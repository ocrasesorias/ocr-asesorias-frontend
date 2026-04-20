'use client';

import type { SplitDetection } from '@/hooks/useInvoiceProcessing';

interface RevisarSplitFacturasProps {
  isOpen: boolean;
  detections: SplitDetection[];
  onClose: () => void;
}

const METHOD_LABELS: Record<SplitDetection['method'], string> = {
  single: 'única',
  heuristic: 'heurística',
  ai: 'IA',
  hybrid: 'híbrido',
};

/**
 * Modal informativo que muestra al usuario los PDFs multi-factura detectados y las
 * facturas individuales en las que se han separado. La separación ya se ha aplicado
 * en backend (no es reversible desde aquí); el usuario puede cerrar y, si la
 * detección no le gusta, eliminar manualmente las invoices generadas desde la lista.
 */
export function RevisarSplitFacturas({
  isOpen,
  detections,
  onClose,
}: RevisarSplitFacturasProps) {
  if (!isOpen || detections.length === 0) return null;

  const totalFacturasNuevas = detections.reduce(
    (acc, d) => acc + d.created_invoice_ids.length,
    0
  );
  const totalCosteIA = detections.reduce(
    (acc, d) => acc + (d.ai_cost_estimate || 0),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Revisar facturas detectadas"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-none bg-[var(--l-card,#ffffff)] shadow-xl border border-[var(--l-card-border,#e5e7eb)] p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">
          PDFs multi-factura detectados
        </h3>
        <p className="mt-2 text-sm text-foreground-secondary">
          Hemos detectado que {detections.length === 1 ? 'un PDF contiene' : `${detections.length} PDFs contienen`} varias
          facturas. Las hemos separado automáticamente para procesarlas por
          separado. Se han creado{' '}
          <span className="font-semibold text-foreground">
            {totalFacturasNuevas} factura{totalFacturasNuevas !== 1 ? 's' : ''} adicional
            {totalFacturasNuevas !== 1 ? 'es' : ''}
          </span>
          .
        </p>

        <div className="mt-5 space-y-4">
          {detections.map((d) => (
            <div
              key={d.originalInvoiceId}
              className="border border-[var(--l-card-border,#e5e7eb)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate" title={d.filename ?? ''}>
                    {d.filename ?? 'Documento sin nombre'}
                  </p>
                  <p className="text-xs text-foreground-secondary mt-0.5">
                    {d.total_pages} página{d.total_pages !== 1 ? 's' : ''} ·{' '}
                    {d.ranges.length} factura{d.ranges.length !== 1 ? 's' : ''} ·{' '}
                    detección {METHOD_LABELS[d.method]}
                    {d.ai_cost_estimate > 0
                      ? ` · coste IA: $${d.ai_cost_estimate.toFixed(4)}`
                      : ''}
                  </p>
                </div>
              </div>

              <ul className="mt-3 space-y-1 text-sm text-foreground-secondary">
                {d.ranges.map((r, i) => (
                  <li key={`${r.page_start}-${r.page_end}`} className="flex items-baseline gap-2">
                    <span className="font-medium text-foreground">
                      Factura {i + 1}:
                    </span>
                    <span>
                      página{r.page_start !== r.page_end ? 's' : ''} {r.page_start}
                      {r.page_start !== r.page_end ? `–${r.page_end}` : ''}
                    </span>
                    {r.confidence < 0.7 ? (
                      <span className="text-xs text-amber-600">
                        (confianza baja, revisar)
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>

              {d.error ? (
                <p className="mt-2 text-xs text-red-600">Error: {d.error}</p>
              ) : null}
            </div>
          ))}
        </div>

        {totalCosteIA > 0 ? (
          <p className="mt-4 text-xs text-foreground-secondary">
            Coste total estimado de IA en esta detección: $
            {totalCosteIA.toFixed(4)}
          </p>
        ) : null}

        <div className="mt-3 text-xs text-foreground-secondary">
          Si alguna factura se separó incorrectamente, puedes eliminarla desde la
          lista de archivos.
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="px-5 py-3 rounded-none bg-[var(--l-accent,#0f172a)] text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--l-accent,#0f172a)]"
            onClick={onClose}
          >
            Entendido, continuar
          </button>
        </div>
      </div>
    </div>
  );
}
