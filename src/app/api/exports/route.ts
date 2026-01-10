import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
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
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgId = memberships[0].org_id as string

    const body = await request.json().catch(() => null)
    const invoiceIds = Array.isArray(body?.invoice_ids) ? (body.invoice_ids as string[]) : []
    const program = typeof body?.program === 'string' ? body.program : 'monitor'

    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoice_ids es requerido' }, { status: 400 })
    }

    // Traer facturas de la org + fields
    const { data, error } = await supabase
      .from('invoices')
      .select(
        `
        id,
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
      .eq('org_id', orgId)
      .in('id', invoiceIds)

    if (error) {
      return NextResponse.json({ error: error.message || 'Error cargando facturas' }, { status: 500 })
    }

    const rows: ExportRow[] = ((data || []) as InvoiceWithFieldsRow[]).map((r) => {
      const f = Array.isArray(r.invoice_fields) ? r.invoice_fields[0] : r.invoice_fields
      return { invoice_id: r.id, ...(f || {}) }
    })

    // Export “genérico” (pipeline completo: genera fichero y lo guarda en bucket exports)
    // Cuando tengamos el layout oficial de Monitor/ContaSol, se puede adaptar aquí.
    const header = [
      'invoice_id',
      'supplier_name',
      'supplier_tax_id',
      'invoice_number',
      'invoice_date',
      'base_amount',
      'vat_amount',
      'total_amount',
      'vat_rate',
    ]

    const csv =
      header.join(';') +
      '\n' +
      rows
        .map((r) => header.map((h) => csvEscape(r[h])).join(';'))
        .join('\n')

    const bucket = 'exports'
    const exportId = crypto.randomUUID()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${program}-${ts}.csv`
    const storagePath = `org/${orgId}/export/${exportId}/${filename}`

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


