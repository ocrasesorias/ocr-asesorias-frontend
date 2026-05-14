import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'

// Límite de tamaño del archivo (5 MB es razonable para listados de hasta ~50k registros)
const MAX_FILE_BYTES = 5 * 1024 * 1024

type ParsedRow = {
  account_code: string | null
  name: string
  address: string | null
  postal_code: string | null
  city: string | null
  province: string | null
  tax_id: string | null
}

type ImportSummary = {
  inserted: number
  updated: number
  skipped: number
  errors: { row: number; reason: string }[]
}

/** Quita acentos, espacios extra y baja a minúsculas para matching de cabeceras. */
function normalizeHeader(s: unknown): string {
  if (s == null) return ''
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Detecta la fila de cabeceras buscando "código" en col A en las primeras 15 filas. */
function findHeaderRowIndex(rows: unknown[][]): number {
  const limit = Math.min(15, rows.length)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue
    const first = normalizeHeader(row[0])
    if (first === 'codigo' || first === 'cuenta' || first === 'cod.') {
      return i
    }
  }
  return -1
}

/** Normaliza un valor de celda a string trimeado (o null si vacío). */
function cellToString(v: unknown): string | null {
  if (v == null) return null
  const s = typeof v === 'number' ? String(v) : String(v).trim()
  return s.length > 0 ? s : null
}

/** Normaliza CIF/NIF: mayúsculas + sin espacios. */
function normalizeTaxId(v: unknown): string | null {
  const s = cellToString(v)
  if (!s) return null
  const clean = s.replace(/\s+/g, '').toUpperCase()
  return clean.length >= 8 && clean.length <= 18 ? clean : null
}

/** Normaliza el código contable: solo dígitos, sin puntos ni espacios. */
function normalizeAccountCode(v: unknown): string | null {
  const s = cellToString(v)
  if (!s) return null
  const digits = s.replace(/\D/g, '')
  // Debe tener al menos 4 dígitos para ser una subcuenta válida
  return digits.length >= 4 && digits.length <= 12 ? digits : null
}

/** ¿Es la fila padre genérica de Contasol (ej. "4000000 Proveedores")? */
function isParentAccountRow(code: string | null, name: string): boolean {
  if (!code) return false
  if (!/0{3}$/.test(code)) return false
  const n = name.trim().toLowerCase()
  return n === 'proveedores' || n === 'clientes' || n === 'acreedores' || !n
}

/** Parsea el workbook completo y devuelve filas válidas + meta. */
function parseWorkbook(wb: XLSX.WorkBook): { rows: ParsedRow[]; warnings: string[] } {
  const warnings: string[] = []
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) return { rows: [], warnings: ['No se encontró ninguna hoja en el archivo'] }

  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })
  const headerIdx = findHeaderRowIndex(raw)
  if (headerIdx < 0) {
    return { rows: [], warnings: ['No se encontró la fila de cabeceras (busca "Código" en columna A)'] }
  }

  const header = raw[headerIdx].map((c) => normalizeHeader(c))

  // Resolver índices de columnas relevantes por nombre. Fallback a orden Contasol clásico.
  const findCol = (...names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n)
      if (idx >= 0) return idx
    }
    return -1
  }
  const colCode = findCol('codigo', 'cuenta', 'cod.', 'cod')
  const colName = findCol('descripcion', 'nombre', 'razon social')
  const colAddress = findCol('domicilio', 'direccion')
  const colPostal = findCol('c.p.', 'cp', 'codigo postal')
  const colCity = findCol('poblacion', 'localidad')
  const colProvince = findCol('provincia')
  const colTaxId = findCol('cif', 'nif', 'cif/nif', 'dni')

  if (colCode < 0 || colName < 0) {
    return { rows: [], warnings: ['El archivo no tiene columnas "Código" y "Descripción" reconocibles'] }
  }
  if (colTaxId < 0) warnings.push('No se detectó columna CIF; se importará sin NIF')

  const rows: ParsedRow[] = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue

    const code = normalizeAccountCode(r[colCode])
    const name = cellToString(r[colName]) ?? ''
    if (!name) continue
    if (isParentAccountRow(code, name)) continue
    // Si no hay código ni CIF, no podemos identificar el proveedor: lo saltamos
    const taxId = colTaxId >= 0 ? normalizeTaxId(r[colTaxId]) : null
    if (!code && !taxId) continue

    rows.push({
      account_code: code,
      name: name.trim(),
      address: colAddress >= 0 ? cellToString(r[colAddress]) : null,
      postal_code: colPostal >= 0 ? cellToString(r[colPostal]) : null,
      city: colCity >= 0 ? cellToString(r[colCity]) : null,
      province: colProvince >= 0 ? cellToString(r[colProvince]) : null,
      tax_id: taxId,
    })
  }

  return { rows, warnings }
}

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Content-Type debe ser multipart/form-data' },
        { status: 400 }
      )
    }

    const form = await request.formData()
    const file = form.get('file')
    const clientId = String(form.get('client_id') || '').trim()
    const dryRun = String(form.get('dry_run') || '').toLowerCase() === 'true'

    if (!clientId) {
      return NextResponse.json({ error: 'client_id es requerido' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `Archivo demasiado grande (máx ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB)` },
        { status: 413 }
      )
    }

    // Verificar pertenencia del cliente a la org
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', orgId)
      .single()
    if (clientErr || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Parsear Excel (.xls binario BIFF o .xlsx)
    let workbook: XLSX.WorkBook
    try {
      const buf = Buffer.from(await file.arrayBuffer())
      workbook = XLSX.read(buf, { type: 'buffer', cellDates: false })
    } catch (err) {
      console.error('Error parseando Excel:', err)
      return NextResponse.json({ error: 'No se pudo abrir el archivo Excel' }, { status: 400 })
    }

    const { rows: parsed, warnings } = parseWorkbook(workbook)
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: warnings[0] || 'No se encontraron registros válidos en el archivo', warnings },
        { status: 400 }
      )
    }

    // Modo preview: devuelve sólo lo parseado, sin tocar BBDD
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        preview: parsed.slice(0, 5),
        total_rows: parsed.length,
        warnings,
      })
    }

    const admin = createAdminClient()
    const db = admin ?? supabase
    const summary: ImportSummary = { inserted: 0, updated: 0, skipped: 0, errors: [] }

    // Procesar registros uno a uno (volumen esperado <10k; transacción global no es necesaria)
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i]
      try {
        let existingId: string | null = null

        // 1) Match por CIF
        if (p.tax_id) {
          const { data: byTax } = await db
            .from('suppliers')
            .select('id')
            .eq('client_id', clientId)
            .ilike('tax_id', p.tax_id)
            .limit(1)
            .maybeSingle()
          existingId = byTax?.id ?? null
        }
        // 2) Match por código contable
        if (!existingId && p.account_code) {
          const { data: byCode } = await db
            .from('suppliers')
            .select('id')
            .eq('client_id', clientId)
            .eq('account_code', p.account_code)
            .limit(1)
            .maybeSingle()
          existingId = byCode?.id ?? null
        }
        // 3) Match por nombre exacto (ilike)
        if (!existingId) {
          const { data: byName } = await db
            .from('suppliers')
            .select('id')
            .eq('client_id', clientId)
            .ilike('name', p.name)
            .limit(1)
            .maybeSingle()
          existingId = byName?.id ?? null
        }

        const payload = {
          name: p.name,
          tax_id: p.tax_id,
          address: p.address,
          postal_code: p.postal_code,
          city: p.city,
          province: p.province,
          account_code: p.account_code,
        }

        if (existingId) {
          const { error } = await db.from('suppliers').update(payload).eq('id', existingId)
          if (error) {
            summary.errors.push({ row: i + 1, reason: error.message })
            continue
          }
          summary.updated++
        } else {
          // tax_id es NOT NULL en el schema actual: si no lo tenemos, usamos el código como fallback
          // para satisfacer el constraint (el código identifica de forma única al proveedor en su plan).
          const insertPayload = {
            org_id: orgId,
            client_id: clientId,
            ...payload,
            tax_id: payload.tax_id ?? p.account_code ?? `SIN-NIF-${i}`,
          }
          const { error } = await db.from('suppliers').insert(insertPayload)
          if (error) {
            summary.errors.push({ row: i + 1, reason: error.message })
            continue
          }
          summary.inserted++
        }
      } catch (err) {
        summary.errors.push({
          row: i + 1,
          reason: err instanceof Error ? err.message : 'Error desconocido',
        })
      }
    }

    summary.skipped = parsed.length - summary.inserted - summary.updated - summary.errors.length

    return NextResponse.json({
      success: true,
      total_rows: parsed.length,
      summary,
      warnings,
    })
  } catch (error) {
    console.error('Error en POST /api/suppliers/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
