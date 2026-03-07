-- Index for fast duplicate invoice detection
-- Covers queries that match on supplier_tax_id + invoice_number
CREATE INDEX IF NOT EXISTS idx_invoice_fields_dup_check
ON invoice_fields (supplier_tax_id, invoice_number)
WHERE supplier_tax_id IS NOT NULL AND invoice_number IS NOT NULL;
