'use client';

/**
 * Simple wrapper for pages outside the landing.
 * Theme is now global (applied to <html> by ThemeProvider), so this is just a passthrough div.
 */
export function ThemedPage({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style}>{children}</div>;
}
