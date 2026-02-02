'use client';

import React, { useEffect, useRef, useState } from 'react';

interface StickyHeaderProps {
  children: React.ReactNode;
  /** px desde el top en el que siempre se muestra */
  revealAtTopPx?: number;
  /** mínimo delta de scroll para considerar cambio de dirección */
  minDeltaPx?: number;
}

export function StickyHeader({
  children,
  revealAtTopPx = 80,
  minDeltaPx = 6,
}: StickyHeaderProps) {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;

      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        // Cerca del top: siempre visible
        if (y <= revealAtTopPx) {
          setVisible(true);
        } else if (Math.abs(delta) >= minDeltaPx) {
          // Subiendo: revelar, Bajando: ocultar
          if (delta < 0) setVisible(true);
          if (delta > 0) setVisible(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [minDeltaPx, revealAtTopPx]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-background border-b border-gray-200 transition-transform duration-300 ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      {children}
    </header>
  );
}


