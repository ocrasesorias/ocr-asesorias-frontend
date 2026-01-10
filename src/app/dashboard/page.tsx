'use client';

import { useState, useCallback, useEffect } from 'react';
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

export default function DashboardPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [organizationName, setOrganizationName] = useState<string>('');
  const [orgId, setOrgId] = useState<string | null>(null);
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
  const [nuevoCliente, setNuevoCliente] = useState({ name: '', tax_id: '' });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [subidaParaEliminar, setSubidaParaEliminar] = useState<SubidaFacturas | null>(null)
  const [isDeletingUpload, setIsDeletingUpload] = useState(false)
  const [isDeleteInvoiceModalOpen, setIsDeleteInvoiceModalOpen] = useState(false)
  const [facturaParaEliminar, setFacturaParaEliminar] = useState<ArchivoSubido | null>(null)
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false)

  const hasProcessingInvoices = archivosSubidos.some(
    (a) => a.estado === 'procesando' || a.estado === 'pendiente'
  )

  const canValidate =
    !!subidaActual?.uploadId &&
    archivosSubidos.length > 0 &&
    !archivosSubidos.some((a) => a.estado === 'procesando' || a.estado === 'pendiente' || a.estado === 'error')

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
    setIsChoosingTipoSubida(false);
    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');

    // Cargar subidas reales del backend para este cliente
    if (clienteId) {
      ;(async () => {
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
            tipo: 'gasto',
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
      setNuevoCliente({ name: '', tax_id: '' });
      setMostrarNuevoCliente(false);
      
      showSuccess('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error al crear cliente:', error);
      showError('Error al crear el cliente. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingClient(false);
    }
  };

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

  const handleGuardarNombreSubida = (subidaId: string) => {
    const nuevoNombre = subidaEditandoNombre.trim();
    if (!nuevoNombre) {
      showError('El nombre no puede estar vacío');
      return;
    }

    setSubidasFacturas(prev =>
      prev.map(s => (s.id === subidaId ? { ...s, nombre: nuevoNombre } : s))
    );
    if (subidaActual?.id === subidaId) {
      setSubidaActual(prev => (prev ? { ...prev, nombre: nuevoNombre } : prev));
    }

    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');
    showSuccess('Nombre de la subida actualizado');
  };

  // Seleccionar subida existente
  const handleSeleccionarSubida = useCallback((subida: SubidaFacturas) => {
    setSubidaActual(subida);
    setArchivosSubidos(subida.archivos);
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
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la subida')
    } finally {
      setIsDeletingUpload(false)
    }
  }, [showError, showSuccess, subidaActual, subidaParaEliminar]);

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
          body: JSON.stringify({ name: subidaActual.nombre, client_id: clienteSeleccionado.id }),
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
    const uploaded: ArchivoSubido[] = []
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
        // Si tienes el extractor Python levantado, puedes activar extracción automática:
        fd.append('run_extraction', 'true')

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

        uploaded.push({
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
          // Si el endpoint respondió OK, consideramos el archivo listo (la preview se puede firmar luego)
          estado: 'procesado',
        })
        successCount++
      } catch (e) {
        uploaded.push({
          ...placeholders[i],
          estado: 'error',
          url: '',
        })
        showError(e instanceof Error ? e.message : 'Error subiendo la factura')
      }
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

    // Reemplazar placeholders por resultados finales (manteniendo orden)
    setArchivosSubidos(prev => {
      const byId = new Map(uploaded.map(a => [a.id, a]))
      const merged = prev.map(a => byId.get(a.id) || a)

      // persistir en subidaActual/subidasFacturas
      setSubidasFacturas(sPrev =>
        sPrev.map(s => (s.uploadId === realUploadId ? { ...s, archivos: merged } : s))
      )
      setSubidaActual(sPrev => (sPrev ? { ...sPrev, archivos: merged } : null))

      return merged
    })
  }, [subidaActual, archivosSubidos, showError, clienteSeleccionado, setSubidasFacturas]);

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
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Error eliminando la factura')
    } finally {
      setIsDeletingInvoice(false)
    }
  }, [archivosSubidos, facturaParaEliminar, subidaActual, showError, showSuccess]);

  // Ir a validar facturas
  const handleValidarFacturas = useCallback(() => {
    if (!subidaActual || archivosSubidos.length === 0) {
      showError('Por favor, sube al menos un archivo antes de validar');
      return;
    }
    if (!subidaActual.uploadId) {
      showError('La subida aún no está guardada. Sube al menos una factura primero.');
      return;
    }
    if (archivosSubidos.some((a) => a.estado === 'procesando' || a.estado === 'pendiente')) {
      showError('Aún se están procesando las facturas. Espera a que estén en "Listo".');
      return;
    }
    if (archivosSubidos.some((a) => a.estado === 'error')) {
      showError('Hay facturas con error. Elimina o reintenta antes de validar.');
      return;
    }

    // Pasamos el tipo para que la pantalla de validación adapte los campos (gasto vs ingreso)
    try {
      sessionStorage.setItem(`upload:${subidaActual.uploadId}:tipo`, subidaActual.tipo)
    } catch {
      // noop
    }
    router.push(`/dashboard/uploads/${subidaActual.uploadId}/validar?tipo=${encodeURIComponent(subidaActual.tipo)}`);
  }, [subidaActual, archivosSubidos, router, showError]);

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
              <button
                type="button"
                onClick={handleLogout}
                className="text-foreground-secondary hover:text-foreground transition-colors"
              >
                Cerrar sesión
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-light text-foreground mb-2">
            {organizationName || 'Dashboard'}
          </h2>
          <p className="text-foreground-secondary">
            Gestiona las facturas de tus clientes
          </p>
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
                        setNuevoCliente({ name: '', tax_id: '' });
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
                          ${
                            subidaActual?.id === subida.id
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
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16.862 4.487a2.25 2.25 0 113.182 3.182L7.125 20.588a4.5 4.5 0 01-1.897 1.13l-2.04.68.68-2.04a4.5 4.5 0 011.13-1.897L16.862 4.487z"
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
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
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
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {subidaActual.nombre}
                  </h3>
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
                />

                {archivosSubidos.length > 0 && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={handleValidarFacturas}
                      disabled={!canValidate}
                    >
                      <span className="inline-flex items-center justify-center gap-2 font-light">
                        {hasProcessingInvoices
                          ? 'Procesando...'
                          : `Validar ${archivosSubidos.length} factura${archivosSubidos.length !== 1 ? 's' : ''}`}
                        {!hasProcessingInvoices && (
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
                Se borrarán también todas sus facturas asociadas y sus archivos del bucket.
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
                Se borrará también su registro y el archivo del bucket (si existe en Supabase).
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
    </div>
  );
}

