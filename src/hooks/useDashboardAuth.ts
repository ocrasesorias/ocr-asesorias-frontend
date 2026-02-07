import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/contexts/ToastContext';

/**
 * Hook para manejar la autenticación y verificación de organización en el dashboard
 */
export function useDashboardAuth() {
  const router = useRouter();
  const { showError } = useToast();
  const [organizationName, setOrganizationName] = useState<string>('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/dashboard');
        return;
      }

      // Verificar si el usuario tiene una organización
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('org_id')
          .eq('user_id', user.id)
          .limit(1);

        if (membershipError) {
          console.warn('Error al verificar organización, redirigiendo a bienvenida:', membershipError.message);
          router.push('/dashboard/bienvenida');
          return;
        }

        // Si no tiene organización, redirigir a la página de bienvenida
        if (!memberships || memberships.length === 0) {
          router.push('/dashboard/bienvenida');
          return;
        }

        // Obtener información de la organización
        const currentOrgId = memberships[0].org_id;
        setOrgId(currentOrgId);

        const { data: organization, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', currentOrgId)
          .single();

        if (orgError) {
          console.error('Error al cargar organización:', orgError);
          showError('Error al cargar la información de la organización');
        } else if (organization) {
          setOrganizationName(organization.name);
        }
      } else {
        router.push('/login?redirect=/dashboard');
        return;
      }

      setIsLoading(false);
    };

    checkSession();
  }, [router, showError]);

  return {
    organizationName,
    orgId,
    isLoading,
  };
}
