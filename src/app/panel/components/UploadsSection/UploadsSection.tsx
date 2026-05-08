'use client';

import { useState, useMemo } from 'react';
import { SubidaFacturas } from '@/types/dashboard';
import { useToast } from '@/contexts/ToastContext';
import { UploadItem } from './UploadItem';

interface UploadsSectionProps {
  subidas: SubidaFacturas[];
  subidaActual: SubidaFacturas | null;
  subidaEditandoId: string | null;
  subidaEditandoNombre: string;
  onSelectSubida: (subida: SubidaFacturas) => void;
  onStartEdit: (subida: SubidaFacturas) => void;
  onSaveEdit: (subidaId: string) => void;
  onCancelEdit: () => void;
  onEditingNombreChange: (nombre: string) => void;
  onDeleteSubida: (subida: SubidaFacturas) => void;
  onBulkDelete?: (uploadIds: string[]) => Promise<void>;
}

export function UploadsSection({
  subidas,
  subidaActual,
  subidaEditandoId,
  subidaEditandoNombre,
  onSelectSubida,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingNombreChange,
  onDeleteSubida,
  onBulkDelete,
}: UploadsSectionProps) {
  const { showError, showSuccess } = useToast();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkExporting, setIsBulkExporting] = useState(false);

  // Only uploads that exist in DB can be deleted
  const deletableSubidas = useMemo(
    () => subidas.filter(s => !!s.uploadId),
    [subidas]
  );

  const allSelected = deletableSubidas.length > 0 && deletableSubidas.every(s => selectedIds.has(s.uploadId!));

  // Subidas seleccionadas (con uploadId en DB)
  const selectedSubidas = useMemo(
    () => deletableSubidas.filter(s => selectedIds.has(s.uploadId!)),
    [deletableSubidas, selectedIds]
  );

  // Tipo común: si todas comparten el mismo tipo, devuelve 'gasto' o 'ingreso'; si no, null
  const commonTipo: 'gasto' | 'ingreso' | null = useMemo(() => {
    if (selectedSubidas.length === 0) return null;
    const first = selectedSubidas[0].tipo;
    return selectedSubidas.every(s => s.tipo === first) ? first : null;
  }, [selectedSubidas]);

  // Solo se exportan facturas ya validadas (dbStatus === 'ready') — preserva orden por subida
  const exportableInvoiceIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of selectedSubidas) {
      for (const a of s.archivos) {
        if (a.invoiceId && a.dbStatus === 'ready') ids.push(a.invoiceId);
      }
    }
    return ids;
  }, [selectedSubidas]);

  const exportDisabledReason: string | null = (() => {
    if (selectedSubidas.length === 0) return 'Selecciona al menos una subida';
    if (commonTipo === null) return 'Solo se pueden exportar gastos o ingresos juntos, no mezclados';
    if (exportableInvoiceIds.length === 0) return 'Las subidas seleccionadas no tienen facturas validadas';
    return null;
  })();

  const handleBulkExport = async () => {
    if (exportDisabledReason || !commonTipo || exportableInvoiceIds.length === 0) return;
    setIsBulkExporting(true);
    try {
      const resp = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_ids: exportableInvoiceIds, tipo: commonTipo }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Error generando export');
      showSuccess(
        `Export generado: ${exportableInvoiceIds.length} factura${exportableInvoiceIds.length !== 1 ? 's' : ''} de ${selectedSubidas.length} subida${selectedSubidas.length !== 1 ? 's' : ''}`
      );
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      setSelectedIds(new Set());
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error generando export');
    } finally {
      setIsBulkExporting(false);
    }
  };

  const toggleSelect = (uploadId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deletableSubidas.map(s => s.uploadId!)));
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsBulkDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  return (
    <div className="bg-[var(--l-card,#ffffff)] rounded-none shadow-sm border border-[var(--l-card-border,#e5e7eb)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-[var(--l-bg,#f9fafb)]/50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Histórico de subidas
          </h3>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Marca varias subidas para exportarlas juntas (solo del mismo tipo)
          </p>
        </div>
        <span
          className={`shrink-0 text-foreground-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isExpanded && (
      <div className="px-6 pb-6 pt-0">
      {/* Toolbar permanente: 2 filas — fila 1 checkbox, fila 2 acciones a 50/50 */}
      {deletableSubidas.length > 0 && (
        <div className="mb-3 py-2 px-3 bg-[var(--l-bg,#f9fafb)] border border-[var(--l-card-border,#e5e7eb)] rounded-none">
          <label className="flex items-center gap-2 text-sm text-foreground-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label="Seleccionar todas las subidas"
            />
            <span className="font-medium text-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} seleccionada${selectedIds.size !== 1 ? 's' : ''}`
                : 'Todas'}
            </span>
          </label>
          <div className="flex items-stretch gap-2 mt-2">
            <button
              type="button"
              onClick={handleBulkExport}
              disabled={!!exportDisabledReason || isBulkExporting}
              title={
                selectedIds.size === 0
                  ? 'Marca subidas para exportar'
                  : exportDisabledReason || `Exportar ${exportableInvoiceIds.length} factura${exportableInvoiceIds.length !== 1 ? 's' : ''} (${commonTipo === 'gasto' ? 'gastos' : 'ingresos'})`
              }
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span className="truncate">
                {isBulkExporting ? 'Exportando…' : 'Exportar'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              disabled={selectedIds.size === 0 || isBulkExporting}
              title={selectedIds.size === 0 ? 'Marca subidas para eliminar' : `Eliminar ${selectedIds.size}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="truncate">Eliminar</span>
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {subidas.length === 0 ? (
          <p className="text-sm text-foreground-secondary text-center py-4">
            No hay subidas todavía.
          </p>
        ) : (
          subidas.map((subida) => (
            <UploadItem
              key={subida.id}
              subida={subida}
              isSelected={subidaActual?.id === subida.id}
              isEditing={subidaEditandoId === subida.id}
              editingNombre={subidaEditandoNombre}
              onSelect={() => onSelectSubida(subida)}
              onStartEdit={() => onStartEdit(subida)}
              onSaveEdit={() => onSaveEdit(subida.id)}
              onCancelEdit={onCancelEdit}
              onEditingNombreChange={onEditingNombreChange}
              onDelete={() => onDeleteSubida(subida)}
              isSelectionMode={!!subida.uploadId}
              isChecked={!!subida.uploadId && selectedIds.has(subida.uploadId)}
              onToggleCheck={() => subida.uploadId && toggleSelect(subida.uploadId)}
            />
          ))
        )}
      </div>
      </div>
      )}

      {/* Bulk delete confirmation modal */}
      {isBulkDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación masiva"
          onMouseDown={() => { if (!isBulkDeleting) setIsBulkDeleteModalOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-none bg-[var(--l-card,#ffffff)] shadow-xl border border-[var(--l-card-border,#e5e7eb)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar subidas</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{selectedIds.size} subida{selectedIds.size !== 1 ? 's' : ''}</span>.
                Se borrarán también todas sus facturas asociadas.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-none border border-[var(--l-card-border,#e5e7eb)] text-foreground hover:bg-[var(--l-bg,#f9fafb)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-5 py-3 rounded-none bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
              >
                {isBulkDeleting ? 'Eliminando…' : `Eliminar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
