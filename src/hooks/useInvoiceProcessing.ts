import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { ArchivoSubido, SubidaFacturas } from '@/types/dashboard';

/** Máximo de extracts en paralelo (frontend); al completar uno se lanza el siguiente */
const MAX_EXTRACT_CONCURRENCY = 5;

/**
 * Hook para gestionar el procesamiento de facturas (upload, OCR/IA, validación)
 */
export function useInvoiceProcessing() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [archivosSubidos, setArchivosSubidos] = useState<ArchivoSubido[]>([]);
  const [isDeleteInvoiceModalOpen, setIsDeleteInvoiceModalOpen] = useState(false);
  const [facturaParaEliminar, setFacturaParaEliminar] = useState<ArchivoSubido | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  // Estado de procesamiento OCR/IA
  const [extractStatusByInvoiceId, setExtractStatusByInvoiceId] = useState<
    Record<string, 'idle' | 'processing' | 'ready' | 'error'>
  >({});
  const [sessionInvoiceIds, setSessionInvoiceIds] = useState<string[]>([]);
  const extractInFlightRef = useRef(0);
  const extractStartedRef = useRef<Record<string, true>>({});

  // Estado de mensajes dinámicos
  const [statusMessageTick, setStatusMessageTick] = useState(0);

  // Cálculos derivados
  const hasUploadingFiles = archivosSubidos.some((a) => a.estado === 'procesando' || a.estado === 'pendiente');

  const invoiceIdsInOrder = useMemo(
    () => archivosSubidos.map((a) => a.invoiceId).filter((id): id is string => Boolean(id)),
    [archivosSubidos]
  );

  const sessionIdSet = useMemo(() => new Set(sessionInvoiceIds), [sessionInvoiceIds]);
  const currentSessionInvoiceIds = useMemo(() => {
    return invoiceIdsInOrder.filter((id) => sessionIdSet.has(id));
  }, [invoiceIdsInOrder, sessionIdSet]);

  const activeInvoiceIds = useMemo(
    () => (currentSessionInvoiceIds.length > 0 ? currentSessionInvoiceIds : invoiceIdsInOrder),
    [currentSessionInvoiceIds, invoiceIdsInOrder]
  );

  const isAllReady = useMemo(() => {
    if (activeInvoiceIds.length === 0) return false;
    return activeInvoiceIds.every((id) => {
      const st = extractStatusByInvoiceId[id];
      return st === 'ready' || st === 'error';
    });
  }, [activeInvoiceIds, extractStatusByInvoiceId]);

  const processingCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'processing').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  );
  const readyCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'ready').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  );
  const errorCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'error').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  );

  const dbCounts = useMemo(() => {
    let uploaded = 0;
    let processing = 0;
    let needsReview = 0;
    let ready = 0;
    let error = 0;
    let withDb = 0;

    for (const a of archivosSubidos) {
      if (!a.invoiceId) continue;
      if (a.dbStatus) withDb += 1;
      if (a.dbStatus === 'uploaded') uploaded += 1;
      else if (a.dbStatus === 'processing') processing += 1;
      else if (a.dbStatus === 'needs_review') needsReview += 1;
      else if (a.dbStatus === 'ready') ready += 1;
      else if (a.dbStatus === 'error') error += 1;
    }

    const total = archivosSubidos.filter((a) => Boolean(a.invoiceId)).length;
    return { withDb, total, uploaded, processing, needsReview, ready, error };
  }, [archivosSubidos]);

  const hasAnyExtractionWork = processingCount > 0 || readyCount > 0 || errorCount > 0;

  const dynamicMessages = useMemo(() => {
    const total = archivosSubidos.length;
    const uploaded = invoiceIdsInOrder.length;

    const msgs: string[] = [];
    if (hasUploadingFiles) {
      msgs.push(`Subiendo facturas… (${uploaded}/${total})`);
    }

    // Subida histórica (sin session: ya cargada de antes)
    if (!hasUploadingFiles && currentSessionInvoiceIds.length === 0 && dbCounts.withDb > 0) {
      if (dbCounts.processing > 0) {
        msgs.push(`Procesando facturas… (${dbCounts.processing} en curso)`);
      } else if (dbCounts.uploaded > 0) {
        msgs.push(`${dbCounts.uploaded} factura${dbCounts.uploaded !== 1 ? 's' : ''} pendientes de procesar.`);
      } else if (dbCounts.needsReview > 0) {
        msgs.push(`Tienes ${dbCounts.needsReview} factura${dbCounts.needsReview !== 1 ? 's' : ''} por validar.`);
      } else if (dbCounts.ready > 0 && dbCounts.error === 0) {
        msgs.push('Subida completada. Todas las facturas están validadas.');
      }
      if (dbCounts.error > 0) {
        msgs.push('Hay facturas con error. Puedes eliminarlas o reintentar desde validar.');
      }
      if (msgs.length === 0) msgs.push('Subida cargada. Puedes continuar validando.');
      return msgs;
    }

    if (uploaded > 0 && !isAllReady) {
      msgs.push(`Procesando… (${readyCount + errorCount}/${uploaded} listas). Máx. 5 en paralelo.`);
    }
    if (!hasUploadingFiles && uploaded > 0 && isAllReady) {
      msgs.push('¡Todo listo! Ya puedes empezar a validar.');
    }
    if (errorCount > 0) {
      msgs.push('Algunas facturas fallaron al procesarse.');
    }
    if (msgs.length === 0) {
      msgs.push('Sube tus facturas para empezar.');
    }
    return msgs;
  }, [
    archivosSubidos.length,
    dbCounts,
    errorCount,
    isAllReady,
    readyCount,
    hasUploadingFiles,
    invoiceIdsInOrder.length,
    currentSessionInvoiceIds.length,
  ]);

  const statusMessage = dynamicMessages[statusMessageTick % dynamicMessages.length];

  // Solo permitir validar cuando hay al menos una factura lista y no hay subidas en curso
  const canValidate = useMemo(() => {
    return (
      archivosSubidos.length > 0 &&
      !hasUploadingFiles &&
      (currentSessionInvoiceIds.length === 0 || readyCount > 0 || isAllReady)
    );
  }, [archivosSubidos.length, hasUploadingFiles, currentSessionInvoiceIds.length, readyCount, isAllReady]);

  // Rotar mensajes cada 2.5s
  useEffect(() => {
    if (!hasUploadingFiles && !hasAnyExtractionWork) return;
    const id = window.setInterval(() => setStatusMessageTick((t) => t + 1), 2500);
    return () => window.clearInterval(id);
  }, [hasUploadingFiles, hasAnyExtractionWork]);

  // Iniciar extracción de una factura
  const startExtract = useCallback(
    async (invoiceId: string, setSubidasFacturas: React.Dispatch<React.SetStateAction<SubidaFacturas[]>>, setSubidaActual: React.Dispatch<React.SetStateAction<SubidaFacturas | null>>) => {
      if (extractStartedRef.current[invoiceId]) return;
      extractStartedRef.current[invoiceId] = true;

      setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'processing' }));
      setArchivosSubidos((prev) =>
        prev.map((a) =>
          a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a
        )
      );
      setSubidasFacturas((prev) =>
        prev.map((s) =>
          s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a)) }
            : s
        )
      );
      setSubidaActual((prev) =>
        prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
          ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a)) }
          : prev
      );
      extractInFlightRef.current += 1;
      try {
        const r = await fetch(`/api/invoices/${invoiceId}/extract`, { method: 'POST' });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error || 'Error procesando factura');
        setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'ready' }));
        setArchivosSubidos((prev) =>
          prev.map((a) =>
            a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a
          )
        );
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
              ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a)) }
              : s
          )
        );
        setSubidaActual((prev) =>
          prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a)) }
            : prev
        );
      } catch {
        setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'error' }));
        setArchivosSubidos((prev) =>
          prev.map((a) =>
            a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a
          )
        );
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
              ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a)) }
              : s
          )
        );
        setSubidaActual((prev) =>
          prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a)) }
            : prev
        );
      } finally {
        extractInFlightRef.current -= 1;
      }
    },
    []
  );

  // Lanzar hasta 5 extracts en paralelo; al completar uno el efecto re-ejecuta y lanza el siguiente
  const pumpExtractQueue = useCallback((setSubidasFacturas: React.Dispatch<React.SetStateAction<SubidaFacturas[]>>, setSubidaActual: React.Dispatch<React.SetStateAction<SubidaFacturas | null>>) => {
    if (extractInFlightRef.current >= MAX_EXTRACT_CONCURRENCY) return;
    for (const invoiceId of sessionInvoiceIds) {
      if (extractInFlightRef.current >= MAX_EXTRACT_CONCURRENCY) break;
      const st = extractStatusByInvoiceId[invoiceId] || 'idle';
      if (st === 'idle') void startExtract(invoiceId, setSubidasFacturas, setSubidaActual);
    }
  }, [extractStatusByInvoiceId, sessionInvoiceIds, startExtract]);

  // Manejar subida de archivos
  const handleFilesSelected = useCallback(async (
    files: File[],
    subidaActual: SubidaFacturas | null,
    clienteId: string,
    setSubidasFacturas: React.Dispatch<React.SetStateAction<SubidaFacturas[]>>,
    setSubidaActual: React.Dispatch<React.SetStateAction<SubidaFacturas | null>>,
    onRefresh: () => void
  ) => {
    if (!subidaActual) {
      showError('Por favor, crea o selecciona una subida primero');
      return;
    }
    if (!clienteId) {
      showError('Selecciona un cliente antes de subir facturas');
      return;
    }

    // Asegurar que existe un upload real en DB
    let realUploadId = subidaActual.uploadId;
    let createdNow = false;
    if (!realUploadId) {
      try {
        const resp = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: subidaActual.nombre,
            client_id: clienteId,
            tipo: subidaActual.tipo,
          }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || 'No se pudo crear la subida');
        realUploadId = data.upload.id;
        createdNow = true;

        setSubidasFacturas(prev =>
          prev.map(s => (s.id === subidaActual.id ? { ...s, id: realUploadId!, uploadId: realUploadId! } : s))
        );
        setSubidaActual(prev => (prev ? { ...prev, id: realUploadId!, uploadId: realUploadId! } : prev));
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Error creando la subida');
        return;
      }
    }

    // Crear placeholders
    const placeholders: ArchivoSubido[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      nombre: file.name,
      tamaño: file.size,
      tipo: file.type,
      url: '',
      fechaSubida: new Date().toISOString(),
      estado: 'procesando',
    }));

    const archivosConPlaceholders = [...archivosSubidos, ...placeholders];
    setArchivosSubidos(archivosConPlaceholders);
    setSubidasFacturas(prev =>
      prev.map(s => (s.id === subidaActual.id ? { ...s, archivos: archivosConPlaceholders } : s))
    );
    setSubidaActual(prev => (prev ? { ...prev, archivos: archivosConPlaceholders } : null));

    // Subir archivos en paralelo (todas a la vez)
    const uploadOne = async (file: File, index: number): Promise<string | null> => {
      const placeholderId = placeholders[index].id;
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('client_id', clienteId);
        fd.append('upload_id', realUploadId!);
        fd.append('tipo', String(subidaActual.tipo).toUpperCase());

        const resp = await fetch('/api/invoices/upload', { method: 'POST', body: fd });
        const data = await resp.json();

        if (!resp.ok) {
          throw new Error(data?.error || 'Error subiendo la factura');
        }
        if (data?.success === false) {
          throw new Error(data?.error || 'Error procesando la factura');
        }

        const invoice = data.invoice;
        let url = data.previewUrl || '';
        if (!url && invoice?.id) {
          try {
            const r2 = await fetch(`/api/invoices/${invoice.id}/preview?expires=${60 * 60 * 24 * 7}`);
            const j2 = await r2.json();
            if (r2.ok && j2?.signedUrl) url = j2.signedUrl;
          } catch {
            // noop
          }
        }

        const statusRaw = typeof invoice?.status === 'string' ? String(invoice.status) : null;
        const dbStatus: ArchivoSubido['dbStatus'] =
          statusRaw === 'uploaded' ||
          statusRaw === 'processing' ||
          statusRaw === 'needs_review' ||
          statusRaw === 'ready' ||
          statusRaw === 'error'
            ? statusRaw
            : 'uploaded';

        const nextArchivo: ArchivoSubido = {
          id: placeholderId,
          invoiceId: invoice.id,
          nombre: invoice.original_filename || file.name,
          tamaño: Number(invoice.file_size_bytes || file.size),
          tipo:
            invoice.mime_type ||
            file.type ||
            (String(invoice.original_filename || file.name).toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'application/octet-stream'),
          url,
          bucket: invoice.bucket || 'invoices',
          storagePath: invoice.storage_path,
          fechaSubida: invoice.created_at || new Date().toISOString(),
          estado: 'procesado',
          dbStatus,
          dbErrorMessage: typeof invoice.error_message === 'string' ? invoice.error_message : null,
        };

        setArchivosSubidos(prev => {
          const merged = prev.map(a => (a.id === placeholderId ? nextArchivo : a));
          setSubidasFacturas(sPrev => sPrev.map(s => (s.uploadId === realUploadId ? { ...s, archivos: merged } : s)));
          setSubidaActual(sPrev => (sPrev ? { ...sPrev, archivos: merged } : null));
          return merged;
        });
        return invoice.id;
      } catch (e) {
        const nextArchivo: ArchivoSubido = { ...placeholders[index], estado: 'error', url: '' };
        setArchivosSubidos(prev => {
          const merged = prev.map(a => (a.id === placeholderId ? nextArchivo : a));
          setSubidasFacturas(sPrev => sPrev.map(s => (s.uploadId === realUploadId ? { ...s, archivos: merged } : s)));
          setSubidaActual(sPrev => (sPrev ? { ...sPrev, archivos: merged } : null));
          return merged;
        });
        showError(e instanceof Error ? e.message : 'Error subiendo la factura');
        return null;
      }
    };

    const results = await Promise.allSettled(files.map((file, i) => uploadOne(file, i)));
    const successfulInvoiceIds = results
      .filter((r): r is PromiseFulfilledResult<string | null> => r.status === 'fulfilled' && r.value != null)
      .map(r => r.value as string);
    const successCount = successfulInvoiceIds.length;

    // Encolar extracción
    if (successfulInvoiceIds.length > 0) {
      setExtractStatusByInvoiceId(prev => {
        const next = { ...prev };
        for (const id of successfulInvoiceIds) {
          next[id] = next[id] || 'idle';
        }
        return next;
      });
      setSessionInvoiceIds(prev => {
        const next = [...prev];
        for (const id of successfulInvoiceIds) {
          if (!next.includes(id)) next.push(id);
        }
        return next;
      });
    }

    if (successCount > 0) {
      onRefresh();
    }

    // Si no se subió nada y acabamos de crear la subida, borrarla
    if (createdNow && successCount === 0 && realUploadId) {
      try {
        await fetch(`/api/uploads/${realUploadId}`, { method: 'DELETE' });
      } catch {
        // noop
      }

      setSubidaActual(null);
      setArchivosSubidos([]);
      setSubidasFacturas(prev => prev.filter(s => s.uploadId !== realUploadId));
      return;
    }
  }, [archivosSubidos, showError]);

  // Eliminar factura
  const handleRemoveFile = useCallback(async (fileId: string) => {
    const fileToRemove = archivosSubidos.find((f) => f.id === fileId) || null;
    if (!fileToRemove) return;

    setFacturaParaEliminar(fileToRemove);
    setIsDeleteInvoiceModalOpen(true);
  }, [archivosSubidos]);

  const handleConfirmEliminarFactura = useCallback(async (
    subidaActual: SubidaFacturas | null,
    setSubidasFacturas: React.Dispatch<React.SetStateAction<SubidaFacturas[]>>,
    setSubidaActual: React.Dispatch<React.SetStateAction<SubidaFacturas | null>>,
    onRefresh: () => void
  ) => {
    if (!facturaParaEliminar) {
      setIsDeleteInvoiceModalOpen(false);
      return;
    }

    setIsDeletingInvoice(true);
    try {
      if (facturaParaEliminar.invoiceId) {
        const resp = await fetch(`/api/invoices/${facturaParaEliminar.invoiceId}`, { method: 'DELETE' });
        const data = await resp.json().catch(() => null);
        if (!resp.ok) throw new Error(data?.error || 'Error eliminando la factura');
      }

      const archivosActualizados = archivosSubidos.filter((f) => f.id !== facturaParaEliminar.id);
      setArchivosSubidos(archivosActualizados);

      if (subidaActual) {
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.id === subidaActual.id ? { ...s, archivos: archivosActualizados } : s
          )
        );
        setSubidaActual((prev) => (prev ? { ...prev, archivos: archivosActualizados } : null));
      }

      showSuccess('Factura eliminada');
      setIsDeleteInvoiceModalOpen(false);
      setFacturaParaEliminar(null);
      onRefresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la factura');
    } finally {
      setIsDeletingInvoice(false);
    }
  }, [archivosSubidos, facturaParaEliminar, showError, showSuccess]);

  // Ir a validar
  const handleValidarFacturas = useCallback((
    view: 'pending' | 'all',
    subidaActual: SubidaFacturas | null
  ) => {
    if (!subidaActual || archivosSubidos.length === 0) {
      showError('Por favor, sube al menos un archivo antes de validar');
      return;
    }
    if (!subidaActual.uploadId) {
      showError('La subida aún no está guardada. Sube al menos una factura primero.');
      return;
    }

    if (hasUploadingFiles) {
      showError('Espera a que terminen de subirse las facturas para empezar a validar.');
      return;
    }
    if (!canValidate) {
      const total = archivosSubidos.filter((a) => a.invoiceId).length;
      showError(`Espera a que al menos una factura esté procesada (${readyCount + errorCount}/${total} listas).`);
      return;
    }

    try {
      sessionStorage.setItem(`upload:${subidaActual.uploadId}:tipo`, subidaActual.tipo);
    } catch {
      // noop
    }

    router.push(
      `/dashboard/uploads/${subidaActual.uploadId}/validar?tipo=${encodeURIComponent(subidaActual.tipo)}&view=${encodeURIComponent(view)}`
    );
  }, [archivosSubidos, router, showError, hasUploadingFiles, canValidate, readyCount, errorCount]);

  // Reset de estado al cambiar de cliente/subida
  const resetProcessingState = useCallback(() => {
    setArchivosSubidos([]);
    setExtractStatusByInvoiceId({});
    setSessionInvoiceIds([]);
    extractStartedRef.current = {};
    extractInFlightRef.current = 0;
    setStatusMessageTick(0);
  }, []);

  // Sincronizar estado al seleccionar subida existente (incl. IDs para que el pump lance extracts)
  const syncProcessingStateForUpload = useCallback((subida: SubidaFacturas) => {
    setArchivosSubidos(subida.archivos);
    const idsInOrder: string[] = [];
    const nextExtract: Record<string, 'idle' | 'processing' | 'ready' | 'error'> = {};
    for (const a of subida.archivos) {
      if (!a.invoiceId) continue;
      idsInOrder.push(a.invoiceId);
      const st = a.dbStatus || null;
      nextExtract[a.invoiceId] =
        st === 'processing'
          ? 'processing'
          : st === 'error'
            ? 'error'
            : st === 'needs_review' || st === 'ready'
              ? 'ready'
              : 'idle';
    }
    setExtractStatusByInvoiceId((prev) => ({ ...prev, ...nextExtract }));
    setSessionInvoiceIds(idsInOrder);
    setStatusMessageTick(0);
  }, []);

  return {
    archivosSubidos,
    extractStatusByInvoiceId,
    sessionInvoiceIds,
    hasUploadingFiles,
    invoiceIdsInOrder,
    currentSessionInvoiceIds,
    isAllReady,
    readyCount,
    dbCounts,
    statusMessage,
    canValidate,
    isDeleteInvoiceModalOpen,
    setIsDeleteInvoiceModalOpen,
    facturaParaEliminar,
    isDeletingInvoice,
    handleFilesSelected,
    handleRemoveFile,
    handleConfirmEliminarFactura,
    handleValidarFacturas,
    resetProcessingState,
    syncProcessingStateForUpload,
    pumpExtractQueue,
  };
}
