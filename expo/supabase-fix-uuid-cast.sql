-- ===============================================
-- CORRECTION DES ERREURS DE COMPARAISON UUID/TEXT
-- ===============================================
-- Ce script résout l'erreur: operator does not exist: text = uuid
-- Le problème: auth.uid() retourne UUID mais nos colonnes sont en TEXT
-- ===============================================

-- ÉTAPE 1: CORRIGER LES POLITIQUES RLS POUR DISCOUNT_CODE_USAGE
-- ===============================================

DROP POLICY IF EXISTS "Users can view their discount usage" ON discount_code_usage;
CREATE POLICY "Users can view their discount usage" ON discount_code_usage
  FOR SELECT USING (user_id = auth.uid()::text);

-- ÉTAPE 2: CORRIGER LES POLITIQUES RLS POUR DISCOUNT_CODES
-- ===============================================

DROP POLICY IF EXISTS "SuperAdmins can manage discount codes" ON discount_codes;
CREATE POLICY "SuperAdmins can manage discount codes" ON discount_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- ÉTAPE 3: CORRIGER LES POLITIQUES RLS POUR ANNOUNCEMENT_BANNERS
-- ===============================================

DROP POLICY IF EXISTS "SuperAdmins can manage banners" ON announcement_banners;
CREATE POLICY "SuperAdmins can manage banners" ON announcement_banners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- ÉTAPE 4: CORRIGER LES POLITIQUES RLS POUR GLOBAL_PREMIUM_MODE
-- ===============================================

DROP POLICY IF EXISTS "SuperAdmins can manage global premium mode" ON global_premium_mode;
CREATE POLICY "SuperAdmins can manage global premium mode" ON global_premium_mode
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND is_super_admin = true)
  );

-- ÉTAPE 5: CORRIGER LES POLITIQUES RLS POUR PRODUCTS
-- ===============================================

DROP POLICY IF EXISTS "Users can view products" ON products;
CREATE POLICY "Users can view products" ON products 
  FOR SELECT USING (
    status = 'approved' OR 
    seller_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can update products" ON products;
CREATE POLICY "Users can update products" ON products 
  FOR UPDATE USING (
    seller_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can delete products" ON products;
CREATE POLICY "Users can delete products" ON products 
  FOR DELETE USING (
    seller_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can insert products" ON products;
CREATE POLICY "Users can insert products" ON products 
  FOR INSERT WITH CHECK (
    seller_id = auth.uid()::text
  );

-- ÉTAPE 6: CORRIGER LES POLITIQUES RLS POUR ORDERS
-- ===============================================

DROP POLICY IF EXISTS "Users can view their orders" ON orders;
CREATE POLICY "Users can view their orders" ON orders 
  FOR SELECT USING (
    buyer_id = auth.uid()::text OR 
    seller_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can insert orders" ON orders;
CREATE POLICY "Users can insert orders" ON orders 
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their orders" ON orders;
CREATE POLICY "Users can update their orders" ON orders 
  FOR UPDATE USING (
    buyer_id = auth.uid()::text OR 
    seller_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

-- ÉTAPE 7: CORRIGER LES POLITIQUES RLS POUR REVIEWS
-- ===============================================

DROP POLICY IF EXISTS "Users can view reviews" ON reviews;
CREATE POLICY "Users can view reviews" ON reviews 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their reviews" ON reviews;
CREATE POLICY "Users can insert their reviews" ON reviews 
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their reviews" ON reviews;
CREATE POLICY "Users can update their reviews" ON reviews 
  FOR UPDATE USING (
    reviewer_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can delete their reviews" ON reviews;
CREATE POLICY "Users can delete their reviews" ON reviews 
  FOR DELETE USING (
    reviewer_id = auth.uid()::text OR
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

-- ÉTAPE 8: CORRIGER LES POLITIQUES RLS POUR USERS
-- ===============================================

DROP POLICY IF EXISTS "Users can view profiles" ON users;
CREATE POLICY "Users can view profiles" ON users 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users 
  FOR UPDATE USING (
    id = auth.uid()::text OR 
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true))
  );

DROP POLICY IF EXISTS "Users can insert their profile" ON users;
CREATE POLICY "Users can insert their profile" ON users 
  FOR INSERT WITH CHECK (
    id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admins can delete users" ON users;
CREATE POLICY "Admins can delete users" ON users 
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND (is_admin = true OR is_super_admin = true)) AND
    id != (SELECT id FROM users WHERE is_super_admin = true LIMIT 1)
  );

-- ÉTAPE 9: VÉRIFICATION
-- ===============================================

SELECT 
  'Correction UUID/TEXT terminée avec succès!' as status,
  COUNT(*) FILTER (WHERE schemaname = 'public') as total_policies
FROM pg_policies 
WHERE schemaname = 'public';
