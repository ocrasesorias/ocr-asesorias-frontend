import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Hook para gestionar el contador de facturas gastadas de la organización
 */
export function useInvoiceCounter(orgId: string | null) {
  const [facturasGastadasOrgCount, setFacturasGastadasOrgCount] = useState<number | null>(null);
  const [isLoadingFacturasGastadasOrgCount, setIsLoadingFacturasGastadasOrgCount] = useState(false);

  const refreshFacturasGastadasOrgCount = useCallback(async () => {
    if (!orgId) return;
    setIsLoadingFacturasGastadasOrgCount(true);
    try {
      const supabase = createClient();
      const { count, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);

      if (error) throw new Error(error.message || 'Error contando facturas');
      setFacturasGastadasOrgCount(typeof count === 'number' ? count : 0);
    } catch {
      // Mejor no spamear toasts aquí. Mostramos "—" y seguimos.
      setFacturasGastadasOrgCount(null);
    } finally {
      setIsLoadingFacturasGastadasOrgCount(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refreshFacturasGastadasOrgCount();
  }, [refreshFacturasGastadasOrgCount]);

  return {
    facturasGastadasOrgCount,
    isLoading: isLoadingFacturasGastadasOrgCount,
    refresh: refreshFacturasGastadasOrgCount,
  };
}
