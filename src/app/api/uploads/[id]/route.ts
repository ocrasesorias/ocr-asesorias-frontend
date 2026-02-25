import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgIds } = auth

    // Importante:
    // - Con RLS, los joins (clients/invoice_fields/invoice_extractions) pueden fallar aunque el upload exista.
    // - Por eso usamos Service Role (si está configurado) DESPUÉS de comprobar que el usuario pertenece a la org.
    const admin = createAdminClient()
    const db = admin ?? supabase

    const { data: upload, error } = await db
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
          tax_id,
          preferred_income_account,
          preferred_expense_account,
          activity_description
        ),
        invoices (
          id,
          bucket,
          storage_path,
          original_filename,
          mime_type,
          file_size_bytes,
          created_at,
          status,
          error_message,
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
      .in('org_id', orgIds)
      .maybeSingle()

    if (error) {
      const code = error.code ?? undefined
      const hint = error.hint ?? undefined
      return NextResponse.json(
        {
          error: 'Error cargando la subida',
          details:
            process.env.NODE_ENV !== 'production'
              ? { message: error.message, code, hint, usedAdmin: Boolean(admin) }
              : undefined,
        },
        { status: 500 }
      )
    }

    if (!upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }

    // Orden consistente de facturas: ordenamos alfabéticamente por nombre de archivo (numéricamente)
    // para que la extracción y validación siga un orden estricto predecible.
    const uploadObj = upload as Record<string, unknown>
    const invoicesVal = uploadObj.invoices
    if (Array.isArray(invoicesVal)) {
      uploadObj.invoices = invoicesVal.toSorted((a, b) => {
        const aObj = a && typeof a === 'object' ? (a as Record<string, unknown>) : null
        const bObj = b && typeof b === 'object' ? (b as Record<string, unknown>) : null
        
        const aName = typeof aObj?.original_filename === 'string' ? aObj.original_filename : ''
        const bName = typeof bObj?.original_filename === 'string' ? bObj.original_filename : ''
        
        const nameCmp = aName.localeCompare(bName, undefined, { numeric: true, sensitivity: 'base' })
        if (nameCmp !== 0) return nameCmp

        const aCreated = typeof aObj?.created_at === 'string' ? aObj.created_at : ''
        const bCreated = typeof bObj?.created_at === 'string' ? bObj.created_at : ''
        return aCreated.localeCompare(bCreated)
      })
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
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgIds } = auth

    const admin = createAdminClient()
    const db = admin ?? supabase

    // Verificar que el upload pertenece a la org
    const { data: upload, error: uploadError } = await db
      .from('uploads')
      .select('id, org_id')
      .eq('id', uploadId)
      .in('org_id', orgIds)
      .maybeSingle()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }

    // Traer facturas asociadas para borrar objetos de Storage
    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id, bucket, storage_path')
      .eq('org_id', upload.org_id)
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

    // Borrar en storage en paralelo por bucket
    const deleteResults = await Promise.all(
      Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
        const { error } = await supabase.storage.from(bucket).remove(paths)
        return { bucket, error }
      })
    )
    const failedBucket = deleteResults.find((r) => r.error)
    if (failedBucket) {
      return NextResponse.json(
        {
          error:
            failedBucket.error?.message ||
            `Error borrando objetos en bucket ${failedBucket.bucket}`,
        },
        { status: 500 }
      )
    }

    // Borrar upload (cascade eliminará invoices)
    const { error: delError } = await supabase.from('uploads').delete().eq('id', uploadId).eq('org_id', upload.org_id)
    if (delError) {
      return NextResponse.json({ error: delError.message || 'Error eliminando subida' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedInvoices: (invoices || []).length }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en DELETE /api/uploads/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgIds } = auth

    const body = await request.json().catch(() => null)
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const name = typeof bodyObj?.name === 'string' ? bodyObj.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    // Verificar que el upload pertenece a la org
    const { data: upload, error: uploadError } = await db
      .from('uploads')
      .select('id, org_id')
      .eq('id', uploadId)
      .in('org_id', orgIds)
      .maybeSingle()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }

    const { data: updated, error: updError } = await db
      .from('uploads')
      .update({ name })
      .eq('id', uploadId)
      .eq('org_id', upload.org_id)
      .select('id, org_id, client_id, tipo, name, created_at, updated_at')
      .single()

    if (updError || !updated) {
      return NextResponse.json({ error: updError?.message || 'Error actualizando subida' }, { status: 500 })
    }

    return NextResponse.json({ success: true, upload: updated }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PUT /api/uploads/[id]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


