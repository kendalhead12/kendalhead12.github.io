'use strict';
// ============================================================
//  Entities: base, platforms, pickups, mechanics, hazards
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T, F = AF.TF, S = () => AF.SPR;
  const OBJ = AF.OBJ = {};

  class Ent {
    constructor(g, x, y, w, h) { this.g = g; this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0; this.dead = false; this.solid = false; this.collides = false; this.oneWay = false; this.z = 0; this.hittable = false; this.lastHit = -1; this.t = 0; this.dx = 0; this.dy = 0; }
    get cx() { return this.x + this.w / 2; } get cy() { return this.y + this.h / 2; }
    update() { } draw() { } touch() { } hit() { return false; }
    near(m) { const c = this.g.cam; m = m || 64; return this.x + this.w > c.x - m && this.x < c.x + AF.W + m && this.y + this.h > c.y - m && this.y < c.y + AF.H + m; }
    // move a solid/platform and carry riders
    moveBy(dx, dy) {
      if (!dx && !dy) { this.dx = this.dy = 0; return; }
      const g = this.g;
      for (const b of g.bodies) {
        if (b.dead || b === this) continue;
        const riding = b.ground === this && b.onGround;
        const hanging = b.hanging === this;
        if (riding || hanging) {
          if (dx) AF.moveX(b, g.lv, dx, this);
          if (dy) { if (dy < 0 && riding && b.grav > 0 && AF.rectSolid(g.lv, b.x, b.y + dy, b.w, b.h)) { /* crushed vs ceiling */ if (b.crush) b.crush(); } else b.y += dy; }
        }
      }
      this.x += dx; this.y += dy; this.dx = dx; this.dy = dy;
      if (this.solid && !this.oneWay) {
        for (const b of g.bodies) {
          if (b.dead || b === this || b.ground === this || b.noEntCollide) continue;
          if (!AF.rectsHit(b.x, b.y, b.w, b.h, this.x, this.y, this.w, this.h)) continue;
          if (dx > 0) AF.moveX(b, g.lv, this.x + this.w - b.x, this); else if (dx < 0) AF.moveX(b, g.lv, this.x - (b.x + b.w), this);
          if (dy > 0 && b.y < this.y + this.h && b.y + b.h > this.y + this.h - Math.abs(dy) - 2) b.y = this.y + this.h;
          else if (dy < 0 && b.y + b.h > this.y && b.y < this.y + 4) { b.y = this.y - b.h; b.vy = Math.min(b.vy, 0); }
        }
      }
    }
  }
  AF.Ent = Ent;
  const reg = (name, cls) => { OBJ[name] = cls; return cls; };

  // ---------------- platform visuals ----------------
  const platCache = {};
  AF.platImg = function (style, w, h) {
    const k = style + w + 'x' + h;
    if (platCache[k]) return platCache[k];
    const p = new AF.Pix(w, h);
    const box = (c0, c1, c2, c3) => { p.rect(0, 0, w, h, c1); p.rect(0, 0, w, 2, c2); p.rect(0, 0, w, 1, c3); p.rect(0, h - 2, w, 2, c0); };
    switch (style) {
      case 'leaf': case 'leafY': { const y = style === 'leaf' ? ['#1e6a1c', '#2c9028', '#58c040', '#a8f070'] : ['#906010', '#c08018', '#f0b830', '#fff080']; p.ell(w / 2, h / 2 + 1, w / 2, h / 2, y[1]); p.ell(w / 2, h / 2, w / 2 - 2, h / 2 - 1.5, y[2]); p.line(2, h / 2 + 1, w - 3, h / 2, y[0]); for (let x = 6; x < w - 4; x += 6) { p.line(x, h / 2 + 1, x + 3, 1, y[0]); } p.set(w * .3, 2, y[3]); p.set(w * .6, 2, y[3]); break; }
      case 'log': box('#4a2810', '#7a4a20', '#a86c34', '#d09050'); for (let x = 3; x < w; x += 7) p.set(x, h / 2, '#4a2810'); p.ell(2, h / 2, 2, h / 2 - 1, '#d09050'); p.ell(w - 3, h / 2, 2, h / 2 - 1, '#d09050'); break;
      case 'stone': box('#4a4a5a', '#7a7a8a', '#a0a0b0', '#d0d0e0'); for (let x = 15; x < w; x += 16) p.rect(x, 2, 1, h - 4, '#4a4a5a'); break;
      case 'metal': box('#30364a', '#5a6278', '#8a92a8', '#c8d0e0'); for (let x = 3; x < w; x += 8) { p.set(x, 3, '#c8d0e0'); p.set(x, h - 4, '#30364a'); } p.rect(0, 2, 2, h - 2, '#f0c020'); p.rect(w - 2, 2, 2, h - 2, '#f0c020'); break;
      case 'tech': box('#1a1830', '#3a3860', '#6a66a0', '#30f0c0'); for (let x = 4; x < w; x += 8) p.set(x, 4, '#30f0c0'); break;
      case 'crystal': box('#3060c8', '#58b8f0', '#b0e8ff', '#ffffff'); for (let x = 4; x < w; x += 10) p.line(x, h - 2, x + 4, 2, '#ffffff'); break;
      case 'crystalOff': for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (((x + y) & 1) === 0 && (y === 0 || y === h - 1 || x === 0 || x === w - 1 || (x + y) % 6 === 0)) p.set(x, y, '#80c0ff'); break;
      case 'cloud': p.rect(3, 3, w - 6, h - 4, '#ffffff'); for (let x = 4; x < w - 2; x += 7) p.circ(x, 4, 4, '#ffffff'); p.rect(2, h - 3, w - 4, 2, '#c8d8f0'); p.rect(3, 1, w - 6, 1, '#ffffff'); break;
      case 'basalt': box('#1c0c10', '#3a1c20', '#5c2c2c', '#ff9030'); p.set(w / 3, h - 3, '#ff6a18'); p.set(w * .7, h - 4, '#ff6a18'); break;
      case 'sand': box('#8a5a24', '#c88a40', '#f0c070', '#fff0c0'); for (let x = 5; x < w; x += 9) p.set(x, h / 2, '#8a5a24'); break;
      case 'ice': box('#2a5ab0', '#58b8f0', '#b8ecff', '#ffffff'); p.line(4, h - 2, 8, 2, '#ffffff'); break;
      case 'raft': box('#5a3418', '#a86a30', '#d89a58', '#f0c080'); for (let x = 7; x < w; x += 8) p.rect(x, 1, 1, h - 2, '#5a3418'); break;
      case 'coral': box('#802040', '#e05888', '#f898b8', '#ffd0e0'); for (let x = 3; x < w; x += 6) p.set(x, h - 3, '#ffffff'); break;
      case 'elevator': box('#3a3a50', '#6a6a88', '#9a9ab8', '#d0d0e8'); p.rect(w / 2 - 6, 3, 12, 3, '#f0c020'); p.rect(w / 2 - 6, 3, 12, 1, '#fff080'); break;
      case 'ship': { p.rect(0, 0, w, h, '#7a4a20'); p.rect(0, 0, w, 3, '#c89058'); p.rect(0, 0, w, 1, '#f0c080'); for (let x = 6; x < w; x += 12) p.circ(x, h / 2 + 2, 2, '#e0e8ff'); p.rect(0, h - 3, w, 3, '#4a2810'); break; }
      case 'grate': box('#303a50', '#56627e', '#8a98b0', '#c8d0e0'); for (let x = 2; x < w; x += 3) p.rect(x, 3, 1, h - 5, '#303a50'); break;
      case 'skywood': box('#6a4a2a', '#9a6a3a', '#c89058', '#f0c080'); for (let x = 7; x < w; x += 8) p.rect(x, 1, 1, h - 2, '#6a4a2a'); break;
      default: box('#303040', '#606070', '#9090a0', '#c0c0d0');
    }
    p.outline('#140a18');
    platCache[k] = p.canvas();
    return platCache[k];
  };

  // ---------------- Platform ----------------
  class Platform extends Ent {
    constructor(g, d) {
      const p = d.p;
      const w = (p.w || 2) * TS, h = p.h ? p.h * TS : (p.thick || 8);
      super(g, d.x * TS, d.y * TS, w, h);
      this.p = p; this.kind = p.kind || 'path'; this.style = p.style || g.platStyle;
      this.solid = true; this.oneWay = p.solidAll ? false : true;
      this.x0 = this.x; this.y0 = this.y; this.t = p.phase || 0; this.state = 0; this.timer = 0; this.alpha = 1; this.shake = 0;
      if (p.path) { this.pts = [[0, 0]].concat(p.path).map(q => [this.x0 + q[0] * TS, this.y0 + q[1] * TS]); this.seg = 0; this.segT = 0; this.dirSeg = 1; }
      this.speed = p.speed || 1;
      this.icy = this.style === 'ice' || this.style === 'crystal';
      this.convey = p.convey || 0;
      if (this.kind === 'toggle') { this.ch = p.ch; this.inv = !!p.inv; }
      this.collides = true;
    }
    ridden() { const pl = this.g.player; return pl.ground === this && pl.onGround; }
    update() {
      this.t++;
      let nx = this.x, ny = this.y;
      const p = this.p, g = this.g;
      switch (this.kind) {
        case 'path': case 'elevator': case 'cart': case 'ship': case 'trigger': {
          if ((this.kind === 'elevator' || this.kind === 'trigger' || this.kind === 'cart') && !this.started) {
            if (this.ridden() || (p.ch && g.sig[p.ch])) { this.started = true; this.timer = this.kind === 'cart' ? 20 : 30; }
            else break;
          }
          if (this.timer > 0) { this.timer--; break; }
          const a = this.pts[this.seg], b = this.pts[this.seg + this.dirSeg];
          if (!b) break;
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          this.segT += this.speed / len;
          if (this.segT >= 1) {
            this.segT = 0; this.seg += this.dirSeg;
            const end = this.seg + this.dirSeg < 0 || this.seg + this.dirSeg >= this.pts.length;
            if (end) {
              if (p.loop) { this.seg = 0; this.dirSeg = 1; this.loopJump = true; }
              else if (this.kind === 'cart' || p.once) { this.stopped = true; this.dirSeg = 0; }
              else { this.dirSeg *= -1; this.timer = p.wait || 0; if (this.kind === 'elevator' && this.seg === 0) { this.started = false; } }
            }
            const q = this.pts[this.seg]; nx = q[0]; ny = q[1];
            if (this.loopJump) { this.loopJump = false; }
          } else { nx = a[0] + (b[0] - a[0]) * this.segT; ny = a[1] + (b[1] - a[1]) * this.segT; }
          if (this.kind === 'cart' && this.started && !this.stopped && this.t % 6 === 0) AF.fx.dust(g, this.x + 4, this.y + this.h, 1, '#ffa040');
          break;
        }
        case 'sine': { const per = p.per || 180, k = Math.sin((this.t / per) * Math.PI * 2); nx = this.x0 + k * (p.ax || 0) * TS; ny = this.y0 + k * (p.ay || 0) * TS; break; }
        case 'circle': { const per = p.per || 240, a = (this.t / per) * Math.PI * 2 * (p.cw === false ? -1 : 1) + (p.ang || 0); nx = this.x0 + Math.cos(a) * (p.r || 3) * TS; ny = this.y0 + Math.sin(a) * (p.r || 3) * TS; break; }
        case 'sink': case 'leaf': case 'sinklava': {
          const rid = this.ridden();
          if (this.state === 0) {
            if (rid) { ny = this.y + (p.sink || .55); this.shake = 0; if (ny - this.y0 > (p.max || 90)) { this.state = 1; this.vy = 1; } }
            else if (this.y > this.y0) ny = Math.max(this.y0, this.y - .5);
          } else if (this.state === 1) { this.vy = Math.min(4, this.vy + .15); ny = this.y + this.vy; if (ny > g.lv.ph + 40) { this.state = 2; this.timer = 120; this.solid = false; } }
          else { if (--this.timer <= 0) { this.state = 0; this.solid = true; nx = this.x0; ny = this.y0; this.alpha = 0; } }
          if (this.alpha < 1) this.alpha = Math.min(1, this.alpha + .05);
          if (this.kind === 'leaf' && this.state === 0) nx = this.x0 + Math.sin(this.t * .03) * 2;
          break;
        }
        case 'fall': case 'crumble': {
          if (this.state === 0 && this.ridden()) { this.state = 1; this.timer = p.delay || 30; AF.Audio.sfx('crumble'); }
          if (this.state === 1) { this.shake = (this.t & 2) ? 1 : -1; if (--this.timer <= 0) { this.state = 2; this.vy = 0; if (this.kind === 'crumble') { this.solid = false; AF.fx.debris(g, this.cx, this.cy, this.style === 'ice' ? '#a0e0ff' : '#c89050', 8); this.timer = p.respawn || 150; this.state = 3; } } }
          if (this.state === 2) { this.vy = Math.min(5, this.vy + .25); ny = this.y + this.vy; if (ny > g.lv.ph + 40) { this.state = 3; this.solid = false; this.timer = p.respawn || 150; } }
          if (this.state === 3) { if (--this.timer <= 0 && !AF.rectsHit(g.player.x, g.player.y, g.player.w, g.player.h, this.x0, this.y0 - 4, this.w, this.h + 8)) { this.state = 0; this.solid = true; nx = this.x0; ny = this.y0; this.alpha = 0; this.shake = 0; } }
          if (this.alpha < 1) this.alpha = Math.min(1, this.alpha + .05);
          break;
        }
        case 'timed': case 'cloud': {
          // cloud: vanish some time after touched; timed: periodic on/off
          if (this.kind === 'cloud') {
            if (this.state === 0 && this.ridden()) { this.state = 1; this.timer = p.delay || 50; }
            if (this.state === 1) { if (--this.timer <= 0) { this.state = 2; this.solid = false; this.timer = p.respawn || 140; AF.fx.puff(g, this.cx, this.cy); } }
            if (this.state === 2) { if (--this.timer <= 0) { this.state = 0; this.solid = true; this.alpha = 0; } }
            this.alpha = this.state === 2 ? 0 : this.state === 1 ? ((this.timer >> 2) & 1 ? .5 : 1) : Math.min(1, this.alpha + .05);
          } else {
            const per = p.per || 180, on = p.on || 110, ph = (this.t + (p.off || 0)) % per;
            this.solid = ph < on;
            this.alpha = this.solid ? (ph > on - 30 && (ph >> 2) & 1 ? .4 : 1) : .15;
          }
          break;
        }
        case 'rise': { // rises out of lava periodically
          const per = p.per || 240, ph = (this.t + (p.off || 0)) % per, up = (p.dist || 3) * TS;
          let k; if (ph < 40) k = ph / 40; else if (ph < per / 2) k = 1; else if (ph < per / 2 + 40) k = 1 - (ph - per / 2) / 40; else k = 0;
          ny = this.y0 - AF.ease.inOut(k) * up;
          this.solid = ny < this.y0 - 4;
          if (ph === per / 2 + 30 && this.near()) AF.fx.splash(g, this.cx, this.y0, '#ffa020');
          break;
        }
        case 'toggle': {
          const on = !!g.sig[this.ch] !== this.inv;
          this.solid = on; this.alpha = on ? 1 : .25;
          break;
        }
      }
      this.moveBy(nx - this.x, ny - this.y);
    }
    draw(ctx, cx, cy) {
      if (this.state === 3 || (this.kind !== 'toggle' && this.kind !== 'timed' && !this.solid && this.state !== 2)) { if (this.kind !== 'cloud' || this.alpha === 0) return; }
      if (this.alpha <= 0) return;
      const x = Math.round(this.x - cx + (this.shake || 0)), y = Math.round(this.y - cy);
      if (x > AF.W || x + this.w < 0 || y > AF.H + 20 || y + this.h < -20) return;
      ctx.globalAlpha = this.alpha;
      const st = (this.kind === 'toggle' && !this.solid) ? 'crystalOff' : this.style;
      if (this.kind === 'cart') {
        if (this.pts) { ctx.globalAlpha = 1; for (let i = 0; i < this.pts.length - 1; i++) { const a = this.pts[i], q = this.pts[i + 1], n = Math.max(1, Math.round(Math.hypot(q[0] - a[0], q[1] - a[1]) / 6)); for (let k = 0; k <= n; k++) { const rx = Math.round(a[0] + (q[0] - a[0]) * k / n + this.w / 2 - cx), ry = Math.round(a[1] + (q[1] - a[1]) * k / n + this.h + 16 - cy); ctx.fillStyle = '#4a2a14'; ctx.fillRect(rx - 2, ry, 5, 2); ctx.fillStyle = '#9090a0'; ctx.fillRect(rx - 3, ry - 1, 7, 1); } } }
        AF.drawSpr(ctx, AF.SPR.cart, x + this.w / 2, y + this.h + 8, 1);
      }
      else ctx.drawImage(AF.platImg(st, this.w, this.h), x, y);
      if (this.kind === 'ship') { ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x + this.w / 2 - 1, y - 30, 2, 30); ctx.beginPath(); ctx.moveTo(x + this.w / 2 + 1, y - 28); ctx.lineTo(x + this.w / 2 + 18, y - 8); ctx.lineTo(x + this.w / 2 + 1, y - 6); ctx.fill(); }
      if (this.kind === 'elevator' || (this.kind === 'path' && this.p.chains)) { ctx.fillStyle = '#505060'; ctx.fillRect(x + 3, y - 200, 1, 200); ctx.fillRect(x + this.w - 4, y - 200, 1, 200); }
      if (this.convey) { const off = (this.g.t >> 1) % 6; ctx.fillStyle = '#f0c020'; for (let i = off; i < this.w; i += 6) ctx.fillRect(x + (this.convey > 0 ? i : this.w - i), y + 3, 2, 1); }
      ctx.globalAlpha = 1;
    }
  }
  reg('plat', Platform);
  AF.Platform = Platform;

  // grab bar (hangable handle, optionally moving)
  class GrabBar extends Platform {
    constructor(g, d) { d.p.thick = 6; super(g, d); this.solid = false; this.collides = false; this.grabKind = 'bar'; this.kind = d.p.kind || (d.p.path ? 'path' : 'sine'); if (!d.p.path && !d.p.ax && !d.p.ay) this.kind = 'static'; g.grabbables.push(this); }
    update() { if (this.kind === 'static') return; super.update(); }
    moveBy(dx, dy) { const pl = this.g.player; if (pl.hanging === this) { AF.moveX(pl, this.g.lv, dx); pl.y += dy; } this.x += dx; this.y += dy; }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      ctx.fillStyle = '#505868'; ctx.fillRect(x + 2, y - 6, 1, 6); ctx.fillRect(x + this.w - 3, y - 6, 1, 6);
      ctx.fillStyle = '#140a18'; ctx.fillRect(x - 1, y - 1, this.w + 2, 6);
      ctx.fillStyle = '#f0c020'; ctx.fillRect(x, y, this.w, 4); ctx.fillStyle = '#fff080'; ctx.fillRect(x, y, this.w, 1);
      if (this.p.path || this.kind === 'sine') { ctx.fillStyle = '#6a6a80'; ctx.fillRect(x + this.w / 2 - 4, y - 10, 8, 5); }
    }
  }
  reg('bar', GrabBar);

  // ---------------- Swing vine / rope ----------------
  class Rope extends Ent {
    constructor(g, d) {
      super(g, d.x * TS + 8, d.y * TS, 4, 4);
      this.len = (d.p.len || 5) * TS; this.amp = d.p.amp || .7; this.ph = d.p.phase || 0; this.ang = 0; this.av = 0; this.holder = null; this.hk = 1; this.grabKind = 'rope';
      this.w0 = Math.sqrt(.0024 * 1.6 * TS / this.len) * .55 + .012;
      this.vine = d.p.vine !== false;
      g.grabbables.push(this);
    }
    update() {
      if (!this.holder) {
        // free swing with constant amplitude (eases back to its base amplitude after release)
        if (this.freeA === undefined) this.freeA = this.amp;
        this.freeA = AF.approach(this.freeA, this.amp, .003);
        this.ph += this.w0;
        const na = this.freeA * Math.sin(this.ph);
        this.av = na - this.ang; this.ang = na;
      } else {
        this.av += -.0024 * 1.6 * Math.sin(this.ang) * (96 / this.len);
        this.av *= .998;
        this.ang += this.av;
        this.ang = AF.clamp(this.ang, -1.3, 1.3);
      }
    }
    points() { const pts = []; const n = 10; for (let i = 0; i <= n; i++) { const l = this.len * i / n; pts.push({ x: this.x + Math.sin(this.ang) * l, y: this.y + Math.cos(this.ang) * l }); } return pts; }
    grab(p, k) { this.holder = p; this.hk = Math.max(.5, k); this.av += p.vx * .006 / this.hk; }
    pump(dir) { if (!dir) return; if (Math.sign(this.av) === dir || Math.abs(this.av) < .004) this.av += dir * .0011; }
    holdPoint() { const l = this.len * this.hk; return { x: this.x + Math.sin(this.ang) * l, y: this.y + Math.cos(this.ang) * l }; }
    release() {
      const l = this.len * this.hk, v = this.av * l; this.holder = null;
      this.freeA = Math.max(.15, Math.min(1.2, Math.hypot(this.ang, this.av / this.w0)));
      this.ph = Math.atan2(this.ang / this.freeA, (this.av / this.w0) / this.freeA);
      return { x: Math.cos(this.ang) * v * 1.25, y: -Math.sin(this.ang) * v * 1.25 };
    }
    draw(ctx, cx, cy) {
      const pts = this.points();
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const n = 6;
        for (let k = 0; k < n; k++) { const x = a.x + (b.x - a.x) * k / n - cx, y = a.y + (b.y - a.y) * k / n - cy; ctx.fillStyle = '#140a18'; ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 2); ctx.fillStyle = this.vine ? ((i + k) % 3 ? '#3a9a30' : '#68d040') : '#c8a060'; ctx.fillRect(Math.round(x), Math.round(y), 1, 2); }
        if (this.vine && i % 2 === 1) { ctx.fillStyle = '#58c040'; ctx.fillRect(Math.round(a.x - cx) + 1, Math.round(a.y - cy), 3, 2); }
      }
      ctx.fillStyle = '#5a3820'; ctx.fillRect(Math.round(this.x - cx) - 3, Math.round(this.y - cy) - 2, 7, 3);
    }
  }
  reg('rope', Rope);

  // ---------------- Pickups ----------------
  class Pickup extends Ent {
    constructor(g, d, w, h) { super(g, d.x * TS + (TS - w) / 2, d.y * TS + (TS - h) / 2, w, h); this.by = this.y; this.t = AF.ri(0, 60); this.p = d.p || {}; this.isPickup = true; }
    bob() { this.y = this.by + Math.sin(this.t * .07) * 2; }
  }
  class Coin extends Pickup {
    constructor(g, d) { super(g, d, 10, 12); this.free = !!d.p.free; if (this.free) { this.vx = d.p.vx || 0; this.vy = d.p.vy || -3; this.life = 300; this.x = d.p.px; this.y = d.p.py; } }
    update() {
      this.t++;
      const g = this.g, pl = g.player;
      if (this.free) {
        this.vy += .2; this.life--;
        AF.moveBody(this, g.lv); if (this.onGround) this.vy = -this.vy * .5;
        if (this.life <= 0) this.dead = true;
      }
      if (AF.save.upgrades.magnet && !this.free) {
        const dx = pl.cx - this.cx, dy = pl.cy - this.cy, d = Math.hypot(dx, dy);
        if (d < 48) { this.x += dx / d * 2.5; this.y += dy / d * 2.5; this.by = this.y; }
      }
    }
    touch() { if (this.free && this.life > 280) return; this.dead = true; this.g.addCoins(1); AF.Audio.sfx('coin'); AF.fx.sparkle(this.g, this.cx, this.cy); }
    draw(ctx, cx, cy) { if (this.free && this.life < 60 && (this.t & 2)) return; AF.drawSpr(ctx, AF.SPR.coin[((this.g.t >> 3) + (this.free ? 0 : 0)) & 3], this.cx - cx, this.cy - cy, 1); }
  }
  reg('coin', Coin);
  class HeartPU extends Pickup {
    constructor(g, d) { super(g, d, 12, 11); }
    update() { this.t++; this.bob(); }
    touch() { const pl = this.g.player; this.dead = true; pl.heal(this.p.n || 1); AF.Audio.sfx('heart'); AF.fx.score(this.g, this.cx, this.y, '+@', '#ff8090'); }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, AF.SPR.heart, this.cx - cx, this.y + this.h - cy, 1); }
  }
  reg('heart', HeartPU);
  class OneUp extends Pickup {
    constructor(g, d) { super(g, d, 16, 22); this.by = this.y - 4; }
    update() { this.t++; this.bob(); }
    touch() { this.dead = true; AF.save.lives = Math.min(99, AF.save.lives + 1); AF.Audio.sfx('oneup'); AF.fx.score(this.g, this.cx, this.y, '1UP!', '#60ff60'); }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, AF.SPR.oneup, this.cx - cx, this.y + this.h - cy, 1); }
  }
  reg('oneup', OneUp);
  class Orb extends Pickup {
    constructor(g, d) { super(g, d, 12, 12); }
    update() { this.t++; this.bob(); if (this.t % 20 === 0 && this.near()) AF.fx.sparkle(this.g, this.cx, this.cy); }
    touch() { const pl = this.g.player; this.dead = true; pl.energy = Math.min(AF.maxEnergy(), pl.energy + 1); AF.Audio.sfx('orb'); AF.fx.ring(this.g, this.cx, this.cy, '#80c0ff', 3, 12); }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, AF.SPR.orb[(this.t >> 4) & 1], this.cx - cx, this.cy - cy, 1); }
  }
  reg('orb', Orb);
  class Medal extends Pickup {
    constructor(g, d) { super(g, d, 16, 16); this.id = d.p.id; this.had = !!(g.actRec.med & (1 << this.id)); }
    update() { this.t++; this.bob(); if (this.t % 12 === 0 && this.near()) AF.fx.sparkle(this.g, this.cx, this.cy); }
    touch() { this.dead = true; this.g.gotMedal(this.id); AF.Audio.sfx('medal'); AF.fx.score(this.g, this.cx, this.y, 'MEDALLION!', '#ffe060'); AF.fx.ring(this.g, this.cx, this.cy, '#ffe060', 4, 20); }
    draw(ctx, cx, cy) { if (this.had) ctx.globalAlpha = .45; AF.drawSpr(ctx, AF.SPR.medal[(this.t >> 3) & 3], this.cx - cx, this.cy - cy, 1); ctx.globalAlpha = 1; }
  }
  reg('medal', Medal);
  class Artifact extends Pickup {
    constructor(g, d) { super(g, d, 14, 16); this.had = AF.save.artifacts[g.world - 1]; }
    update() { this.t++; this.bob(); if (this.t % 10 === 0 && this.near()) AF.fx.sparkle(this.g, this.cx, this.cy); }
    touch() { this.dead = true; this.g.gotArtifact(); }
    draw(ctx, cx, cy) { if (this.had) ctx.globalAlpha = .45; AF.drawSpr(ctx, AF.SPR.artifact[(this.t >> 4) & 1], this.cx - cx, this.y + this.h - cy, 1); ctx.globalAlpha = 1; }
  }
  reg('artifact', Artifact);
  class Capsule extends Ent {
    constructor(g, d) { super(g, d.x * TS - 3, d.y * TS - 12, 22, 28); this.ab = d.p.ab; this.got = AF.save.abilities[this.ab]; }
    update() { this.t++; if (!this.got && this.t % 8 === 0 && this.near()) AF.fx.sparkle(this.g, this.cx, this.y + 8); }
    touch() { if (this.got) return; this.got = true; this.g.gainAbility(this.ab); }
    draw(ctx, cx, cy) { if (this.got) { ctx.globalAlpha = .35; } AF.drawSpr(ctx, AF.SPR.capsule[(this.t >> 3) & 3], this.cx - cx, this.y + this.h - cy, 1); ctx.globalAlpha = 1; }
  }
  reg('capsule', Capsule);

  // ---------------- Checkpoint & Goal ----------------
  class Checkpoint extends Ent {
    constructor(g, d) { super(g, d.x * TS + 2, d.y * TS - 18, 12, 34); this.on = false; this.idx = g.ckIdx = (g.ckIdx || 0) + 1; if (g.restoreCk === this.idx) this.on = true; }
    touch() {
      if (this.on) return;
      this.on = true; const g = this.g;
      g.checkpoint = { x: this.cx, y: this.y + this.h, idx: this.idx };
      AF.Audio.sfx('checkpoint'); AF.fx.ring(g, this.cx, this.y + 5, '#ffe040', 3, 18);
      for (let i = 0; i < 6; i++) AF.fx.sparkle(g, this.cx, this.y + 5);
      g.player.heal(1);
    }
    update() { this.t++; }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, AF.SPR.check[this.on ? 1 : 0], this.cx - cx, this.y + this.h - cy, 1); if (this.on && (this.t & 16)) { ctx.globalAlpha = .3; ctx.fillStyle = '#ffe040'; ctx.beginPath(); ctx.arc(Math.round(this.cx - cx), Math.round(this.y + 5 - cy), 7, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
  }
  reg('check', Checkpoint);
  class Goal extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS - 36, 16, 52); this.got = false; this.spin = 0; }
    update() { this.t++; if (this.spin > 0) this.spin--; }
    touch() { if (this.got) return; this.got = true; this.spin = 40; this.g.clearStage(this); AF.Audio.sfx('checkpoint'); for (let i = 0; i < 10; i++) AF.fx.sparkle(this.g, this.x + 16, this.y + 14); }
    draw(ctx, cx, cy) {
      const fr = this.got && this.spin < 20 ? 1 : 0;
      AF.drawSpr(ctx, AF.SPR.goal[fr], this.x + 5 - cx, this.y + this.h - cy, (this.spin > 0 && (this.spin >> 2) & 1) ? -1 : 1);
    }
  }
  reg('goal', Goal);

  // ---------------- Springs & mushrooms ----------------
  class Spring extends Ent {
    constructor(g, d) {
      const mush = d.p.mush;
      super(g, d.x * TS + (mush ? -6 : 0), d.y * TS + (mush ? 4 : 6), mush ? 28 : 16, mush ? 12 : 10);
      this.mush = mush; this.power = d.p.power || (mush ? 6.8 : 7.6); this.sq = 0; this.side = d.p.side || 0; if (d.p.behind) this.z = -1;
    }
    update() { if (this.sq > 0) this.sq--; }
    touch(p) {
      if (p.grav > 0 && p.vy >= -.5 && p.y + p.h <= this.y + 8 + p.vy) {
        p.y = this.y - p.h; p.vy = -this.power; p.onGround = false; p.jumpCut = false; p.djumpUsed = false; p.airDashUsed = false; p.coyote = 0;
        if (p.state !== 'normal' && p.state !== 'kick') p.toNormal();
        p.spinT = 20; this.sq = 10; AF.Audio.sfx(this.mush ? 'boing' : 'spring');
        if (this.side) { p.vx = this.side * 4; p.facing = this.side; }
      }
    }
    draw(ctx, cx, cy) {
      const spr = this.mush ? AF.SPR.mushroom[this.sq ? 1 : 0] : AF.SPR.spring[this.sq ? 1 : 0];
      AF.drawSpr(ctx, spr, this.cx - cx, this.y + this.h - cy + (this.mush ? 0 : 0), 1);
    }
  }
  reg('spring', Spring);
  reg('mushroom', class extends Spring { constructor(g, d) { d.p.mush = true; super(g, d); } });

  // ---------------- Push blocks / crates ----------------
  class PushBlock extends Ent {
    constructor(g, d) {
      super(g, d.x * TS, d.y * TS, 16, 16);
      this.solid = true; this.collides = true; this.kind = d.p.kind || 'crate'; this.grav = 1; this.slide = 0; this.float = d.p.float || this.kind === 'barrel'; this.x0 = this.x; this.y0 = this.y;
      if (this.float) { this.w = 20; this.h = 12; this.oneWay = false; }
      g.bodies.push(this);
      this.noEntCollideSelf = true;
    }
    onPushed(b, dir) {
      if (b !== this.g.player || !b.onGround) return;
      if (this.kind === 'ice') { if (!this.slide) { this.slide = dir * 2.4; AF.Audio.sfx('roll'); } return; }
      if (this.pushCD > 0) return;
      const ox = this.x;
      AF.moveX(this, this.g.lv, dir * .9);
      if (this.x !== ox) { this.pushing = 6; if (this.g.t % 14 === 0) AF.Audio.sfx('step'); }
    }
    update() {
      const g = this.g;
      if (this.pushing > 0) this.pushing--;
      if (this.slide) { const ox = this.x; AF.moveX(this, g.lv, this.slide); if (this.x === ox || this.hitWall) { this.slide = 0; AF.Audio.sfx('land'); g.cam.shake(1, 4); } }
      if (this.float) {
        const z = g.lv.surfaceAt(this.cx);
        if (z && this.y + this.h * .5 > z.top) { this.vy = AF.approach(this.vy, (z.top - this.h * .5 - this.y) * .2, .25); this.vy *= .9; }
        else this.vy = Math.min(4, this.vy + .2);
        // currents push floats too
        for (const zn of g.zones) if (zn.active && AF.rectsHit(this.x, this.y, this.w, this.h, zn.x, zn.y, zn.w, zn.h)) AF.moveX(this, g.lv, zn.fx * 6);
      } else this.vy = Math.min(5, this.vy + .25);
      const oy = this.y;
      const saveSolid = this.solid; this.solid = false;
      const r = AF.moveY(this, g.lv, this.vy, this);
      this.solid = saveSolid;
      const dy = this.y - oy;
      // carry riders
      if (dy) for (const b of g.bodies) if (b !== this && b.ground === this && b.onGround) b.y += dy;
      this.dy = dy;
      if (r.landed) this.vy = 0;
      if (this.y > g.lv.ph + 30) { this.x = this.x0; this.y = this.y0; this.vy = 0; this.slide = 0; AF.fx.puff(g, this.cx, this.cy); }
    }
    draw(ctx, cx, cy) {
      const spr = this.float ? AF.SPR.barrel : this.kind === 'ice' ? AF.SPR.iceblock : this.kind === 'stone' ? AF.SPR.stoneblock : AF.SPR.crate;
      if (this.float) AF.drawSpr(ctx, spr, this.cx - cx, this.y + this.h + 2 - cy, 1);
      else ctx.drawImage(spr.c, Math.round(this.x - cx), Math.round(this.y - cy));
    }
  }
  reg('crate', PushBlock);
  reg('iceblock', class extends PushBlock { constructor(g, d) { d.p.kind = 'ice'; super(g, d); } });
  reg('barrel', class extends PushBlock { constructor(g, d) { d.p.kind = 'barrel'; super(g, d); } });

  // ---------------- Switches & doors ----------------
  class Switch extends Ent {
    constructor(g, d) {
      const k = d.p.kind || 'button';
      super(g, d.x * TS, d.y * TS + (k === 'button' ? 8 : 0), 16, k === 'button' ? 8 : 16);
      this.p_momentary = d.p.momentary; this.kind = k; this.ch = d.p.ch; this.on = false; this.timeT = 0; this.dur = d.p.dur || 300; this.hittable = k !== 'button'; this.toggle = d.p.toggle;
      if (k === 'crystal') { this.y = d.y * TS - 4; this.h = 20; this.x = d.x * TS + 1; this.w = 14; }
    }
    update() {
      const g = this.g;
      if (this.kind === 'button') {
        let pressed = false;
        for (const b of g.bodies) if (!b.dead && b !== this && AF.rectsHit(b.x, b.y + b.h - 2, b.w, 4, this.x + 2, this.y, this.w - 4, 4)) pressed = true;
        if (pressed && !this.on) { this.on = true; AF.Audio.sfx('switch'); g.setSig(this.ch, true); }
        if (!pressed && this.on && this.p_momentary) { this.on = false; g.setSig(this.ch, false); }
      }
      if ((this.kind === 'timed' || this.kind === 'crystal') && this.on) {
        this.timeT--;
        if (this.timeT % 30 === 0 && this.timeT > 0) AF.Audio.sfx(this.timeT < 90 ? 'warn' : 'tally');
        if (this.timeT <= 0) { this.on = false; g.setSig(this.ch, false); AF.Audio.sfx('cancel'); }
      }
    }
    hit(box) {
      if (this.kind === 'button' || this.lastHit === box.id) return false;
      this.lastHit = box.id;
      const g = this.g;
      if (this.kind === 'lever') { this.on = this.toggle ? !this.on : true; g.setSig(this.ch, this.on); AF.Audio.sfx('switch'); return true; }
      this.on = true; this.timeT = this.dur; g.setSig(this.ch, true); AF.Audio.sfx('switch'); AF.fx.ring(g, this.cx, this.cy, '#ffe060', 4, 16);
      return true;
    }
    draw(ctx, cx, cy) {
      const S = AF.SPR;
      if (this.kind === 'button') AF.drawSpr(ctx, S.button[this.on ? 1 : 0], this.cx - cx, this.y + this.h - cy, 1);
      else if (this.kind === 'crystal') { AF.drawSpr(ctx, S.crystal[this.on ? 1 : 0], this.cx - cx, this.y + this.h - cy, 1); if (this.on) { ctx.globalAlpha = .25 + Math.sin(this.g.t * .2) * .1; ctx.fillStyle = '#fff080'; ctx.beginPath(); ctx.arc(Math.round(this.cx - cx), Math.round(this.cy - cy), 12, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
      else { AF.drawSpr(ctx, S.lever[this.on ? 1 : 0], this.cx - cx, this.y + this.h - cy, 1); if (this.kind === 'timed' && this.on) { ctx.fillStyle = '#140a18'; ctx.fillRect(Math.round(this.x - cx), Math.round(this.y - cy) - 6, 16, 4); ctx.fillStyle = '#ffe040'; ctx.fillRect(Math.round(this.x - cx) + 1, Math.round(this.y - cy) - 5, Math.round(14 * this.timeT / this.dur), 2); } }
    }
  }
  reg('switch', Switch);
  class Door extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, 16, (d.p.h || 3) * TS); this.solid = true; this.collides = true; this.ch = d.p.ch; this.y0 = this.y; this.open = 0; this.inv = !!d.p.inv; this.wasOpen = false; this.style = d.p.style; }
    update() {
      const want = !!this.g.sig[this.ch] !== this.inv;
      if (want !== this.wasOpen) { this.wasOpen = want; if (this.near(80)) AF.Audio.sfx('door'); }
      this.open = AF.approach(this.open, want ? 1 : 0, .04);
      const ny = this.y0 - this.open * (this.h - 4);
      this.solid = this.open < .95;
      // don't crush: if closing onto player, stop
      if (ny > this.y && AF.rectsHit(this.g.player.x, this.g.player.y, this.g.player.w, this.g.player.h, this.x, ny, this.w, this.h)) return;
      this.y = ny;
    }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      const visH = Math.round(this.h - this.open * (this.h - 4));
      ctx.save(); ctx.beginPath(); ctx.rect(x, Math.round(this.y0 - cy), 16, this.h); ctx.clip();
      for (let yy = 0; yy < this.h; yy += 48) ctx.drawImage(AF.SPR.door.c, x, y + yy);
      ctx.restore();
      ctx.fillStyle = this.g.sig[this.ch] ? '#40e060' : '#f04040'; ctx.fillRect(x + 6, Math.round(this.y0 - cy) - 4, 4, 3);
    }
  }
  reg('door', Door);

  // water level controller: when channel on, liquid zone #idx moves to top 'to' (tiles)
  class WaterCtl extends Ent {
    constructor(g, d) { super(g, 0, 0, 0, 0); this.ch = d.p.ch; this.idx = d.p.idx || 0; this.to = d.p.to * TS; this.speed = d.p.speed || .5; }
    update() {
      const z = this.g.lv.liquids[this.idx]; if (!z) return;
      const target = this.g.sig[this.ch] ? this.to : z.base;
      if (z.top !== target) { z.top = AF.approach(z.top, target, this.speed); if (this.g.t % 20 === 0) AF.Audio.sfx('bubble'); }
    }
  }
  reg('waterctl', WaterCtl);

  // ---------------- Zones (wind, currents, updrafts, magnets, snowstorm) ----------------
  class Zone extends Ent {
    constructor(g, d) {
      super(g, d.x * TS, d.y * TS, (d.p.w || 4) * TS, (d.p.h || 4) * TS);
      this.fx = d.p.fx || 0; this.fy = d.p.fy || 0; this.maxUp = d.p.maxUp || -3; this.maxX = d.p.maxX || 3.2;
      this.kind = d.p.kind || 'wind'; this.ch = d.p.ch; this.per = d.p.per; this.on = d.p.on || 0; this.off = d.p.off || 0;
      this.active = true; this.p_inv = d.p.inv; this.p_vent = d.p.vent; g.zones.push(this);
    }
    update() {
      const g = this.g;
      this.active = this.ch ? !!g.sig[this.ch] !== !!this.p_inv : true;
      if (this.per) { const ph = (g.t + this.off) % this.per; this.active = this.active && ph < this.on; this.warn = !this.active && ph > this.per - 40; }
      if (!this.active || !this.near(32)) return;
      // visual particles
      const k = this.kind;
      if (g.t % (k === 'storm' ? 1 : 3) === 0) {
        const x = this.x + Math.random() * this.w, y = this.y + Math.random() * this.h;
        if (k === 'wind' || k === 'storm') g.parts.add({ x, y, vx: this.fx * 40, vy: this.fy * 30 + AF.rr(-.2, .2), life: 30, col: k === 'storm' ? '#ffffff' : '#e0f0ff', size: 1, fade: true });
        else if (k === 'updraft') g.parts.add({ x, y: this.y + this.h, vx: AF.rr(-.2, .2), vy: -3, life: Math.floor(this.h / 3), col: '#e0f8ff', size: 1, fade: true });
        else if (k === 'current') g.parts.add({ x, y, vx: this.fx * 30, vy: this.fy * 30, life: 40, spr: AF.SPR.fx.bubble });
        else if (k === 'magnet') g.parts.add({ x, y: this.y + this.h, vy: -2, life: 20, col: '#ff60a0', size: 1, fade: true });
        else if (k === 'steam') g.parts.add({ x, y: this.y + this.h, vx: AF.rr(-.3, .3), vy: -3.5, life: Math.floor(this.h / 3.5), col: '#f0f0f8', size: 3, fade: true });
      }
    }
    draw(ctx, cx, cy) {
      if (this.kind === 'magnet') {
        const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
        ctx.fillStyle = '#140a18'; ctx.fillRect(x - 1, y - 9, this.w + 2, 10);
        ctx.fillStyle = this.active ? '#e03060' : '#603040'; ctx.fillRect(x, y - 8, this.w, 8);
        ctx.fillStyle = '#c0c0d0'; ctx.fillRect(x, y - 3, this.w, 3);
        if (this.active) { ctx.globalAlpha = .12; ctx.fillStyle = '#ff60a0'; ctx.fillRect(x, y, this.w, this.h); ctx.globalAlpha = 1; }
      }
      if ((this.kind === 'steam' || this.kind === 'updraft') && this.p_vent !== false) {
        for (let i = 0; i < this.w; i += 32) AF.drawSpr(ctx, AF.SPR.fan[(this.active && (this.g.t & 4)) ? 1 : 0], this.x + i + 16 - cx, this.y + this.h - cy, 1);
        if (this.warn && (this.g.t & 4)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(this.x - cx), Math.round(this.y + this.h - cy) - 12, this.w, 1); }
      }
    }
  }
  reg('zone', Zone);

  // ---------------- Periodic hazards ----------------
  // kind: geyser (fire column up), laser (beam), lightning (column strike), efloor (electric tiles), flame (pillar)
  class Hazard extends Ent {
    constructor(g, d) {
      const p = d.p;
      super(g, d.x * TS, d.y * TS, (p.w || 1) * TS, (p.h || 1) * TS);
      this.kind = p.kind; this.per = p.per || 150; this.on = p.on || 50; this.off = p.off || 0; this.warnT = p.warn || 40; this.ch = p.ch; this.dir = p.dir || 'v';
      this.active = false; this.warning = false; this.always = p.always; this.p_hgt = p.hgt; this.p_invch = p.invch;
      if (this.kind === 'laser') this.computeBeam();
    }
    computeBeam() {
      // beam from emitter downward (v) or rightward (h) until a solid tile
      const lv = this.g.lv;
      if (this.dir === 'v') { let ty = Math.floor(this.y / TS) + 1; while (ty < lv.h && !(AF.TFLAGS[Math.max(0, lv.get(Math.floor(this.cx / TS), ty))] & F.SOLID)) ty++; this.bh = ty * TS - this.y; this.bw = 4; }
      else { let tx = Math.floor(this.x / TS) + 1; while (tx < lv.w && !(AF.TFLAGS[Math.max(0, lv.get(tx, Math.floor(this.cy / TS)))] & F.SOLID)) tx++; this.bw = tx * TS - this.x; this.bh = 4; }
    }
    update() {
      const g = this.g;
      const ph = (g.t + this.off) % this.per;
      let en = this.ch ? !g.sig[this.ch] : true; // channel disables hazard (e.g. security off)
      if (this.p_invch) en = !en;
      this.active = en && (this.always || ph < this.on);
      this.warning = en && !this.always && ph >= this.per - this.warnT;
      if (!this.near(40)) return;
      if (this.active && ph === 0 && !this.always) AF.Audio.sfx(this.kind === 'geyser' ? 'fire' : this.kind === 'lightning' ? 'thunder' : this.kind === 'laser' ? 'laser' : this.kind === 'steamv' ? 'steam' : 'zap');
      if (this.active && this.kind === 'lightning' && ph === 0) g.cam.shake(2, 6);
      const box = this.hurtBox();
      if (this.active && box) {
        const pl = g.player;
        if (AF.rectsHit(pl.x, pl.y, pl.w, pl.h, box.x, box.y, box.w, box.h)) pl.hurt(1, box.x + box.w / 2);
        if (this.kind === 'geyser' && g.t % 2 === 0) g.parts.add({ x: box.x + Math.random() * box.w, y: box.y + box.h, vy: -AF.rr(2, 4), life: 20, col: AF.pick(['#ff4010', '#ffa020', '#ffe060']), size: 3, shrink: true });
        if (this.kind === 'efloor' && g.t % 3 === 0) g.parts.add({ x: box.x + Math.random() * box.w, y: box.y + box.h - 2, vy: -1, life: 8, col: AF.pick(['#fff060', '#80f0ff']), size: 1 });
      }
    }
    hurtBox() {
      switch (this.kind) {
        case 'geyser': return { x: this.x + 3, y: this.y + this.h - (this.p_hgt || 5) * TS, w: this.w - 6, h: (this.p_hgt || 5) * TS - 4 };
        case 'laser': return this.dir === 'v' ? { x: this.cx - 2, y: this.y + 8, w: 4, h: this.bh - 8 } : { x: this.x + 8, y: this.cy - 2, w: this.bw - 8, h: 4 };
        case 'lightning': return { x: this.x + 2, y: 0, w: this.w - 4, h: this.y + this.h };
        case 'efloor': return { x: this.x, y: this.y - 4, w: this.w, h: 8 };
        case 'flame': return { x: this.x + 2, y: this.y, w: this.w - 4, h: this.h };
      }
      return null;
    }
    draw(ctx, cx, cy) {
      const g = this.g, t = g.t;
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy);
      if (this.kind === 'geyser') {
        AF.drawSpr(ctx, AF.SPR.vent, x + this.w / 2, y + this.h, 1);
        const b = this.hurtBox();
        if (this.active) {
          const by = Math.round(b.y - cy);
          for (let yy = by; yy < y + this.h - 6; yy += 2) { const w = 6 + Math.sin(yy * .3 + t * .5) * 2; ctx.fillStyle = yy < by + 10 ? '#ffe060' : ((yy + t) & 4) ? '#ff6020' : '#ffa020'; ctx.fillRect(Math.round(x + this.w / 2 - w / 2), yy, Math.round(w), 2); }
        } else if (this.warning && (t & 4)) { ctx.fillStyle = '#ff8020'; ctx.fillRect(x + this.w / 2 - 3, y + this.h - 10, 6, 3); }
      } else if (this.kind === 'laser') {
        if (this.dir === 'v') { AF.drawSpr(ctx, AF.SPR.emitter, x + this.w / 2, y, 1); }
        else { ctx.fillStyle = '#4a4a60'; ctx.fillRect(x, y + this.h / 2 - 5, 8, 10); ctx.fillStyle = '#ff2040'; ctx.fillRect(x + 6, y + this.h / 2 - 1, 2, 2); }
        const b = this.hurtBox();
        if (this.active) {
          const bx = Math.round(b.x - cx), by = Math.round(b.y - cy);
          ctx.fillStyle = '#ff2060'; ctx.fillRect(bx, by, b.w, b.h); ctx.fillStyle = '#ffffff';
          if (this.dir === 'v') ctx.fillRect(bx + 1, by, 2, b.h); else ctx.fillRect(bx, by + 1, b.w, 2);
        } else if (this.warning) {
          ctx.fillStyle = (t & 2) ? '#ff2060' : '#802040'; const bx = Math.round(b.x - cx), by = Math.round(b.y - cy);
          if (this.dir === 'v') for (let k = 0; k < b.h; k += 6) ctx.fillRect(bx + 1, by + k, 1, 3); else for (let k = 0; k < b.w; k += 6) ctx.fillRect(bx + k, by + 1, 3, 1);
        }
      } else if (this.kind === 'lightning') {
        const b = this.hurtBox();
        if (this.warning) { ctx.globalAlpha = (t & 4) ? .35 : .15; ctx.fillStyle = '#fff080'; ctx.fillRect(x + 2, 0, this.w - 4, y + this.h - cy + cy); ctx.globalAlpha = 1; ctx.fillStyle = '#fff080'; ctx.fillRect(x + this.w / 2 - 4, y + this.h - 3, 8, 3); }
        if (this.active) {
          let lx = x + this.w / 2; ctx.fillStyle = '#ffffff';
          for (let yy = -cy % 8 - 8; yy < y + this.h; yy += 8) { const nx = x + this.w / 2 + Math.round(Math.sin(yy * 1.7 + t) * 4); ctx.fillStyle = '#c0e0ff'; ctx.fillRect(Math.min(lx, nx) - 1, yy, Math.abs(nx - lx) + 3, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.min(lx, nx), yy, Math.abs(nx - lx) + 1, 8); lx = nx; }
          ctx.globalAlpha = .4; ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y + this.h - 8, this.w + 8, 8); ctx.globalAlpha = 1;
        }
      } else if (this.kind === 'efloor') {
        if (this.active) { ctx.fillStyle = (t & 2) ? '#fff060' : '#80f0ff'; for (let i = 0; i < this.w; i += 4) { const h = 2 + ((i * 7 + t) % 5); ctx.fillRect(x + i + ((t >> 1) & 3), y - h, 1, h); } }
        else if (this.warning && (t & 4)) { ctx.fillStyle = '#fff060'; ctx.fillRect(x, y - 1, this.w, 1); }
      } else if (this.kind === 'flame') {
        if (this.active) { for (let yy = 0; yy < this.h; yy += 2) { const w = this.w - 4 + Math.sin(yy * .4 + t * .5) * 3; ctx.fillStyle = ((yy + t) & 4) ? '#ff6020' : '#ffd040'; ctx.fillRect(Math.round(x + this.w / 2 - w / 2), y + yy, Math.round(w), 2); } }
        else if (this.warning && (t & 4)) { ctx.fillStyle = '#ff8020'; ctx.fillRect(x, y + this.h - 3, this.w, 3); }
      }
    }
  }
  reg('hazard', Hazard);

  // ---------------- Falling hazards: acorns, icicles, rocks ----------------
  class Faller extends Ent {
    constructor(g, x, y, spr, opts) { super(g, x - 5, y - 5, 10, 10); this.spr = spr; this.vy = opts.vy || 0; this.dmg = 1; this.grav = opts.grav || .2; this.bounce = opts.bounce; this.life = 300; this.big = opts.big; this.hittable = !!opts.hittable; this.sfx = opts.sfx; if (this.big) { this.w = 14; this.h = 14; } }
    update() {
      const g = this.g;
      this.vy = Math.min(6, this.vy + this.grav); this.y += this.vy; this.x += this.vx;
      if (--this.life < 0) this.dead = true;
      if (AF.rectSolid(g.lv, this.x + 2, this.y + this.h - 2, this.w - 4, 2) || g.lv.liquidAt(this.cx, this.y + this.h)) {
        if (this.bounce && this.bounce-- > 0) { this.vy = -2.5; this.vx = AF.rr(-1, 1); this.y -= 2; return; }
        this.dead = true; AF.fx.debris(g, this.cx, this.cy, this.debrisCol || '#a07040', 4); if (this.near()) AF.Audio.sfx(this.sfx || 'break');
      }
    }
    touch(p) { p.hurt(this.dmg, this.cx); }
    hit(box) { if (!this.hittable) return false; this.dead = true; AF.fx.hit(this.g, this.cx, this.cy); AF.Audio.sfx('clink'); return true; }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, this.spr, this.cx - cx, this.cy - cy, 1); }
  }
  AF.Faller = Faller;
  // dropper: spawns fallers periodically or when player beneath
  class Dropper extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, (d.p.w || 1) * TS, TS); this.kind = d.p.kind || 'acorn'; this.per = d.p.per || 120; this.t = d.p.off || 0; this.state = 0; this.timer = 0; this.range = (d.p.range || 2) * TS; this.respawn = d.p.respawn; }
    update() {
      const g = this.g, pl = g.player;
      this.t++;
      if (!this.near(16)) return;
      if (this.kind === 'icicle') {
        if (this.state === 0 && Math.abs(pl.cx - this.cx) < this.range && pl.y > this.y) { this.state = 1; this.timer = 24; AF.Audio.sfx('crumble'); }
        if (this.state === 1 && --this.timer <= 0) { this.state = 2; const f = new Faller(g, this.cx, this.y + 8, AF.SPR.icicle, { vy: 1, grav: .3, sfx: 'clink' }); f.debrisCol = '#c0f0ff'; f.h = 16; g.spawn(f); this.timer = this.respawn || 240; }
        if (this.state === 2 && this.respawn && --this.timer <= 0) this.state = 0;
        return;
      }
      if (this.t % this.per === 0) {
        const x = this.x + Math.random() * this.w;
        let f;
        if (this.kind === 'acorn') f = new Faller(g, x, this.y, AF.SPR.acorn, { grav: .15, bounce: 1, hittable: true });
        else if (this.kind === 'macorn') f = new Faller(g, x, this.y, AF.SPR.macorn, { grav: .18, hittable: true });
        else if (this.kind === 'rock') { f = new Faller(g, x, this.y, AF.SPR.rock, { grav: .18, big: true }); f.debrisCol = '#5a2a24'; }
        else if (this.kind === 'debris') { f = new Faller(g, x, this.y, AF.SPR.debris, { grav: .2, big: true }); f.debrisCol = '#707088'; }
        if (f) { g.spawn(f); g.shadows.push({ x, t: 40 }); }
      }
    }
    draw(ctx, cx, cy) {
      if (this.kind === 'icicle' && this.state !== 2) AF.drawSpr(ctx, AF.SPR.icicle, this.cx - cx + (this.state === 1 ? ((this.g.t & 2) ? 1 : -1) : 0), this.y - cy, 1);
    }
  }
  reg('dropper', Dropper);

  // rolling boulder spawner / avalanche
  class Roller extends Ent {
    constructor(g, x, y, dir, big) { super(g, x, y - (big ? 44 : 28), big ? 44 : 28, big ? 44 : 28); this.dir = dir; this.vx = dir * (big ? 2.2 : 2.4); this.big = big; this.grav = 1; this.noEntCollide = true; this.hittable = !big; this.hp = 3; this.rot = 0; }
    update() {
      const g = this.g;
      this.vy = Math.min(6, this.vy + .3);
      AF.moveBody(this, g.lv);
      if (this.hitWall) { this.dead = true; AF.fx.debris(g, this.cx, this.cy, this.big ? '#ffffff' : '#a07040', 10); AF.Audio.sfx('break'); g.cam.shake(2, 8); }
      this.vx = this.dir * (this.big ? 2.2 : 2.4);
      this.rot += this.vx * .08;
      if (this.y > g.lv.ph) this.dead = true;
      if (g.t % 8 === 0 && this.onGround) { AF.fx.dust(g, this.cx - this.dir * this.w / 2, this.y + this.h, 2, this.big ? '#ffffff' : '#c8a070'); if (this.big) g.cam.shake(1, 4); }
    }
    touch(p) { p.hurt(this.big ? 2 : 1, this.cx); }
    hit(box) { if (!this.hittable || box.id === this.lastHit) return false; this.lastHit = box.id; if (--this.hp <= 0 || box.kind === 'charge') { this.dead = true; AF.fx.debris(this.g, this.cx, this.cy, '#a07040', 10); AF.Audio.sfx('break'); this.g.addScore(200, this.cx, this.y); } else AF.Audio.sfx('clink'); return true; }
    draw(ctx, cx, cy) { const fr = (((Math.floor(this.rot * 2)) % 4) + 4) % 4; AF.drawSpr(ctx, this.big ? AF.SPR.snowball[fr] : AF.SPR.boulder[fr], this.cx - cx, this.y + this.h - cy, 1); }
  }
  AF.Roller = Roller;
  class RollerSpawn extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, 16, 16); this.dir = d.p.dir || 1; this.per = d.p.per || 200; this.t = d.p.off || 0; this.big = d.p.big; this.range = (d.p.range || 20) * TS; }
    update() { this.t++; const pl = this.g.player; if (Math.abs(pl.cx - this.cx) < this.range && this.t % this.per === 0) { this.g.spawn(new Roller(this.g, this.x, this.y + 16, this.dir, this.big)); AF.Audio.sfx('crumble'); } }
  }
  reg('rollers', RollerSpawn);
  // avalanche / rising chase wall: moves right at speed once triggered
  class Chaser extends Ent {
    constructor(g, d) { super(g, d.x * TS, 0, 48, g.lv.ph); this.speed = d.p.speed || 1.6; this.started = false; this.kind = d.p.kind || 'snow'; this.endX = (d.p.end || 9999) * TS; this.ch = d.p.ch || 'chase'; }
    update() {
      const g = this.g, pl = g.player;
      if (!this.started) { if (g.sig[this.ch]) { this.started = true; AF.Audio.sfx('roar'); } else return; }
      if (this.x + this.w > this.endX) return;
      const dist = pl.x - (this.x + this.w);
      this.x += dist > 200 ? this.speed * 2 : this.speed;
      if (g.t % 4 === 0) g.cam.shake(1, 4);
      if (g.t % 30 === 0) AF.Audio.sfx('crumble');
      if (pl.x < this.x + this.w - 6) { pl.hurt(1, this.x); if (pl.state !== 'dead') { pl.x = this.x + this.w + 2; pl.vx = 3; } }
      for (let i = 0; i < 2; i++) g.parts.add({ x: this.x + this.w, y: g.cam.y + Math.random() * AF.H, vx: AF.rr(0, 1.5), vy: AF.rr(-1, 1), life: 20, col: '#ffffff', size: 3, shrink: true });
    }
    draw(ctx, cx, cy) {
      if (!this.started) return;
      const x = Math.round(this.x - cx);
      if (x + this.w < 0) { return; }
      for (let y = -16; y < AF.H + 16; y += 22) { const yy = y + ((this.g.t * 2) % 22); AF.drawSpr(ctx, AF.SPR.snowball[(this.g.t >> 3) & 3], x + 24 + Math.sin(yy * .2) * 4, yy, 1); }
      ctx.fillStyle = '#e8f0ff'; ctx.fillRect(x - 200, 0, 220, AF.H);
    }
  }
  reg('chaser', Chaser);

  // rising liquid (timed escape): starts when channel set
  class Riser extends Ent {
    constructor(g, d) { super(g, 0, 0, 0, 0); this.idx = d.p.idx || 0; this.speed = d.p.speed || .45; this.ch = d.p.ch || 'rise'; this.stopAt = (d.p.stop || 0) * TS; }
    update() {
      const g = this.g, z = g.lv.liquids[this.idx]; if (!z || !g.sig[this.ch]) return;
      const pl = g.player;
      const gap = z.top - (pl.y + pl.h);
      const sp = gap > 120 ? this.speed * 2.5 : this.speed;
      if (z.top > this.stopAt) z.top -= sp;
      if (g.t % 6 === 0) AF.fx.ember(g, z.x + Math.random() * z.w, z.top);
      if (g.t % 3 === 0) g.cam.shake(.6, 3);
    }
  }
  reg('riser', Riser);

  // ---------------- Triggers (dialogue, camera, signals) ----------------
  class Trigger extends Ent {
    constructor(g, d) { super(g, d.x * TS, (d.p.y0 !== undefined ? d.p.y0 : 0) * TS, (d.p.w || 1) * TS, (d.p.h || g.lv.h) * TS); this.p = d.p; this.done = false; }
    touch() {
      if (this.done) return; this.done = true;
      const g = this.g, p = this.p;
      if (p.sig) g.setSig(p.sig, true);
      if (p.talk) g.talk(p.talk);
      if (p.music) AF.Audio.music(p.music);
      if (p.boss) g.startBoss();
      if (p.lockLeft) g.camMinX = this.x - AF.W / 2;
      if (p.msg) g.toast(p.msg);
    }
  }
  reg('trigger', Trigger);

  // ---------------- Teleporter ----------------
  class Teleporter extends Ent {
    constructor(g, d) { super(g, d.x * TS - 4, d.y * TS + 6, 24, 10); this.id = d.p.id; this.to = d.p.to; this.cd = 0; }
    update() { this.t++; if (this.cd > 0) this.cd--; if (this.t % 6 === 0 && this.near()) this.g.parts.add({ x: this.x + 4 + Math.random() * 16, y: this.y, vy: -1, life: 18, col: '#80ffe0', size: 1, fade: true }); }
    touch(p) {
      if (this.cd > 0 || p.state !== 'normal' || !p.onGround || !AF.Input.pressed.up) return;
      const dest = this.g.ents.find(e => e instanceof Teleporter && e.id === this.to);
      if (!dest) return;
      AF.Audio.sfx('teleport'); AF.fx.ring(this.g, p.cx, p.cy, '#80ffe0', 4, 20);
      p.x = dest.cx - p.w / 2; p.y = dest.y - p.h - 1; p.vx = 0; p.vy = 0; dest.cd = 30; this.cd = 30;
      AF.fx.ring(this.g, p.cx, p.cy, '#80ffe0', 20, -18);
      this.g.cam.snap(this.g);
    }
    draw(ctx, cx, cy) {
      AF.drawSpr(ctx, AF.SPR.tele[(this.t >> 3) & 1], this.cx - cx, this.y + this.h - cy, 1);
      const pl = this.g.player;
      if (AF.overlap(pl, this) && (this.t & 16)) AF.text(ctx, '^', Math.round(this.cx - cx), Math.round(this.y - cy) - 38, '#80ffe0', { a: 'c' });
    }
  }
  reg('tele', Teleporter);

  // ---------------- Gravity switch ----------------
  class GravSwitch extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, 16, 16); this.hittable = true; this.cd = 0; this.dirSet = d.p.set; }
    update() { this.t++; if (this.cd > 0) this.cd--; }
    touch(p) { if (this.cd === 0 && this.dirSet === undefined) { } }
    hit(box) {
      if (this.cd > 0) return false;
      this.cd = 30; const p = this.g.player;
      const ng = this.dirSet !== undefined ? this.dirSet : -p.grav;
      if (ng !== p.grav) { p.grav = ng; p.vy = 0; p.onGround = false; AF.Audio.sfx('teleport'); AF.fx.ring(this.g, this.cx, this.cy, '#ff80ff', 4, 24); this.g.cam.shake(2, 8); }
      return true;
    }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy), up = this.g.player.grav < 0;
      ctx.fillStyle = '#140a18'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#6040a0'; ctx.fillRect(x + 1, y + 1, 14, 14); ctx.fillStyle = (this.t & 16) ? '#ff80ff' : '#c060e0';
      AF.text(ctx, up ? 'v' : '^', x + 8, y + 4, (this.t & 16) ? '#ffffff' : '#ffb0ff', { a: 'c', o: null });
    }
  }
  reg('gravsw', GravSwitch);

  // ---------------- Light beam puzzle (sun emitter, mirrors, receptor) ----------------
  class SunEmitter extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, 16, 16); this.dir = d.p.dir || [1, 0]; this.path = []; this.ch = d.p.ch; }
    update() {
      const g = this.g, lv = g.lv;
      let x = Math.floor(this.cx / TS), y = Math.floor(this.cy / TS), dx = this.dir[0], dy = this.dir[1];
      this.path = [[this.cx, this.cy]];
      let lit = null;
      for (let i = 0; i < 80; i++) {
        x += dx; y += dy;
        const t = lv.get(x, y);
        if (t === -1 || (AF.TFLAGS[t] & F.SOLID)) { this.path.push([x * TS + 8 - dx * 8, y * TS + 8 - dy * 8]); break; }
        const m = g.mirrors.find(e => Math.floor(e.cx / TS) === x && Math.floor((e.y + 8) / TS) === y);
        if (m) {
          this.path.push([x * TS + 8, y * TS + 8]);
          if (m.recv) { lit = m; break; }
          // '/' (o=0): (1,0)->(0,-1); '\' (o=1): (1,0)->(0,1)
          if (m.o === 0) { const ndx = -dy, ndy = -dx; dx = ndx; dy = ndy; } else { const ndx = dy, ndy = dx; dx = ndx; dy = ndy; }
        }
      }
      for (const m of g.mirrors) if (m.recv) { const was = m.lit; m.lit = m === lit; if (m.lit && !was) { AF.Audio.sfx('medal'); g.setSig(m.ch, true); } }
    }
    draw(ctx, cx, cy) {
      AF.drawSpr(ctx, AF.SPR.emitterSun, this.cx - cx, this.y + 16 - cy, 1);
      const t = this.g.t;
      for (let i = 0; i < this.path.length - 1; i++) {
        const a = this.path[i], b = this.path[i + 1];
        const x0 = Math.min(a[0], b[0]) - cx, y0 = Math.min(a[1], b[1]) - cy, w = Math.abs(a[0] - b[0]), h = Math.abs(a[1] - b[1]);
        ctx.fillStyle = '#ffd040'; ctx.fillRect(Math.round(x0) - 1, Math.round(y0) - 1, Math.round(w) + 3, Math.round(h) + 3);
        ctx.fillStyle = (t & 4) ? '#ffffff' : '#fff8c0'; ctx.fillRect(Math.round(x0), Math.round(y0), Math.round(w) + 1, Math.round(h) + 1);
      }
    }
  }
  reg('sun', SunEmitter);
  class Mirror extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, 16, 16); this.o = d.p.o || 0; this.hittable = true; this.recv = !!d.p.recv; this.ch = d.p.ch; this.fixed = d.p.fixed; g.mirrors.push(this); }
    hit(box) { if (this.recv || this.fixed || box.id === this.lastHit) return false; this.lastHit = box.id; this.o = 1 - this.o; AF.Audio.sfx('switch'); return true; }
    draw(ctx, cx, cy) {
      if (this.recv) AF.drawSpr(ctx, AF.SPR.receptor[this.lit ? 1 : 0], this.cx - cx, this.y + 16 - cy, 1);
      else { AF.drawSpr(ctx, AF.SPR.mirror[this.o], this.cx - cx, this.y + 16 - cy, 1); if (!this.fixed && (this.g.t & 32)) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(this.cx - cx), Math.round(this.y - cy) - 3, 1, 1); } }
    }
  }
  reg('mirror', Mirror);

  // ---------------- Waterfall (front decor hiding secrets) ----------------
  class Waterfall extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS, (d.p.w || 2) * TS, (d.p.h || 6) * TS); this.z = 10; this.lava = d.p.lava; }
    update() { if (this.g.t % 6 === 0 && this.near()) AF.fx.splash(this.g, this.x + Math.random() * this.w, this.y + this.h, this.lava ? '#ffa020' : null); }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy), t = this.g.t;
      const pl = this.g.player; const inside = AF.overlap(pl, this);
      ctx.globalAlpha = inside ? .45 : .88;
      for (let i = 0; i < this.w; i++) {
        const c = this.lava ? (((i * 7) % 5 < 2) ? '#ffa020' : '#ff6010') : (((i * 7) % 5 < 2) ? '#c0f0ff' : '#58b0f0');
        ctx.fillStyle = c; ctx.fillRect(x + i, y, 1, this.h);
        ctx.fillStyle = this.lava ? '#ffe060' : '#ffffff';
        for (let k = (i * 13 + t * 3) % 24; k < this.h; k += 24) ctx.fillRect(x + i, y + k, 1, 5);
      }
      ctx.globalAlpha = 1;
    }
  }
  reg('waterfall', Waterfall);

  // ---------------- Bubble vent (oxygen) ----------------
  class BubbleVent extends Ent {
    constructor(g, d) { super(g, d.x * TS, d.y * TS + 8, 16, 8); this.per = d.p.per || 90; this.t = d.p.off || 0; }
    update() {
      this.t++;
      if (this.t % this.per === 0) this.g.spawn(new AirBubble(this.g, this.cx, this.y));
      if (this.t % 10 === 0 && this.near()) AF.fx.bubble(this.g, this.cx + AF.rr(-3, 3), this.y);
    }
    draw(ctx, cx, cy) { const x = Math.round(this.x - cx), y = Math.round(this.y - cy); ctx.fillStyle = '#140a18'; ctx.fillRect(x, y, 16, 8); ctx.fillStyle = '#506080'; ctx.fillRect(x + 1, y + 1, 14, 6); ctx.fillStyle = '#90a8c8'; ctx.fillRect(x + 1, y + 1, 14, 1); ctx.fillStyle = '#203048'; ctx.fillRect(x + 5, y + 2, 6, 3); }
  }
  reg('bubblevent', BubbleVent);
  class AirBubble extends Ent {
    constructor(g, x, y) { super(g, x - 6, y - 12, 12, 12); this.life = 400; }
    update() { this.t++; this.y -= .5; this.x += Math.sin(this.t * .08) * .3; if (--this.life <= 0 || !this.g.lv.liquidAt(this.cx, this.y)) this.dead = true; }
    touch(p) { this.dead = true; p.o2 = AF.PC.o2; AF.Audio.sfx('bubble'); AF.fx.score(this.g, this.cx, this.y, 'AIR!', '#a0e8ff'); }
    draw(ctx, cx, cy) { const x = Math.round(this.cx - cx), y = Math.round(this.cy - cy); ctx.strokeStyle = '#e0f8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 5 + Math.sin(this.t * .2) * .5, 0, 7); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 3, 2, 2); }
  }

  // ---------------- Player energy wave ----------------
  class EnergyWave extends Ent {
    constructor(g, x, y, dir, grav) { super(g, x, y, 16, 12); this.dir = dir; this.vx = dir * 4.6; this.life = 70; this.id = 'w' + Math.random(); }
    update() {
      const g = this.g;
      this.x += this.vx; this.life--;
      g.attack({ x: this.x, y: this.y, w: this.w, h: this.h, dmg: 2 * g.player.power(), kind: 'wave', id: this.id, dir: this.dir, knock: 2.5, owner: this, proj: true, brk: 1 });
      if (AF.rectSolid(g.lv, this.x + 4, this.y + 2, this.w - 8, this.h - 4) || this.life <= 0) { this.dead = true; AF.fx.hit(g, this.cx, this.cy); }
      if (g.t % 2 === 0) g.parts.add({ x: this.cx - this.dir * 6, y: this.cy + AF.rr(-3, 3), life: 12, col: '#80c0ff', size: 2, shrink: true });
    }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, AF.SPR.wave[(this.g.t >> 2) & 1], this.cx - cx, this.cy - cy, this.dir); }
  }
  AF.EnergyWave = EnergyWave;

  // ---------------- Generic projectile (enemies/bosses) ----------------
  class Shot extends Ent {
    constructor(g, x, y, vx, vy, o) {
      o = o || {};
      const sz = o.size || 6;
      super(g, x - sz / 2, y - sz / 2, sz, sz);
      this.vx = vx; this.vy = vy; this.spr = o.spr || AF.SPR.bullet; this.grav = o.grav || 0; this.life = o.life || 240; this.dmg = o.dmg || 1;
      this.homing = o.homing || 0; this.wall = o.wall !== false; this.hittable = !!o.hittable; this.bounce = o.bounce || 0; this.frames = Array.isArray(this.spr) ? this.spr : null;
      this.explode = o.explode; this.rotate = o.rotate; this.onDie = o.onDie; this.trail = o.trail; this.flipX = o.flipX;
      this.z = 5;
    }
    update() {
      const g = this.g;
      this.t++;
      if (this.homing && this.t < (this.homeT || 120)) {
        const p = g.player, dx = p.cx - this.cx, dy = p.cy - this.cy, d = Math.hypot(dx, dy) || 1, sp = Math.hypot(this.vx, this.vy) || 1;
        this.vx += dx / d * this.homing; this.vy += dy / d * this.homing; const ns = Math.hypot(this.vx, this.vy); this.vx *= sp / ns; this.vy *= sp / ns;
      }
      this.vy += this.grav; this.x += this.vx; this.y += this.vy;
      if (this.trail && g.t % 2 === 0) g.parts.add({ x: this.cx, y: this.cy, life: 10, col: this.trail, size: 2, shrink: true });
      if (--this.life <= 0) this.kill();
      if (this.wall && AF.rectSolid(g.lv, this.x + 1, this.y + 1, this.w - 2, this.h - 2)) {
        if (this.bounce > 0) { this.bounce--; this.vy = -Math.abs(this.vy) * .7; this.y -= 2; } else this.kill();
      }
      if (this.x < g.cam.x - 200 || this.x > g.cam.x + AF.W + 200 || this.y > g.lv.ph + 50 || this.y < g.cam.y - 300) this.dead = true;
    }
    kill() { if (this.dead) return; this.dead = true; if (this.explode) { AF.fx.boom(this.g, this.cx, this.cy); if (this.near()) AF.Audio.sfx('explode'); } else AF.fx.puff(this.g, this.cx, this.cy); if (this.onDie) this.onDie(this); }
    touch(p) { if (p.hurt(this.dmg, this.cx - this.vx * 4)) this.kill(); }
    hit(box) { if (!this.hittable) return false; this.vx = -this.vx * 1.2; this.vy = -Math.abs(this.vy) - 1; this.reflected = true; AF.Audio.sfx('clink'); return true; }
    draw(ctx, cx, cy) {
      const s = this.frames ? this.frames[(this.t >> 2) % this.frames.length] : this.spr;
      AF.drawSpr(ctx, s, this.cx - cx, this.cy - cy, this.flipX ? -1 : (this.vx < 0 && this.rotate !== false ? -1 : 1));
    }
  }
  AF.Shot = Shot;

  // ---------------- Decor (non-colliding art) ----------------
  AF.drawDecor = function (ctx, d, cx, cy, t) {
    const x = Math.round(d.x * TS - cx), y = Math.round(d.y * TS - cy);
    if (x < -96 || x > AF.W + 96 || y < -160 || y > AF.H + 96) return;
    const img = AF.decorImg(d.type, d.p);
    if (img) ctx.drawImage(img, x + 8 - (img.width >> 1), y + 16 - img.height + (d.p.dy || 0));
    if (d.type === 'torch' || d.type === 'lamp') { const f = (t >> 2) % 3; ctx.fillStyle = '#ff8020'; ctx.fillRect(x + 7, y + 2 - f, 3, 3 + f); ctx.fillStyle = '#ffe060'; ctx.fillRect(x + 8, y + 4 - f, 1, 1 + f); ctx.globalAlpha = .15; ctx.fillStyle = '#ffa040'; ctx.beginPath(); ctx.arc(x + 8, y + 4, 12 + f, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    if (d.type === 'sign') AF.text(ctx, d.p.txt || '', x + 8, y - 6, '#ffffff', { a: 'c' });
    if (d.type === 'monitor' && (t & 32)) { ctx.fillStyle = '#30f0c0'; ctx.fillRect(x + 3, y + 5, 10, 1); }
  };
  const decoCache = {};
  AF.decorImg = function (type, p) {
    const k = type + (p.v || '') + (p.h || '');
    if (decoCache[k] !== undefined) return decoCache[k];
    let q = null;
    const P = (w, h) => new AF.Pix(w, h);
    switch (type) {
      case 'tree': { const h = (p.h || 5) * 16; q = P(64, h); q.rect(28, h * .35, 9, h * .65, '#6a4020'); q.rect(30, h * .35, 2, h * .65, '#8e5a2c'); q.rect(35, h * .35, 2, h * .65, '#4a2a14'); q.ell(32, h * .3, 28, h * .26, '#1e6a1c'); q.ell(28, h * .25, 22, h * .19, '#38a030'); q.ell(24, h * .2, 12, h * .1, '#68d040'); q.rect(26, h - 3, 13, 3, '#4a2a14'); q.outline('#140a18'); break; }
      case 'bush': q = P(32, 16); q.ell(10, 10, 9, 6, '#2c9028'); q.ell(21, 9, 10, 7, '#38a030'); q.ell(18, 7, 6, 3, '#68d040'); q.set(8, 8, '#ff60a0'); q.set(24, 10, '#ffe060'); q.outline('#140a18'); break;
      case 'flower': q = P(8, 12); q.rect(3, 4, 1, 8, '#2c9028'); q.circ(3.5, 3, 2.5, p.v === 1 ? '#ffe040' : '#ff60a0'); q.set(3, 3, '#ffffff'); q.outline('#140a18'); break;
      case 'grass': q = P(16, 8); for (let i = 0; i < 16; i += 2) q.rect(i, 8 - ((i * 7) % 5 + 2), 1, 8, i % 4 ? '#38a030' : '#68d040'); break;
      case 'rock': q = P(24, 14); q.shadeEll(12, 9, 11, 6, ['#3a3a4a', '#6a6a7a', '#9a9aaa', '#d0d0e0']); q.outline('#140a18'); break;
      case 'pillar': { const h = (p.h || 4) * 16; q = P(20, h); q.rect(3, 4, 14, h - 8, '#7e9478'); q.rect(5, 4, 3, h - 8, '#a8bca0'); q.rect(14, 4, 2, h - 8, '#5a6e58'); q.rect(1, 0, 18, 5, '#a8bca0'); q.rect(1, h - 5, 18, 5, '#5a6e58'); for (let y = 10; y < h - 8; y += 9) q.set(10, y, '#4a8a3a'); q.outline('#140a18'); break; }
      case 'coral': q = P(24, 24); { const c = ['#e05888', '#f08848', '#a050d0', '#50c8a0'][p.v || 0]; q.thick(12, 24, 12, 8, 2, c); q.thick(12, 16, 5, 6, 1.5, c); q.thick(12, 14, 19, 4, 1.5, c); q.circ(5, 5, 2, c); q.circ(19, 4, 2, c); q.circ(12, 7, 2, c); } q.outline('#140a18'); break;
      case 'seaweed': q = P(12, 32); for (let y = 0; y < 32; y++) { const x = 6 + Math.round(Math.sin(y * .3) * 2); q.rect(x - 1, y, 3, 1, y % 6 < 3 ? '#2a8a5a' : '#40b070'); } q.outline('#0a2a20'); break;
      case 'pine': { const h = (p.h || 4) * 16; q = P(40, h); q.rect(18, h - 12, 4, 12, '#4a2a14'); for (let k = 0; k < 4; k++) { const w = 18 - k * 4, y0 = h - 14 - k * (h / 5); q.poly([[20, y0 - h / 4], [20 + w, y0], [20 - w, y0]], k % 2 ? '#1a4a50' : '#2a6a68'); q.rect(20 - w + 2, y0 - 2, w * 2 - 4, 2, '#f0f8ff'); } q.outline('#0a1a20'); break; }
      case 'crystalD': q = P(20, 28); { const c = p.v ? ['#a070f0', '#d0b0ff'] : ['#40a0f0', '#b0e8ff']; q.poly([[10, 0], [16, 12], [12, 28], [6, 28], [4, 12]], c[0]); q.poly([[10, 0], [10, 28], [6, 28], [4, 12]], c[1]); q.poly([[3, 14], [0, 20], [3, 28], [6, 28]], c[0]); } q.outline('#101040'); break;
      case 'snowman': q = P(20, 30); q.circ(10, 22, 8, '#f0f8ff'); q.circ(10, 9, 6, '#ffffff'); q.set(8, 8, '#101020'); q.set(12, 8, '#101020'); q.rect(10, 10, 4, 1, '#ff8020'); q.rect(5, 2, 10, 2, '#202030'); q.rect(7, -1, 6, 4, '#202030'); q.outline('#3a4a80'); break;
      case 'bones': q = P(24, 10); q.rect(2, 6, 18, 2, '#e8e0d0'); q.circ(2, 5, 2, '#e8e0d0'); q.circ(2, 8, 2, '#e8e0d0'); q.circ(20, 5, 2, '#e8e0d0'); q.circ(20, 8, 2, '#e8e0d0'); q.circ(14, 3, 3, '#f0e8d8'); q.outline('#140a18'); break;
      case 'scaffold': { const h = (p.h || 4) * 16; q = P(24, h); q.rect(2, 0, 3, h, '#6a4020'); q.rect(19, 0, 3, h, '#6a4020'); for (let y = 4; y < h; y += 16) { q.rect(2, y, 20, 3, '#8e5a2c'); q.line(4, y + 3, 19, y + 15, '#4a2a14'); } q.outline('#140a18'); break; }
      case 'pipe': { const h = (p.h || 3) * 16; q = P(16, h); q.rect(3, 0, 10, h, '#5a6278'); q.rect(4, 0, 3, h, '#9aa2c0'); q.rect(11, 0, 2, h, '#30364a'); for (let y = 0; y < h; y += 24) { q.rect(1, y, 14, 4, '#6a7290'); q.rect(1, y, 14, 1, '#c8d0e0'); } q.outline('#140a18'); break; }
      case 'gearD': { const r = (p.h || 2) * 8; q = P(r * 2 + 8, r * 2 + 8); const c = r + 4; const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, rr = k & 1 ? r - 3 : r + 2; pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]); } q.poly(pts, '#8a6a40'); q.circ(c, c, r - 5, '#b08a50'); q.circ(c, c, r * .3, '#4a3018'); q.outline('#140a18'); break; }
      case 'lamp': q = P(16, 32); q.rect(7, 8, 2, 24, '#404858'); q.rect(4, 2, 8, 6, '#606878'); q.rect(5, 3, 6, 4, '#fff0a0'); q.outline('#140a18'); break;
      case 'crates': q = P(32, 16); for (let i = 0; i < 2; i++) { q.rect(i * 16, 0, 16, 16, '#a86a30'); q.rect(i * 16 + 1, 1, 14, 14, '#c88a48'); q.line(i * 16 + 2, 2, i * 16 + 13, 13, '#8a5420'); } q.outline('#140a18'); break;
      case 'cactus': q = P(20, 30); q.rect(8, 2, 5, 28, '#3a8a40'); q.rect(9, 2, 1, 28, '#58b058'); q.rect(2, 10, 6, 3, '#3a8a40'); q.rect(2, 4, 3, 8, '#3a8a40'); q.rect(13, 14, 5, 3, '#3a8a40'); q.rect(15, 8, 3, 8, '#3a8a40'); q.set(10, 1, '#ff60a0'); q.outline('#140a18'); break;
      case 'palm': q = P(48, 64); for (let k = 0; k < 50; k++) q.rect(22 + Math.sin(k / 50 * 1.5) * 5, 63 - k, 4, 1, k % 6 < 3 ? '#8a5a28' : '#6a4018'); for (let a = 0; a < 6; a++) { const ang = a / 6 * 3.14 + .15; for (let k = 0; k < 18; k++) q.rect(27 + Math.cos(ang) * k * (a < 3 ? -1 : 1), 14 + Math.sin(ang * .5) * k * .4 + k * k * .025, 3, 2, a & 1 ? '#3a8a3a' : '#58b058'); } q.outline('#140a18'); break;
      case 'statue': q = P(24, 40); q.rect(4, 32, 16, 8, '#a07040'); q.rect(7, 10, 10, 22, '#c89a60'); q.circ(12, 7, 6, '#c89a60'); q.rect(6, 4, 12, 3, '#a07040'); q.rect(10, 7, 1, 1, '#4a2a10'); q.rect(13, 7, 1, 1, '#4a2a10'); q.rect(8, 12, 8, 1, '#a07040'); q.outline('#140a18'); break;
      case 'pot': q = P(14, 14); q.ell(7, 8, 6, 5.5, '#c06030'); q.rect(4, 1, 6, 3, '#c06030'); q.rect(3, 8, 8, 1, '#ffd080'); q.outline('#140a18'); break;
      case 'column': { const h = (p.h || 4) * 16; q = P(20, h); q.rect(4, 4, 12, h - 8, '#e0e0f0'); q.rect(6, 4, 2, h - 8, '#ffffff'); q.rect(13, 4, 2, h - 8, '#b8b8d0'); q.rect(1, 0, 18, 5, '#ffffff'); q.rect(1, h - 5, 18, 5, '#b8b8d0'); q.outline('#140a18'); break; }
      case 'banner': q = P(16, 32); q.rect(7, 0, 2, 32, '#8a6a3a'); q.poly([[9, 2], [16, 4], [14, 10], [16, 16], [9, 16]], p.v ? '#4060e0' : '#e04060'); q.outline('#140a18'); break;
      case 'windmill': q = P(32, 48); q.rect(14, 16, 4, 32, '#e0d0c0'); q.rect(12, 44, 8, 4, '#a09080'); q.thick(16, 16, 4, 4, 1.5, '#c0a080'); q.thick(16, 16, 28, 28, 1.5, '#c0a080'); q.thick(16, 16, 28, 4, 1.5, '#c0a080'); q.thick(16, 16, 4, 28, 1.5, '#c0a080'); q.outline('#140a18'); break;
      case 'tube': { q = P(24, 48); q.rect(2, 0, 20, 6, '#4a5a6a'); q.rect(2, 42, 20, 6, '#4a5a6a'); q.rect(4, 6, 16, 36, p.v ? '#5a1040' : '#1a6a40'); q.rect(4, 6, 16, 4, p.v ? '#a02060' : '#30c070'); q.ell(12, 24, 5, 7, p.v ? '#200818' : '#0a3020'); q.rect(6, 8, 1, 32, '#c0fff0'); q.outline('#140a18'); break; }
      case 'monitor': q = P(16, 16); q.rect(0, 0, 16, 12, '#303848'); q.rect(1, 1, 14, 10, '#0a1a20'); q.rect(6, 12, 4, 4, '#303848'); q.rect(3, 3, 6, 1, '#30f0c0'); q.rect(3, 7, 9, 1, '#30f0c0'); q.outline('#140a18'); break;
      case 'computer': q = P(32, 24); q.rect(0, 4, 32, 20, '#3a4458'); q.rect(2, 6, 28, 10, '#0a1a20'); for (let i = 0; i < 6; i++) q.rect(4 + i * 4, 18, 2, 2, ['#ff4060', '#30f0c0', '#ffe040'][i % 3]); q.rect(4, 8, 14, 1, '#30f0c0'); q.rect(4, 11, 20, 1, '#30f0c0'); q.outline('#140a18'); break;
      case 'cable': { const h = (p.h || 3) * 16; q = P(8, h); for (let y = 0; y < h; y++) q.set(3 + Math.round(Math.sin(y * .15) * 2), y, '#202030'); q.outline('#30f0c0'); break; }
      case 'torch': q = P(16, 16); q.rect(6, 6, 4, 10, '#6a4020'); q.rect(5, 5, 6, 2, '#8a6a3a'); q.outline('#140a18'); break;
      case 'sign': q = P(24, 24); q.rect(11, 10, 2, 14, '#6a4020'); q.rect(0, 0, 24, 12, '#a86c34'); q.rect(1, 1, 22, 10, '#d09050'); q.outline('#140a18'); break;
      case 'arrow': q = P(24, 24); q.rect(11, 10, 2, 14, '#6a4020'); q.poly([[0, 2], [16, 2], [16, 0], [23, 6], [16, 12], [16, 10], [0, 10]], '#d09050'); q.outline('#140a18'); break;
      case 'ruinarch': q = P(64, 64); q.rect(0, 8, 14, 56, '#7e9478'); q.rect(50, 8, 14, 56, '#7e9478'); q.rect(0, 0, 64, 12, '#a8bca0'); q.ell(32, 14, 18, 10, 0); for (let y = 16; y < 64; y += 8) { q.rect(0, y, 14, 1, '#5a6e58'); q.rect(50, y, 14, 1, '#5a6e58'); } q.rect(4, 20, 4, 4, '#4a8a3a'); q.outline('#140a18'); break;
      case 'window': q = P(32, 32); q.rect(0, 0, 32, 32, '#5a8aa8'); q.rect(2, 2, 28, 28, '#145a98'); q.rect(15, 2, 2, 28, '#5a8aa8'); q.rect(2, 15, 28, 2, '#5a8aa8'); q.line(4, 12, 12, 4, '#80c8f0'); q.outline('#140a18'); break;
      case 'skull': q = P(16, 14); q.circ(8, 6, 6, '#e8e0d0'); q.rect(5, 10, 6, 4, '#e8e0d0'); q.rect(4, 5, 3, 3, '#140a18'); q.rect(9, 5, 3, 3, '#140a18'); q.outline('#140a18'); break;
    }
    decoCache[k] = q ? q.canvas() : null;
    return decoCache[k];
  };
})();
