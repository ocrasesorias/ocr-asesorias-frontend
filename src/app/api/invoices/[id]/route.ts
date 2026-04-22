import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError

    const { supabase, orgId } = auth

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    if (typeof (body as { discarded?: unknown }).discarded === 'boolean') {
      updates.is_discarded = (body as { discarded: boolean }).discarded
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
    }

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

    const { error: updateError } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Error actualizando factura' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, ...updates }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PATCH /api/invoices/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError

    const { supabase, orgId } = auth

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, org_id, bucket, storage_path')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Borrar archivo de storage (best effort)
    if (invoice.bucket && invoice.storage_path) {
      await supabase.storage.from(invoice.bucket).remove([invoice.storage_path])
    }

    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', invoiceId)
    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message || 'Error eliminando factura' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en DELETE /api/invoices/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


