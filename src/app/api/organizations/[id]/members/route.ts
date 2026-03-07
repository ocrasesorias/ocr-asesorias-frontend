import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/** GET: listar miembros de la organización */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
    }

    // Get members from organization_members
    const { data: members, error } = await auth.supabase
      .from('organization_members')
      .select('user_id, role, created_at')
      .eq('org_id', orgId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get user details via admin client (auth.users is only accessible via service role)
    const userIds = (members ?? []).map((m) => m.user_id as string)
    const usersInfo: Record<string, { email: string; created_at: string }> = {}

    for (const uid of userIds) {
      const { data } = await admin.auth.admin.getUserById(uid)
      if (data?.user) {
        usersInfo[uid] = {
          email: data.user.email ?? '',
          created_at: data.user.created_at ?? '',
        }
      }
    }

    const result = (members ?? []).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      joined_at: m.created_at,
      email: usersInfo[m.user_id as string]?.email ?? '',
    }))

    return NextResponse.json({ members: result }, { status: 200 })
  } catch (error) {
    console.error('Error en GET /api/organizations/[id]/members:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/** POST: crear un nuevo miembro (solo owner) */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: orgId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError

    if (auth.role !== 'owner') {
      return NextResponse.json({ error: 'Solo el propietario puede añadir miembros' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
    }

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email
    )

    let userId: string

    if (existingUser) {
      // Check if already a member of this org
      const { data: existingMember } = await admin
        .from('organization_members')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('user_id', existingUser.id)
        .maybeSingle()

      if (existingMember) {
        return NextResponse.json({ error: 'Este usuario ya es miembro de la organización' }, { status: 409 })
      }

      userId = existingUser.id
    } else {
      // Create new user
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError || !newUser?.user) {
        return NextResponse.json(
          { error: createError?.message || 'Error creando el usuario' },
          { status: 500 }
        )
      }

      userId = newUser.user.id
    }

    // Add to organization_members
    const { error: memberError } = await admin
      .from('organization_members')
      .insert({
        org_id: orgId,
        user_id: userId,
        role: 'member',
      })

    if (memberError) {
      return NextResponse.json({ error: memberError.message || 'Error añadiendo miembro' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      member: { user_id: userId, email, role: 'member' },
    }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/organizations/[id]/members:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
