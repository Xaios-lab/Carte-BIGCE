// ---------------------------------------------------------------------------
//  WORLD : construction de la scène 3D (labyrinthe, pointillés, Manas, décor)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { signedArea, offsetLoop, pointInLoop } from './maze.js';
import * as TEX from './textures.js';

export const WALL_H = 0.62;
const INSET = 0.14;
const BEVEL = 0.09;

export class World {
  constructor({ maze, level, theme, logoTextures, quality }) {
    this.maze = maze;
    this.level = level;
    this.theme = theme;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.FogExp2(theme.fog.color, theme.fog.density);
    this.animated = []; // fonctions (t, dt) appelées chaque frame
    this.time = 0;

    this.glowMat = null;
    this.wallMat = null;
    this.manas = [];

    this._lights();
    this._floor();
    this._walls();
    this._dots();
    this._manas(logoTextures);
    this._decor();
  }

  // ------------------------------------------------------------ LUMIÈRES
  _lights() {
    const { theme, maze, quality } = this;
    const hemi = new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(theme.sun.color, theme.sun.intensity);
    sun.position.set(5, 16, 7);
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
    const ext = Math.max(maze.w, maze.h) / 2 + 3;
    sun.castShadow = quality.shadows;
    sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
    sun.shadow.camera.left = -ext; sun.shadow.camera.right = ext;
    sun.shadow.camera.top = ext; sun.shadow.camera.bottom = -ext;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    this.sun = sun;
    // lumière d'ambiance teintée (rendu plus "lisible" des murs)
    const fill = new THREE.DirectionalLight(0x6fd8c9, 0.35);
    fill.position.set(-8, 6, -6);
    this.scene.add(fill);
  }

  // ------------------------------------------------------------ SOL
  _floor() {
    const { maze, theme } = this;
    const floorTex = TEX.floorTexture(maze, theme);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(maze.w, maze.h),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.92, metalness: 0.02 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const groundTex = TEX.groundTexture(theme);
    groundTex.repeat.set(30, 30);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: 0x9fbf9f })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.03;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // ------------------------------------------------------------ MURS
  _walls() {
    const { maze, theme } = this;
    const loops = maze.wallLoops();
    const W = maze.w, H = maze.h;
    const outers = [], holes = [];
    for (const loop of loops) {
      const area = signedArea(loop);
      const entry = { raw: loop, off: offsetLoop(loop, INSET), area: Math.abs(area), holes: [] };
      (area > 0 ? outers : holes).push(entry);
    }
    outers.sort((a, b) => a.area - b.area);
    for (const h of holes) {
      const pt = h.off[0];
      const owner = outers.find((o) => pointInLoop(pt, o.raw));
      if (owner) owner.holes.push(h);
    }
    const toShape = (pts, Ctor) => {
      const s = new Ctor();
      pts.forEach((p, i) => { const x = p[0] - W / 2, y = -(p[1] - H / 2); i ? s.lineTo(x, y) : s.moveTo(x, y); });
      s.closePath();
      return s;
    };
    const shapes = outers.map((o) => {
      const s = toShape(o.off, THREE.Shape);
      o.holes.forEach((h) => s.holes.push(toShape(h.off, THREE.Path)));
      return s;
    });
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: WALL_H - BEVEL, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL * 0.9,
      bevelOffset: -BEVEL * 0.9, bevelSegments: 3, curveSegments: 4,
    });
    geo.rotateX(-Math.PI / 2);
    geo.computeVertexNormals();
    const stone = TEX.stoneTexture(theme);
    stone.repeat.set(0.45, 0.45);
    this.wallMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 0.85, metalness: 0.05, emissive: 0x000000 });
    const walls = new THREE.Mesh(geo, this.wallMat);
    walls.castShadow = true;
    walls.receiveShadow = true;
    this.scene.add(walls);
    this.walls = walls;

    // ruban lumineux sur le dessus des murs (bioluminescence)
    const ribbon = [];
    const addRibbon = (loop) => {
      const a = offsetLoop(loop, INSET + BEVEL * 0.9 + 0.01);
      const b = offsetLoop(loop, INSET + BEVEL * 0.9 + 0.09);
      const n = a.length;
      const base = ribbon.length / 3;
      const y = WALL_H + 0.012;
      for (let i = 0; i < n; i++) {
        ribbon.push(a[i][0] - W / 2, y, a[i][1] - H / 2, b[i][0] - W / 2, y, b[i][1] - H / 2);
      }
      const idx = [];
      for (let i = 0; i < n; i++) {
        const i0 = base + i * 2, i1 = base + ((i + 1) % n) * 2;
        idx.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
      }
      ribbonIdx.push(...idx);
    };
    const ribbonIdx = [];
    loops.forEach(addRibbon);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(ribbon, 3));
    rg.setIndex(ribbonIdx);
    this.glowMat = new THREE.MeshBasicMaterial({ color: theme.wall.glow, toneMapped: false, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(rg, this.glowMat);
    this.scene.add(glow);
    this.glowRibbon = glow;
    this.animated.push((t) => { this.glowMat.opacity = 0.7 + 0.2 * Math.sin(t * 1.7); });

    // porte de la maison des fantômes
    if (maze.door) {
      const p = maze.toWorld(maze.door.c, maze.door.r);
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.16, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xffd9c2, emissive: 0xff9c8a, emissiveIntensity: 0.5, roughness: 0.4 })
      );
      door.position.set(p.x, 0.26, p.z);
      this.scene.add(door);
    }

    // grottes aux extrémités des tunnels (cachent l'entité qui "téléporte")
    const caveMat = new THREE.MeshStandardMaterial({ map: stone, roughness: 1, color: 0x667766 });
    for (const r of maze.tunnelRows) {
      for (const side of [-1, 1]) {
        const cave = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.05, 1.25), caveMat);
        const z = r - (H - 1) / 2;
        cave.position.set(side * (W / 2 + 0.9), 0.52, z);
        cave.castShadow = true;
        this.scene.add(cave);
        // bouche sombre
        const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x020806 }));
        mouth.position.set(side * (W / 2 - 0.005), 0.46, z);
        mouth.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.scene.add(mouth);
      }
    }
  }

  // ------------------------------------------------------------ POINTILLÉS (flèches tatouage)
  _dots() {
    const { maze, theme } = this;
    const s = new THREE.Shape();
    // flèche "tatau" : pointe triangulaire + hampe
    s.moveTo(0, 0.26); s.lineTo(0.17, 0.02); s.lineTo(0.065, 0.02); s.lineTo(0.065, -0.24);
    s.lineTo(-0.065, -0.24); s.lineTo(-0.065, 0.02); s.lineTo(-0.17, 0.02); s.closePath();
    const geo = new THREE.ShapeGeometry(s);
    geo.scale(0.85, 0.85, 0.85);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: theme.dot, toneMapped: false, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, maze.dots.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dotsMesh = mesh;
    this.dotState = new Float32Array(maze.dots.length); // 0 = présent, >0 = temps depuis mangé, -1 = disparu
    this.dotState.fill(0);
    this.dotPhase = new Float32Array(maze.dots.length);
    this.dotFlip = new Uint8Array(maze.dots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    maze.dots.forEach((d, i) => {
      this.dotPhase[i] = (d.c * 0.7 + d.r * 1.3) % 6.28;
      this.dotFlip[i] = (d.c + d.r) % 2; // alternance flèche / flèche inversée
    });
    this.scene.add(mesh);
    const halo = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: TEX.glowTexture('rgba(255,220,150,1)', 'rgba(255,200,120,0)'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      maze.dots.length
    );
    halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dotHalo = halo;
    this.scene.add(halo);
    this.updateDots(0, 0, true);
  }

  updateDots(t, dt, force = false) {
    const { maze } = this;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < maze.dots.length; i++) {
      const st = this.dotState[i];
      if (st < 0 && !force) continue;
      const d = maze.dots[i];
      const w = maze.toWorld(d.c, d.r);
      let k = 1;
      if (st > 0) {
        const e = st + dt;
        this.dotState[i] = e;
        k = e < 0.09 ? 1 + e * 8 : Math.max(0, 1.7 - (e - 0.09) * 14);
        if (k <= 0) { this.dotState[i] = -1; k = 0; }
      } else if (st < 0) k = 0;
      const bob = 0.05 + 0.025 * Math.sin(t * 2.2 + this.dotPhase[i]);
      p.set(w.x, bob, w.z);
      q.setFromAxisAngle(up, this.dotFlip[i] ? Math.PI : 0);
      sc.set(k, k, k);
      m.compose(p, q, sc);
      this.dotsMesh.setMatrixAt(i, m);
      sc.set(k * (0.9 + 0.15 * Math.sin(t * 3 + this.dotPhase[i])), 1, k * (0.9 + 0.15 * Math.sin(t * 3 + this.dotPhase[i])));
      p.y = 0.02;
      m.compose(p, q, sc);
      this.dotHalo.setMatrixAt(i, m);
    }
    this.dotsMesh.instanceMatrix.needsUpdate = true;
    this.dotHalo.instanceMatrix.needsUpdate = true;
  }

  eatDot(i) { if (this.dotState[i] === 0) this.dotState[i] = 1e-4; }
  resetDots() { this.dotState.fill(0); this.updateDots(this.time, 0, true); }

  // ------------------------------------------------------------ MANAS (logos partenaires)
  _manas(logoTextures) {
    const { maze, level, theme } = this;
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe7c25a, metalness: 0.85, roughness: 0.3, emissive: 0x6b4a00, emissiveIntensity: 0.25 });
    const glowTex = TEX.glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const leafTex = TEX.leafTexture(theme.leaves.c, 2);

    maze.manas.forEach((cell, i) => {
      const partnerId = level.mana[i % level.mana.length];
      const tex = logoTextures[partnerId];
      const partner = logoTextures.__partners[partnerId];
      const w = maze.toWorld(cell.c, cell.r);
      const g = new THREE.Group();
      g.position.set(w.x, 0, w.z);

      // pièce (logo recto/verso)
      const coinGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.09, 48);
      const face = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const texBack = tex.clone();
      texBack.wrapS = THREE.RepeatWrapping; texBack.repeat.x = -1; texBack.offset.x = 1; texBack.needsUpdate = true;
      const faceBack = new THREE.MeshBasicMaterial({ map: texBack, toneMapped: false });
      const coin = new THREE.Mesh(coinGeo, [goldMat, face, faceBack]);
      coin.rotation.x = Math.PI / 2;
      coin.castShadow = true;
      // la pièce est inclinée vers la caméra (lisible) et tourne sur l'axe vertical
      const tilt = new THREE.Group();
      tilt.rotation.x = -THREE.MathUtils.degToRad(30);
      tilt.add(coin);
      const spin = new THREE.Group();
      spin.add(tilt);
      spin.position.y = 0.85;
      g.add(spin);

      // halo coloré
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: partner.color === '#1b1b1b' ? 0x9ad8ff : partner.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.set(2.2, 2.2, 1);
      halo.position.y = 0.85;
      g.add(halo);
      // halo au sol
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, color: partner.color === '#1b1b1b' ? 0x9ad8ff : partner.color, toneMapped: false }));
      ground.position.y = 0.02;
      g.add(ground);

      // fines lianes qui se balancent devant le logo
      const vines = new THREE.Group();
      vines.position.set(0, 2.4, 0.55);
      const vineMat = new THREE.MeshStandardMaterial({ color: 0x3e7a2d, roughness: 0.9 });
      const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
      for (let v = 0; v < 3; v++) {
        const pivot = new THREE.Group();
        const x0 = (v - 1) * 0.28;
        const len = 1.7 + v * 0.2;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x0, 0, 0),
          new THREE.Vector3(x0 + 0.12 * (v % 2 ? 1 : -1), -len * 0.45, 0.05),
          new THREE.Vector3(x0 - 0.08 * (v % 2 ? 1 : -1), -len, 0.02),
        ]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.022, 5, false), vineMat);
        tube.castShadow = true;
        pivot.add(tube);
        for (let l = 0; l < 3; l++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.4).translate(0, -0.2, 0), leafMat);
          const pt = curve.getPoint(0.3 + l * 0.28);
          leaf.position.copy(pt);
          leaf.rotation.set(0.3, (l + v) * 1.9, (l % 2 ? 0.9 : -0.9));
          pivot.add(leaf);
        }
        pivot.userData.phase = v * 1.4 + i;
        pivot.userData.amp = 0.10 + v * 0.03;
        vines.add(pivot);
      }
      g.add(vines);

      this.scene.add(g);
      const mana = { group: g, spin, coin, halo, ground, vines, partner, partnerId, cell, eaten: false, phase: i * 1.7 };
      this.manas.push(mana);
    });

    this.animated.push((t, dt) => {
      for (const m of this.manas) {
        if (m.eaten) continue;
        m.spin.rotation.y += dt * 1.6;
        m.spin.position.y = 0.85 + 0.08 * Math.sin(t * 2 + m.phase);
        const k = 1.9 + 0.25 * Math.sin(t * 3.1 + m.phase);
        m.halo.scale.set(k, k, 1);
        m.halo.material.opacity = 0.45 + 0.15 * Math.sin(t * 3.1 + m.phase);
        for (const pv of m.vines.children) pv.rotation.z = Math.sin(t * 1.25 + pv.userData.phase) * pv.userData.amp;
        m.vines.children.forEach((pv, k2) => { pv.rotation.x = Math.sin(t * 0.9 + pv.userData.phase + k2) * 0.05; });
      }
    });
  }

  eatMana(mana) {
    mana.eaten = true;
    mana.spin.visible = false;
    mana.halo.visible = false;
    mana.ground.visible = false;
    // les lianes restent (décor), elles continuent de se balancer légèrement
    const vinesAnim = (t) => { for (const pv of mana.vines.children) pv.rotation.z = Math.sin(t * 1.25 + pv.userData.phase) * pv.userData.amp; };
    this.animated.push(vinesAnim);
  }

  resetManas() {
    for (const m of this.manas) { m.eaten = false; m.spin.visible = true; m.halo.visible = true; m.ground.visible = true; }
  }

  // ------------------------------------------------------------ DÉCOR JUNGLE
  _decor() {
    const { maze, theme, quality } = this;
    const W = maze.w, H = maze.h;
    const rand = TEX.rng(1234);

    // --- feuillage (instancié)
    const leafTexA = TEX.leafTexture(theme.leaves.a, 0);
    const leafTexB = TEX.leafTexture(theme.leaves.b, 1);
    const leafGeo = new THREE.PlaneGeometry(1, 2).translate(0, 1, 0);
    const mkLeaves = (tex, count) => {
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
      const im = new THREE.InstancedMesh(leafGeo, mat, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = quality.shadows;
      im.userData.items = [];
      return im;
    };
    const total = quality.leaves;
    const leavesA = mkLeaves(leafTexA, Math.ceil(total * 0.55));
    const leavesB = mkLeaves(leafTexB, Math.floor(total * 0.45));
    const place = (im, count) => {
      for (let i = 0; i < count; i++) {
        // position dans une bande autour du labyrinthe
        let x, z, tries = 0;
        do {
          x = (rand() - 0.5) * (W + 11);
          z = (rand() - 0.5) * (H + 11);
          tries++;
        } while (Math.abs(x) < W / 2 + 0.7 && Math.abs(z) < H / 2 + 0.7 && tries < 50);
        const near = z > H / 2;       // côté caméra : plus petit pour ne pas masquer
        const far = z < -H / 2 - 1;
        const s = near ? 0.6 + rand() * 0.5 : far ? 1.4 + rand() * 1.6 : 0.9 + rand() * 1.2;
        im.userData.items.push({ x, z, s, yaw: rand() * Math.PI * 2, lean: (rand() - 0.5) * 0.5, phase: rand() * 6.28, color: new THREE.Color().setHSL(0.28 + rand() * 0.1, 0.5 + rand() * 0.3, 0.3 + rand() * 0.2) });
      }
      im.userData.items.forEach((it, i) => im.setColorAt(i, it.color));
      im.instanceColor.needsUpdate = true;
    };
    place(leavesA, leavesA.count);
    place(leavesB, leavesB.count);
    this.scene.add(leavesA, leavesB);
    const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    const sway = (im, t) => {
      im.userData.items.forEach((it, i) => {
        e.set(it.lean + Math.sin(t * 0.9 + it.phase) * 0.06, it.yaw, Math.sin(t * 1.1 + it.phase * 1.3) * 0.05);
        q.setFromEuler(e);
        p.set(it.x, 0, it.z);
        sc.set(it.s, it.s, it.s);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    this.animated.push((t) => { sway(leavesA, t); sway(leavesB, t); });

    // --- palmiers / grands arbres (côté éloigné et latéraux)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3621, roughness: 0.95 });
    const frondMat = new THREE.MeshStandardMaterial({ map: leafTexB, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    const palms = [];
    const palmSpots = [
      [-W / 2 - 3.5, -H / 2 - 2], [W / 2 + 3.5, -H / 2 - 2.5], [-2, -H / 2 - 4.5], [5, -H / 2 - 4],
      [-W / 2 - 4.5, -2], [W / 2 + 4.5, 1], [-W / 2 - 5, H / 2 - 3], [W / 2 + 5, H / 2 - 2],
    ];
    palmSpots.forEach(([x, z], i) => {
      const g = new THREE.Group();
      const h = 4.5 + rand() * 2.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.24, h, 8), trunkMat);
      trunk.position.y = h / 2;
      trunk.castShadow = quality.shadows;
      g.add(trunk);
      const crown = new THREE.Group();
      crown.position.y = h;
      for (let f = 0; f < 7; f++) {
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 2.8).translate(0, 1.4, 0), frondMat);
        const pivot = new THREE.Group();
        pivot.rotation.y = (f / 7) * Math.PI * 2;
        frond.rotation.x = -1.25;
        pivot.add(frond);
        pivot.userData.phase = f;
        crown.add(pivot);
      }
      g.add(crown);
      g.position.set(x, 0, z);
      g.rotation.z = (rand() - 0.5) * 0.25;
      g.rotation.x = (rand() - 0.5) * 0.2;
      this.scene.add(g);
      palms.push({ crown, phase: i });
    });
    this.animated.push((t) => {
      for (const pm of palms) {
        pm.crown.rotation.y = Math.sin(t * 0.5 + pm.phase) * 0.06;
        for (const pv of pm.crown.children) pv.rotation.x = Math.sin(t * 1.2 + pv.userData.phase + pm.phase) * 0.06;
      }
    });

    // --- lianes suspendues sur les côtés
    const vineMat = new THREE.MeshStandardMaterial({ color: 0x35692a, roughness: 0.9 });
    const lianas = [];
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (W / 2 + 1.6 + rand() * 1.2);
      const z = -H / 2 + rand() * H;
      const len = 3 + rand() * 4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3 * side, -len * 0.5, 0.2), new THREE.Vector3(-0.1 * side, -len, 0),
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.035, 6, false), vineMat);
      const pivot = new THREE.Group();
      pivot.position.set(x, 8.5, z);
      pivot.add(tube);
      for (let l = 0; l < 4; l++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.6).translate(0, -0.3, 0), frondMat);
        leaf.position.copy(curve.getPoint(0.25 + l * 0.22));
        leaf.rotation.set(0.4, l * 2.1, l % 2 ? 0.8 : -0.8);
        pivot.add(leaf);
      }
      pivot.userData.phase = rand() * 6.28;
      this.scene.add(pivot);
      lianas.push(pivot);
    }
    this.animated.push((t) => { for (const l of lianas) { l.rotation.z = Math.sin(t * 0.8 + l.userData.phase) * 0.07; l.rotation.x = Math.sin(t * 0.6 + l.userData.phase) * 0.04; } });

    // --- torches aux 4 coins
    const flameTex = TEX.flameTexture();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 0.9 });
    const torches = [];
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    corners.forEach(([sx, sz], i) => {
      const g = new THREE.Group();
      g.position.set(sx * (W / 2 + 1.0), 0, sz * (H / 2 + 1.0));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 7), woodMat);
      post.position.y = 0.75;
      post.castShadow = quality.shadows;
      g.add(post);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x2b1a0c, emissive: 0xff5a00, emissiveIntensity: 0.9 }));
      head.position.y = 1.55;
      g.add(head);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      flame.position.y = 2.05;
      flame.scale.set(0.55, 1.0, 1);
      g.add(flame);
      let light = null;
      if (i < quality.torchLights) {
        light = new THREE.PointLight(theme.torch.color, theme.torch.intensity, theme.torch.distance, 2);
        light.position.y = 2.0;
        g.add(light);
      }
      this.scene.add(g);
      torches.push({ flame, light, phase: i * 1.9 });
    });
    this.animated.push((t) => {
      for (const tc of torches) {
        const f = 0.85 + 0.15 * Math.sin(t * 11 + tc.phase) + 0.08 * Math.sin(t * 23 + tc.phase * 2);
        tc.flame.scale.set(0.5 * f, 1.0 * f, 1);
        tc.flame.material.opacity = 0.8 + 0.2 * Math.sin(t * 17 + tc.phase);
        if (tc.light) tc.light.intensity = theme.torch.intensity * f;
      }
    });

    // --- rayons de lumière à travers la canopée
    const rayTex = TEX.rayTexture();
    const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, color: 0xcfffe9 });
    const rays = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(1.6 + i * 0.4, 12).translate(0, 6, 0), rayMat);
      r.position.set(-W / 4 + i * (W / 6), 0.5, -H / 2 + 1 + i * 1.5);
      r.rotation.z = -0.35;
      r.rotation.y = 0.2 * i;
      this.scene.add(r);
      rays.push(r);
    }
    this.animated.push((t) => { rays.forEach((r, i) => { r.rotation.y = 0.2 * i + Math.sin(t * 0.15 + i) * 0.25; }); });

    // --- lucioles
    const N = quality.fireflies;
    const pos = new Float32Array(N * 3);
    const seeds = [];
    for (let i = 0; i < N; i++) {
      seeds.push({ x: (rand() - 0.5) * (W + 6), z: (rand() - 0.5) * (H + 6), y: 0.6 + rand() * 2.5, a: rand() * 6.28, s: 0.3 + rand() * 0.6 });
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pm = new THREE.PointsMaterial({ map: TEX.glowTexture('rgba(220,255,170,1)', 'rgba(200,255,150,0)'), color: theme.firefly, size: 0.28, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false });
    const points = new THREE.Points(pg, pm);
    this.scene.add(points);
    this.animated.push((t) => {
      for (let i = 0; i < N; i++) {
        const s = seeds[i];
        pos[i * 3] = s.x + Math.sin(t * s.s + s.a) * 0.8;
        pos[i * 3 + 1] = s.y + Math.sin(t * s.s * 1.7 + s.a) * 0.3;
        pos[i * 3 + 2] = s.z + Math.cos(t * s.s * 0.8 + s.a) * 0.8;
      }
      pg.attributes.position.needsUpdate = true;
      pm.opacity = 0.6 + 0.3 * Math.sin(t * 2.3);
    });
  }

  /** Flash des murs (fin de niveau) : k dans [0,1] */
  setWallFlash(k) {
    this.wallMat.emissive.setRGB(k * 0.9, k * 0.95, k * 0.8);
    this.glowMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(this.theme.wall.glow), 1 - k);
  }

  update(t, dt) {
    this.time = t;
    for (const f of this.animated) f(t, dt);
    this.updateDots(t, dt);
  }
}
