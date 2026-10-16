// ---------------------------------------------------------------------------
//  AUDIO : tout est synthétisé en WebAudio (aucun fichier son)
// ---------------------------------------------------------------------------
export function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* stockage indisponible */ } }

export class AudioFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = lsGet('pipemana.muted') === '1';
    this.flowNode = null;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this._ambient();
  }

  setMuted(m) {
    this.muted = m;
    lsSet('pipemana.muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05);
  }

  /** Bruit de fond : vagues du lagon (bruit filtré, lent) */
  _ambient() {
    const ctx = this.ctx;
    const noise = this._noiseBuffer(3);
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.035;
    lfo.connect(lfoG).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(); lfo.start();
  }

  _noiseBuffer(sec) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _tone(freq, { type = 'sine', dur = 0.15, gain = 0.3, attack = 0.005, slide = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  _splash(dur = 0.5, gain = 0.5, freq = 1200, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.frequency.exponentialRampToValueAtTime(freq / 3, t0 + dur); f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t0); src.stop(t0 + dur + 0.1);
  }

  // --- événements de jeu
  place() { this._tone(520, { type: 'square', dur: 0.06, gain: 0.12 }); this._tone(260, { type: 'triangle', dur: 0.09, gain: 0.2, delay: 0.01 }); }
  replace() { this._splash(0.12, 0.25, 500); this._tone(180, { type: 'sawtooth', dur: 0.12, gain: 0.12 }); }
  invalid() { this._tone(140, { type: 'square', dur: 0.1, gain: 0.08 }); }
  enterPipe() { this._tone(660 + Math.random() * 120, { type: 'sine', dur: 0.12, gain: 0.1, slide: 420 }); }
  mana() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, { type: 'triangle', dur: 0.35, gain: 0.22, delay: i * 0.08 })); }
  card() { [784, 988, 1175, 1568, 1976].forEach((f, i) => this._tone(f, { type: 'sine', dur: 0.4, gain: 0.2, delay: i * 0.06 })); this._splash(0.4, 0.15, 3000, 0.1); }
  cross() { this._tone(880, { type: 'triangle', dur: 0.18, gain: 0.18 }); this._tone(1320, { type: 'triangle', dur: 0.22, gain: 0.14, delay: 0.09 }); }
  leak() { this._splash(0.9, 0.7, 1800); this._tone(300, { type: 'sawtooth', dur: 0.6, gain: 0.18, slide: 70 }); }
  tick() { this._tone(1100, { type: 'square', dur: 0.05, gain: 0.08 }); }
  go() { this._tone(880, { type: 'square', dur: 0.25, gain: 0.14 }); this._splash(0.5, 0.3, 900, 0.05); }
  start() { [392, 523, 659, 784].forEach((f, i) => this._tone(f, { type: 'triangle', dur: 0.25, gain: 0.2, delay: i * 0.1 })); }
  levelWin() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this._tone(f, { type: 'triangle', dur: 0.3, gain: 0.22, delay: i * 0.11 }));
    this._splash(1.6, 0.25, 2200, 0.3);
  }
  gameOver() { [440, 392, 330, 262, 196].forEach((f, i) => this._tone(f, { type: 'sawtooth', dur: 0.4, gain: 0.14, delay: i * 0.18 })); this._splash(1.4, 0.35, 700, 0.2); }
  extraLife() { [659, 784, 1046, 1318].forEach((f, i) => this._tone(f, { type: 'sine', dur: 0.25, gain: 0.2, delay: i * 0.07 })); }

  /** Glouglou continu pendant que l'eau coule ; `rate` = vitesse relative (1 = normale) */
  setFlow(on, rate = 1) {
    if (!this.ctx) return;
    if (on && !this.flowNode) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this._noiseBuffer(2); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.5;
      const g = ctx.createGain(); g.gain.value = 0.0;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7;
      const lg = ctx.createGain(); lg.gain.value = 500;
      lfo.connect(lg).connect(f.frequency);
      src.connect(f).connect(g).connect(this.master); src.start(); lfo.start();
      g.gain.setTargetAtTime(0.09, ctx.currentTime, 0.2);
      this.flowNode = { src, g, lfo, f };
    } else if (!on && this.flowNode) {
      const { src, g, lfo } = this.flowNode;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => { try { src.stop(); lfo.stop(); } catch { /* déjà arrêté */ } }, 400);
      this.flowNode = null;
    }
    if (this.flowNode) { this.flowNode.lfo.frequency.setTargetAtTime(7 * rate, this.ctx.currentTime, 0.1); this.flowNode.f.frequency.setTargetAtTime(900 * Math.sqrt(rate), this.ctx.currentTime, 0.1); }
  }
}
