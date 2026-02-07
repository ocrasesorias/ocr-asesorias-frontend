'use client';

import { SubidaFacturas } from '@/types/dashboard';
import { UploadItem } from './UploadItem';

interface UploadsSectionProps {
  subidas: SubidaFacturas[];
  subidaActual: SubidaFacturas | null;
  subidaEditandoId: string | null;
  subidaEditandoNombre: string;
  onSelectSubida: (subida: SubidaFacturas) => void;
  onStartEdit: (subida: SubidaFacturas) => void;
  onSaveEdit: (subidaId: string) => void;
  onCancelEdit: () => void;
  onEditingNombreChange: (nombre: string) => void;
  onDeleteSubida: (subida: SubidaFacturas) => void;
}

export function UploadsSection({
  subidas,
  subidaActual,
  subidaEditandoId,
  subidaEditandoNombre,
  onSelectSubida,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingNombreChange,
  onDeleteSubida,
}: UploadsSectionProps) {
  return (
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
        {subidas.length === 0 ? (
          <p className="text-sm text-foreground-secondary text-center py-4">
            No hay subidas todavía.
          </p>
        ) : (
          subidas.map((subida) => (
            <UploadItem
              key={subida.id}
              subida={subida}
              isSelected={subidaActual?.id === subida.id}
              isEditing={subidaEditandoId === subida.id}
              editingNombre={subidaEditandoNombre}
              onSelect={() => onSelectSubida(subida)}
              onStartEdit={() => onStartEdit(subida)}
              onSaveEdit={() => onSaveEdit(subida.id)}
              onCancelEdit={onCancelEdit}
              onEditingNombreChange={onEditingNombreChange}
              onDelete={() => onDeleteSubida(subida)}
            />
          ))
        )}
      </div>
    </div>
  );
}
