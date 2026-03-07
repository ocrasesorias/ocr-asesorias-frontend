'use client';

import { useState } from 'react';
import { useToast } from '@/contexts/ToastContext';
import { translateError } from '@/utils/errorMessages';
import { Button } from '@/components/Button';

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIPOS = [
  { value: '', label: '— Seleccionar —' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'error', label: 'Error o incidencia' },
  { value: 'duda', label: 'Duda' },
  { value: 'otro', label: 'Otro' },
] as const;

export function SuggestionsModal({ isOpen, onClose }: SuggestionsModalProps) {
  const { showError, showSuccess } = useToast();
  const [message, setMessage] = useState('');
  const [type, setType] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 3) {
      showError('Escribe al menos 3 caracteres.');
      return;
    }
    setIsSending(true);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          type: type || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(translateError(data?.error || 'Error al enviar'));
        return;
      }
      showSuccess('Sugerencia enviada. Gracias por tu feedback.');
      setMessage('');
      setType('');
      onClose();
    } catch (err) {
      showError('Error de conexión.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    if (!isSending) onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestions-modal-title"
      onMouseDown={handleClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h3 id="suggestions-modal-title" className="text-lg font-semibold text-foreground">
            Buzón de sugerencias
          </h3>
          <p className="mt-1 text-sm text-foreground-secondary">
            Cuéntanos qué mejorar, si has encontrado un error o tienes una duda.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="suggestions-type" className="block text-sm font-medium text-foreground mb-1">
                Tipo (opcional)
              </label>
              <select
                id="suggestions-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {TIPOS.map((t) => (
                  <option key={t.value || 'none'} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="suggestions-message" className="block text-sm font-medium text-foreground mb-1">
                Mensaje <span className="text-red-500">*</span>
              </label>
              <textarea
                id="suggestions-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe tu sugerencia, error o duda..."
                rows={4}
                required
                minLength={3}
                maxLength={2000}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-foreground text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              />
              <p className="mt-1 text-xs text-foreground-secondary">{message.length}/2000</p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border border-gray-200 text-foreground hover:bg-gray-50 transition-colors disabled:opacity-50"
                disabled={isSending}
                onClick={handleClose}
              >
                Cancelar
              </button>
              <Button type="submit" variant="primary" disabled={isSending}>
                {isSending ? 'Enviando…' : 'Enviar'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
