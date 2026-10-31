// Pipeline VISUEL PUBLICITAIRE : brief → accroche + prompt → image(s) par format →
// habillage (bandeau marque, titre, CTA, logo) → déclinaisons.
import path from "node:path";
import { generate } from "../providers/index.js";
import { adCreative } from "../director.js";
import { getBrand } from "../brands.js";
import { byId, DEFAULTS, estimateCost } from "../catalog.js";
import { overlayAd } from "../media.js";
import { jobDir, publicUrl, resolveLocal } from "../storage.js";

export function estimate(p) {
  const model = byId(p.model || DEFAULTS.image.standard);
  const n = (p.formats?.length || 1) * (p.count || 1);
  return { usd: estimateCost(model, { count: n }), items: n, model: model?.name };
}

export async function run({ params: p, log, step, progress, addOutput, setResult }) {
  const brand = getBrand(p.brandId);
  const formats = p.formats?.length ? p.formats : ["1:1"];
  const modelId = p.model || (p.refImages?.length ? DEFAULTS["image-edit"].standard : DEFAULTS.image.standard);

  const creative = await step("Accroche et direction artistique", () => adCreative(p.brief, brand, { format: formats[0], log }));
  if (p.headline) creative.headline = p.headline;
  if (p.cta) creative.cta = p.cta;
  setResult({ creative });
  progress(15, "Génération des visuels");

  const prompt = `${creative.imagePrompt}${p.extraPrompt ? ", " + p.extraPrompt : ""}`;
  const logoFile = resolveLocal(brand?.logo);
  let done = 0;
  for (const aspect of formats) {
    const assets = await step(`Visuel ${aspect}`, () =>
      generate(modelId, { prompt, negative: creative.negativePrompt, aspect, count: p.count || 1, refImages: p.refImages }, { jobId: p.jobId, log, baseName: `visuel-${aspect.replace(":", "x")}` }));
    for (const a of assets) {
      addOutput({ ...a, label: `Fond ${aspect}`, aspect, kind: "image" });
      if (p.overlay !== false) {
        const out = path.join(jobDir(p.jobId), path.basename(a.file).replace(/\.(\w+)$/, "-habille.png"));
        try {
          await overlayAd(a.file, out, { headline: creative.headline, cta: creative.cta, brand, logo: logoFile });
          addOutput({ kind: "image", file: out, url: publicUrl(out), label: `Visuel ${aspect} habillé`, aspect, headline: creative.headline, cta: creative.cta });
        } catch (e) { log(`Habillage impossible (${e.message.split("\n")[0]})`); }
      }
    }
    done++;
    progress(15 + (done / formats.length) * 80);
  }
  return { creative };
}
