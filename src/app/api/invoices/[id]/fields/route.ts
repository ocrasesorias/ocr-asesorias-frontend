import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ])
    const { data: auth, response: authError } = authResult
    if (authError) return authError
    const { supabase, user, orgId } = auth

    // Comprobar que la factura pertenece a la organización
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, org_id')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    // Permitimos solo campos conocidos del esquema
    const allowed = new Set([
      'supplier_name',
      'supplier_tax_id',
      'invoice_number',
      'invoice_date',
      'base_amount',
      'vat_amount',
      'total_amount',
      'vat_rate',
    ])

    const payload: Record<string, unknown> = { invoice_id: invoiceId, updated_by: user.id }
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (allowed.has(k)) payload[k] = v
    }

    const { data, error } = await supabase
      .from('invoice_fields')
      .upsert(payload, { onConflict: 'invoice_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error guardando campos' }, { status: 500 })
    }

    // Estado: ready (validada)
    try {
      await supabase
        .from('invoices')
        .update({ status: 'ready', error_message: null })
        .eq('id', invoiceId)
        .eq('org_id', orgId)
    } catch {
      // noop (no bloqueamos la validación por esto)
    }

    return NextResponse.json({ success: true, fields: data }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PUT /api/invoices/[id]/fields:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


