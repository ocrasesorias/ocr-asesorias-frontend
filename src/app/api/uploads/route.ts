import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
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

    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')

    let query = supabase
      .from('uploads')
      .select(
        `
        id,
        org_id,
        client_id,
        tipo,
        name,
        created_by,
        created_at,
        updated_at,
        invoices (
          id,
          original_filename,
          mime_type,
          file_size_bytes,
          bucket,
          storage_path,
          created_at
        )
      `
      )
      .in('org_id', orgIds)
      .order('created_at', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message || 'Error cargando subidas' }, { status: 500 })
    }

    return NextResponse.json({ success: true, uploads: data || [] }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en GET /api/uploads:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

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

    // TODO: si en el futuro hay selección de org activa, usarla aquí.
    const orgId = (memberships[0].org_id as string) || ''
    if (!orgId) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const clientId = typeof body?.client_id === 'string' && body.client_id.trim() ? body.client_id : null
    const tipoRaw = typeof body?.tipo === 'string' ? body.tipo.trim().toLowerCase() : ''
    const tipo = tipoRaw === 'ingreso' || tipoRaw === 'gasto' ? tipoRaw : 'gasto'

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('uploads')
      .insert({
        org_id: orgId,
        client_id: clientId,
        tipo,
        name,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error creando subida' }, { status: 500 })
    }

    return NextResponse.json({ success: true, upload: data }, { status: 201 })
  } catch (error) {
    console.error('Error inesperado en POST /api/uploads:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


