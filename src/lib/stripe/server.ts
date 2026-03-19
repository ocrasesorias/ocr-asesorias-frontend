import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY no está configurada')
  }

  _stripe = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  })

  return _stripe
}

/**
 * Mapeo de price IDs de Stripe a nombres de plan.
 * Rellena con tus IDs reales del dashboard de Stripe.
 */
export const STRIPE_PRICES = {
  profesional_mensual: process.env.STRIPE_PRICE_PROFESIONAL_MENSUAL!,
  profesional_anual: process.env.STRIPE_PRICE_PROFESIONAL_ANUAL!,
  gestoria_mensual: process.env.STRIPE_PRICE_GESTORIA_MENSUAL!,
  gestoria_anual: process.env.STRIPE_PRICE_GESTORIA_ANUAL!,
} as const

/** Créditos que otorga cada plan al mes */
export const PLAN_CREDITS: Record<string, number> = {
  [process.env.STRIPE_PRICE_PROFESIONAL_MENSUAL!]: 750,
  [process.env.STRIPE_PRICE_PROFESIONAL_ANUAL!]: 750,
  [process.env.STRIPE_PRICE_GESTORIA_MENSUAL!]: 2000,
  [process.env.STRIPE_PRICE_GESTORIA_ANUAL!]: 2000,
}
