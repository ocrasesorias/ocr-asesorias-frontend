import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const PAGE_SIZE = 50
const STATUS_PENDING = ['uploaded', 'processing', 'needs_review', 'error'] as const

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError
    const { supabase } = auth

    const admin = createAdminClient()
    const db = admin ?? supabase

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status') ?? 'pending' // 'pending' | 'all'
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? String(PAGE_SIZE), 10)))

    let query = db
      .from('invoices')
      .select(
        `
        id,
        original_filename,
        status,
        created_at,
        upload_id,
        upload:uploads (
          id,
          name,
          tipo,
          client_id,
          client:clients (
            id,
            name
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (statusFilter === 'pending') {
      query = query.in('status', [...STATUS_PENDING])
    }

    const from = (page - 1) * pageSize
    const { data: rows, error, count } = await query.range(from, from + pageSize - 1)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Error listando facturas' },
        { status: 500 }
      )
    }

    const items = (rows || []).map((row: Record<string, unknown>) => {
      const upload = (row.upload ?? row.uploads) as Record<string, unknown> | null
      const client = (upload?.client ?? upload?.clients) as Record<string, unknown> | null
      return {
        id: row.id,
        original_filename: row.original_filename ?? '',
        status: row.status ?? 'uploaded',
        created_at: row.created_at,
        upload_id: row.upload_id,
        upload_name: upload?.name ?? '',
        upload_tipo: upload?.tipo ?? null,
        client_name: client?.name ?? '',
      }
    })

    return NextResponse.json({
      items,
      total: count ?? 0,
      page,
      pageSize,
    })
  } catch (err) {
    console.error('Error GET /api/organizations/[id]/invoices:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
