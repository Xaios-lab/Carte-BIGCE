// ---------------------------------------------------------------------------
//  INPUT : toucher / souris (tap sur une case, survol) + clavier (curseur, pose, accélération)
// ---------------------------------------------------------------------------
export class Input {
  constructor(el) {
    this.el = el;
    this.onTap = null;      // (px, py)
    this.onHover = null;    // (px, py) ou (null) quand le pointeur quitte la zone
    this.onCursor = null;   // ('N'|'E'|'S'|'W') clavier
    this.onPlace = null;    // clavier : poser sur la case du curseur
    this.onFast = null;     // Espace / F : lancer l'eau
    this.onPause = null;
    this.onAction = null;   // Entrée / Espace sur un écran
    this.enabled = () => true;
    this.pointerFine = matchMedia('(pointer: fine)').matches;
    this._down = null;

    const ignore = (t) => t.closest && t.closest('button, a, #screens, #lightbox, #status, #partners, #hud');
    el.addEventListener('pointerdown', (e) => {
      if (ignore(e.target)) return;
      this._down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
      if (ignore(e.target)) { if (this.onHover) this.onHover(null); return; }
      if (e.pointerType === 'mouse' || this.pointerFine) { if (this.onHover) this.onHover(e.clientX, e.clientY); }
    });
    el.addEventListener('pointerleave', () => { if (this.onHover) this.onHover(null); });
    el.addEventListener('pointerup', (e) => {
      const d = this._down; this._down = null;
      if (!d || d.id !== e.pointerId || ignore(e.target)) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (dx * dx + dy * dy > 18 * 18 || performance.now() - d.t > 600) return; // glissé ou appui long : pas un tap
      if (!this.enabled()) return;
      if (this.onTap) this.onTap(e.clientX, e.clientY);
    });
    el.addEventListener('pointercancel', () => { this._down = null; });

    const DIRS = { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W', KeyW: 'N', KeyZ: 'N', KeyD: 'E', KeyS: 'S', KeyA: 'W', KeyQ: 'W' };
    window.addEventListener('keydown', (e) => {
      if (e.repeat && !DIRS[e.code]) return;
      if (e.code === 'KeyP' || e.code === 'Escape') { if (this.onPause) this.onPause(); e.preventDefault(); return; }
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.onAction && this.onAction()) { e.preventDefault(); return; }
        if (!this.enabled()) return;
        if (e.code === 'Space' && this.onFast) this.onFast(true);   // Espace : lancer l'eau
        else if (this.onPlace) this.onPlace();                       // Entrée : pivoter la pièce du curseur
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyF') { if (this.onFast) this.onFast(true); return; }
      const dir = DIRS[e.code];
      if (dir && this.enabled()) { if (this.onCursor) this.onCursor(dir); e.preventDefault(); }
    });
  }
}
