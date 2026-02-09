import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

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


