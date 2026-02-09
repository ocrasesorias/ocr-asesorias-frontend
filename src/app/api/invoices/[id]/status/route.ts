import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

const ALLOWED = new Set(['uploaded', 'processing', 'needs_review', 'ready', 'error'])

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ])
    const { data: auth, response: authError } = authResult
    if (authError) return authError
    const { supabase, orgId } = auth

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, org_id, status')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const status = typeof bodyObj?.status === 'string' ? bodyObj.status : null
    const error_message = typeof bodyObj?.error_message === 'string' ? bodyObj.error_message : null

    if (!status || !ALLOWED.has(status)) {
      return NextResponse.json(
        { error: 'status inválido (uploaded|processing|needs_review|ready|error)' },
        { status: 400 }
      )
    }

    // Regla: no degradar ready -> otro estado desde aquí (evita pisar validaciones)
    const invoiceObj = invoice && typeof invoice === 'object' ? (invoice as Record<string, unknown>) : null
    const currentStatus = typeof invoiceObj?.status === 'string' ? invoiceObj.status : null
    if (currentStatus === 'ready' && status !== 'ready') {
      return NextResponse.json({ success: true, status: 'ready' }, { status: 200 })
    }

    const payload: Record<string, unknown> = { status }
    if (status === 'error') payload.error_message = error_message || 'Error'
    else payload.error_message = null

    const { data: updated, error: updError } = await supabase
      .from('invoices')
      .update(payload)
      .eq('id', invoiceId)
      .eq('org_id', orgId)
      .select('id, status, error_message')
      .single()

    if (updError) {
      return NextResponse.json({ error: updError.message || 'Error actualizando estado' }, { status: 500 })
    }

    return NextResponse.json({ success: true, invoice: updated }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PUT /api/invoices/[id]/status:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

