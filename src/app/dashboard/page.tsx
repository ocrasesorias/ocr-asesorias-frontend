'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
// Custom hooks
import { useDashboardAuth } from '@/hooks/useDashboardAuth';
import { useInvoiceCounter } from '@/hooks/useInvoiceCounter';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useUploadManagement } from '@/hooks/useUploadManagement';
import { useInvoiceProcessing } from '@/hooks/useInvoiceProcessing';
// Components
import { DashboardHeader } from './components/DashboardHeader';
import { ClientSection } from './components/ClientSection/ClientSection';
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

export default function DashboardPage() {
  // ============================================================================
  // HOOKS
  // ============================================================================
  
  // Authentication & Organization
  const { organizationName, orgId, isLoading: isLoadingAuth } = useDashboardAuth();
  
  // Invoice Counter
  const {
    creditsBalance,
    isLoading: isLoadingCredits,
    refresh: refreshInvoiceCounter,
  } = useInvoiceCounter(orgId);
  
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
  } = useClientManagement(orgId);
  
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

  // ============================================================================
  // RENDER
  // ============================================================================
  
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-foreground-secondary">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        organizationName={organizationName}
        creditsBalance={creditsBalance}
        isLoadingCredits={isLoadingCredits}
        orgId={orgId}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Client & Uploads */}
          <div className="lg:col-span-1 space-y-6">
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
            />

            {clienteSeleccionado && subidasFacturas.length > 0 && (
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
              />
            )}
          </div>

          {/* Right Column: Files */}
          <div className="lg:col-span-2">
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
    </div>
  );
}
