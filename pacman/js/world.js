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

  // ------------------------------------------------------------ POINTILLÉS (flèches tatouage, étoiles de mer, coquillages)
  _dots() {
    const { maze, theme } = this;
    // flèche tatouage : longue pointe triangulaire + fine lame parallèle (motif « niho »)
    const tip = new THREE.Shape();
    tip.moveTo(0, 0.31); tip.lineTo(0.07, -0.23); tip.lineTo(-0.15, -0.23); tip.closePath();
    const blade = new THREE.Shape();
    blade.moveTo(0.12, 0.16); blade.lineTo(0.2, -0.23); blade.lineTo(0.13, -0.23); blade.closePath();
    const arrowGeo = new THREE.ShapeGeometry([tip, blade]);
    arrowGeo.translate(0.0, -0.03, 0); arrowGeo.scale(0.9, 0.9, 0.9); arrowGeo.rotateX(-Math.PI / 2);
    // étoile de mer
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.12 : 0.3, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    star.closePath();
    const starGeo = new THREE.ShapeGeometry(star, 2); starGeo.rotateX(-Math.PI / 2);
    // coquillage (éventail à bord festonné)
    const shell = new THREE.Shape();
    shell.moveTo(0, -0.26);
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI + (i / 14) * Math.PI;             // de gauche à droite par le haut
      const r = 0.27 + (i % 2 ? 0 : 0.035);
      shell.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * -1 + 0.02);
    }
    shell.closePath();
    const shellGeo = new THREE.ShapeGeometry(shell); shellGeo.rotateX(-Math.PI / 2);

    // perles dorées lumineuses (style visuel promo)
    const pearlGeo = new THREE.SphereGeometry(0.17, 14, 10);
    const pearlMat = new THREE.MeshStandardMaterial({ color: 0xffd45a, emissive: 0xd98a00, emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.5 });
    const mk = (geo, color, count, mat) => {
      mat = mat || new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = count;
      this.scene.add(im);
      return im;
    };
    const kinds = { arrow: [], star: [], shell: [] };
    maze.dots.forEach((d) => kinds[d.kind].push(d));
    this.pearlStyle = theme.dotStyle === 'pearl';
    this.dotMeshes = {
      arrow: this.pearlStyle ? mk(pearlGeo, theme.dot, kinds.arrow.length, pearlMat) : mk(arrowGeo, theme.dot, kinds.arrow.length),
      star: mk(starGeo, 0xff7a3d, kinds.star.length),
      shell: mk(shellGeo, 0xffd9e4, kinds.shell.length),
    };
    this.dotLocal = new Int32Array(maze.dots.length);   // index dans le mesh de sa famille
    Object.values(kinds).forEach((list) => list.forEach((d, i) => { this.dotLocal[d.idx] = i; }));

    this.dotState = new Float32Array(maze.dots.length); // 0 = présent, >0 = temps depuis mangé, -1 = disparu
    this.dotPhase = new Float32Array(maze.dots.length);
    this.dotRot = new Float32Array(maze.dots.length);
    // orientation : haut/bas dans les couloirs verticaux, gauche/droite dans les horizontaux, les 4 aux croisements
    const UP = 0, DOWN = Math.PI, LEFT = Math.PI / 2, RIGHT = -Math.PI / 2;
    maze.dots.forEach((d, i) => {
      this.dotPhase[i] = (d.c * 0.7 + d.r * 1.3) % 6.28;
      const horiz = maze.isOpen(d.c - 1, d.r) || maze.isOpen(d.c + 1, d.r);
      const vert = maze.isOpen(d.c, d.r - 1) || maze.isOpen(d.c, d.r + 1);
      if (d.kind !== 'arrow') this.dotRot[i] = (d.c * 1.7 + d.r * 0.9) % 6.28;
      else if (horiz && !vert) this.dotRot[i] = d.c % 2 ? LEFT : RIGHT;
      else if (vert && !horiz) this.dotRot[i] = d.r % 2 ? DOWN : UP;
      else this.dotRot[i] = [UP, RIGHT, DOWN, LEFT][(d.c + d.r) % 4];
    });
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
      const special = d.kind !== 'arrow';
      const bob = (this.pearlStyle && !special ? 0.26 : 0.05) + 0.025 * Math.sin(t * 2.2 + this.dotPhase[i]);
      p.set(w.x, bob, w.z);
      q.setFromAxisAngle(up, this.dotRot[i] + (special ? Math.sin(t * 1.5 + this.dotPhase[i]) * 0.3 : 0));
      const ks = special ? k * (1 + 0.08 * Math.sin(t * 4 + this.dotPhase[i])) : k;
      sc.set(ks, ks, ks);
      m.compose(p, q, sc);
      this.dotMeshes[d.kind].setMatrixAt(this.dotLocal[i], m);
      const hs = k * (special ? 1.4 : (this.pearlStyle ? 1.1 : 0.9) + 0.15 * Math.sin(t * 3 + this.dotPhase[i]));
      sc.set(hs, 1, hs);
      p.y = 0.02;
      m.compose(p, q, sc);
      this.dotHalo.setMatrixAt(i, m);
    }
    for (const im of Object.values(this.dotMeshes)) im.instanceMatrix.needsUpdate = true;
    this.dotHalo.instanceMatrix.needsUpdate = true;
  }

  eatDot(i) { if (this.dotState[i] === 0) this.dotState[i] = 1e-4; }
  resetDots() { this.dotState.fill(0); this.updateDots(this.time, 0, true); }

  // ------------------------------------------------------------ MANAS (logos partenaires)
  _manas(logoTextures) {
    const { maze, level, theme } = this;
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xe7c25a, metalness: 0.85, roughness: 0.3, emissive: 0x6b4a00, emissiveIntensity: 0.25 });
    const glowTex = TEX.glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    maze.manas.forEach((cell, i) => {
      const partnerId = level.mana[i % level.mana.length];
      const tex = logoTextures[partnerId];
      const partner = logoTextures.__partners[partnerId];
      const w = maze.toWorld(cell.c, cell.r);
      const g = new THREE.Group();
      g.position.set(w.x, 0, w.z);

      // médaillon : disque doré + logo en façade, toujours face à la caméra (lisible, dans le bon sens)
      const R = 0.74;
      const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.1, 56), goldMat);
      back.rotation.x = Math.PI / 2;
      back.castShadow = true;
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.96, R * 1.96), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.2, toneMapped: false }));
      logo.position.z = 0.055;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 10, 56), goldMat);
      const badge = new THREE.Group();
      badge.add(back, logo, rim);
      // la caméra plonge à ~63° : la normale du médaillon pointe vers elle => vu de face, cercle parfait, logo à l'endroit
      badge.rotation.x = -THREE.MathUtils.degToRad(63);
      const spin = new THREE.Group(); // flottement ; le flip ne sert qu'à l'apparition
      spin.add(badge);
      spin.position.y = 1.05;
      g.add(spin);
      const coin = badge;
      badge.userData.restX = badge.rotation.x;

      // halo coloré
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: partner.color === '#1b1b1b' ? 0x9ad8ff : partner.color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      halo.scale.set(3.0, 3.0, 1);
      halo.position.y = 1.05;
      g.add(halo);
      // halo au sol
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, color: partner.color === '#1b1b1b' ? 0x9ad8ff : partner.color, toneMapped: false }));
      ground.position.y = 0.02;
      g.add(ground);

      this.scene.add(g);
      const mana = { group: g, spin, coin, halo, ground, partner, partnerId, cell, eaten: false, phase: i * 1.7, appear: 0 };
      this.manas.push(mana);
    });

    this.animated.push((t, dt) => {
      for (const m of this.manas) {
        if (m.eaten) continue;
        m.spin.position.y = 1.05 + 0.1 * Math.sin(t * 1.8 + m.phase);
        if (m.appear < 1) {
          // flip rapide (0,55 s) : part de dos, finit pile de face, avec un petit rebond d'échelle
          m.appear = Math.min(1, m.appear + dt / 0.55);
          const e = 1 - Math.pow(1 - m.appear, 3);
          m.spin.rotation.y = Math.PI * 2 * (1 - e);
          const sc = 0.4 + 0.6 * e + Math.sin(m.appear * Math.PI) * 0.15;
          m.spin.scale.set(sc, sc, sc);
        }
        const k = 2.8 + 0.3 * Math.sin(t * 3.1 + m.phase);
        m.halo.scale.set(k, k, 1);
        m.halo.material.opacity = 0.6 + 0.15 * Math.sin(t * 3.1 + m.phase);
      }
    });
  }

  eatMana(mana) {
    mana.eaten = true;
    mana.spin.visible = false;
    mana.halo.visible = false;
    mana.ground.visible = false;
  }

  resetManas() {
    for (const m of this.manas) { m.eaten = false; m.spin.visible = true; m.halo.visible = true; m.ground.visible = true; m.appear = 0; }
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
      im.castShadow = quality.leafShadows;
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
        im.userData.items.push({ x, z, s, yaw: rand() * Math.PI * 2, lean: (rand() - 0.5) * 0.5, phase: rand() * 6.28, color: new THREE.Color().setHSL(0.25 + rand() * 0.13, 0.75 + rand() * 0.25, 0.4 + rand() * 0.2) });
      }
      im.userData.items.forEach((it, i) => im.setColorAt(i, it.color));
      im.instanceColor.needsUpdate = true;
    };
    place(leavesA, leavesA.count);
    place(leavesB, leavesB.count);
    this.scene.add(leavesA, leavesB);
    const m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    // vent : souffle de fond + rafales irrégulières
    const wind = (t) => 0.6 + 0.4 * Math.sin(t * 0.35) + 0.5 * Math.max(0, Math.sin(t * 0.9 + 1.3)) * Math.max(0, Math.sin(t * 0.23));
    this.wind = wind;
    const sway = (im, t) => {
      const wv = wind(t);
      im.userData.items.forEach((it, i) => {
        e.set(it.lean + Math.sin(t * 1.3 + it.phase) * 0.07 * wv + Math.sin(t * 3.1 + it.phase) * 0.02 * wv, it.yaw + Math.sin(t * 0.7 + it.phase) * 0.08 * wv, Math.sin(t * 1.6 + it.phase * 1.3) * 0.09 * wv);
        q.setFromEuler(e);
        p.set(it.x, 0, it.z);
        sc.set(it.s, it.s, it.s);
        m.compose(p, q, sc);
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    this.animated.push(Object.assign((t) => { sway(leavesA, t); sway(leavesB, t); }, { decor: true }));

    // --- fleurs tropicales (hibiscus) : touches de couleur dans le feuillage
    const flowerTex = TEX.flowerTexture();
    const flowerGeo = new THREE.PlaneGeometry(0.7, 0.7).translate(0, 0.35, 0);
    const flowers = new THREE.InstancedMesh(flowerGeo, new THREE.MeshBasicMaterial({ map: flowerTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: false }), quality.flowers);
    flowers.userData.items = [];
    for (let i = 0; i < quality.flowers; i++) {
      let x, z, tries = 0;
      do { x = (rand() - 0.5) * (W + 9); z = (rand() - 0.5) * (H + 9); tries++; } while (Math.abs(x) < W / 2 + 0.9 && Math.abs(z) < H / 2 + 0.9 && tries < 50);
      const near = z > H / 2;
      flowers.userData.items.push({ x, z, s: near ? 0.6 + rand() * 0.3 : 0.8 + rand() * 0.7, yaw: rand() * 6.28, phase: rand() * 6.28, color: new THREE.Color(theme.flowers[i % theme.flowers.length]) });
    }
    flowers.userData.items.forEach((it, i) => flowers.setColorAt(i, it.color));
    flowers.instanceColor.needsUpdate = true;
    this.scene.add(flowers);
    this.animated.push(Object.assign((t) => {
      flowers.userData.items.forEach((it, i) => {
        const wv = wind(t);
        e.set(Math.sin(t * 1.2 + it.phase) * 0.12 * wv, it.yaw + Math.sin(t * 0.8 + it.phase) * 0.1, Math.sin(t * 1.5 + it.phase) * 0.1 * wv);
        q.setFromEuler(e); p.set(it.x, 0.15, it.z); sc.set(it.s, it.s, it.s); m.compose(p, q, sc);
        flowers.setMatrixAt(i, m);
      });
      flowers.instanceMatrix.needsUpdate = true;
    }, { decor: true }));

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
      const wv = wind(t);
      for (const pm of palms) {
        pm.crown.rotation.y = Math.sin(t * 0.5 + pm.phase) * 0.08 * wv;
        pm.crown.rotation.z = Math.sin(t * 0.8 + pm.phase) * 0.05 * wv;
        for (const pv of pm.crown.children) pv.rotation.x = Math.sin(t * 1.6 + pv.userData.phase + pm.phase) * 0.12 * wv;
      }
    });

    // --- feuilles qui tombent lentement
    const fallGeo = new THREE.PlaneGeometry(0.28, 0.42);
    const fallMat = new THREE.MeshBasicMaterial({ map: leafTexA, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, toneMapped: false, color: 0xc9f08a });
    const falling = new THREE.InstancedMesh(fallGeo, fallMat, quality.fallingLeaves);
    falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const fallers = [];
    for (let i = 0; i < quality.fallingLeaves; i++) fallers.push({ x: (rand() - 0.5) * (W + 10), z: (rand() - 0.5) * (H + 10), y: rand() * 7, spd: 0.35 + rand() * 0.35, phase: rand() * 6.28, rot: rand() * 6.28 });
    this.scene.add(falling);
    this.animated.push(Object.assign((t, dt) => {
      const wv = wind(t);
      fallers.forEach((f, i) => {
        f.y -= f.spd * dt;
        f.x += (0.3 + 0.6 * wv) * dt * Math.sin(t * 0.5 + f.phase);
        f.z += 0.2 * dt * Math.cos(t * 0.7 + f.phase);
        if (f.y < 0.1) { f.y = 6 + rand() * 2; f.x = (rand() - 0.5) * (W + 10); f.z = (rand() - 0.5) * (H + 10); }
        e.set(Math.sin(t * 2 + f.phase) * 0.8, f.rot + t * 0.8, Math.cos(t * 1.7 + f.phase) * 0.6);
        q.setFromEuler(e); p.set(f.x, f.y, f.z); sc.set(1, 1, 1); m.compose(p, q, sc);
        falling.setMatrixAt(i, m);
      });
      falling.instanceMatrix.needsUpdate = true;
    }, { decor: true }));

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
    this.animated.push((t) => { const wv = wind(t); for (const l of lianas) { l.rotation.z = Math.sin(t * 0.8 + l.userData.phase) * 0.12 * wv; l.rotation.x = Math.sin(t * 0.6 + l.userData.phase) * 0.07 * wv; } });

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
    this.animated.push(Object.assign((t) => { rays.forEach((r, i) => { r.rotation.y = 0.2 * i + Math.sin(t * 0.15 + i) * 0.25; }); }, { decor: true }));

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

  /** Mode allégé : on fige une partie du décor animé (feuillage, feuilles qui tombent, rayons) */
  setLite(on) {
    this.lite = on;
  }

  /** Flash des murs (fin de niveau) : k dans [0,1] */
  setWallFlash(k) {
    this.wallMat.emissive.setRGB(k * 0.9, k * 0.95, k * 0.8);
    this.glowMat.color.setRGB(1, 1, 1).lerp(new THREE.Color(this.theme.wall.glow), 1 - k);
  }

  update(t, dt) {
    this.time = t;
    // en mode allégé, le décor n'est animé qu'une image sur trois
    this.frame = (this.frame || 0) + 1;
    const skipDecor = this.lite && this.frame % 3 !== 0;
    for (const f of this.animated) { if (skipDecor && f.decor) continue; f(t, skipDecor ? dt : dt * (this.lite ? 3 : 1)); }
    this.updateDots(t, dt);
  }
}
