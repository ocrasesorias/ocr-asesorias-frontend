import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { translateError } from '@/utils/errorMessages'
import type { Supplier } from '@/types/dashboard'

export type SupplierFormState = {
  name: string
  tax_id: string
  address: string
  postal_code: string
  province: string
}

const emptySupplierForm: SupplierFormState = {
  name: '',
  tax_id: '',
  address: '',
  postal_code: '',
  province: '',
}

/**
 * Hook para gestionar proveedores de un cliente (CRUD)
 */
export function useSupplierManagement(clientId: string | null, orgId: string | null) {
  const { showError, showSuccess } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false)
  const [nuevoProveedor, setNuevoProveedor] = useState<SupplierFormState>({ ...emptySupplierForm })
  const [isCreating, setIsCreating] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [proveedorParaEditar, setProveedorParaEditar] = useState<Supplier | null>(null)
  const [editProveedor, setEditProveedor] = useState<SupplierFormState>({ ...emptySupplierForm })
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [proveedorParaEliminar, setProveedorParaEliminar] = useState<Supplier | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadSuppliers = useCallback(async () => {
    if (!clientId || !orgId) {
      setSuppliers([])
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/suppliers?client_id=${encodeURIComponent(clientId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showError(data?.error || 'Error al cargar proveedores')
        setSuppliers([])
        return
      }
      setSuppliers(Array.isArray(data.suppliers) ? data.suppliers : [])
    } catch (e) {
      console.error('Error al cargar proveedores:', e)
      showError('Error al cargar los proveedores')
      setSuppliers([])
    } finally {
      setIsLoading(false)
    }
  }, [clientId, orgId, showError])

  useEffect(() => {
    void loadSuppliers()
  }, [loadSuppliers])

  const handleCrearProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
    if (!nuevoProveedor.name.trim()) {
      showError('El nombre del proveedor es requerido')
      return
    }
    if (!nuevoProveedor.tax_id.trim() || nuevoProveedor.tax_id.trim().length < 8) {
      showError('El CIF/NIF es requerido y debe tener al menos 8 caracteres')
      return
    }

    setIsCreating(true)
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          name: nuevoProveedor.name.trim(),
          tax_id: nuevoProveedor.tax_id.trim().toUpperCase(),
          address: nuevoProveedor.address.trim() || null,
          postal_code: nuevoProveedor.postal_code.trim() || null,
          province: nuevoProveedor.province.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al crear el proveedor'))
        return
      }
      setSuppliers((prev) => [...prev, data.supplier].sort((a, b) => a.name.localeCompare(b.name)))
      setNuevoProveedor({ ...emptySupplierForm })
      setMostrarNuevoProveedor(false)
      showSuccess('Proveedor creado')
    } catch (err) {
      showError('Error al crear el proveedor')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancelCrearProveedor = () => {
    setMostrarNuevoProveedor(false)
    setNuevoProveedor({ ...emptySupplierForm })
  }

  const openEditProveedor = (s: Supplier) => {
    setProveedorParaEditar(s)
    setEditProveedor({
      name: s.name || '',
      tax_id: s.tax_id || '',
      address: s.address || '',
      postal_code: s.postal_code || '',
      province: s.province || '',
    })
    setIsEditModalOpen(true)
  }

  const handleGuardarEdicionProveedor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!proveedorParaEditar) return
    if (!editProveedor.name.trim()) {
      showError('El nombre del proveedor es requerido')
      return
    }
    if (!editProveedor.tax_id.trim() || editProveedor.tax_id.trim().length < 8) {
      showError('El CIF/NIF es requerido y debe tener al menos 8 caracteres')
      return
    }

    setIsUpdating(true)
    try {
      const res = await fetch(`/api/suppliers/${proveedorParaEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProveedor.name.trim(),
          tax_id: editProveedor.tax_id.trim().toUpperCase(),
          address: editProveedor.address.trim() || null,
          postal_code: editProveedor.postal_code.trim() || null,
          province: editProveedor.province.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al actualizar el proveedor'))
        return
      }
      const updated = data.supplier as Supplier
      setSuppliers((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.name.localeCompare(b.name))
      )
      setIsEditModalOpen(false)
      setProveedorParaEditar(null)
      showSuccess('Proveedor actualizado')
    } catch (err) {
      showError('Error al actualizar el proveedor')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEditProveedor = () => {
    setIsEditModalOpen(false)
    setProveedorParaEditar(null)
  }

  const openDeleteProveedor = (s: Supplier) => {
    setProveedorParaEliminar(s)
    setIsDeleteModalOpen(true)
  }

  const handleConfirmEliminarProveedor = useCallback(async () => {
    if (!proveedorParaEliminar) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/suppliers/${proveedorParaEliminar.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al eliminar el proveedor'))
        return
      }
      setSuppliers((prev) => prev.filter((s) => s.id !== proveedorParaEliminar.id))
      setIsDeleteModalOpen(false)
      setProveedorParaEliminar(null)
      showSuccess('Proveedor eliminado')
    } catch (err) {
      showError('Error al eliminar el proveedor')
    } finally {
      setIsDeleting(false)
    }
  }, [proveedorParaEliminar, showError, showSuccess])

  const handleCancelDeleteProveedor = () => {
    setIsDeleteModalOpen(false)
    setProveedorParaEliminar(null)
  }

  return {
    suppliers,
    isLoading,
    mostrarNuevoProveedor,
    setMostrarNuevoProveedor,
    nuevoProveedor,
    setNuevoProveedor,
    isCreating,
    handleCrearProveedor,
    handleCancelCrearProveedor,
    isEditModalOpen,
    proveedorParaEditar,
    editProveedor,
    setEditProveedor,
    isUpdating,
    openEditProveedor,
    handleGuardarEdicionProveedor,
    handleCancelEditProveedor,
    isDeleteModalOpen,
    proveedorParaEliminar,
    isDeleting,
    openDeleteProveedor,
    handleConfirmEliminarProveedor,
    handleCancelDeleteProveedor,
    refreshSuppliers: loadSuppliers,
  }
}
