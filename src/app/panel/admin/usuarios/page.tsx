'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';

const ACCOUNTING_PROGRAMS = [
  { value: 'monitor', label: 'Monitor' },
  { value: 'contasol', label: 'Contasol' },
  { value: 'a3', label: 'A3' },
] as const;

type CreatedSummary = {
  email: string;
  org_name: string;
  accounting_program: string;
  credits: number;
};

export default function AdminUsuariosPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [accountingProgram, setAccountingProgram] = useState<'monitor' | 'contasol' | 'a3'>('monitor');
  const [credits, setCredits] = useState<string>('25');
  const [isLoading, setIsLoading] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreatedSummary | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const creditsNum = Number(credits);
    if (!Number.isFinite(creditsNum) || creditsNum < 0 || creditsNum > 100000) {
      showError('Los créditos deben ser un número entre 0 y 100.000');
      return;
    }
    if (password.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          org_name: orgName.trim(),
          accounting_program: accountingProgram,
          credits: creditsNum,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.push('/login?redirect=/panel/admin/usuarios');
        return;
      }
      if (res.status === 403) {
        showError('No tienes permiso para crear usuarios.');
        router.push('/panel');
        return;
      }
      if (!res.ok) {
        showError(translateError(data?.error ?? 'Error al crear el usuario'));
        return;
      }

      setLastCreated({
        email: data.email,
        org_name: data.org_name,
        accounting_program: data.accounting_program,
        credits: data.credits,
      });
      showSuccess(`Usuario ${data.email} creado correctamente`);
      setEmail('');
      setPassword('');
      setOrgName('');
      setCredits('25');
      setAccountingProgram('monitor');
    } catch (err) {
      console.error(err);
      showError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-[var(--l-card,#ffffff)] border-b border-[var(--l-card-border,#e5e7eb)] text-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/img/logo.png"
                alt="KontaScan"
                width={100}
                height={100}
                className="h-10 w-auto"
                priority
              />
              <span className="text-2xl font-bold text-primary">KontaScan</span>
            </Link>
            <Link
              href="/panel"
              className="text-sm font-medium text-primary hover:underline"
            >
              Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/panel"
            className="p-2 -ml-2 rounded-none text-foreground-secondary hover:text-foreground hover:bg-primary/5 transition-colors shrink-0"
            aria-label="Volver al panel"
            title="Volver al panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-light text-foreground mb-2">Crear nuevo usuario</h1>
            <p className="text-foreground-secondary">
              Da de alta una asesoría con créditos de prueba.
            </p>
          </div>
        </div>

        {/* Tabs admin */}
        <div className="mb-6 flex gap-1 border-b border-[var(--l-card-border,#e5e7eb)]">
          <Link
            href="/panel/admin/usuarios"
            className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary -mb-px"
          >
            Usuarios
          </Link>
          <Link
            href="/panel/admin/suggestions"
            className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-foreground-secondary hover:text-foreground hover:bg-primary/5"
          >
            Sugerencias
          </Link>
        </div>

        {lastCreated && (
          <div
            className="mb-6 p-4 border border-secondary/30 bg-secondary/5 text-foreground"
            role="status"
          >
            <p className="text-sm font-semibold mb-2">Usuario creado correctamente</p>
            <ul className="text-sm space-y-0.5 text-foreground-secondary">
              <li><strong className="text-foreground">Email:</strong> {lastCreated.email}</li>
              <li><strong className="text-foreground">Asesoría:</strong> {lastCreated.org_name}</li>
              <li><strong className="text-foreground">Programa contable:</strong> {lastCreated.accounting_program}</li>
              <li><strong className="text-foreground">Créditos:</strong> {lastCreated.credits}</li>
            </ul>
            <p className="text-xs text-foreground-secondary mt-2">
              Recuerda enviarle la contraseña por un canal seguro.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-[var(--l-card,#ffffff)] border border-[var(--l-card-border,#e5e7eb)] p-6 space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground-secondary mb-2">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@asesoria.com"
              className="block w-full px-4 py-3 border border-[var(--l-card-border,#e5e7eb)] bg-[var(--l-bg,#f9fafb)] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground-secondary mb-2">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="block w-full px-4 py-3 pr-10 border border-[var(--l-card-border,#e5e7eb)] bg-[var(--l-bg,#f9fafb)] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-secondary hover:text-foreground"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="orgName" className="block text-sm font-medium text-foreground-secondary mb-2">
              Nombre de la asesoría
            </label>
            <input
              id="orgName"
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Asesoría Pérez S.L."
              className="block w-full px-4 py-3 border border-[var(--l-card-border,#e5e7eb)] bg-[var(--l-bg,#f9fafb)] text-foreground placeholder:text-foreground-secondary focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="accountingProgram" className="block text-sm font-medium text-foreground-secondary mb-2">
              Programa contable
            </label>
            <select
              id="accountingProgram"
              value={accountingProgram}
              onChange={(e) => setAccountingProgram(e.target.value as 'monitor' | 'contasol' | 'a3')}
              className="block w-full px-4 py-3 border border-[var(--l-card-border,#e5e7eb)] bg-[var(--l-bg,#f9fafb)] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {ACCOUNTING_PROGRAMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="credits" className="block text-sm font-medium text-foreground-secondary mb-2">
              Créditos / facturas de prueba
            </label>
            <input
              id="credits"
              type="number"
              min={0}
              max={100000}
              step={1}
              required
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className="block w-full px-4 py-3 border border-[var(--l-card-border,#e5e7eb)] bg-[var(--l-bg,#f9fafb)] text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="text-xs text-foreground-secondary mt-1">
              Cantidad de facturas que cargamos a la cuenta. Por defecto 25.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-primary text-white font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creando usuario...
                </span>
              ) : 'Crear usuario'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
