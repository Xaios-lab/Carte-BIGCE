// ---------------------------------------------------------------------------
//  UI : HUD, file des pièces, barre d'état, écrans, bandeau partenaires, effets
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { partnerLogoUrl } from './textures.js';
import { DIRS } from './pieces.js';

const $ = (s) => document.querySelector(s);

export class UI {
  constructor(partners) {
    this.partners = partners;
    this.el = {
      score: $('#score'), hiscore: $('#hiscore'), level: $('#level'), lives: $('#lives'),
      partners: $('#partner-logos'), fx: $('#fx'), screens: $('#screens'),
      msg: $('#msg'), btnSound: $('#btn-sound'), btnPause: $('#btn-pause'), btnFast: $('#btn-fast'),
      levelName: $('#title-level'), queue: $('#queue-items'), statusText: $('#status-text'),
      quotaBar: $('#quota-bar'), quotaText: $('#quota-text'),
    };
    this.popups = [];
    this.lastScore = -1;
    this.queueCanvases = [];
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
  setFast(on) { this.el.btnFast.classList.toggle('on', on); }
  setFastVisible(v) { this.el.btnFast.hidden = !v; }

  /** Texte de la barre d'état ("L'eau arrive dans 12 s", "L'eau coule !", ...) */
  setStatus(text, cls = '') { this.el.statusText.textContent = text; this.el.statusText.className = 'status-text ' + cls; }
  /** Quota de tuyaux à remplir */
  setQuota(filled, quota, open) {
    const k = Math.min(1, filled / quota);
    this.el.quotaBar.style.width = (k * 100).toFixed(1) + '%';
    this.el.quotaText.textContent = open ? 'Réservoir ouvert !' : `Tuyaux ${filled} / ${quota}`;
    this.el.quotaBar.parentElement.classList.toggle('open', !!open);
  }

  // ------------------------------------------------------------ file des pièces
  /** items = [{piece, special}], le premier est la pièce qui sera posée */
  setQueue(items) {
    const q = this.el.queue;
    while (this.queueCanvases.length < items.length) {
      const wrap = document.createElement('div'); wrap.className = 'q';
      const c = document.createElement('canvas'); c.width = 96; c.height = 96;
      wrap.appendChild(c); q.appendChild(wrap);
      this.queueCanvases.push({ wrap, c });
    }
    items.forEach((it, i) => {
      const { wrap, c } = this.queueCanvases[i];
      wrap.classList.toggle('next', i === 0);
      wrap.classList.toggle('card', it.special === 'card');
      this._drawPiece(c, it);
    });
    this.el.queue.classList.remove('shift'); void this.el.queue.offsetWidth; this.el.queue.classList.add('shift');
  }
  _drawPiece(canvas, item) {
    const ctx = canvas.getContext('2d'), S = canvas.width, h = S / 2;
    ctx.clearRect(0, 0, S, S);
    const gold = item.special === 'card';
    const body = gold ? '#f2c35b' : '#2f86ec', edge = gold ? '#8d5a12' : '#0f3f8a', water = gold ? '#fff1c2' : '#9fd9ff';
    const end = (side) => ({ x: h + DIRS[side].dc * h, y: h + DIRS[side].dr * h });
    const path = ([a, b]) => {
      const pa = end(a), pb = end(b);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y);
      if (DIRS[a].opp === b) ctx.lineTo(pb.x, pb.y); else ctx.quadraticCurveTo(h, h, pb.x, pb.y);
    };
    ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
    for (const ch of item.piece.channels) { path(ch); ctx.lineWidth = S * 0.36; ctx.strokeStyle = edge; ctx.stroke(); }
    for (const ch of item.piece.channels) { path(ch); ctx.lineWidth = S * 0.28; ctx.strokeStyle = body; ctx.stroke(); }
    for (const ch of item.piece.channels) { path(ch); ctx.lineWidth = S * 0.07; ctx.strokeStyle = water; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1; }
    // bagues laiton aux extrémités
    ctx.fillStyle = gold ? '#fff0b0' : '#d9a441';
    for (const ch of item.piece.channels) for (const side of ch) {
      const p = end(side);
      const d = DIRS[side];
      ctx.save(); ctx.translate(p.x - d.dc * S * 0.06, p.y - d.dr * S * 0.06); ctx.rotate(d.dc ? 0 : Math.PI / 2);
      ctx.fillRect(-S * 0.05, -S * 0.21, S * 0.1, S * 0.42); ctx.restore();
    }
    if (item.piece.cross) { ctx.fillStyle = body; ctx.beginPath(); ctx.arc(h, h, S * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = S * 0.04; ctx.stroke(); }
    if (gold) { ctx.fillStyle = '#2a1a00'; ctx.font = `bold ${S * 0.17}px Nunito, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BIG CE', h, h); }
  }

  /** Bandeau des partenaires (ordre des Manas) */
  setPartners(ids) {
    this.el.partners.innerHTML = '';
    this.partnerEls = {};
    ids.forEach((id) => {
      const p = this.partners[id];
      const d = document.createElement('div');
      d.className = 'partner';
      d.innerHTML = `<img src="${partnerLogoUrl(p)}" alt="${p.name}"><span>${p.name}</span>`;
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

  setRecord(screen, on) {
    const el = document.querySelector(`#screen-${screen} .record`);
    if (el) el.hidden = !on;
  }
  hint(on) {
    const el = document.getElementById('hint');
    if (el) el.classList.toggle('on', on);
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
    this.el.screens.classList.toggle('on', !!id);
  }

  /** Message central court ("PRÊT ?", "3", "C'EST PARTI !", ...) */
  message(text, cls = '') {
    const m = this.el.msg;
    m.className = 'msg ' + cls;
    if (!text) { m.classList.remove('on'); m.textContent = ''; return; }
    m.innerHTML = text;
    m.classList.add('on');
  }

  /** Grand retournement du logo Mana + flammes dorées + nom du partenaire */
  manaBurst(partner, { card = false, tag = 'MANA', sub = "L'eau ralentit !" } = {}) {
    const d = document.createElement('div');
    d.className = 'mana-burst' + (card ? ' card' : '');
    d.style.left = '50%'; d.style.top = '40%';
    const img = card ? 'assets/carte-2026.webp' : partnerLogoUrl(partner);
    d.innerHTML = `
      <div class="fire"></div><div class="fire b"></div>
      <div class="coin"><div class="side front"><img src="${img}" alt=""></div><div class="side back"><img src="${img}" alt=""></div></div>
      <div class="label"><em>${tag}</em><strong>${partner.name}</strong><span>${sub}</span></div>`;
    this.el.fx.appendChild(d);
    setTimeout(() => d.remove(), 2900);
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

  // confettis gouttes (fin de niveau)
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
