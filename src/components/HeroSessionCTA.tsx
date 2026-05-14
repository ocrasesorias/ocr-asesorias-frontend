'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isStripeEnabled } from '@/lib/features';

interface HeroSessionCTAProps {
  /** "hero" usa los estilos del bloque principal; "footer" los del bloque CTA inferior */
  variant: 'hero' | 'footer';
}

/**
 * Renderiza los CTAs principales según el estado de sesión leído en cliente.
 * Sirve un fallback "no logueado" durante el primer paint (mayoritario en landings)
 * para permitir que la página sea totalmente estática y mejore TTFB/LCP.
 */
export function HeroSessionCTA({ variant }: HeroSessionCTAProps) {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setHasSession(!!session);
      } catch {
        if (!cancelled) setHasSession(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  if (variant === 'hero') {
    if (hasSession) {
      return (
        <Link
          href="/panel"
          className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
        >
          Ir al panel
        </Link>
      );
    }
    return (
      <>
        {isStripeEnabled ? (
          <Link
            href="/registro"
            className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            Empieza gratis
          </Link>
        ) : (
          <Link
            href="/login"
            className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
          >
            Iniciar sesion
          </Link>
        )}
        <Link
          href="#como-funciona"
          className="landing-outline-btn px-8 py-4 rounded-none text-lg font-semibold text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2"
        >
          Ver cómo funciona
        </Link>
      </>
    );
  }

  // variant === 'footer'
  if (hasSession) {
    return (
      <Link
        href="/panel"
        className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
      >
        Ir al panel
      </Link>
    );
  }
  return (
    <>
      {isStripeEnabled ? (
        <>
          <Link
            href="/registro"
            className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
          >
            Empieza gratis
          </Link>
          <Link
            href="/login"
            className="border-2 border-secondary text-secondary px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary hover:text-white transition-colors text-center"
          >
            Iniciar sesion
          </Link>
        </>
      ) : (
        <Link
          href="/login"
          className="bg-secondary text-white px-8 py-4 rounded-none text-lg font-semibold hover:bg-secondary-hover transition-colors shadow-lg text-center"
        >
          Iniciar sesion
        </Link>
      )}
    </>
  );
}
