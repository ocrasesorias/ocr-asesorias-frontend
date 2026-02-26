import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { Cliente } from '@/types/dashboard';
import { safeGetItem, safeSetItem, safeRemoveItem } from '@/utils/safeStorage';

/**
 * Hook para gestionar clientes (CRUD completo)
 */
export function useClientManagement(orgId: string | null) {
  const { showError, showSuccess } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({
    name: '',
    tax_id: '',
    address: '',
    preferred_income_account: '700',
    preferred_expense_account: '600',
    activity_description: '',
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = useState(false);
  const [clientParaEditar, setClientParaEditar] = useState<Cliente | null>(null);
  const [clientParaEliminar, setClientParaEliminar] = useState<Cliente | null>(null);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [editCliente, setEditCliente] = useState({
    name: '',
    tax_id: '',
    address: '',
    preferred_income_account: '700',
    preferred_expense_account: '600',
    activity_description: '',
  });

  // Cargar clientes desde la API (usa orgId del servidor con requireAuth) para evitar
  // ver clientes de otra gestoría si el usuario tiene varias orgs o datos duplicados.
  useEffect(() => {
    if (!orgId) return;

    const loadClients = async () => {
      try {
        const res = await fetch('/api/clients');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.error('Error al cargar clientes:', data?.error);
          showError(data?.error || 'Error al cargar los clientes');
          return;
        }
        const list = Array.isArray(data.clients) ? data.clients : [];
        setClientes(list as Cliente[]);
      } catch (e) {
        console.error('Error al cargar clientes:', e);
        showError('Error al cargar los clientes');
      }
    };

    loadClients();
  }, [orgId, showError]);

  // Manejar cambio de cliente seleccionado
  const handleClienteChange = useCallback((clienteId: string, onClientChange?: (clienteId: string) => void) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setClienteSeleccionado(cliente || null);

    // Persistir selección
    if (orgId) {
      const key = `dashboard:selectedClientId:${orgId}`;
      if (clienteId) safeSetItem(key, clienteId);
      else safeRemoveItem(key);
    }

    // Callback externo para resetear subidas
    if (onClientChange) {
      onClientChange(clienteId);
    }
  }, [clientes, orgId]);

  // Restaurar cliente seleccionado desde sessionStorage
  useEffect(() => {
    if (!orgId) return;
    if (clienteSeleccionado) return;
    if (clientes.length === 0) return;

    const key = `dashboard:selectedClientId:${orgId}`;
    const savedId = safeGetItem(key);
    if (!savedId) return;

    const exists = clientes.some(c => c.id === savedId);
    if (exists) handleClienteChange(savedId);
  }, [orgId, clientes, clienteSeleccionado, handleClienteChange]);

  // Crear cliente
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
          address: nuevoCliente.address?.trim() || null,
          preferred_income_account: nuevoCliente.preferred_income_account || null,
          preferred_expense_account: nuevoCliente.preferred_expense_account || null,
          activity_description: nuevoCliente.activity_description?.trim() || null,
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
        safeSetItem(`dashboard:selectedClientId:${orgId}`, data.client.id);
      }

      // Limpiar el formulario y cerrar
      setNuevoCliente({ name: '', tax_id: '', address: '', preferred_income_account: '700', preferred_expense_account: '600', activity_description: '' });
      setMostrarNuevoCliente(false);

      showSuccess('Cliente creado exitosamente');
    } catch (error) {
      console.error('Error al crear cliente:', error);
      showError('Error al crear el cliente. Por favor, intenta de nuevo.');
    } finally {
      setIsCreatingClient(false);
    }
  };

  // Abrir modal de edición
  const openEditClient = (c: Cliente) => {
    setClientParaEditar(c);
    setEditCliente({
      name: c.name || '',
      tax_id: c.tax_id || '',
      address: c.address || '',
      preferred_income_account: c.preferred_income_account || '700',
      preferred_expense_account: c.preferred_expense_account || '600',
      activity_description: c.activity_description || '',
    });
    setIsEditClientModalOpen(true);
  };

  // Guardar edición de cliente
  const handleGuardarEdicionCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientParaEditar) return;
    if (!editCliente.name.trim()) {
      showError('El nombre del cliente es requerido');
      return;
    }
    setIsUpdatingClient(true);
    try {
      const resp = await fetch(`/api/clients/${clientParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCliente.name.trim(),
          tax_id: editCliente.tax_id.trim() || null,
          address: editCliente.address?.trim() || null,
          preferred_income_account: editCliente.preferred_income_account || null,
          preferred_expense_account: editCliente.preferred_expense_account || null,
          activity_description: editCliente.activity_description?.trim() || null,
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'Error actualizando el cliente');

      const updated = data?.client as Cliente;
      setClientes((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setClienteSeleccionado(updated);
      showSuccess('Cliente actualizado');
      setIsEditClientModalOpen(false);
      setClientParaEditar(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error actualizando el cliente');
    } finally {
      setIsUpdatingClient(false);
    }
  };

  // Confirmar eliminación de cliente
  const handleConfirmEliminarCliente = useCallback(async () => {
    if (!clientParaEliminar) return;
    setIsDeletingClient(true);
    try {
      const resp = await fetch(`/api/clients/${clientParaEliminar.id}`, { method: 'DELETE' });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'Error eliminando el cliente');

      setClientes((prev) => prev.filter((c) => c.id !== clientParaEliminar.id));
      if (clienteSeleccionado?.id === clientParaEliminar.id) setClienteSeleccionado(null);
      showSuccess('Cliente eliminado');
      setIsDeleteClientModalOpen(false);
      setClientParaEliminar(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error eliminando el cliente');
    } finally {
      setIsDeletingClient(false);
    }
  }, [clientParaEliminar, clienteSeleccionado?.id, showError, showSuccess]);

  return {
    clientes,
    clienteSeleccionado,
    mostrarNuevoCliente,
    setMostrarNuevoCliente,
    nuevoCliente,
    setNuevoCliente,
    isCreatingClient,
    isEditModalOpen: isEditClientModalOpen,
    clienteParaEditar: clientParaEditar,
    editCliente,
    setEditCliente,
    isUpdatingClient,
    isDeleteModalOpen: isDeleteClientModalOpen,
    clienteParaEliminar: clientParaEliminar,
    isDeletingClient,
    handleClienteChange,
    handleCrearCliente,
    handleCancelCrearCliente: () => {
      setMostrarNuevoCliente(false);
      setNuevoCliente({ name: '', tax_id: '', address: '', preferred_income_account: '700', preferred_expense_account: '600', activity_description: '' });
    },
    handleEditClient: openEditClient,
    handleSaveEditClient: handleGuardarEdicionCliente,
    handleCancelEditClient: () => {
      setIsEditClientModalOpen(false);
      setClientParaEditar(null);
    },
    handleDeleteClient: (client: Cliente) => {
      setClientParaEliminar(client);
      setIsDeleteClientModalOpen(true);
    },
    handleConfirmDeleteClient: handleConfirmEliminarCliente,
    handleCancelDeleteClient: () => {
      setIsDeleteClientModalOpen(false);
      setClientParaEliminar(null);
    },
  };
}
