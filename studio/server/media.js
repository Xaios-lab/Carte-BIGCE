// Outils ffmpeg : sondage, habillage, assemblage vidéo, sous-titres, rendus démo.
// Tout le texte est rendu via libass (filtres `ass` / `subtitles`), présent dans
// toutes les distributions ffmpeg courantes, y compris la version embarquée
// (ffmpeg-static) qui n'a pas le filtre drawtext.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(here, "..", "assets", "fonts");
const FONT_NAME = "Inter";

/** Binaire ffmpeg/ffprobe : celui du système s'il existe, sinon la version embarquée (npm ffmpeg-static). */
function findBin(name) {
  if (process.env.STUDIO_USE_BUNDLED_FFMPEG !== "1") {
    for (const d of (process.env.PATH || "").split(path.delimiter)) {
      for (const ext of process.platform === "win32" ? [".exe", ""] : [""]) {
        const f = path.join(d, name + ext);
        if (d && fs.existsSync(f)) return f;
      }
    }
  }
  try { return name === "ffmpeg" ? require("ffmpeg-static") : require("ffprobe-static").path; } catch { return name; }
}
export const FFMPEG = findBin("ffmpeg");
export const FFPROBE = findBin("ffprobe");

export function ff(args, { bin = "ffmpeg" } = {}) {
  return new Promise((resolve, reject) => {
    const exe = bin === "ffprobe" ? FFPROBE : FFMPEG;
    const p = spawn(exe, ["-hide_banner", "-loglevel", "error", ...(bin === "ffmpeg" ? ["-y"] : []), ...args]);
    let err = "", out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => reject(new Error(`Impossible de lancer ${exe} : ${e.message}`)));
    p.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`${bin} a échoué (${code}) : ${err.slice(-800)}\nargs: ${args.join(" ")}`)));
  });
}

export async function probe(file) {
  const out = await ff(["-print_format", "json", "-show_format", "-show_streams", file], { bin: "ffprobe" });
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return { duration: Number(j.format.duration || v?.duration || a?.duration || 0), width: v?.width, height: v?.height, hasAudio: Boolean(a), hasVideo: Boolean(v) };
}

// ───────── Texte via libass ─────────
/** Chemin utilisable dans une option de filtre (échappe ':' des lecteurs Windows et les apostrophes). */
const fpath = (f) => f.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:").replace(/'/g, "'\\''");
const hexToAss = (hex, alpha = 0) => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ""); return m ? `&H${alpha.toString(16).padStart(2, "0")}${m[3]}${m[2]}${m[1]}`.toUpperCase() : "&H00FFFFFF"; };
const assTime = (s) => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = (s % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${sec}`; };
const assText = (t) => String(t).replace(/\\/g, "\\\\").replace(/\{/g, "(").replace(/\}/g, ")").replace(/\r?\n/g, "\\N");
const tmpFile = (ext) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "studio-")), `t-${crypto.randomBytes(3).toString("hex")}${ext}`);

/** Coupe un texte en lignes de ~n caractères. */
export function wrap(text, n = 28) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Écrit un fichier ASS. events: [{ text, x, y, size, color, outline, bold, align, start, end, maxChars }]
 * align : 5 = centré, 4 = gauche (milieu vertical), 7 = haut gauche, 1 = bas gauche.
 */
export function writeAss(events, W, H) {
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${FONT_NAME},48,&H00FFFFFF,&H000000FF,&H80000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,5,0,0,0,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  const lines = events.map((e) => {
    const text = e.maxChars ? wrap(e.text, e.maxChars).join("\n") : e.text;
    const tags = [`\\an${e.align ?? 5}`, `\\pos(${Math.round(e.x)},${Math.round(e.y)})`, `\\fs${Math.round(e.size || 48)}`, `\\b${e.bold === false ? 0 : 1}`, `\\c${hexToAss(e.color || "#ffffff")}`, `\\3c${hexToAss(e.outlineColor || "#000000", e.outlineAlpha ?? 0x60)}`, `\\bord${e.outline ?? 2}`, `\\shad0`];
    return `Dialogue: 0,${assTime(e.start ?? 0)},${assTime(e.end ?? 36000)},Default,,0,0,0,,{${tags.join("")}}${assText(text)}`;
  });
  const file = tmpFile(".ass");
  fs.writeFileSync(file, head + lines.join("\n") + "\n");
  return file;
}
/** Filtre ffmpeg qui incruste un fichier ASS/SRT. */
export const assFilter = (file, style) => `${file.endsWith(".srt") ? "subtitles" : "ass"}='${fpath(file)}':fontsdir='${fpath(FONTS_DIR)}'${style ? `:force_style='${style}'` : ""}`;

// ───────── Habillage d'un visuel publicitaire ─────────
export async function overlayAd(input, output, { headline, cta, brand, logo } = {}) {
  brand = brand || {};
  const { width: W, height: H } = await probe(input);
  const primary = /^#[0-9a-f]{6}$/i.test(brand.primary || "") ? brand.primary : "#0b3d91";
  const accent = /^#[0-9a-f]{6}$/i.test(brand.accent || "") ? brand.accent : "#ffb703";
  const bandH = Math.round(H * 0.26), fsH = Math.round(W / 15), fsC = Math.round(W / 30), mx = Math.round(W * 0.05);
  const events = [];
  if (headline) events.push({ text: headline, x: mx, y: H - bandH + Math.round(bandH * 0.42), size: fsH, align: 4, color: "#ffffff", outline: 0, maxChars: Math.max(12, Math.round(W / fsH * 1.7)) });
  const filters = [`[0:v]drawbox=x=0:y=${H - bandH}:w=${W}:h=${bandH}:color=${primary}@0.92:t=fill[b]`];
  let last = "b";
  if (cta) {
    const ctaW = Math.round(cta.length * fsC * 0.6 + fsC * 1.6), y = H - Math.round(bandH * 0.22), h = Math.round(fsC * 1.8);
    filters.push(`[${last}]drawbox=x=${mx}:y=${y - Math.round(h / 2)}:w=${ctaW}:h=${h}:color=${accent}:t=fill[c]`);
    last = "c";
    events.push({ text: cta, x: mx + Math.round(ctaW / 2), y, size: fsC, align: 5, color: "#111111", outline: 0 });
  }
  if (events.length) { filters.push(`[${last}]${assFilter(writeAss(events, W, H))}[t]`); last = "t"; }
  const inputs = ["-i", input];
  if (logo && fs.existsSync(logo)) {
    inputs.push("-i", logo);
    filters.push(`[1:v]scale=${Math.round(W * 0.18)}:-1[lg]`, `[${last}][lg]overlay=W-w-${Math.round(W * 0.04)}:${Math.round(H * 0.04)}[o]`);
    last = "o";
  }
  await ff([...inputs, "-filter_complex", filters.join(";"), "-map", `[${last}]`, "-frames:v", "1", output]);
  return output;
}

// ───────── Rendus factices (mode démo) ─────────
export async function placeholderImage(output, { text = "", w = 1024, h = 1024, color = "0x1f2a44" } = {}) {
  const ass = writeAss([{ text, x: w / 2, y: h / 2, size: Math.round(w / 26), align: 5, bold: false, outline: 1, maxChars: 34 }], w, h);
  await ff(["-f", "lavfi", "-i", `gradients=s=${w}x${h}:c0=${color}:c1=0x0ea5e9:x0=0:y0=0:x1=${w}:y1=${h}:n=2`, "-vf", `format=rgba,${assFilter(ass)}`, "-frames:v", "1", output]);
  return output;
}

export async function placeholderVideo(output, { text = "", w = 1280, h = 720, duration = 5, audio } = {}) {
  const ass = writeAss([{ text, x: w / 2, y: h / 2, size: Math.round(w / 28), align: 5, bold: false, outline: 1, maxChars: 30 }], w, h);
  const args = ["-f", "lavfi", "-i", `gradients=s=${w}x${h}:c0=0x0f172a:c1=0x0ea5e9:speed=0.05:d=${duration}:r=25`];
  if (audio) args.push("-i", audio); else args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${duration}`);
  args.push("-vf", assFilter(ass), "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", String(duration), output);
  await ff(args);
  return output;
}

export async function placeholderSpeech(output, text = "") {
  const d = Math.max(1.5, Math.min(60, text.length / 15));
  await ff(["-f", "lavfi", "-i", `sine=frequency=220:duration=${d}`, "-af", "tremolo=f=4:d=0.8,volume=0.15", "-c:a", "aac", output]);
  return output;
}

// ───────── Montage ─────────
const fit = (W, H) => `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=25,format=yuv420p`;

/** Fichier SRT à partir des scènes (voix off) et de leurs durées. */
export function buildSrt(scenes) {
  const ts = (s) => new Date(Math.round(s * 1000)).toISOString().slice(11, 23).replace(".", ",");
  let t = 0, i = 1, out = "";
  for (const sc of scenes) {
    const text = (sc.subtitle || sc.voiceover || "").trim();
    if (text) {
      const chunks = wrap(text, 42);
      const per = sc.duration / Math.max(1, Math.ceil(chunks.length / 2));
      for (let k = 0; k < chunks.length; k += 2) {
        const a = t + (k / 2) * per, b = Math.min(t + sc.duration, a + per);
        out += `${i++}\n${ts(a)} --> ${ts(b)}\n${chunks.slice(k, k + 2).join("\n")}\n\n`;
      }
    }
    t += sc.duration;
  }
  return out;
}

/**
 * Assemble des scènes { video, audio?, onScreenText?, voiceover? } en une vidéo finale :
 * format cible, durée calée sur la voix off (gel de la dernière image si besoin), textes à
 * l'écran, voix off, musique de fond (-15 dB), sous-titres, logo en filigrane.
 */
export async function assembleVideo(scenes, output, { aspect = "16:9", logo, music, subtitles = true, workDir, log = () => {} } = {}) {
  const sizes = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] };
  const [W, H] = sizes[aspect] || sizes["16:9"];
  fs.mkdirSync(workDir, { recursive: true });
  const parts = [];
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const vInfo = await probe(sc.video);
    let dur = vInfo.duration;
    if (sc.audio) { const aInfo = await probe(sc.audio); dur = Math.max(aInfo.duration + 0.4, Math.min(vInfo.duration, aInfo.duration + 0.4)); }
    sc.duration = dur;
    const part = path.join(workDir, `part-${String(i).padStart(2, "0")}.mp4`);
    let vf = fit(W, H);
    if (dur > vInfo.duration + 0.05) vf += `,tpad=stop_mode=clone:stop_duration=${(dur - vInfo.duration).toFixed(2)}`;
    if (sc.onScreenText) {
      const ass = writeAss([{ text: sc.onScreenText, x: W / 2, y: H * (aspect === "9:16" ? 0.56 : 0.64), size: Math.round(W / (aspect === "9:16" ? 15 : 24)), align: 5, outline: 3, start: 0.3, end: Math.max(0.5, dur - 0.2), maxChars: aspect === "9:16" ? 20 : 34 }], W, H);
      vf += `,${assFilter(ass)}`;
    }
    const args = ["-i", sc.video];
    if (sc.audio) args.push("-i", sc.audio);
    else if (!vInfo.hasAudio) args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
    const aMap = sc.audio ? "1:a" : vInfo.hasAudio ? "0:a" : "1:a";
    args.push("-filter_complex", `[0:v]${vf}[v];[${aMap}]aresample=48000,aformat=channel_layouts=stereo,apad[a]`, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", part);
    await ff(args);
    parts.push(part);
    log(`Scène ${i + 1}/${scenes.length} montée (${dur.toFixed(1)} s)`);
  }
  const list = path.join(workDir, "concat.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  const concat = path.join(workDir, "concat.mp4");
  await ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat]);

  const total = scenes.reduce((s, x) => s + x.duration, 0);
  const inputs = ["-i", concat];
  const fc = [];
  let v = "0:v", a = "0:a", idx = 1;
  if (logo && fs.existsSync(logo)) {
    inputs.push("-i", logo);
    fc.push(`[${idx}:v]scale=${Math.round(W * 0.14)}:-1[lg]`, `[${v}][lg]overlay=W-w-${Math.round(W * 0.03)}:${Math.round(H * 0.03)}[vl]`);
    v = "vl"; idx++;
  }
  let srtFile;
  if (subtitles) {
    srtFile = path.join(workDir, "subtitles.srt");
    fs.writeFileSync(srtFile, buildSrt(scenes));
    if (fs.statSync(srtFile).size > 0) {
      const style = `FontName=${FONT_NAME},FontSize=${aspect === "9:16" ? 9 : 8},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,Outline=2,MarginV=${aspect === "9:16" ? 60 : 28}`;
      fc.push(`[${v}]${assFilter(srtFile, style)}[vs]`);
      v = "vs";
    }
  }
  if (music && fs.existsSync(music)) {
    inputs.push("-stream_loop", "-1", "-i", music);
    fc.push(`[${idx}:a]volume=0.18,afade=t=out:st=${Math.max(0, total - 2).toFixed(2)}:d=2[m]`, `[${a}][m]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[am]`);
    a = "am"; idx++;
  }
  const args = [...inputs];
  if (fc.length) args.push("-filter_complex", fc.join(";"));
  args.push("-map", v.includes(":") ? v : `[${v}]`, "-map", a.includes(":") ? a : `[${a}]`, "-t", total.toFixed(2), "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output);
  await ff(args);
  return { output, srt: srtFile, duration: total, width: W, height: H };
}

/** Extrait une vignette JPEG d'une vidéo. */
export async function thumbnail(video, output, at = 0.5) {
  await ff(["-ss", String(at), "-i", video, "-frames:v", "1", "-vf", "scale=640:-2", output]);
  return output;
}
