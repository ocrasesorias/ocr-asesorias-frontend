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
    const program: 'monitor' | 'contasol' = body?.program === 'contasol' ? 'contasol' : 'monitor'

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

    // Uppercase preference
    let uppercaseNamesAddresses = true
    if (usedOrgIds.length === 1) {
      try {
        const { data: orgPref } = await db
          .from('organizations')
          .select('uppercase_names_addresses')
          .eq('id', usedOrgIds[0])
          .maybeSingle()
        const v = (orgPref as Record<string, unknown> | null)?.uppercase_names_addresses
        if (typeof v === 'boolean') uppercaseNamesAddresses = v
      } catch (err) { console.error('Error cargando preferencia uppercase:', err) }
    }
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).uppercase_names_addresses === 'boolean') {
      uppercaseNamesAddresses = (body as Record<string, unknown>).uppercase_names_addresses as boolean
    }

    // Build workbook
    const isCompras = tipo === 'gasto'
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

    // Upload to Supabase Storage
    const bucket = 'exports'
    const exportId = crypto.randomUUID()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
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
