'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { DashboardHeader } from '../components/DashboardHeader';
import { useInvoiceCounter } from '@/hooks/useInvoiceCounter';

const PAGE_SIZE = 20;

type InvoiceItem = {
  id: string;
  original_filename: string;
  status: string;
  created_at: string;
  upload_id: string;
  upload_name: string;
  upload_tipo: string | null;
  client_name: string;
};

const statusLabel: Record<string, string> = {
  uploaded: 'Subida',
  processing: 'Procesando',
  needs_review: 'Lista para validar',
  ready: 'Validada',
  error: 'Error',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PendientesPage() {
  const { organizationName, orgId, isLoading: isLoadingAuth } = useDashboardAuth();
  const { creditsBalance, isLoading: isLoadingCredits } = useInvoiceCounter(orgId);
  const { showError } = useToast();

  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'all'>('pending');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      const res = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/invoices?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        return;
      }
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al cargar'));
        return;
      }

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
      showError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, page, statusFilter, showError]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleOpenInNewTab = async (id: string) => {
    setOpeningId(id);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}/preview`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.signedUrl) {
        showError(translateError(data?.error || 'No se pudo abrir la factura'));
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      showError('Error al abrir la factura');
    } finally {
      setOpeningId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-foreground-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        organizationName={organizationName}
        creditsBalance={creditsBalance}
        isLoadingCredits={isLoadingCredits}
        orgId={orgId}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-full text-foreground-secondary hover:text-foreground hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Volver al dashboard"
            title="Volver al dashboard"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-3xl font-light text-foreground mb-2">Facturas por procesar</h1>
            <p className="text-foreground-secondary">
              Todas las facturas pendientes de validar en un solo lugar. Ábrelas o descárgalas desde aquí.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground-secondary">Mostrar:</span>
              <button
                type="button"
                onClick={() => { setStatusFilter('pending'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'pending' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-foreground hover:bg-gray-50'}`}
              >
                Solo pendientes
              </button>
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-foreground hover:bg-gray-50'}`}
              >
                Todas
              </button>
            </div>
            <button
              type="button"
              onClick={() => fetchList()}
              className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-slate-100 transition-colors"
              title="Actualizar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-3" />
              <p className="text-foreground-secondary">Cargando facturas...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-foreground-secondary">
              {statusFilter === 'pending'
                ? 'No hay facturas pendientes de procesar.'
                : 'No hay facturas en esta organización.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Cliente</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Subida</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Tipo</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Archivo</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Estado</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Fecha</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-40">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm text-foreground">{row.client_name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{row.upload_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${row.upload_tipo === 'ingreso' ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>
                          {row.upload_tipo === 'ingreso' ? 'Ingreso' : row.upload_tipo === 'gasto' ? 'Gasto' : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground truncate max-w-[200px]" title={row.original_filename}>
                        {row.original_filename || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${row.status === 'error' ? 'text-error' : row.status === 'ready' ? 'text-secondary' : 'text-foreground-secondary'}`}>
                          {statusLabel[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground-secondary">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenInNewTab(row.id)}
                            disabled={openingId === row.id}
                            className="px-2 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                          >
                            {openingId === row.id ? '…' : 'Abrir'}
                          </button>
                          <a
                            href={`/api/invoices/${encodeURIComponent(row.id)}/download`}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors inline-flex items-center justify-center"
                            title="Descargar"
                            aria-label="Descargar factura"
                          >
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-foreground" aria-hidden="true">
                              <path d="M12.5535 16.5061C12.4114 16.6615 12.2106 16.75 12 16.75C11.7894 16.75 11.5886 16.6615 11.4465 16.5061L7.44648 12.1311C7.16698 11.8254 7.18822 11.351 7.49392 11.0715C7.79963 10.792 8.27402 10.8132 8.55352 11.1189L11.25 14.0682V3C11.25 2.58579 11.5858 2.25 12 2.25C12.4142 2.25 12.75 2.58579 12.75 3V14.0682L15.4465 11.1189C15.726 10.8132 16.2004 10.792 16.5061 11.0715C16.8118 11.351 16.833 11.8254 16.5535 12.1311L12.5535 16.5061Z" fill="currentColor" />
                              <path d="M3.75 15C3.75 14.5858 3.41422 14.25 3 14.25C2.58579 14.25 2.25 14.5858 2.25 15V15.0549C2.24998 16.4225 2.24996 17.5248 2.36652 18.3918C2.48754 19.2919 2.74643 20.0497 3.34835 20.6516C3.95027 21.2536 4.70814 21.5125 5.60825 21.6335C6.47522 21.75 7.57754 21.75 8.94513 21.75H15.0549C16.4225 21.75 17.5248 21.75 18.3918 21.6335C19.2919 21.5125 20.0497 21.2536 20.6517 20.6516C21.2536 20.0497 21.5125 19.2919 21.6335 18.3918C21.75 17.5248 21.75 16.4225 21.75 15.0549V15C21.75 14.5858 21.4142 14.25 21 14.25C20.5858 14.25 20.25 14.5858 20.25 15C20.25 16.4354 20.2484 17.4365 20.1469 18.1919C20.0482 18.9257 19.8678 19.3142 19.591 19.591C19.3142 19.8678 18.9257 20.0482 18.1919 20.1469C17.4365 20.2484 16.4354 20.25 15 20.25H9C7.56459 20.25 6.56347 20.2484 5.80812 20.1469C5.07435 20.0482 4.68577 19.8678 4.40901 19.591C4.13225 19.3142 3.9518 18.9257 3.85315 18.1919C3.75159 17.4365 3.75 16.4354 3.75 15Z" fill="currentColor" />
                            </svg>
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
              <p className="text-sm text-foreground-secondary">
                Mostrando {from}-{to} de {total} facturas
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="px-3 text-sm text-foreground">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
