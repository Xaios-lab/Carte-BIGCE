// ---------------------------------------------------------------------------
//  AUDIO : tout est synthétisé en WebAudio (aucun fichier son)
// ---------------------------------------------------------------------------
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = localStorage.getItem('pacmana.muted') === '1';
    this.wakaFlip = false;
    this.loops = {};
    this.sirenLevel = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    this._ambient();
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('pacmana.muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05);
    if (this.music) this.music.muted = m;
  }

  // --- musique (fichier) : « Poursuite dans la forêt »
  loadMusic(url) {
    const a = new Audio();
    a.src = url; a.loop = true; a.preload = 'auto'; a.volume = this.musicVolume; a.muted = this.muted;
    this.music = a;
    this.musicPlaying = false;
  }
  get musicVolume() { return 0.55; }
  playMusic() {
    if (!this.music) return;
    const p = this.music.play();
    this.musicPlaying = true;
    if (p && p.catch) p.catch(() => { this.musicPlaying = false; });
  }
  pauseMusic() { if (this.music) { this.music.pause(); this.musicPlaying = false; } }
  stopMusic() { if (this.music) { this.music.pause(); this.music.currentTime = 0; this.musicPlaying = false; } }
  /** Baisse temporaire de la musique (mode Mana) : k dans [0,1] */
  duck(k) { if (this.music) this.music.volume += (this.musicVolume * k - this.music.volume) * 0.1; }

  _osc(type, freq, t0, dur, vol = 0.2, { attack = 0.005, release = 0.05, to = null, dest = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.setValueAtTime(vol, t0 + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }

  _noise(t0, dur, vol = 0.2, filterFreq = 1200) {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  // --- ambiance jungle : souffle de cascade + tambour pahu discret
  _ambient() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = c.createGain(); g.gain.value = 0.08;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.ambientGain = g;
  }

  waka() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wakaFlip = !this.wakaFlip;
    if (this.wakaFlip) this._osc('square', 420, t, 0.07, 0.07, { to: 640 });
    else this._osc('square', 640, t, 0.07, 0.07, { to: 380 });
  }

  eatMana() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [0, 0.08, 0.16, 0.24].forEach((o, i) => this._osc('triangle', 330 * Math.pow(1.26, i), t + o, 0.2, 0.18));
    this._osc('sine', 110, t, 0.6, 0.25, { to: 55 });
    this._noise(t, 0.5, 0.15, 3000);
  }

  eatGhost() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._osc('sawtooth', 200, t, 0.35, 0.15, { to: 1400 });
    this._osc('square', 100, t, 0.35, 0.08, { to: 700 });
  }

  bonus() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => this._osc('triangle', f, t + i * 0.07, 0.18, 0.15));
  }

  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 7; i++) this._osc('square', 500 - i * 55, t + i * 0.13, 0.14, 0.12, { to: 300 - i * 30 });
    this._noise(t + 1.0, 0.5, 0.25, 800);
  }

  start() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // petite mélodie pentatonique "ukulélé"
    const notes = [392, 440, 523, 587, 659, 784, 659, 784];
    notes.forEach((f, i) => { this._osc('triangle', f, t + i * 0.14, 0.25, 0.14); this._osc('sine', f * 2, t + i * 0.14, 0.12, 0.05); });
    this.drum(t + 0.0); this.drum(t + 0.56);
  }

  levelWin() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
    notes.forEach((f, i) => this._osc('triangle', f, t + i * 0.11, 0.3, 0.16));
    for (let i = 0; i < 4; i++) this.drum(t + i * 0.22);
  }

  extraLife() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1108, 1318, 1760].forEach((f, i) => this._osc('square', f, t + i * 0.09, 0.2, 0.08));
  }

  drum(t) {
    if (!this.ctx) return;
    this._osc('sine', 150, t, 0.25, 0.3, { to: 50 });
    this._noise(t, 0.08, 0.1, 900);
  }

  // --- boucles : sirène des fantômes / mode Mana / yeux
  setLoop(name) {
    if (!this.ctx) return;
    if (this.loopName === name) return;
    this.stopLoop();
    this.loopName = name;
    if (!name) return;
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
    if (name === 'siren') { o.type = 'triangle'; o.frequency.value = 180; lfo.frequency.value = 1.2; lg.gain.value = 90; g.gain.value = 0.05; }
    else if (name === 'fright') { o.type = 'square'; o.frequency.value = 220; lfo.frequency.value = 6; lg.gain.value = 120; g.gain.value = 0.035; }
    else { o.type = 'sine'; o.frequency.value = 900; lfo.frequency.value = 9; lg.gain.value = 500; g.gain.value = 0.03; }
    lfo.connect(lg).connect(o.frequency);
    o.connect(g).connect(this.master);
    o.start(); lfo.start();
    this.loop = { o, lfo, g };
  }
  stopLoop() {
    if (this.loop) { try { this.loop.o.stop(); this.loop.lfo.stop(); } catch { /* ignore */ } this.loop = null; }
    this.loopName = null;
  }
}
