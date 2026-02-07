import { useState, useCallback, useEffect } from 'react';

/**
 * Hook para el saldo de créditos de la organización (billing ledger).
 * credits_balance: créditos disponibles (restan al subir facturas).
 */
export function useInvoiceCounter(orgId: string | null) {
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/organizations/${encodeURIComponent(orgId)}/invoice-stats`);
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || 'Error cargando saldo');
      const balance = typeof data?.credits_balance === 'number' ? data.credits_balance : 0;
      setCreditsBalance(balance);
    } catch {
      setCreditsBalance(null);
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    creditsBalance,
    isLoading,
    refresh,
  };
}
