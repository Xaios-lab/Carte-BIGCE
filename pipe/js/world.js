// ---------------------------------------------------------------------------
//  WORLD : scène 3D — îlot de sable dans le lagon, tuyaux PVC bleus translucides,
//  eau turquoise qui les remplit, robinet source, réservoir du partenaire, Manas dorés
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as TEX from './textures.js';
import { DIRS, PIECES } from './pieces.js';
import { CAMERA_PITCH_DEG } from './camera.js';

export const PIPE_Y = 0.3;
const R_PIPE = 0.25, R_WATER = 0.165;
const RADIAL = 12;
const PITCH = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);

const sidePoint = (side) => side === 'C' ? new THREE.Vector3(0, PIPE_Y, 0) : new THREE.Vector3(DIRS[side].dc * 0.5, PIPE_Y, DIRS[side].dr * 0.5);
const isStraight = (a, b) => a === 'C' || b === 'C' || DIRS[a].opp === b;
/** Courbe d'un canal entre deux côtés : droite ou coude arrondi passant par le centre */
export function channelCurve(a, b) {
  const pa = sidePoint(a), pb = sidePoint(b);
  if (isStraight(a, b)) return new THREE.LineCurve3(pa, pb);
  return new THREE.QuadraticBezierCurve3(pa, new THREE.Vector3(0, PIPE_Y, 0), pb);
}
const segsFor = (a, b) => isStraight(a, b) ? 8 : 22;

export class World {
  constructor({ board, level, theme, logoTextures, cardTexture, quality }) {
    this.board = board; this.level = level; this.theme = theme; this.quality = quality;
    this.logoTextures = logoTextures; this.cardTexture = cardTexture;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.sky.bottom);
    this.scene.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);
    this.anims = [];       // { t, dur, fn(k), done }
    this.pieces = new Map(); // cell -> { group, channels }
    this.manaVisuals = new Map();
    this.lite = false;
    this._materials();
    this._lights();
    this._island();
    this._sea();
    this._decor();
    this._source();
    this._reservoir();
    this._manas();
    this._cursor();
    this._particles();
    this.previews = {};
    for (const id of Object.keys(PIECES)) { const g = this.buildPiece(PIECES[id], { preview: true }); g.group.visible = false; this.scene.add(g.group); this.previews[id] = g.group; }
    this.front = new THREE.Mesh(new THREE.SphereGeometry(R_WATER * 1.15, 14, 10), this.mat.waterFront);
    this.front.visible = false;
    this.scene.add(this.front);
  }

  // ------------------------------------------------------------ matériaux
  _materials() {
    const th = this.theme;
    this.mat = {
      glass: new THREE.MeshStandardMaterial({ color: th.pipe.glass, transparent: true, opacity: 0.42, roughness: 0.18, metalness: 0.05, side: THREE.FrontSide }),
      goldGlass: new THREE.MeshStandardMaterial({ color: 0xffd98a, transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.2 }),
      preview: new THREE.MeshStandardMaterial({ color: th.pipe.preview, transparent: true, opacity: 0.32, roughness: 0.3, depthWrite: false }),
      body: new THREE.MeshStandardMaterial({ color: th.pipe.body, roughness: 0.4, metalness: 0.1 }),
      brass: new THREE.MeshStandardMaterial({ color: th.pipe.brass, roughness: 0.3, metalness: 0.85 }),
      gold: new THREE.MeshStandardMaterial({ color: th.gold, metalness: 0.85, roughness: 0.3, emissive: 0x6b4a00, emissiveIntensity: 0.25 }),
      water: new THREE.MeshStandardMaterial({ color: th.pipe.water, emissive: th.pipe.water, emissiveIntensity: 0.45, roughness: 0.25 }),
      waterFront: new THREE.MeshStandardMaterial({ color: th.pipe.waterGlow, emissive: th.pipe.waterGlow, emissiveIntensity: 1.2 }),
      rock: new THREE.MeshStandardMaterial({ color: th.rock, roughness: 0.95, flatShading: true }),
      trunk: new THREE.MeshStandardMaterial({ color: th.palm.trunk, roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ color: th.palm.leaf, roughness: 0.7, side: THREE.DoubleSide }),
      leaf2: new THREE.MeshStandardMaterial({ color: th.palm.leaf2, roughness: 0.7, side: THREE.DoubleSide }),
    };
    this.geo = {};
    this.glowTex = TEX.glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  }

  _lights() {
    const th = this.theme;
    this.hemi = new THREE.HemisphereLight(th.hemi.sky, th.hemi.ground, th.hemi.intensity);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun.color, th.sun.intensity);
    this.sun.position.set(-6, 14, 7);
    this.sun.castShadow = !!this.quality.shadows;
    const s = this.sun.shadow;
    s.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    const ext = Math.max(this.board.w, this.board.h) / 2 + 2;
    s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext;
    s.camera.near = 2; s.camera.far = 40; s.bias = -0.0008; s.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  // ------------------------------------------------------------ îlot, mer, décor
  _island() {
    const { board, theme } = this;
    const sand = TEX.sandTexture(theme);
    sand.repeat.set(0.5, 0.5);
    const sandDark = sand.clone(); sandDark.repeat.set(board.w / 2, board.h / 2); sandDark.needsUpdate = true;
    const W = board.w + 1.3, H = board.h + 1.3;
    const plat = new THREE.Mesh(new THREE.BoxGeometry(W, 0.6, H), new THREE.MeshStandardMaterial({ color: theme.sand.dark, map: sandDark, roughness: 1 }));
    plat.position.y = -0.3; plat.receiveShadow = true;
    this.scene.add(plat);
    // liseré turquoise entre les dalles (fond de bassin)
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(board.w + 0.1, board.h + 0.1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: theme.sand.grid, roughness: 0.6, transparent: true, opacity: 0.55 }));
    grid.position.y = 0.004; grid.receiveShadow = true;
    this.scene.add(grid);
    // plage autour
    const beach = new THREE.Mesh(new THREE.BoxGeometry(W + 1.6, 0.34, H + 1.6), new THREE.MeshStandardMaterial({ color: theme.sand.light, map: sand, roughness: 1 }));
    beach.position.y = -0.47; beach.receiveShadow = true;
    this.scene.add(beach);
    // dalles de chaque case jouable
    const tileGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
    const tileMat = new THREE.MeshStandardMaterial({ color: theme.sand.light, map: sand, roughness: 1 });
    const tileMatDark = new THREE.MeshStandardMaterial({ color: theme.sand.edge, map: sand, roughness: 1 });
    for (const row of board.cells) for (const cell of row) {
      const w = board.toWorld(cell.c, cell.r);
      const m = new THREE.Mesh(tileGeo, (cell.c + cell.r) % 2 ? tileMatDark : tileMat);
      m.position.set(w.x, 0.012, w.z); m.receiveShadow = true;
      this.scene.add(m);
    }
  }

  _sea() {
    const th = this.theme;
    this.seaTex = TEX.seaTexture(th);
    this.seaTex.repeat.set(12, 12);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 220).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: th.sea.shallow, map: this.seaTex, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    sea.position.y = -0.56;
    this.scene.add(sea);
    this.sea = sea;
    // écume au bord de la plage
    const W = this.board.w + 3.2, H = this.board.h + 3.2;
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, H + 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: th.sea.foam, transparent: true, opacity: 0.35, depthWrite: false }));
    foam.position.y = -0.55;
    this.scene.add(foam);
    this.foam = foam;
  }

  _decor() {
    const { board, theme, quality } = this;
    const r = TEX.rng(31);
    this.decor = [];
    // rochers et cocotiers sur les cases bloquées
    for (const row of board.cells) for (const cell of row) {
      const w = board.toWorld(cell.c, cell.r);
      if (cell.type === 'rock') this.scene.add(this._rock(w.x, w.z, r));
      else if (cell.type === 'palm') { const p = this._palm(r, 1); p.position.set(w.x, 0, w.z); this.scene.add(p); }
    }
    // cocotiers autour de l'îlot
    const hw = board.w / 2 + 1.25, hh = board.h / 2 + 1.25;
    const spots = [[-hw, -hh], [hw, -hh], [-hw, hh * 0.3], [hw, hh * 0.3], [-hw * 0.4, -hh], [hw * 0.5, -hh]];
    spots.slice(0, quality.palms).forEach(([x, z], i) => {
      const p = this._palm(r, 1.25 + r() * 0.3); p.position.set(x, -0.3, z); p.rotation.y = r() * Math.PI * 2;
      this.scene.add(p); this.decor.push(p);
      if (i >= 4) p.userData.lite = true;
    });
    // fleurs d'hibiscus sur la plage
    const flowerTex = theme.flowers.map((c) => TEX.flowerTexture(c));
    this.flowers = [];
    for (let i = 0; i < quality.flowers; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerTex[i % flowerTex.length], transparent: true, depthWrite: false }));
      const side = Math.floor(r() * 4);
      const x = side < 2 ? (r() - 0.5) * (board.w + 2) : (side === 2 ? -1 : 1) * (board.w / 2 + 1.0 + r() * 0.3);
      const z = side >= 2 ? (r() - 0.5) * (board.h + 2) : (side === 0 ? -1 : 1) * (board.h / 2 + 1.0 + r() * 0.3);
      sp.position.set(x, -0.18, z); sp.scale.setScalar(0.32 + r() * 0.12);
      this.scene.add(sp); this.flowers.push(sp);
    }
  }
  _rock(x, z, r) {
    const g = new THREE.Group();
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + r() * 0.2, 0), this.mat.rock);
      m.position.set((r() - 0.5) * 0.4, 0.12 + r() * 0.1, (r() - 0.5) * 0.4);
      m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = 0.7 + r() * 0.5;
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    g.position.set(x, 0, z);
    return g;
  }
  _palm(r, scale = 1) {
    const g = new THREE.Group();
    const h = 1.5 * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.11, h, 7), this.mat.trunk);
    trunk.position.y = h / 2; trunk.rotation.z = (r() - 0.5) * 0.25; trunk.castShadow = true;
    g.add(trunk);
    const top = new THREE.Group();
    top.position.set(trunk.rotation.z * -h * 0.5, h, 0);
    const leafGeo = new THREE.PlaneGeometry(0.28 * scale, 1.05 * scale, 1, 4);
    const pos = leafGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setZ(i, -Math.pow((y + 0.52 * scale) / (1.05 * scale), 2) * 0.5 * scale); }
    leafGeo.computeVertexNormals();
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(leafGeo, i % 2 ? this.mat.leaf : this.mat.leaf2);
      leaf.rotation.y = (i / 7) * Math.PI * 2 + r() * 0.3;
      leaf.rotation.x = -0.35 - r() * 0.25;
      leaf.position.y = 0.05;
      leaf.translateY(0.5 * scale);
      leaf.castShadow = true;
      top.add(leaf);
    }
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 8, 6), this.mat.trunk); c.position.set((r() - 0.5) * 0.18, -0.02, (r() - 0.5) * 0.18); top.add(c); }
    g.add(top);
    g.userData.top = top;
    return g;
  }

  // ------------------------------------------------------------ tuyaux
  _tubeGeo(key, a, b, radius, radial) {
    const k = `${key}:${a}${b}`;
    if (!this.geo[k]) this.geo[k] = new THREE.TubeGeometry(channelCurve(a, b), segsFor(a, b), radius, radial, false);
    return this.geo[k];
  }
  _ring(side, mat = this.mat.brass) {
    if (!this.geo.ring) this.geo.ring = new THREE.TorusGeometry(R_PIPE + 0.03, 0.045, 8, 22);
    const m = new THREE.Mesh(this.geo.ring, mat);
    const p = sidePoint(side); m.position.copy(p);
    if (side === 'E' || side === 'W') m.rotation.y = Math.PI / 2;
    // les bagues sont posées légèrement en retrait du bord pour ne pas se chevaucher avec la voisine
    m.position.x -= DIRS[side].dc * 0.07; m.position.z -= DIRS[side].dr * 0.07;
    m.castShadow = true;
    return m;
  }

  /**
   * Construit le groupe 3D d'une pièce : tubes translucides, bagues laiton, et un tube d'eau par canal
   * (révélé progressivement par `drawRange`). Options : preview (fantôme), gold (vanne Mana / Carte).
   */
  buildPiece(piece, { preview = false, gold = false } = {}) {
    const group = new THREE.Group();
    const outer = preview ? this.mat.preview : gold ? this.mat.goldGlass : this.mat.glass;
    const channels = [];
    for (const [a, b] of piece.channels) {
      const tube = new THREE.Mesh(this._tubeGeo('pipe', a, b, R_PIPE, 14), outer);
      tube.castShadow = !preview; tube.renderOrder = 2;
      group.add(tube);
      if (!preview) {
        const geo = this._tubeGeo('water', a, b, R_WATER, RADIAL).clone();
        const water = new THREE.Mesh(geo, this.mat.water);
        water.renderOrder = 1;
        const total = geo.index.count;
        geo.setDrawRange(0, 0);
        group.add(water);
        channels.push({ a, b, water, geo, total, segs: segsFor(a, b), curve: channelCurve(a, b) });
      }
      if (!preview) for (const side of [a, b]) if (side !== 'C') group.add(this._ring(side, gold ? this.mat.gold : this.mat.brass));
    }
    if (piece.cross) {
      const joint = new THREE.Mesh(new THREE.SphereGeometry(R_PIPE + 0.05, 16, 12), outer);
      joint.position.y = PIPE_Y; joint.renderOrder = 3; joint.castShadow = !preview;
      group.add(joint);
    }
    return { group, channels };
  }

  /** Pose (ou remplace) la pièce d'une case, avec un petit rebond */
  setPiece(cell, item) {
    this.clearPiece(cell);
    const isCard = item.special === 'card';
    const built = this.buildPiece(item.piece, { gold: isCard });
    const w = this.board.toWorld(cell.c, cell.r);
    built.group.position.set(w.x, 0, w.z);
    if (isCard) this._cardBadge(built);
    this.scene.add(built.group);
    this.pieces.set(cell, built);
    built.group.scale.setScalar(1.25); built.group.position.y = 0.5;
    this.anims.push({ t: 0, dur: 0.22, fn: (k) => { const e = 1 - Math.pow(1 - k, 3); built.group.scale.setScalar(1.25 - 0.25 * e); built.group.position.y = 0.5 * (1 - e); } });
    return built;
  }
  clearPiece(cell) {
    const b = this.pieces.get(cell);
    if (!b) return;
    this.scene.remove(b.group);
    for (const ch of b.channels) ch.geo.dispose();
    this.pieces.delete(cell);
  }
  _cardBadge(built) {
    // carte BIG CE flottante au-dessus de la croix dorée, face caméra
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95 * 642 / 1010), new THREE.MeshBasicMaterial({ map: this.cardTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
    card.rotation.x = -PITCH; card.position.y = 1.15;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x9ad8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(1.9, 1.9, 1); halo.position.y = 1.15;
    built.group.add(card, halo);
    built.card = card; built.cardHalo = halo;
  }
  /** La Carte BIG CE s'envole quand l'eau la traverse */
  cardTaken(cell) {
    const b = this.pieces.get(cell);
    if (!b || !b.card) return;
    const card = b.card, halo = b.cardHalo;
    this.anims.push({ t: 0, dur: 0.9, fn: (k) => { card.position.y = 1.15 + k * 1.6; card.material.opacity = 1 - k; halo.material.opacity = 0.6 * (1 - k); card.rotation.y = k * Math.PI * 2; }, done: () => { b.group.remove(card, halo); b.card = null; } });
  }

  /** Remplissage d'un canal : progress 0..1 depuis le côté `enter` */
  setFill(cell, chan, enter, progress) {
    const b = this.pieces.get(cell) || this.manaVisuals.get(cell) || (cell === this.board.source ? this.sourceBuilt : null);
    if (!b) return;
    const ch = b.channels[chan];
    if (!ch) return;
    const p = THREE.MathUtils.clamp(progress, 0, 1);
    const n = Math.round(p * ch.segs);
    const count = n * RADIAL * 6;
    const fromA = enter === null || enter === ch.a;
    if (fromA) ch.geo.setDrawRange(0, count); else ch.geo.setDrawRange(ch.total - count, count);
    ch.filledFrom = fromA ? 'a' : 'b';
    // front d'eau
    const pt = ch.curve.getPointAt(fromA ? p : 1 - p);
    this.front.position.copy(pt).add(b.group.position);
    this.front.visible = p > 0.02 && p < 0.995;
  }
  /** Assèche tous les tuyaux (nouvelle manche) */
  resetWater() {
    const all = [...this.pieces.values(), ...this.manaVisuals.values(), this.sourceBuilt];
    for (const b of all) for (const ch of b.channels) ch.geo.setDrawRange(0, 0);
    this.front.visible = false;
    this.reservoirFill(0);
    for (const v of this.manaVisuals.values()) this._setManaLit(v, false);
  }

  // ------------------------------------------------------------ robinet source
  _source() {
    const s = this.board.source;
    const w = this.board.toWorld(s.c, s.r);
    const g = new THREE.Group(); g.position.set(w.x, 0, w.z);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.22, 0.56), this.mat.body); base.position.y = 0.11; base.castShadow = true; base.receiveShadow = true;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.75, 12), this.mat.brass); col.position.y = 0.55; col.castShadow = true;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.04, 8, 24), this.mat.brass); wheel.position.y = 0.95; wheel.rotation.x = Math.PI / 2; wheel.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10), this.mat.brass); hub.position.y = 0.95;
    for (let i = 0; i < 3; i++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.03, 0.03), this.mat.brass); spoke.position.y = 0.95; spoke.rotation.y = (i * Math.PI) / 3; g.add(spoke); }
    g.add(base, col, wheel, hub);
    this.sourceWheel = wheel;
    // canal du centre vers le côté de sortie
    const pseudo = { channels: [['C', s.dir]] };
    const built = this.buildPiece(pseudo);
    g.add(built.group);
    built.group = g; // remplissage positionné par rapport au groupe du robinet
    this.sourceBuilt = built;
    // jauge du compte à rebours au sol
    this.gauge = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 48, 1, 0, 0.001).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: this.theme.pipe.water, transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false }));
    this.gauge.position.y = 0.03; this.gauge.visible = false;
    g.add(this.gauge);
    this.gaugeTheta = 0;
    this.scene.add(g);
    this.sourceGroup = g;
  }
  /** Jauge circulaire : p = 0..1 (1 = l'eau part). Masquée si p = null */
  sourceGauge(p) {
    if (p === null) { this.gauge.visible = false; return; }
    this.gauge.visible = true;
    const theta = Math.max(0.001, p * Math.PI * 2);
    if (Math.abs(theta - this.gaugeTheta) > 0.04) {
      this.gauge.geometry.dispose();
      this.gauge.geometry = new THREE.RingGeometry(0.5, 0.62, 48, 1, Math.PI / 2 - theta, theta).rotateX(-Math.PI / 2);
      this.gaugeTheta = theta;
    }
  }

  // ------------------------------------------------------------ réservoir
  _reservoir() {
    const c = this.board.reservoir;
    const w = this.board.toWorld(c.c, c.r);
    const g = new THREE.Group(); g.position.set(w.x, 0, w.z);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 24, 1, true), this.mat.glass); tank.position.y = 0.5; tank.renderOrder = 2;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.12, 24), this.mat.body); bottom.position.y = 0.06; bottom.castShadow = true;
    const bandTop = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.04, 8, 28), this.mat.brass); bandTop.position.y = 0.92; bandTop.rotation.x = Math.PI / 2;
    const bandMid = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.03, 8, 28), this.mat.brass); bandMid.position.y = 0.5; bandMid.rotation.x = Math.PI / 2;
    const lid = new THREE.Group(); lid.position.y = 0.96;
    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.08, 24), this.mat.body); lidMesh.castShadow = true;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 1.4 })); lamp.position.y = 0.1;
    lid.add(lidMesh, lamp);
    this.lamp = lamp; this.lid = lid; this.lidOpen = 0; this.lidTarget = 0;
    // eau à l'intérieur
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 20), this.mat.water); inner.position.y = 0.1; inner.scale.y = 0.001; inner.renderOrder = 1;
    this.tankWater = inner;
    // raccords d'entrée sur les 4 côtés
    for (const side of ['N', 'E', 'S', 'W']) {
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(R_PIPE, R_PIPE, 0.16, 12), this.mat.glass);
      const p = sidePoint(side); stub.position.set(p.x * 0.84, PIPE_Y, p.z * 0.84);
      if (side === 'N' || side === 'S') stub.rotation.x = Math.PI / 2; else stub.rotation.z = Math.PI / 2;
      stub.renderOrder = 2;
      g.add(stub, this._ring(side));
    }
    g.add(tank, bottom, bandTop, bandMid, lid, inner);
    // médaillon du partenaire principal
    const tex = this.logoTextures.__main;
    if (tex) { const badge = this._medallion(tex, 0.5); badge.position.y = 1.75; g.add(badge); this.reservoirBadge = badge; }
    this.scene.add(g);
    this.reservoirGroup = g;
  }
  /** Le réservoir s'ouvre (quota atteint) : couvercle levé, voyant vert */
  setReservoirOpen(open) {
    this.lidTarget = open ? 1 : 0;
    this.lamp.material.color.set(open ? 0x3bff7a : 0xff3b3b);
    this.lamp.material.emissive.set(open ? 0x20ff60 : 0xff2020);
  }
  reservoirFill(p) {
    const k = THREE.MathUtils.clamp(p, 0, 1);
    this.tankWater.scale.y = Math.max(0.001, k); this.tankWater.position.y = 0.1 + 0.4 * k;
  }

  _medallion(tex, R = 0.6) {
    const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.08, 48), this.mat.gold); back.rotation.x = Math.PI / 2; back.castShadow = true;
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.96, R * 1.96), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.2, toneMapped: false })); logo.position.z = 0.045;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 10, 48), this.mat.gold);
    const badge = new THREE.Group(); badge.add(back, logo, rim);
    badge.rotation.x = -PITCH; // face à la caméra : cercle parfait, logo à l'endroit
    return badge;
  }

  // ------------------------------------------------------------ Manas (vannes dorées)
  _manas() {
    const { board, level } = this;
    board.manas.forEach((cell, i) => {
      const partner = this.logoTextures.__partners[cell.manaId];
      const tex = this.logoTextures[cell.manaId];
      const w = board.toWorld(cell.c, cell.r);
      const built = this.buildPiece(PIECES.X, { gold: true });
      built.group.position.set(w.x, 0, w.z);
      // volant de vanne
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), this.mat.gold); stem.position.y = PIPE_Y + 0.3;
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 24), this.mat.gold); wheel.position.y = PIPE_Y + 0.5; wheel.rotation.x = Math.PI / 2; wheel.castShadow = true;
      built.group.add(stem, wheel);
      // médaillon logo + halo coloré
      const badge = this._medallion(tex, 0.42); badge.position.y = 1.55;
      const color = partner.color === '#1b1b1b' ? 0x9ad8ff : partner.color;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.set(2.2, 2.2, 1); halo.position.y = 1.55;
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, color, toneMapped: false }));
      ground.position.y = 0.02;
      built.group.add(badge, halo, ground);
      built.badge = badge; built.halo = halo; built.wheel = wheel; built.phase = i * 1.3; built.lit = false;
      this.scene.add(built.group);
      this.manaVisuals.set(cell, built);
    });
  }
  _setManaLit(v, lit) {
    v.lit = lit;
    v.halo.material.opacity = lit ? 0.85 : 0.35;
  }
  /** L'eau traverse une vanne Mana : médaillon qui tourne, halo intense */
  manaLit(cell) {
    const v = this.manaVisuals.get(cell);
    if (!v) return;
    this._setManaLit(v, true);
    v.animating = true;
    this.anims.push({ t: 0, dur: 1.2, fn: (k) => { v.badge.rotation.y = k * Math.PI * 4; v.badge.position.y = 1.55 + Math.sin(k * Math.PI) * 0.5; v.halo.scale.setScalar(2.2 + Math.sin(k * Math.PI) * 1.6); }, done: () => { v.badge.rotation.y = 0; v.halo.scale.set(2.2, 2.2, 1); v.animating = false; } });
  }

  // ------------------------------------------------------------ curseur & aperçu
  _cursor() {
    this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.cursor.position.y = 0.02; this.cursor.visible = false;
    this.scene.add(this.cursor);
    this.previewCell = null; this.previewId = null;
  }
  setCursor(cell, ok = true) {
    if (!cell) { this.cursor.visible = false; return; }
    const w = this.board.toWorld(cell.c, cell.r);
    this.cursor.position.set(w.x, 0.02, w.z); this.cursor.visible = true;
    this.cursor.material.color.set(ok ? 0xffffff : 0xff5050);
  }
  setPreview(cell, piece) {
    for (const g of Object.values(this.previews)) g.visible = false;
    if (!cell || !piece) return;
    const g = this.previews[piece.id];
    const w = this.board.toWorld(cell.c, cell.r);
    g.position.set(w.x, 0, w.z); g.visible = true;
  }

  // ------------------------------------------------------------ particules (fuite, fontaine)
  _particles() {
    const N = 160;
    this.pN = N; this.pPos = new Float32Array(N * 3); this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    const mat = new THREE.PointsMaterial({ map: TEX.dropTexture(), size: 0.26, transparent: true, depthWrite: false, color: this.theme.pipe.waterGlow, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false;
    this.scene.add(this.points);
    for (let i = 0; i < N; i++) this.pPos[i * 3 + 1] = -50;
    this.pNext = 0;
  }
  emit(pos, dir, count, { speed = 3, spread = 1.2, up = 2.5 } = {}) {
    for (let k = 0; k < count; k++) {
      const i = this.pNext; this.pNext = (this.pNext + 1) % this.pN;
      this.pPos[i * 3] = pos.x; this.pPos[i * 3 + 1] = pos.y; this.pPos[i * 3 + 2] = pos.z;
      this.pVel[i * 3] = dir.x * speed + (Math.random() - 0.5) * spread;
      this.pVel[i * 3 + 1] = up + Math.random() * 1.5;
      this.pVel[i * 3 + 2] = dir.z * speed + (Math.random() - 0.5) * spread;
      this.pLife[i] = 0.9 + Math.random() * 0.6;
    }
  }
  /** Jet d'eau à la sortie d'un tuyau (fuite) */
  leakAt(cell, side) {
    const w = this.board.toWorld(cell.c, cell.r);
    const d = DIRS[side];
    const pos = new THREE.Vector3(w.x + d.dc * 0.5, PIPE_Y, w.z + d.dr * 0.5);
    this.leak = { pos, dir: new THREE.Vector3(d.dc, 0, d.dr), t: 1.6 };
  }
  stopLeak() { this.leak = null; }
  /** Fontaine de victoire au-dessus du réservoir */
  fountain(on) { this.fountainOn = on; }

  // ------------------------------------------------------------ boucle
  setLite(on) {
    this.lite = on;
    for (const f of this.flowers) f.visible = !on;
    for (const p of this.decor) if (p.userData.lite) p.visible = !on;
  }

  update(t, dt) {
    // animations ponctuelles
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i]; a.t += dt; const k = Math.min(1, a.t / a.dur); a.fn(k);
      if (k >= 1) { if (a.done) a.done(); this.anims.splice(i, 1); }
    }
    // mer
    if (!this.lite) { this.seaTex.offset.x = (t * 0.012) % 1; this.seaTex.offset.y = (t * 0.008) % 1; }
    this.foam.material.opacity = 0.28 + Math.sin(t * 1.3) * 0.1;
    // palmiers qui ondulent
    for (const p of this.decor) if (p.visible) p.userData.top.rotation.z = Math.sin(t * 1.1 + p.position.x) * 0.05;
    // Manas : médaillons flottants
    for (const v of this.manaVisuals.values()) {
      if (!v.animating) v.badge.position.y = 1.55 + Math.sin(t * 1.6 + v.phase) * 0.06;
      if (v.lit) v.wheel.rotation.z += dt * 3;
    }
    for (const b of this.pieces.values()) if (b.card) { b.card.position.y = 1.15 + Math.sin(t * 2.2) * 0.06; b.cardHalo.position.y = b.card.position.y; }
    if (this.reservoirBadge) this.reservoirBadge.position.y = 1.75 + Math.sin(t * 1.4) * 0.05;
    // couvercle du réservoir
    this.lidOpen += (this.lidTarget - this.lidOpen) * (1 - Math.exp(-dt * 5));
    this.lid.position.y = 0.96 + this.lidOpen * 0.3; this.lid.rotation.z = this.lidOpen * 0.5; this.lid.position.x = -this.lidOpen * 0.2;
    this.lamp.material.emissiveIntensity = 1.2 + Math.sin(t * 6) * 0.4;
    // robinet : le volant tourne quand l'eau coule
    if (this.front.visible) this.sourceWheel.rotation.y += dt * 2.5;
    this.cursor.material.opacity = 0.18 + Math.sin(t * 5) * 0.08;
    // particules
    if (this.leak) { this.emit(this.leak.pos, this.leak.dir, 4, { speed: 3.2 }); this.leak.t -= dt; if (this.leak.t <= 0) this.leak = null; }
    if (this.fountainOn) this.emit(new THREE.Vector3(this.reservoirGroup.position.x, 1.1, this.reservoirGroup.position.z), new THREE.Vector3(0, 0, 0), 3, { speed: 0, spread: 1.6, up: 4.5 });
    const P = this.pPos, V = this.pVel, L = this.pLife;
    for (let i = 0; i < this.pN; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt; V[i * 3 + 1] -= 9.5 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (L[i] <= 0 || P[i * 3 + 1] < -0.5) { L[i] = 0; P[i * 3 + 1] = -50; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Position monde d'une case (pour les popups) */
  worldPos(cell, y = PIPE_Y) { const w = this.board.toWorld(cell.c, cell.r); return new THREE.Vector3(w.x, y, w.z); }
}
