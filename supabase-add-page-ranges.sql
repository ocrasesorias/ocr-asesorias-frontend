-- Soporte para PDFs multi-factura: rangos de páginas por invoice
-- Ejecutar en Supabase SQL Editor. Idempotente.
--
-- Cuando un PDF contiene varias facturas, se crea una row en `invoices` por
-- cada factura detectada. Todas comparten el mismo `storage_path` (un único
-- archivo) y se diferencian por el rango de páginas (`page_start`..`page_end`,
-- 1-indexed, inclusive). `split_group_id` agrupa las invoices que vienen del
-- mismo PDF original (útil para mostrar "Factura 2 de 5" en la UI).
--
-- Para invoices de PDFs con una sola factura, las columnas quedan NULL y todo
-- el código sigue funcionando como antes.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS page_start integer,
  ADD COLUMN IF NOT EXISTS page_end integer,
  ADD COLUMN IF NOT EXISTS total_pages integer,
  ADD COLUMN IF NOT EXISTS split_group_id uuid;

-- Índice parcial: solo indexamos las invoices que pertenecen a un grupo split
CREATE INDEX IF NOT EXISTS idx_invoices_split_group
  ON invoices(split_group_id)
  WHERE split_group_id IS NOT NULL;

-- Constraint de coherencia: si page_start está, page_end también, y page_end >= page_start
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_page_range_valid;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_page_range_valid
  CHECK (
    (page_start IS NULL AND page_end IS NULL)
    OR (page_start IS NOT NULL AND page_end IS NOT NULL AND page_end >= page_start AND page_start >= 1)
  );
