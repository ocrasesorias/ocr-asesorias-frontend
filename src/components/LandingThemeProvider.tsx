'use client';

import { useEffect, useRef } from 'react';

/**
 * Landing page wrapper. Theme is now global (via ThemeProvider in Providers).
 * This component only handles the grid-right-base calculation for grid cell alignment.
 */
export function LandingThemeProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const cols = Math.floor(el.clientWidth / 64);
      el.style.setProperty('--grid-right-base', `${cols * 64}px`);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return <div ref={ref}>{children}</div>;
}
