'use client';

import { validarNifCif } from '@/lib/validarNifCif';
import { FacturaData } from '@/types/factura';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { CircleCheckBig } from '@/components/animate-ui/icons/circle-check-big';
import { Button } from './Button';
import { Card } from './Card';

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
      className={`text-xs font-medium text-foreground shrink-0 ${widthClass} ${alignTop ? 'pt-0.5' : ''
        }`}
    >
      {label}
    </span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
)

interface ValidarFacturaProps {
  empresaNombre: string
  tipo?: 'gasto' | 'ingreso'
  uppercaseNombreDireccion?: boolean
  /** Trimestre de trabajo configurado en preferencias (Q1–Q4). Si la factura no coincide, se muestra aviso. */
  workingQuarter?: string
  /** ID del cliente de esta subida, para buscar proveedores en base de datos. */
  clientId?: string | null
  factura: FacturaData;
  /** true si el preview de esta factura ya se intentó y devolvió distinto de 200 (mostrar error en vez de "Cargando..."). */
  previewFailed?: boolean
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
  empresaNombre,
  tipo = 'gasto',
  uppercaseNombreDireccion = false,
  workingQuarter = '',
  clientId = null,
  factura: facturaInicial,
  previewFailed = false,
  onValidar,
  onSiguiente,
  onParaDespues,
  isLast = false,
  canGoNext = true,
  disableValidar = false,
  validarText
}) => {
  const [moneyFocusKey, setMoneyFocusKey] = useState<string | null>(null)
  /** Al hacer foco en un campo numérico guardamos el valor; al blur si quedó vacío se restaura. */
  const valueBeforeFocusRef = useRef<Record<string, string>>({})

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
      const thousandsSepRegex = new RegExp(`\\${thousandsSep}`, 'g')
      normalized = raw.replace(thousandsSepRegex, '').replace(decimalSep, '.')
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
    // Formato español: punto (.) miles, coma (,) decimales. Ej: 1089 → "1.089,00 €"
    const fixed = n.toFixed(2)
    const [intPart, decPart] = fixed.split('.')
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    const formatted = `${withThousands},${decPart} €`
    return formatted
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
  const [supplierEnBd, setSupplierEnBd] = useState<{
    name: string
    tax_id: string
    address?: string | null
    postal_code?: string | null
    province?: string | null
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Detectar si existe en BD un proveedor con este nombre, CIF o dirección (mostrar warning y permitir corregir)
  useEffect(() => {
    const cif = factura.proveedor?.cif?.trim()
    const nombre = factura.proveedor?.nombre?.trim()
    const direccion = factura.proveedor?.direccion?.trim()
    if (!cif && !nombre && !direccion) {
      setSupplierEnBd(null)
      return
    }
    let cancelled = false
    const searchSupplier = async (params: Record<string, string>) => {
      const url = new URL(window.location.origin + '/api/suppliers/search')
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
      if (clientId) url.searchParams.set('client_id', clientId)
      const resp = await fetch(url.toString())
      if (!resp.ok) return null
      const data = await resp.json()
      const s = data?.supplier
      return (s && s.name && s.tax_id) ? s : null
    }
    const run = async () => {
      try {
        // Prioridad: CIF → nombre → dirección
        let s = null
        if (cif) s = await searchSupplier({ tax_id: cif })
        if (!s && nombre) s = await searchSupplier({ name: nombre })
        if (!s && direccion) s = await searchSupplier({ address: direccion })

        if (cancelled) return
        if (s) {
          setSupplierEnBd({
            name: s.name,
            tax_id: s.tax_id,
            address: s.address ?? null,
            postal_code: s.postal_code ?? null,
            province: s.province ?? null,
          })
        } else {
          setSupplierEnBd(null)
        }
      } catch {
        if (!cancelled) setSupplierEnBd(null)
      }
    }
    run()
    return () => { cancelled = true }
  }, [factura.proveedor?.nombre, factura.proveedor?.cif, factura.proveedor?.direccion, clientId])

  const handleUsarDatosGuardados = () => {
    if (!supplierEnBd) return
    setFactura(prev => {
      const next = { ...prev }
      next.proveedor = { ...next.proveedor }
      if (supplierEnBd.name) next.proveedor.nombre = supplierEnBd.name
      if (supplierEnBd.tax_id) next.proveedor.cif = supplierEnBd.tax_id
      if (supplierEnBd.address != null) next.proveedor.direccion = supplierEnBd.address
      if (supplierEnBd.postal_code != null) next.proveedor.codigoPostal = supplierEnBd.postal_code
      if (supplierEnBd.province != null) next.proveedor.provincia = supplierEnBd.province
      if (uppercaseNombreDireccion) {
        if (next.proveedor.nombre) next.proveedor.nombre = next.proveedor.nombre.toLocaleUpperCase('es-ES')
        if (next.proveedor.direccion) next.proveedor.direccion = next.proveedor.direccion.toLocaleUpperCase('es-ES')
      }
      return next
    })
  }

  const datosDifierenDeBd = useMemo(() => {
    if (!supplierEnBd) return false
    const p = factura.proveedor
    const norm = (s: string | undefined | null): string => {
      const t = (s ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
      return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    }
    const eq = (a: string | undefined | null, b: string | undefined | null) =>
      norm(a) === norm(b)
    return (
      !eq(p?.nombre, supplierEnBd.name) ||
      !eq(p?.cif, supplierEnBd.tax_id) ||
      !eq(p?.direccion, supplierEnBd.address ?? '') ||
      !eq(p?.codigoPostal, supplierEnBd.postal_code ?? '') ||
      !eq(p?.provincia, supplierEnBd.province ?? '')
    )
  }, [supplierEnBd, factura.proveedor])

  const showSupplierWarning = Boolean(supplierEnBd && datosDifierenDeBd)

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
          cuotaRecargo: '',
          tipoExencion: undefined,
        }
      ]
    }));
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disableValidar) return
    if (ivaVerification.hasErrors) return
    if (totalVerification.hasErrors) return
    // Si no podemos avanzar a la siguiente, bloqueamos la acción para que
    // al validar/poner "para después" siempre se pase a la siguiente factura.
    if (!isLast && !canGoNext) return
    // CIF/NIF: solo advertencia, no bloquea el envío
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

  // Verificación de operación IVA: base × (%/100) ≈ cuota (0.05). Con inversión del sujeto pasivo, cuota 0 es válida.
  const inversionSujetoPasivo = Boolean(facturaInicial.inversion_sujeto_pasivo)
  const tipoDocumento = facturaInicial.tipo_documento || 'factura'
  const tipoDocumentoLabel =
    tipoDocumento === 'albaran'
      ? 'Albarán'
      : tipoDocumento === 'nota_entrega'
        ? 'Nota de entrega'
        : tipoDocumento === 'otro'
          ? 'Otro documento'
          : 'Factura'
  const ivaVerification = (() => {
    const errors: number[] = []
    for (let i = 0; i < (factura.lineas?.length || 0); i++) {
      const l = factura.lineas[i]
      if (!l) continue
      const lineFocused =
        moneyFocusKey === `linea:${i}:base` ||
        moneyFocusKey === `linea:${i}:cuotaIva` ||
        moneyFocusKey === `linea:${i}:cuotaRecargo`
      if (lineFocused) continue
      const baseN = parseEuroNumber(l.base)
      const cuotaN = parseEuroNumber(l.cuotaIva)
      const pctRaw = String(l.porcentajeIva || '').replace('%', '').trim().replace(',', '.')
      const pctN = Number(pctRaw)
      if (baseN === null && cuotaN === null) continue
      if (!Number.isFinite(pctN) || pctN < 0) continue
      // Inversión del sujeto pasivo: cuota IVA 0 es correcta (IVA repercutido por el destinatario)
      if (inversionSujetoPasivo && (cuotaN === null || cuotaN === 0)) continue
      const expected = baseN !== null ? baseN * (pctN / 100) : null
      if (expected === null || cuotaN === null) continue
      const diff = Math.abs(cuotaN - expected)
      if (diff > 0.05) errors.push(i)
    }
    return { hasErrors: errors.length > 0, errorLineIndices: errors }
  })()

  // Validación: suma de filas (base + IVA + recargo) - retención debe coincidir con el total de la factura (total a pagar)
  const totalVerification = (() => {
    if (moneyFocusKey === 'total') return { hasErrors: false }
    if (moneyFocusKey?.startsWith('linea:') || moneyFocusKey === 'retencion:cantidad') return { hasErrors: false }
    let sumBase = 0
    let sumIva = 0
    let sumRecargo = 0
    for (const l of factura.lineas || []) {
      const b = parseEuroNumber(l.base)
      const i = parseEuroNumber(l.cuotaIva)
      const r = parseEuroNumber(l.cuotaRecargo)
      if (b !== null) sumBase += b
      if (i !== null) sumIva += i
      if (r !== null) sumRecargo += r
    }
    const retencionN = parseEuroNumber(factura.retencion?.cantidad ?? '') ?? 0
    const tableTotalNeto = sumBase + sumIva + sumRecargo - retencionN
    const facturaTotal = parseEuroNumber(factura.total)
    if (facturaTotal === null && !factura.total?.trim()) return { hasErrors: false }
    if (facturaTotal === null) return { hasErrors: false } // total no numérico: no bloqueamos
    const diff = Math.abs(tableTotalNeto - facturaTotal)
    return {
      hasErrors: diff > 0.05,
    }
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
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium ${tipoDocumento === 'factura'
                    ? 'bg-slate-600 text-white'
                    : tipoDocumento === 'albaran'
                      ? 'bg-blue-500/90 text-white'
                      : tipoDocumento === 'nota_entrega'
                        ? 'bg-slate-500/90 text-white'
                        : 'bg-slate-500/80 text-white'
                    }`}
                  title={tipoDocumento === 'factura' ? 'Documento fiscal para contabilidad' : tipoDocumento === 'albaran' ? 'Documento de entrega; la factura puede llegar por separado' : tipoDocumento === 'nota_entrega' ? 'Prueba de entrega' : 'Otro tipo de documento'}
                >
                  {tipoDocumentoLabel}
                </span>
                {inversionSujetoPasivo && (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/90 text-slate-900" title="IVA repercutido por el destinatario (Art. 196)">
                    Inversión sujeto pasivo
                  </span>
                )}
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
                  ) : previewFailed ? (
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
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-center px-6">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="animate-spin h-8 w-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <p className="text-sm text-slate-500">Cargando previsualización…</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : factura.archivo?.url ? (
                <div className="w-full h-full overflow-hidden bg-white relative">
                  <Image
                    src={factura.archivo.url}
                    alt="Factura"
                    fill
                    sizes="(min-width: 1024px) 50vw, 100vw"
                    className="object-contain"
                    priority={false}
                  />
                </div>
              ) : previewFailed ? (
                <div className="h-full w-full flex items-center justify-center text-center px-6">
                  <div>
                    <p className="text-sm text-slate-500">No se pudo cargar la previsualización de esta factura.</p>
                    <p className="text-xs text-slate-500 mt-1">Vuelve al dashboard y reintenta la subida o revisa permisos de Storage/RLS.</p>
                  </div>
                </div>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-center px-6">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="animate-spin h-8 w-8 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-slate-500">Cargando previsualización…</p>
                  </div>
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
                    Empresa - {empresaNombre}
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
                        className={`w-full min-w-0 px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${cifVerification.empresaError ? 'border-amber-500 bg-amber-50/70 pr-7' : 'border-gray-200'
                          }`}
                        aria-describedby={cifVerification.empresaError ? 'cif-empresa-warning' : undefined}
                        title={cifVerification.empresaError ? `${cifVerification.empresaError}` : undefined}
                      />
                      {cifVerification.empresaError && (
                        <Tooltip
                          content={
                            <span id="cif-empresa-warning" className="block bg-amber-600 text-white text-xs p-3 rounded-md shadow-lg min-w-[260px] max-w-[320px] text-center whitespace-normal">
                              {cifVerification.empresaError}
                            </span>
                          }
                          placement="bottom"
                          showArrow
                          classNames={{
                            base: 'border-0 p-0 bg-transparent shadow-none before:!bg-amber-600 data-[placement=bottom]:before:!-top-0.5',
                          }}
                        >
                          <span
                            className="absolute right-0 top-0 pr-1.5 flex items-center justify-end h-7 w-7 cursor-help"
                            aria-label={`${cifVerification.empresaError}`}
                          >
                            <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
                          className={`w-full min-w-0 px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${noCoincide ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
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
              <div className={`rounded-lg p-2 border ${showSupplierWarning ? 'border-amber-500 bg-amber-50/60' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" aria-hidden="true">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <path d="M5 21C5 17.134 8.13401 14 12 14C15.866 14 19 17.134 19 21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </g>
                  </svg>
                  <div className={`text-[11px] font-bold uppercase tracking-widest flex-1 min-w-0 truncate ${showSupplierWarning ? 'text-amber-800' : 'text-slate-500'}`}>
                    {contraparteTitle} - {factura.proveedor.nombre}
                    {showSupplierWarning && (
                      <span className="ml-1.5 text-amber-600 font-normal normal-case tracking-normal">
                        · Hay datos correctos guardados
                      </span>
                    )}
                  </div>
                  {showSupplierWarning && (
                    <button
                      type="button"
                      onClick={handleUsarDatosGuardados}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded border border-amber-300 transition-colors shrink-0"
                      title="Usar los datos del proveedor guardados en base de datos"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Usar datos guardados
                    </button>
                  )}
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
                            className={`w-full px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent font-bold ${cifVerification.proveedorError ? 'border-amber-500 bg-amber-50/70 pr-7' : 'border-gray-200'
                              }`}
                            aria-describedby={cifVerification.proveedorError ? 'cif-proveedor-warning' : undefined}
                            title={cifVerification.proveedorError ? `${cifVerification.proveedorError}` : undefined}
                          />
                          {cifVerification.proveedorError && (
                            <Tooltip
                              content={
                                <span id="cif-proveedor-warning" className="block bg-amber-600 text-white text-xs p-3 rounded-md shadow-lg min-w-[260px] max-w-[320px] text-center whitespace-normal">
                                  {cifVerification.proveedorError}
                                </span>
                              }
                              placement="top"
                              showArrow
                              classNames={{
                                base: 'border-0 p-0 bg-transparent shadow-none before:!bg-amber-600 data-[placement=top]:before:!-bottom-0.5',
                              }}
                            >
                              <span
                                className="absolute right-0 bottom-0 pr-1.5 flex items-center justify-end h-7 w-7 cursor-help"
                                aria-label={`${cifVerification.proveedorError}`}
                              >
                                <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
                  {totalVerification.hasErrors && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-800">
                        <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs font-medium">
                          La suma de las filas (base + IVA + recargo) no coincide con el total de la factura. Revisa los importes.
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <table className="w-full border-collapse text-[10px]">
                      <colgroup>
                        <col className="w-auto" />
                        <col className="w-12" />
                        <col className="w-16" />
                        <col className="w-auto" />
                        <col className="w-12" />
                        <col className="w-auto" />
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[13px] font-bold">BASE</th>
                          <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[10px] font-semibold">% IVA</th>
                          <th className="border border-gray-200 px-0.5 py-0.5 text-left text-[10px] font-semibold">TIPO</th>
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
                                onFocus={() => {
                                  valueBeforeFocusRef.current[`linea:${index}:base`] = String(linea.base ?? '')
                                  handleLineaChange(index, 'base', '')
                                  setMoneyFocusKey(`linea:${index}:base`)
                                }}
                                onBlur={() => {
                                  setMoneyFocusKey(null)
                                  setFactura((prev) => {
                                    const newLineas = [...prev.lineas]
                                    const cur = newLineas[index].base
                                    if (!String(cur).trim()) {
                                      newLineas[index] = { ...newLineas[index], base: valueBeforeFocusRef.current[`linea:${index}:base`] ?? '' }
                                    } else {
                                      newLineas[index] = { ...newLineas[index], base: normalizeEuroString(cur) }
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
                                value={linea.porcentajeIva}
                                onChange={(e) => handleLineaChange(index, 'porcentajeIva', e.target.value)}
                                className="w-full px-0.5 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[10px]"
                              />
                            </td>
                            <td className="border border-gray-200 px-0.5 py-0.5">
                              {String(linea.porcentajeIva || '').trim() === '0' ? (
                                <select
                                  value={linea.tipoExencion || ''}
                                  onChange={(e) => handleLineaChange(index, 'tipoExencion', e.target.value)}
                                  className="w-full px-0 py-0.5 border-0 focus:ring-1 focus:ring-primary rounded text-[9px] bg-transparent"
                                >
                                  <option value="">—</option>
                                  <option value="suplidos">Suplidos</option>
                                  <option value="exento_art20">Exento Art. 20</option>
                                  <option value="intracomunitaria">Op. Intracom.</option>
                                  <option value="no_sujeta">No sujeta</option>
                                  <option value="otro">Otro</option>
                                </select>
                              ) : (
                                <span className="text-[9px] text-gray-300 px-0.5">—</span>
                              )}
                            </td>
                            <td className="border border-gray-200 px-0.5 py-0.5">
                              <input
                                type="text"
                                value={moneyValue(`linea:${index}:cuotaIva`, linea.cuotaIva)}
                                onChange={(e) => handleLineaChange(index, 'cuotaIva', e.target.value)}
                                onFocus={() => {
                                  valueBeforeFocusRef.current[`linea:${index}:cuotaIva`] = String(linea.cuotaIva ?? '')
                                  handleLineaChange(index, 'cuotaIva', '')
                                  setMoneyFocusKey(`linea:${index}:cuotaIva`)
                                }}
                                onBlur={() => {
                                  setMoneyFocusKey(null)
                                  setFactura((prev) => {
                                    const newLineas = [...prev.lineas]
                                    const cur = newLineas[index].cuotaIva
                                    if (!String(cur).trim()) {
                                      newLineas[index] = { ...newLineas[index], cuotaIva: valueBeforeFocusRef.current[`linea:${index}:cuotaIva`] ?? '' }
                                    } else {
                                      newLineas[index] = { ...newLineas[index], cuotaIva: normalizeEuroString(cur) }
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
                                onFocus={() => {
                                  valueBeforeFocusRef.current[`linea:${index}:cuotaRecargo`] = String(linea.cuotaRecargo ?? '')
                                  handleLineaChange(index, 'cuotaRecargo', '')
                                  setMoneyFocusKey(`linea:${index}:cuotaRecargo`)
                                }}
                                onBlur={() => {
                                  setMoneyFocusKey(null)
                                  setFactura((prev) => {
                                    const newLineas = [...prev.lineas]
                                    const cur = newLineas[index].cuotaRecargo
                                    if (!String(cur).trim()) {
                                      newLineas[index] = { ...newLineas[index], cuotaRecargo: valueBeforeFocusRef.current[`linea:${index}:cuotaRecargo`] ?? '' }
                                    } else {
                                      newLineas[index] = { ...newLineas[index], cuotaRecargo: normalizeEuroString(cur) }
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Retención
                      </span>
                      {factura.retencion.tipo === 'ALQUILERES' && (
                        <Tooltip
                          content={
                            <span className="block bg-amber-50 text-amber-800 text-xs p-3 rounded-md shadow-lg border border-amber-200 min-w-[260px] max-w-[320px] text-center whitespace-normal">
                              Determinados programas contables necesitan marcar las retenciones de alquileres con un código específico para que lo lleven al modelo correspondiente.
                            </span>
                          }
                          placement="top"
                          showArrow
                          classNames={{
                            base: 'border-0 p-0 bg-transparent shadow-none before:!bg-amber-50 before:!border-amber-200 data-[placement=top]:before:!-bottom-0.5',
                          }}
                        >
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-50 text-amber-600 border border-amber-200 cursor-help" aria-label="Alquileres: info">
                            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    <select
                      value={factura.retencion.tipo}
                      onChange={(e) => handleChange('retencion.tipo', e.target.value)}
                      className={`w-full min-w-0 px-2 py-1 text-[13px] border rounded focus:ring-1 focus:ring-primary focus:border-transparent ${factura.retencion.tipo === 'ALQUILERES' ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                        }`}
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
                      onFocus={() => {
                        valueBeforeFocusRef.current['retencion:cantidad'] = String(factura.retencion.cantidad ?? '')
                        handleChange('retencion.cantidad', '')
                        setMoneyFocusKey('retencion:cantidad')
                      }}
                      onBlur={() => {
                        setMoneyFocusKey(null)
                        setFactura((prev) => {
                          const cur = prev.retencion.cantidad
                          const restored = valueBeforeFocusRef.current['retencion:cantidad'] ?? ''
                          return {
                            ...prev,
                            retencion: {
                              ...prev.retencion,
                              cantidad: !String(cur).trim() ? restored : normalizeEuroString(cur),
                            },
                          }
                        })
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
                  <input
                    type="text"
                    value={moneyValue('total', factura.total)}
                    onChange={(e) => handleChange('total', e.target.value)}
                    onFocus={() => {
                      valueBeforeFocusRef.current['total'] = String(factura.total ?? '')
                      handleChange('total', '')
                      setMoneyFocusKey('total')
                    }}
                    onBlur={() => {
                      setMoneyFocusKey(null)
                      const cur = factura.total
                      if (!String(cur).trim()) {
                        handleChange('total', valueBeforeFocusRef.current['total'] ?? '')
                      } else {
                        handleChange('total', normalizeEuroString(cur))
                      }
                    }}
                    className={`w-full text-2xl font-bold text-foreground border rounded px-2 py-0.5 focus:ring-0 focus:outline-none ${totalVerification.hasErrors ? 'bg-amber-100 border-amber-300' : 'bg-transparent border-gray-200 focus:border-primary'
                      }`}
                    aria-invalid={totalVerification.hasErrors}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="md"
                    type="button"
                    onClick={() => (onParaDespues ? onParaDespues() : onSiguiente())}
                    // Permitir "Para después" también en la última factura.
                    // Bloqueamos si no podemos avanzar (salvo última).
                    disabled={Boolean(disableValidar || (!isLast && !canGoNext))}
                    className="group px-4 py-2 text-sm font-bold whitespace-nowrap inline-flex items-center justify-center gap-2"
                  >
                    <span className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
                      PARA DESPUÉS
                    </span>
                    <svg
                      className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    type="submit"
                    disabled={disableValidar || ivaVerification.hasErrors || totalVerification.hasErrors || (!isLast && !canGoNext)}
                    className="px-5 py-2 text-sm font-bold whitespace-nowrap inline-flex items-center justify-center gap-2"
                  >
                    <AnimateIcon animateOnHover className="inline-flex items-center justify-center gap-2 w-full">
                      {validarText || (disableValidar ? 'PROCESANDO…' : ivaVerification.hasErrors ? 'REVISA IVA' : totalVerification.hasErrors ? 'REVISA TOTAL' : 'VALIDAR')}
                      <CircleCheckBig size={20} className="shrink-0 text-white" />
                    </AnimateIcon>
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

