'use strict';
// ============================================================
//  Screen effects: fades, flashes, shake, glitches, particles
// ============================================================
(function () {
  const FX = U.FX = { fade: 0, fadeCol: '#000', flash: 0, flashCol: '#fff', flashMax: 1, shakeT: 0, shakeM: 0, glitchT: 0, glitchI: 0, ox: 0, oy: 0, tint: null };
  FX.fadeTo = function (target, frames, col) {
    return {
      start() { this.from = FX.fade; this.t = 0; this.n = Math.max(1, frames || 15); if (col) FX.fadeCol = col; },
      update() { this.t++; FX.fade = U.lerp(this.from, target, Math.min(1, this.t / this.n)); return this.t >= this.n; },
    };
  };
  FX.flashScreen = function (col, frames) {
    FX.flashCol = col || '#fff';
    FX.flash = frames || 8; FX.flashMax = FX.flash;
  };
  FX.shake = function (m, frames) {
    if (U.opts.reduceShake) m *= .25;
    if (m < .5) return;
    FX.shakeM = Math.max(FX.shakeM, m); FX.shakeT = Math.max(FX.shakeT, frames || 10);
  };
  FX.glitch = function (frames, intensity) { FX.glitchT = Math.max(FX.glitchT, frames); FX.glitchI = intensity == null ? 1 : intensity; };
  FX.update = function () {
    if (FX.flash > 0) FX.flash--;
    if (FX.shakeT > 0) { FX.shakeT--; const m = FX.shakeM * (FX.shakeT / (FX.shakeT + 6)); FX.ox = Math.round(U.rand(-m, m)); FX.oy = Math.round(U.rand(-m, m)); if (!FX.shakeT) { FX.shakeM = 0; FX.ox = FX.oy = 0; } }
    if (FX.glitchT > 0) FX.glitchT--;
  };
  FX.drawPost = function (ctx) {
    const W = U.W, H = U.H;
    if (FX.glitchT > 0) {
      const I = FX.glitchI * (U.opts.reduceFlash ? .4 : 1);
      const n = Math.floor(3 + I * 8);
      for (let i = 0; i < n; i++) {
        const y = U.randi(0, H - 8), h = U.randi(2, 12), dx = Math.round(U.rand(-20, 20) * I);
        ctx.drawImage(U.canvas, 0, y, W, h, dx, y, W, h);
      }
      if (!U.opts.reduceFlash) for (let i = 0; i < Math.floor(I * 6); i++) {
        ctx.fillStyle = U.choose(['#ff0040', '#00ffd0', '#ffffff', '#000000', '#3040ff']);
        ctx.globalAlpha = .5; ctx.fillRect(U.randi(0, W), U.randi(0, H), U.randi(4, 40), U.randi(1, 4)); ctx.globalAlpha = 1;
      }
    }
    if (FX.tint) { ctx.globalAlpha = FX.tint.a; ctx.fillStyle = FX.tint.col; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (FX.flash > 0) {
      let a = FX.flash / FX.flashMax;
      if (U.opts.reduceFlash) a *= .3;
      ctx.globalAlpha = a; ctx.fillStyle = FX.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    }
    if (FX.fade > 0.001) { ctx.globalAlpha = Math.min(1, FX.fade); ctx.fillStyle = FX.fadeCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  };

  // ---------------- particles ----------------
  class Particles {
    constructor() { this.list = []; }
    add(p) { const q = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, life: 30, t: 0, col: '#fff', size: 1, fade: true, drag: 1 }, p); this.list.push(q); return q; }
    burst(x, y, n, o) { for (let i = 0; i < n; i++) { const a = U.rand(0, Math.PI * 2), s = U.rand(o.smin || .5, o.smax || 2); this.add(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s }, o, { life: U.randi(o.lmin || 20, o.lmax || 40) })); } }
    update() {
      for (const p of this.list) { p.t++; p.vx = p.vx * p.drag + p.ax; p.vy = p.vy * p.drag + p.ay; p.x += p.vx; p.y += p.vy; if (p.update) p.update(p); }
      this.list = this.list.filter(p => p.t < p.life);
    }
    draw(ctx, ox, oy) {
      ox = ox || 0; oy = oy || 0;
      for (const p of this.list) {
        const a = p.fade ? 1 - p.t / p.life : 1;
        ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.col;
        const s = typeof p.size === 'function' ? p.size(p) : p.size;
        ctx.fillRect(Math.round(p.x - ox - s / 2), Math.round(p.y - oy - s / 2), s, s);
      }
      ctx.globalAlpha = 1;
    }
    clear() { this.list.length = 0; }
  }
  U.Particles = Particles;
})();
