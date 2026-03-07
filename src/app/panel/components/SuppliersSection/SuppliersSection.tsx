'use client';

import { useState, useMemo } from 'react';
import type { Supplier } from '@/types/dashboard';
import { CreateSupplierModal } from './CreateSupplierModal';
import { EditSupplierModal } from './EditSupplierModal';
import { DeleteSupplierModal } from './DeleteSupplierModal';
import type { SupplierFormState } from '@/hooks/useSupplierManagement';

interface SuppliersSectionProps {
  clientName: string;
  suppliers: Supplier[];
  isLoading: boolean;
  mostrarNuevoProveedor: boolean;
  setMostrarNuevoProveedor: (show: boolean) => void;
  nuevoProveedor: SupplierFormState;
  setNuevoProveedor: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  isCreating: boolean;
  onCrearProveedor: (e: React.FormEvent) => void;
  onCancelCrearProveedor: () => void;
  isEditModalOpen: boolean;
  proveedorParaEditar: Supplier | null;
  editProveedor: SupplierFormState;
  setEditProveedor: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  isUpdating: boolean;
  onEditProveedor: (s: Supplier) => void;
  onGuardarEdicionProveedor: (e: React.FormEvent) => void;
  onCancelEditProveedor: () => void;
  isDeleteModalOpen: boolean;
  proveedorParaEliminar: Supplier | null;
  isDeleting: boolean;
  onDeleteProveedor: (s: Supplier) => void;
  onConfirmEliminarProveedor: () => void;
  onCancelDeleteProveedor: () => void;
  onBulkDelete?: (supplierIds: string[]) => Promise<void>;
}

export function SuppliersSection({
  clientName,
  suppliers,
  isLoading,
  mostrarNuevoProveedor,
  setMostrarNuevoProveedor,
  nuevoProveedor,
  setNuevoProveedor,
  isCreating,
  onCrearProveedor,
  onCancelCrearProveedor,
  isEditModalOpen,
  proveedorParaEditar,
  editProveedor,
  setEditProveedor,
  isUpdating,
  onEditProveedor,
  onGuardarEdicionProveedor,
  onCancelEditProveedor,
  isDeleteModalOpen,
  proveedorParaEliminar,
  isDeleting,
  onDeleteProveedor,
  onConfirmEliminarProveedor,
  onCancelDeleteProveedor,
  onBulkDelete,
}: SuppliersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const allSelected = suppliers.length > 0 && suppliers.every(s => selectedIds.has(s.id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suppliers.map(s => s.id)));
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
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex-1 flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50/50 transition-colors min-w-0"
          >
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Proveedores de {clientName}
              </h3>
              <p className="text-sm text-foreground-secondary mt-0.5">
                Gestiona los proveedores habituales de este cliente
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
            <button
              type="button"
              onClick={() => setMostrarNuevoProveedor(true)}
              className="shrink-0 px-4 text-sm text-primary hover:text-primary-hover font-medium transition-colors"
            >
              + Nuevo
            </button>
          )}
        </div>

        {isExpanded && (
        <div className="px-6 pb-6 pt-0">
        {isLoading ? (
          <p className="text-sm text-foreground-secondary text-center py-6">
            Cargando proveedores…
          </p>
        ) : (
          <>
            {/* Selection toolbar */}
            {suppliers.length > 0 && (
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
                      Todos ({suppliers.length})
                    </label>
                    <div className="flex-1" />
                    {selectedIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsBulkDeleteModalOpen(true)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        Eliminar {selectedIds.size}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={exitSelectionMode}
                      className="px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:text-foreground border border-gray-200 rounded-lg transition-colors"
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
              {suppliers.length === 0 ? (
                <p className="text-sm text-foreground-secondary text-center py-4">
                  No hay proveedores. Añade uno o se crearán al validar facturas.
                </p>
              ) : (
                suppliers.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-foreground-secondary truncate">
                          {s.tax_id}
                          {s.address && ` · ${s.address}`}
                        </p>
                      </div>
                    </div>
                    {!isSelectionMode && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onEditProveedor(s)}
                          className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProveedor(s)}
                          className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        </div>
        )}
      </div>

      {/* Bulk delete confirmation modal */}
      {isBulkDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación masiva de proveedores"
          onMouseDown={() => { if (!isBulkDeleting) setIsBulkDeleteModalOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar proveedores</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{selectedIds.size} proveedor{selectedIds.size !== 1 ? 'es' : ''}</span>.
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isBulkDeleting}
                onClick={handleBulkDelete}
              >
                {isBulkDeleting ? 'Eliminando…' : `Eliminar ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateSupplierModal
        isOpen={mostrarNuevoProveedor}
        nuevoProveedor={nuevoProveedor}
        setNuevoProveedor={setNuevoProveedor}
        isCreating={isCreating}
        onSubmit={onCrearProveedor}
        onClose={onCancelCrearProveedor}
      />

      <EditSupplierModal
        isOpen={isEditModalOpen}
        supplier={proveedorParaEditar}
        editProveedor={editProveedor}
        setEditProveedor={setEditProveedor}
        isUpdating={isUpdating}
        onSave={onGuardarEdicionProveedor}
        onClose={onCancelEditProveedor}
      />

      <DeleteSupplierModal
        isOpen={isDeleteModalOpen}
        supplier={proveedorParaEliminar}
        isDeleting={isDeleting}
        onConfirm={onConfirmEliminarProveedor}
        onClose={onCancelDeleteProveedor}
      />
    </>
  );
}
