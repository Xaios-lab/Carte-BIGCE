// ---------------------------------------------------------------------------
//  TEXTURES PROCÉDURALES (canvas) : pierre, sol, feuilles, flammes, halos…
//  Aucun asset externe nécessaire à part les logos.
// ---------------------------------------------------------------------------
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// petit générateur pseudo-aléatoire déterministe (rendu identique à chaque chargement)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(c) { return '#' + new THREE.Color(c).getHexString(); }
function rgba(c, a) { const k = new THREE.Color(c); return `rgba(${(k.r * 255) | 0},${(k.g * 255) | 0},${(k.b * 255) | 0},${a})`; }

/** Bruit "granit" : taches superposées */
function speckle(ctx, w, h, rand, count, color, alpha, rmin, rmax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rgba(color, alpha * (0.4 + rand() * 0.6));
    const r = rmin + rand() * (rmax - rmin);
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, r, r * (0.5 + rand()), rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Pierre moussue pour les murs (répétable) */
export function stoneTexture(theme) {
  const S = 256;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const rand = rng(7);
  ctx.fillStyle = hex(theme.wall.color);
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, rand, 900, 0x000000, 0.18, 2, 9);
  speckle(ctx, S, S, rand, 500, 0xffffff, 0.10, 1, 6);
  speckle(ctx, S, S, rand, 160, theme.wall.moss, 0.35, 6, 22);
  speckle(ctx, S, S, rand, 400, theme.wall.moss, 0.25, 1, 4);
  // fissures
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let x = rand() * S, y = rand() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 40; y += (rand() - 0.5) * 40; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Motif de tatouage polynésien : rangée de triangles / dents de requin */
function tattooBand(ctx, x, y, w, h, color, alpha, rand) {
  ctx.fillStyle = rgba(color, alpha);
  const n = Math.max(2, Math.floor(w / h));
  const tw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    if (i % 2 === 0) { ctx.moveTo(x + i * tw, y + h); ctx.lineTo(x + i * tw + tw / 2, y); ctx.lineTo(x + (i + 1) * tw, y + h); }
    else { ctx.moveTo(x + i * tw, y); ctx.lineTo(x + i * tw + tw / 2, y + h); ctx.lineTo(x + (i + 1) * tw, y); }
    ctx.closePath(); ctx.fill();
  }
}

/** Sol du labyrinthe : dalles de basalte par cellule, gravures tatouage discrètes */
export function floorTexture(maze, theme) {
  const px = 48;
  const W = maze.w * px, H = maze.h * px;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const rand = rng(21);
  ctx.fillStyle = hex(theme.floor.stone);
  ctx.fillRect(0, 0, W, H);
  speckle(ctx, W, H, rand, 2500, 0x000000, 0.25, 3, 14);
  speckle(ctx, W, H, rand, 1200, 0xffffff, 0.05, 2, 8);

  for (let r = 0; r < maze.h; r++) {
    for (let cidx = 0; cidx < maze.w; cidx++) {
      if (maze.isWall(cidx, r)) continue;
      const x = cidx * px, y = r * px;
      // dalle
      const g = ctx.createLinearGradient(x, y, x + px, y + px);
      g.addColorStop(0, rgba(theme.floor.path, 1));
      g.addColorStop(1, rgba(theme.floor.pathEdge, 1));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, px, px);
      // grain
      for (let i = 0; i < 14; i++) {
        ctx.fillStyle = rgba(rand() > 0.5 ? 0x000000 : 0xffffff, 0.06 + rand() * 0.08);
        const rr = 1 + rand() * 4;
        ctx.beginPath(); ctx.ellipse(x + rand() * px, y + rand() * px, rr, rr * 0.6, rand() * 3, 0, 7); ctx.fill();
      }
      // joints entre dalles
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, px - 2, px - 2);
      // gravure tatouage (rare)
      if (rand() < 0.22) {
        tattooBand(ctx, x + 8, y + px / 2 - 4, px - 16, 8, theme.floor.carve, 0.13, rand);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Sol de la jungle autour du labyrinthe (répétable, sombre) */
export function groundTexture(theme) {
  const S = 512;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const rand = rng(99);
  ctx.fillStyle = hex(theme.ground);
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, rand, 1500, 0x000000, 0.35, 4, 26);
  speckle(ctx, S, S, rand, 700, theme.leaves.b, 0.25, 6, 30);
  speckle(ctx, S, S, rand, 300, theme.leaves.a, 0.12, 3, 12);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Feuille large (type monstera / philodendron) avec nervures */
export function leafTexture(color, variant = 0) {
  const W = 128, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const rand = rng(31 + variant);
  const base = new THREE.Color(color);
  const dark = base.clone().multiplyScalar(0.55);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.25);
  ctx.translate(W / 2, H);
  const g = ctx.createLinearGradient(0, 0, 0, -H);
  g.addColorStop(0, hex(dark)); g.addColorStop(0.6, hex(base)); g.addColorStop(1, hex(light));
  ctx.fillStyle = g;
  if (variant % 2 === 0) {
    // feuille ovale pointue
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(W * 0.62, -H * 0.25, W * 0.55, -H * 0.8, 0, -H);
    ctx.bezierCurveTo(-W * 0.55, -H * 0.8, -W * 0.62, -H * 0.25, 0, 0);
    ctx.fill();
    // échancrures
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 5; i++) {
      const y = -H * (0.18 + i * 0.15);
      const s = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(s * W * 0.42, y, W * 0.17, H * 0.035, s * 0.6, 0, 7);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // fougère : folioles de part et d'autre d'une tige
    ctx.strokeStyle = hex(dark); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H * 0.97); ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const y = -H * (0.08 + i * 0.058);
      const len = W * 0.45 * (1 - i / 20);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.quadraticCurveTo(s * len * 0.6, y - 14, s * len, y - 22);
        ctx.quadraticCurveTo(s * len * 0.5, y + 2, 0, y + 6);
        ctx.fill();
      }
    }
  }
  // nervures
  ctx.strokeStyle = rgba(light, 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H * 0.95); ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const y = -H * i * 0.12;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W * 0.4, y - H * 0.08); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(-W * 0.4, y - H * 0.08); ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fleur d'hibiscus (blanche : la couleur vient de l'instance) */
export function flowerTexture() {
  const S = 128;
  const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate((i / 5) * Math.PI * 2);
    const g = ctx.createLinearGradient(0, 0, 0, -S * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(S * 0.3, -S * 0.1, S * 0.28, -S * 0.5, 0, -S * 0.47);
    ctx.bezierCurveTo(-S * 0.28, -S * 0.5, -S * 0.3, -S * 0.1, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(255,230,120,1)';
  ctx.beginPath(); ctx.arc(0, 0, S * 0.07, 0, 7); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Noix de coco : fibres brunes (corps de Pac-Man, façon visuel promo) */
export function coconutTexture() {
  const W = 512, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const rand = rng(77);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#a8672e'); g.addColorStop(0.5, '#8d4f22'); g.addColorStop(1, '#6a3715');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // fibres
  for (let i = 0; i < 900; i++) {
    const x = rand() * W, y = rand() * H, len = 8 + rand() * 30;
    ctx.strokeStyle = rand() > 0.5 ? `rgba(60,30,10,${0.25 + rand() * 0.4})` : `rgba(220,160,90,${0.15 + rand() * 0.3})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * (rand() - 0.5), y + len * 0.4 * (rand() - 0.5)); ctx.stroke();
  }
  speckle(ctx, W, H, rand, 300, 0x000000, 0.25, 2, 6);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Halo radial doux (sprites, lucioles) */
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const c = canvas(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/,1\)$/, ',0.5)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Flamme de torche (sprite) */
export function flameTexture() {
  const W = 64, H = 128;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(W / 2, H * 0.7, 2, W / 2, H * 0.6, H * 0.6);
  g.addColorStop(0, 'rgba(255,255,220,1)');
  g.addColorStop(0.25, 'rgba(255,200,60,0.95)');
  g.addColorStop(0.6, 'rgba(255,90,10,0.55)');
  g.addColorStop(1, 'rgba(255,40,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(W / 2, 4);
  ctx.bezierCurveTo(W, H * 0.45, W * 0.95, H, W / 2, H);
  ctx.bezierCurveTo(W * 0.05, H, 0, H * 0.45, W / 2, 4);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Rayon de lumière vertical (dégradé) */
export function rayTexture() {
  const W = 32, H = 256;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,230,0.9)');
  g.addColorStop(0.7, 'rgba(255,255,230,0.25)');
  g.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const h = ctx.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = h; ctx.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Bandeau tatouage pour les fantômes / Pac-Man (répétable horizontalement) */
export function tattooBandTexture(color = '#ffffff') {
  const W = 256, H = 32;
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);
  const rand = rng(5);
  tattooBand(ctx, 0, 4, W, 12, color, 0.9, rand);
  ctx.fillStyle = color;
  ctx.fillRect(0, 20, W, 3);
  for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.arc(i * 16 + 8, 27, 2, 0, 7); ctx.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Carte BIG CE (bonus) */
export function cardTexture() {
  const W = 256, H = 160;
  const c = canvas(W, H), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0e7c86'); g.addColorStop(0.5, '#15a3a0'); g.addColorStop(1, '#f2b134');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, 18); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(W * 0.8, H * 0.2, 90, 50, 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px Impact, "Arial Black", sans-serif';
  ctx.fillText('BIG CE', 22, 64);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('CARTE PARTENAIRES', 22, 96);
  ctx.fillStyle = '#ffd25a';
  ctx.fillRect(22, 112, 64, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(110, 124, 120, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Visage tiki pour les fantômes (yeux + bouche à dents), appliqué en emissive */
export function tikiFaceTexture() {
  const S = 256;
  const c = canvas(S, S), ctx = c.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  // bouche : rangée de dents
  const y = S * 0.62, w = S * 0.5, x0 = S * 0.25;
  ctx.fillRect(x0, y - 3, w, 4);
  const n = 7, tw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * tw, y); ctx.lineTo(x0 + i * tw + tw / 2, y + 16); ctx.lineTo(x0 + (i + 1) * tw, y);
    ctx.closePath(); ctx.fill();
  }
  // motifs sur les côtés
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 5; i++) {
    const yy = S * 0.3 + i * 22;
    ctx.beginPath(); ctx.moveTo(S * 0.06, yy); ctx.lineTo(S * 0.16, yy + 8); ctx.lineTo(S * 0.06, yy + 16); ctx.fill();
    ctx.beginPath(); ctx.moveTo(S * 0.94, yy); ctx.lineTo(S * 0.84, yy + 8); ctx.lineTo(S * 0.94, yy + 16); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; resolve(t); }, undefined, reject);
  });
}
