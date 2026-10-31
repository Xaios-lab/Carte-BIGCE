// Pipeline UGC : brief → script parlé + persona → portrait (ou photo fournie) →
// voix → avatar parlant (image + audio → vidéo) OU vidéo « parole native »
// (Wan 2.5 / Veo) → habillage vertical (hooks texte, sous-titres) → MP4.
import fs from "node:fs";
import path from "node:path";
import { generate } from "../providers/index.js";
import { ugcScript } from "../director.js";
import { getBrand } from "../brands.js";
import { byId, DEFAULTS, estimateCost } from "../catalog.js";
import { assembleVideo, thumbnail, probe } from "../media.js";
import { jobDir, publicUrl, resolveLocal } from "../storage.js";

export function estimate(p) {
  const duration = p.duration || 25;
  const route = p.route || "avatar";
  let usd = 0;
  const models = [];
  if (!p.personaImage) { const m = byId(p.imageModel || DEFAULTS.image.premium); usd += estimateCost(m, { count: 1 }); models.push(m?.name); }
  if (route === "avatar") {
    const tts = byId(p.ttsModel || DEFAULTS.tts.premium); usd += estimateCost(tts, { text: "x".repeat(duration * 15) }); models.push(tts?.name);
    const av = byId(p.avatarModel || DEFAULTS.avatar.standard); usd += estimateCost(av, { duration }); models.push(av?.name);
  } else {
    const v = byId(p.videoModel || "wan25-i2v"); const n = Math.ceil(duration / 10); usd += n * estimateCost(v, { duration: 10, resolution: "720p" }); models.push(`${v?.name} × ${n}`);
  }
  return { usd, models };
}

export async function run({ params: p, log, step, progress, addOutput, setResult }) {
  const brand = getBrand(p.brandId);
  const duration = p.duration || 25;
  const route = p.route || "avatar";
  const dir = jobDir(p.jobId);

  const script = p.script || await step("Script UGC et persona", () => ugcScript(p.brief, brand, { duration, persona: p.persona, log }));
  fs.writeFileSync(path.join(dir, "script-ugc.json"), JSON.stringify(script, null, 2));
  addOutput({ kind: "json", file: path.join(dir, "script-ugc.json"), url: publicUrl(path.join(dir, "script-ugc.json")), label: "Script UGC (JSON)" });
  setResult({ script });
  progress(10, "Persona");

  let portrait;
  if (p.personaImage) {
    const local = resolveLocal(p.personaImage);
    portrait = { file: local, url: p.personaImage };
    log("Portrait fourni par l'utilisateur (vérifiez d'avoir le droit à l'image de la personne).");
  } else {
    [portrait] = await step("Portrait du persona", () => generate(p.imageModel || DEFAULTS.image.premium, { prompt: script.persona.imagePrompt, aspect: "9:16", count: 1 }, { jobId: p.jobId, log, baseName: "persona" }));
    addOutput({ ...portrait, label: `Persona — ${script.persona.name}` });
  }
  progress(25, "Voix");

  const scenes = [];
  if (route === "avatar") {
    const [voice] = await step("Voix (TTS)", () => generate(p.ttsModel || DEFAULTS.tts.premium, { text: script.script, voice: p.voice }, { jobId: p.jobId, log, baseName: "voix-ugc" }));
    addOutput({ ...voice, label: "Voix UGC" });
    const vdur = (await probe(voice.file)).duration;
    progress(40, "Avatar parlant");
    const [talking] = await step("Avatar parlant (lip-sync)", () => generate(p.avatarModel || DEFAULTS.avatar.standard, { imageUrl: portrait.url || portrait.file, audioUrl: voice.url || voice.file, prompt: `${script.persona.description}. Talking to the camera, natural gestures, vertical selfie video`, aspect: "9:16", duration: Math.ceil(vdur) + 1, resolution: p.resolution || "480p" }, { jobId: p.jobId, log, baseName: "ugc-avatar" }));
    addOutput({ ...talking, label: "Avatar brut" });
    scenes.push({ video: talking.file, audio: voice.file, onScreenText: script.onScreenHooks?.[0] || "", voiceover: script.script, subtitle: script.script });
  } else {
    // Parole native : le modèle vidéo génère image + voix à partir du texte (segments de ≤ 10 s).
    const sentences = script.script.match(/[^.!?]+[.!?]+/g) || [script.script];
    const segments = [];
    let cur = "";
    for (const s of sentences) { if ((cur + s).split(/\s+/).length > 22 && cur) { segments.push(cur.trim()); cur = s; } else cur += s; }
    if (cur.trim()) segments.push(cur.trim());
    for (let i = 0; i < segments.length; i++) {
      const [clip] = await step(`Segment ${i + 1}/${segments.length} — vidéo parlée`, () =>
        generate(p.videoModel || "wan25-i2v", { imageUrl: portrait.url || portrait.file, prompt: `${script.persona.description}. The person speaks to the camera in French, natural lip movement, and says exactly: "${segments[i]}". Vertical selfie video, handheld, natural light.`, aspect: "9:16", duration: 10, resolution: "720p" }, { jobId: p.jobId, log, baseName: `ugc-segment-${i + 1}` }));
      addOutput({ ...clip, label: `Segment ${i + 1}` });
      scenes.push({ video: clip.file, onScreenText: script.onScreenHooks?.[i] || "", voiceover: segments[i], subtitle: segments[i] });
      progress(40 + ((i + 1) / segments.length) * 45);
    }
  }

  const out = path.join(dir, "ugc-9x16.mp4");
  const res = await step("Habillage et export", () => assembleVideo(scenes, out, { aspect: "9:16", logo: resolveLocal(brand?.logo), subtitles: p.subtitles !== false, workDir: path.join(dir, "work"), log }));
  const thumb = path.join(dir, "ugc-thumb.jpg");
  await thumbnail(out, thumb, 1).catch(() => {});
  addOutput({ kind: "video", file: out, url: publicUrl(out), label: `UGC final 9:16 (${res.duration.toFixed(0)} s)`, duration: res.duration, thumb: fs.existsSync(thumb) ? publicUrl(thumb) : null, final: true });
  progress(100, "Terminé");
  return { script, video: publicUrl(out), caption: script.caption, hashtags: script.hashtags };
}
