import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function sanitizeFilename(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

function inferMimeType(filename: string): string | null {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff'
  return null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseDateToISO(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  // Python extractor devuelve normalmente dd/mm/yyyy
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  // fallback: intentar Date.parse
  const t = Date.parse(value)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    const form = await request.formData()
    const file = form.get('file')
    const clientId = form.get('client_id')
    const uploadId = form.get('upload_id')
    const runExtraction = form.get('run_extraction')
    const tipo = form.get('tipo')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo (file)' }, { status: 400 })
    }
    if (typeof clientId !== 'string' || !clientId.trim()) {
      return NextResponse.json({ error: 'Falta client_id' }, { status: 400 })
    }
    if (typeof uploadId !== 'string' || !uploadId.trim()) {
      return NextResponse.json({ error: 'Falta upload_id' }, { status: 400 })
    }

    const invoiceId = crypto.randomUUID()
    const originalFilename = file.name || 'factura'
    const safeName = sanitizeFilename(originalFilename) || 'factura'
    const bucket = 'invoices'
    const storagePath = `org/${orgId}/upload/${uploadId}/${safeName}`
    const contentType = file.type || inferMimeType(originalFilename) || 'application/octet-stream'

    // Subir primero a Storage; si falla no dejamos registros huérfanos.
    const uploadRes = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType,
      upsert: false,
    })

    if (uploadRes.error) {
      return NextResponse.json(
        { error: uploadRes.error.message || 'Error subiendo el archivo' },
        { status: 500 }
      )
    }

    // Insert en invoices
    const { data: invoiceRow, error: insertError } = await supabase
      .from('invoices')
      .insert({
        id: invoiceId,
        org_id: orgId,
        client_id: clientId,
        upload_id: uploadId,
        bucket,
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: contentType || null,
        file_size_bytes: file.size ?? null,
        uploaded_by: user.id,
        status: 'uploaded',
        error_message: null,
      })
      .select()
      .single()

    if (insertError || !invoiceRow) {
      // best-effort cleanup
      await supabase.storage.from(bucket).remove([storagePath])
      return NextResponse.json(
        { error: insertError?.message || 'Error creando el registro de factura' },
        { status: 500 }
      )
    }

    // Consumir 1 crédito en el ledger (allow_negative=true para pay-as-you-go por ahora)
    try {
      await supabase.rpc('consume_credit', {
        p_org_id: orgId,
        p_invoice_id: invoiceId,
        p_upload_id: uploadId || null,
        p_allow_negative: true, // Cambiar a false cuando apliques límites estrictos por plan
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('insufficient_credits')) {
        return NextResponse.json(
          { error: 'No tienes créditos suficientes. Renueva tu plan o compra un pack.' },
          { status: 402 }
        )
      }
      // Fallback: increment_org_invoices_consumed si la migración ledger aún no está
      try {
        await supabase.rpc('increment_org_invoices_consumed', { p_org_id: orgId })
      } catch {
        // Ignorar si las migraciones aún no se han ejecutado
      }
    }

    // URL firmada para previsualización (válida 1h)
    const expiresIn = 60 * 60 * 24 * 7 // 7 días (como en el panel)
    let previewUrl: string | null = null

    const signed = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
    if (!signed.error) {
      previewUrl = signed.data?.signedUrl ?? null
    } else {
      const admin = createAdminClient()
      if (admin) {
        const adminSigned = await admin.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
        previewUrl = adminSigned.data?.signedUrl ?? null
      }
    }

    let extraction: unknown = null
    let extractedFields: Record<string, unknown> | null = null

    const shouldExtract =
      (typeof runExtraction === 'string' ? runExtraction : '').toLowerCase() === 'true' ||
      runExtraction === '1'

    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL

    if (shouldExtract && extractorUrl) {
      try {
        // Estado: processing
        await supabase
          .from('invoices')
          .update({ status: 'processing', error_message: null })
          .eq('id', invoiceId)

        const fd = new FormData()
        fd.append('file', file)
        const tipoNorm = typeof tipo === 'string' ? tipo.trim().toUpperCase() : ''
        if (tipoNorm === 'INGRESO' || tipoNorm === 'GASTO') fd.append('tipo', tipoNorm)

        // Si es GASTO, enviar CIF de la empresa (cliente contable) para que el extractor identifique al proveedor
        if (tipoNorm === 'GASTO' && clientId) {
          const { data: clientRow } = await supabase
            .from('clients')
            .select('tax_id')
            .eq('id', clientId)
            .eq('org_id', orgId)
            .single()
          const cifEmpresa = typeof clientRow?.tax_id === 'string' ? clientRow.tax_id.trim() : ''
          if (cifEmpresa) fd.append('cif_empresa', cifEmpresa)
        }

        const resp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/upload`, {
          method: 'POST',
          body: fd,
        })

        const json = await resp.json().catch(() => null)

        if (!resp.ok || !json?.success) {
          const msg = json?.detail || json?.error || 'Error en extracción'
          await supabase
            .from('invoices')
            .update({ status: 'error', error_message: String(msg) })
            .eq('id', invoiceId)
        } else {
          const factura = json?.factura ?? json
          extraction = factura

          await supabase.from('invoice_extractions').insert({
            invoice_id: invoiceId,
            raw_json: factura,
            model: 'regex-v1',
            confidence: null,
          })

          // Mapear a invoice_fields (mínimo). En GASTO preferir proveedor/proveedor_nif (emisor)
          const invoice_number =
            typeof factura?.numero_factura === 'string' ? factura.numero_factura : null
          const invoice_date = parseDateToISO(factura?.fecha)
          const base_amount = parseNumber(factura?.importe_base)
          const vat_amount = parseNumber(factura?.iva)
          const total_amount = parseNumber(factura?.total)
          const vat_rate = parseNumber(factura?.porcentaje_iva)
          const supplier_name =
            tipoNorm === 'GASTO' && typeof factura?.proveedor === 'string' && factura.proveedor
              ? factura.proveedor
              : typeof factura?.cliente === 'string'
                ? factura.cliente
                : null
          const supplier_tax_id =
            tipoNorm === 'GASTO' && typeof factura?.proveedor_nif === 'string' && factura.proveedor_nif
              ? factura.proveedor_nif
              : typeof factura?.cliente_nif === 'string'
                ? factura.cliente_nif
                : typeof factura?.nif_cliente === 'string'
                  ? factura.nif_cliente
                  : typeof factura?.nif === 'string'
                    ? factura.nif
                    : null

          extractedFields = {
            supplier_name,
            supplier_tax_id,
            invoice_number,
            invoice_date,
            base_amount,
            vat_amount,
            total_amount,
            vat_rate,
          }

          await supabase.from('invoice_fields').upsert(
            {
              invoice_id: invoiceId,
              supplier_name,
              supplier_tax_id,
              invoice_number,
              invoice_date,
              base_amount,
              vat_amount,
              total_amount,
              vat_rate,
              updated_by: user.id,
            },
            { onConflict: 'invoice_id' }
          )

          // Estado: needs_review (pendiente de validación)
          await supabase
            .from('invoices')
            .update({ status: 'needs_review', error_message: null })
            .eq('id', invoiceId)
        }
      } catch (e) {
        await supabase
          .from('invoices')
          .update({
            status: 'error',
            error_message: `Error extracción: ${e instanceof Error ? e.message : 'unknown'}`,
          })
          .eq('id', invoiceId)
      }
    }

    return NextResponse.json(
      {
        success: true,
        invoice: invoiceRow,
        previewUrl,
        extraction,
        extractedFields,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error inesperado en /api/invoices/upload:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


