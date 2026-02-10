import { NextResponse } from 'next/server'
import { createClient } from './server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Resultado exitoso: usuario autenticado con al menos una organización.
 */
export type AuthGuardSuccess = {
  supabase: SupabaseClient
  user: User
  orgId: string
  /** Todos los org_ids del usuario (normalmente 1) */
  orgIds: string[]
}

/**
 * Verifica autenticación y membresía en una organización.
 * Patrón común en todas las API routes:
 *   1. createClient()
 *   2. getUser()
 *   3. Buscar organization_members
 *
 * Devuelve { data, response }:
 * - Si hay error → data es null, response es el NextResponse con el error (401/403)
 * - Si todo ok  → data contiene { supabase, user, orgId, orgIds }, response es null
 *
 * Uso:
 * ```ts
 * const { data: auth, response: authError } = await requireAuth()
 * if (authError) return authError
 * const { supabase, user, orgId } = auth
 * ```
 */
export async function requireAuth(): Promise<
  | { data: AuthGuardSuccess; response: null }
  | { data: null; response: NextResponse }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      data: null,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)

  if (membershipError || !memberships || memberships.length === 0) {
    return {
      data: null,
      response: NextResponse.json(
        { error: 'No tienes una organización' },
        { status: 403 }
      ),
    }
  }

  const orgIds = memberships.map((m) => m.org_id as string).filter(Boolean)
  if (orgIds.length === 0) {
    return {
      data: null,
      response: NextResponse.json(
        { error: 'No tienes una organización' },
        { status: 403 }
      ),
    }
  }

  // Si tiene varias organizaciones, elegir una de forma determinista (por nombre desc)
  // para que demo no vea datos de otra gestoría por tener varias membresías.
  let primaryOrgId = orgIds[0]
  if (orgIds.length > 1) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)
    const sorted = (orgs ?? []).slice().sort((a, b) => (b.name ?? '').localeCompare(a.name ?? '', 'es'))
    if (sorted.length > 0) primaryOrgId = sorted[0].id as string
  }

  return {
    data: {
      supabase,
      user,
      orgId: primaryOrgId,
      orgIds,
    },
    response: null,
  }
}

/**
 * Variante que además verifica membresía en una organización específica.
 * Útil para rutas como /api/organizations/[id]/*.
 *
 * Devuelve el rol del usuario en la organización cuando tiene éxito.
 */
export async function requireOrgMembership(
  orgId: string
): Promise<
  | { data: AuthGuardSuccess & { role: string }; response: null }
  | { data: null; response: NextResponse }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      data: null,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError || !membership) {
    return {
      data: null,
      response: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }),
    }
  }

  const role = String((membership as Record<string, unknown>).role || '').toLowerCase()

  return {
    data: {
      supabase,
      user,
      orgId,
      orgIds: [orgId],
      role,
    },
    response: null,
  }
}
