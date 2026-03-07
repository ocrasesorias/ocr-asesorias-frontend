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
      'supplier_address',
      'supplier_postal_code',
      'supplier_city',
      'supplier_province',
      'invoice_number',
      'invoice_date',
      'base_amount',
      'vat_amount',
      'total_amount',
      'vat_rate',
      'subcuenta_gasto',
      'retencion_porcentaje',
      'retencion_importe',
      'retencion_tipo',
      'inversion_sujeto_pasivo',
      'iva_lines',
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
    // Lógica: buscar primero por CIF, luego por nombre. Si encuentra, actualizar. Si no, insertar.
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
        const sName = supplierName.trim()
        const sTaxId = supplierTaxId.trim().toUpperCase()
        const sAddress = typeof body.supplier_address === 'string' && body.supplier_address.trim() ? body.supplier_address.trim() : null
        const sPostalCode = typeof body.supplier_postal_code === 'string' && body.supplier_postal_code.trim() ? body.supplier_postal_code.trim() : null
        const sCity = typeof body.supplier_city === 'string' && body.supplier_city.trim() ? body.supplier_city.trim() : null
        const sProvince = typeof body.supplier_province === 'string' && body.supplier_province.trim() ? body.supplier_province.trim() : null

        // 1) Buscar por CIF (match exacto)
        const { data: byTaxId } = await supabase
          .from('suppliers')
          .select('id')
          .eq('client_id', invoice.client_id)
          .ilike('tax_id', sTaxId)
          .limit(1)
          .maybeSingle()

        // 2) Si no hay match por CIF, buscar por nombre (case-insensitive)
        const existingId = byTaxId?.id ?? null
        let matchByName: string | null = null
        if (!existingId) {
          const { data: byName } = await supabase
            .from('suppliers')
            .select('id')
            .eq('client_id', invoice.client_id)
            .ilike('name', sName)
            .limit(1)
            .maybeSingle()
          matchByName = byName?.id ?? null
        }

        const updatePayload = {
          name: sName,
          tax_id: sTaxId,
          address: sAddress,
          postal_code: sPostalCode,
          city: sCity,
          province: sProvince,
        }

        let saveError: { message: string } | null = null

        if (existingId) {
          // Actualizar proveedor encontrado por CIF
          const { error } = await supabase
            .from('suppliers')
            .update(updatePayload)
            .eq('id', existingId)
          saveError = error
        } else if (matchByName) {
          // Actualizar proveedor encontrado por nombre (puede haber cambiado el CIF)
          const { error } = await supabase
            .from('suppliers')
            .update(updatePayload)
            .eq('id', matchByName)
          saveError = error
        } else {
          // No existe: insertar nuevo
          const { error } = await supabase
            .from('suppliers')
            .insert({ org_id: orgId, client_id: invoice.client_id, ...updatePayload })
          saveError = error
        }

        if (saveError) {
          console.error('Error guardando proveedor:', saveError)
          // Fallback con admin client
          const { createAdminClient } = await import('@/lib/supabase/admin')
          const admin = createAdminClient()
          if (admin) {
            if (existingId) {
              await admin.from('suppliers').update(updatePayload).eq('id', existingId)
            } else if (matchByName) {
              await admin.from('suppliers').update(updatePayload).eq('id', matchByName)
            } else {
              await admin.from('suppliers').insert({ org_id: orgId, client_id: invoice.client_id, ...updatePayload })
            }
          }
        }
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


