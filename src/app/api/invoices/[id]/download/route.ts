import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
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

    if (membershipError || !memberships?.length) {
      return NextResponse.json({ error: 'No tienes una organización' }, { status: 403 })
    }

    const orgId = memberships[0].org_id as string

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, org_id, bucket, storage_path, original_filename')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const expiresIn = 60 * 60 // 1 hora para descarga

    let signedUrl: string | null = null
    const userSigned = await supabase.storage
      .from(invoice.bucket)
      .createSignedUrl(invoice.storage_path, expiresIn)

    if (!userSigned.error) {
      signedUrl = userSigned.data?.signedUrl ?? null
    } else {
      const admin = createAdminClient()
      if (admin) {
        const adminSigned = await admin.storage
          .from(invoice.bucket)
          .createSignedUrl(invoice.storage_path, expiresIn)
        if (!adminSigned.error) {
          signedUrl = adminSigned.data?.signedUrl ?? null
        }
      }
    }

    if (!signedUrl) {
      return NextResponse.json(
        { error: 'No se pudo generar el enlace de descarga' },
        { status: 500 }
      )
    }

    const fileRes = await fetch(signedUrl)
    if (!fileRes.ok || !fileRes.body) {
      return NextResponse.json(
        { error: 'No se pudo obtener el archivo' },
        { status: 502 }
      )
    }

    const filename = invoice.original_filename || 'factura.pdf'
    const safeName = filename.replace(/[^\w.\-]+/g, '_')
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'

    return new NextResponse(fileRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    })
  } catch (error) {
    console.error('Error GET /api/invoices/[id]/download:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
