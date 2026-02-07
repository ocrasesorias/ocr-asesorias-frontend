'use client';

import { Button } from '@/components/Button';

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
        >
          <span className="inline-flex items-center justify-center gap-2 font-light">
            {hasUploadingFiles
              ? `Subiendo… (${readyCount}/${totalFiles})`
                : !isAllReady
                  ? `Procesando facturas… (${readyCount}/${totalFiles})`
                  : 'Validar'}
            {!hasUploadingFiles && (
              <svg
                className="w-5 h-5"
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
