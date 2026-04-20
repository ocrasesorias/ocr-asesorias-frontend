'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ViewerState = { invoiceId: string; pageNum: number } | null;

export function RevisarSplitFacturas({
  isOpen,
  detections,
  onClose,
  onApplied,
}: RevisarSplitFacturasProps) {
  const [stateByInvoice, setStateByInvoice] = useState<Record<string, LocalState>>({});
  const [isApplying, setIsApplying] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerState>(null);
  const loadStartedRef = useRef<Set<string>>(new Set());

  // Inicializa estado y dispara la carga de thumbnails para detecciones nuevas.
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

  // Resetea el tracker al cerrar el modal
  useEffect(() => {
    if (!isOpen) {
      loadStartedRef.current.clear();
      setViewer(null);
    }
  }, [isOpen]);

  const totalNuevasFacturas = useMemo(
    () => detections.reduce((acc, d) => acc + d.created_invoice_ids.length, 0),
    [detections]
  );

  const dirtyCount = useMemo(
    () => detections.filter((d) => stateByInvoice[d.originalInvoiceId]?.isDirty).length,
    [detections, stateByInvoice]
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

  /** Aplica todos los cambios pendientes en serie. */
  const handleApplyAll = async () => {
    if (isApplying || dirtyCount === 0) return;
    setIsApplying(true);
    setGlobalError(null);
    try {
      for (const d of detections) {
        const cur = stateByInvoice[d.originalInvoiceId];
        if (!cur || !cur.isDirty) continue;
        const r = await fetch(`/api/uploads/${d.uploadId}/splits`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalInvoiceId: d.originalInvoiceId, ranges: cur.ranges }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok) {
          setGlobalError(
            `Error aplicando cambios en "${d.filename || 'PDF'}": ${j?.error || `HTTP ${r.status}`}`
          );
          return; // detiene en el primer fallo
        }
        // Re-disparar extracción para la ancla + nuevas invoices (fire-and-forget)
        const idsToReExtract: string[] = [
          j?.anchor_invoice_id,
          ...(Array.isArray(j?.created_invoice_ids) ? j.created_invoice_ids : []),
        ].filter((x): x is string => typeof x === 'string' && x.length > 0);
        for (const id of idsToReExtract) {
          fetch(`/api/invoices/${id}/extract`, { method: 'POST' }).catch((err) => {
            console.error(`Error re-extrayendo invoice ${id}:`, err);
          });
        }
        setStateByInvoice((prev) => ({
          ...prev,
          [d.originalInvoiceId]: { ...prev[d.originalInvoiceId], isDirty: false },
        }));
      }
      onApplied?.();
      onClose();
    } catch (e) {
      setGlobalError((e as Error)?.message || 'Error aplicando cambios');
    } finally {
      setIsApplying(false);
    }
  };

  // Navegación con teclado dentro del lightbox
  const moveViewer = useCallback(
    (delta: number) => {
      if (!viewer) return;
      const st = stateByInvoice[viewer.invoiceId];
      if (!st) return;
      const next = viewer.pageNum + delta;
      if (next < 1 || next > st.totalPages) return;
      setViewer({ invoiceId: viewer.invoiceId, pageNum: next });
    },
    [viewer, stateByInvoice]
  );

  useEffect(() => {
    if (!viewer) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewer(null);
      else if (e.key === 'ArrowLeft') moveViewer(-1);
      else if (e.key === 'ArrowRight') moveViewer(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewer, moveViewer]);

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
          Si la división no es correcta, puedes ajustarla pulsando entre las páginas. Haz clic en una miniatura para verla en grande.
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
                  {st.isDirty ? (
                    <button
                      type="button"
                      className="shrink-0 text-xs px-2 py-1 border border-[var(--l-card-border,#e5e7eb)] hover:bg-[var(--l-bg,#f9fafb)] transition-colors disabled:opacity-50"
                      onClick={() => handleResetToDetected(d.originalInvoiceId)}
                      disabled={isApplying}
                    >
                      Restablecer
                    </button>
                  ) : null}
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
                    onPageClick={(p) => setViewer({ invoiceId: d.originalInvoiceId, pageNum: p })}
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
            className="px-5 py-3 rounded-none border border-[var(--l-card-border,#e5e7eb)] text-foreground hover:bg-[var(--l-bg,#f9fafb)] transition-colors disabled:opacity-50"
            onClick={onClose}
            disabled={isApplying}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="px-5 py-3 rounded-none bg-[var(--l-accent,#0f172a)] text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--l-accent,#0f172a)] disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleApplyAll}
            disabled={dirtyCount === 0 || isApplying}
          >
            {isApplying
              ? 'Aplicando…'
              : dirtyCount > 0
                ? `Aplicar cambios (${dirtyCount})`
                : 'Aplicar cambios'}
          </button>
        </div>
      </div>

      {/* Lightbox de página individual */}
      {viewer ? (
        <PageLightbox
          state={stateByInvoice[viewer.invoiceId]}
          pageNum={viewer.pageNum}
          onClose={() => setViewer(null)}
          onPrev={() => moveViewer(-1)}
          onNext={() => moveViewer(1)}
        />
      ) : null}
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
  onPageClick: (pageNum: number) => void;
}

function PageGrid({ thumbnails, totalPages, ranges, onSplitAt, onMergeWithPrevious, onPageClick }: PageGridProps) {
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
        const isStartOfFact = ranges[factIdx]?.page_start === p;

        return (
          <div key={p} className="flex items-stretch">
            {idx > 0 && (
              <PageSeparator
                isBoundary={factIdxByPage[pages[idx - 1]] !== factIdx}
                onSplit={() => onSplitAt(p)}
                onMerge={() => onMergeWithPrevious(factIdx)}
                canSplit={!isStartOfFact || idx > 0}
              />
            )}

            <button
              type="button"
              className={`flex flex-col items-center p-1.5 border-2 ${c.bg} ${c.border} hover:brightness-95 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500`}
              title={`Página ${p} — Factura ${factIdx + 1} (clic para ampliar)`}
              onClick={() => onPageClick(p)}
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
            </button>
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

// =====================================================
// PageLightbox: vista grande de una página con navegación
// =====================================================

interface PageLightboxProps {
  state: LocalState | undefined;
  pageNum: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function PageLightbox({ state, pageNum, onClose, onPrev, onNext }: PageLightboxProps) {
  if (!state) return null;
  const total = state.totalPages;
  const thumb = state.thumbnails[pageNum - 1] || null;
  const factIdx = (() => {
    for (let i = 0; i < state.ranges.length; i++) {
      const r = state.ranges[i];
      if (pageNum >= r.page_start && pageNum <= r.page_end) return i;
    }
    return -1;
  })();
  const c = factIdx >= 0 ? colorFor(factIdx) : null;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-black/85 p-4 flex flex-col items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Página ${pageNum} de ${total}`}
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-4xl flex flex-col items-center my-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="w-full flex items-center justify-between mb-3 text-white">
          <div className="text-sm">
            <span className="font-semibold">Página {pageNum}</span>
            <span className="opacity-70"> de {total}</span>
            {factIdx >= 0 ? (
              <span className={`ml-3 inline-flex items-center px-2 py-0.5 text-[11px] border ${c?.chip}`}>
                Factura {factIdx + 1}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="text-white/80 hover:text-white text-xl leading-none p-2"
            onClick={onClose}
            aria-label="Cerrar vista grande"
          >
            ×
          </button>
        </div>

        {/* Imagen + flechas */}
        <div className="relative w-full flex items-center justify-center">
          <button
            type="button"
            className="absolute left-0 -translate-x-2 sm:-translate-x-12 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/15 hover:bg-white/30 text-white text-2xl rounded-none disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={onPrev}
            disabled={pageNum <= 1}
            aria-label="Página anterior"
            title="Página anterior (←)"
          >
            ‹
          </button>

          <div className="bg-white w-full max-h-[85vh] overflow-auto">
            {thumb ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={thumb}
                alt={`Página ${pageNum}`}
                className="block mx-auto max-w-full h-auto"
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div className="p-12 text-foreground-secondary text-sm text-center">
                Miniatura no disponible para esta página.
              </div>
            )}
          </div>

          <button
            type="button"
            className="absolute right-0 translate-x-2 sm:translate-x-12 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/15 hover:bg-white/30 text-white text-2xl rounded-none disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={onNext}
            disabled={pageNum >= total}
            aria-label="Página siguiente"
            title="Página siguiente (→)"
          >
            ›
          </button>
        </div>

        <p className="text-white/60 text-xs mt-3">
          Usa las flechas ← → del teclado para navegar entre páginas. Esc para cerrar.
        </p>
      </div>
    </div>
  );
}
