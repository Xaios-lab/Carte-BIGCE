// Kits de marque : couleurs, logo, ton, audience. Stockés en JSON dans data/brands.
import fs from "node:fs";
import path from "node:path";
import { BRANDS_DIR } from "./config.js";

const SEED = {
  id: "big-ce",
  name: "BIG CE",
  tagline: "La carte avantages des salariés en Polynésie",
  description: "BIG CE est une carte de comité d'entreprise mutualisée en Polynésie française : elle donne aux salariés des entreprises adhérentes des réductions et avantages chez des centaines de partenaires locaux (loisirs, restaurants, voyages, shopping, bien-être).",
  audience: "Salariés et dirigeants de PME/TPE polynésiennes, DRH, partenaires commerçants. Public familial, 25–55 ans, Tahiti et îles.",
  tone: "Chaleureux, solaire, accessible, fier d'être local (« fenua »), dynamique mais jamais agressif. Tutoiement possible en UGC, vouvoiement en institutionnel.",
  primary: "#0b3d91",
  secondary: "#00a3e0",
  accent: "#ffb703",
  fonts: "Inter / Montserrat",
  language: "fr",
  region: "Polynésie française (Tahiti)",
  visualStyle: "Lumière tropicale, lagon, couleurs vives, personnes souriantes et diverses, carte BIG CE visible en main, décor local (Papeete, plages, marché), rendu photo moderne et premium.",
  avoid: "Clichés exotiques dégradants, stock photo générique, texte illisible, logos déformés.",
  cta: ["Demandez votre carte", "Rejoignez BIG CE", "Découvrez les avantages"],
  logo: null,
  references: ["https://www.big-ce.pf/sites/default/files/2024-12/Carte-2025-Recto.png", "https://www.big-ce.pf/sites/default/files/2024-12/Carte-2025-Verso.png"],
  createdAt: Date.now(),
};

export function listBrands() {
  fs.mkdirSync(BRANDS_DIR, { recursive: true });
  const files = fs.readdirSync(BRANDS_DIR).filter((f) => f.endsWith(".json"));
  if (!files.length) { saveBrand(SEED); return [SEED]; }
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(BRANDS_DIR, f), "utf8")));
}

export function getBrand(id) {
  if (!id) return null;
  listBrands(); // garantit l'amorçage du kit BIG CE au premier démarrage
  const f = path.join(BRANDS_DIR, `${id.replace(/[^a-z0-9-]/gi, "")}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}

export function saveBrand(b) {
  const id = (b.id || b.name || "marque").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const brand = { ...b, id, updatedAt: Date.now(), createdAt: b.createdAt || Date.now() };
  fs.writeFileSync(path.join(BRANDS_DIR, `${id}.json`), JSON.stringify(brand, null, 2));
  return brand;
}

export function deleteBrand(id) {
  const f = path.join(BRANDS_DIR, `${id.replace(/[^a-z0-9-]/gi, "")}.json`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

/** Résumé textuel du kit de marque injecté dans les prompts. */
export function brandBrief(b) {
  if (!b) return "";
  return [
    `Marque : ${b.name}${b.tagline ? ` — « ${b.tagline} »` : ""}`,
    b.description && `Description : ${b.description}`,
    b.audience && `Audience : ${b.audience}`,
    b.tone && `Ton : ${b.tone}`,
    `Couleurs : primaire ${b.primary}, secondaire ${b.secondary}, accent ${b.accent}`,
    b.visualStyle && `Style visuel : ${b.visualStyle}`,
    b.avoid && `À éviter : ${b.avoid}`,
    b.region && `Région : ${b.region}`,
  ].filter(Boolean).join("\n");
}
