'use client';

interface ClientFormProps {
  cliente: {
    name: string;
    tax_id: string;
    preferred_income_account: string;
    preferred_expense_account: string;
  };
  setCliente: React.Dispatch<React.SetStateAction<{
    name: string;
    tax_id: string;
    preferred_income_account: string;
    preferred_expense_account: string;
  }>>;
  isDisabled?: boolean;
}

/**
 * Formulario reutilizable para crear/editar clientes
 */
export function ClientForm({ cliente, setCliente, isDisabled = false }: ClientFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="client-name" className="block text-sm font-medium text-foreground mb-2">
          Nombre del cliente *
        </label>
        <input
          id="client-name"
          type="text"
          required
          value={cliente.name}
          onChange={(e) => setCliente({ ...cliente, name: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Ej: Empresa ABC S.L."
          disabled={isDisabled}
        />
      </div>
      <div>
        <label htmlFor="client-tax-id" className="block text-sm font-medium text-foreground mb-2">
          CIF/NIF (opcional)
        </label>
        <input
          id="client-tax-id"
          type="text"
          value={cliente.tax_id}
          onChange={(e) => setCliente({ ...cliente, tax_id: e.target.value })}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Ej: B12345678"
          disabled={isDisabled}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Cuenta preferente (Ingresos)
          </label>
          <select
            value={cliente.preferred_income_account}
            onChange={(e) =>
              setCliente({ ...cliente, preferred_income_account: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            disabled={isDisabled}
          >
            <option value="700">700 - Ventas</option>
            <option value="705">705 - Prestaciones de servicios</option>
            <option value="708">708 - Devoluciones y descuentos</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Cuenta preferente (Gastos)
          </label>
          <select
            value={cliente.preferred_expense_account}
            onChange={(e) =>
              setCliente({ ...cliente, preferred_expense_account: e.target.value })
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            disabled={isDisabled}
          >
            <option value="600">600</option>
            <option value="620">620</option>
            <option value="621">621</option>
            <option value="628">628</option>
          </select>
        </div>
      </div>
    </div>
  );
}
