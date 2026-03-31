'use client';

import { formatMiles } from '@/utils/formatNumber';

interface ProcessingStatusProps {
  statusMessage: string;
  totalFiles: number;
  validatedCount: number;
  needsReviewCount: number;
  processingCount: number;
  uploadedCount: number;
  errorCount: number;
  readyCount: number;
  showProgress: boolean;
}

export function ProcessingStatus({
  totalFiles,
  validatedCount,
  needsReviewCount,
  processingCount,
  uploadedCount,
  errorCount,
  readyCount,
  showProgress,
}: ProcessingStatusProps) {
  const pct = totalFiles > 0 ? Math.round((readyCount / totalFiles) * 100) : 0;

  return (
    <div className="border border-[var(--l-card-border,#e5e7eb)] px-4 py-4 h-full flex flex-col justify-center" style={{ backgroundColor: 'var(--l-card, #ffffff)' }}>
      {/* Counter + stats in one row */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-lg font-bold text-foreground tabular-nums">
          {formatMiles(readyCount, 0)}<span className="text-foreground-secondary font-normal">/{formatMiles(totalFiles, 0)}</span>
        </span>
        <span className="text-foreground-secondary">Validadas <span className="font-semibold text-foreground">{formatMiles(validatedCount, 0)}</span></span>
        <span className="text-foreground-secondary">Pendientes <span className="font-semibold text-foreground">{formatMiles(needsReviewCount, 0)}</span></span>
        {processingCount > 0 && (
          <span className="text-foreground-secondary">Procesando <span className="font-semibold text-foreground">{formatMiles(processingCount, 0)}</span></span>
        )}
        {uploadedCount > 0 && (
          <span className="text-foreground-secondary">En cola <span className="font-semibold text-foreground">{formatMiles(uploadedCount, 0)}</span></span>
        )}
        {errorCount > 0 && (
          <span className="text-foreground-secondary">Error <span className="font-semibold text-error">{formatMiles(errorCount, 0)}</span></span>
        )}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full h-1 bg-gray-200 mt-2">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
