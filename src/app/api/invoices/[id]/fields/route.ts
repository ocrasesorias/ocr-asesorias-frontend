import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
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

    const body = await request.json().catch(() => null)
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


