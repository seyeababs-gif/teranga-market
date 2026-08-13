-- Fix 1: Add partner_commission_rate column to discount_codes if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_commission_rate'
  ) THEN
    ALTER TABLE discount_codes ADD COLUMN partner_commission_rate NUMERIC(5,2) DEFAULT 5;
    COMMENT ON COLUMN discount_codes.partner_commission_rate IS 'Commission percentage for partners (e.g., 5 for 5%)';
  END IF;
END $$;

-- Fix 2: Update RLS policies for announcement_banners to allow super admins to insert
DROP POLICY IF EXISTS "Super admins can manage banners" ON announcement_banners;
DROP POLICY IF EXISTS "Anyone can view active banners" ON announcement_banners;

-- Enable RLS
ALTER TABLE announcement_banners ENABLE ROW LEVEL SECURITY;

-- Policy for viewing active banners (everyone)
CREATE POLICY "Anyone can view active banners" ON announcement_banners
  FOR SELECT
  USING (is_active = TRUE);

-- Policy for super admins to insert banners
CREATE POLICY "Super admins can insert banners" ON announcement_banners
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- Policy for super admins to update banners
CREATE POLICY "Super admins can update banners" ON announcement_banners
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- Policy for super admins to delete banners
CREATE POLICY "Super admins can delete banners" ON announcement_banners
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()::text
      AND users.is_super_admin = TRUE
    )
  );

-- Verify the changes
SELECT 
  'discount_codes has partner_commission_rate' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_commission_rate'
  ) as result;

SELECT 
  'announcement_banners RLS policies' as check_type,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename = 'announcement_banners';
