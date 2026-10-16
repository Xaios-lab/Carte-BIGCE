// ---------------------------------------------------------------------------
//  CAMERA RIG : cadre tout le plateau en tenant compte des zones occupées par le HUD
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export const CAMERA_PITCH_DEG = 58;

export class CameraRig {
  constructor(board, renderer) {
    this.board = board;
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 200);
    this.pitch = THREE.MathUtils.degToRad(CAMERA_PITCH_DEG);
    this.target = new THREE.Vector3(0, 0, 0);
    this.dist = 20;
    this.insets = { top: 64, bottom: 110, left: 70, right: 8 }; // HUD en pixels
    this.shake = 0;
    this.zoomBoost = 0;
    this.resize();
  }

  _place(target, dist) {
    const c = this.camera;
    c.position.set(target.x, target.y + dist * Math.sin(this.pitch), target.z + dist * Math.cos(this.pitch));
    c.lookAt(target);
    c.updateMatrixWorld();
  }

  resize() {
    const w = this.renderer.domElement.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
    const { board } = this;
    const hw = board.w / 2 + 0.75, hh = board.h / 2 + 0.75;
    const corners = [
      new THREE.Vector3(-hw, 0, -hh), new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(-hw, 0, hh), new THREE.Vector3(hw, 0, hh),
      new THREE.Vector3(-hw, 1.9, -hh), new THREE.Vector3(hw, 1.9, -hh), // médaillons des Manas
    ];
    // le centre du cadrage est décalé pour que la zone libre (hors HUD) soit centrée sur le plateau
    const nxL = -1 + (2 * this.insets.left) / w, nxR = 1 - (2 * this.insets.right) / w;
    const nyTop = 1 - (2 * this.insets.top) / h, nyBot = -1 + (2 * this.insets.bottom) / h;
    // on recentre la cible pour que le plateau tombe au milieu de la zone libre, puis on cherche
    // par dichotomie la distance la plus proche qui laisse tout le plateau visible
    const cx = (nxL + nxR) / 2, cy = (nyTop + nyBot) / 2;
    let lo = 4, hi = 150;
    for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (this._fitsCentered(mid, corners, nxL, nxR, nyTop, nyBot, cx, cy)) hi = mid; else lo = mid; }
    this.dist = hi;
    this.offset = this._centerOffset(this.dist, cx, cy);
    this._place(this.target.clone().add(this.offset), this.dist);
  }

  /** Décalage de la cible (au sol) pour qu'un point du centre du plateau se projette en (cx, cy) NDC */
  _centerOffset(d, cx, cy) {
    this._place(new THREE.Vector3(0, 0, 0), d);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(cx, cy), this.camera);
    const p = new THREE.Vector3();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    if (!ray.ray.intersectPlane(ground, p)) return new THREE.Vector3();
    return p.negate();
  }
  _fitsCentered(d, corners, nxL, nxR, nyTop, nyBot, cx, cy) {
    const off = this._centerOffset(d, cx, cy);
    this._place(off, d);
    for (const c of corners) {
      const p = c.clone().project(this.camera);
      if (p.x < nxL || p.x > nxR || p.y > nyTop || p.y < nyBot) return false;
    }
    return true;
  }

  update(dt) {
    const d = this.dist * (1 - this.zoomBoost);
    const t = this.target.clone().add(this.offset || new THREE.Vector3());
    if (this.shake > 0) {
      t.x += (Math.random() - 0.5) * this.shake; t.z += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this._place(t, d);
  }

  /** Point du sol (y = 0) visé par une position écran, ou null */
  groundAt(px, py) {
    const ndc = new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3), p) ? p : null;
  }
}
