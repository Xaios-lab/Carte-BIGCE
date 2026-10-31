// Serveur HTTP du studio : API JSON + flux SSE + fichiers statiques.
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { ROOT, PORT, OUTPUT_DIR, UPLOADS_DIR, USD_TO_XPF, providerStatus, defaultProvider } from "./config.js";
import { publicCatalog, byId, DEFAULTS, estimateCost } from "./catalog.js";
import { createJob, listJobs, getJob, deleteJob, bus } from "./jobs.js";
import { listBrands, getBrand, saveBrand, deleteBrand } from "./brands.js";
import { saveUpload } from "./storage.js";
import { generate } from "./providers/index.js";
import { claudeAvailable, CLAUDE_MODEL } from "./director.js";
import * as logo from "./pipelines/logo.js";
import * as image from "./pipelines/image.js";
import * as video from "./pipelines/video.js";
import * as ugc from "./pipelines/ugc.js";

const PIPELINES = { logo, image, video, ugc };
const app = express();
app.use(express.json({ limit: "60mb" }));
app.use("/outputs", express.static(OUTPUT_DIR));
app.use("/uploads", express.static(UPLOADS_DIR));
app.use(express.static(path.join(ROOT, "public")));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => res.status(e.status && e.status < 600 ? e.status : 500).json({ error: e.message }));

// ── État / configuration
app.get("/api/status", (req, res) => {
  res.json({ providers: providerStatus(), defaultProvider: defaultProvider(), claude: { available: claudeAvailable(), model: CLAUDE_MODEL }, usdToXpf: USD_TO_XPF, mockMode: defaultProvider() === "mock", version: JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version });
});
app.get("/api/catalog", (req, res) => res.json({ models: publicCatalog(), defaults: DEFAULTS }));

// ── Marques
app.get("/api/brands", (req, res) => res.json(listBrands()));
app.get("/api/brands/:id", (req, res) => { const b = getBrand(req.params.id); b ? res.json(b) : res.status(404).json({ error: "Marque introuvable" }); });
app.post("/api/brands", wrap((req, res) => res.json(saveBrand(req.body))));
app.delete("/api/brands/:id", (req, res) => { deleteBrand(req.params.id); res.json({ ok: true }); });

// ── Uploads (data URI base64)
app.post("/api/upload", wrap((req, res) => {
  const { data, name } = req.body;
  if (!data) throw Object.assign(new Error("Champ 'data' (data URI) requis"), { status: 400 });
  res.json(saveUpload(data, name));
}));

// ── Estimation de coût
app.post("/api/estimate/:kind", wrap((req, res) => {
  const pl = PIPELINES[req.params.kind];
  if (!pl) throw Object.assign(new Error("Pipeline inconnu"), { status: 404 });
  const est = pl.estimate(req.body || {});
  res.json({ ...est, xpf: Math.round(est.usd * USD_TO_XPF), mock: defaultProvider() === "mock" });
}));

// ── Lancement d'un pipeline
app.post("/api/generate/:kind", wrap((req, res) => {
  const pl = PIPELINES[req.params.kind];
  if (!pl) throw Object.assign(new Error("Pipeline inconnu"), { status: 404 });
  const params = req.body || {};
  if (!params.brief && !params.script) throw Object.assign(new Error("Le brief est obligatoire"), { status: 400 });
  const job = createJob(req.params.kind, params, (ctx) => { ctx.params.jobId = ctx.job.id; return pl.run(ctx); });
  res.status(202).json(job);
}));

// ── Appel direct d'un modèle (expert) : { model, params }
app.post("/api/run", wrap((req, res) => {
  const { model, params = {} } = req.body;
  const m = byId(model);
  if (!m) throw Object.assign(new Error("Modèle inconnu"), { status: 404 });
  const job = createJob("run", { ...params, title: `${m.name}` }, async (ctx) => {
    ctx.params.jobId = ctx.job.id;
    const assets = await ctx.step(m.name, () => generate(model, params, { jobId: ctx.job.id, log: ctx.log, baseName: model }));
    assets.forEach((a) => ctx.addOutput({ ...a, label: m.name }));
    return { count: assets.length };
  });
  res.status(202).json({ ...job, estimate: estimateCost(m, params) });
}));

// ── Jobs
app.get("/api/jobs", (req, res) => res.json(listJobs().map(({ logs, ...j }) => j)));
app.get("/api/jobs/:id", (req, res) => { const j = getJob(req.params.id); j ? res.json(j) : res.status(404).json({ error: "Job introuvable" }); });
app.delete("/api/jobs/:id", (req, res) => {
  const j = deleteJob(req.params.id);
  if (j && req.query.files === "1") fs.rmSync(path.join(OUTPUT_DIR, j.id), { recursive: true, force: true });
  res.json({ ok: true });
});
app.get("/api/jobs/:id/events", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(`event: snapshot\ndata: ${JSON.stringify(job)}\n\n`);
  const handler = (ev) => { if (ev.jobId === job.id) res.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`); };
  bus.on("event", handler);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => { bus.off("event", handler); clearInterval(ping); });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    const st = providerStatus();
    console.log(`\n🎬  Studio créa IA — http://localhost:${PORT}`);
    console.log(`    Fournisseur par défaut : ${defaultProvider()}${defaultProvider() === "mock" ? " (DÉMO : ajoutez FAL_KEY dans studio/.env pour générer en vrai)" : ""}`);
    console.log(`    Claude : ${claudeAvailable() ? CLAUDE_MODEL : "hors ligne (ANTHROPIC_API_KEY absente)"}`);
    for (const [id, p] of Object.entries(st)) if (p.env) console.log(`    ${p.configured ? "✔" : "✘"} ${p.name} (${p.env})`);
  });
}
export default app;
