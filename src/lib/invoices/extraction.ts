import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  const m = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`)
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  const t = Date.parse(value)
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  return null
}

async function createSignedUrlWithFallback(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number
) {
  const userSigned = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (!userSigned.error && userSigned.data?.signedUrl) return userSigned.data.signedUrl

  const admin = createAdminClient()
  if (!admin) return null

  const adminSigned = await admin.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (!adminSigned.error && adminSigned.data?.signedUrl) return adminSigned.data.signedUrl

  return null
}

export async function extractInvoiceAndPersist(params: {
  supabase: SupabaseClient
  userId: string
  orgId: string
  invoiceId: string
  extractorUrl: string
  tipo?: 'gasto' | 'ingreso' | 'GASTO' | 'INGRESO'
}) {
  const { supabase, userId, orgId, invoiceId, extractorUrl, tipo } = params

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, org_id, bucket, storage_path, original_filename, mime_type')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { ok: false as const, error: 'Factura no encontrada' }
  }
  if (invoice.org_id !== orgId) {
    return { ok: false as const, error: 'Sin permisos' }
  }

  // Backend ahora soporta PDF con texto, PDF escaneado (OCR) e imágenes (OCR).

  const signedUrl = await createSignedUrlWithFallback(
    supabase,
    invoice.bucket,
    invoice.storage_path,
    60 * 60 * 24 * 7
  )

  if (!signedUrl) {
    return { ok: false as const, error: 'No se pudo obtener URL firmada del archivo' }
  }

  const fileResp = await fetch(signedUrl)
  if (!fileResp.ok) {
    return { ok: false as const, error: `No se pudo descargar el archivo (${fileResp.status})` }
  }

  const arrayBuf = await fileResp.arrayBuffer()
  const filename = invoice.original_filename || 'factura.pdf'
  const contentType = invoice.mime_type || 'application/pdf'
  const blob = new Blob([arrayBuf], { type: contentType })

  const fd = new FormData()
  fd.append('file', blob, filename)
  const tipoNorm =
    String(tipo || '')
      .trim()
      .toUpperCase() === 'INGRESO'
      ? 'INGRESO'
      : String(tipo || '')
            .trim()
            .toUpperCase() === 'GASTO'
        ? 'GASTO'
        : null
  if (tipoNorm) fd.append('tipo', tipoNorm)

  const resp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/upload`, {
    method: 'POST',
    body: fd,
  })

  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.success) {
    const msg = json?.detail || json?.error || 'Error en extracción'
    await supabase.from('invoices').update({ error_message: String(msg) }).eq('id', invoiceId)
    return { ok: false as const, error: String(msg) }
  }

  const factura = json?.factura ?? json

  await supabase.from('invoice_extractions').insert({
    invoice_id: invoiceId,
    raw_json: factura,
    model: 'regex-v1',
    confidence: null,
  })

  const invoice_number = typeof factura?.numero_factura === 'string' ? factura.numero_factura : null
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

  const { data: fields, error: fieldsError } = await supabase
    .from('invoice_fields')
    .upsert(
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
        updated_by: userId,
      },
      { onConflict: 'invoice_id' }
    )
    .select()
    .single()

  if (fieldsError) {
    return { ok: false as const, error: fieldsError.message || 'Error guardando campos' }
  }

  return { ok: true as const, extraction: factura, fields }
}


