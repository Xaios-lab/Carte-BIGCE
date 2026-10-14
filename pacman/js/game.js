// ---------------------------------------------------------------------------
//  GAME : boucle, états, règles (points, Mana, collisions, vies, niveau)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { LEVELS, THEMES, PARTNERS } from './levels.js';
import { Maze, DIRS } from './maze.js';
import { World } from './world.js';
import { Pacman, Ghost, GHOST_DEFS } from './actors.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { AudioFX, lsGet, lsSet } from './audio.js';
import { UI } from './ui.js';
import { loadImageTexture, glowTexture } from './textures.js';

const SCORE = { dot: 10, mana: 50, ghost: [200, 400, 800, 1600], extraLifeAt: 10000 };
const DRAW_URL = 'https://formulaire.big-ce.com/pacmana'; // formulaire du tirage au sort
const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch { /* indisponible */ } };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isTouch ? 2 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(dpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    // ?q=low force la qualité réduite (vieux mobiles) ; sinon adaptation automatique
    const q = new URLSearchParams(location.search).get('q');
    const low = q === 'low';
    this.quality = {
      shadows: !low,
      shadowSize: this.isTouch ? 1024 : 2048,
      leaves: low ? 50 : this.isTouch ? 90 : 150,
      fireflies: low ? 30 : this.isTouch ? 50 : 90,
      torchLights: low ? 1 : this.isTouch ? 2 : 4,
      flowers: low ? 25 : this.isTouch ? 40 : 60,
      fallingLeaves: low ? 10 : this.isTouch ? 18 : 30,
    };
    if (low) { this.renderer.setPixelRatio(1); this.renderer.shadowMap.enabled = false; this.lowQualityApplied = true; }
    this.ui = new UI(PARTNERS);
    this.audio = new AudioFX();
    this.input = new Input(document.getElementById('app'), document.getElementById('joystick'));
    this.state = 'loading';
    this.levelIndex = 0;
    this.score = 0;
    this.hiscore = Number(lsGet('pacmana.hiscore') || 0);
    this.lives = 3;
    this.timeScale = 1;
    this.clock = new THREE.Clock();
    this.frameTimes = [];
    this.lowQualityApplied = false;
    this.elapsed = 0;
    this._bindUI();
  }

  async load() {
    const level = LEVELS[this.levelIndex];
    const theme = THEMES[level.theme];
    this.level = level; this.theme = theme;
    this.maze = new Maze(level.maze, { specialRatio: level.specials ? level.specials.ratio : 0 });
    const logoTextures = { __partners: PARTNERS };
    await Promise.all(level.mana.map(async (id) => { logoTextures[id] = await loadImageTexture(PARTNERS[id].logo); }));
    this.cardTex = await loadImageTexture(level.bonus.image).catch(() => null);
    this.audio.loadMusic('assets/audio/poursuite-foret.m4a');
    this.world = new World({ maze: this.maze, level, theme, logoTextures, quality: this.quality });
    this.scene = this.world.scene;
    this.rig = new CameraRig(this.maze, this.renderer);
    this.rig.minCellPx = this.isTouch ? 31 : 28;
    this._applyInsets();
    this.rig.resize();

    this.pac = new Pacman(this.maze, theme);
    this.scene.add(this.pac.mesh);
    this.ghosts = GHOST_DEFS.map((d, i) => { const g = new Ghost(this.maze, d, i); this.scene.add(g.mesh); return g; });
    this.ghostByName = Object.fromEntries(this.ghosts.map((g) => [g.def.id, g]));

    // bonus "Carte BIG CE"
    this.bonus = this._makeBonus();
    this.scene.add(this.bonus.mesh);

    // effets 3D (onde de choc)
    this.fx = [];
    this.ringGeo = new THREE.RingGeometry(0.6, 0.8, 48).rotateX(-Math.PI / 2);
    this.sparkTex = glowTexture('rgba(255,240,180,1)', 'rgba(255,200,80,0)');

    this.ui.setPartners(level.mana);
    this.ui.setLevel(level.name);
    this.ui.setHiScore(this.hiscore);
    this.ui.setLives(this.lives);
    this.ui.setScore(0);
    this.ui.setSound(!this.audio.muted);
    if (this.ui.el.levelName) this.ui.el.levelName.textContent = `${level.name} · ${level.subtitle}`;
    const prize = document.getElementById('title-prize');
    if (prize) { prize.textContent = level.prize || ''; prize.hidden = !level.prize; }

    window.addEventListener('resize', () => this._resize());
    this._resize();
    this.state = 'title';
    this.ui.showScreen('screen-title');
    this.renderer.setAnimationLoop(() => this._frame());
  }

  /** Zones réservées au HUD pour le cadrage caméra */
  _applyInsets() {
    this.rig.insets = this.isTouch ? { top: 58, bottom: 70, left: 6, right: 6 } : { top: 66, bottom: 84, left: 6, right: 6 };
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    this._applyInsets();
    this.rig.resize();
  }

  _bindUI() {
    this.input.onDir = (d) => { if (this.state === 'playing' || this.state === 'ready') this.pac.setWant(d); };
    this.input.showJoystick = () => this.state === 'playing' || this.state === 'ready';
    this.input.onAction = () => this._action(false);
    this.input.onPause = () => this.togglePause();
    document.getElementById('btn-play').addEventListener('click', () => this._action(true));
    document.getElementById('btn-retry').addEventListener('click', () => this.newGame());
    document.getElementById('btn-next').addEventListener('click', () => this.newGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => { this.audio.init(); this.newGame(); });
    // tirage au sort : lightbox par-dessus le jeu
    for (const b of document.querySelectorAll('.btn-draw')) b.addEventListener('click', () => this.openDraw());
    document.getElementById('lb-close').addEventListener('click', () => this.closeDraw());
    document.getElementById('lb-frame').addEventListener('load', () => { document.querySelector('.lb-loading').hidden = true; });
    document.getElementById('lightbox').addEventListener('click', (e) => { if (e.target.id === 'lightbox') this.closeDraw(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && !document.getElementById('lightbox').hidden) this.closeDraw(); });
    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-sound').addEventListener('click', () => { this.audio.init(); this.audio.setMuted(!this.audio.muted); this.ui.setSound(!this.audio.muted); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'playing') this.togglePause(); });
  }

  _action(fromButton) {
    this.audio.init();
    if (this.state === 'title') this.newGame();
    else if ((this.state === 'gameover' || this.state === 'win') && fromButton) this.newGame();
    else if (this.state === 'paused') this.togglePause();
  }

  openDraw() {
    const lb = document.getElementById('lightbox');
    const url = `${DRAW_URL}?score=${encodeURIComponent(this.score)}`;
    const frame = document.getElementById('lb-frame');
    document.getElementById('lb-ext').href = url;
    document.querySelector('.lb-loading').hidden = false;
    if (frame.src !== url) frame.src = url;
    lb.hidden = false;
    document.getElementById('lb-close').focus();
  }
  closeDraw() {
    const lb = document.getElementById('lightbox');
    lb.hidden = true;
    document.getElementById('lb-frame').src = 'about:blank';
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.ui.showScreen('screen-pause'); this.audio.setLoop(null); this.audio.pauseMusic(); }
    else if (this.state === 'paused') { this.state = 'playing'; this.ui.showScreen(null); this.clock.getDelta(); this.audio.playMusic(); }
  }

  // ------------------------------------------------------------ PARTIE
  newGame() {
    this.score = 0; this.lives = 3; this.nextExtraLife = SCORE.extraLifeAt;
    this.startHiscore = this.hiscore;
    this.ui.setScore(0); this.ui.setLives(this.lives);
    this.world.resetDots(); this.world.resetManas(); this.world.setWallFlash(0);
    this.ui.resetPartners();
    this.dotsEaten = 0; this.dotsTotal = this.maze.dots.length;
    this.bonusIndex = 0; this.bonus.active = false; this.bonus.mesh.visible = false;
    this._startRound(true);
  }

  _startRound(first) {
    this.ui.showScreen(null);
    this.pac.reset(this.maze.pacStart);
    this.ghosts.forEach((g) => g.resetToHouse(this.maze.houseCenter, g.def.startsOutside, this.maze.houseExit));
    this.frightTimer = 0; this.freezeTimer = 0; this.ghostCombo = 0;
    this.modeIndex = 0; this.modeTimer = this.level.scatterChase[0]; this.mode = 'scatter';
    this.dotTimer = 0;
    this.readyTimer = first ? 2.4 : 1.6;
    this.state = 'ready';
    this.timeScale = 1;
    this.rig.target.set(0, 0, 0);
    this.ui.message(first ? 'PRÊT ?' : 'ENCORE !', 'ready');
    // aide au tout premier lancement sur tactile : "glisse pour diriger"
    if (first && this.isTouch && !lsGet('pacmana.hintSeen')) { this.ui.hint(true); lsSet('pacmana.hintSeen', '1'); this.hintShown = true; }
    if (first) { this.audio.start(); this.audio.playMusic(); }
    this.audio.setLoop(null);
    this.clock.getDelta();
  }

  _frame() {
    let raw = this.clock.getDelta();
    if (raw > 0.1) raw = 0.1;
    this._adaptQuality(raw);
    this.elapsed += raw;
    const t = this.elapsed;
    const dt = raw * this.timeScale;

    if (this.state === 'ready') {
      this.readyTimer -= raw;
      if (this.readyTimer <= 0) { this.state = 'playing'; this.ui.message(null); }
    }
    if (this.hintShown && this.state === 'playing' && this.pac.moving) { this.ui.hint(false); this.hintShown = false;
    } else if (this.state === 'playing') {
      this._step(dt);
    } else if (this.state === 'dying') {
      this.pac.update(dt);
      this.dieTimer -= dt;
      if (this.dieTimer <= 0) this._afterDeath();
    } else if (this.state === 'winning') {
      this.winTimer -= raw;
      const k = Math.max(0, Math.sin(this.winTimer * 9));
      this.world.setWallFlash(k);
      if (this.winTimer <= 0) this._showWin();
    }
    // retour progressif du ralenti (effet Mana)
    this.timeScale += (1 - this.timeScale) * (1 - Math.exp(-raw * 2.2));
    this.rig.zoomBoost += (0 - this.rig.zoomBoost) * (1 - Math.exp(-raw * 2));

    this.world.update(t, dt);
    this._updateFx(dt);
    if (this.bonus.active) this.bonus.update(t, dt);
    const focus = this.state === 'title' ? new THREE.Vector3(0, 0, 0) : this.pac.mesh.position;
    this.rig.update(raw, focus);
    this.ui.updatePopups(raw, this.rig.camera, this.rig.w, this.rig.h);
    this.renderer.render(this.scene, this.rig.camera);
  }

  _adaptQuality(raw) {
    if (this.lowQualityApplied) return;
    this.frameTimes.push(raw);
    if (this.frameTimes.length < 150) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.028 && this.state !== 'title') {
      // trop lent : on baisse la résolution et on coupe les ombres
      this.lowQualityApplied = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = false;
      this.world.sun.castShadow = false;
      this._resize();
    }
  }

  // ------------------------------------------------------------ SIMULATION
  _step(dt) {
    const L = this.level;
    // sous-pas fixes pour une physique stable
    const sub = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      this._simulate(h);
      if (this.state !== 'playing') return;
    }
    // sons de boucle
    if (this.ghosts.some((g) => g.state === 'eyes')) this.audio.setLoop('eyes');
    else if (this.frightTimer > 0 || this.freezeTimer > 0) this.audio.setLoop('fright');
    else this.audio.setLoop(this.audio.musicPlaying ? null : 'siren');
    this.audio.duck(this.frightTimer > 0 || this.freezeTimer > 0 ? 0.55 : 1);
    void L;
  }

  _simulate(dt) {
    const L = this.level, maze = this.maze;
    // --- gel (carte BIG CE)
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.freezeTimer = 0;
        this.ghosts.forEach((g) => g.setFrozen(false));
        if (this.frightTimer <= 0) { this.pac.powered = false; this.ghostCombo = 0; }
      }
    }
    // --- mode scatter/chase
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      const flash = this.frightTimer < 2 && Math.floor(this.frightTimer * 5) % 2 === 0;
      for (const g of this.ghosts) if (g.frightened && g.flash !== flash) { g.flash = flash; g.applyLook(); }
      if (this.frightTimer <= 0) {
        this.frightTimer = 0; this.ghostCombo = 0;
        this.ghosts.forEach((g) => g.setFrightened(false));
        if (this.freezeTimer <= 0) this.pac.powered = false;
      }
    } else {
      this.modeTimer -= dt;
      if (this.modeTimer <= 0 && this.modeIndex < L.scatterChase.length - 1) {
        this.modeIndex++;
        this.modeTimer = L.scatterChase[this.modeIndex];
        this.mode = this.modeIndex % 2 === 0 ? 'scatter' : 'chase';
        this.ghosts.forEach((g) => { if (g.state === 'active') g.forceReverse = true; });
      }
    }
    // --- Pac-Man
    const eating = this.pac.lastCell && this._dotAt(this.pac.cell) !== null;
    this.pac.update(dt, eating ? L.speeds.pacmanEating : L.speeds.pacman);
    const cell = this.pac.cell;
    if (!this.pac.lastCell || cell.c !== this.pac.lastCell.c || cell.r !== this.pac.lastCell.r) {
      this.pac.lastCell = cell;
      this._enterCell(cell);
    }
    // --- sortie des fantômes de la maison
    this.dotTimer += dt;
    for (const g of this.ghosts) {
      let release = false;
      if (g.state === 'house') {
        const need = L.ghostRelease[g.def.id] ?? 0;
        release = this.dotsEaten >= need || this.dotTimer > 7;
        if (release) this.dotTimer = 0;
      }
      g.update({ dt, speeds: L.speeds, mode: this.mode, pac: this.pac, blinky: this.ghostByName.blinky, frightTimer: this.frightTimer, houseCenter: maze.houseCenter, houseExit: maze.houseExit, release });
    }
    // --- collisions
    for (const g of this.ghosts) {
      const dx = Math.abs(g.x - this.pac.x), dz = Math.abs(g.z - this.pac.z);
      if (dx < 0.52 && dz < 0.52) {
        if (g.isEdible) this._eatGhost(g);
        else if (g.isDangerous) { this._die(); return; }
      }
    }
    // --- bonus
    if (this.bonus.active) {
      this.bonus.timer -= dt;
      if (this.bonus.timer <= 0) { this.bonus.active = false; this.bonus.mesh.visible = false; }
      else {
        const b = maze.bonusCell;
        if (Math.abs(this.pac.x - b.c) < 0.5 && Math.abs(this.pac.z - b.r) < 0.5) this._eatBonus();
      }
    }
  }

  _dotAt(cell) {
    const d = this.maze.dotAt(cell.c, cell.r);
    if (!d || this.world.dotState[d.idx] !== 0) return null;
    return d;
  }

  _enterCell(cell) {
    const d = this._dotAt(cell);
    if (d) {
      this.world.eatDot(d.idx);
      this.dotsEaten++;
      if (d.kind !== 'arrow') {
        const pts = this.level.specials[d.kind];
        this._addScore(pts);
        const w = this.maze.toWorld(d.c, d.r);
        this.ui.popup(`${d.kind === 'star' ? '★' : '◗'} +${pts}`, new THREE.Vector3(w.x, 0.3, w.z), 'bonus');
        this._sparks(new THREE.Vector3(w.x, 0.3, w.z), 10);
        this.audio.bonus();
      } else {
        this._addScore(SCORE.dot);
        this.audio.waka();
      }
      this.dotTimer = 0;
      const L = this.level;
      if (L.bonus && this.bonusIndex < L.bonus.at.length && this.dotsEaten >= L.bonus.at[this.bonusIndex]) {
        this.bonusIndex++;
        this._spawnBonus();
      }
      if (this.dotsEaten >= this.dotsTotal) this._levelComplete();
      return;
    }
    const mana = this.world.manas.find((m) => !m.eaten && m.cell.c === cell.c && m.cell.r === cell.r);
    if (mana) this._eatMana(mana);
  }

  /** Position écran de Pac-Man (0..1), pour placer les effets sans le masquer */
  _pacScreen() {
    const v = this.pac.mesh.position.clone().project(this.rig.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  _eatMana(mana) {
    this.world.eatMana(mana);
    this._addScore(SCORE.mana);
    this.frightTimer = this.level.frightenedTime;
    this.ghostCombo = 0;
    this.ghosts.forEach((g) => g.setFrightened(true));
    this.pac.powered = true;
    this.ui.setPartnerState(mana.partnerId, true);
    this.ui.manaBurst(mana.partner, { avoid: this._pacScreen() });
    this.ui.flash('gold');
    this.audio.eatMana();
    buzz(50);
    this.timeScale = 0.25;      // ralenti dramatique
    this.rig.zoomBoost = 0.08;  // léger zoom
    this.rig.shake = 0.25;
    const w = this.maze.toWorld(mana.cell.c, mana.cell.r);
    this._shockwave(new THREE.Vector3(w.x, 0.05, w.z), mana.partner.color === '#1b1b1b' ? 0x9ad8ff : mana.partner.color);
    this._sparks(new THREE.Vector3(w.x, 0.7, w.z), 40);
  }

  _eatGhost(g) {
    const pts = SCORE.ghost[Math.min(this.ghostCombo, 3)];
    this.ghostCombo++;
    this._addScore(pts);
    g.eaten();
    this.audio.eatGhost();
    buzz(30);
    this.ui.popup(String(pts), g.mesh.position, 'ghost');
    this._sparks(g.mesh.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 18);
    this.timeScale = 0.35;
    this.rig.shake = 0.18;
  }

  _spawnBonus() {
    const b = this.maze.bonusCell;
    const w = this.maze.toWorld(b.c, b.r);
    this.bonus.mesh.position.set(w.x, 0, w.z);
    this.bonus.mesh.visible = true;
    this.bonus.active = true;
    this.bonus.appear = 0;
    this.bonus.timer = this.level.bonus.duration;
    this.audio.bonus();
  }
  _eatBonus() {
    this.bonus.active = false; this.bonus.mesh.visible = false;
    this._addScore(this.level.bonus.score);
    // super-pouvoir : les esprits sont gelés et comestibles pendant quelques secondes
    this.freezeTimer = this.level.freezeTime;
    this.ghostCombo = 0;
    this.ghosts.forEach((g) => g.setFrozen(true));
    this.pac.powered = true;
    this.ui.manaBurst({ logo: this.level.bonus.image, name: this.level.bonus.label }, { card: true, tag: 'GEL !', sub: 'Les esprits sont figés : mange-les !', avoid: this._pacScreen() });
    this.ui.flash('white');
    this.audio.eatMana();
    this.timeScale = 0.3;
    this.rig.shake = 0.3;
    this._shockwave(this.bonus.mesh.position.clone().setY(0.05), 0x7fdcff);
    this._sparks(this.bonus.mesh.position.clone().setY(0.8), 40);
  }

  _addScore(n) {
    this.score += n;
    this.ui.setScore(this.score);
    if (this.score >= this.nextExtraLife) {
      this.nextExtraLife += SCORE.extraLifeAt;
      this.lives++;
      this.ui.setLives(this.lives);
      this.audio.extraLife();
      this.ui.popup('+1 VIE', this.pac.mesh.position, 'bonus');
    }
    if (this.score > this.hiscore) { this.hiscore = this.score; lsSet('pacmana.hiscore', String(this.hiscore)); this.ui.setHiScore(this.hiscore); }
  }

  _die() {
    this.state = 'dying';
    this.pac.dead = true; this.pac.deathT = 0;
    this.dieTimer = 1.9;
    this.audio.setLoop(null);
    this.audio.death();
    buzz([80, 40, 120]);
    this.rig.shake = 0.5;
    this.ui.flash('red');
    this.ghosts.forEach((g) => { g.mesh.visible = false; });
  }
  _afterDeath() {
    this.ghosts.forEach((g) => { g.mesh.visible = true; });
    this.lives--;
    this.ui.setLives(this.lives);
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.audio.setLoop(null);
      this.audio.stopMusic();
      document.getElementById('over-score').textContent = String(this.score);
      this.ui.setRecord('over', this.score > 0 && this.score >= this.hiscore && this.hiscore > this.startHiscore);
      this.ui.showScreen('screen-over');
      this.ui.message(null);
    } else {
      this._startRound(false);
    }
  }

  _levelComplete() {
    this.state = 'winning';
    this.winTimer = 2.4;
    this.audio.setLoop(null);
    this.audio.stopMusic();
    this.audio.levelWin();
    this.ui.message('NIVEAU TERMINÉ !', 'win');
    this.ui.confetti(70);
    this.bonus.active = false; this.bonus.mesh.visible = false;
    this.pac.moving = false;
  }
  _showWin() {
    this.state = 'win';
    this.world.setWallFlash(0);
    this.ui.message(null);
    document.getElementById('win-score').textContent = String(this.score);
    this.ui.setRecord('win', this.score >= this.hiscore && this.hiscore > this.startHiscore);
    this.ui.showScreen('screen-win');
  }

  // ------------------------------------------------------------ EFFETS 3D
  _shockwave(pos, color) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.position.copy(pos);
    this.scene.add(m);
    this.fx.push({ mesh: m, t: 0, life: 0.8, kind: 'ring' });
  }
  _sparks(pos, n) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 4;
      v.push(new THREE.Vector3(Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ map: this.sparkTex, size: 0.35, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: 0xffe9a0 });
    const pts = new THREE.Points(geo, mat);
    this.scene.add(pts);
    this.fx.push({ mesh: pts, t: 0, life: 0.9, kind: 'sparks', vel: v });
  }
  _updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { this.scene.remove(f.mesh); f.mesh.material.dispose(); if (f.kind === 'sparks') f.mesh.geometry.dispose(); this.fx.splice(i, 1); continue; }
      if (f.kind === 'ring') { const s = 1 + k * 7; f.mesh.scale.set(s, 1, s); f.mesh.material.opacity = 0.9 * (1 - k); }
      else {
        const a = f.mesh.geometry.attributes.position;
        for (let j = 0; j < f.vel.length; j++) {
          const vv = f.vel[j];
          vv.y -= 12 * dt;
          a.setXYZ(j, a.getX(j) + vv.x * dt, Math.max(0.05, a.getY(j) + vv.y * dt), a.getZ(j) + vv.z * dt);
        }
        a.needsUpdate = true;
        f.mesh.material.opacity = 1 - k;
      }
    }
  }

  _makeBonus() {
    const tex = this.cardTex;
    const g = new THREE.Group();
    // même présentation que les Manas : carte vue de face, flottante, sans rotation
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.96), new THREE.MeshStandardMaterial({ color: 0xf4d27a, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.89), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
    card.position.z = 0.01;
    const badge = new THREE.Group();
    badge.add(plate, card);
    badge.rotation.x = -THREE.MathUtils.degToRad(63);
    const spin = new THREE.Group();
    spin.add(badge);
    spin.position.y = 1.05;
    g.add(spin);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(190,240,255,1)', 'rgba(120,200,255,0)'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(3.2, 3.2, 1);
    halo.position.y = 1.05;
    g.add(halo);
    g.visible = false;
    const self = { mesh: g, active: false, timer: 0, appear: 1 };
    self.update = (t, dt) => {
      if (!g.visible) return;
      spin.position.y = 1.05 + Math.sin(t * 1.8) * 0.1;
      halo.material.opacity = 0.5 + 0.2 * Math.sin(t * 4);
      if (self.appear < 1) {
        self.appear = Math.min(1, self.appear + dt / 0.55);
        const e = 1 - Math.pow(1 - self.appear, 3);
        spin.rotation.y = Math.PI * 2 * (1 - e);
        const sc = 0.4 + 0.6 * e + Math.sin(self.appear * Math.PI) * 0.15;
        spin.scale.set(sc, sc, sc);
      }
      // clignote avant de disparaître
      g.visible = !(self.timer < 2.5 && Math.floor(self.timer * 6) % 2 === 0) || self.timer <= 0;
      if (self.timer < 2.5 && self.active) g.visible = Math.floor(self.timer * 6) % 2 === 0;
    };
    return self;
  }
}
