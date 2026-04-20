import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

type IncomingRange = { page_start: number; page_end: number }

type InvoiceRow = {
  id: string
  org_id: string
  client_id: string | null
  upload_id: string
  bucket: string
  storage_path: string
  original_filename: string | null
  mime_type: string | null
  file_size_bytes: number | null
  uploaded_by: string
  status: string | null
  page_start: number | null
  page_end: number | null
  total_pages: number | null
  split_group_id: string | null
}

function validateRanges(ranges: unknown, totalPages: number): IncomingRange[] | { error: string } {
  if (!Array.isArray(ranges) || ranges.length === 0) {
    return { error: 'ranges debe ser un array no vacío' }
  }
  const cleaned: IncomingRange[] = []
  for (const r of ranges) {
    if (!r || typeof r !== 'object') return { error: 'cada rango debe ser un objeto' }
    const ro = r as Record<string, unknown>
    const ps = Number(ro.page_start)
    const pe = Number(ro.page_end)
    if (!Number.isInteger(ps) || !Number.isInteger(pe)) return { error: 'page_start/page_end deben ser enteros' }
    if (ps < 1 || pe < ps) return { error: `rango inválido (${ps}-${pe})` }
    if (pe > totalPages) return { error: `page_end ${pe} excede total_pages ${totalPages}` }
    cleaned.push({ page_start: ps, page_end: pe })
  }
  cleaned.sort((a, b) => a.page_start - b.page_start)
  // No solapamientos y cobertura completa
  if (cleaned[0].page_start !== 1) return { error: 'el primer rango debe empezar en página 1' }
  if (cleaned[cleaned.length - 1].page_end !== totalPages) {
    return { error: `el último rango debe terminar en página ${totalPages}` }
  }
  for (let i = 1; i < cleaned.length; i++) {
    if (cleaned[i].page_start !== cleaned[i - 1].page_end + 1) {
      return { error: 'los rangos deben ser contiguos y no solaparse' }
    }
  }
  return cleaned
}

/**
 * PATCH /api/uploads/{uploadId}/splits
 * Body: { originalInvoiceId: string, ranges: [{page_start, page_end}, ...] }
 *
 * Aplica una nueva división al PDF de un invoice (que puede o no estar ya splitteado).
 * Si el número de invoices cambia, se ajustan los créditos consumidos.
 *
 * Lógica:
 * 1. Localiza la invoice "original" (la que tiene el menor page_start en el grupo).
 * 2. Borra todas las demás invoices del split_group_id (si existía).
 * 3. Actualiza la original con el primer rango nuevo.
 * 4. Inserta N-1 invoices nuevas con los demás rangos.
 * 5. Si la cantidad neta varía, consume/devuelve créditos.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: uploadId } = await context.params

    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, user, orgId } = auth

    const body = await request.json().catch(() => null)
    const originalInvoiceId =
      body && typeof body === 'object' && typeof body.originalInvoiceId === 'string'
        ? body.originalInvoiceId
        : null
    if (!originalInvoiceId) {
      return NextResponse.json({ error: 'Falta originalInvoiceId' }, { status: 400 })
    }

    // Cargar la invoice original
    const { data: origRaw, error: origErr } = await supabase
      .from('invoices')
      .select(
        'id, org_id, client_id, upload_id, bucket, storage_path, original_filename, mime_type, file_size_bytes, uploaded_by, status, page_start, page_end, total_pages, split_group_id'
      )
      .eq('id', originalInvoiceId)
      .single()

    if (origErr || !origRaw) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }
    const original = origRaw as InvoiceRow
    if (original.org_id !== orgId) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    if (original.upload_id !== uploadId) {
      return NextResponse.json({ error: 'La factura no pertenece a esta subida' }, { status: 400 })
    }

    // Determinar total de páginas del PDF (usa el campo si existe; si no, asume single-factura)
    const totalPages = Number(original.total_pages || 0) || null
    if (!totalPages) {
      return NextResponse.json(
        { error: 'No se conoce el total de páginas del PDF; ejecuta detección primero.' },
        { status: 400 }
      )
    }

    const validated = validateRanges((body as { ranges?: unknown })?.ranges, totalPages)
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 422 })
    }
    const newRanges = validated

    // Localizar invoices existentes del grupo (incluyendo la original)
    const groupId = original.split_group_id
    let groupInvoices: InvoiceRow[] = [original]
    if (groupId) {
      const { data: all, error: gErr } = await supabase
        .from('invoices')
        .select(
          'id, org_id, client_id, upload_id, bucket, storage_path, original_filename, mime_type, file_size_bytes, uploaded_by, status, page_start, page_end, total_pages, split_group_id'
        )
        .eq('split_group_id', groupId)
        .eq('org_id', orgId)
      if (gErr) {
        return NextResponse.json({ error: gErr.message || 'Error cargando grupo' }, { status: 500 })
      }
      groupInvoices = (all || []) as InvoiceRow[]
    }

    const oldCount = groupInvoices.length
    const newCount = newRanges.length

    // Tomar como "ancla" la invoice con menor page_start (o la original si no hay grupo)
    const anchor =
      groupInvoices
        .slice()
        .sort((a, b) => (a.page_start ?? 0) - (b.page_start ?? 0))[0] || original

    // Si en el grupo hay alguna invoice ya validada (status='ready'), bloquear el reajuste
    const validated_status_blocked = groupInvoices.some((i) => i.status === 'ready')
    if (validated_status_blocked) {
      return NextResponse.json(
        { error: 'No se puede reajustar: alguna factura del grupo ya está validada.' },
        { status: 409 }
      )
    }

    // Eliminar invoices del grupo distintas a la ancla
    const toDelete = groupInvoices.filter((i) => i.id !== anchor.id).map((i) => i.id)
    if (toDelete.length > 0) {
      // Borramos también dependencias (extracciones, fields) — Supabase lo hace por cascada si está
      // configurado; si no, borramos manualmente.
      await supabase.from('invoice_fields').delete().in('invoice_id', toDelete)
      await supabase.from('invoice_extractions').delete().in('invoice_id', toDelete)
      const { error: delErr } = await supabase.from('invoices').delete().in('id', toDelete)
      if (delErr) {
        return NextResponse.json(
          { error: delErr.message || 'Error eliminando invoices antiguas del grupo' },
          { status: 500 }
        )
      }
    }

    // Si la ancla tenía datos de extracción previa, los descartamos (los rangos cambian)
    await supabase.from('invoice_fields').delete().eq('invoice_id', anchor.id)
    await supabase.from('invoice_extractions').delete().eq('invoice_id', anchor.id)

    // Decidir nuevo split_group_id
    const newGroupId = newCount > 1 ? (groupId || crypto.randomUUID()) : null

    // Actualizar la ancla con el primer rango nuevo
    const first = newRanges[0]
    const { error: updErr } = await supabase
      .from('invoices')
      .update({
        page_start: newCount > 1 ? first.page_start : null,
        page_end: newCount > 1 ? first.page_end : null,
        total_pages: newCount > 1 ? totalPages : null,
        split_group_id: newGroupId,
        status: 'uploaded',
        error_message: null,
      })
      .eq('id', anchor.id)
    if (updErr) {
      return NextResponse.json({ error: updErr.message || 'Error actualizando ancla' }, { status: 500 })
    }

    // Insertar invoices nuevas para los rangos restantes
    const newRows = newRanges.slice(1).map((r) => ({
      org_id: anchor.org_id,
      client_id: anchor.client_id,
      upload_id: anchor.upload_id,
      bucket: anchor.bucket,
      storage_path: anchor.storage_path,
      original_filename: anchor.original_filename,
      mime_type: anchor.mime_type,
      file_size_bytes: anchor.file_size_bytes,
      uploaded_by: anchor.uploaded_by || user.id,
      status: 'uploaded',
      error_message: null,
      page_start: r.page_start,
      page_end: r.page_end,
      total_pages: totalPages,
      split_group_id: newGroupId,
    }))

    let inserted: { id: string }[] = []
    if (newRows.length > 0) {
      const { data: ins, error: insErr } = await supabase.from('invoices').insert(newRows).select('id')
      if (insErr) {
        return NextResponse.json({ error: insErr.message || 'Error insertando nuevas invoices' }, { status: 500 })
      }
      inserted = (ins as { id: string }[]) || []
    }

    // Ajuste de créditos por delta: nuevas - antiguas
    const delta = newCount - oldCount
    if (delta > 0) {
      // Cobrar más
      for (let k = 0; k < delta; k++) {
        const newId = inserted[k]?.id
        try {
          await supabase.rpc('consume_credit', {
            p_org_id: orgId,
            p_invoice_id: newId,
            p_upload_id: uploadId,
            p_allow_negative: false,
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          // Si fallan créditos, revertimos las nuevas y devolvemos error
          if (msg.includes('insufficient_credits')) {
            const idsToRollback = inserted.map((i) => i.id)
            if (idsToRollback.length > 0) {
              await supabase.from('invoices').delete().in('id', idsToRollback)
            }
            return NextResponse.json(
              { error: 'No tienes créditos suficientes para aumentar la división.' },
              { status: 402 }
            )
          }
          console.error('Error consumiendo crédito en reajuste:', e)
        }
      }
    } else if (delta < 0) {
      // Devolver créditos: invocar refund_credit por cada delta. Si la RPC no existe, log y seguimos.
      for (let k = 0; k < -delta; k++) {
        try {
          await supabase.rpc('refund_credit', {
            p_org_id: orgId,
            p_invoice_id: anchor.id,
            p_upload_id: uploadId,
          })
        } catch (e) {
          // Si no existe la RPC, no rompemos: solo log informativo. El usuario "pierde" los créditos sobrantes.
          console.warn('refund_credit no disponible o falló (créditos sobrantes no devueltos):', e)
          break
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        upload_id: uploadId,
        split_group_id: newGroupId,
        anchor_invoice_id: anchor.id,
        created_invoice_ids: inserted.map((i) => i.id),
        deleted_invoice_ids: toDelete,
        new_count: newCount,
        old_count: oldCount,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en PATCH /api/uploads/[id]/splits:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
