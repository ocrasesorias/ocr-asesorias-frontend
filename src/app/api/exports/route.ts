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

/** Round to 2 decimal places (avoid floating-point artifacts) */
function round2(v: number | null): number | null {
  return v != null ? Math.round(v * 100) / 100 : null
}

/** Subcuenta IVA for COMPRAS: 4720 (>0%), 472090 (0% no exenta), null (exenta) */
function subcuentaIvaCompras(pctIva: number | null, tipoExencion?: string | null): string | null {
  if (pctIva == null) return null
  if (pctIva === 0) return tipoExencion ? null : '472090'
  return '4720'
}

/** Subcuenta IVA for VENTAS: 4770 (>0%), 477090 (0% no exenta), null (exenta) */
function subcuentaIvaVentas(pctIva: number | null, tipoExencion?: string | null): string | null {
  if (pctIva == null) return null
  if (pctIva === 0) return tipoExencion ? null : '477090'
  return '4770'
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
        pctIva,                                         // M  %IVA/IGIC
        cuotaIva,                                       // N  CUOTA IVA/IGIC
        subcuentaIvaCompras(pctIva, line.tipo_exencion), // O  SUBCUENTA IVA
        hasRecargo ? pctRecargo : null,                 // P  % R.E.
        hasRecargo ? cuotaRecargo : null,               // Q  IMPORTE R.E.
        null,                                           // R  SUBCUENTA R.E.
        showRetencion ? retPct : null,                  // S  % IRPF
        showRetencion ? retImpExport : null,            // T  CUOTA IRPF
        showRetencion ? '4751' : null,                  // U  SUBCUENTA IRPF
        isRectificativa ? 'X' : null,                   // V  RECTIFICATIVA
        subcuentaGasto || null,                         // W  SUBCUENTA GASTO
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
        pctIva,                                         // M  % IVA/IGIC
        cuotaIva,                                       // N  CUOTA IVA/IGIC
        subcuentaIvaVentas(pctIva, line.tipo_exencion), // O  SUBCUENTA IVA
        hasRecargo ? pctRecargo : null,                 // P  % RE
        hasRecargo ? cuotaRecargo : null,               // Q  CUOTA RE
        null,                                           // R  SUBCUENTA RE
        showRetencion ? retPct : null,                  // S  % RETENCIÓN
        showRetencion ? retImpExport : null,            // T  IMPORTE RETEN
        showRetencion ? '4730' : null,                  // U  SUBCUENTA RETENCION
        isRectificativa ? 'X' : null,                   // V  RECTIFICATIVA
        subcuentaIngreso || null,                       // W  SUBCUENTA INGRESO
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
      } catch { /* noop */ }
    }
    if (body && typeof body === 'object' && typeof (body as Record<string, unknown>).uppercase_names_addresses === 'boolean') {
      uppercaseNamesAddresses = (body as Record<string, unknown>).uppercase_names_addresses as boolean
    }

    // Build workbook
    const isCompras = tipo === 'gasto'
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Hoja1')

    if (isCompras) {
      buildComprasSheet(ws, invoiceRows, uppercaseNamesAddresses)
    } else {
      buildVentasSheet(ws, invoiceRows, uppercaseNamesAddresses)
    }

    // Generate XLSX buffer
    const buffer = Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer)

    // Upload to Supabase Storage
    const bucket = 'exports'
    const exportId = crypto.randomUUID()
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const label = isCompras ? 'COMPRAS' : 'VENTAS'
    const filename = `${label}-${ts}.xlsx`
    const storagePath = `org/${orgIds[0]}/export/${exportId}/${filename}`

    const upload = await supabase.storage
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

    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600)

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
