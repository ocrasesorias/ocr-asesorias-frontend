'use client';

import { ClientForm } from './ClientForm';

interface CreateClientModalProps {
  isOpen: boolean;
  nuevoCliente: {
    name: string;
    tax_id: string;
    address: string;
    preferred_income_account: string;
    preferred_expense_account: string;
    activity_description: string;
  };
  setNuevoCliente: React.Dispatch<React.SetStateAction<{
    name: string;
    tax_id: string;
    address: string;
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
        className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-foreground">Crear cliente</h3>
            <p className="mt-2 text-sm text-foreground-secondary">
              Introduce los datos del nuevo cliente. Las cuentas preferentes se usarán por defecto al validar facturas.
            </p>

            <div className="mt-4">
              <ClientForm
                cliente={nuevoCliente}
                setCliente={setNuevoCliente}
                isDisabled={isCreating}
              />
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3">
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
