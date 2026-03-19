-- ============================================================================
-- Trial & Initial Credits Migration
-- Adds is_trial column and updates create_organization to grant 25 free credits
-- ============================================================================

-- 1. Add is_trial column to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_trial boolean DEFAULT true;

-- 2. Add TRIAL_CREDITS to billing_ledger event_type check constraint
ALTER TABLE billing_ledger DROP CONSTRAINT IF EXISTS billing_ledger_event_type_check;
ALTER TABLE billing_ledger ADD CONSTRAINT billing_ledger_event_type_check
  CHECK (event_type = ANY (ARRAY['INVOICE_UPLOAD','PLAN_RENEWAL','BONUS_PACK','MANUAL_ADJUSTMENT','TRIAL_CREDITS']));

-- 3. Drop and recreate (keeps original uuid return type)
DROP FUNCTION IF EXISTS create_organization(text);

CREATE OR REPLACE FUNCTION public.create_organization(org_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  new_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, credits_balance, is_trial)
  values (org_name, 25, true)
  returning id into new_org_id;

  insert into public.organization_members (org_id, user_id, role)
  values (new_org_id, auth.uid(), 'owner');

  insert into public.billing_ledger (org_id, event_type, amount, balance_after, meta)
  values (new_org_id, 'TRIAL_CREDITS', 25, 25, '{"description": "Créditos de prueba gratuitos al crear organización"}'::jsonb);

  return new_org_id;
end;
$function$;
