// ---------------------------------------------------------------------------
//  UI : HUD, écrans, bandeau partenaires, effet "retournement Mana", popups
// ---------------------------------------------------------------------------
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(partners) {
    this.partners = partners;
    this.el = {
      score: $('#score'), hiscore: $('#hiscore'), level: $('#level'), lives: $('#lives'),
      partners: $('#partner-logos'), fx: $('#fx'), screens: $('#screens'),
      msg: $('#msg'), btnSound: $('#btn-sound'), btnPause: $('#btn-pause'),
      levelName: $('#title-level'),
    };
    this.popups = [];
    this.lastScore = -1;
  }

  setScore(v) {
    if (v === this.lastScore) return;
    this.lastScore = v;
    this.el.score.textContent = String(v).padStart(5, '0');
    this.el.score.classList.remove('bump'); void this.el.score.offsetWidth; this.el.score.classList.add('bump');
  }
  setHiScore(v) { this.el.hiscore.textContent = String(v).padStart(5, '0'); }
  setLevel(name) { this.el.level.textContent = name; }
  setLives(n) {
    this.el.lives.innerHTML = '';
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'life'; this.el.lives.appendChild(s); }
  }
  setSound(on) { this.el.btnSound.classList.toggle('off', !on); this.el.btnSound.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son'); }

  /** Bandeau des partenaires (ordre des Manas) */
  setPartners(ids) {
    this.el.partners.innerHTML = '';
    this.partnerEls = {};
    ids.forEach((id) => {
      const p = this.partners[id];
      const d = document.createElement('div');
      d.className = 'partner';
      d.innerHTML = `<img src="${p.logo}" alt="${p.name}"><span>${p.name}</span>`;
      this.el.partners.appendChild(d);
      this.partnerEls[id] = d;
    });
  }
  setPartnerState(id, collected) {
    const d = this.partnerEls[id];
    if (!d) return;
    d.classList.toggle('collected', collected);
    if (collected) { d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }
  }
  resetPartners() { Object.keys(this.partnerEls || {}).forEach((id) => this.setPartnerState(id, false)); }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    this.el.screens.classList.toggle('on', !!id);
  }

  /** Message central court ("PRÊT ?", "NIVEAU TERMINÉ", ...) */
  message(text, cls = '') {
    const m = this.el.msg;
    m.className = 'msg ' + cls;
    if (!text) { m.classList.remove('on'); m.textContent = ''; return; }
    m.innerHTML = text;
    m.classList.add('on');
  }

  /** Grand retournement du logo Mana + flammes dorées + nom du partenaire */
  /** avoid = position écran de Pac-Man (0..1) : l'effet s'affiche à l'opposé pour ne pas le masquer */
  manaBurst(partner, { card = false, tag = 'MANA', sub = 'Mange les esprits !', avoid = null } = {}) {
    const d = document.createElement('div');
    d.className = 'mana-burst' + (card ? ' card' : '');
    let left = 50, top = 42;
    if (avoid) {
      if (avoid.x < 0.42) left = 70;
      else if (avoid.x > 0.58) left = 30;
      else top = avoid.y < 0.5 ? 68 : 24;
    }
    d.style.left = left + '%'; d.style.top = top + '%';
    d.innerHTML = `
      <div class="fire"></div><div class="fire b"></div>
      <div class="coin"><div class="side front"><img src="${partner.logo}" alt=""></div><div class="side back"><img src="${partner.logo}" alt=""></div></div>
      <div class="label"><em>${tag}</em><strong>${partner.name}</strong><span>${sub}</span></div>`;
    this.el.fx.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }

  /** Popup de score ancré dans le monde 3D */
  popup(text, worldPos, cls = '') {
    const d = document.createElement('div');
    d.className = 'popup ' + cls;
    d.textContent = text;
    this.el.fx.appendChild(d);
    this.popups.push({ el: d, pos: worldPos.clone(), t: 0 });
  }

  updatePopups(dt, camera, w, h) {
    const v = new THREE.Vector3();
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      if (p.t > 1.3) { p.el.remove(); this.popups.splice(i, 1); continue; }
      v.copy(p.pos); v.y += 0.8 + p.t * 0.9; v.project(camera);
      p.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-50%) scale(${1 + Math.min(p.t * 2, 0.4)})`;
      p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1';
    }
  }

  flash(cls = 'white') {
    const d = document.createElement('div');
    d.className = 'flash ' + cls;
    this.el.fx.appendChild(d);
    setTimeout(() => d.remove(), 600);
  }

  // confettis flèches (fin de niveau)
  confetti(n = 60) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.animationDelay = Math.random() * 0.8 + 's';
      d.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
      d.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      d.style.setProperty('--hue', String(30 + Math.random() * 40));
      this.el.fx.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }
}
