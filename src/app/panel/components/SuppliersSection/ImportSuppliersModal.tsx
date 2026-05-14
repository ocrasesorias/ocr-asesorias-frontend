'use client';

import { useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { useToast } from '@/contexts/ToastContext';

interface ImportSuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onImported: () => void;
}

type PreviewRow = {
  account_code: string | null;
  name: string;
  tax_id: string | null;
  city: string | null;
  province: string | null;
};

type ImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

export function ImportSuppliersModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  onImported,
}: ImportSuppliersModalProps) {
  const { showError, showSuccess } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<{ rows: PreviewRow[]; total: number; warnings: string[] } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setIsLoadingPreview(false);
    setIsImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    if (isImporting) return;
    reset();
    onClose();
  };

  const handleFile = async (selected: File) => {
    setFile(selected);
    setResult(null);
    setPreview(null);
    setIsLoadingPreview(true);
    try {
      const fd = new FormData();
      fd.append('file', selected);
      fd.append('client_id', clientId);
      fd.append('dry_run', 'true');
      const resp = await fetch('/api/suppliers/import', { method: 'POST', body: fd });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        showError(json?.error || 'No se pudo leer el archivo');
        setFile(null);
        return;
      }
      setPreview({
        rows: json.preview || [],
        total: json.total_rows || 0,
        warnings: json.warnings || [],
      });
    } catch (err) {
      console.error(err);
      showError('Error al procesar el archivo');
      setFile(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file) return;
    setIsImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('client_id', clientId);
      const resp = await fetch('/api/suppliers/import', { method: 'POST', body: fd });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        showError(json?.error || 'Error al importar');
        return;
      }
      setResult(json.summary as ImportResult);
      const summary = json.summary as ImportResult;
      showSuccess(`Importación completada: ${summary.inserted} nuevos, ${summary.updated} actualizados`);
      onImported();
    } catch (err) {
      console.error(err);
      showError('Error al importar proveedores');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="2xl" isDismissable={!isImporting}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span>Importar proveedores</span>
          <span className="text-xs font-normal text-foreground-secondary">
            Cliente: {clientName}
          </span>
        </ModalHeader>

        <ModalBody>
          {!result && (
            <>
              <p className="text-sm text-foreground-secondary">
                Sube un archivo Excel (<code>.xls</code> o <code>.xlsx</code>) con el listado de proveedores
                exportado de tu programa contable. Las columnas reconocidas son
                <strong> Código, Descripción, Domicilio, C.P., Población, Provincia, CIF</strong>.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) void handleFile(f);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-4 border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-[var(--l-card-border,#e5e7eb)] hover:border-primary/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xls,.xlsx,.ods,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                {file ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground-secondary mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Arrastra el archivo aquí o haz clic para seleccionarlo
                    </p>
                    <p className="text-xs text-foreground-secondary mt-1">
                      Máx. 5 MB · .xls, .xlsx, .ods
                    </p>
                  </div>
                )}
              </div>

              {isLoadingPreview && (
                <p className="mt-4 text-sm text-foreground-secondary">Leyendo archivo…</p>
              )}

              {preview && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Se importarán <strong>{preview.total}</strong> proveedores. Vista previa:
                  </p>
                  <div className="border border-[var(--l-card-border,#e5e7eb)] rounded-none overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--l-bg,#f9fafb)] text-foreground-secondary">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-semibold">Código</th>
                          <th className="text-left px-2 py-1.5 font-semibold">Nombre</th>
                          <th className="text-left px-2 py-1.5 font-semibold">CIF</th>
                          <th className="text-left px-2 py-1.5 font-semibold">Provincia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((r, i) => (
                          <tr key={i} className="border-t border-[var(--l-card-border,#e5e7eb)]">
                            <td className="px-2 py-1 font-mono">{r.account_code || '—'}</td>
                            <td className="px-2 py-1 truncate max-w-[200px]">{r.name}</td>
                            <td className="px-2 py-1 font-mono">{r.tax_id || '—'}</td>
                            <td className="px-2 py-1">{r.province || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.warnings.length > 0 && (
                    <div className="mt-2 text-xs text-amber-600">
                      {preview.warnings.map((w, i) => (
                        <p key={i}>⚠ {w}</p>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-foreground-secondary">
                    Los proveedores existentes se actualizarán (match por CIF, código o nombre).
                    Los nuevos se añadirán.
                  </p>
                </div>
              )}
            </>
          )}

          {result && (
            <div className="text-sm">
              <p className="font-medium text-foreground mb-3">Resultado de la importación:</p>
              <ul className="space-y-1">
                <li className="text-green-600">✓ {result.inserted} proveedores nuevos creados</li>
                <li className="text-blue-600">↻ {result.updated} proveedores actualizados</li>
                {result.skipped > 0 && (
                  <li className="text-foreground-secondary">— {result.skipped} ignorados</li>
                )}
                {result.errors.length > 0 && (
                  <li className="text-red-600">
                    ✗ {result.errors.length} errores
                  </li>
                )}
              </ul>
              {result.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-foreground-secondary">
                    Ver detalle de errores
                  </summary>
                  <ul className="mt-2 max-h-40 overflow-auto text-xs space-y-1">
                    {result.errors.slice(0, 50).map((e, i) => (
                      <li key={i}>
                        Fila {e.row}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {!result && (
            <>
              <Button variant="light" onPress={handleClose} isDisabled={isImporting}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={handleConfirmImport}
                isDisabled={!file || !preview || isImporting || isLoadingPreview}
                isLoading={isImporting}
              >
                {isImporting ? 'Importando…' : `Importar ${preview?.total || 0} proveedores`}
              </Button>
            </>
          )}
          {result && (
            <Button color="primary" onPress={handleClose}>
              Cerrar
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
