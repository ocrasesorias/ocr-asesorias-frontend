'use client';

import { useState } from 'react';
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
}: SuppliersSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-xs text-foreground-secondary truncate">
                      {s.tax_id}
                      {s.address && ` · ${s.address}`}
                    </p>
                  </div>
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
                </div>
              ))
            )}
          </div>
        )}
        </div>
        )}
      </div>

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
