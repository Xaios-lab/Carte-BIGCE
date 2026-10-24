# Pipe Mana · film d'intro (HyperFrames)

Film de 16 s en 1920×1080 à 30 i/s, écrit en HTML + GSAP et rendu en MP4 par la CLI HyperFrames.
Quatre scènes qui se passent le relais par un fondu-flou de 0,15 s :

| Scène | Fichier | Contenu |
| --- | --- | --- |
| 0 → 3 s | `compositions/ouverture.html` | plongée de la caméra depuis le ciel (séquence réelle du jeu), « BIG CE présente », titre mot par mot |
| 2,85 → 8,85 s | `compositions/jeu.html` | l'eau coule dans le réseau (séquence réelle), trois lignes : pivoter, château d'eau, 4 enseignes |
| 8,7 → 12,7 s | `compositions/enseignes.html` | lente orbite sur la vallée, les 4 logos se posent en cascade |
| 12,55 → 16 s | `compositions/fin.html` | carton final : logo BIG CE, titre, lot de 10 000 F, appel à l'action |

Les séquences `assets/clip-*.mp4` sont capturées image par image dans le vrai jeu (pas de temps fixe,
GSAP piloté à la main) par le script de capture de la session, puis encodées avec FFmpeg.
Les textes sont des variables (`data-composition-variables` dans `index.html`), modifiables dans
le HyperFrames desktop app ou en ligne de commande.

```bash
npm run check                               # lint + rendu + mise en page + contraste
npx hyperframes snapshot --at 1.5,5,10,14   # images fixes pour contrôler
npx hyperframes preview --background        # aperçu dans le navigateur
npx hyperframes render --quality delivery --output pipe-mana-intro.mp4
```
