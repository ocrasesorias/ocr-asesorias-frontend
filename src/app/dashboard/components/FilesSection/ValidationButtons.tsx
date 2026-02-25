'use client';

import { Button } from '@/components/Button';
import { formatMiles } from '@/utils/formatNumber';

interface ValidationButtonsProps {
  canValidate: boolean;
  hasUploadingFiles: boolean;
  isAllReady: boolean;
  readyCount: number;
  totalFiles: number;
  isNewUpload: boolean;
  onValidate: (view: 'pending' | 'all') => void;
}

export function ValidationButtons({
  canValidate,
  hasUploadingFiles,
  isAllReady,
  readyCount,
  totalFiles,
  isNewUpload,
  onValidate,
}: ValidationButtonsProps) {
  return (
    <div className="flex justify-end gap-2">
      {!isNewUpload ? (
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={() => onValidate('all')}
            disabled={!canValidate}
          >
            Ver todas
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={() => onValidate('pending')}
            disabled={!canValidate}
          >
            Validar pendientes
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          size="lg"
          onClick={() => onValidate('all')}
          disabled={!canValidate}
          className="group"
        >
          <span className="inline-flex items-center justify-center gap-2 font-light">
            <span className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
              {hasUploadingFiles
                ? `Subiendo… (${formatMiles(readyCount, 0)}/${formatMiles(totalFiles, 0)})`
                : !isAllReady && readyCount === 0
                  ? `Procesando facturas… (${formatMiles(readyCount, 0)}/${formatMiles(totalFiles, 0)})`
                  : !isAllReady && readyCount > 0
                  ? `Validar procesadas (${formatMiles(readyCount, 0)}/${formatMiles(totalFiles, 0)})`
                  : 'Validar'}
            </span>
            {!hasUploadingFiles && (
              <svg
                className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </span>
        </Button>
      )}
    </div>
  );
}
