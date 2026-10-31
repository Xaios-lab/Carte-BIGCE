// Catalogue des modèles : prix, licence, points forts, et mappage des
// paramètres génériques du studio vers l'entrée de chaque fournisseur.
//
// Tarifs indicatifs (USD, octobre 2026) relevés sur les pages publiques des
// fournisseurs et agrégateurs : ils changent souvent, vérifiez avant un gros
// volume. `verified:false` = identifiant d'endpoint à confirmer sur la page du
// modèle (la session de développement n'avait pas accès à fal.ai/Replicate).

export const ASPECTS = {
  "1:1":  { w: 1024, h: 1024, fal: "square_hd" },
  "4:5":  { w: 1024, h: 1280, fal: { width: 1024, height: 1280 } },
  "3:4":  { w: 960,  h: 1280, fal: "portrait_4_3" },
  "9:16": { w: 768,  h: 1344, fal: "portrait_16_9" },
  "16:9": { w: 1344, h: 768,  fal: "landscape_16_9" },
  "4:3":  { w: 1280, h: 960,  fal: "landscape_4_3" },
  "3:2":  { w: 1216, h: 832,  fal: { width: 1216, height: 832 } },
};

const falSize = (aspect) => (ASPECTS[aspect] || ASPECTS["1:1"]).fal;
const dims = (aspect) => ASPECTS[aspect] || ASPECTS["1:1"];

/** Normalise une sortie image fal/replicate en liste d'assets. */
function imagesFromFal(out) {
  const imgs = out.images || (out.image ? [out.image] : []);
  return imgs.map((i) => ({ kind: "image", src: i.url, mime: i.content_type, width: i.width, height: i.height, seed: out.seed }));
}
function imagesFromReplicate(out) {
  const arr = Array.isArray(out) ? out : [out];
  return arr.filter(Boolean).map((u) => ({ kind: "image", src: typeof u === "string" ? u : u.url }));
}
const videoFromFal = (out) => [{ kind: "video", src: out.video?.url, mime: out.video?.content_type }];
const videoFromReplicate = (out) => [{ kind: "video", src: typeof out === "string" ? out : out?.url || out?.[0] }];
const audioFromFal = (out) => [{ kind: "audio", src: out.audio?.url || out.audio_url?.url || out.audio_file?.url }];
const audioFromReplicate = (out) => [{ kind: "audio", src: typeof out === "string" ? out : out?.url || out?.audio }];

export const CATALOG = [
  // ───────────────────────── IMAGES ─────────────────────────
  {
    id: "flux-schnell", name: "FLUX.1 [schnell]", task: "image", provider: "fal", endpoint: "fal-ai/flux/schnell",
    openSource: true, license: "Apache-2.0 (usage commercial OK)", quality: 3, speed: 5,
    price: { unit: "image", usd: 0.003 }, verified: true,
    bestFor: "Brouillons, itérations rapides, moodboards. Le moins cher du marché.",
    build: (p) => ({ prompt: p.prompt, image_size: falSize(p.aspect), num_images: p.count || 1, num_inference_steps: 4, enable_safety_checker: false, seed: p.seed }),
    parse: imagesFromFal,
  },
  {
    id: "flux-dev", name: "FLUX.1 [dev]", task: "image", provider: "fal", endpoint: "fal-ai/flux/dev",
    openSource: true, license: "FLUX non-commercial (sortie commerciale OK via fal, licence hébergeur)", quality: 4, speed: 4,
    price: { unit: "image", usd: 0.025 }, verified: true,
    bestFor: "Qualité photo solide, bon rapport qualité/prix pour visuels publicitaires.",
    build: (p) => ({ prompt: p.prompt, image_size: falSize(p.aspect), num_images: p.count || 1, num_inference_steps: 28, guidance_scale: 3.5, enable_safety_checker: false, seed: p.seed }),
    parse: imagesFromFal,
  },
  {
    id: "flux2-dev", name: "FLUX.2 [dev]", task: "image", provider: "fal", endpoint: "fal-ai/flux-2/dev",
    openSource: true, license: "FLUX.2 dev non-commercial (sortie commerciale via hébergeur)", quality: 5, speed: 3,
    price: { unit: "image", usd: 0.03 }, verified: false,
    bestFor: "Référence qualité open-weight 2026 : photoréalisme, texte, multi-références.",
    build: (p) => ({ prompt: p.prompt, image_size: falSize(p.aspect), num_images: p.count || 1, enable_safety_checker: false, seed: p.seed, image_urls: p.refImages?.length ? p.refImages : undefined }),
    parse: imagesFromFal,
  },
  {
    id: "qwen-image", name: "Qwen-Image", task: "image", provider: "fal", endpoint: "fal-ai/qwen-image",
    openSource: true, license: "Apache-2.0 (usage commercial OK)", quality: 4, speed: 3,
    price: { unit: "image", usd: 0.02 }, verified: true,
    bestFor: "Meilleur open source pour le TEXTE dans l'image (affiches, prix, slogans). Licence 100 % libre.",
    build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative || " ", image_size: falSize(p.aspect), num_images: p.count || 1, num_inference_steps: 30, guidance_scale: 4, enable_safety_checker: false, seed: p.seed }),
    parse: imagesFromFal,
  },
  {
    id: "seedream-4", name: "Seedream 4.0 (ByteDance)", task: "image", provider: "fal", endpoint: "fal-ai/bytedance/seedream/v4/text-to-image",
    openSource: false, license: "Propriétaire, usage commercial OK", quality: 5, speed: 4,
    price: { unit: "image", usd: 0.03 }, verified: true,
    bestFor: "Visuels pub très léchés, 4K, texte fiable. Excellent rapport qualité/prix.",
    build: (p) => ({ prompt: p.prompt, image_size: falSize(p.aspect), num_images: p.count || 1, enable_safety_checker: false, seed: p.seed }),
    parse: imagesFromFal,
  },
  {
    id: "nano-banana", name: "Nano Banana (Gemini 2.5 Flash Image)", task: "image", provider: "fal", endpoint: "fal-ai/nano-banana",
    openSource: false, license: "Propriétaire (Google), usage commercial OK", quality: 5, speed: 4,
    price: { unit: "image", usd: 0.039 }, verified: true,
    bestFor: "Cohérence produit/personnage, texte parfait, intégration d'un logo ou produit existant.",
    build: (p) => ({ prompt: p.prompt, num_images: p.count || 1, aspect_ratio: p.aspect || "1:1", output_format: "png" }),
    parse: imagesFromFal,
  },
  {
    id: "recraft-v3", name: "Recraft V3 (style vectoriel)", task: "image", provider: "fal", endpoint: "fal-ai/recraft/v3/text-to-image",
    openSource: false, license: "Propriétaire, usage commercial OK", quality: 5, speed: 4,
    price: { unit: "image", usd: 0.04 }, verified: true, logo: true,
    bestFor: "LOGOS et illustrations vectorielles : formes nettes, aplats, typographie. Numéro 1 pour l'identité visuelle.",
    build: (p) => ({ prompt: p.prompt, image_size: falSize(p.aspect), style: p.style || "vector_illustration", colors: p.colors }),
    parse: imagesFromFal,
  },
  {
    id: "flux-schnell-replicate", name: "FLUX.1 [schnell] (Replicate)", task: "image", provider: "replicate", endpoint: "black-forest-labs/flux-schnell",
    openSource: true, license: "Apache-2.0", quality: 3, speed: 5,
    price: { unit: "image", usd: 0.003 }, verified: true,
    bestFor: "Même modèle que fal, en secours.",
    build: (p) => ({ prompt: p.prompt, aspect_ratio: p.aspect || "1:1", num_outputs: p.count || 1, output_format: "png", disable_safety_checker: true, seed: p.seed }),
    parse: imagesFromReplicate,
  },
  {
    id: "recraft-v3-svg", name: "Recraft V3 SVG (Replicate)", task: "image", provider: "replicate", endpoint: "recraft-ai/recraft-v3-svg",
    openSource: false, license: "Propriétaire, usage commercial OK", quality: 5, speed: 4,
    price: { unit: "image", usd: 0.08 }, verified: true, logo: true, svg: true,
    bestFor: "Logos en SVG natif, prêts pour l'impression et la découpe. Le meilleur pour un logo final.",
    build: (p) => ({ prompt: p.prompt, size: `${dims(p.aspect).w}x${dims(p.aspect).h}`, style: p.style || "vector_illustration" }),
    parse: imagesFromReplicate,
  },

  // ───────────────────────── RETOUCHE IMAGE ─────────────────────────
  {
    id: "nano-banana-edit", name: "Nano Banana Edit", task: "image-edit", provider: "fal", endpoint: "fal-ai/nano-banana/edit",
    openSource: false, license: "Propriétaire (Google)", quality: 5, speed: 4,
    price: { unit: "image", usd: 0.039 }, verified: true,
    bestFor: "Mettre VOTRE produit/logo/carte dans une scène, changer le fond, décliner un visuel.",
    build: (p) => ({ prompt: p.prompt, image_urls: p.refImages || [], num_images: p.count || 1, output_format: "png" }),
    parse: imagesFromFal,
  },
  {
    id: "qwen-image-edit", name: "Qwen-Image-Edit", task: "image-edit", provider: "fal", endpoint: "fal-ai/qwen-image-edit",
    openSource: true, license: "Apache-2.0", quality: 4, speed: 3,
    price: { unit: "image", usd: 0.03 }, verified: true,
    bestFor: "Retouche open source : remplacer un texte, modifier un élément, garder la composition.",
    build: (p) => ({ prompt: p.prompt, image_url: p.refImages?.[0], num_images: p.count || 1 }),
    parse: imagesFromFal,
  },
  {
    id: "bg-remove", name: "Suppression de fond (BiRefNet v2)", task: "bg-remove", provider: "fal", endpoint: "fal-ai/birefnet/v2",
    openSource: true, license: "MIT", quality: 5, speed: 5,
    price: { unit: "image", usd: 0.002 }, verified: true,
    bestFor: "Détourer un logo ou un produit (PNG transparent).",
    build: (p) => ({ image_url: p.refImages?.[0], model: "General Use (Heavy)", output_format: "png" }),
    parse: (out) => [{ kind: "image", src: out.image?.url, mime: "image/png" }],
  },
  {
    id: "vectorize", name: "Recraft Vectorize (PNG → SVG)", task: "vectorize", provider: "fal", endpoint: "fal-ai/recraft/vectorize",
    openSource: false, license: "Propriétaire", quality: 5, speed: 5,
    price: { unit: "image", usd: 0.01 }, verified: false,
    bestFor: "Convertir un logo PNG en SVG propre.",
    build: (p) => ({ image_url: p.refImages?.[0] }),
    parse: (out) => [{ kind: "image", src: out.image?.url, mime: "image/svg+xml" }],
  },
  {
    id: "upscale", name: "Upscale ×2/×4 (Clarity)", task: "upscale", provider: "fal", endpoint: "fal-ai/clarity-upscaler",
    openSource: true, license: "Open source (Clarity / SD)", quality: 4, speed: 3,
    price: { unit: "image", usd: 0.03 }, verified: true,
    bestFor: "Agrandir un visuel pour l'impression (affiche, kakemono).",
    build: (p) => ({ image_url: p.refImages?.[0], upscale_factor: p.factor || 2 }),
    parse: (out) => [{ kind: "image", src: out.image?.url }],
  },

  // ───────────────────────── VIDÉO ─────────────────────────
  {
    id: "wan25-t2v", name: "Wan 2.5 — texte → vidéo (audio natif)", task: "video-t2v", provider: "fal", endpoint: "fal-ai/wan-25-preview/text-to-video",
    openSource: true, license: "Apache-2.0 (Wan 2.2) / preview 2.5 via API", quality: 4, speed: 3,
    price: { unit: "second", usd: 0.05, note: "480p 0,05 $/s · 720p 0,10 $/s · 1080p 0,15 $/s" }, verified: true,
    bestFor: "Le meilleur rapport qualité/prix. Génère voix + ambiance sonore à partir du prompt (dialogue en français possible).",
    build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, resolution: p.resolution || "720p", duration: String(p.duration || 5), enable_prompt_expansion: true, audio_url: p.audioUrl, seed: p.seed }),
    parse: videoFromFal,
    pricing: (p) => ({ "480p": 0.05, "720p": 0.10, "1080p": 0.15 }[p.resolution || "720p"] * (p.duration || 5)),
  },
  {
    id: "wan25-i2v", name: "Wan 2.5 — image → vidéo (audio natif)", task: "video-i2v", provider: "fal", endpoint: "fal-ai/wan-25-preview/image-to-video",
    openSource: true, license: "Apache-2.0 (Wan 2.2) / preview 2.5 via API", quality: 4, speed: 3,
    price: { unit: "second", usd: 0.05, note: "480p 0,05 $/s · 720p 0,10 $/s · 1080p 0,15 $/s" }, verified: true,
    bestFor: "Animer un visuel de marque généré avant : cohérence parfaite des couleurs, logo et produit.",
    build: (p) => ({ prompt: p.prompt, image_url: p.imageUrl, negative_prompt: p.negative, resolution: p.resolution || "720p", duration: String(p.duration || 5), enable_prompt_expansion: true, audio_url: p.audioUrl, seed: p.seed }),
    parse: videoFromFal,
    pricing: (p) => ({ "480p": 0.05, "720p": 0.10, "1080p": 0.15 }[p.resolution || "720p"] * (p.duration || 5)),
  },
  {
    id: "ltx2-fast-t2v", name: "LTX-2.3 Fast — texte → vidéo (audio synchro)", task: "video-t2v", provider: "fal", endpoint: "fal-ai/ltx-2.3/text-to-video/fast",
    openSource: true, license: "LTX Open Weights (gratuit < 10 M$ CA/an)", quality: 4, speed: 5,
    price: { unit: "second", usd: 0.04, note: "1080p 0,04 $/s · 1440p 0,08 $/s · 4K 0,16 $/s" }, verified: true,
    bestFor: "Clips 6–20 s en 1080p avec son synchronisé, le moins cher à la seconde en Full HD.",
    build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, duration: Math.min(20, Math.max(6, p.duration || 6)), resolution: p.resolution4k ? "2160p" : "1080p", aspect_ratio: p.aspect || "16:9", generate_audio: p.audio !== false, fps: 25 }),
    parse: videoFromFal,
    pricing: (p) => 0.04 * Math.min(20, Math.max(6, p.duration || 6)),
  },
  {
    id: "ltx2-fast-i2v", name: "LTX-2.3 Fast — image → vidéo (audio synchro)", task: "video-i2v", provider: "fal", endpoint: "fal-ai/ltx-2.3/image-to-video/fast",
    openSource: true, license: "LTX Open Weights (gratuit < 10 M$ CA/an)", quality: 4, speed: 5,
    price: { unit: "second", usd: 0.04 }, verified: true,
    bestFor: "Animer un visuel en 1080p à petit prix, son inclus.",
    build: (p) => ({ prompt: p.prompt, image_url: p.imageUrl, duration: Math.min(20, Math.max(6, p.duration || 6)), resolution: "1080p", aspect_ratio: p.aspect || "16:9", generate_audio: p.audio !== false, fps: 25 }),
    parse: videoFromFal,
    pricing: (p) => 0.04 * Math.min(20, Math.max(6, p.duration || 6)),
  },
  {
    id: "kling25-t2v", name: "Kling 2.5 Turbo Pro — texte → vidéo", task: "video-t2v", provider: "fal", endpoint: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    openSource: false, license: "Propriétaire (Kuaishou), usage commercial OK", quality: 5, speed: 3,
    price: { unit: "second", usd: 0.07, note: "0,35 $ les 5 s puis 0,07 $/s" }, verified: true,
    bestFor: "Mouvement et réalisme premium (personnes, produits) quand Wan ne suffit pas.",
    build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, duration: String(p.duration >= 10 ? 10 : 5), aspect_ratio: p.aspect || "16:9", cfg_scale: 0.5 }),
    parse: videoFromFal,
    pricing: (p) => 0.07 * (p.duration >= 10 ? 10 : 5),
  },
  {
    id: "kling25-i2v", name: "Kling 2.5 Turbo Pro — image → vidéo", task: "video-i2v", provider: "fal", endpoint: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    openSource: false, license: "Propriétaire (Kuaishou)", quality: 5, speed: 3,
    price: { unit: "second", usd: 0.07 }, verified: true,
    bestFor: "Animation premium d'un visuel clé.",
    build: (p) => ({ prompt: p.prompt, image_url: p.imageUrl, negative_prompt: p.negative, duration: String(p.duration >= 10 ? 10 : 5), cfg_scale: 0.5 }),
    parse: videoFromFal,
    pricing: (p) => 0.07 * (p.duration >= 10 ? 10 : 5),
  },
  {
    id: "veo31-fast", name: "Veo 3.1 Fast — texte → vidéo (dialogue natif)", task: "video-t2v", provider: "fal", endpoint: "fal-ai/veo3.1/fast",
    openSource: false, license: "Propriétaire (Google)", quality: 5, speed: 3,
    price: { unit: "second", usd: 0.20, note: "~0,20 $/s avec audio (8 s ≈ 1,60 $)" }, verified: false,
    bestFor: "Le haut de gamme : UGC « parlé » ultra réaliste, lip-sync natif. À réserver aux plans clés.",
    build: (p) => ({ prompt: p.prompt, aspect_ratio: p.aspect === "9:16" ? "9:16" : "16:9", duration: "8s", generate_audio: true, resolution: "720p" }),
    parse: videoFromFal,
    pricing: () => 0.20 * 8,
  },
  {
    id: "wan25-t2v-replicate", name: "Wan 2.5 — texte → vidéo (Replicate)", task: "video-t2v", provider: "replicate", endpoint: "wan-video/wan-2.5-t2v",
    openSource: true, license: "Wan (Alibaba)", quality: 4, speed: 3,
    price: { unit: "second", usd: 0.10 }, verified: false,
    bestFor: "Secours si fal.ai est indisponible.",
    build: (p) => ({ prompt: p.prompt, negative_prompt: p.negative, resolution: p.resolution || "720p", duration: p.duration >= 10 ? 10 : 5, enable_prompt_expansion: true }),
    parse: videoFromReplicate,
  },

  // ───────────────────────── VOIX (TTS) ─────────────────────────
  {
    id: "kokoro-fr", name: "Kokoro 82M — voix française", task: "tts", provider: "fal", endpoint: "fal-ai/kokoro/french",
    openSource: true, license: "Apache-2.0", quality: 3, speed: 5,
    price: { unit: "1k_chars", usd: 0.002 }, verified: true,
    bestFor: "Voix off quasi gratuite, naturelle, idéale pour maquettes et vidéos internes.",
    voices: ["ff_siwis"],
    build: (p) => ({ prompt: p.text, voice: p.voice || "ff_siwis", speed: p.speed || 1 }),
    parse: audioFromFal,
  },
  {
    id: "elevenlabs-v2", name: "ElevenLabs Multilingual v2", task: "tts", provider: "fal", endpoint: "fal-ai/elevenlabs/tts/multilingual-v2",
    openSource: false, license: "Propriétaire, usage commercial OK", quality: 5, speed: 4,
    price: { unit: "1k_chars", usd: 0.10 }, verified: true,
    bestFor: "La voix off la plus naturelle en français (accent, émotion). Pour les vidéos destinées au public.",
    voices: ["Rachel", "Aria", "Roger", "Sarah", "Laura", "Charlie", "George", "Callum", "River", "Liam", "Charlotte", "Alice", "Matilda", "Will", "Jessica", "Eric", "Chris", "Brian", "Daniel", "Lily", "Bill"],
    build: (p) => ({ text: p.text, voice: p.voice || "Sarah", stability: 0.5, similarity_boost: 0.75, speed: p.speed || 1 }),
    parse: audioFromFal,
  },
  {
    id: "minimax-speech", name: "MiniMax Speech-02 HD", task: "tts", provider: "fal", endpoint: "fal-ai/minimax/speech-02-hd",
    openSource: false, license: "Propriétaire", quality: 4, speed: 4,
    price: { unit: "1k_chars", usd: 0.05 }, verified: true,
    bestFor: "Très bonne voix multilingue, moitié prix d'ElevenLabs.",
    voices: ["French_Female_News Anchor", "French_Male_Speech_New", "Wise_Woman", "Friendly_Person", "Calm_Woman", "Casual_Guy"],
    build: (p) => ({ text: p.text, voice_setting: { voice_id: p.voice || "French_Female_News Anchor", speed: p.speed || 1 }, language_boost: "French" }),
    parse: audioFromFal,
  },
  {
    id: "kokoro-replicate", name: "Kokoro 82M (Replicate)", task: "tts", provider: "replicate", endpoint: "jaaari/kokoro-82m",
    openSource: true, license: "Apache-2.0", quality: 3, speed: 5,
    price: { unit: "1k_chars", usd: 0.002 }, verified: true,
    bestFor: "Secours voix off.",
    voices: ["ff_siwis"],
    build: (p) => ({ text: p.text, voice: p.voice || "ff_siwis", speed: p.speed || 1 }),
    parse: audioFromReplicate,
  },

  // ───────────────────────── AVATAR / UGC (image + voix → vidéo parlante) ─────────────────────────
  {
    id: "infinitalk", name: "InfiniteTalk — avatar parlant (image + audio)", task: "avatar", provider: "fal", endpoint: "fal-ai/infinitalk",
    openSource: true, license: "Apache-2.0 (Wan 2.1 based)", quality: 4, speed: 2,
    price: { unit: "second", usd: 0.06, note: "~0,30 $ pour 5 s en 480p" }, verified: true,
    bestFor: "UGC : un visage (généré ou photo réelle avec accord) qui parle votre texte, lip-sync précis, open source.",
    build: (p) => ({ image_url: p.imageUrl, audio_url: p.audioUrl, prompt: p.prompt || "A person talking naturally to the camera, friendly, natural lighting", resolution: p.resolution || "480p", num_frames: Math.min(721, Math.round((p.duration || 10) * 25)), acceleration: "regular" }),
    parse: videoFromFal,
    pricing: (p) => 0.06 * (p.duration || 10),
  },
  {
    id: "omnihuman", name: "OmniHuman (ByteDance) — avatar parlant", task: "avatar", provider: "fal", endpoint: "fal-ai/bytedance/omnihuman",
    openSource: false, license: "Propriétaire", quality: 5, speed: 2,
    price: { unit: "second", usd: 0.14 }, verified: false,
    bestFor: "Gestuelle corps entier très réaliste, le plus crédible pour un témoignage client.",
    build: (p) => ({ image_url: p.imageUrl, audio_url: p.audioUrl }),
    parse: videoFromFal,
    pricing: (p) => 0.14 * (p.duration || 10),
  },
  {
    id: "fabric", name: "VEED Fabric 1.0 — avatar parlant", task: "avatar", provider: "fal", endpoint: "veed/fabric-1.0",
    openSource: false, license: "Propriétaire", quality: 4, speed: 3,
    price: { unit: "second", usd: 0.08 }, verified: false,
    bestFor: "Alternative rapide à InfiniteTalk, expressions faciales soignées.",
    build: (p) => ({ image_url: p.imageUrl, audio_url: p.audioUrl, resolution: p.resolution || "480p" }),
    parse: videoFromFal,
    pricing: (p) => 0.08 * (p.duration || 10),
  },

  // ───────────────────────── MUSIQUE ─────────────────────────
  {
    id: "ace-step", name: "ACE-Step — musique (open source)", task: "music", provider: "fal", endpoint: "fal-ai/ace-step",
    openSource: true, license: "Apache-2.0", quality: 3, speed: 4,
    price: { unit: "second", usd: 0.0005, note: "≈ 0,02 $ la minute" }, verified: true,
    bestFor: "Fond musical libre de droits en quelques secondes (tags de style, instrumental).",
    build: (p) => ({ tags: p.prompt, lyrics: "[inst]", duration: p.duration || 30 }),
    parse: audioFromFal,
  },
  {
    id: "stable-audio", name: "Stable Audio 2.5 — musique", task: "music", provider: "fal", endpoint: "fal-ai/stable-audio-25/text-to-audio",
    openSource: false, license: "Stability AI (commercial via API)", quality: 4, speed: 4,
    price: { unit: "second", usd: 0.002 }, verified: false,
    bestFor: "Jingles et ambiances plus propres.",
    build: (p) => ({ prompt: p.prompt, seconds_total: p.duration || 30 }),
    parse: audioFromFal,
  },
];

export const byId = (id) => CATALOG.find((m) => m.id === id);
export const byTask = (task) => CATALOG.filter((m) => m.task === task);

/** Choix par défaut par tâche selon la priorité qualité/prix. */
export const DEFAULTS = {
  image: { eco: "flux-schnell", standard: "qwen-image", premium: "seedream-4" },
  logo: { eco: "flux-dev", standard: "recraft-v3", premium: "recraft-v3-svg" },
  "image-edit": { standard: "nano-banana-edit", eco: "qwen-image-edit" },
  "video-t2v": { eco: "ltx2-fast-t2v", standard: "wan25-t2v", premium: "kling25-t2v" },
  "video-i2v": { eco: "ltx2-fast-i2v", standard: "wan25-i2v", premium: "kling25-i2v" },
  tts: { eco: "kokoro-fr", standard: "minimax-speech", premium: "elevenlabs-v2" },
  avatar: { eco: "infinitalk", standard: "infinitalk", premium: "omnihuman" },
  music: { eco: "ace-step", standard: "ace-step", premium: "stable-audio" },
};

/** Estimation du coût USD d'un appel de modèle avec des paramètres donnés. */
export function estimateCost(model, p = {}) {
  if (!model) return 0;
  if (model.pricing) return model.pricing(p);
  const { unit, usd } = model.price;
  switch (unit) {
    case "image": return usd * (p.count || 1);
    case "second": return usd * (p.duration || 5);
    case "1k_chars": return usd * Math.max(1, (p.text?.length || 500) / 1000);
    default: return usd;
  }
}

/** Vue publique du catalogue (sans fonctions) pour l'interface. */
export function publicCatalog() {
  return CATALOG.map(({ build, parse, pricing, ...rest }) => rest);
}
