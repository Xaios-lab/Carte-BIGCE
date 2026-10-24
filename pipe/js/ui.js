// ---------------------------------------------------------------------------
//  UI : HUD, barre d'état, écrans (entrées/sorties GSAP), enseignes partenaires, effets
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { partnerLogoUrl } from './textures.js';
import { gsap, panelIn, panelOut, wordsIn, bump } from './motion.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(partners) {
    this.partners = partners;
    this.el = {
      score: $('#score'), hiscore: $('#hiscore'), level: $('#level'), lives: $('#lives'),
      partners: $('#partner-logos'), fx: $('#fx'), screens: $('#screens'),
      msg: $('#msg'), btnSound: $('#btn-sound'), btnPause: $('#btn-pause'), btnLaunch: $('#btn-launch'),
      levelName: $('#title-level'), statusText: $('#status-text'), statusSub: $('#status-sub'),
    };
    this.popups = [];
    this.lastScore = -1;
    this.current = null;
  }

  setScore(v) {
    if (v === this.lastScore) return;
    this.lastScore = v;
    this.el.score.textContent = String(v).padStart(5, '0');
    bump(this.el.score);
  }
  setHiScore(v) { this.el.hiscore.textContent = String(v).padStart(5, '0'); }
  setLevel(name) { this.el.level.textContent = name; }
  setLives(n) {
    this.el.lives.innerHTML = '';
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.className = 'life'; this.el.lives.appendChild(s); }
  }
  setSound(on) { this.el.btnSound.classList.toggle('off', !on); this.el.btnSound.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son'); }
  setLaunchVisible(v) {
    const b = this.el.btnLaunch;
    if (v && b.hidden) { b.hidden = false; gsap.fromTo(b, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'expo.out' }); }
    else if (!v && !b.hidden) { gsap.to(b, { opacity: 0, scale: 0.96, duration: 0.25, ease: 'power3.in', onComplete: () => { b.hidden = true; gsap.set(b, { clearProps: 'all' }); } }); }
  }
  setStatus(text, cls = '', sub = '') {
    if (this.el.statusText.textContent !== text) this.el.statusText.textContent = text;
    this.el.statusText.className = 'status-text ' + cls;
    this.el.statusSub.textContent = sub;
  }

  /** Enseignes (ordre A, B, C, D) */
  setPartners(ids) {
    this.el.partners.innerHTML = '';
    this.partnerEls = {};
    ids.forEach((id, i) => {
      const p = this.partners[id];
      const d = document.createElement('div');
      d.className = 'partner';
      d.innerHTML = `<span class="frame"><img src="${partnerLogoUrl(p)}" alt="${p.name}"></span><span>${p.short || p.name}</span>`;
      this.el.partners.appendChild(d);
      this.partnerEls[i] = d;
    });
  }
  setPartnerState(i, fed) {
    const d = this.partnerEls[i];
    if (!d) return;
    d.classList.toggle('collected', fed);
    if (fed) gsap.fromTo(d, { scale: 0.7, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.6)' });
  }
  resetPartners() { Object.keys(this.partnerEls || {}).forEach((i) => this.setPartnerState(i, false)); }

  setRecord(screen, on) { const el = document.querySelector(`#screen-${screen} .record`); if (el) el.hidden = !on; }
  hint(on) { const el = document.getElementById('hint'); if (el) el.classList.toggle('on', on); }

  /** Écrans : l'ancien sort en accélérant, le nouveau se pose sur une longue traîne */
  showScreen(id) {
    const prev = this.current;
    this.current = id;
    const show = () => {
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
      this.el.screens.classList.toggle('on', !!id);
      if (id) { const panel = document.querySelector(`#${id} .panel`); panelIn(panel); const h = panel && panel.querySelector('h1, h2'); if (h && h.tagName === 'H1') wordsIn(h); }
    };
    if (prev && prev !== id) panelOut(document.querySelector(`#${prev} .panel`), show); else show();
  }

  /** Message central court : flou → net, puis sortie courte */
  message(text, cls = '') {
    const m = this.el.msg;
    gsap.killTweensOf(m);
    if (!text) { gsap.to(m, { opacity: 0, filter: 'blur(6px)', duration: 0.22, ease: 'power3.in', onComplete: () => { m.textContent = ''; m.className = 'msg'; } }); return; }
    m.className = 'msg on ' + cls;
    m.innerHTML = text;
    gsap.fromTo(m, { opacity: 0, scale: 0.9, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'expo.out' });
  }

  /** Grand retournement d'un logo (enseigne alimentée / Carte BIG CE) avec flammes dorées */
  burst(partner, opts = {}) {
    const now = performance.now();
    const at = Math.max(now, (this.lastBurst || 0) + 1100);
    this.lastBurst = at;
    if (at > now) { setTimeout(() => this._burst(partner, opts), at - now); return; }
    this._burst(partner, opts);
  }
  _burst(partner, { tag = 'ENSEIGNE ALIMENTÉE', sub = '+300', card = false } = {}) {
    const d = document.createElement('div');
    d.className = 'mana-burst' + (card ? ' card' : ' sign');
    const img = card ? 'assets/carte-2026.webp' : partnerLogoUrl(partner);
    const ratio = card ? 1010 / 642 : (partner.ratio || 1);
    d.innerHTML = `
      <div class="fire"></div><div class="fire b"></div>
      <div class="coin" style="--ratio:${ratio}"><div class="side front"><img src="${img}" alt=""></div><div class="side back"><img src="${img}" alt=""></div></div>
      <div class="label"><em>${tag}</em><strong>${partner.short || partner.name}</strong><span>${sub}</span></div>`;
    this.el.fx.appendChild(d);
    setTimeout(() => d.remove(), 2900);
  }

  popup(text, worldPos, cls = '') {
    const d = document.createElement('div');
    d.className = 'popup ' + cls; d.textContent = text;
    this.el.fx.appendChild(d);
    this.popups.push({ el: d, pos: worldPos.clone(), t: 0 });
  }
  updatePopups(dt, camera, w, h) {
    const v = new THREE.Vector3();
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.t += dt;
      if (p.t > 1.3) { p.el.remove(); this.popups.splice(i, 1); continue; }
      v.copy(p.pos); v.y += 0.6 + p.t * 0.9; v.project(camera);
      p.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%,-50%) scale(${1 + Math.min(p.t * 2, 0.4)})`;
      p.el.style.opacity = p.t > 0.9 ? String(1 - (p.t - 0.9) / 0.4) : '1';
    }
  }
  flash(cls = 'white') {
    const d = document.createElement('div'); d.className = 'flash ' + cls; this.el.fx.appendChild(d); setTimeout(() => d.remove(), 600);
  }
  confetti(n = 60) {
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'confetti';
      d.style.left = Math.random() * 100 + 'vw';
      d.style.animationDelay = Math.random() * 0.8 + 's';
      d.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
      d.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg');
      d.style.setProperty('--hue', String(175 + Math.random() * 40));
      this.el.fx.appendChild(d);
      setTimeout(() => d.remove(), 3200);
    }
  }
}
