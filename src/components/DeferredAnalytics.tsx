'use client';

import dynamic from 'next/dynamic';

const Analytics = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false }
);
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights),
  { ssr: false }
);

/**
 * Carga Analytics y SpeedInsights de forma diferida (después de la hidratación).
 * Se usa como Client Component desde el layout (Server Component).
 */
export function DeferredAnalytics() {
  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
