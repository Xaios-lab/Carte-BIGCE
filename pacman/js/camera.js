// ---------------------------------------------------------------------------
//  CAMERA RIG : cadre tout le labyrinthe si l'écran le permet, sinon suit Pac-Man
// ---------------------------------------------------------------------------
import * as THREE from 'three';

export class CameraRig {
  constructor(maze, renderer) {
    this.maze = maze;
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.5, 120);
    this.pitch = THREE.MathUtils.degToRad(63);
    this.target = new THREE.Vector3(0, 0, 0);
    this.desired = new THREE.Vector3(0, 0, 0);
    this.dist = 30;
    this.fitDist = 30;
    this.follow = false;
    this.minCellPx = 30;
    this.insets = { top: 64, bottom: 76, left: 8, right: 8 }; // HUD en pixels
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
    const { maze } = this;
    const hw = maze.w / 2 + 0.9, hh = maze.h / 2 + 0.9;
    const corners = [
      new THREE.Vector3(-hw, 0, -hh), new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(-hw, 0.7, hh), new THREE.Vector3(hw, 0.7, hh),
      new THREE.Vector3(-hw, 1.2, -hh), new THREE.Vector3(hw, 1.2, -hh),
    ];
    // limites NDC en tenant compte du HUD
    const nx = 1 - (2 * Math.max(this.insets.left, this.insets.right)) / w;
    const nyTop = 1 - (2 * this.insets.top) / h;
    const nyBot = 1 - (2 * this.insets.bottom) / h;
    const fits = (d) => {
      this._place(new THREE.Vector3(0, 0, 0), d);
      for (const c of corners) {
        const p = c.clone().project(this.camera);
        if (p.x < -nx || p.x > nx || p.y > nyTop || p.y < -nyBot) return false;
      }
      return true;
    };
    let lo = 5, hi = 120;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    this.fitDist = hi;
    // taille d'une case à l'écran en mode "tout le labyrinthe"
    this._place(new THREE.Vector3(0, 0, 0), this.fitDist);
    const a = new THREE.Vector3(0, 0, 0).project(this.camera), b = new THREE.Vector3(1, 0, 0).project(this.camera);
    const cellPx = Math.abs(b.x - a.x) * w / 2;
    this.follow = cellPx < this.minCellPx;
    this.dist = this.follow ? this.fitDist * (cellPx / this.minCellPx) : this.fitDist;
    // étendue visible au sol (pour borner la caméra en mode suivi)
    this._place(new THREE.Vector3(0, 0, 0), this.dist);
    const ray = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = (x, y) => { ray.setFromCamera(new THREE.Vector2(x, y), this.camera); const p = new THREE.Vector3(); return ray.ray.intersectPlane(ground, p) ? p : new THREE.Vector3(x * 50, 0, -y * 50); };
    const bl = hit(-nx, -nyBot), br = hit(nx, -nyBot), tl = hit(-nx, nyTop);
    this.visHalfW = Math.min(Math.abs(bl.x), Math.abs(br.x));
    this.visTop = -tl.z;   // distance (en z) de la cible jusqu'au bord haut visible
    this.visBottom = bl.z; // ... jusqu'au bord bas visible
    this._place(this.target, this.dist);
  }

  update(dt, focus) {
    const { maze } = this;
    if (this.follow) {
      const hw = maze.w / 2, hh = maze.h / 2;
      const minX = -hw + this.visHalfW, maxX = hw - this.visHalfW;
      const minZ = -hh + this.visTop - 0.5, maxZ = hh - this.visBottom + 0.5;
      this.desired.x = minX > maxX ? 0 : THREE.MathUtils.clamp(focus.x, minX, maxX);
      this.desired.z = minZ > maxZ ? 0 : THREE.MathUtils.clamp(focus.z, minZ, maxZ);
    } else {
      // léger parallaxe vers Pac-Man
      this.desired.x = focus.x * 0.06;
      this.desired.z = focus.z * 0.06;
    }
    const k = 1 - Math.exp(-dt * 4.5);
    this.target.lerp(this.desired, k);
    const d = this.dist * (1 - this.zoomBoost);
    const t = this.target.clone();
    if (this.shake > 0) {
      t.x += (Math.random() - 0.5) * this.shake; t.z += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this._place(t, d);
  }
}
