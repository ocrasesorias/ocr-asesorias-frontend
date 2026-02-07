import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const TIPOS_VALIDOS = ['sugerencia', 'error', 'duda', 'otro'] as const

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

    const admin = createAdminClient()
    if (!admin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY no configurada')
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const body = await request.json().catch(() => null)
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const message = typeof bodyObj?.message === 'string' ? bodyObj.message.trim() : ''
    const typeRaw = typeof bodyObj?.type === 'string' ? bodyObj.type.trim() : null
    const type = typeRaw && TIPOS_VALIDOS.includes(typeRaw as (typeof TIPOS_VALIDOS)[number]) ? typeRaw : null
    const emailRaw = typeof bodyObj?.email === 'string' ? bodyObj.email.trim() : null
    const email = emailRaw || null

    if (!message || message.length < 3) {
      return NextResponse.json({ error: 'El mensaje es obligatorio (mínimo 3 caracteres).' }, { status: 400 })
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'El mensaje no puede superar 2000 caracteres.' }, { status: 400 })
    }

    let orgId: string | null = null
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
    if (memberships && memberships.length > 0) {
      orgId = memberships[0].org_id as string
    }

    const { data: row, error } = await admin
      .from('suggestions')
      .insert({
        org_id: orgId,
        user_id: user.id,
        email: email || (user.email ?? null),
        type: type,
        message,
        status: 'nuevo',
      })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('Error insertando sugerencia:', error)
      return NextResponse.json({ error: error.message || 'Error al guardar la sugerencia' }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: row?.id, created_at: row?.created_at }, { status: 201 })
  } catch (error) {
    console.error('Error inesperado en POST /api/suggestions:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
