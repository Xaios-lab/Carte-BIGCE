# Pipe Mana · BIG CE

Jeu de tuyaux 3D façon *Pipe Mania*, ambiance lagon tropical « bleu plomberie », mobile first,
sans dépendance serveur : un simple dossier statique (ouvrir `pipe/` sur GitHub Pages ou n'importe quel
hébergement). Le seul fichier tiers est `vendor/three.module.min.js` (Three.js r160, licence MIT).

Même mécanique « BIG CE » que Pac‑Mana : Manas des partenaires, bonus Carte BIG CE, record, 3 vies,
bouton « Participer au tirage » (10 000 F de chèques cadeaux) et lien vers les partenaires sponsors.

## Tester sans serveur ni GitHub
`node build-standalone.mjs` génère `pipemana-standalone.html`, une version tout-en-un (Three.js, logos,
carte embarqués) qui s'ouvre d'un double-clic dans Chrome / Safari / Firefox (Node ≥ 18, aucune dépendance).

## Règles du jeu
* Une **file de 5 tuyaux** est affichée à gauche ; on pose toujours le premier en touchant une case libre.
  On peut recouvrir un tuyau encore sec (−50 points). Les tuyaux déjà remplis d'eau, les rochers,
  les cocotiers et les Manas ne bougent plus.
* Au bout du **compte à rebours**, l'eau jaillit du robinet et avance tuyau après tuyau.
  Si elle sort dans le vide : **fuite**, une vie en moins. Les tuyaux posés restent, seule l'eau est vidée.
* Le **réservoir** (logo Plomberie de Faa'a) reste fermé tant que le **quota** de tuyaux n'est pas atteint
  (barre en bas de l'écran). Y arriver trop tôt compte comme une fuite. Y arriver ouvert = niveau terminé.
* **Manas** : vannes dorées déjà posées, avec le logo d'un partenaire. L'eau qui les traverse rapporte
  300 points et **ralentit de moitié** pendant 8 s (effet « retournement » du logo, comme dans Pac‑Mana).
  Traverser tous les Manas du niveau : +1000 à la fin.
* **Carte BIG CE** : une croix dorée arrive dans la file après quelques pièces posées. L'eau qui la traverse
  rapporte 500 points et **gèle l'eau 5 s**.
* **Accélérer** (bouton en bas à droite, ou touche F / Maj) : l'eau va 5× plus vite et chaque tuyau
  rapporte 200 points au lieu de 100. Croix traversée deux fois : +200. Vie bonus tous les 6 000 points.
* 3 niveaux (grille, quota et vitesse croissants). Le score et les vies se conservent d'un niveau à l'autre.

## Jouer
* **Mobile** : toucher une case pour y poser le prochain tuyau ; maintenir « Accélérer » pour presser l'eau.
* **PC / Mac** : clic, ou flèches / ZQSD + `Espace` pour poser. `F` ou `Maj` : accélérer. `P` / `Échap` : pause.
* `?q=low` dans l'URL force la qualité réduite (vieux mobiles) ; `?q=high` force la qualité maximale
  dans une WebView. La qualité baisse aussi automatiquement si le jeu rame.

## Intégration dans une application (WebView / iframe)
Le jeu détecte une WebView ou une page intégrée et passe en profil allégé (résolution 1×, ombres coupées,
décor réduit). Dans une WebView, le tirage au sort et la page des sponsors s'ouvrent en lien direct
(le navigateur de l'app) au lieu de la lightbox.

## Partenaires et logos
Tout est dans `js/levels.js` :
* `PARTNERS` : un partenaire = nom, logo (PNG 512×512 rond dans `assets/logos/`), couleur.
  **Plomberie de Faa'a** n'a pas encore de fichier logo : `logo: null` déclenche une pastille dessinée
  automatiquement (goutte + clé). Remplacer par `logo: 'assets/logos/plomberie.png'` dès réception.
* `MAIN_PARTNER` : partenaire dont le logo orne le réservoir d'arrivée.
* chaque niveau liste ses Manas (`mana`) dans l'ordre de lecture de la grille.

Liens à créer côté BIG CE : `DRAW_URL` (formulaire du tirage) et `SPONSORS_URL` dans `js/game.js`
pointent pour l'instant sur `formulaire.big-ce.com/pipemana` et sur la page sponsors de Pac‑Mana.

## Ajouter un niveau ou un thème
Dans `js/levels.js`, dupliquer un objet de `LEVELS`, dessiner la grille en ASCII (légende dans le fichier :
`.` libre, `#` rocher, `T` cocotier, `^v<>` robinet et son sens, `R` réservoir, `o` Mana), régler
`quota`, `countdown`, `secPerCell`, `cardAt`. Un thème = couleurs du lagon, du sable, des tuyaux (`THEMES`).

## Structure
```
pipe/
  index.html          page + HUD + écrans + lightbox
  css/style.css       interface, file des tuyaux, barre d'état, effet « retournement Mana »
  js/levels.js        niveaux, thèmes, partenaires        ← à éditer pour logos / niveaux
  js/pieces.js        les 7 tuyaux, raccords, file aléatoire
  js/board.js         grille logique + progression de l'eau (sans 3D, testable)
  js/world.js         scène 3D : îlot, lagon, tuyaux translucides, robinet, réservoir, Manas, particules
  js/camera.js        cadrage automatique du plateau (hors zones du HUD)
  js/input.js         tap / survol / clavier
  js/audio.js         sons synthétisés (WebAudio)
  js/ui.js            HUD, file des pièces, écrans, popups
  js/game.js          règles, états, score, bonus, niveaux
  js/textures.js      textures procédurales (sable, mer, fleurs, logo de secours)
  assets/             logo BIG CE, carte 2026, pastilles partenaires
  build-standalone.mjs  → pipemana-standalone.html
```
