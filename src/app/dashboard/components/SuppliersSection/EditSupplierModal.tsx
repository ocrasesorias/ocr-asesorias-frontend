'use client';

import { SupplierForm } from './SupplierForm';
import type { Supplier } from '@/types/dashboard';
import type { SupplierFormState } from '@/hooks/useSupplierManagement';

interface EditSupplierModalProps {
  isOpen: boolean;
  supplier: Supplier | null;
  editProveedor: SupplierFormState;
  setEditProveedor: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  isUpdating: boolean;
  onSave: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function EditSupplierModal({
  isOpen,
  supplier,
  editProveedor,
  setEditProveedor,
  isUpdating,
  onSave,
  onClose,
}: EditSupplierModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editar proveedor"
      onMouseDown={() => {
        if (isUpdating) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSave}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground">Editar proveedor</h3>
            <p className="mt-2 text-sm text-foreground-secondary">
              {supplier ? `Modifica los datos de ${supplier.name}.` : 'Modifica los datos del proveedor.'}
            </p>
            <div className="mt-4">
              <SupplierForm
                proveedor={editProveedor}
                setProveedor={setEditProveedor}
                isDisabled={isUpdating}
              />
            </div>
          </div>
          <div className="px-6 pb-6 flex justify-end gap-3">
            <button
              type="button"
              className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUpdating}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUpdating}
            >
              {isUpdating ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
