import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
process.env.STUDIO_FORCE_MOCK = "1";
process.env.NODE_ENV = "test";
process.env.STUDIO_DATA_DIR = "/tmp/studio-test-data";
fs.rmSync(process.env.STUDIO_DATA_DIR, { recursive: true, force: true });

const { createJob, getJob } = await import("../server/jobs.js");
const logo = await import("../server/pipelines/logo.js");
const image = await import("../server/pipelines/image.js");
const video = await import("../server/pipelines/video.js");
const ugc = await import("../server/pipelines/ugc.js");
const { probe } = await import("../server/media.js");

function runJob(kind, params, pl) {
  return new Promise((resolve) => {
    const job = createJob(kind, params, (ctx) => { ctx.params.jobId = ctx.job.id; return pl.run(ctx); });
    const t = setInterval(() => { const j = getJob(job.id); if (j.status === "done" || j.status === "failed") { clearInterval(t); resolve(j); } }, 150);
  });
}

test("logo pipeline (démo)", async () => {
  const j = await runJob("logo", { brief: "carte avantages salariés Polynésie", brandId: "big-ce", concepts: 2, transparent: true, svg: true }, logo);
  assert.equal(j.status, "done", j.error);
  assert.ok(j.outputs.length >= 4, "2 concepts × (png + svg)");
  for (const o of j.outputs) assert.ok(fs.existsSync(o.file), o.file);
});

test("image pipeline (démo) avec habillage", async () => {
  const j = await runJob("image", { brief: "offre de rentrée -20% chez nos partenaires", brandId: "big-ce", formats: ["1:1", "9:16"], headline: "-20 % chez 300 partenaires" }, image);
  assert.equal(j.status, "done", j.error);
  const dressed = j.outputs.filter((o) => o.label.includes("habillé"));
  assert.equal(dressed.length, 2);
  const info = await probe(dressed[1].file);
  assert.ok(Math.abs(info.width / info.height - 9 / 16) < 0.02, `ratio ${info.width}x${info.height}`);
});

test("video pipeline (démo) : montage, sous-titres, 9:16", async () => {
  const j = await runJob("video", { brief: "lancement de la carte 2026", brandId: "big-ce", duration: 15, scenes: 3, aspect: "9:16", music: "none" }, video);
  assert.equal(j.status, "done", j.error);
  const final = j.outputs.find((o) => o.final);
  assert.ok(final && fs.existsSync(final.file));
  const info = await probe(final.file);
  assert.equal(info.width, 1080); assert.equal(info.height, 1920);
  assert.ok(info.hasAudio && info.duration > 5, `durée ${info.duration}`);
  assert.ok(j.outputs.some((o) => o.label.startsWith("Sous-titres")));
}, { timeout: 120000 });

test("ugc pipeline (démo) : route avatar", async () => {
  const j = await runJob("ugc", { brief: "la carte BIG CE au quotidien", brandId: "big-ce", duration: 12 }, ugc);
  assert.equal(j.status, "done", j.error);
  const final = j.outputs.find((o) => o.final);
  assert.ok(final && fs.existsSync(final.file));
  const info = await probe(final.file);
  assert.equal(info.width, 1080); assert.ok(info.hasAudio);
}, { timeout: 120000 });

test("estimations de coût", () => {
  assert.ok(video.estimate({ duration: 30 }).usd > 0.5);
  assert.ok(logo.estimate({ concepts: 4 }).usd > 0.1);
  assert.ok(ugc.estimate({ duration: 25 }).usd > 0.5);
  assert.ok(image.estimate({ formats: ["1:1", "9:16", "16:9"] }).items === 3);
});
