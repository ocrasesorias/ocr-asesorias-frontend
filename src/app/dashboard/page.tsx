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
  const [subidaEditandoId, setSubidaEditandoId] = useState<string | null>(null);
  const [subidaEditandoNombre, setSubidaEditandoNombre] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ name: '', tax_id: '' });
  const [isCreatingClient, setIsCreatingClient] = useState(false);

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
    
    // Cargar subidas del cliente (en producción sería una llamada API)
    // (por ahora no cargamos nada aquí; solo reseteamos la selección)
    setSubidaActual(null);
    setArchivosSubidos([]);
    setSubidaEditandoId(null);
    setSubidaEditandoNombre('');
  }, [clientes, orgId]);

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

    const nuevaSubida: SubidaFacturas = {
      id: Date.now().toString(),
      clienteId: clienteSeleccionado.id,
      nombre: getNombreSubidaPorDefecto(),
      fechaCreacion: new Date().toISOString(),
      estado: 'pendiente',
      archivos: [],
    };

    setSubidasFacturas(prev => [...prev, nuevaSubida]);
    setSubidaActual(nuevaSubida);
    setArchivosSubidos([]);
  }, [clienteSeleccionado]);

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

  // Manejar archivos seleccionados
  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!subidaActual) {
      showError('Por favor, crea o selecciona una subida primero');
      return;
    }
    if (!orgId) {
      showError('No se ha podido determinar la organización');
      return;
    }

    const supabase = createClient();
    const bucket = 'invoices';

    const nuevosArchivos: ArchivoSubido[] = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      nombre: file.name,
      tamaño: file.size,
      tipo: file.type,
      url: '', // se completará con URL firmada tras el upload
      bucket,
      fechaSubida: new Date().toISOString(),
      estado: 'procesando',
    }));

    const archivosActualizados = [...archivosSubidos, ...nuevosArchivos];
    setArchivosSubidos(archivosActualizados);

    // Actualizar la subida con los nuevos archivos
    setSubidasFacturas(prev =>
      prev.map(s =>
        s.id === subidaActual.id
          ? { ...s, archivos: archivosActualizados }
          : s
      )
    );
    setSubidaActual(prev => prev ? { ...prev, archivos: archivosActualizados } : null);

    // Subir archivos a Storage y generar URL firmada
    await Promise.all(
      nuevosArchivos.map(async (archivoMeta, idx) => {
        const file = files[idx];
        const safeName = file.name.replace(/[^\w.\-() ]+/g, '_');
        const storagePath = `${orgId}/${clienteSeleccionado?.id || 'unknown-client'}/${subidaActual.id}/${archivoMeta.id}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(storagePath, file, { upsert: false, contentType: file.type });

        if (uploadError) {
          console.error('Error subiendo archivo:', uploadError);
          setArchivosSubidos(prev =>
            prev.map(a => (a.id === archivoMeta.id ? { ...a, estado: 'error' } : a))
          );
          return;
        }

        const { data: signed, error: signedErr } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 60 * 60);

        if (signedErr || !signed?.signedUrl) {
          console.error('Error creando URL firmada:', signedErr);
          setArchivosSubidos(prev =>
            prev.map(a => (a.id === archivoMeta.id ? { ...a, storagePath, estado: 'error' } : a))
          );
          return;
        }

        setArchivosSubidos(prev =>
          prev.map(a =>
            a.id === archivoMeta.id
              ? { ...a, storagePath, url: signed.signedUrl, estado: 'pendiente' }
              : a
          )
        );

        // Mantener subidaActual y subidasFacturas sincronizadas
        setSubidasFacturas(prev =>
          prev.map(s => {
            if (s.id !== subidaActual.id) return s;
            return {
              ...s,
              archivos: s.archivos.map(a =>
                a.id === archivoMeta.id
                  ? { ...a, storagePath, url: signed.signedUrl, estado: 'pendiente' }
                  : a
              ),
            };
          })
        );
        setSubidaActual(prev =>
          prev
            ? {
                ...prev,
                archivos: prev.archivos.map(a =>
                  a.id === archivoMeta.id
                    ? { ...a, storagePath, url: signed.signedUrl, estado: 'pendiente' }
                    : a
                ),
              }
            : prev
        );
      })
    );
  }, [subidaActual, archivosSubidos, showError, orgId, clienteSeleccionado?.id]);

  // Eliminar archivo
  const handleRemoveFile = useCallback(async (fileId: string) => {
    const fileToRemove = archivosSubidos.find(f => f.id === fileId);
    const archivosActualizados = archivosSubidos.filter(f => f.id !== fileId);
    setArchivosSubidos(archivosActualizados);

    if (subidaActual) {
      setSubidasFacturas(prev =>
        prev.map(s =>
          s.id === subidaActual.id
            ? { ...s, archivos: archivosActualizados }
            : s
        )
      );
      setSubidaActual(prev => prev ? { ...prev, archivos: archivosActualizados } : null);
    }

    // Si el archivo estaba subido a Storage, intentamos borrarlo
    if (fileToRemove?.bucket && fileToRemove.storagePath) {
      const supabase = createClient();
      await supabase.storage.from(fileToRemove.bucket).remove([fileToRemove.storagePath]);
    }
  }, [archivosSubidos, subidaActual]);

  // Ir a validar facturas
  const handleValidarFacturas = useCallback(() => {
    if (!subidaActual || archivosSubidos.length === 0) {
      showError('Por favor, sube al menos un archivo antes de validar');
      return;
    }

    // Guardar los archivos en sessionStorage o pasar por query params
    // Por ahora usaremos sessionStorage
    sessionStorage.setItem('archivosSubidos', JSON.stringify(archivosSubidos));
    sessionStorage.setItem('subidaActual', JSON.stringify(subidaActual));
    sessionStorage.setItem('clienteSeleccionado', JSON.stringify(clienteSeleccionado));

    router.push('/validar-factura');
  }, [subidaActual, archivosSubidos, clienteSeleccionado, router, showError]);

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
                alt="Atajo"
                width={100}
                height={100}
                className="h-10 w-auto"
                priority
              />
              <span className="text-2xl font-bold text-primary">Atajo</span>
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

                  {clienteSeleccionado && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg text-foreground">
                      <p className="text-sm font-medium text-foreground">
                        {clienteSeleccionado.name}
                      </p>
                      {clienteSeleccionado.tax_id && (
                        <p className="text-xs text-foreground-secondary mt-1">
                          CIF/NIF: {clienteSeleccionado.tax_id}
                        </p>
                      )}
                    </div>
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
                    >
                      Validar {archivosSubidos.length} factura{archivosSubidos.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

