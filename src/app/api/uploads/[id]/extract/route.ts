import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { extractInvoiceAndPersist } from '@/lib/invoices/extraction'

export const runtime = 'nodejs'

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let idx = 0
  const c = Math.max(1, Math.min(10, Math.floor(concurrency || 1)))
  const workers = Array.from({ length: Math.min(c, items.length || 1) }).map(async () => {
    while (idx < items.length) {
      const current = idx
      idx += 1
      // eslint-disable-next-line no-await-in-loop
      await worker(items[current] as T)
    }
  })
  await Promise.all(workers)
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const concurrencyRaw = url.searchParams.get('concurrency')
    const limit = limitRaw ? Math.max(1, Math.min(500, Number(limitRaw))) : null
    const concurrency = concurrencyRaw ? Math.max(1, Math.min(10, Number(concurrencyRaw))) : 3

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

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
      .select('id, created_at')
      .eq('org_id', orgId)
      .eq('upload_id', uploadId)
      .order('created_at', { ascending: true })

    if (invError) {
      return NextResponse.json({ error: invError.message || 'Error cargando facturas' }, { status: 500 })
    }

    const idsAll = (invoices || []).map((i) => i.id)
    const ids = limit ? idsAll.slice(0, limit) : idsAll
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

    await runWithConcurrency(ids, concurrency, async (invoiceId) => {
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
    })

    return NextResponse.json(
      { success: true, total: ids.length, ok: okCount, errors, limit: limit ?? null, concurrency },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en POST /api/uploads/[id]/extract:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


