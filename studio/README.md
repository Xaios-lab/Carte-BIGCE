# Studio Créa IA — logos, visuels pub, vidéos promo, UGC

Outil de production créative pour professionnels, multi-fournisseurs, piloté par un
**directeur créatif IA** (Claude) et des modèles de génération **open source quand ils
sont au niveau** (FLUX, Qwen-Image, Wan 2.5, LTX-2, Kokoro, InfiniteTalk…) ou
propriétaires quand ils font la différence (Recraft pour les logos, Seedream / Nano
Banana pour la pub, ElevenLabs pour la voix, Kling / Veo pour le premium).

Premier cas d'usage : les vidéos et visuels de **BIG CE** (kit de marque pré-rempli).

## Ce que ça produit

| Module | Chaîne de production | Sorties |
|---|---|---|
| **Logo** | brief → 1–8 concepts (nom, rationale, palette, typo) → image vectorielle par concept → PNG transparent → SVG | PNG, PNG détouré, SVG |
| **Visuel publicitaire** | brief → accroche + sous-titre + CTA + prompt → image par format (1:1, 4:5, 9:16, 16:9) → habillage auto (bandeau couleur marque, titre, CTA, logo) | fonds + visuels habillés, variantes A/B de texte |
| **Vidéo promo** | brief → script & storyboard (hook, scènes, voix off, textes écran, musique) → image clé par scène → animation image→vidéo → voix off → musique → montage (format, sous-titres incrustés, logo) | MP4 final, SRT, script JSON, chaque scène séparément |
| **UGC face caméra** | brief → script parlé première personne + persona → portrait (ou votre photo) → voix → avatar lip-sync → hooks + sous-titres 9:16 | MP4 vertical, script, légende + hashtags |
| **Mode expert** | appel direct de n'importe quel modèle du catalogue (31 modèles) | fichiers bruts |

Chaque lancement affiche le **coût estimé avant génération** (USD et XPF), un suivi en
direct (étapes, journal, fichiers au fur et à mesure) et tout est archivé dans la
bibliothèque.

## Démarrage

```bash
cd studio
npm install
cp .env.example .env     # puis renseignez vos clés (voir ci-dessous)
npm start                # http://localhost:3777
```

Prérequis : Node.js ≥ 20.12 et `ffmpeg` (montage vidéo, habillage, sous-titres).

Sans aucune clé, le studio tourne en **mode démo** : toute la chaîne fonctionne
(scripts, montage, sous-titres, exports) avec des rendus factices, pour prendre en main
l'outil sans dépenser.

## Connexions API nécessaires

| Clé | Rôle | Obligatoire ? | Où l'obtenir |
|---|---|---|---|
| `FAL_KEY` | Génération image / vidéo / voix / avatar / musique | **Oui** (recommandé) | https://fal.ai/dashboard/keys |
| `ANTHROPIC_API_KEY` | Directeur créatif (prompts, scripts, storyboards sur mesure) | Fortement conseillé | https://console.anthropic.com/settings/keys |
| `REPLICATE_API_TOKEN` | Secours + Recraft V3 **SVG** (logo vectoriel natif) | Optionnel | https://replicate.com/account/api-tokens |

fal.ai a été retenu comme fournisseur principal : un seul compte donne accès à tous les
modèles ci-dessous, en paiement à l'usage, avec les tarifs les plus bas relevés sur les
modèles open source (voir [docs/MODELES.md](../docs/MODELES.md) pour l'étude comparative
et les sources).

Sans clé Anthropic, un directeur créatif « hors ligne » (gabarits) prend le relais : les
scripts restent corrects mais génériques. Avec la clé, chaque brief donne un script,
des prompts et des accroches réellement écrits pour la marque. Les appels Claude
utilisent `claude-opus-5-5` avec le repli serveur `fallbacks: "default"` activé (si un
classifieur refuse une requête, elle est rejouée automatiquement sur un autre modèle).
Changez de modèle avec `STUDIO_CLAUDE_MODEL`.

## Coûts indicatifs (production, hors mode démo)

| Production | Modèles par défaut | Coût estimé |
|---|---|---|
| 4 concepts de logo + détourage | Recraft V3 + BiRefNet | ≈ 0,17 $ |
| Visuel pub en 3 formats | Qwen-Image | ≈ 0,06 $ |
| Vidéo promo 30 s, 6 scènes, 720p, voix off | Qwen-Image + Wan 2.5 + MiniMax | ≈ 3 $ |
| Vidéo promo 30 s en « éco » | FLUX schnell + LTX-2.3 Fast + Kokoro | ≈ 1,5 $ |
| UGC 25 s avatar lip-sync | Seedream + ElevenLabs + InfiniteTalk | ≈ 1,6 $ |

L'estimation exacte s'affiche dans l'interface selon vos choix.

## Kits de marque

Onglet **Marques** : nom, slogan, description, audience, ton, couleurs, polices, style
visuel (injecté dans tous les prompts), interdits, CTA, logo. Le kit **BIG CE** est
fourni ; ajustez-le (notamment en téléversant le logo PNG transparent pour qu'il soit
incrusté sur les visuels et vidéos).

## Architecture

```
studio/
├─ server/
│  ├─ index.js          API Express + SSE (progression en direct)
│  ├─ config.js         .env, état des fournisseurs
│  ├─ catalog.js        31 modèles : endpoint, prix, licence, mappage des paramètres
│  ├─ director.js       directeur créatif Claude (sorties structurées Zod) + repli hors ligne
│  ├─ providers/        fal.js (file d'attente), replicate.js, mock.js (démo), index.js (routeur)
│  ├─ pipelines/        logo.js, image.js, video.js, ugc.js
│  ├─ media.js          ffmpeg : habillage, montage, sous-titres, vignettes, rendus démo
│  ├─ jobs.js           file de travaux, journal, persistance
│  ├─ brands.js         kits de marque
│  └─ storage.js        téléchargement / sauvegarde des rendus, uploads
├─ public/              interface (HTML/CSS/JS, sans build)
├─ test/                tests de bout en bout en mode démo (`npm test`)
└─ data/                marques, rendus (`outputs/`), uploads, journal des travaux
```

Ajouter un modèle = ajouter une entrée dans `server/catalog.js` (endpoint, prix,
`build(params)` → entrée fournisseur, `parse(sortie)` → fichiers). Les entrées marquées
`verified: false` ont un identifiant d'endpoint à confirmer sur la page du modèle : la
session de développement n'avait pas accès à fal.ai pour les tester.

## API HTTP

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/status` | fournisseurs configurés, mode démo, modèle Claude |
| GET | `/api/catalog` | catalogue des modèles et défauts |
| GET/POST/DELETE | `/api/brands[/:id]` | kits de marque |
| POST | `/api/upload` | `{ data: "data:…;base64,…", name }` → `{ url }` |
| POST | `/api/estimate/:kind` | estimation de coût (`logo`, `image`, `video`, `ugc`) |
| POST | `/api/generate/:kind` | lance un pipeline, renvoie le job (202) |
| POST | `/api/run` | `{ model, params }` appel direct d'un modèle |
| GET | `/api/jobs`, `/api/jobs/:id`, `/api/jobs/:id/events` (SSE) | suivi |
| DELETE | `/api/jobs/:id?files=1` | suppression (et fichiers) |

## Déploiement

Le studio est une application Node autonome : un VPS, un Raspberry Pi ou un poste de
travail suffisent (les calculs lourds sont faits chez les fournisseurs). Si vous
l'exposez sur Internet, mettez-le derrière une authentification (reverse proxy) et
définissez `PUBLIC_BASE_URL` pour que les fournisseurs récupèrent les fichiers par URL
plutôt qu'en base64.

## Droits et bonnes pratiques

- Vérifiez la licence de chaque modèle avant un usage commercial (colonne « Licence »
  du catalogue). Les modèles open source Apache-2.0 / MIT sont sans restriction.
- Pour un avatar UGC à partir d'une **vraie personne**, obtenez son accord écrit (droit
  à l'image). Les personas générés évitent ce problème.
- Les voix clonées sont désactivées ; les voix proposées sont des voix de catalogue.
