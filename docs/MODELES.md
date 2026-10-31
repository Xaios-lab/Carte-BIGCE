# Étude des modèles IA image / vidéo / voix (octobre 2026)

Objectif : choisir, pour le Studio Créa IA, les modèles **les plus performants et les
moins chers**, en privilégiant l'open source quand il est au niveau. Les prix sont ceux
relevés sur les pages publiques des fournisseurs et d'agrégateurs au 31 octobre 2026 ;
ils bougent chaque mois, l'interface du studio les affiche et ils se corrigent dans
`studio/server/catalog.js`.

## Synthèse des choix

| Besoin | Choix par défaut | Pourquoi | Éco | Premium |
|---|---|---|---|---|
| Logo | **Recraft V3** (style vectoriel) ~0,04 $/img | Seul modèle vraiment conçu pour les formes nettes, aplats et typographie ; SVG natif via Replicate | FLUX.1 dev 0,025 $ | Recraft V3 SVG 0,08 $ |
| Visuel pub | **Qwen-Image** ~0,02 $/img | Open source Apache-2.0, meilleur texte dans l'image du libre, très bon photoréalisme | FLUX.1 schnell 0,003 $ | Seedream 4.0 0,03 $ / Nano Banana 0,039 $ |
| Retouche / intégrer un produit | **Nano Banana Edit** 0,039 $ | Cohérence produit et texte imbattables | Qwen-Image-Edit 0,03 $ (open source) | — |
| Vidéo (image → vidéo) | **Wan 2.5** 0,05–0,15 $/s | Le meilleur rapport qualité/prix, audio natif, famille Wan open source | LTX-2.3 Fast 0,04 $/s en 1080p | Kling 2.5 Turbo Pro 0,07 $/s · Veo 3.1 ~0,20 $/s |
| Voix off française | **MiniMax Speech-02 HD** ~0,05 $/1k car. | Naturelle, moitié prix d'ElevenLabs | Kokoro 82M (Apache-2.0) ~0,002 $/1k car. | ElevenLabs v2 ~0,10 $/1k car. |
| Avatar parlant (UGC) | **InfiniteTalk** ~0,06 $/s | Open source, lip-sync précis depuis une image + un audio | — | OmniHuman ~0,14 $/s |
| Musique | **ACE-Step** ~0,02 $/min | Open source Apache-2.0, libre de droits | — | Stable Audio 2.5 |
| Détourage / upscale | BiRefNet v2 (MIT) 0,002 $ · Clarity 0,03 $ | Open source, quasi gratuit | | |

## Images : état de l'art open source

- **Qwen-Image / Qwen-Image 2.x (Alibaba)** : licence Apache-2.0 pour Qwen-Image (la
  version 2.1 serait sous licence « Qwen Research », à vérifier avant usage commercial).
  Référence du texte dans l'image côté libre ; en tête de l'arène Artificial Analysis
  parmi les open-weight selon un relevé d'octobre 2026.
- **FLUX.2 [dev] (Black Forest Labs)** : meilleure qualité brute open-weight mais licence
  non commerciale pour l'auto-hébergement (la sortie commerciale est couverte par la
  licence de l'hébergeur fal/Replicate). ~32 Go de VRAM en FP8 : non pertinent en local.
  **FLUX.2 [klein] 4B** est Apache-2.0 et tourne sur 13 Go.
- **FLUX.1 [schnell]** : Apache-2.0, 0,003 $ l'image, le choix pour itérer.
- **HiDream-I1** (17B, MIT) : alternative permissive de bonne qualité ; non retenu faute
  d'avantage net sur Qwen-Image au même prix.
- Propriétaires qui valent leur prix pour la pub : **Seedream 4.0** (0,03 $), **Nano
  Banana** (0,039 $, texte et cohérence produit), **Recraft V3** (vectoriel).

## Vidéo : état de l'art open source

- **Wan 2.2 / 2.5 / 2.6 (Alibaba)** : Wan 2.2 est Apache-2.0 et considéré comme le
  meilleur image→vidéo open-weight ; Wan 2.5 (preview via API, audio natif, dialogue
  possible) est à 0,05 $/s en 480p, 0,10 $ en 720p, 0,15 $ en 1080p sur fal.ai.
- **LTX-2 / 2.3 (Lightricks)** : open weights (gratuit sous 10 M$ de CA annuel),
  première famille à générer image + son synchronisés en une passe, 6–20 s, 1080p à
  0,04 $/s (le moins cher en Full HD), 4K possible.
- **HunyuanVideo 1.5 (Tencent)** : excellent pour un GPU local, mais licence excluant
  l'UE/UK/Corée ; non retenu.
- Propriétaires : **Kling 2.5 Turbo Pro** (0,35 $ les 5 s) pour le mouvement humain,
  **Veo 3.1** (~0,20 $/s) pour le parlé ultra-réaliste. Sora 2 n'est pas proposé via
  fal au moment de l'étude.

## Voix

- **Kokoro 82M** : Apache-2.0, voix française `ff_siwis`, quasi gratuit ; qualité
  correcte pour maquettes et vidéos internes.
- **MiniMax Speech-02 HD** et **ElevenLabs Multilingual v2** : les plus naturels en
  français ; ElevenLabs reste la référence émotionnelle.
- **Voxtral TTS (Mistral)** : open source, 0,016 $/1k car., prometteur pour le français ;
  à ajouter au catalogue dès qu'il est hébergé chez fal/Replicate.

## Fournisseurs

| Fournisseur | Atouts | Limites |
|---|---|---|
| **fal.ai** (retenu) | Catalogue le plus large (image, vidéo, voix, avatar, musique), file d'attente avec logs, tarifs les plus bas relevés sur Wan/FLUX/LTX, pas de démarrage à froid | Pas d'accès depuis la session de développement : endpoints marqués « à vérifier » |
| **Replicate** | Recraft V3 **SVG**, modèles officiels à prix fixe (FLUX schnell 0,003 $), bonne doc | Vidéo généralement plus chère (0,07–0,25 $/s), facturation GPU à la seconde sur les modèles communautaires |
| WaveSpeed, Runware, Novita, Together | Parfois moins chers sur un modèle précis | Catalogue plus étroit, à intégrer si un volume important le justifie |
| Auto-hébergement (RunPod / ComfyUI) | Coût marginal très bas à gros volume (FLUX schnell < 0,002 $/img) | GPU 24–80 Go, maintenance, pas rentable sous quelques milliers de rendus/mois |

## Sources consultées

- Classements image open source 2026 : [Pixazo](https://www.pixazo.ai/blog/top-open-source-image-generation-models), [Sevenlabs](https://www.sevenlabs.site/blogs/open-source-image-generation-models-2026), [Thunder Compute](https://www.thundercompute.com/blog/best-open-source-image-generation-models), [Pinggy](https://pinggy.io/blog/best_free_open_source_ai_image_generators_to_self_host/), [Artifilog](https://www.artifilog.com/posts/best-open-source-image-generation-models), [BuilderAI](https://builderai.tools/blog/best-open-source-image-generation-stack-2026)
- Classements vidéo open source 2026 : [LTX.io](https://ltx.io/blog/best-open-source-video-generation-models), [Turing Post](https://www.turingpost.com/p/6-opensource-video-generation-models), [Thunder Compute](https://www.thundercompute.com/blog/best-open-source-ai-video-generation-models), [AImagicx](https://www.aimagicx.com/blog/open-source-ai-video-models-comparison-2026), [Local AI Master](https://localaimaster.com/blog/local-ai-video-generation), [Sevenlabs](https://www.sevenlabs.site/blogs/best-open-source-video-generation-models-2026)
- Tarifs fal.ai : [LTX-2 Fast](https://fal.ai/models/fal-ai/ltx-2/text-to-video/fast), [LTX-2.3](https://fal.ai/models/fal-ai/ltx-2.3/text-to-video), [pricing LTX](https://docs.ltx.io/pricing), [Wireflow](https://www.wireflow.ai/fal-ai-pricing), [Costbench](https://costbench.com/software/ai-media-apis/fal-ai/), [PrePrice](https://preprice.app/ai-costs/fal), [ModelsLab](https://modelslab.com/fal-ai-pricing)
- Comparatifs fournisseurs : [fal vs Replicate vs Modal](https://apiscout.dev/blog/fal-ai-vs-replicate-vs-modal-2026), [Replicate vs deAPI](https://dev.to/pietrus914/replicate-vs-deapi-price-comparison-for-ai-inference-2026-1d3l), [WaveSpeed](https://wavespeed.ai/blog/posts/best-ai-inference-platform-2026/), [Spheron](https://www.spheron.network/blog/fal-ai-alternatives/), [Fluxnote — prix vidéo](https://fluxnote.io/blog/ai-video-generation-pricing-guide-2026)
- Voix : [Fish Audio — TTS les moins chers](https://fish.audio/blog/cheapest-text-to-speech-api-developers/), [Inworld — comparatif prix TTS](https://inworld.ai/resources/tts-api-pricing-comparison), [Camb.ai](https://www.camb.ai/blog-post/text-to-speech-price-comparison), [Voxtral TTS](https://tools.skila.ai/tools/voxtral-tts)

Les chiffres issus d'agrégateurs tiers sont indicatifs : confirmez sur la page du
modèle avant de budgéter un volume important.
