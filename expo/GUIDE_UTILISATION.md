# 📖 Guide d'Utilisation - Système de Commission et Codes Promo

## 🎯 Vue d'Ensemble

### Le système fonctionne en 3 étapes simples:

```
1. CRÉATION DU CODE      2. UTILISATION           3. CALCUL
   (Super Admin)            (Vendeur)                (Automatique)
   
   ┌──────────┐           ┌──────────┐           ┌──────────┐
   │ Créer    │──────────▶│ Vendeur  │──────────▶│ 15% → 10%│
   │ CODE2024 │           │ utilise  │           │ Économie │
   └──────────┘           └──────────┘           └──────────┘
        │                                              │
        │                                              │
        └──────────────────┬──────────────────────────┘
                           │
                      ┌────▼─────┐
                      │Partenaire│
                      │gagne 5%  │
                      └──────────┘
```

## 💰 Système de Commission

### Cas 1: Utilisateur Standard (Sans code promo)
```
Prix du produit: 10 000 FCFA
Commission: 15%
─────────────────────────────
À payer: 1 500 FCFA

Le vendeur paie 1 500 FCFA pour publier son annonce
```

### Cas 2: Utilisateur Standard (Avec code promo)
```
Prix du produit: 10 000 FCFA
Commission normale: 15% = 1 500 FCFA
Réduction: -5%
─────────────────────────────
Commission finale: 10% = 1 000 FCFA
À payer: 1 000 FCFA

Économie: 500 FCFA ✅
Si le code a un partenaire: le partenaire gagne 500 FCFA (5%)
```

### Cas 3: Utilisateur Premium
```
Prix du produit: 10 000 FCFA
Commission: 0%
─────────────────────────────
À payer: 0 FCFA

Publication gratuite! 🎉
```

### Cas 4: Premium Global Actif
```
Prix du produit: 10 000 FCFA
Commission: 0% (pour tous!)
─────────────────────────────
À payer: 0 FCFA

Tout le monde publie gratuitement pendant l'événement! 🎊
```

## 🎫 Codes Promo - Comment ça marche?

### Pour le Super Admin

#### Étape 1: Créer un code simple
```
Admin → Paramètres → "Créer un code"

┌────────────────────────────────┐
│ Créer un code promo            │
├────────────────────────────────┤
│ Code: [PROMO2024___________] │
│                                │
│ Le code réduit la commission   │
│ de 15% à 10%                   │
│                                │
│ [Annuler]         [Créer]      │
└────────────────────────────────┘
```

#### Étape 2: Associer à un partenaire (optionnel)
```
1. D'abord, créer le partenaire:
   Admin → Utilisateurs → Trouver l'utilisateur
   → Cliquer sur "Admin" ou "Prm"
   → L'utilisateur a maintenant is_partner = true

2. Ensuite, créer le code promo
   Le système verra automatiquement que c'est un partenaire
   et lui attribuera 5% de commission sur chaque utilisation
```

### Pour le Vendeur

#### Quand publier une annonce:
```
1. Remplir le formulaire d'annonce
2. Arriver à l'étape "Paiement"
3. Voir:
   ┌────────────────────────────────┐
   │ Frais de publication           │
   │ Prix: 10 000 FCFA              │
   │ Commission (15%): 1 500 FCFA   │
   │                                │
   │ Code promo (optionnel):        │
   │ [________________]             │
   │                                │
   │ [Vérifier]                     │
   └────────────────────────────────┘

4. Entrer "PROMO2024" et cliquer "Vérifier"
5. Voir:
   ┌────────────────────────────────┐
   │ ✅ Code appliqué!              │
   │                                │
   │ Prix: 10 000 FCFA              │
   │ Commission (10%): 1 000 FCFA   │
   │ Économie: 500 FCFA             │
   │                                │
   │ [Payer avec Wave]              │
   └────────────────────────────────┘
```

## 👥 Partenaires (Influenceurs)

### Qu'est-ce qu'un partenaire?
Un partenaire est un utilisateur normal qui:
- A `is_partner = true` dans la base de données
- Peut avoir des codes promo associés à son compte
- Gagne 5% de commission chaque fois que son code est utilisé

### Comment ça marche?

```
Exemple: Marie est une influenceuse

1. Super Admin fait de Marie une partenaire:
   Admin → Utilisateurs → Marie → Activer "Partenaire"
   
2. Super Admin crée un code pour Marie:
   Admin → Paramètres → Créer "MARIE2024"
   (Le système détecte automatiquement que Marie est partenaire)

3. Marie partage son code "MARIE2024" avec ses followers

4. Quelqu'un utilise le code:
   - L'utilisateur économise 500 FCFA (5% de 10 000)
   - Marie gagne 500 FCFA (5% de 10 000)
   - La plateforme reçoit 1 000 FCFA (10% de 10 000)

┌────────────────────────────────────────┐
│ Avant (sans code):                     │
│ Commission: 1 500 FCFA → Plateforme   │
│                                        │
│ Après (avec code MARIE2024):          │
│ Commission: 1 000 FCFA → Plateforme   │
│ + 500 FCFA → Marie (partenaire)       │
│ Économie: 500 FCFA → Utilisateur      │
└────────────────────────────────────────┘
```

### Voir les gains d'un partenaire

```sql
-- Dans Supabase, exécutez:
SELECT 
  u.name,
  COUNT(dc.id) as total_codes,
  SUM(dc.times_used) as total_utilisations,
  SUM(dc.times_used * 5) as estimation_gains_pct
FROM users u
LEFT JOIN discount_codes dc ON dc.partner_id = u.id
WHERE u.is_partner = true
GROUP BY u.id, u.name;
```

## 📢 Bannières (Messages défilants)

### Créer une bannière
```
Admin → Paramètres → "Nouveau Message"

┌────────────────────────────────┐
│ Créer un message               │
├────────────────────────────────┤
│ Message:                       │
│ [Black Friday! 50% de réduction│
│  sur tous les produits!_____] │
│                                │
│ Couleur de fond:               │
│ [🟠][🟢][🔵][🟡][🔴][🟣]      │
│                                │
│ Couleur du texte:              │
│ [⚪][⚫]                        │
│                                │
│ Aperçu:                        │
│ ┌──────────────────────────┐  │
│ │ Black Friday! 50% de     │  │
│ │ réduction sur tous les   │  │
│ │ produits!                │  │
│ └──────────────────────────┘  │
│                                │
│ [Annuler]         [Créer]      │
└────────────────────────────────┘
```

### Où apparaît la bannière?
```
┌────────────────────────────────────┐
│ ┌────────────────────────────────┐ │
│ │ 🔥 Black Friday! 50% de réduc  │ │ ← Bannière ici
│ └────────────────────────────────┘ │
│                                    │
│ [🏠 Accueil] [➕ Ajouter] [👤]    │
│                                    │
│ 🔍 Rechercher...                   │
│                                    │
│ ┌─────────────┐  ┌─────────────┐ │
│ │   Produit   │  │   Produit   │ │
│ │   10 000 F  │  │   15 000 F  │ │
│ └─────────────┘  └─────────────┘ │
└────────────────────────────────────┘
```

## 👑 Premium Global

### Qu'est-ce que c'est?
Mode spécial qui rend TOUS les utilisateurs Premium temporairement.
Parfait pour les événements spéciaux!

### Quand l'utiliser?
- Black Friday (24-48h)
- Ramadan / Korité (1 semaine)
- Anniversaire de l'app (1 jour)
- Opération spéciale (durée variable)

### Comment l'activer?
```
Admin → Paramètres → "Activer Premium Global"

┌────────────────────────────────┐
│ Activer Premium Global         │
├────────────────────────────────┤
│ Nom de l'événement:            │
│ [Black Friday 2024_________] │
│                                │
│ Description (optionnel):       │
│ [Publiez gratuitement pendant │
│  24 heures!________________] │
│                                │
│ Durée en heures:               │
│ [24_________________________] │
│                                │
│ Tous les utilisateurs seront   │
│ en Premium pendant la durée    │
│ choisie                        │
│                                │
│ [Annuler]         [Activer]    │
└────────────────────────────────┘
```

### Effet sur l'application
```
Pendant Premium Global:

┌────────────────────────────────┐
│ 👑 Black Friday 2024           │
│ Publiez gratuitement!          │
│ Encore 18h 24min               │
└────────────────────────────────┘

Tous les utilisateurs voient:
┌────────────────────────────────┐
│ Frais de publication           │
│ Prix: 10 000 FCFA              │
│ Commission: 0% (Premium Global)│
│ À payer: 0 FCFA                │
│                                │
│ [Publier gratuitement]         │
└────────────────────────────────┘
```

## 🔧 Paramètres Globaux

### Structure actuelle
```
┌──────────────────────────────────────┐
│ global_settings (table)              │
├──────────────────────────────────────┤
│ id: 'default'                        │
│ commission_rate: 15                  │ → 15%
│ discount_reduction: 5                │ → Réduction de 5%
│ partner_commission_rate: 5           │ → Partenaires gagnent 5%
│ updated_at: ...                      │
│ updated_by: ...                      │
└──────────────────────────────────────┘
```

### Modifier les paramètres (en SQL)
```sql
-- Changer la commission de 15% à 20%
UPDATE global_settings 
SET commission_rate = 20,
    updated_at = NOW(),
    updated_by = 'votre_user_id'
WHERE id = 'default';

-- Changer la réduction de 5% à 10%
UPDATE global_settings 
SET discount_reduction = 10
WHERE id = 'default';
```

## 📊 Tableau Récapitulatif

```
┌──────────────┬────────────┬────────────┬───────────┬─────────────┐
│ Scénario     │ Commission │ Code Promo │ Économie  │ Partenaire  │
├──────────────┼────────────┼────────────┼───────────┼─────────────┤
│ Standard     │ 15%        │ Non        │ 0         │ 0           │
│ Avec code    │ 10%        │ Oui        │ 5%        │ 5% (si lié) │
│ Premium      │ 0%         │ N/A        │ 15%       │ 0           │
│ Prem. Global │ 0%         │ N/A        │ 15%       │ 0           │
└──────────────┴────────────┴────────────┴───────────┴─────────────┘
```

## ✅ Checklist de Test

### Test 1: Code promo basique
- [ ] Créer un code "TEST001"
- [ ] Se déconnecter
- [ ] Se connecter avec un compte standard
- [ ] Publier une annonce avec le code "TEST001"
- [ ] Vérifier que la commission est 10% (au lieu de 15%)

### Test 2: Partenaire
- [ ] Créer un utilisateur "Marie"
- [ ] Faire de Marie une partenaire (Admin → Utilisateurs)
- [ ] Créer un code "MARIE2024"
- [ ] Utiliser le code lors d'une publication
- [ ] Vérifier que times_used du code s'incrémente

### Test 3: Bannière
- [ ] Créer une bannière "Promo du jour!"
- [ ] Rafraîchir l'app
- [ ] Voir la bannière en haut de l'accueil

### Test 4: Premium Global
- [ ] Activer Premium Global pour 1 heure
- [ ] Se connecter avec un compte standard
- [ ] Essayer de publier une annonce
- [ ] Vérifier que la commission est 0%

---

**Besoin d'aide?** 
- Consultez `RÉSUMÉ_CORRECTION.md` pour un aperçu rapide
- Consultez `INSTRUCTIONS_CORRECTION_FINALE.md` pour les détails techniques
