import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

/** GET: lista de proveedores de un cliente */
export async function GET(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const url = new URL(request.url)
    const clientId = url.searchParams.get('client_id')
    if (!clientId) {
      return NextResponse.json({ error: 'client_id es requerido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name, tax_id, address, postal_code, province, created_at, updated_at')
      .eq('org_id', orgId)
      .eq('client_id', clientId)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error al listar proveedores:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ suppliers: data ?? [] }, { status: 200 })
  } catch (error) {
    console.error('Error en GET /api/suppliers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/** POST: crear proveedor */
export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : null
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const taxId = typeof body.tax_id === 'string' ? body.tax_id.trim().toUpperCase() : ''

    if (!clientId) {
      return NextResponse.json({ error: 'client_id es requerido' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'name es requerido' }, { status: 400 })
    }
    if (!taxId || taxId.length < 8) {
      return NextResponse.json({ error: 'tax_id (CIF/NIF) es requerido y debe tener al menos 8 caracteres' }, { status: 400 })
    }

    // Verificar que el cliente pertenece a la org
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('org_id', orgId)
      .single()

    if (clientErr || !client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .insert({
        org_id: orgId,
        client_id: clientId,
        name,
        tax_id: taxId,
        address: typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null,
        postal_code: typeof body.postal_code === 'string' && body.postal_code.trim() ? body.postal_code.trim() : null,
        province: typeof body.province === 'string' && body.province.trim() ? body.province.trim() : null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un proveedor con ese CIF/NIF para este cliente' }, { status: 409 })
      }
      console.error('Error al crear proveedor:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, supplier }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/suppliers:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
