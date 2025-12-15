'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LandingAuthNav() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  const refreshSession = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setHasSession(!!session)
    } catch {
      // Si faltan env vars en algún entorno, evitamos romper la landing
      setHasSession(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const run = async () => {
      await refreshSession()
      if (cancelled) return

      try {
        const supabase = createClient()
        const { data } = supabase.auth.onAuthStateChange(() => {
          if (!cancelled) refreshSession()
        })
        unsubscribe = () => data.subscription.unsubscribe()
      } catch {
        // noop
      }
    }

    run()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [refreshSession])

  const handleLogout = useCallback(async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } finally {
      setHasSession(false)
      router.refresh()
    }
  }, [router])

  if (hasSession) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard"
          className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors"
        >
          Ir al dashboard
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="text-foreground hover:text-primary transition-colors font-medium"
          disabled={isLoading}
        >
          Cerrar sesión
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-4 ${isLoading ? 'opacity-80' : ''}`}>
      <Link
        href="/login"
        className="text-foreground hover:text-primary transition-colors font-medium"
      >
        Iniciar sesión
      </Link>
      <Link
        href="/registro"
        className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors"
      >
        Probar gratis
      </Link>
    </div>
  )
}


