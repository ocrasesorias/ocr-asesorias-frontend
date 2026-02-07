'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ValidarFactura } from '@/components/ValidarFactura';
import { FacturaData } from '@/types/factura';
import { Button } from '@/components/Button';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';

const toISODate = (value: string) => {
  const v = (value || '').trim();
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // ya viene en ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return v;
};

const toNumber = (value: string) => {
  const raw = String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .trim()
  if (!raw) return null

  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')
  let normalized = raw

  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf('.')
    const lastComma = raw.lastIndexOf(',')
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandsSep = decimalSep === ',' ? '.' : ','
    normalized = raw.replace(new RegExp(`\\${thousandsSep}`, 'g'), '').replace(decimalSep, '.')
  } else if (hasComma) {
    normalized = raw.replace(',', '.')
  } else if (hasDot) {
    const parts = raw.split('.')
    normalized = parts.length === 2 && parts[1].length === 2 ? raw : raw.replace(/\./g, '')
  }

  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
};

export default function ValidarFacturaPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [facturaActual, setFacturaActual] = useState(0);
  const [facturas, setFacturas] = useState<FacturaData[]>([]);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isFinishedModalOpen, setIsFinishedModalOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1) Proteger: requiere sesión
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/validar-factura');
        return;
      }

      // Ruta antigua (MVP). Ahora la validación vive en /dashboard/uploads/[id]/validar
      showError('Ruta antigua. Te llevamos al dashboard para validar desde una subida.');
      router.replace('/dashboard');

      setIsCheckingSession(false);
    };

    init();
  }, [router, showError]);

  const handleValidar = async (factura: FacturaData) => {
    // Guardar campos en Supabase (invoice_fields)
    const invoiceId = factura.archivo?.invoiceId;
    if (invoiceId) {
      try {
        const baseSum = factura.lineas
          .map((l) => toNumber(l.base))
          .filter((n): n is number => n !== null)
          .reduce((a, b) => a + b, 0);

        const vatSum = factura.lineas
          .map((l) => toNumber(l.cuotaIva))
          .filter((n): n is number => n !== null)
          .reduce((a, b) => a + b, 0);

        const total = toNumber(factura.total) ?? (baseSum + vatSum);

        await fetch(`/api/invoices/${invoiceId}/fields`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplier_name: factura.proveedor.nombre || null,
            supplier_tax_id: factura.proveedor.cif || null,
            invoice_number: factura.factura.numero || null,
            invoice_date: toISODate(factura.factura.fecha) || null,
            base_amount: baseSum || null,
            vat_amount: vatSum || null,
            total_amount: total || null,
            vat_rate: null,
          }),
        });
      } catch {
        // noop: no bloqueamos el flujo de validación por un fallo puntual
      }
    }

    // Actualizamos la factura en el array local para navegación
    setFacturas((prev) => {
      const nuevas = [...prev];
      nuevas[facturaActual] = factura;
      return nuevas;
    });

    const isLast = facturaActual === facturas.length - 1;
    showSuccess(isLast ? 'Factura validada. Has completado todas.' : 'Factura validada');
    if (isLast) setIsFinishedModalOpen(true);
  };

  const handleSiguiente = () => {
    if (facturaActual < facturas.length - 1) {
      setFacturaActual(facturaActual + 1);
    } else {
      // Todas las facturas validadas
      // Opcional: redirigir al dashboard
      // router.push('/dashboard');
    }
  };

  const handleAnterior = () => {
    if (facturaActual > 0) {
      setFacturaActual(facturaActual - 1);
    }
  };

  const handleVolverDashboard = () => {
    router.push('/dashboard');
  };

  const handleGenerarExport = async () => {
    const invoiceIds = facturas
      .map((f) => f.archivo?.invoiceId)
      .filter((id): id is string => Boolean(id));

    if (invoiceIds.length === 0) {
      showError('No hay facturas subidas a Supabase para exportar');
      return;
    }

    const program = sessionStorage.getItem('onboarding:accountingProgram') || 'monitor';

    setIsExporting(true);
    try {
      const resp = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: invoiceIds, program }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        showError(data?.error || 'Error generando export');
        return;
      }

      showSuccess('Export generado correctamente');
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      setIsFinishedModalOpen(false);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error generando export');
    } finally {
      setIsExporting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (facturas.length === 0) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            No hay facturas para validar
          </h2>
          <p className="text-foreground-secondary mb-6">
            Sube facturas desde el dashboard para comenzar el proceso de validación
          </p>
          <Button variant="primary" onClick={handleVolverDashboard}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen bg-background flex flex-col">
      {/* Header con navegación */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard" className="text-primary hover:text-primary-hover">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Validar facturas
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-xs text-foreground-secondary">
            {facturaActual + 1} de {facturas.length}
          </span>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAnterior}
              disabled={facturaActual === 0}
              className="py-2"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSiguiente}
              disabled={facturaActual === facturas.length - 1}
              className="py-2"
            >
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {/* Modal fin de proceso */}
      {isFinishedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !isExporting && setIsFinishedModalOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 p-6 text-foreground">
            <h2 className="text-xl font-semibold mb-2">Has terminado la validación</h2>
            <p className="text-sm text-foreground-secondary mb-6">
              ¿Quieres revisar o cambiar algún dato, o prefieres continuar y generar el export?
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setIsFinishedModalOpen(false)}
                disabled={isExporting}
              >
                Revisar / cambiar
              </Button>
              <Button
                variant="primary"
                onClick={handleGenerarExport}
                disabled={isExporting}
              >
                {isExporting ? 'Generando export...' : 'Generar export'}
              </Button>
            </div>

            <div className="mt-4">
              <button
                type="button"
                className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
                onClick={() => router.push('/dashboard')}
                disabled={isExporting}
              >
                Volver al dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Componente de validación */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <ValidarFactura
          factura={facturas[facturaActual]}
          onValidar={handleValidar}
          onSiguiente={handleSiguiente}
          isLast={facturaActual === facturas.length - 1}
          canGoNext={true}
        />
      </div>
    </div>
  );
}

