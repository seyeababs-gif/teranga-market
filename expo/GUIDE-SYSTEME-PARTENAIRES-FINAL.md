# 🎯 Guide Système Partenaires - Version Finale

## ✅ Script SQL Créé
**Fichier:** `supabase-partner-system-final-clean.sql`

## 🚀 Instructions d'Exécution

### 1. Exécuter le Script SQL
Copiez le contenu de `supabase-partner-system-final-clean.sql` et exécutez-le dans l'éditeur SQL de Supabase.

**Ce script fait tout automatiquement:**
- ✅ Nettoie toutes les anciennes erreurs
- ✅ Crée les colonnes nécessaires dans `users`
- ✅ Crée les tables `discount_codes` et `partner_commissions`
- ✅ Crée toutes les fonctions nécessaires
- ✅ Configure les triggers pour les commissions automatiques
- ✅ Génère des codes de parrainage pour les partenaires existants

### 2. Vérifier l'Installation
Après l'exécution, vous devriez voir dans les logs:
```
✅ SYSTÈME PARTENAIRES INITIALISÉ AVEC SUCCÈS
Partenaires actifs: X
Codes de réduction: X
Commissions: X
```

## 📱 Fonctionnalités du Système

### Pour le Super Admin (`/admin/manage-partners`)
1. **Activer/Désactiver des partenaires**
   - Toggle simple pour chaque utilisateur
   - Génération automatique du code de parrainage

2. **Voir les statistiques**
   - Nombre de partenaires
   - Nombre d'utilisateurs

3. **Recherche et filtres**
   - Rechercher par nom, téléphone
   - Filtrer: Tous / Partenaires uniquement

### Pour les Partenaires (`/(tabs)/partner-dashboard`)
1. **Code de parrainage personnel**
   - Affiché en grand avec fond orange
   - Bouton pour copier
   - Visible uniquement par le partenaire

2. **Statistiques**
   - Vendeurs référés
   - Ventes totales
   - Commission totale gagnée

3. **Commissions détaillées**
   - Liste de toutes les commissions
   - Statut: En attente / Payée
   - Détails: Produit, Vendeur, Prix, Taux de commission

4. **Codes promo**
   - Liste des codes de réduction actifs
   - Nombre d'utilisations

5. **Vendeurs référés**
   - Liste des utilisateurs qui ont utilisé leur code

## 🔄 Flux Complet

### 1. Activation d'un Partenaire
```
Super Admin → /admin/manage-partners → Toggle "Activer"
↓
Système génère automatiquement un code unique (ex: PARTNER8A4F2B)
↓
Partenaire peut voir son code dans son profil
```

### 2. Utilisation du Code de Parrainage
```
Vendeur publie un produit
↓
Entre le code partenaire (ex: PARTNER8A4F2B)
↓
Système identifie le partenaire
↓
Applique la réduction au vendeur
↓
Lien le produit au partenaire
```

### 3. Création de Commission
```
Produit avec code partenaire est approuvé
↓
Trigger automatique crée une commission
↓
Commission = (Prix produit × Taux commission) / 100
↓
Commission visible dans le dashboard du partenaire
↓
Statut: "En attente"
```

### 4. Paiement des Commissions
```
Super Admin marque la commission comme "Payée"
↓
Statut passe à "Payée"
↓
Total des commissions payées mis à jour
```

## 🎨 Codes Couleurs

### Code de Parrainage Personnel (Dashboard Partenaire)
- **Fond:** Orange (#FF6B35)
- **Texte:** Blanc (#FFF)
- **Police:** 28px, poids 900, espacement 2
- **Lisible et voyant** ✅

### Badges
- **Partenaire:** Couronne dorée (#FFD700)
- **Commission Payée:** Vert (#10B981)
- **Commission En attente:** Orange (#F59E0B)

## 🗄️ Structure de la Base de Données

### Table `users`
```sql
- is_partner: BOOLEAN (false par défaut)
- partner_referral_code: TEXT (unique)
- referred_by_partner_id: TEXT (référence vers users.id)
```

### Table `discount_codes`
```sql
- id: TEXT (UUID)
- code: TEXT (unique)
- description: TEXT
- discount_percent: INTEGER (5% par défaut)
- partner_user_id: TEXT (référence vers users.id)
- is_active: BOOLEAN
- times_used: INTEGER
```

### Table `partner_commissions`
```sql
- id: TEXT (UUID)
- partner_user_id: TEXT
- product_id: TEXT
- seller_id: TEXT
- product_title: TEXT
- product_price: DECIMAL
- seller_name: TEXT
- commission_rate: INTEGER
- commission_amount: DECIMAL
- status: TEXT ('pending' | 'paid')
- paid_at: TIMESTAMP
```

### Table `products` (colonnes ajoutées)
```sql
- partner_code_used: TEXT
- partner_user_id: TEXT
- commission_rate: INTEGER
- commission_amount: DECIMAL
```

## 🔧 Fonctions Disponibles

### `get_active_user_partners()`
Retourne tous les partenaires actifs avec leurs statistiques

### `get_partner_stats(partner_user_id TEXT)`
Retourne les stats d'un partenaire spécifique

### `update_partner_referral_code(partner_user_id TEXT, new_code TEXT)`
Met à jour le code de parrainage d'un partenaire

### `get_partner_commissions(partner_user_id TEXT)`
Retourne toutes les commissions d'un partenaire

### `get_partner_commission_stats(partner_user_id TEXT)`
Retourne les statistiques de commissions (total, en attente, payé)

## 🎯 Pages de l'Application

### `/admin/manage-partners`
- Accessible uniquement au super admin
- Liste tous les utilisateurs
- Toggle pour activer/désactiver le statut partenaire
- Recherche et filtres

### `/(tabs)/partner-dashboard`
- Accessible uniquement aux partenaires
- Dashboard complet avec toutes les statistiques
- Code de parrainage bien visible
- Liste des commissions et vendeurs référés

## 💡 Notes Importantes

1. **Code de Parrainage**
   - Généré automatiquement au format: PARTNER + 6 caractères aléatoires
   - Unique pour chaque partenaire
   - Modifiable par le super admin

2. **Commissions**
   - Créées automatiquement quand un produit avec code partenaire est approuvé
   - Taux de commission défini dans `global_settings.partner_commission_rate` (10% par défaut)
   - Statut initial: "En attente"

3. **Visibilité**
   - Le code de parrainage est différent des codes promo (`discount_codes`)
   - Le code de parrainage est personnel et visible dans le profil
   - Les codes promo sont créés séparément pour des campagnes spécifiques

## 🐛 Résolution de Problèmes

### Le code ne s'affiche pas pour le partenaire
- Vérifier que `currentUser.partnerReferralCode` existe
- Vérifier que `is_partner = true` dans la base de données
- Re-exécuter la requête de génération automatique des codes

### Les commissions ne se créent pas
- Vérifier que le trigger `trigger_create_partner_commission` existe
- Vérifier que le produit a bien `partner_user_id` ET `partner_code_used`
- Vérifier que le statut passe de 'pending' à 'approved'

### Erreur "relation profiles does not exist"
- Ce script utilise la table `users`, pas `profiles`
- Cette erreur ne devrait plus apparaître avec ce nouveau script

## ✨ Améliorations Incluses

1. **Script Ultra-Robuste**
   - Gère tous les cas d'erreur possibles
   - Vérifie l'existence des colonnes avant de les créer
   - Supprime proprement les anciennes versions
   - Pas de conflit de noms de fonctions

2. **Interface Intuitive**
   - Code de parrainage bien visible (fond orange)
   - Statistiques claires
   - Navigation fluide

3. **Automatisation Complète**
   - Génération automatique des codes
   - Création automatique des commissions
   - Mise à jour automatique des statistiques

---

**Tout devrait fonctionner parfaitement maintenant ! 🎉**
