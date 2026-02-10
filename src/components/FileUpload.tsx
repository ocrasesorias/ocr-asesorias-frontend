'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { ArchivoSubido } from '@/types/dashboard';
import { formatMiles } from '@/utils/formatNumber';
import { CloudUpload } from './animate-ui/icons/cloud-upload';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  archivosSubidos: ArchivoSubido[];
  onRemoveFile: (fileId: string) => void;
  maxVisibleFiles?: number
  badgeForFile?: (archivo: ArchivoSubido) => React.ReactNode
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  archivosSubidos,
  onRemoveFile,
  maxVisibleFiles,
  badgeForFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [isSectionHovered, setIsSectionHovered] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalCount = archivosSubidos.length
  const visibleCount = maxVisibleFiles ? Math.max(1, maxVisibleFiles) : totalCount
  const isCollapsed = Boolean(maxVisibleFiles && totalCount > visibleCount && !showAll)
  const displayedFiles = useMemo(() => {
    if (!maxVisibleFiles) return archivosSubidos
    if (showAll) return archivosSubidos
    return archivosSubidos.slice(0, visibleCount)
  }, [archivosSubidos, maxVisibleFiles, showAll, visibleCount])

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseEnter={() => setIsSectionHovered(true)}
        onMouseLeave={() => setIsSectionHovered(false)}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging 
            ? 'border-primary bg-primary-lighter' 
            : 'border-gray-200 hover:border-primary hover:bg-gray-50'
          }
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept=".pdf,image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <div className="flex justify-center mb-4">
              <CloudUpload animate={isSectionHovered} className="w-16 h-16 text-primary" />
            </div>
          <p className="text-lg font-medium text-foreground mb-2">
            Arrastra archivos aquí o haz clic para seleccionar
          </p>
          <p className="text-sm text-foreground-secondary">
            PDF o imágenes
          </p>
        </label>
      </div>

      {/* Lista de archivos subidos */}
      {archivosSubidos.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-foreground">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-foreground">
              Facturas ({formatMiles(totalCount, 0)})
            </h3>
            {maxVisibleFiles && totalCount > visibleCount && (
              <button
                type="button"
                className="text-xs text-primary hover:text-primary-hover font-medium"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Ver menos' : `Ver todas (${formatMiles(totalCount, 0)})`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {displayedFiles.map((archivo) => (
              <div
                key={archivo.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="shrink-0">
                    {archivo.tipo === 'application/pdf' ? (
                      <svg
                        className="w-6 h-6 text-red-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-6 h-6 text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {archivo.nombre}
                    </p>
                    <p className="text-xs text-foreground-secondary">
                      {formatFileSize(archivo.tamaño)}
                    </p>
                  </div>
                  {badgeForFile ? <div className="shrink-0">{badgeForFile(archivo)}</div> : null}
                </div>
                <button
                  onClick={() => onRemoveFile(archivo.id)}
                  className="ml-3 shrink-0 text-red-500 hover:text-red-700 transition-colors"
                  type="button"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {isCollapsed && (
            <div className="mt-3 text-xs text-foreground-secondary">
              Mostrando {formatMiles(displayedFiles.length, 0)} de {formatMiles(totalCount, 0)}. Hay más facturas procesándose…
            </div>
          )}
        </div>
      )}
    </div>
  );
};

