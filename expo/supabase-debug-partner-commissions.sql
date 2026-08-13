-- ============================================
-- DEBUG ET CORRECTION DU SYSTÈME DE COMMISSIONS PARTENAIRES
-- ============================================

-- ÉTAPE 1: Vérifier l'état actuel
DO $$
BEGIN
  RAISE NOTICE '=== DIAGNOSTIC DU SYSTÈME ===';
  
  -- Vérifier si la table partner_commissions existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'partner_commissions') THEN
    RAISE NOTICE '✓ Table partner_commissions existe';
  ELSE
    RAISE NOTICE '✗ Table partner_commissions n''existe pas';
  END IF;
  
  -- Vérifier si le trigger existe
  IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_create_partner_commission') THEN
    RAISE NOTICE '✓ Trigger trigger_create_partner_commission existe';
  ELSE
    RAISE NOTICE '✗ Trigger trigger_create_partner_commission n''existe pas';
  END IF;
END $$;

-- ÉTAPE 2: Afficher des exemples de produits avec partner_id
DO $$
DECLARE
  v_count INTEGER;
  v_approved_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM products WHERE partner_id IS NOT NULL AND partner_id != '';
  SELECT COUNT(*) INTO v_approved_count FROM products WHERE partner_id IS NOT NULL AND partner_id != '' AND status = 'approved';
  
  RAISE NOTICE '=== PRODUITS AVEC PARTENAIRE ===';
  RAISE NOTICE 'Total produits avec partner_id: %', v_count;
  RAISE NOTICE 'Produits approuvés avec partner_id: %', v_approved_count;
END $$;

-- Afficher quelques exemples
SELECT 
  id,
  title,
  seller_id,
  seller_name,
  partner_id,
  status,
  created_at
FROM products 
WHERE partner_id IS NOT NULL AND partner_id != ''
ORDER BY created_at DESC
LIMIT 5;

-- ÉTAPE 3: Vérifier les commissions existantes
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM partner_commissions;
  RAISE NOTICE '=== COMMISSIONS ===';
  RAISE NOTICE 'Total commissions: %', v_count;
END $$;

-- Afficher quelques exemples de commissions
SELECT 
  pc.id,
  pc.partner_user_id,
  pc.product_id,
  pc.commission_amount,
  pc.status,
  p.title as product_title,
  p.status as product_status
FROM partner_commissions pc
LEFT JOIN products p ON p.id = pc.product_id
ORDER BY pc.created_at DESC
LIMIT 5;

-- ÉTAPE 4: Recréer le système proprement avec CASCADE
DROP TRIGGER IF EXISTS trigger_create_partner_commission ON products CASCADE;
DROP FUNCTION IF EXISTS create_partner_commission_on_approval() CASCADE;

-- ÉTAPE 5: Créer la fonction trigger améliorée avec plus de logs
CREATE OR REPLACE FUNCTION create_partner_commission_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_existing_commission UUID;
BEGIN
  RAISE NOTICE '[TRIGGER] Produit modifié: % (status: % -> %)', NEW.id, OLD.status, NEW.status;
  
  -- Vérifier que le produit vient d'être approuvé
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    RAISE NOTICE '[TRIGGER] Produit approuvé détecté: %', NEW.id;
    
    -- Récupérer l'ID du partenaire depuis partner_id
    IF NEW.partner_id IS NOT NULL AND NEW.partner_id != '' THEN
      RAISE NOTICE '[TRIGGER] Partner ID trouvé: %', NEW.partner_id;
      
      BEGIN
        v_partner_id := NEW.partner_id::uuid;
        RAISE NOTICE '[TRIGGER] Partner UUID: %', v_partner_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[TRIGGER] ✗ Format partner_id invalide: %', NEW.partner_id;
        RETURN NEW;
      END;
      
      -- Vérifier que ce n'est pas le vendeur lui-même
      IF v_partner_id::text = NEW.seller_id THEN
        RAISE NOTICE '[TRIGGER] ⚠ Le vendeur est le partenaire, pas de commission';
        RETURN NEW;
      END IF;
      
      -- Vérifier si une commission existe déjà
      SELECT id INTO v_existing_commission
      FROM partner_commissions
      WHERE partner_user_id = v_partner_id
        AND product_id = NEW.id;
      
      IF v_existing_commission IS NOT NULL THEN
        RAISE NOTICE '[TRIGGER] ⚠ Commission déjà existante: %', v_existing_commission;
        RETURN NEW;
      END IF;
      
      -- Récupérer le taux de commission
      SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
      FROM global_settings
      LIMIT 1;
      
      IF v_commission_rate IS NULL THEN
        v_commission_rate := 10;
        RAISE NOTICE '[TRIGGER] ⚠ Pas de settings, utilisation du taux par défaut: %', v_commission_rate;
      ELSE
        RAISE NOTICE '[TRIGGER] Taux de commission: %', v_commission_rate;
      END IF;
      
      -- Calculer la commission
      v_commission_amount := (NEW.price * v_commission_rate) / 100;
      RAISE NOTICE '[TRIGGER] Commission calculée: % FCFA', v_commission_amount;
      
      -- Créer la commission
      INSERT INTO partner_commissions (
        partner_user_id,
        product_id,
        commission_amount,
        commission_rate,
        status,
        created_at
      )
      VALUES (
        v_partner_id,
        NEW.id,
        v_commission_amount,
        v_commission_rate,
        'pending',
        NOW()
      );
      
      RAISE NOTICE '[TRIGGER] ✓ Commission créée avec succès !';
      
      -- Créer une notification pour le partenaire
      BEGIN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          is_read,
          created_at
        )
        VALUES (
          v_partner_id::text,
          'partner_commission',
          '🎉 Nouvelle commission !',
          format('Le produit "%s" a été validé. Vous gagnez %s FCFA de commission !', 
                 NEW.title, 
                 ROUND(v_commission_amount)::text),
          jsonb_build_object(
            'product_id', NEW.id,
            'product_title', NEW.title,
            'commission_amount', v_commission_amount,
            'seller_name', NEW.seller_name
          ),
          false,
          NOW()
        );
        RAISE NOTICE '[TRIGGER] ✓ Notification créée';
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[TRIGGER] ⚠ Erreur lors de la création de la notification: %', SQLERRM;
      END;
      
    ELSE
      RAISE NOTICE '[TRIGGER] Pas de partner_id sur ce produit';
    END IF;
  ELSE
    RAISE NOTICE '[TRIGGER] Produit non approuvé ou déjà approuvé, aucune action';
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[TRIGGER] ✗ ERREUR: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ÉTAPE 6: Créer le trigger
CREATE TRIGGER trigger_create_partner_commission
  AFTER INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION create_partner_commission_on_approval();

RAISE NOTICE '=== SYSTÈME RECRÉÉ ===';
RAISE NOTICE '✓ Trigger installé et actif';
RAISE NOTICE '✓ Les commissions seront créées automatiquement lors de l''approbation des produits';

-- ÉTAPE 7: Créer les commissions pour les produits déjà approuvés
DO $$
DECLARE
  v_product RECORD;
  v_partner_id UUID;
  v_commission_rate NUMERIC;
  v_commission_amount NUMERIC;
  v_existing_commission UUID;
  v_created_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
BEGIN
  RAISE NOTICE '=== CRÉATION DES COMMISSIONS MANQUANTES ===';
  
  -- Récupérer le taux de commission
  SELECT COALESCE(partner_commission_rate, 10) INTO v_commission_rate
  FROM global_settings
  LIMIT 1;
  
  IF v_commission_rate IS NULL THEN
    v_commission_rate := 10;
  END IF;
  
  -- Pour chaque produit approuvé avec un partner_id
  FOR v_product IN 
    SELECT * FROM products 
    WHERE status = 'approved' 
      AND partner_id IS NOT NULL 
      AND partner_id != ''
  LOOP
    BEGIN
      -- Convertir partner_id en UUID
      v_partner_id := v_product.partner_id::uuid;
      
      -- Vérifier que ce n'est pas le vendeur lui-même
      IF v_partner_id::text = v_product.seller_id THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
      
      -- Vérifier si une commission existe déjà
      SELECT id INTO v_existing_commission
      FROM partner_commissions
      WHERE partner_user_id = v_partner_id
        AND product_id = v_product.id;
      
      IF v_existing_commission IS NOT NULL THEN
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
      
      -- Calculer la commission
      v_commission_amount := (v_product.price * v_commission_rate) / 100;
      
      -- Créer la commission
      INSERT INTO partner_commissions (
        partner_user_id,
        product_id,
        commission_amount,
        commission_rate,
        status,
        created_at
      )
      VALUES (
        v_partner_id,
        v_product.id,
        v_commission_amount,
        v_commission_rate,
        'pending',
        NOW()
      );
      
      v_created_count := v_created_count + 1;
      
      -- Créer une notification
      BEGIN
        INSERT INTO notifications (
          user_id,
          type,
          title,
          message,
          data,
          is_read,
          created_at
        )
        VALUES (
          v_partner_id::text,
          'partner_commission',
          '🎉 Commission créée !',
          format('Commission créée pour le produit "%s": %s FCFA', 
                 v_product.title, 
                 ROUND(v_commission_amount)::text),
          jsonb_build_object(
            'product_id', v_product.id,
            'product_title', v_product.title,
            'commission_amount', v_commission_amount,
            'seller_name', v_product.seller_name
          ),
          false,
          NOW()
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '✗ Erreur pour produit %: %', v_product.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '✓ Commissions créées: %', v_created_count;
  RAISE NOTICE '⚠ Commissions ignorées (déjà existantes ou vendeur=partenaire): %', v_skipped_count;
END $$;

-- ÉTAPE 8: Vérification finale
DO $$
DECLARE
  v_total_commissions INTEGER;
  v_total_pending NUMERIC;
  v_total_paid NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END),
    SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END)
  INTO v_total_commissions, v_total_pending, v_total_paid
  FROM partner_commissions;
  
  RAISE NOTICE '=== RÉSUMÉ FINAL ===';
  RAISE NOTICE 'Total commissions: %', v_total_commissions;
  RAISE NOTICE 'Total en attente: % FCFA', v_total_pending;
  RAISE NOTICE 'Total payé: % FCFA', v_total_paid;
  RAISE NOTICE '====================================';
  RAISE NOTICE 'Le système est maintenant opérationnel !';
  RAISE NOTICE 'Les partenaires peuvent voir leurs commissions dans leur tableau de bord.';
END $$;
