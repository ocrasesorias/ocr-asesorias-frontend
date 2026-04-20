'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
// Custom hooks
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { useInvoiceCounter } from '@/hooks/useInvoiceCounter';
import { useSubscription } from '@/hooks/useSubscription';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSupplierManagement } from '@/hooks/useSupplierManagement';
import { useUploadManagement } from '@/hooks/useUploadManagement';
import { useInvoiceProcessing } from '@/hooks/useInvoiceProcessing';
// Components
import { DashboardHeader } from './components/DashboardHeader';
import { ClientSection } from './components/ClientSection/ClientSection';
import { SuppliersSection } from './components/SuppliersSection/SuppliersSection';
import { UploadsSection } from './components/UploadsSection/UploadsSection';
import { FilesSection } from './components/FilesSection/FilesSection';

// Modales cargados dinámicamente (solo se renderizan condicionalmente)
const EditClientModal = dynamic(
  () => import('./components/ClientSection/EditClientModal').then((m) => m.EditClientModal),
  { ssr: false }
);
const DeleteClientModal = dynamic(
  () => import('./components/ClientSection/DeleteClientModal').then((m) => m.DeleteClientModal),
  { ssr: false }
);
const DeleteUploadModal = dynamic(
  () => import('./components/modals/DeleteUploadModal').then((m) => m.DeleteUploadModal),
  { ssr: false }
);
const DeleteInvoiceModal = dynamic(
  () => import('./components/modals/DeleteInvoiceModal').then((m) => m.DeleteInvoiceModal),
  { ssr: false }
);
const RevisarSplitFacturas = dynamic(
  () => import('@/components/RevisarSplitFacturas').then((m) => m.RevisarSplitFacturas),
  { ssr: false }
);

export default function DashboardPage() {
  // ============================================================================
  // HOOKS
  // ============================================================================
  
  // Authentication & Organization
  const { organizationName, orgId, userRole, isLoading: isLoadingAuth } = useDashboardAuth();
  
  // Invoice Counter
  const {
    creditsBalance,
    isUnlimited: isUnlimitedCredits,
    isLoading: isLoadingCredits,
    refresh: refreshInvoiceCounter,
  } = useInvoiceCounter(orgId);

  // Subscription
  const { subscription } = useSubscription(orgId);
  
  // Client Management
  const {
    clientes,
    clienteSeleccionado,
    mostrarNuevoCliente,
    setMostrarNuevoCliente,
    nuevoCliente,
    setNuevoCliente,
    isCreatingClient,
    isEditModalOpen,
    clienteParaEditar,
    editCliente,
    setEditCliente,
    isUpdatingClient,
    isDeleteModalOpen,
    clienteParaEliminar,
    isDeletingClient,
    handleClienteChange,
    handleCrearCliente,
    handleCancelCrearCliente,
    handleEditClient,
    handleSaveEditClient,
    handleCancelEditClient,
    handleDeleteClient,
    handleConfirmDeleteClient,
    handleCancelDeleteClient,
    handleBulkDeleteClients,
  } = useClientManagement(orgId);

  // Supplier Management (proveedores del cliente seleccionado)
  const {
    suppliers,
    isLoading: isLoadingSuppliers,
    mostrarNuevoProveedor,
    setMostrarNuevoProveedor,
    nuevoProveedor,
    setNuevoProveedor,
    isCreating: isCreatingSupplier,
    handleCrearProveedor,
    handleCancelCrearProveedor,
    isEditModalOpen: isEditSupplierModalOpen,
    proveedorParaEditar,
    editProveedor,
    setEditProveedor,
    isUpdating: isUpdatingSupplier,
    openEditProveedor,
    handleGuardarEdicionProveedor,
    handleCancelEditProveedor,
    isDeleteModalOpen: isDeleteSupplierModalOpen,
    proveedorParaEliminar,
    isDeleting: isDeletingSupplier,
    openDeleteProveedor,
    handleConfirmEliminarProveedor,
    handleCancelDeleteProveedor,
    handleBulkDeleteSuppliers,
  } = useSupplierManagement(clienteSeleccionado?.id ?? null, orgId);
  
  // Upload Management
  const {
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
    isDeleteModalOpen: isDeleteUploadModalOpen,
    setIsDeleteModalOpen: setIsDeleteUploadModalOpen,
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
    handleBulkDeleteUploads,
  } = useUploadManagement();
  
  // Invoice Processing
  const {
    archivosSubidos,
    extractStatusByInvoiceId,
    sessionInvoiceIds,
    hasUploadingFiles,
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
    pendingSplitDetections,
    dismissSplitDetections,
  } = useInvoiceProcessing();

  // ============================================================================
  // EFFECTS
  // ============================================================================
  
  // Load uploads when client changes
  useEffect(() => {
    if (!clienteSeleccionado) {
      setSubidasFacturas([]);
      setSubidaActual(null);
      resetProcessingState();
      return;
    }
    void loadUploadsForClient(clienteSeleccionado.id);
  }, [clienteSeleccionado, loadUploadsForClient, resetProcessingState, setSubidasFacturas, setSubidaActual]);

  // Pump extraction queue
  useEffect(() => {
    if (sessionInvoiceIds.length === 0) return;
    pumpExtractQueue(setSubidasFacturas, setSubidaActual);
  }, [sessionInvoiceIds, pumpExtractQueue, setSubidasFacturas, setSubidaActual]);

  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  const handleClienteChangeWrapper = (clienteId: string) => {
    handleClienteChange(clienteId);
    handleDeseleccionarSubida();
    resetProcessingState();
  };

  const handleCrearSubidaWrapper = () => {
    if (!clienteSeleccionado) return;
    handleCrearSubida(clienteSeleccionado.id);
  };

  const handleCrearSubidaConTipoWrapper = (tipo: 'gasto' | 'ingreso') => {
    if (!clienteSeleccionado) return;
    handleCrearSubidaConTipo(tipo, clienteSeleccionado.id, resetProcessingState);
  };

  const handleSeleccionarSubidaWrapper = (subida: typeof subidaActual) => {
    if (!subida) return;
    handleSeleccionarSubida(subida, syncProcessingStateForUpload);
  };

  const handleFilesSelectedWrapper = (files: File[]) => {
    if (!clienteSeleccionado) return;
    void handleFilesSelected(
      files,
      subidaActual,
      clienteSeleccionado.id,
      setSubidasFacturas,
      setSubidaActual,
      refreshInvoiceCounter
    );
  };

  const handleConfirmEliminarFacturaWrapper = () => {
    void handleConfirmEliminarFactura(
      subidaActual,
      setSubidasFacturas,
      setSubidaActual,
      refreshInvoiceCounter
    );
  };

  const handleConfirmEliminarSubidaWrapper = () => {
    void handleConfirmEliminarSubida(refreshInvoiceCounter);
  };

  const handleValidarFacturasWrapper = (view: 'pending' | 'all') => {
    handleValidarFacturas(view, subidaActual);
  };

  const handleValidarFacturaConcreto = (invoiceId: string) => {
    handleValidarFacturas('all', subidaActual, invoiceId);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse">
          <img src="/img/logo.png" alt="KontaScan" className="h-16 w-auto mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--l-bg,#f9fafb)]">
      <DashboardHeader
        organizationName={organizationName}
        creditsBalance={creditsBalance}
        isLoadingCredits={isLoadingCredits}
        isUnlimitedCredits={isUnlimitedCredits}
        orgId={orgId}
        planName={subscription.planName}
        subscriptionStatus={subscription.status}
        isTrial={subscription.isTrial}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column: Client & Uploads */}
          <div className="md:col-span-1 space-y-6">
            <ClientSection
              clientes={clientes}
              clienteSeleccionado={clienteSeleccionado}
              mostrarNuevoCliente={mostrarNuevoCliente}
              setMostrarNuevoCliente={setMostrarNuevoCliente}
              nuevoCliente={nuevoCliente}
              setNuevoCliente={setNuevoCliente}
              isCreatingClient={isCreatingClient}
              onClienteChange={handleClienteChangeWrapper}
              onCrearCliente={handleCrearCliente}
              onCancelCrearCliente={handleCancelCrearCliente}
              onEditClient={handleEditClient}
              onDeleteClient={handleDeleteClient}
              onBulkDelete={handleBulkDeleteClients}
              canDelete={userRole === 'owner'}
            />

            {clienteSeleccionado && (
              <UploadsSection
                subidas={subidasFacturas}
                subidaActual={subidaActual}
                subidaEditandoId={subidaEditandoId}
                subidaEditandoNombre={subidaEditandoNombre}
                onSelectSubida={handleSeleccionarSubidaWrapper}
                onStartEdit={(subida) => {
                  setSubidaEditandoId(subida.id);
                  setSubidaEditandoNombre(subida.nombre);
                }}
                onSaveEdit={handleGuardarNombreSubida}
                onCancelEdit={() => {
                  setSubidaEditandoId(null);
                  setSubidaEditandoNombre('');
                }}
                onEditingNombreChange={setSubidaEditandoNombre}
                onDeleteSubida={handleEliminarSubida}
                onBulkDelete={(ids) => handleBulkDeleteUploads(ids, refreshInvoiceCounter)}
              />
            )}

            {clienteSeleccionado && (
              <SuppliersSection
                clientName={clienteSeleccionado.name || 'Cliente'}
                suppliers={suppliers}
                isLoading={isLoadingSuppliers}
                mostrarNuevoProveedor={mostrarNuevoProveedor}
                setMostrarNuevoProveedor={setMostrarNuevoProveedor}
                nuevoProveedor={nuevoProveedor}
                setNuevoProveedor={setNuevoProveedor}
                isCreating={isCreatingSupplier}
                onCrearProveedor={handleCrearProveedor}
                onCancelCrearProveedor={handleCancelCrearProveedor}
                isEditModalOpen={isEditSupplierModalOpen}
                proveedorParaEditar={proveedorParaEditar}
                editProveedor={editProveedor}
                setEditProveedor={setEditProveedor}
                isUpdating={isUpdatingSupplier}
                onEditProveedor={openEditProveedor}
                onGuardarEdicionProveedor={handleGuardarEdicionProveedor}
                onCancelEditProveedor={handleCancelEditProveedor}
                isDeleteModalOpen={isDeleteSupplierModalOpen}
                proveedorParaEliminar={proveedorParaEliminar}
                isDeleting={isDeletingSupplier}
                onDeleteProveedor={openDeleteProveedor}
                onConfirmEliminarProveedor={handleConfirmEliminarProveedor}
                onCancelDeleteProveedor={handleCancelDeleteProveedor}
                onBulkDelete={handleBulkDeleteSuppliers}
              />
            )}
          </div>

          {/* Right Column: Files */}
          <div className="md:col-span-2">
            <FilesSection
              clienteSeleccionado={clienteSeleccionado}
              subidaActual={subidaActual}
              isChoosingTipoSubida={isChoosingTipoSubida}
              archivosSubidos={archivosSubidos}
              extractStatusByInvoiceId={extractStatusByInvoiceId}
              statusMessage={statusMessage}
              dbCounts={dbCounts}
              readyCount={readyCount}
              currentSessionInvoiceIds={currentSessionInvoiceIds}
              hasUploadingFiles={hasUploadingFiles}
              isAllReady={isAllReady}
              canValidate={canValidate}
              onCrearSubida={handleCrearSubidaWrapper}
              onCrearSubidaConTipo={handleCrearSubidaConTipoWrapper}
              onCancelarTipoSubida={() => setIsChoosingTipoSubida(false)}
              onFilesSelected={handleFilesSelectedWrapper}
              onRemoveFile={handleRemoveFile}
              onValidarFacturas={handleValidarFacturasWrapper}
              onValidarFactura={handleValidarFacturaConcreto}
              onDeseleccionarSubida={handleDeseleccionarSubida}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <EditClientModal
        isOpen={isEditModalOpen}
        client={clienteParaEditar}
        editCliente={editCliente}
        setEditCliente={setEditCliente}
        isUpdating={isUpdatingClient}
        onSave={handleSaveEditClient}
        onClose={handleCancelEditClient}
      />

      <DeleteClientModal
        isOpen={isDeleteModalOpen}
        client={clienteParaEliminar}
        isDeleting={isDeletingClient}
        onConfirm={handleConfirmDeleteClient}
        onClose={handleCancelDeleteClient}
      />

      <DeleteUploadModal
        isOpen={isDeleteUploadModalOpen}
        subida={subidaParaEliminar}
        isDeleting={isDeletingUpload}
        onConfirm={handleConfirmEliminarSubidaWrapper}
        onClose={() => setIsDeleteUploadModalOpen(false)}
      />

      <DeleteInvoiceModal
        isOpen={isDeleteInvoiceModalOpen}
        factura={facturaParaEliminar}
        isDeleting={isDeletingInvoice}
        onConfirm={handleConfirmEliminarFacturaWrapper}
        onClose={() => setIsDeleteInvoiceModalOpen(false)}
      />

      <RevisarSplitFacturas
        isOpen={pendingSplitDetections.length > 0}
        detections={pendingSplitDetections}
        onClose={dismissSplitDetections}
      />
    </div>
  );
}
