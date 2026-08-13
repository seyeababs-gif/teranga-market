# Deploiement Teranga Market sur Hostinger

## Etape 1 — Build web en local

Sur ta machine, dans le dossier `expo/` :

```bash
# 1. Installer les dependances
bun install

# 2. Creer le build web statique
npx expo export -p web
```

Cela genere un dossier `dist/` avec tous les fichiers statiques (HTML, CSS, JS, images).

## Etape 2 — Recuperer les fichiers

Le dossier `dist/` contient :
- `index.html`
- `_expo/` (JS bundles, CSS)
- `assets/` (images, icones)
- `.htaccess` (routing SPA + compression + cache)

## Etape 3 — Deployer sur Hostinger

### Option A : Via le Gestionnaire de Fichiers (le plus simple)

1. Connecte-toi a **hPanel Hostinger**
2. Va dans **Fichiers > Gestionnaire de fichiers**
3. Ouvre le dossier `public_html/` (ou le sous-domaine souhaite)
4. **Supprime** le fichier `default.php` s'il existe
5. **Upload** tout le contenu du dossier `dist/` dans `public_html/`
   - IMPORTANT : upload le **contenu** de `dist/`, pas le dossier `dist/` lui-meme
   - Le fichier `.htaccess` doit etre a la racine de `public_html/`
6. C'est en ligne !

### Option B : Via FTP (FileZilla)

1. Recupere tes identifiants FTP dans **hPanel > Fichiers > Comptes FTP**
2. Connecte-toi avec FileZilla :
   - Hote : `ftp.tondomaine.com`
   - Utilisateur : ton identifiant FTP
   - Mot de passe : ton mot de passe FTP
   - Port : 21
3. Va dans `public_html/`
4. Glisse tout le contenu de `dist/` dans `public_html/`
5. Assure-toi que `.htaccess` est bien transfere (FileZilla > Serveur > Forcer l'affichage des fichiers caches)

### Option C : Via Git (si tu as un VPS Hostinger)

1. SSH sur ton VPS : `ssh root@ton-ip-hostinger`
2. `cd /var/www/html` (ou ton dossier web)
3. `git clone https://github.com/seyeababs-gif/ton-repo.git`
4. `cd ton-repo/expo`
5. `bun install && npx expo export -p web`
6. Copie le contenu de `dist/` dans ton dossier web

## Etape 4 — Variables d'environnement

Les variables suivantes sont **integrees au build** (inbriquées dans le JS) :
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_RORK_AUTH_URL`
- `EXPO_PUBLIC_RORK_APP_KEY`
- `EXPO_PUBLIC_PROJECT_ID`

Elles sont deja configurees dans le fichier `.env` et seront incluses automatiquement dans le build.

**Pour changer ces valeurs** : modifie `expo/.env` avant de lancer `npx expo export -p web`.

## Etape 5 — Domaine

1. Dans **hPanel > Domaines**, assure-toi que ton domaine pointe vers `public_html/`
2. Si tu utilises un sous-domaine (ex: `market.tondomaine.com`), cree-le dans **hPanel > Sous-domaines** et deploye dans son dossier

## Etape 6 — HTTPS (SSL)

1. Va dans **hPanel > Securite > SSL**
2. Active **SSL gratuit (Let's Encrypt)** pour ton domaine
3. Active **Forcer HTTPS** pour rediriger tout le trafic HTTP vers HTTPS

## Verifications apres deploiement

- [ ] La page d'accueil s'affiche : `https://tondomaine.com`
- [ ] La navigation fonctionne (refresh sur une page produit ne donne pas 404)
- [ ] L'inscription fonctionne (champ telephone WhatsApp obligatoire)
- [ ] L'ajout d'annonce fonctionne (10 photos max)
- [ ] Le bouton "Contacter" ouvre WhatsApp
- [ ] Le partage d'un produit donne une URL valide
- [ ] Les prix s'affichent en EUR

## Deploiement depuis GitHub avec Hostinger Git

1. Dans **hPanel > Avance > Git**
2. Clique sur **Ajouter un clone Git**
3. URL du depot : `https://github.com/seyeababs-gif/ton-repo.git`
4. Branche : `main`
5. Dossier de deploiement : `public_html`
6. **IMPORTANT** : apres le clone, tu dois quand meme faire le build :
   - SSH sur ton serveur
   - `cd public_html/expo && bun install && npx expo export -p web`
   - Deplace le contenu de `dist/` vers `public_html/`

## Notes importantes

- L'app est 100% statique cote front-end (pas de serveur Node.js necessaire)
- Toutes les donnees transitent via Supabase (deja heberge)
- L'authentification utilise Rork Auth (deja heberge)
- Le `.htaccess` gere : routing SPA, compression GZIP, cache navigateur, securite
- Aucun paiement a prevoir — c'est un site statique sur un hebergement mutualise
