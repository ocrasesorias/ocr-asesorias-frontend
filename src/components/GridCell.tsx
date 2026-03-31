'use client';

import { useEffect, useRef, useState } from 'react';

interface GridCellProps {
  style: React.CSSProperties;
  delay?: number;
}

export function GridCell({ style, delay = 0 }: GridCellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="grid-cell"
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transitionDelay: `${delay}s`,
      }}
    />
  );
}
