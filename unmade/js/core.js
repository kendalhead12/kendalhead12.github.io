'use strict';
// ============================================================
//  UNMADE — core: namespace, math, storage, canvas, coroutines
// ============================================================
(function () {
  const U = window.U = {
    W: 320, H: 240, TILE: 16,
    frame: 0,
    params: new URLSearchParams(location.search),
    opts: { music: 0.6, sfx: 0.7, textSpeed: 1, reduceFlash: false, reduceShake: false, touch: 'auto' },
    errors: [],
  };
  U.debug = U.params.has('debug');

  // ---------------- math ----------------
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.choose = arr => arr[Math.floor(Math.random() * arr.length)];
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.ang = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
  U.approach = (v, t, s) => v < t ? Math.min(v + s, t) : Math.max(v - s, t);
  U.ease = {
    inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    out: t => 1 - (1 - t) * (1 - t),
    in: t => t * t,
    back: t => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  };
  U.hash = (x, y = 0, s = 0) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  U.rng = seed => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  U.fmtTime = s => { s = Math.floor(s); const m = Math.floor(s / 60), h = Math.floor(m / 60); return (h ? h + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };

  // ---------------- storage (never throws) ----------------
  const PFX = 'unmade.';
  U.store = {
    get(k) { try { const v = localStorage.getItem(PFX + k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(PFX + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(PFX + k); } catch (e) { /* ignore */ } },
    // only ever touches keys that belong to this game
    clearAll() { try { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PFX)) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); } catch (e) { /* ignore */ } },
  };
  U.loadOpts = function () { const o = U.store.get('settings'); if (o) Object.assign(U.opts, o); };
  U.saveOpts = function () { U.store.set('settings', U.opts); };

  // ---------------- canvas ----------------
  U.canvas = document.getElementById('screen');
  U.ctx = U.canvas.getContext('2d', { alpha: false });
  U.ctx.imageSmoothingEnabled = false;
  U.mk = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = false;
    c.g = x;
    return c;
  };

  // ---------------- coroutine runner ----------------
  // Scripts are generator functions that `yield` commands. A command is an
  // object with update() -> true when finished (optional start(), value).
  // Shorthands: yield 30 (wait frames), yield () => cond (wait until), yield [a, b] (parallel).
  U.cmd = {
    wait(n) { return { t: n, update() { return --this.t <= 0; } }; },
    until(fn) { return { update() { return !!fn(); } }; },
    call(fn) { return { update() { fn(); return true; } }; },
    all(list) {
      const cs = list.map(U.cmd.wrap);
      return {
        start() { cs.forEach(c => { if (c.start) c.start(); c._d = false; }); },
        update() { let all = true; for (const c of cs) { if (!c._d) { if (c.update()) c._d = true; else all = false; } } return all; },
      };
    },
    gen(g) { // run a generator as a command (parallel sub-script)
      const r = new Runner(); let th;
      return { start() { th = r.run(g); }, update() { r.update(); this.value = th.value; return th.done; } };
    },
    wrap(v) {
      if (v == null) return U.cmd.wait(1);
      if (typeof v === 'number') return U.cmd.wait(v);
      if (typeof v === 'function') return U.cmd.until(v);
      if (Array.isArray(v)) return U.cmd.all(v);
      if (typeof v.next === 'function' && typeof v.update !== 'function') return U.cmd.gen(v);
      return v;
    },
  };
  class Runner {
    constructor() { this.threads = []; }
    get busy() { return this.threads.some(t => !t.done && !t.bg); }
    run(gen, bg) {
      const th = { gen, cur: null, bg: !!bg, done: false, value: undefined };
      this.threads.push(th);
      this._advance(th, undefined);
      return th;
    }
    _advance(th, val) {
      let r;
      try { r = th.gen.next(val); } catch (e) { U.reportErr(e); th.done = true; return; }
      if (r.done) { th.done = true; th.value = r.value; th.cur = null; return; }
      const c = U.cmd.wrap(r.value);
      th.cur = c;
      try { if (c.start) c.start(); } catch (e) { U.reportErr(e); }
    }
    update() {
      const list = this.threads.slice();
      for (const th of list) {
        if (th.done) continue;
        const c = th.cur;
        let fin = true;
        try { fin = !c || c.update(); } catch (e) { U.reportErr(e); fin = true; }
        if (fin) this._advance(th, c ? c.value : undefined);
      }
      this.threads = this.threads.filter(t => !t.done);
    }
    stop() { this.threads.length = 0; }
  }
  U.Runner = Runner;
  U.Script = new Runner();

  U.reportErr = function (e) {
    console.error(e);
    U.errors.push(((e && e.message) || String(e)) + '\n' + (e && e.stack || ''));
  };
})();
