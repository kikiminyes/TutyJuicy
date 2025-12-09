-- Migration: Fix RLS policies for payment_proofs table to allow admin delete
-- This allows authenticated users (admin) to delete payment proofs

-- Drop existing policy if any (to recreate cleanly)
DROP POLICY IF EXISTS "Allow authenticated delete payment_proofs" ON payment_proofs;

-- Create policy to allow authenticated users to delete payment proofs
CREATE POLICY "Allow authenticated delete payment_proofs" 
ON payment_proofs 
FOR DELETE 
TO authenticated 
USING (true);

-- Also ensure order_items can be deleted by authenticated users
DROP POLICY IF EXISTS "Allow authenticated delete order_items" ON order_items;

CREATE POLICY "Allow authenticated delete order_items" 
ON order_items 
FOR DELETE 
TO authenticated 
USING (true);

-- Also allow deleting orders by authenticated users
DROP POLICY IF EXISTS "Allow authenticated delete orders" ON orders;

CREATE POLICY "Allow authenticated delete orders" 
ON orders 
FOR DELETE 
TO authenticated 
USING (true);
