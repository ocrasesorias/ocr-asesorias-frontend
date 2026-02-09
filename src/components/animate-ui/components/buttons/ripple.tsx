'use client';

import React, { useCallback, useRef, useState } from 'react';

export type RippleButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
};

interface Ripple {
  id: number;
  x: number;
  y: number;
}

const variantClasses: Record<NonNullable<RippleButtonProps['variant']>, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary',
  secondary: 'bg-secondary text-white hover:bg-secondary-hover focus:ring-secondary',
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white focus:ring-primary',
};

const sizeClasses: Record<NonNullable<RippleButtonProps['size']>, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
  icon: 'p-3',
};

export function RippleButton({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  onClick,
  ...rest
}: RippleButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextId = useRef(0);

  const addRipple = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = ref.current;
      if (!button || disabled) return;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = nextId.current++;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 600);
    },
    [disabled]
  );

  const baseClasses =
    'relative font-semibold rounded-lg overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`;

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      onMouseDown={addRipple}
      onClick={onClick}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">{children}</span>
      <RippleButtonRipples ripples={ripples} variant={variant} />
    </button>
  );
}

function RippleButtonRipples({
  ripples,
  variant: _variant,
}: {
  ripples: Ripple[];
  variant: RippleButtonProps['variant'];
}) {
  return (
    <span className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      {ripples.map(({ id, x, y }) => (
        <span
          key={id}
          className="ripple-span absolute rounded-full bg-current opacity-20"
          style={{
            left: x,
            top: y,
            width: 24,
            height: 24,
            marginLeft: -12,
            marginTop: -12,
            animation: 'ripple 0.6s ease-out forwards',
          }}
        />
      ))}
    </span>
  );
}

export { RippleButtonRipples };
