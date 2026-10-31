// Pipeline LOGO : brief → concepts (directeur créatif) → images vectorielles →
// (option) détourage PNG transparent → (option) SVG.
import { generate } from "../providers/index.js";
import { logoConcepts } from "../director.js";
import { getBrand } from "../brands.js";
import { byId, DEFAULTS, estimateCost } from "../catalog.js";

export function estimate(p) {
  const model = byId(p.model || DEFAULTS.logo.standard);
  const n = (p.concepts || 4) * (p.variantsPerConcept || 1);
  let usd = estimateCost(model, { count: n });
  if (p.transparent) usd += estimateCost(byId("bg-remove"), { count: n });
  if (p.svg && !model?.svg) usd += estimateCost(byId("vectorize"), { count: n });
  return { usd, items: n, model: model?.name };
}

export async function run({ params: p, log, step, progress, addOutput, setResult }) {
  const brand = getBrand(p.brandId);
  const modelId = p.model || DEFAULTS.logo.standard;
  const model = byId(modelId);
  const nConcepts = Math.min(8, Math.max(1, p.concepts || 4));
  const perConcept = Math.min(4, Math.max(1, p.variantsPerConcept || 1));

  const { concepts } = await step("Concepts créatifs", () => logoConcepts(p.brief, brand, { count: nConcepts, log }));
  setResult({ concepts });
  progress(15, "Génération des logos");

  const results = [];
  for (let i = 0; i < concepts.length; i++) {
    const c = concepts[i];
    const prompt = `${c.prompt}${p.extraPrompt ? ", " + p.extraPrompt : ""}`;
    const assets = await step(`Logo ${i + 1}/${concepts.length} — ${c.name}`, () =>
      generate(modelId, { prompt, negative: c.negativePrompt, aspect: "1:1", count: perConcept, style: c.style, colors: c.palette?.map(hexToRgb).filter(Boolean) }, { jobId: p.jobId, log, baseName: `logo-${i + 1}-${slug(c.name)}` }));
    for (const a of assets) {
      let final = a;
      if (p.transparent && !model?.svg) {
        const [cut] = await generate("bg-remove", { refImages: [a.url || a.file], aspect: "1:1" }, { jobId: p.jobId, log, baseName: `logo-${i + 1}-${slug(c.name)}-transparent` });
        final = { ...cut, source: a.url };
      }
      if (p.svg && !model?.svg) {
        const [svg] = await generate("vectorize", { refImages: [final.url || final.file], aspect: "1:1" }, { jobId: p.jobId, log, baseName: `logo-${i + 1}-${slug(c.name)}-vector` });
        addOutput({ ...svg, concept: c.name, kind: "image", label: `${c.name} (SVG)` });
      }
      addOutput({ ...final, concept: c.name, label: c.name, rationale: c.rationale, typography: c.typography, palette: c.palette });
      results.push(final);
    }
    progress(15 + ((i + 1) / concepts.length) * 80);
  }
  return { concepts, count: results.length };
}

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || "");
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 30);
