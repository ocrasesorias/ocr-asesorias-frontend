import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

type Range = { page_start: number; page_end: number; confidence: number; signals: string[] }
type DetectionResult = {
  total_pages: number
  ranges: Range[]
  method: 'single' | 'heuristic' | 'ai' | 'hybrid'
  needs_review: boolean
  ai_cost_estimate: number
}

type InvoiceRow = {
  id: string
  org_id: string
  client_id: string | null
  upload_id: string
  bucket: string
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string
  status: string | null
  page_start: number | null
  page_end: number | null
  total_pages: number | null
  split_group_id: string | null
}

async function createSignedUrlWithFallback(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresIn: number
): Promise<string | null> {
  const userSigned = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (!userSigned.error && userSigned.data?.signedUrl) return userSigned.data.signedUrl
  const admin = createAdminClient()
  if (!admin) return null
  const adminSigned = await admin.storage.from(bucket).createSignedUrl(path, expiresIn)
  return adminSigned.data?.signedUrl ?? null
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL
    if (!extractorUrl) {
      return NextResponse.json(
        { error: 'INVOICE_EXTRACTOR_API_URL no está configurada' },
        { status: 500 }
      )
    }

    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('id, org_id')
      .eq('id', uploadId)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }
    if (upload.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    // Solo procesamos invoices que NO son ya parte de un grupo split (idempotente)
    const { data: invoicesRaw, error: invErr } = await supabase
      .from('invoices')
      .select(
        'id, org_id, client_id, upload_id, bucket, storage_path, original_filename, mime_type, file_size_bytes, uploaded_by, status, page_start, page_end, total_pages, split_group_id'
      )
      .eq('org_id', orgId)
      .eq('upload_id', uploadId)
      .is('split_group_id', null)
      .order('created_at', { ascending: true })

    if (invErr) {
      return NextResponse.json({ error: invErr.message || 'Error cargando facturas' }, { status: 500 })
    }

    const invoices = (invoicesRaw || []) as InvoiceRow[]

    const headers: Record<string, string> = {}
    if (process.env.BACKEND_API_KEY) headers['X-API-Key'] = process.env.BACKEND_API_KEY

    type Detection = {
      uploadId: string
      originalInvoiceId: string
      filename: string | null
      method: DetectionResult['method']
      ranges: Range[]
      needs_review: boolean
      ai_cost_estimate: number
      total_pages: number
      created_invoice_ids: string[]   // IDs de las nuevas invoices (excluye la original)
      split_group_id: string | null
      error?: string
    }

    const detections: Detection[] = []
    let totalSplit = 0
    let totalAiCost = 0

    for (const inv of invoices) {
      try {
        // Saltar si no es PDF (imágenes son siempre 1 factura)
        const isPdf =
          (inv.mime_type || '').toLowerCase() === 'application/pdf' ||
          (inv.original_filename || '').toLowerCase().endsWith('.pdf')
        if (!isPdf) continue

        const signedUrl = await createSignedUrlWithFallback(supabase, inv.bucket, inv.storage_path, 60 * 10)
        if (!signedUrl) {
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: 'single',
            ranges: [],
            needs_review: false,
            ai_cost_estimate: 0,
            total_pages: 0,
            created_invoice_ids: [],
            split_group_id: null,
            error: 'No se pudo obtener URL firmada',
          })
          continue
        }

        const fileResp = await fetch(signedUrl)
        if (!fileResp.ok) {
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: 'single',
            ranges: [],
            needs_review: false,
            ai_cost_estimate: 0,
            total_pages: 0,
            created_invoice_ids: [],
            split_group_id: null,
            error: `Descarga fallida (${fileResp.status})`,
          })
          continue
        }
        const arrayBuf = await fileResp.arrayBuffer()
        const blob = new Blob([arrayBuf], { type: 'application/pdf' })

        const fd = new FormData()
        fd.append('file', blob, inv.original_filename || 'factura.pdf')

        const detResp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/detect-invoices`, {
          method: 'POST',
          headers,
          body: fd,
        })

        if (!detResp.ok) {
          const errJson = await detResp.json().catch(() => null)
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: 'single',
            ranges: [],
            needs_review: false,
            ai_cost_estimate: 0,
            total_pages: 0,
            created_invoice_ids: [],
            split_group_id: null,
            error: String(errJson?.detail || errJson?.error || `HTTP ${detResp.status}`),
          })
          continue
        }

        const result = (await detResp.json()) as DetectionResult
        totalAiCost += result.ai_cost_estimate || 0

        // 1 factura → no hay nada que hacer
        if (!Array.isArray(result.ranges) || result.ranges.length <= 1) {
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: result.method,
            ranges: result.ranges || [],
            needs_review: false,
            ai_cost_estimate: result.ai_cost_estimate || 0,
            total_pages: result.total_pages,
            created_invoice_ids: [],
            split_group_id: null,
          })
          continue
        }

        // N facturas → split: actualizar original con primer rango, insertar N-1 nuevas
        const splitGroupId = crypto.randomUUID()
        const ranges = result.ranges
        const first = ranges[0]

        const { error: updErr } = await supabase
          .from('invoices')
          .update({
            page_start: first.page_start,
            page_end: first.page_end,
            total_pages: result.total_pages,
            split_group_id: splitGroupId,
          })
          .eq('id', inv.id)

        if (updErr) {
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: result.method,
            ranges,
            needs_review: result.needs_review,
            ai_cost_estimate: result.ai_cost_estimate || 0,
            total_pages: result.total_pages,
            created_invoice_ids: [],
            split_group_id: null,
            error: `No se pudo actualizar invoice original: ${updErr.message}`,
          })
          continue
        }

        const newRows = ranges.slice(1).map((r) => ({
          org_id: inv.org_id,
          client_id: inv.client_id,
          upload_id: inv.upload_id,
          bucket: inv.bucket,
          storage_path: inv.storage_path,
          original_filename: inv.original_filename,
          mime_type: inv.mime_type,
          file_size_bytes: inv.file_size_bytes,
          uploaded_by: inv.uploaded_by || user.id,
          status: 'uploaded',
          error_message: null,
          page_start: r.page_start,
          page_end: r.page_end,
          total_pages: result.total_pages,
          split_group_id: splitGroupId,
        }))

        const { data: inserted, error: insErr } = await supabase
          .from('invoices')
          .insert(newRows)
          .select('id')

        if (insErr) {
          // Revert el update de la original para mantener estado consistente
          await supabase
            .from('invoices')
            .update({
              page_start: null, page_end: null, total_pages: null, split_group_id: null,
            })
            .eq('id', inv.id)
          detections.push({
            uploadId,
            originalInvoiceId: inv.id,
            filename: inv.original_filename,
            method: result.method,
            ranges,
            needs_review: result.needs_review,
            ai_cost_estimate: result.ai_cost_estimate || 0,
            total_pages: result.total_pages,
            created_invoice_ids: [],
            split_group_id: null,
            error: `No se pudieron insertar invoices nuevas: ${insErr.message}`,
          })
          continue
        }

        // Consumir N-1 créditos extra (la original ya consumió 1 al subirse)
        const extras = newRows.length
        if (extras > 0) {
          for (let k = 0; k < extras; k++) {
            try {
              const newId = (inserted as { id: string }[] | null)?.[k]?.id
              await supabase.rpc('consume_credit', {
                p_org_id: orgId,
                p_invoice_id: newId,
                p_upload_id: uploadId,
                p_allow_negative: false,
              })
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e)
              if (msg.includes('insufficient_credits')) {
                console.warn(`Sin créditos para invoice extra ${k} de ${inv.id}; continúa sin consumir`)
              } else {
                console.error('Error consumiendo crédito extra:', e)
              }
            }
          }
        }

        totalSplit++
        detections.push({
          uploadId,
          originalInvoiceId: inv.id,
          filename: inv.original_filename,
          method: result.method,
          ranges,
          needs_review: result.needs_review,
          ai_cost_estimate: result.ai_cost_estimate || 0,
          total_pages: result.total_pages,
          created_invoice_ids: ((inserted as { id: string }[] | null) || []).map((r) => r.id),
          split_group_id: splitGroupId,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Error en detección invoice ${inv.id}:`, e)
        detections.push({
          uploadId,
          originalInvoiceId: inv.id,
          filename: inv.original_filename,
          method: 'single',
          ranges: [],
          needs_review: false,
          ai_cost_estimate: 0,
          total_pages: 0,
          created_invoice_ids: [],
          split_group_id: null,
          error: msg,
        })
      }
    }

    return NextResponse.json(
      {
        success: true,
        upload_id: uploadId,
        invoices_analyzed: invoices.length,
        invoices_split: totalSplit,
        ai_cost_total: totalAiCost,
        detections,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en POST /api/uploads/[id]/detect:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
