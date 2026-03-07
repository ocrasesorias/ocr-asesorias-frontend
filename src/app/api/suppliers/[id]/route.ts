import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: supplierId } = await context.params
    const [authResult, body] = await Promise.all([
      requireAuth(),
      request.json().catch(() => null),
    ])
    const { data: auth, response: authError } = authResult
    if (authError) return authError
    const { supabase, orgId } = auth

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const taxId = typeof body.tax_id === 'string' ? body.tax_id.trim().toUpperCase() : ''

    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }
    if (!taxId || taxId.length < 8) {
      return NextResponse.json({ error: 'tax_id (CIF/NIF) es requerido y debe tener al menos 8 caracteres' }, { status: 400 })
    }

    // Obtener el proveedor actual para saber su client_id
    const { data: current, error: currentErr } = await supabase
      .from('suppliers')
      .select('id, client_id')
      .eq('id', supplierId)
      .eq('org_id', orgId)
      .single()

    if (currentErr || !current) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    // Verificar nombre duplicado (case-insensitive, excluyendo self)
    const { data: existingByName } = await supabase
      .from('suppliers')
      .select('id')
      .eq('client_id', current.client_id)
      .ilike('name', name)
      .neq('id', supplierId)
      .limit(1)

    if (existingByName && existingByName.length > 0) {
      return NextResponse.json({ error: 'Ya existe otro proveedor con ese nombre para este cliente' }, { status: 409 })
    }

    // Verificar CIF duplicado (case-insensitive, excluyendo self)
    const { data: existingByTaxId } = await supabase
      .from('suppliers')
      .select('id')
      .eq('client_id', current.client_id)
      .ilike('tax_id', taxId)
      .neq('id', supplierId)
      .limit(1)

    if (existingByTaxId && existingByTaxId.length > 0) {
      return NextResponse.json({ error: 'Ya existe otro proveedor con ese CIF/NIF para este cliente' }, { status: 409 })
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .update({
        name,
        tax_id: taxId,
        address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null,
        postal_code: typeof body.postal_code === 'string' && body.postal_code.trim() ? body.postal_code.trim() : null,
        city: typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null,
        province: typeof body.province === 'string' && body.province.trim() ? body.province.trim() : null,
      })
      .eq('id', supplierId)
      .eq('org_id', orgId)
      .select()
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe otro proveedor con ese CIF/NIF para este cliente' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true, supplier }, { status: 200 })
  } catch (error) {
    console.error('Error en PUT /api/suppliers/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: supplierId } = await context.params
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const { data: deleted, error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', supplierId)
      .eq('org_id', orgId)
      .select('id')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error en DELETE /api/suppliers/[id]:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
