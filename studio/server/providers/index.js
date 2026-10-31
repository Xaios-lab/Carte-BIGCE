// Point d'entrée unique : exécute un modèle du catalogue sur son fournisseur
// (ou en mode démo), normalise la sortie et la sauvegarde localement.
import * as fal from "./fal.js";
import * as replicate from "./replicate.js";
import * as mock from "./mock.js";
import { byId, estimateCost } from "../catalog.js";
import { hasProvider, defaultProvider } from "../config.js";
import { saveAsset, toProviderUrl } from "../storage.js";

export { ProviderError } from "./fal.js";

/**
 * Lance un modèle du catalogue.
 * @param {string} modelId  identifiant du catalogue
 * @param {object} params   paramètres génériques (prompt, aspect, count, imageUrl, audioUrl, text, duration…)
 * @param {object} ctx      { jobId, log, baseName, forceMock }
 * @returns {Promise<Array<{kind, file, url, ...}>>}
 */
export async function generate(modelId, params, ctx = {}) {
  const model = byId(modelId);
  if (!model) throw new Error(`Modèle inconnu : ${modelId}`);
  const { jobId = "adhoc", log = () => {}, baseName = modelId } = ctx;
  const useMock = ctx.forceMock || defaultProvider() === "mock" || !hasProvider(model.provider);

  let assets;
  if (useMock) {
    assets = await mock.run(model, params, { jobId, log });
  } else {
    const p = { ...params, imageUrl: toProviderUrl(params.imageUrl), audioUrl: toProviderUrl(params.audioUrl), refImages: params.refImages?.map(toProviderUrl) };
    const input = JSON.parse(JSON.stringify(model.build(p))); // retire les undefined
    log(`${model.provider} → ${model.endpoint} (≈ ${estimateCost(model, params).toFixed(3)} $)`);
    const runner = model.provider === "fal" ? fal.run : replicate.run;
    const out = await runner(model.endpoint, input, { log });
    assets = model.parse(out).filter((a) => a.src);
    if (!assets.length) throw new Error(`${model.name} n'a renvoyé aucun fichier : ${JSON.stringify(out).slice(0, 300)}`);
  }
  const saved = [];
  for (let i = 0; i < assets.length; i++) {
    saved.push(await saveAsset(assets[i], jobId, `${baseName}${assets.length > 1 ? "-" + (i + 1) : ""}`));
  }
  return saved.map((a) => ({ ...a, model: model.id, modelName: model.name, cost: useMock ? 0 : estimateCost(model, params) / assets.length, mock: useMock }));
}
