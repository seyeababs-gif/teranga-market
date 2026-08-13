# Guide de Redéploiement Netlify

Si vous avez connecté Netlify à un dépôt Git (GitHub, GitLab, Bitbucket), le redéploiement est **automatique** à chaque fois que vous faites un `push` sur la branche principale.

## Si vous n'utilisez pas Git (Drag & Drop)

Si vous avez déployé manuellement en glissant le dossier `dist`, le redéploiement n'est **pas automatique**. Vous devez refaire la procédure suivante à chaque modification :

1. **Reconstruire le projet :**
   Ouvrez votre terminal et lancez la commande suivante :
   ```bash
   npx expo export -p web
   ```
   Cette commande va mettre à jour le dossier `dist` avec vos dernières modifications.

2. **Redéployer sur Netlify :**
   - Allez sur votre tableau de bord Netlify.
   - Sélectionnez votre site.
   - Allez dans l'onglet **"Deploys"**.
   - Glissez-déposez le dossier `dist` (qui se trouve à la racine de votre projet) dans la zone de drop en bas de la page (ou "Trigger deploy" > "Deploy manually").

## Résolution des problèmes courants

### Le site ne se met pas à jour (Mise en cache)
Parfois, le navigateur garde en cache l'ancienne version.
- Essayez d'ouvrir le site en navigation privée.
- Ou forcez le rechargement (Ctrl+Shift+R ou Cmd+Shift+R).

### Erreurs après déploiement
Si vous voyez des erreurs sur le site en ligne qui ne sont pas en local :
- Vérifiez la console du navigateur (F12 > Console).
- Assurez-vous que toutes les variables d'environnement (Supabase URL, Keys) sont bien configurées dans Netlify (Site settings > Environment variables).
