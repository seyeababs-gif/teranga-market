-- Fix product status constraint to include pending_payment
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected'));

-- Make sure commission columns exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wave_payment_reference TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- Update RLS policies to allow sellers to see their own products regardless of status
DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products" ON products FOR SELECT USING (
  status = 'approved' OR 
  seller_id = auth.uid()::text OR
  (SELECT is_admin FROM users WHERE id = auth.uid()::text) = true OR
  (SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true
);

-- Comments for documentation
COMMENT ON COLUMN products.commission_amount IS 'The 10% commission amount that seller needs to pay to publish the product';
COMMENT ON COLUMN products.wave_payment_reference IS 'Wave payment reference number for commission payment';
COMMENT ON COLUMN products.payment_confirmed_at IS 'When seller confirmed the commission payment';
COMMENT ON COLUMN products.payment_confirmed_by IS 'Seller user ID who confirmed the payment';
COMMENT ON CONSTRAINT products_status_check ON products IS 'Product workflow: pending_payment -> pending (after payment) -> approved/rejected (by admin)';
