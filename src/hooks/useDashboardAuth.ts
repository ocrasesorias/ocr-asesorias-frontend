import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';

interface UseDashboardAuthOptions {
  /** Datos iniciales desde SSR — si se pasan, se omite la consulta inicial al servidor */
  initialOrgId?: string | null;
  initialOrgName?: string;
  initialUserRole?: 'owner' | 'member';
}

/**
 * Hook para manejar la autenticación y verificación de organización en el panel.
 * Si recibe datos iniciales desde SSR, los usa para hidratar el estado sin bloquear el render.
 */
export function useDashboardAuth(options: UseDashboardAuthOptions = {}) {
  const { initialOrgId, initialOrgName, initialUserRole } = options;
  const hasInitialData = initialOrgId !== undefined;
  const router = useRouter();
  const { showError } = useToast();
  const [organizationName, setOrganizationName] = useState<string>(initialOrgName ?? '');
  const [orgId, setOrgId] = useState<string | null>(initialOrgId ?? null);
  const [userRole, setUserRole] = useState<'owner' | 'member'>(initialUserRole ?? 'member');
  // Si hay datos iniciales, no estamos cargando: el SSR ya validó la sesión.
  const [isLoading, setIsLoading] = useState(!hasInitialData);

  useEffect(() => {
    // Si vienen datos iniciales del SSR, omitimos la consulta cliente.
    // El middleware ya valida la sesión en cada navegación a /panel.
    if (hasInitialData) return;

    const checkAuth = async () => {
      const supabase = createClient();

      // getUser() valida el JWT contra el servidor de Supabase Auth.
      // Es más seguro que getSession() que solo lee del almacenamiento local.
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        router.push('/login?redirect=/panel');
        return;
      }

      // Verificar si el usuario tiene al menos una organización
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', user.id);

      if (membershipError) {
        console.warn('Error al verificar organización, redirigiendo a bienvenida:', membershipError.message);
        router.push('/panel/bienvenida');
        return;
      }

      if (!memberships || memberships.length === 0) {
        router.push('/panel/bienvenida');
        return;
      }

      // Caso 1 (común): una sola org → traemos el nombre directamente, sin doble round-trip
      const orgIds = memberships.map((m) => m.org_id as string).filter(Boolean);

      let currentOrgId: string;
      let currentOrgName: string | null = null;

      if (orgIds.length === 1) {
        currentOrgId = orgIds[0];
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', currentOrgId)
          .single();
        if (orgError) {
          console.error('Error al cargar organización:', orgError);
          showError('Error al cargar la información de la organización');
        } else if (org) {
          currentOrgName = org.name as string;
        }
      } else {
        // Caso 2: varias orgs → traemos id+name de todas y elegimos en cliente (sin segunda consulta)
        const { data: orgs, error: orgsError } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        if (orgsError) {
          console.error('Error al cargar organizaciones:', orgsError);
          showError('Error al cargar la información de la organización');
          currentOrgId = orgIds[0];
        } else {
          const sorted = (orgs ?? []).slice().sort((a, b) => (b.name ?? '').localeCompare(a.name ?? '', 'es'));
          if (sorted.length > 0) {
            currentOrgId = sorted[0].id as string;
            currentOrgName = (sorted[0].name as string) ?? null;
          } else {
            currentOrgId = orgIds[0];
          }
        }
      }

      // Determine role for the selected org
      const membership = memberships.find((m) => m.org_id === currentOrgId);
      const role = String((membership as Record<string, unknown>)?.role || '').toLowerCase();

      // Batch state updates al final para minimizar re-renders
      setOrgId(currentOrgId);
      setUserRole(role === 'owner' ? 'owner' : 'member');
      if (currentOrgName) setOrganizationName(currentOrgName);
      setIsLoading(false);
    };

    checkAuth();
  }, [router, showError, hasInitialData]);

  return {
    organizationName,
    orgId,
    userRole,
    isLoading,
  };
}
