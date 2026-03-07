-- Extend invoice_fields to persist all validation form data for Monitor export
-- Run this migration in Supabase SQL Editor
-- Uses IF NOT EXISTS so it's safe to run multiple times

-- New scalar fields
ALTER TABLE invoice_fields
  ADD COLUMN IF NOT EXISTS subcuenta_gasto text,
  ADD COLUMN IF NOT EXISTS retencion_porcentaje numeric,
  ADD COLUMN IF NOT EXISTS retencion_importe numeric,
  ADD COLUMN IF NOT EXISTS retencion_tipo text,
  ADD COLUMN IF NOT EXISTS inversion_sujeto_pasivo boolean DEFAULT false;

-- IVA breakdown stored as JSONB array
-- Each element: { "base": 1000, "porcentaje_iva": 21, "cuota_iva": 210, "porcentaje_recargo": 5.2, "cuota_recargo": 52, "tipo_exencion": null }
ALTER TABLE invoice_fields
  ADD COLUMN IF NOT EXISTS iva_lines jsonb;
