// Pipeline VIDÉO PROMO : brief → script/storyboard → image clé par scène →
// animation (image→vidéo) → voix off par scène → musique (option) → montage
// ffmpeg (format, sous-titres, logo) → MP4 + SRT + script.
import fs from "node:fs";
import path from "node:path";
import { generate } from "../providers/index.js";
import { promoScript } from "../director.js";
import { getBrand } from "../brands.js";
import { byId, DEFAULTS, estimateCost } from "../catalog.js";
import { assembleVideo, thumbnail } from "../media.js";
import { jobDir, publicUrl, resolveLocal } from "../storage.js";

export function estimate(p) {
  const duration = p.duration || 30;
  const n = p.scenes || Math.max(3, Math.min(8, Math.round(duration / 5)));
  const per = duration / n;
  const img = byId(p.imageModel || DEFAULTS.image.standard);
  const vid = byId(p.videoModel || (p.mode === "t2v" ? DEFAULTS["video-t2v"].standard : DEFAULTS["video-i2v"].standard));
  const tts = byId(p.ttsModel || DEFAULTS.tts.standard);
  const music = p.music === "generate" ? byId(p.musicModel || DEFAULTS.music.standard) : null;
  let usd = 0;
  if (p.mode !== "t2v") usd += estimateCost(img, { count: n });
  usd += n * estimateCost(vid, { duration: Math.ceil(per), resolution: p.resolution || "720p" });
  if (p.voiceover !== false) usd += estimateCost(tts, { text: "x".repeat(Math.round(duration * 2.5 * 6)) });
  if (music) usd += estimateCost(music, { duration });
  return { usd, scenes: n, models: [img?.name, vid?.name, tts?.name, music?.name].filter(Boolean) };
}

export async function run({ params: p, log, step, progress, addOutput, setResult }) {
  const brand = getBrand(p.brandId);
  const aspect = p.aspect || "16:9";
  const duration = p.duration || 30;
  const mode = p.mode || "i2v";
  const imageModel = p.imageModel || DEFAULTS.image.standard;
  const videoModel = p.videoModel || (mode === "t2v" ? DEFAULTS["video-t2v"].standard : DEFAULTS["video-i2v"].standard);
  const ttsModel = p.ttsModel || DEFAULTS.tts.standard;
  const dir = jobDir(p.jobId);

  const script = p.script || await step("Script et storyboard", () => promoScript(p.brief, brand, { duration, scenes: p.scenes, aspect, log }));
  fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(script, null, 2));
  addOutput({ kind: "json", file: path.join(dir, "script.json"), url: publicUrl(path.join(dir, "script.json")), label: "Script & storyboard (JSON)" });
  setResult({ script });
  progress(10, "Images clés");

  const styleSuffix = brand?.visualStyle ? `, ${brand.visualStyle.slice(0, 160)}` : "";
  const scenes = [];
  const total = script.scenes.length;
  for (let i = 0; i < total; i++) {
    const sc = script.scenes[i];
    const sceneDur = Math.max(3, Math.min(12, Math.round(sc.durationSec || duration / total)));
    const base = `scene-${String(i + 1).padStart(2, "0")}`;
    let keyframe;
    if (mode !== "t2v") {
      [keyframe] = await step(`Scène ${i + 1}/${total} — image clé`, () =>
        generate(imageModel, { prompt: `${sc.visualPrompt}${styleSuffix}`, aspect, count: 1 }, { jobId: p.jobId, log, baseName: `${base}-image` }));
      addOutput({ ...keyframe, label: `Scène ${i + 1} — image clé`, scene: i + 1 });
    }
    const [clip] = await step(`Scène ${i + 1}/${total} — vidéo`, () =>
      generate(videoModel, { prompt: mode === "t2v" ? `${sc.visualPrompt}. ${sc.motionPrompt}${styleSuffix}` : `${sc.motionPrompt}. ${sc.visualPrompt}`, imageUrl: keyframe?.url, aspect, duration: sceneDur, resolution: p.resolution || "720p", audio: p.voiceover === false }, { jobId: p.jobId, log, baseName: `${base}-clip` }));
    addOutput({ ...clip, label: `Scène ${i + 1} — clip`, scene: i + 1 });

    let voice;
    if (p.voiceover !== false && sc.voiceover?.trim()) {
      [voice] = await step(`Scène ${i + 1}/${total} — voix off`, () =>
        generate(ttsModel, { text: sc.voiceover, voice: p.voice }, { jobId: p.jobId, log, baseName: `${base}-voix` }));
      addOutput({ ...voice, label: `Scène ${i + 1} — voix off`, scene: i + 1 });
    }
    scenes.push({ video: clip.file, audio: voice?.file, onScreenText: p.onScreenText === false ? "" : sc.onScreenText, voiceover: sc.voiceover, duration: sceneDur });
    progress(10 + ((i + 1) / total) * 70, `Scène ${i + 1}/${total}`);
  }

  let music;
  if (p.music === "generate") {
    const [m] = await step("Musique de fond", () => generate(p.musicModel || DEFAULTS.music.standard, { prompt: script.musicMood, duration: Math.ceil(duration + 5) }, { jobId: p.jobId, log, baseName: "musique" }));
    music = m.file;
    addOutput({ ...m, label: "Musique" });
  } else if (p.music && p.music !== "none") {
    music = resolveLocal(p.music);
  }

  const out = path.join(dir, `promo-${aspect.replace(":", "x")}.mp4`);
  const res = await step("Montage final", () => assembleVideo(scenes, out, { aspect, logo: resolveLocal(brand?.logo), music, subtitles: p.subtitles !== false, workDir: path.join(dir, "work"), log }));
  const thumb = path.join(dir, "promo-thumb.jpg");
  await thumbnail(out, thumb, 1).catch(() => {});
  addOutput({ kind: "video", file: out, url: publicUrl(out), label: `Vidéo finale ${aspect} (${res.duration.toFixed(0)} s)`, duration: res.duration, width: res.width, height: res.height, thumb: fs.existsSync(thumb) ? publicUrl(thumb) : null, final: true });
  if (res.srt && fs.existsSync(res.srt)) {
    const srtOut = path.join(dir, "sous-titres.srt");
    fs.copyFileSync(res.srt, srtOut);
    addOutput({ kind: "text", file: srtOut, url: publicUrl(srtOut), label: "Sous-titres (SRT)" });
  }
  progress(100, "Terminé");
  return { script, video: publicUrl(out), caption: script.caption, hashtags: script.hashtags };
}
