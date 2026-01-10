import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
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


