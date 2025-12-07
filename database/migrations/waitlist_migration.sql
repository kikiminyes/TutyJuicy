-- ============================================
-- WAITLIST FEATURE - Complete Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Add admin_phone_number column to payment_settings if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_settings' 
        AND column_name = 'admin_phone_number'
    ) THEN
        ALTER TABLE payment_settings ADD COLUMN admin_phone_number TEXT;
    END IF;
END $$;

-- 2. Create waitlist_leads table
CREATE TABLE IF NOT EXISTS waitlist_leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    notified_at TIMESTAMP WITH TIME ZONE
);

-- 3. Enable RLS for waitlist_leads
ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Enable insert for everyone" ON waitlist_leads;
DROP POLICY IF EXISTS "Enable select for admins" ON waitlist_leads;
DROP POLICY IF EXISTS "Enable update for admins" ON waitlist_leads;
DROP POLICY IF EXISTS "Enable delete for admins" ON waitlist_leads;
DROP POLICY IF EXISTS "Public can insert waitlist" ON waitlist_leads;
DROP POLICY IF EXISTS "Admins can view waitlist" ON waitlist_leads;
DROP POLICY IF EXISTS "Admins can update waitlist" ON waitlist_leads;
DROP POLICY IF EXISTS "Admins can delete waitlist" ON waitlist_leads;

-- 5. Create RLS policies
-- Allow anyone (public) to insert into waitlist
CREATE POLICY "Public can insert waitlist" 
    ON waitlist_leads 
    FOR INSERT 
    WITH CHECK (true);

-- Allow authenticated users (admins) to view waitlist
CREATE POLICY "Admins can view waitlist" 
    ON waitlist_leads 
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Allow authenticated users (admins) to update waitlist
CREATE POLICY "Admins can update waitlist" 
    ON waitlist_leads 
    FOR UPDATE 
    USING (auth.role() = 'authenticated');

-- Allow authenticated users (admins) to delete waitlist
CREATE POLICY "Admins can delete waitlist" 
    ON waitlist_leads 
    FOR DELETE 
    USING (auth.role() = 'authenticated');

-- 6. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_waitlist_leads_created_at ON waitlist_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_leads_notified ON waitlist_leads(notified);

-- 7. Grant permissions
GRANT SELECT, INSERT ON waitlist_leads TO anon;
GRANT ALL ON waitlist_leads TO authenticated;
