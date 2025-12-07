-- Migration 002: Batch Status Enhancement
-- Date: 2025-12-04
-- Description: Change batch status from active/inactive to draft/open/closed lifecycle

-- ==================
-- DROP OLD CONSTRAINT
-- ==================

ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_status_check;

-- ==================
-- ADD NEW CONSTRAINT
-- ==================

ALTER TABLE public.batches ADD CONSTRAINT batches_status_check
CHECK (status IN ('draft', 'open', 'closed'));

-- ==================
-- MIGRATE EXISTING DATA
-- ==================

-- Convert 'active' batches to 'open' (accepting orders)
UPDATE public.batches SET status = 'open' WHERE status = 'active';

-- Convert 'inactive' batches to 'closed' (completed)
UPDATE public.batches SET status = 'closed' WHERE status = 'inactive';

-- ==================
-- ADD INDEX
-- ==================

CREATE INDEX IF NOT EXISTS idx_batches_status ON public.batches(status);

-- ==================
-- ADD DOCUMENTATION
-- ==================

COMMENT ON COLUMN public.batches.status IS
'Batch lifecycle status:
- draft: Admin is preparing batch, not visible to customers
- open: Batch is accepting orders, visible to customers (only one batch should be open at a time)
- closed: Batch has completed, read-only for admin, not visible to customers';

-- ==================
-- VERIFICATION QUERIES
-- ==================

-- Uncomment to verify migration:
-- SELECT status, COUNT(*) as count FROM public.batches GROUP BY status;
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints WHERE constraint_name LIKE '%batches%status%';
