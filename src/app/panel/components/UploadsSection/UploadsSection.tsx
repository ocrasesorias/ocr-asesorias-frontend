'use client';

import { useState, useMemo } from 'react';
import { SubidaFacturas } from '@/types/dashboard';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Only uploads that exist in DB can be deleted
  const deletableSubidas = useMemo(
    () => subidas.filter(s => !!s.uploadId),
    [subidas]
  );

  const allSelected = deletableSubidas.length > 0 && deletableSubidas.every(s => selectedIds.has(s.uploadId!));

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

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setIsSelectionMode(false);
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
            Selecciona una subida para seguir trabajando
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
      {/* Selection toolbar */}
      {deletableSubidas.length > 0 && (
        <div className="flex items-center justify-between mb-2">
          {isSelectionMode ? (
            <div className="flex items-center gap-3 w-full">
              <label className="flex items-center gap-2 text-sm text-foreground-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
                Todas ({deletableSubidas.length})
              </label>
              <div className="flex-1" />
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-none transition-colors"
                >
                  Eliminar {selectedIds.size}
                </button>
              )}
              <button
                type="button"
                onClick={exitSelectionMode}
                className="px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:text-foreground border border-[var(--l-card-border,#e5e7eb)] rounded-none transition-colors"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="text-xs text-foreground-secondary hover:text-foreground transition-colors"
              >
                Seleccionar
              </button>
            </div>
          )}
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
              isSelectionMode={isSelectionMode}
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
