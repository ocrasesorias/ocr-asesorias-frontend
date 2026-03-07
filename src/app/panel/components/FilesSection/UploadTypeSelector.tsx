'use client';

interface UploadTypeSelectorProps {
  onSelectTipo: (tipo: 'gasto' | 'ingreso') => void;
  onCancel: () => void;
}

export function UploadTypeSelector({ onSelectTipo, onCancel }: UploadTypeSelectorProps) {
  return (
    <div className="py-6">
      <h4 className="text-lg font-semibold text-foreground mb-2 text-center">
        ¿Esta subida es de gasto o de ingreso?
      </h4>
      <p className="text-foreground-secondary mb-6 text-center">
        Elige una opción para continuar.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onSelectTipo('ingreso')}
          className="group text-left border border-gray-200 rounded-xl p-5 hover:border-secondary hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-secondary transition-colors">
              <svg className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0l-6-6m6 6l-6 6" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Ingreso</div>
              <div className="text-sm text-foreground-secondary">Venta / emitida</div>
            </div>
          </div>
          <div className="text-xs text-foreground-secondary">
            Ej.: servicios facturados, ventas, abonos.
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTipo('gasto')}
          className="group text-left border border-gray-200 rounded-xl p-5 hover:border-primary hover:bg-primary-lighter transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary-lighter flex items-center justify-center text-primary transition-colors">
              <svg className="w-5 h-5 transition-transform duration-200 group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m0 0l6-6m-6 6l6 6" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-foreground">Gastos</div>
              <div className="text-sm text-foreground-secondary">Compra / proveedor</div>
            </div>
          </div>
          <div className="text-xs text-foreground-secondary">
            Ej.: suministros, servicios, alquiler, materiales.
          </div>
        </button>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
