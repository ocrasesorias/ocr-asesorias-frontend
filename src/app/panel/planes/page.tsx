'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDashboardAuth } from '@/hooks/useDashboardAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useToast } from '@/contexts/ToastContext'
import Link from 'next/link'
import { isStripeEnabled } from '@/lib/features'

const PLANS = [
  {
    name: 'Profesional',
    description: 'Para gestorías pequeñas',
    features: [
      '750 facturas/mes incluidas',
      'Soporte por email prioritario',
      'Exceso: 0,12 €/factura',
    ],
    prices: {
      mensual: {
        amount: 79,
        label: '79 €/mes',
        envKey: 'profesional_mensual',
      },
      anual: {
        amount: 66,
        label: '66 €/mes',
        sublabel: '790 €/año — ahorra 2 meses',
        envKey: 'profesional_anual',
      },
    },
  },
  {
    name: 'Gestoría',
    description: 'Para gestorías medianas',
    popular: true,
    features: [
      '2.000 facturas/mes incluidas',
      'Soporte prioritario + onboarding',
      'Exportación masiva Excel',
      'Dashboard de métricas',
      'Exceso: 0,08 €/factura',
    ],
    prices: {
      mensual: {
        amount: 149,
        label: '149 €/mes',
        envKey: 'gestoria_mensual',
      },
      anual: {
        amount: 125,
        label: '125 €/mes',
        sublabel: '1.490 €/año — ahorra 2 meses',
        envKey: 'gestoria_anual',
      },
    },
  },
]

// Mapeo de envKey a variable de entorno (se pasan desde el servidor vía la API)
const PRICE_IDS: Record<string, string> = {
  profesional_mensual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL_MENSUAL ?? '',
  profesional_anual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL_ANUAL ?? '',
  gestoria_mensual: process.env.NEXT_PUBLIC_STRIPE_PRICE_GESTORIA_MENSUAL ?? '',
  gestoria_anual: process.env.NEXT_PUBLIC_STRIPE_PRICE_GESTORIA_ANUAL ?? '',
}

export default function PlanesPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isStripeEnabled) router.replace('/panel')
  }, [router])

  const { orgId, isLoading: authLoading } = useDashboardAuth()
  const { subscription, isLoading: subLoading } = useSubscription(orgId)
  const { showError, showSuccess } = useToast()
  const [billingPeriod, setBillingPeriod] = useState<'mensual' | 'anual'>('mensual')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  if (!isStripeEnabled) return null

  const isLoading = authLoading || subLoading

  const handleSubscribe = async (envKey: string) => {
    const priceId = PRICE_IDS[envKey]
    if (!priceId) {
      showError('Precio no configurado. Contacta con soporte.')
      return
    }

    setLoadingPlan(envKey)
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        showError(data?.error || 'Error al crear la sesión de pago')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      showError('Error de conexión')
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setLoadingPlan('portal')
    try {
      const resp = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await resp.json()
      if (!resp.ok) {
        showError(data?.error || 'Error abriendo el portal')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      showError('Error de conexión')
    } finally {
      setLoadingPlan(null)
    }
  }

  // Mostrar mensaje de éxito si viene de checkout
  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null
  const status = searchParams?.get('status')

  if (status === 'success' && subscription.status !== 'active') {
    // Esperar a que el webhook actualice — mostrar mensaje
    showSuccess('¡Pago completado! Tu suscripción se activará en unos segundos.')
  }

  const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/panel"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Volver al panel
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">Planes y facturación</h1>
          </div>

          {hasActiveSubscription && (
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={loadingPlan === 'portal'}
              className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loadingPlan === 'portal' ? 'Abriendo...' : 'Gestionar suscripción'}
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Status banner */}
        {hasActiveSubscription && (
          <div className="mb-8 p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-green-800 font-medium">
              Plan actual: <span className="font-bold">{subscription.planName}</span>
              {subscription.periodEnd && (
                <span className="text-green-600 font-normal ml-2">
                  · Próxima renovación: {new Date(subscription.periodEnd).toLocaleDateString('es-ES')}
                </span>
              )}
            </p>
          </div>
        )}

        {/* Toggle mensual/anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod('mensual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'mensual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('anual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'anual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Anual
              <span className="ml-1 text-xs text-green-600 font-semibold">-16%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {PLANS.map((plan) => {
            const priceInfo = plan.prices[billingPeriod]
            const envKey = priceInfo.envKey
            const isCurrentPlan =
              hasActiveSubscription && subscription.planName === plan.name
            const isLoadingThis = loadingPlan === envKey

            return (
              <div
                key={plan.name}
                className={`relative bg-white rounded-2xl border-2 p-8 ${
                  plan.popular
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Más popular
                  </div>
                )}

                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

                <div className="mt-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {priceInfo.amount} €
                  </span>
                  <span className="text-gray-500 ml-1">/mes</span>
                </div>

                {billingPeriod === 'anual' && 'sublabel' in priceInfo && (
                  <p className="text-xs text-green-600 mt-1">{priceInfo.sublabel}</p>
                )}

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg
                        className="w-4 h-4 text-green-500 mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    isCurrentPlan ? handleManageSubscription() : handleSubscribe(envKey)
                  }
                  disabled={isLoading || isLoadingThis}
                  className={`mt-8 w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    isCurrentPlan
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : plan.popular
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isLoadingThis
                    ? 'Redirigiendo...'
                    : isCurrentPlan
                      ? 'Gestionar plan'
                      : 'Suscribirse'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Info */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Pago seguro con Stripe. Puedes cancelar en cualquier momento.
          Los precios no incluyen IVA.
        </p>
      </div>
    </div>
  )
}
