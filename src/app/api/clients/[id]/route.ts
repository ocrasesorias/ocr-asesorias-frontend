import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: clientId } = await context.params
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
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const tax_id = typeof body?.tax_id === 'string' ? body.tax_id.trim() : ''
    const preferred_income_account =
      typeof body?.preferred_income_account === 'string' ? body.preferred_income_account.trim() : ''
    const preferred_expense_account =
      typeof body?.preferred_expense_account === 'string' ? body.preferred_expense_account.trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'El nombre del cliente es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('clients')
      .update({
        name,
        tax_id: tax_id || null,
        preferred_income_account: preferred_income_account || null,
        preferred_expense_account: preferred_expense_account || null,
      })
      .eq('id', clientId)
      .in('org_id', orgIds)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error actualizando el cliente' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, client: data }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PUT /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: clientId } = await context.params
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

    // Seguridad: si tiene subidas, no lo borramos (evita dejar históricos huérfanos)
    const { data: anyUpload, error: uploadError } = await supabase
      .from('uploads')
      .select('id')
      .in('org_id', orgIds)
      .eq('client_id', clientId)
      .limit(1)

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message || 'Error verificando subidas del cliente' }, { status: 500 })
    }

    if (anyUpload && anyUpload.length > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar un cliente con subidas. Elimina primero sus subidas.' },
        { status: 409 }
      )
    }

    const { data: deleted, error: delError } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .in('org_id', orgIds)
      .select('id')
      .maybeSingle()

    if (delError) {
      return NextResponse.json({ error: delError.message || 'Error eliminando el cliente' }, { status: 500 })
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en DELETE /api/clients/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

