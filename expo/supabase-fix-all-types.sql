-- ============================================
-- CORRECTION COMPLÈTE DES TYPES ET SYSTÈME PARTENAIRE
-- ============================================

-- 1. NETTOYER LES ANCIENNES TABLES
DROP TABLE IF EXISTS commission_payments CASCADE;
DROP TABLE IF EXISTS partner_commissions CASCADE;

-- 2. CRÉER LA TABLE commission_payments AVEC LES BONS TYPES
CREATE TABLE commission_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  commission_amount NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  paid_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CRÉER LES INDEX
CREATE INDEX IF NOT EXISTS idx_commission_payments_partner ON commission_payments(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON commission_payments(status);
CREATE INDEX IF NOT EXISTS idx_commission_payments_product ON commission_payments(product_id);

-- 4. AJOUTER LES COLONNES MANQUANTES DANS users SI NÉCESSAIRE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_partner'
  ) THEN
    ALTER TABLE users ADD COLUMN is_partner BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'partner_referral_code'
  ) THEN
    ALTER TABLE users ADD COLUMN partner_referral_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- 5. AJOUTER LES COLONNES DANS products SI NÉCESSAIRE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'partner_id'
  ) THEN
    ALTER TABLE products ADD COLUMN partner_id TEXT REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'discount_code_applied'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_code_applied BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_amount NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 6. CRÉER LA TABLE global_settings SI ELLE N'EXISTE PAS
CREATE TABLE IF NOT EXISTS global_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_rate NUMERIC DEFAULT 10,
  discount_reduction NUMERIC DEFAULT 50,
  partner_commission_rate NUMERIC DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT REFERENCES users(id)
);

-- 7. INSÉRER LES PARAMÈTRES PAR DÉFAUT SI LA TABLE EST VIDE
INSERT INTO global_settings (commission_rate, discount_reduction, partner_commission_rate)
SELECT 10, 50, 5
WHERE NOT EXISTS (SELECT 1 FROM global_settings);

-- 8. CRÉER LE PARTENAIRE +221771801199
DO $$
DECLARE
  v_partner_id TEXT;
BEGIN
  SELECT id INTO v_partner_id FROM users WHERE phone = '+221771801199';
  
  IF v_partner_id IS NULL THEN
    INSERT INTO users (
      id, name, phone, password, avatar, type, is_partner, partner_referral_code, location
    ) VALUES (
      'partner-' || gen_random_uuid()::text,
      'Partenaire Principal',
      '+221771801199',
      '$2a$10$defaulthash',
      'https://via.placeholder.com/150',
      'standard',
      true,
      'PART1199',
      'Dakar, Sénégal'
    )
    RETURNING id INTO v_partner_id;
    
    RAISE NOTICE '✅ Partenaire créé: % avec code PART1199', v_partner_id;
  ELSE
    UPDATE users 
    SET 
      is_partner = true,
      partner_referral_code = COALESCE(partner_referral_code, 'PART1199')
    WHERE id = v_partner_id;
    
    RAISE NOTICE '✅ Partenaire mis à jour: % avec code %', v_partner_id, (SELECT partner_referral_code FROM users WHERE id = v_partner_id);
  END IF;
END $$;

-- 9. CRÉER LE PARTENAIRE +221651104669
DO $$
DECLARE
  v_partner_id TEXT;
BEGIN
  SELECT id INTO v_partner_id FROM users WHERE phone = '+221651104669';
  
  IF v_partner_id IS NULL THEN
    INSERT INTO users (
      id, name, phone, password, avatar, type, is_partner, partner_referral_code, location
    ) VALUES (
      'partner-' || gen_random_uuid()::text,
      'Partenaire Secondaire',
      '+221651104669',
      '$2a$10$defaulthash',
      'https://via.placeholder.com/150',
      'standard',
      true,
      'PART4669',
      'Dakar, Sénégal'
    )
    RETURNING id INTO v_partner_id;
    
    RAISE NOTICE '✅ Partenaire créé: % avec code PART4669', v_partner_id;
  ELSE
    UPDATE users 
    SET 
      is_partner = true,
      partner_referral_code = COALESCE(partner_referral_code, 'PART4669')
    WHERE id = v_partner_id;
    
    RAISE NOTICE '✅ Partenaire mis à jour: % avec code %', v_partner_id, (SELECT partner_referral_code FROM users WHERE id = v_partner_id);
  END IF;
END $$;

-- 10. NETTOYER LES ANCIENNES FONCTIONS
DROP FUNCTION IF EXISTS get_partner_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commissions(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_commission_stats(TEXT) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_partner_referred_clients(TEXT) CASCADE;
DROP FUNCTION IF EXISTS mark_commission_as_paid(UUID, TEXT) CASCADE;

-- 11. CRÉER LA FONCTION mark_commission_as_paid
CREATE OR REPLACE FUNCTION mark_commission_as_paid(
  p_payment_id UUID,
  p_paid_by TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE commission_payments
  SET 
    status = 'paid',
    paid_at = NOW(),
    paid_by = p_paid_by,
    updated_at = NOW()
  WHERE id = p_payment_id;
  
  INSERT INTO notifications (
    id,
    user_id,
    type,
    title,
    message,
    is_read,
    created_at
  )
  SELECT
    gen_random_uuid()::text,
    partner_user_id,
    'partner_commission_paid',
    '💰 Commission payée !',
    'Votre commission de ' || ROUND(commission_amount)::text || ' FCFA a été payée',
    false,
    NOW()
  FROM commission_payments
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. CRÉER LE TRIGGER POUR LES COMMISSIONS
DROP TRIGGER IF EXISTS trigger_create_commission_on_approval ON products;
DROP FUNCTION IF EXISTS create_commission_on_approval() CASCADE;

CREATE OR REPLACE FUNCTION create_commission_on_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
BEGIN
  IF NEW.status = 'approved' 
     AND NEW.partner_id IS NOT NULL 
     AND NEW.discount_code_applied = true
     AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    
    BEGIN
      SELECT COALESCE(partner_commission_rate, 5) INTO v_commission_rate
      FROM global_settings
      LIMIT 1;
      
      v_commission_amount := (NEW.price * v_commission_rate) / 100;
      
      IF NOT EXISTS (
        SELECT 1 FROM commission_payments 
        WHERE product_id = NEW.id::uuid
      ) THEN
        INSERT INTO commission_payments (
          partner_user_id,
          product_id,
          commission_amount,
          commission_rate,
          status,
          created_at
        )
        VALUES (
          NEW.partner_id,
          NEW.id::uuid,
          v_commission_amount,
          v_commission_rate,
          'pending',
          NOW()
        );
        
        INSERT INTO notifications (
          id,
          user_id,
          type,
          title,
          message,
          data,
          is_read,
          created_at
        )
        VALUES (
          gen_random_uuid()::text,
          NEW.partner_id,
          'partner_commission',
          '🎉 Nouvelle commission !',
          format('Commission de %s FCFA générée pour "%s"', 
                 ROUND(v_commission_amount)::text, 
                 NEW.title),
          jsonb_build_object(
            'product_id', NEW.id,
            'commission_amount', v_commission_amount
          ),
          false,
          NOW()
        );
        
        RAISE NOTICE '✅ Commission créée: % FCFA pour produit %', v_commission_amount, NEW.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '⚠️ Erreur création commission: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_commission_on_approval
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_commission_on_approval();

-- 13. ACTIVER RLS SUR commission_payments
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their commissions" ON commission_payments;
DROP POLICY IF EXISTS "Super admins can view all commissions" ON commission_payments;
DROP POLICY IF EXISTS "Super admins can update commissions" ON commission_payments;

CREATE POLICY "Partners can view their commissions" 
  ON commission_payments FOR SELECT 
  USING (partner_user_id = auth.uid()::text);

CREATE POLICY "Super admins can view all commissions" 
  ON commission_payments FOR SELECT 
  USING ((SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true);

CREATE POLICY "Super admins can update commissions" 
  ON commission_payments FOR UPDATE 
  USING ((SELECT is_super_admin FROM users WHERE id = auth.uid()::text) = true);

-- 14. VÉRIFICATION FINALE
DO $$
DECLARE
  v_partner_count INTEGER;
  v_settings_count INTEGER;
  v_phone TEXT;
  v_code TEXT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  
  SELECT COUNT(*) INTO v_partner_count FROM users WHERE is_partner = true;
  RAISE NOTICE 'Nombre de partenaires: %', v_partner_count;
  
  SELECT COUNT(*) INTO v_settings_count FROM global_settings;
  RAISE NOTICE 'Paramètres globaux: %', v_settings_count;
  
  RAISE NOTICE 'Codes partenaires:';
  FOR v_phone, v_code IN 
    SELECT phone, partner_referral_code 
    FROM users 
    WHERE is_partner = true 
  LOOP
    RAISE NOTICE '  - %: %', v_phone, v_code;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Configuration terminée !';
  RAISE NOTICE '========================================';
END $$;
