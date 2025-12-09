-- Migration: Complete fix for payment_proofs RLS to allow admin operations
-- The 406 error happens when RLS policies block the operation
-- For DELETE, Supabase needs both SELECT and DELETE policies to work

-- ===========================================
-- STEP 1: Fix payment_proofs table policies
-- ===========================================

-- Drop all existing policies on payment_proofs first
DROP POLICY IF EXISTS "Public can create payment proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Allow authenticated delete payment_proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Allow authenticated select payment_proofs" ON payment_proofs;
DROP POLICY IF EXISTS "Anyone can view payment proofs" ON payment_proofs;

-- Create SELECT policy - needed for DELETE to work
CREATE POLICY "Anyone can view payment proofs" 
ON payment_proofs 
FOR SELECT 
USING (true);

-- Create INSERT policy - for customers to upload proofs
CREATE POLICY "Anyone can create payment proofs" 
ON payment_proofs 
FOR INSERT 
WITH CHECK (true);

-- Create DELETE policy for authenticated users (admin)
CREATE POLICY "Authenticated can delete payment proofs" 
ON payment_proofs 
FOR DELETE 
TO authenticated 
USING (true);

-- ===========================================
-- STEP 2: Fix order_items table policies
-- ===========================================

DROP POLICY IF EXISTS "Allow authenticated delete order_items" ON order_items;
DROP POLICY IF EXISTS "Allow authenticated select order_items" ON order_items;
DROP POLICY IF EXISTS "Anyone can view order items" ON order_items;

-- Create SELECT policy
CREATE POLICY "Anyone can view order items" 
ON order_items 
FOR SELECT 
USING (true);

-- Create DELETE policy for authenticated users
CREATE POLICY "Authenticated can delete order_items" 
ON order_items 
FOR DELETE 
TO authenticated 
USING (true);

-- ===========================================
-- STEP 3: Fix orders table policies  
-- ===========================================

DROP POLICY IF EXISTS "Allow authenticated delete orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON orders;

-- Make sure SELECT policy exists
CREATE POLICY "Anyone can view orders" 
ON orders 
FOR SELECT 
USING (true);

-- Create DELETE policy for authenticated users
CREATE POLICY "Authenticated can delete orders" 
ON orders 
FOR DELETE 
TO authenticated 
USING (true);

-- ===========================================
-- Verification: Check that RLS is enabled
-- ===========================================
-- These should already be enabled, but just in case:
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
