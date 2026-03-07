'use client';

import { useMemo } from 'react';
import { validarNifCif } from '@/lib/validarNifCif';

interface ClientFormProps {
  cliente: {
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
  setCliente: React.Dispatch<React.SetStateAction<{
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
  isDisabled?: boolean;
}

/**
 * Formulario reutilizable para crear/editar clientes
 */
export function ClientForm({ cliente, setCliente, isDisabled = false }: ClientFormProps) {
  const taxIdValidation = useMemo(() => {
    const trimmed = (cliente.tax_id ?? '').trim();
    if (!trimmed) return { error: undefined };
    const res = validarNifCif(trimmed);
    return { error: res.valido ? undefined : res.error };
  }, [cliente.tax_id]);

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
          onChange={(e) => setCliente(prev => ({ ...prev, name: e.target.value }))}
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
          onChange={(e) => setCliente(prev => ({ ...prev, tax_id: e.target.value }))}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
            taxIdValidation.error ? 'border-amber-500 bg-amber-50/70' : 'border-gray-200'
          }`}
          placeholder="Ej: B12345678"
          disabled={isDisabled}
          aria-invalid={!!taxIdValidation.error}
          aria-describedby={taxIdValidation.error ? 'client-tax-id-error' : undefined}
        />
        {taxIdValidation.error && (
          <p id="client-tax-id-error" className="mt-1.5 text-sm text-amber-600 flex items-center gap-1.5" role="alert">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {taxIdValidation.error}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="client-address" className="block text-sm font-medium text-foreground mb-2">
          Dirección (opcional)
        </label>
        <input
          id="client-address"
          type="text"
          value={cliente.address}
          onChange={(e) => setCliente(prev => ({ ...prev, address: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Ej: Calle Mayor 1"
          disabled={isDisabled}
        />
        <p className="mt-1 text-xs text-foreground-secondary">
          Se usa para evitar que la IA confunda tu empresa con el proveedor al extraer facturas.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="client-postal-code" className="block text-sm font-medium text-foreground mb-2">
            Código postal
          </label>
          <input
            id="client-postal-code"
            type="text"
            value={cliente.postal_code}
            onChange={(e) => setCliente(prev => ({ ...prev, postal_code: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="28013"
            disabled={isDisabled}
            maxLength={10}
          />
        </div>
        <div>
          <label htmlFor="client-city" className="block text-sm font-medium text-foreground mb-2">
            Población
          </label>
          <input
            id="client-city"
            type="text"
            value={cliente.city}
            onChange={(e) => setCliente(prev => ({ ...prev, city: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Madrid"
            disabled={isDisabled}
          />
        </div>
        <div>
          <label htmlFor="client-province" className="block text-sm font-medium text-foreground mb-2">
            Provincia
          </label>
          <input
            id="client-province"
            type="text"
            value={cliente.province}
            onChange={(e) => setCliente(prev => ({ ...prev, province: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Madrid"
            disabled={isDisabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Cuenta preferente (Ingresos)
          </label>
          <select
            value={cliente.preferred_income_account}
            onChange={(e) =>
              setCliente(prev => ({ ...prev, preferred_income_account: e.target.value }))
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
              setCliente(prev => ({ ...prev, preferred_expense_account: e.target.value }))
            }
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            disabled={isDisabled}
          >
            <option value="600">600 - Compra mercaderías</option>
            <option value="601">601 - Compra materias primas</option>
            <option value="602">602 - Otros aprovisionamientos</option>
            <option value="607">607 - Trabajos otras empresas</option>
            <option value="620">620 - Gastos I+D</option>
            <option value="621">621 - Arrendamientos y cánones</option>
            <option value="622">622 - Reparaciones y conservación</option>
            <option value="623">623 - Servicios profesionales</option>
            <option value="624">624 - Transportes</option>
            <option value="625">625 - Primas de seguros</option>
            <option value="626">626 - Servicios bancarios</option>
            <option value="627">627 - Publicidad y RRPP</option>
            <option value="628">628 - Suministros</option>
            <option value="629">629 - Otros servicios</option>
            <option value="631">631 - Otros tributos</option>
            <option value="640">640 - Sueldos y salarios</option>
            <option value="642">642 - Seg. Social empresa</option>
            <option value="649">649 - Otros gastos sociales</option>
            <option value="662">662 - Intereses deudas</option>
            <option value="669">669 - Otros gastos financieros</option>
            <option value="681">681 - Amortización inmov. material</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="client-activity" className="block text-sm font-medium text-foreground mb-2">
          Actividad (opcional)
        </label>
        <textarea
          id="client-activity"
          rows={3}
          value={cliente.activity_description}
          onChange={(e) => setCliente(prev => ({ ...prev, activity_description: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all resize-none"
          placeholder="Ej: Comercio al por menor, Servicios profesionales..."
          disabled={isDisabled}
        />
      </div>
    </div>
  );
}
