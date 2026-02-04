'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Button } from '@/components/Button'
import { ValidarFactura } from '@/components/ValidarFactura'
import { FacturaData } from '@/types/factura'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'

type UploadInvoiceRow = {
  id: string
  bucket: string
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  invoice_extractions?: Array<{
    raw_json: unknown
    created_at: string
  }>
  invoice_fields?:
  | {
    supplier_name: string | null
    supplier_tax_id: string | null
    invoice_number: string | null
    invoice_date: string | null
    base_amount: string | number | null
    vat_amount: string | number | null
    total_amount: string | number | null
    vat_rate: string | number | null
  }
  | Array<{
    supplier_name: string | null
    supplier_tax_id: string | null
    invoice_number: string | null
    invoice_date: string | null
    base_amount: string | number | null
    vat_amount: string | number | null
    total_amount: string | number | null
    vat_rate: string | number | null
  }>
}

type InvoiceFieldsRow = {
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  base_amount: string | number | null
  vat_amount: string | number | null
  total_amount: string | number | null
  vat_rate: string | number | null
}

function coerceInvoiceFieldsRow(value: unknown): InvoiceFieldsRow | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Record<keyof InvoiceFieldsRow, unknown>>
  // Chequeo mínimo: que exista al menos una clave esperada
  const hasAny =
    'supplier_name' in v ||
    'supplier_tax_id' in v ||
    'invoice_number' in v ||
    'invoice_date' in v ||
    'base_amount' in v ||
    'vat_amount' in v ||
    'total_amount' in v ||
    'vat_rate' in v
  if (!hasAny) return null
  return value as InvoiceFieldsRow
}

function getLatestExtraction(inv: UploadInvoiceRow): Record<string, unknown> | null {
  const arr = Array.isArray(inv.invoice_extractions) ? inv.invoice_extractions : []
  if (arr.length === 0) return null
  const latest = [...arr].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
  const raw = latest?.raw_json
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

type RetencionPorcentaje = FacturaData['retencion']['porcentaje']
type RetencionTipo = FacturaData['retencion']['tipo']

function toRetencionPorcentaje(pct: number | null): RetencionPorcentaje {
  if (pct === null) return ''
  const r = Math.round(Math.abs(pct))
  if (r === 7) return '7%'
  if (r === 15) return '15%'
  if (r === 17) return '17%'
  if (r === 19) return '19%'
  return ''
}

function defaultRetencionTipo(hasRetencion: boolean): RetencionTipo {
  return hasRetencion ? 'PROFESIONAL' : ''
}

function toNumLoose(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const s = value.trim().replace(/\u00A0/g, ' ').replace(/€/g, '').replace(/\s+/g, '')
    if (!s) return null
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

type ExtractedIvaLine = { base: number | null; porcentaje: number | null; iva: number | null }

function extractIvaLinesFromExtraction(ex: Record<string, unknown> | null): ExtractedIvaLine[] {
  const raw = ex?.ivas
  if (!Array.isArray(raw)) return []

  const out: ExtractedIvaLine[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const it = item as Record<string, unknown>
    const base = toNumLoose(it.base_imponible ?? it.base)
    const porcentaje = toNumLoose(it.porcentaje_iva ?? it.porcentaje ?? it.tipo)
    const iva = toNumLoose(it.iva_importe ?? it.iva ?? it.cuota ?? it.cuota_iva)
    if (base === null && porcentaje === null && iva === null) continue
    out.push({ base, porcentaje, iva })
  }

  // Consolidar por porcentaje (evita duplicados)
  const merged = new Map<number, { base: number; iva: number }>()
  for (const l of out) {
    const pct = l.porcentaje
    if (pct === null || !Number.isFinite(pct)) continue
    const key = Math.round(pct * 100) / 100
    const cur = merged.get(key) || { base: 0, iva: 0 }
    merged.set(key, {
      base: cur.base + (l.base ?? 0),
      iva: cur.iva + (l.iva ?? 0),
    })
  }

  const result: ExtractedIvaLine[] = []
  for (const [pct, vals] of merged.entries()) {
    result.push({
      porcentaje: pct,
      base: Math.round(vals.base * 100) / 100,
      iva: Math.round(vals.iva * 100) / 100,
    })
  }

  return result.sort((a, b) => (b.porcentaje ?? 0) - (a.porcentaje ?? 0))
}

function applyExtractedIvasToLineas(params: {
  lineas: FacturaData['lineas']
  extracted: ExtractedIvaLine[]
  overwrite: boolean
}): FacturaData['lineas'] {
  const { extracted, overwrite } = params
  const lineas = [...params.lineas]
  if (extracted.length === 0) return lineas

  const parsePct = (v: string) => {
    const raw = String(v || '').replace('%', '').trim().replace(',', '.')
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  const findIndexByPct = (pct: number) => {
    for (let i = 0; i < lineas.length; i += 1) {
      const n = parsePct(lineas[i]?.porcentajeIva || '')
      if (n !== null && Math.abs(n - pct) < 0.01) return i
    }
    return -1
  }

  for (const l of extracted) {
    if (l.porcentaje === null || !Number.isFinite(l.porcentaje)) continue
    const pct = Math.round(l.porcentaje * 100) / 100
    let idx = findIndexByPct(pct)
    if (idx === -1) {
      lineas.push({
        base: '',
        porcentajeIva: String(pct),
        cuotaIva: '',
        porcentajeRecargo: '0',
        cuotaRecargo: '0.00',
      })
      idx = lineas.length - 1
    }

    const cur = { ...lineas[idx] }
    if (overwrite || !cur.porcentajeIva?.trim()) cur.porcentajeIva = String(pct)
    if (l.base !== null && (overwrite || !cur.base?.trim())) cur.base = String(l.base)
    if (l.iva !== null && (overwrite || !cur.cuotaIva?.trim())) cur.cuotaIva = String(l.iva)
    lineas[idx] = cur
  }

  return lineas
}

function toFacturaData(
  inv: UploadInvoiceRow,
  previewUrl: string,
  opts?: { clientTaxId?: string | null; defaultSubcuenta?: string }
): FacturaData {
  const f = Array.isArray(inv.invoice_fields) ? inv.invoice_fields[0] : inv.invoice_fields || undefined
  const ex = getLatestExtraction(inv)
  const isPdf =
    (inv.mime_type || '').toLowerCase().includes('pdf') ||
    (inv.original_filename || '').toLowerCase().endsWith('.pdf')

  const base = f?.base_amount ?? null
  const vat = f?.vat_amount ?? null
  const total = f?.total_amount ?? null
  const vatRate = f?.vat_rate ?? null

  const exCliente = typeof ex?.cliente === 'string' ? (ex.cliente as string) : ''
  const exNif = typeof ex?.cliente_nif === 'string' ? (ex.cliente_nif as string) : ''
  const exDireccion = typeof ex?.cliente_direccion === 'string' ? (ex.cliente_direccion as string) : ''
  const exCp = typeof ex?.cliente_codigo_postal === 'string' ? (ex.cliente_codigo_postal as string) : ''
  const exProv = typeof ex?.cliente_provincia === 'string' ? (ex.cliente_provincia as string) : ''
  const exRetPct = toNumLoose(ex?.retencion_porcentaje)
  const exRetImp = toNumLoose(ex?.retencion_importe)
  const hasRetencion = Boolean((exRetPct && Math.abs(exRetPct) > 0) || (exRetImp && Math.abs(exRetImp) > 0))

  const extractedIvas = extractIvaLinesFromExtraction(ex)

  // Si tenemos desglose de IVAs, preferimos rellenar desde ahí (evita el caso "IVA total" con porcentaje 0).
  // Si no hay desglose, caemos al comportamiento legacy (1 sola línea con base/iva/%).
  const baseLineas: FacturaData['lineas'] =
    extractedIvas.length > 0
      ? [
          { base: '', porcentajeIva: '21', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
          { base: '', porcentajeIva: '10', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
          { base: '', porcentajeIva: '4', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
        ]
      : [
          {
            base: base !== null ? String(base) : '',
            porcentajeIva: vatRate !== null ? String(vatRate) : '21',
            cuotaIva: vat !== null ? String(vat) : '',
            porcentajeRecargo: '0',
            cuotaRecargo: '0.00',
          },
          { base: '', porcentajeIva: '10', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
          { base: '', porcentajeIva: '4', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
        ]

  const lineas = applyExtractedIvasToLineas({ lineas: baseLineas, extracted: extractedIvas, overwrite: true })

  return {
    empresa: { cif: opts?.clientTaxId || 'B12345678', trimestre: 'Q1', actividad: '' },
    proveedor: {
      nombre: f?.supplier_name || exCliente || '',
      cif: f?.supplier_tax_id || exNif || '',
      direccion: exDireccion || '',
      codigoPostal: exCp || '',
      provincia: exProv || '',
    },
    factura: {
      numero: f?.invoice_number || '',
      fecha: f?.invoice_date ? String(f.invoice_date) : '',
      fechaVencimiento: '',
    },
    subcuentaGasto: opts?.defaultSubcuenta || '',
    retencion: {
      aplica: hasRetencion,
      porcentaje: toRetencionPorcentaje(exRetPct),
      // No tenemos tipo en extracción; por defecto "PROFESIONAL" si hay retención
      tipo: defaultRetencionTipo(hasRetencion),
      cantidad: exRetImp !== null ? String(Math.abs(exRetImp)) : '',
    },
    lineas,
    anexosObservaciones: '',
    total: total !== null ? String(total) : '',
    archivo: {
      url: previewUrl,
      tipo: isPdf ? 'pdf' : 'imagen',
      nombre: inv.original_filename || 'factura',
      invoiceId: inv.id,
      bucket: inv.bucket,
      storagePath: inv.storage_path,
    },
  }
}

export default function ValidarUploadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const uploadId = params.id
  const { showError, showSuccess, showInfo, setToastConfig } = useToast()

  const BLOCK_SIZE = 6
  const MAX_CONCURRENCY = 3

  const [isLoading, setIsLoading] = useState(true)
  const [facturaActual, setFacturaActual] = useState(0)
  const [facturas, setFacturas] = useState<FacturaData[]>([])
  const [facturaRevisions, setFacturaRevisions] = useState<Record<string, number>>({})
  const [invoiceRows, setInvoiceRows] = useState<UploadInvoiceRow[]>([])
  const [invoiceStatus, setInvoiceStatus] = useState<Record<string, 'idle' | 'processing' | 'ready' | 'error'>>({})
  const [validatedByInvoiceId, setValidatedByInvoiceId] = useState<Record<string, true>>({})
  const [deferredByInvoiceId, setDeferredByInvoiceId] = useState<Record<string, true>>({})
  const [visitedByInvoiceId, setVisitedByInvoiceId] = useState<Record<string, true>>({})
  const inFlightRef = useRef(0)
  const startedRef = useRef<Record<string, true>>({})
  const [clienteNombre, setClienteNombre] = useState<string>('')
  const [tipoFactura, setTipoFactura] = useState<'gasto' | 'ingreso'>('gasto')

  const [isFinishedModalOpen, setIsFinishedModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const statusStats = useMemo(() => {
    const total = invoiceRows.length
    let ready = 0
    let processing = 0
    let error = 0
    let idle = 0
    for (const inv of invoiceRows) {
      const st = invoiceStatus[inv.id]
      if (st === 'ready') ready += 1
      else if (st === 'processing') processing += 1
      else if (st === 'error') error += 1
      else idle += 1
    }
    const done = ready + error
    const percent = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, ready, processing, error, idle, done, percent }
  }, [invoiceRows, invoiceStatus])

  const validatedStats = useMemo(() => {
    const total = invoiceRows.length
    let validated = 0
    for (const inv of invoiceRows) {
      if (validatedByInvoiceId[inv.id]) validated += 1
    }
    const percent = total > 0 ? Math.round((validated / total) * 100) : 0
    return { total, validated, percent }
  }, [invoiceRows, validatedByInvoiceId])

  const allValidated = useMemo(() => {
    return validatedStats.total > 0 && validatedStats.validated >= validatedStats.total
  }, [validatedStats.total, validatedStats.validated])

  const persistIdSet = (key: string, rec: Record<string, true>) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(Object.keys(rec)))
    } catch {
      // noop
    }
  }

  const restoreIdSet = (key: string): Set<string> => {
    try {
      const raw = sessionStorage.getItem(key)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === 'string'))
    } catch {
      // noop
    }
    return new Set()
  }

  const prefixDoneCount = useMemo(() => {
    // cuántas facturas consecutivas (desde la primera) ya están "procesadas" (ready o error)
    let c = 0
    for (const inv of invoiceRows) {
      const st = invoiceStatus[inv.id]
      if (st === 'ready' || st === 'error') c += 1
      else break
    }
    return c
  }, [invoiceRows, invoiceStatus])

  const unlockedMaxIndex = useMemo(() => {
    // desbloqueamos navegación por bloques de 6 (0-5, luego 0-11, etc.)
    // Importante: el último bloque puede tener 1..5 facturas (si total no es múltiplo de 6).
    if (invoiceRows.length === 0) return -1
    const total = invoiceRows.length
    let unlockedCount = 0
    for (let start = 0; start < total; start += BLOCK_SIZE) {
      const end = Math.min(total, start + BLOCK_SIZE) // fin exclusivo del bloque
      if (prefixDoneCount >= end) unlockedCount = end
      else break
    }
    return unlockedCount - 1
  }, [invoiceRows.length, prefixDoneCount, BLOCK_SIZE])

  const initialGateReady = useMemo(() => {
    // no mostramos validar hasta que estén listas las primeras 6 (o menos si hay <6)
    const need = Math.min(BLOCK_SIZE, invoiceRows.length)
    return need > 0 && prefixDoneCount >= need
  }, [invoiceRows.length, prefixDoneCount, BLOCK_SIZE])

  useEffect(() => {
    // En esta pantalla: toasts arriba centrados y sin apilar (máx 1).
    setToastConfig({ position: 'top-center', maxToasts: 1 })
    return () => setToastConfig(null)
  }, [setToastConfig])

  useEffect(() => {
    // Resolver tipo de la subida: preferimos query param, y si no existe usamos sessionStorage (fallback)
    const qp = (searchParams.get('tipo') || '').toLowerCase()
    if (qp === 'gasto' || qp === 'ingreso') {
      setTipoFactura(qp)
    } else {
      try {
        const st = (sessionStorage.getItem(`upload:${uploadId}:tipo`) || '').toLowerCase()
        if (st === 'gasto' || st === 'ingreso') setTipoFactura(st as 'gasto' | 'ingreso')
      } catch {
        // noop
      }
    }

    const run = async () => {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push(`/login?redirect=/dashboard/uploads/${uploadId}/validar`)
          return
        }

        const resp = await fetch(`/api/uploads/${uploadId}`)
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || 'Error cargando la subida')

        const upload = data.upload
        const uploadTipo = String(upload?.tipo || '').toLowerCase()
        const tipoLocal = (uploadTipo === 'gasto' || uploadTipo === 'ingreso' ? uploadTipo : 'gasto') as
          | 'gasto'
          | 'ingreso'
        if (uploadTipo === 'gasto' || uploadTipo === 'ingreso') {
          setTipoFactura(uploadTipo as 'gasto' | 'ingreso')
          try {
            sessionStorage.setItem(`upload:${uploadId}:tipo`, uploadTipo)
          } catch {
            // noop
          }
        }
        const client = upload?.clients
        setClienteNombre(client?.name || '')
        const defaultSubcuenta =
          tipoLocal === 'ingreso'
            ? (client?.preferred_income_account as string | null) || '700'
            : (client?.preferred_expense_account as string | null) || '600'

        const invoices: UploadInvoiceRow[] = Array.isArray(upload?.invoices) ? upload.invoices : []

        // Crear previews (firmadas 7 días) por invoice
        const previews = await Promise.all(
          invoices.map(async (inv) => {
            const r = await fetch(`/api/invoices/${inv.id}/preview?expires=${60 * 60 * 24 * 7}`)
            const j = await r.json().catch(() => null)
            return { invoiceId: inv.id, url: r.ok ? j?.signedUrl || '' : '' }
          })
        )
        const previewRecord: Record<string, string> = {}
        for (const p of previews) previewRecord[p.invoiceId] = p.url || ''

        setInvoiceRows(invoices)

        const mapped = invoices.map((inv) =>
          toFacturaData(inv, previewRecord[inv.id] || '', { clientTaxId: client?.tax_id, defaultSubcuenta })
        )
        setFacturas(mapped)

        // Restaurar estado de sesión (validada / para después / visitada)
        const validatedSet = restoreIdSet(`upload:${uploadId}:validatedIds`)
        const deferredSet = restoreIdSet(`upload:${uploadId}:deferredIds`)
        const visitedSet = restoreIdSet(`upload:${uploadId}:visitedIds`)

        const vRec: Record<string, true> = {}
        const dRec: Record<string, true> = {}
        const visRec: Record<string, true> = {}
        for (const inv of invoices) {
          if (validatedSet.has(inv.id)) vRec[inv.id] = true
          if (deferredSet.has(inv.id)) dRec[inv.id] = true
          if (visitedSet.has(inv.id)) visRec[inv.id] = true
        }
        setValidatedByInvoiceId(vRec)
        setDeferredByInvoiceId(dRec)
        setVisitedByInvoiceId(visRec)

        // Estado inicial por factura: si ya tiene fields/extraction, la consideramos lista.
        const initialStatus: Record<string, 'idle' | 'processing' | 'ready' | 'error'> = {}
        for (const inv of invoices) {
          const f = Array.isArray(inv.invoice_fields) ? inv.invoice_fields[0] : inv.invoice_fields || undefined
          const latestEx = getLatestExtraction(inv)
          const hasFields = Boolean(
            f?.supplier_name ||
            f?.supplier_tax_id ||
            f?.invoice_number ||
            f?.invoice_date ||
            f?.base_amount ||
            f?.vat_amount ||
            f?.total_amount
          )
          const hasExtraction = Boolean(latestEx)

          // Auto-reintento: si antes se guardó un IVA con % = 0 pero con cuota > 0 (caso típico de facturas con varios IVAs),
          // forzamos una nueva extracción para intentar obtener el desglose.
          const vatRateN = toNumLoose(f?.vat_rate)
          const vatAmountN = toNumLoose(f?.vat_amount)
          const exIvasValue = latestEx ? latestEx['ivas'] : null
          const exHasIvas = Array.isArray(exIvasValue) && exIvasValue.length > 0
          const needsReextract = Boolean(vatRateN === 0 && (vatAmountN || 0) > 0 && !exHasIvas)

          initialStatus[inv.id] = needsReextract ? 'idle' : hasFields || hasExtraction ? 'ready' : 'idle'
        }
        setInvoiceStatus(initialStatus)
        startedRef.current = {}

      } catch (e) {
        showError(e instanceof Error ? e.message : 'Error cargando la subida')
      } finally {
        setIsLoading(false)
      }
    }

    run()
  }, [router, uploadId, showError, searchParams])

  // Marcar como "visitada" la factura actual (para colorear barra)
  useEffect(() => {
    const id = invoiceRows[facturaActual]?.id
    if (!id) return
    setVisitedByInvoiceId((prev) => {
      if (prev[id]) return prev
      const next = { ...prev, [id]: true as const }
      persistIdSet(`upload:${uploadId}:visitedIds`, next)
      return next
    })
  }, [facturaActual, invoiceRows, uploadId])

  const clientTaxId = useMemo(() => {
    // Preferimos el CIF que ya está en FacturaData.empresa.cif
    return facturas?.[0]?.empresa?.cif || null
  }, [facturas])

  const bumpRevision = (invoiceId: string) => {
    setFacturaRevisions((prev) => ({ ...prev, [invoiceId]: (prev[invoiceId] || 0) + 1 }))
  }

  const patchFacturaFromExtraction = (prevFactura: FacturaData, extraction: unknown, fields: InvoiceFieldsRow | null) => {
    const ex = (extraction && typeof extraction === 'object' ? (extraction as Record<string, unknown>) : null) || null
    const exCliente = typeof ex?.cliente === 'string' ? (ex.cliente as string) : ''
    const exNif = typeof ex?.cliente_nif === 'string' ? (ex.cliente_nif as string) : ''
    const exDireccion = typeof ex?.cliente_direccion === 'string' ? (ex.cliente_direccion as string) : ''
    const exCp = typeof ex?.cliente_codigo_postal === 'string' ? (ex.cliente_codigo_postal as string) : ''
    const exProv = typeof ex?.cliente_provincia === 'string' ? (ex.cliente_provincia as string) : ''
    const exNumero = typeof ex?.numero_factura === 'string' ? (ex.numero_factura as string) : ''
    const exFecha = typeof ex?.fecha === 'string' ? (ex.fecha as string) : ''

    const supplierName = fields?.supplier_name || exCliente || ''
    const supplierTaxId = fields?.supplier_tax_id || exNif || ''
    const invoiceNumber = fields?.invoice_number || exNumero || ''
    const invoiceDate = fields?.invoice_date ? String(fields.invoice_date) : exFecha || ''

    const base = fields?.base_amount ?? null
    const vat = fields?.vat_amount ?? null
    const total = fields?.total_amount ?? null
    const vatRate = fields?.vat_rate ?? null

    const next = { ...prevFactura }
    // Solo rellenamos si está vacío (no pisamos lo que el usuario haya editado).
    if (!next.proveedor.nombre && supplierName) next.proveedor.nombre = supplierName
    if (!next.proveedor.cif && supplierTaxId) next.proveedor.cif = supplierTaxId
    if (!next.proveedor.direccion && exDireccion) next.proveedor.direccion = exDireccion
    if (!next.proveedor.codigoPostal && exCp) next.proveedor.codigoPostal = exCp
    if (!next.proveedor.provincia && exProv) next.proveedor.provincia = exProv

    if (!next.factura.numero && invoiceNumber) next.factura.numero = invoiceNumber
    if (!next.factura.fecha && invoiceDate) next.factura.fecha = invoiceDate

    const line0 = next.lineas?.[0] ? { ...next.lineas[0] } : null
    if (line0) {
      if (!line0.base && base !== null) line0.base = String(base)
      if (!line0.cuotaIva && vat !== null) line0.cuotaIva = String(vat)
      if ((!line0.porcentajeIva || !String(line0.porcentajeIva).trim()) && vatRate !== null) line0.porcentajeIva = String(vatRate)
      next.lineas = [line0, ...next.lineas.slice(1)]
    }
    if (!next.total && total !== null) next.total = String(total)

    // Si viene desglose de IVAs, rellenamos líneas.
    // Heurística: si antes nos llegó un "IVA total" con porcentaje 0, lo limpiamos y aplicamos el desglose.
    const extractedIvas = extractIvaLinesFromExtraction(ex)
    if (extractedIvas.length > 0) {
      const distinctRates = new Set<number>()
      for (const l of extractedIvas) {
        if (typeof l.porcentaje === 'number' && Number.isFinite(l.porcentaje)) distinctRates.add(l.porcentaje)
      }
      const hasMultiple = distinctRates.size > 1
      const parsePct = (v: string) => {
        const raw = String(v || '').replace('%', '').trim().replace(',', '.')
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      }
      const lineas0 = Array.isArray(next.lineas) ? [...next.lineas] : []
      const pct0 = lineas0[0] ? parsePct(lineas0[0].porcentajeIva) : null

      if (hasMultiple && (pct0 === 0 || pct0 === null)) {
        // Caso típico reportado: IVA total en línea 0 con % = 0
        if (lineas0[0]) {
          lineas0[0] = { ...lineas0[0], base: '', cuotaIva: '', porcentajeIva: '21' }
        }
        next.lineas = applyExtractedIvasToLineas({ lineas: lineas0, extracted: extractedIvas, overwrite: true })
      } else {
        next.lineas = applyExtractedIvasToLineas({ lineas: next.lineas || [], extracted: extractedIvas, overwrite: false })
      }
    }

    // Retención: si viene en la extracción, la aplicamos por defecto.
    // Aceptamos varias claves por compatibilidad.
    const retPctRaw =
      toNumLoose(ex?.retencion_porcentaje) ?? toNumLoose(ex?.porcentaje_retencion) ?? toNumLoose(ex?.retencion_pct) ?? null
    const retImpRaw = toNumLoose(ex?.retencion_importe) ?? toNumLoose(ex?.retencion) ?? null

    const retPct = retPctRaw !== null ? Math.abs(retPctRaw) : null
    const retImp = retImpRaw !== null ? Math.abs(retImpRaw) : null

    if (!next.retencion.aplica && ((retPct && retPct > 0) || (retImp && retImp > 0))) {
      next.retencion.aplica = true
    }
    if (!next.retencion.porcentaje && retPct !== null) {
      next.retencion.porcentaje = toRetencionPorcentaje(retPct)
    }
    if (!next.retencion.cantidad && retImp !== null) {
      next.retencion.cantidad = String(retImp)
    }

    return next
  }

  const updateInvoiceFromExtraction = (invoiceId: string, extraction: unknown, fields: unknown) => {
    const fieldsRow = coerceInvoiceFieldsRow(fields)

    // Guardamos en invoiceRows para futuras rehidrataciones (export, etc.)
    setInvoiceRows((prev) => {
      const idx = prev.findIndex((i) => i.id === invoiceId)
      if (idx === -1) return prev
      const next = [...prev]
      const current = next[idx]
      const createdAt = new Date().toISOString()
      const invoice_extractions = [
        ...(Array.isArray(current.invoice_extractions) ? current.invoice_extractions : []),
        { raw_json: extraction, created_at: createdAt },
      ]
      next[idx] = {
        ...current,
        invoice_fields: fieldsRow || current.invoice_fields,
        invoice_extractions,
      }
      return next
    })

    // Parcheamos FacturaData sin depender de closures antiguas.
    setFacturas((prev) =>
      prev.map((f) => (f.archivo?.invoiceId === invoiceId ? patchFacturaFromExtraction(f, extraction, fieldsRow) : f))
    )

    bumpRevision(invoiceId)
  }

  const startExtract = async (invoiceId: string): Promise<void> => {
    if (startedRef.current[invoiceId]) return Promise.resolve()
    startedRef.current[invoiceId] = true

    setInvoiceStatus((prev) => ({ ...prev, [invoiceId]: 'processing' }))
    inFlightRef.current += 1

    try {
      const resp = await fetch(`/api/invoices/${invoiceId}/extract`, { method: 'POST' })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || 'Error extrayendo factura')

      // data: { success, extraction, fields }
      updateInvoiceFromExtraction(invoiceId, data?.extraction, data?.fields)
      setInvoiceStatus((prev) => ({ ...prev, [invoiceId]: 'ready' }))
    } catch (e) {
      setInvoiceStatus((prev) => ({ ...prev, [invoiceId]: 'error' }))
      // no spameamos toast por cada una; mostramos solo si es la actual
      const currentId = facturas?.[facturaActual]?.archivo?.invoiceId
      if (currentId === invoiceId) showError(e instanceof Error ? e.message : 'Error extrayendo factura')
      throw e
    } finally {
      inFlightRef.current -= 1
    }
  }

  const pumpQueue = useMemo(() => {
    return () => {
      if (invoiceRows.length === 0) return
      if (inFlightRef.current >= MAX_CONCURRENCY) return

      const orderedIds = invoiceRows.map((i) => i.id)
      for (const id of orderedIds) {
        if (inFlightRef.current >= MAX_CONCURRENCY) break
        const st = invoiceStatus[id]
        if (st === 'idle') void startExtract(id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceRows, invoiceStatus, MAX_CONCURRENCY])

  // Arrancar y mantener cola (3 en paralelo).
  useEffect(() => {
    pumpQueue()
  }, [pumpQueue, invoiceRows.length, facturaActual, invoiceStatus])

  const validatedInvoiceIds = useMemo(() => {
    const ordered = invoiceRows.map((i) => i.id)
    return ordered.filter((id) => Boolean(validatedByInvoiceId[id]))
  }, [invoiceRows, validatedByInvoiceId])

  const toISODate = (value: string) => {
    const v = (value || '').trim()
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (m) {
      const [, dd, mm, yyyy] = m
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    return v
  }

  const toNumber = (value: string) => {
    // Soporta:
    // - 1.000,56  (ES)
    // - 1000,56
    // - 1,000.56  (EN)
    // - 1000.56
    // - y con/ sin símbolo €
    const raw = String(value || '')
      .replace(/\u00A0/g, ' ')
      .replace(/€/g, '')
      .replace(/\s+/g, '')
      .trim()
    if (!raw) return null

    const hasDot = raw.includes('.')
    const hasComma = raw.includes(',')

    let normalized = raw

    if (hasDot && hasComma) {
      // El separador decimal es el que aparezca el último
      const lastDot = raw.lastIndexOf('.')
      const lastComma = raw.lastIndexOf(',')
      const decimalSep = lastComma > lastDot ? ',' : '.'
      const thousandsSep = decimalSep === ',' ? '.' : ','
      normalized = raw.replace(new RegExp(`\\${thousandsSep}`, 'g'), '').replace(decimalSep, '.')
    } else if (hasComma) {
      // ES típico: 1.000,56 ya vendría con '.', pero si solo hay coma asumimos coma decimal
      normalized = raw.replace(',', '.')
    } else if (hasDot) {
      // Si solo hay '.', puede ser decimal (94.50) o miles (1.000)
      const parts = raw.split('.')
      if (parts.length === 2 && parts[1].length === 2) {
        // 94.50 -> decimal
        normalized = raw
      } else {
        // 1.000 o 1.000.000 -> miles
        normalized = raw.replace(/\./g, '')
      }
    }

    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }

  const handleValidar = async (factura: FacturaData) => {
    const invoiceId = factura.archivo?.invoiceId
    if (invoiceId) {
      const st = invoiceStatus[invoiceId]
      if (st && st !== 'ready') {
        showError(st === 'error' ? 'Esta factura falló al procesarse. Reintenta.' : 'Factura aún procesándose…')
        return
      }
    }
    if (invoiceId) {
      try {
        const baseSum = factura.lineas
          .map((l) => toNumber(l.base))
          .filter((n): n is number => n !== null)
          .reduce((a, b) => a + b, 0)

        const vatSum = factura.lineas
          .map((l) => toNumber(l.cuotaIva))
          .filter((n): n is number => n !== null)
          .reduce((a, b) => a + b, 0)

        const total = toNumber(factura.total) ?? baseSum + vatSum
        const vatRatesUsed = new Set<number>()
        for (const l of factura.lineas || []) {
          const baseN = toNumber(l.base)
          const vatN = toNumber(l.cuotaIva)
          if (baseN === null && vatN === null) continue
          const raw = String(l.porcentajeIva || '').replace('%', '').trim().replace(',', '.')
          const n = Number(raw)
          if (Number.isFinite(n)) vatRatesUsed.add(n)
        }
        // Solo guardamos un único tipo si la factura tiene 1 IVA; si hay varios, dejamos null.
        const vatRate = vatRatesUsed.size === 1 ? [...vatRatesUsed][0] : null

        await fetch(`/api/invoices/${invoiceId}/fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplier_name: factura.proveedor.nombre || null,
            supplier_tax_id: factura.proveedor.cif || null,
            invoice_number: factura.factura.numero || null,
            invoice_date: toISODate(factura.factura.fecha) || null,
            base_amount: baseSum || null,
            vat_amount: vatSum || null,
            total_amount: total || null,
            vat_rate: Number.isFinite(vatRate as number) ? (vatRate as number) : null,
          }),
        })
      } catch {
        // noop
      }
    }

    setFacturas((prev) => {
      const nuevas = [...prev]
      nuevas[facturaActual] = factura
      return nuevas
    })

    // Marcar como validada y persistir (sesión)
    if (invoiceId) {
      setValidatedByInvoiceId((prev) => {
        const next = { ...prev, [invoiceId]: true as const }
        persistIdSet(`upload:${uploadId}:validatedIds`, next)
        return next
      })
      // Si estaba "para después", lo quitamos.
      setDeferredByInvoiceId((prev) => {
        if (!prev[invoiceId]) return prev
        const { [invoiceId]: _omit, ...rest } = prev
        persistIdSet(`upload:${uploadId}:deferredIds`, rest)
        return rest
      })
    }

    const isLast = facturaActual === facturas.length - 1
    // Calculamos "all validated" incluyendo esta factura (sin esperar al setState async)
    const totalCount = invoiceRows.length
    const prevValidatedCount = validatedStats.validated
    const isAlreadyValidated = Boolean(invoiceId && validatedByInvoiceId[invoiceId])
    const nextValidatedCount = invoiceId ? prevValidatedCount + (isAlreadyValidated ? 0 : 1) : prevValidatedCount
    const nextAllValidated = totalCount > 0 && nextValidatedCount >= totalCount

    if (nextAllValidated) {
      showSuccess('Factura validada. Has completado todas.')
      setIsFinishedModalOpen(true)
      return
    }

    // Si es la última (en orden) pero quedan pendientes, volvemos a la primera pendiente.
    if (isLast) {
      const pendingCount = Math.max(0, totalCount - nextValidatedCount)
      showInfo(`Te faltan ${pendingCount} por validar. Volvemos a la primera pendiente.`)
      // Recalcular primera pendiente (usando invoiceRows actuales)
      const ids = invoiceRows.map((i) => i.id)
      let target = 0
      for (let idx = 0; idx < ids.length; idx += 1) {
        const id = ids[idx]
        const isVal = id === invoiceId ? true : Boolean(validatedByInvoiceId[id])
        if (!isVal) {
          target = idx
          break
        }
      }
      setFacturaActual(target)
      return
    }

    showSuccess('Factura validada')
  }

  const handleParaDespues = () => {
    const invoiceId = facturas[facturaActual]?.archivo?.invoiceId
    if (invoiceId && !validatedByInvoiceId[invoiceId]) {
      setDeferredByInvoiceId((prev) => {
        const next = { ...prev, [invoiceId]: true as const }
        persistIdSet(`upload:${uploadId}:deferredIds`, next)
        return next
      })
    }
    handleSiguiente()
  }

  const jumpToIndex = (idx: number) => {
    if (idx < 0 || idx >= invoiceRows.length) return
    if (idx > unlockedMaxIndex) {
      showError('Aún se están procesando las siguientes facturas. Espera al siguiente bloque.')
      return
    }
    setFacturaActual(idx)
  }

  const handleSiguiente = () => {
    const next = facturaActual + 1
    if (next > unlockedMaxIndex) {
      showError('Aún se están procesando las siguientes facturas. Espera al siguiente bloque.')
      return
    }
    if (facturaActual < facturas.length - 1) setFacturaActual(next)
  }

  const handleAnterior = () => {
    if (facturaActual > 0) setFacturaActual(facturaActual - 1)
  }

  const handleGenerarExport = async () => {
    if (validatedInvoiceIds.length === 0) {
      showError('No hay facturas validadas para exportar')
      return
    }

    const program = sessionStorage.getItem('onboarding:accountingProgram') || 'monitor'
    setIsExporting(true)
    try {
      const resp = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: validatedInvoiceIds, program }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Error generando export')

      showSuccess('Export generado correctamente')
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
      setIsFinishedModalOpen(false)
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error generando export')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Cargando subida...</p>
        </div>
      </div>
    )
  }

  // No mostramos la pantalla de validación hasta que estén procesadas las primeras 6 (o menos si hay <6).
  if (!initialGateReady) {
    const need = Math.min(BLOCK_SIZE, invoiceRows.length)
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Procesando las primeras {need} facturas…</p>
          <p className="text-xs text-foreground-secondary mt-2">
            {Math.min(prefixDoneCount, need)}/{need} listas
          </p>
        </div>
      </div>
    )
  }

  if (facturas.length === 0) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">No hay facturas para validar</h2>
          <p className="text-foreground-secondary mb-6">Esta subida no contiene facturas.</p>
          <Button variant="primary" onClick={() => router.push('/dashboard')}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen h-screen bg-background flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between gap-6">
          {/* Izquierda */}
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Volver"
              title="Volver"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight truncate">
                {clientTaxId ? (
                  <span className="text-slate-900">CIF {clientTaxId}</span>
                ) : (
                  <span className="text-slate-900">CIF —</span>
                )}
                <span className="text-slate-400">{' · '}</span>
                <span className="text-secondary">{clienteNombre || 'Validar facturas'}</span>
                <span className="text-slate-400">{' · '}</span>
                <span className="text-slate-900">{tipoFactura === 'ingreso' ? 'Ingresos' : 'Gastos'}</span>
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                Pantalla de Validación
              </div>
            </div>
          </div>

          {/* Derecha */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex flex-col items-end">
              <span className="text-xs font-medium text-slate-500">
                {statusStats.done}/{statusStats.total} procesadas
              </span>
              <div className="w-32 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="bg-secondary h-full rounded-full transition-all"
                  style={{ width: `${statusStats.percent}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleAnterior}
              disabled={facturaActual === 0}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Volver a la factura anterior"
              title="Anterior"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Anterior</span>
            </button>

            <Button
              variant="primary"
              onClick={() => setIsFinishedModalOpen(true)}
              disabled={validatedInvoiceIds.length === 0}
              title={
                validatedInvoiceIds.length === 0
                  ? 'Valida al menos una factura para exportar'
                  : `Exportar ${validatedInvoiceIds.length} facturas validadas`
              }
            >
              Finalizar / Exportar
            </Button>
          </div>
        </div>

        {/* Línea inferior de progreso (como en el screenshot cuando está completo) */}
        <div className="mt-3 -mx-6">
          <div className="px-6 pb-1 flex justify-end">
            <div className="text-[11px] text-slate-500 whitespace-nowrap">
              {validatedStats.validated}/{validatedStats.total} validadas
            </div>
          </div>
          {/* Barra segmentada clicable:
              - secondary: validada
              - warning: para después
              - neutral: visitada pero no validada
              - transparente: no visitada */}
          <div className="h-2 w-full border border-slate-200 bg-transparent overflow-hidden">
            <div className="h-full w-full flex">
              {invoiceRows.map((inv, idx) => {
                const isValidated = Boolean(validatedByInvoiceId[inv.id])
                const isDeferred = Boolean(deferredByInvoiceId[inv.id]) && !isValidated
                const isVisited = Boolean(visitedByInvoiceId[inv.id])
                const isCurrent = idx === facturaActual

                const bgClass = isValidated
                  ? 'bg-secondary'
                  : isDeferred
                    ? 'bg-warning'
                    : isVisited
                      ? 'bg-slate-200'
                      : 'bg-transparent'

                return (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => jumpToIndex(idx)}
                    className={[
                      'h-full flex-1 transition-colors',
                      bgClass,
                      idx === invoiceRows.length - 1 ? '' : 'border-r border-slate-200',
                      isCurrent ? 'ring-2 ring-primary ring-inset' : '',
                      idx > unlockedMaxIndex ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    ].join(' ')}
                    title={`Factura ${idx + 1}/${invoiceRows.length}${isValidated ? ' · validada' : isDeferred ? ' · para después' : ''}`}
                    aria-label={`Ir a factura ${idx + 1}`}
                    disabled={idx > unlockedMaxIndex}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </header>

      {isFinishedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !isExporting && setIsFinishedModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 text-foreground">
            <h2 className="text-xl font-semibold mb-2">Exportar facturas validadas</h2>
            <p className="text-sm text-foreground-secondary mb-6">
              Se generará el Excel con las facturas marcadas como validadas.
              <span className="font-medium">{' '}{validatedStats.validated}</span>/{validatedStats.total} validadas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsFinishedModalOpen(false)} disabled={isExporting}>
                Revisar / cambiar
              </Button>
              <Button variant="primary" onClick={handleGenerarExport} disabled={isExporting}>
                {isExporting ? 'Generando exportación...' : 'Generar exportación'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        {(() => {
          const currentId = facturas[facturaActual]?.archivo?.invoiceId
          const st = currentId ? invoiceStatus[currentId] : undefined
          const isLast = facturaActual === facturas.length - 1
          const canGoNext = facturaActual + 1 <= unlockedMaxIndex
          // Regla UX: si esta factura es "la última disponible" pero todavía no podemos pasar al siguiente bloque,
          // NO dejamos validarla (evita validar y quedarse bloqueado con toast de error).
          const mustWaitForNextBlock = !isLast && !canGoNext

          const disableValidar = Boolean(!currentId || st !== 'ready' || mustWaitForNextBlock)
          const validarText = mustWaitForNextBlock
            ? 'ESPERA AL SIGUIENTE BLOQUE…'
            : st === 'processing'
              ? 'PROCESANDO…'
              : st === 'error'
                ? 'ERROR (REINTENTA)'
                : undefined

          return (
            <ValidarFactura
              key={`${currentId || facturaActual}:${currentId ? facturaRevisions[currentId] || 0 : 0}`}
              tipo={tipoFactura}
              factura={facturas[facturaActual]}
              onValidar={handleValidar}
              onAnterior={facturaActual > 0 ? handleAnterior : undefined}
              onSiguiente={handleSiguiente}
              onParaDespues={handleParaDespues}
              isLast={isLast}
              canGoNext={canGoNext}
              disableValidar={disableValidar}
              validarText={validarText}
            />
          )
        })()}
      </div>
    </div>
  )
}

