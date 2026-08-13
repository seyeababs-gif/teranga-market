-- CLEAN SCHEMA REBUILD FOR MARKETPLACE APP
-- This script creates a fresh database schema from scratch
-- Execute this in Supabase SQL Editor

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    location TEXT NOT NULL,
    email TEXT,
    bio TEXT,
    type TEXT DEFAULT 'standard' CHECK (type IN ('standard', 'premium')),
    is_admin BOOLEAN DEFAULT FALSE,
    is_super_admin BOOLEAN DEFAULT FALSE,
    is_partner BOOLEAN DEFAULT FALSE,
    partner_referral_code TEXT UNIQUE,
    rating NUMERIC(3,2),
    review_count INTEGER DEFAULT 0,
    joined_date TIMESTAMPTZ DEFAULT NOW(),
    premium_payment_pending BOOLEAN DEFAULT FALSE,
    premium_request_date TIMESTAMPTZ,
    delivery_address TEXT,
    delivery_city TEXT,
    delivery_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    images TEXT[] NOT NULL,
    category TEXT NOT NULL,
    sub_category TEXT,
    location TEXT NOT NULL,
    seller_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_name TEXT NOT NULL,
    seller_avatar TEXT,
    seller_phone TEXT,
    condition TEXT,
    status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    approved_by TEXT REFERENCES public.users(id),
    average_rating NUMERIC(3,2),
    review_count INTEGER DEFAULT 0,
    listing_type TEXT DEFAULT 'product' CHECK (listing_type IN ('product', 'service')),
    service_details JSONB,
    stock_quantity INTEGER,
    is_out_of_stock BOOLEAN DEFAULT FALSE,
    has_discount BOOLEAN DEFAULT FALSE,
    discount_percent NUMERIC(5,2),
    original_price NUMERIC(10,2),
    commission_amount NUMERIC(10,2),
    wave_payment_reference TEXT,
    payment_confirmed_at TIMESTAMPTZ,
    payment_confirmed_by TEXT REFERENCES public.users(id),
    discount_code TEXT,
    discount_code_applied BOOLEAN DEFAULT FALSE,
    partner_id TEXT REFERENCES public.users(id),
    partner_code_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FAVORITES TABLE
CREATE TABLE IF NOT EXISTS public.favorites (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_phone TEXT NOT NULL,
    items JSONB NOT NULL,
    total_amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'validated', 'rejected', 'shipped', 'completed')),
    payment_method TEXT DEFAULT 'wave',
    wave_transaction_id TEXT,
    delivery_name TEXT NOT NULL,
    delivery_phone TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_city TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    shipped_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    has_review BOOLEAN DEFAULT FALSE
);

-- 5. REVIEWS TABLE
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    seller_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PUSH TOKENS TABLE
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- 8. DISCOUNT CODES TABLE
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    partner_user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    discount_amount NUMERIC(10,2),
    discount_percent NUMERIC(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT REFERENCES public.users(id)
);

-- 9. GLOBAL SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.global_settings (
    id TEXT PRIMARY KEY DEFAULT 'main',
    commission_rate NUMERIC(5,2) DEFAULT 15.00,
    discount_reduction NUMERIC(5,2) DEFAULT 5.00,
    partner_commission_rate NUMERIC(5,2) DEFAULT 10.00,
    global_premium_active BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT REFERENCES public.users(id)
);

-- 10. PARTNER SALES TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.partner_sales (
    id SERIAL PRIMARY KEY,
    partner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    sale_amount NUMERIC(10,2) NOT NULL,
    commission_amount NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'paid')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PARTNER REFERRALS TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.partner_referrals (
    id SERIAL PRIMARY KEY,
    partner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referral_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partner_id, referred_user_id)
);

-- 12. COMMISSION PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.commission_payments (
    id SERIAL PRIMARY KEY,
    partner_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'wave',
    payment_reference TEXT,
    notes TEXT,
    paid_by TEXT REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_partner_id ON public.products(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON public.reviews(seller_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_sales_partner_id ON public.partner_sales(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id ON public.partner_referrals(partner_id);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for now (adjust as needed)
CREATE POLICY "Allow all users operations" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all products operations" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all favorites operations" ON public.favorites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all orders operations" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all reviews operations" ON public.reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all notifications operations" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all push_tokens operations" ON public.push_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all discount_codes operations" ON public.discount_codes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all global_settings operations" ON public.global_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all partner_sales operations" ON public.partner_sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all partner_referrals operations" ON public.partner_referrals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all commission_payments operations" ON public.commission_payments FOR ALL USING (true) WITH CHECK (true);

-- Insert default global settings
INSERT INTO public.global_settings (id, commission_rate, discount_reduction, partner_commission_rate, global_premium_active)
VALUES ('main', 15.00, 5.00, 10.00, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Create super admin user
INSERT INTO public.users (
    id, 
    name, 
    phone, 
    password, 
    avatar, 
    location, 
    type, 
    is_admin, 
    is_super_admin,
    delivery_address,
    delivery_city,
    delivery_phone
)
VALUES (
    'super-admin-' || extract(epoch from now())::text,
    'Super Admin',
    '+33651104669',
    'Carbabayese',
    'https://ui-avatars.com/api/?name=Super+Admin&background=00A651&color=fff&size=200',
    'France',
    'premium',
    TRUE,
    TRUE,
    'Admin Address',
    'Paris',
    '+33651104669'
)
ON CONFLICT (phone) 
DO UPDATE SET 
    is_super_admin = TRUE,
    is_admin = TRUE,
    type = 'premium',
    password = 'Carbabayese';

-- Helper function to check global premium status
CREATE OR REPLACE FUNCTION public.is_global_premium_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (SELECT COALESCE(global_premium_active, FALSE) FROM public.global_settings WHERE id = 'main');
END;
$$;
