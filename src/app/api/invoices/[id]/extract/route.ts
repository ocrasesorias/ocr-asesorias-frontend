import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { extractInvoiceAndPersist } from '@/lib/invoices/extraction'

export const runtime = 'nodejs'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const extractorUrl = process.env.INVOICE_EXTRACTOR_API_URL
    if (!extractorUrl) {
      return NextResponse.json(
        { error: 'INVOICE_EXTRACTOR_API_URL no está configurada' },
        { status: 500 }
      )
    }

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    // Determinar tipo desde el upload asociado (si existe)
    let tipo: 'gasto' | 'ingreso' | undefined = undefined
    try {
      const { data: invRow } = await supabase
        .from('invoices')
        .select('id, org_id, upload_id')
        .eq('id', invoiceId)
        .single()

      const uploadId = (invRow as { upload_id?: unknown })?.upload_id
      if (typeof uploadId === 'string' && uploadId) {
        const { data: upRow } = await supabase
          .from('uploads')
          .select('id, org_id, tipo')
          .eq('id', uploadId)
          .single()

        const t = String((upRow as { tipo?: unknown })?.tipo || '').toLowerCase()
        if (t === 'gasto' || t === 'ingreso') tipo = t as 'gasto' | 'ingreso'
      }
    } catch {
      // noop
    }

    const result = await extractInvoiceAndPersist({
      supabase,
      userId: user.id,
      orgId,
      invoiceId,
      extractorUrl,
      tipo,
    })

    if (!result.ok) {
      const status = result.error === 'Factura no encontrada' ? 404 : result.error === 'Sin permisos' ? 403 : 500
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ success: true, extraction: result.extraction, fields: result.fields }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en POST /api/invoices/[id]/extract:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


