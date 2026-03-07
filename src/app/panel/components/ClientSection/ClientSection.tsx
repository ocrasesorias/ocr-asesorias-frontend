'use client';

import { useState } from 'react';
import { Cliente } from '@/types/dashboard';
import { ClientSelect } from '@/components/ClientSelect';
import { Button } from '@/components/Button';
import { CreateClientModal } from './CreateClientModal';

interface ClientSectionProps {
  clientes: Cliente[];
  clienteSeleccionado: Cliente | null;
  mostrarNuevoCliente: boolean;
  setMostrarNuevoCliente: (show: boolean) => void;
  nuevoCliente: {
    name: string;
    tax_id: string;
    address: string;
    postal_code: string;
    city: string;
    province: string;
    preferred_income_account: string;
    preferred_expense_account: string;
    activity_description: string;
  };
  setNuevoCliente: React.Dispatch<React.SetStateAction<{
    name: string;
    tax_id: string;
    address: string;
    postal_code: string;
    city: string;
    province: string;
    preferred_income_account: string;
    preferred_expense_account: string;
    activity_description: string;
  }>>;
  isCreatingClient: boolean;
  onClienteChange: (clienteId: string) => void;
  onCrearCliente: (e: React.FormEvent) => void;
  onCancelCrearCliente: () => void;
  onEditClient: (client: Cliente) => void;
  onDeleteClient: (client: Cliente) => void;
  onBulkDelete?: (clientIds: string[]) => Promise<void>;
}

export function ClientSection({
  clientes,
  clienteSeleccionado,
  mostrarNuevoCliente,
  setMostrarNuevoCliente,
  nuevoCliente,
  setNuevoCliente,
  isCreatingClient,
  onClienteChange,
  onCrearCliente,
  onCancelCrearCliente,
  onEditClient,
  onDeleteClient,
  onBulkDelete,
}: ClientSectionProps) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const allSelected = clientes.length > 0 && clientes.every(c => selectedIds.has(c.id));

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
      setSelectedIds(new Set(clientes.map(c => c.id)));
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Seleccionar cliente
        </h3>
        <button
          onClick={() => setMostrarNuevoCliente(true)}
          className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
        >
          + Nuevo
        </button>
      </div>

      <ClientSelect
        clients={clientes}
        value={clienteSeleccionado?.id || ''}
        onChange={onClienteChange}
      />

      {clienteSeleccionado && (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="md"
            className="flex-1"
            onClick={() => onEditClient(clienteSeleccionado)}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="flex-1 border-red-700 text-red-700 hover:bg-red-700"
            onClick={() => onDeleteClient(clienteSeleccionado)}
          >
            Eliminar
          </Button>
        </div>
      )}

      {clientes.length === 0 && (
        <p className="mt-4 text-sm text-foreground-secondary text-center">
          No hay clientes registrados. Crea uno nuevo.
        </p>
      )}

      {/* Multi-select list for bulk delete */}
      {clientes.length > 1 && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          {isSelectionMode ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 text-sm text-foreground-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  Todos ({clientes.length})
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
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {clientes.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      {c.tax_id && (
                        <p className="text-xs text-foreground-secondary truncate">{c.tax_id}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="text-xs text-foreground-secondary hover:text-foreground transition-colors"
              >
                Seleccionar varios
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {isBulkDeleteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación masiva de clientes"
          onMouseDown={() => { if (!isBulkDeleting) setIsBulkDeleteModalOpen(false); }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar clientes</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''}</span>.
              </p>
              <p className="mt-2 text-xs text-foreground-secondary">
                Los clientes con subidas asociadas no se podrán eliminar.
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

      <CreateClientModal
        isOpen={mostrarNuevoCliente}
        nuevoCliente={nuevoCliente}
        setNuevoCliente={setNuevoCliente}
        isCreating={isCreatingClient}
        onSubmit={onCrearCliente}
        onClose={onCancelCrearCliente}
      />
    </div>
  );
}
