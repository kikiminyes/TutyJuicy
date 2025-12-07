# Database Migrations

This directory contains incremental database migrations for the TutyJuicy project.

## How to Apply Migrations

### Using Supabase Dashboard

1. Open your Supabase project
2. Navigate to **SQL Editor**
3. Open the migration file (e.g., `001_add_indexes_and_fix_rls.sql`)
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run** to execute

### Migration Files

- `001_add_indexes_and_fix_rls.sql` - Adds performance indexes, fixes RLS policies, adds batch title column, updates RPC function

## Migration History

| Migration | Date | Description | Status |
|-----------|------|-------------|--------|
| 001 | 2024-12-04 | Performance indexes + RLS fixes + Batch title + RPC update | Pending |

## Verification

After running a migration, verify it was successful:

```sql
-- Check indexes
SELECT * FROM pg_indexes WHERE tablename IN ('orders', 'batch_stocks');

-- Check batch.title column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'batches' AND column_name = 'title';

-- Test RPC function
SELECT create_order_atomic(
  'test-batch-id'::uuid,
  'Test Customer',
  '+628123456789',
  'Test Address',
  50000,
  'pending',  -- Should now be accepted
  '[]'::jsonb
);
-- Note: This will fail if batch doesn't exist, but should NOT fail on payment_method validation
```

## Rollback

If you need to rollback a migration:

### Rollback 001

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_orders_status;
DROP INDEX IF EXISTS idx_orders_batch_id;
DROP INDEX IF EXISTS idx_batch_stocks_batch_id;
DROP INDEX IF EXISTS idx_orders_customer_phone_created;

-- Remove batch title column
ALTER TABLE public.batches DROP COLUMN IF EXISTS title;

-- Restore original RPC function (without 'pending' support)
-- See original supabase_schema.sql for function definition
```

## Best Practices

1. **Always backup** before running migrations on production
2. **Test migrations** on a staging/development database first
3. **Run migrations sequentially** - do not skip migration numbers
4. **Document changes** in this README after applying
5. **Update schema_updated.sql** to reflect current state
