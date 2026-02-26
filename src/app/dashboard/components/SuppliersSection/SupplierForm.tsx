'use client';

import type { SupplierFormState } from '@/hooks/useSupplierManagement';

interface SupplierFormProps {
  proveedor: SupplierFormState;
  setProveedor: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  isDisabled?: boolean;
}

export function SupplierForm({ proveedor, setProveedor, isDisabled = false }: SupplierFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="supplier-name" className="block text-sm font-medium text-foreground mb-2">
          Nombre *
        </label>
        <input
          id="supplier-name"
          type="text"
          required
          value={proveedor.name}
          onChange={(e) => setProveedor((prev) => ({ ...prev, name: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Ej: Proveedor ABC S.L."
          disabled={isDisabled}
        />
      </div>
      <div>
        <label htmlFor="supplier-tax-id" className="block text-sm font-medium text-foreground mb-2">
          CIF/NIF *
        </label>
        <input
          id="supplier-tax-id"
          type="text"
          required
          value={proveedor.tax_id}
          onChange={(e) => setProveedor((prev) => ({ ...prev, tax_id: e.target.value.toUpperCase() }))}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Ej: B12345678"
          disabled={isDisabled}
          maxLength={9}
        />
      </div>
      <div>
        <label htmlFor="supplier-address" className="block text-sm font-medium text-foreground mb-2">
          Dirección (opcional)
        </label>
        <input
          id="supplier-address"
          type="text"
          value={proveedor.address}
          onChange={(e) => setProveedor((prev) => ({ ...prev, address: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          placeholder="Calle, número, piso..."
          disabled={isDisabled}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="supplier-postal-code" className="block text-sm font-medium text-foreground mb-2">
            Código postal
          </label>
          <input
            id="supplier-postal-code"
            type="text"
            value={proveedor.postal_code}
            onChange={(e) => setProveedor((prev) => ({ ...prev, postal_code: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="28001"
            disabled={isDisabled}
            maxLength={10}
          />
        </div>
        <div>
          <label htmlFor="supplier-province" className="block text-sm font-medium text-foreground mb-2">
            Provincia
          </label>
          <input
            id="supplier-province"
            type="text"
            value={proveedor.province}
            onChange={(e) => setProveedor((prev) => ({ ...prev, province: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            placeholder="Madrid"
            disabled={isDisabled}
          />
        </div>
      </div>
    </div>
  );
}
