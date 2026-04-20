'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SplitDetection } from '@/hooks/useInvoiceProcessing';

interface RevisarSplitFacturasProps {
  isOpen: boolean;
  detections: SplitDetection[];
  onClose: () => void;
  onApplied?: () => void;
}

type LocalRange = { page_start: number; page_end: number };

/** Paleta cíclica de colores por factura — usa fondos suaves + bordes saturados de Tailwind. */
const COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-400', chip: 'bg-blue-100 text-blue-800 border-blue-300' },
  { bg: 'bg-purple-50', border: 'border-purple-400', chip: 'bg-purple-100 text-purple-800 border-purple-300' },
  { bg: 'bg-emerald-50', border: 'border-emerald-400', chip: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { bg: 'bg-amber-50', border: 'border-amber-400', chip: 'bg-amber-100 text-amber-800 border-amber-300' },
  { bg: 'bg-rose-50', border: 'border-rose-400', chip: 'bg-rose-100 text-rose-800 border-rose-300' },
  { bg: 'bg-indigo-50', border: 'border-indigo-400', chip: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
] as const;

const colorFor = (idx: number) => COLORS[idx % COLORS.length];

/** Devuelve el índice (0-based) del rango que contiene la página `pageNum` (1-indexed). */
function rangeIndexForPage(ranges: LocalRange[], pageNum: number): number {
  for (let i = 0; i < ranges.length; i++) {
    if (pageNum >= ranges[i].page_start && pageNum <= ranges[i].page_end) return i;
  }
  return -1;
}

/** Divide el rango que contiene `pageNum` en dos: ...→pageNum-1 y pageNum→fin. */
function splitRangeAtPage(ranges: LocalRange[], pageNum: number): LocalRange[] {
  const idx = rangeIndexForPage(ranges, pageNum);
  if (idx < 0) return ranges;
  const r = ranges[idx];
  if (pageNum <= r.page_start) return ranges; // ya es inicio de factura
  const left = { page_start: r.page_start, page_end: pageNum - 1 };
  const right = { page_start: pageNum, page_end: r.page_end };
  return [...ranges.slice(0, idx), left, right, ...ranges.slice(idx + 1)];
}

/** Fusiona el rango `idx` con el anterior. */
function mergeRangeWithPrevious(ranges: LocalRange[], idx: number): LocalRange[] {
  if (idx <= 0 || idx >= ranges.length) return ranges;
  const prev = ranges[idx - 1];
  const curr = ranges[idx];
  const merged = { page_start: prev.page_start, page_end: curr.page_end };
  return [...ranges.slice(0, idx - 1), merged, ...ranges.slice(idx + 1)];
}

/** Estado por upload (PDF original): thumbnails + rangos editables. */
type LocalState = {
  loading: boolean;
  error: string | null;
  thumbnails: string[]; // data:image/jpeg;base64,...
  totalPages: number;
  ranges: LocalRange[];
  isDirty: boolean;
};

const initialStateFromDetection = (d: SplitDetection): LocalState => ({
  loading: true,
  error: null,
  thumbnails: [],
  totalPages: d.total_pages,
  ranges: d.ranges.map((r) => ({ page_start: r.page_start, page_end: r.page_end })),
  isDirty: false,
});

export function RevisarSplitFacturas({
  isOpen,
  detections,
  onClose,
  onApplied,
}: RevisarSplitFacturasProps) {
  const [stateByInvoice, setStateByInvoice] = useState<Record<string, LocalState>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const loadStartedRef = useRef<Set<string>>(new Set());

  // Inicializa estado y dispara la carga de thumbnails para detecciones nuevas.
  // Combinado en un solo efecto para evitar la race condition de leer estado stale
  // antes de que setState se aplique.
  useEffect(() => {
    if (!isOpen) return;

    setStateByInvoice((prev) => {
      const next = { ...prev };
      for (const d of detections) {
        if (!next[d.originalInvoiceId]) {
          next[d.originalInvoiceId] = initialStateFromDetection(d);
        }
      }
      return next;
    });

    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      for (const d of detections) {
        if (loadStartedRef.current.has(d.originalInvoiceId)) continue;
        loadStartedRef.current.add(d.originalInvoiceId);
        try {
          const r = await fetch(`/api/invoices/${d.originalInvoiceId}/thumbnails`, { signal: controller.signal });
          const j = await r.json().catch(() => null);
          if (cancelled) return;
          if (!r.ok) {
            setStateByInvoice((prev) => {
              const cur = prev[d.originalInvoiceId] || initialStateFromDetection(d);
              return {
                ...prev,
                [d.originalInvoiceId]: { ...cur, loading: false, error: j?.error || `HTTP ${r.status}` },
              };
            });
            continue;
          }
          const thumbs: string[] = Array.isArray(j?.thumbnails) ? j.thumbnails : [];
          const total: number = Number(j?.total_pages) || thumbs.length;
          setStateByInvoice((prev) => {
            const cur = prev[d.originalInvoiceId] || initialStateFromDetection(d);
            return {
              ...prev,
              [d.originalInvoiceId]: {
                ...cur,
                loading: false,
                thumbnails: thumbs,
                totalPages: total || cur.totalPages,
              },
            };
          });
        } catch (e) {
          if (cancelled || (e as Error)?.name === 'AbortError') return;
          setStateByInvoice((prev) => {
            const cur = prev[d.originalInvoiceId] || initialStateFromDetection(d);
            return {
              ...prev,
              [d.originalInvoiceId]: {
                ...cur,
                loading: false,
                error: (e as Error)?.message || 'Error cargando miniaturas',
              },
            };
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, detections]);

  // Resetea el tracker de cargas iniciadas al cerrar el modal, así la próxima apertura
  // (con nuevas detecciones) volverá a cargar miniaturas si hace falta.
  useEffect(() => {
    if (!isOpen) {
      loadStartedRef.current.clear();
    }
  }, [isOpen]);

  const totalNuevasFacturas = useMemo(
    () => detections.reduce((acc, d) => acc + d.created_invoice_ids.length, 0),
    [detections]
  );

  const updateRanges = (invoiceId: string, transform: (ranges: LocalRange[]) => LocalRange[]) => {
    setStateByInvoice((prev) => {
      const cur = prev[invoiceId];
      if (!cur) return prev;
      const newRanges = transform(cur.ranges);
      return {
        ...prev,
        [invoiceId]: { ...cur, ranges: newRanges, isDirty: true },
      };
    });
  };

  const handleSplitAt = (invoiceId: string, pageNum: number) => {
    updateRanges(invoiceId, (ranges) => splitRangeAtPage(ranges, pageNum));
  };

  const handleMergeWithPrevious = (invoiceId: string, factIdx: number) => {
    updateRanges(invoiceId, (ranges) => mergeRangeWithPrevious(ranges, factIdx));
  };

  const handleResetToDetected = (invoiceId: string) => {
    const detection = detections.find((d) => d.originalInvoiceId === invoiceId);
    if (!detection) return;
    setStateByInvoice((prev) => ({
      ...prev,
      [invoiceId]: {
        ...prev[invoiceId],
        ranges: detection.ranges.map((r) => ({ page_start: r.page_start, page_end: r.page_end })),
        isDirty: false,
      },
    }));
  };

  const handleApplyChanges = async (invoiceId: string, uploadId: string) => {
    const cur = stateByInvoice[invoiceId];
    if (!cur || !cur.isDirty) return;
    setApplyingId(invoiceId);
    setGlobalError(null);
    try {
      const r = await fetch(`/api/uploads/${uploadId}/splits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalInvoiceId: invoiceId, ranges: cur.ranges }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        setGlobalError(j?.error || `Error aplicando cambios (HTTP ${r.status})`);
        return;
      }
      // Re-disparar extracción para la ancla + nuevas invoices (fire-and-forget)
      const idsToReExtract: string[] = [
        j?.anchor_invoice_id,
        ...(Array.isArray(j?.created_invoice_ids) ? j.created_invoice_ids : []),
      ].filter((x): x is string => typeof x === 'string' && x.length > 0);
      for (const id of idsToReExtract) {
        // No await: queremos que se lancen en paralelo y no bloqueen al usuario
        fetch(`/api/invoices/${id}/extract`, { method: 'POST' }).catch((err) => {
          console.error(`Error re-extrayendo invoice ${id}:`, err);
        });
      }
      setStateByInvoice((prev) => ({
        ...prev,
        [invoiceId]: { ...prev[invoiceId], isDirty: false },
      }));
      onApplied?.();
    } catch (e) {
      setGlobalError((e as Error)?.message || 'Error aplicando cambios');
    } finally {
      setApplyingId(null);
    }
  };

  if (!isOpen || detections.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Revisar facturas detectadas"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-none bg-[var(--l-card,#ffffff)] shadow-xl border border-[var(--l-card-border,#e5e7eb)] p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-foreground">
          Revisar división de PDFs multi-factura
        </h3>
        <p className="mt-2 text-sm text-foreground-secondary">
          Hemos detectado que {detections.length === 1 ? 'un PDF contiene' : `${detections.length} PDFs contienen`} varias facturas
          (en total se han creado {totalNuevasFacturas} factura{totalNuevasFacturas !== 1 ? 's' : ''} adicional{totalNuevasFacturas !== 1 ? 'es' : ''}).
          Si la división no es correcta, puedes ajustarla pulsando entre las páginas.
        </p>

        {globalError ? (
          <div className="mt-3 p-3 border border-red-300 bg-red-50 text-sm text-red-700">
            {globalError}
          </div>
        ) : null}

        <div className="mt-5 space-y-6">
          {detections.map((d) => {
            const st = stateByInvoice[d.originalInvoiceId];
            if (!st) return null;
            return (
              <div
                key={d.originalInvoiceId}
                className="border border-[var(--l-card-border,#e5e7eb)] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate" title={d.filename ?? ''}>
                      {d.filename ?? 'Documento sin nombre'}
                    </p>
                    <p className="text-xs text-foreground-secondary mt-0.5">
                      {st.totalPages} página{st.totalPages !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {st.isDirty ? (
                      <button
                        type="button"
                        className="text-xs px-2 py-1 border border-[var(--l-card-border,#e5e7eb)] hover:bg-[var(--l-bg,#f9fafb)] transition-colors"
                        onClick={() => handleResetToDetected(d.originalInvoiceId)}
                        disabled={applyingId === d.originalInvoiceId}
                      >
                        Restablecer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs px-3 py-1 bg-[var(--l-accent,#0f172a)] text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => handleApplyChanges(d.originalInvoiceId, d.uploadId)}
                      disabled={!st.isDirty || applyingId === d.originalInvoiceId || st.loading}
                    >
                      {applyingId === d.originalInvoiceId ? 'Aplicando…' : 'Aplicar cambios'}
                    </button>
                  </div>
                </div>

                {st.loading ? (
                  <div className="text-sm text-foreground-secondary py-8 text-center">
                    Cargando miniaturas…
                  </div>
                ) : st.error ? (
                  <div className="text-sm text-red-600 py-4">
                    Error cargando miniaturas: {st.error}
                  </div>
                ) : (
                  <PageGrid
                    thumbnails={st.thumbnails}
                    totalPages={st.totalPages}
                    ranges={st.ranges}
                    onSplitAt={(p) => handleSplitAt(d.originalInvoiceId, p)}
                    onMergeWithPrevious={(idx) => handleMergeWithPrevious(d.originalInvoiceId, idx)}
                  />
                )}

                {/* Resumen textual de los rangos actuales */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {st.ranges.map((r, i) => {
                    const c = colorFor(i);
                    return (
                      <span
                        key={`${r.page_start}-${r.page_end}`}
                        className={`inline-flex items-center gap-1 px-2 py-1 text-xs border ${c.chip}`}
                      >
                        Factura {i + 1}: pág{r.page_start !== r.page_end ? 's.' : '.'} {r.page_start}
                        {r.page_start !== r.page_end ? `–${r.page_end}` : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-5 py-3 rounded-none border border-[var(--l-card-border,#e5e7eb)] text-foreground hover:bg-[var(--l-bg,#f9fafb)] transition-colors"
            onClick={onClose}
            disabled={Boolean(applyingId)}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// PageGrid: render del grid de miniaturas con separadores
// =====================================================

interface PageGridProps {
  thumbnails: string[];
  totalPages: number;
  ranges: LocalRange[];
  onSplitAt: (pageNum: number) => void;
  onMergeWithPrevious: (factIdx: number) => void;
}

function PageGrid({ thumbnails, totalPages, ranges, onSplitAt, onMergeWithPrevious }: PageGridProps) {
  // Si no llegan thumbnails (degradado), render de fallback con cuadritos numerados
  const hasThumbs = thumbnails.length > 0;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  const factIdxByPage = useMemo(() => {
    const m: Record<number, number> = {};
    for (let i = 0; i < ranges.length; i++) {
      for (let p = ranges[i].page_start; p <= ranges[i].page_end; p++) {
        m[p] = i;
      }
    }
    return m;
  }, [ranges]);

  return (
    <div className="flex flex-wrap items-stretch gap-0">
      {pages.map((p, idx) => {
        const factIdx = factIdxByPage[p] ?? 0;
        const c = colorFor(factIdx);
        const nextFactIdx = idx + 1 < pages.length ? factIdxByPage[pages[idx + 1]] : factIdx;
        const isBoundaryAfter = nextFactIdx !== factIdx; // hay corte entre p y p+1
        const isStartOfFact = ranges[factIdx]?.page_start === p;

        return (
          <div key={p} className="flex items-stretch">
            {/* Separador a la IZQUIERDA: existe entre páginas (no antes de la primera) */}
            {idx > 0 && (
              <PageSeparator
                isBoundary={factIdxByPage[pages[idx - 1]] !== factIdx}
                onSplit={() => onSplitAt(p)}
                onMerge={() => onMergeWithPrevious(factIdx)}
                canSplit={!isStartOfFact || idx > 0}  // no permitir dividir donde ya hay corte
              />
            )}

            {/* Miniatura de la página */}
            <div
              className={`flex flex-col items-center p-1.5 border-2 ${c.bg} ${c.border}`}
              title={`Página ${p} — Factura ${factIdx + 1}`}
            >
              {hasThumbs && thumbnails[p - 1] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={thumbnails[p - 1]}
                  alt={`Página ${p}`}
                  className="w-20 h-28 object-contain bg-white border border-gray-200"
                />
              ) : (
                <div className="w-20 h-28 flex items-center justify-center bg-white border border-gray-200 text-2xl font-bold text-gray-400">
                  {p}
                </div>
              )}
              <span className="text-[10px] mt-1 text-foreground-secondary">
                Pág. {p}
              </span>
            </div>

            {/* La marca de "fin de factura" se ve en el siguiente separador (isBoundary=true) */}
            {/* No renderizamos nada extra a la derecha aquí */}
            {isBoundaryAfter && idx === pages.length - 1 ? null : null}
          </div>
        );
      })}
    </div>
  );
}

interface PageSeparatorProps {
  isBoundary: boolean;
  onSplit: () => void;
  onMerge: () => void;
  canSplit: boolean;
}

function PageSeparator({ isBoundary, onSplit, onMerge, canSplit }: PageSeparatorProps) {
  if (isBoundary) {
    return (
      <button
        type="button"
        className="group relative flex items-center justify-center w-6 mx-0.5 my-1.5 bg-foreground hover:bg-red-500 text-white transition-colors"
        onClick={onMerge}
        title="Fusionar con factura anterior"
      >
        <span className="text-[10px] font-bold leading-none transform -rotate-90 whitespace-nowrap opacity-90 group-hover:opacity-100">
          ✂ corte
        </span>
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap text-[10px] bg-foreground text-white px-2 py-0.5 z-10">
          Fusionar
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      className="group relative flex items-center justify-center w-3 mx-0.5 my-1.5 hover:bg-blue-100 transition-colors disabled:opacity-30"
      onClick={onSplit}
      disabled={!canSplit}
      title="Dividir aquí (nueva factura)"
    >
      <span className="text-[10px] text-gray-400 group-hover:text-blue-600 leading-none transition-colors">
        +
      </span>
      <span className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap text-[10px] bg-foreground text-white px-2 py-0.5 z-10">
        Dividir
      </span>
    </button>
  );
}
