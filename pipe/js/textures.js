// ---------------------------------------------------------------------------
//  TEXTURES : tout est dessiné en canvas (sable, mer, fleurs, halos, logos de secours)
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

/** Sable fin : grain + quelques coquillages */
export function sandTexture(theme) {
  const S = 256, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(7);
  ctx.fillStyle = hex(theme.sand.light); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(120,90,40,0.10)' : 'rgba(255,255,255,0.14)';
    ctx.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(230,170,120,0.3)';
    ctx.beginPath(); ctx.ellipse(r() * S, r() * S, 2 + r() * 2, 1.2 + r(), r() * 3, 0, Math.PI * 2); ctx.fill();
  }
  return srgb(c, true);
}

/** Mer : dégradé turquoise + reflets (caustiques) ; se déplace en boucle */
export function seaTexture(theme) {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d'), r = rng(11);
  ctx.fillStyle = hex(theme.sea.shallow); ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    const g = ctx.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, 40 + r() * 90);
    g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    const x = r() * S, y = r() * S, l = 20 + r() * 50;
    ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y + (r() - 0.5) * 16, x + l, y);
    ctx.stroke();
  }
  return srgb(c, true);
}

/** Halo radial (sprites) */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128, c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/,1\)$/, ',0.5)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return srgb(c);
}

/** Goutte d'eau (particules) */
export function dropTexture() {
  const S = 64, c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S * 0.42, S * 0.4, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(160,240,255,0.95)'); g.addColorStop(1, 'rgba(60,180,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.fill();
  return srgb(c);
}

/** Fleur d'hibiscus (sprite) */
export function flowerTexture(color) {
  const S = 96, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  ctx.fillStyle = hex(color);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath(); ctx.ellipse(0, -22, 13, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate((Math.PI * 2) / 5);
  }
  ctx.fillStyle = '#ffe36b'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffe36b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, -16); ctx.stroke();
  return srgb(c);
}

/** Logo de secours quand le fichier du partenaire n'est pas encore fourni : pastille ronde + nom */
export function placeholderLogoCanvas(partner) {
  const S = 512, c = canvas(S, S), ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#2d8df2'); g.addColorStop(1, partner.color || '#1e6fd9');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 14; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  // goutte d'eau
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(S / 2, 92);
  ctx.bezierCurveTo(S / 2 + 70, 190, S / 2 + 70, 250, S / 2, 268);
  ctx.bezierCurveTo(S / 2 - 70, 250, S / 2 - 70, 190, S / 2, 92);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,111,217,0.9)'; ctx.beginPath(); ctx.ellipse(S / 2 + 18, 215, 14, 22, 0.3, 0, Math.PI * 2); ctx.fill();
  // clé à molette stylisée
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(150, 300); ctx.lineTo(220, 230); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(292, 230); ctx.lineTo(362, 300); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 62px Nunito, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ph = partner.placeholder || {};
  ctx.fillText(ph.line1 || partner.name.toUpperCase(), S / 2, 352);
  ctx.font = 'bold 54px Nunito, Arial, sans-serif';
  if (ph.line2) ctx.fillText(ph.line2, S / 2, 412);
  return c;
}
const placeholderUrls = new Map();
/** URL du logo d'un partenaire (fichier, ou dessin de secours en data-URL) */
export function partnerLogoUrl(partner) {
  if (partner.logo) return partner.logo;
  if (!placeholderUrls.has(partner.id)) placeholderUrls.set(partner.id, placeholderLogoCanvas(partner).toDataURL('image/png'));
  return placeholderUrls.get(partner.id);
}

export function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, reject);
  });
}
/** Texture du logo (fichier ou dessin de secours) */
export async function partnerTexture(partner) {
  if (partner.logo) return loadImageTexture(partner.logo);
  return srgb(placeholderLogoCanvas(partner));
}
