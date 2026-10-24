// ---------------------------------------------------------------------------
//  TEXTURES : tout est dessiné en canvas (herbe, terre, écorce, feuilles, nuages, halos, logos)
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const srgb = (c, repeat = false) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
};
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

/** Détail du sol, neutre (gris clair + grain + brins) : la teinte vient des couleurs de sommets */
export function grassTexture() {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(5);
  ctx.fillStyle = '#d6d6d6'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 12000; i++) {
    const k = r();
    ctx.fillStyle = k < 0.45 ? 'rgba(255,255,255,0.35)' : k < 0.85 ? 'rgba(60,60,60,0.22)' : 'rgba(0,0,0,0.3)';
    ctx.fillRect(r() * S, r() * S, 2, 2);
  }
  ctx.lineCap = 'round'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 3200; i++) {
    const x = r() * S, y = r() * S, l = 4 + r() * 9, a = (r() - 0.5) * 1.2;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(40,40,40,0.4)';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); ctx.stroke();
  }
  return srgb(c, true);
}
/** Terre / chemin */
export function dirtTexture(theme) {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(9);
  ctx.fillStyle = hex(theme.dirt.b); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(60,40,20,0.3)' : 'rgba(200,170,120,0.22)'; ctx.fillRect(r() * S, r() * S, 2 + r() * 2, 1 + r() * 2); }
  for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(80,80,80,0.45)'; ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 2 + r() * 3, 1.5 + r() * 2, r() * 3, 0, Math.PI * 2); ctx.fill(); }
  return srgb(c, true);
}
/** Écorce de cocotier : anneaux */
export function barkTexture(theme) {
  const S = 128, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(3);
  ctx.fillStyle = hex(theme.palm.trunk); ctx.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 9) { ctx.fillStyle = `rgba(40,25,10,${0.25 + r() * 0.25})`; ctx.fillRect(0, y + r() * 3, S, 3); }
  for (let i = 0; i < 600; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,230,190,0.14)'; ctx.fillRect(r() * S, r() * S, 2, 1); }
  return srgb(c, true);
}
/** Béton (château d'eau, socles) */
export function concreteTexture() {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(17);
  ctx.fillStyle = '#b9b3a7'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 6000; i++) { ctx.fillStyle = r() < 0.5 ? 'rgba(60,60,60,0.12)' : 'rgba(255,255,255,0.12)'; ctx.fillRect(r() * S, r() * S, 2, 2); }
  for (let i = 0; i < 12; i++) { ctx.strokeStyle = 'rgba(70,60,50,0.25)'; ctx.lineWidth = 1; ctx.beginPath(); const x = r() * S, y = r() * S; ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 60, y + r() * 50); ctx.stroke(); }
  return srgb(c, true);
}
/** Palme de cocotier (plume) avec alpha */
export function frondTexture(color, color2) {
  const W = 128, H = 512, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.translate(W / 2, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, hex(color2)); g.addColorStop(1, hex(color));
  ctx.fillStyle = g;
  for (let i = 0; i < 46; i++) {
    const y = 20 + (i / 46) * (H - 40), len = 20 + Math.sin((i / 46) * Math.PI) * 42, w = 5;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * len * 0.6, y + 6, s * len, y + 22); ctx.lineTo(s * len * 0.9, y + 26); ctx.quadraticCurveTo(s * len * 0.4, y + 14, 0, y + w); ctx.closePath(); ctx.fill();
    }
  }
  ctx.strokeStyle = hex(color2); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, H); ctx.stroke();
  const t = srgb(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
/** Touffe d'herbe (brins) avec alpha */
export function bladeTexture(theme) {
  const W = 128, H = 128, c = canvas(W, H), ctx = c.getContext('2d'), r = rng(21);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = 20 + r() * 88, h = 50 + r() * 70, lean = (r() - 0.5) * 50;
    const g = ctx.createLinearGradient(0, H, 0, H - h); g.addColorStop(0, hex(theme.grass.c)); g.addColorStop(1, hex(theme.grass.b));
    ctx.strokeStyle = g; ctx.lineWidth = 3 + r() * 3;
    ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h); ctx.stroke();
  }
  return srgb(c);
}
/** Fougère (éventail) avec alpha */
export function fernTexture(theme) {
  const W = 256, H = 256, c = canvas(W, H), ctx = c.getContext('2d');
  ctx.translate(W / 2, H);
  for (let k = -3; k <= 3; k++) {
    const a = k * 0.32;
    ctx.save(); ctx.rotate(a);
    ctx.fillStyle = k % 2 ? hex(theme.grass.c) : hex(theme.grass.a);
    for (let i = 0; i < 18; i++) { const y = -20 - i * 11, l = 10 + Math.sin((i / 18) * Math.PI) * 26; ctx.beginPath(); ctx.ellipse(-l / 2, y, l / 2, 4, 0, 0, Math.PI * 2); ctx.ellipse(l / 2, y, l / 2, 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = hex(theme.grass.c); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -220); ctx.stroke();
    ctx.restore();
  }
  return srgb(c);
}
/** Nuage doux (sprite) */
export function cloudTexture(seed = 1) {
  const W = 256, H = 128, c = canvas(W, H), ctx = c.getContext('2d'), r = rng(seed);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * (W - 80), y = 50 + r() * 40, rad = 22 + r() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.6, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  return srgb(c);
}
/** Halo radial (sprites) */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128, c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/,1\)$/, ',0.5)')); g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return srgb(c);
}
/** Goutte d'eau (particules) */
export function dropTexture() {
  const S = 64, c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S * 0.42, S * 0.4, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(180,240,255,0.95)'); g.addColorStop(1, 'rgba(60,180,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  return srgb(c);
}
/** Fleur (hibiscus / tiaré) */
export function flowerTexture(color) {
  const S = 96, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = hex(color);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, -22, 13, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate((Math.PI * 2) / 5); }
  ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  return srgb(c);
}
/** Eau de rivière (reflets) */
export function riverTexture(theme) {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(11);
  ctx.fillStyle = hex(theme.river.shallow); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 60; i++) { const g = ctx.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 40 + r() * 90); g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, S, S); }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 70; i++) { ctx.beginPath(); const x = r() * S, y = r() * S, l = 20 + r() * 50; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y + (r() - 0.5) * 16, x + l, y); ctx.stroke(); }
  return srgb(c, true);
}

export function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, reject);
  });
}
export function partnerLogoUrl(partner) { return partner.logo; }
export async function partnerTexture(partner) { return loadImageTexture(partner.logo); }
