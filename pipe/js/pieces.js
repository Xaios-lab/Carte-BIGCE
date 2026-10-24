// ---------------------------------------------------------------------------
//  PIECES : les 7 tuyaux posables, leurs raccords, et la file aléatoire
// ---------------------------------------------------------------------------

/** Directions : N = vers le haut de l'écran (r-1), S = vers le bas (r+1) */
export const DIRS = {
  N: { dc: 0, dr: -1, opp: 'S', angle: Math.PI },
  E: { dc: 1, dr: 0, opp: 'W', angle: Math.PI / 2 },
  S: { dc: 0, dr: 1, opp: 'N', angle: 0 },
  W: { dc: -1, dr: 0, opp: 'E', angle: -Math.PI / 2 },
};
export const DIR_LIST = ['N', 'E', 'S', 'W'];

/**
 * Chaque pièce = un ou deux canaux. Un canal relie deux côtés de la case.
 * La croix (X) a deux canaux indépendants : l'eau peut la traverser deux fois.
 */
export const PIECES = {
  H:  { id: 'H',  channels: [['W', 'E']], weight: 2.2 },
  V:  { id: 'V',  channels: [['N', 'S']], weight: 2.2 },
  NE: { id: 'NE', channels: [['N', 'E']], weight: 1.4 },
  ES: { id: 'ES', channels: [['E', 'S']], weight: 1.4 },
  SW: { id: 'SW', channels: [['S', 'W']], weight: 1.4 },
  WN: { id: 'WN', channels: [['W', 'N']], weight: 1.4 },
  X:  { id: 'X',  channels: [['N', 'S'], ['W', 'E']], weight: 1.0, cross: true },
};
export const PIECE_IDS = Object.keys(PIECES);

/** Canal d'une pièce utilisable depuis le côté `side` (null si aucun) */
export function channelFor(piece, side) {
  for (let i = 0; i < piece.channels.length; i++) if (piece.channels[i].includes(side)) return i;
  return -1;
}
/** Côté de sortie d'un canal quand on y entre par `side` */
export function exitOf(piece, chan, side) {
  const [a, b] = piece.channels[chan];
  return side === a ? b : a;
}

/**
 * File des pièces à venir. Tirage pondéré "par sac" : chaque pièce ressort
 * au plus tard tous les ~2 sacs, ce qui évite les longues séries injouables.
 * Les pièces spéciales (Carte BIG CE) sont insérées par le jeu via `inject`.
 */
export class PieceQueue {
  constructor(size = 5, rnd = Math.random) {
    this.size = size;
    this.rnd = rnd;
    this.bag = [];
    this.items = [];
    while (this.items.length < size) this.items.push(this._draw());
  }
  _refill() {
    const bag = [];
    for (const id of PIECE_IDS) { const n = Math.round(PIECES[id].weight * 2); for (let i = 0; i < n; i++) bag.push(id); }
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    this.bag = bag;
  }
  _draw() {
    if (!this.bag.length) this._refill();
    return { piece: PIECES[this.bag.pop()], special: null };
  }
  /** Pièce suivante (celle qui sera posée) */
  get next() { return this.items[0]; }
  /** Retire la pièce suivante et complète la file */
  pop() {
    const it = this.items.shift();
    this.items.push(this._draw());
    return it;
  }
  /** Insère une pièce spéciale (croix dorée "Carte BIG CE") en fin de file visible */
  inject(special) {
    this.items.splice(this.items.length - 1, 0, { piece: PIECES.X, special });
    this.items.length = this.size;
  }
}
