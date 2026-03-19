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
      'Soporte por email prioritario',
      'Exceso: 0,12 €/factura',
    ],
    prices: {
      mensual: { amount: 79, label: '79 €', period: '/mes', sublabel: '' },
      anual: { amount: 66, label: '66 €', period: '/mes', sublabel: '790 €/año — ahorra 16%' },
    },
  },
  {
    name: 'Gestoría',
    description: 'Para gestorías medianas',
    popular: true,
    features: [
      '2.000 facturas/mes incluidas',
      'Soporte prioritario + onboarding',
      'Exportación masiva Excel',
      'Dashboard de métricas',
      'Exceso: 0,08 €/factura',
    ],
    prices: {
      mensual: { amount: 149, label: '149 €', period: '/mes', sublabel: '' },
      anual: { amount: 125, label: '125 €', period: '/mes', sublabel: '1.490 €/año — ahorra 16%' },
    },
  },
];

interface PricingCardsProps {
  hasSession?: boolean;
}

export function PricingCards({ hasSession = false }: PricingCardsProps) {
  const [billingPeriod, setBillingPeriod] = useState<'mensual' | 'anual'>('mensual');

  return (
    <section id="planes" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Planes simples, sin sorpresas
            </h2>
            <p className="text-xl text-foreground-secondary max-w-2xl mx-auto">
              Elige el plan que mejor se adapte a tu volumen de facturas. Empieza gratis con 25 facturas de prueba.
            </p>
          </div>
        </ScrollReveal>

        {/* Toggle mensual/anual */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1">
            <button
              type="button"
              onClick={() => setBillingPeriod('mensual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'mensual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('anual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billingPeriod === 'anual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Anual
              <span className="ml-1 text-xs text-green-600 font-semibold">-16%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, i) => {
            const priceInfo = plan.prices[billingPeriod];

            return (
              <ScrollReveal key={plan.name} delayMs={120 * (i + 1)} direction="up">
                <div
                  className={`relative bg-white rounded-2xl border-2 shadow-lg overflow-hidden h-full flex flex-col ${
                    plan.popular ? 'border-blue-500' : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 translate-y-0 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-b-lg">
                      Más popular
                    </div>
                  )}

                  <div className="p-8 sm:p-10 text-center flex-1 flex flex-col">
                    <h3 className="text-2xl font-bold text-foreground mb-1">
                      {plan.name}
                    </h3>
                    <p className="text-foreground-secondary mb-6 text-sm">
                      {plan.description}
                    </p>

                    <div className="mb-2">
                      <span className="text-4xl font-bold text-foreground">
                        {priceInfo.amount} €
                      </span>
                      <span className="text-foreground-secondary ml-1">{priceInfo.period}</span>
                    </div>

                    {billingPeriod === 'anual' && priceInfo.sublabel && (
                      <p className="text-xs text-green-600 mb-6">{priceInfo.sublabel}</p>
                    )}
                    {billingPeriod === 'mensual' && <div className="mb-6" />}

                    <ul className="space-y-3 text-left max-w-sm mx-auto mb-8 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckIcon />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={hasSession ? '/panel/planes' : '/registro'}
                      className={`inline-block px-8 py-3 rounded-lg font-semibold transition-colors mt-auto ${
                        plan.popular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
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
          <p className="text-center text-sm text-foreground-secondary mt-8">
            Empieza con <span className="font-semibold">25 facturas gratis</span>, sin tarjeta. Precios sin IVA. Cancela cuando quieras.
          </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
