export const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};

const tweens = new Set();

// Dünya döngüsünden ilerletilir; hit-stop sırasında hepsi birlikte durur.
export function tween(dur, onUpdate, ease = Ease.outCubic) {
  return new Promise((res) => tweens.add({ t: 0, dur: Math.max(dur, 1e-4), onUpdate, ease, res }));
}
export const wait = (s) => tween(s, () => {}, Ease.linear);

export function updateTweens(dt) {
  for (const tw of tweens) {
    tw.t += dt;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate(tw.ease(k), k);
    if (k >= 1) { tweens.delete(tw); tw.res(); }
  }
}

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const settings = { motion: !reduced };

// Trauma tabanlı ekran sarsıntısı: kareli sönümleme, sinüs ile pürüzsüz.
export class Trauma {
  constructor() { this.v = 0; this.t = 0; }
  add(a) { if (settings.motion) this.v = Math.min(1, this.v + a); }
  update(dt) {
    this.v = Math.max(0, this.v - 1.5 * dt);
    this.t += dt * 30;
    const s = this.v * this.v;
    return { x: 0.32 * s * Math.sin(this.t * 1.7), y: 0.22 * s * Math.sin(this.t * 2.3 + 1), r: 0.018 * s * Math.sin(this.t * 1.1) };
  }
}
