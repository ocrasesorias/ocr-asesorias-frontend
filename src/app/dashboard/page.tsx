'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Cliente, SubidaFacturas, ArchivoSubido } from '@/types/dashboard';
import { FileUpload } from '@/components/FileUpload';
import { Button } from '@/components/Button';
import Link from 'next/link';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { ClientSelect } from '@/components/ClientSelect';
// (Preferencias) import mantenido por navegación; no usamos el loader aquí.

export default function DashboardPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [organizationName, setOrganizationName] = useState<string>('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [facturasGastadasOrgCount, setFacturasGastadasOrgCount] = useState<number | null>(null)
  const [isLoadingFacturasGastadasOrgCount, setIsLoadingFacturasGastadasOrgCount] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [subidasFacturas, setSubidasFacturas] = useState<SubidaFacturas[]>([]);
  const [subidaActual, setSubidaActual] = useState<SubidaFacturas | null>(null);
  const [archivosSubidos, setArchivosSubidos] = useState<ArchivoSubido[]>([]);
  const [isChoosingTipoSubida, setIsChoosingTipoSubida] = useState(false);
  const [subidaEditandoId, setSubidaEditandoId] = useState<string | null>(null);
  const [subidaEditandoNombre, setSubidaEditandoNombre] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    name: '',
    tax_id: '',
    preferred_income_account: '700',
    preferred_expense_account: '600',
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [subidaParaEliminar, setSubidaParaEliminar] = useState<SubidaFacturas | null>(null)
  const [isDeletingUpload, setIsDeletingUpload] = useState(false)
  const [isDeleteInvoiceModalOpen, setIsDeleteInvoiceModalOpen] = useState(false)
  const [facturaParaEliminar, setFacturaParaEliminar] = useState<ArchivoSubido | null>(null)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false)
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false)
  const [clientParaEditar, setClientParaEditar] = useState<Cliente | null>(null)
  const [clientParaEliminar, setClientParaEliminar] = useState<Cliente | null>(null)
  const [isUpdatingClient, setIsUpdatingClient] = useState(false)
  const [isDeletingClient, setIsDeletingClient] = useState(false)
  const [editCliente, setEditCliente] = useState({
    name: '',
    tax_id: '',
    preferred_income_account: '700',
    preferred_expense_account: '600',
  })
  // Procesamiento OCR/IA en dashboard (cola 3 en paralelo)
  const [extractStatusByInvoiceId, setExtractStatusByInvoiceId] = useState<
    Record<string, 'idle' | 'processing' | 'ready' | 'error'>
  >({})
  const [sessionInvoiceIds, setSessionInvoiceIds] = useState<string[]>([])
  const extractInFlightRef = useRef(0)
  const extractStartedRef = useRef<Record<string, true>>({})
  const MAX_EXTRACT_CONCURRENCY = 3
  const BLOCK_SIZE = 6

  const [statusMessageTick, setStatusMessageTick] = useState(0)

  const hasUploadingFiles = archivosSubidos.some((a) => a.estado === 'procesando' || a.estado === 'pendiente')

  const refreshFacturasGastadasOrgCount = useCallback(async () => {
    if (!orgId) return
    setIsLoadingFacturasGastadasOrgCount(true)
    try {
      const supabase = createClient()
      const { count, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)

      if (error) throw new Error(error.message || 'Error contando facturas')
      setFacturasGastadasOrgCount(typeof count === 'number' ? count : 0)
    } catch {
      // Mejor no spamear toasts aquí. Mostramos "—" y seguimos.
      setFacturasGastadasOrgCount(null)
    } finally {
      setIsLoadingFacturasGastadasOrgCount(false)
    }
  }, [orgId])

  useEffect(() => {
    void refreshFacturasGastadasOrgCount()
  }, [refreshFacturasGastadasOrgCount])

  const invoiceIdsInOrder = useMemo(
    () => archivosSubidos.map((a) => a.invoiceId).filter((id): id is string => Boolean(id)),
    [archivosSubidos]
  )

  const sessionIdSet = useMemo(() => new Set(sessionInvoiceIds), [sessionInvoiceIds])
  const currentSessionInvoiceIds = useMemo(() => {
    // Solo los invoiceIds "de esta subida" que se han subido en esta sesión (para colas/mensajes)
    return invoiceIdsInOrder.filter((id) => sessionIdSet.has(id))
  }, [invoiceIdsInOrder, sessionIdSet])

  const activeInvoiceIds = useMemo(
    () => (currentSessionInvoiceIds.length > 0 ? currentSessionInvoiceIds : invoiceIdsInOrder),
    [currentSessionInvoiceIds, invoiceIdsInOrder]
  )

  const firstBlockIds = useMemo(() => activeInvoiceIds.slice(0, BLOCK_SIZE), [activeInvoiceIds, BLOCK_SIZE])
  const requiredFirstCount = useMemo(() => Math.min(BLOCK_SIZE, activeInvoiceIds.length), [activeInvoiceIds.length, BLOCK_SIZE])
  const firstBlockReadyCount = useMemo(() => {
    const ids = firstBlockIds.slice(0, requiredFirstCount)
    return ids.filter((id) => extractStatusByInvoiceId[id] === 'ready').length
  }, [firstBlockIds, requiredFirstCount, extractStatusByInvoiceId])

  const canValidate =
    !!subidaActual?.uploadId &&
    archivosSubidos.length > 0 &&
    !archivosSubidos.some((a) => a.estado === 'error') &&
    !hasUploadingFiles &&
    requiredFirstCount > 0 &&
    // si es una subida antigua (no se subió en esta sesión), dejamos entrar y que valide procese allí
    (currentSessionInvoiceIds.length === 0 || firstBlockReadyCount >= requiredFirstCount)

  const processingCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'processing').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  )
  const readyCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'ready').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  )
  const errorCount = useMemo(
    () => invoiceIdsInOrder.filter((id) => extractStatusByInvoiceId[id] === 'error').length,
    [extractStatusByInvoiceId, invoiceIdsInOrder]
  )

  const dbCounts = useMemo(() => {
    let uploaded = 0
    let processing = 0
    let needsReview = 0
    let ready = 0
    let error = 0
    let withDb = 0

    for (const a of archivosSubidos) {
      if (!a.invoiceId) continue
      if (a.dbStatus) withDb += 1
      if (a.dbStatus === 'uploaded') uploaded += 1
      else if (a.dbStatus === 'processing') processing += 1
      else if (a.dbStatus === 'needs_review') needsReview += 1
      else if (a.dbStatus === 'ready') ready += 1
      else if (a.dbStatus === 'error') error += 1
    }

    const total = archivosSubidos.filter((a) => Boolean(a.invoiceId)).length
    return { withDb, total, uploaded, processing, needsReview, ready, error }
  }, [archivosSubidos])

  const hasAnyExtractionWork = processingCount > 0 || readyCount > 0 || errorCount > 0

  const dynamicMessages = useMemo(() => {
    const total = archivosSubidos.length
    const uploaded = invoiceIdsInOrder.length
    const need = Math.min(BLOCK_SIZE, total)
    const isSmallUpload = total > 0 && total <= BLOCK_SIZE

    const msgs: string[] = []
    if (hasUploadingFiles) {
      msgs.push(`Subiendo facturas… (${uploaded}/${total})`)
    }

    // Subida histórica: no mostramos mensajes de “Procesando…” si no hay procesamiento real.
    if (!hasUploadingFiles && currentSessionInvoiceIds.length === 0 && dbCounts.withDb > 0) {
      if (dbCounts.processing > 0) {
        msgs.push(`Procesando facturas… (${dbCounts.processing} en curso)`)
      } else if (dbCounts.uploaded > 0) {
        msgs.push(`Hay facturas en cola (${dbCounts.uploaded}). Entra a validar para procesarlas.`)
      } else if (dbCounts.needsReview > 0) {
        msgs.push(`Tienes ${dbCounts.needsReview} factura${dbCounts.needsReview !== 1 ? 's' : ''} por validar.`)
      } else if (dbCounts.ready > 0 && dbCounts.error === 0) {
        msgs.push('Subida completada. Todas las facturas están validadas.')
      }
      if (dbCounts.error > 0) {
        msgs.push('Hay facturas con error. Puedes eliminarlas o reintentar desde validar.')
      }
      if (msgs.length === 0) msgs.push('Subida cargada. Puedes continuar validando.')
      return msgs
    }

    if (uploaded > 0 && firstBlockReadyCount < Math.min(BLOCK_SIZE, uploaded)) {
      msgs.push(isSmallUpload ? 'Procesando facturas…' : `Procesando las primeras ${Math.min(BLOCK_SIZE, uploaded)} para empezar a validar…`)
    }
    if (!hasUploadingFiles && uploaded >= need && firstBlockReadyCount >= need) {
      msgs.push(isSmallUpload ? 'Ya puedes empezar a validar.' : 'Ya puedes empezar a validar. Seguimos procesando el resto en segundo plano.')
    }
    if (errorCount > 0) {
      msgs.push('Algunas facturas fallaron al procesarse. Puedes eliminarlas o reintentar.')
    }
    if (msgs.length === 0) {
      msgs.push('Sube tus facturas para empezar.')
    }
    return msgs
  }, [
    archivosSubidos.length,
    dbCounts,
    errorCount,
    firstBlockReadyCount,
    hasUploadingFiles,
    invoiceIdsInOrder.length,
    currentSessionInvoiceIds.length,
  ])

  const statusMessage = dynamicMessages[statusMessageTick % dynamicMessages.length]

  useEffect(() => {
    if (!hasUploadingFiles && !hasAnyExtractionWork) return
    const id = window.setInterval(() => setStatusMessageTick((t) => t + 1), 2500)
    return () => window.clearInterval(id)
  }, [hasUploadingFiles, hasAnyExtractionWork])

  const startExtract = useCallback(
    async (invoiceId: string) => {
      if (extractStartedRef.current[invoiceId]) return
      extractStartedRef.current[invoiceId] = true

      setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'processing' }))
      // Reflejarlo también como estado real en la UI (para no mostrar "En cola" al volver).
      setArchivosSubidos((prev) =>
        prev.map((a) =>
          a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a
        )
      )
      setSubidasFacturas((prev) =>
        prev.map((s) =>
          s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a)) }
            : s
        )
      )
      setSubidaActual((prev) =>
        prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
          ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'processing', dbErrorMessage: null } : a)) }
          : prev
      )
      extractInFlightRef.current += 1
      try {
        const r = await fetch(`/api/invoices/${invoiceId}/extract`, { method: 'POST' })
        const j = await r.json().catch(() => null)
        if (!r.ok) throw new Error(j?.error || 'Error procesando factura')
        setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'ready' }))
        setArchivosSubidos((prev) =>
          prev.map((a) =>
            a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a
          )
        )
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
              ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a)) }
              : s
          )
        )
        setSubidaActual((prev) =>
          prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'needs_review', dbErrorMessage: null } : a)) }
            : prev
        )
      } catch {
        setExtractStatusByInvoiceId((prev) => ({ ...prev, [invoiceId]: 'error' }))
        setArchivosSubidos((prev) =>
          prev.map((a) =>
            a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a
          )
        )
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.uploadId && s.archivos.some((a) => a.invoiceId === invoiceId)
              ? { ...s, archivos: s.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a)) }
              : s
          )
        )
        setSubidaActual((prev) =>
          prev && prev.archivos.some((a) => a.invoiceId === invoiceId)
            ? { ...prev, archivos: prev.archivos.map((a) => (a.invoiceId === invoiceId ? { ...a, dbStatus: 'error' } : a)) }
            : prev
        )
      } finally {
        extractInFlightRef.current -= 1
      }
    },
    []
  )

  const pumpExtractQueue = useCallback(() => {
    if (extractInFlightRef.current >= MAX_EXTRACT_CONCURRENCY) return

    // Solo auto-procesamos lo subido en esta sesión (para no re-procesar históricos).
    for (const invoiceId of sessionInvoiceIds) {
      if (extractInFlightRef.current >= MAX_EXTRACT_CONCURRENCY) break
      const st = extractStatusByInvoiceId[invoiceId] || 'idle'
      if (st === 'idle') void startExtract(invoiceId)
    }
  }, [extractStatusByInvoiceId, sessionInvoiceIds, startExtract])

  useEffect(() => {
    pumpExtractQueue()
  }, [pumpExtractQueue])

  // Verificar sesión y organización al cargar
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/dashboard');
        return;
      }

      // Verificar si el usuario tiene una organización
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1);

        if (membershipError) {
          // Si hay error (tabla no existe, permisos, etc.), asumimos que no tiene organización
          // y redirigimos a bienvenida para que la cree
          console.warn('Error al verificar organización, redirigiendo a bienvenida:', membershipError.message);
          router.push('/dashboard/bienvenida');
          return;
        }

        // Si no tiene organización, redirigir a la página de bienvenida
        if (!memberships || memberships.length === 0) {
          router.push('/dashboard/bienvenida');
          return;
        }

        // Obtener información de la organización
        const currentOrgId = memberships[0].org_id;
        setOrgId(currentOrgId);

        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', currentOrgId)
          .single();

        if (orgError) {
          console.error('Error al cargar organización:', orgError);
          showError('Error al cargar la información de la organización');
        } else if (organization) {
          setOrganizationName(organization.name);
        }

        // Cargar clientes de la organización
        const { data: clients, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .eq('org_id', currentOrgId)
          .order('created_at', { ascending: false });

        if (clientsError) {
          console.error('Error al cargar clientes:', clientsError);
          showError('Error al cargar los clientes');
        } else if (clients) {
          setClientes(clients as Cliente[]);
        }
      } else {
        // Si no hay usuario, redirigir a login
        router.push('/login?redirect=/dashboard');
        return;
      }

      setIsLoading(false);
    };

    checkSession();
  }, [router, showError]);

  // Cargar subidas existentes cuando se selecciona un cliente
  const handleClienteChange = useCallback((clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setClienteSeleccionado(cliente || null);

    // Persistir selección para cuando se vuelva al dashboard
    if (orgId) {
      const key = `dashboard:selectedClientId:${orgId}`;
      if (clienteId) sessionStorage.setItem(key, clienteId);
      else sessionStorage.removeItem(key);
    }

    // Reset UI mientras cargamos histórico real
    setSubidaActual(null);
    setArchivosSubidos([]);
    setExtractStatusByInvoiceId({})
    setSessionInvoiceIds([])
    extractStartedRef.current = {}
    extractInFlightRef.current = 0
    setStatusMessageTick(0)
    setIsChoosingTipoSubida(false);
    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');

    // Cargar subidas reales del backend para este cliente
    if (clienteId) {
      ; (async () => {
        try {
          const resp = await fetch(`/api/uploads?client_id=${encodeURIComponent(clienteId)}`)
          const data: unknown = await resp.json()
          if (!resp.ok) {
            const msg =
              typeof (data as { error?: unknown })?.error === 'string'
                ? (data as { error?: string }).error
                : 'Error cargando subidas'
            throw new Error(msg)
          }

          type UploadInvoiceApiRow = {
            id: string
            status?: 'uploaded' | 'processing' | 'needs_review' | 'ready' | 'error' | null
            error_message?: string | null
            original_filename: string | null
            mime_type: string | null
            file_size_bytes: number | null
            bucket: string
            storage_path: string
            created_at: string
          }

          type UploadApiRow = {
            id: string
            client_id: string | null
            tipo?: string | null
            name: string
            created_at: string
            invoices?: UploadInvoiceApiRow[]
          }

          const uploads = Array.isArray((data as { uploads?: unknown })?.uploads)
            ? ((data as { uploads: unknown[] }).uploads as UploadApiRow[])
            : []

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
          }))

          setSubidasFacturas(mapped)
        } catch (e) {
          showError(e instanceof Error ? e.message : 'Error cargando subidas')
          setSubidasFacturas([])
        }
      })()
    } else {
      setSubidasFacturas([])
    }
  }, [clientes, orgId, showError]);

  // Restaurar cliente seleccionado al volver al dashboard (si existe en sessionStorage)
  useEffect(() => {
    if (!orgId) return;
    if (clienteSeleccionado) return;
    if (clientes.length === 0) return;

    const key = `dashboard:selectedClientId:${orgId}`;
    const savedId = sessionStorage.getItem(key);
    if (!savedId) return;

    const exists = clientes.some(c => c.id === savedId);
    if (exists) handleClienteChange(savedId);
  }, [orgId, clientes, clienteSeleccionado, handleClienteChange]);

  // Crear nuevo cliente
  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nuevoCliente.name.trim()) {
      showError('El nombre del cliente es requerido');
      return;
    }

    setIsCreatingClient(true);

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: nuevoCliente.name.trim(),
          tax_id: nuevoCliente.tax_id.trim() || null,
          preferred_income_account: nuevoCliente.preferred_income_account || null,
          preferred_expense_account: nuevoCliente.preferred_expense_account || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showError(translateError(data.error || 'Error al crear el cliente'));
        setIsCreatingClient(false);
        return;
      }

      // Agregar el nuevo cliente a la lista
      setClientes(prev => [data.client, ...prev]);

      // Seleccionar el nuevo cliente automáticamente
      setClienteSeleccionado(data.client);
      if (orgId) {
        sessionStorage.setItem(`dashboard:selectedClientId:${orgId}`, data.client.id);
      }

      // Limpiar el formulario y cerrar
      setNuevoCliente({ name: '', tax_id: '', preferred_income_account: '700', preferred_expense_account: '600' });
      setMostrarNuevoCliente(false);

      showSuccess('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error al crear cliente:', error);
      showError('Error al crear el cliente. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const openEditClient = (c: Cliente) => {
    setClientParaEditar(c)
    setEditCliente({
      name: c.name || '',
      tax_id: c.tax_id || '',
      preferred_income_account: c.preferred_income_account || '700',
      preferred_expense_account: c.preferred_expense_account || '600',
    })
    setIsEditClientModalOpen(true)
  }

  const handleGuardarEdicionCliente = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientParaEditar) return
    if (!editCliente.name.trim()) {
      showError('El nombre del cliente es requerido')
      return
    }
    setIsUpdatingClient(true)
    try {
      const resp = await fetch(`/api/clients/${clientParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCliente.name.trim(),
          tax_id: editCliente.tax_id.trim() || null,
          preferred_income_account: editCliente.preferred_income_account || null,
          preferred_expense_account: editCliente.preferred_expense_account || null,
        }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || 'Error actualizando el cliente')

      const updated = data?.client as Cliente
      setClientes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      setClienteSeleccionado(updated)
      showSuccess('Cliente actualizado')
      setIsEditClientModalOpen(false)
      setClientParaEditar(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error actualizando el cliente')
    } finally {
      setIsUpdatingClient(false)
    }
  }

  const handleConfirmEliminarCliente = useCallback(async () => {
    if (!clientParaEliminar) return
    setIsDeletingClient(true)
    try {
      const resp = await fetch(`/api/clients/${clientParaEliminar.id}`, { method: 'DELETE' })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || 'Error eliminando el cliente')

      setClientes((prev) => prev.filter((c) => c.id !== clientParaEliminar.id))
      if (clienteSeleccionado?.id === clientParaEliminar.id) setClienteSeleccionado(null)
      showSuccess('Cliente eliminado')
      setIsDeleteClientModalOpen(false)
      setClientParaEliminar(null)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error eliminando el cliente')
    } finally {
      setIsDeletingClient(false)
    }
  }, [clientParaEliminar, clienteSeleccionado?.id, showError, showSuccess])

  const getNombreSubidaPorDefecto = () => {
    // Ej: "13/12/2025 10:35"
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES');
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return `${fecha} ${hora}`;
  };

  // Crear nueva subida
  const handleCrearSubida = useCallback(() => {
    if (!clienteSeleccionado) return;

    setIsChoosingTipoSubida(true);
  }, [clienteSeleccionado]);

  const handleCrearSubidaConTipo = useCallback(
    (tipo: 'gasto' | 'ingreso') => {
      if (!clienteSeleccionado) return;

      // Reset estado de procesamiento (nueva subida)
      setExtractStatusByInvoiceId({})
      setSessionInvoiceIds([])
      extractStartedRef.current = {}
      extractInFlightRef.current = 0
      setStatusMessageTick(0)

      const nuevaSubida: SubidaFacturas = {
        id: Date.now().toString(),
        uploadId: undefined, // se creará en DB al subir la primera factura
        clienteId: clienteSeleccionado.id,
        tipo,
        nombre: getNombreSubidaPorDefecto(),
        fechaCreacion: new Date().toISOString(),
        estado: 'pendiente',
        archivos: [],
      };

      setSubidasFacturas(prev => [...prev, nuevaSubida]);
      setSubidaActual(nuevaSubida);
      setArchivosSubidos([]);
      setIsChoosingTipoSubida(false);
    },
    [clienteSeleccionado]
  );

  const handleDeseleccionarSubida = useCallback(() => {
    setSubidaActual(null)
    setArchivosSubidos([])
    setIsChoosingTipoSubida(false)
    setSubidaEditandoId(null)
    setSubidaEditandoNombre('')
    setStatusMessageTick(0)
  }, [])

  const handleGuardarNombreSubida = async (subidaId: string) => {
    const nuevoNombre = subidaEditandoNombre.trim();
    if (!nuevoNombre) {
      showError('El nombre no puede estar vacío');
      return;
    }

    const target = subidasFacturas.find((s) => s.id === subidaId) || null
    const uploadIdReal = target?.uploadId || (subidaId && subidaId.length > 20 ? subidaId : null)
    const prevNombre = target?.nombre || ''

    // Optimista
    setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: nuevoNombre } : s)))
    if (subidaActual?.id === subidaId) {
      setSubidaActual((prev) => (prev ? { ...prev, nombre: nuevoNombre } : prev))
    }

    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');

    // Si aún no existe en BD (uploadId undefined), el cambio queda local hasta que se cree.
    if (!uploadIdReal) {
      showSuccess('Nombre de la subida actualizado')
      return
    }

    try {
      const resp = await fetch(`/api/uploads/${encodeURIComponent(uploadIdReal)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nuevoNombre }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) throw new Error(data?.error || 'Error actualizando subida')

      const serverName = typeof data?.upload?.name === 'string' ? data.upload.name : nuevoNombre
      setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: serverName } : s)))
      if (subidaActual?.id === subidaId) {
        setSubidaActual((prev) => (prev ? { ...prev, nombre: serverName } : prev))
      }

      showSuccess('Nombre de la subida actualizado')
    } catch (e) {
      // rollback
      setSubidasFacturas((prev) => prev.map((s) => (s.id === subidaId ? { ...s, nombre: prevNombre } : s)))
      if (subidaActual?.id === subidaId) {
        setSubidaActual((prev) => (prev ? { ...prev, nombre: prevNombre } : prev))
      }
      showError(e instanceof Error ? e.message : 'Error actualizando subida')
    }
  };

  // Seleccionar subida existente
  const handleSeleccionarSubida = useCallback((subida: SubidaFacturas) => {
    setSubidaActual(subida);
    setArchivosSubidos(subida.archivos);
    // Importante: NO paramos la cola global si estás procesando otra subida.
    // Aquí solo "sincronizamos" el estado local para los invoiceIds visibles de esta subida (merge).
    const nextExtract: Record<string, 'idle' | 'processing' | 'ready' | 'error'> = {}
    for (const a of subida.archivos) {
      if (!a.invoiceId) continue
      const st = a.dbStatus || null
      nextExtract[a.invoiceId] =
        st === 'processing'
          ? 'processing'
          : st === 'error'
            ? 'error'
            : st === 'needs_review' || st === 'ready'
              ? 'ready'
              : 'idle'
    }
    setExtractStatusByInvoiceId((prev) => ({ ...prev, ...nextExtract }))
    setStatusMessageTick(0)
  }, []);

  const handleEliminarSubida = useCallback(async (subida: SubidaFacturas) => {
    if (!subida.uploadId) {
      showError('Esta subida todavía no existe en el backend')
      return
    }

    setSubidaParaEliminar(subida)
    setIsDeleteModalOpen(true)
  }, [showError]);

  const handleConfirmEliminarSubida = useCallback(async () => {
    if (!subidaParaEliminar?.uploadId) {
      showError('No se pudo identificar la subida a eliminar')
      setIsDeleteModalOpen(false)
      setSubidaParaEliminar(null)
      return
    }

    setIsDeletingUpload(true)

    try {
      const resp = await fetch(`/api/uploads/${subidaParaEliminar.uploadId}`, { method: 'DELETE' })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'Error eliminando la subida')

      setSubidasFacturas(prev => prev.filter(s => s.uploadId !== subidaParaEliminar.uploadId))
      if (subidaActual?.uploadId === subidaParaEliminar.uploadId) {
        setSubidaActual(null)
        setArchivosSubidos([])
      }
      showSuccess('Subida eliminada')
      setIsDeleteModalOpen(false)
      setSubidaParaEliminar(null)
      void refreshFacturasGastadasOrgCount()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la subida')
    } finally {
      setIsDeletingUpload(false)
    }
  }, [showError, showSuccess, subidaActual, subidaParaEliminar, refreshFacturasGastadasOrgCount]);

  // Manejar archivos seleccionados
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!subidaActual) {
      showError('Por favor, crea o selecciona una subida primero');
      return;
    }
    if (!clienteSeleccionado) {
      showError('Selecciona un cliente antes de subir facturas');
      return;
    }

    // Asegurar que existe un upload real en DB (solo cuando se sube el primer archivo)
    let realUploadId = subidaActual.uploadId
    let createdNow = false
    if (!realUploadId) {
      try {
        const resp = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: subidaActual.nombre,
            client_id: clienteSeleccionado.id,
            tipo: subidaActual.tipo,
          }),
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error || 'No se pudo crear la subida')
        realUploadId = data.upload.id
        createdNow = true

        // Persistir el uploadId en el estado para siguientes archivos
        setSubidasFacturas(prev =>
          prev.map(s => (s.id === subidaActual.id ? { ...s, id: realUploadId!, uploadId: realUploadId! } : s))
        )
        setSubidaActual(prev => (prev ? { ...prev, id: realUploadId!, uploadId: realUploadId! } : prev))
      } catch (e) {
        showError(e instanceof Error ? e.message : 'Error creando la subida')
        return
      }
    }

    // Creamos placeholders en UI para feedback inmediato
    const placeholders: ArchivoSubido[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      nombre: file.name,
      tamaño: file.size,
      tipo: file.type,
      url: '',
      fechaSubida: new Date().toISOString(),
      estado: 'procesando',
    }))

    const archivosConPlaceholders = [...archivosSubidos, ...placeholders]
    setArchivosSubidos(archivosConPlaceholders)
    setSubidasFacturas(prev =>
      prev.map(s => (s.id === subidaActual.id ? { ...s, archivos: archivosConPlaceholders } : s))
    )
    setSubidaActual(prev => (prev ? { ...prev, archivos: archivosConPlaceholders } : null))

    // Subida real a Supabase vía API (una a una para simplificar estado/errores)
    let successCount = 0

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const placeholderId = placeholders[i].id

      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('client_id', clienteSeleccionado.id)
        // Agrupa varias facturas dentro de una misma "subida" en Storage
        fd.append('upload_id', realUploadId!)
        // Enviamos el tipo para que la IA sepa si es ingreso/gasto
        fd.append('tipo', String(subidaActual.tipo).toUpperCase())
        // Importante: NO esperamos a la extracción aquí.
        // La extracción OCR/IA se hará desde la pantalla de validación en cola (3 en paralelo).

        const resp = await fetch('/api/invoices/upload', { method: 'POST', body: fd })
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data?.error || 'Error subiendo la factura')
        }
        // El endpoint puede responder 200 con success=false (p.ej. fallo en extracción)
        if (data?.success === false) {
          throw new Error(data?.error || 'Error procesando la factura')
        }

        const invoice = data.invoice
        let url = data.previewUrl || ''
        if (!url && invoice?.id) {
          try {
            const r2 = await fetch(`/api/invoices/${invoice.id}/preview?expires=${60 * 60 * 24 * 7}`)
            const j2 = await r2.json()
            if (r2.ok && j2?.signedUrl) url = j2.signedUrl
          } catch {
            // noop
          }
        }

        const statusRaw = typeof invoice?.status === 'string' ? String(invoice.status) : null
        const dbStatus: ArchivoSubido['dbStatus'] =
          statusRaw === 'uploaded' ||
          statusRaw === 'processing' ||
          statusRaw === 'needs_review' ||
          statusRaw === 'ready' ||
          statusRaw === 'error'
            ? statusRaw
            : 'uploaded'

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
          // subido; el procesamiento OCR/IA se hará en cola (3 en paralelo) desde este dashboard y/o validación
          estado: 'procesado',
          dbStatus,
          dbErrorMessage: typeof invoice.error_message === 'string' ? invoice.error_message : null,
        }
        successCount++

        // Actualizar UI inmediatamente (para no esperar al final)
        setArchivosSubidos(prev => {
          const merged = prev.map(a => (a.id === placeholderId ? nextArchivo : a))
          setSubidasFacturas(sPrev => sPrev.map(s => (s.uploadId === realUploadId ? { ...s, archivos: merged } : s)))
          setSubidaActual(sPrev => (sPrev ? { ...sPrev, archivos: merged } : null))
          return merged
        })

        // Encolar extracción de esta factura
        setExtractStatusByInvoiceId(prev => ({ ...prev, [invoice.id]: prev[invoice.id] || 'idle' }))
        setSessionInvoiceIds(prev => (prev.includes(invoice.id) ? prev : [...prev, invoice.id]))
      } catch (e) {
        const nextArchivo: ArchivoSubido = { ...placeholders[i], estado: 'error', url: '' }
        setArchivosSubidos(prev => {
          const merged = prev.map(a => (a.id === placeholderId ? nextArchivo : a))
          setSubidasFacturas(sPrev => sPrev.map(s => (s.uploadId === realUploadId ? { ...s, archivos: merged } : s)))
          setSubidaActual(sPrev => (sPrev ? { ...sPrev, archivos: merged } : null))
          return merged
        })
        showError(e instanceof Error ? e.message : 'Error subiendo la factura')
      }
    }

    if (successCount > 0) {
      void refreshFacturasGastadasOrgCount()
    }

    // Si acabamos de crear la subida y no se subió ninguna factura, borrarla (para cumplir “solo si se sube algo”)
    if (createdNow && successCount === 0 && realUploadId) {
      try {
        await fetch(`/api/uploads/${realUploadId}`, { method: 'DELETE' })
      } catch {
        // noop
      }

      setSubidaActual(null)
      setArchivosSubidos([])
      setSubidasFacturas(prev => prev.filter(s => s.uploadId !== realUploadId))
      return
    }

  }, [subidaActual, archivosSubidos, showError, clienteSeleccionado, setSubidasFacturas, refreshFacturasGastadasOrgCount]);

  // Eliminar archivo
  const handleRemoveFile = useCallback(async (fileId: string) => {
    const fileToRemove = archivosSubidos.find((f) => f.id === fileId) || null
    if (!fileToRemove) return

    setFacturaParaEliminar(fileToRemove)
    setIsDeleteInvoiceModalOpen(true)
  }, [archivosSubidos]);

  const handleConfirmEliminarFactura = useCallback(async () => {
    if (!facturaParaEliminar) {
      setIsDeleteInvoiceModalOpen(false)
      return
    }

    setIsDeletingInvoice(true)
    try {
      // Si existe en backend, borramos factura+storage
      if (facturaParaEliminar.invoiceId) {
        const resp = await fetch(`/api/invoices/${facturaParaEliminar.invoiceId}`, { method: 'DELETE' })
        const data = await resp.json().catch(() => null)
        if (!resp.ok) throw new Error(data?.error || 'Error eliminando la factura')
      }

      const archivosActualizados = archivosSubidos.filter((f) => f.id !== facturaParaEliminar.id)
      setArchivosSubidos(archivosActualizados)

      if (subidaActual) {
        setSubidasFacturas((prev) =>
          prev.map((s) =>
            s.id === subidaActual.id ? { ...s, archivos: archivosActualizados } : s
          )
        )
        setSubidaActual((prev) => (prev ? { ...prev, archivos: archivosActualizados } : null))
      }

      showSuccess('Factura eliminada')
      setIsDeleteInvoiceModalOpen(false)
      setFacturaParaEliminar(null)
      void refreshFacturasGastadasOrgCount()
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la factura')
    } finally {
      setIsDeletingInvoice(false)
    }
  }, [archivosSubidos, facturaParaEliminar, subidaActual, showError, showSuccess, refreshFacturasGastadasOrgCount]);

  // Ir a validar facturas (vista elegida desde fuera)
  const handleValidarFacturas = useCallback((view: 'pending' | 'all') => {
    if (!subidaActual || archivosSubidos.length === 0) {
      showError('Por favor, sube al menos un archivo antes de validar');
      return;
    }
    if (!subidaActual.uploadId) {
      showError('La subida aún no está guardada. Sube al menos una factura primero.');
      return;
    }
    if (archivosSubidos.some((a) => a.estado === 'error')) {
      showError('Hay facturas con error. Elimina o reintenta antes de validar.');
      return;
    }

    if (hasUploadingFiles) {
      showError('Espera a que terminen de subirse las facturas para empezar a validar.')
      return
    }
    if (!canValidate) {
      showError(
        requiredFirstCount > 0
          ? (archivosSubidos.length <= BLOCK_SIZE
            ? 'Estamos procesando las facturas. En cuanto estén listas, podrás validar.'
            : `Estamos procesando las primeras ${requiredFirstCount} facturas (${firstBlockReadyCount}/${requiredFirstCount}). En cuanto estén listas, podrás validar.`)
          : 'Estamos preparando las facturas. En cuanto estén listas, podrás validar.'
      )
      return
    }

    try {
      sessionStorage.setItem(`upload:${subidaActual.uploadId}:tipo`, subidaActual.tipo)
    } catch {
      // noop
    }

    router.push(
      `/dashboard/uploads/${subidaActual.uploadId}/validar?tipo=${encodeURIComponent(subidaActual.tipo)}&view=${encodeURIComponent(view)}`
    )
  }, [
    subidaActual,
    archivosSubidos,
    router,
    showError,
    hasUploadingFiles,
    canValidate,
    requiredFirstCount,
    firstBlockReadyCount,
  ]);

  const handleLogout = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      showError(translateError(error.message));
      return;
    }

    if (orgId) {
      sessionStorage.removeItem(`dashboard:selectedClientId:${orgId}`);
    }
    showSuccess('Sesión cerrada');
    router.push('/login');
  };

  // Obtener subidas del cliente actual
  const subidasDelCliente = subidasFacturas.filter(
    s => s.clienteId === clienteSeleccionado?.id
  );

  // Mostrar loading mientras se verifica la sesión
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 text-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/img/logo.png"
                alt="KontaScan"
                width={100}
                height={100}
                className="h-10 w-auto"
                priority
              />
              <span className="text-2xl font-bold text-primary">KontaScan</span>
            </Link>
            <nav className="flex items-center space-x-4">
              <Link
                href="/dashboard/preferencias"
                className="p-2 rounded-full text-foreground-secondary hover:text-foreground hover:bg-slate-100 transition-colors"
                aria-label="Preferencias"
                title="Preferencias"
              >
                <span className="sr-only">Preferencias</span>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 8.25C9.92894 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92894 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25ZM9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z"
                    fill="currentColor"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.9747 1.25C11.5303 1.24999 11.1592 1.24999 10.8546 1.27077C10.5375 1.29241 10.238 1.33905 9.94761 1.45933C9.27379 1.73844 8.73843 2.27379 8.45932 2.94762C8.31402 3.29842 8.27467 3.66812 8.25964 4.06996C8.24756 4.39299 8.08454 4.66251 7.84395 4.80141C7.60337 4.94031 7.28845 4.94673 7.00266 4.79568C6.64714 4.60777 6.30729 4.45699 5.93083 4.40743C5.20773 4.31223 4.47642 4.50819 3.89779 4.95219C3.64843 5.14353 3.45827 5.3796 3.28099 5.6434C3.11068 5.89681 2.92517 6.21815 2.70294 6.60307L2.67769 6.64681C2.45545 7.03172 2.26993 7.35304 2.13562 7.62723C1.99581 7.91267 1.88644 8.19539 1.84541 8.50701C1.75021 9.23012 1.94617 9.96142 2.39016 10.5401C2.62128 10.8412 2.92173 11.0602 3.26217 11.2741C3.53595 11.4461 3.68788 11.7221 3.68786 12C3.68785 12.2778 3.53592 12.5538 3.26217 12.7258C2.92169 12.9397 2.62121 13.1587 2.39007 13.4599C1.94607 14.0385 1.75012 14.7698 1.84531 15.4929C1.88634 15.8045 1.99571 16.0873 2.13552 16.3727C2.26983 16.6469 2.45535 16.9682 2.67758 17.3531L2.70284 17.3969C2.92507 17.7818 3.11058 18.1031 3.28089 18.3565C3.45817 18.6203 3.64833 18.8564 3.89769 19.0477C4.47632 19.4917 5.20763 19.6877 5.93073 19.5925C6.30717 19.5429 6.647 19.3922 7.0025 19.2043C7.28833 19.0532 7.60329 19.0596 7.8439 19.1986C8.08452 19.3375 8.24756 19.607 8.25964 19.9301C8.27467 20.3319 8.31403 20.7016 8.45932 21.0524C8.73843 21.7262 9.27379 22.2616 9.94761 22.5407C10.238 22.661 10.5375 22.7076 10.8546 22.7292C11.1592 22.75 11.5303 22.75 11.9747 22.75H12.0252C12.4697 22.75 12.8407 22.75 13.1454 22.7292C13.4625 22.7076 13.762 22.661 14.0524 22.5407C14.7262 22.2616 15.2616 21.7262 15.5407 21.0524C15.686 20.7016 15.7253 20.3319 15.7403 19.93C15.7524 19.607 15.9154 19.3375 16.156 19.1985C16.3966 19.0596 16.7116 19.0532 16.9974 19.2042C17.3529 19.3921 17.6927 19.5429 18.0692 19.5924C18.7923 19.6876 19.5236 19.4917 20.1022 19.0477C20.3516 18.8563 20.5417 18.6203 20.719 18.3565C20.8893 18.1031 21.0748 17.7818 21.297 17.3969L21.3223 17.3531C21.5445 16.9682 21.7301 16.6468 21.8644 16.3726C22.0042 16.0872 22.1135 15.8045 22.1546 15.4929C22.2498 14.7697 22.0538 14.0384 21.6098 13.4598C21.3787 13.1586 21.0782 12.9397 20.7378 12.7258C20.464 12.5538 20.3121 12.2778 20.3121 11.9999C20.3121 11.7221 20.464 11.4462 20.7377 11.2742C21.0783 11.0603 21.3788 10.8414 21.6099 10.5401C22.0539 9.96149 22.2499 9.23019 22.1547 8.50708C22.1136 8.19546 22.0043 7.91274 21.8645 7.6273C21.7302 7.35313 21.5447 7.03183 21.3224 6.64695L21.2972 6.60318C21.0749 6.21825 20.8894 5.89688 20.7191 5.64347C20.5418 5.37967 20.3517 5.1436 20.1023 4.95225C19.5237 4.50826 18.7924 4.3123 18.0692 4.4075C17.6928 4.45706 17.353 4.60782 16.9975 4.79572C16.7117 4.94679 16.3967 4.94036 16.1561 4.80144C15.9155 4.66253 15.7524 4.39297 15.7403 4.06991C15.7253 3.66808 15.686 3.2984 15.5407 2.94762C15.2616 2.27379 14.7262 1.73844 14.0524 1.45933C13.762 1.33905 13.4625 1.29241 13.1454 1.27077C12.8407 1.24999 12.4697 1.24999 12.0252 1.25H11.9747ZM10.5216 2.84515C10.5988 2.81319 10.716 2.78372 10.9567 2.76729C11.2042 2.75041 11.5238 2.75 12 2.75C12.4762 2.75 12.7958 2.75041 13.0432 2.76729C13.284 2.78372 13.4012 2.81319 13.4783 2.84515C13.7846 2.97202 14.028 3.21536 14.1548 3.52165C14.1949 3.61826 14.228 3.76887 14.2414 4.12597C14.271 4.91835 14.68 5.68129 15.4061 6.10048C16.1321 6.51968 16.9974 6.4924 17.6984 6.12188C18.0143 5.9549 18.1614 5.90832 18.265 5.89467C18.5937 5.8514 18.9261 5.94047 19.1891 6.14228C19.2554 6.19312 19.3395 6.27989 19.4741 6.48016C19.6125 6.68603 19.7726 6.9626 20.0107 7.375C20.2488 7.78741 20.4083 8.06438 20.5174 8.28713C20.6235 8.50382 20.6566 8.62007 20.6675 8.70287C20.7108 9.03155 20.6217 9.36397 20.4199 9.62698C20.3562 9.70995 20.2424 9.81399 19.9397 10.0041C19.2684 10.426 18.8122 11.1616 18.8121 11.9999C18.8121 12.8383 19.2683 13.574 19.9397 13.9959C20.2423 14.186 20.3561 14.29 20.4198 14.373C20.6216 14.636 20.7107 14.9684 20.6674 15.2971C20.6565 15.3799 20.6234 15.4961 20.5173 15.7128C20.4082 15.9355 20.2487 16.2125 20.0106 16.6249C19.7725 17.0373 19.6124 17.3139 19.474 17.5198C19.3394 17.72 19.2553 17.8068 19.189 17.8576C18.926 18.0595 18.5936 18.1485 18.2649 18.1053C18.1613 18.0916 18.0142 18.045 17.6983 17.8781C16.9973 17.5075 16.132 17.4803 15.4059 17.8995C14.68 18.3187 14.271 19.0816 14.2414 19.874C14.228 20.2311 14.1949 20.3817 14.1548 20.4784C14.028 20.7846 13.7846 21.028 13.4783 21.1549C13.4012 21.1868 13.284 21.2163 13.0432 21.2327C12.7958 21.2496 12.4762 21.25 12 21.25C11.5238 21.25 11.2042 21.2496 10.9567 21.2327C10.716 21.2163 10.5988 21.1868 10.5216 21.1549C10.2154 21.028 9.97201 20.7846 9.84514 20.4784C9.80512 20.3817 9.77195 20.2311 9.75859 19.874C9.72896 19.0817 9.31997 18.3187 8.5939 17.8995C7.86784 17.4803 7.00262 17.5076 6.30158 17.8781C5.98565 18.0451 5.83863 18.0917 5.73495 18.1053C5.40626 18.1486 5.07385 18.0595 4.81084 17.8577C4.74458 17.8069 4.66045 17.7201 4.52586 17.5198C4.38751 17.314 4.22736 17.0374 3.98926 16.625C3.75115 16.2126 3.59171 15.9356 3.4826 15.7129C3.37646 15.4962 3.34338 15.3799 3.33248 15.2971C3.28921 14.9684 3.37828 14.636 3.5801 14.373C3.64376 14.2901 3.75761 14.186 4.0602 13.9959C4.73158 13.5741 5.18782 12.8384 5.18786 12.0001C5.18791 11.1616 4.73165 10.4259 4.06021 10.004C3.75769 9.81389 3.64385 9.70987 3.58019 9.62691C3.37838 9.3639 3.28931 9.03149 3.33258 8.7028C3.34348 8.62001 3.37656 8.50375 3.4827 8.28707C3.59181 8.06431 3.75125 7.78734 3.98935 7.37493C4.22746 6.96253 4.3876 6.68596 4.52596 6.48009C4.66055 6.27983 4.74468 6.19305 4.81093 6.14222C5.07395 5.9404 5.40636 5.85133 5.73504 5.8946C5.83873 5.90825 5.98576 5.95483 6.30173 6.12184C7.00273 6.49235 7.86791 6.51962 8.59394 6.10045C9.31998 5.68128 9.72896 4.91837 9.75859 4.12602C9.77195 3.76889 9.80512 3.61827 9.84514 3.52165C9.97201 3.21536 10.2154 2.97202 10.5216 2.84515Z"
                    fill="currentColor"
                  />
                </svg>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="text-red-700 hover:text-red-800 transition-colors"
              >
                Cerrar sesión
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h2 className="text-3xl font-light text-foreground mb-2 truncate">
              {organizationName || 'Dashboard'}
            </h2>
            <p className="text-foreground-secondary">
              Gestiona las facturas de tus clientes
            </p>
          </div>

          <div className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-right min-w-[170px]">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Facturas gastadas
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
              {isLoadingFacturasGastadasOrgCount ? '…' : (facturasGastadasOrgCount ?? '—')}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Columna izquierda: Selección de cliente y subidas */}
          <div className="lg:col-span-1 space-y-6">
            {/* Selector de cliente */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Seleccionar cliente
                </h3>
                <button
                  onClick={() => setMostrarNuevoCliente(true)}
                  className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
                >
                  + Nuevo
                </button>
              </div>

              {!mostrarNuevoCliente ? (
                <>
                  <ClientSelect
                    clients={clientes}
                    value={clienteSeleccionado?.id || ''}
                    onChange={handleClienteChange}
                  />

                  {clienteSeleccionado && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="flex-1"
                        onClick={() => openEditClient(clienteSeleccionado)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="md"
                        className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setClientParaEliminar(clienteSeleccionado)
                          setIsDeleteClientModalOpen(true)
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  )}

                  {clientes.length === 0 && (
                    <p className="mt-4 text-sm text-foreground-secondary text-center">
                      No hay clientes registrados. Crea uno nuevo.
                    </p>
                  )}
                </>
              ) : (
                <form onSubmit={handleCrearCliente} className="space-y-4">
                  <div>
                    <label htmlFor="client-name" className="block text-sm font-medium text-foreground mb-2">
                      Nombre del cliente *
                    </label>
                    <input
                      id="client-name"
                      type="text"
                      required
                      value={nuevoCliente.name}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Ej: Empresa ABC S.L."
                      disabled={isCreatingClient}
                    />
                  </div>
                  <div>
                    <label htmlFor="client-tax-id" className="block text-sm font-medium text-foreground mb-2">
                      CIF/NIF (opcional)
                    </label>
                    <input
                      id="client-tax-id"
                      type="text"
                      value={nuevoCliente.tax_id}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, tax_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      placeholder="Ej: B12345678"
                      disabled={isCreatingClient}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cuenta preferente (Ingresos)
                      </label>
                      <select
                        value={nuevoCliente.preferred_income_account}
                        onChange={(e) =>
                          setNuevoCliente({ ...nuevoCliente, preferred_income_account: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        disabled={isCreatingClient}
                      >
                        <option value="700">700 - Ventas</option>
                        <option value="705">705 - Prestaciones de servicios</option>
                        <option value="708">708 - Devoluciones y descuentos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cuenta preferente (Gastos)
                      </label>
                      <select
                        value={nuevoCliente.preferred_expense_account}
                        onChange={(e) =>
                          setNuevoCliente({ ...nuevoCliente, preferred_expense_account: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        disabled={isCreatingClient}
                      >
                        <option value="600">600</option>
                        <option value="620">620</option>
                        <option value="621">621</option>
                        <option value="628">628</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      className="flex-1"
                      disabled={isCreatingClient}
                    >
                      {isCreatingClient ? 'Creando...' : 'Crear cliente'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => {
                        setMostrarNuevoCliente(false);
                        setNuevoCliente({
                          name: '',
                          tax_id: '',
                          preferred_income_account: '700',
                          preferred_expense_account: '600',
                        });
                      }}
                      disabled={isCreatingClient}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Gestión de subidas */}
            {clienteSeleccionado && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Histórico de subidas
                  </h3>
                  <p className="text-sm text-foreground-secondary mt-1">
                    Selecciona una subida para seguir trabajando
                  </p>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {subidasDelCliente.length === 0 ? (
                    <p className="text-sm text-foreground-secondary text-center py-4">
                      No hay subidas todavía.
                    </p>
                  ) : (
                    subidasDelCliente.map((subida) => (
                      <div
                        key={subida.id}
                        className={`
                          w-full p-3 rounded-lg border transition-colors
                          ${subidaActual?.id === subida.id
                            ? 'border-primary bg-primary-lighter'
                            : 'border-gray-200 hover:border-gray-200 hover:bg-gray-50'
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {subidaEditandoId === subida.id ? (
                              <div className="relative">
                                <input
                                  value={subidaEditandoNombre}
                                  onChange={(e) => setSubidaEditandoNombre(e.target.value)}
                                  className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleGuardarNombreSubida(subida.id);
                                    if (e.key === 'Escape') {
                                      setSubidaEditandoId(null);
                                      setSubidaEditandoNombre('');
                                    }
                                  }}
                                />

                                <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleGuardarNombreSubida(subida.id)}
                                    className="p-1 rounded-md text-primary hover:text-primary-hover hover:bg-primary-lighter transition-colors"
                                    aria-label="Guardar nombre"
                                    title="Guardar"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubidaEditandoId(null);
                                      setSubidaEditandoNombre('');
                                    }}
                                    className="p-1 rounded-md text-error hover:bg-red-50 transition-colors"
                                    aria-label="Cancelar edición"
                                    title="Cancelar"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSeleccionarSubida(subida)}
                                className="w-full text-left"
                                type="button"
                              >
                                <p className="text-sm font-medium text-foreground truncate">
                                  {subida.nombre}
                                </p>
                                <p className="text-xs text-foreground-secondary mt-1">
                                  {new Date(subida.fechaCreacion).toLocaleDateString('es-ES')} •{' '}
                                  {subida.archivos.length} archivo{subida.archivos.length !== 1 ? 's' : ''}
                                </p>
                              </button>
                            )}
                          </div>

                          {subidaEditandoId !== subida.id && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSubidaEditandoId(subida.id);
                                  setSubidaEditandoNombre(subida.nombre);
                                }}
                                className="text-foreground-secondary hover:text-foreground transition-colors mt-1"
                                aria-label="Renombrar subida"
                                title="Renombrar"
                              >
                                {/* Icono lápiz */}
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="w-4 h-4"
                                >
                                  <path
                                    d="M18 9.99982L14 5.99982M2.5 21.4998L5.88437 21.1238C6.29786 21.0778 6.5046 21.0549 6.69785 20.9923C6.86929 20.9368 7.03245 20.8584 7.18289 20.7592C7.35245 20.6474 7.49955 20.5003 7.79373 20.2061L21 6.99982C22.1046 5.89525 22.1046 4.10438 21 2.99981C19.8955 1.89525 18.1046 1.89524 17 2.99981L3.79373 16.2061C3.49955 16.5003 3.35246 16.6474 3.24064 16.8169C3.14143 16.9674 3.06301 17.1305 3.00751 17.302C2.94496 17.4952 2.92198 17.702 2.87604 18.1155L2.5 21.4998Z"
                                    stroke="#1f2937"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </button>

                              {/* Solo mostramos eliminar si es una subida persistida */}
                              {subida.uploadId && (
                                <button
                                  type="button"
                                  onClick={() => handleEliminarSubida(subida)}
                                  className="text-error hover:text-red-700 transition-colors mt-1"
                                  aria-label="Eliminar subida"
                                  title="Eliminar"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-4 h-4"
                                  >
                                    <path
                                      d="M10 11V17"
                                      stroke="#C11007"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M14 11V17"
                                      stroke="#C11007"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M4 7H20"
                                      stroke="#C11007"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M6 7H12H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z"
                                      stroke="#C11007"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z"
                                      stroke="#C11007"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: Upload de archivos */}
          <div className="lg:col-span-2">
            {!clienteSeleccionado ? (
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
            ) : !subidaActual ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="mb-6">
                  <p className="text-sm text-foreground-secondary">
                    Cliente: {clienteSeleccionado.name}
                  </p>
                </div>

                {!isChoosingTipoSubida ? (
                  <div className="py-10 text-center">
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
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h4 className="text-lg font-semibold text-foreground mb-2">
                      Crea una nueva subida
                    </h4>
                    <p className="text-foreground-secondary mb-6">
                      Empieza una nueva subida o selecciona una del histórico de la izquierda.
                    </p>
                    <Button
                      variant="primary"
                      onClick={handleCrearSubida}
                    >
                      Crear nueva subida
                    </Button>
                  </div>
                ) : (
                  <div className="py-6">
                    <h4 className="text-lg font-semibold text-foreground mb-2 text-center">
                      ¿Esta subida es de gasto o de ingreso?
                    </h4>
                    <p className="text-foreground-secondary mb-6 text-center">
                      Elige una opción para continuar.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleCrearSubidaConTipo('ingreso')}
                        className="group text-left border border-gray-200 rounded-xl p-5 hover:border-secondary hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-secondary group-hover:bg-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0l-6-6m6 6l-6 6" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-base font-semibold text-foreground">Ingreso</div>
                            <div className="text-sm text-foreground-secondary">Venta / emitida</div>
                          </div>
                        </div>
                        <div className="text-xs text-foreground-secondary">
                          Ej.: servicios facturados, ventas, abonos.
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCrearSubidaConTipo('gasto')}
                        className="group text-left border border-gray-200 rounded-xl p-5 hover:border-primary hover:bg-primary-lighter transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg bg-primary-lighter flex items-center justify-center text-primary group-hover:bg-white transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4m0 0l6-6m-6 6l6 6" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-base font-semibold text-foreground">Gastos</div>
                            <div className="text-sm text-foreground-secondary">Compra / proveedor</div>
                          </div>
                        </div>
                        <div className="text-xs text-foreground-secondary">
                          Ej.: suministros, servicios, alquiler, materiales.
                        </div>
                      </button>
                    </div>

                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setIsChoosingTipoSubida(false)}
                        className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
                          handleDeseleccionarSubida()
                          handleCrearSubida()
                        }}
                      >
                        Nueva subida
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground-secondary">
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
                  onFilesSelected={handleFilesSelected}
                  archivosSubidos={archivosSubidos}
                  onRemoveFile={handleRemoveFile}
                  maxVisibleFiles={3}
                  badgeForFile={(archivo) => {
                    const invoiceId = archivo.invoiceId
                    if (!invoiceId) return null

                    // Fuente de verdad: estado en BD. Si estamos procesando en esta sesión, el estado local tiene prioridad.
                    const localSt = extractStatusByInvoiceId[invoiceId] || 'idle'
                    const dbSt = archivo.dbStatus || null

                    // Badge final (no colapsar needs_review dentro de ready).
                    // - Si la factura ya está validada en BD -> siempre "Validada"
                    // - Si estamos procesando en esta sesión -> "Procesando" / "Error"
                    // - Si la extracción terminó en esta sesión (local ready) -> "Por validar"
                    // - Si no hay info -> "En cola"
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
                                  : 'uploaded'

                    const cls =
                      badgeKind === 'ready'
                        ? 'bg-secondary-lighter text-secondary'
                        : badgeKind === 'needs_review'
                          ? 'bg-amber-100 text-amber-900'
                          : badgeKind === 'processing'
                            ? 'bg-sky-100 text-sky-900'
                            : badgeKind === 'error'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'

                    const label =
                      badgeKind === 'ready'
                        ? 'Validada'
                        : badgeKind === 'needs_review'
                          ? 'Por validar'
                          : badgeKind === 'processing'
                            ? 'Procesando'
                            : badgeKind === 'error'
                              ? 'Error'
                              : 'En cola'

                    return (
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${cls}`}
                        title={archivo.dbErrorMessage ? archivo.dbErrorMessage : undefined}
                      >
                        {label}
                      </span>
                    )
                  }}
                />

                {archivosSubidos.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-foreground-secondary">
                      <div className="font-medium text-foreground">{statusMessage}</div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        <span>
                          Total: <span className="font-semibold text-foreground">{archivosSubidos.length}</span>
                        </span>
                        <span>
                          Validadas:{' '}
                          <span className="font-semibold text-foreground">
                            {dbCounts.ready}
                          </span>
                          {' '}· Por validar:{' '}
                          <span className="font-semibold text-foreground">
                            {dbCounts.needsReview}
                          </span>
                          {dbCounts.processing > 0 ? (
                            <>
                              {' '}
                              · Procesando:{' '}
                              <span className="font-semibold text-foreground">{dbCounts.processing}</span>
                            </>
                          ) : null}
                          {dbCounts.uploaded > 0 ? (
                            <>
                              {' '}
                              · En cola:{' '}
                              <span className="font-semibold text-foreground">{dbCounts.uploaded}</span>
                            </>
                          ) : null}
                          {dbCounts.error > 0 ? (
                            <>
                              {' '}
                              · Error: <span className="font-semibold text-foreground">{dbCounts.error}</span>
                            </>
                          ) : null}
                        </span>
                        {sessionInvoiceIds.length > 0 && archivosSubidos.length > BLOCK_SIZE ? (
                          <span>
                            Primer bloque: <span className="font-semibold text-foreground">{firstBlockReadyCount}</span>/
                            <span className="font-semibold text-foreground">{requiredFirstCount || 0}</span> listas
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {currentSessionInvoiceIds.length === 0 ? (
                        <>
                          <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleValidarFacturas('all')}
                            disabled={!canValidate}
                          >
                            Ver todas
                          </Button>
                          <Button
                            variant="primary"
                            size="lg"
                            onClick={() => handleValidarFacturas('pending')}
                            disabled={!canValidate}
                          >
                            Validar pendientes
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => handleValidarFacturas('all')}
                          disabled={!canValidate}
                        >
                          <span className="inline-flex items-center justify-center gap-2 font-light">
                            {hasUploadingFiles
                              ? `Subiendo… (${invoiceIdsInOrder.length}/${archivosSubidos.length})`
                              : firstBlockReadyCount < requiredFirstCount
                                ? (archivosSubidos.length <= BLOCK_SIZE
                                  ? 'Procesando facturas…'
                                  : `Procesando primeras ${requiredFirstCount}… (${firstBlockReadyCount}/${requiredFirstCount})`)
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
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {isDeleteModalOpen && subidaParaEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de subida"
          onMouseDown={() => {
            if (isDeletingUpload) return
            setIsDeleteModalOpen(false)
            setSubidaParaEliminar(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar subida</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{subidaParaEliminar.nombre}</span>.
                Se borrarán también todas sus facturas asociadas.
              </p>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingUpload}
                onClick={() => {
                  setIsDeleteModalOpen(false)
                  setSubidaParaEliminar(null)
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingUpload}
                onClick={handleConfirmEliminarSubida}
              >
                {isDeletingUpload ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteInvoiceModalOpen && facturaParaEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de factura"
          onMouseDown={() => {
            if (isDeletingInvoice) return
            setIsDeleteInvoiceModalOpen(false)
            setFacturaParaEliminar(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar factura</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{facturaParaEliminar.nombre}</span>.
              </p>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingInvoice}
                onClick={() => {
                  setIsDeleteInvoiceModalOpen(false)
                  setFacturaParaEliminar(null)
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingInvoice}
                onClick={handleConfirmEliminarFactura}
              >
                {isDeletingInvoice ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditClientModalOpen && clientParaEditar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Editar cliente"
          onMouseDown={() => {
            if (isUpdatingClient) return
            setIsEditClientModalOpen(false)
            setClientParaEditar(null)
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <form onSubmit={handleGuardarEdicionCliente}>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-foreground">Editar cliente</h3>
                <p className="mt-2 text-sm text-foreground-secondary">
                  Actualiza los datos y las cuentas preferentes para que aparezcan por defecto al validar.
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={editCliente.name}
                      onChange={(e) => setEditCliente((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      disabled={isUpdatingClient}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CIF/NIF (opcional)</label>
                    <input
                      type="text"
                      value={editCliente.tax_id}
                      onChange={(e) => setEditCliente((p) => ({ ...p, tax_id: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      disabled={isUpdatingClient}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cuenta preferente (Ingresos)
                      </label>
                      <select
                        value={editCliente.preferred_income_account}
                        onChange={(e) =>
                          setEditCliente((p) => ({ ...p, preferred_income_account: e.target.value }))
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        disabled={isUpdatingClient}
                      >
                        <option value="700">700 - Ventas</option>
                        <option value="705">705 - Prestaciones de servicios</option>
                        <option value="708">708 - Devoluciones y descuentos</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Cuenta preferente (Gastos)
                      </label>
                      <select
                        value={editCliente.preferred_expense_account}
                        onChange={(e) =>
                          setEditCliente((p) => ({ ...p, preferred_expense_account: e.target.value }))
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        disabled={isUpdatingClient}
                      >
                        <option value="600">600</option>
                        <option value="620">620</option>
                        <option value="621">621</option>
                        <option value="628">628</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6 flex justify-end gap-3">
                <button
                  type="button"
                  className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUpdatingClient}
                  onClick={() => {
                    setIsEditClientModalOpen(false)
                    setClientParaEditar(null)
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isUpdatingClient}
                >
                  {isUpdatingClient ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteClientModalOpen && clientParaEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de cliente"
          onMouseDown={() => {
            if (isDeletingClient) return
            setIsDeleteClientModalOpen(false)
            setClientParaEliminar(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground">Eliminar cliente</h3>
              <p className="mt-2 text-sm text-foreground-secondary leading-relaxed">
                Vas a eliminar <span className="font-semibold text-foreground">{clientParaEliminar.name}</span>.
              </p>
              <p className="mt-2 text-xs text-foreground-secondary">
                Si este cliente tiene subidas, no se podrá eliminar hasta borrarlas.
              </p>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                type="button"
                className="px-5 py-3 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingClient}
                onClick={() => {
                  setIsDeleteClientModalOpen(false)
                  setClientParaEliminar(null)
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-5 py-3 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isDeletingClient}
                onClick={handleConfirmEliminarCliente}
              >
                {isDeletingClient ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

