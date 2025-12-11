-- Migration: Add menu_images table for multi-image gallery
-- Run this in Supabase SQL Editor

-- 1. Create menu_images table
CREATE TABLE IF NOT EXISTS public.menu_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_menu_images_menu_id ON public.menu_images(menu_id);

-- 3. Enable RLS
ALTER TABLE public.menu_images ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Allow public read, admin write
CREATE POLICY "Allow public read menu_images" ON public.menu_images
    FOR SELECT USING (true);

CREATE POLICY "Allow admin insert menu_images" ON public.menu_images
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow admin update menu_images" ON public.menu_images
    FOR UPDATE USING (true);

CREATE POLICY "Allow admin delete menu_images" ON public.menu_images
    FOR DELETE USING (true);

-- Note: Keep existing image_url on menus table as primary/thumbnail for backward compatibility
