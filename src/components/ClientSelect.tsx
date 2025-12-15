'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Client = {
  id: string;
  name: string;
  tax_id: string | null;
};

interface ClientSelectProps {
  clients: Client[];
  value: string; // client id ('' for none)
  onChange: (clientId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ClientSelect({
  clients,
  value,
  onChange,
  placeholder = '-- Selecciona un cliente --',
  disabled = false,
}: ClientSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => clients.find((c) => c.id === value) || null,
    [clients, value]
  );

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const label = selected
    ? `${selected.name}${selected.tax_id ? ` (${selected.tax_id})` : ''}`
    : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          'w-full flex items-center justify-between gap-3',
          'px-4 py-3 rounded-lg border border-gray-200 bg-white',
          'text-left transition-all',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? 'text-foreground' : 'text-foreground-secondary'}>
          {label}
        </span>
        <span className="flex items-center text-foreground-secondary">
          <svg
            className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {open && !disabled && (
        <div
          className={[
            'absolute z-20 mt-2 w-full',
            'rounded-lg border border-gray-200 bg-white shadow-lg',
            'max-h-64 overflow-auto',
          ].join(' ')}
          role="listbox"
        >
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className={[
              'w-full text-left px-4 py-3 text-sm',
              value === '' ? 'bg-primary-lighter text-foreground' : 'text-foreground-secondary',
              'hover:bg-gray-50 transition-colors',
            ].join(' ')}
          >
            {placeholder}
          </button>

          {clients.length === 0 ? (
            <div className="px-4 py-3 text-sm text-foreground-secondary">
              No hay clientes todavía.
            </div>
          ) : (
            clients.map((c) => {
              const isActive = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className={[
                    'w-full text-left px-4 py-3 text-sm',
                    isActive ? 'bg-primary-lighter text-foreground' : 'text-foreground',
                    'hover:bg-gray-50 transition-colors',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">{c.name}</span>
                    {c.tax_id ? (
                      <span className="text-xs text-foreground-secondary whitespace-nowrap">
                        {c.tax_id}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}


