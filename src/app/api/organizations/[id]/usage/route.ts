import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/**
 * GET /api/organizations/[id]/usage?from=2025-01-01&to=2025-12-31&groupBy=month
 *
 * Devuelve el uso de facturas por periodo para facturación:
 * - groupBy: 'day' | 'month' | 'year' (agrupa por día, mes o año)
 * - from, to: fechas ISO (opcional, por defecto último año)
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError
    const { supabase } = auth

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const groupBy = searchParams.get('groupBy') || 'month'

    const now = new Date()
    const defaultTo = now.toISOString().slice(0, 10)
    const defaultFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString()
      .slice(0, 10)

    const fromDate = fromParam || defaultFrom
    const toDate = toParam || defaultTo

    if (!['day', 'month', 'year'].includes(groupBy)) {
      return NextResponse.json(
        { error: 'groupBy debe ser day, month o year' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    const { data: rows, error } = await db
      .from('billing_ledger')
      .select('id, created_at')
      .eq('org_id', orgId)
      .eq('event_type', 'INVOICE_UPLOAD')
      .lt('amount', 0)
      .gte('created_at', `${fromDate}T00:00:00Z`)
      .lte('created_at', `${toDate}T23:59:59.999Z`)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Error cargando uso' },
        { status: 500 }
      )
    }

    // Agrupar por periodo
    const byPeriod: Record<string, number> = {}
    for (const r of rows || []) {
      const d = new Date((r as { created_at: string }).created_at)
      let key: string
      if (groupBy === 'day') {
        key = d.toISOString().slice(0, 10)
      } else if (groupBy === 'month') {
        key = d.toISOString().slice(0, 7)
      } else {
        key = String(d.getUTCFullYear())
      }
      byPeriod[key] = (byPeriod[key] || 0) + 1
    }

    const periods = Object.entries(byPeriod)
      .map(([period, count]) => ({ period, count }))
      .toSorted((a, b) => a.period.localeCompare(b.period))

    const total = periods.reduce((s, p) => s + p.count, 0)

    return NextResponse.json(
      {
        success: true,
        from: fromDate,
        to: toDate,
        groupBy,
        total,
        periods,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en GET /api/organizations/[id]/usage:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
