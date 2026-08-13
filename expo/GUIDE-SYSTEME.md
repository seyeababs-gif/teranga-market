# 🎯 GUIDE RAPIDE - Système de Commission et Codes Promo

## ⚡ EN BREF

- **Commission normale** : 15%
- **Avec code promo** : 10% (réduction de 5%)
- **Partenaire** : Juste un statut pour identifier d'où viennent les utilisateurs

---

## 📖 Fonctionnement Détaillé

### 1. Publication d'annonce

```
Vendeur publie annonce
    ↓
Calcul commission : 15% du prix
    ↓
Vendeur paie via Wave
    ↓
Si code promo entré → Commission devient 10%
    ↓
Admin valide le paiement
    ↓
Annonce publiée ✅
```

### 2. Codes Promo

**Créer un code (Super Admin uniquement) :**
1. Admin → Paramètres
2. Section "Codes Promo"
3. Cliquer "+ Créer un code promo"
4. Entrer le code (ex: PROMO2024)
5. Valider

**Utiliser un code (Vendeur) :**
1. Au moment de payer la commission Wave
2. Entrer le code promo
3. Commission réduite automatiquement de 15% → 10%

### 3. Partenaires (Influenceurs)

**C'est quoi ?**
- Un statut/marqueur sur un utilisateur
- Permet de tracker d'où viennent les utilisateurs
- Exemple : "Cet utilisateur vient de l'influenceur X"

**Comment définir un partenaire ?**
1. Admin → Utilisateurs
2. Cliquer sur utilisateur
3. Toggle "Partenaire"

**Note importante :** Pour l'instant, les partenaires ne gagnent PAS de commission. C'est juste un marqueur.

---

## 🔧 Configuration Technique

### Base de données (Supabase)

**Tables principales :**
- `global_settings` : Configuration commission (15%, 5%, etc.)
- `discount_codes` : Liste des codes promo
- `users` : Utilisateurs avec champ `is_partner`
- `products` : Annonces avec `discount_code_applied`

**Exécuter la correction :**
```sql
-- Fichier : CORRECTION-COMPLETE-FINALE.sql
-- Exécuter dans Supabase SQL Editor
```

---

## 💡 Exemples Concrets

### Exemple 1 : Vendre sans code promo
```
Prix produit : 10,000 FCFA
Commission 15% : 1,500 FCFA
Vendeur paie : 1,500 FCFA
```

### Exemple 2 : Vendre avec code promo "PROMO2024"
```
Prix produit : 10,000 FCFA
Code promo : PROMO2024
Commission 10% : 1,000 FCFA
Vendeur paie : 1,000 FCFA
Économie : 500 FCFA ✅
```

---

## 🎨 Interface Admin

### Onglet Paramètres (Super Admin only)

**Section 1 : Frais de Commission**
- Affiche : 15%
- Info : "Frais prélevés quand un vendeur publie une annonce"

**Section 2 : Codes Promo**
- Liste des codes actifs
- Nombre d'utilisations de chaque code
- Bouton pour créer un nouveau code
- Explication claire du système

**Section 3 : Messages défilants**
- Messages affichés en haut de l'app
- Créer/supprimer des messages

**Section 4 : Premium Global**
- Activer Premium pour tous (événements)
- Définir une durée

---

## 🚦 Workflow Complet

```
┌─────────────────┐
│ Vendeur publie  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Calcul 15%      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│ Paiement Wave   │────→ │ Code promo ? │
└────────┬────────┘      └──────┬───────┘
         │                      │
         │                      ▼
         │              ┌──────────────┐
         │              │ OUI: 10%     │
         │              │ NON: 15%     │
         │              └──────┬───────┘
         │                      │
         ▼◄─────────────────────┘
┌─────────────────┐
│ Admin valide    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Annonce publiée │
└─────────────────┘
```

---

## 🔐 Permissions

| Action | Standard | Premium | Admin | Super Admin |
|--------|----------|---------|-------|-------------|
| Publier annonce | ✅ | ✅ | ✅ | ✅ |
| Utiliser code promo | ✅ | ✅ | ✅ | ✅ |
| Valider annonces | ❌ | ❌ | ✅ | ✅ |
| Créer codes promo | ❌ | ❌ | ❌ | ✅ |
| Définir partenaires | ❌ | ❌ | ❌ | ✅ |
| Premium Global | ❌ | ❌ | ❌ | ✅ |

---

## 📞 Support

Si quelque chose ne fonctionne pas :

1. **Vérifier que le SQL a été exécuté**
   - Dashboard Supabase → SQL Editor
   - Vérifier table `global_settings` existe

2. **Vérifier la commission dans la base**
   ```sql
   SELECT * FROM global_settings WHERE id = 'default';
   ```
   Doit retourner : commission_rate = 15, discount_reduction = 5

3. **Redémarrer l'application**
   - Fermer complètement l'app
   - Rouvrir

4. **Vérifier les logs**
   - Console navigateur (F12)
   - Chercher erreurs SQL

---

## 🎯 Prochaines Étapes (Optionnel)

Si tu veux ajouter le système de commission pour partenaires plus tard :

1. Créer une table `partner_commissions`
2. Tracker quand un code promo d'un partenaire est utilisé
3. Calculer et verser 5% au partenaire

Mais **pour l'instant, c'est pas nécessaire**. Le système actuel fonctionne parfaitement !
