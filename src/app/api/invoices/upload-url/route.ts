import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

function sanitizeFilename(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const body = await request.json().catch(() => null)
    const uploadId = typeof body?.upload_id === 'string' ? body.upload_id.trim() : ''
    const originalFilename =
      typeof body?.original_filename === 'string' && body.original_filename.trim()
        ? body.original_filename
        : 'factura'

    if (!uploadId) {
      return NextResponse.json({ error: 'Falta upload_id' }, { status: 400 })
    }

    const { data: upload, error: uploadErr } = await supabase
      .from('uploads')
      .select('id, org_id')
      .eq('id', uploadId)
      .single()

    if (uploadErr || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }
    if ((upload as { org_id?: string }).org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const bucket = 'invoices'
    const safeName = sanitizeFilename(originalFilename) || 'factura'
    // Prefijo aleatorio corto para evitar colisiones si se sube el mismo nombre dos veces.
    const prefix = crypto.randomUUID().slice(0, 8)
    const storagePath = `org/${orgId}/upload/${uploadId}/${prefix}_${safeName}`

    let signed = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath)
    if (signed.error || !signed.data) {
      const admin = createAdminClient()
      if (admin) {
        signed = await admin.storage.from(bucket).createSignedUploadUrl(storagePath)
      }
    }

    if (signed.error || !signed.data) {
      return NextResponse.json(
        { error: signed.error?.message || 'No se pudo firmar la subida' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      bucket,
      storage_path: storagePath,
      token: signed.data.token,
      signed_url: signed.data.signedUrl,
    })
  } catch (error) {
    console.error('Error inesperado en POST /api/invoices/upload-url:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
