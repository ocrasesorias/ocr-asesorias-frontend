'use client';

import { Cliente } from '@/types/dashboard';

interface DeleteClientModalProps {
  isOpen: boolean;
  client: Cliente | null;
  isDeleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteClientModal({
  isOpen,
  client,
  isDeleting,
  onConfirm,
  onClose,
}: DeleteClientModalProps) {
  if (!isOpen || !client) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar eliminación de cliente"
      onMouseDown={() => {
        if (isDeleting) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground">Eliminar cliente</h3>
          <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
            Vas a eliminar <span className="font-semibold text-foreground">{client.name}</span>.
          </p>
          <p className="mt-2 text-xs text-foreground-secondary">
            Si este cliente tiene subidas, no se podrá eliminar hasta borrarlas.
          </p>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
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
