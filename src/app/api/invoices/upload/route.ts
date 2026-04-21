import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function inferMimeType(filename: string): string | null {
  const lower = (filename || '').toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff'
  return null
}

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    const body = await request.json().catch(() => null)

    const clientId = typeof body?.client_id === 'string' ? body.client_id.trim() : ''
    const uploadId = typeof body?.upload_id === 'string' ? body.upload_id.trim() : ''
    const storagePath = typeof body?.storage_path === 'string' ? body.storage_path.trim() : ''
    const bucket =
      typeof body?.bucket === 'string' && body.bucket.trim() ? body.bucket.trim() : 'invoices'
    const originalFilename =
      typeof body?.original_filename === 'string' && body.original_filename.trim()
        ? body.original_filename
        : 'factura'
    const mimeType = typeof body?.mime_type === 'string' && body.mime_type.trim() ? body.mime_type : null
    const fileSizeBytes =
      typeof body?.file_size_bytes === 'number' && Number.isFinite(body.file_size_bytes)
        ? body.file_size_bytes
        : null

    if (!clientId) return NextResponse.json({ error: 'Falta client_id' }, { status: 400 })
    if (!uploadId) return NextResponse.json({ error: 'Falta upload_id' }, { status: 400 })
    if (!storagePath) return NextResponse.json({ error: 'Falta storage_path' }, { status: 400 })

    // Validación defensiva: el path debe pertenecer a esta org + upload.
    const expectedPrefix = `org/${orgId}/upload/${uploadId}/`
    if (!storagePath.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'storage_path inválido' }, { status: 400 })
    }

    const invoiceId = crypto.randomUUID()
    const contentType = mimeType || inferMimeType(originalFilename) || 'application/octet-stream'

    const { data: invoiceRow, error: insertError } = await supabase
      .from('invoices')
      .insert({
        id: invoiceId,
        org_id: orgId,
        client_id: clientId,
        upload_id: uploadId,
        bucket,
        storage_path: storagePath,
        original_filename: originalFilename,
        mime_type: contentType,
        file_size_bytes: fileSizeBytes,
        uploaded_by: user.id,
        status: 'uploaded',
        error_message: null,
      })
      .select()
      .single()

    if (insertError || !invoiceRow) {
      // Best-effort cleanup del fichero ya subido a Storage.
      try {
        await supabase.storage.from(bucket).remove([storagePath])
      } catch (err) {
        console.error('Error limpiando fichero huérfano en Storage:', err)
      }
      return NextResponse.json(
        { error: insertError?.message || 'Error creando el registro de factura' },
        { status: 500 }
      )
    }

    // Consumir 1 crédito en el ledger.
    try {
      await supabase.rpc('consume_credit', {
        p_org_id: orgId,
        p_invoice_id: invoiceId,
        p_upload_id: uploadId || null,
        p_allow_negative: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('insufficient_credits')) {
        return NextResponse.json(
          { error: 'No tienes créditos suficientes. Renueva tu plan o compra un pack.' },
          { status: 402 }
        )
      }
      try {
        await supabase.rpc('increment_org_invoices_consumed', { p_org_id: orgId })
      } catch (err) {
        console.error('Error incrementando facturas consumidas (migración pendiente?):', err)
      }
    }

    const expiresIn = 60 * 60 * 24 * 7
    let previewUrl: string | null = null
    const signed = await supabase.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
    if (!signed.error) {
      previewUrl = signed.data?.signedUrl ?? null
    } else {
      const admin = createAdminClient()
      if (admin) {
        const adminSigned = await admin.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
        previewUrl = adminSigned.data?.signedUrl ?? null
      }
    }

    return NextResponse.json(
      {
        success: true,
        invoice: invoiceRow,
        previewUrl,
        extraction: null,
        extractedFields: null,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error inesperado en /api/invoices/upload:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
