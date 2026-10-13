// ---------------------------------------------------------------------------
//  MAZE : grille logique + extraction des contours de murs (pour l'extrusion 3D)
// ---------------------------------------------------------------------------

export const DIRS = {
  up:    { x: 0, z: -1, name: 'up' },
  left:  { x: -1, z: 0, name: 'left' },
  down:  { x: 0, z: 1, name: 'down' },
  right: { x: 1, z: 0, name: 'right' },
  none:  { x: 0, z: 0, name: 'none' },
};
export const DIR_ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right]; // ordre de priorité (classique)

export function opposite(d) {
  if (d === DIRS.up) return DIRS.down;
  if (d === DIRS.down) return DIRS.up;
  if (d === DIRS.left) return DIRS.right;
  if (d === DIRS.right) return DIRS.left;
  return DIRS.none;
}

export class Maze {
  constructor(rows) {
    this.rows = rows.map((r) => r.split(''));
    this.h = rows.length;
    this.w = rows[0].length;
    this.dots = [];      // {c, r, idx}
    this.manas = [];     // {c, r}
    this.tunnelRows = new Set();
    this.house = [];     // cellules intérieures de la maison
    this.door = null;    // {c, r}
    this.pacStart = { c: 1, r: 1 };
    this.bonusCell = null;

    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        const ch = this.rows[r][c];
        if (ch === '.') this.dots.push({ c, r, idx: this.dots.length });
        else if (ch === 'o') this.manas.push({ c, r });
        else if (ch === 'T') this.tunnelRows.add(r);
        else if (ch === 'G') this.house.push({ c, r });
        else if (ch === '=') this.door = { c, r };
        else if (ch === 'P') this.pacStart = { c, r };
        else if (ch === 'B') this.bonusCell = { c, r };
      }
    }
    // centre de la maison et case de sortie (juste au-dessus de la porte)
    const hc = this.house.reduce((a, p) => a + p.c, 0) / this.house.length;
    const hr = this.house.reduce((a, p) => a + p.r, 0) / this.house.length;
    this.houseCenter = { c: Math.round(hc), r: Math.round(hr) };
    this.houseExit = this.door ? { c: this.door.c, r: this.door.r - 1 } : { c: this.houseCenter.c, r: this.houseCenter.r - 2 };
    if (!this.bonusCell) this.bonusCell = { c: this.houseCenter.c, r: this.houseCenter.r + 2 };
    this.dotIndex = new Map(this.dots.map((d) => [d.c + ',' + d.r, d]));
  }

  dotAt(c, r) { return this.dotIndex.get(this.wrapC(c) + ',' + r) || null; }

  wrapC(c) { return ((c % this.w) + this.w) % this.w; }

  charAt(c, r) {
    if (r < 0 || r >= this.h) return '#';
    return this.rows[r][this.wrapC(c)];
  }

  isWall(c, r) { return this.charAt(c, r) === '#'; }
  isDoor(c, r) { return this.charAt(c, r) === '='; }
  isHouse(c, r) { return this.charAt(c, r) === 'G'; }
  isTunnelCell(c, r) {
    if (!this.tunnelRows.has(r)) return false;
    const cc = this.wrapC(c);
    return cc <= 3 || cc >= this.w - 4;
  }

  /** Une entité "normale" peut-elle entrer dans cette case ? */
  isOpen(c, r, { allowDoor = false } = {}) {
    const ch = this.charAt(c, r);
    if (ch === '#') return false;
    if (ch === '=' && !allowDoor) return false;
    return true;
  }

  /** Centre monde d'une cellule (y=0) */
  toWorld(c, r) {
    return { x: c - (this.w - 1) / 2, z: r - (this.h - 1) / 2 };
  }

  // -------------------------------------------------------------------------
  //  CONTOURS : boucles rectilignes autour des régions de murs.
  //  Chaque arête est orientée avec le mur à sa GAUCHE ; les boucles
  //  extérieures sont CCW (aire > 0), les trous CW (aire < 0).
  // -------------------------------------------------------------------------
  wallLoops() {
    const isW = (c, r) => (c < 0 || c >= this.w || r < 0 || r >= this.h) ? false : this.rows[r][c] === '#';
    const edges = [];
    for (let r = 0; r < this.h; r++) {
      for (let c = 0; c < this.w; c++) {
        if (!isW(c, r)) continue;
        if (!isW(c, r - 1)) edges.push([[c, r], [c + 1, r]]);          // bas (côté r)
        if (!isW(c, r + 1)) edges.push([[c + 1, r + 1], [c, r + 1]]);  // haut
        if (!isW(c - 1, r)) edges.push([[c, r + 1], [c, r]]);          // gauche
        if (!isW(c + 1, r)) edges.push([[c + 1, r], [c + 1, r + 1]]);  // droite
      }
    }
    const key = (p) => p[0] + ',' + p[1];
    const byStart = new Map();
    edges.forEach((e, i) => {
      const k = key(e[0]);
      if (!byStart.has(k)) byStart.set(k, []);
      byStart.get(k).push(i);
    });
    const used = new Uint8Array(edges.length);
    const loops = [];
    for (let i = 0; i < edges.length; i++) {
      if (used[i]) continue;
      const loop = [];
      let e = i;
      let guard = 0;
      while (!used[e] && guard++ < 100000) {
        used[e] = 1;
        const [a, b] = edges[e];
        loop.push(a);
        const d = [b[0] - a[0], b[1] - a[1]];
        const cands = (byStart.get(key(b)) || []).filter((j) => !used[j]);
        if (!cands.length) break;
        // préférer le virage à gauche (reste collé au même mur), puis tout droit, puis droite
        let best = null, bestScore = -Infinity;
        for (const j of cands) {
          const [p, q] = edges[j];
          const dd = [q[0] - p[0], q[1] - p[1]];
          const cross = d[0] * dd[1] - d[1] * dd[0];
          const dot = d[0] * dd[0] + d[1] * dd[1];
          const score = cross > 0 ? 3 : dot > 0 ? 2 : 1;
          if (score > bestScore) { bestScore = score; best = j; }
        }
        e = best;
      }
      // fusion des arêtes colinéaires
      const simp = [];
      for (let k = 0; k < loop.length; k++) {
        const p0 = loop[(k - 1 + loop.length) % loop.length], p1 = loop[k], p2 = loop[(k + 1) % loop.length];
        const d1 = [p1[0] - p0[0], p1[1] - p0[1]], d2 = [p2[0] - p1[0], p2[1] - p1[1]];
        if (d1[0] * d2[1] - d1[1] * d2[0] !== 0) simp.push(p1);
      }
      if (simp.length >= 4) loops.push(simp);
    }
    return loops;
  }
}

/** Aire signée d'une boucle (CCW > 0) */
export function signedArea(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i], q = loop[(i + 1) % loop.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

/** Décale une boucle rectiligne vers la gauche de chaque arête (vers le mur) de d */
export function offsetLoop(loop, d) {
  const n = loop.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = loop[(i - 1 + n) % n], p1 = loop[i], p2 = loop[(i + 1) % n];
    const d1 = norm([p1[0] - p0[0], p1[1] - p0[1]]);
    const d2 = norm([p2[0] - p1[0], p2[1] - p1[1]]);
    const n1 = [-d1[1] * d, d1[0] * d];
    const n2 = [-d2[1] * d, d2[0] * d];
    // arête précédente verticale ? => x vient d'elle, y de la suivante
    if (d1[0] === 0) out.push([p1[0] + n1[0], p1[1] + n2[1]]);
    else out.push([p1[0] + n2[0], p1[1] + n1[1]]);
  }
  return out;
}

function norm(v) {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}

export function pointInLoop(pt, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const xi = loop[i][0], yi = loop[i][1], xj = loop[j][0], yj = loop[j][1];
    const inter = (yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (inter) inside = !inside;
  }
  return inside;
}
