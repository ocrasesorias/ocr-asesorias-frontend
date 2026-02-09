import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS ?? ''
  const emails = list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return emails.includes(email.toLowerCase())
}

/**
 * GET /api/organizations/[id]/invoice-stats
 * Devuelve credits_balance (saldo de créditos actual) e invoices_consumed_count (legacy)
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError
    const { supabase, user } = auth

    // Admins: créditos ilimitados
    if (isAdmin(user.email ?? undefined)) {
      return NextResponse.json(
        { success: true, unlimited: true, credits_balance: null },
        { status: 200 }
      )
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    const { data: org, error } = await db
      .from('organizations')
      .select('credits_balance')
      .eq('id', orgId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Error cargando saldo' },
        { status: 500 }
      )
    }

    const creditsBalance =
      typeof (org as { credits_balance?: number } | null)?.credits_balance === 'number'
        ? (org as { credits_balance: number }).credits_balance
        : 0

    return NextResponse.json(
      { success: true, unlimited: false, credits_balance: creditsBalance },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en GET /api/organizations/[id]/invoice-stats:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
