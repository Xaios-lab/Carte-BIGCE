# Pipe Mana · BIG CE

Puzzle de tuyaux 3D plein écran dans une vallée tahitienne, mobile first, sans dépendance serveur :
un simple dossier statique (ouvrir `pipe/` sur GitHub Pages ou n'importe quel hébergement).
Fichiers tiers : `vendor/three.module.min.js` (Three.js r160, MIT) et `vendor/gsap.min.js` (GSAP 3.12, licence standard gratuite).

Même mécanique « BIG CE » que Pac‑Mana : enseignes des partenaires, bonus Carte BIG CE, record, 3 vies,
bouton « Participer au tirage » (10 000 F de chèques cadeaux) et lien vers les partenaires sponsors.

## Tester sans serveur ni GitHub
`node build-standalone.mjs` génère `pipemana-standalone.html`, une version tout-en-un (Three.js, GSAP, logos,
carte embarqués) qui s'ouvre d'un double-clic dans Chrome / Safari / Firefox (Node ≥ 18, aucune dépendance).

## Règles du jeu
* Le **château d'eau** est en haut au centre, les **4 enseignes** (La Plomberie de Faa'a, Polyplast, PlastiBois, BIG CE)
  de part et d'autre. Les tuyaux sont déjà posés mais **mal orientés** : toucher un tuyau le fait pivoter d'un quart de tour.
* Au bout du **compte à rebours** (ou dès qu'on appuie sur **Lancer l'eau**, bonus de 40 points par seconde restante),
  l'eau jaillit et se **ramifie** dans tous les tuyaux raccordés. Les tuyaux mouillés ne pivotent plus, les secs si.
* L'eau qui sort dans le vide = **fuite** : une vie en moins, l'eau est vidée, les tuyaux gardent leur orientation,
  nouveau compte à rebours plus court. Les **4 enseignes alimentées** = niveau terminé.
* Chaque enseigne alimentée : +300 et le grand « retournement » de son logo (comme les Manas de Pac‑Mana).
  Tuyau rempli : +100. **Carte BIG CE** (tuyau doré) : +500 et l'eau fait une pause de 4 s. Niveau : +1000.
  Vie bonus tous les 6 000 points. 3 niveaux de plus en plus ramifiés ; score et vies se conservent.

## Jouer
* **Mobile** : toucher un tuyau pour le faire pivoter ; bouton « Lancer l'eau » pour ne pas attendre.
* **PC / Mac** : clic sur un tuyau ; flèches pour déplacer le curseur et `Entrée` pour pivoter ; `Espace` ou `F` : lancer l'eau ; `P` / `Échap` : pause.
* `?q=low` dans l'URL force la qualité réduite (vieux mobiles) ; `?q=high` force la qualité maximale dans une WebView.
  La qualité baisse aussi automatiquement si le jeu rame.

## Motion design
`js/motion.js` porte la charte de mouvement, reprise de la grammaire HyperFrames : arrivées sur une longue traîne
(`expo.out`), sorties courtes qui accélèrent (`power3.in`), ressorts nommés par amortissement (`back.out(1.4)` ≈ 0,75),
chevauchements et cascades de 40–80 ms, titres qui entrent mot par mot en flou. La caméra plonge depuis le ciel
à l'entrée du niveau, donne un coup de zoom à chaque enseigne alimentée, tremble à la fuite et orbite lentement (3°/s)
sur les écrans. Le film d'intro HyperFrames est dans `film/` (voir son README).

## Intégration dans une application (WebView / iframe)
Le jeu détecte une WebView ou une page intégrée et passe en profil allégé (résolution 1×, ombres coupées, décor réduit).
Dans une WebView, le tirage au sort et la page des sponsors s'ouvrent en lien direct (le navigateur de l'app).

## Partenaires et logos
Tout est dans `js/levels.js` :
* `PARTNERS` : un partenaire = nom, nom court, logo (`assets/enseignes/`), couleur, format (`ratio` largeur / hauteur).
  Le logo PlastiBois fourni est petit (322 × 210) : un fichier haute définition améliorera le panneau.
* chaque niveau associe les enseignes `A B C D` (haut-gauche, haut-droite, bas-gauche, bas-droite) à un partenaire.

Liens à créer côté BIG CE : `DRAW_URL` (formulaire du tirage) et `SPONSORS_URL` dans `js/game.js`
pointent pour l'instant sur `formulaire.big-ce.com/pipemana` et sur la page sponsors de Pac‑Mana.

## Ajouter un niveau
Dans `js/levels.js`, dupliquer un objet de `LEVELS` et dessiner le plan **résolu** avec les caractères de tracé
(`─ │ ┌ ┐ └ ┘ ┬ ┴ ├ ┤ ┼`, `T` château d'eau, `A`–`D` enseignes, `#` rocher, `.` herbe), régler `countdown`,
`cellsPerSec`, `seed` (mélange) et `gold` (case du tuyau doré). Le jeu mélange les orientations lui-même.
`node test-network.mjs` vérifie qu'un plan résolu alimente les 4 enseignes sans fuite (`Network` et `Flow` n'ont aucune dépendance 3D).

## Structure
```
pipe/
  index.html          page + HUD + écrans + lightbox
  css/style.css       interface, barre d'état, enseignes, effet « retournement »
  js/levels.js        niveaux (plans de tuyauterie), thème, partenaires   ← à éditer pour logos / niveaux
  js/network.js       grille logique : pièces, rotation, mélange, eau ramifiée (sans 3D, testable)
  js/grid3d.js        plan incliné du réseau (coordonnées, picking)
  js/terrain.js       vallée : sol, rivière, ciel / environnement, cocotiers, fougères, herbe, rochers
  js/world.js         réseau 3D : tuyaux PVC translucides, château d'eau, enseignes, tuyau doré, particules
  js/camera.js        cadrage automatique, plongée d'intro, coups de zoom, orbite
  js/motion.js        charte de mouvement GSAP (panneaux, titres, ressorts)
  js/input.js         tap / survol / clavier
  js/audio.js         sons synthétisés (WebAudio)
  js/ui.js            HUD, barre d'état, écrans, retournements, popups
  js/game.js          règles, états, score, bonus, niveaux
  js/textures.js      textures procédurales (sol, écorce, palmes, nuages…)
  assets/             logo BIG CE, carte 2026, enseignes des partenaires
  film/               film d'intro HyperFrames (HTML → vidéo)
  build-standalone.mjs  → pipemana-standalone.html
```
