-- Mise à jour du taux de commission des partenaires à 5%
UPDATE global_settings
SET partner_commission_rate = 5,
    updated_at = NOW()
WHERE id = 'default';

-- Vérifier que la mise à jour a réussi
SELECT 
  id,
  commission_rate,
  discount_reduction,
  partner_commission_rate,
  updated_at
FROM global_settings
WHERE id = 'default';
