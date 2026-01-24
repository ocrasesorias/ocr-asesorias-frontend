import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgId = memberships[0].org_id as string

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
        const fd = new FormData()
        fd.append('file', file)
        const tipoNorm = typeof tipo === 'string' ? tipo.trim().toUpperCase() : ''
        if (tipoNorm === 'INGRESO' || tipoNorm === 'GASTO') fd.append('tipo', tipoNorm)

        const resp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/upload`, {
          method: 'POST',
          body: fd,
        })

        const json = await resp.json().catch(() => null)

        if (!resp.ok || !json?.success) {
          const msg = json?.detail || json?.error || 'Error en extracción'
          await supabase.from('invoices').update({ error_message: String(msg) }).eq('id', invoiceId)
        } else {
          const factura = json?.factura ?? json
          extraction = factura

          await supabase.from('invoice_extractions').insert({
            invoice_id: invoiceId,
            raw_json: factura,
            model: 'regex-v1',
            confidence: null,
          })

          // Mapear a invoice_fields (mínimo)
          const invoice_number =
            typeof factura?.numero_factura === 'string' ? factura.numero_factura : null
          const invoice_date = parseDateToISO(factura?.fecha)
          const base_amount = parseNumber(factura?.importe_base)
          const vat_amount = parseNumber(factura?.iva)
          const total_amount = parseNumber(factura?.total)
          const vat_rate = parseNumber(factura?.porcentaje_iva)
          const supplier_name = typeof factura?.cliente === 'string' ? factura.cliente : null
          const supplier_tax_id =
            typeof factura?.cliente_nif === 'string'
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
        }
      } catch (e) {
        await supabase
          .from('invoices')
          .update({ error_message: `Error extracción: ${e instanceof Error ? e.message : 'unknown'}` })
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


