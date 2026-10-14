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
    this.threshold = 10;
    this.showJoystick = () => true;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const d = KEYMAP[e.code];
      if (d) { e.preventDefault(); this.onDir(d); return; }
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.onAction(); }
      if (e.code === 'KeyP' || e.code === 'Escape') { this.onPause(); }
    });

    // --- logique commune (souris et tactile)
    const begin = (id, x, y, target) => {
      if (target && target.closest && target.closest('button, a, .no-joy')) return false;
      if (this.pointerId !== null) return false;
      this.pointerId = id;
      this.origin = { x, y };
      this.lastDir = null;
      this.moved = false;
      if (this.showJoystick()) this._showJoy(x, y);
      return true;
    };
    const track = (id, x, y) => {
      if (id !== this.pointerId || !this.origin) return;
      const dx = x - this.origin.x, dy = y - this.origin.y;
      const len = Math.hypot(dx, dy);
      this._moveKnob(dx, dy);
      if (len < this.threshold) return;
      this.moved = true;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const hor = dx > 0 ? DIRS.right : DIRS.left, ver = dy > 0 ? DIRS.down : DIRS.up;
      const first = ax > ay ? hor : ver, second = ax > ay ? ver : hor;
      if (first !== this.lastDir) { this.lastDir = first; this.onDir(first); }
      // geste en diagonale (événements espacés dans une WebView) : le 2e axe devient le virage suivant
      if (Math.min(ax, ay) > this.threshold * 1.6) this.onDir(second);
      // l'origine suit le doigt : on peut enchaîner les virages sans relever
      const k = Math.max(0, len - this.threshold * 0.6) / len;
      this.origin.x += dx * k; this.origin.y += dy * k;
    };
    const end = (id) => {
      if (id !== this.pointerId) return;
      this.pointerId = null;
      this.origin = null;
      this._hideJoy();
      if (!this.moved) this.onAction();
    };

    // --- tactile : événements touch natifs (plus réactifs que Pointer Events dans certaines WebViews)
    const touchOpts = { passive: false };
    surface.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      if (begin('t' + t.identifier, t.clientX, t.clientY, e.target)) e.preventDefault();
    }, touchOpts);
    surface.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) track('t' + t.identifier, t.clientX, t.clientY);
      if (this.pointerId !== null) e.preventDefault();
    }, touchOpts);
    const touchEnd = (e) => { for (const t of e.changedTouches) end('t' + t.identifier); };
    surface.addEventListener('touchend', touchEnd);
    surface.addEventListener('touchcancel', touchEnd);

    // --- souris / stylet : Pointer Events (les pointeurs tactiles sont déjà gérés ci-dessus)
    surface.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      if (begin(e.pointerId, e.clientX, e.clientY, e.target)) { try { surface.setPointerCapture(e.pointerId); } catch { /* ignore */ } }
    });
    surface.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') track(e.pointerId, e.clientX, e.clientY); });
    surface.addEventListener('pointerup', (e) => { if (e.pointerType !== 'touch') end(e.pointerId); });
    surface.addEventListener('pointercancel', (e) => { if (e.pointerType !== 'touch') end(e.pointerId); });
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
