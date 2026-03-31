'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { formatMiles } from '@/utils/formatNumber';
import { SuggestionsModal } from './modals/SuggestionsModal';
import { safeRemoveItem } from '@/utils/safeStorage';
import { isStripeEnabled } from '@/lib/features';
import { ThemeToggle } from '@/components/ThemeToggle';
import { StickyHeader } from '@/components/StickyHeader';

interface DashboardHeaderProps {
  organizationName: string;
  creditsBalance: number | null;
  isLoadingCredits: boolean;
  isUnlimitedCredits?: boolean;
  orgId: string | null;
  planName?: string | null;
  subscriptionStatus?: string | null;
  isTrial?: boolean;
}

export function DashboardHeader({
  organizationName,
  creditsBalance,
  isLoadingCredits,
  isUnlimitedCredits = false,
  orgId,
  planName,
  subscriptionStatus,
  isTrial = false,
}: DashboardHeaderProps) {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      showError(translateError(error.message));
      return;
    }

    if (orgId) {
      safeRemoveItem(`panel:selectedClientId:${orgId}`);
      safeRemoveItem(`panel:selectedUploadId:${orgId}`);
    }

    showSuccess('Sesión cerrada');
    router.push('/');
  };

  const navLinks = [
    {
      href: '#',
      label: 'Sugerencias',
      onClick: () => { setIsSuggestionsOpen(true); setIsMobileMenuOpen(false); },
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/panel/pendientes',
      label: 'Pendientes',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/panel/admin/suggestions',
      label: 'Admin',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/panel/equipo',
      label: 'Equipo',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      href: '/panel/preferencias',
      label: 'Preferencias',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Navbar compacto — sticky con auto-hide */}
      <StickyHeader>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/img/logo.png"
                alt="KontaScan"
                width={100}
                height={100}
                className="h-8 w-auto"
                priority
              />
              <span className="text-xl font-bold" style={{ color: 'var(--l-text, #1f2937)' }}>KontaScan</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center space-x-3">
              {navLinks.map((link) =>
                link.onClick ? (
                  <button
                    key={link.label}
                    type="button"
                    onClick={link.onClick}
                    className="p-2 rounded-none transition-colors"
                    style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                    aria-label={link.label}
                    title={link.label}
                  >
                    {link.icon}
                  </button>
                ) : (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="p-2 rounded-none transition-colors"
                    style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                    title={link.label}
                  >
                    {link.icon}
                  </Link>
                )
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="transition-colors text-sm" style={{ color: 'var(--l-text-secondary, #6b7280)' }}
              >
                Cerrar sesión
              </button>
              <ThemeToggle />
            </nav>

            {/* Mobile: theme toggle + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="p-2 transition-colors"
                style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                aria-label="Abrir menú"
              >
                {isMobileMenuOpen ? (
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                    <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          {isMobileMenuOpen && (
            <div ref={menuRef} className="md:hidden border-t border-[var(--l-header-border,#e5e7eb)] py-2 pb-4">
              <nav className="flex flex-col gap-1">
                {navLinks.map((link) =>
                  link.onClick ? (
                    <button
                      key={link.label}
                      type="button"
                      onClick={link.onClick}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-none hover:bg-[var(--l-bg,#f9fafb)]"
                      style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                    >
                      {link.icon}
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-none hover:bg-[var(--l-bg,#f9fafb)]"
                      style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                    >
                      {link.icon}
                      {link.label}
                    </Link>
                  )
                )}
                <button
                  type="button"
                  onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-none hover:bg-[var(--l-bg,#f9fafb)]"
                  style={{ color: 'var(--l-text-secondary, #6b7280)' }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Cerrar sesión
                </button>
              </nav>
            </div>
          )}
        </div>
      </StickyHeader>

      {/* Info bar: nombre + créditos (pt-16 compensa el header fixed) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-xl sm:text-2xl font-light text-foreground truncate">
              {organizationName || 'Panel'}
            </h2>
            {isTrial && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-secondary text-white shrink-0">
                Prueba gratuita
              </span>
            )}
            {!isTrial && planName && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary shrink-0">
                Plan {planName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-foreground-secondary uppercase tracking-wider">Créditos</span>
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {isLoadingCredits
                ? '…'
                : isUnlimitedCredits
                  ? 'Ilimitados'
                  : (creditsBalance != null ? formatMiles(creditsBalance, 0) : '—')}
            </span>
            {isStripeEnabled && !isUnlimitedCredits && (
              <Link href="/panel/planes" className="text-xs text-primary hover:text-primary-hover font-medium">
                Ver planes →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Banner de créditos agotados */}
      {!isLoadingCredits && !isUnlimitedCredits && creditsBalance != null && creditsBalance <= 0 && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Has agotado tus créditos.</span>{' '}
              {isStripeEnabled
                ? 'Suscríbete a un plan para seguir procesando facturas.'
                : 'Contacta con soporte para seguir procesando facturas.'}
            </p>
            {isStripeEnabled && (
              <Link
                href="/panel/planes"
                className="shrink-0 ml-4 px-4 py-1.5 bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
              >
                Ver planes
              </Link>
            )}
          </div>
        </div>
      )}

      <SuggestionsModal isOpen={isSuggestionsOpen} onClose={() => setIsSuggestionsOpen(false)} />
    </>
  );
}
