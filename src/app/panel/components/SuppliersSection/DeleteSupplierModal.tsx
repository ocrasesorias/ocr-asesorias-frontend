'use client';

import type { Supplier } from '@/types/dashboard';

interface DeleteSupplierModalProps {
  isOpen: boolean;
  supplier: Supplier | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteSupplierModal({
  isOpen,
  supplier,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteSupplierModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Eliminar proveedor"
      onMouseDown={() => {
        if (isDeleting) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">Eliminar proveedor</h3>
        <p className="mt-3 text-sm text-foreground-secondary">
          ¿Estás seguro de que quieres eliminar a{' '}
          <span className="font-semibold text-foreground">{supplier?.name ?? 'este proveedor'}</span>?
          Esta acción no se puede deshacer.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
