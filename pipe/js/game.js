// ---------------------------------------------------------------------------
//  GAME : boucle, états, règles (pose des tuyaux, eau, quota, Manas, Carte BIG CE, vies, niveaux)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, THEMES, PARTNERS, MAIN_PARTNER } from './levels.js';
import { PieceQueue, DIRS, PIECES } from './pieces.js';
import { Board, Flow } from './board.js';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { AudioFX, lsGet, lsSet } from './audio.js';
import { UI } from './ui.js';
import { partnerTexture, loadImageTexture, partnerLogoUrl } from './textures.js';

const SCORE = { pipe: 100, fastBonus: 100, cross: 200, mana: 300, card: 500, replace: -50, level: 1000, allManas: 1000, extraLifeAt: 6000 };
const FAST_RATE = 5;          // accélération de l'eau (bouton / touche F)
const SLOW_TIME = 8;          // effet Mana : l'eau ralentit de moitié pendant N s
const FREEZE_TIME = 5;        // effet Carte BIG CE : l'eau est gelée N s
const DRAW_URL = 'https://formulaire.big-ce.com/pipemana'; // formulaire du tirage au sort (à créer)
const SPONSORS_URL = 'https://www.guide2026.big-ce.com/PacMana/sponsors';
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* indisponible */ } };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    // WebView d'application / page intégrée (iframe) : profil allégé d'office
    const ua = navigator.userAgent || '';
    this.isEmbedded = /\bwv\b/.test(ua) || (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)) || window.self !== window.top || matchMedia('(display-mode: standalone)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isEmbedded ? 1 : this.isTouch ? 1.5 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.isEmbedded, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = !this.isEmbedded;
    this.renderer.shadowMap.type = this.isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const q = new URLSearchParams(location.search).get('q');
    const low = q === 'low' || (this.isEmbedded && q !== 'high');
    this.quality = { shadows: !low, shadowSize: this.isTouch ? 1024 : 2048, palms: low ? 4 : 6, flowers: low ? 8 : this.isTouch ? 18 : 30 };
    this.qualityStep = 0;
    if (low) { this.renderer.setPixelRatio(1); this.renderer.shadowMap.enabled = false; this.qualityStep = 2; this.liteFromStart = true; }
    this.ui = new UI(PARTNERS);
    this.audio = new AudioFX();
    this.input = new Input(document.getElementById('app'));
    this.state = 'loading';
    this.levelIndex = 0;
    this.score = 0;
    this.hiscore = Number(lsGet('pipemana.hiscore') || 0);
    this.lives = 3;
    this.fast = false;
    this.clock = new THREE.Clock();
    this.frameTimes = [];
    this.elapsed = 0;
    this.textures = {};
    this.__THREE = THREE; this.__pieces = { PIECES }; // exposés pour les tests automatisés (window.__game)
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
    this.ui.setFastVisible(false);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.state = 'title';
    this.ui.showScreen('screen-title');
    this.renderer.setAnimationLoop(() => this._frame());
    const loader = document.getElementById('loader');
    if (loader) { loader.classList.add('off'); setTimeout(() => loader.remove(), 500); }
  }

  /** Construit plateau + scène 3D du niveau demandé (la scène précédente est libérée) */
  async _buildLevel(index) {
    this.levelIndex = index;
    const level = LEVELS[index];
    const theme = THEMES[level.theme];
    this.level = level; this.theme = theme;
    this.board = new Board(level);
    const ids = new Set([...level.mana, MAIN_PARTNER]);
    const logoTextures = { __partners: PARTNERS };
    await Promise.all([...ids].map(async (id) => { if (!this.textures[id]) this.textures[id] = await partnerTexture(PARTNERS[id]); logoTextures[id] = this.textures[id]; }));
    logoTextures.__main = logoTextures[MAIN_PARTNER];
    if (this.world) this._disposeWorld();
    this.world = new World({ board: this.board, level, theme, logoTextures, cardTexture: this.cardTex, quality: this.quality });
    if (this.liteFromStart || this.qualityStep >= 2) this.world.setLite(true);
    if (this.qualityStep >= 1) this.world.sun.castShadow = false;
    this.scene = this.world.scene;
    this.rig = new CameraRig(this.board, this.renderer);
    this._applyInsets();
    this.rig.resize();
    this.ui.setPartners(level.mana);
    this.ui.setLevel(level.name);
    if (this.ui.el.levelName) this.ui.el.levelName.textContent = `${level.name} · ${level.subtitle}`;
    const prize = document.getElementById('title-prize');
    if (prize) { prize.textContent = level.prize || ''; prize.hidden = !level.prize; }
    this.cursorCell = this.board.cellAt(Math.floor(this.board.w / 2), Math.floor(this.board.h / 2));
  }
  _disposeWorld() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && m.map.dispose && !Object.values(this.textures).includes(m.map) && m.map !== this.cardTex) m.map.dispose(); m.dispose(); } }
    });
    this.renderer.renderLists.dispose();
  }

  /** Zones réservées au HUD (file des pièces à gauche, barre d'état et partenaires en bas) */
  _applyInsets() {
    const portrait = window.innerHeight > window.innerWidth;
    this.rig.insets = { top: this.isTouch ? 60 : 68, bottom: this.isTouch ? 118 : 128, left: portrait ? 76 : 96, right: 8 };
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
    const placing = () => this.state === 'countdown' || this.state === 'flowing';
    this.input.enabled = placing;
    this.input.onTap = (px, py) => this._tapAt(px, py);
    this.input.onHover = (px, py) => this._hoverAt(px, py);
    this.input.onCursor = (dir) => this._moveCursor(dir);
    this.input.onPlace = () => { if (this.cursorCell) this._placeAt(this.cursorCell); };
    this.input.onFast = (on) => this.setFast(on);
    this.input.onPause = () => this.togglePause();
    this.input.onAction = () => this._action(false);
    document.getElementById('btn-play').addEventListener('click', () => this._action(true));
    document.getElementById('btn-retry').addEventListener('click', () => this.newGame());
    document.getElementById('btn-next').addEventListener('click', () => this._nextLevel());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => { this.audio.init(); this.newGame(); });
    const fast = document.getElementById('btn-fast');
    fast.addEventListener('pointerdown', (e) => { e.preventDefault(); this.setFast(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) fast.addEventListener(ev, () => this.setFast(false));
    // tirage au sort et partenaires sponsors : lightbox par-dessus le jeu (la partie reste en pause)
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

  /** Entrée / Espace / bouton : renvoie true si l'action a été consommée par un écran */
  _action(fromButton) {
    this.audio.init();
    if (this.state === 'title') { this.newGame(); return true; }
    if ((this.state === 'gameover') && fromButton) { this.newGame(); return true; }
    if (this.state === 'win' && fromButton) { this._nextLevel(); return true; }
    if (this.state === 'paused') { this.togglePause(); return true; }
    return false;
  }

  openDraw() {
    const url = `${DRAW_URL}?score=${encodeURIComponent(this.score)}`;
    if (this.isEmbedded) {
      // WebView d'application : le cadre intégré serait intercepté => lien direct, l'app ouvre son navigateur
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      return;
    }
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
  closeDraw() {
    document.getElementById('lightbox').hidden = true;
    document.getElementById('lb-frame').src = 'about:blank';
  }

  togglePause() {
    if (this.state === 'countdown' || this.state === 'flowing') {
      this.pausedFrom = this.state; this.state = 'paused'; this.ui.showScreen('screen-pause'); this.audio.setFlow(false); this.setFast(false);
    } else if (this.state === 'paused') {
      this.state = this.pausedFrom; this.ui.showScreen(null); this.clock.getDelta();
    }
  }

  setFast(on) {
    if (this.fast === on) return;
    this.fast = on;
    this.ui.setFast(on);
  }

  // ------------------------------------------------------------ PARTIE
  newGame() {
    this.score = 0; this.lives = 3; this.nextExtraLife = SCORE.extraLifeAt;
    this.startHiscore = this.hiscore;
    this.ui.setScore(0); this.ui.setLives(this.lives);
    this.ui.setRecord('over', false); this.ui.setRecord('win', false);
    if (this.levelIndex !== 0) {
      this.state = 'loading';
      this._buildLevel(0).then(() => { this._resize(); this._startLevel(); });
    } else this._startLevel();
  }
  _nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) {
      this.state = 'loading';
      this._buildLevel(this.levelIndex + 1).then(() => { this._resize(); this._startLevel(); });
    } else this.newGame();
  }

  _startLevel() {
    this.board.reset();
    this.world.resetWater();
    this.world.setReservoirOpen(false);
    this.ui.resetPartners();
    this.collected = new Set();
    this.placed = 0;
    this.cardsGiven = 0;
    this.queue = new PieceQueue(5);
    this.ui.setQueue(this.queue.items);
    this._startRound(true);
  }

  /** Nouvelle manche : compte à rebours, puis l'eau part. first = début de niveau ; sinon reprise après fuite */
  _startRound(first) {
    this.ui.showScreen(null);
    this.flow = new Flow(this.board);
    this.countdown = this.level.countdown;
    this.lastTick = Math.ceil(this.countdown);
    this.slowTimer = 0; this.freezeTimer = 0;
    this.reservoirOpen = false;
    this.world.setReservoirOpen(false);
    this.world.stopLeak();
    this.world.fountain(false);
    this.state = 'countdown';
    this.ui.setQuota(0, this.level.quota, false);
    this.ui.setFastVisible(false);
    this.ui.message(first ? 'PRÊT ?' : 'ENCORE !', 'ready');
    setTimeout(() => { if (this.state === 'countdown') this.ui.message(null); }, 1500);
    if (first && this.isTouch && !lsGet('pipemana.hintSeen')) { this.ui.hint(true); lsSet('pipemana.hintSeen', '1'); this.hintShown = true; }
    if (first) this.audio.start();
    this.clock.getDelta();
  }

  // ------------------------------------------------------------ POSE DES TUYAUX
  _cellAtScreen(px, py) {
    const p = this.rig.groundAt(px, py);
    return p ? this.board.fromWorld(p.x, p.z) : null;
  }
  _tapAt(px, py) {
    const cell = this._cellAtScreen(px, py);
    if (!cell) return;
    this.cursorCell = cell;
    this._placeAt(cell);
  }
  _hoverAt(px, py) {
    if (px === null || !(this.state === 'countdown' || this.state === 'flowing')) { this.world.setCursor(null); this.world.setPreview(null); return; }
    const cell = this._cellAtScreen(px, py);
    this.hoverCell = cell;
    this._showCursor(cell);
  }
  _showCursor(cell) {
    if (!cell) { this.world.setCursor(null); this.world.setPreview(null); return; }
    const ok = this.board.canPlace(cell);
    this.world.setCursor(cell, ok);
    this.world.setPreview(ok ? cell : null, this.queue.next.piece);
  }
  _moveCursor(dir) {
    const d = DIRS[dir];
    const c = this.cursorCell || this.board.cellAt(0, 0);
    const n = this.board.cellAt(c.c + d.dc, c.r + d.dr);
    if (n) this.cursorCell = n;
    this._showCursor(this.cursorCell);
  }
  _placeAt(cell) {
    this.audio.init();
    if (!this.board.canPlace(cell)) {
      this.audio.invalid(); buzz(30);
      this.world.setCursor(cell, false);
      return;
    }
    const item = this.queue.pop();
    const replaced = this.board.place(cell, item);
    this.world.setPiece(cell, item);
    if (replaced) {
      this.score = Math.max(0, this.score + SCORE.replace);
      this.ui.setScore(this.score);
      this.ui.popup(`${SCORE.replace}`, this.world.worldPos(cell), 'bad');
      this.audio.replace();
    } else this.audio.place();
    buzz(12);
    this.placed++;
    if (this.hintShown) { this.ui.hint(false); this.hintShown = false; }
    // la Carte BIG CE rejoint la file après N pièces posées
    if (this.cardsGiven < this.level.cardAt.length && this.placed >= this.level.cardAt[this.cardsGiven]) { this.queue.inject('card'); this.cardsGiven++; }
    this.ui.setQueue(this.queue.items);
    this._showCursor(this.isTouch ? null : (this.hoverCell || cell));
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
    else if (this.state === 'winning') {
      this.winTimer -= raw;
      this.world.reservoirFill(1 - Math.max(0, this.winTimer) / 1.8);
      if (this.winTimer <= 0) this._showWin();
    }

    if (this.world) {
      this.world.update(t, raw);
      this.rig.update(raw);
      this.ui.updatePopups(raw, this.rig.camera, this.rig.w, this.rig.h);
      this.renderer.render(this.scene, this.rig.camera);
    }
  }

  _stepCountdown(dt) {
    this.countdown -= dt;
    this.world.sourceGauge(1 - this.countdown / this.level.countdown);
    const left = Math.ceil(this.countdown);
    if (left !== this.lastTick) {
      this.lastTick = left;
      if (left <= 3 && left > 0) { this.ui.message(String(left), 'count'); this.audio.tick(); }
    }
    this.ui.setStatus(`L'eau arrive dans ${Math.max(0, left)} s`, left <= 3 ? 'urgent' : '');
    if (this.countdown <= 0) {
      this.state = 'flowing';
      this.flow.start();
      this.world.sourceGauge(null);
      this.ui.message("C'EST PARTI !", 'go');
      setTimeout(() => { if (this.state === 'flowing') this.ui.message(null); }, 1100);
      this.ui.setStatus("L'eau coule !", 'flow');
      this.ui.setFastVisible(true);
      this.audio.go();
      this.audio.setFlow(true, 1);
    }
  }

  _stepFlow(dt) {
    const L = this.level;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.freezeTimer > 0) { this.freezeTimer -= dt; this.ui.setStatus(`Eau gelée ${Math.ceil(this.freezeTimer)} s`, 'freeze'); }
    else if (this.slowTimer > 0) this.ui.setStatus(`Mana : l'eau ralentit ${Math.ceil(this.slowTimer)} s`, 'slow');
    else this.ui.setStatus(this.fast ? 'Accélération ×' + FAST_RATE : "L'eau coule !", 'flow');
    let rate = (this.fast ? FAST_RATE : 1) * (this.slowTimer > 0 ? 0.5 : 1);
    if (this.freezeTimer > 0) rate = 0;
    this.audio.setFlow(rate > 0, Math.max(0.5, rate));
    const events = this.flow.advance((dt / L.secPerCell) * rate);
    for (const ev of events) this._onFlowEvent(ev);
    if (this.flow.head) { const h = this.flow.head; this.world.setFill(h.cell, h.chan, h.enter, h.progress); }
  }

  _onFlowEvent(ev) {
    const pos = (cell) => this.world.worldPos(cell);
    switch (ev.type) {
      case 'enter': {
        this.world.setFill(ev.cell, ev.chan, ev.enter, 0);
        const pts = SCORE.pipe + (this.fast ? SCORE.fastBonus : 0);
        this._addScore(pts, pos(ev.cell), this.fast ? 'bonus' : '');
        this.audio.enterPipe();
        this.ui.setQuota(this.flow.filled, this.level.quota, this.reservoirOpen);
        if (!this.reservoirOpen && this.flow.filled >= this.level.quota) {
          this.reservoirOpen = true;
          this.world.setReservoirOpen(true);
          this.ui.setQuota(this.flow.filled, this.level.quota, true);
          this.ui.message('RÉSERVOIR<br>OUVERT !', 'go');
          setTimeout(() => { if (this.state === 'flowing') this.ui.message(null); }, 1400);
          this.audio.cross();
        }
        break;
      }
      case 'cross': this._addScore(SCORE.cross, pos(ev.cell), 'bonus'); this.audio.cross(); break;
      case 'mana': {
        const partner = PARTNERS[ev.cell.manaId];
        this._addScore(SCORE.mana, pos(ev.cell), 'bonus');
        this.slowTimer = SLOW_TIME;
        this.world.manaLit(ev.cell);
        this.collected.add(ev.cell);
        this.ui.setPartnerState(ev.cell.manaId, true);
        this.ui.manaBurst(partner);
        this.ui.flash('gold');
        this.audio.mana(); buzz([30, 40, 60]);
        break;
      }
      case 'card': {
        this._addScore(SCORE.card, pos(ev.cell), 'bonus');
        this.freezeTimer = FREEZE_TIME;
        this.world.cardTaken(ev.cell);
        this.ui.manaBurst({ name: 'Carte BIG CE' }, { card: true, tag: 'GEL', sub: "L'eau s'arrête 5 s !" });
        this.ui.flash('white');
        this.audio.card(); buzz([20, 30, 20, 30, 80]);
        break;
      }
      case 'reservoir': {
        if (this.reservoirOpen) this._win();
        else { this.world.leakAt(ev.cell, ev.enter); this._leak('Réservoir fermé : il manquait des tuyaux !'); }
        break;
      }
      case 'leak': this.world.leakAt(ev.cell, ev.side); this._leak('Fuite !'); break;
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
    this.leakTimer = 1.7;
    this.lives--;
    this.ui.setLives(this.lives);
    this.ui.setFastVisible(false); this.setFast(false);
    this.ui.setStatus(reason, 'urgent');
    this.ui.message('FUITE !', 'bad');
    this.ui.flash('red');
    this.rig.shake = 0.5;
    this.world.front.visible = false;
    this.world.setCursor(null); this.world.setPreview(null);
    this.audio.setFlow(false);
    this.audio.leak(); buzz([80, 40, 120]);
  }
  _afterLeak() {
    this.world.stopLeak();
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.ui.message(null);
      document.getElementById('over-score').textContent = this.score;
      this.ui.setRecord('over', this.score > 0 && this.score >= this.hiscore && this.hiscore > this.startHiscore);
      this.ui.showScreen('screen-over');
      this.audio.gameOver();
      return;
    }
    // on garde les tuyaux posés : seule l'eau est vidée
    this.board.drain();
    this.world.resetWater();
    this._startRound(false);
  }

  _win() {
    this.state = 'winning';
    this.winTimer = 1.8;
    this.ui.setFastVisible(false); this.setFast(false);
    this.world.front.visible = false;
    this.world.fountain(true);
    this.world.setCursor(null); this.world.setPreview(null);
    this.ui.message('NIVEAU<br>TERMINÉ !', 'win');
    this.ui.setStatus("L'eau est arrivée !", 'flow');
    this.audio.setFlow(false);
    this.audio.levelWin(); buzz([40, 30, 40, 30, 120]);
    this.ui.confetti(70);
  }
  _showWin() {
    this.state = 'win';
    this.world.fountain(false);
    this.ui.message(null);
    this._addScore(SCORE.level, null);
    const all = this.collected.size >= this.board.manas.length;
    if (all) this._addScore(SCORE.allManas, null);
    document.getElementById('win-score').textContent = this.score;
    document.getElementById('win-title').innerHTML = `${this.level.name.toUpperCase()}<br>TERMINÉ`;
    const last = this.levelIndex + 1 >= LEVELS.length;
    document.getElementById('btn-next').textContent = last ? 'REJOUER' : 'NIVEAU SUIVANT';
    document.getElementById('win-help').textContent = all ? 'Tous les Manas traversés : +1000 ! Māuruuru !' : (last ? 'Bravo, tous les niveaux sont terminés !' : `Prochaine étape : ${LEVELS[this.levelIndex + 1].subtitle}`);
    this.ui.setRecord('win', this.score >= this.hiscore && this.hiscore > this.startHiscore);
    this.ui.showScreen('screen-win');
  }

  /** Baisse automatique de la qualité si le jeu rame (2 paliers), mesurée sur ~1 s de jeu */
  _adaptQuality(raw) {
    if (this.qualityStep >= 2 || !(this.state === 'countdown' || this.state === 'flowing')) return;
    this.frameTimes.push(raw);
    if (this.frameTimes.length < 60) return;
    const sorted = this.frameTimes.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    this.frameTimes.length = 0;
    if (median <= 0.021) return;
    this.qualityStep++;
    if (this.qualityStep === 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = false;
      this.world.sun.castShadow = false;
    } else {
      this.renderer.setPixelRatio(1);
      this.world.setLite(true);
    }
    this._resize();
  }
}
