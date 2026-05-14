import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardClient from './DashboardClient';

/**
 * Server Component: resuelve auth + org en SSR para hidratar el cliente
 * sin bloquear el LCP con awaits encadenados en navegador.
 *
 * El middleware (src/proxy.ts) ya validó la sesión antes de llegar aquí.
 */
export default async function DashboardPage() {
  const supabase = await createClient();

  // Auth (middleware ya validó, pero necesitamos el user.id)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/panel');
  }

  // Memberships del usuario
  const { data: memberships, error: membershipsError } = await supabase
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id);

  if (membershipsError || !memberships || memberships.length === 0) {
    redirect('/panel/bienvenida');
  }

  const orgIds = memberships.map((m) => m.org_id as string).filter(Boolean);

  let currentOrgId: string = orgIds[0];
  let currentOrgName = '';

  if (orgIds.length === 1) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', currentOrgId)
      .single();
    currentOrgName = (org?.name as string) ?? '';
  } else {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);
    const sorted = (orgs ?? []).slice().sort((a, b) =>
      (b.name ?? '').localeCompare(a.name ?? '', 'es')
    );
    if (sorted.length > 0) {
      currentOrgId = sorted[0].id as string;
      currentOrgName = (sorted[0].name as string) ?? '';
    }
  }

  const membership = memberships.find((m) => m.org_id === currentOrgId);
  const role = String((membership as Record<string, unknown>)?.role || '').toLowerCase();
  const userRole: 'owner' | 'member' = role === 'owner' ? 'owner' : 'member';

  return (
    <DashboardClient
      initialOrgId={currentOrgId}
      initialOrgName={currentOrgName}
      initialUserRole={userRole}
    />
  );
}
