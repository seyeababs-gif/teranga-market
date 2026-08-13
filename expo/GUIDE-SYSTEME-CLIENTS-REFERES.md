# 🎯 Guide du Système de Clients Référés pour Partenaires

## 📋 Vue d'ensemble

Le système de suivi des clients référés permet aux partenaires de voir en temps réel :
- **Qui utilise leur code** de parrainage lors de la publication
- **Les produits publiés** par chaque client
- **Les réductions accordées** à chaque client
- **Les commissions générées** par chaque produit approuvé

---

## 🗄️ Structure de la base de données

### Table `partner_code_usages`

Cette table enregistre chaque utilisation d'un code partenaire :

```sql
partner_code_usages
├── id (TEXT)
├── partner_user_id (TEXT) → Référence au partenaire
├── product_id (TEXT) → Produit publié avec le code
├── seller_id (TEXT) → Client qui a utilisé le code
├── seller_name (TEXT)
├── seller_phone (TEXT)
├── seller_avatar (TEXT)
├── product_title (TEXT)
├── product_price (DECIMAL)
├── discount_applied (DECIMAL) → Montant de la réduction accordée
├── code_used (TEXT) → Code partenaire utilisé
└── created_at (TIMESTAMP)
```

---

## 🔧 Fonctions SQL créées

### 1. `get_partner_referred_clients(partner_user_id TEXT)`

Retourne la liste des clients qui ont utilisé le code du partenaire avec :
- Informations du client (nom, téléphone, avatar)
- Nombre total de produits publiés
- Montant total dépensé
- Réduction totale reçue
- Dates de première et dernière utilisation
- Liste des produits (en JSON)

### 2. `get_partner_client_details(partner_user_id TEXT, client_seller_id TEXT)`

Retourne les détails d'un client spécifique :
- Liste complète de ses produits
- Statut de chaque produit
- Commissions associées
- Dates de publication

### 3. `get_partner_stats(partner_user_id TEXT)` - Mise à jour

Maintenant inclut :
- `total_clients` : Nombre de clients uniques ayant utilisé le code
- `total_discount_given` : Montant total des réductions accordées

---

## 🎨 Interface Dashboard Partenaire

### Section "Clients qui utilisent mon code"

Chaque carte client affiche :

#### En-tête
- **Avatar** du client
- **Nom complet**
- **Numéro de téléphone**

#### Statistiques
- **Produits publiés** : Nombre total de produits avec le code
- **Réduction obtenue** : Somme totale des réductions

#### Historique
- **Première utilisation** : Date du premier produit publié
- **Derniers produits** : Les 2 derniers produits publiés avec :
  - Titre du produit
  - Prix du produit
- **Indicateur** : Si plus de 2 produits, affiche "+X autre(s) produit(s)"

---

## 🔄 Flux de fonctionnement

### 1. Publication d'un produit avec code partenaire

```
Vendeur publie un produit
    ↓
Entre le code partenaire (ex: PARTNER123)
    ↓
Le code est vérifié et appliqué
    ↓
TRIGGER: track_partner_code_usage()
    ↓
Enregistrement dans partner_code_usages
    ↓
Incrémentation du compteur times_used du code
```

### 2. Approbation du produit

```
Admin approuve le produit
    ↓
TRIGGER: create_partner_commission()
    ↓
Création d'une commission dans partner_commissions
    ↓
Visible dans le dashboard du partenaire
```

### 3. Affichage dans le dashboard

```
Partenaire ouvre son dashboard
    ↓
Chargement des données via getReferredClients()
    ↓
Affichage des clients groupés par seller_id
    ↓
Statistiques et historique pour chaque client
```

---

## 📊 Statistiques en temps réel

Le dashboard affiche en haut :

1. **Clients référés** : Nombre de clients uniques utilisant le code
2. **Produits publiés** : Nombre total de produits avec le code
3. **Commission totale** : Somme de toutes les commissions

---

## 🚀 Migration des données

Le script SQL migre automatiquement :
- Les **produits existants** avec un code partenaire
- Vers la table `partner_code_usages`
- Calcul automatique des réductions appliquées

---

## 🔐 Sécurité (RLS)

Les politiques de sécurité garantissent que :
- Chaque partenaire voit **uniquement ses propres clients**
- Les admins voient **tous les clients référés**
- Les triggers fonctionnent en `SECURITY DEFINER`

---

## 💡 Exemple d'utilisation

### Scénario complet

1. **Partenaire "Alice"** partage son code `ALICE2024`
2. **Client "Bob"** publie 3 produits avec `ALICE2024`
   - Produit 1 : 10,000 FCFA (réduction 5% = 500 FCFA)
   - Produit 2 : 15,000 FCFA (réduction 5% = 750 FCFA)
   - Produit 3 : 20,000 FCFA (réduction 5% = 1,000 FCFA)

3. **Dashboard d'Alice affiche** :
   ```
   📊 Clients référés: 1
   📦 Produits publiés: 3
   💰 Commission totale: 4,500 FCFA (10% de 45,000)
   
   👤 Client: Bob (771234567)
      • Produits publiés: 3
      • Réduction obtenue: 2,250 FCFA
      • Première utilisation: 15 déc 2024
      
      Derniers produits:
      • Produit C - 20,000 FCFA
      • Produit B - 15,000 FCFA
      +1 autre(s) produit(s)
   ```

4. **Lorsque les produits sont approuvés** :
   - Alice voit 3 commissions dans "Mes commissions"
   - Total commission: 4,500 FCFA (en attente)
   - Après paiement: statut passe à "Payée"

---

## 📝 Installation

Pour appliquer le système :

```bash
# Exécuter dans Supabase SQL Editor
1. supabase-partner-system-final-clean.sql
2. supabase-partner-referrals-tracking.sql
```

---

## ✅ Vérification

Après installation, vérifier :

```sql
-- Nombre d'utilisations trackées
SELECT COUNT(*) FROM partner_code_usages;

-- Clients d'un partenaire spécifique
SELECT * FROM get_partner_referred_clients('partner_user_id');

-- Stats d'un partenaire
SELECT * FROM get_partner_stats('partner_user_id');
```

---

## 🎯 Résumé

Le système permet maintenant aux partenaires de :
✅ Voir la liste de tous leurs clients référés
✅ Connaître le nombre de produits publiés par client
✅ Voir les réductions totales accordées à chaque client
✅ Suivre l'historique des produits de chaque client
✅ Voir les commissions générées par chaque produit approuvé
✅ Suivre le statut des commissions (en attente / payée)

Le tout en temps réel et avec une interface intuitive ! 🚀
