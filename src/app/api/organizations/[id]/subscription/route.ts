import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const PLAN_NAMES: Record<string, string> = {
  [process.env.STRIPE_PRICE_PROFESIONAL_MENSUAL!]: 'Profesional',
  [process.env.STRIPE_PRICE_PROFESIONAL_ANUAL!]: 'Profesional',
  [process.env.STRIPE_PRICE_GESTORIA_MENSUAL!]: 'Gestoría',
  [process.env.STRIPE_PRICE_GESTORIA_ANUAL!]: 'Gestoría',
}

/**
 * GET /api/organizations/[id]/subscription
 * Devuelve el estado de la suscripción de la organización.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError

    const admin = createAdminClient()
    const db = admin ?? auth.supabase

    const { data: org, error } = await db
      .from('organizations')
      .select('subscription_status, stripe_price_id, subscription_period_end, is_trial')
      .eq('id', orgId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const row = org as {
      subscription_status?: string
      stripe_price_id?: string
      subscription_period_end?: string
      is_trial?: boolean
    } | null

    const priceId = row?.stripe_price_id ?? null
    const planName = priceId ? (PLAN_NAMES[priceId] ?? null) : null

    return NextResponse.json({
      status: row?.subscription_status ?? null,
      price_id: priceId,
      period_end: row?.subscription_period_end ?? null,
      plan_name: planName,
      is_trial: row?.is_trial ?? false,
    })
  } catch (error) {
    console.error('Error en GET /subscription:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
