import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractInvoiceAndPersist } from '@/lib/invoices/extraction'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
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

    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('id, org_id, tipo')
      .eq('id', uploadId)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Subida no encontrada' }, { status: 404 })
    }
    if (upload.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { data: invoices, error: invError } = await supabase
      .from('invoices')
      .select('id')
      .eq('org_id', orgId)
      .eq('upload_id', uploadId)

    if (invError) {
      return NextResponse.json({ error: invError.message || 'Error cargando facturas' }, { status: 500 })
    }

    const ids = (invoices || []).map((i) => i.id)
    let okCount = 0
    const errors: Array<{ invoiceId: string; error: string }> = []

    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL
    if (!extractorUrl) {
      return NextResponse.json(
        { error: 'INVOICE_EXTRACTOR_API_URL no está configurada' },
        { status: 500 }
      )
    }

    const tipo = typeof (upload as { tipo?: unknown })?.tipo === 'string' ? (upload as { tipo: string }).tipo : null

    for (const invoiceId of ids) {
      const result = await extractInvoiceAndPersist({
        supabase,
        userId: user.id,
        orgId,
        invoiceId,
        extractorUrl,
        tipo: (tipo as 'gasto' | 'ingreso' | null) || undefined,
      })

      if (result.ok) okCount++
      else errors.push({ invoiceId, error: result.error })
    }

    return NextResponse.json({ success: true, total: ids.length, ok: okCount, errors }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en POST /api/uploads/[id]/extract:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


