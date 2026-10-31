// Fournisseur démo : produit des rendus factices localement (aucune clé, aucun coût).
import path from "node:path";
import { placeholderImage, placeholderVideo, placeholderSpeech } from "../media.js";
import { ASPECTS } from "../catalog.js";
import os from "node:os";
import fs from "node:fs";
import { uid, resolveLocal } from "../storage.js";

export async function run(model, params, { jobId, log = () => {} } = {}) {
  const dir = path.join(os.tmpdir(), "studio-mock");
  fs.mkdirSync(dir, { recursive: true });
  const name = `mock-${model.id}-${uid(3)}`;
  log(`démo : simulation de ${model.name}`);
  await new Promise((r) => setTimeout(r, 300));
  switch (model.task) {
    case "image": case "image-edit": case "bg-remove": case "upscale": case "vectorize": {
      const d = ASPECTS[params.aspect] || ASPECTS["1:1"];
      const n = params.count || 1;
      const out = [];
      for (let i = 0; i < n; i++) {
        const f = path.join(dir, `${name}-${i}.png`);
        await placeholderImage(f, { text: `[${model.name}]\n${params.prompt || model.task}`, w: Math.round(d.w / 2), h: Math.round(d.h / 2), color: params.colorHex ? "0x" + params.colorHex.replace("#", "") : "0x1f2a44" });
        out.push({ kind: "image", src: f, mime: "image/png", width: d.w, height: d.h });
      }
      return out;
    }
    case "video-t2v": case "video-i2v": case "avatar": {
      const vertical = params.aspect === "9:16";
      const f = path.join(dir, `${name}.mp4`);
      const audio = params.audioUrl ? resolveLocal(params.audioUrl) : null;
      await placeholderVideo(f, { text: `[${model.name}]\n${params.prompt || ""}`, w: vertical ? 540 : 960, h: vertical ? 960 : 540, duration: params.duration || 5, audio });
      return [{ kind: "video", src: f, mime: "video/mp4" }];
    }
    case "tts": {
      const f = path.join(dir, `${name}.m4a`);
      await placeholderSpeech(f, params.text || "");
      return [{ kind: "audio", src: f, mime: "audio/mp4" }];
    }
    case "music": {
      const f = path.join(dir, `${name}.m4a`);
      await placeholderSpeech(f, "x".repeat((params.duration || 30) * 15));
      return [{ kind: "audio", src: f, mime: "audio/mp4" }];
    }
    default:
      throw new Error(`démo : tâche inconnue ${model.task}`);
  }
}
