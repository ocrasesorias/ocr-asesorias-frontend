import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    // Get the current invoice's fields
    const { data: currentInvoice, error: invError } = await supabase
      .from('invoices')
      .select('id, org_id, client_id')
      .eq('id', invoiceId)
      .single()

    if (invError || !currentInvoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (currentInvoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: fields, error: fieldsError } = await supabase
      .from('invoice_fields')
      .select('supplier_tax_id, invoice_number')
      .eq('invoice_id', invoiceId)
      .single()

    if (fieldsError || !fields) {
      return NextResponse.json({ duplicates: [] })
    }

    const supplierTaxId = (fields.supplier_tax_id || '').trim()
    const invoiceNumber = (fields.invoice_number || '').trim()

    if (!supplierTaxId || !invoiceNumber) {
      return NextResponse.json({ duplicates: [] })
    }

    // Find duplicates: same supplier_tax_id + invoice_number, same client, different invoice
    const { data: dupes, error: dupError } = await supabase
      .from('invoice_fields')
      .select(`
        invoice_id,
        supplier_name,
        invoice_number,
        invoice_date,
        total_amount
      `)
      .ilike('supplier_tax_id', supplierTaxId)
      .ilike('invoice_number', invoiceNumber)
      .neq('invoice_id', invoiceId)

    if (dupError || !dupes || dupes.length === 0) {
      return NextResponse.json({ duplicates: [] })
    }

    // Filter to same client + org by joining with invoices
    const dupeInvoiceIds = dupes.map((d) => d.invoice_id)
    const { data: invoiceRows, error: invRowsError } = await supabase
      .from('invoices')
      .select('id, upload_id, original_filename')
      .in('id', dupeInvoiceIds)
      .eq('org_id', orgId)
      .eq('client_id', currentInvoice.client_id)

    if (invRowsError || !invoiceRows || invoiceRows.length === 0) {
      return NextResponse.json({ duplicates: [] })
    }

    const invoiceMap = new Map(invoiceRows.map((r) => [r.id, r]))
    const duplicates = dupes
      .filter((d) => invoiceMap.has(d.invoice_id))
      .map((d) => {
        const inv = invoiceMap.get(d.invoice_id)!
        return {
          invoice_id: d.invoice_id,
          upload_id: inv.upload_id,
          supplier_name: d.supplier_name,
          invoice_number: d.invoice_number,
          invoice_date: d.invoice_date,
          total_amount: d.total_amount,
          original_filename: inv.original_filename,
        }
      })

    return NextResponse.json({ duplicates })
  } catch (error) {
    console.error('Error en GET /api/invoices/[id]/duplicates:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
