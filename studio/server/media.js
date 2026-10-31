// Outils ffmpeg : sondage, images de texte, assemblage vidéo, voix factice.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const FONT_BOLD = ["/usr/share/fonts/opentype/inter/Inter-Bold.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"].find((f) => fs.existsSync(f)) || "";
export const FONT_REG = ["/usr/share/fonts/opentype/inter/Inter-Regular.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find((f) => fs.existsSync(f)) || "";

export function ff(args, { bin = "ffmpeg", log } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, ["-hide_banner", "-loglevel", "error", ...(bin === "ffmpeg" ? ["-y"] : []), ...args]);
    let err = "";
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${bin} a échoué (${code}) : ${err.slice(-800)}\nargs: ${args.join(" ")}`));
    });
  });
}

export async function probe(file) {
  const out = await ff(["-print_format", "json", "-show_format", "-show_streams", file], { bin: "ffprobe" });
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  return { duration: Number(j.format.duration || v?.duration || a?.duration || 0), width: v?.width, height: v?.height, hasAudio: Boolean(a), hasVideo: Boolean(v) };
}

/** Échappe un texte pour le filtre drawtext. */
export function esc(t = "") {
  return String(t).replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%").replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/,/g, "\\,").replace(/;/g, "\;");
}

/** Coupe un texte en lignes de ~n caractères pour drawtext. */
export function wrap(text, n = 28) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

const hex = (c, fallback) => (/^#?[0-9a-fA-F]{6}$/.test(c || "") ? (c.startsWith("#") ? c : `#${c}`) : fallback);

/**
 * Habillage d'un visuel publicitaire : bandeau couleur de marque + titre + CTA (+ logo).
 */
export async function overlayAd(input, output, { headline, cta, brand, logo } = {}) {
  brand = brand || {};
  const { width: W, height: H } = await probe(input);
  const primary = hex(brand.primary, "#0b3d91");
  const bandH = Math.round(H * 0.26);
  const fsH = Math.round(W / 16);
  const fsC = Math.round(W / 30);
  const filters = [`[0:v]drawbox=x=0:y=${H - bandH}:w=${W}:h=${bandH}:color=${primary}@0.92:t=fill[b]`];
  let last = "b";
  if (headline && FONT_BOLD) {
    const lines = wrap(headline, Math.max(14, Math.round(W / fsH * 1.6)));
    lines.slice(0, 2).forEach((l, i) => {
      filters.push(`[${last}]drawtext=fontfile='${FONT_BOLD}':text='${esc(l)}':fontcolor=white:fontsize=${fsH}:x=${Math.round(W * 0.05)}:y=${H - bandH + Math.round(bandH * 0.12) + i * Math.round(fsH * 1.15)}[t${i}]`);
      last = `t${i}`;
    });
  }
  if (cta && FONT_BOLD) {
    const accent = hex(brand.accent, "#ffb703");
    const ctaW = Math.round(cta.length * fsC * 0.62 + fsC * 1.6);
    const x = Math.round(W * 0.05);
    const y = H - Math.round(bandH * 0.3);
    filters.push(`[${last}]drawbox=x=${x}:y=${y - Math.round(fsC * 0.4)}:w=${ctaW}:h=${Math.round(fsC * 1.8)}:color=${accent}:t=fill[c0]`);
    filters.push(`[c0]drawtext=fontfile='${FONT_BOLD}':text='${esc(cta)}':fontcolor=black:fontsize=${fsC}:x=${x + Math.round(fsC * 0.8)}:y=${y}[c1]`);
    last = "c1";
  }
  const inputs = ["-i", input];
  if (logo && fs.existsSync(logo)) {
    inputs.push("-i", logo);
    const lw = Math.round(W * 0.18);
    filters.push(`[1:v]scale=${lw}:-1[lg]`, `[${last}][lg]overlay=W-w-${Math.round(W * 0.04)}:${Math.round(H * 0.04)}[o]`);
    last = "o";
  }
  await ff([...inputs, "-filter_complex", filters.join(";"), "-map", `[${last}]`, "-frames:v", "1", output]);
  return output;
}

/** Image factice (mode démo) : dégradé + texte du prompt. */
export async function placeholderImage(output, { text = "", w = 1024, h = 1024, color = "0x1f2a44" } = {}) {
  const lines = wrap(text, 34).slice(0, 6);
  const fs_ = Math.round(w / 26);
  const dt = lines.map((l, i) => `drawtext=fontfile='${FONT_REG}':text='${esc(l)}':fontcolor=white@0.9:fontsize=${fs_}:x=(w-text_w)/2:y=${Math.round(h / 2 - (lines.length / 2) * fs_ * 1.3) + i * Math.round(fs_ * 1.3)}`).join(",");
  const vf = `gradients=s=${w}x${h}:c0=${color}:c1=0x0ea5e9:x0=0:y0=0:x1=${w}:y1=${h}:n=2,format=rgba${dt ? "," + dt : ""}`;
  await ff(["-f", "lavfi", "-i", vf, "-frames:v", "1", output]);
  return output;
}

/** Vidéo factice (mode démo) : fond animé + texte, avec ou sans audio. */
export async function placeholderVideo(output, { text = "", w = 1280, h = 720, duration = 5, audio } = {}) {
  const lines = wrap(text, 30).slice(0, 4);
  const fs_ = Math.round(w / 28);
  const dt = lines.map((l, i) => `drawtext=fontfile='${FONT_REG}':text='${esc(l)}':fontcolor=white:fontsize=${fs_}:x=(w-text_w)/2:y=${Math.round(h / 2 - (lines.length / 2) * fs_ * 1.3) + i * Math.round(fs_ * 1.3)}`).join(",");
  const args = ["-f", "lavfi", "-i", `gradients=s=${w}x${h}:c0=0x0f172a:c1=0x0ea5e9:speed=0.05:d=${duration}:r=25${dt ? "," + dt : ""}`];
  if (audio) args.push("-i", audio);
  else args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${duration}`);
  args.push("-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", String(duration), output);
  await ff(args);
  return output;
}

/** Voix factice (mode démo) : modulation ~ durée de lecture du texte (15 car./s). */
export async function placeholderSpeech(output, text = "") {
  const d = Math.max(1.5, Math.min(60, text.length / 15));
  await ff(["-f", "lavfi", "-i", `sine=frequency=220:duration=${d}`, "-af", "tremolo=f=4:d=0.8,volume=0.15", "-c:a", "aac", output]);
  return output;
}

function fit(W, H) {
  return `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=25,format=yuv420p`;
}

/** Fichier SRT à partir des scènes (voix off) et de leurs durées. */
export function buildSrt(scenes) {
  const ts = (s) => { const d = new Date(Math.round(s * 1000)); return d.toISOString().slice(11, 23).replace(".", ","); };
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
 * Assemble des scènes { video, audio?, onScreenText?, duration } en une vidéo finale.
 * - chaque clip est ajusté au format (W×H) et à la durée de sa voix off (prolongé par gel si besoin)
 * - voix off mixée, musique en fond (-14 dB), sous-titres optionnels, logo en filigrane optionnel
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
    if (sc.audio) {
      const aInfo = await probe(sc.audio);
      dur = Math.max(aInfo.duration + 0.4, Math.min(vInfo.duration, aInfo.duration + 0.4));
    }
    sc.duration = dur;
    const part = path.join(workDir, `part-${String(i).padStart(2, "0")}.mp4`);
    let vf = fit(W, H);
    if (dur > vInfo.duration + 0.05) vf += `,tpad=stop_mode=clone:stop_duration=${(dur - vInfo.duration).toFixed(2)}`;
    if (sc.onScreenText && FONT_BOLD) {
      const lines = wrap(sc.onScreenText, aspect === "9:16" ? 20 : 34).slice(0, 3);
      const fsz = Math.round(W / (aspect === "9:16" ? 16 : 24));
      lines.forEach((l, k) => {
        vf += `,drawtext=fontfile='${FONT_BOLD}':text='${esc(l)}':fontcolor=white:borderw=${Math.round(fsz / 12)}:bordercolor=black@0.6:fontsize=${fsz}:x=(w-text_w)/2:y=${Math.round(H * (aspect === "9:16" ? 0.56 : 0.64)) + k * Math.round(fsz * 1.2)}:enable='between(t,0.3,${(dur - 0.2).toFixed(2)})'`;
      });
    }
    const args = ["-i", sc.video];
    if (sc.audio) args.push("-i", sc.audio);
    else if (!vInfo.hasAudio) args.push("-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`);
    const aMap = sc.audio ? "1:a" : vInfo.hasAudio ? "0:a" : "1:a";
    args.push("-filter_complex", `[0:v]${vf}[v];[${aMap}]aresample=48000,aformat=channel_layouts=stereo,apad[a]`, "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(2), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", part);
    await ff(args);
    parts.push(part);
    log(`Scène ${i + 1}/${scenes.length} montée (${dur.toFixed(1)} s)`);
  }
  const list = path.join(workDir, "concat.txt");
  fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
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
      const style = `FontName=Inter,FontSize=${aspect === "9:16" ? 9 : 8},Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,Outline=2,MarginV=${aspect === "9:16" ? 60 : 28}`;
      fc.push(`[${v}]subtitles='${srtFile.replace(/'/g, "'\\''").replace(/:/g, "\\:")}':force_style='${style}'[vs]`);
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
