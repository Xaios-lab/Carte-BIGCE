// File de travaux : exécution asynchrone, journal, progression, persistance JSON, flux SSE.
import fs from "node:fs";
import path from "node:path";
import { EventEmitter } from "node:events";
import { DATA_DIR } from "./config.js";
import { uid } from "./storage.js";

const FILE = path.join(DATA_DIR, "jobs.json");
const jobs = new Map();
export const bus = new EventEmitter();
bus.setMaxListeners(200);

try {
  if (fs.existsSync(FILE)) for (const j of JSON.parse(fs.readFileSync(FILE, "utf8"))) {
    if (j.status === "running" || j.status === "queued") { j.status = "failed"; j.error = "Interrompu par un redémarrage du serveur"; }
    jobs.set(j.id, j);
  }
} catch { /* fichier corrompu : on repart à vide */ }

let saveTimer;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const arr = [...jobs.values()].slice(-300);
    fs.writeFileSync(FILE, JSON.stringify(arr, null, 1));
  }, 200);
}

function emit(job, type, data) {
  bus.emit("event", { jobId: job.id, type, data, at: Date.now() });
  persist();
}

export function listJobs() { return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt); }
export function getJob(id) { return jobs.get(id); }
export function deleteJob(id) { const j = jobs.get(id); jobs.delete(id); persist(); return j; }

/**
 * Crée et lance un job. `runner(ctx)` reçoit { job, log, step, progress, params } et renvoie le résultat.
 */
export function createJob(kind, params, runner) {
  const job = { id: `${kind}-${Date.now().toString(36)}-${uid(2)}`, kind, params, status: "queued", logs: [], steps: [], outputs: [], cost: 0, progress: 0, createdAt: Date.now(), title: params.title || params.brief?.slice(0, 80) || kind };
  jobs.set(job.id, job);
  persist();

  const ctx = {
    job,
    params,
    log: (msg) => { const line = `[${new Date().toLocaleTimeString("fr-FR")}] ${msg}`; job.logs.push(line); if (job.logs.length > 400) job.logs.shift(); emit(job, "log", line); },
    progress: (p, label) => { job.progress = Math.max(0, Math.min(100, Math.round(p))); if (label) job.stage = label; emit(job, "progress", { progress: job.progress, stage: job.stage }); },
    step: async (name, fn) => {
      const s = { name, status: "running", startedAt: Date.now() };
      job.steps.push(s); emit(job, "step", s); ctx.log(`▶ ${name}`);
      try { const r = await fn(); s.status = "done"; s.endedAt = Date.now(); emit(job, "step", s); return r; }
      catch (e) { s.status = "failed"; s.error = e.message; s.endedAt = Date.now(); emit(job, "step", s); throw e; }
    },
    addOutput: (o) => { job.outputs.push(o); if (o.cost) job.cost += o.cost; emit(job, "output", o); },
    setResult: (r) => { job.result = r; emit(job, "result", r); },
  };

  setImmediate(async () => {
    job.status = "running"; job.startedAt = Date.now(); emit(job, "status", "running");
    try {
      const result = await runner(ctx);
      if (result !== undefined) job.result = result;
      job.status = "done"; job.progress = 100; job.endedAt = Date.now();
      ctx.log(`✔ Terminé (coût estimé ${job.cost.toFixed(3)} $)`);
      emit(job, "status", "done");
    } catch (e) {
      job.status = "failed"; job.error = e.message; job.endedAt = Date.now();
      ctx.log(`✖ Échec : ${e.message}`);
      emit(job, "status", "failed");
    }
  });
  return job;
}
