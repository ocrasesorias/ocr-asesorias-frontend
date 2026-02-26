'use client';

import { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Histórico de subidas
          </h3>
          <p className="text-sm text-foreground-secondary mt-0.5">
            Selecciona una subida para seguir trabajando
          </p>
        </div>
        <span
          className={`shrink-0 text-foreground-secondary transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {isExpanded && (
      <div className="px-6 pb-6 pt-0">
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
      )}
    </div>
  );
}
