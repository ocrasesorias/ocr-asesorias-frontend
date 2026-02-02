'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastComponent, { Toast, ToastType } from '@/components/Toast';

type ToastPosition = 'top-right' | 'top-center'

type ToastConfig = {
  position: ToastPosition
  maxToasts: number // 1 para no apilar; <=0 para ilimitados
}

const DEFAULT_TOAST_CONFIG: ToastConfig = {
  position: 'top-right',
  maxToasts: 0,
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  /**
   * Configuración temporal (por pantalla).
   * - Pasa null para volver al comportamiento por defecto.
   */
  setToastConfig: (config: Partial<ToastConfig> | null) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [toastConfig, setToastConfigState] = useState<ToastConfig>(DEFAULT_TOAST_CONFIG)

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const setToastConfig = useCallback((config: Partial<ToastConfig> | null) => {
    if (!config) {
      setToastConfigState(DEFAULT_TOAST_CONFIG)
      return
    }
    setToastConfigState((prev) => ({ ...prev, ...config }))
  }, [])

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = {
        id,
        message,
        type,
        duration,
      };
      setToasts((prev) => {
        const max = Number(toastConfig.maxToasts || 0)
        if (max === 1) return [newToast]
        if (max > 1) return [...prev, newToast].slice(-max)
        return [...prev, newToast]
      });
    },
    [toastConfig.maxToasts]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => showToast(message, 'success', duration),
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => showToast(message, 'error', duration),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => showToast(message, 'warning', duration),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => showToast(message, 'info', duration),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        setToastConfig,
      }}
    >
      {children}
      {/* Contenedor de toasts */}
      <div
        className={`fixed top-4 z-50 flex flex-col gap-2 pointer-events-none ${
          toastConfig.position === 'top-center'
            ? 'left-1/2 -translate-x-1/2 items-center'
            : 'right-4 items-end'
        }`}
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastComponent toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

