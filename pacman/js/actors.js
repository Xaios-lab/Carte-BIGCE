// ---------------------------------------------------------------------------
//  ACTORS : Pac-Man & fantômes (logique de déplacement sur grille + meshes 3D)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { DIRS, DIR_ORDER, opposite } from './maze.js';
import * as TEX from './textures.js';

const EPS = 1e-4;

/** Déplacement continu sur une grille, décision aux centres de cases */
export class Mover {
  constructor(maze) {
    this.maze = maze;
    this.x = 0; this.z = 0;
    this.dir = DIRS.none;
    this.visX = 0; this.visZ = 0; // décalage visuel (virage anticipé) qui s'amortit
  }
  setCell(c, r) { this.x = c; this.z = r; this.visX = this.visZ = 0; }
  get cell() { return { c: this.maze.wrapC(Math.round(this.x)), r: Math.round(this.z) }; }
  get atCenter() { return Math.abs(this.x - Math.round(this.x)) < EPS && Math.abs(this.z - Math.round(this.z)) < EPS; }

  wrap() {
    const W = this.maze.w;
    if (this.x < -0.5) this.x += W;
    else if (this.x > W - 0.5) this.x -= W;
  }

  /** Avance de `dist` cases ; `decide(c, r)` est appelé à chaque centre de case et peut changer this.dir */
  advance(dist, decide) {
    let guard = 0;
    while (dist > 1e-9 && guard++ < 12) {
      const cx = Math.round(this.x), cz = Math.round(this.z);
      const atC = Math.abs(this.x - cx) < EPS && Math.abs(this.z - cz) < EPS;
      if (atC || this.dir === DIRS.none) {
        this.x = cx; this.z = cz;
        decide(cx, cz);
        if (this.dir === DIRS.none) { this.wrap(); return; }
        const d = Math.min(dist, 1);
        this.x += this.dir.x * d; this.z += this.dir.z * d; dist -= d;
        if (d === 1) { this.x = cx + this.dir.x; this.z = cz + this.dir.z; }
      } else {
        const dx = this.dir.x, dz = this.dir.z;
        const along = (cx - this.x) * dx + (cz - this.z) * dz;
        if (along > 1e-6) {
          const d = Math.min(dist, along);
          this.x += dx * d; this.z += dz * d; dist -= d;
          if (d === along) { this.x = cx; this.z = cz; }
        } else {
          const rem = 1 + along;
          const d = Math.min(dist, rem);
          this.x += dx * d; this.z += dz * d; dist -= d;
          if (d === rem) { this.x = cx + dx; this.z = cz + dz; }
        }
      }
      this.wrap();
    }
  }

  decayVisual(dt) {
    const k = Math.exp(-dt * 18);
    this.visX *= k; this.visZ *= k;
  }
}

// ===========================================================================
//  PAC-MAN
// ===========================================================================
export class Pacman extends Mover {
  constructor(maze, theme) {
    super(maze);
    this.theme = theme;
    this.want = DIRS.none;
    this.speed = 7;
    this.mouth = 0;        // 0 fermé .. 1 ouvert
    this.mouthT = 0;
    this.yaw = 0;
    this.targetYaw = 0;
    this.dead = false;
    this.deathT = 0;
    this.powered = false;
    this.moving = false;
    this.lastCell = null;
    this._buildMesh();
  }

  _buildMesh() {
    const g = new THREE.Group();
    // corps jaune classique (la variante « noix de coco » reste disponible : map: TEX.coconutTexture())
    const bodyMat = new THREE.MeshStandardMaterial({ color: this.theme.pacman.body, roughness: 0.42, metalness: 0.05, emissive: 0x5a3f00, emissiveIntensity: 0.25 });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x5a1a12, roughness: 0.8 });
    const R = 0.44;
    const mkJaw = (top) => {
      const jaw = new THREE.Group();
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 18, 0, Math.PI * 2, top ? 0 : Math.PI / 2, Math.PI / 2), bodyMat);
      sphere.castShadow = true;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(R, 36), innerMat);
      disc.rotation.x = top ? Math.PI / 2 : -Math.PI / 2;
      jaw.add(sphere, disc);
      return jaw;
    };
    this.top = mkJaw(true);
    this.bottom = mkJaw(false);
    g.add(this.top, this.bottom);
    // yeux cartoon (blanc + pupille + sourcil), sur la mâchoire supérieure
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x333333 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const browMat = new THREE.MeshStandardMaterial({ color: 0x2a1608, roughness: 0.8 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), whiteMat);
      eye.position.set(0.16, 0.27, s * 0.3);
      eye.scale.set(0.8, 1.1, 0.9);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), pupilMat);
      pupil.position.set(0.23, 0.28, s * 0.3);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), browMat);
      brow.position.set(0.17, 0.4, s * 0.3);
      brow.rotation.z = 0.35;
      this.top.add(eye, pupil, brow);
    }
    // fleur de tiaré
    const flower = new THREE.Group();
    const petalMat = new THREE.MeshStandardMaterial({ color: this.theme.pacman.flower, roughness: 0.6 });
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), petalMat);
      petal.scale.set(1, 0.35, 0.55);
      const a = (i / 6) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.085, 0, Math.sin(a) * 0.085);
      petal.rotation.y = -a;
      flower.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffc83c, emissive: 0xaa6600, emissiveIntensity: 0.4 }));
    flower.add(center);
    flower.position.set(-0.12, 0.38, 0.22);
    flower.rotation.set(0.5, 0, -0.4);
    this.top.add(flower);

    // aura (mode Mana)
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glowTexture('rgba(255,236,140,1)', 'rgba(255,200,60,0)'), color: 0xffe07a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.aura.scale.set(2.2, 2.2, 1);
    this.aura.visible = true;
    this.aura.material.opacity = 0.35;
    g.add(this.aura);

    this.body = new THREE.Group();
    this.body.add(g);
    this.inner = g;
    this.mesh = new THREE.Group();
    this.mesh.add(this.body);
    this.mesh.position.y = 0.46;
  }

  reset(cell) {
    this.setCell(cell.c, cell.r);
    this.dir = DIRS.none; this.want = DIRS.none;
    this.dead = false; this.deathT = 0; this.mouth = 0; this.mouthT = 0;
    this.yaw = this.targetYaw = Math.PI; // regarde à gauche
    this.body.rotation.set(0, 0, 0);
    this.body.scale.set(1, 1, 1);
    this.inner.rotation.set(0, 0, 0);
    this.powered = false;
    this.lastCell = null;
    this.syncMesh();
  }

  setWant(dir) { this.want = dir; }

  update(dt, speed) {
    if (this.dead) { this._deathAnim(dt); return; }
    const maze = this.maze;
    const open = (c, r) => maze.isOpen(c, r);

    // inversion immédiate
    if (this.want !== DIRS.none && this.dir !== DIRS.none && this.want === opposite(this.dir)) {
      this.dir = this.want;
    }
    // virage anticipé (cornering) : si la direction voulue est perpendiculaire et ouverte depuis la case la plus proche
    if (this.want !== DIRS.none && this.want !== this.dir && !this.atCenter && this.dir !== DIRS.none) {
      const cx = Math.round(this.x), cz = Math.round(this.z);
      const perp = this.want.x * this.dir.x + this.want.z * this.dir.z === 0;
      if (perp && open(cx + this.want.x, cz + this.want.z)) {
        this.visX += this.x - cx; this.visZ += this.z - cz;
        this.x = cx; this.z = cz;
        this.dir = this.want;
      }
    }

    const before = this.dir;
    this.advance(speed * dt, (cx, cz) => {
      if (this.want !== DIRS.none && open(cx + this.want.x, cz + this.want.z)) this.dir = this.want;
      else if (this.dir !== DIRS.none && !open(cx + this.dir.x, cz + this.dir.z)) this.dir = DIRS.none;
    });
    this.moving = this.dir !== DIRS.none;
    if (this.moving) {
      this.mouthT += dt * 11;
      this.mouth = Math.abs(Math.sin(this.mouthT));
      this.targetYaw = yawFor(this.dir);
    } else {
      this.mouth = THREE.MathUtils.lerp(this.mouth, 0.08, 1 - Math.exp(-dt * 10));
    }
    this.decayVisual(dt);
    this.syncMesh(dt);
    void before;
  }

  _deathAnim(dt) {
    this.deathT += dt;
    const t = this.deathT;
    this.mouth = Math.min(1, t * 1.6);
    this.inner.rotation.y = t * t * 6;
    const s = t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) * 1.6);
    this.body.scale.set(s, s, s);
    this.syncMesh(dt);
  }

  syncMesh(dt = 0) {
    const w = this.maze.toWorld(this.x + this.visX, this.z + this.visZ);
    this.mesh.position.x = w.x;
    this.mesh.position.z = w.z;
    // rotation la plus courte vers la direction
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * (dt ? 1 - Math.exp(-dt * 22) : 1);
    this.body.rotation.y = this.yaw;
    const a = this.mouth * 0.62;
    this.top.rotation.z = a;
    this.bottom.rotation.z = -a;
    // petit rebond en marchant
    this.mesh.position.y = 0.46 + (this.moving ? Math.abs(Math.sin(this.mouthT * 0.5)) * 0.03 : 0);
    if (this.powered) {
      const k = 2.3 + 0.35 * Math.sin(performance.now() * 0.012);
      this.aura.scale.set(k, k, 1);
      this.aura.material.opacity = 0.75;
    } else {
      this.aura.scale.set(1.7, 1.7, 1);
      this.aura.material.opacity = 0.25;
    }
  }
}

export function yawFor(dir) {
  if (dir === DIRS.right) return 0;
  if (dir === DIRS.left) return Math.PI;
  if (dir === DIRS.up) return Math.PI / 2;
  if (dir === DIRS.down) return -Math.PI / 2;
  return 0;
}

// ===========================================================================
//  FANTÔMES (esprits tiki)
// ===========================================================================
export const GHOST_DEFS = [
  { id: 'blinky', name: 'Blinky', color: 0xff4040, scatter: 'tr', startsOutside: true },
  { id: 'pinky',  name: 'Pinky',  color: 0xff8ad8, scatter: 'tl', slot: 0 },
  { id: 'inky',   name: 'Inky',   color: 0x3ff0ff, scatter: 'br', slot: -1 },
  { id: 'clyde',  name: 'Clyde',  color: 0xffb13b, scatter: 'bl', slot: 1 },
];

const FRIGHT_COLOR = new THREE.Color(0x2b3cff), FRIGHT_EMISSIVE = new THREE.Color(0x1223b0);
const FLASH_COLOR = new THREE.Color(0xe8efff), FLASH_EMISSIVE = new THREE.Color(0x8f9dff);
const FROZEN_COLOR = new THREE.Color(0xd8f6ff), FROZEN_EMISSIVE = new THREE.Color(0x4fc3ff);

let sharedGhostGeo = null;
function ghostGeometry() {
  if (sharedGhostGeo) return sharedGhostGeo;
  const R = 0.42;
  const top = new THREE.SphereGeometry(R, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  top.translate(0, 0.42, 0);
  const skirt = new THREE.CylinderGeometry(R, R, 0.42, 28, 3, true);
  skirt.translate(0, 0.21, 0);
  // ourlet ondulé sur la rangée du bas
  const pos = skirt.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < 0.001) {
      const ang = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, 0.11 * Math.abs(Math.sin(ang * 2.5)) + 0.0);
    }
  }
  skirt.computeVertexNormals();
  sharedGhostGeo = { top, skirt };
  return sharedGhostGeo;
}
let sharedFaceTex = null, sharedBandTex = null;

export class Ghost extends Mover {
  constructor(maze, def, index) {
    super(maze);
    this.def = def;
    this.index = index;
    this.baseColor = new THREE.Color(def.color);
    this.state = 'house';      // house | exiting | active | eyes | entering
    this.frightened = false;
    this.frozen = false;
    this.flash = false;
    this.releaseDots = 0;
    this.houseSlot = def.slot ?? 0; // position dans la maison (décalage en colonnes)
    this.bobPhase = index * 1.3;
    this.forceReverse = false;
    this.pupil = new THREE.Vector3(0, 0, 1);
    this._buildMesh();
  }

  _buildMesh() {
    const { top, skirt } = ghostGeometry();
    this.bodyMat = new THREE.MeshStandardMaterial({ color: this.baseColor, emissive: this.baseColor, emissiveIntensity: 0.6, transparent: true, opacity: 0.92, roughness: 0.35, metalness: 0.0 });
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(top, this.bodyMat), m2 = new THREE.Mesh(skirt, this.bodyMat);
    m1.castShadow = m2.castShadow = true;
    m2.material.side = THREE.DoubleSide;
    this.bodyGroup = new THREE.Group();
    this.bodyGroup.add(m1, m2);
    // ceinture tatouage
    if (!sharedBandTex) sharedBandTex = TEX.tattooBandTexture('#ffffff');
    const bandTex = sharedBandTex.clone(); bandTex.repeat.set(4, 1); bandTex.needsUpdate = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.435, 0.435, 0.16, 28, 1, true), new THREE.MeshBasicMaterial({ map: bandTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    band.position.y = 0.3;
    this.bodyGroup.add(band);
    // dents tiki (face avant)
    if (!sharedFaceTex) sharedFaceTex = TEX.tikiFaceTexture();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshBasicMaterial({ map: sharedFaceTex, transparent: true, opacity: 0.9, depthWrite: false }));
    face.position.set(0, 0.42, 0.41);
    this.bodyGroup.add(face);
    this.face = face;
    g.add(this.bodyGroup);
    // yeux
    this.eyes = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x444444 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x1030c0, roughness: 0.3 });
    this.pupils = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 12), white);
      eye.scale.set(0.85, 1.15, 0.8);
      eye.position.set(s * 0.16, 0.56, 0.3);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), blue);
      pupil.position.set(s * 0.16, 0.56, 0.37);
      this.eyes.add(eye, pupil);
      this.pupils.push(pupil);
    }
    this.brows = [];
    const browMat = new THREE.MeshStandardMaterial({ color: 0x101a3a, roughness: 0.6 });
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.05), browMat);
      brow.position.set(s * 0.16, 0.7, 0.32);
      brow.rotation.z = -s * 0.45;
      this.eyes.add(brow);
      this.brows.push(brow);
    }
    g.add(this.eyes);
    // halo
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), color: this.baseColor, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.halo.scale.set(1.6, 1.6, 1);
    this.halo.position.y = 0.4;
    g.add(this.halo);
    this.mesh = g;
  }

  resetToHouse(houseCenter, startsOutside, exitCell) {
    this.frightened = false; this.flash = false; this.frozen = false;
    this.forceReverse = false;
    if (startsOutside) {
      this.state = 'active';
      this.setCell(exitCell.c, exitCell.r);
      this.dir = DIRS.left;
    } else {
      this.state = 'house';
      this.setCell(houseCenter.c + this.houseSlot, houseCenter.r);
      this.dir = DIRS.up;
    }
    this.applyLook();
    this.syncMesh(0);
  }

  get isDangerous() { return this.state === 'active' && !this.frightened && !this.frozen; }
  get isEdible() { return this.state === 'active' && (this.frightened || this.frozen); }

  setFrozen(on) { this.frozen = on && this.state === 'active'; this.applyLook(); }

  setFrightened(on) {
    if (on) {
      if (this.state === 'active') { this.frightened = true; this.flash = false; this.dir = opposite(this.dir); }
      else if (this.state === 'house' || this.state === 'exiting') { this.frightened = true; }
    } else { this.frightened = false; this.flash = false; }
    this.applyLook();
  }

  eaten() {
    this.state = 'eyes';
    this.frightened = false; this.flash = false; this.frozen = false;
    this.applyLook();
  }

  applyLook() {
    const eyesOnly = this.state === 'eyes' || this.state === 'entering';
    this.bodyGroup.visible = !eyesOnly;
    for (const b of this.brows) b.visible = !eyesOnly && !this.frightened && !this.frozen;
    this.halo.visible = !eyesOnly;
    if (this.frozen) {
      this.bodyMat.color.copy(FROZEN_COLOR); this.bodyMat.emissive.copy(FROZEN_EMISSIVE);
      this.bodyMat.opacity = 0.95;
      this.halo.material.color.copy(FROZEN_EMISSIVE);
      this.face.material.opacity = 0.5;
      for (const p of this.pupils) p.visible = true;
    } else if (this.frightened) {
      const c = this.flash ? FLASH_COLOR : FRIGHT_COLOR;
      const e = this.flash ? FLASH_EMISSIVE : FRIGHT_EMISSIVE;
      this.bodyMat.color.copy(c); this.bodyMat.emissive.copy(e);
      this.bodyMat.opacity = 0.8;
      this.halo.material.color.copy(c);
      this.face.material.opacity = 0.6;
      for (const p of this.pupils) p.visible = false;
    } else {
      this.bodyMat.color.copy(this.baseColor); this.bodyMat.emissive.copy(this.baseColor);
      this.bodyMat.opacity = 0.9;
      this.halo.material.color.copy(this.baseColor);
      this.face.material.opacity = 0.9;
      for (const p of this.pupils) p.visible = true;
    }
  }

  /**
   * @param ctx { dt, speeds, mode:'scatter'|'chase', pac, blinky, frightTimer, houseCenter, houseExit, releaseGhost(bool) }
   */
  update(ctx) {
    const { dt, maze } = { dt: ctx.dt, maze: this.maze };
    if (this.frozen && this.state === 'active') { this.syncMesh(dt); return; } // figé sur place
    const hc = ctx.houseCenter, he = ctx.houseExit;
    if (this.state === 'house') {
      this.bobPhase += dt * 4;
      this.z = hc.r + Math.sin(this.bobPhase) * 0.25;
      if (ctx.release) { this.state = 'exiting'; }
      this.syncMesh(dt);
      return;
    }
    if (this.state === 'exiting') {
      const sp = 3.2 * dt;
      if (Math.abs(this.x - hc.c) > 1e-3) {
        this.x += Math.sign(hc.c - this.x) * Math.min(sp, Math.abs(hc.c - this.x));
      } else if (Math.abs(this.z - he.r) > 1e-3) {
        this.z += Math.sign(he.r - this.z) * Math.min(sp, Math.abs(he.r - this.z));
      } else {
        this.z = he.r; this.x = hc.c;
        this.state = 'active';
        this.frightened = this.frightened && ctx.frightTimer > 0;
        this.dir = Math.random() < 0.5 ? DIRS.left : DIRS.right;
        this.applyLook();
      }
      this.syncMesh(dt);
      return;
    }
    if (this.state === 'entering') {
      const sp = 4.5 * dt;
      if (Math.abs(this.z - hc.r) > 1e-3) {
        this.z += Math.sign(hc.r - this.z) * Math.min(sp, Math.abs(hc.r - this.z));
      } else {
        this.z = hc.r;
        this.state = 'exiting';
        this.frightened = false;
        this.applyLook();
      }
      this.syncMesh(dt);
      return;
    }

    // --- active / eyes : déplacement sur la grille
    let speed = ctx.speeds.ghost;
    if (this.state === 'eyes') speed = ctx.speeds.eyes;
    else if (this.frightened) speed = ctx.speeds.frightened;
    else if (maze.isTunnelCell(Math.round(this.x), Math.round(this.z))) speed = ctx.speeds.tunnel;

    const target = this._target(ctx);
    this.advance(speed * dt, (cx, cz) => {
      if (this.state === 'eyes' && cx === he.c && cz === he.r) {
        this.state = 'entering';
        this.dir = DIRS.down;
        this.applyLook();
        return;
      }
      let cands = DIR_ORDER.filter((d) => d !== opposite(this.dir) && maze.isOpen(cx + d.x, cz + d.z));
      if (this.forceReverse) {
        this.forceReverse = false;
        const rev = opposite(this.dir);
        if (maze.isOpen(cx + rev.x, cz + rev.z)) cands = [rev];
      }
      if (!cands.length) { this.dir = opposite(this.dir); return; }
      if (this.frightened && this.state === 'active') {
        this.dir = cands[Math.floor(Math.random() * cands.length)];
        return;
      }
      let best = cands[0], bd = Infinity;
      for (const d of cands) {
        const nx = cx + d.x, nz = cz + d.z;
        const dx = Math.min(Math.abs(nx - target.c), maze.w - Math.abs(nx - target.c));
        const dz = nz - target.r;
        const dist = dx * dx + dz * dz;
        if (dist < bd) { bd = dist; best = d; }
      }
      this.dir = best;
    });
    if (this.state === 'entering') { this.syncMesh(dt); return; }
    this.decayVisual(dt);
    this.syncMesh(dt);
  }

  _target(ctx) {
    const maze = this.maze;
    if (this.state === 'eyes') return ctx.houseExit;
    if (ctx.mode === 'scatter') return scatterCorner(this.def.scatter, maze);
    const pc = ctx.pac.cell, pd = ctx.pac.dir;
    switch (this.def.id) {
      case 'blinky': return pc;
      case 'pinky': return { c: pc.c + pd.x * 4, r: pc.r + pd.z * 4 };
      case 'inky': {
        const ahead = { c: pc.c + pd.x * 2, r: pc.r + pd.z * 2 };
        const b = ctx.blinky.cell;
        return { c: ahead.c + (ahead.c - b.c), r: ahead.r + (ahead.r - b.r) };
      }
      case 'clyde': {
        const d = Math.hypot(this.x - pc.c, this.z - pc.r);
        return d > 8 ? pc : scatterCorner(this.def.scatter, maze);
      }
    }
    return pc;
  }

  syncMesh(dt) {
    const w = this.maze.toWorld(this.x + this.visX, this.z + this.visZ);
    this.mesh.position.x = w.x;
    this.mesh.position.z = w.z;
    const t = performance.now() * 0.001;
    this.mesh.position.y = 0.1 + Math.sin(t * 3 + this.bobPhase) * 0.04;
    // les pupilles regardent dans la direction
    const look = this.dir;
    this.pupil.set(look.x * 0.05, 0, 0.37 - Math.max(0, -look.z) * 0.02);
    for (let i = 0; i < this.pupils.length; i++) {
      const p = this.pupils[i];
      p.position.x = (i ? 0.16 : -0.16) + look.x * 0.045;
      p.position.y = 0.56 + (look.z < 0 ? 0.035 : look.z > 0 ? -0.035 : 0);
    }
    if (this.frightened) {
      const k = 1.5 + 0.2 * Math.sin(t * 12);
      this.halo.scale.set(k, k, 1);
    } else {
      this.halo.scale.set(1.6, 1.6, 1);
    }
  }
}

function scatterCorner(code, maze) {
  switch (code) {
    case 'tl': return { c: 2, r: -2 };
    case 'tr': return { c: maze.w - 3, r: -2 };
    case 'bl': return { c: 0, r: maze.h + 1 };
    case 'br': return { c: maze.w - 1, r: maze.h + 1 };
  }
  return { c: 0, r: 0 };
}
