'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ScrollReveal } from '@/components/ScrollReveal';

type Billing = 'monthly' | 'annual';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 29,
    annualPrice: 290,
    invoices: 100,
    extraPrice: '0,35',
    ideal: 'Autónomos o gestores freelance.',
    cta: 'Empezar',
    featured: false,
    priceColor: 'text-foreground' as const,
    buttonClass: 'border-2 border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 99,
    annualPrice: 990,
    invoices: 500,
    extraPrice: '0,25',
    ideal: 'Gestorías pequeñas (1-3 empleados). Es el plan más elegido.',
    cta: 'Elegir Pro',
    featured: true,
    priceColor: 'text-primary' as const,
    buttonClass: 'bg-primary text-white font-semibold hover:bg-primary-hover transition-colors',
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: 249,
    annualPrice: 2490,
    invoices: 2000,
    extraPrice: '0,15',
    ideal: 'Despachos consolidados con mucho volumen.',
    cta: 'Elegir Business',
    featured: false,
    priceColor: 'text-foreground' as const,
    buttonClass: 'border-2 border-slate-300 text-foreground font-semibold hover:bg-slate-50 transition-colors',
  },
];

function formatPrice(n: number) {
  return n.toLocaleString('es-ES');
}

export function PricingCards() {
  const [billing, setBilling] = useState<Billing>('monthly');

  return (
    <section id="planes" className="py-20 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Planes que se adaptan a ti
            </h2>
            <p className="text-xl text-foreground-secondary max-w-2xl mx-auto mb-8">
              Elige mensual o anual y llevaté 2 meses gratis.
            </p>

            {/* Switch Mensual / Anual */}
            <div className="inline-flex items-center gap-3 p-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              aria-pressed={billing === 'monthly'}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                billing === 'monthly'
                  ? 'bg-primary text-white'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBilling('annual')}
              aria-pressed={billing === 'annual'}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                billing === 'annual'
                  ? 'bg-primary text-white'
                  : 'text-foreground-secondary hover:text-foreground'
              }`}
            >
              Anual
            </button>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {PLANS.map((plan, index) => (
            <ScrollReveal key={plan.id} delayMs={index * 120} direction="up">
            <div
              className={`bg-white rounded-2xl overflow-hidden flex flex-col ${
                plan.featured ? 'border-2 border-primary shadow-lg relative' : 'border border-slate-200 shadow-sm'
              }`}
            >
              {plan.featured && (
                <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Más elegido
                </div>
              )}
              <div className={`p-6 border-b border-slate-100 shrink-0 ${plan.featured ? 'bg-primary/5' : ''}`}>
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {plan.name}
                </h3>
                {billing === 'monthly' ? (
                  <>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className={`text-3xl font-bold ${plan.priceColor}`}>
                        {formatPrice(plan.monthlyPrice)}€
                      </span>
                      <span className="text-foreground-secondary">/mes</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-4 flex items-baseline gap-1">
                      <span className={`text-3xl font-bold ${plan.priceColor}`}>
                        {formatPrice(plan.annualPrice)}€
                      </span>
                      <span className="text-foreground-secondary">/año</span>
                    </div>
                    <p className="mt-1 text-sm text-foreground-secondary">2 meses gratis</p>
                  </>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-3 text-foreground-secondary text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-primary font-medium">{formatPrice(plan.invoices)}</span> facturas / mes incluidas
                  </li>
                  <li>
                    Factura extra: <strong className="text-foreground">{plan.extraPrice}€</strong>
                  </li>
                  <li className="pt-2 text-foreground-secondary border-t border-slate-100 mt-auto">
                    {plan.ideal}
                  </li>
                </ul>
                <Link
                  href="/registro"
                  className={`mt-6 block w-full text-center py-3 px-4 rounded-lg transition-colors ${plan.buttonClass}`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
            </ScrollReveal>
          ))}
        </div>

        <ScrollReveal delayMs={200}>
        <p className="mt-6 text-center text-sm text-foreground-secondary">
          * Precio por factura extra aplicable una vez consumidas las incluidas en el plan.
        </p>
        </ScrollReveal>
      </div>
    </section>
  );
}
