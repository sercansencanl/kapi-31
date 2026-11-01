// Tüm sesler Web Audio API ile prosedürel üretiliyor. Ses dosyası yok.
const NOOP = { set() {}, stop() {} };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('k31-muted') === '1'; } catch { /* yok say */ }
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = this.gain(this.muted ? 0 : 0.9, comp);
    this.sfx = this.gain(1, this.master);
    this.music = this.gain(0.28, this.master);
    this.amb = this.gain(0.55, this.master);
    this.white = this.makeNoise(2, false);
    this.brown = this.makeNoise(4, true);
  }

  gain(v, dest) { const g = this.ctx.createGain(); g.gain.value = v; if (dest) g.connect(dest); return g; }

  makeNoise(sec, brown) {
    const len = this.ctx.sampleRate * sec, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('k31-muted', m ? '1' : '0'); } catch { /* yok say */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  tone({ type = 'sine', f = 440, f2, t = 0, dur = 0.2, vol = 0.2, attack = 0.005, filter, q = 1, bus }) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (filter) { const b = c.createBiquadFilter(); b.type = 'lowpass'; b.frequency.value = filter; b.Q.value = q; o.connect(b); node = b; }
    node.connect(g); g.connect(bus || this.sfx);
    o.start(now); o.stop(now + dur + 0.05);
  }

  noise({ t = 0, dur = 0.3, vol = 0.2, type = 'bandpass', f = 1000, f2, q = 1, attack = 0.005, buf, bus }) {
    if (!this.ctx) return;
    const c = this.ctx, now = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = buf || this.white;
    const b = c.createBiquadFilter(); b.type = type; b.frequency.setValueAtTime(f, now); b.Q.value = q;
    if (f2) b.frequency.exponentialRampToValueAtTime(f2, now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(b); b.connect(g); g.connect(bus || this.sfx);
    s.start(now); s.stop(now + dur + 0.05);
  }

  // ---------- Arayüz ----------
  click() { this.tone({ type: 'triangle', f: 1300, f2: 700, dur: 0.06, vol: 0.12 }); }
  paper() { this.noise({ dur: 0.22, vol: 0.18, f: 2600, f2: 1200, q: 0.8, attack: 0.03 }); }
  kantarTick(final) {
    if (final) { this.tone({ type: 'square', f: 1760, dur: 0.09, vol: 0.06, filter: 3000 }); this.tone({ type: 'square', f: 2350, t: 0.1, dur: 0.14, vol: 0.06, filter: 3000 }); }
    else this.tone({ type: 'square', f: 2200, dur: 0.018, vol: 0.025, filter: 4000 });
  }
  correct() {
    this.tone({ type: 'triangle', f: mtof(76), dur: 0.35, vol: 0.18 });
    this.tone({ type: 'triangle', f: mtof(83), t: 0.09, dur: 0.5, vol: 0.16 });
  }
  wrong() {
    this.tone({ type: 'sawtooth', f: 140, dur: 0.18, vol: 0.18, filter: 900 });
    this.tone({ type: 'sawtooth', f: 104, t: 0.2, dur: 0.32, vol: 0.18, filter: 700 });
  }
  cash() {
    this.noise({ dur: 0.05, vol: 0.15, f: 4000, type: 'highpass' });
    this.tone({ type: 'sine', f: 1568, t: 0.03, dur: 0.5, vol: 0.12 });
    this.tone({ type: 'sine', f: 2093, t: 0.08, dur: 0.6, vol: 0.1 });
  }
  stampHit() { // lastik damga: tok vuruş + kağıt hışırtısı
    this.tone({ type: 'sine', f: 140, f2: 55, dur: 0.16, vol: 0.32 });
    this.noise({ dur: 0.07, vol: 0.28, type: 'lowpass', f: 900 });
    this.noise({ t: 0.03, dur: 0.12, vol: 0.08, type: 'bandpass', f: 2400, q: 0.8 });
  }
  stamp() { // gün sonu
    [0, 0.12, 0.24].forEach((t, i) => this.tone({ type: 'triangle', f: mtof([69, 73, 76][i]), t, dur: 0.6, vol: 0.13 }));
  }

  // ---------- Kamyon ----------
  engine() {
    if (!this.ctx) return NOOP;
    const c = this.ctx, now = c.currentTime;
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 44;
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 88; o2.detune.value = 12;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 3;
    const g = c.createGain(); g.gain.value = 0;
    const lfo = c.createOscillator(); lfo.frequency.value = 13;
    const lg = c.createGain(); lg.gain.value = 0.035; lfo.connect(lg); lg.connect(g.gain);
    const rumble = c.createBufferSource(); rumble.buffer = this.brown; rumble.loop = true;
    const rg = c.createGain(); rg.gain.value = 0.5; rumble.connect(rg); rg.connect(lp);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.sfx);
    [o1, o2, lfo, rumble].forEach((n) => n.start());
    g.gain.setTargetAtTime(0.11, now, 0.3);
    return {
      set: (level) => {
        const t = c.currentTime;
        o1.frequency.setTargetAtTime(36 + level * 34, t, 0.15);
        o2.frequency.setTargetAtTime(72 + level * 68, t, 0.15);
        lp.frequency.setTargetAtTime(220 + level * 650, t, 0.15);
        lfo.frequency.setTargetAtTime(10 + level * 14, t, 0.15);
      },
      stop: () => {
        const t = c.currentTime;
        g.gain.setTargetAtTime(0, t, 0.25);
        [o1, o2, lfo, rumble].forEach((n) => n.stop(t + 1.5));
      },
    };
  }
  brake() {
    this.noise({ dur: 0.7, vol: 0.22, type: 'highpass', f: 2500, attack: 0.01 });
    this.noise({ t: 0.05, dur: 0.5, vol: 0.12, type: 'bandpass', f: 5000, f2: 3000, q: 2 });
  }
  doorOpen() {
    this.noise({ dur: 0.12, vol: 0.3, type: 'lowpass', f: 500 });
    this.tone({ type: 'sine', f: 120, f2: 60, dur: 0.18, vol: 0.3 });
    this.tone({ type: 'sawtooth', f: 210, f2: 140, t: 0.12, dur: 0.75, vol: 0.05, filter: 1400, q: 8 });
    this.tone({ type: 'sawtooth', f: 260, f2: 170, t: 0.2, dur: 0.6, vol: 0.04, filter: 1800, q: 8 });
    this.noise({ t: 0.95, dur: 0.15, vol: 0.2, type: 'lowpass', f: 380 });
  }
  barrier() {
    this.tone({ type: 'sawtooth', f: 180, f2: 240, dur: 1.0, vol: 0.05, filter: 700, attack: 0.1 });
    this.noise({ t: 0.95, dur: 0.08, vol: 0.14, type: 'lowpass', f: 600 });
  }
  reverseBeeps() {
    if (!this.ctx) return NOOP;
    let on = true;
    const beep = () => { if (!on) return; this.tone({ type: 'square', f: 1180, dur: 0.38, vol: 0.05, filter: 2500, attack: 0.01 }); };
    beep();
    const id = setInterval(beep, 800);
    return { set() {}, stop: () => { on = false; clearInterval(id); } };
  }
  crateHover() { this.tone({ type: 'triangle', f: 520, f2: 480, dur: 0.05, vol: 0.05 }); }

  // ---------- Ortam ve müzik ----------
  startAmbience() {
    if (!this.ctx || this.ambOn) return;
    this.ambOn = true;
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.brown; s.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = c.createGain(); g.gain.value = 0.32;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    const lg = c.createGain(); lg.gain.value = 0.18; lfo.connect(lg); lg.connect(g.gain);
    s.connect(lp); lp.connect(g); g.connect(this.amb); s.start(); lfo.start();
    const gull = () => {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.tone({ type: 'sine', f: 1500 + Math.random() * 300, f2: 850, t: i * 0.22, dur: 0.2, vol: 0.025, bus: this.amb });
      setTimeout(gull, 7000 + Math.random() * 9000);
    };
    setTimeout(gull, 3000);
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    const c = this.ctx;
    const chords = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 59, 64], [50, 55, 59, 62]];
    const bar = 4.8;
    let next = c.currentTime + 0.2, bi = 0, step = 0;
    const pad = (notes, t) => {
      notes.forEach((m) => [-7, 7].forEach((det) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.03, t + 1.4);
        g.gain.setTargetAtTime(0.0001, t + bar - 0.4, 0.6);
        o.connect(lp); lp.connect(g); g.connect(this.music);
        o.start(t); o.stop(t + bar + 3);
      }));
    };
    const pluck = (m, t) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 1);
    };
    const tick = () => {
      while (next < c.currentTime + 0.3) {
        const ch = chords[bi % chords.length];
        if (step === 0) pad(ch, next);
        if (Math.random() < 0.55) pluck(ch[Math.floor(Math.random() * ch.length)] + 12 + (Math.random() < 0.2 ? 12 : 0), next);
        next += bar / 8; step++;
        if (step === 8) { step = 0; bi++; }
      }
    };
    this.musicTimer = setInterval(tick, 60);
  }
}

export const audio = new AudioEngine();
