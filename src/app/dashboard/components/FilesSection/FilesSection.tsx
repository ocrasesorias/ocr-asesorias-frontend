'use client';

import { Cliente, SubidaFacturas, ArchivoSubido } from '@/types/dashboard';
import { CloudUpload } from '@/components/animate-ui/icons/cloud-upload';
import { Button } from '@/components/Button';
import { FileUpload } from '@/components/FileUpload';
import { UploadTypeSelector } from './UploadTypeSelector';
import { ProcessingStatus } from './ProcessingStatus';
import { ValidationButtons } from './ValidationButtons';

interface FilesSectionProps {
  clienteSeleccionado: Cliente | null;
  subidaActual: SubidaFacturas | null;
  isChoosingTipoSubida: boolean;
  archivosSubidos: ArchivoSubido[];
  extractStatusByInvoiceId: Record<string, 'idle' | 'processing' | 'ready' | 'error'>;
  statusMessage: string;
  dbCounts: {
    withDb: number;
    total: number;
    uploaded: number;
    processing: number;
    needsReview: number;
    ready: number;
    error: number;
  };
  readyCount: number;
  currentSessionInvoiceIds: string[];
  hasUploadingFiles: boolean;
  isAllReady: boolean;
  canValidate: boolean;
  onCrearSubida: () => void;
  onCrearSubidaConTipo: (tipo: 'gasto' | 'ingreso') => void;
  onCancelarTipoSubida: () => void;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onValidarFacturas: (view: 'pending' | 'all') => void;
  onDeseleccionarSubida: () => void;
}

export function FilesSection({
  clienteSeleccionado,
  subidaActual,
  isChoosingTipoSubida,
  archivosSubidos,
  extractStatusByInvoiceId,
  statusMessage,
  dbCounts,
  readyCount,
  currentSessionInvoiceIds,
  hasUploadingFiles,
  isAllReady,
  canValidate,
  onCrearSubida,
  onCrearSubidaConTipo,
  onCancelarTipoSubida,
  onFilesSelected,
  onRemoveFile,
  onValidarFacturas,
  onDeseleccionarSubida,
}: FilesSectionProps) {
  // Sin cliente seleccionado
  if (!clienteSeleccionado) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <svg
          className="w-16 h-16 text-foreground-secondary mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Selecciona un cliente
        </h3>
        <p className="text-foreground-secondary">
          Elige un cliente para comenzar a subir facturas
        </p>
      </div>
    );
  }

  // Sin subida seleccionada
  if (!subidaActual) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <p className="text-sm text-foreground-secondary">
            Cliente: {clienteSeleccionado.name}
          </p>
        </div>

        {!isChoosingTipoSubida ? (
          <div className="py-10 text-center">
            <div className="flex justify-center mb-4">
              <CloudUpload animateOnHover className="w-16 h-16 text-primary" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">
              Crea una nueva subida
            </h4>
            <p className="text-foreground-secondary mb-6">
              Empieza una nueva subida o selecciona una del histórico de la izquierda.
            </p>
            <Button
              variant="primary"
              onClick={onCrearSubida}
            >
              Crear nueva subida
            </Button>
          </div>
        ) : (
          <UploadTypeSelector
            onSelectTipo={onCrearSubidaConTipo}
            onCancel={onCancelarTipoSubida}
          />
        )}
      </div>
    );
  }

  // Con subida seleccionada
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-foreground mb-2 min-w-0 truncate">
            {subidaActual.nombre}
          </h3>
          <div className="shrink-0 flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                onDeseleccionarSubida();
                onCrearSubida();
              }}
            >
              Nueva subida
            </Button>
          </div>
        </div>
        <p className="text-sm text-foreground-secondaryç">
          Cliente: {clienteSeleccionado.name}
        </p>
        <p className="text-sm text-foreground-secondary">
          Tipo:{' '}
          <span className="font-medium text-foreground">
            {subidaActual.tipo === 'gasto' ? 'Gasto' : 'Ingreso'}
          </span>
        </p>
      </div>

      <FileUpload
        onFilesSelected={onFilesSelected}
        archivosSubidos={archivosSubidos}
        onRemoveFile={onRemoveFile}
        maxVisibleFiles={3}
        badgeForFile={(archivo) => {
          const invoiceId = archivo.invoiceId;
          if (!invoiceId) return null;

          const localSt = extractStatusByInvoiceId[invoiceId] || 'idle';
          const dbSt = archivo.dbStatus || null;

          const badgeKind:
            | 'uploaded'
            | 'processing'
            | 'needs_review'
            | 'ready'
            | 'error' =
            dbSt === 'ready'
              ? 'ready'
              : dbSt === 'error'
                ? 'error'
                : localSt === 'processing' || dbSt === 'processing'
                  ? 'processing'
                  : localSt === 'error'
                    ? 'error'
                    : dbSt === 'needs_review' || localSt === 'ready'
                      ? 'needs_review'
                      : dbSt === 'uploaded'
                        ? 'uploaded'
                        : 'uploaded';

          const cls =
            badgeKind === 'ready'
              ? 'bg-secondary-lighter text-secondary'
              : badgeKind === 'needs_review'
                ? 'bg-amber-100 text-amber-900'
                : badgeKind === 'processing'
                  ? 'bg-sky-100 text-sky-900'
                  : badgeKind === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-700';

          const label =
            badgeKind === 'ready'
              ? 'Validada'
              : badgeKind === 'needs_review'
                ? 'Por validar'
                : badgeKind === 'processing'
                  ? 'Procesando'
                  : badgeKind === 'error'
                    ? 'Error'
                    : 'En cola';

          return (
            <span
              className={`text-xs px-2 py-1 rounded-full ${cls}`}
              title={archivo.dbErrorMessage ? archivo.dbErrorMessage : undefined}
            >
              {label}
            </span>
          );
        }}
      />

      {archivosSubidos.length > 0 && (
        <div className="mt-6 space-y-3">
          <ProcessingStatus
            statusMessage={statusMessage}
            totalFiles={archivosSubidos.length}
            validatedCount={dbCounts.ready}
            needsReviewCount={dbCounts.needsReview}
            processingCount={dbCounts.processing}
            uploadedCount={dbCounts.uploaded}
            errorCount={dbCounts.error}
            readyCount={readyCount}
            showProgress={currentSessionInvoiceIds.length > 0 && archivosSubidos.length > 0}
          />
          <ValidationButtons
            canValidate={canValidate}
            hasUploadingFiles={hasUploadingFiles}
            isAllReady={isAllReady}
            readyCount={readyCount}
            totalFiles={archivosSubidos.length}
            isNewUpload={currentSessionInvoiceIds.length > 0}
            onValidate={onValidarFacturas}
          />
        </div>
      )}
    </div>
  );
}
