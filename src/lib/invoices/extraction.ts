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

/**
 * Si el total de la factura coincide con la suma (base + IVA) de las líneas de ivas,
 * la factura no tiene recargo de equivalencia (aunque la plantilla tenga la columna vacía).
 * Ponemos recargo a 0 para no inflar totales.
 */
function normalizeRecargoWhenTotalEqualsBasePlusIva(factura: Record<string, unknown>): void {
  const total = parseNumber(factura.total)
  const rawIvas = factura.ivas
  if (!Array.isArray(rawIvas) || total === null) return

  let sumBasePlusIva = 0
  for (const item of rawIvas) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const base = parseNumber(it.base ?? it.base_imponible)
    const iva = parseNumber(it.iva ?? it.iva_importe ?? it.cuota ?? it.cuota_iva)
    sumBasePlusIva += (base ?? 0) + (iva ?? 0)
  }
  sumBasePlusIva = Math.round(sumBasePlusIva * 100) / 100
  if (Math.abs(sumBasePlusIva - total) > 0.02) return

  factura.recargo_equivalencia = false
  factura.recargo_equivalencia_importe = 0
  for (const item of rawIvas) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    it.recargo = 0
    it.porcentaje_recargo = 0
    it.recargo_importe = 0
    it.recargo_equivalencia_importe = 0
  }
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
  /** CIF de la empresa (cliente/receptor) para GASTO; la IA lo usa para identificar al proveedor */
  cifEmpresa?: string | null
  /** Lista de proveedores ya conocidos de esta empresa para ayudar a la IA (en GASTO) */
  proveedoresConocidos?: { nombre: string; nif: string; direccion?: string; cp?: string; provincia?: string }[]
}) {
  const { supabase, userId, orgId, invoiceId, extractorUrl, tipo, cifEmpresa, proveedoresConocidos } = params

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, org_id, bucket, storage_path, original_filename, mime_type, status')
    .eq('id', invoiceId)
    .single()

  if (invoiceError || !invoice) {
    return { ok: false as const, error: 'Factura no encontrada' }
  }
  if (invoice.org_id !== orgId) {
    return { ok: false as const, error: 'Sin permisos' }
  }

  const invoiceObj = invoice && typeof invoice === 'object' ? (invoice as Record<string, unknown>) : null
  const currentStatus = typeof invoiceObj?.status === 'string' ? invoiceObj.status : null

  const fail = async (msg: string) => {
    try {
      // No degradamos una factura ya validada
      if (currentStatus !== 'ready') {
        await supabase.from('invoices').update({ status: 'error', error_message: msg }).eq('id', invoiceId)
      }
    } catch {
      // noop
    }
    return { ok: false as const, error: msg }
  }

  // Estado: processing (si no está ya validada)
  if (currentStatus !== 'ready') {
    try {
      await supabase.from('invoices').update({ status: 'processing', error_message: null }).eq('id', invoiceId)
    } catch {
      // noop
    }
  }

  // Backend ahora soporta PDF con texto, PDF escaneado (OCR) e imágenes (OCR).

  const signedUrl = await createSignedUrlWithFallback(
    supabase,
    invoice.bucket,
    invoice.storage_path,
    60 * 60 * 24 * 7
  )

  if (!signedUrl) {
    return await fail('No se pudo obtener URL firmada del archivo')
  }

  const fileResp = await fetch(signedUrl)
  if (!fileResp.ok) {
    return await fail(`No se pudo descargar el archivo (${fileResp.status})`)
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
  if (tipoNorm === 'GASTO' && typeof cifEmpresa === 'string' && cifEmpresa.trim()) {
    fd.append('cif_empresa', cifEmpresa.trim())
  }
  if (tipoNorm === 'GASTO' && proveedoresConocidos && proveedoresConocidos.length > 0) {
    fd.append('proveedores_conocidos', JSON.stringify(proveedoresConocidos))
  }

  const resp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/upload`, {
    method: 'POST',
    body: fd,
  })

  const json = await resp.json().catch(() => null)
  if (!resp.ok || !json?.success) {
    const facturaErr =
      typeof json?.factura?.error === 'string'
        ? json.factura.error
        : typeof json?.factura?.error_message === 'string'
          ? json.factura.error_message
          : null
    const msg =
      json?.detail ||
      json?.error ||
      facturaErr ||
      json?.message ||
      'Error en extracción'
    return await fail(String(msg))
  }

  const factura = json?.factura ?? json
  const facturaObj = factura && typeof factura === 'object' ? (factura as Record<string, unknown>) : null
  if (facturaObj) {
    normalizeRecargoWhenTotalEqualsBasePlusIva(facturaObj)
  }

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
  // En GASTO el extractor puede devolver "proveedor"/"proveedor_nif" (emisor); preferirlos para no confundir con "Cliente" del documento (receptor)
  const supplier_name =
    (tipo && String(tipo).toUpperCase() === 'GASTO' && typeof factura?.proveedor === 'string' && factura.proveedor)
      ? factura.proveedor
      : typeof factura?.cliente === 'string'
        ? factura.cliente
        : null
  const supplier_tax_id =
    (tipo && String(tipo).toUpperCase() === 'GASTO' && typeof factura?.proveedor_nif === 'string' && factura.proveedor_nif)
      ? factura.proveedor_nif
      : typeof factura?.cliente_nif === 'string'
        ? factura.cliente_nif
        : typeof factura?.nif_cliente === 'string'
          ? factura.nif_cliente
          : typeof factura?.nif === 'string'
            ? factura.nif
            : null

  // Si la extracción trae desglose de IVAs, vat_rate puede no ser representativo (por ejemplo 0 con varios tipos).
  // En ese caso, guardamos vat_rate solo si hay un único porcentaje en el desglose; si hay varios, lo dejamos null.
  let vat_rate_to_store: number | null = vat_rate
  const rawIvasValue =
    factura && typeof factura === 'object' ? (factura as Record<string, unknown>)?.ivas : null
  const rawIvas: unknown[] = Array.isArray(rawIvasValue) ? rawIvasValue : []
  if (rawIvas.length > 0) {
    const rates = new Set<number>()
    for (const it of rawIvas) {
      if (!it || typeof it !== 'object') continue
      const itObj = it as Record<string, unknown>
      const r = parseNumber(itObj.porcentaje_iva ?? itObj.porcentaje ?? itObj.tipo)
      if (typeof r === 'number' && Number.isFinite(r)) rates.add(r)
    }
    vat_rate_to_store = rates.size === 1 ? [...rates][0] : null
  } else if (vat_rate_to_store === 0 && (vat_amount || 0) > 0) {
    // 0% con IVA > 0 no tiene sentido -> mejor null que un 0 engañoso
    vat_rate_to_store = null
  }

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
        vat_rate: vat_rate_to_store,
        updated_by: userId,
      },
      { onConflict: 'invoice_id' }
    )
    .select()
    .single()

  if (fieldsError) {
    return await fail(fieldsError.message || 'Error guardando campos')
  }

  // Estado: needs_review (si no está ya validada)
  if (currentStatus !== 'ready') {
    try {
      await supabase
        .from('invoices')
        .update({ status: 'needs_review', error_message: null })
        .eq('id', invoiceId)
    } catch {
      // noop
    }
  }

  return { ok: true as const, extraction: factura, fields }
}


