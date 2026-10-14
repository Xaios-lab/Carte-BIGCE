# Pac‑Mana · BIG CE

Pac‑Man 3D « jungle polynésienne », mobile first, sans dépendance serveur : un simple dossier statique
(ouvrir `pacman/` sur GitHub Pages ou n'importe quel hébergement). Le seul fichier tiers est
`vendor/three.module.min.js` (Three.js r160, licence MIT).

## Tester sans serveur ni GitHub
`pacman-standalone.html` est une version tout-en-un (Three.js, logos, carte, musique embarqués) :
un double-clic l'ouvre directement dans Chrome / Safari / Firefox. Pour la régénérer après une
modification du code : `node build-standalone.mjs` (Node ≥ 18, aucune dépendance).

## Intégration dans une application (WebView / iframe)
Le jeu détecte une WebView ou une page intégrée et passe automatiquement en profil allégé
(résolution 1,25×, ombres coupées, décor réduit) ; `?q=high` force la qualité maximale.
Pour une réactivité optimale :
* ouvrir le jeu en plein écran dans la WebView plutôt que dans une `<iframe>` ; si une iframe est
  indispensable, lui donner `allow="autoplay"` et mettre `touch-action: none; overflow: hidden` sur la page hôte ;
* activer l'accélération matérielle de la WebView (Android : `setLayerType(LAYER_TYPE_HARDWARE)`, `hardwareAccelerated="true"`) ;
* ne pas superposer de couche HTML transparente au-dessus du jeu (elle intercepte les gestes).

## Jouer
* **Mobile** : glisser le doigt n'importe où sur l'écran (joystick flottant). On peut enchaîner les virages sans relever le doigt.
* **PC / Mac** : flèches, ZQSD ou WASD. `P` / `Échap` : pause. `Entrée` / `Espace` : valider.
* **Manas** : les 4 logos partenaires aux coins du labyrinthe rendent Pac‑Man invincible et les esprits tiki comestibles.
* Bonus « Carte BIG CE » : apparaît sous la maison des esprits après 60 puis 150 pointillés mangés.
* `?q=low` dans l'URL force la qualité réduite (vieux mobiles). La qualité baisse aussi automatiquement si le jeu rame.

## Ajouter un niveau ou un thème (Halloween, Noël, Jeux du Pacifique…)
Tout est dans `js/levels.js` :

1. **Thème** : dupliquer `THEMES.jungle`, changer les couleurs (murs, sol, lueur, flèches, torches…).
2. **Partenaires / Manas** : ajouter une entrée dans `PARTNERS` (nom, logo PNG 512×512 rond, couleur).
3. **Niveau** : dupliquer l'objet dans `LEVELS`, dessiner le labyrinthe en ASCII (légende dans le fichier),
   choisir les 4 Manas dans `mana`, régler vitesses / durées.

Les murs sont extrudés automatiquement depuis l'ASCII (contours lissés + ruban lumineux), les
pointillés sont posés sur chaque `.`, les Manas sur chaque `o`.

## Structure
```
pacman/
  index.html          page + HUD + écrans
  css/style.css       interface, effet « retournement Mana », joystick
  js/levels.js        niveaux, thèmes, partenaires        ← à éditer pour de nouveaux niveaux
  js/maze.js          grille, contours de murs
  js/world.js         scène 3D : sol, murs, flèches, Manas, décor jungle
  js/actors.js        Pac‑Man et esprits tiki (déplacement, IA)
  js/game.js          règles, états, score, effets
  js/camera.js        cadrage auto (tout le labyrinthe) ou suivi (mobile)
  js/input.js         clavier + joystick flottant
  js/audio.js         sons synthétisés (WebAudio)
  js/textures.js      textures procédurales (pierre, feuilles, flammes…)
  assets/logos/       pastilles partenaires
  assets/bigce.png    logo BIG CE (écran titre)
  assets/carte-2026.webp  carte BIG CE (bonus en jeu)
  assets/audio/       musique « Poursuite dans la forêt » (AAC)
  assets/splash.webp  illustration de l'écran titre
```
