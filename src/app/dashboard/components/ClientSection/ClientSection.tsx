'use client';

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
    preferred_income_account: string;
    preferred_expense_account: string;
    activity_description: string;
  };
  setNuevoCliente: React.Dispatch<React.SetStateAction<{
    name: string;
    tax_id: string;
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
}: ClientSectionProps) {
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
