-- Add commission_amount, wave_payment_reference, payment_confirmed_at and payment_confirmed_by columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS wave_payment_reference TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_confirmed_by TEXT;

-- Add comment for documentation
COMMENT ON COLUMN products.commission_amount IS 'The 10% commission amount that seller needs to pay to publish the product';
COMMENT ON COLUMN products.wave_payment_reference IS 'Wave payment reference number for commission payment';
COMMENT ON COLUMN products.payment_confirmed_at IS 'When admin confirmed the commission payment';
COMMENT ON COLUMN products.payment_confirmed_by IS 'Admin user ID who confirmed the payment';
