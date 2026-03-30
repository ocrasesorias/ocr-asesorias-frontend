'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { isStripeEnabled } from '@/lib/features';

const PRICE_IDS: Record<string, string> = {
  profesional_mensual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL_MENSUAL ?? '',
  profesional_anual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESIONAL_ANUAL ?? '',
  gestoria_mensual: process.env.NEXT_PUBLIC_STRIPE_PRICE_GESTORIA_MENSUAL ?? '',
  gestoria_anual: process.env.NEXT_PUBLIC_STRIPE_PRICE_GESTORIA_ANUAL ?? '',
};

const PLANS = [
  {
    name: 'Profesional',
    description: 'Para gestorías pequeñas',
    features: ['750 facturas/mes', 'Soporte email prioritario', 'Exceso: 0,12 €/factura'],
    prices: {
      mensual: { amount: 79, envKey: 'profesional_mensual' },
      anual: { amount: 66, envKey: 'profesional_anual', sublabel: '790 €/año — ahorra 2 meses' },
    },
  },
  {
    name: 'Gestoría',
    description: 'Para gestorías medianas',
    popular: true,
    features: ['2.000 facturas/mes', 'Soporte prioritario + onboarding', 'Exportación masiva', 'Exceso: 0,08 €/factura'],
    prices: {
      mensual: { amount: 149, envKey: 'gestoria_mensual' },
      anual: { amount: 125, envKey: 'gestoria_anual', sublabel: '1.490 €/año — ahorra 2 meses' },
    },
  },
];

export default function BienvenidaPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [orgName, setOrgName] = useState('');
  const [accountingProgram, setAccountingProgram] = useState<'monitor' | 'contasol'>('monitor');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [step, setStep] = useState<'create-org' | 'choose-plan'>('create-org');
  const [billingPeriod, setBillingPeriod] = useState<'mensual' | 'anual'>('mensual');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!isStripeEnabled) router.replace('/panel');
  }, [router]);

  // Verificar sesión y si ya tiene organización (siempre declarar el hook; la lógica depende de Stripe)
  useEffect(() => {
    if (!isStripeEnabled) return;

    const checkUser = async () => {
      const supabase = createClient();

      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login?redirect=/panel/bienvenida');
        return;
      }

      // Verificar si el usuario ya tiene una organización
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        console.warn('Error al verificar organización:', error.message);
      } else if (memberships && memberships.length > 0) {
        router.push('/panel');
        return;
      }

      setIsChecking(false);
    };

    checkUser();
  }, [router]);

  if (!isStripeEnabled) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!orgName.trim()) {
      showError('Por favor, ingresa el nombre de tu asesoría');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ org_name: orgName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(translateError(data.error || 'Error al crear la organización'));
        setIsLoading(false);
        return;
      }

      showSuccess('¡Organización creada! Tienes 25 facturas gratis para empezar.');
      try {
        sessionStorage.setItem('onboarding:accountingProgram', accountingProgram);
      } catch {
        // noop
      }
      setStep('choose-plan');
    } catch (error) {
      console.error('Error al crear organización:', error);
      showError('Error al crear la organización. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (envKey: string) => {
    const priceId = PRICE_IDS[envKey];
    if (!priceId) {
      showError('Precio no configurado. Contacta con soporte.');
      return;
    }

    setLoadingPlan(envKey);
    try {
      const resp = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        showError(data?.error || 'Error al crear la sesión de pago');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-foreground-secondary">Verificando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background via-white to-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        {/* Logo y título de bienvenida */}
        <div className="text-center mb-8">
          <Image
            src="/img/logo.png"
            alt="KontaScan"
            width={100}
            height={100}
            className="mx-auto h-16 w-auto mb-4"
            priority
          />
          <h1 className="text-4xl font-light text-foreground mb-2">
            {step === 'create-org' ? '¡Bienvenido a KontaScan!' : '¡Tu organización está lista!'}
          </h1>
          <p className="text-lg text-foreground-secondary">
            {step === 'create-org'
              ? 'Estás a un paso de automatizar tu contabilidad'
              : 'Tienes 25 facturas gratis para probar. Elige un plan o empieza ya.'}
          </p>
        </div>

        {step === 'create-org' && (
          <>
            {/* Card con formulario */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-200">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Crea tu organización
                </h2>
                <p className="text-foreground-secondary">
                  Para comenzar, necesitamos el nombre de tu asesoría y el programa contable que utilizas.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="org_name" className="block text-sm font-medium text-foreground mb-2">
                    Nombre de tu asesoría
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-foreground-secondary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                    </div>
                    <input
                      id="org_name"
                      name="org_name"
                      type="text"
                      required
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg placeholder-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Ej: Asesoría García López"
                      disabled={isLoading}
                    />
                  </div>
                  <p className="mt-2 text-sm text-foreground-secondary">
                    Puedes cambiarlo más tarde desde la configuración.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Programa contable
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAccountingProgram('monitor')}
                      disabled={isLoading}
                      className={`text-left w-full border rounded-lg p-4 transition-all ${
                        accountingProgram === 'monitor'
                          ? 'border-primary ring-2 ring-primary/20 bg-primary-lighter'
                          : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">Monitor Informática</p>
                          <p className="text-xs text-foreground-secondary mt-1">Disponible</p>
                        </div>
                        <div
                          className={`h-4 w-4 rounded-full border ${
                            accountingProgram === 'monitor' ? 'bg-primary border-primary' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    </button>

                    <div className="text-left w-full border border-gray-200 rounded-lg p-4 opacity-60">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">ContaSol</p>
                          <p className="text-xs text-foreground-secondary mt-1">Próximamente</p>
                        </div>
                        <div className="h-4 w-4 rounded-full border border-gray-300 bg-gray-100" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creando organización...
                      </span>
                    ) : (
                      'Crear organización y continuar'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {step === 'choose-plan' && (
          <>
            {/* Trial badge */}
            <div className="bg-secondary-lighter border border-secondary rounded-xl p-4 mb-8 text-center">
              <p className="text-secondary-foreground font-medium">
                Tienes <span className="font-bold">25 facturas gratis</span> para probar KontaScan sin compromiso.
              </p>
            </div>

            {/* Toggle mensual/anual */}
            <div className="flex justify-center mb-8">
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

            {/* Plan cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {PLANS.map((plan) => {
                const priceInfo = plan.prices[billingPeriod];
                const isLoadingThis = loadingPlan === priceInfo.envKey;

                return (
                  <div
                    key={plan.name}
                    className={`relative bg-white rounded-2xl border-2 p-8 ${
                      plan.popular ? 'border-blue-500 shadow-lg' : 'border-gray-200'
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Más popular
                      </div>
                    )}

                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>

                    <div className="mt-4">
                      <span className="text-3xl font-bold text-gray-900">{priceInfo.amount} €</span>
                      <span className="text-gray-500 ml-1">/mes</span>
                    </div>

                    {billingPeriod === 'anual' && 'sublabel' in priceInfo && (
                      <p className="text-xs text-green-600 mt-1">{priceInfo.sublabel}</p>
                    )}

                    <ul className="mt-4 space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => handleSubscribe(priceInfo.envKey)}
                      disabled={isLoadingThis}
                      className={`mt-6 w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                        plan.popular
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      }`}
                    >
                      {isLoadingThis ? 'Redirigiendo...' : 'Suscribirse'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Skip button */}
            <div className="mt-8 text-center">
              <Link
                href="/panel"
                className="inline-flex items-center text-primary hover:text-primary-hover font-medium transition-colors"
              >
                Empezar con la prueba gratuita
                <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4">
              Pago seguro con Stripe. Puedes cancelar en cualquier momento.
            </p>
          </>
        )}

        {/* Información adicional */}
        {step === 'create-org' && (
          <div className="mt-6 text-center">
            <p className="text-sm text-foreground-secondary">
              ¿Necesitas ayuda?{' '}
              <a
                href="mailto:hola@ocrasesorias.com"
                className="font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Contáctanos
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
