import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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

/**
 * GET /api/invoices/{id}/thumbnails
 * Devuelve { thumbnails: string[], total_pages: number } con miniaturas low-res JPEG
 * data-URL de cada página del PDF asociado a la invoice. Para PDFs multi-factura,
 * devuelve TODAS las páginas del archivo original (no solo el rango de la invoice).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL
    if (!extractorUrl) {
      return NextResponse.json(
        { error: 'INVOICE_EXTRACTOR_API_URL no está configurada' },
        { status: 500 }
      )
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, org_id, bucket, storage_path, original_filename, mime_type')
      .eq('id', invoiceId)
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const isPdf =
      (invoice.mime_type || '').toLowerCase() === 'application/pdf' ||
      (invoice.original_filename || '').toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      return NextResponse.json({ error: 'Solo PDFs admiten thumbnails' }, { status: 400 })
    }

    const signedUrl = await createSignedUrlWithFallback(supabase, invoice.bucket, invoice.storage_path, 60 * 10)
    if (!signedUrl) {
      return NextResponse.json({ error: 'No se pudo obtener URL firmada' }, { status: 500 })
    }

    const fileResp = await fetch(signedUrl)
    if (!fileResp.ok) {
      return NextResponse.json({ error: `Descarga fallida (${fileResp.status})` }, { status: 502 })
    }
    const arrayBuf = await fileResp.arrayBuffer()
    const blob = new Blob([arrayBuf], { type: 'application/pdf' })

    const fd = new FormData()
    fd.append('file', blob, invoice.original_filename || 'factura.pdf')

    const headers: Record<string, string> = {}
    if (process.env.BACKEND_API_KEY) headers['X-API-Key'] = process.env.BACKEND_API_KEY

    const resp = await fetch(`${extractorUrl.replace(/\/$/, '')}/api/render-thumbnails`, {
      method: 'POST',
      headers,
      body: fd,
    })
    if (!resp.ok) {
      const errJson = await resp.json().catch(() => null)
      return NextResponse.json(
        { error: errJson?.detail || errJson?.error || `HTTP ${resp.status}` },
        { status: 502 }
      )
    }
    const json = await resp.json()
    return NextResponse.json(json, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en GET /api/invoices/[id]/thumbnails:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
