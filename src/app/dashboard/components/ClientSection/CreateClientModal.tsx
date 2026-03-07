'use client';

import { ClientForm } from './ClientForm';

interface CreateClientModalProps {
  isOpen: boolean;
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
  isCreating: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export function CreateClientModal({
  isOpen,
  nuevoCliente,
  setNuevoCliente,
  isCreating,
  onSubmit,
  onClose,
}: CreateClientModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crear cliente"
      onMouseDown={() => {
        if (isCreating) return;
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] rounded-xl bg-white shadow-xl border border-gray-200 flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Crear cliente</h3>
            <p className="mt-1 text-sm text-foreground-secondary">
              Introduce los datos del nuevo cliente. Las cuentas preferentes se usarán por defecto al validar facturas.
            </p>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            disabled={isCreating}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="p-6 overflow-y-auto flex-1">
            <ClientForm
                cliente={nuevoCliente}
                setCliente={setNuevoCliente}
                isDisabled={isCreating}
              />
          </div>

          <div className="px-6 py-4 flex justify-end gap-3 border-t border-gray-100 shrink-0">
            <button
              type="button"
              className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-3 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isCreating}
            >
              {isCreating ? 'Creando…' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
