// ---------------------------------------------------------------------------
//  WORLD : scène 3D — vallée (terrain.js), réseau de tuyaux PVC translucides à pivoter,
//  château d'eau, enseignes des partenaires, tuyau doré Carte BIG CE, particules
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as TEX from './textures.js';
import { Terrain } from './terrain.js';
import { DIRS, rotateSide } from './network.js';
import { cellToWorld, TILT, PIPE_Y } from './grid3d.js';
import { CAMERA_PITCH_DEG } from './camera.js';
import { gsap, M } from './motion.js';

const R_PIPE = 0.16, R_WATER = 0.105, RADIAL = 12, SEGS = 10;
const PITCH = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
const sideVec = (side) => new THREE.Vector3(DIRS[side].dc, 0, DIRS[side].dr);
const armCurve = (side) => new THREE.LineCurve3(new THREE.Vector3(0, PIPE_Y, 0), sideVec(side).multiplyScalar(0.5).setY(PIPE_Y));

export class World {
  constructor({ net, level, theme, logoTextures, cardTexture, quality, renderer }) {
    this.net = net; this.level = level; this.theme = theme; this.quality = quality;
    this.logoTextures = logoTextures; this.cardTexture = cardTexture;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);
    this.pieces = new Map();
    this.signs = new Map();
    this.fronts = [];
    this._materials();
    this._lights();
    this.terrain = new Terrain({ net, theme, quality });
    this.scene.add(this.terrain.group);
    this.scene.environment = this.terrain.buildEnvironment(renderer);
    this._network();
    this._tower();
    this._signs();
    this._particles();
    this._highlight();
    this.frontPool = [];
    for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(R_WATER * 1.25, 12, 8), this.mat.waterFront); s.visible = false; this.scene.add(s); this.frontPool.push(s); }
  }

  _materials() {
    const th = this.theme;
    this.mat = {
      glass: new THREE.MeshStandardMaterial({ color: th.pipe.glass, transparent: true, opacity: 0.58, roughness: 0.14, metalness: 0.05, envMapIntensity: 1.3 }),
      goldGlass: new THREE.MeshStandardMaterial({ color: 0xffd98a, transparent: true, opacity: 0.5, roughness: 0.12, metalness: 0.25, envMapIntensity: 1.6 }),
      steel: new THREE.MeshStandardMaterial({ color: th.pipe.steel, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.2 }),
      brass: new THREE.MeshStandardMaterial({ color: th.pipe.brass, roughness: 0.35, metalness: 0.85, envMapIntensity: 1.2 }),
      gold: new THREE.MeshStandardMaterial({ color: th.pipe.gold, metalness: 0.9, roughness: 0.3, emissive: 0x6b4a00, emissiveIntensity: 0.2 }),
      body: new THREE.MeshStandardMaterial({ color: th.pipe.body, roughness: 0.45, metalness: 0.1 }),
      water: new THREE.MeshStandardMaterial({ color: th.pipe.water, emissive: th.pipe.water, emissiveIntensity: 0.8, roughness: 0.2 }),
      waterFront: new THREE.MeshStandardMaterial({ color: th.pipe.waterGlow, emissive: th.pipe.waterGlow, emissiveIntensity: 1.1 }),
      concrete: new THREE.MeshStandardMaterial({ map: TEX.concreteTexture(), roughness: 0.92 }),
      rock: new THREE.MeshStandardMaterial({ color: th.rock, roughness: 0.95, flatShading: true }),
      white: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 }),
    };
    this.geo = {
      pipe: new THREE.TubeGeometry(armCurve('S'), SEGS, R_PIPE, 14, false),
      water: new THREE.TubeGeometry(armCurve('S'), SEGS, R_WATER, RADIAL, false),
      ring: new THREE.TorusGeometry(R_PIPE + 0.03, 0.035, 8, 22),
      joint: new THREE.SphereGeometry(R_PIPE + 0.06, 18, 14),
      coupling: new THREE.CylinderGeometry(R_PIPE + 0.04, R_PIPE + 0.04, 0.22, 16),
      support: new THREE.BoxGeometry(0.28, PIPE_Y - 0.1, 0.28),
    };
    this.glowTex = TEX.glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  }

  _lights() {
    const th = this.theme;
    this.hemi = new THREE.HemisphereLight(th.hemi.sky, th.hemi.ground, th.hemi.intensity);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun.color, th.sun.intensity);
    this.sun.position.set(...th.sun.position);
    this.sun.castShadow = !!this.quality.shadows;
    const s = this.sun.shadow;
    s.mapSize.set(this.quality.shadowSize, this.quality.shadowSize);
    const ext = Math.max(this.net.w, this.net.h) / 2 + 5;
    s.camera.left = -ext; s.camera.right = ext; s.camera.top = ext; s.camera.bottom = -ext;
    s.camera.near = 2; s.camera.far = 60; s.bias = -0.0006; s.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);
    this.fill = new THREE.DirectionalLight(0x9fc8ff, 0.5); this.fill.position.set(8, 6, -4);
    this.scene.add(this.fill);
  }

  // ------------------------------------------------------------ réseau
  _network() {
    const { net } = this;
    for (const row of net.cells) for (const cell of row) {
      if (cell.kind === 'pipe') this._piece(cell);
      else if (cell.kind === 'rock') this._rock(cell);
    }
  }
  /** Groupe d'une case : posé sur le plan incliné, pivote autour de sa normale */
  _cellGroup(cell) {
    const g = new THREE.Group();
    g.position.copy(cellToWorld(this.net, cell.c, cell.r, 0));
    g.rotation.set(TILT, 0, 0);
    return g;
  }
  _rock(cell) {
    const g = this._cellGroup(cell);
    const r = TEX.rng(cell.c * 31 + cell.r * 7 + 1);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + r() * 0.2, 0), this.mat.rock);
      m.position.set((r() - 0.5) * 0.45, 0.1 + r() * 0.12, (r() - 0.5) * 0.45); m.rotation.set(r() * 3, r() * 3, r() * 3); m.scale.y = 0.6 + r() * 0.5;
      m.castShadow = true; m.receiveShadow = true; g.add(m);
    }
    this.scene.add(g);
  }
  _piece(cell) {
    const g = this._cellGroup(cell);
    const outer = cell.gold ? this.mat.goldGlass : this.mat.glass;
    const metal = cell.gold ? this.mat.gold : this.mat.steel;
    const arms = {};
    for (const side of cell.base) {
      const a = new THREE.Group();
      a.rotation.y = -{ S: 0, W: Math.PI / 2, N: Math.PI, E: -Math.PI / 2 }[side]; // le bras modèle pointe vers le Sud
      const tube = new THREE.Mesh(this.geo.pipe, outer); tube.castShadow = true; tube.renderOrder = 2;
      const geo = this.geo.water.clone(); geo.setDrawRange(0, 0);
      const water = new THREE.Mesh(geo, this.mat.water); water.renderOrder = 1;
      const ring = new THREE.Mesh(this.geo.ring, metal); ring.position.set(0, PIPE_Y, 0.43); ring.castShadow = true;
      a.add(tube, water, ring);
      g.add(a);
      arms[side] = { group: a, geo, total: geo.index.count, side };
    }
    // raccord central : sphère (coude, té, croix) ou manchon (droit)
    let hub;
    if (cell.piece === 'straight') { hub = new THREE.Mesh(this.geo.coupling, metal); hub.rotation.z = Math.PI / 2; if (cell.base.includes('N')) hub.rotation.set(Math.PI / 2, 0, 0); hub.position.y = PIPE_Y; }
    else { hub = new THREE.Mesh(this.geo.joint, metal); hub.position.y = PIPE_Y; }
    hub.castShadow = true; hub.renderOrder = 3;
    g.add(hub);
    const support = new THREE.Mesh(this.geo.support, this.mat.concrete); support.position.y = (PIPE_Y - 0.1) / 2; support.receiveShadow = true; support.castShadow = true;
    g.add(support);
    if (cell.gold) {
      const card = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72 * 642 / 1010), new THREE.MeshBasicMaterial({ map: this.cardTexture, transparent: true, toneMapped: false, side: THREE.DoubleSide }));
      card.rotation.x = -PITCH - TILT; card.position.y = 0.95;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffe08a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.set(1.6, 1.6, 1); halo.position.y = 0.95;
      const holder = new THREE.Group(); holder.add(card, halo); // le porte-carte ne tourne pas avec la pièce
      holder.position.copy(g.position); holder.rotation.copy(g.rotation);
      this.scene.add(holder);
      this.card = { holder, card, halo };
    }
    g.rotation.y = -cell.rot * Math.PI / 2;
    this.scene.add(g);
    this.pieces.set(cell, { group: g, arms, hub });
  }

  /** Entrée en scène des pièces : tombent et se posent en cascade (40 ms) */
  dropIn() {
    const list = [...this.pieces.entries()].sort((a, b) => (a[0].r - b[0].r) || (a[0].c - b[0].c));
    list.forEach(([cell, p], i) => {
      gsap.killTweensOf(p.group.scale); gsap.killTweensOf(p.group.position);
      const y0 = p.group.position.y;
      gsap.set(p.group.scale, { x: 0.01, y: 0.01, z: 0.01 });
      gsap.to(p.group.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: M.spring, delay: 0.35 + i * 0.04 });
      gsap.fromTo(p.group.position, { y: y0 + 1.6 }, { y: y0, duration: 0.5, ease: 'power3.out', delay: 0.35 + i * 0.04 });
    });
    return 0.35 + list.length * 0.04 + 0.55;
  }

  /** Rotation d'une pièce : ressort premium + petit « coup » d'échelle */
  rotatePiece(cell) {
    const p = this.pieces.get(cell); if (!p) return;
    const target = -cell.rot * Math.PI / 2;
    // chemin le plus court vers la nouvelle orientation (toujours un quart de tour horaire)
    const cur = p.group.rotation.y;
    let goal = target; while (goal > cur + 0.01) goal -= Math.PI * 2; while (goal < cur - Math.PI / 2 - 0.01) goal += Math.PI * 2;
    gsap.killTweensOf(p.group.rotation);
    gsap.to(p.group.rotation, { y: goal, duration: 0.45, ease: M.spring });
    gsap.killTweensOf(p.group.scale);
    gsap.fromTo(p.group.scale, { x: 1.12, y: 1.12, z: 1.12 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power3.out' });
  }
  /** Refus (pièce mouillée) : vibration courte */
  shakePiece(cell) {
    const p = this.pieces.get(cell); if (!p) return;
    gsap.killTweensOf(p.group.position, 'x');
    const x0 = cellToWorld(this.net, cell.c, cell.r, 0).x;
    gsap.fromTo(p.group.position, { x: x0 - 0.06 }, { x: x0, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
  }

  /** Remplissage d'un bras : dir 'out' = du moyeu vers le bord, 'in' = du bord vers le moyeu */
  setArmFill(cell, side, dir, p) {
    const base = cell.kind === 'tower' ? 'S' : rotateSide(side, -cell.rot);
    const built = cell.kind === 'tower' ? this.towerArm : (this.pieces.get(cell) || {}).arms?.[base];
    if (!built) return;
    const k = THREE.MathUtils.clamp(p, 0, 1);
    const count = Math.round(k * SEGS) * RADIAL * 6;
    if (dir === 'out') built.geo.setDrawRange(0, count); else built.geo.setDrawRange(built.total - count, count);
  }
  /** Positions des fronts d'eau (sphères brillantes) */
  setFronts(fronts) {
    const v = new THREE.Vector3();
    this.frontPool.forEach((s, i) => {
      const f = fronts[i];
      if (!f) { s.visible = false; return; }
      const d = f.dir === 'out' ? f.p * 0.5 : (1 - f.p) * 0.5;
      const g = f.cell.kind === 'tower' ? this.towerGroup : this.pieces.get(f.cell).group;
      const base = f.cell.kind === 'tower' ? 'S' : rotateSide(f.side, -f.cell.rot);
      v.copy(sideVec(base)).multiplyScalar(d).setY(PIPE_Y);
      g.localToWorld(v);
      s.position.copy(v); s.visible = f.p > 0.02 && f.p < 0.98;
    });
  }
  /** Mouille visuellement le moyeu d'une pièce (le joint s'allume) */
  wetHub(cell) {
    const p = this.pieces.get(cell); if (!p) return;
    gsap.fromTo(p.hub.scale, { x: 1.25, y: 1.25, z: 1.25 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: M.spring });
  }
  dry() {
    for (const p of this.pieces.values()) for (const a of Object.values(p.arms)) a.geo.setDrawRange(0, 0);
    if (this.towerArm) this.towerArm.geo.setDrawRange(0, 0);
    this.setFronts([]);
    for (const s of this.signs.values()) { s.panel.material.emissiveIntensity = 0; s.halo.material.opacity = 0; s.fountain = false; }
  }
  cardTaken() {
    if (!this.card) return;
    const { card, halo } = this.card;
    gsap.to(card.position, { y: 2.4, duration: 0.9, ease: 'power2.in' });
    gsap.to(card.material, { opacity: 0, duration: 0.9, ease: 'power2.in' });
    gsap.to(halo.material, { opacity: 0, duration: 0.6 });
    gsap.to(card.rotation, { y: Math.PI * 2, duration: 0.9, ease: 'power2.inOut' });
  }

  // ------------------------------------------------------------ château d'eau
  _tower() {
    const t = this.net.tower;
    const g = this._cellGroup(t);
    const concrete = this.mat.concrete, steel = this.mat.steel;
    const legH = 2.3;
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, legH, 8), steel); leg.position.set(x, legH / 2, z); leg.castShadow = true; g.add(leg);
    }
    for (const [a, b] of [[[-0.6, -0.6], [0.6, 0.6]], [[0.6, -0.6], [-0.6, 0.6]]]) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 6), steel);
      br.position.set((a[0] + b[0]) / 2, 1.2, (a[1] + b[1]) / 2); br.rotation.z = Math.PI / 2; br.rotation.y = Math.atan2(b[1] - a[1], b[0] - a[0]); br.rotation.x = 0.85; g.add(br);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.35, 28), concrete); tank.position.y = legH + 0.68; tank.castShadow = true; tank.receiveShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.05, 8, 40), steel); band.position.y = legH + 0.1; band.rotation.x = Math.PI / 2;
    const band2 = band.clone(); band2.position.y = legH + 1.3;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.55, 28), new THREE.MeshStandardMaterial({ color: 0x8a3b2f, roughness: 0.7, metalness: 0.2 })); roof.position.y = legH + 1.35 + 0.27; roof.castShadow = true;
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 28), concrete); floor.position.y = legH; floor.castShadow = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.8), concrete); slab.position.y = 0.08; slab.receiveShadow = true;
    // tuyau de descente + volant
    const down = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, legH, 12), steel); down.position.y = legH / 2 + PIPE_Y; down.castShadow = true;
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), steel); elbow.position.y = PIPE_Y;
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 24), this.mat.brass); wheel.position.set(0, PIPE_Y + 0.75, 0); wheel.rotation.x = Math.PI / 2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 8), this.mat.brass); stem.position.y = PIPE_Y + 0.65;
    this.towerWheel = wheel;
    // jauge de niveau (tube de verre sur la cuve)
    const gaugeGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 12), this.mat.glass); gaugeGlass.position.set(0, legH + 0.68, 1.0); gaugeGlass.renderOrder = 2;
    const gaugeWater = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 10), this.mat.water); gaugeWater.position.set(0, legH + 0.68, 1.0); gaugeWater.renderOrder = 1;
    this.gaugeWater = gaugeWater; this.gaugeBase = legH + 0.68;
    g.add(tank, band, band2, roof, floor, slab, down, elbow, wheel, stem, gaugeGlass, gaugeWater);
    // bras de sortie vers le Sud (même modèle que les pièces)
    const a = new THREE.Group();
    const tube = new THREE.Mesh(this.geo.pipe, this.mat.glass); tube.castShadow = true; tube.renderOrder = 2;
    const geo = this.geo.water.clone(); geo.setDrawRange(0, 0);
    const water = new THREE.Mesh(geo, this.mat.water); water.renderOrder = 1;
    const ring = new THREE.Mesh(this.geo.ring, steel); ring.position.set(0, PIPE_Y, 0.43);
    a.add(tube, water, ring); g.add(a);
    this.towerArm = { group: a, geo, total: geo.index.count };
    this.scene.add(g);
    this.towerGroup = g;
    this.setTowerLevel(1);
  }
  /** Niveau de la cuve (0..1) : la jauge se vide pendant le compte à rebours */
  setTowerLevel(p) {
    const k = THREE.MathUtils.clamp(p, 0.02, 1);
    this.gaugeWater.scale.y = k; this.gaugeWater.position.y = this.gaugeBase - 0.5 + 0.5 * k;
  }

  // ------------------------------------------------------------ enseignes
  _signs() {
    for (const cell of this.net.signs) {
      const partner = this.logoTextures.__partners[cell.partnerId];
      const tex = this.logoTextures[cell.partnerId];
      const g = this._cellGroup(cell);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.95), this.mat.concrete); base.position.y = 0.11; base.receiveShadow = true; base.castShadow = true;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 10), this.mat.steel); post.position.y = 0.95; post.castShadow = true;
      g.add(base, post);
      // panneau au format du logo, face à la caméra
      const ratio = partner.ratio || 1, maxW = 1.45, maxH = 1.05;
      let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.5, toneMapped: true }));
      const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06), this.mat.white); back.position.z = -0.04; back.castShadow = true;
      const holder = new THREE.Group(); holder.add(back, panel);
      holder.rotation.x = -PITCH - TILT; holder.position.y = 1.55;
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: partner.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.set(2.6, 2.6, 1); halo.position.y = 1.55;
      g.add(holder, halo);
      // raccords d'arrivée vers les tuyaux voisins (allongés quand l'enseigne est poussée vers le bord)
      const stubs = [];
      for (const side of ['N', 'E', 'S', 'W']) {
        const n = this.net.neighbor(cell, side);
        if (!n || n.kind !== 'pipe') continue;
        const stub = new THREE.Group(); stub.rotation.y = -{ S: 0, W: Math.PI / 2, N: Math.PI, E: -Math.PI / 2 }[side];
        const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, PIPE_Y, 0.2), new THREE.Vector3(0, PIPE_Y, 0.5)), 4, R_PIPE, 14, false), this.mat.glass); tube.renderOrder = 2;
        const ring = new THREE.Mesh(this.geo.ring, this.mat.steel); ring.position.set(0, PIPE_Y, 0.43);
        const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12), this.mat.brass); tap.position.set(0, PIPE_Y, 0.15); tap.rotation.x = Math.PI / 2;
        stub.add(tube, ring, tap); g.add(stub);
        stubs.push({ group: stub, tube, ring, side });
      }
      // arroseur (jet d'eau quand l'enseigne est alimentée)
      const sprinkler = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), this.mat.brass); sprinkler.position.set(0.3, 0.45, 0.25); g.add(sprinkler);
      this.scene.add(g);
      this.signs.set(cell, { group: g, panel, halo, holder, sprinkler, partner, stubs, fountain: false, dir: cell.c < this.net.w / 2 ? -1 : 1 });
    }
    this.layoutSigns(0);
  }
  /** Pousse les enseignes vers les bords de l'écran de `offset` cases (paysage) ; le raccord s'allonge */
  layoutSigns(offset) {
    this.signOffset = offset;
    for (const [cell, s] of this.signs) {
      s.group.position.copy(cellToWorld(this.net, cell.c + s.dir * offset, cell.r, 0));
      for (const st of s.stubs) {
        const horizontal = st.side === 'E' || st.side === 'W';
        const len = 0.5 + (horizontal ? offset : 0);
        st.tube.geometry.dispose();
        st.tube.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, PIPE_Y, 0.2), new THREE.Vector3(0, PIPE_Y, len)), 4, R_PIPE, 14, false);
        st.ring.position.z = len - 0.07;
      }
    }
  }
  /** Points des enseignes (pour le cadrage caméra) */
  signPoints() { return [...this.signs.values()].map((s) => { const v = new THREE.Vector3(0, 2.1, 0); s.group.localToWorld(v); return v; }); }
  /** Enseigne alimentée : le panneau s'allume, halo, panneau qui « cogne », arroseur */
  feedSign(cell) {
    const s = this.signs.get(cell); if (!s) return;
    gsap.to(s.panel.material, { emissiveIntensity: 0.55, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(s.halo.material, { opacity: 0 }, { opacity: 0.8, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(s.holder.scale, { x: 1.18, y: 1.18, z: 1.18 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: M.spring });
    s.fountain = true;
    setTimeout(() => { s.fountain = false; }, 2600);
  }

  // ------------------------------------------------------------ survol
  _highlight() {
    this.hl = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.hl.visible = false; this.scene.add(this.hl);
  }
  highlight(cell, ok = true) {
    if (!cell) { this.hl.visible = false; return; }
    const p = this.pieces.get(cell); if (!p) { this.hl.visible = false; return; }
    this.hl.position.copy(p.group.position); this.hl.position.y += 0.03; this.hl.rotation.set(TILT, 0, 0);
    this.hl.material.color.set(ok ? 0xffffff : 0xff6060); this.hl.visible = true;
  }

  // ------------------------------------------------------------ particules
  _particles() {
    const N = 220;
    this.pN = N; this.pPos = new Float32Array(N * 3); this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    const mat = new THREE.PointsMaterial({ map: TEX.dropTexture(), size: 0.2, transparent: true, depthWrite: false, color: this.theme.pipe.waterGlow, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; this.scene.add(this.points);
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
      this.pLife[i] = 0.8 + Math.random() * 0.6;
    }
  }
  leakAt(cell, side) {
    const g = cell.kind === 'tower' ? this.towerGroup : this.pieces.get(cell).group;
    const base = cell.kind === 'tower' ? 'S' : rotateSide(side, -cell.rot);
    const pos = sideVec(base).multiplyScalar(0.5).setY(PIPE_Y); g.localToWorld(pos);
    const dir = sideVec(base); dir.applyQuaternion(g.quaternion);
    this.leak = { pos, dir, t: 1.7 };
  }
  stopLeak() { this.leak = null; }

  setLite(on) { this.terrain.setLite(on); }

  update(t, dt) {
    this.terrain.update(t, dt);
    if (this.frontPool.some((s) => s.visible)) this.towerWheel.rotation.z += dt * 2.2;
    if (this.card) { this.card.halo.material.opacity = 0.45 + Math.sin(t * 3) * 0.12; }
    this.hl.material.opacity = 0.4 + Math.sin(t * 6) * 0.15;
    if (this.leak) { this.emit(this.leak.pos, this.leak.dir, 5, { speed: 3.4 }); this.leak.t -= dt; if (this.leak.t <= 0) this.leak = null; }
    const v = new THREE.Vector3();
    for (const s of this.signs.values()) if (s.fountain) { v.set(0.3, 0.75, 0.25); s.group.localToWorld(v); this.emit(v, new THREE.Vector3(0, 0, 0), 3, { speed: 0, spread: 1.4, up: 3.2 }); }
    const P = this.pPos, V = this.pVel, L = this.pLife;
    for (let i = 0; i < this.pN; i++) {
      if (L[i] <= 0) continue;
      L[i] -= dt; V[i * 3 + 1] -= 9.5 * dt;
      P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
      if (L[i] <= 0 || P[i * 3 + 1] < -3) { L[i] = 0; P[i * 3 + 1] = -50; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Position monde d'une case (popups) */
  worldPos(cell, y = PIPE_Y) { return cellToWorld(this.net, cell.c, cell.r, y); }
}
