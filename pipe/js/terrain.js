// ---------------------------------------------------------------------------
//  TERRAIN : la vallée — pente herbeuse sous le réseau, flancs de colline, rivière en contrebas,
//  ciel dégradé (aussi utilisé comme environnement pour les reflets), soleil, nuages, végétation
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import * as TEX from './textures.js';
import { COS, SIN, groundY } from './grid3d.js';

// --- bruit de valeur déterministe
const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const sm = (t) => t * t * (3 - 2 * t);
export function noise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * a; n += a; a *= 0.5; f *= 2.1; } return s / n; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class Terrain {
  constructor({ net, theme, quality }) {
    this.net = net; this.theme = theme; this.quality = quality;
    this.group = new THREE.Group();
    this.hx = net.w / 2 + 0.9;   // demi-largeur de la zone plate (réseau)
    this.hs = net.h / 2 + 0.9;   // demi-hauteur (en lignes)
    this.animated = [];
    this.liteObjects = [];
    this._ground();
    this._river();
    this._sky();
    this._vegetation();
  }

  /** Hauteur du sol en un point monde (x, z) */
  height(x, z) {
    const s = z / COS;
    const base = groundY(z);
    const dx = Math.max(0, Math.abs(x) - this.hx), ds = Math.max(0, Math.abs(s) - this.hs);
    const k = smooth(0, 2.4, Math.hypot(dx, ds));                      // 0 dans la zone du réseau, 1 dehors
    const side = smooth(this.hx + 1.5, this.hx + 8, Math.abs(x)) * (3.4 + fbm(x * 0.2, s * 0.2) * 1.6);
    const top = smooth(this.hs + 1.0, this.hs + 7, -s) * (3.0 + fbm(x * 0.25, s * 0.25) * 1.2);
    const river = -smooth(this.hs + 1.6, this.hs + 4.0, s) * 1.7;
    const bumps = (fbm(x * 0.33, s * 0.33) - 0.5) * 1.1 * k;
    return base - 0.1 * (1 - k) + side + top + river + bumps;
  }
  /** Facteur « hors réseau » (0 sous les tuyaux, 1 dans la nature) */
  outside(x, z) {
    const s = z / COS;
    const dx = Math.max(0, Math.abs(x) - this.hx), ds = Math.max(0, Math.abs(s) - this.hs);
    return smooth(0, 1.6, Math.hypot(dx, ds));
  }
  riverLevel() { return groundY((this.hs + 3.2) * COS) - 1.05; }

  _ground() {
    const th = this.theme;
    const SIZE = 90, SEG = 160;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ga = new THREE.Color(th.grass.a), gb = new THREE.Color(th.grass.b), gc = new THREE.Color(th.grass.c), gd = new THREE.Color(th.grass.dry);
    const da = new THREE.Color(th.dirt.a), db = new THREE.Color(th.dirt.b), sand = new THREE.Color(0xd9c89a);
    const tmp = new THREE.Color();
    const zOff = 4; // la rivière (bas) est plus proche que la colline du haut
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i) + zOff;
      const y = this.height(x, z);
      pos.setZ(i, z); pos.setY(i, y);
      // pente locale
      const slope = Math.abs(this.height(x + 0.3, z) - y) + Math.abs(this.height(x, z + 0.3) - y);
      const n1 = fbm(x * 0.5 + 7, z * 0.5 + 3), n2 = fbm(x * 1.7, z * 1.7);
      tmp.copy(ga).lerp(gb, n1).lerp(gc, n2 * 0.5).lerp(gd, smooth(0.62, 0.8, n1) * 0.5);
      const inside = 1 - this.outside(x, z);
      const dirtK = smooth(0.35, 0.8, slope) * 0.8 + inside * (0.55 + smooth(0.4, 0.7, n2) * 0.35);
      tmp.lerp(n2 > 0.5 ? da : db, Math.min(1, dirtK));
      if (inside > 0.5) tmp.lerp(sand, inside * smooth(0.45, 0.65, n1) * 0.5);
      if (y < this.riverLevel() + 0.35) tmp.lerp(sand, smooth(this.riverLevel() + 0.35, this.riverLevel() - 0.2, y));
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const grass = TEX.grassTexture(); grass.repeat.set(26, 26);
    const mat = new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: 0.92, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.ground = mesh;
  }

  _river() {
    const th = this.theme;
    this.riverTex = TEX.riverTexture(th); this.riverTex.repeat.set(14, 2);
    const z = (this.hs + 3.4) * COS;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(100, 9).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: th.river.shallow, map: this.riverTex, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.9, envMapIntensity: 1.2 }));
    mesh.position.set(0, this.riverLevel(), z + 1.5);
    this.group.add(mesh);
    this.river = mesh;
  }

  _sky() {
    const th = this.theme;
    const zen = new THREE.Color(th.sky.zenith), hor = new THREE.Color(th.sky.horizon);
    const mat = new THREE.ShaderMaterial({
      uniforms: { zenith: { value: zen }, horizon: { value: hor } },
      vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 zenith; uniform vec3 horizon; varying vec3 vW; void main(){ float h = normalize(vW).y; vec3 c = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.6)); c = mix(c, horizon * 0.85, smoothstep(0.0, -0.3, h)); gl_FragColor = vec4(c, 1.0); }',
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), mat);
    this.group.add(this.sky);
    // soleil
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.glowTexture('rgba(255,245,220,1)', 'rgba(255,220,150,0)'), color: th.sky.sun, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    const d = new THREE.Vector3(...th.sun.position).normalize();
    sun.position.copy(d.multiplyScalar(240)); sun.scale.set(90, 90, 1);
    this.group.add(sun);
    // nuages
    this.clouds = [];
    const r = TEX.rng(41);
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.cloudTexture(50 + i), transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
      sp.position.set((r() - 0.5) * 240, 46 + r() * 22, -150 - r() * 60);
      sp.scale.set(50 + r() * 50, 22 + r() * 18, 1);
      sp.userData.speed = 0.25 + r() * 0.3;
      this.group.add(sp); this.clouds.push(sp);
    }
  }

  /** Environnement (reflets) : le ciel rendu en PMREM */
  buildEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const scene = new THREE.Scene();
    scene.add(this.sky.clone());
    const env = pmrem.fromScene(scene, 0.04).texture;
    pmrem.dispose();
    return env;
  }

  _vegetation() {
    const th = this.theme, q = this.quality;
    const r = TEX.rng(77);
    const spot = (minOut = 0.7, range = 16) => {
      for (let i = 0; i < 40; i++) {
        const x = (r() - 0.5) * 2 * range, z = (r() - 0.55) * 2 * (range * 0.8) + 2;
        if (this.outside(x, z) < minOut) continue;
        const y = this.height(x, z);
        if (y < this.riverLevel() + 0.3) continue;
        return new THREE.Vector3(x, y, z);
      }
      return null;
    };
    // touffes d'herbe (instances, deux plans croisés)
    const blade = TEX.bladeTexture(th);
    const bladeMat = new THREE.MeshStandardMaterial({ map: blade, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xdddddd });
    const tuft = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.7, 0.55).translate(0, 0.27, 0), bladeMat, q.grass * 2);
    const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), sc = new THREE.Vector3();
    let idx = 0;
    for (let i = 0; i < q.grass; i++) {
      const p = spot(0.35, 15); if (!p) continue;
      const s = 0.7 + r() * 0.9;
      for (let k = 0; k < 2; k++) { qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI + k * Math.PI / 2); sc.set(s, s, s); m.compose(p, qt, sc); tuft.setMatrixAt(idx++, m); }
    }
    tuft.count = idx; tuft.instanceMatrix.needsUpdate = true;
    this.group.add(tuft); this.liteObjects.push(tuft);
    // fougères
    const fernMat = new THREE.MeshStandardMaterial({ map: TEX.fernTexture(th), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
    const fern = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1).translate(0, 0.55, 0), fernMat, q.ferns * 2);
    idx = 0;
    for (let i = 0; i < q.ferns; i++) {
      const p = spot(0.6, 14); if (!p) continue;
      const s = 0.8 + r() * 0.8;
      for (let k = 0; k < 2; k++) { qt.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI + k * Math.PI / 2); sc.set(s, s, s); m.compose(p, qt, sc); fern.setMatrixAt(idx++, m); }
    }
    fern.count = idx; fern.instanceMatrix.needsUpdate = true;
    this.group.add(fern);
    // buissons
    const bushMat = new THREE.MeshStandardMaterial({ color: th.grass.c, roughness: 0.9, flatShading: true });
    const bush = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 1), bushMat, q.bushes);
    idx = 0;
    for (let i = 0; i < q.bushes; i++) {
      const p = spot(0.8, 14); if (!p) continue;
      qt.setFromEuler(new THREE.Euler(r() * 0.4, r() * Math.PI, r() * 0.4)); sc.set(0.7 + r() * 1.1, 0.5 + r() * 0.6, 0.7 + r() * 1.1);
      p.y += 0.1; m.compose(p, qt, sc); bush.setMatrixAt(idx++, m);
    }
    bush.count = idx; bush.instanceMatrix.needsUpdate = true; bush.castShadow = true; bush.receiveShadow = true;
    this.group.add(bush);
    // rochers
    const rockMat = new THREE.MeshStandardMaterial({ color: th.rock, roughness: 0.95, flatShading: true });
    const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.4, 0), rockMat, 40);
    idx = 0;
    for (let i = 0; i < 40; i++) {
      const p = spot(0.75, 15); if (!p) continue;
      qt.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)); sc.set(0.5 + r() * 1.2, 0.4 + r() * 0.7, 0.5 + r() * 1.2);
      m.compose(p, qt, sc); rock.setMatrixAt(idx++, m);
    }
    rock.count = idx; rock.instanceMatrix.needsUpdate = true; rock.castShadow = true;
    this.group.add(rock);
    // fleurs
    const flowerTex = th.flowers.map((c) => TEX.flowerTexture(c));
    for (let i = 0; i < q.flowers; i++) {
      const p = spot(0.4, 13); if (!p) continue;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerTex[i % flowerTex.length], transparent: true, depthWrite: false }));
      sp.position.copy(p); sp.position.y += 0.18; sp.scale.setScalar(0.26 + r() * 0.14);
      this.group.add(sp); this.liteObjects.push(sp);
    }
    // cocotiers : flancs et sommet, quelques-uns près des enseignes
    this.bark = TEX.barkTexture(th); this.bark.repeat.set(1, 6);
    this.frond = TEX.frondTexture(th.palm.leaf, th.palm.leaf2);
    const palmSpots = [];
    for (let i = 0; i < q.palms; i++) { const p = spot(0.9, 15); if (p) palmSpots.push(p); }
    palmSpots.forEach((p, i) => {
      const palm = this._palm(r, 1 + r() * 0.5);
      palm.position.copy(p); palm.rotation.y = r() * Math.PI * 2;
      this.group.add(palm); this.animated.push(palm);
      if (i >= Math.ceil(q.palms * 0.6)) this.liteObjects.push(palm);
    });
  }

  _palm(r, scale = 1) {
    const g = new THREE.Group();
    const h = 3.2 * scale, lean = (r() - 0.5) * 1.2;
    const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.2, h * 0.4, 0), new THREE.Vector3(lean * 0.6, h * 0.75, 0), new THREE.Vector3(lean, h, 0)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.11 * scale, 8, false), new THREE.MeshStandardMaterial({ map: this.bark, roughness: 0.9 }));
    trunk.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * scale, 0.2 * scale, 0.5, 8), trunk.material); foot.position.y = 0.2;
    g.add(trunk, foot);
    const top = new THREE.Group(); top.position.copy(pts[3]);
    const frondGeo = new THREE.PlaneGeometry(0.55 * scale, 2.3 * scale, 1, 6).translate(0, 1.15 * scale, 0);
    const fp = frondGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) { const y = fp.getY(i) / (2.3 * scale); fp.setZ(i, -Math.pow(y, 2) * 1.3 * scale); }
    frondGeo.computeVertexNormals();
    const frondMat = new THREE.MeshStandardMaterial({ map: this.frond, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    const N = 9;
    for (let i = 0; i < N; i++) {
      const f = new THREE.Mesh(frondGeo, frondMat);
      f.rotation.y = (i / N) * Math.PI * 2 + r() * 0.4;
      f.rotation.x = 1.15 + r() * 0.35; // la palme part vers l'extérieur et retombe
      f.castShadow = true;
      top.add(f);
    }
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.1 * scale, 8, 6), trunk.material); c.position.set((r() - 0.5) * 0.25, -0.05, (r() - 0.5) * 0.25); top.add(c); }
    g.add(top);
    g.userData.top = top;
    return g;
  }

  setLite(on) { for (const o of this.liteObjects) o.visible = !on; this.lite = on; }

  update(t, dt) {
    if (!this.lite) {
      this.riverTex.offset.x = (t * 0.02) % 1; this.riverTex.offset.y = (t * 0.006) % 1;
      for (const c of this.clouds) { c.position.x += c.userData.speed * dt; if (c.position.x > 130) c.position.x = -130; }
    }
    for (const p of this.animated) if (p.visible) p.userData.top.rotation.z = Math.sin(t * 0.9 + p.position.x) * 0.04;
  }
}
