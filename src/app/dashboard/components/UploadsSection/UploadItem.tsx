'use client';

import { SubidaFacturas } from '@/types/dashboard';

interface UploadItemProps {
  subida: SubidaFacturas;
  isSelected: boolean;
  isEditing: boolean;
  editingNombre: string;
  onSelect: () => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditingNombreChange: (nombre: string) => void;
  onDelete: () => void;
}

export function UploadItem({
  subida,
  isSelected,
  isEditing,
  editingNombre,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingNombreChange,
  onDelete,
}: UploadItemProps) {
  return (
    <div
      className={`
        w-full p-3 rounded-lg border transition-colors
        ${isSelected
          ? 'border-primary bg-primary-lighter'
          : 'border-gray-200 hover:border-gray-200 hover:bg-gray-50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="relative">
              <input
                value={editingNombre}
                onChange={(e) => onEditingNombreChange(e.target.value)}
                className="w-full px-3 py-2 pr-16 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveEdit();
                  if (e.key === 'Escape') onCancelEdit();
                }}
              />

              <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={onSaveEdit}
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
                  onClick={onCancelEdit}
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
              onClick={onSelect}
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

        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartEdit}
              className="text-foreground-secondary hover:text-foreground transition-colors mt-1"
              aria-label="Renombrar subida"
              title="Renombrar"
            >
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

            {subida.uploadId && (
              <button
                type="button"
                onClick={onDelete}
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
  );
}
