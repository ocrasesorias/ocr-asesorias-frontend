'use client';

import { ScrollReveal } from '@/components/ScrollReveal';
import Link from 'next/link';

export function PricingCards() {
  return (
    <section id="planes" className="py-20 bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Un plan a medida para tu gestoría
            </h2>
            <p className="text-xl text-foreground-secondary max-w-2xl mx-auto">
              Cada despacho es diferente. Por eso preparamos una propuesta
              personalizada según tu volumen de facturas y necesidades reales.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={120} direction="up">
          <div className="bg-white rounded-2xl border-2 border-primary shadow-lg overflow-hidden">
            <div className="p-8 sm:p-10 text-center">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                Plan Personalizado
              </h3>
              <p className="text-foreground-secondary mb-8 max-w-md mx-auto">
                Te proponemos un plan adaptado a tu volumen, con el precio justo
                y sin sorpresas. Cuéntanos qué necesitas y te respondemos en
                menos de 24h.
              </p>

              <ul className="space-y-4 text-left max-w-sm mx-auto mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground-secondary text-sm">Volumen de facturas ajustado a tu cartera de clientes</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground-secondary text-sm">Extracción con IA híbrida (Visión + Texto)</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground-secondary text-sm">Soporte prioritario y onboarding guiado</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-foreground-secondary text-sm">Sin permanencia ni compromisos a largo plazo</span>
                </li>
              </ul>

              <Link
                href="/#contacto"
                className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors"
              >
                Solicitar propuesta
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
