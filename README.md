# Cube Malin

Un outil en 3D pour apprendre aux enfants de 5 à 10 ans à résoudre le Rubik's Cube,
avec la méthode « couche par couche » pour débutants.

## Lancer

Ouvrir `index.html` via un petit serveur local (les fichiers JS sont chargés à part) :

```bash
node serve.js
```

puis aller sur http://localhost:5180 (autre port : `$env:PORT=8080; node serve.js` dans PowerShell).

On peut aussi simplement double-cliquer sur `index.html`. Il faut une connexion internet
pour la 3D (Three.js) et les polices.

## Sans internet

- **Téléphone / tablette** : sur le site, le bouton **Télécharger** garde l'appli et les
  90 voix sur l'appareil (environ 13 Mo) et explique comment ajouter l'icône sur l'écran
  d'accueil. Ensuite tout marche hors connexion (PWA : `manifest.webmanifest` + `sw.js`).
- **Ordinateur** : télécharger le dépôt en .zip, le dézipper, double-cliquer sur `index.html`.

Tout est dans le projet (moteur 3D dans `js/vendor/`, polices dans `fonts/`), rien n'est
chargé depuis internet. Quand la liste des fichiers de l'appli change, mettre à jour
`CORE_FILES` dans `sw.js` et passer `CORE` à la version suivante (`v2`, `v3`…).
Les icônes se régénèrent avec `tools/make-icons.ps1`.

## Ce qu'il y a dedans

- **10 niveaux** : découvrir le cube, les gestes, puis les 8 étapes de la méthode
  (marguerite, croix blanche, coins blancs, 2e couronne, croix jaune, arêtes jaunes,
  coins jaunes, dernier secret).
- **Plusieurs cas par niveau** (« ce que tu vois sur ton cube ») : chaque démo part
  d'une position réaliste.
- **Une flèche sur le cube** avant chaque geste, et un nom simple
  (« Droite monte », « Haut à gauche »…) plutôt que la notation R, U'.
- **Pièces grisées** : seules les pièces utiles à l'étape gardent leurs couleurs ;
  la pièce à suivre brille.
- **Voix** : les explications peuvent être lues à voix haute (pour les plus petits qui
  ne lisent pas encore).
- **Mode libre** : tourner le cube, mélanger, annuler, rembobiner.
- Les étoiles des niveaux réussis sont gardées dans le navigateur.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `js/cube.js` | Modèle logique du cube (sans dépendance, marche aussi dans Node) |
| `js/lessons.js` | Le parcours : textes, cas, recettes |
| `js/view3d.js` | Rendu 3D (Three.js r128), animations, flèches |
| `js/app.js` | Interface, lecteur de démo, voix, mode libre |
| `tests/verify-lessons.js` | Vérifie par simulation que chaque démo est correcte |

## La voix

Les explications sont enregistrées avec la voix HeyGen « voix calme » (`audio/voix/*.mp3`).
Une phrase sans enregistrement est lue par la voix du navigateur, en secours.

Après avoir modifié ou ajouté un texte dans `js/lessons.js`, enregistre les nouvelles phrases
(seules les phrases manquantes sont générées, les anciennes sont supprimées) :

```bash
node tools/generate-voice.mjs
```

Il faut être connecté à HeyGen (`npx hyperframes auth login`) ou définir `HEYGEN_API_KEY`.
`--dry` montre ce qui serait généré sans rien dépenser, `--force` régénère tout.
Autre voix : `VOICE_ID=<id> node tools/generate-voice.mjs --force`.

## Ajouter ou modifier une démo

Dans `js/lessons.js`, un cas décrit **l'état visé après la démo** (`base`, en gestes depuis
un cube résolu) et la recette découpée en morceaux (`segments`). L'état de départ est
calculé tout seul (base + recette à l'envers). Après une modification :

```bash
node tests/verify-lessons.js
```

Le test contrôle que chaque démo part d'une position valide pour l'étape et arrive au bon résultat.
