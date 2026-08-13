-- Partner Tracking System
-- This script adds the ability to track which partner brought which client

-- Step 1: Ensure users table has is_partner column (should already exist based on previous scripts)
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS is_partner BOOLEAN DEFAULT FALSE;

-- Step 2: Add partner_referral_code column to users for partners
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS partner_referral_code TEXT UNIQUE;

-- Step 3: Add referred_by_partner column to users to track who referred them
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Step 4: Update discount_codes table to properly link to partners
-- This should already exist but we ensure it's correct
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'discount_codes' 
    AND column_name = 'partner_user_id'
  ) THEN
    ALTER TABLE discount_codes 
      ADD COLUMN partner_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Create function to generate unique partner code
CREATE OR REPLACE FUNCTION generate_partner_code(user_name TEXT, user_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_code TEXT;
  final_code TEXT;
  counter INTEGER := 1;
BEGIN
  -- Create base code from first 3 chars of name + last 4 chars of UUID
  base_code := UPPER(SUBSTRING(REGEXP_REPLACE(user_name, '[^a-zA-Z]', '', 'g'), 1, 3) || SUBSTRING(REPLACE(user_id::TEXT, '-', ''), -4));
  
  final_code := base_code;
  
  -- Ensure uniqueness
  WHILE EXISTS (SELECT 1 FROM users WHERE partner_referral_code = final_code) LOOP
    final_code := base_code || counter;
    counter := counter + 1;
  END LOOP;
  
  RETURN final_code;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Update existing partners to have referral codes
UPDATE users 
SET partner_referral_code = generate_partner_code(name, id)
WHERE is_partner = TRUE AND partner_referral_code IS NULL;

-- Step 7: Create trigger to auto-generate partner code when user becomes partner
CREATE OR REPLACE FUNCTION auto_generate_partner_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_partner = TRUE AND NEW.partner_referral_code IS NULL THEN
    NEW.partner_referral_code := generate_partner_code(NEW.name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_partner_code ON users;
CREATE TRIGGER trigger_auto_generate_partner_code
  BEFORE INSERT OR UPDATE OF is_partner ON users
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_partner_code();

-- Step 8: Create view to see partner statistics
CREATE OR REPLACE VIEW partner_statistics AS
SELECT 
  u.id as partner_id,
  u.name as partner_name,
  u.email as partner_email,
  u.phone as partner_phone,
  u.partner_referral_code,
  COUNT(DISTINCT referred.id) as total_referrals,
  COUNT(DISTINCT dc.id) as discount_codes_count,
  COALESCE(SUM(dc.times_used), 0) as total_code_usage,
  u.created_at as partner_since
FROM users u
LEFT JOIN users referred ON referred.referred_by_partner_id = u.id
LEFT JOIN discount_codes dc ON dc.partner_user_id = u.id AND dc.is_active = TRUE
WHERE u.is_partner = TRUE
GROUP BY u.id, u.name, u.email, u.phone, u.partner_referral_code, u.created_at;

-- Step 9: Create RPC function to get partner stats
CREATE OR REPLACE FUNCTION get_partner_stats(partner_user_id UUID)
RETURNS JSON AS $$
SELECT json_build_object(
  'partner_id', partner_id,
  'partner_name', partner_name,
  'partner_referral_code', partner_referral_code,
  'total_referrals', total_referrals,
  'discount_codes_count', discount_codes_count,
  'total_code_usage', total_code_usage,
  'partner_since', partner_since
)
FROM partner_statistics
WHERE partner_id = partner_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 10: Create RPC to track user signup with partner code
CREATE OR REPLACE FUNCTION apply_partner_referral(
  new_user_id UUID,
  referral_code TEXT
)
RETURNS JSON AS $$
DECLARE
  partner_id UUID;
  result JSON;
BEGIN
  -- Find partner by referral code
  SELECT id INTO partner_id
  FROM users
  WHERE partner_referral_code = UPPER(referral_code)
    AND is_partner = TRUE
  LIMIT 1;
  
  IF partner_id IS NULL THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Code partenaire invalide'
    );
  END IF;
  
  -- Update user with partner reference
  UPDATE users
  SET referred_by_partner_id = partner_id
  WHERE id = new_user_id;
  
  RETURN json_build_object(
    'success', TRUE,
    'partner_id', partner_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Update get_active_user_partners to include referral code
CREATE OR REPLACE FUNCTION get_active_user_partners()
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  bio TEXT,
  partner_referral_code TEXT,
  total_commission_earned NUMERIC,
  total_sales BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.phone,
    u.email,
    u.avatar,
    u.bio,
    u.partner_referral_code,
    COALESCE(SUM(p.commission_amount), 0) as total_commission_earned,
    COUNT(DISTINCT p.id) as total_sales,
    u.created_at
  FROM users u
  LEFT JOIN products p ON p.seller_id = u.id AND p.status = 'approved'
  WHERE u.is_partner = TRUE
  GROUP BY u.id, u.name, u.phone, u.email, u.avatar, u.bio, u.partner_referral_code, u.created_at
  ORDER BY total_commission_earned DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 12: Grant necessary permissions
GRANT EXECUTE ON FUNCTION generate_partner_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_partner_stats TO authenticated;
GRANT EXECUTE ON FUNCTION apply_partner_referral TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_user_partners TO authenticated;
GRANT SELECT ON partner_statistics TO authenticated;

-- Step 13: Add RLS policies for new columns
-- Users can see their own referred_by_partner_id
-- Partners can see who they referred
-- Admins can see everything

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their referral info" ON users;
DROP POLICY IF EXISTS "Partners can view their referrals" ON users;

-- Policy: Users can see their own referral data
CREATE POLICY "Users can view their referral info" ON users
  FOR SELECT
  USING (
    auth.uid() = id
    OR 
    auth.uid() IN (SELECT id FROM users WHERE is_admin = TRUE OR is_super_admin = TRUE)
  );

-- Policy: Partners can see users they referred
CREATE POLICY "Partners can view their referrals" ON users
  FOR SELECT
  USING (
    referred_by_partner_id = auth.uid()
    OR
    auth.uid() IN (SELECT id FROM users WHERE is_admin = TRUE OR is_super_admin = TRUE)
  );

COMMENT ON COLUMN users.is_partner IS 'Indicates if user is a partner who can refer new users';
COMMENT ON COLUMN users.partner_referral_code IS 'Unique code partners can share with potential customers';
COMMENT ON COLUMN users.referred_by_partner_id IS 'ID of the partner who referred this user';
COMMENT ON COLUMN discount_codes.partner_user_id IS 'ID of the partner associated with this discount code';
