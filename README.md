# Knighter Tiers List

Application web autonome permettant d’importer des images, de les classer dans une tier list et d’exporter le résultat en PNG.

Le projet fonctionne entièrement dans le navigateur, sans framework, sans base de données et sans envoi d’images vers un serveur.

## Lancer le projet

Prérequis : Python 3 et npm.

```bash
cd tier-list-maker
npm run dev
```

Ouvrir ensuite [http://localhost:4173](http://localhost:4173).

## Utilisation

1. Cliquez dans la bibliothèque ou déposez-y des fichiers.
2. Choisissez le format des vignettes : carré, portrait ou paysage.
3. Faites glisser les images dans les catégories de la tier list.
4. Pour déplacer une image sans glisser, cliquez dessus puis cliquez sur la catégorie souhaitée.
5. Modifiez le titre ou les noms des catégories directement dans l’interface.
6. Cliquez sur **Télécharger en PNG** en bas de la page pour exporter le classement.

## Fonctionnalités

- Import multiple de fichiers JPG, PNG et WEBP
- Import par clic, glisser-déposer ou collage depuis le presse-papiers
- Bibliothèque avec état vide automatique
- Formats carré `1:1`, portrait `4:5` et paysage `16:9`
- Glisser-déposer optimisé pour la souris, le trackpad et le tactile
- Sélection alternative au clic
- Titre et catégories modifiables
- Retour automatique sur plusieurs lignes
- Redimensionnement des vignettes pour conserver une hauteur fixe par catégorie
- Suppression individuelle des images
- Interface responsive
- Export PNG local en haute résolution

## Export PNG

Le fichier exporté mesure `1600 px` de large et contient :

- Le titre de la tier list
- Les cinq catégories et leurs couleurs
- Toutes les images classées
- Le ratio actuellement sélectionné
- La mention de confidentialité Knighter Tiers List

Les images encore présentes dans la bibliothèque ne sont pas incluses dans l’export.

## Design system

- Typographie : SF Pro Display et SF Pro Text
- Fond principal : `#191919`
- Accent interactif : `#5d71fc`
- Palette des catégories issue du projet de positionnement
- Contours bleus au survol et à la sélection

## Structure

```text
tier-list-maker/
├── index.html     # Structure de l’interface
├── styles.css     # Design system et responsive
├── app.js         # Import, classement, interactions et export PNG
├── package.json   # Commandes de lancement
└── README.md      # Documentation
```

## Confidentialité

Les fichiers importés sont lus avec les API locales du navigateur. Ils ne quittent pas l’appareil et ne sont transmis à aucun service externe.

Le rechargement de la page réinitialise la tier list actuelle.
