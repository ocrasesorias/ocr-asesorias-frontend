import { NextResponse } from 'next/server'
import { requireOrgMembership } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

/** DELETE: eliminar un miembro de la organización (solo owner, no puede eliminarse a sí mismo) */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id: orgId, userId: targetUserId } = await context.params
    const { data: auth, response: authError } = await requireOrgMembership(orgId)
    if (authError) return authError

    if (auth.role !== 'owner') {
      return NextResponse.json({ error: 'Solo el propietario puede eliminar miembros' }, { status: 403 })
    }

    if (auth.user.id === targetUserId) {
      return NextResponse.json({ error: 'No puedes eliminarte a ti mismo de la organización' }, { status: 400 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json({ error: 'Configuración de servidor incompleta' }, { status: 500 })
    }

    // Verify the target is actually a member (and not the owner)
    const { data: member } = await admin
      .from('organization_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
    }

    if (member.role === 'owner') {
      return NextResponse.json({ error: 'No se puede eliminar al propietario' }, { status: 400 })
    }

    // Remove from organization
    const { error: deleteError } = await admin
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', targetUserId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || 'Error eliminando miembro' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error en DELETE /api/organizations/[id]/members/[userId]:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
