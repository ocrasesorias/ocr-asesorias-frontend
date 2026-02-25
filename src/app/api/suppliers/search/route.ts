import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { supabase, orgId } = auth

    const url = new URL(request.url)
    const taxId = url.searchParams.get('tax_id')
    const name = url.searchParams.get('name')
    const clientId = url.searchParams.get('client_id')

    if (!taxId && !name) {
      return NextResponse.json({ error: 'Falta tax_id o name' }, { status: 400 })
    }

    let query = supabase.from('suppliers').select('*').eq('org_id', orgId)
    
    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    if (taxId) {
      query = query.eq('tax_id', taxId.toUpperCase().trim())
    } else if (name) {
      query = query.ilike('name', `%${name.trim()}%`)
    }

    // Obtener el más reciente actualizado
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, supplier: data || null }, { status: 200 })
  } catch (error) {
    console.error('Error in GET /api/suppliers/search:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
