// ---------------------------------------------------------------------------
//  CAMERA RIG : cadre tout le réseau (hors zones du HUD), avec plongée d'intro, coups de zoom,
//  secousse et lente orbite (3°/s) quand rien d'autre ne bouge.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { cellToWorld, planeToWorld, PIPE_Y, pipePlane } from './grid3d.js';
import { gsap, M } from './motion.js';

export const CAMERA_PITCH_DEG = 50;

export class CameraRig {
  constructor(net, renderer) {
    this.net = net;
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.3, 400);
    this.pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    this.target = new THREE.Vector3();
    this.center = planeToWorld(0, 0, PIPE_Y);
    this.dist = 20;
    this.fitDist = 20;
    this.yaw = 0;
    this.orbit = 0;        // vitesse d'orbite en rad/s (0 = immobile)
    this.zoom = 1;         // 1 = cadrage complet ; > 1 = coup de zoom
    this.shake = 0;
    this.lift = 0;         // 0 = jeu ; 1 = plongée d'intro (haut et loin)
    this.insets = { top: 70, bottom: 120, left: 10, right: 10 };
    this.plane = pipePlane();
    this.resize();
  }

  _place(target, dist, pitch, yaw) {
    const c = this.camera;
    const h = dist * Math.cos(pitch);
    c.position.set(target.x + h * Math.sin(yaw), target.y + dist * Math.sin(pitch), target.z + h * Math.cos(yaw));
    c.lookAt(target);
    c.updateMatrixWorld();
  }

  /** Points à garder à l'écran : coins du réseau, château d'eau, enseignes */
  _corners() {
    const { net } = this;
    const pts = [];
    const m = 0.6;
    for (const [c, r] of [[-m, -m], [net.w - 1 + m, -m], [-m, net.h - 1 + m], [net.w - 1 + m, net.h - 1 + m]]) pts.push(cellToWorld(net, c, r, 0));
    const t = cellToWorld(net, net.tower.c, net.tower.r, 4.5); pts.push(t);
    if (this.signPoints) pts.push(...this.signPoints()); else for (const s of net.signs) pts.push(cellToWorld(net, s.c, s.r, 2.1));
    return pts;
  }

  resize() {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    // en paysage, les enseignes glissent vers les bords de l'écran (jusqu'à 2,4 cases)
    if (this.onLayout) this.onLayout(THREE.MathUtils.clamp((w / h - 0.8) * 2.2, 0, 2.4));
    const pts = this._corners();
    const nxL = -1 + (2 * this.insets.left) / w, nxR = 1 - (2 * this.insets.right) / w;
    const nyTop = 1 - (2 * this.insets.top) / h, nyBot = -1 + (2 * this.insets.bottom) / h;
    const cx = (nxL + nxR) / 2, cy = (nyTop + nyBot) / 2;
    const fits = (d) => {
      const off = this._centerOffset(d, cx, cy);
      this._place(this.center.clone().add(off), d, this.pitch, 0);
      for (const p of pts) { const q = p.clone().project(this.camera); if (q.x < nxL || q.x > nxR || q.y > nyTop || q.y < nyBot) return false; }
      return true;
    };
    let lo = 3, hi = 200;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    this.fitDist = hi;
    this.offset = this._centerOffset(this.fitDist, cx, cy);
    this.update(0);
  }
  /** Décalage de la cible pour que le centre du réseau tombe au milieu de la zone libre */
  _centerOffset(d, cx, cy) {
    this._place(this.center, d, this.pitch, 0);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(cx, cy), this.camera);
    const p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(this.plane, p)) return new THREE.Vector3();
    return this.center.clone().sub(p);
  }

  update(dt) {
    if (this.orbit) this.yaw += this.orbit * dt;
    const liftPitch = this.pitch + (THREE.MathUtils.degToRad(72) - this.pitch) * this.lift;
    const dist = (this.fitDist / this.zoom) * (1 + 1.3 * this.lift);
    const t = this.center.clone().add(this.offset || new THREE.Vector3()).add(this.target);
    if (this.shake > 0) { t.x += (Math.random() - 0.5) * this.shake; t.y += (Math.random() - 0.5) * this.shake * 0.6; this.shake = Math.max(0, this.shake - dt * 1.4); }
    this._place(t, dist, liftPitch, this.yaw);
  }

  /** Plongée d'intro : de haut et loin vers le cadrage de jeu, 2 s, ease des deux côtés */
  dive(onDone) {
    gsap.killTweensOf(this);
    this.lift = 1; this.yaw = -0.35;
    gsap.to(this, { lift: 0, yaw: 0, duration: 2.1, ease: M.move, onComplete: onDone });
  }
  /** Coup de zoom (événement) : 1 → k puis retour, ease des deux côtés */
  punch(k = 1.07, dur = 0.42) {
    gsap.killTweensOf(this, 'zoom');
    gsap.to(this, { zoom: k, duration: dur * 0.45, ease: 'power2.out', yoyo: true, repeat: 1, repeatDelay: 0.05 });
  }
  /** Orbite lente (3°/s) pendant les écrans, retour à zéro en jeu */
  setOrbit(on) {
    gsap.killTweensOf(this, 'orbit,yaw');
    if (on) gsap.to(this, { orbit: THREE.MathUtils.degToRad(3), duration: 1.2, ease: 'power2.inOut' });
    else { gsap.to(this, { orbit: 0, duration: 0.6, ease: 'power2.out' }); gsap.to(this, { yaw: 0, duration: 1.1, ease: M.move }); }
  }

  /** Point du plan des tuyaux visé par une position écran, ou null */
  pointAt(px, py) {
    const ndc = new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(this.plane, p) ? p : null;
  }
}
