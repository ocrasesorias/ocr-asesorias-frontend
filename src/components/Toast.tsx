'use client';

import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const typeConfig = {
  success: {
    accent: 'bg-secondary',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
  },
  error: {
    accent: 'bg-error',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
  },
  warning: {
    accent: 'bg-warning',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  },
  info: {
    accent: 'bg-primary',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
};

const ToastComponent: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 200);
    }, (toast.duration || 5000) - 200);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const config = typeConfig[toast.type];

  return (
    <div
      className={`flex items-stretch shadow-lg min-w-[320px] max-w-md transition-all duration-200 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
      }`}
      style={{ backgroundColor: 'var(--l-card, #ffffff)', border: '1px solid var(--l-card-border, #e5e7eb)' }}
      role="alert"
    >
      <div className={`w-1 shrink-0 ${config.accent}`} />
      <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
        <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--l-text, #1f2937)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {config.icon}
        </svg>
        <p className="flex-1 text-sm" style={{ color: 'var(--l-text, #1f2937)' }}>{toast.message}</p>
        <button
          onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 200); }}
          className="shrink-0 transition-colors"
          style={{ color: 'var(--l-text-muted, #9ca3af)' }}
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ToastComponent;
