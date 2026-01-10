'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

function toFacturaData(inv: UploadInvoiceRow, previewUrl: string, clientTaxId?: string | null): FacturaData {
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

  return {
    empresa: { cif: clientTaxId || 'B12345678', trimestre: 'Q1', actividad: '' },
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
    subcuentaGasto: '',
    retencion: { aplica: false, porcentaje: '', tipo: '', cantidad: '' },
    lineas: [
      {
        base: base !== null ? String(base) : '',
        porcentajeIva: vatRate !== null ? String(vatRate) : '21',
        cuotaIva: vat !== null ? String(vat) : '',
        porcentajeRecargo: '0',
        cuotaRecargo: '0.00',
      },
      { base: '', porcentajeIva: '10', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
      { base: '', porcentajeIva: '4', cuotaIva: '', porcentajeRecargo: '0', cuotaRecargo: '0.00' },
    ],
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
  const { showError, showSuccess } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [facturaActual, setFacturaActual] = useState(0)
  const [facturas, setFacturas] = useState<FacturaData[]>([])
  const [clienteNombre, setClienteNombre] = useState<string>('')
  const [tipoFactura, setTipoFactura] = useState<'gasto' | 'ingreso'>('gasto')

  const [isFinishedModalOpen, setIsFinishedModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

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
        const client = upload?.clients
        setClienteNombre(client?.name || '')

        const invoices: UploadInvoiceRow[] = Array.isArray(upload?.invoices) ? upload.invoices : []

        // Crear previews (firmadas 7 días) por invoice
        const previews = await Promise.all(
          invoices.map(async (inv) => {
            const r = await fetch(`/api/invoices/${inv.id}/preview?expires=${60 * 60 * 24 * 7}`)
            const j = await r.json().catch(() => null)
            return { invoiceId: inv.id, url: r.ok ? j?.signedUrl || '' : '' }
          })
        )
        const byId = new Map(previews.map((p) => [p.invoiceId, p.url]))

        const mapped = invoices.map((inv) => toFacturaData(inv, byId.get(inv.id) || '', client?.tax_id))
        setFacturas(mapped)
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Error cargando la subida')
      } finally {
        setIsLoading(false)
      }
    }

    run()
  }, [router, uploadId, showError, searchParams])

  const invoiceIds = useMemo(
    () => facturas.map((f) => f.archivo?.invoiceId).filter((id): id is string => Boolean(id)),
    [facturas]
  )

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
    const v = (value || '').replace('€', '').trim().replace(/\./g, '').replace(',', '.')
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const handleValidar = async (factura: FacturaData) => {
    const invoiceId = factura.archivo?.invoiceId
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
        const vatRate =
          factura.lineas?.[0]?.porcentajeIva && factura.lineas[0].porcentajeIva.trim()
            ? Number(factura.lineas[0].porcentajeIva.replace('%', '').trim())
            : null

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

    const isLast = facturaActual === facturas.length - 1
    showSuccess(isLast ? 'Factura validada. Has completado todas.' : 'Factura validada')
    if (isLast) setIsFinishedModalOpen(true)
  }

  const handleSiguiente = () => {
    if (facturaActual < facturas.length - 1) setFacturaActual(facturaActual + 1)
  }

  const handleAnterior = () => {
    if (facturaActual > 0) setFacturaActual(facturaActual - 1)
  }

  const handleGenerarExport = async () => {
    if (invoiceIds.length === 0) {
      showError('No hay facturas para exportar')
      return
    }

    const program = sessionStorage.getItem('onboarding:accountingProgram') || 'monitor'
    setIsExporting(true)
    try {
      const resp = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: invoiceIds, program }),
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
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-primary hover:text-primary-hover">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              {clienteNombre ? `${clienteNombre} · ` : ''}Validar facturas
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-foreground-secondary">
            {facturaActual + 1} de {facturas.length}
          </span>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={handleAnterior} disabled={facturaActual === 0} className="py-2">
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSiguiente}
              disabled={facturaActual === facturas.length - 1}
              className="py-2"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {isFinishedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !isExporting && setIsFinishedModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 text-foreground">
            <h2 className="text-xl font-semibold mb-2">Has terminado la validación</h2>
            <p className="text-sm text-foreground-secondary mb-6">
              ¿Quieres revisar o cambiar algún dato, o prefieres continuar y generar el export?
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button variant="outline" onClick={() => setIsFinishedModalOpen(false)} disabled={isExporting}>
                Revisar / cambiar
              </Button>
              <Button variant="primary" onClick={handleGenerarExport} disabled={isExporting}>
                {isExporting ? 'Generando export...' : 'Generar export'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <ValidarFactura
          key={facturas[facturaActual]?.archivo?.invoiceId || facturaActual}
          tipo={tipoFactura}
          factura={facturas[facturaActual]}
          onValidar={handleValidar}
          onSiguiente={handleSiguiente}
        />
      </div>
    </div>
  )
}

