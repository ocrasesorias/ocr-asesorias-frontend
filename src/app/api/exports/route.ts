import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function formatNumberES(value: unknown) {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n)) return ''
  // Sin separador de miles, coma decimal, sin ceros innecesarios
  const s = n.toFixed(2).replace(/\.?0+$/, '') // "35.70" -> "35.7", "600.00" -> "600"
  return s.replace('.', ',')
}

function formatDateDDMMYYYY(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value).trim()
  if (!s) return ''
  // Ya viene DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return `${dd.padStart(2, '0')}/${mm.padStart(2, '0')}/${yyyy}`
  }
  // ISO YYYY-MM-DD...
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const [, yyyy, mm, dd] = m
    return `${dd}/${mm}/${yyyy}`
  }
  return s
}

type InvoiceFieldsRow = {
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  base_amount: number | null
  vat_amount: number | null
  total_amount: number | null
  vat_rate: number | null
}

type InvoiceWithFieldsRow = {
  id: string
  org_id: string
  invoice_fields: InvoiceFieldsRow | InvoiceFieldsRow[] | null
}

type ExportRow = { invoice_id: string; [key: string]: unknown }

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

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgIds = memberships.map((m) => m.org_id as string).filter(Boolean)
    if (orgIds.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const invoiceIds = Array.isArray(body?.invoice_ids) ? (body.invoice_ids as string[]) : []
    const program = typeof body?.program === 'string' ? body.program : 'monitor'

    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoice_ids es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    // Traer facturas de la org + fields
    const { data, error } = await db
      .from('invoices')
      .select(
        `
        id,
        org_id,
        invoice_fields (
          supplier_name,
          supplier_tax_id,
          invoice_number,
          invoice_date,
          base_amount,
          vat_amount,
          total_amount,
          vat_rate
        )
      `
      )
      .in('org_id', orgIds)
      .in('id', invoiceIds)

    if (error) {
      return NextResponse.json({ error: error.message || 'Error cargando facturas' }, { status: 500 })
    }

    const invoiceRows = (data || []) as InvoiceWithFieldsRow[]
    const usedOrgIds = Array.from(new Set(invoiceRows.map((r) => String(r.org_id || '')).filter(Boolean)))
    if (usedOrgIds.length !== 1) {
      return NextResponse.json(
        { error: 'Las facturas seleccionadas pertenecen a varias organizaciones' },
        { status: 400 }
      )
    }

    // Preferencia desde BD (a nivel de organización). Default ON.
    let uppercaseNamesAddresses = true
    try {
      const { data: orgPref } = await db
        .from('organizations')
        .select('uppercase_names_addresses')
        .eq('id', usedOrgIds[0])
        .maybeSingle()
      const orgPrefObj = orgPref && typeof orgPref === 'object' ? (orgPref as Record<string, unknown>) : null
      const v = orgPrefObj?.uppercase_names_addresses
      if (typeof v === 'boolean') uppercaseNamesAddresses = v
    } catch {
      // noop
    }

    // Permitir override por request (opcional)
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>)?.uppercase_names_addresses === 'boolean') {
      uppercaseNamesAddresses = (body as Record<string, unknown>).uppercase_names_addresses as boolean
    }

    const rows: ExportRow[] = invoiceRows.map((r) => {
      const f = Array.isArray(r.invoice_fields) ? r.invoice_fields[0] : r.invoice_fields
      return { invoice_id: r.id, ...(f || {}) }
    })

    // Layout pedido (abre en Excel como CSV)
    // Orden exacto:
    // Numero de factura | Fecha de factura | Cliente/Razón Social | NIF | (vacío) | 477... | 705... | % IVA | Base | IVA | Total
    const header = [
      'Numero de factura',
      'Fecha de factura',
      'Cliente/Razón Social',
      'NIF',
      '',
      '477000000021',
      '7050000000000',
      'Porcentaje de IVA',
      'Base imponible',
      'IVA de la factura',
      'Total',
    ]

    const csv = [
      header.map((h) => csvEscape(h)).join(';'),
      ...rows.map((r) => {
        const invoiceNumber = (r.invoice_number as string | null) || ''
        const invoiceDate = formatDateDDMMYYYY(r.invoice_date)
        const rawName = (r.supplier_name as string | null) || ''
        const name = uppercaseNamesAddresses ? rawName.toLocaleUpperCase('es-ES') : rawName
        const nif = (r.supplier_tax_id as string | null) || ''
        const vatRate = formatNumberES(r.vat_rate)
        const base = formatNumberES(r.base_amount)
        const vat = formatNumberES(r.vat_amount)
        const total = formatNumberES(r.total_amount)

        const rowValues = [
          invoiceNumber,
          invoiceDate,
          name,
          nif,
          '',
          '477000000021',
          '7050000000000',
          vatRate,
          base,
          vat,
          total,
        ]
        return rowValues.map(csvEscape).join(';')
      }),
    ].join('\n')

    const bucket = 'exports'
    const exportId = crypto.randomUUID()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${program}-${ts}.csv`
    // Guardamos bajo la primera org del usuario (solo como ruta), pero el contenido se basa en invoice_ids validados por orgIds.
    const storagePath = `org/${orgIds[0]}/export/${exportId}/${filename}`

    const upload = await supabase.storage
      .from(bucket)
      .upload(storagePath, new Blob([csv], { type: 'text/csv;charset=utf-8' }), {
        contentType: 'text/csv;charset=utf-8',
        upsert: false,
      })

    if (upload.error) {
      return NextResponse.json(
        { error: upload.error.message || 'Error guardando export en Storage' },
        { status: 500 }
      )
    }

    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60)

    return NextResponse.json(
      {
        success: true,
        bucket,
        storagePath,
        signedUrl: signed?.signedUrl || null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error inesperado en POST /api/exports:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


