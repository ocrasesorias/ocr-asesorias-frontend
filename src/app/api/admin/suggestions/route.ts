import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const STATUSES = ['nuevo', 'visto', 'en_proceso', 'resuelto'] as const
const TIPOS = ['sugerencia', 'error', 'duda', 'otro'] as const
const PAGE_SIZE = 10

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS ?? ''
  const emails = list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return emails.includes(email.toLowerCase())
}

export async function GET(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { user } = auth

    if (!isAdmin(user.email ?? undefined)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? String(PAGE_SIZE), 10)))
    const search = (searchParams.get('search') ?? '').trim()
    const type = searchParams.get('type') ?? ''
    const status = searchParams.get('status') ?? ''

    let q = admin
      .from('suggestions')
      .select('id, org_id, user_id, email, type, message, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      const term = search.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
      q = q.or(`message.ilike.%${term}%,email.ilike.%${term}%`)
    }
    if (type && TIPOS.includes(type as (typeof TIPOS)[number])) {
      q = q.eq('type', type)
    }
    if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
      q = q.eq('status', status)
    }

    const from = (page - 1) * pageSize
    const { data: rows, error, count } = await q.range(from, from + pageSize - 1)

    if (error) {
      console.error('Error listando sugerencias:', error)
      return NextResponse.json({ error: error.message ?? 'Error al listar' }, { status: 500 })
    }

    const total = count ?? 0
    const stats = await getStats(admin)

    return NextResponse.json({
      items: rows ?? [],
      total,
      page,
      pageSize,
      stats,
    })
  } catch (err) {
    console.error('Error GET /api/admin/suggestions:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

async function getStats(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const [nuevo, enProceso, resuelto] = await Promise.all([
    admin.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'nuevo'),
    admin.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'en_proceso'),
    admin.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'resuelto'),
  ])
  return {
    nuevo: nuevo.count ?? 0,
    en_proceso: enProceso.count ?? 0,
    resuelto: resuelto.count ?? 0,
  }
}
