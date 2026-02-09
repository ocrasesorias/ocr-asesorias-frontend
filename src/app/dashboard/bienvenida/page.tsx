'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/Button';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';

export default function BienvenidaPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [orgName, setOrgName] = useState('');
  const [accountingProgram, setAccountingProgram] = useState<'monitor' | 'contasol'>('monitor');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Verificar sesión y si ya tiene organización
  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();

      // getUser() valida el JWT contra el servidor (más seguro que getSession())
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login?redirect=/dashboard/bienvenida');
        return;
      }

      // Verificar si el usuario ya tiene una organización
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1);

      if (error) {
        // Si hay error, asumimos que no tiene organización y continuamos
        console.warn('Error al verificar organización:', error.message);
      } else if (memberships && memberships.length > 0) {
        // Ya tiene organización, redirigir al dashboard
        router.push('/dashboard');
        return;
      }

      setIsChecking(false);
    };

    checkUser();
  }, [router]);

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

      // Organización creada exitosamente, redirigir al dashboard
      showSuccess('¡Organización creada exitosamente!');
      try {
        sessionStorage.setItem('onboarding:accountingProgram', accountingProgram);
      } catch {
        // noop
      }
      router.push('/dashboard');
    } catch (error) {
      console.error('Error al crear organización:', error);
      showError('Error al crear la organización. Por favor, intenta de nuevo.');
      setIsLoading(false);
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
            ¡Bienvenido a KontaScan!
          </h1>
          <p className="text-lg text-foreground-secondary">
            Estás a un paso de automatizar tu contabilidad
          </p>
        </div>

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

        {/* Información adicional */}
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
      </div>
    </div>
  );
}

