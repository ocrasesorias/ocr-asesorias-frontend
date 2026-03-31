'use client';

import { ArchivoSubido } from '@/types/dashboard';

interface DeleteInvoiceModalProps {
  isOpen: boolean;
  factura: ArchivoSubido | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteInvoiceModal({
  isOpen,
  factura,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteInvoiceModalProps) {
  if (!isOpen || !factura) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación de factura"
      onMouseDown={() => {
        if (isDeleting) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-none bg-[var(--l-card,#ffffff)] shadow-xl border border-[var(--l-card-border,#e5e7eb)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground">Eliminar factura</h3>
          <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
            Vas a eliminar <span className="font-semibold text-foreground">{factura.nombre}</span>.
          </p>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-5 py-3 rounded-none border border-[var(--l-card-border,#e5e7eb)] text-foreground hover:bg-[var(--l-bg,#f9fafb)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isDeleting}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-5 py-3 rounded-none bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
