import { NextResponse } from 'next/server'
import { getStripe, PLAN_CREDITS } from '@/lib/stripe/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Tipos auxiliares para campos que la API v2026 mueve de sitio
type InvoiceWithSub = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null
}

/**
 * POST /api/stripe/webhook
 * Recibe eventos de Stripe y actualiza la org en Supabase.
 */
export async function POST(request: Request) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET no configurada')
    return NextResponse.json({ error: 'Webhook no configurado' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Error verificando webhook:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: 'Error de configuración' }, { status: 500 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          await syncSubscription(admin, subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscription(admin, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const orgId = subscription.metadata?.org_id
        if (orgId) {
          await admin
            .from('organizations')
            .update({
              stripe_subscription_id: null,
              stripe_price_id: null,
              subscription_status: 'canceled',
              subscription_period_end: null,
            })
            .eq('id', orgId)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as InvoiceWithSub
        // Solo recargar créditos en pagos de renovación (no el primero)
        if (
          invoice.billing_reason === 'subscription_cycle' &&
          invoice.subscription
        ) {
          const subId =
            typeof invoice.subscription === 'string'
              ? invoice.subscription
              : invoice.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subId)
          const orgId = subscription.metadata?.org_id
          const priceId = subscription.items.data[0]?.price?.id
          if (orgId && priceId) {
            const credits = PLAN_CREDITS[priceId] ?? 0
            if (credits > 0) {
              await admin.rpc('add_credits', {
                p_org_id: orgId,
                p_amount: credits,
              })
            }
          }
        }
        break
      }
    }
  } catch (error) {
    console.error(`Error procesando evento ${event.type}:`, error)
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Sincroniza el estado de la suscripción de Stripe con la org en Supabase.
 */
async function syncSubscription(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  subscription: Stripe.Subscription
) {
  const orgId = subscription.metadata?.org_id
  if (!orgId) {
    console.warn('Suscripción sin org_id en metadata:', subscription.id)
    return
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null
  const status = subscription.status
  // current_period_end está ahora en el item de la suscripción
  const periodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    : null

  await admin
    .from('organizations')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      subscription_status: status,
      subscription_period_end: periodEnd,
      is_trial: false,
    })
    .eq('id', orgId)

  // Si la suscripción acaba de activarse, asignar créditos iniciales
  if (status === 'active' && priceId) {
    const credits = PLAN_CREDITS[priceId] ?? 0
    if (credits > 0) {
      const { data: org } = await admin
        .from('organizations')
        .select('credits_balance')
        .eq('id', orgId)
        .maybeSingle()

      const currentBalance = (org as { credits_balance?: number } | null)?.credits_balance ?? 0
      if (currentBalance <= 0) {
        await admin.rpc('add_credits', {
          p_org_id: orgId,
          p_amount: credits,
        })
      }
    }
  }
}
