'use client';

import React, { useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { Tooltip } from '@heroui/react';
import { FacturaData } from '@/types/factura';
import { validarNifCif } from '@/lib/validarNifCif';
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
  uppercaseNombreDireccion?: boolean
  /** Trimestre de trabajo configurado en preferencias (Q1–Q4). Si la factura no coincide, se muestra aviso. */
  workingQuarter?: string
  factura: FacturaData;
  onValidar: (factura: FacturaData) => void;
  onAnterior?: () => void
  onSiguiente: () => void;
  onParaDespues?: () => void
  isLast?: boolean
  canGoNext?: boolean
  disableValidar?: boolean
  validarText?: string
}

export const ValidarFactura: React.FC<ValidarFacturaProps> = ({
  tipo = 'gasto',
  uppercaseNombreDireccion = false,
  workingQuarter = '',
  factura: facturaInicial,
  onValidar,
  onSiguiente,
  onParaDespues,
  isLast = false,
  canGoNext = true,
  disableValidar = false,
  validarText
}) => {
  const [moneyFocusKey, setMoneyFocusKey] = useState<string | null>(null)

  const parseEuroNumber = (value: string): number | null => {
    const raw = String(value || '')
      .replace(/\u00A0/g, ' ')
      .replace(/€/g, '')
      .replace(/\s+/g, '')
      .trim()
    if (!raw) return null

    const hasDot = raw.includes('.')
    const hasComma = raw.includes(',')
    let normalized = raw

    if (hasDot && hasComma) {
      // El separador decimal es el que aparezca el último
      const lastDot = raw.lastIndexOf('.')
      const lastComma = raw.lastIndexOf(',')
      const decimalSep = lastComma > lastDot ? ',' : '.'
      const thousandsSep = decimalSep === ',' ? '.' : ','
      normalized = raw.replace(new RegExp(`\\${thousandsSep}`, 'g'), '').replace(decimalSep, '.')
    } else if (hasComma) {
      // ES típico: coma decimal
      normalized = raw.replace(',', '.')
    } else if (hasDot) {
      // Si solo hay '.', puede ser decimal (94.5 / 94.50) o miles (1.000 / 1.000.000)
      const parts = raw.split('.')
      if (parts.length === 2 && (parts[1].length === 1 || parts[1].length === 2)) {
        normalized = raw // decimal
      } else {
        normalized = raw.replace(/\./g, '') // miles
      }
    }

    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }

  const formatEuroNumber = (n: number): string => {
    const formatted = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
    // Intl usa NBSP antes del símbolo; lo cambiamos por espacio normal.
    return formatted.replace(/\u00A0€/g, ' €')
  }

  const normalizeEuroString = (value: string): string => {
    const n = parseEuroNumber(value)
    if (n === null) return String(value || '').replace(/€/g, '').trim()
    // Guardamos sin símbolo para edición (el símbolo se añade en display).
    return formatEuroNumber(n).replace(/\s?€$/, '').trim()
  }

  const moneyValue = (key: string, raw: string) => {
    // En foco: mostramos el valor en bruto para poder editar y borrar con normalidad (sin reformatear en cada tecla).
    if (moneyFocusKey === key) return raw ?? ''
    // Fuera de foco: mostramos con miles/decimales y €.
    const n = parseEuroNumber(raw)
    if (n === null) return raw || ''
    return formatEuroNumber(n)
  }

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
    // Reglas UX: el desglose SIEMPRE se muestra en este orden fijo:
    // 1) 21%  2) 10%  3) 4%
    // Y los importes se colocan en la fila que corresponda por porcentaje.
    const parsePct = (v: unknown): number | null => {
      const raw = String(v ?? '').replace('%', '').trim().replace(',', '.')
      if (!raw) return null
      const n = Number(raw)
      return Number.isFinite(n) ? n : null
    }
    const isPct = (line: { porcentajeIva?: unknown } | null | undefined, pct: number) => {
      const n = parsePct(line?.porcentajeIva)
      return n !== null && Math.abs(n - pct) < 0.01
    }
    const emptyLine = (pct: number) => ({
      base: '',
      porcentajeIva: String(pct),
      cuotaIva: '',
      porcentajeRecargo: '0',
      cuotaRecargo: '0.00',
    })

    const remaining = Array.isArray(facturaInicial.lineas) ? [...facturaInicial.lineas] : []

    const takeFirst = (pct: number) => {
      const idx = remaining.findIndex((l) => isPct(l, pct))
      if (idx === -1) return emptyLine(pct)
      const [picked] = remaining.splice(idx, 1)
      return { ...picked, porcentajeIva: String(pct) }
    }

    const l21 = takeFirst(21)
    const l10 = takeFirst(10)
    const l4 = takeFirst(4)

    const lineas = [l21, l10, l4, ...remaining]

    const next = { ...facturaInicial, lineas }
    if (uppercaseNombreDireccion) {
      const toUpper = (s: unknown) => String(s ?? '').toLocaleUpperCase('es-ES')
      next.proveedor = {
        ...next.proveedor,
        nombre: toUpper(next.proveedor?.nombre),
        direccion: toUpper(next.proveedor?.direccion),
      }
    }
    return next
  }, [facturaInicial, uppercaseNombreDireccion])

  const [factura, setFactura] = useState<FacturaData>(() => applyAutoDates(facturaInicialCon3Lineas));
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (path: string, value: string | boolean) => {
    if (
      uppercaseNombreDireccion &&
      typeof value === 'string' &&
      (path === 'proveedor.nombre' || path === 'proveedor.direccion')
    ) {
      value = value.toLocaleUpperCase('es-ES')
    }
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

      // Retención: no mostramos checkbox; el estado "aplica" se deriva de si hay datos.
      if (keys[0] === 'retencion') {
        const r = newFactura.retencion
        const hasAny =
          Boolean(r.tipo) || Boolean(r.porcentaje) || Boolean(String(r.cantidad || '').trim())
        r.aplica = hasAny
        if (!hasAny) {
          // Mantenerlo limpio cuando no hay retención
          r.tipo = ''
          r.porcentaje = ''
          r.cantidad = ''
        }
      }
      return newFactura;
    });
  };

  const handleLineaChange = (index: number, field: string, value: string) => {
    // Remover el símbolo € si está presente
    const valorLimpio = value.replace(/\u00A0/g, ' ').replace('€', '').trim();
    setFactura(prev => {
      const newLineas = [...prev.lineas];
      newLineas[index] = { ...newLineas[index], [field]: valorLimpio };
      return { ...prev, lineas: newLineas };
    });
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
    if (ivaVerification.hasErrors) return
    if (cifVerification.hasErrors) return
    onValidar(factura);
    // En la última factura no intentamos avanzar (evita error de "siguiente bloque").
    if (!isLast && canGoNext) onSiguiente();
  };

  // El formulario manejará automáticamente el Enter en los campos
  // Solo necesitamos prevenir el submit en textareas

  const trimestres = ['Q1', 'Q2', 'Q3', 'Q4'];
  const porcentajesRetencion = ['7%', '15%', '19%'];
  const tiposRetencion: Array<{ value: FacturaData['retencion']['tipo']; label: string }> = [
    { value: 'PROFESIONAL', label: 'Profesionales' },
    { value: 'ALQUILERES', label: 'Alquileres' },
  ]

  // Verificación CIF/NIF: válidos según algoritmo (módulo 23 para DNI/NIE, dígito de control para CIF)
  const cifVerification = (() => {
    const empresaCif = (factura.empresa?.cif ?? '').trim()
    const proveedorCif = (factura.proveedor?.cif ?? '').trim()
    const resEmpresa = validarNifCif(empresaCif)
    const resProveedor = validarNifCif(proveedorCif)
    return {
      hasErrors: !resEmpresa.valido || !resProveedor.valido,
      empresaError: resEmpresa.valido ? undefined : resEmpresa.error,
      proveedorError: resProveedor.valido ? undefined : resProveedor.error,
    }
  })()

  // Verificación de operación IVA: base × (%/100) ≈ cuota (sin margen)
  const ivaVerification = (() => {
    const errors: number[] = []
    for (let i = 0; i < (factura.lineas?.length || 0); i++) {
      const l = factura.lineas[i]
      if (!l) continue
      const baseN = parseEuroNumber(l.base)
      const cuotaN = parseEuroNumber(l.cuotaIva)
      const pctRaw = String(l.porcentajeIva || '').replace('%', '').trim().replace(',', '.')
      const pctN = Number(pctRaw)
      if (baseN === null && cuotaN === null) continue
      if (!Number.isFinite(pctN) || pctN < 0) continue
      const expected = baseN !== null ? baseN * (pctN / 100) : null
      if (expected === null || cuotaN === null) continue
      const diff = Math.abs(cuotaN - expected)
      if (diff > 0.002) errors.push(i)
    }
    return { hasErrors: errors.length > 0, errorLineIndices: errors }
  })()

  const inferRetencionTipo = (porcentaje: string): FacturaData['retencion']['tipo'] => {
    const p = String(porcentaje || '').replace('%', '').trim()
    const n = Number(p.replace(',', '.'))
    if (!Number.isFinite(n)) return ''
    const r = Math.round(Math.abs(n))
    // Feedback cliente:
    // - Profesionales: 7% ó 15%
    // - Alquileres: 19%
    if (r === 19) return 'ALQUILERES'
    if (r === 7 || r === 15) return 'PROFESIONAL'
    return ''
  }

  const isTipoCompatible = (tipoRet: FacturaData['retencion']['tipo'], porcentaje: string): boolean => {
    const inferred = inferRetencionTipo(porcentaje)
    // Si no podemos inferir, no imponemos compatibilidad
    if (!inferred) return true
    return tipoRet === inferred
  }

  const contraparteTitle = tipo === 'ingreso' ? 'CLIENTE' : 'PROVEEDOR'
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
        <div className="overflow-hidden h-full flex flex-col">
          <div className="flex-1 bg-slate-200 rounded-xl overflow-hidden relative border border-slate-300 flex flex-col">
            {/* Barra superior (estilo visor) */}
            <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-medium truncate">{factura.archivo?.nombre || 'Factura'}</span>
              </div>
              {factura.archivo?.url ? (
                <a
                  href={factura.archivo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-secondary hover:text-secondary-hover transition-colors"
                  title="Abrir en nueva pestaña"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7m0 0v7m0-7L10 14" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10v11h11" />
                  </svg>
                  <span className="whitespace-nowrap">Abrir en nueva pestaña</span>
                </a>
              ) : (
                <div className="text-xs text-slate-300">—</div>
              )}
            </div>

            <div className="flex-1 bg-white overflow-hidden">
              {factura.archivo?.tipo === 'pdf' ? (
                <div className="w-full h-full">
                  {factura.archivo?.url ? (
                    <object
                      data={factura.archivo.url}
                      type="application/pdf"
                      className="w-full h-full"
                      aria-label="Vista previa PDF"
                    >
                      <div className="text-center px-6 py-8">
                        <p className="text-sm text-slate-500">
                          El visor de PDF no se pudo incrustar en esta página.
                        </p>
                        <a
                          href={factura.archivo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-secondary hover:text-secondary-hover underline"
                        >
                          Abrir PDF en nueva pestaña
                        </a>
                      </div>
                    </object>
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-center px-6">
                      <div>
                        <p className="text-sm text-slate-500">
                          No se pudo cargar la previsualización de esta factura.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Vuelve al dashboard y reintenta la subida o revisa permisos de Storage/RLS.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-full overflow-hidden bg-white relative">
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
          </div>
        </div>

        {/* Columna derecha: Campos editables */}
        <div className="overflow-hidden h-full">
          <Card variant="elevated" className="h-full p-1 flex flex-col overflow-hidden">
            {/* Contenido scrolleable (detrás de la barra fija inferior) */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-0.5">
              {/* Empresa */}
              <div className="border border-gray-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-secondary shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2 20H4M4 20H14M4 20V6.2002C4 5.08009 4 4.51962 4.21799 4.0918C4.40973 3.71547 4.71547 3.40973 5.0918 3.21799C5.51962 3 6.08009 3 7.2002 3H10.8002C11.9203 3 12.4796 3 12.9074 3.21799C13.2837 3.40973 13.5905 3.71547 13.7822 4.0918C14 4.5192 14 5.07899 14 6.19691V12M14 20H20M14 20V12M20 20H22M20 20V12C20 11.0681 19.9999 10.6024 19.8477 10.2349C19.6447 9.74481 19.2557 9.35523 18.7656 9.15224C18.3981 9 17.9316 9 16.9997 9C16.0679 9 15.6019 9 15.2344 9.15224C14.7443 9.35523 14.3552 9.74481 14.1522 10.2349C14 10.6024 14 11.0681 14 12M7 10H11M7 7H11"
                    />
                  </svg>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Empresa
                  </div>
                </div>

                <div className="grid grid-cols-[2fr_2fr_0.9fr] gap-2 items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-10 shrink-0">
                      CIF
                    </div>
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        value={factura.empresa.cif}
                        onChange={(e) => handleChange('empresa.cif', e.target.value)}
                        className={`w-full min-w-0 px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${
                          cifVerification.empresaError ? 'border-red-500 bg-red-50 pr-7' : 'border-gray-200'
                        }`}
                        aria-invalid={Boolean(cifVerification.empresaError)}
                        title={cifVerification.empresaError ?? undefined}
                      />
                      {cifVerification.empresaError && (
                        <Tooltip
                          content={
                            <span className="block bg-slate-800 text-white text-xs p-3 rounded-md shadow-lg min-w-[260px] max-w-[320px] text-center whitespace-normal">
                              {cifVerification.empresaError}
                            </span>
                          }
                          placement="bottom"
                          showArrow
                          classNames={{
                            base: 'border-0 p-0 bg-transparent shadow-none before:!bg-slate-800 data-[placement=bottom]:before:!-top-0.5',
                          }}
                        >
                          <span
                            className="absolute right-0 top-0 pr-1.5 flex items-center justify-end h-7 w-7 cursor-help"
                            aria-label={cifVerification.empresaError}
                          >
                            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-16 shrink-0">
                      Actividad
                    </div>
                    <input
                      type="text"
                      value={factura.empresa.actividad}
                      onChange={(e) => handleChange('empresa.actividad', e.target.value)}
                      className="w-full min-w-0 px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 w-7 shrink-0">
                      Tri.
                    </div>
                    {(() => {
                      const trimestreFactura = (factura.empresa?.trimestre ?? '').trim()
                      const trimestreConfig = (workingQuarter ?? '').trim()
                      const noCoincide = trimestreConfig && trimestreFactura && trimestreFactura !== trimestreConfig
                      const selectEl = (
                        <select
                          value={factura.empresa.trimestre}
                          onChange={(e) => handleChange('empresa.trimestre', e.target.value)}
                          className={`w-full min-w-0 px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${
                            noCoincide ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                          }`}
                          aria-invalid={noCoincide ? 'true' : undefined}
                        >
                          <option value="">-</option>
                          {trimestres.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      )
                      if (noCoincide) {
                        const tooltipMsg = `El trimestre de esta factura (${trimestreFactura}) no coincide con el trimestre de trabajo configurado (${trimestreConfig}).`
                        return (
                          <div className="relative inline-block w-18 shrink-0 group">
                            {selectEl}
                            <div className="absolute right-full top-1/2 mr-1 -translate-y-1/2 z-50 px-2 py-1.5 bg-slate-800 text-white text-xs rounded-md shadow-lg min-w-[260px] max-w-[320px] text-center whitespace-normal pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                              {tooltipMsg}
                              <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-800" aria-hidden="true" />
                            </div>
                          </div>
                        )
                      }
                      return selectEl
                    })()}
                  </div>
                </div>
              </div>

              {/* Proveedor/Acreedor */}
              <div className="border border-gray-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-secondary shrink-0"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M16.5177 17H3.39249c-.70639 0-1.22802-.69699-.96159-1.33799C3.66709 12.69799 6.57126 10.99999 9.95417 10.99999c3.38394 0 6.2881 1.698 7.52429 4.662 0.26642.641-.2552 1.338-.96076 1.338zM5.87198 5c0-2.206 1.83233-4 4.08319-4 2.25188 0 4.08318 1.794 4.08318 4s-1.8313 4-4.08318 4C7.70431 9 5.87198 7.206 5.87198 5zm12.95472 11.636c-.74211-3.359-3.06341-5.838-6.11865-6.963 1.61898-1.277 2.56322-3.342 2.21615-5.603C14.52243 1.447 12.29505-.652 9.60627-.958 5.89466-1.381 2.74652 1.449 2.74652 5c0 1.89.89422 3.574 2.28863 4.673-3.05626 1.125-5.37654 3.604-6.11967 6.963C-1.35498 17.857-.35052 19 0.92445 19H16.8162c1.27599 0 2.28046-1.143 2.0105-2.364z" />
                  </svg>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    {contraparteTitle}
                  </div>
                </div>
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
                <div className="min-w-0">
                  <FieldRow label="CIF" widthClass="w-10">
                    <div className="relative min-w-0">
                      <input
                        type="text"
                        value={factura.proveedor.cif}
                        onChange={(e) => handleChange('proveedor.cif', e.target.value)}
                        className={`w-full px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${
                          cifVerification.proveedorError ? 'border-red-500 bg-red-50 pr-7' : 'border-gray-200'
                        }`}
                        aria-invalid={Boolean(cifVerification.proveedorError)}
                        title={cifVerification.proveedorError ?? undefined}
                      />
                      {cifVerification.proveedorError && (
                        <Tooltip
                          content={
                            <span className="block bg-slate-800 text-white text-xs p-3 rounded-md shadow-lg min-w-[260px] max-w-[320px] text-center whitespace-normal">
                              {cifVerification.proveedorError}
                            </span>
                          }
                          placement="top"
                          showArrow
                          classNames={{
                            base: 'border-0 p-0 bg-transparent shadow-none before:!bg-slate-800 data-[placement=top]:before:!-bottom-0.5',
                          }}
                        >
                          <span
                            className="absolute right-0 bottom-0 pr-1.5 flex items-center justify-end h-7 w-7 cursor-help"
                            aria-label={cifVerification.proveedorError}
                          >
                            <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </span>
                        </Tooltip>
                      )}
                    </div>
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
              <div className="border border-gray-200 rounded-lg p-2">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="w-4 h-4 text-secondary shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M6 1C4.34315 1 3 2.34315 3 4V20C3 21.6569 4.34315 23 6 23H18C19.6569 23 21 21.6569 21 20V8.82843C21 8.03278 20.6839 7.26972 20.1213 6.70711L15.2929 1.87868C14.7303 1.31607 13.9672 1 13.1716 1H6ZM5 4C5 3.44772 5.44772 3 6 3H12V8C12 9.10457 12.8954 10 14 10H19V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V4ZM18.5858 8L14 3.41421V8H18.5858Z"
                    />
                  </svg>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Datos Factura
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
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

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <FieldRow label="SUBCUENTA" widthClass="w-20">
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

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      Desglose
                    </div>
                    <button
                      type="button"
                      onClick={agregarLinea}
                      className="text-[11px] px-2 py-0.5 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      + Línea
                    </button>
                  </div>
                  {ivaVerification.hasErrors && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-800">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium">
                          Operación IVA: base × % no coincide con la cuota en {ivaVerification.errorLineIndices.length} línea(s). Revisa los importes.
                        </span>
                      </div>
                    </div>
                  )}
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
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[13px] font-bold">BASE</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[10px] font-semibold">% IVA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[13px] font-bold">CUOTA</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[10px] font-semibold">% REC</th>
                    <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[13px] font-bold">CUOTA REC</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.lineas.map((linea, index) => (
                    <tr
                      key={index}
                      className={ivaVerification.errorLineIndices.includes(index) ? 'bg-amber-50' : undefined}
                    >
                      <td className="border border-gray-200 px-0.5 py-0.5">
                        <input
                          type="text"
                          value={moneyValue(`linea:${index}:base`, linea.base)}
                          onChange={(e) => handleLineaChange(index, 'base', e.target.value)}
                          onFocus={() => setMoneyFocusKey(`linea:${index}:base`)}
                          onBlur={() => {
                            setMoneyFocusKey(null)
                            setFactura((prev) => {
                              const newLineas = [...prev.lineas]
                              newLineas[index] = { ...newLineas[index], base: normalizeEuroString(newLineas[index].base) }
                              return { ...prev, lineas: newLineas }
                            })
                          }}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[13px] font-bold"
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
                          value={moneyValue(`linea:${index}:cuotaIva`, linea.cuotaIva)}
                          onChange={(e) => handleLineaChange(index, 'cuotaIva', e.target.value)}
                          onFocus={() => setMoneyFocusKey(`linea:${index}:cuotaIva`)}
                          onBlur={() => {
                            setMoneyFocusKey(null)
                            setFactura((prev) => {
                              const newLineas = [...prev.lineas]
                              newLineas[index] = {
                                ...newLineas[index],
                                cuotaIva: normalizeEuroString(newLineas[index].cuotaIva),
                              }
                              return { ...prev, lineas: newLineas }
                            })
                          }}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[13px] font-bold"
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
                          value={moneyValue(`linea:${index}:cuotaRecargo`, linea.cuotaRecargo)}
                          onChange={(e) => handleLineaChange(index, 'cuotaRecargo', e.target.value)}
                          onFocus={() => setMoneyFocusKey(`linea:${index}:cuotaRecargo`)}
                          onBlur={() => {
                            setMoneyFocusKey(null)
                            setFactura((prev) => {
                              const newLineas = [...prev.lineas]
                              newLineas[index] = {
                                ...newLineas[index],
                                cuotaRecargo: normalizeEuroString(newLineas[index].cuotaRecargo),
                              }
                              return { ...prev, lineas: newLineas }
                            })
                          }}
                          className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[13px] font-bold"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-2 border-t border-slate-100 pt-2">
                  <div className="grid grid-cols-[5.5rem_1fr_6rem_1fr] gap-2 items-center border border-gray-200 rounded-lg p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Retención
                  </div>

                  <select
                    value={factura.retencion.tipo}
                    onChange={(e) => handleChange('retencion.tipo', e.target.value)}
                    className="w-full min-w-0 px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Tipo…</option>
                    {tiposRetencion.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={factura.retencion.porcentaje}
                    onChange={(e) => {
                      const v = e.target.value
                      handleChange('retencion.porcentaje', v)
                      const inferred = inferRetencionTipo(v)
                      if (!inferred) return
                      if (!factura.retencion.tipo || !isTipoCompatible(factura.retencion.tipo, v)) {
                        handleChange('retencion.tipo', inferred)
                      }
                    }}
                    className="w-full min-w-0 px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">%…</option>
                    {porcentajesRetencion.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={moneyValue('retencion:cantidad', factura.retencion.cantidad)}
                    onChange={(e) => {
                      const valorLimpio = e.target.value.replace('€', '').trim()
                      handleChange('retencion.cantidad', valorLimpio)
                    }}
                    onFocus={() => setMoneyFocusKey('retencion:cantidad')}
                    onBlur={() => {
                      setMoneyFocusKey(null)
                      setFactura((prev) => ({
                        ...prev,
                        retencion: { ...prev.retencion, cantidad: normalizeEuroString(prev.retencion.cantidad) },
                      }))
                    }}
                    className="w-full min-w-0 px-2 py-1 text-[13px] border border-gray-200 rounded focus:ring-1 focus:ring-primary focus:border-transparent"
                    placeholder="Importe…"
                  />
                </div>
              </div>
              </div>

              {/* Observaciones */}
              <div className="border border-gray-200 rounded-lg p-1">
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

              {/* Separación visual para que el scroll no quede “pegado” a la barra fija */}
              <div className="h-2" />
            </div>

            {/* Barra fija inferior (TOTAL + acciones) */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-2 py-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-foreground-secondary">
                    TOTAL FACTURA
                  </div>
                  <div className="text-2xl font-bold text-foreground truncate">
                    {moneyValue('total', factura.total)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    type="button"
                    onClick={() => (onParaDespues ? onParaDespues() : onSiguiente())}
                    // Permitir "Para después" también en la última factura.
                    // Solo deshabilitamos si NO hay handler y no podemos avanzar.
                    disabled={Boolean(!onParaDespues && (isLast || !canGoNext))}
                    className="px-4 py-2 text-sm font-bold whitespace-nowrap"
                  >
                    PARA DESPUÉS
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    type="submit"
                    disabled={disableValidar || ivaVerification.hasErrors || cifVerification.hasErrors}
                    className="px-5 py-2 text-sm font-bold whitespace-nowrap inline-flex items-center gap-2"
                  >
                    <span>{validarText || (disableValidar ? 'PROCESANDO…' : ivaVerification.hasErrors ? 'REVISA IVA' : cifVerification.hasErrors ? 'REVISA CIF/NIF' : 'VALIDAR')}</span>
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>

            {/* Botón oculto para permitir submit con Enter desde cualquier campo */}
            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </Card>
        </div>
      </form>
    </div>
  );
};

