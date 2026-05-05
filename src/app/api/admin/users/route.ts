import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const ACCOUNTING_PROGRAMS = ['monitor', 'contasol', 'a3'] as const
type AccountingProgram = (typeof ACCOUNTING_PROGRAMS)[number]

function isAdmin(email: string | undefined): boolean {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS ?? ''
  const emails = list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return emails.includes(email.toLowerCase())
}

export async function POST(request: Request) {
  try {
    const { data: auth, response: authError } = await requireAuth()
    if (authError) return authError
    const { user } = auth

    if (!isAdmin(user.email ?? undefined)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const admin = createAdminClient()
    if (!admin) {
      return NextResponse.json(
        { error: 'Error de configuración del servidor' },
        { status: 500 }
      )
    }

    const body = await request.json().catch(() => null)
    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null

    const email = typeof bodyObj?.email === 'string' ? bodyObj.email.trim().toLowerCase() : ''
    const password = typeof bodyObj?.password === 'string' ? bodyObj.password : ''
    const orgName = typeof bodyObj?.org_name === 'string' ? bodyObj.org_name.trim() : ''
    const accountingProgramRaw =
      typeof bodyObj?.accounting_program === 'string' ? bodyObj.accounting_program.trim().toLowerCase() : ''
    const creditsRaw = bodyObj?.credits
    const credits = typeof creditsRaw === 'number' ? Math.floor(creditsRaw) : NaN

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 })
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }
    if (!orgName) {
      return NextResponse.json(
        { error: 'El nombre de la asesoría es requerido' },
        { status: 400 }
      )
    }
    if (!ACCOUNTING_PROGRAMS.includes(accountingProgramRaw as AccountingProgram)) {
      return NextResponse.json(
        { error: 'Programa contable debe ser monitor, contasol o a3' },
        { status: 400 }
      )
    }
    const accountingProgram = accountingProgramRaw as AccountingProgram

    if (!Number.isFinite(credits) || credits < 0 || credits > 100000) {
      return NextResponse.json(
        { error: 'Los créditos deben ser un número entre 0 y 100.000' },
        { status: 400 }
      )
    }

    // 1. Crear usuario en Auth (email confirmado para que pueda entrar directo)
    const { data: created, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        accepted_terms: true,
        accepted_terms_at: new Date().toISOString(),
        created_by_admin: user.email ?? null,
      },
    })

    if (userError || !created?.user) {
      const msg = userError?.message ?? 'Error creando usuario'
      const isDuplicate = /already.*registered|already.*exists|duplicate/i.test(msg)
      return NextResponse.json(
        { error: isDuplicate ? 'Ya existe un usuario con ese email' : msg },
        { status: isDuplicate ? 409 : 500 }
      )
    }

    const newUserId = created.user.id

    // 2. Crear organización
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: orgName,
        credits_balance: credits,
        is_trial: true,
        accounting_program: accountingProgram,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        { error: orgError?.message ?? 'Error creando organización' },
        { status: 500 }
      )
    }

    const newOrgId = (org as { id: string }).id

    // 3. Añadir como owner
    const { error: memberError } = await admin
      .from('organization_members')
      .insert({ org_id: newOrgId, user_id: newUserId, role: 'owner' })

    if (memberError) {
      await admin.from('organizations').delete().eq('id', newOrgId)
      await admin.auth.admin.deleteUser(newUserId)
      return NextResponse.json(
        { error: memberError.message ?? 'Error añadiendo membresía' },
        { status: 500 }
      )
    }

    // 4. Registrar créditos en el ledger
    if (credits > 0) {
      const { error: ledgerError } = await admin.from('billing_ledger').insert({
        org_id: newOrgId,
        event_type: 'MANUAL_ADJUSTMENT',
        amount: credits,
        balance_after: credits,
        meta: {
          description: `Alta manual por admin: ${credits} créditos de prueba`,
          created_by: user.email ?? null,
        },
      })
      if (ledgerError) {
        console.warn('No se pudo escribir en billing_ledger tras alta:', ledgerError)
      }
    }

    return NextResponse.json(
      {
        success: true,
        user_id: newUserId,
        org_id: newOrgId,
        email,
        org_name: orgName,
        accounting_program: accountingProgram,
        credits,
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('Error POST /api/admin/users:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
