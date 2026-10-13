// ---------------------------------------------------------------------------
//  INPUT : clavier (PC/Mac) + joystick flottant tactile (mobile) + souris
// ---------------------------------------------------------------------------
import { DIRS } from './maze.js';

const KEYMAP = {
  ArrowUp: DIRS.up, ArrowDown: DIRS.down, ArrowLeft: DIRS.left, ArrowRight: DIRS.right,
  KeyW: DIRS.up, KeyS: DIRS.down, KeyA: DIRS.left, KeyD: DIRS.right,
  KeyZ: DIRS.up, KeyQ: DIRS.left, // AZERTY
};

export class Input {
  constructor(surface, joystickEl) {
    this.surface = surface;
    this.joy = joystickEl;
    this.onDir = () => {};
    this.onAction = () => {};   // Entrée / espace / tap
    this.onPause = () => {};
    this.origin = null;
    this.pointerId = null;
    this.lastDir = null;
    this.threshold = 14;
    this.showJoystick = () => true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const d = KEYMAP[e.code];
      if (d) { e.preventDefault(); this.onDir(d); return; }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.onAction(); }
      if (e.code === 'KeyP' || e.code === 'Escape') { this.onPause(); }
    });

    const down = (e) => {
      if (e.target.closest('button, a, .no-joy')) return;
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.lastDir = null;
      this.moved = false;
      if (this.showJoystick()) this._showJoy(e.clientX, e.clientY);
      try { surface.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const move = (e) => {
      if (e.pointerId !== this.pointerId || !this.origin) return;
      const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y;
      const len = Math.hypot(dx, dy);
      this._moveKnob(dx, dy);
      if (len < this.threshold) return;
      this.moved = true;
      const d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? DIRS.right : DIRS.left) : (dy > 0 ? DIRS.down : DIRS.up);
      if (d !== this.lastDir) { this.lastDir = d; this.onDir(d); }
      // l'origine suit le doigt : on peut enchaîner les virages sans relever
      const k = Math.max(0, len - this.threshold * 0.6) / len;
      this.origin.x += dx * k; this.origin.y += dy * k;
    };
    const up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.origin = null;
      this._hideJoy();
      if (!this.moved) this.onAction();
    };
    surface.addEventListener('pointerdown', down);
    surface.addEventListener('pointermove', move);
    surface.addEventListener('pointerup', up);
    surface.addEventListener('pointercancel', up);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _showJoy(x, y) {
    if (!this.joy) return;
    this.joy.style.left = x + 'px';
    this.joy.style.top = y + 'px';
    this.joy.classList.add('on');
    this._moveKnob(0, 0);
  }
  _moveKnob(dx, dy) {
    if (!this.joy) return;
    const r = 34, len = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, len / r);
    const knob = this.joy.firstElementChild;
    knob.style.transform = `translate(${(dx / len) * k * r}px, ${(dy / len) * k * r}px)`;
  }
  _hideJoy() { if (this.joy) this.joy.classList.remove('on'); }
}
