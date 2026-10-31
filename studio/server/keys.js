// Enregistrement des clés API depuis l'interface : écrit studio/.env et met à
// jour process.env sans redémarrage. Les clés ne sont jamais renvoyées en clair.
import fs from "node:fs";
import path from "node:path";
import { ROOT, PROVIDERS } from "./config.js";

const ENV_FILE = path.join(ROOT, ".env");
const ALLOWED = new Set([...Object.values(PROVIDERS).map((p) => p.env), "STUDIO_CLAUDE_MODEL", "USD_TO_XPF", "PUBLIC_BASE_URL"]);

export function readMasked() {
  const out = {};
  for (const k of ALLOWED) {
    const v = process.env[k];
    out[k] = v ? (k.includes("KEY") || k.includes("TOKEN") ? `${v.slice(0, 6)}…${v.slice(-4)}` : v) : "";
  }
  return out;
}

export function saveKeys(values) {
  let lines = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  for (const [k, raw] of Object.entries(values || {})) {
    if (!ALLOWED.has(k)) continue;
    const v = String(raw ?? "").trim();
    if (v === "" || /^.{6}….{4}$/.test(v)) continue; // champ vide ou valeur masquée inchangée
    const idx = lines.findIndex((l) => l.replace(/^#\s*/, "").startsWith(`${k}=`));
    const line = `${k}=${v}`;
    if (idx >= 0) lines[idx] = line; else lines.push(line);
    process.env[k] = v;
  }
  fs.writeFileSync(ENV_FILE, lines.join("\n").replace(/\n*$/, "\n"));
  return readMasked();
}

export function clearKey(k) {
  if (!ALLOWED.has(k)) return readMasked();
  delete process.env[k];
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, "utf8").split(/\r?\n/).filter((l) => !l.startsWith(`${k}=`));
    fs.writeFileSync(ENV_FILE, lines.join("\n"));
  }
  return readMasked();
}
