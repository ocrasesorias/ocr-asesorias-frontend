import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import ExcelJS from 'exceljs'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IvaLine = {
  base: number | null
  porcentaje_iva: number | null
  cuota_iva: number | null
  porcentaje_recargo?: number | null
  cuota_recargo?: number | null
  tipo_exencion?: string | null
}

type InvoiceFieldsRow = {
  supplier_name: string | null
  supplier_tax_id: string | null
  supplier_address?: string | null
  supplier_postal_code?: string | null
  supplier_city?: string | null
  supplier_province?: string | null
  invoice_number: string | null
  invoice_date: string | null
  base_amount: number | null
  vat_amount: number | null
  total_amount: number | null
  vat_rate: number | null
  subcuenta_gasto?: string | null
  retencion_porcentaje?: number | null
  retencion_importe?: number | null
  retencion_tipo?: string | null
  inversion_sujeto_pasivo?: boolean | null
  iva_lines?: IvaLine[] | null
}

type InvoiceWithFieldsRow = {
  id: string
  org_id: string
  invoice_fields: InvoiceFieldsRow | InvoiceFieldsRow[] | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function getFields(row: InvoiceWithFieldsRow): InvoiceFieldsRow | null {
  const f = row.invoice_fields
  if (!f) return null
  return Array.isArray(f) ? f[0] || null : f
}

/** Monitor date format: D/M/YY (e.g. 1/1/24) */
function formatDateMonitor(value: unknown): string {
  const s = value == null ? '' : String(value).trim()
  if (!s) return ''
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${Number(m1[1])}/${Number(m1[2])}/${m1[3].slice(2)}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${Number(m2[3])}/${Number(m2[2])}/${m2[1].slice(2)}`
  return s
}

/** Get exportable IVA lines — prefers saved iva_lines, falls back to legacy single line */
function getIvaLines(f: InvoiceFieldsRow): IvaLine[] {
  if (Array.isArray(f.iva_lines) && f.iva_lines.length > 0) {
    return f.iva_lines.filter(l => l.base != null || l.cuota_iva != null)
  }
  if (f.base_amount != null || f.vat_amount != null) {
    return [{
      base: toNum(f.base_amount),
      porcentaje_iva: toNum(f.vat_rate),
      cuota_iva: toNum(f.vat_amount),
    }]
  }
  return []
}

function applyCase(s: string | null | undefined, upper: boolean): string {
  const v = s || ''
  return upper ? v.toLocaleUpperCase('es-ES') : v
}

/** Pad subcuenta to 12 digits with trailing zeros */
function padSubcuenta(s: string | null): string | null {
  if (!s) return null
  return s.padEnd(12, '0')
}

/** Round to 2 decimal places (avoid floating-point artifacts) */
function round2(v: number | null): number | null {
  return v != null ? Math.round(v * 100) / 100 : null
}

/** Subcuenta IVA for COMPRAS: specific account per rate, null for 0% */
function subcuentaIvaCompras(pctIva: number | null): string | null {
  if (pctIva == null || pctIva === 0) return null
  if (pctIva === 21) return padSubcuenta('472000000021')
  if (pctIva === 10) return padSubcuenta('472000000010')
  if (pctIva === 4) return padSubcuenta('472000000004')
  return padSubcuenta('4720')
}

/** Subcuenta IVA for VENTAS: specific account per rate, null for 0% */
function subcuentaIvaVentas(pctIva: number | null): string | null {
  if (pctIva == null || pctIva === 0) return null
  if (pctIva === 21) return padSubcuenta('477000000021')
  if (pctIva === 10) return padSubcuenta('477000000010')
  if (pctIva === 4) return padSubcuenta('477000000004')
  return padSubcuenta('4770')
}

// ---------------------------------------------------------------------------
// a3CON / a3ECO / a3ASESOR|con helpers
// Spec oficial: "Enlace contable de entrada. Descripción de registros"
// (Wolters Kluwer España, rev. 2023). Fichero SUENLACE.DAT — ASCII ancho fijo,
// 512 bytes por registro + CRLF. Cada factura se compone de:
//   - 1 registro tipo '1' (factura) o '2' (rectificativa)  → cabecera
//   - N registros tipo '9' (uno por tipo de IVA presente)  → detalle IVA
//   - [opcional] registro tipo '4' (ampliación SII: ISP, intracom, 347, rectif.)
// Todos los offsets internos usan indexado 0-based; las "posiciones" del PDF
// oficial son 1-based, así que pos 1 → offset 0, pos 69 → offset 68, etc.
// ---------------------------------------------------------------------------

const A3_RECORD_LEN = 512
const A3_EOL = '\r\n'

/** Normaliza texto a ASCII puro (sin acentos) y pad-derecha al largo fijo. */
function a3Text(text: string | null | undefined, len: number): string {
  if (!text) return ' '.repeat(len)
  const normalized = String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '?')
    .trim()
  if (normalized.length >= len) return normalized.slice(0, len)
  return normalized.padEnd(len, ' ')
}

/** Fecha AAAAMMDD (8 chars). Acepta ISO o dd/mm/yyyy. Devuelve 8 espacios si no se puede parsear. */
function a3Date(value: unknown): string {
  const s = value == null ? '' : String(value).trim()
  if (!s) return ' '.repeat(8)
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[3]}${m1[2].padStart(2, '0')}${m1[1].padStart(2, '0')}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[1]}${m2[2]}${m2[3]}`
  return ' '.repeat(8)
}

/** Importe: signo + 10 enteros + '.' + 2 decimales = 14 chars (ej: +0000001000.00). */
function a3Importe(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const sign = n < 0 ? '-' : '+'
  const absRounded = Math.round(Math.abs(n) * 100) / 100
  const integerPart = Math.floor(absRounded)
  const decimalPart = Math.round((absRounded - integerPart) * 100)
  return sign + String(integerPart).padStart(10, '0') + '.' + String(decimalPart).padStart(2, '0')
}

/** Porcentaje xx.xx (5 chars). */
function a3Pct(value: number | null | undefined): string {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 0
  const absRounded = Math.round(Math.abs(n) * 100) / 100
  const integerPart = Math.floor(absRounded)
  const decimalPart = Math.round((absRounded - integerPart) * 100)
  return String(integerPart).padStart(2, '0') + '.' + String(decimalPart).padStart(2, '0')
}

/** Cuenta contable: solo dígitos, pad con '0' a la derecha hasta 12 chars. */
function a3Cuenta(cuenta: string | null | undefined): string {
  const digits = String(cuenta || '').replace(/\D/g, '')
  if (!digits) return ' '.repeat(12)
  return digits.padEnd(12, '0').slice(0, 12)
}

/** Construye un registro de 512 chars a partir de pares (offset0based, value). */
function a3Record(segments: { offset: number; value: string }[]): string {
  const buf = Array<string>(A3_RECORD_LEN).fill(' ')
  for (const { offset, value } of segments) {
    if (offset < 0 || offset >= A3_RECORD_LEN) continue
    for (let i = 0; i < value.length && offset + i < A3_RECORD_LEN; i++) {
      buf[offset + i] = value[i] ?? ' '
    }
  }
  return buf.join('') + A3_EOL
}

/** Subtipo de operación para factura EMITIDA (tipo=1) en pos 100-101 del registro '9'. */
function a3SubtipoEmitida(opts: { isIntracom: boolean; isISP: boolean; tipoExencion?: string | null }): string {
  if (opts.isIntracom) return '03' // Entregas intracomunitarias
  if (opts.isISP) return '08'       // ISP con derecho a deducción
  if (opts.tipoExencion === 'exento_art20') return '02'
  return '01'                       // Operaciones interiores sujetas a IVA
}

/** Subtipo de operación para factura RECIBIDA (tipo=2). */
function a3SubtipoRecibida(opts: { isIntracom: boolean; isISP: boolean; tipoExencion?: string | null }): string {
  if (opts.isISP) return '04'       // Inversión del Sujeto Pasivo
  if (opts.isIntracom) return '03'  // Adquisiciones intracomunitarias de bienes
  return '01'                       // Interiores con IVA deducible
}

/** Cuenta IVA soportado según tipo (compras). */
function a3CuentaIvaCompras(pctIva: number | null): string {
  if (pctIva === 21) return '472000000021'
  if (pctIva === 10) return '472000000010'
  if (pctIva === 4) return '472000000004'
  if (pctIva === 5) return '472000000005'
  return '472000000000'
}

/** Cuenta IVA repercutido según tipo (ventas). */
function a3CuentaIvaVentas(pctIva: number | null): string {
  if (pctIva === 21) return '477000000021'
  if (pctIva === 10) return '477000000010'
  if (pctIva === 4) return '477000000004'
  if (pctIva === 5) return '477000000005'
  return '477000000000'
}

/** Cuenta proveedor/cliente por defecto cuando no hay subcuenta específica. */
const A3_CUENTA_PROVEEDOR_DEFAULT = '400000000000'
const A3_CUENTA_CLIENTE_DEFAULT = '430000000000'
const A3_CUENTA_COMPRA_DEFAULT = '600000000000'
const A3_CUENTA_VENTA_DEFAULT = '700000000000'
const A3_CUENTA_RETENCION_DEFAULT = '473000000000'
const A3_EMPRESA_DEFAULT = '00001'

type A3ExportContext = {
  codEmpresa: string
}

/** Genera registros SUENLACE.DAT para COMPRAS (facturas recibidas). */
function buildA3SuenlaceCompras(
  invoices: InvoiceWithFieldsRow[],
  ctx: A3ExportContext,
): string {
  let output = ''
  const codEmpresa = ctx.codEmpresa

  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const ivaLines = getIvaLines(f)
    if (ivaLines.length === 0) continue

    const fechaAsiento = a3Date(f.invoice_date)
    const fechaFactura = fechaAsiento
    if (fechaAsiento.trim() === '') continue // sin fecha no se puede importar

    const totalAmount = toNum(f.total_amount) ?? 0
    const isRectificativa = totalAmount < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)
    const isIntracom = ivaLines.some((l) => l.tipo_exencion === 'intracomunitaria')

    const nombreProveedor = f.supplier_name || ''
    const nif = f.supplier_tax_id || ''
    const cp = f.supplier_postal_code || ''
    const numFactura = f.invoice_number || ''

    // Cuenta proveedor (400xxx). Sin subcuenta específica usamos default.
    // Cuenta del gasto (6xxx): prioriza subcuenta_gasto del usuario, si no 600 default.
    const cuentaProveedor = A3_CUENTA_PROVEEDOR_DEFAULT
    const cuentaCompra = (f.subcuenta_gasto || '').trim() || A3_CUENTA_COMPRA_DEFAULT

    // Importe de cabecera: en rectificativas va POSITIVO si disminuye la original
    // (es el caso cuando total_amount es negativo en el documento), NEGATIVO si aumenta.
    // Por convención KontaScan, un total negativo representa abono → positivo en a3.
    const importeCab = isRectificativa ? Math.abs(totalAmount) : totalAmount

    // ==================== REGISTRO '1' o '2' (cabecera factura) ====================
    output += a3Record([
      { offset: 0, value: '5' },                                           // pos 1: formato
      { offset: 1, value: codEmpresa },                                    // pos 2-6: empresa
      { offset: 6, value: fechaAsiento },                                  // pos 7-14: fecha apunte
      { offset: 14, value: isRectificativa ? '2' : '1' },                  // pos 15: tipo registro
      { offset: 15, value: a3Cuenta(cuentaProveedor) },                    // pos 16-27: cuenta proveedor
      { offset: 27, value: a3Text(nombreProveedor, 30) },                  // pos 28-57: descripción cuenta
      { offset: 57, value: '2' },                                          // pos 58: tipo factura (2=Compras)
      { offset: 58, value: a3Text(numFactura, 10) },                       // pos 59-68: nº factura
      { offset: 68, value: 'I' },                                          // pos 69: línea apunte
      { offset: 69, value: a3Text(nombreProveedor, 30) },                  // pos 70-99: descripción apunte
      { offset: 99, value: a3Importe(importeCab) },                        // pos 100-113: importe total
      { offset: 175, value: a3Text(nif, 14) },                             // pos 176-189: NIF
      { offset: 189, value: nif.trim() ? a3Text(nombreProveedor, 40) : ' '.repeat(40) }, // pos 190-229: nombre
      { offset: 229, value: nif.trim() ? a3Text(cp, 5) : ' '.repeat(5) }, // pos 230-234: CP
      { offset: 236, value: fechaFactura },                                // pos 237-244: fecha operación
      { offset: 244, value: fechaFactura },                                // pos 245-252: fecha factura
      { offset: 252, value: a3Text(numFactura, 60) },                      // pos 253-312: nº factura SII
      { offset: 508, value: 'E' },                                         // pos 509: moneda (Euro)
      { offset: 509, value: 'N' },                                         // pos 510: generado
    ])

    // ==================== REGISTROS '9' (detalle IVA por línea) ====================
    const retPct0 = toNum(f.retencion_porcentaje) || 0
    const retImp0 = round2(toNum(f.retencion_importe)) || 0
    const hasRetencion = retPct0 > 0 || retImp0 > 0

    for (let i = 0; i < ivaLines.length; i++) {
      const line = ivaLines[i]
      const isLast = i === ivaLines.length - 1
      const base = Math.abs(round2(toNum(line.base)) || 0)
      const pctIva = toNum(line.porcentaje_iva) || 0
      const cuotaIva = Math.abs(round2(toNum(line.cuota_iva)) || 0)
      const pctRecargo = toNum(line.porcentaje_recargo) || 0
      const cuotaRecargo = Math.abs(round2(toNum(line.cuota_recargo)) || 0)
      const retPct = i === 0 ? retPct0 : 0
      const retImp = i === 0 ? Math.abs(retImp0) : 0

      const subtipo = a3SubtipoRecibida({ isIntracom, isISP, tipoExencion: line.tipo_exencion })
      const sujeta = pctIva > 0 || pctRecargo > 0 || hasRetencion ? 'S' : 'N'

      output += a3Record([
        { offset: 0, value: '5' },                                          // formato
        { offset: 1, value: codEmpresa },                                   // empresa
        { offset: 6, value: fechaAsiento },                                 // fecha
        { offset: 14, value: '9' },                                         // tipo registro
        { offset: 15, value: a3Cuenta(cuentaCompra) },                      // pos 16-27: cuenta compra
        { offset: 27, value: a3Text('COMPRAS', 30) },                       // descripción
        { offset: 57, value: isRectificativa ? 'A' : 'C' },                 // pos 58: tipo importe
        { offset: 58, value: a3Text(numFactura, 10) },                      // nº factura
        { offset: 68, value: isLast ? 'U' : 'M' },                          // pos 69: línea apunte
        { offset: 69, value: a3Text('COMPRAS', 30) },                       // descripción apunte
        { offset: 99, value: subtipo },                                     // pos 100-101: subtipo
        { offset: 101, value: a3Importe(base) },                            // pos 102-115: base
        { offset: 115, value: a3Pct(pctIva) },                              // pos 116-120: % IVA
        { offset: 120, value: a3Importe(cuotaIva) },                        // pos 121-134: cuota IVA
        { offset: 134, value: a3Pct(pctRecargo) },                          // pos 135-139: % recargo
        { offset: 139, value: a3Importe(cuotaRecargo) },                    // pos 140-153: cuota recargo
        { offset: 153, value: a3Pct(retPct) },                              // pos 154-158: % retención
        { offset: 158, value: a3Importe(retImp) },                          // pos 159-172: cuota retención
        { offset: 174, value: sujeta },                                     // pos 175: sujeta IVA
        { offset: 175, value: 'N' },                                        // pos 176: afecta 415 (IGIC)
        { offset: 191, value: pctIva > 0 ? a3Cuenta(a3CuentaIvaCompras(pctIva)) : ' '.repeat(12) }, // pos 192-203
        { offset: 215, value: hasRetencion ? a3Cuenta(A3_CUENTA_RETENCION_DEFAULT) : ' '.repeat(12) }, // pos 216-227: cuenta retención
        { offset: 508, value: 'E' },                                        // moneda
        { offset: 509, value: 'N' },                                        // generado
      ])
    }
  }

  return output
}

/** Genera registros SUENLACE.DAT para VENTAS (facturas emitidas). */
function buildA3SuenlaceVentas(
  invoices: InvoiceWithFieldsRow[],
  ctx: A3ExportContext,
): string {
  let output = ''
  const codEmpresa = ctx.codEmpresa

  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const ivaLines = getIvaLines(f)
    if (ivaLines.length === 0) continue

    const fechaAsiento = a3Date(f.invoice_date)
    const fechaFactura = fechaAsiento
    if (fechaAsiento.trim() === '') continue

    const totalAmount = toNum(f.total_amount) ?? 0
    const isRectificativa = totalAmount < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)
    const isIntracom = ivaLines.some((l) => l.tipo_exencion === 'intracomunitaria')

    const nombreCliente = f.supplier_name || ''
    const nif = f.supplier_tax_id || ''
    const cp = f.supplier_postal_code || ''
    const numFactura = f.invoice_number || ''

    const cuentaCliente = A3_CUENTA_CLIENTE_DEFAULT
    const cuentaVenta = A3_CUENTA_VENTA_DEFAULT

    const importeCab = isRectificativa ? Math.abs(totalAmount) : totalAmount

    // ==================== REGISTRO '1' o '2' (cabecera factura) ====================
    output += a3Record([
      { offset: 0, value: '5' },
      { offset: 1, value: codEmpresa },
      { offset: 6, value: fechaAsiento },
      { offset: 14, value: isRectificativa ? '2' : '1' },
      { offset: 15, value: a3Cuenta(cuentaCliente) },
      { offset: 27, value: a3Text(nombreCliente, 30) },
      { offset: 57, value: '1' },                                          // pos 58: tipo factura (1=Ventas)
      { offset: 58, value: a3Text(numFactura, 10) },
      { offset: 68, value: 'I' },
      { offset: 69, value: a3Text(nombreCliente, 30) },
      { offset: 99, value: a3Importe(importeCab) },
      { offset: 175, value: a3Text(nif, 14) },
      { offset: 189, value: nif.trim() ? a3Text(nombreCliente, 40) : ' '.repeat(40) },
      { offset: 229, value: nif.trim() ? a3Text(cp, 5) : ' '.repeat(5) },
      { offset: 236, value: fechaFactura },
      { offset: 244, value: fechaFactura },
      { offset: 252, value: a3Text(numFactura, 60) },
      { offset: 508, value: 'E' },
      { offset: 509, value: 'N' },
    ])

    // ==================== REGISTROS '9' ====================
    const retPct0 = toNum(f.retencion_porcentaje) || 0
    const retImp0 = round2(toNum(f.retencion_importe)) || 0
    const hasRetencion = retPct0 > 0 || retImp0 > 0

    for (let i = 0; i < ivaLines.length; i++) {
      const line = ivaLines[i]
      const isLast = i === ivaLines.length - 1
      const base = Math.abs(round2(toNum(line.base)) || 0)
      const pctIva = toNum(line.porcentaje_iva) || 0
      const cuotaIva = Math.abs(round2(toNum(line.cuota_iva)) || 0)
      const pctRecargo = toNum(line.porcentaje_recargo) || 0
      const cuotaRecargo = Math.abs(round2(toNum(line.cuota_recargo)) || 0)
      const retPct = i === 0 ? retPct0 : 0
      const retImp = i === 0 ? Math.abs(retImp0) : 0

      const subtipo = a3SubtipoEmitida({ isIntracom, isISP, tipoExencion: line.tipo_exencion })
      const sujeta = pctIva > 0 || pctRecargo > 0 || hasRetencion ? 'S' : 'N'

      output += a3Record([
        { offset: 0, value: '5' },
        { offset: 1, value: codEmpresa },
        { offset: 6, value: fechaAsiento },
        { offset: 14, value: '9' },
        { offset: 15, value: a3Cuenta(cuentaVenta) },
        { offset: 27, value: a3Text('VENTAS', 30) },
        { offset: 57, value: isRectificativa ? 'A' : 'C' },
        { offset: 58, value: a3Text(numFactura, 10) },
        { offset: 68, value: isLast ? 'U' : 'M' },
        { offset: 69, value: a3Text('VENTAS', 30) },
        { offset: 99, value: subtipo },
        { offset: 101, value: a3Importe(base) },
        { offset: 115, value: a3Pct(pctIva) },
        { offset: 120, value: a3Importe(cuotaIva) },
        { offset: 134, value: a3Pct(pctRecargo) },
        { offset: 139, value: a3Importe(cuotaRecargo) },
        { offset: 153, value: a3Pct(retPct) },
        { offset: 158, value: a3Importe(retImp) },
        { offset: 174, value: sujeta },
        { offset: 175, value: 'N' },
        { offset: 227, value: pctIva > 0 ? a3Cuenta(a3CuentaIvaVentas(pctIva)) : ' '.repeat(12) }, // pos 228-239: IVA repercutido
        { offset: 215, value: hasRetencion ? a3Cuenta(A3_CUENTA_RETENCION_DEFAULT) : ' '.repeat(12) },
        { offset: 508, value: 'E' },
        { offset: 509, value: 'N' },
      ])
    }
  }

  return output
}

// ---------------------------------------------------------------------------
// ContaSol helpers
// Spec oficial: "ContaSOL 2011 — Instrucciones para la importación de datos
// desde OpenOffice.org Calc o Microsoft Office Excel" (Software del Sol).
// IVS.xls (I.V.A. soportado, 73 cols A..BU) y IVR.xls (I.V.A. repercutido,
// 64 cols A..BL). Reglas generales (p.4): fechas DD/MM/AAAA, 2 decimales,
// no puede haber filas vacías entre registros, texto admite blanco.
// ---------------------------------------------------------------------------

/** Letters (A, Z, AA, BU…) -> 0-based column index for addRow arrays */
function colIdx(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/** ContaSol date format: DD/MM/AAAA */
function formatDateContasol(value: unknown): string {
  const s = value == null ? '' : String(value).trim()
  if (!s) return ''
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m1) return `${m1[1].padStart(2, '0')}/${m1[2].padStart(2, '0')}/${m1[3]}`
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`
  return s
}

function trimField(s: string | null | undefined, max: number): string {
  const v = (s || '').trim()
  return v.length > max ? v.slice(0, max) : v
}

/** Clave de operación ContaSol IVS (col BB). Spec p.17-18. */
function claveOperacionContasolCompras(opts: {
  isRectificativa: boolean
  isISP: boolean
  isIntracom: boolean
}): number {
  if (opts.isISP) return 8                  // I - Inversión del Sujeto pasivo
  if (opts.isIntracom) return 17            // P - Adquisiciones intracomunitarias de bienes
  if (opts.isRectificativa) return 4        // D - Factura rectificativa
  return 0                                  // Operación habitual
}

/** Clave de operación ContaSol IVR (col AX). Spec p.21. */
function claveOperacionContasolVentas(opts: {
  isRectificativa: boolean
  isISP: boolean
}): number {
  if (opts.isISP) return 8                  // I - Inversión del Sujeto pasivo
  if (opts.isRectificativa) return 4        // D - Factura rectificativa
  return 0                                  // Operación habitual
}

type ContasolSplit = {
  conIva: IvaLine[]
  baseExenta: number
  importeSuplidos: number
  isIntracom: boolean
}

/**
 * Separa las líneas IVA en: líneas con cuota (%IVA>0) que irán a los 3 slots,
 * base exenta total (para col Base exenta) y suplidos (col Importe suplidos).
 */
function splitIvaLinesContasol(lines: IvaLine[]): ContasolSplit {
  const conIva: IvaLine[] = []
  let baseExenta = 0
  let importeSuplidos = 0
  let isIntracom = false
  for (const l of lines) {
    const pct = toNum(l.porcentaje_iva)
    const base = toNum(l.base) ?? 0
    if (pct == null || pct === 0) {
      if (l.tipo_exencion === 'suplidos') importeSuplidos += base
      else baseExenta += base
      if (l.tipo_exencion === 'intracomunitaria') isIntracom = true
    } else {
      conIva.push(l)
    }
  }
  return { conIva, baseExenta, importeSuplidos, isIntracom }
}

// ---------------------------------------------------------------------------
// ContaSol IVS.xls — I.V.A. soportado (gastos / facturas recibidas), 73 cols
// ---------------------------------------------------------------------------

function buildContasolIvsSheet(
  ws: ExcelJS.Worksheet,
  invoices: InvoiceWithFieldsRow[],
  uppercase: boolean,
) {
  const NUM_COLS = 73 // A..BU

  let codigo = 1
  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const ivaLinesAll = getIvaLines(f)
    if (ivaLinesAll.length === 0) continue

    const { conIva, baseExenta, importeSuplidos, isIntracom } = splitIvaLinesContasol(ivaLinesAll)
    const ivaSlots = conIva.slice(0, 3) // ContaSol sólo permite 3 tipos por registro

    const isRectificativa = (toNum(f.total_amount) ?? 0) < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)
    const fecha = formatDateContasol(f.invoice_date)

    const row: (string | number | null)[] = new Array(NUM_COLS).fill(null)

    row[colIdx('A')] = codigo++                                                 // Código (índice)
    row[colIdx('B')] = 1                                                        // Libro IVA
    row[colIdx('C')] = fecha                                                    // Fecha
    // D (Cuenta proveedor): vacío; ContaSol lo resuelve por CIF si PRO.xls está importado
    row[colIdx('E')] = trimField(f.invoice_number, 12)                          // Factura
    row[colIdx('F')] = applyCase(trimField(f.supplier_name, 100), uppercase)    // Nombre
    row[colIdx('G')] = trimField((f.supplier_tax_id || '').toUpperCase(), 12)   // CIF
    row[colIdx('H')] = isIntracom ? 2 : 0                                       // Tipo op: Interior=0, Importación=1, Intracom=2
    row[colIdx('I')] = 0                                                        // Deducible

    // Hasta 3 tipos de IVA: base (J/K/L), %iva (M/N/O), %rec (P/Q/R), importe iva (S/T/U), importe rec (V/W/X)
    const baseCols = [colIdx('J'), colIdx('K'), colIdx('L')]
    const pctIvaCols = [colIdx('M'), colIdx('N'), colIdx('O')]
    const pctRecCols = [colIdx('P'), colIdx('Q'), colIdx('R')]
    const impIvaCols = [colIdx('S'), colIdx('T'), colIdx('U')]
    const impRecCols = [colIdx('V'), colIdx('W'), colIdx('X')]

    for (let i = 0; i < ivaSlots.length; i++) {
      const l = ivaSlots[i]
      row[baseCols[i]] = round2(toNum(l.base))
      row[pctIvaCols[i]] = toNum(l.porcentaje_iva)
      row[impIvaCols[i]] = round2(toNum(l.cuota_iva))
      const pctRec = toNum(l.porcentaje_recargo)
      if (pctRec != null && pctRec > 0) {
        row[pctRecCols[i]] = pctRec
        row[impRecCols[i]] = round2(toNum(l.cuota_recargo))
      }
    }

    row[colIdx('Y')] = round2(toNum(f.total_amount))                            // Total
    row[colIdx('Z')] = 0                                                        // Bienes soportados: No

    row[colIdx('AS')] = 1                                                       // Incluir en modelo 347

    const retPct = toNum(f.retencion_porcentaje)
    const retImp = toNum(f.retencion_importe)
    const hasRetencion = (retPct != null && retPct > 0) || (retImp != null && retImp > 0)
    if (hasRetencion) {
      row[colIdx('AT')] = retPct
      row[colIdx('AU')] = retImp != null
        ? round2(isRectificativa ? -Math.abs(retImp) : retImp)
        : null
      row[colIdx('AV')] = 1                                                     // Tipo retención: 1=Actividad profesional dineraria
    }

    row[colIdx('AX')] = fecha                                                   // Fecha expedición
    if (baseExenta !== 0) row[colIdx('AY')] = round2(baseExenta)                // Base imponible exenta
    row[colIdx('AZ')] = 100                                                     // % deducible

    row[colIdx('BB')] = claveOperacionContasolCompras({ isRectificativa, isISP, isIntracom })
    row[colIdx('BC')] = 1                                                       // Identificación fiscal: NIF
    row[colIdx('BD')] = 0                                                       // Tipo impuesto: IVA

    if (importeSuplidos !== 0) row[colIdx('BT')] = round2(importeSuplidos)      // Importe suplidos

    ws.addRow(row)
  }
}

// ---------------------------------------------------------------------------
// ContaSol IVR.xls — I.V.A. repercutido (ingresos / facturas emitidas), 64 cols
// ---------------------------------------------------------------------------

function buildContasolIvrSheet(
  ws: ExcelJS.Worksheet,
  invoices: InvoiceWithFieldsRow[],
  uppercase: boolean,
) {
  const NUM_COLS = 64 // A..BL

  let codigo = 1
  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const ivaLinesAll = getIvaLines(f)
    if (ivaLinesAll.length === 0) continue

    const { conIva, baseExenta, importeSuplidos, isIntracom } = splitIvaLinesContasol(ivaLinesAll)
    const ivaSlots = conIva.slice(0, 3)

    const isRectificativa = (toNum(f.total_amount) ?? 0) < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)
    const fecha = formatDateContasol(f.invoice_date)

    const row: (string | number | null)[] = new Array(NUM_COLS).fill(null)

    row[colIdx('A')] = codigo++                                                 // Código (índice)
    row[colIdx('B')] = 1                                                        // Libro IVA
    row[colIdx('C')] = fecha                                                    // Fecha
    // D (Cuenta cliente): vacío; ContaSol resuelve por CIF vía CLI.xls
    row[colIdx('E')] = trimField(f.invoice_number, 12)                          // Factura
    row[colIdx('F')] = applyCase(trimField(f.supplier_name, 40), uppercase)     // Nombre (max 40 en IVR)
    row[colIdx('G')] = trimField((f.supplier_tax_id || '').toUpperCase(), 12)   // CIF
    row[colIdx('H')] = isIntracom ? 1 : 0                                       // Tipo op: General=0, Intracom=1, Export=2, Interior exento=3

    // Slots 1/2/3: bases I/J/K, %iva L/M/N, %rec O/P/Q, importe iva R/S/T, importe rec U/V/W
    const baseCols = [colIdx('I'), colIdx('J'), colIdx('K')]
    const pctIvaCols = [colIdx('L'), colIdx('M'), colIdx('N')]
    const pctRecCols = [colIdx('O'), colIdx('P'), colIdx('Q')]
    const impIvaCols = [colIdx('R'), colIdx('S'), colIdx('T')]
    const impRecCols = [colIdx('U'), colIdx('V'), colIdx('W')]

    for (let i = 0; i < ivaSlots.length; i++) {
      const l = ivaSlots[i]
      row[baseCols[i]] = round2(toNum(l.base))
      row[pctIvaCols[i]] = toNum(l.porcentaje_iva)
      row[impIvaCols[i]] = round2(toNum(l.cuota_iva))
      const pctRec = toNum(l.porcentaje_recargo)
      if (pctRec != null && pctRec > 0) {
        row[pctRecCols[i]] = pctRec
        row[impRecCols[i]] = round2(toNum(l.cuota_recargo))
      }
    }

    row[colIdx('X')] = round2(toNum(f.total_amount))                            // Total

    row[colIdx('AQ')] = 1                                                       // Incluir en modelo 347

    const retPct = toNum(f.retencion_porcentaje)
    const retImp = toNum(f.retencion_importe)
    const hasRetencion = (retPct != null && retPct > 0) || (retImp != null && retImp > 0)
    if (hasRetencion) {
      row[colIdx('AR')] = retPct
      row[colIdx('AS')] = retImp != null
        ? round2(isRectificativa ? -Math.abs(retImp) : retImp)
        : null
      row[colIdx('AT')] = 1                                                     // Tipo retención: profesional dineraria
    }

    row[colIdx('AV')] = fecha                                                   // Fecha expedición
    if (baseExenta !== 0) row[colIdx('AW')] = round2(baseExenta)                // Base exenta

    row[colIdx('AX')] = claveOperacionContasolVentas({ isRectificativa, isISP }) // Clave operación
    row[colIdx('AY')] = 1                                                       // Identificación fiscal: NIF
    row[colIdx('AZ')] = 0                                                       // Tipo impuesto: IVA

    if (importeSuplidos !== 0) row[colIdx('BK')] = round2(importeSuplidos)      // Importe suplidos

    ws.addRow(row)
  }
}

// ---------------------------------------------------------------------------
// COMPRAS sheet (36 columns A-AJ)
// ---------------------------------------------------------------------------

function buildComprasSheet(ws: ExcelJS.Worksheet, invoices: InvoiceWithFieldsRow[], uppercase: boolean) {
  // Row 1: section headers
  const sections: (string | null)[] = new Array(36).fill(null)
  sections[0] = 'DATOS GENERALES:'     // A
  sections[4] = 'DATOS PROVEEDOR:'     // E
  sections[11] = 'DATOS DE LA FACTURA:' // L
  sections[22] = 'DATOS GASTO:'        // W
  sections[24] = 'DATOS PAGO:'         // Y
  sections[27] = 'SII:'               // AB
  sections[28] = 'TIPO DE OPERACIÓN:'  // AC
  const sectionRow = ws.addRow(sections)
  sectionRow.font = { bold: true }

  // Row 2: column headers
  ws.addRow([
    'FECHA DE ASIENTO',          // A
    'FECHA FACTURA',             // B
    'Nº FACTURA',                // C
    'CONCEPTO',                  // D
    'SUBCUENTA PROVEEDOR',       // E
    'CIF/NIF',                   // F
    'NOMBRE',                    // G
    'DOMICILIO',                 // H
    'LOCALIDAD',                 // I
    'PROVINCIA',                 // J
    'C.P.',                      // K
    'BASE',                      // L
    '%IVA/IGIC',                 // M
    'CUOTA IVA/IGIC',            // N
    'SUBCUENTA IVA/IGIC',        // O
    '% R.E.',                    // P
    'IMPORTE R.E.',              // Q
    'SUBCUENTA R.E.',            // R
    '% IRPF',                    // S
    'CUOTA IRPF',                // T
    'SUBCUENTA IRPF',            // U
    'RECTIFICATIVA',             // V
    'SUBCUENTA GASTO',           // W
    'IMPORTE GASTO/INGRESO',     // X
    'DEBE',                      // Y
    'HABER',                     // Z
    'TOTAL FRA.',                // AA
    'SII COMUNICADA',            // AB
    'AIB',                       // AC
    'IMPORTACIONES',             // AD
    'RECTIF DEDUCCIONES',        // AE
    'AIS ISP',                   // AF
    'REAG',                      // AG
    'IVA NO DEDUCIBLE',          // AH
    'CUENTA NO DEDUCIBLE',       // AI
    'IMPORTE NO DEDUCIBLE',      // AJ
  ])

  // Data rows
  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const fecha = formatDateMonitor(f.invoice_date)
    const numero = f.invoice_number || ''
    const concepto = `SU FRA. NÚM. ${numero}`
    const cif = (f.supplier_tax_id || '').trim().toUpperCase()
    const nombre = applyCase(f.supplier_name, uppercase)
    const direccion = applyCase(f.supplier_address, uppercase)
    const localidad = applyCase(f.supplier_city, uppercase)
    const provincia = applyCase(f.supplier_province, uppercase)
    const cp = f.supplier_postal_code || ''
    const subcuentaGasto = f.subcuenta_gasto || ''
    const isRectificativa = (toNum(f.total_amount) ?? 0) < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)

    const retPct = toNum(f.retencion_porcentaje)
    const retImp = toNum(f.retencion_importe)
    const hasRetencion = (retPct != null && retPct > 0) || (retImp != null && retImp > 0)

    const ivaLines = getIvaLines(f)
    if (ivaLines.length === 0) continue

    // Retención: en rectificativas el importe IRPF va negativo (Monitor lo espera así)
    const retImpExport = retImp != null
      ? round2(isRectificativa ? -Math.abs(retImp) : retImp)
      : null

    for (let i = 0; i < ivaLines.length; i++) {
      const line = ivaLines[i]
      const base = round2(toNum(line.base))
      const pctIva = toNum(line.porcentaje_iva)
      const cuotaIva = round2(toNum(line.cuota_iva))
      const pctRecargo = toNum(line.porcentaje_recargo)
      const cuotaRecargo = round2(toNum(line.cuota_recargo))
      const hasRecargo = pctRecargo != null && pctRecargo > 0
      const showRetencion = i === 0 && hasRetencion

      ws.addRow([
        fecha,                                          // A  FECHA ASIENTO
        fecha,                                          // B  FECHA FACTURA
        numero,                                         // C  Nº FACTURA
        concepto,                                       // D  CONCEPTO
        null,                                           // E  SUBCUENTA PROVEEDOR
        cif,                                            // F  CIF/NIF
        nombre,                                         // G  NOMBRE
        direccion,                                      // H  DOMICILIO
        localidad,                                      // I  LOCALIDAD
        provincia,                                      // J  PROVINCIA
        cp,                                             // K  C.P.
        base,                                           // L  BASE
        pctIva ?? null,                                  // M  %IVA/IGIC
        cuotaIva,                                       // N  CUOTA IVA/IGIC
        subcuentaIvaCompras(pctIva),                    // O  SUBCUENTA IVA
        hasRecargo ? pctRecargo : null,                 // P  % R.E.
        hasRecargo ? cuotaRecargo : null,               // Q  IMPORTE R.E.
        null,                                           // R  SUBCUENTA R.E.
        showRetencion ? retPct : null,                  // S  % IRPF
        showRetencion ? retImpExport : null,            // T  CUOTA IRPF
        showRetencion ? padSubcuenta('4751') : null,     // U  SUBCUENTA IRPF
        isRectificativa ? 'X' : null,                   // V  RECTIFICATIVA
        padSubcuenta(subcuentaGasto) || null,           // W  SUBCUENTA GASTO
        base,                                           // X  IMPORTE GASTO
        null,                                           // Y  DEBE
        null,                                           // Z  HABER
        null,                                           // AA TOTAL FRA.
        null,                                           // AB SII COMUNICADA
        null,                                           // AC AIB
        null,                                           // AD IMPORTACIONES
        null,                                           // AE RECTIF DEDUCCIONES
        isISP ? 'X' : null,                             // AF AIS ISP
        null,                                           // AG REAG
        null,                                           // AH IVA NO DEDUCIBLE
        null,                                           // AI CUENTA NO DEDUCIBLE
        null,                                           // AJ IMPORTE NO DEDUCIBLE
      ])
    }
  }
}

// ---------------------------------------------------------------------------
// VENTAS sheet (40 columns A-AN)
// ---------------------------------------------------------------------------

function buildVentasSheet(ws: ExcelJS.Worksheet, invoices: InvoiceWithFieldsRow[], uppercase: boolean) {
  // Row 1: section headers
  const sections: (string | null)[] = new Array(40).fill(null)
  sections[0] = 'DATOS GENERALES:'        // A
  sections[4] = 'DATOS CLIENTES:'         // E
  sections[11] = 'DATOS DE LA FACTURA:'    // L
  sections[22] = 'DATOS INGRESO:'         // W
  sections[24] = 'DATOS COBRO AL CONTADO:' // Y
  sections[27] = 'SII:'                   // AB
  sections[29] = 'VENTA EN VENTANILLA ÚNICA:' // AD
  sections[35] = 'TIPO DE OPERACIÓN:'     // AJ
  const sectionRow = ws.addRow(sections)
  sectionRow.font = { bold: true }

  // Row 2: column headers
  ws.addRow([
    'FECHA ASIENTO',                       // A
    'FECHA FACTURA',                       // B
    'Nº FACTURA',                          // C
    'CONCEPTO',                            // D
    'SUBCUENTA CLIENTE',                   // E
    'CIF/NIF CLIENTE',                     // F
    'NOMBRE',                              // G
    'DOMICILIO',                           // H
    'LOCALIDAD',                           // I
    'PROVINCIA',                           // J
    'C.P. CLIENTE',                        // K
    'BASE',                                // L
    '% IVA/IGIC',                          // M
    'CUOTA IVA/IGIC',                      // N
    'SUBCUENTA IVA/IGIC',                  // O
    '% RE',                                // P
    'CUOTA RE',                            // Q
    'SUBCUENTA RE',                        // R
    '% RETENCIÓN',                         // S
    'IMPORTE RETEN',                       // T
    'SUBCUENTA RETENCION',                 // U
    'RECTIFICATIVA',                       // V
    'SUBCUENTA INGRESO',                   // W
    'BASE',                                // X
    'DEBE',                                // Y
    'HABER',                               // Z
    'TOTAL',                               // AA
    'COMUNICADA',                          // AB
    'TIQUE',                               // AC
    'PREST. SERVICIO EN VENTANILLA ÚNICA', // AD
    'ENTREGA DE BIENES EN VENTANILLA ÚNICA', // AE
    'CÓDIGO DE PAÍS',                      // AF
    'TIPO DE IVA',                         // AG
    'EJERCICIO',                           // AH
    'PERIODO RECTIFICATIVA',               // AI
    'EIE',                                 // AJ
    'EXPORTACION',                         // AK
    'MODI BASES CUOTA',                    // AL
    'OP. FINANCIERA',                      // AM
    'ENTREGAS ISP',                        // AN
  ])

  // Data rows
  for (const inv of invoices) {
    const f = getFields(inv)
    if (!f) continue

    const fecha = formatDateMonitor(f.invoice_date)
    const numero = f.invoice_number || ''
    const concepto = `NTRA. FRA. ${numero}`
    const cif = (f.supplier_tax_id || '').trim().toUpperCase()
    const nombre = applyCase(f.supplier_name, uppercase)
    const direccion = applyCase(f.supplier_address, uppercase)
    const localidad = applyCase(f.supplier_city, uppercase)
    const provincia = applyCase(f.supplier_province, uppercase)
    const cp = f.supplier_postal_code || ''
    const subcuentaIngreso = f.subcuenta_gasto || ''
    const isRectificativa = (toNum(f.total_amount) ?? 0) < 0 || (toNum(f.base_amount) ?? 0) < 0
    const isISP = Boolean(f.inversion_sujeto_pasivo)

    const retPct = toNum(f.retencion_porcentaje)
    const retImp = toNum(f.retencion_importe)
    const hasRetencion = (retPct != null && retPct > 0) || (retImp != null && retImp > 0)

    const ivaLines = getIvaLines(f)
    if (ivaLines.length === 0) continue

    const retImpExport = retImp != null
      ? round2(isRectificativa ? -Math.abs(retImp) : retImp)
      : null

    for (let i = 0; i < ivaLines.length; i++) {
      const line = ivaLines[i]
      const base = round2(toNum(line.base))
      const pctIva = toNum(line.porcentaje_iva)
      const cuotaIva = round2(toNum(line.cuota_iva))
      const pctRecargo = toNum(line.porcentaje_recargo)
      const cuotaRecargo = round2(toNum(line.cuota_recargo))
      const hasRecargo = pctRecargo != null && pctRecargo > 0
      const showRetencion = i === 0 && hasRetencion

      ws.addRow([
        fecha,                                          // A  FECHA ASIENTO
        fecha,                                          // B  FECHA FACTURA
        numero,                                         // C  Nº FACTURA
        concepto,                                       // D  CONCEPTO
        null,                                           // E  SUBCUENTA CLIENTE
        cif,                                            // F  CIF/NIF CLIENTE
        nombre,                                         // G  NOMBRE
        direccion,                                      // H  DOMICILIO
        localidad,                                      // I  LOCALIDAD
        provincia,                                      // J  PROVINCIA
        cp,                                             // K  C.P.
        base,                                           // L  BASE
        pctIva ?? null,                                  // M  % IVA/IGIC
        cuotaIva,                                       // N  CUOTA IVA/IGIC
        subcuentaIvaVentas(pctIva),                     // O  SUBCUENTA IVA
        hasRecargo ? pctRecargo : null,                 // P  % RE
        hasRecargo ? cuotaRecargo : null,               // Q  CUOTA RE
        null,                                           // R  SUBCUENTA RE
        showRetencion ? retPct : null,                  // S  % RETENCIÓN
        showRetencion ? retImpExport : null,            // T  IMPORTE RETEN
        showRetencion ? padSubcuenta('4730') : null,     // U  SUBCUENTA RETENCION
        isRectificativa ? 'X' : null,                   // V  RECTIFICATIVA
        padSubcuenta(subcuentaIngreso) || null,         // W  SUBCUENTA INGRESO
        base,                                           // X  BASE (importe ingreso)
        null,                                           // Y  DEBE
        null,                                           // Z  HABER
        null,                                           // AA TOTAL
        null,                                           // AB COMUNICADA
        null,                                           // AC TIQUE
        null,                                           // AD PREST. SERVICIO VENT. ÚNICA
        null,                                           // AE ENTREGA BIENES VENT. ÚNICA
        null,                                           // AF CÓDIGO DE PAÍS
        null,                                           // AG TIPO DE IVA
        null,                                           // AH EJERCICIO
        null,                                           // AI PERIODO RECTIFICATIVA
        null,                                           // AJ EIE
        null,                                           // AK EXPORTACION
        null,                                           // AL MODI BASES CUOTA
        null,                                           // AM OP. FINANCIERA
        isISP ? 'X' : null,                             // AN ENTREGAS ISP
      ])
    }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgIds } = auth

    const body = await request.json().catch(() => null)
    const invoiceIds: string[] = Array.isArray(body?.invoice_ids) ? body.invoice_ids : []
    const tipo: 'gasto' | 'ingreso' = body?.tipo === 'ingreso' ? 'ingreso' : 'gasto'

    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoice_ids es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    const { data, error } = await db
      .from('invoices')
      .select(`
        id,
        org_id,
        invoice_fields (
          supplier_name, supplier_tax_id,
          supplier_address, supplier_postal_code, supplier_city, supplier_province,
          invoice_number, invoice_date,
          base_amount, vat_amount, total_amount, vat_rate,
          subcuenta_gasto,
          retencion_porcentaje, retencion_importe, retencion_tipo,
          inversion_sujeto_pasivo,
          iva_lines
        )
      `)
      .in('org_id', orgIds)
      .in('id', invoiceIds)

    if (error) {
      return NextResponse.json({ error: error.message || 'Error cargando facturas' }, { status: 500 })
    }

    const invoiceRows = (data || []) as InvoiceWithFieldsRow[]

    // Preserve original order from invoice_ids
    const orderMap = new Map(invoiceIds.map((id, i) => [id, i]))
    invoiceRows.sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))

    // Check all invoices belong to the same org
    const usedOrgIds = [...new Set(invoiceRows.map(r => String(r.org_id || '')).filter(Boolean))]
    if (usedOrgIds.length > 1) {
      return NextResponse.json(
        { error: 'Las facturas seleccionadas pertenecen a varias organizaciones' },
        { status: 400 }
      )
    }

    // Org preferences — fuente de verdad: tabla organizations
    let uppercaseNamesAddresses = true
    let program: 'monitor' | 'contasol' | 'a3' = 'monitor'
    if (usedOrgIds.length === 1) {
      try {
        const { data: orgPref } = await db
          .from('organizations')
          .select('uppercase_names_addresses, accounting_program')
          .eq('id', usedOrgIds[0])
          .maybeSingle()
        const prefObj = (orgPref as Record<string, unknown> | null) || {}
        if (typeof prefObj.uppercase_names_addresses === 'boolean') {
          uppercaseNamesAddresses = prefObj.uppercase_names_addresses
        }
        if (prefObj.accounting_program === 'contasol') program = 'contasol'
        else if (prefObj.accounting_program === 'a3') program = 'a3'
      } catch (err) { console.error('Error cargando preferencias de organización:', err) }
    }
    // Override manual desde body (sólo útil para tests/debug, no se expone en UI)
    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>
      if (typeof b.uppercase_names_addresses === 'boolean') {
        uppercaseNamesAddresses = b.uppercase_names_addresses
      }
      if (b.program === 'contasol' || b.program === 'monitor' || b.program === 'a3') {
        program = b.program
      }
    }

    const isCompras = tipo === 'gasto'
    const bucket = 'exports'
    const exportId = crypto.randomUUID()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')

    // Rama a3: genera fichero SUENLACE.DAT (ASCII ancho fijo) en lugar de XLSX
    if (program === 'a3') {
      const codEmpresa = A3_EMPRESA_DEFAULT
      const suenlace = isCompras
        ? buildA3SuenlaceCompras(invoiceRows, { codEmpresa })
        : buildA3SuenlaceVentas(invoiceRows, { codEmpresa })

      if (!suenlace) {
        return NextResponse.json(
          { error: 'No se pudo generar el fichero SUENLACE.DAT (sin registros válidos)' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(suenlace, 'ascii')
      // a3 espera literalmente "SUENLACE.DAT". El exportId único en la ruta evita colisiones.
      const filename = 'SUENLACE.DAT'
      const storagePath = `org/${orgIds[0]}/export/${exportId}/${filename}`

      const upload = await db.storage.from(bucket).upload(storagePath, buffer, {
        contentType: 'text/plain; charset=us-ascii',
        upsert: false,
      })
      if (upload.error) {
        return NextResponse.json(
          { error: upload.error.message || 'Error guardando export' },
          { status: 500 }
        )
      }

      const { data: signed } = await db.storage.from(bucket).createSignedUrl(storagePath, 3600)
      return NextResponse.json({
        success: true,
        bucket,
        storagePath,
        signedUrl: signed?.signedUrl || null,
      }, { status: 201 })
    }

    // Rama por defecto: construye workbook Excel (Monitor o ContaSol)
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Hoja1')

    if (program === 'contasol') {
      if (isCompras) buildContasolIvsSheet(ws, invoiceRows, uppercaseNamesAddresses)
      else buildContasolIvrSheet(ws, invoiceRows, uppercaseNamesAddresses)
    } else {
      if (isCompras) buildComprasSheet(ws, invoiceRows, uppercaseNamesAddresses)
      else buildVentasSheet(ws, invoiceRows, uppercaseNamesAddresses)
    }

    // Generate XLSX buffer
    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer)

    // ContaSol exige literalmente IVS.xlsx / IVR.xlsx al importar.
    // El exportId único en la ruta evita colisiones sin necesidad de timestamp.
    const filename = program === 'contasol'
      ? (isCompras ? 'IVS.xlsx' : 'IVR.xlsx')
      : `${isCompras ? 'COMPRAS' : 'VENTAS'}-${ts}.xlsx`
    const storagePath = `org/${orgIds[0]}/export/${exportId}/${filename}`

    const upload = await db.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })

    if (upload.error) {
      return NextResponse.json(
        { error: upload.error.message || 'Error guardando export' },
        { status: 500 }
      )
    }

    const { data: signed } = await db.storage.from(bucket).createSignedUrl(storagePath, 3600)

    return NextResponse.json({
      success: true,
      bucket,
      storagePath,
      signedUrl: signed?.signedUrl || null,
    }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/exports:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
