-- Migration: Add size column to menus table
-- Run this in Supabase SQL Editor

ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS size TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN public.menus.size IS 'Size of the juice (e.g., 350ml, 500ml)';
