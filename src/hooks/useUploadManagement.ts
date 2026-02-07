import { useState, useCallback } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { SubidaFacturas } from '@/types/dashboard';

/**
 * Hook para gestionar subidas de facturas (CRUD completo)
 */
export function useUploadManagement() {
  const { showError, showSuccess } = useToast();
  const [subidasFacturas, setSubidasFacturas] = useState<SubidaFacturas[]>([]);
  const [subidaActual, setSubidaActual] = useState<SubidaFacturas | null>(null);
  const [isChoosingTipoSubida, setIsChoosingTipoSubida] = useState(false);
  const [subidaEditandoId, setSubidaEditandoId] = useState<string | null>(null);
  const [subidaEditandoNombre, setSubidaEditandoNombre] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [subidaParaEliminar, setSubidaParaEliminar] = useState<SubidaFacturas | null>(null);
  const [isDeletingUpload, setIsDeletingUpload] = useState(false);

  // Cargar subidas del cliente
  const loadUploadsForClient = useCallback(async (clienteId: string) => {
    try {
      const resp = await fetch(`/api/uploads?client_id=${encodeURIComponent(clienteId)}`);
      const data: unknown = await resp.json();
      if (!resp.ok) {
        const msg =
          typeof (data as { error?: unknown })?.error === 'string'
            ? (data as { error?: string }).error
            : 'Error cargando subidas';
        throw new Error(msg);
      }

      type UploadInvoiceApiRow = {
        id: string;
        status?: 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'error' | null;
        error_message?: string | null;
        original_filename: string | null;
        mime_type: string | null;
        file_size_bytes: number | null;
        bucket: string;
        storage_path: string;
        created_at: string;
      };

      type UploadApiRow = {
        id: string;
        client_id: string | null;
        tipo?: string | null;
        name: string;
        created_at: string;
        invoices?: UploadInvoiceApiRow[];
      };

      const uploads = Array.isArray((data as { uploads?: unknown })?.uploads)
        ? ((data as { uploads: unknown[] }).uploads as UploadApiRow[])
        : [];

      const mapped: SubidaFacturas[] = uploads.map((u, uIdx) => ({
        id: u.id || `${uIdx}`,
        uploadId: u.id || undefined,
        clienteId: u.client_id || clienteId,
        tipo: (String(u.tipo || '').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto') as
          | 'gasto'
          | 'ingreso',
        nombre: u.name || 'Subida',
        fechaCreacion: u.created_at || new Date().toISOString(),
        estado: 'pendiente',
        archivos: (u.invoices || []).map((inv, idx) => ({
          id: `${inv.id}-${idx}`,
          invoiceId: inv.id,
          nombre: inv.original_filename || 'factura',
          tamaño: Number(inv.file_size_bytes || 0),
          tipo: inv.mime_type || 'application/pdf',
          url: '',
          bucket: inv.bucket,
          storagePath: inv.storage_path,
          fechaSubida: inv.created_at,
          estado: 'procesado',
          dbStatus: typeof inv.status === 'string' ? inv.status : null,
          dbErrorMessage: typeof inv.error_message === 'string' ? inv.error_message : null,
        })),
      }));

      setSubidasFacturas(mapped);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error cargando subidas');
      setSubidasFacturas([]);
    }
  }, [showError]);

  // Generar nombre por defecto para subida
  const getNombreSubidaPorDefecto = () => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES');
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${fecha} ${hora}`;
  };

  // Crear nueva subida (solo UI, se persiste al subir primer archivo)
  const handleCrearSubida = useCallback((clienteId: string) => {
    if (!clienteId) return;
    setIsChoosingTipoSubida(true);
  }, []);

  // Crear subida con tipo específico
  const handleCrearSubidaConTipo = useCallback(
    (tipo: 'gasto' | 'ingreso', clienteId: string, onReset: () => void) => {
      if (!clienteId) return;

      // Reset estado de procesamiento (nueva subida)
      onReset();

      const nuevaSubida: SubidaFacturas = {
        id: Date.now().toString(),
        uploadId: undefined, // se creará en DB al subir la primera factura
        clienteId: clienteId,
        tipo,
        nombre: getNombreSubidaPorDefecto(),
        fechaCreacion: new Date().toISOString(),
        estado: 'pendiente',
        archivos: [],
      };

      setSubidasFacturas(prev => [...prev, nuevaSubida]);
      setSubidaActual(nuevaSubida);
      setIsChoosingTipoSubida(false);
    },
    []
  );

  // Deseleccionar subida actual
  const handleDeseleccionarSubida = useCallback(() => {
    setSubidaActual(null);
    setIsChoosingTipoSubida(false);
    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');
  }, []);

  // Guardar nombre de subida
  const handleGuardarNombreSubida = async (subidaId: string) => {
    const nuevoNombre = subidaEditandoNombre.trim();
    if (!nuevoNombre) {
      showError('El nombre no puede estar vacío');
      return;
    }

    const target = subidasFacturas.find((s) => s.id === subidaId) || null;
    const uploadIdReal = target?.uploadId || (subidaId && subidaId.length > 20 ? subidaId : null);
    const prevNombre = target?.nombre || '';

    // Optimista
    setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: nuevoNombre } : s)));
    if (subidaActual?.id === subidaId) {
      setSubidaActual((prev) => (prev ? { ...prev, nombre: nuevoNombre } : prev));
    }

    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');

    // Si aún no existe en BD (uploadId undefined), el cambio queda local hasta que se cree.
    if (!uploadIdReal) {
      showSuccess('Nombre de la subida actualizado');
      return;
    }

    try {
      const resp = await fetch(`/api/uploads/${encodeURIComponent(uploadIdReal)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nuevoNombre }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'Error actualizando subida');

      const serverName = typeof data?.upload?.name === 'string' ? data.upload.name : nuevoNombre;
      setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: serverName } : s)));
      if (subidaActual?.id === subidaId) {
        setSubidaActual((prev) => (prev ? { ...prev, nombre: serverName } : prev));
      }

      showSuccess('Nombre de la subida actualizado');
    } catch (e) {
      // rollback
      setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: prevNombre } : s)));
      if (subidaActual?.id === subidaId) {
        setSubidaActual((prev) => (prev ? { ...prev, nombre: prevNombre } : prev));
      }
      showError(e instanceof Error ? e.message : 'Error actualizando subida');
    }
  };

  // Seleccionar subida existente
  const handleSeleccionarSubida = useCallback((subida: SubidaFacturas, onSelect: (subida: SubidaFacturas) => void) => {
    setSubidaActual(subida);
    onSelect(subida);
  }, []);

  // Eliminar subida
  const handleEliminarSubida = useCallback(async (subida: SubidaFacturas) => {
    if (!subida.uploadId) {
      showError('Esta subida todavía no existe en el backend');
      return;
    }

    setSubidaParaEliminar(subida);
    setIsDeleteModalOpen(true);
  }, [showError]);

  // Confirmar eliminación de subida
  const handleConfirmEliminarSubida = useCallback(async (onRefresh: () => void) => {
    if (!subidaParaEliminar?.uploadId) {
      showError('No se pudo identificar la subida a eliminar');
      setIsDeleteModalOpen(false);
      setSubidaParaEliminar(null);
      return;
    }

    setIsDeletingUpload(true);

    try {
      const resp = await fetch(`/api/uploads/${subidaParaEliminar.uploadId}`, { method: 'DELETE' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Error eliminando la subida');

      setSubidasFacturas(prev => prev.filter(s => s.uploadId !== subidaParaEliminar.uploadId));
      if (subidaActual?.uploadId === subidaParaEliminar.uploadId) {
        setSubidaActual(null);
      }
      showSuccess('Subida eliminada');
      setIsDeleteModalOpen(false);
      setSubidaParaEliminar(null);
      onRefresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la subida');
    } finally {
      setIsDeletingUpload(false);
    }
  }, [showError, showSuccess, subidaActual, subidaParaEliminar]);

  return {
    subidasFacturas,
    setSubidasFacturas,
    subidaActual,
    setSubidaActual,
    isChoosingTipoSubida,
    setIsChoosingTipoSubida,
    subidaEditandoId,
    setSubidaEditandoId,
    subidaEditandoNombre,
    setSubidaEditandoNombre,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    subidaParaEliminar,
    isDeletingUpload,
    loadUploadsForClient,
    handleCrearSubida,
    handleCrearSubidaConTipo,
    handleDeseleccionarSubida,
    handleGuardarNombreSubida,
    handleSeleccionarSubida,
    handleEliminarSubida,
    handleConfirmEliminarSubida,
  };
}
