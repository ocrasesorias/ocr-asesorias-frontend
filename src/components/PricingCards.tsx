'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScrollReveal } from '@/components/ScrollReveal';

const CheckIcon = () => (
  <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const PLANS = [
  {
    name: 'Profesional',
    description: 'Para gestorías pequeñas',
    features: [
      '750 facturas/mes incluidas',
      'Extracción con IA híbrida (Visión + Texto)',
      'Exportación Excel',
      'Dashboard de métricas',
      'Soporte por email',
    ],
    prices: {
      mensual: { amount: 79, period: '/mes', sublabel: '' },
      anual: { amount: 790, period: '/año', sublabel: 'Ahorra 2 meses' },
    },
  },
  {
    name: 'Gestoría',
    description: 'Para gestorías medianas',
    popular: true,
    features: [
      '2.000 facturas/mes incluidas',
      'Extracción con IA híbrida (Visión + Texto)',
      'Exportación Excel',
      'Dashboard de métricas',
      'Soporte prioritario + onboarding',
    ],
    prices: {
      mensual: { amount: 149, period: '/mes', sublabel: '' },
      anual: { amount: 1490, period: '/año', sublabel: 'Ahorra 2 meses' },
    },
  },
];

interface PricingCardsProps {
  hasSession?: boolean;
}

export function PricingCards({ hasSession = false }: PricingCardsProps) {
  const [billingPeriod, setBillingPeriod] = useState<'mensual' | 'anual'>('mensual');

  return (
    <section id="planes" className="py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold mb-4" style={{ color: 'var(--l-text)' }}>
              Planes simples, sin sorpresas
            </h2>
            <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--l-text-secondary)' }}>
              Elige el plan que mejor se adapte a tu volumen de facturas. Empieza gratis con 25 facturas de prueba.
            </p>
          </div>
        </ScrollReveal>

        {/* Toggle mensual/anual */}
        <div className="flex justify-center mb-10">
          <div
            className="inline-flex items-center rounded-none p-1"
            style={{ backgroundColor: 'var(--l-card-border)' }}
          >
            <button
              type="button"
              onClick={() => setBillingPeriod('mensual')}
              className="px-5 py-2 rounded-none text-sm font-medium transition-colors"
              style={{
                backgroundColor: billingPeriod === 'mensual' ? 'var(--l-card)' : 'transparent',
                color: billingPeriod === 'mensual' ? 'var(--l-text)' : 'var(--l-text-muted)',
              }}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('anual')}
              className="px-5 py-2 rounded-none text-sm font-medium transition-colors"
              style={{
                backgroundColor: billingPeriod === 'anual' ? 'var(--l-card)' : 'transparent',
                color: billingPeriod === 'anual' ? 'var(--l-text)' : 'var(--l-text-muted)',
              }}
            >
              Anual
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, i) => {
            const priceInfo = plan.prices[billingPeriod];

            return (
              <ScrollReveal key={plan.name} delayMs={120 * (i + 1)} direction="up">
                <div
                  className="relative rounded-none border-2 overflow-hidden h-full flex flex-col"
                  style={{
                    backgroundColor: 'var(--l-card)',
                    borderColor: plan.popular ? 'var(--primary)' : 'var(--l-card-border)',
                  }}
                >
                  {plan.popular && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 translate-y-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-none">
                      Mas popular
                    </div>
                  )}

                  <div className="p-8 sm:p-10 text-center flex-1 flex flex-col">
                    <h3 className="text-2xl font-bold mb-1" style={{ color: 'var(--l-text)' }}>
                      {plan.name}
                    </h3>
                    <p className="mb-6 text-sm" style={{ color: 'var(--l-text-secondary)' }}>
                      {plan.description}
                    </p>

                    <div className="mb-2">
                      <span className="text-4xl font-bold" style={{ color: 'var(--l-text)' }}>
                        {priceInfo.amount} €
                      </span>
                      <span className="ml-1" style={{ color: 'var(--l-text-secondary)' }}>{priceInfo.period}</span>
                    </div>

                    {billingPeriod === 'anual' && priceInfo.sublabel && (
                      <p className="text-xs text-green-500 mb-6">{priceInfo.sublabel}</p>
                    )}
                    {billingPeriod === 'mensual' && <div className="mb-6" />}

                    <ul className="space-y-3 text-left max-w-sm mx-auto mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm" style={{ color: 'var(--l-text-secondary)' }}>
                          <CheckIcon />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={hasSession ? '/panel/planes' : '/registro'}
                      className={`inline-block px-8 py-3 rounded-none font-semibold transition-colors mt-auto ${
                        plan.popular
                          ? 'bg-primary text-white hover:bg-primary-hover'
                          : 'bg-secondary text-white hover:bg-secondary-hover'
                      }`}
                    >
                      {hasSession ? 'Ver planes' : 'Empieza gratis'}
                    </Link>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal delayMs={400}>
          <p className="text-center text-sm mt-8" style={{ color: 'var(--l-text-muted)' }}>
            Empieza con <span className="font-semibold">25 facturas gratis</span>, sin tarjeta. Precios sin IVA. Cancela cuando quieras.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
