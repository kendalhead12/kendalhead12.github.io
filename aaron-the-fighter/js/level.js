'use strict';
// ============================================================
//  Level builder (data), Level runtime (tiles, liquids), Camera
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T;
  AF.LEVELS = {};

  // ---------------- Builder ----------------
  class LB {
    constructor(o) {
      Object.assign(this, { w: 200, h: 20, world: 1, act: 1, music: null, bgAct: null, dark: 0 }, o);
      this.tiles = new Uint8Array(this.w * this.h);
      this.objs = []; this.decor = []; this.water = []; this.medals = 0;
      this.spawn = { x: 2, y: this.h - 6 };
    }
    t(x, y, id) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = id === undefined ? T.SOLID : id; return this; }
    g(x, y) { if (x < 0 || x >= this.w) return -1; if (y < 0 || y >= this.h) return 0; return this.tiles[y * this.w + x]; }
    r(x, y, w, h, id) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.t(i, j, id); return this; }
    clear(x, y, w, h) { return this.r(x, y, w, h, T.EMPTY); }
    ground(x0, x1, y, id) { return this.r(x0, y, x1 - x0 + 1, this.h - y, id); } // inclusive columns, fill to bottom
    plat(x, y, w, id) { return this.r(x, y, w, 1, id === undefined ? T.PLAT : id); }
    ladder(x, y, h, vine) { return this.r(x, y, 1, h, vine ? T.VINE : T.LADDER); }
    col(x, y, h, id) { return this.r(x, y, 1, h, id); }
    // stairs: n steps rising toward dir
    steps(x, y, n, dir, id) { for (let i = 0; i < n; i++) this.r(dir > 0 ? x + i : x - i, y - i, 1, i + 1 + (this.h - y), id); return this; }
    o(type, x, y, p) { this.objs.push({ type, x, y, p: p || {} }); return this; }
    e(type, x, y, p) { return this.o(type, x, y, p); }
    coins(x, y, n, dx, dy) { dx = dx === undefined ? 1 : dx; dy = dy || 0; for (let i = 0; i < n; i++) this.o('coin', x + i * dx, y + i * dy); return this; }
    arc(x, y, n, h) { h = h || 2; for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) : .5; this.o('coin', x + i, y - Math.round(Math.sin(t * Math.PI) * h)); } return this; }
    medal(x, y) { this.o('medal', x, y, { id: this.medals++ }); return this; }
    deco(type, x, y, p) { this.decor.push({ type, x, y, p: p || {} }); return this; }
    liquid(x, y, w, h, kind, p) { this.water.push(Object.assign({ x: x * TS, y: y * TS, w: w * TS, h: h * TS, kind: kind || 'water' }, p || {})); return this; }
    start(x, y) { this.spawn = { x, y }; return this; }
    // floating chunk of terrain (grass/snow capped)
    isl(x, y, w, h, id) { return this.r(x, y, w, h || 2, id === undefined ? AF.T.SOLID : id); }
    // standard 15-wide boss arena starting at column x with floor top at row F
    arena(x, F, kind, o) {
      o = o || {};
      this.r(x - 1, F, 17, this.h - F, o.tile || AF.T.SOLID);
      if (o.ceil !== false) this.r(x - 1, 0, 17, Math.max(0, F - 9), o.ceilTile || AF.T.ALT);
      this.o('check', x - 4, F - 1);
      this.o('trigger', x + 3, 0, { boss: 1, h: this.h });
      this.o(kind, x, F - 1, Object.assign({ ax: x, ay: F - 8, aw: 15, ah: 10, floor: F }, o.p || {}));
      return this;
    }
    done() {
      if (this.medals !== 3) console.warn('Level ' + this.world + '-' + this.act + ' has ' + this.medals + ' medals');
      return this;
    }
  }
  AF.LB = LB;

  // ---------------- Runtime level ----------------
  class Level {
    constructor(def) {
      this.def = def;
      this.w = def.w; this.h = def.h; this.world = def.world; this.act = def.act;
      this.tiles = new Uint8Array(def.tiles);
      this.pw = this.w * TS; this.ph = this.h * TS;
      this.solids = [];
      this.liquids = def.water.map(z => Object.assign({ top: z.y, base: z.y }, z));
      this.ts = AF.tileset(def.tileWorld || def.world);
      this.vis = new Int16Array(this.w * this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.vis[y * this.w + x] = AF.tileVisual(this, x, y);
      this.secretAlpha = new Float32Array(this.w * this.h).fill(1);
    }
    get(x, y) { if (x < 0 || x >= this.w) return -1; if (y < 0 || y >= this.h) return 0; return this.tiles[y * this.w + x]; }
    set(x, y, t) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
      this.tiles[y * this.w + x] = t;
      for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.vis[j * this.w + i] = AF.tileVisual(this, i, j);
    }
    liquidAt(px, py) {
      for (const z of this.liquids) if (px >= z.x && px < z.x + z.w && py >= z.top && py < z.y + z.h) return z;
      return null;
    }
    surfaceAt(px) { for (const z of this.liquids) if (px >= z.x && px < z.x + z.w) return z; return null; }
    drawTiles(ctx, cx, cy, bgPass, t) {
      const x0 = Math.max(0, Math.floor(cx / TS)), x1 = Math.min(this.w - 1, Math.floor((cx + AF.W) / TS));
      const y0 = Math.max(0, Math.floor(cy / TS)), y1 = Math.min(this.h - 1, Math.floor((cy + AF.H) / TS));
      const atlas = this.ts.atlas;
      const fr = (t >> 2) & 3;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const tid = this.tiles[y * this.w + x];
        const isBG = tid === T.BGWALL || tid === T.BGALT;
        if (isBG !== bgPass) continue;
        let v = this.vis[y * this.w + x];
        if (v < 0) continue;
        if (tid === T.CONVL || tid === T.CONVR) v += fr;
        const sx = Math.round(x * TS - cx), sy = Math.round(y * TS - cy);
        if (tid === T.SECRET) {
          const a = this.secretAlpha[y * this.w + x];
          if (a < .02) continue;
          ctx.globalAlpha = a;
          ctx.drawImage(atlas, (v % 16) * 16, Math.floor(v / 16) * 16, 16, 16, sx, sy, 16, 16);
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.drawImage(atlas, (v % 16) * 16, Math.floor(v / 16) * 16, 16, 16, sx, sy, 16, 16);
      }
    }
    // fade secret walls when the player is inside/near them
    updateSecrets(px, py) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      for (let y = ty - 6; y <= ty + 6; y++) for (let x = tx - 8; x <= tx + 8; x++) {
        if (this.get(x, y) !== T.SECRET) continue;
        const i = y * this.w + x;
        // find if player is in same connected secret region (cheap: within 3 tiles of a secret tile containing player)
        const inside = this.secretRegion && this.secretRegion.has(i);
        this.secretAlpha[i] = AF.approach(this.secretAlpha[i], inside ? .15 : 1, .08);
      }
    }
    computeSecretRegion(px, py) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      const start = [];
      for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) if (this.get(x, y) === T.SECRET) start.push(y * this.w + x);
      if (!start.length) { this.secretRegion = null; return; }
      if (this.secretRegion && this.secretRegion.has(start[0])) return;
      const set = new Set(start), q = start.slice();
      while (q.length && set.size < 400) {
        const i = q.pop(), x = i % this.w, y = (i / this.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, ni = ny * this.w + nx; if (!set.has(ni) && this.get(nx, ny) === T.SECRET) { set.add(ni); q.push(ni); } }
      }
      this.secretRegion = set;
    }
    drawLiquids(ctx, cx, cy, t) {
      for (const z of this.liquids) {
        const x = Math.round(z.x - cx), y = Math.round(z.top - cy), w = z.w, h = z.y + z.h - z.top;
        if (x > AF.W || x + w < 0 || y > AF.H || y + h < 0 || h <= 0) continue;
        const k = z.kind;
        const body = k === 'lava' ? '#e84010' : k === 'acid' ? '#40d040' : k === 'goo' ? '#a040c0' : '#2878d0';
        const surf = k === 'lava' ? '#ffd040' : k === 'acid' ? '#c0ff80' : '#c0f0ff';
        const mid = k === 'lava' ? '#ff8020' : k === 'acid' ? '#80f060' : '#60b0f0';
        ctx.globalAlpha = k === 'lava' ? .92 : k === 'acid' ? .7 : .42;
        ctx.fillStyle = body;
        const yy = Math.max(-2, y), x0 = Math.max(0, x), x1 = Math.min(AF.W, x + w);
        ctx.fillRect(x0, yy + 2, x1 - x0, Math.min(AF.H, y + h) - yy - 2);
        ctx.globalAlpha = k === 'lava' ? 1 : .8;
        if (y > -4 && y < AF.H) {
          for (let i = x0; i < x1; i++) {
            const wv = Math.round(Math.sin((i + cx) * .25 + t * .08) * 1.2);
            ctx.fillStyle = surf; ctx.fillRect(i, y + wv, 1, 1);
            ctx.fillStyle = mid; ctx.fillRect(i, y + wv + 1, 1, 2);
          }
          if (k === 'lava') { // glow bubbles
            for (let i = 0; i < w / 24; i++) { const bx = x + ((i * 37 + (t >> 1)) % w), ph = (t + i * 23) % 60; if (ph < 12 && bx > 0 && bx < AF.W) { ctx.fillStyle = '#ffd040'; ctx.fillRect(bx, y + 4 - (ph >> 2), 2, 2); } }
          }
        }
        if (k === 'water') { // shimmer lines
          ctx.globalAlpha = .18; ctx.fillStyle = '#e0f8ff';
          for (let j = 1; j < 6; j++) { const ly = y + j * 18 + Math.round(Math.sin(t * .03 + j) * 2); if (ly > y + 4 && ly < y + h) for (let i = x0 + ((j * 13 + (t >> 2)) % 24); i < x1; i += 24) ctx.fillRect(i, ly, 8, 1); }
        }
        ctx.globalAlpha = 1;
      }
    }
  }
  AF.Level = Level;

  // ---------------- Camera ----------------
  class Camera {
    constructor() { this.x = 0; this.y = 0; this.look = 0; this.shakeT = 0; this.shakeA = 0; this.lock = null; this.ox = 0; this.oy = 0; this.yTarget = 0; }
    snap(g) { this.update(g, true); }
    shake(a, t) { if (!AF.opts.shake) return; this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, t); }
    update(g, instant) {
      const p = g.player, lv = g.lv;
      const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
      this.look = AF.approach(this.look, p.facing * 28 + p.vx * 6, 1.2);
      if (Math.abs(p.vx) < .3 && !instant) this.look = AF.approach(this.look, p.facing * 16, .4);
      let tx = pcx - AF.W / 2 + this.look;
      // vertical: follow with band; anchor on ground
      let ty;
      const band = 24;
      if (p.onGround || p.climbing || p.swimming || p.hanging || g.vertical) this.yTarget = pcy - AF.H / 2 - 12 + (p.lookDown || 0);
      else {
        if (pcy - (this.yTarget + AF.H / 2) > band) this.yTarget = pcy - AF.H / 2 - band;
        if (pcy - (this.yTarget + AF.H / 2) < -band - 20) this.yTarget = pcy - AF.H / 2 + band + 20;
      }
      ty = this.yTarget;
      let minX = 0, maxX = lv.pw - AF.W, minY = 0, maxY = lv.ph - AF.H;
      if (this.lock) { minX = this.lock.x; maxX = this.lock.x + this.lock.w - AF.W; minY = this.lock.y; maxY = this.lock.y + this.lock.h - AF.H; if (this.lock.fixed) { tx = minX; ty = minY; } }
      if (g.camMinX !== undefined) minX = Math.max(minX, g.camMinX);
      tx = AF.clamp(tx, minX, Math.max(minX, maxX)); ty = AF.clamp(ty, minY, Math.max(minY, maxY));
      if (instant) { this.x = tx; this.y = ty; }
      else {
        this.x += (tx - this.x) * .14;
        const dy = ty - this.y;
        this.y += AF.clamp(dy * (Math.abs(dy) > 60 ? .2 : .1), -7, 7);
      }
      if (this.shakeT > 0) { this.shakeT--; this.ox = AF.rr(-1, 1) * this.shakeA; this.oy = AF.rr(-1, 1) * this.shakeA; if (this.shakeT <= 0) this.shakeA = 0; }
      else { this.ox = this.oy = 0; }
    }
    get vx() { return Math.round(this.x + this.ox); }
    get vy() { return Math.round(this.y + this.oy); }
  }
  AF.Camera = Camera;
})();
