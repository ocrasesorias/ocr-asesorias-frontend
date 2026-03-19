import { useState, useCallback, useEffect } from 'react'

export interface SubscriptionInfo {
  status: string | null
  priceId: string | null
  periodEnd: string | null
  planName: string | null
  isTrial: boolean
}

/**
 * Hook para consultar el estado de suscripción de la organización.
 */
export function useSubscription(orgId: string | null) {
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    status: null,
    priceId: null,
    periodEnd: null,
    planName: null,
    isTrial: false,
  })
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!orgId) return
    setIsLoading(true)
    try {
      const resp = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/subscription`)
      const data = await resp.json().catch(() => null)
      if (resp.ok && data) {
        setSubscription({
          status: data.status ?? null,
          priceId: data.price_id ?? null,
          periodEnd: data.period_end ?? null,
          planName: data.plan_name ?? null,
          isTrial: data.is_trial ?? false,
        })
      }
    } catch {
      // silencio
    } finally {
      setIsLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { subscription, isLoading, refresh }
}
