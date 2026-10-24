// ---------------------------------------------------------------------------
//  GAME : boucle, états, règles (rotation des tuyaux, compte à rebours, eau ramifiée,
//  enseignes, Carte BIG CE, fuites, vies, niveaux)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, THEME, PARTNERS } from './levels.js';
import { Network, Flow, DIRS } from './network.js';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { AudioFX, lsGet, lsSet } from './audio.js';
import { UI } from './ui.js';
import { partnerTexture, loadImageTexture, partnerLogoUrl } from './textures.js';
import { worldToCell } from './grid3d.js';
import { gsap } from './motion.js';

const SCORE = { pipe: 100, sign: 300, gold: 500, level: 1000, earlyPerSec: 40, extraLifeAt: 6000 };
const FREEZE_TIME = 4;        // Carte BIG CE : l'eau fait une pause
const DRAW_URL = 'https://formulaire.big-ce.com/pipemana'; // formulaire du tirage au sort (à créer)
const SPONSORS_URL = 'https://www.guide2026.big-ce.com/PacMana/sponsors';
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* indisponible */ } };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    const ua = navigator.userAgent || '';
    this.isEmbedded = /\bwv\b/.test(ua) || (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) || window.self !== window.top || matchMedia('(display-mode: standalone)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isEmbedded ? 1 : this.isTouch ? 1.5 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.isEmbedded, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isEmbedded;
    this.renderer.shadowMap.type = this.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    const q = new URLSearchParams(location.search).get('q');
    const low = q === 'low' || (this.isEmbedded && q !== 'high');
    this.quality = { shadows: !low, shadowSize: this.isTouch ? 1024 : 2048, palms: low ? 5 : 10, grass: low ? 150 : this.isTouch ? 450 : 800, ferns: low ? 30 : 90, bushes: low ? 20 : 45, flowers: low ? 12 : 40 };
    this.qualityStep = 0;
    if (low) { this.renderer.setPixelRatio(1); this.renderer.shadowMap.enabled = false; this.qualityStep = 2; this.liteFromStart = true; }
    this.ui = new UI(PARTNERS);
    this.audio = new AudioFX();
    this.input = new Input(document.getElementById('app'));
    this.state = 'loading';
    this.levelIndex = 0;
    this.attempt = 0;
    this.score = 0;
    this.hiscore = Number(lsGet('pipemana.hiscore') || 0);
    this.lives = 3;
    this.clock = new THREE.Clock();
    this.frameTimes = [];
    this.elapsed = 0;
    this.textures = {};
    this.__THREE = THREE; // exposé pour les tests automatisés (window.__game)
    this._bindUI();
  }

  // ------------------------------------------------------------ CHARGEMENT
  async load() {
    this.cardTex = await loadImageTexture('assets/carte-2026.webp').catch(() => null);
    await this._buildLevel(0);
    for (const img of document.querySelectorAll('img[data-partner]')) { const pr = PARTNERS[img.dataset.partner]; if (pr) img.src = partnerLogoUrl(pr); }
    this.ui.setHiScore(this.hiscore);
    this.ui.setLives(this.lives);
    this.ui.setScore(0);
    this.ui.setSound(!this.audio.muted);
    this.ui.setLaunchVisible(false);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.state = 'title';
    this.rig.lift = 1; this.rig.yaw = -0.35; this.rig.setOrbit(true);
    this.ui.showScreen('screen-title');
    this.renderer.setAnimationLoop(() => this._frame());
    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('off'); setTimeout(() => loader.remove(), 500); }
  }

  async _buildLevel(index) {
    this.levelIndex = index;
    const level = LEVELS[index];
    this.level = level;
    this.net = new Network(level);
    const ids = new Set(Object.values(level.signs));
    const logoTextures = { __partners: PARTNERS };
    await Promise.all([...ids].map(async (id) => { if (!this.textures[id]) this.textures[id] = await partnerTexture(PARTNERS[id]); logoTextures[id] = this.textures[id]; }));
    if (this.world) this._disposeWorld();
    this.world = new World({ net: this.net, level, theme: THEME, logoTextures, cardTexture: this.cardTex, quality: this.quality, renderer: this.renderer });
    if (this.liteFromStart || this.qualityStep >= 2) this.world.setLite(true);
    if (this.qualityStep >= 1) this.world.sun.castShadow = false;
    this.scene = this.world.scene;
    this.rig = new CameraRig(this.net, this.renderer);
    this.rig.signPoints = () => this.world.signPoints();
    this.rig.onLayout = (offset) => this.world.layoutSigns(offset);
    this._applyInsets();
    this.rig.resize();
    this.ui.setPartners(['A', 'B', 'C', 'D'].map((k) => level.signs[k]));
    this.ui.setLevel(level.name);
    if (this.ui.el.levelName) this.ui.el.levelName.textContent = `${level.name} · ${level.subtitle}`;
    const prize = document.getElementById('title-prize');
    if (prize) { prize.textContent = level.prize || ''; prize.hidden = !level.prize; }
    this.cursorCell = this.net.pipes[Math.floor(this.net.pipes.length / 2)];
  }
  _disposeWorld() {
    gsap.globalTimeline.getChildren(true, true, false).forEach((t) => { if (t.targets && t.targets().some((o) => o && o.isObject3D)) t.kill(); });
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && m.map.dispose && !Object.values(this.textures).includes(m.map) && m.map !== this.cardTex) m.map.dispose(); m.dispose(); } }
    });
    this.renderer.renderLists.dispose();
  }

  _applyInsets() {
    this.rig.insets = { top: this.isTouch ? 62 : 72, bottom: this.isTouch ? 128 : 140, left: 8, right: 8 };
  }
  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this._applyInsets();
    this.rig.resize();
  }

  // ------------------------------------------------------------ INTERFACE
  _bindUI() {
    const playing = () => this.state === 'countdown' || this.state === 'flowing';
    this.input.enabled = playing;
    this.input.onTap = (px, py) => this._tapAt(px, py);
    this.input.onHover = (px, py) => this._hoverAt(px, py);
    this.input.onCursor = (dir) => this._moveCursor(dir);
    this.input.onPlace = () => { if (this.cursorCell) this._rotateAt(this.cursorCell); };
    this.input.onFast = (on) => { if (on && this.state === 'countdown') this.launch(); };
    this.input.onPause = () => this.togglePause();
    this.input.onAction = () => this._action(false);
    document.getElementById('btn-play').addEventListener('click', () => this._action(true));
    document.getElementById('btn-retry').addEventListener('click', () => this.newGame());
    document.getElementById('btn-next').addEventListener('click', () => this._nextLevel());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => { this.audio.init(); this.newGame(); });
    document.getElementById('btn-launch').addEventListener('click', () => this.launch());
    for (const b of document.querySelectorAll('.btn-draw')) b.addEventListener('click', () => this.openDraw());
    for (const a of document.querySelectorAll('.link-line a')) a.addEventListener('click', (e) => { e.preventDefault(); this.openSponsors(); });
    document.getElementById('lb-close').addEventListener('click', () => this.closeDraw());
    document.getElementById('lb-frame').addEventListener('load', () => { document.querySelector('.lb-loading').hidden = true; });
    window.addEventListener('message', (e) => { if (e.data && (e.data.type === 'pipemana:close' || e.data.type === 'pacmana:close')) this.closeDraw(); });
    document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') this.closeDraw(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !document.getElementById('lightbox').hidden) this.closeDraw(); });
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-sound').addEventListener('click', () => { this.audio.init(); this.audio.setMuted(!this.audio.muted); this.ui.setSound(!this.audio.muted); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && (this.state === 'countdown' || this.state === 'flowing')) this.togglePause(); });
  }

  _action(fromButton) {
    this.audio.init();
    if (this.state === 'title') { this.newGame(); return true; }
    if (this.state === 'gameover' && fromButton) { this.newGame(); return true; }
    if (this.state === 'win' && fromButton) { this._nextLevel(); return true; }
    if (this.state === 'paused') { this.togglePause(); return true; }
    return false;
  }

  openDraw() {
    const url = `${DRAW_URL}?score=${encodeURIComponent(this.score)}`;
    if (this.isEmbedded) { const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); return; }
    this.openLightbox(url, 'Participer au tirage');
  }
  openSponsors() {
    if (this.isEmbedded) { const a = document.createElement('a'); a.href = SPONSORS_URL; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); return; }
    this.openLightbox(SPONSORS_URL, 'Nos partenaires sponsors');
  }
  openLightbox(url, title) {
    const lb = document.getElementById('lightbox');
    const frame = document.getElementById('lb-frame');
    document.getElementById('lb-title').textContent = title;
    document.getElementById('lb-ext').href = url;
    document.querySelector('.lb-loading').hidden = false;
    if (frame.src !== url) frame.src = url;
    lb.hidden = false;
    document.getElementById('lb-close').focus();
  }
  closeDraw() { document.getElementById('lightbox').hidden = true; document.getElementById('lb-frame').src = 'about:blank'; }

  togglePause() {
    if (this.state === 'countdown' || this.state === 'flowing') {
      this.pausedFrom = this.state; this.state = 'paused'; this.ui.showScreen('screen-pause'); this.audio.setFlow(false); gsap.globalTimeline.pause();
    } else if (this.state === 'paused') {
      this.state = this.pausedFrom; this.ui.showScreen(null); this.clock.getDelta(); gsap.globalTimeline.resume();
    }
  }

  // ------------------------------------------------------------ PARTIE
  newGame() {
    this.score = 0; this.lives = 3; this.nextExtraLife = SCORE.extraLifeAt; this.attempt = 0;
    this.startHiscore = this.hiscore;
    this.ui.setScore(0); this.ui.setLives(this.lives);
    this.ui.setRecord('over', false); this.ui.setRecord('win', false);
    if (this.levelIndex !== 0) { this.state = 'loading'; this._buildLevel(0).then(() => { this._resize(); this._startLevel(); }); }
    else this._startLevel();
  }
  _nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) { this.state = 'loading'; this._buildLevel(this.levelIndex + 1).then(() => { this._resize(); this._startLevel(); }); }
    else this.newGame();
  }

  /** Début de niveau : mélange, plongée de caméra, tuyaux qui se posent, puis compte à rebours */
  _startLevel() {
    this.net.dry();
    this.net.scramble(this.level.seed + this.attempt * 101);
    for (const [cell, p] of this.world.pieces) p.group.rotation.y = -cell.rot * Math.PI / 2;
    this.world.dry();
    this.ui.resetPartners();
    this.rotations = 0;
    this.state = 'intro';
    this.ui.showScreen(null);
    this.rig.setOrbit(false);
    this.rig.dive();
    const dur = this.world.dropIn();
    this.audio.start();
    setTimeout(() => { if (this.state === 'intro') this._startRound(true); }, Math.max(2200, dur * 1000));
  }

  _startRound(first) {
    this.flow = new Flow(this.net);
    this.countdownTotal = first ? this.level.countdown : this.level.retryCountdown;
    this.countdown = this.countdownTotal;
    this.lastTick = Math.ceil(this.countdown);
    this.freezeTimer = 0;
    this.world.stopLeak();
    this.world.setTowerLevel(1);
    this.state = 'countdown';
    this.ui.setLaunchVisible(true);
    this.ui.message(first ? 'PRÊT ?' : 'ENCORE !', 'ready');
    setTimeout(() => { if (this.state === 'countdown') this.ui.message(null); }, 1400);
    if (first && this.isTouch && !lsGet('pipemana.hintSeen')) { this.ui.hint(true); lsSet('pipemana.hintSeen', '1'); this.hintShown = true; }
    this.clock.getDelta();
  }

  /** Lancer l'eau avant la fin du compte à rebours : bonus par seconde restante */
  launch() {
    if (this.state !== 'countdown') return;
    this.audio.init();
    const left = Math.floor(this.countdown);
    if (left > 0) { this._addScore(left * SCORE.earlyPerSec, this.world.worldPos(this.net.tower, 2.5), 'bonus'); }
    this.countdown = 0;
  }

  // ------------------------------------------------------------ ROTATION
  _cellAtScreen(px, py) { const p = this.rig.pointAt(px, py); return p ? worldToCell(this.net, p) : null; }
  _tapAt(px, py) { const cell = this._cellAtScreen(px, py); if (cell) { this.cursorCell = cell; this._rotateAt(cell); } }
  _hoverAt(px, py) {
    if (px === null || !(this.state === 'countdown' || this.state === 'flowing')) { this.world.highlight(null); return; }
    const cell = this._cellAtScreen(px, py);
    this.hoverCell = cell;
    if (cell && cell.kind === 'pipe') this.world.highlight(cell, this.net.canRotate(cell)); else this.world.highlight(null);
  }
  _moveCursor(dir) {
    const d = DIRS[dir];
    let c = this.cursorCell || this.net.pipes[0];
    for (let i = 1; i < Math.max(this.net.w, this.net.h); i++) { const n = this.net.cellAt(c.c + d.dc * i, c.r + d.dr * i); if (!n) break; if (n.kind === 'pipe') { c = n; break; } }
    this.cursorCell = c;
    this.world.highlight(c, this.net.canRotate(c));
  }
  _rotateAt(cell) {
    this.audio.init();
    if (!cell || cell.kind !== 'pipe') return;
    if (!this.net.canRotate(cell)) { this.world.shakePiece(cell); this.world.highlight(cell, false); this.audio.invalid(); buzz(30); return; }
    this.net.rotate(cell);
    this.world.rotatePiece(cell);
    this.rotations++;
    this.audio.rotate(); buzz(10);
    if (this.hintShown) { this.ui.hint(false); this.hintShown = false; }
    if (!this.isTouch) this.world.highlight(cell, this.net.canRotate(cell));
  }

  // ------------------------------------------------------------ BOUCLE
  _frame() {
    let raw = this.clock.getDelta();
    if (raw > 0.1) raw = 0.1;
    this._adaptQuality(raw);
    this.elapsed += raw;
    const t = this.elapsed;
    if (this.state === 'countdown') this._stepCountdown(raw);
    else if (this.state === 'flowing') this._stepFlow(raw);
    else if (this.state === 'leak') { this.leakTimer -= raw; if (this.leakTimer <= 0) this._afterLeak(); }
    else if (this.state === 'winning') { this.winTimer -= raw; if (this.winTimer <= 0) this._showWin(); }
    if (this.world) {
      this.world.update(t, raw);
      this.rig.update(raw);
      this.ui.updatePopups(raw, this.rig.camera, this.rig.w, this.rig.h);
      this.renderer.render(this.scene, this.rig.camera);
    }
  }

  _stepCountdown(dt) {
    this.countdown -= dt;
    this.world.setTowerLevel(this.countdown / this.countdownTotal);
    const left = Math.ceil(this.countdown);
    if (left !== this.lastTick) { this.lastTick = left; if (left <= 3 && left > 0) { this.ui.message(String(left), 'count'); this.audio.tick(); } }
    this.ui.setStatus(`L'eau part dans ${Math.max(0, left)} s`, left <= 3 ? 'urgent' : '', 'Touche un tuyau pour le faire pivoter');
    if (this.countdown <= 0) {
      this.state = 'flowing';
      this.flow.start();
      this.ui.setLaunchVisible(false);
      this.ui.message("C'EST PARTI !", 'go');
      setTimeout(() => { if (this.state === 'flowing') this.ui.message(null); }, 1000);
      this.audio.go(); this.audio.setFlow(true, 1);
      this.rig.punch(1.04, 0.5);
    }
  }

  _stepFlow(dt) {
    if (this.freezeTimer > 0) { this.freezeTimer -= dt; this.ui.setStatus(`Carte BIG CE : l'eau fait une pause ${Math.ceil(this.freezeTimer)} s`, 'freeze', ''); }
    else this.ui.setStatus(`L'eau coule · enseignes ${this.net.fedCount} / ${this.net.signs.length}`, 'flow', 'Les tuyaux secs peuvent encore pivoter');
    const rate = this.freezeTimer > 0 ? 0 : 1;
    this.audio.setFlow(rate > 0, 1);
    const prev = this.flow.fronts.slice();
    const events = this.flow.advance(dt * rate, this.level.cellsPerSec);
    for (const f of prev) this.world.setArmFill(f.cell, f.side, f.dir, f.p);
    for (const f of this.flow.fronts) this.world.setArmFill(f.cell, f.side, f.dir, f.p);
    this.world.setFronts(this.flow.fronts);
    for (const ev of events) { this._onFlowEvent(ev); if (this.state !== 'flowing') break; }
  }

  _onFlowEvent(ev) {
    switch (ev.type) {
      case 'hub':
        this._addScore(SCORE.pipe, null);
        this.world.wetHub(ev.cell);
        this.audio.enterPipe();
        break;
      case 'gold':
        this._addScore(SCORE.gold, this.world.worldPos(ev.cell, 1), 'bonus');
        this.freezeTimer = FREEZE_TIME;
        this.world.cardTaken();
        this.ui.burst({ name: 'Carte BIG CE' }, { card: true, tag: 'CARTE BIG CE', sub: "+500 · l'eau fait une pause" });
        this.ui.flash('white');
        this.audio.card(); buzz([20, 30, 20, 30, 80]);
        break;
      case 'sign': {
        const partner = PARTNERS[ev.cell.partnerId];
        this._addScore(SCORE.sign, this.world.worldPos(ev.cell, 1.2), 'bonus');
        this.world.feedSign(ev.cell);
        this.ui.setPartnerState('ABCD'.indexOf(ev.cell.sign), true);
        this.ui.burst(partner, { tag: 'ENSEIGNE ALIMENTÉE', sub: `+${SCORE.sign}` });
        this.ui.flash('gold');
        this.rig.punch(1.07, 0.45);
        this.audio.mana(); buzz([30, 40, 60]);
        if (this.net.fedCount >= this.net.signs.length) this._win();
        break;
      }
      case 'leak':
        this.world.leakAt(ev.cell, ev.side);
        this._leak('Fuite ! Un tuyau donnait sur le vide');
        break;
      case 'done':
        if (this.net.fedCount < this.net.signs.length) this._leak("L'eau n'arrive pas à toutes les enseignes");
        break;
    }
  }

  _addScore(pts, worldPos, cls = '') {
    this.score += pts;
    this.ui.setScore(this.score);
    if (worldPos) this.ui.popup(`+${pts}`, worldPos, cls);
    if (this.score > this.hiscore) { this.hiscore = this.score; lsSet('pipemana.hiscore', String(this.hiscore)); this.ui.setHiScore(this.hiscore); }
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += SCORE.extraLifeAt;
      this.lives++; this.ui.setLives(this.lives);
      this.ui.message('VIE BONUS !', 'go'); setTimeout(() => { if (this.state === 'flowing') this.ui.message(null); }, 1200);
      this.audio.extraLife();
    }
  }

  // ------------------------------------------------------------ FUITE / VICTOIRE
  _leak(reason) {
    this.state = 'leak';
    this.leakTimer = 1.9;
    this.lives--;
    this.ui.setLives(this.lives);
    this.ui.setStatus(reason, 'urgent', '');
    this.ui.message('FUITE !', 'bad');
    this.ui.flash('red');
    this.rig.shake = 0.45;
    this.world.setFronts([]);
    this.world.highlight(null);
    this.audio.setFlow(false);
    this.audio.leak(); buzz([80, 40, 120]);
  }
  _afterLeak() {
    this.world.stopLeak();
    this.ui.message(null);
    if (this.lives <= 0) {
      this.state = 'gameover';
      document.getElementById('over-score').textContent = this.score;
      this.ui.setRecord('over', this.score > 0 && this.score >= this.hiscore && this.hiscore > this.startHiscore);
      this.ui.showScreen('screen-over');
      this.rig.setOrbit(true);
      this.audio.gameOver();
      return;
    }
    // les tuyaux gardent leur orientation : seule l'eau est vidée
    this.net.dry();
    this.world.dry();
    this._startRound(false);
  }

  _win() {
    this.state = 'winning';
    this.winTimer = 2.4;
    this.world.setFronts([]);
    this.world.highlight(null);
    this.ui.message('RÉSEAU<br>COMPLET !', 'win');
    this.ui.setStatus('Les 4 enseignes sont alimentées !', 'flow', '');
    this.ui.setLaunchVisible(false);
    this.audio.setFlow(false);
    this.audio.levelWin(); buzz([40, 30, 40, 30, 120]);
    this.ui.confetti(70);
    this.rig.punch(1.1, 1.2);
  }
  _showWin() {
    this.state = 'win';
    this.ui.message(null);
    this._addScore(SCORE.level, null);
    document.getElementById('win-score').textContent = this.score;
    document.getElementById('win-title').innerHTML = `${this.level.name.toUpperCase()}<br>TERMINÉ`;
    const last = this.levelIndex + 1 >= LEVELS.length;
    document.getElementById('btn-next').textContent = last ? 'REJOUER' : 'NIVEAU SUIVANT';
    document.getElementById('win-help').textContent = `${this.rotations} rotation${this.rotations > 1 ? 's' : ''} · ` + (last ? 'Bravo, tous les niveaux sont terminés !' : `Prochaine étape : ${LEVELS[this.levelIndex + 1].subtitle}`);
    this.ui.setRecord('win', this.score >= this.hiscore && this.hiscore > this.startHiscore);
    this.ui.showScreen('screen-win');
    this.rig.setOrbit(true);
  }

  _adaptQuality(raw) {
    if (this.qualityStep >= 2 || !(this.state === 'countdown' || this.state === 'flowing')) return;
    this.frameTimes.push(raw);
    if (this.frameTimes.length < 60) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.frameTimes.length = 0;
    if (median <= 0.021) return;
    this.qualityStep++;
    if (this.qualityStep === 1) { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); this.renderer.shadowMap.enabled = false; this.world.sun.castShadow = false; }
    else { this.renderer.setPixelRatio(1); this.world.setLite(true); }
    this._resize();
  }
}
