import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { extractInvoiceAndPersist } from '@/lib/invoices/extraction'
import { withExtractSlot } from '@/lib/invoices/extract-queue'

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

    // Determinar tipo y cliente (CIF empresa) desde invoice y upload
    let tipo: 'gasto' | 'ingreso' | undefined = undefined
    let cifEmpresa: string | null = null
    try {
      const { data: invRow } = await supabase
        .from('invoices')
        .select('id, org_id, upload_id, client_id')
        .eq('id', invoiceId)
        .single()

      const uploadId = (invRow as { upload_id?: unknown })?.upload_id
      const clientId = (invRow as { client_id?: unknown })?.client_id
      if (typeof uploadId === 'string' && uploadId) {
        const { data: upRow } = await supabase
          .from('uploads')
          .select('id, org_id, tipo')
          .eq('id', uploadId)
          .single()

        const t = String((upRow as { tipo?: unknown })?.tipo || '').toLowerCase()
        if (t === 'gasto' || t === 'ingreso') tipo = t as 'gasto' | 'ingreso'
      }
      // Para GASTO, enviar CIF de la empresa (cliente) para que el extractor identifique al proveedor
      if (tipo === 'gasto' && typeof clientId === 'string' && clientId) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('tax_id')
          .eq('id', clientId)
          .eq('org_id', orgId)
          .single()
        const taxId = (clientRow as { tax_id?: string } | null)?.tax_id
        if (typeof taxId === 'string' && taxId.trim()) cifEmpresa = taxId.trim()
      }
    } catch {
      // noop
    }

    // Cola en backend: máximo 5 extracts en paralelo; el resto esperan
    const result = await withExtractSlot(() =>
      extractInvoiceAndPersist({
        supabase,
        userId: user.id,
        orgId,
        invoiceId,
        extractorUrl,
        tipo,
        cifEmpresa: cifEmpresa ?? undefined,
      })
    )

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


