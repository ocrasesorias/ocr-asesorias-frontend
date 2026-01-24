import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgId = memberships[0].org_id as string

    const { data: upload, error } = await supabase
      .from('uploads')
      .select(
        `
        id,
        org_id,
        client_id,
        tipo,
        name,
        created_by,
        created_at,
        updated_at,
        clients (
          id,
          name,
          tax_id
        ),
        invoices (
          id,
          bucket,
          storage_path,
          original_filename,
          mime_type,
          file_size_bytes,
          created_at,
          invoice_fields (
            supplier_name,
            supplier_tax_id,
            invoice_number,
            invoice_date,
            base_amount,
            vat_amount,
            total_amount,
            vat_rate
          ),
          invoice_extractions (
            raw_json,
            created_at
          )
        )
      `
      )
      .eq('id', uploadId)
      .single()

    if (error || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }

    if (upload.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    return NextResponse.json({ success: true, upload }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en GET /api/uploads/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)

    if (membershipError || !memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgId = memberships[0].org_id as string

    // Verificar que el upload pertenece a la org
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

    // Traer facturas asociadas para borrar objetos de Storage
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id, bucket, storage_path')
      .eq('org_id', orgId)
      .eq('upload_id', uploadId)

    if (invError) {
      return NextResponse.json({ error: invError.message || 'Error cargando facturas' }, { status: 500 })
    }

    const byBucket = new Map<string, string[]>()
    for (const inv of invoices || []) {
      if (!inv.bucket || !inv.storage_path) continue
      const arr = byBucket.get(inv.bucket) || []
      arr.push(inv.storage_path)
      byBucket.set(inv.bucket, arr)
    }

    // Borrar en storage (best effort por bucket)
    for (const [bucket, paths] of byBucket.entries()) {
      const { error } = await supabase.storage.from(bucket).remove(paths)
      if (error) {
        return NextResponse.json(
          { error: error.message || `Error borrando objetos en bucket ${bucket}` },
          { status: 500 }
        )
      }
    }

    // Borrar upload (cascade eliminará invoices)
    const { error: delError } = await supabase.from('uploads').delete().eq('id', uploadId).eq('org_id', orgId)
    if (delError) {
      return NextResponse.json({ error: delError.message || 'Error eliminando subida' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedInvoices: (invoices || []).length }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en DELETE /api/uploads/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


