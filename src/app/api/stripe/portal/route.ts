import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/portal
 * Crea una sesión del Customer Portal de Stripe para gestionar suscripción.
 */
export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { orgId } = auth

    const stripe = getStripe()
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    const { data: org } = await admin
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', orgId)
      .maybeSingle()

    const customerId = (org as { stripe_customer_id?: string } | null)?.stripe_customer_id

    if (!customerId) {
      return NextResponse.json(
        { error: 'No tienes una suscripción activa' },
        { status: 400 }
      )
    }

    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/panel/planes`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creando portal session:', error)
    return NextResponse.json({ error: 'Error abriendo portal de pagos' }, { status: 500 })
  }
}
