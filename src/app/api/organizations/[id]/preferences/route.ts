import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params

    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError

    const { supabase } = auth
    const admin = createAdminClient()
    const db = admin ?? supabase

    const { data: org, error } = await db
      .from('organizations')
      .select('id, uppercase_names_addresses, working_quarter')
      .eq('id', orgId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error cargando preferencias' }, { status: 500 })
    }
    if (!org) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 })
    }

    // Default ON si por cualquier motivo viniera null/undefined
    const orgObj = typeof org === 'object' ? (org as Record<string, unknown>) : null
    const uppercase_names_addresses = typeof orgObj?.uppercase_names_addresses === 'boolean' ? orgObj.uppercase_names_addresses : true
    const working_quarter = typeof orgObj?.working_quarter === 'string' && /^Q[1-4]$/.test(orgObj.working_quarter) ? orgObj.working_quarter : null

    return NextResponse.json({ success: true, org_id: orgId, uppercase_names_addresses, working_quarter }, { status: 200 })
  } catch (error) {
    console.error('Error inesperado en GET /api/organizations/[id]/preferences:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const [authResult, body] = await Promise.all([
      requireOrgMembership(orgId),
      request.json().catch(() => null),
    ])

    const { data: auth, response: authError } = authResult
    if (authError) return authError

    const { supabase, role } = auth

    if (role !== 'owner') {
      return NextResponse.json({ error: 'Solo el owner puede cambiar preferencias' }, { status: 403 })
    }

    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
    const uppercase_names_addresses =
      typeof bodyObj?.uppercase_names_addresses === 'boolean' ? bodyObj.uppercase_names_addresses : null
    const working_quarter_raw = typeof bodyObj?.working_quarter === 'string' ? bodyObj.working_quarter.trim() : undefined
    const working_quarter = working_quarter_raw === '' || !working_quarter_raw ? null : (/^Q[1-4]$/.test(working_quarter_raw) ? working_quarter_raw : null)

    if (uppercase_names_addresses === null) {
      return NextResponse.json({ error: 'uppercase_names_addresses es requerido (boolean)' }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin ?? supabase

    const updatePayload: Record<string, unknown> = { uppercase_names_addresses }
    if (working_quarter !== undefined) updatePayload.working_quarter = working_quarter

    const { data: updated, error } = await db
      .from('organizations')
      .update(updatePayload)
      .eq('id', orgId)
      .select('id, uppercase_names_addresses, working_quarter')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message || 'Error guardando preferencias' }, { status: 500 })
    }

    const updatedObj = updated && typeof updated === 'object' ? (updated as Record<string, unknown>) : null
    return NextResponse.json(
      {
        success: true,
        org_id: orgId,
        uppercase_names_addresses:
          typeof updatedObj?.uppercase_names_addresses === 'boolean' ? updatedObj.uppercase_names_addresses : uppercase_names_addresses,
        working_quarter: typeof updatedObj?.working_quarter === 'string' ? updatedObj.working_quarter : null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error inesperado en PUT /api/organizations/[id]/preferences:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

