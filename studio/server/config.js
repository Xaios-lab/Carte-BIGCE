// Chargement de la configuration (.env) et état des fournisseurs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, "..");
export const DATA_DIR = process.env.STUDIO_DATA_DIR || path.join(ROOT, "data");
export const OUTPUT_DIR = path.join(DATA_DIR, "outputs");
export const BRANDS_DIR = path.join(DATA_DIR, "brands");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

for (const d of [DATA_DIR, OUTPUT_DIR, BRANDS_DIR, UPLOADS_DIR]) fs.mkdirSync(d, { recursive: true });

const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  try { process.loadEnvFile(envFile); } catch { /* déjà chargé ou format invalide */ }
}

export const PORT = Number(process.env.PORT || 3777);
export const USD_TO_XPF = Number(process.env.USD_TO_XPF || 110);

/** Description de chaque fournisseur : clé attendue, usage, où l'obtenir. */
export const PROVIDERS = {
  anthropic: {
    name: "Claude (Anthropic)",
    env: "ANTHROPIC_API_KEY",
    role: "Directeur créatif : briefs → prompts, scripts, storyboards, textes UGC",
    url: "https://console.anthropic.com/settings/keys",
    required: false,
    fallback: "Sans clé, un directeur créatif hors ligne (gabarits) est utilisé.",
  },
  fal: {
    name: "fal.ai",
    env: "FAL_KEY",
    role: "Génération image / vidéo / voix / avatar (FLUX, Qwen-Image, Recraft, Wan, LTX-2, Kling, Veo, Kokoro, ElevenLabs…)",
    url: "https://fal.ai/dashboard/keys",
    required: true,
    fallback: "Fournisseur recommandé : le plus large catalogue et les tarifs les plus bas sur les modèles open source.",
  },
  replicate: {
    name: "Replicate",
    env: "REPLICATE_API_TOKEN",
    role: "Alternative / secours pour image, vidéo, voix (FLUX, Recraft SVG, Wan, Kling, Kokoro…)",
    url: "https://replicate.com/account/api-tokens",
    required: false,
    fallback: "Utile pour Recraft V3 SVG (logos vectoriels natifs) et comme secours si fal.ai est indisponible.",
  },
};

export function providerStatus() {
  const out = {};
  for (const [id, p] of Object.entries(PROVIDERS)) {
    out[id] = { ...p, configured: Boolean(process.env[p.env]) };
  }
  out.mock = {
    name: "Démo locale",
    env: null,
    role: "Génère des rendus factices (ffmpeg) pour tester la chaîne complète sans clé ni coût",
    configured: true,
    required: false,
  };
  return out;
}

export function hasProvider(id) {
  if (id === "mock") return true;
  const p = PROVIDERS[id];
  return Boolean(p && process.env[p.env]);
}

/** Fournisseur par défaut pour un modèle : fal > replicate > mock. */
export function defaultProvider() {
  if (process.env.STUDIO_FORCE_MOCK === "1") return "mock";
  if (hasProvider("fal")) return "fal";
  if (hasProvider("replicate")) return "replicate";
  return "mock";
}
