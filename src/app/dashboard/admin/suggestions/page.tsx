'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';

const TIPOS_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'error', label: 'Error' },
  { value: 'duda', label: 'Duda' },
  { value: 'otro', label: 'Otro' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'visto', label: 'Visto' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'resuelto', label: 'Resuelto' },
];

const PAGE_SIZE = 10;

type SuggestionRow = {
  id: string;
  org_id: string | null;
  user_id: string;
  email: string | null;
  type: string | null;
  message: string;
  status: string;
  created_at: string;
};

type Stats = { nuevo: number; en_proceso: number; resuelto: number };

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
  };
}

function typePillClass(type: string | null): string {
  switch (type) {
    case 'sugerencia':
      return 'bg-secondary text-white';
    case 'error':
      return 'bg-error text-white';
    case 'duda':
      return 'bg-info text-white';
    case 'otro':
      return 'bg-gray-500 text-white';
    default:
      return 'bg-gray-400 text-white';
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'nuevo':
      return 'text-info';
    case 'visto':
      return 'text-foreground-secondary';
    case 'en_proceso':
      return 'text-warning';
    case 'resuelto':
      return 'text-secondary';
    default:
      return 'text-foreground';
  }
}

export default function AdminSuggestionsPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<Stats>({ nuevo: 0, en_proceso: 0, resuelto: 0 });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [detailItem, setDetailItem] = useState<SuggestionRow | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(PAGE_SIZE));
      if (search) params.set('search', search);
      if (filterType) params.set('type', filterType);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/admin/suggestions?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        router.push('/login?redirect=/dashboard/admin/suggestions');
        return;
      }
      if (res.status === 403) {
        showError('No tienes permiso para ver esta página.');
        router.push('/dashboard');
        return;
      }
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al cargar'));
        return;
      }

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? { nuevo: 0, en_proceso: 0, resuelto: 0 });
    } catch (err) {
      console.error(err);
      showError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, filterType, filterStatus, router, showError]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/suggestions/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al actualizar'));
        return;
      }
      showSuccess('Estado actualizado');
      setItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      setDetailItem((d) => (d?.id === id ? { ...d, status: newStatus } : d));
      setStats((s) => {
        const next = { ...s };
        const oldRow = items.find((r) => r.id === id);
        if (oldRow?.status === 'nuevo') next.nuevo = Math.max(0, next.nuevo - 1);
        if (oldRow?.status === 'en_proceso') next.en_proceso = Math.max(0, next.en_proceso - 1);
        if (oldRow?.status === 'resuelto') next.resuelto = Math.max(0, next.resuelto - 1);
        if (newStatus === 'nuevo') next.nuevo += 1;
        if (newStatus === 'en_proceso') next.en_proceso += 1;
        if (newStatus === 'resuelto') next.resuelto += 1;
        return next;
      });
    } catch (err) {
      console.error(err);
      showError('Error al actualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-gray-200 text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              href="/dashboard"
              className="text-sm font-medium text-primary hover:underline"
            >
              Volver al dashboard
            </Link>
          </div>
        </div>
      </header>

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
            <h1 className="text-3xl font-light text-foreground mb-2">Gestión de sugerencias</h1>
            <p className="text-foreground-secondary">
              Incidencias, errores y mensajes enviados por los usuarios.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary-lighter flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.nuevo}</p>
              <p className="text-sm text-foreground-secondary">Nuevos</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.en_proceso}</p>
              <p className="text-sm text-foreground-secondary">En proceso</p>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary-lighter flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.resuelto}</p>
              <p className="text-sm text-foreground-secondary">Resueltos</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-secondary pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar por email o mensaje..."
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-foreground placeholder:text-foreground-secondary focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-foreground text-sm min-w-[140px] focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {TIPOS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-foreground text-sm min-w-[160px] focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => { setSearchInput(''); setSearch(''); setFilterType(''); setFilterStatus(''); setPage(1); fetchList(); }}
              className="p-2 rounded-lg text-foreground-secondary hover:text-foreground hover:bg-slate-100 transition-colors"
              title="Limpiar y recargar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-3" />
              <p className="text-foreground-secondary">Cargando...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-foreground-secondary">
              No hay sugerencias que coincidan con los filtros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Tipo</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Mensaje</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Usuario / Email</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Estado</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground">Fecha</th>
                    <th className="px-4 py-3 text-sm font-semibold text-foreground w-20">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const { date, time } = formatDate(row.created_at);
                    const msgShort = row.message.length > 60 ? row.message.slice(0, 60) + '…' : row.message;
                    return (
                      <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${typePillClass(row.type)}`}>
                            {row.type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 max-w-[280px]">
                          <p className="text-sm text-foreground line-clamp-2">{msgShort}</p>
                          <button
                            type="button"
                            onClick={() => setDetailItem(row)}
                            className="text-sm text-primary hover:underline mt-0.5"
                          >
                            Ver más
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-foreground">{row.email || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.status}
                            onChange={(e) => handleStatusChange(row.id, e.target.value)}
                            disabled={updatingId === row.id}
                            className={`text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white min-w-[120px] focus:ring-2 focus:ring-primary ${statusClass(row.status)}`}
                          >
                            {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground-secondary">
                          <span className="block">{date}</span>
                          <span className="block">{time}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDetailItem(row)}
                            className="p-2 rounded-lg text-foreground-secondary hover:text-primary hover:bg-primary-lighter transition-colors"
                            title="Ver detalle"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
              <p className="text-sm text-foreground-secondary">
                Mostrando {from}-{to} de {total} registros
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

      {/* Detail modal */}
      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <h2 id="detail-title" className="text-lg font-semibold text-foreground">
                Detalle de la sugerencia
              </h2>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-2 -mr-2 rounded-full text-foreground-secondary hover:text-foreground hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1">Tipo</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${typePillClass(detailItem.type)}`}>
                  {detailItem.type || '—'}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1">Estado</p>
                <select
                  value={detailItem.status}
                  onChange={(e) => handleStatusChange(detailItem.id, e.target.value)}
                  disabled={updatingId === detailItem.id}
                  className={`text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white ${statusClass(detailItem.status)}`}
                >
                  {STATUS_OPTIONS.filter((o) => o.value).map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1">Email</p>
                <p className="text-foreground">{detailItem.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1">Fecha</p>
                <p className="text-foreground">{formatDate(detailItem.created_at).date} {formatDate(detailItem.created_at).time}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground-secondary uppercase tracking-wide mb-1">Mensaje</p>
                <p className="text-foreground whitespace-pre-wrap">{detailItem.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
