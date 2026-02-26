'use client';

import { ScrollReveal } from '@/components/ScrollReveal';

const CheckIcon = () => (
  <svg className="w-5 h-5 text-primary mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const benefits = [
  'Volumen de facturas ajustado a tu cartera de clientes',
  'Extracción con IA híbrida (Visión + Texto)',
  'Soporte prioritario y onboarding guiado',
  'Sin permanencia ni compromisos a largo plazo',
];

export function PricingCards() {
  return (
    <section id="planes" className="py-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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

        <div className="grid md:grid-cols-2 gap-6">
          <ScrollReveal delayMs={120} direction="up">
            <div className="bg-white rounded-2xl border-2 border-primary shadow-lg overflow-hidden h-full flex flex-col">
              <div className="p-8 sm:p-10 text-center flex-1 flex flex-col">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Empresas
                </h3>
                <p className="text-foreground-secondary mb-4 text-sm">
                  Para empresas con gran volumen de facturas
                </p>
                <p className="text-2xl font-bold text-primary mb-6">
                  Desde 70 € <span className="text-base font-normal text-foreground-secondary">/ mes</span>
                </p>

                <ul className="space-y-4 text-left max-w-sm mx-auto mb-8 flex-1">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckIcon />
                      <span className="text-foreground-secondary text-sm">{b}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="mailto:ocrasesorias@gmail.com?subject=Propuesta KontaScan - Empresas"
                  className="inline-block bg-primary text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-hover transition-colors mt-auto"
                >
                  Solicitar propuesta
                </a>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={200} direction="up">
            <div className="bg-white rounded-2xl border-2 border-secondary shadow-lg overflow-hidden h-full flex flex-col">
              <div className="p-8 sm:p-10 text-center flex-1 flex flex-col">
                <h3 className="text-2xl font-bold text-foreground mb-2">
                  Asesorías Contables
                </h3>
                <p className="text-foreground-secondary mb-4 text-sm">
                  Para despachos y gestorías
                </p>
                <p className="text-2xl font-bold text-secondary mb-6">
                  Desde 90 € <span className="text-base font-normal text-foreground-secondary">/ mes</span>
                </p>

                <ul className="space-y-4 text-left max-w-sm mx-auto mb-8 flex-1">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-3">
                      <CheckIcon />
                      <span className="text-foreground-secondary text-sm">{b}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="mailto:ocrasesorias@gmail.com?subject=Propuesta KontaScan - Asesorías"
                  className="inline-block bg-secondary text-white px-8 py-3 rounded-lg font-semibold hover:bg-secondary-hover transition-colors mt-auto"
                >
                  Solicitar propuesta
                </a>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
