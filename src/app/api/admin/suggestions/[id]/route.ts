import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const STATUSES = ['nuevo', 'visto', 'en_proceso', 'resuelto'] as const

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS ?? ''
  const emails = list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return emails.includes(email.toLowerCase())
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!isAdmin(user.email ?? undefined)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const status = typeof bodyObj?.status === 'string' ? bodyObj.status.trim() : null

    if (!status || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json(
        { error: 'status debe ser uno de: nuevo, visto, en_proceso, resuelto' },
        { status: 400 }
      )
    }

    const { data, error } = await admin
      .from('suggestions')
      .update({ status })
      .eq('id', id)
      .select('id, status')
      .single()

    if (error) {
      console.error('Error actualizando sugerencia:', error)
      return NextResponse.json({ error: error.message ?? 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Error PATCH /api/admin/suggestions/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
