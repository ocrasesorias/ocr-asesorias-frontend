import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError

    const { supabase, orgIds } = auth

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
          status,
          error_message,
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
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ])

    const { data: auth, response: authErr } = authResult
    if (authErr) return authErr

    const { supabase, user, orgId } = auth

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


