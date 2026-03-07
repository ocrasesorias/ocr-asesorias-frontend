'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'
import { useToast } from '@/contexts/ToastContext'
import { translateError } from '@/utils/errorMessages'

type Member = {
  user_id: string
  email: string
  role: string
  joined_at: string
}

export default function EquipoPage() {
  const router = useRouter()
  const { showError, showSuccess } = useToast()

  const [isLoading, setIsLoading] = useState(true)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [userRole, setUserRole] = useState<'owner' | 'member'>('member')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])

  // Form para nuevo miembro
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // Modal de confirmación de eliminación
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const run = async () => {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/login?redirect=/panel/equipo')
          return
        }
        setCurrentUserId(user.id)

        const { data: memberships } = await supabase
          .from('organization_members')
          .select('org_id, role')
          .eq('user_id', user.id)
          .limit(1)

        if (!memberships || memberships.length === 0) {
          router.push('/panel/bienvenida')
          return
        }

        const currentOrgId = memberships[0].org_id as string
        const role = String(memberships[0].role || '').toLowerCase()
        setOrgId(currentOrgId)
        setUserRole(role === 'owner' ? 'owner' : 'member')

        const { data: organization } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', currentOrgId)
          .maybeSingle()
        setOrgName(organization?.name || 'Equipo')

        // Load members
        const resp = await fetch(`/api/organizations/${encodeURIComponent(currentOrgId)}/members`)
        const data = await resp.json().catch(() => null)
        if (resp.ok && Array.isArray(data?.members)) {
          setMembers(data.members)
        }
      } catch (err) {
        console.error('Error cargando equipo:', err)
        showError('Error cargando el equipo')
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [router, showError])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || userRole !== 'owner') return

    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      showError('Introduce un email válido')
      return
    }
    if (!newPassword || newPassword.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    setIsAdding(true)
    try {
      const resp = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      })
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        showError(translateError(data?.error || 'Error añadiendo miembro'))
        return
      }

      setMembers((prev) => [
        ...prev,
        {
          user_id: data.member.user_id,
          email: data.member.email,
          role: 'member',
          joined_at: new Date().toISOString(),
        },
      ])
      setNewEmail('')
      setNewPassword('')
      setShowAddForm(false)
      showSuccess('Miembro añadido correctamente')
    } catch {
      showError('Error añadiendo miembro')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeleteMember = async () => {
    if (!orgId || !memberToDelete) return
    setIsDeleting(true)
    try {
      const resp = await fetch(
        `/api/organizations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(memberToDelete.user_id)}`,
        { method: 'DELETE' }
      )
      const data = await resp.json().catch(() => null)
      if (!resp.ok) {
        showError(translateError(data?.error || 'Error eliminando miembro'))
        return
      }
      setMembers((prev) => prev.filter((m) => m.user_id !== memberToDelete.user_id))
      setMemberToDelete(null)
      showSuccess('Miembro eliminado de la organización')
    } catch {
      showError('Error eliminando miembro')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  const isOwner = userRole === 'owner'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link href="/panel" className="flex items-center space-x-3">
                <Image
                  src="/img/logo.png"
                  alt="KontaScan"
                  width={100}
                  height={100}
                  className="h-10 w-auto"
                  priority
                />
                <span className="text-2xl font-bold text-primary">KontaScan</span>
              </Link>
            </div>
            <Link
              href="/panel"
              className="inline-flex items-center gap-2 text-sm text-foreground-secondary hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al panel
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-light text-foreground">{orgName}</h1>
          <p className="text-foreground-secondary mt-1">Gestiona los miembros de tu equipo</p>
        </div>

        {/* Members list */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Miembros ({members.length})
            </h2>
            {isOwner && (
              <Button
                variant="primary"
                onClick={() => setShowAddForm(!showAddForm)}
              >
                {showAddForm ? 'Cancelar' : 'Añadir miembro'}
              </Button>
            )}
          </div>

          {/* Add member form */}
          {showAddForm && isOwner && (
            <form onSubmit={handleAddMember} className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="new-member-email" className="block text-sm font-medium text-foreground mb-1">
                    Email del trabajador
                  </label>
                  <input
                    id="new-member-email"
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="trabajador@ejemplo.com"
                    disabled={isAdding}
                  />
                </div>
                <div>
                  <label htmlFor="new-member-password" className="block text-sm font-medium text-foreground mb-1">
                    Contraseña
                  </label>
                  <input
                    id="new-member-password"
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                    placeholder="Mínimo 6 caracteres"
                    disabled={isAdding}
                    minLength={6}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" type="button" onClick={() => { setShowAddForm(false); setNewEmail(''); setNewPassword('') }} disabled={isAdding}>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" disabled={isAdding}>
                  {isAdding ? 'Creando…' : 'Crear cuenta'}
                </Button>
              </div>
            </form>
          )}

          {/* Members table */}
          <div className="divide-y divide-gray-100">
            {members.length === 0 ? (
              <div className="px-5 py-8 text-center text-foreground-secondary text-sm">
                No hay miembros en la organización
              </div>
            ) : (
              members
                .sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.email.localeCompare(b.email)))
                .map((member) => {
                  const isCurrentUser = member.user_id === currentUserId
                  const isMemberOwner = member.role === 'owner'
                  return (
                    <div
                      key={member.user_id}
                      className="px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-foreground-secondary uppercase">
                            {member.email.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {member.email}
                            {isCurrentUser && (
                              <span className="ml-2 text-[10px] text-foreground-secondary font-normal">(tú)</span>
                            )}
                          </div>
                          <div className="text-xs text-foreground-secondary">
                            Se unió el{' '}
                            {new Date(member.joined_at).toLocaleDateString('es-ES', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            isMemberOwner
                              ? 'bg-primary/10 text-primary'
                              : 'bg-gray-100 text-foreground-secondary'
                          }`}
                        >
                          {isMemberOwner ? 'Propietario' : 'Miembro'}
                        </span>

                        {isOwner && !isMemberOwner && !isCurrentUser && (
                          <button
                            type="button"
                            onClick={() => setMemberToDelete(member)}
                            className="p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                            title="Eliminar miembro"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {!isOwner && (
          <p className="mt-4 text-xs text-foreground-secondary text-center">
            Solo el propietario de la organización puede gestionar miembros.
          </p>
        )}
      </main>

      {/* Delete confirmation modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !isDeleting && setMemberToDelete(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-foreground">Eliminar miembro</h3>
            <p className="text-sm text-foreground-secondary mt-2">
              Vas a eliminar a <span className="font-semibold text-foreground">{memberToDelete.email}</span> de la
              organización. Ya no podrá acceder al panel ni a los datos del equipo.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setMemberToDelete(null)} disabled={isDeleting}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteMember}
                disabled={isDeleting}
                className="!bg-red-600 hover:!bg-red-700"
              >
                {isDeleting ? 'Eliminando…' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
