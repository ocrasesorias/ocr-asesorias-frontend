import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/server'

export const runtime = 'nodejs'

/**
 * POST /api/stripe/checkout
 * Body: { priceId: string }
 * Crea una Stripe Checkout Session y devuelve la URL.
 */
export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { user, orgId } = auth

    const body = await request.json()
    const { priceId } = body as { priceId?: string }

    if (!priceId) {
      return NextResponse.json({ error: 'priceId es obligatorio' }, { status: 400 })
    }

    const stripe = getStripe()
    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Error de configuración del servidor' }, { status: 500 })
    }

    // Buscar si la org ya tiene stripe_customer_id
    const { data: org } = await admin
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', orgId)
      .maybeSingle()

    let customerId = (org as { stripe_customer_id?: string } | null)?.stripe_customer_id

    // Crear customer en Stripe si no existe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          org_id: orgId,
          supabase_user_id: user.id,
        },
        name: (org as { name?: string } | null)?.name ?? undefined,
      })
      customerId = customer.id

      // Guardar en la org
      await admin
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', orgId)
    }

    // Crear Checkout Session
    const origin = request.headers.get('origin') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/panel/planes?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${origin}/panel/planes?status=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        org_id: orgId,
      },
      subscription_data: {
        metadata: {
          org_id: orgId,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creando checkout session:', error)
    return NextResponse.json({ error: 'Error creando sesión de pago' }, { status: 500 })
  }
}
