import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

    const result = await extractInvoiceAndPersist({
      supabase,
      userId: user.id,
      orgId,
      invoiceId,
      extractorUrl,
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


