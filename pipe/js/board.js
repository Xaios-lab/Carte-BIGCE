// ---------------------------------------------------------------------------
//  BOARD : grille logique (cases, pose des tuyaux) et FLOW : progression de l'eau
//  Aucune dépendance 3D : tout est testable en pur JavaScript.
// ---------------------------------------------------------------------------
import { DIRS, PIECES, channelFor, exitOf } from './pieces.js';

const SOURCE_CHARS = { '^': 'N', 'v': 'S', '<': 'W', '>': 'E' };

export class Board {
  constructor(level) {
    this.level = level;
    const grid = level.grid;
    this.h = grid.length;
    this.w = grid[0].length;
    this.cells = [];
    this.manas = [];
    this.source = null;
    this.reservoir = null;
    let manaIndex = 0;
    for (let r = 0; r < this.h; r++) {
      const row = [];
      for (let c = 0; c < this.w; c++) {
        const ch = grid[r][c] || '#';
        const cell = { c, r, type: 'empty', piece: null, special: null, flooded: [], manaId: null, dir: null };
        if (ch === '#') cell.type = 'rock';
        else if (ch === 'T') cell.type = 'palm';
        else if (ch === 'R') { cell.type = 'reservoir'; this.reservoir = cell; }
        else if (SOURCE_CHARS[ch]) { cell.type = 'source'; cell.dir = SOURCE_CHARS[ch]; this.source = cell; }
        else if (ch === 'o') {
          cell.type = 'mana';
          cell.piece = PIECES.X;
          cell.flooded = [false, false];
          cell.manaId = level.mana[manaIndex % level.mana.length];
          manaIndex++;
          this.manas.push(cell);
        }
        row.push(cell);
      }
      this.cells.push(row);
    }
    if (!this.source || !this.reservoir) throw new Error('Niveau invalide : source ou réservoir manquant');
  }

  cellAt(c, r) { return (c < 0 || r < 0 || c >= this.w || r >= this.h) ? null : this.cells[r][c]; }

  /** Centre d'une case en coordonnées monde (x, z) ; le plateau est centré sur l'origine */
  toWorld(c, r) { return { x: c - (this.w - 1) / 2, z: r - (this.h - 1) / 2 }; }
  /** Case sous un point du sol (ou null) */
  fromWorld(x, z) {
    const c = Math.round(x + (this.w - 1) / 2), r = Math.round(z + (this.h - 1) / 2);
    return this.cellAt(c, r);
  }

  /** Une case libre, ou un tuyau posé mais encore sec, peut recevoir une pièce */
  canPlace(cell) {
    if (!cell || cell.type !== 'empty') return false;
    return !cell.piece || !cell.flooded.some(Boolean);
  }
  /** Pose une pièce ; renvoie la pièce remplacée (ou null) */
  place(cell, item) {
    const replaced = cell.piece ? { piece: cell.piece, special: cell.special } : null;
    cell.piece = item.piece;
    cell.special = item.special || null;
    cell.flooded = item.piece.channels.map(() => false);
    return replaced;
  }

  /** Retire tous les tuyaux posés et assèche tout */
  reset() {
    for (const row of this.cells) for (const cell of row) {
      if (cell.type === 'empty') { cell.piece = null; cell.special = null; cell.flooded = []; }
      else if (cell.type === 'mana') cell.flooded = [false, false];
    }
  }
  /** Assèche les tuyaux (après une fuite) mais garde ceux qui sont posés */
  drain() {
    for (const row of this.cells) for (const cell of row) cell.flooded = cell.flooded.map(() => false);
  }

  /** Nombre de tuyaux posés (hors Manas) */
  get placedCount() {
    let n = 0;
    for (const row of this.cells) for (const cell of row) if (cell.type === 'empty' && cell.piece) n++;
    return n;
  }
}

/**
 * Tête d'eau : la case traversée, le canal, le côté d'entrée (null pour la source),
 * le côté de sortie et la progression 0..1 dans le canal.
 */
export class Flow {
  constructor(board) {
    this.board = board;
    this.head = null;
    this.filled = 0;   // tuyaux remplis (quota)
    this.trail = [];   // historique des cases traversées
  }

  start() {
    const s = this.board.source;
    this.head = { cell: s, chan: 0, enter: null, exit: s.dir, progress: 0 };
    this.filled = 0;
    this.trail = [];
  }

  /**
   * Fait avancer l'eau de `amount` (fraction de canal). Renvoie la liste des événements :
   *   { type: 'enter', cell, chan, enter }      l'eau entre dans un nouveau tuyau
   *   { type: 'mana', cell } / { type: 'card', cell } / { type: 'cross', cell } bonus traversés
   *   { type: 'reservoir', cell, enter }        arrivée au réservoir (fin heureuse si ouvert)
   *   { type: 'leak', cell, side }              l'eau sort dans le vide : fuite
   */
  advance(amount) {
    const events = [];
    if (!this.head) return events;
    this.head.progress += amount;
    while (this.head && this.head.progress >= 1) {
      const carry = this.head.progress - 1;
      const ev = this._step();
      events.push(...ev);
      if (this.head) this.head.progress = carry;
    }
    return events;
  }

  _step() {
    const { cell, exit } = this.head;
    const d = DIRS[exit];
    const n = this.board.cellAt(cell.c + d.dc, cell.r + d.dr);
    const enter = d.opp;
    const leak = () => { this.head = null; return [{ type: 'leak', cell, side: exit }]; };
    if (!n) return leak();
    if (n.type === 'reservoir') { this.head = null; return [{ type: 'reservoir', cell: n, enter }]; }
    if (!n.piece) return leak();
    const chan = channelFor(n.piece, enter);
    if (chan < 0 || n.flooded[chan]) return leak();
    n.flooded[chan] = true;
    this.head = { cell: n, chan, enter, exit: exitOf(n.piece, chan, enter), progress: 0 };
    this.filled++;
    this.trail.push(n);
    const events = [{ type: 'enter', cell: n, chan, enter }];
    if (n.type === 'mana') events.push({ type: 'mana', cell: n });
    else if (n.special === 'card') events.push({ type: 'card', cell: n });
    else if (n.piece.cross && n.flooded.every(Boolean)) events.push({ type: 'cross', cell: n });
    return events;
  }
}
