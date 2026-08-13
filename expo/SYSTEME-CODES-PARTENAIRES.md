# Système de Codes Partenaires - Guide Complet

## 📋 Vue d'ensemble

Le système de codes partenaires permet aux partenaires de partager des codes de réduction avec leur communauté et de gagner des commissions sur les ventes générées.

## 🚀 Installation

### 1. Exécuter le fichier SQL

Connectez-vous à votre base de données Supabase et exécutez le fichier :
```
supabase-partner-code-system.sql
```

Ce fichier va :
- Ajouter la colonne `partner_code` à la table `users`
- Créer une fonction pour générer des codes uniques automatiquement
- Créer des triggers pour auto-générer les codes lors de la promotion en partenaire
- Ajouter les colonnes `partner_id` et `partner_code_used` à la table `products`
- Créer des fonctions SQL pour les statistiques et la validation

### 2. Générer des codes pour les partenaires existants

Le script génère automatiquement des codes pour tous les partenaires existants qui n'en ont pas encore.

## 💡 Fonctionnalités

### Pour les Partenaires

#### 1. Voir son code partenaire
- Accédez au tableau de bord partenaire (`/partner-dashboard`)
- Le code personnel s'affiche dans une carte mise en évidence
- Bouton pour copier le code facilement

#### 2. Statistiques en temps réel
- Nombre de vendeurs référés
- Ventes totales générées
- Commission gagnée
- Codes actifs

#### 3. Codes promo supplémentaires
- En plus du code personnel, l'admin peut créer des codes promo supplémentaires
- Chaque code peut avoir une description personnalisée
- Statistiques d'utilisation pour chaque code

### Pour les Vendeurs

#### 1. Utiliser un code lors de la publication
- Lors de la publication d'une annonce, entrez le code partenaire dans le champ "Code Promo"
- Le code peut être soit :
  - Un code partenaire personnel (ex: `PART12AB34CD`)
  - Un code promo créé par l'admin (ex: `PROMO2024`)
- La réduction est automatiquement appliquée

#### 2. Réduction automatique
- Le système valide le code et applique la réduction
- Les frais de commission passent de 15% à 10% (par défaut)
- Message de confirmation avec le montant économisé

### Pour le Super Admin

#### 1. Gestion des partenaires
Accédez à `/admin/partners` puis sélectionnez un partenaire pour :
- Voir les statistiques détaillées
- Modifier le code de parrainage du partenaire
- Créer des codes promo supplémentaires
- Désactiver/Activer le partenaire
- Voir les vendeurs référés

#### 2. Modifier le code partenaire
- Cliquez sur l'icône d'édition ✏️ à côté du code de parrainage
- Entrez le nouveau code (il sera converti en majuscules)
- Attention : L'ancien code ne fonctionnera plus après modification

#### 3. Créer des codes promo
- Bouton "Créer un code" dans la section codes de réduction
- Entrez le code et une description optionnelle
- Le code est automatiquement lié au partenaire

## 🔧 Configuration

### Paramètres globaux

Les paramètres suivants peuvent être modifiés dans `global_settings` :
- `commission_rate` : Taux de commission de base (défaut: 15%)
- `discount_reduction` : Réduction apportée par un code (défaut: 5%)
- `partner_commission_rate` : Commission du partenaire sur les ventes (défaut: 5%)

### Formules de calcul

#### Pour un vendeur standard utilisant un code partenaire :
```
Commission vendeur = Prix × (commission_rate - discount_reduction)%
Exemple : 100000 FCFA × (15% - 5%) = 10000 FCFA au lieu de 15000 FCFA
```

#### Pour le partenaire :
```
Commission partenaire = Commission vendeur × partner_commission_rate%
Exemple : 10000 FCFA × 5% = 500 FCFA
```

## 📊 Schéma de base de données

### Table `users`
```sql
- partner_code VARCHAR(50) UNIQUE -- Code de parrainage du partenaire
- is_partner BOOLEAN -- Statut partenaire
```

### Table `products`
```sql
- partner_id TEXT -- ID du partenaire si un code a été utilisé
- partner_code_used VARCHAR(50) -- Code utilisé lors de la publication
- discount_code_applied BOOLEAN -- Code appliqué ou non
```

### Table `discount_codes`
```sql
- partner_user_id TEXT -- ID du partenaire propriétaire du code
- code VARCHAR(50) UNIQUE
- discount_percent NUMERIC
- times_used INTEGER
- is_active BOOLEAN
```

## 🔔 Notifications

Le système envoie automatiquement une notification au partenaire lorsque son code est utilisé :
- Type : `partner_code_used`
- Contenu : Nom du vendeur, produit publié, commission potentielle

## 📱 Pages et Composants

### Pages principales
- `/partner-dashboard` - Tableau de bord partenaire
- `/admin/partners` - Liste des partenaires (super admin uniquement)
- `/admin/partners/[id]` - Détails d'un partenaire (super admin uniquement)

### Contextes
- `PartnersContext` - Gestion des partenaires et codes
- `MarketplaceContext` - Validation des codes lors de la publication

## 🎯 Workflow complet

1. **Admin désigne un partenaire** → Un code unique est généré automatiquement
2. **Partenaire voit son code** → Peut le partager avec sa communauté
3. **Vendeur utilise le code** → Lors de la publication d'annonce
4. **Système valide le code** → Applique la réduction automatiquement
5. **Partenaire est notifié** → Voit les statistiques en temps réel
6. **Admin valide le paiement** → Le partenaire reçoit sa commission

## ⚠️ Points d'attention

1. **Modification de code** : L'ancien code ne fonctionnera plus après modification
2. **Unicité** : Chaque code doit être unique dans toute la base de données
3. **Format** : Les codes sont automatiquement convertis en majuscules
4. **Validation** : Le système vérifie si l'utilisateur est bien partenaire actif

## 🐛 Debug

### Vérifier si un code existe
```sql
SELECT * FROM users WHERE partner_code = 'VOTRE_CODE' AND is_partner = true;
```

### Voir les utilisations d'un code
```sql
SELECT * FROM products WHERE partner_code_used = 'VOTRE_CODE';
```

### Statistiques d'un partenaire
```sql
SELECT * FROM get_partner_stats('user_id_ici');
```

## 📞 Support

En cas de problème :
1. Vérifiez que le fichier SQL a été correctement exécuté
2. Assurez-vous que l'utilisateur est bien désigné comme partenaire
3. Vérifiez les logs de la console pour les erreurs
