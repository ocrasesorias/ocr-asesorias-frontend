'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function LandingAuthNav() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const run = async () => {
      try {
        const supabase = createClient()

        // getSession() es aceptable aquí porque es solo para UI de la landing.
        // La verificación real ocurre en el middleware al navegar a /dashboard.
        const { data: { session } } = await supabase.auth.getSession()
        if (!cancelled) setHasSession(!!session)

        // Escuchar cambios de sesión (login/logout desde otra pestaña)
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!cancelled) setHasSession(!!session)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      } catch {
        // Si faltan env vars en algún entorno, evitamos romper la landing
        if (!cancelled) setHasSession(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

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
          aria-label="Cerrar sesión de tu cuenta"
          className="text-red-700 hover:text-red-800 transition-colors font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-lg px-2 py-1"
          disabled={isLoading}
          aria-busy={isLoading}
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
        href="/#contacto"
        className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-primary-hover transition-colors"
      >
        Contactar
      </Link>
    </div>
  )
}


