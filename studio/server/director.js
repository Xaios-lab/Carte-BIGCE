// Directeur créatif : transforme un brief + kit de marque en concepts, prompts,
// scripts et storyboards. Utilise Claude (sorties structurées) si une clé
// ANTHROPIC_API_KEY est présente, sinon un repli hors ligne à base de gabarits.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { brandBrief } from "./brands.js";

export const CLAUDE_MODEL = process.env.STUDIO_CLAUDE_MODEL || "claude-opus-5-5";

const SYSTEM = `Tu es le directeur créatif senior d'un studio publicitaire haut de gamme, expert en :
- stratégie de marque, copywriting publicitaire (français courant, naturel, sans anglicismes inutiles),
- écriture de scripts vidéo courts (promo 15–60 s, UGC TikTok/Reels/Shorts) avec hook fort dans les 2 premières secondes,
- prompt engineering pour modèles de diffusion image (FLUX, Qwen-Image, Recraft, Seedream) et vidéo (Wan, LTX-2, Kling, Veo).

Règles :
- Les PROMPTS destinés aux modèles image/vidéo sont écrits EN ANGLAIS, descriptifs et concrets : sujet, action, décor, lumière, objectif/caméra, style, palette. Pas de texte à rendre dans l'image sauf si explicitement demandé (alors mettre le texte exact entre guillemets doubles). Mentionne les couleurs de la marque par leur nom/hex.
- Les textes destinés aux humains (voix off, titres, sous-titres, CTA, légendes) sont EN FRANÇAIS, sauf si le brief impose une autre langue.
- Respecte le ton et les interdits du kit de marque. Évite les clichés et le jargon.
- Pour les vidéos : chaque scène = un plan unique, filmable en 4–8 s, avec un mouvement de caméra simple décrit dans motionPrompt. La voix off d'une scène se lit en ≤ durée de la scène (≈ 2,5 mots/seconde).
- Pour l'UGC : première personne, parlé, authentique, imperfections de langage légères, pas de ton publicitaire.
Réponds uniquement avec le JSON demandé.`;

// ───────────── Schémas ─────────────
export const LogoConceptsSchema = z.object({
  concepts: z.array(z.object({
    name: z.string().describe("Nom court du concept"),
    rationale: z.string().describe("Pourquoi ce concept sert la marque (2 phrases)"),
    prompt: z.string().describe("Prompt anglais pour le modèle image, style logo vectoriel, fond uni"),
    negativePrompt: z.string(),
    palette: z.array(z.string()).describe("Couleurs hex"),
    style: z.enum(["vector_illustration", "digital_illustration", "realistic_image"]),
    typography: z.string().describe("Recommandation typographique"),
  })),
});

export const AdCreativeSchema = z.object({
  headline: z.string().describe("Titre percutant ≤ 8 mots"),
  subline: z.string().describe("Sous-titre ≤ 16 mots"),
  cta: z.string().describe("Appel à l'action ≤ 4 mots"),
  imagePrompt: z.string().describe("Prompt anglais de la scène, sans texte"),
  negativePrompt: z.string(),
  altText: z.string(),
  variants: z.array(z.object({ headline: z.string(), cta: z.string() })).describe("2 variantes A/B"),
});

export const PromoScriptSchema = z.object({
  title: z.string(),
  hook: z.string().describe("Accroche des 2 premières secondes"),
  scenes: z.array(z.object({
    index: z.number().int(),
    durationSec: z.number().describe("4 à 8"),
    visualPrompt: z.string().describe("Prompt anglais de l'image clé"),
    motionPrompt: z.string().describe("Prompt anglais du mouvement (caméra, action) pour l'image→vidéo"),
    voiceover: z.string().describe("Voix off française, ≤ 2,5 mots/s"),
    onScreenText: z.string().describe("Texte à l'écran, ≤ 6 mots, ou vide"),
    soundDesign: z.string(),
  })),
  outro: z.string().describe("Phrase de clôture / CTA"),
  musicMood: z.string().describe("Tags anglais pour un générateur de musique"),
  caption: z.string().describe("Légende réseaux sociaux"),
  hashtags: z.array(z.string()),
});

export const UgcScriptSchema = z.object({
  persona: z.object({
    name: z.string(),
    description: z.string().describe("Qui parle, âge, situation, pourquoi crédible"),
    imagePrompt: z.string().describe("Prompt anglais : portrait selfie vertical, cadrage buste, regard caméra, lumière naturelle, fond réaliste local"),
  }),
  hook: z.string().describe("Première phrase parlée, ≤ 12 mots"),
  script: z.string().describe("Texte parlé complet en français, première personne"),
  cta: z.string(),
  onScreenHooks: z.array(z.string()).describe("2–3 textes courts à afficher"),
  caption: z.string(),
  hashtags: z.array(z.string()),
  estimatedSeconds: z.number(),
});

// ───────────── Client Claude ─────────────
let client;
export function claudeAvailable() { return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN); }
function getClient() { return (client ||= new Anthropic()); }

async function ask(schema, user, { log = () => {} } = {}) {
  const c = getClient();
  log(`Claude (${CLAUDE_MODEL}) : rédaction en cours…`);
  const res = await c.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: user }],
  });
  if (res.stop_reason === "refusal") throw new Error(`Claude a refusé la demande (${res.stop_details?.category || "politique"})`);
  if (res.stop_reason === "max_tokens") throw new Error("Réponse Claude tronquée (max_tokens)");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = schema.parse(JSON.parse(text));
  const u = res.usage;
  log(`Claude : ${u.input_tokens} tokens entrée, ${u.output_tokens} sortie`);
  return parsed;
}

// ───────────── Repli hors ligne ─────────────
const ucfirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lcfirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
function colors(brand) { return `${brand?.primary || "#0b3d91"} (primary), ${brand?.secondary || "#00a3e0"} (secondary), ${brand?.accent || "#ffb703"} (accent)`; }
function styleHint(brand) { return brand?.visualStyle ? `, ${brand.visualStyle.slice(0, 220)}` : ""; }

const offline = {
  logo(brief, brand, n) {
    const name = brand?.name || "la marque";
    const base = [
      ["Monogramme", `minimalist flat vector logo, bold geometric monogram of the initials of "${name}", clean negative space, single-color on white background, ${colors(brand)}, no text`],
      ["Emblème", `modern emblem logo for "${name}", rounded badge shape, stylized symbol inspired by ${brief}, flat vector, two colors ${colors(brand)}, white background, no text`],
      ["Symbole abstrait", `abstract dynamic logo mark, flowing shapes suggesting ${brief}, gradient from ${brand?.primary || "#0b3d91"} to ${brand?.secondary || "#00a3e0"}, flat vector, centered on white background, no text`],
      ["Mascotte", `friendly simple mascot logo inspired by ${brief}, flat vector illustration, thick outlines, ${colors(brand)}, white background, no text`],
      ["Lettrage", `custom wordmark logo "${name}", bold rounded sans-serif lettering, playful ligature, ${brand?.primary || "#0b3d91"} on white background, vector`],
      ["Pictogramme", `iconic pictogram logo, single continuous line art representing ${brief}, ${brand?.primary || "#0b3d91"}, flat vector, white background, no text`],
    ];
    return { concepts: base.slice(0, n).map(([nm, prompt]) => ({ name: nm, rationale: `Concept ${nm.toLowerCase()} : lisible à petite taille, cohérent avec le ton « ${(brand?.tone || "moderne").split(",")[0]} ».`, prompt, negativePrompt: "photo, realistic, 3d render, shadows, gradients mesh, text, watermark, blurry, complex details", palette: [brand?.primary, brand?.secondary, brand?.accent].filter(Boolean), style: "vector_illustration", typography: brand?.fonts || "Sans-serif géométrique (Inter, Montserrat)" })) };
  },
  ad(brief, brand) {
    const name = brand?.name || "Notre marque";
    return {
      headline: ucfirst(brief.length < 40 ? brief : `${name} : ${brief.split(/[.,;]/)[0].slice(0, 36)}`),
      subline: brand?.tagline || "Des avantages concrets, chaque jour.",
      cta: brand?.cta?.[0] || "En savoir plus",
      imagePrompt: `professional advertising photograph, ${brief}, happy diverse people, bright natural light, premium commercial look, color palette ${colors(brand)}${styleHint(brand)}, sharp focus, no text`,
      negativePrompt: "text, watermark, logo, blurry, deformed hands, low quality",
      altText: `Visuel publicitaire ${name} : ${brief}`,
      variants: [{ headline: `${name}, c'est maintenant`, cta: brand?.cta?.[1] || "Je découvre" }, { headline: "Profitez-en dès aujourd'hui", cta: brand?.cta?.[2] || "Rejoignez-nous" }],
    };
  },
  promo(brief, brand, { duration = 30, scenes: n }) {
    const name = brand?.name || "la marque";
    const count = n || Math.max(3, Math.min(8, Math.round(duration / 5)));
    const per = Math.round((duration / count) * 10) / 10;
    const beats = [
      ["Hook : problème ou désir", `cinematic close-up of a smiling person looking at their phone with surprise, ${brief}`, "slow push-in, shallow depth of field", `Et si ${lcfirst(brief)} devenait simple ?`, "Et si c'était simple ?"],
      ["Présentation", `wide establishing shot, ${brand?.region || "a sunny city"}, people enjoying life, ${brief}`, "smooth drone-style lateral glide", `Avec ${name}, ${brand?.tagline?.toLowerCase() || "vous profitez de vrais avantages"}.`, name],
      ["Bénéfice 1", `medium shot, person showing a card at a shop counter, friendly cashier, warm light, ${colors(brand)} accents`, "gentle handheld, slight orbit", "Des réductions chez des centaines de partenaires.", "-20 % partenaires"],
      ["Bénéfice 2", `family having fun outdoors, lagoon and palm trees, joyful, golden hour`, "slow tracking shot following the family", "Loisirs, restaurants, voyages : tout y est.", "Loisirs · Resto · Voyages"],
      ["Preuve", `group of coworkers laughing in a modern office, one holds a colorful membership card`, "static then subtle zoom", "Déjà des milliers de salariés en profitent.", "Ils en profitent déjà"],
      ["CTA", `clean product shot of a membership card floating on a gradient background ${colors(brand)}, studio lighting`, "card rotates slowly, light sweep", `${brand?.cta?.[0] || "Rejoignez-nous"} dès aujourd'hui.`, brand?.cta?.[0] || "Rejoignez-nous"],
      ["Bénéfice 3", `person paying with a smile at a restaurant terrace by the sea, sunset`, "slow dolly out", "Et ça, c'est tous les jours.", "Tous les jours"],
      ["Communauté", `diverse community of workers in a sunny plaza waving, upbeat`, "crane up revealing the plaza", "Une communauté qui grandit.", "Ensemble"],
    ];
    const order = count <= 3 ? [0, 1, 5] : count === 4 ? [0, 1, 2, 5] : count === 5 ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5, 6, 7].slice(0, count - 1).concat(5);
    return {
      title: `${name} — ${ucfirst(brief).slice(0, 60)}`,
      hook: beats[0][3],
      scenes: order.map((b, i) => ({ index: i + 1, durationSec: per, visualPrompt: `${beats[b][1]}, premium commercial photography${styleHint(brand)}, no text`, motionPrompt: beats[b][2], voiceover: beats[b][3], onScreenText: beats[b][4], soundDesign: i === 0 ? "soft whoosh, ambient" : "ambient, light foley" })),
      outro: `${brand?.cta?.[0] || "Rejoignez-nous"} — ${name}.`,
      musicMood: "upbeat tropical pop, ukulele, light percussion, positive, corporate friendly, instrumental",
      caption: `${ucfirst(brief)} avec ${name}. ${brand?.cta?.[0] || "Rejoignez-nous"} 👉`,
      hashtags: [`#${name.replace(/\s+/g, "")}`, "#avantages", "#fenua", "#Tahiti"],
    };
  },
  ugc(brief, brand, { duration = 25, persona } = {}) {
    const name = brand?.name || "cette carte";
    const script = `Franchement, je pensais que ${lcfirst(brief)} c'était pas pour moi. Et puis ma boîte m'a donné la carte ${name}. Depuis, le resto du vendredi, les sorties avec les enfants, même le billet pour Moorea… j'ai des réductions partout. Je vous jure, j'ai calculé : c'est plusieurs milliers de francs économisés chaque mois. Si votre entreprise ne l'a pas encore, demandez-la, sérieux. ${brand?.cta?.[0] || "Rejoignez-nous"}.`;
    return {
      persona: { name: persona?.name || "Hina", description: persona?.description || "Salariée polynésienne de 32 ans, mère de deux enfants, pragmatique, parle comme à ses amis.", imagePrompt: persona?.imagePrompt || `vertical selfie-style portrait photo of a friendly Polynesian woman in her early thirties, natural makeup, casual colorful top, looking at camera, soft natural daylight, blurred home or terrace background with tropical plants, smartphone front camera look, realistic skin texture, 9:16` },
      hook: `Je pensais que ${lcfirst(brief)} c'était pas pour moi…`,
      script,
      cta: brand?.cta?.[0] || "Demandez votre carte",
      onScreenHooks: ["Je pensais que c'était pas pour moi 😅", "Des réductions PARTOUT", `${brand?.cta?.[0] || "Demandez-la"} 👇`],
      caption: `POV : tu découvres ${name} 😍 ${brief}`,
      hashtags: [`#${name.replace(/\s+/g, "")}`, "#bonplan", "#Tahiti", "#fenua", "#salarié"],
      estimatedSeconds: Math.round(script.split(/\s+/).length / 2.5),
    };
  },
};

// ───────────── API publique ─────────────
function userMsg(kind, brief, brand, extra) {
  return `${brandBrief(brand)}\n\nBRIEF (${kind}) : ${brief}\n${extra ? `\nCONTRAINTES : ${extra}` : ""}`;
}

export async function logoConcepts(brief, brand, { count = 4, log } = {}) {
  if (!claudeAvailable()) { log?.("Directeur créatif hors ligne (pas de clé Claude) : concepts génériques"); return offline.logo(brief, brand, count); }
  return ask(LogoConceptsSchema, userMsg("logo", brief, brand, `Propose exactement ${count} concepts de logo très différents (monogramme, symbole, emblème, lettrage…). Prompts pour un modèle vectoriel : fond blanc uni, aplats, pas de texte sauf si le concept est un lettrage (alors texte exact entre guillemets).`), { log });
}

export async function adCreative(brief, brand, { format = "1:1", log } = {}) {
  if (!claudeAvailable()) { log?.("Directeur créatif hors ligne : accroche générique"); return offline.ad(brief, brand); }
  return ask(AdCreativeSchema, userMsg("visuel publicitaire", brief, brand, `Format ${format}. Le titre et le CTA seront incrustés par nous : le prompt image ne doit contenir AUCUN texte et laisser de l'espace en bas pour un bandeau.`), { log });
}

export async function promoScript(brief, brand, { duration = 30, scenes, aspect = "16:9", log } = {}) {
  if (!claudeAvailable()) { log?.("Directeur créatif hors ligne : storyboard gabarit"); return offline.promo(brief, brand, { duration, scenes }); }
  const n = scenes || Math.max(3, Math.min(8, Math.round(duration / 5)));
  return ask(PromoScriptSchema, userMsg("vidéo promotionnelle", brief, brand, `Durée totale ≈ ${duration} s, exactement ${n} scènes, format ${aspect}. Les images clés seront générées par un modèle image puis animées (image→vidéo) : visualPrompt décrit un plan fixe parfait, motionPrompt le mouvement. Dernière scène = CTA.`), { log });
}

export async function ugcScript(brief, brand, { duration = 25, persona, log } = {}) {
  if (!claudeAvailable()) { log?.("Directeur créatif hors ligne : script UGC gabarit"); return offline.ugc(brief, brand, { duration, persona }); }
  return ask(UgcScriptSchema, userMsg("vidéo UGC (témoignage face caméra)", brief, brand, `Durée parlée ≈ ${duration} s (${Math.round(duration * 2.5)} mots max). ${persona ? `Persona imposé : ${JSON.stringify(persona)}` : "Invente un persona crédible pour l'audience."} Vertical 9:16.`), { log });
}
