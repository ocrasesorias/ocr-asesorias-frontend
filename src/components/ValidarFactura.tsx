'use client';

import React, { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { FacturaData } from '@/types/factura';
import { Card } from './Card';
import { Button } from './Button';

const FieldRow = ({
  label,
  widthClass = 'w-20',
  alignTop = false,
  children,
}: {
  label: string
  widthClass?: string
  alignTop?: boolean
  children: React.ReactNode
}) => (
  <div className={`flex ${alignTop ? 'items-start' : 'items-center'} gap-2`}>
    <span
      className={`text-xs font-medium text-foreground shrink-0 ${widthClass} ${
        alignTop ? 'pt-0.5' : ''
      }`}
    >
      {label}
    </span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
)

interface ValidarFacturaProps {
  tipo?: 'gasto' | 'ingreso'
  factura: FacturaData;
  onValidar: (factura: FacturaData) => void;
  onAnterior?: () => void
  onSiguiente: () => void;
  isLast?: boolean
  canGoNext?: boolean
  disableValidar?: boolean
  validarText?: string
}

export const ValidarFactura: React.FC<ValidarFacturaProps> = ({
  tipo = 'gasto',
  factura: facturaInicial,
  onValidar,
  onSiguiente,
  isLast = false,
  canGoNext = true,
  disableValidar = false,
  validarText
}) => {
  const normalizeToISODate = (value: string) => {
    const v = (value || '').trim()
    if (!v) return ''
    // DD/MM/YYYY o DD-MM-YYYY -> YYYY-MM-DD
    const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
    if (m) {
      const [, dd, mm, yyyy] = m
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
    }
    // Ya ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    return v
  }

  const quarterFromISODate = (iso: string): 'Q1' | 'Q2' | 'Q3' | 'Q4' | '' => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return ''
    const month = Number(m[2])
    if (!Number.isFinite(month) || month < 1 || month > 12) return ''
    const q = Math.floor((month - 1) / 3) + 1
    return (`Q${q}` as 'Q1' | 'Q2' | 'Q3' | 'Q4')
  }

  const applyAutoDates = (data: FacturaData): FacturaData => {
    const fechaISO = normalizeToISODate(data.factura.fecha)
    if (!fechaISO) return data

    const trimestre = quarterFromISODate(fechaISO)
    const vencOriginal = (data.factura.fechaVencimiento || '').trim()
    const vencISO = vencOriginal ? normalizeToISODate(vencOriginal) : ''

    return {
      ...data,
      empresa: {
        ...data.empresa,
        trimestre: trimestre || data.empresa.trimestre,
      },
      factura: {
        ...data.factura,
        fecha: fechaISO,
        fechaVencimiento: vencISO || fechaISO,
      },
    }
  }
  const facturaInicialCon3Lineas = useMemo(() => {
    // Asegurar que siempre haya al menos 3 líneas con IVA 21%, 10% y 4%
    const lineasBase = facturaInicial.lineas.length >= 3 
      ? [...facturaInicial.lineas]
      : [
          ...facturaInicial.lineas,
          ...Array(3 - facturaInicial.lineas.length).fill(null).map((_, index) => {
            // Asignar IVA según la posición: primera línea 21%, segunda 10%, tercera 4%
            const ivas = ['21', '10', '4'];
            const ivaIndex = facturaInicial.lineas.length + index;
            return {
              base: '',
              porcentajeIva: ivas[ivaIndex] || '',
              cuotaIva: '',
              porcentajeRecargo: '0',
              cuotaRecargo: '0.00'
            };
          })
        ];
    
    // Asegurar que las 3 líneas tengan IVA 21%, 10% y 4% respectivamente
    const lineas = lineasBase.length >= 3
      ? [
          { ...lineasBase[0], porcentajeIva: lineasBase[0].porcentajeIva || '21' },
          { ...lineasBase[1], porcentajeIva: lineasBase[1].porcentajeIva || '10' },
          { ...lineasBase[2], porcentajeIva: lineasBase[2].porcentajeIva || '4' }
        ]
      : lineasBase;
    
    return { ...facturaInicial, lineas };
  }, [facturaInicial]);

  const [factura, setFactura] = useState<FacturaData>(() => applyAutoDates(facturaInicialCon3Lineas));
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (path: string, value: string | boolean) => {
    setFactura(prev => {
      // Auto-reglas para fechas:
      // - factura.fecha: normaliza a ISO, calcula trimestre, y si vencimiento está vacío (o estaba igual que la fecha anterior), lo actualiza.
      // - factura.fechaVencimiento: normaliza a ISO.
      if (path === 'factura.fecha') {
        const prevFechaISO = normalizeToISODate(prev.factura.fecha)
        const nextFechaISO = normalizeToISODate(String(value || ''))
        const trimestre = quarterFromISODate(nextFechaISO)

        const vencOriginal = (prev.factura.fechaVencimiento || '').trim()
        const vencISO = vencOriginal ? normalizeToISODate(vencOriginal) : ''
        const shouldAutoSetVenc = !vencOriginal || (vencISO && prevFechaISO && vencISO === prevFechaISO)

        return {
          ...prev,
          empresa: {
            ...prev.empresa,
            trimestre: trimestre || prev.empresa.trimestre,
          },
          factura: {
            ...prev.factura,
            fecha: nextFechaISO,
            fechaVencimiento: shouldAutoSetVenc ? (nextFechaISO || prev.factura.fechaVencimiento) : prev.factura.fechaVencimiento,
          },
        }
      }

      if (path === 'factura.fechaVencimiento') {
        return {
          ...prev,
          factura: {
            ...prev.factura,
            fechaVencimiento: normalizeToISODate(String(value || '')),
          },
        }
      }

      const keys = path.split('.');
      const newFactura = { ...prev };
      let current: Record<string, unknown> = newFactura;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const nextValue = current[key];
        current = current[key] = { ...(nextValue as Record<string, unknown>) };
      }
      
      current[keys[keys.length - 1]] = value;
      return newFactura;
    });
  };

  const handleLineaChange = (index: number, field: string, value: string) => {
    // Remover el símbolo € si está presente
    const valorLimpio = value.replace('€', '').trim();
    setFactura(prev => {
      const newLineas = [...prev.lineas];
      newLineas[index] = { ...newLineas[index], [field]: valorLimpio };
      return { ...prev, lineas: newLineas };
    });
  };

  const formatearMoneda = (valor: string) => {
    if (!valor || valor.trim() === '') return '';
    return valor + '€';
  };

  const agregarLinea = () => {
    setFactura(prev => ({
      ...prev,
      lineas: [
        ...prev.lineas,
        {
          base: '',
          porcentajeIva: '',
          cuotaIva: '',
          porcentajeRecargo: '',
          cuotaRecargo: ''
        }
      ]
    }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disableValidar) return
    onValidar(factura);
    // En la última factura no intentamos avanzar (evita error de "siguiente bloque").
    if (!isLast && canGoNext) onSiguiente();
  };

  // El formulario manejará automáticamente el Enter en los campos
  // Solo necesitamos prevenir el submit en textareas

  const trimestres = ['Q1', 'Q2', 'Q3', 'Q4'];
  const porcentajesRetencion = ['15%', '17%', '19%'];
  const tiposRetencion = ['AUTÓNOMO', 'PROFESIONAL'];

  const contraparteTitle = tipo === 'ingreso' ? 'CLIENTE' : 'PROVEEDOR'
  const subcuentaLabel = tipo === 'ingreso' ? 'SUBCUENTA VENTA' : 'SUBCUENTA'
  const subcuentas = tipo === 'ingreso'
    ? [
        { value: '700', label: '700 - Ventas' },
        { value: '705', label: '705 - Prestaciones de servicios' },
        { value: '708', label: '708 - Devoluciones y descuentos' },
      ]
    : [
        { value: '600', label: '600' },
        { value: '620', label: '620' },
        { value: '621', label: '621' },
        { value: '628', label: '628' },
      ]

  return (
    <div className="bg-background p-1 flex flex-col min-h-0 h-full">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-1 min-h-0 h-full"
      >
        {/* Columna izquierda: Imagen/PDF de la factura */}
        <div className="overflow-hidden h-full">
          <Card variant="elevated" className="p-1 h-full flex flex-col">
            <h2 className="text-[10px] font-semibold text-foreground mb-0.5">
              Factura
            </h2>
            <div className="flex-1 overflow-hidden">
              {factura.archivo?.tipo === 'pdf' ? (
                <div className="w-full h-full border border-gray-200 rounded flex items-center justify-center bg-gray-50">
                  {factura.archivo?.url ? (
                    <object
                      data={factura.archivo.url}
                      type="application/pdf"
                      className="w-full h-full rounded"
                      aria-label="Vista previa PDF"
                    >
                      <div className="text-center px-6">
                        <p className="text-sm text-foreground-secondary">
                          El visor de PDF no se pudo incrustar en esta página.
                        </p>
                        <a
                          href={factura.archivo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary-hover transition-colors"
                        >
                          Abrir PDF en nueva pestaña
                        </a>
                      </div>
                    </object>
                  ) : (
                    <div className="text-center px-6">
                      <p className="text-sm text-foreground-secondary">
                        No se pudo cargar la previsualización de esta factura.
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Vuelve al dashboard y reintenta la subida o revisa permisos de Storage/RLS.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full border border-gray-200 rounded overflow-hidden bg-gray-50 relative">
                  <Image
                    src={factura.archivo?.url || '/img/placeholder-invoice.png'}
                    alt="Factura"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain"
                    priority={false}
                  />
                </div>
              )}
            </div>

            {/* Debug/acción rápida: abrir la URL firmada si existe */}
            {factura.archivo?.url && (
              <div className="mt-1 flex items-center justify-between gap-2">
                <a
                  href={factura.archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary-hover transition-colors"
                >
                  Abrir factura en nueva pestaña
                </a>
                <span className="text-[10px] text-foreground-secondary truncate max-w-[60%]">
                  {factura.archivo.nombre}
                </span>
              </div>
            )}
          </Card>
        </div>

        {/* Columna derecha: Campos editables */}
        <div className="overflow-hidden h-full">
          <Card variant="elevated" className="h-full p-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-hidden space-y-1">
              {/* Empresa */}
              <div className="border border-gray-200 rounded-lg p-1">
                <h3 className="text-xs font-semibold text-foreground mb-1">
                  EMPRESA
                </h3>
                <div className="grid grid-cols-[2fr_2fr_0.7fr] gap-1">
              <div>
                <FieldRow label="CIF" widthClass="w-10">
                  <input
                    type="text"
                    value={factura.empresa.cif}
                    onChange={(e) => handleChange('empresa.cif', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="ACTIVIDAD" widthClass="w-20">
                  <input
                    type="text"
                    value={factura.empresa.actividad}
                    onChange={(e) => handleChange('empresa.actividad', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="TRI." widthClass="w-8">
                  <select
                    value={factura.empresa.trimestre}
                    onChange={(e) => handleChange('empresa.trimestre', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">-</option>
                    {trimestres.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>
                </div>
              </div>

              {/* Proveedor/Acreedor */}
              <div className="border border-gray-200 rounded-lg p-1">
                <h3 className="text-xs font-semibold text-foreground mb-1">
                  {contraparteTitle}
                </h3>
                <div className="space-y-1">
              <div>
                <FieldRow label="NOMBRE" widthClass="w-16">
                  <input
                    type="text"
                    value={factura.proveedor.nombre}
                    onChange={(e) => handleChange('proveedor.nombre', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
                  <div className="grid grid-cols-3 gap-1">
                <div>
                  <FieldRow label="CIF" widthClass="w-10">
                    <input
                      type="text"
                      value={factura.proveedor.cif}
                      onChange={(e) => handleChange('proveedor.cif', e.target.value)}
                          className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </FieldRow>
                </div>
                <div>
                  <FieldRow label="C.P." widthClass="w-10">
                    <input
                      type="text"
                      value={factura.proveedor.codigoPostal}
                      onChange={(e) => handleChange('proveedor.codigoPostal', e.target.value)}
                          className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </FieldRow>
                </div>
                <div>
                  <FieldRow label="PROV." widthClass="w-12">
                    <input
                      type="text"
                      value={factura.proveedor.provincia}
                      onChange={(e) => handleChange('proveedor.provincia', e.target.value)}
                          className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </FieldRow>
                </div>
              </div>
              <div>
                <FieldRow label="DIRECCIÓN" widthClass="w-20">
                  <input
                    type="text"
                    value={factura.proveedor.direccion}
                    onChange={(e) => handleChange('proveedor.direccion', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
                </div>
              </div>

              {/* Datos de la factura */}
              <div className="border border-gray-200 rounded-lg p-1">
                <h3 className="text-xs font-semibold text-foreground mb-1">
                  DATOS FACTURA
                </h3>
                <div className="grid grid-cols-3 gap-1">
              <div>
                <FieldRow label="Nº" widthClass="w-8">
                  <input
                    type="text"
                    value={factura.factura.numero}
                    onChange={(e) => handleChange('factura.numero', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="FECHA" widthClass="w-12">
                  <input
                    type="date"
                    value={factura.factura.fecha}
                    onChange={(e) => handleChange('factura.fecha', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
              <div>
                <FieldRow label="VENC." widthClass="w-12">
                  <input
                    type="date"
                    value={factura.factura.fechaVencimiento}
                    onChange={(e) => handleChange('factura.fechaVencimiento', e.target.value)}
                        className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </FieldRow>
              </div>
                </div>
              </div>

              {/* Subcuenta de gasto */}
              <div className="border border-gray-200 rounded-lg p-1">
                <FieldRow label={subcuentaLabel} widthClass="w-20">
                  <select
                    value={factura.subcuentaGasto}
                    onChange={(e) => handleChange('subcuentaGasto', e.target.value)}
                    className="w-full px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">-</option>
                    {subcuentas.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </FieldRow>
              </div>

              {/* Tabla de desglose */}
              <div className="border border-gray-200 rounded-lg p-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="text-xs font-semibold text-foreground">
                    DESGLOSE
                  </h3>
                  <button
                    type="button"
                    onClick={agregarLinea}
                    className="text-[11px] px-2 py-0.5 border border-gray-200 rounded hover:bg-gray-50"
                  >
                    + Línea
                  </button>
                </div>
                <div className="overflow-hidden">
                  <table className="w-full border-collapse text-[10px]">
                <colgroup>
                  <col className="w-auto" />
                  <col className="w-12" />
                  <col className="w-auto" />
                  <col className="w-12" />
                  <col className="w-auto" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">BASE</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">% IVA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">CUOTA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">% REC</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left font-semibold">CUOTA REC</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.lineas.map((linea, index) => (
                    <tr key={index}>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.base)}
                          onChange={(e) => handleLineaChange(index, 'base', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={linea.porcentajeIva}
                          onChange={(e) => handleLineaChange(index, 'porcentajeIva', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.cuotaIva)}
                          onChange={(e) => handleLineaChange(index, 'cuotaIva', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={linea.porcentajeRecargo}
                          onChange={(e) => handleLineaChange(index, 'porcentajeRecargo', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                        />
                      </td>
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={formatearMoneda(linea.cuotaRecargo)}
                          onChange={(e) => handleLineaChange(index, 'cuotaRecargo', e.target.value)}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                  </table>
                </div>
              </div>

              {/* Retención */}
              <div className="border border-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-4 gap-2 items-stretch">
                  {/* RETENCIÓN + Sí (centrado) */}
                  <div className="flex flex-col items-center justify-center text-center gap-1">
                    <div className="text-xs font-medium text-foreground">RETENCIÓN</div>
                    <label className="inline-flex items-center justify-center gap-1">
                      <input
                        type="checkbox"
                        checked={factura.retencion.aplica}
                        onChange={(e) => handleChange('retencion.aplica', e.target.checked)}
                        className="mr-0.5"
                      />
                      <span className="text-xs">Sí</span>
                    </label>
                  </div>

                  {/* TIPO (centrado) */}
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">TIPO</div>
                    <select
                      value={factura.retencion.tipo}
                      onChange={(e) => handleChange('retencion.tipo', e.target.value)}
                      disabled={!factura.retencion.aplica}
                      className="w-full max-w-[220px] px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-</option>
                      {tiposRetencion.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* % (centrado) */}
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">%</div>
                    <select
                      value={factura.retencion.porcentaje}
                      onChange={(e) => handleChange('retencion.porcentaje', e.target.value)}
                      disabled={!factura.retencion.aplica}
                      className="w-full max-w-[220px] px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">-</option>
                      {porcentajesRetencion.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* CANT. (centrado) */}
                  <div className="flex flex-col items-center justify-center text-center gap-1 min-w-0">
                    <div className="text-xs font-medium text-foreground">CANT.</div>
                    <input
                      type="text"
                      value={formatearMoneda(factura.retencion.cantidad)}
                      onChange={(e) => {
                        const valorLimpio = e.target.value.replace('€', '').trim()
                        handleChange('retencion.cantidad', valorLimpio)
                      }}
                      disabled={!factura.retencion.aplica}
                      className="w-full max-w-[220px] px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="0.00€"
                    />
                  </div>
                </div>
              </div>

              {/* Anexos/Observaciones y Total */}
              <div className="border border-gray-200 rounded-lg p-1">
                <div className="grid grid-cols-2 gap-1">
              <div>
                <FieldRow label="OBS." widthClass="w-12" alignTop>
                  <textarea
                    value={factura.anexosObservaciones}
                    onChange={(e) => handleChange('anexosObservaciones', e.target.value)}
                    onKeyDown={(e) => {
                      // Permitir Enter en textarea, pero Ctrl+Enter o Cmd+Enter para submit
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        handleSubmit(e as unknown as React.FormEvent)
                      }
                    }}
                        rows={3}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent resize-none"
                    placeholder="Albarán, ticket..."
                  />
                </FieldRow>
              </div>
              <div className="flex flex-col">
                <FieldRow label="TOTAL" widthClass="w-12">
                  <input
                    type="text"
                    value={formatearMoneda(factura.total)}
                    onChange={(e) => {
                      const valorLimpio = e.target.value.replace('€', '').trim()
                      handleChange('total', valorLimpio)
                    }}
                        className="w-full px-2 py-1.5 text-base border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent font-semibold"
                  />
                </FieldRow>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    type="button"
                    onClick={() => onSiguiente()}
                    disabled={isLast || !canGoNext}
                    className="w-full text-sm py-1.5 font-bold"
                  >
                    PARA DESPUÉS
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    type="submit"
                    disabled={disableValidar}
                    className="w-full text-sm py-1.5 font-bold"
                  >
                    {validarText || (disableValidar ? 'PROCESANDO…' : 'VALIDAR')}
                  </Button>
                </div>
              </div>
            </div>
            {/* Botón oculto para permitir submit con Enter desde cualquier campo */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
              </div>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
};

