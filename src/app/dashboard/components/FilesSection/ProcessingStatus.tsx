'use client';

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
  statusMessage,
  totalFiles,
  validatedCount,
  needsReviewCount,
  processingCount,
  uploadedCount,
  errorCount,
  readyCount,
  showProgress,
}: ProcessingStatusProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-foreground-secondary">
      <div className="font-medium text-foreground">{statusMessage}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          Total: <span className="font-semibold text-foreground">{totalFiles}</span>
        </span>
        <span>
          Validadas:{' '}
          <span className="font-semibold text-foreground">
            {validatedCount}
          </span>
          {' '}· Por validar:{' '}
          <span className="font-semibold text-foreground">
            {needsReviewCount}
          </span>
          {processingCount > 0 ? (
            <>
              {' '}
              · Procesando:{' '}
              <span className="font-semibold text-foreground">{processingCount}</span>
            </>
          ) : null}
          {uploadedCount > 0 ? (
            <>
              {' '}
              · En cola:{' '}
              <span className="font-semibold text-foreground">{uploadedCount}</span>
            </>
          ) : null}
          {errorCount > 0 ? (
            <>
              {' '}
              · Error: <span className="font-semibold text-foreground">{errorCount}</span>
            </>
          ) : null}
        </span>
        {showProgress ? (
          <span>
            Progreso: <span className="font-semibold text-foreground">{readyCount}</span>/
            <span className="font-semibold text-foreground">{totalFiles}</span> listas
          </span>
        ) : null}
      </div>
    </div>
  );
}
