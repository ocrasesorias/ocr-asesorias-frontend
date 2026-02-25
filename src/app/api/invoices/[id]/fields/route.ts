import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: invoiceId } = await context.params
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ])
    const { data: auth, response: authError } = authResult
    if (authError) return authError
    const { supabase, user, orgId } = auth

    // Comprobar que la factura pertenece a la organización
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, org_id, client_id')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
    }

    if (invoice.org_id !== orgId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    // Permitimos solo campos conocidos del esquema
    const allowed = new Set([
      'supplier_name',
      'supplier_tax_id',
      'invoice_number',
      'invoice_date',
      'base_amount',
      'vat_amount',
      'total_amount',
      'vat_rate',
    ])

    const payload: Record<string, unknown> = { invoice_id: invoiceId, updated_by: user.id }
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (allowed.has(k)) payload[k] = v
    }

    const { data, error } = await supabase
      .from('invoice_fields')
      .upsert(payload, { onConflict: 'invoice_id' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error guardando campos' }, { status: 500 })
    }

    // Actualizar o crear proveedor habitual en la tabla 'suppliers'
    try {
      const supplierName = body.supplier_name
      const supplierTaxId = body.supplier_tax_id
      if (
        invoice.client_id &&
        supplierName &&
        typeof supplierName === 'string' &&
        supplierTaxId &&
        typeof supplierTaxId === 'string' &&
        supplierTaxId.trim().length >= 8
      ) {
        // Usamos el cliente normal, pero con onConflict por columnas (es lo que recomienda Supabase JS)
        const { error: upsertError } = await supabase.from('suppliers').upsert(
          {
            org_id: orgId,
            client_id: invoice.client_id,
            name: supplierName.trim(),
            tax_id: supplierTaxId.trim().toUpperCase(),
            address:
              typeof body.supplier_address === 'string' && body.supplier_address.trim()
                ? body.supplier_address.trim()
                : null,
            postal_code:
              typeof body.supplier_postal_code === 'string' && body.supplier_postal_code.trim()
                ? body.supplier_postal_code.trim()
                : null,
            province:
              typeof body.supplier_province === 'string' && body.supplier_province.trim()
                ? body.supplier_province.trim()
                : null,
          },
          { onConflict: 'client_id,tax_id' }
        )
        if (upsertError) {
          console.error('Error en upsert de suppliers:', upsertError)
          // Si falla por RLS, intentamos con el admin client como fallback
          const { createAdminClient } = await import('@/lib/supabase/admin')
          const admin = createAdminClient()
          if (admin) {
            await admin.from('suppliers').upsert(
              {
                org_id: orgId,
                client_id: invoice.client_id,
                name: supplierName.trim(),
                tax_id: supplierTaxId.trim().toUpperCase(),
                address: typeof body.supplier_address === 'string' ? body.supplier_address.trim() : null,
                postal_code: typeof body.supplier_postal_code === 'string' ? body.supplier_postal_code.trim() : null,
                province: typeof body.supplier_province === 'string' ? body.supplier_province.trim() : null,
              },
              { onConflict: 'client_id,tax_id' }
            )
          }
        } else {
          console.log(`Proveedor ${supplierName} guardado en suppliers correctamente.`)
        }
      } else {
        console.log('No se guardó el proveedor por falta de datos o NIF corto:', { supplierName, supplierTaxId, clientId: invoice.client_id })
      }
    } catch (err) {
      console.error('Error actualizando proveedor habitual:', err)
    }

    // Estado: ready (validada)
    try {
      await supabase
        .from('invoices')
        .update({ status: 'ready', error_message: null })
        .eq('id', invoiceId)
        .eq('org_id', orgId)
    } catch {
      // noop (no bloqueamos la validación por esto)
    }

    return NextResponse.json({ success: true, fields: data }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en PUT /api/invoices/[id]/fields:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}


