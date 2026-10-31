// Adaptateur Replicate — https://replicate.com/docs/reference/http
import { ProviderError } from "./fal.js";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function token() {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) throw new ProviderError("REPLICATE_API_TOKEN manquant : ajoutez votre jeton Replicate dans studio/.env", { status: 401, provider: "replicate" });
  return t;
}

export async function run(endpoint, input, { log = () => {}, timeoutMs = 15 * 60_000, signal } = {}) {
  const headers = { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", Prefer: "wait=60" };
  // endpoint = "owner/model" (modèle officiel) ou "owner/model:version"
  const [model, version] = endpoint.split(":");
  const url = version ? "https://api.replicate.com/v1/predictions" : `https://api.replicate.com/v1/models/${model}/predictions`;
  const body = version ? { version, input } : { input };
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  if (!r.ok) {
    const txt = await r.text();
    throw new ProviderError(`Replicate ${endpoint} → HTTP ${r.status}: ${txt.slice(0, 500)}`, { status: r.status, provider: "replicate", body: txt });
  }
  let pred = await r.json();
  log(`Replicate: prédiction ${pred.id} (${pred.status})`);
  const started = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(pred.status)) {
    if (Date.now() - started > timeoutMs) throw new ProviderError(`Replicate : délai dépassé pour ${endpoint}`, { provider: "replicate" });
    await sleep(2500);
    const p = await fetch(pred.urls.get, { headers: { Authorization: headers.Authorization }, signal });
    pred = await p.json();
    if (pred.logs) { const last = pred.logs.trim().split("\n").pop(); if (last) log(`  ${last.slice(0, 160)}`); }
  }
  if (pred.status !== "succeeded") throw new ProviderError(`Replicate échec : ${pred.error || pred.status}`, { provider: "replicate" });
  return pred.output;
}
