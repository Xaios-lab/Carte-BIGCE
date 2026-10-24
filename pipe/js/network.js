// ---------------------------------------------------------------------------
//  NETWORK : grille de tuyaux (pièces, orientation, mélange) + FLOW : eau ramifiée
//  Aucune dépendance 3D : testable en pur JavaScript.
//
//  Une pièce = un moyeu (centre de la case) + des bras vers les côtés ouverts.
//  L'eau entre par un bras (de l'extérieur vers le moyeu), remplit le moyeu, puis
//  ressort par tous les autres bras (du moyeu vers l'extérieur), et ainsi de suite.
// ---------------------------------------------------------------------------

export const SIDES = ['N', 'E', 'S', 'W'];
export const DIRS = {
  N: { dc: 0, dr: -1, opp: 'S' },
  E: { dc: 1, dr: 0, opp: 'W' },
  S: { dc: 0, dr: 1, opp: 'N' },
  W: { dc: -1, dr: 0, opp: 'E' },
};
/** Côté après rotation d'un quart de tour horaire */
const CW = { N: 'E', E: 'S', S: 'W', W: 'N' };
export const rotateSide = (side, k) => { let s = side; for (let i = 0; i < ((k % 4) + 4) % 4; i++) s = CW[s]; return s; };

const GLYPHS = {
  '─': ['W', 'E'], '│': ['N', 'S'],
  '┌': ['E', 'S'], '┐': ['W', 'S'], '└': ['N', 'E'], '┘': ['N', 'W'],
  '┬': ['W', 'E', 'S'], '┴': ['W', 'E', 'N'], '├': ['N', 'S', 'E'], '┤': ['N', 'S', 'W'],
  '┼': ['N', 'E', 'S', 'W'],
};
/** Type visuel / logique d'une pièce d'après ses bras */
export function pieceKind(sides) {
  if (sides.length === 4) return 'cross';
  if (sides.length === 3) return 'tee';
  return DIRS[sides[0]].opp === sides[1] ? 'straight' : 'elbow';
}
/** Nombre d'orientations distinctes */
const STATES = { straight: 2, elbow: 4, tee: 4, cross: 1 };

/** Générateur pseudo-aléatoire déterministe (même mélange pour une même graine) */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class Network {
  constructor(level) {
    this.level = level;
    const grid = level.grid.map((row) => Array.from(row)); // caractères de tracé = 1 point de code
    this.h = grid.length;
    this.w = Math.max(...grid.map((r) => r.length));
    this.cells = [];
    this.pipes = [];
    this.signs = [];
    this.tower = null;
    const gold = new Set((level.gold || []).map(([c, r]) => `${c},${r}`));
    for (let r = 0; r < this.h; r++) {
      const row = [];
      for (let c = 0; c < this.w; c++) {
        const ch = grid[r][c] || '.';
        const cell = { c, r, kind: 'grass', base: [], arms: [], rot: 0, solvedRot: 0, gold: false, wet: null, sign: null, fed: false };
        if (ch === '#') cell.kind = 'rock';
        else if (ch === 'T') { cell.kind = 'tower'; cell.arms = ['S']; this.tower = cell; }
        else if ('ABCD'.includes(ch)) { cell.kind = 'sign'; cell.sign = ch; cell.partnerId = level.signs[ch]; this.signs.push(cell); }
        else if (GLYPHS[ch]) {
          cell.kind = 'pipe';
          cell.base = GLYPHS[ch].slice();
          cell.arms = cell.base.slice();
          cell.piece = pieceKind(cell.base);
          cell.gold = gold.has(`${c},${r}`);
          this.pipes.push(cell);
        }
        row.push(cell);
      }
      this.cells.push(row);
    }
    if (!this.tower) throw new Error('Niveau invalide : château d’eau manquant');
    this.dry();
  }

  cellAt(c, r) { return (c < 0 || r < 0 || c >= this.w || r >= this.h) ? null : this.cells[r][c]; }
  neighbor(cell, side) { const d = DIRS[side]; return this.cellAt(cell.c + d.dc, cell.r + d.dr); }

  /** Applique une orientation (0..3) à une pièce */
  setRot(cell, rot) {
    cell.rot = ((rot % 4) + 4) % 4;
    cell.arms = cell.base.map((s) => rotateSide(s, cell.rot));
  }
  /** Mélange : chaque pièce reçoit une orientation aléatoire, au moins 60 % hors position résolue */
  scramble(seed) {
    const r = rng(seed);
    const rotatable = this.pipes.filter((p) => STATES[p.piece] > 1);
    let tries = 0;
    do {
      for (const p of rotatable) this.setRot(p, Math.floor(r() * STATES[p.piece]) * (p.piece === 'straight' ? 1 : 1));
      tries++;
    } while (rotatable.filter((p) => !this.isSolved(p)).length < rotatable.length * 0.6 && tries < 20);
  }
  /** Une pièce est en position résolue si ses bras correspondent au plan (modulo symétrie des droits) */
  isSolved(cell) {
    const a = cell.arms.slice().sort().join(''), b = cell.base.slice().sort().join('');
    return a === b;
  }
  canRotate(cell) {
    return cell && cell.kind === 'pipe' && cell.piece !== 'cross' && !this.isWet(cell);
  }
  rotate(cell) { this.setRot(cell, cell.rot + 1); }

  isWet(cell) { return !!(cell.wet && (cell.wet.hub || Object.keys(cell.wet.arms).length)); }
  /** Assèche tout */
  dry() {
    for (const row of this.cells) for (const cell of row) { cell.wet = { hub: false, arms: {} }; cell.fed = false; }
  }
  get fedCount() { return this.signs.filter((s) => s.fed).length; }
}

/**
 * Fronts d'eau : chaque front remplit un bras ({ cell, side, dir: 'in' | 'out', p: 0..1 }).
 * `advance(dt)` renvoie les événements :
 *   { type: 'hub', cell }            le moyeu d'un tuyau se remplit (score)
 *   { type: 'gold', cell }           tuyau doré traversé
 *   { type: 'sign', cell }           une enseigne est alimentée
 *   { type: 'leak', cell, side }     l'eau sort dans le vide
 *   { type: 'done' }                 plus aucun front actif (toutes les enseignes alimentées ou réseau plein)
 */
export class Flow {
  constructor(net) {
    this.net = net;
    this.fronts = [];
    this.wetCount = 0;
    this.started = false;
  }
  start() {
    const t = this.net.tower;
    t.wet.hub = true;
    this.fronts = [{ cell: t, side: 'S', dir: 'out', p: 0 }];
    t.wet.arms.S = this.fronts[0];
    this.started = true;
  }
  get active() { return this.fronts.length > 0; }

  advance(dt, cellsPerSec) {
    const events = [];
    if (!this.fronts.length) return events;
    const step = dt * cellsPerSec * 2; // un bras = une demi-case
    const next = [];
    for (const f of this.fronts) {
      f.p += step;
      if (f.p < 1) { next.push(f); continue; }
      f.p = 1;
      if (f.dir === 'in') {
        // le moyeu se remplit, l'eau repart par les autres bras (une seule fois, même si deux bras y arrivent)
        if (f.cell.wet.hub) continue;
        f.cell.wet.hub = true;
        events.push({ type: 'hub', cell: f.cell });
        this.wetCount++;
        if (f.cell.gold) events.push({ type: 'gold', cell: f.cell });
        for (const side of f.cell.arms) {
          if (side === f.side || f.cell.wet.arms[side]) continue;
          const nf = { cell: f.cell, side, dir: 'out', p: 0 };
          f.cell.wet.arms[side] = nf;
          next.push(nf);
        }
      } else {
        // bout du bras : voisin ?
        const n = this.net.neighbor(f.cell, f.side);
        const opp = DIRS[f.side].opp;
        if (n && n.kind === 'sign') {
          if (!n.fed) { n.fed = true; n.wet.hub = true; events.push({ type: 'sign', cell: n, from: f.cell, side: f.side }); }
        } else if (n && n.kind === 'pipe' && n.arms.includes(opp)) {
          if (!n.wet.arms[opp] && !n.wet.hub) {
            const nf = { cell: n, side: opp, dir: 'in', p: 0 };
            n.wet.arms[opp] = nf;
            next.push(nf);
          } else if (n.wet.arms[opp] && n.wet.arms[opp].dir === 'out' && n.wet.arms[opp].p < 1) {
            // deux fronts se rejoignent dans le même bras : il se remplit des deux côtés
            n.wet.arms[opp].p = 1;
          }
        } else {
          events.push({ type: 'leak', cell: f.cell, side: f.side });
          this.fronts = [];
          return events;
        }
      }
    }
    this.fronts = next;
    if (!this.fronts.length) events.push({ type: 'done' });
    return events;
  }
}
