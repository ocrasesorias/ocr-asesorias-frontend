'use client';

import React from 'react';

interface AnimateIconProps {
  children: React.ReactNode;
  animateOnHover?: boolean;
  className?: string;
}

/**
 * Wrapper para iconos que añade una animación sutil al hacer hover (scale + transición).
 */
export function AnimateIcon({
  children,
  animateOnHover = true,
  className = '',
}: AnimateIconProps) {
  return (
    <span
      className={`inline-flex transition-transform duration-200 ${animateOnHover ? 'hover:scale-110' : ''} ${className}`}
    >
      {children}
    </span>
  );
}
