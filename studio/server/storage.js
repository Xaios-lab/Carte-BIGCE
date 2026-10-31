// Stockage local des rendus : téléchargement des URL distantes, data-URI, fichiers.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { OUTPUT_DIR, UPLOADS_DIR } from "./config.js";

const EXT = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "video/mp4": ".mp4", "video/webm": ".webm", "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/mp4": ".m4a", "audio/aac": ".aac" };

export const uid = (n = 8) => crypto.randomBytes(n).toString("hex").slice(0, n * 2);

export function jobDir(jobId) {
  const d = path.join(OUTPUT_DIR, jobId);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function publicUrl(file) {
  const rel = path.relative(OUTPUT_DIR, file);
  if (!rel.startsWith("..")) return "/outputs/" + rel.split(path.sep).join("/");
  const relU = path.relative(UPLOADS_DIR, file);
  if (!relU.startsWith("..")) return "/uploads/" + relU.split(path.sep).join("/");
  return null;
}

function extFor(mime, src) {
  if (mime && EXT[mime.split(";")[0]]) return EXT[mime.split(";")[0]];
  const m = /\.(png|jpe?g|webp|svg|mp4|webm|mp3|wav|m4a|aac)(\?|$)/i.exec(src || "");
  return m ? "." + m[1].toLowerCase().replace("jpeg", "jpg") : "";
}

/** Sauvegarde un asset (url http, data:, ou chemin local) dans le dossier du job. */
export async function saveAsset(asset, jobId, baseName) {
  const dir = jobDir(jobId);
  let buf, mime = asset.mime;
  const src = asset.src;
  if (!src) throw new Error("Asset sans source");
  if (src.startsWith("data:")) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(src);
    mime = mime || m[1];
    buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
  } else if (/^https?:\/\//.test(src)) {
    const r = await fetch(src);
    if (!r.ok) throw new Error(`Téléchargement échoué (${r.status}) : ${src}`);
    mime = mime || r.headers.get("content-type") || undefined;
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    buf = fs.readFileSync(src);
  }
  const file = path.join(dir, `${baseName}${extFor(mime, src) || (asset.kind === "video" ? ".mp4" : asset.kind === "audio" ? ".mp3" : ".png")}`);
  fs.writeFileSync(file, buf);
  return { ...asset, file, url: publicUrl(file), bytes: buf.length };
}

/** Sauvegarde un upload base64 (logo, photo produit, musique) et renvoie son chemin. */
export function saveUpload(dataUri, name = "upload") {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUri);
  if (!m) throw new Error("Upload invalide (attendu : data URI)");
  const mime = m[1] || "application/octet-stream";
  const buf = Buffer.from(m[3], "base64");
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const file = path.join(UPLOADS_DIR, `${Date.now()}-${uid(3)}-${safe}${extFor(mime, name)}`);
  fs.writeFileSync(file, buf);
  return { file, url: publicUrl(file), mime, bytes: buf.length };
}

/** Convertit un fichier local en data URI (pour l'envoyer à un fournisseur). */
export function toDataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] || "application/octet-stream";
  return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`;
}

/** Résout une référence (URL publique /outputs/… ou /uploads/…, chemin, http, data) vers un chemin local si possible. */
export function resolveLocal(ref) {
  if (!ref) return null;
  if (ref.startsWith("/outputs/")) return path.join(OUTPUT_DIR, ref.slice("/outputs/".length));
  if (ref.startsWith("/uploads/")) return path.join(UPLOADS_DIR, ref.slice("/uploads/".length));
  if (fs.existsSync(ref)) return ref;
  return null;
}

/** Transforme une référence en URL exploitable par un fournisseur distant (http ou data URI). */
export function toProviderUrl(ref) {
  if (!ref) return undefined;
  if (/^(https?:|data:)/.test(ref)) return ref;
  const local = resolveLocal(ref);
  if (local) {
    const base = process.env.PUBLIC_BASE_URL; // ex. https://studio.mondomaine.pf si le serveur est exposé
    const url = publicUrl(local);
    if (base && url) return base.replace(/\/$/, "") + url;
    return toDataUri(local);
  }
  return ref;
}
