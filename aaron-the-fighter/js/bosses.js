'use strict';
// ============================================================
//  Bosses: base class + 8 minibosses
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T, OBJ = AF.OBJ;
  const OL = '#140a18';
  const R = (x, y, w, h) => ({ x, y, w, h });

  // ---------------- shared hazard entities ----------------
  class Wave extends AF.Ent {
    constructor(g, x, floorY, dir, o) {
      o = o || {};
      const h = o.h || 14;
      super(g, x - 7, floorY - h, 14, h);
      this.dir = dir; this.speed = o.speed || 2.6; this.kind = o.kind || 'dust'; this.life = o.life || 260; this.floorY = floorY; this.z = 4;
    }
    update() {
      this.t++; this.x += this.dir * this.speed;
      if (--this.life <= 0 || AF.rectSolid(this.g.lv, this.x + (this.dir > 0 ? this.w : -1), this.y + 2, 1, this.h - 4)) this.dead = true;
      if (this.t % 3 === 0) this.g.parts.add({ x: this.cx, y: this.floorY - 2, vx: -this.dir * .5, vy: -AF.rr(.5, 1.5), life: 14, col: this.kind === 'fire' ? '#ff8020' : this.kind === 'ice' ? '#c0f0ff' : this.kind === 'elec' ? '#fff060' : '#e0d0b0', size: 2, shrink: true });
    }
    touch(p) { p.hurt(1, this.cx - this.dir * 10); }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy), h = this.h, t = this.t;
      const c = this.kind === 'fire' ? ['#ff4010', '#ffa020', '#ffe060'] : this.kind === 'ice' ? ['#3878d8', '#90d8ff', '#ffffff'] : this.kind === 'elec' ? ['#8080ff', '#fff060', '#ffffff'] : ['#a08060', '#e0d0b0', '#ffffff'];
      for (let i = 0; i < 14; i++) {
        const hh = Math.round(h * Math.sin((i + .5) / 14 * Math.PI) * (.8 + .2 * Math.sin(t * .5 + i)));
        ctx.fillStyle = OL; ctx.fillRect(x + i, y + h - hh - 1, 1, hh + 1);
        ctx.fillStyle = c[i % 3 === 0 ? 2 : (i & 1) ? 1 : 0]; ctx.fillRect(x + i, y + h - hh, 1, hh);
      }
    }
  }
  AF.Wave = Wave;
  // tall lava wave
  class LavaWave extends Wave {
    constructor(g, x, floorY, dir) { super(g, x, floorY, dir, { h: 34, speed: 1.6, kind: 'fire', life: 400 }); this.w = 22; }
    draw(ctx, cx, cy) {
      const x = Math.round(this.x - cx), y = Math.round(this.y - cy), t = this.t;
      for (let i = 0; i < this.w; i++) {
        const k = this.dir > 0 ? i / this.w : 1 - i / this.w;
        const hh = Math.round(this.h * Math.min(1, Math.sin(k * Math.PI) * 1.3) * (.85 + .15 * Math.sin(t * .4 + i * .7)));
        ctx.fillStyle = '#801000'; ctx.fillRect(x + i, y + this.h - hh - 1, 1, hh + 1);
        ctx.fillStyle = (i + (t >> 2)) % 4 === 0 ? '#ffe060' : (i & 1) ? '#ff6010' : '#ffa020'; ctx.fillRect(x + i, y + this.h - hh, 1, hh);
      }
    }
  }
  AF.LavaWave = LavaWave;
  // big boss melee hitbox that lingers (arm slam etc)
  class HurtRect extends AF.Ent {
    constructor(g, x, y, w, h, life) { super(g, x, y, w, h); this.life = life || 10; }
    update() { if (--this.life <= 0) this.dead = true; }
    touch(p) { p.hurt(1, this.cx); }
  }
  AF.HurtRect = HurtRect;

  // ---------------- Boss base ----------------
  class Boss extends AF.Ent {
    constructor(g, d) {
      const p = d.p;
      const A = R(p.ax * TS, p.ay * TS, (p.aw || 15) * TS, (p.ah || 10) * TS);
      super(g, A.x, A.y, A.w, A.h);
      this.A = A; this.p = p;
      this.floorY = (p.floor !== undefined ? p.floor : p.ay + (p.ah || 10) - 2) * TS;
      this.isBoss = true; this.hittable = true; this.hitBoxes = true; this.z = 2;
      this.active = false; this.state = 'wait'; this.st = 0; this.flash = 0; this.dying = 0; this.introT = 0; this.seq = 0;
      this.hp = this.maxHp = p.hp || 12; this.lastHits = {}; this.dir = -1; this.enraged = false; this.contactDmg = 1;
      this.name = p.name || 'BOSS';
    }
    get pl() { return this.g.player; }
    set(s) { this.state = s; this.st = 0; }
    activate() {
      const g = this.g;
      this.active = true; this.introT = 130; this.set('intro');
      g.cam.lock = { x: this.A.x, y: this.A.y, w: this.A.w, h: this.A.h };
      AF.Audio.stopMusic(); AF.Audio.sfx('alarm');
      // seal arena walls
      const lv = g.lv, x0 = this.A.x / TS - 1, x1 = (this.A.x + this.A.w) / TS;
      this.sealed = [];
      for (const x of [x0, x1]) for (let y = this.A.y / TS; y < this.floorY / TS; y++) if (lv.get(x, y) === T.EMPTY) { lv.set(x, y, T.ALT); this.sealed.push([x, y]); }
      g.lv.solids = g.ents.filter(e => e.collides);
    }
    unseal() { for (const [x, y] of this.sealed || []) this.g.lv.set(x, y, T.EMPTY); this.g.cam.lock = null; }
    update() {
      if (!this.active) return;
      this.t++; this.st++;
      if (this.flash > 0) this.flash--;
      if (this.dying) return this.updDying();
      if (this.introT > 0) { this.introT--; if (this.introT === 100) { AF.Audio.sfx('roar'); this.g.cam.shake(3, 30); } if (this.introT === 76) AF.Audio.music(this.p.music || 'boss'); this.intro && this.intro(); if (this.introT === 0) this.set('idle'); return; }
      this.think();
    }
    // vulnerability rects (world coords) & armor rects & hurt rects - override
    weak() { return []; }
    armor() { return []; }
    hurts() { return []; }
    hitTest(b) {
      if (!this.active || this.dying || this.introT > 0 || this.lastHits[b.id]) return false;
      for (const r of this.weak()) if (AF.rectsHit(b.x, b.y, b.w, b.h, r.x, r.y, r.w, r.h) && (!r.fromAbove || b.down || b.kind === 'kick' || b.kind === 'stomp' || b.y + b.h < r.y + 10)) {
        this.lastHits[b.id] = 1; this.damage(b.dmg * (r.mult || 1), b, r); return true;
      }
      for (const r of this.armor()) if (AF.rectsHit(b.x, b.y, b.w, b.h, r.x, r.y, r.w, r.h)) {
        this.lastHits[b.id] = 1;
        if (this.armorHit && this.armorHit(b, r)) return true;
        AF.Audio.sfx('clink'); AF.fx.hit(this.g, AF.clamp(b.x + b.w / 2, r.x, r.x + r.w), AF.clamp(b.y + b.h / 2, r.y, r.y + r.h));
        if (b.owner === this.pl) this.pl.vx = -(b.dir || 1) * 1.2;
        return true;
      }
      return false;
    }
    damage(n, b) {
      const g = this.g;
      this.hp -= n; this.flash = 12; g.hitstop = 5;
      AF.fx.hit(g, b.x + b.w / 2, b.y + b.h / 2, true); AF.Audio.sfx('bighit'); g.cam.shake(2, 6);
      g.addScore(100 * n);
      if (this.hp <= 0) { this.hp = 0; this.die(); return; }
      if (!this.enraged && this.hp <= this.maxHp / 2) { this.enraged = true; this.onEnrage && this.onEnrage(); }
    }
    touch(p) { if (this.dying || !this.active) return; for (const r of this.hurts()) if (AF.rectsHit(p.x, p.y, p.w, p.h, r.x, r.y, r.w, r.h)) { p.hurt(this.contactDmg, r.x + r.w / 2); break; } }
    die() {
      const g = this.g;
      this.dying = 1; AF.Audio.stopMusic(); AF.Audio.sfx('bossdie'); g.hitstop = 24; g.cam.shake(5, 60);
      for (const e of g.ents) if (e !== this && (e instanceof AF.Shot || e instanceof Wave || e instanceof AF.Faller || (e.isEnemy && e.minion))) { e.dead = true; AF.fx.puff(g, e.cx, e.cy); }
      g.player.inv = Math.max(g.player.inv, 200);
    }
    body() { return R(this.bx, this.by, this.bw, this.bh); }
    updDying() {
      const g = this.g, b = this.body();
      this.dying++;
      if (this.dying < 150 && this.dying % 7 === 0) { AF.fx.boom(g, b.x + Math.random() * b.w, b.y + Math.random() * b.h, this.dying % 21 === 0); AF.Audio.sfx('explode'); }
      if (this.dying === 150) { g.screenFlash = 20; AF.Audio.sfx('bigexplode'); for (let i = 0; i < 8; i++) AF.fx.boom(g, b.x + Math.random() * b.w, b.y + Math.random() * b.h, true); this.gone = true; g.cam.shake(6, 30); for (let i = 0; i < 12; i++) g.spawn(new OBJ.coin(g, { x: 0, y: 0, p: { free: true, px: b.x + b.w / 2, py: b.y + b.h / 2, vx: AF.rr(-2.5, 2.5), vy: AF.rr(-5, -2) } })); }
      if (this.dying === 220) { this.unseal(); this.onDefeated ? this.onDefeated() : g.clearStage(); }
    }
    minions() { return this.g.ents.filter(e => e.minion && !e.dead).length; }
    spawnMinion(type, x, y, p) { const e = new OBJ[type](this.g, { x: x / TS - .5, y: y / TS - 1, p: p || {} }); e.minion = true; e.coins = 0; e.wake = true; this.g.spawn(e); AF.fx.puff(this.g, e.cx, e.cy); return e; }
    rain(spr, n, o) {
      o = o || {};
      const g = this.g;
      for (let i = 0; i < n; i++) {
        const x = this.A.x + 20 + Math.random() * (this.A.w - 40);
        setTimeoutFrames(g, i * (o.gap || 12) + 30, () => { if (this.dying) return; const f = new AF.Faller(g, x, this.A.y - 8, spr, { grav: o.grav || .16, hittable: o.hittable, big: o.big }); if (o.col) f.debrisCol = o.col; g.spawn(f); });
        g.shadows.push({ x, t: i * (o.gap || 12) + 30 });
      }
    }
    flashOn() { return this.flash > 0 && (this.flash & 2); }
    telegraph() { return (this.t & 4) ? 1 : 0; }
    drawPart(ctx, img, x, y, cx, cy, flip) { if (!img) return; const im = flip ? AF.flipped(img) : img; ctx.drawImage(this.flashOn() ? AF.whiteOf(im) : im, Math.round(x - cx), Math.round(y - cy)); }
    draw(ctx, cx, cy) {
      if (!this.active) { if (!this.p.hideIdle) this.drawBoss(ctx, cx, cy); return; }
      if (this.gone) return;
      this.drawBoss(ctx, cx, cy);
      if (this.introT > 0) this.drawIntroBanner(ctx);
    }
    drawIntroBanner(ctx) {
      const k = this.introT, a = k > 110 ? (130 - k) / 20 : k < 20 ? k / 20 : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 24, AF.W, 24);
      ctx.fillStyle = (AF.tick & 8) ? '#c01030' : '#801020'; ctx.fillRect(0, 26, AF.W, 20);
      for (let x = -((AF.tick * 2) % 16); x < AF.W; x += 16) { ctx.fillStyle = '#ffd040'; ctx.fillRect(x, 26, 8, 2); ctx.fillRect(x + 8, 44, 8, 2); }
      AF.text(ctx, 'WARNING!', AF.W / 2, 29, '#ffe060', { a: 'c' });
      AF.text(ctx, this.name, AF.W / 2, 37, '#ffffff', { a: 'c' });
      ctx.globalAlpha = 1;
    }
  }
  AF.Boss = Boss;
  // frame-based timeouts tied to the play scene
  function setTimeoutFrames(g, n, fn) { g.spawn(new (class extends AF.Ent { constructor() { super(g, 0, -9999, 0, 0); this.n = n; } update() { if (--this.n <= 0) { this.dead = true; fn(); } } })()); }
  AF.after = setTimeoutFrames;

  // ---------------- art helpers ----------------
  const artCache = {};
  function art(key, fn) { if (!artCache[key]) artCache[key] = fn(); return artCache[key]; }
  function pix(w, h, fn, ol) { const p = new AF.Pix(w, h); fn(p); p.outline(ol || OL); return p.canvas(); }
  AF.bossArt = art; AF.bossPix = pix;
  const coreImg = (open, col) => pix(18, 18, p => { if (open) { p.shadeEll(9, 9, 7, 7, [AF.mix(col, '#000', .5), col, AF.mix(col, '#fff', .5), '#ffffff']); p.set(7, 6, '#ffffff'); } else { p.rect(2, 2, 14, 14, '#5a6278'); p.rect(2, 2, 14, 2, '#9aa2c0'); p.line(4, 9, 13, 9, '#30364a'); p.set(4, 4, '#c8d0e0'); p.set(13, 13, '#30364a'); } });

  // =====================================================================
  //  W1: MECHANICAL TREANT
  // =====================================================================
  class Treant extends Boss {
    constructor(g, d) {
      d.p.name = 'MECHANICAL TREANT'; d.p.hp = d.p.hp || 12;
      super(g, d);
      this.bw = 64; this.bh = 120; this.bx = this.A.x + this.A.w - 78; this.by = this.floorY - this.bh;
      this.arm = 0; this.armTarget = 0; this.coreOpen = false; this.seqList = ['slam', 'acorns', 'slam', 'bugs', 'stomp'];
      this.art = art('treant', () => ({
        trunk: pix(40, 96, p => { p.rect(4, 0, 32, 96, '#5a3820'); p.rect(6, 0, 6, 96, '#7a5030'); p.rect(30, 0, 5, 96, '#3a2210'); for (let y = 6; y < 96; y += 14) { p.rect(4, y, 32, 2, '#6a6a7a'); p.set(8, y, '#c0c0d0'); p.set(31, y, '#c0c0d0'); } p.rect(0, 86, 40, 10, '#4a2a14'); p.rect(14, 44, 14, 16, '#202030'); }),
        face: pix(30, 18, p => { p.rect(2, 2, 26, 14, '#3a2210'); p.rect(5, 5, 6, 4, '#ff3030'); p.rect(19, 5, 6, 4, '#ff3030'); p.set(6, 5, '#ffffff'); p.set(20, 5, '#ffffff'); p.rect(8, 11, 14, 3, '#100808'); for (let i = 9; i < 22; i += 3) p.set(i, 11, '#c0c0d0'); }),
        canopy: pix(104, 56, p => { p.ell(52, 30, 50, 25, '#1e6a38'); p.ell(44, 22, 38, 17, '#2e8a48'); p.ell(36, 16, 20, 9, '#48a858'); for (let i = 0; i < 14; i++) { const x = 10 + (i * 37) % 84, y = 12 + (i * 23) % 34; p.rect(x, y, 3, 3, '#8a92a8'); p.set(x, y, '#c8d0e0'); } }),
        arm: pix(16, 12, p => { p.rect(0, 2, 16, 8, '#5a3820'); p.rect(0, 2, 16, 2, '#7a5030'); p.rect(6, 1, 3, 10, '#6a6a7a'); }),
        claw: pix(18, 16, p => { p.rect(2, 4, 12, 8, '#6a6a7a'); p.rect(2, 4, 12, 2, '#c0c0d0'); p.poly([[0, 12], [4, 12], [2, 16]], '#9aa2c0'); p.poly([[6, 12], [10, 12], [8, 16]], '#9aa2c0'); p.poly([[12, 12], [16, 12], [14, 16]], '#9aa2c0'); }),
        coreO: coreImg(true, '#40e0ff'), coreC: coreImg(false)
      }));
    }
    coreR() { return R(this.bx + 25, this.by + 74, 16, 16); }
    weak() { return this.coreOpen ? [this.coreR()] : []; }
    armor() { return [R(this.bx + 12, this.by + 10, 44, this.bh - 10)]; }
    hurts() {
      const r = this.coreOpen ? [R(this.bx + 30, this.by + 20, 22, this.bh - 20)] : [R(this.bx + 16, this.by + 20, 36, this.bh - 20)];
      if (this.state === 'slam' && this.st >= 45 && this.st < 58) r.push(R(this.armX(), this.floorY - 18, this.bx + 10 - this.armX(), 18));
      return r;
    }
    armX() { return this.bx + 10 - this.arm; }
    think() {
      const g = this.g, A = this.A, fast = this.enraged ? .7 : 1;
      this.coreOpen = (this.state === 'stuck') || (this.state === 'tired');
      switch (this.state) {
        case 'idle':
          this.arm = AF.approach(this.arm, 0, 4);
          if (this.st > 50 * fast) { const n = this.seqList[this.seq++ % this.seqList.length]; this.set(n); if (n === 'slam') { this.armTarget = AF.clamp(this.bx + 10 - (this.pl.cx - 10), 40, this.bx - A.x - 10); AF.Audio.sfx('warn'); } }
          break;
        case 'slam':
          if (this.st < 45) { this.armUp = Math.min(1, this.st / 30); }
          else if (this.st < 52) { this.armUp = 0; this.arm = AF.lerp(this.arm, this.armTarget, .6); }
          if (this.st === 52) { AF.Audio.sfx('slam'); g.cam.shake(4, 14); AF.fx.dust(g, this.armX(), this.floorY, 8); g.spawn(new Wave(g, this.armX(), this.floorY, -1, { speed: 2.4 })); if (this.enraged) g.spawn(new Wave(g, this.armX(), this.floorY, 1, { speed: 2 })); }
          if (this.st > 58) this.set('stuck');
          break;
        case 'stuck':
          if (this.st % 20 === 0) AF.fx.sparkle(g, this.coreR().x + 8, this.coreR().y + 8);
          if (this.st > 110) this.set('retract');
          break;
        case 'retract': this.arm = AF.approach(this.arm, 0, 5); if (this.arm <= 0) this.set('idle'); break;
        case 'acorns':
          if (this.st === 1) AF.Audio.sfx('crumble');
          if (this.st === 30) this.rain(AF.SPR.macorn, this.enraged ? 8 : 5, { gap: 14, hittable: true, grav: .14 });
          if (this.st > 100) this.set('idle');
          break;
        case 'bugs':
          if (this.st === 20 && this.minions() < 3) { this.spawnMinion('bug', this.bx, this.floorY, { dir: -1 }); this.spawnMinion('bug', this.bx - 30, this.floorY - 40, { dir: -1 }); AF.Audio.sfx('roar'); }
          if (this.st > 60) this.set('idle');
          break;
        case 'stomp':
          if (this.st === 35 || (this.enraged && this.st === 70)) { AF.Audio.sfx('slam'); g.cam.shake(3, 12); g.spawn(new Wave(g, this.bx, this.floorY, -1, { speed: 2.8, h: 16 })); }
          if (this.st > (this.enraged ? 100 : 70)) this.set(this.enraged ? 'tired' : 'idle');
          break;
        case 'tired': if (this.st > 70) this.set('idle'); break;
      }
    }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      const sway = Math.round(Math.sin(t * .03) * 2);
      this.drawPart(ctx, a.trunk, this.bx + 12, this.by + 24, cx, cy);
      // arm (extends left along ground during slam; raised otherwise)
      const ay = this.state === 'slam' && this.st < 52 ? this.floorY - 70 - (this.armUp || 0) * 10 : this.floorY - 14;
      const len = Math.max(0, this.arm);
      if (len > 4 || this.state === 'slam') {
        for (let x = 0; x < len; x += 14) this.drawPart(ctx, a.arm, this.bx + 2 - x - 14, ay, cx, cy);
        this.drawPart(ctx, a.claw, this.armX() - 8, ay - 2, cx, cy);
      } else {
        this.drawPart(ctx, a.arm, this.bx - 2, this.by + 50 + sway, cx, cy); this.drawPart(ctx, a.claw, this.bx - 14, this.by + 48 + sway, cx, cy);
      }
      this.drawPart(ctx, a.canopy, this.bx - 20, this.by - 10 + sway, cx, cy);
      this.drawPart(ctx, a.face, this.bx + 17, this.by + 34, cx, cy);
      const c = this.coreR();
      this.drawPart(ctx, this.coreOpen ? a.coreO : a.coreC, c.x - 1, c.y - 1, cx, cy);
      if (this.coreOpen && (t & 8)) { ctx.globalAlpha = .3; ctx.fillStyle = '#80f0ff'; ctx.beginPath(); ctx.arc(Math.round(c.x + 8 - cx), Math.round(c.y + 8 - cy), 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      if (this.state === 'slam' && this.st < 45 && (t & 4)) { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round(this.bx + 10 - this.armTarget - cx) - 8, Math.round(this.floorY - cy) - 2, 16, 2); }
    }
  }
  OBJ.treant = Treant;

  // =====================================================================
  //  W2: MECHA-SHARK MK1 (underwater arena)
  // =====================================================================
  class Shark extends Boss {
    constructor(g, d) {
      d.p.name = 'MECHA-SHARK MK1'; d.p.hp = d.p.hp || 10;
      super(g, d);
      this.bw = 76; this.bh = 30; this.bx = this.A.x + this.A.w - 100; this.by = this.A.y + 70; this.dir = -1; this.vx = 0; this.vy = 0;
      this.seqList = ['aim', 'torpedo', 'aim', 'current', 'aim', 'summon'];
      this.art = art('shark', () => {
        const mk = open => pix(80, 34, p => {
          p.ell(40, 17, 36, 13, '#4a5a7a'); p.ell(38, 13, 32, 8, '#7a8ab0'); p.ell(40, 24, 30, 6, '#c8d0e0');
          p.poly([[70, 14], [80, 2], [78, 17], [80, 32], [70, 22]], '#4a5a7a');
          p.poly([[34, 6], [44, -6], [48, 6]], '#4a5a7a'); p.poly([[30, 26], [24, 34], [38, 28]], '#4a5a7a');
          p.rect(4, 18, 18, 3, '#101018'); for (let i = 5; i < 22; i += 3) { p.set(i, 18, '#ffffff'); p.set(i + 1, 20, '#ffffff'); }
          p.rect(12, 11, 5, 3, '#ff2020'); p.set(13, 11, '#ffffff');
          for (let i = 0; i < 3; i++) p.rect(26 + i * 4, 14, 1, 6, '#30364a');
          if (open) { p.rect(40, 4, 16, 6, '#202030'); p.shadeEll(48, 7, 6, 4, ['#806000', '#ffd040', '#fff8a0', '#ffffff']); }
          else { p.rect(40, 4, 16, 5, '#5a6a8a'); p.rect(40, 4, 16, 1, '#9aaac8'); }
        });
        return { closed: mk(false), open: mk(true) };
      });
    }
    coreR() { return R(this.dir < 0 ? this.bx + 38 : this.bx + this.bw - 58, this.by - 2, 20, 14); }
    weak() { return this.state === 'stunned' ? [this.coreR()] : []; }
    armor() { return [R(this.bx, this.by, this.bw, this.bh)]; }
    hurts() { return this.state === 'stunned' ? [] : [R(this.bx + 6, this.by + 6, this.bw - 12, this.bh - 10)]; }
    swimTo(tx, ty, sp) { const dx = tx - this.bx, dy = ty - this.by, d = Math.hypot(dx, dy) || 1; this.bx += dx / d * Math.min(sp, d); this.by += dy / d * Math.min(sp, d); }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? 1.4 : 1;
      const minX = A.x + 8, maxX = A.x + A.w - this.bw - 8, minY = A.y + 40, maxY = this.floorY - this.bh - 4;
      switch (this.state) {
        case 'idle':
          this.swimTo(this.bx + this.dir * 20, A.y + 70 + Math.sin(this.t * .04) * 20, .9 * fast);
          if (this.bx <= minX) this.dir = 1; if (this.bx >= maxX) this.dir = -1;
          if (this.st > 70 / fast) { this.set(this.seqList[this.seq++ % this.seqList.length]); }
          break;
        case 'aim':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1;
          this.by = AF.approach(this.by, AF.clamp(p.cy - this.bh / 2, minY, maxY), 1.2);
          this.bx = this.dir < 0 ? AF.approach(this.bx, maxX, 2) : AF.approach(this.bx, minX, 2);
          if (this.st === 1) AF.Audio.sfx('warn');
          if (this.st > 50 / fast) { this.set('charge'); AF.Audio.sfx('dash'); }
          break;
        case 'charge':
          this.bx += this.dir * 4.2 * fast;
          if (this.t % 3 === 0) AF.fx.bubble(g, this.bx + (this.dir < 0 ? this.bw : 0), this.by + 15);
          if (this.bx <= minX || this.bx >= maxX) { this.bx = AF.clamp(this.bx, minX, maxX); this.set('stunned'); AF.Audio.sfx('slam'); g.cam.shake(4, 16); for (let i = 0; i < 6; i++) AF.fx.bubble(g, this.bx + this.bw / 2, this.by); }
          break;
        case 'stunned':
          this.by = AF.approach(this.by, maxY, .4);
          if (this.st % 15 === 0) g.parts.add({ x: this.bx + this.bw / 2 + AF.rr(-10, 10), y: this.by, vy: -.5, life: 20, col: '#fff060', size: 1 });
          if (this.st > 130) { this.dir = -this.dir; this.set('idle'); }
          break;
        case 'torpedo':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1;
          if (this.st === 20 || this.st === 50 || (this.enraged && this.st === 80)) { const s = new AF.Shot(g, this.dir < 0 ? this.bx : this.bx + this.bw, this.by + 19, this.dir * 1.6, 0, { spr: AF.SPR.torpedo, size: 10, homing: .045, hittable: true, life: 260, explode: true, rotate: true }); s.homeT = 160; g.spawn(s); AF.Audio.sfx('shoot'); }
          if (this.st > 100) this.set('idle');
          break;
        case 'current': {
          if (this.st === 1) { this.dir = this.bx < A.x + A.w / 2 ? 1 : -1; this.zone = { x: A.x, y: A.y, w: A.w, h: this.floorY - A.y, fx: -this.dir * .14, fy: 0, maxX: 2.2, active: true, kind: 'current' }; g.zones.push(this.zone); AF.Audio.sfx('wind'); }
          // open mouth toward current flow
          const mx = this.dir > 0 ? this.bx : this.bx + this.bw;
          if (this.st % 2 === 0) g.parts.add({ x: mx + this.dir * 200 * Math.random(), y: A.y + 30 + Math.random() * (this.floorY - A.y - 40), vx: -this.dir * 2.5, life: 50, spr: AF.SPR.fx.bubble });
          if (this.st > 200) { const i = g.zones.indexOf(this.zone); if (i >= 0) g.zones.splice(i, 1); this.set('idle'); }
          break;
        }
        case 'summon':
          if (this.st === 15 && this.minions() < 3) { for (let i = 0; i < 2; i++) this.spawnMinion('robofish', this.bx + this.bw / 2, this.by + i * 30); AF.Audio.sfx('roar'); }
          if (this.st > 50) this.set('idle');
          break;
      }
    }
    drawBoss(ctx, cx, cy) {
      const img = this.state === 'stunned' ? this.art.open : this.art.closed;
      this.drawPart(ctx, img, this.bx - 2, this.by - 4, cx, cy, this.dir > 0);
      if (this.state === 'aim' && (this.t & 4)) { ctx.fillStyle = '#ff2040'; const ex = this.dir < 0 ? this.bx + 12 : this.bx + this.bw - 16; ctx.fillRect(Math.round(ex - cx), Math.round(this.by + 7 - cy), 5, 3); }
      if (this.state === 'stunned') { for (let i = 0; i < 3; i++) { const a = this.t * .1 + i * 2.1; ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(this.bx + this.bw / 2 + Math.cos(a) * 14 - cx), Math.round(this.by - 10 + Math.sin(a) * 4 - cy), 2, 2); } }
    }
  }
  OBJ.shark = Shark;

  // =====================================================================
  //  W3: CRYO-GOLEM
  // =====================================================================
  class Golem extends Boss {
    constructor(g, d) {
      d.p.name = 'CRYO-GOLEM'; d.p.hp = d.p.hp || 10;
      super(g, d);
      this.bw = 56; this.bh = 76; this.bx = this.A.x + this.A.w - 90; this.by = this.floorY - this.bh; this.armorHp = 6; this.exposed = 0; this.dir = -1;
      this.seqList = ['throw', 'stomp', 'icicles', 'throw', 'freeze'];
      this.art = art('golem', () => ({
        body: pix(60, 80, p => {
          p.rect(14, 56, 12, 24, '#5a80b8'); p.rect(34, 56, 12, 24, '#5a80b8'); p.rect(12, 74, 16, 6, '#3a5a90'); p.rect(32, 74, 16, 6, '#3a5a90');
          p.poly([[6, 20], [54, 20], [50, 60], [10, 60]], '#88b0e0'); p.poly([[6, 20], [30, 20], [26, 60], [10, 60]], '#a8d0f8');
          p.ell(30, 12, 14, 11, '#88b0e0'); p.ell(27, 9, 9, 6, '#c8e8ff'); p.rect(20, 10, 6, 3, '#40e0ff'); p.rect(34, 10, 6, 3, '#40e0ff'); p.set(21, 10, '#ffffff'); p.set(35, 10, '#ffffff');
          p.rect(24, 30, 12, 14, '#203050');
        }, '#102040'),
        armor: pix(40, 34, p => { p.poly([[2, 4], [38, 2], [36, 30], [4, 32]], '#c8f0ff'); p.poly([[2, 4], [20, 3], [18, 31], [4, 32]], '#e8faff'); p.line(10, 6, 16, 26, '#90d8ff'); p.line(28, 6, 24, 28, '#90d8ff'); }, '#3878d8'),
        arm: pix(20, 40, p => { p.rect(4, 0, 12, 30, '#88b0e0'); p.rect(4, 0, 4, 30, '#a8d0f8'); p.ell(10, 32, 9, 8, '#c8e8ff'); }, '#102040'),
        crystal: pix(16, 18, p => { p.poly([[8, 0], [15, 9], [8, 17], [1, 9]], '#ff40c0'); p.poly([[8, 0], [8, 17], [1, 9]], '#ff90e0'); p.set(6, 6, '#ffffff'); }),
        block: pix(24, 24, p => { p.rect(0, 0, 24, 24, '#58b8f0'); p.rect(2, 2, 20, 20, '#90d8ff'); p.poly([[2, 2], [20, 2], [2, 20]], '#b8ecff'); p.line(5, 16, 16, 5, '#ffffff'); }, '#2a5ab0')
      }));
    }
    crystalR() { return R(this.bx + 22, this.by + 30, 14, 16); }
    weak() { return this.exposed > 0 ? [this.crystalR()] : []; }
    armor() { return [R(this.bx + 4, this.by, this.bw - 8, this.bh)]; }
    armorHit(b) {
      if (this.exposed > 0) return false;
      this.armorHp -= b.kind === 'charge' ? 3 : 1;
      AF.Audio.sfx('break'); AF.fx.debris(this.g, this.bx + this.bw / 2, this.by + 36, '#c0f0ff', 5); this.flash = 6;
      if (this.armorHp <= 0) { this.exposed = 320; AF.fx.debris(this.g, this.bx + this.bw / 2, this.by + 36, '#e8faff', 16); AF.Audio.sfx('bighit'); this.g.cam.shake(3, 10); this.g.toast('ARMOR SHATTERED! HIT THE CRYSTAL!'); this.set('reel'); }
      return true;
    }
    hurts() { return [R(this.bx + 8, this.by + 4, this.bw - 16, this.bh - 4)]; }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .75 : 1;
      if (this.exposed > 0) { this.exposed--; if (this.exposed === 0) { this.armorHp = 4; AF.Audio.sfx('steam'); AF.fx.ring(g, this.bx + 28, this.by + 38, '#c0f0ff', 4, 20); } }
      const walk = sp => { this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.bx = AF.clamp(this.bx + this.dir * sp, A.x + 8, A.x + A.w - this.bw - 8); };
      switch (this.state) {
        case 'idle': walk(.35); if (this.st > 70 * fast) this.set(this.seqList[this.seq++ % this.seqList.length]); break;
        case 'reel': if (this.st > 60) this.set('idle'); break;
        case 'throw':
          if (this.st === 30) { const dx = p.cx - (this.bx + this.bw / 2); const tt = 60; const s = new AF.Shot(g, this.bx + this.bw / 2, this.by - 10, dx / tt, -4.5, { grav: .15, spr: new AF.Spr(this.art.block, 12, 12), size: 20, life: 300, onDie: sh => { for (const v of [-2, 0, 2]) g.spawn(new AF.Shot(g, sh.cx, sh.cy - 4, v, -2.5, { grav: .2, spr: AF.SPR.iceshot, size: 8 })); AF.Audio.sfx('break'); } }); s.rotate = false; g.spawn(s); AF.Audio.sfx('whoosh'); }
          if (this.st > 60) this.set('idle');
          break;
        case 'stomp':
          if (this.st === 30 || (this.enraged && this.st === 60)) { AF.Audio.sfx('slam'); g.cam.shake(4, 14); g.spawn(new Wave(g, this.bx, this.floorY, -1, { kind: 'ice', speed: 2.5 })); g.spawn(new Wave(g, this.bx + this.bw, this.floorY, 1, { kind: 'ice', speed: 2.5 })); }
          if (this.st > (this.enraged ? 90 : 60)) this.set('idle');
          break;
        case 'icicles':
          if (this.st === 10) AF.Audio.sfx('roar');
          if (this.st === 20) this.rain(AF.SPR.icicle, this.enraged ? 8 : 6, { gap: 12, grav: .2, col: '#c0f0ff' });
          if (this.st > 90) this.set('idle');
          break;
        case 'freeze': {
          if (this.st === 10) { AF.Audio.sfx('wind'); this.frozen = []; const lv = g.lv, ty = this.floorY / TS; for (let x = A.x / TS; x < (A.x + A.w) / TS; x++) if (lv.get(x, ty) === T.SOLID) { lv.set(x, ty, T.ICE); this.frozen.push(x); } this.spikesAt = [p.cx - 40, p.cx, p.cx + 40].map(x => AF.clamp(x, A.x + 16, A.x + A.w - 16)); }
          if (this.st > 10 && this.st < 50 && this.st % 4 === 0) for (const x of this.spikesAt) g.parts.add({ x: x + AF.rr(-6, 6), y: this.floorY - 2, vy: -.6, life: 10, col: '#c0f0ff', size: 2 });
          if (this.st === 50) { AF.Audio.sfx('break'); for (const x of this.spikesAt) g.spawn(new HurtRect(g, x - 8, this.floorY - 22, 16, 22, 50)); this.spikeShow = 50; }
          if (this.spikeShow > 0) this.spikeShow--;
          if (this.st === 420) { for (const x of this.frozen) g.lv.set(x, this.floorY / TS, T.SOLID); }
          if (this.st > 80) { this.set('idle'); setTimeoutFrames(g, 340, () => { for (const x of this.frozen || []) if (g.lv.get(x, this.floorY / TS) === T.ICE) g.lv.set(x, this.floorY / TS, T.SOLID); }); }
          break;
        }
      }
    }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      const bob = (this.state === 'idle' && (t >> 4) & 1) ? 1 : 0;
      const armUp = this.state === 'throw' && this.st < 30;
      this.drawPart(ctx, a.arm, this.bx - 10, this.by + 18 + (armUp ? -20 : 0), cx, cy);
      this.drawPart(ctx, a.body, this.bx - 2, this.by - 2 + bob, cx, cy);
      this.drawPart(ctx, a.crystal, this.bx + 21, this.by + 29 + bob, cx, cy);
      if (this.exposed <= 0) {
        ctx.globalAlpha = .5 + (this.armorHp / 6) * .5;
        this.drawPart(ctx, a.armor, this.bx + 8, this.by + 22 + bob, cx, cy);
        ctx.globalAlpha = 1;
        if (this.armorHp < 6) { ctx.fillStyle = '#3878d8'; for (let i = 0; i < 6 - this.armorHp; i++) { ctx.fillRect(Math.round(this.bx + 14 + i * 5 - cx), Math.round(this.by + 26 + (i * 7) % 20 - cy), 1, 8); } }
      } else if ((t & 8)) { ctx.globalAlpha = .35; ctx.fillStyle = '#ff80e0'; ctx.beginPath(); ctx.arc(Math.round(this.bx + 29 - cx), Math.round(this.by + 38 - cy), 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      this.drawPart(ctx, a.arm, this.bx + this.bw - 10, this.by + 18 + (armUp ? -20 : 0), cx, cy, true);
      if (armUp) this.drawPart(ctx, a.block, this.bx + 16, this.by - 22, cx, cy);
      if (this.spikeShow > 0) for (const x of this.spikesAt) { const h = Math.min(22, (50 - this.spikeShow) * 4); ctx.fillStyle = '#2a5ab0'; ctx.beginPath(); ctx.moveTo(Math.round(x - 8 - cx), Math.round(this.floorY - cy)); ctx.lineTo(Math.round(x - cx), Math.round(this.floorY - h - cy)); ctx.lineTo(Math.round(x + 8 - cx), Math.round(this.floorY - cy)); ctx.fill(); ctx.fillStyle = '#c8f0ff'; ctx.beginPath(); ctx.moveTo(Math.round(x - 5 - cx), Math.round(this.floorY - cy)); ctx.lineTo(Math.round(x - cx), Math.round(this.floorY - h + 3 - cy)); ctx.lineTo(Math.round(x + 2 - cx), Math.round(this.floorY - cy)); ctx.fill(); }
      if (this.state === 'freeze' && this.st < 50 && this.spikesAt && (t & 4)) for (const x of this.spikesAt) { ctx.fillStyle = '#80e0ff'; ctx.fillRect(Math.round(x - 8 - cx), Math.round(this.floorY - 2 - cy), 16, 2); }
    }
  }
  OBJ.golem = Golem;

  // =====================================================================
  //  W4: MAGMABOT
  // =====================================================================
  class Magmabot extends Boss {
    constructor(g, d) {
      d.p.name = 'MAGMABOT'; d.p.hp = d.p.hp || 10;
      super(g, d);
      this.bw = 64; this.bh = 68; this.bx = this.A.x + this.A.w / 2 - 32; this.by = this.floorY - this.bh; this.vents = [3, 3]; this.overheat = 0; this.dir = -1; this.vy = 0;
      this.seqList = ['fireballs', 'wave', 'jump', 'pillars', 'fireballs', 'jump'];
      this.art = art('magma', () => ({
        body: pix(68, 72, p => {
          p.rect(12, 50, 14, 22, '#3a2a2a'); p.rect(42, 50, 14, 22, '#3a2a2a'); p.rect(10, 66, 18, 6, '#2a1818'); p.rect(40, 66, 18, 6, '#2a1818');
          p.shadeEll(34, 32, 30, 24, ['#2a1414', '#5a2a24', '#8a4030', '#c06040']);
          for (let i = 0; i < 6; i++) p.line(10 + i * 9, 20 + (i % 2) * 4, 14 + i * 9, 48, '#ff6a18');
          p.rect(22, 14, 24, 10, '#1a0a0a'); p.rect(26, 17, 6, 4, '#ffe040'); p.rect(37, 17, 6, 4, '#ffe040');
          p.rect(26, 30, 16, 16, '#3a1818');
        }),
        vent: pix(16, 12, p => { p.rect(0, 0, 16, 12, '#606878'); p.rect(0, 0, 16, 2, '#a0a8b8'); for (let x = 2; x < 15; x += 3) p.rect(x, 3, 1, 8, '#202030'); }),
        ventB: pix(16, 12, p => { p.rect(0, 4, 16, 8, '#3a2a2a'); p.rect(3, 6, 10, 4, '#ff6020'); p.set(5, 7, '#ffe060'); }),
        coreO: coreImg(true, '#ff8020'), coreC: coreImg(false),
        arm: pix(16, 26, p => { p.rect(3, 0, 10, 18, '#5a2a24'); p.rect(3, 0, 3, 18, '#8a4030'); p.ell(8, 20, 8, 6, '#3a3a48'); p.rect(2, 22, 12, 3, '#ff6020'); })
      }));
    }
    ventR(i) { return R(this.bx + (i ? this.bw - 18 : 2), this.by + 2, 16, 12); }
    coreR() { return R(this.bx + 25, this.by + 28, 18, 18); }
    weak() { if (this.overheat > 0) return [this.coreR()]; const r = []; for (let i = 0; i < 2; i++) if (this.vents[i] > 0) r.push(Object.assign(this.ventR(i), { vent: i })); return r; }
    damage(n, b, r) {
      if (r && r.vent !== undefined) {
        this.vents[r.vent] -= 1; this.flash = 8; AF.Audio.sfx('break'); AF.fx.hit(this.g, r.x + 8, r.y + 6, true); this.g.hitstop = 4;
        if (this.vents[r.vent] <= 0) { AF.fx.boom(this.g, r.x + 8, r.y + 6); AF.Audio.sfx('explode'); }
        if (this.vents[0] <= 0 && this.vents[1] <= 0) { this.overheat = 260; this.set('overheat'); AF.Audio.sfx('steam'); this.g.toast('OVERHEATING! STRIKE THE CORE!'); }
        return;
      }
      super.damage(n, b);
    }
    armor() { return [R(this.bx + 4, this.by + 10, this.bw - 8, this.bh - 10)]; }
    hurts() { return [R(this.bx + 8, this.by + 8, this.bw - 16, this.bh - 8)]; }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .75 : 1;
      if (this.overheat > 0) { this.overheat--; if (this.t % 3 === 0) AF.fx.steam(g, this.bx + this.bw / 2 + AF.rr(-20, 20), this.by); if (this.overheat === 0) { this.vents = [3, 3]; this.set('idle'); } }
      const minX = A.x + 16, maxX = A.x + A.w - this.bw - 16;
      switch (this.state) {
        case 'idle':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1;
          this.bx = AF.clamp(this.bx + this.dir * .4, minX, maxX);
          if (this.st > 60 * fast) this.set(this.seqList[this.seq++ % this.seqList.length]);
          break;
        case 'overheat': break;
        case 'fireballs':
          if (this.st % 14 === 0 && this.st <= (this.enraged ? 70 : 42) && this.st > 0) { const dx = p.cx - (this.bx + this.bw / 2) + AF.rr(-30, 30); g.spawn(new AF.Shot(g, this.bx + this.bw / 2, this.by + 6, dx / 55, -5, { grav: .18, spr: AF.SPR.fireball, size: 9, trail: '#ff8020', explode: true })); AF.Audio.sfx('fire'); }
          if (this.st > 80) this.set('idle');
          break;
        case 'wave':
          if (this.st === 25) { const fromLeft = p.cx > A.x + A.w / 2; g.spawn(new LavaWave(g, fromLeft ? A.x + 12 : A.x + A.w - 12, this.floorY, fromLeft ? 1 : -1)); AF.Audio.sfx('fire'); g.cam.shake(2, 20); }
          if (this.st > 90) this.set('idle');
          break;
        case 'jump':
          if (this.st === 1) { this.vy = -7; this.tx = AF.clamp(p.cx - this.bw / 2, minX, maxX); AF.Audio.sfx('dash'); }
          this.vy += .25; this.by += this.vy; this.bx = AF.approach(this.bx, this.tx, 2.5);
          if (this.by >= this.floorY - this.bh) { this.by = this.floorY - this.bh; AF.Audio.sfx('slam'); g.cam.shake(5, 18); g.spawn(new Wave(g, this.bx, this.floorY, -1, { kind: 'fire', speed: 2.6 })); g.spawn(new Wave(g, this.bx + this.bw, this.floorY, 1, { kind: 'fire', speed: 2.6 })); this.rain(AF.SPR.rock, this.enraged ? 5 : 3, { gap: 15, big: true, col: '#5a2a24' }); this.set('land'); }
          break;
        case 'land': if (this.st > 40) this.set('idle'); break;
        case 'pillars': {
          if (this.st === 1) { const n = this.enraged ? 5 : 4; this.cols = []; for (let i = 0; i < n; i++) this.cols.push(A.x + 24 + ((i + (this.seq & 1) * .5) / n) * (A.w - 48)); AF.Audio.sfx('warn'); }
          if (this.st === 45) { AF.Audio.sfx('fire'); for (const x of this.cols) g.spawn(new HurtRect(g, x - 8, A.y, 16, this.floorY - A.y, 50)); }
          if (this.st > 100) this.set('idle');
          break;
        }
      }
    }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      const sh = this.overheat > 0 ? ((t & 2) ? 1 : -1) : 0;
      this.drawPart(ctx, a.arm, this.bx - 10 + sh, this.by + 26, cx, cy);
      this.drawPart(ctx, a.body, this.bx - 2 + sh, this.by - 4, cx, cy);
      this.drawPart(ctx, a.arm, this.bx + this.bw - 6 + sh, this.by + 26, cx, cy, true);
      for (let i = 0; i < 2; i++) { const r = this.ventR(i); this.drawPart(ctx, this.vents[i] > 0 ? a.vent : a.ventB, r.x + sh, r.y, cx, cy); if (this.vents[i] > 0 && this.vents[i] < 3) { ctx.fillStyle = '#ff6020'; ctx.fillRect(Math.round(r.x + 4 - cx), Math.round(r.y + 4 - cy), 2 * (3 - this.vents[i]), 1); } }
      const c = this.coreR();
      this.drawPart(ctx, this.overheat > 0 ? a.coreO : a.coreC, c.x - 1 + sh, c.y - 1, cx, cy);
      if (this.overheat > 0 && (t & 8)) { ctx.globalAlpha = .3; ctx.fillStyle = '#ff8020'; ctx.beginPath(); ctx.arc(Math.round(c.x + 9 - cx), Math.round(c.y + 9 - cy), 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      if (this.state === 'pillars' && this.st < 45 && this.cols && (t & 4)) for (const x of this.cols) { ctx.fillStyle = '#ff6020'; ctx.fillRect(Math.round(x - 8 - cx), Math.round(this.floorY - 3 - cy), 16, 3); ctx.globalAlpha = .2; ctx.fillRect(Math.round(x - 8 - cx), Math.round(this.A.y - cy), 16, this.floorY - this.A.y); ctx.globalAlpha = 1; }
      if (this.state === 'pillars' && this.st >= 45 && this.st < 95 && this.cols) for (const x of this.cols) for (let y = this.A.y; y < this.floorY; y += 3) { const w = 12 + Math.sin(y * .2 + t * .6) * 3; ctx.fillStyle = ((y + t) & 6) ? '#ff6020' : '#ffd040'; ctx.fillRect(Math.round(x - w / 2 - cx), Math.round(y - cy), Math.round(w), 3); }
    }
  }
  OBJ.magmabot = Magmabot;

  // =====================================================================
  //  W5: CRUSHER-9000
  // =====================================================================
  class Crusher extends Boss {
    constructor(g, d) {
      d.p.name = 'CRUSHER-9000'; d.p.hp = d.p.hp || 10;
      super(g, d);
      this.bw = 48; this.bh = 66; this.bx = this.A.x + this.A.w - 80; this.by = this.floorY - this.bh; this.armorHp = 8; this.exposed = 0; this.dir = -1; this.vy = 0;
      this.fist = null; this.spin = 0;
      this.seqList = ['rocket', 'slam', 'spin', 'elec', 'rocket', 'spin'];
      this.art = art('crusher', () => ({
        body: pix(52, 70, p => {
          p.rect(10, 48, 12, 22, '#404858'); p.rect(30, 48, 12, 22, '#404858'); p.rect(8, 64, 16, 6, '#202830'); p.rect(28, 64, 16, 6, '#202830');
          p.rect(4, 14, 44, 36, '#8890a8'); p.rect(4, 14, 44, 3, '#c0c8d8'); p.rect(4, 46, 44, 4, '#5a6278');
          p.rect(12, 0, 28, 16, '#606878'); p.rect(12, 0, 28, 2, '#a0a8b8'); p.rect(15, 5, 22, 6, '#101820'); p.rect(19, 7, 14, 2, '#ff2030');
          p.rect(16, 22, 20, 20, '#30364a');
        }),
        plate: pix(28, 26, p => { p.rect(0, 0, 28, 26, '#c8a040'); p.rect(0, 0, 28, 3, '#ffe080'); p.rect(0, 23, 28, 3, '#806020'); for (let y = 3; y < 23; y += 6) for (let x = 2; x < 26; x += 6) p.set(x, y + 2, '#806020'); p.rect(10, 10, 8, 6, '#202020'); p.rect(11, 11, 6, 1, '#f0c020'); }),
        coreO: coreImg(true, '#40ff80'), coreC: coreImg(false),
        fist: pix(22, 18, p => { p.rect(0, 2, 18, 14, '#606878'); p.rect(0, 2, 18, 3, '#a0a8b8'); p.rect(16, 4, 6, 10, '#404858'); for (let y = 5; y < 15; y += 3) p.rect(1, y, 4, 2, '#30364a'); }),
        arm: pix(12, 30, p => { p.rect(2, 0, 8, 22, '#606878'); p.rect(2, 0, 2, 22, '#a0a8b8'); p.rect(0, 20, 12, 10, '#404858'); })
      }));
    }
    coreR() { return R(this.bx + 15, this.by + 22, 18, 18); }
    weak() { return this.exposed > 0 ? [this.coreR()] : []; }
    armor() { return [R(this.bx, this.by, this.bw, this.bh)]; }
    armorHit(b) {
      if (this.exposed > 0) return false;
      const dmg = b.kind === 'charge' ? 4 : 1;
      this.armorHp -= dmg; this.flash = 6; AF.Audio.sfx(dmg > 1 ? 'bighit' : 'clink'); AF.fx.hit(this.g, b.x + b.w / 2, b.y + b.h / 2, dmg > 1);
      if (dmg === 1 && !this.hinted) { this.hinted = true; this.g.toast('Heavy armor! Try a CHARGED PUNCH (hold ATTACK).'); }
      if (this.armorHp <= 0) { this.exposed = 260; AF.fx.debris(this.g, this.bx + 24, this.by + 30, '#c8a040', 14); AF.Audio.sfx('explode'); this.g.cam.shake(3, 10); this.set('stagger'); this.fist = null; this.spin = 0; }
      return true;
    }
    hurts() {
      const r = [R(this.bx + 4, this.by + 2, this.bw - 8, this.bh - 2)];
      if (this.fist) r.push(R(this.fist.x, this.fist.y, 20, 16));
      if (this.spin > 0) r.push(R(this.bx - 22, this.floorY - 60, this.bw + 44, 34));
      return r;
    }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .75 : 1;
      if (this.exposed > 0) { this.exposed--; if (this.exposed === 0) { this.armorHp = 8; AF.Audio.sfx('door'); this.set('idle'); } }
      const minX = A.x + 12, maxX = A.x + A.w - this.bw - 12;
      if (this.fist) {
        const f = this.fist; f.x += f.vx;
        if (!f.back && (f.x < A.x + 4 || f.x > A.x + A.w - 24)) { f.back = true; f.vx = -f.vx; AF.Audio.sfx('clink'); g.cam.shake(2, 6); }
        if (f.back && Math.abs(f.x - (this.bx + (f.dir < 0 ? -10 : this.bw - 10))) < 6) this.fist = null;
        if (this.t % 2 === 0 && this.fist) g.parts.add({ x: f.x + (f.vx > 0 ? 0 : 20), y: f.y + 8, vx: -f.vx * .2, life: 10, col: '#ffa040', size: 2, shrink: true });
      }
      switch (this.state) {
        case 'idle':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.bx = AF.clamp(this.bx + this.dir * .5, minX, maxX);
          if (this.st > 60 * fast && !this.fist) this.set(this.seqList[this.seq++ % this.seqList.length]);
          break;
        case 'stagger': if (this.st > 40) this.set('idle'); break;
        case 'rocket':
          if (this.st === 1) { this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; AF.Audio.sfx('charge'); this.aimY = AF.clamp(p.y + 4, this.floorY - 50, this.floorY - 16); }
          if (this.st === 36) { this.fist = { x: this.dir < 0 ? this.bx - 20 : this.bx + this.bw, y: this.aimY, vx: this.dir * 4.2 * (this.enraged ? 1.2 : 1), dir: this.dir, back: false }; AF.Audio.sfx('dash'); }
          if (this.st > 40) this.set('idle');
          break;
        case 'slam':
          if (this.st === 1) { this.vy = -6.5; this.tx = AF.clamp(p.cx - this.bw / 2, minX, maxX); }
          this.vy += .28; this.by += this.vy; this.bx = AF.approach(this.bx, this.tx, 2.2);
          if (this.by >= this.floorY - this.bh) { this.by = this.floorY - this.bh; AF.Audio.sfx('slam'); g.cam.shake(5, 16); g.spawn(new Wave(g, this.bx, this.floorY, -1, { speed: 2.8 })); g.spawn(new Wave(g, this.bx + this.bw, this.floorY, 1, { speed: 2.8 })); this.set('land'); }
          break;
        case 'land': if (this.st > 35) this.set('idle'); break;
        case 'elec':
          if (this.st === 1) AF.Audio.sfx('charge');
          if (this.st === 40 || (this.enraged && this.st === 75)) { AF.Audio.sfx('zap'); g.spawn(new Wave(g, this.bx, this.floorY, -1, { kind: 'elec', speed: 3, h: 18 })); g.spawn(new Wave(g, this.bx + this.bw, this.floorY, 1, { kind: 'elec', speed: 3, h: 18 })); }
          if (this.st > (this.enraged ? 100 : 70)) this.set('idle');
          break;
        case 'spin':
          if (this.st === 1) { AF.Audio.sfx('alarm'); this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; }
          if (this.st > 35) { this.spin = 1; this.bx += this.dir * 2.2; if (this.t % 6 === 0) AF.Audio.sfx('whoosh'); if (this.bx <= minX || this.bx >= maxX) { this.bx = AF.clamp(this.bx, minX, maxX); this.spin = 0; this.set('dizzy'); } }
          break;
        case 'dizzy': if (this.st > 50) this.set('idle'); break;
      }
    }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      const flip = this.dir > 0;
      this.drawPart(ctx, a.body, this.bx - 2, this.by - 2, cx, cy, flip);
      const c = this.coreR();
      this.drawPart(ctx, this.exposed > 0 ? a.coreO : a.coreC, c.x - 1, c.y - 1, cx, cy);
      if (this.exposed <= 0) { this.drawPart(ctx, a.plate, this.bx + 10, this.by + 18, cx, cy); if (this.armorHp < 8) { ctx.fillStyle = '#402008'; for (let i = 0; i < 8 - this.armorHp; i++) ctx.fillRect(Math.round(this.bx + 14 + (i * 7) % 20 - cx), Math.round(this.by + 22 + (i * 5) % 18 - cy), 4, 1); } }
      else if (t & 8) { ctx.globalAlpha = .3; ctx.fillStyle = '#60ff90'; ctx.beginPath(); ctx.arc(Math.round(c.x + 9 - cx), Math.round(c.y + 9 - cy), 15, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      // arms
      if (this.spin > 0 || (this.state === 'spin' && this.st > 20)) {
        const ang = t * .5;
        for (let k = 0; k < 2; k++) { const aa = ang + k * Math.PI; const x = this.bx + this.bw / 2 + Math.cos(aa) * 30, y = this.floorY - 44 + Math.sin(aa) * 6; this.drawPart(ctx, a.fist, x - 11, y - 9, cx, cy, Math.cos(aa) < 0); }
      } else {
        const ly = this.by + 18, wind = this.state === 'rocket' && this.st < 36;
        if (!this.fist || this.fist.dir > 0) this.drawPart(ctx, a.arm, this.bx - 10 - (wind && this.dir < 0 ? -4 : 0), ly, cx, cy);
        if (!this.fist || this.fist.dir < 0) this.drawPart(ctx, a.arm, this.bx + this.bw - 2, ly, cx, cy, true);
        if (wind && (t & 4)) { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round((this.dir < 0 ? this.A.x : this.bx + this.bw) - cx), Math.round(this.aimY + 8 - cy), this.dir < 0 ? this.bx - this.A.x : this.A.x + this.A.w - this.bx - this.bw, 1); }
      }
      if (this.fist) this.drawPart(ctx, a.fist, this.fist.x, this.fist.y, cx, cy, this.fist.vx < 0);
      if (this.state === 'dizzy') for (let i = 0; i < 3; i++) { const aa = t * .15 + i * 2.1; ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(this.bx + 24 + Math.cos(aa) * 14 - cx), Math.round(this.by - 6 + Math.sin(aa) * 4 - cy), 2, 2); }
    }
  }
  OBJ.crusher = Crusher;

  // =====================================================================
  //  W6: SCORPION-X
  // =====================================================================
  class Scorpion extends Boss {
    constructor(g, d) {
      d.p.name = 'SCORPION-X'; d.p.hp = d.p.hp || 12;
      super(g, d);
      this.bw = 96; this.bh = 40; this.bx = this.A.x + this.A.w - 120; this.by = this.floorY - this.bh; this.dir = -1; this.under = false;
      this.seqList = ['tail', 'charge', 'burrow', 'tail', 'summon', 'charge'];
      this.art = art('scorp', () => ({
        body: pix(100, 44, p => {
          for (let k = 0; k < 4; k++) { p.line(30 + k * 12, 30, 24 + k * 12, 43, '#5a3a18'); p.line(31 + k * 12, 30, 25 + k * 12, 43, '#8a5a28'); }
          p.shadeEll(50, 26, 40, 13, ['#6a4018', '#b07030', '#e0a050', '#ffe0a0']);
          for (let i = 0; i < 5; i++) p.rect(22 + i * 12, 14, 2, 20, '#6a4018');
          p.rect(26, 12, 48, 4, '#40e0ff'); p.rect(26, 12, 48, 1, '#c0ffff');
          p.shadeEll(10, 28, 9, 8, ['#6a4018', '#b07030', '#e0a050']); p.rect(2, 22, 8, 3, '#3a2008'); p.rect(2, 31, 8, 3, '#3a2008');
          p.rect(14, 22, 4, 3, '#40ff60'); p.set(15, 22, '#ffffff');
        }),
        tail: pix(16, 16, p => { p.shadeEll(8, 8, 7, 7, ['#6a4018', '#b07030', '#e0a050']); }),
        sting: pix(18, 18, p => { p.shadeEll(9, 9, 7, 7, ['#801010', '#ff4040', '#ff9090', '#ffffff']); p.poly([[9, 14], [6, 18], [12, 18]], '#202020'); })
      }));
    }
    backR() { return R(this.bx + 22, this.by + 6, 56, 14); }
    weak() { return this.under ? [] : [Object.assign(this.backR(), { fromAbove: true })]; }
    armor() { return this.under ? [] : [R(this.bx, this.by + 14, this.bw, this.bh - 14)]; }
    hurts() { if (this.under) return this.state === 'erupt' && this.st > 0 ? [R(this.bx + 10, this.by, this.bw - 20, this.bh)] : []; const r = [R(this.bx + 2, this.by + 20, 26, this.bh - 20)]; if (this.state === 'charge' && this.st > 30) r.push(R(this.bx, this.by + 10, this.bw, this.bh - 10)); return r; }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .75 : 1;
      const minX = A.x + 8, maxX = A.x + A.w - this.bw - 8;
      switch (this.state) {
        case 'idle':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.bx = AF.clamp(this.bx + this.dir * .4, minX, maxX);
          if (this.st > 60 * fast) this.set(this.seqList[this.seq++ % this.seqList.length]);
          break;
        case 'tail':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1;
          if (this.st === 20 || this.st === 40 || (this.enraged && this.st === 60)) { const tx = this.tailTip(); const dx = p.cx - tx.x; g.spawn(new AF.Shot(g, tx.x, tx.y, dx / 50, -4, { grav: .16, spr: AF.SPR.ebolt, size: 9, trail: '#80f0ff', explode: true })); AF.Audio.sfx('zap'); }
          if (this.st > 80) this.set('idle');
          break;
        case 'charge':
          if (this.st === 1) { this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; AF.Audio.sfx('warn'); }
          if (this.st > 30) { this.bx += this.dir * 3.6 * (this.enraged ? 1.15 : 1); if (this.t % 4 === 0) AF.fx.dust(g, this.bx + (this.dir < 0 ? this.bw : 0), this.floorY, 2, '#e0b060'); if (this.bx <= minX || this.bx >= maxX) { this.bx = AF.clamp(this.bx, minX, maxX); AF.Audio.sfx('slam'); g.cam.shake(4, 14); this.set('stunned'); } }
          break;
        case 'stunned': if (this.st > 110) this.set('idle'); break;
        case 'burrow':
          if (this.st === 1) { AF.Audio.sfx('crumble'); }
          if (this.st < 30) { this.by += 1.4; if (this.st % 3 === 0) AF.fx.dust(g, this.bx + Math.random() * this.bw, this.floorY, 2, '#e0b060'); }
          if (this.st === 30) { this.under = true; }
          if (this.st > 30 && this.st < 100) { this.bx = AF.approach(this.bx, AF.clamp(p.cx - this.bw / 2, minX, maxX), 2.6); if (this.st % 3 === 0) AF.fx.dust(g, this.bx + this.bw / 2 + AF.rr(-10, 10), this.floorY, 2, '#e0b060'); }
          if (this.st === 100) this.set('erupt');
          break;
        case 'erupt':
          if (this.st < 30) { if (this.st % 2 === 0) AF.fx.dust(g, this.bx + Math.random() * this.bw, this.floorY, 2, '#e0b060'); if (this.st === 1) AF.Audio.sfx('warn'); }
          if (this.st === 30) { this.by = this.floorY - this.bh - 50; this.vy = -2; AF.Audio.sfx('roar'); g.cam.shake(4, 12); this.under = false; }
          if (this.st > 30) { this.vy += .3; this.by = Math.min(this.floorY - this.bh, this.by + this.vy); if (this.by >= this.floorY - this.bh && this.st > 35) { AF.Audio.sfx('slam'); this.set('stunned'); this.st = 50; } }
          break;
        case 'summon':
          if (this.st === 15 && this.minions() < 3) { this.spawnMinion('scorpbot', this.bx + this.bw / 2 - 20, this.floorY, { mini: true, dir: -1 }); this.spawnMinion('scorpbot', this.bx + this.bw / 2 + 20, this.floorY, { mini: true, dir: 1 }); AF.Audio.sfx('roar'); }
          if (this.st > 50) this.set('idle');
          break;
      }
    }
    tailTip() { const k = this.state === 'tail' ? 1 : 0; return { x: this.bx + (this.dir < 0 ? this.bw - 14 : 14) + (this.dir < 0 ? -k * 6 : k * 6), y: this.by - 34 - k * 4 }; }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      if (this.under && this.state === 'burrow') { ctx.fillStyle = '#c08a40'; ctx.fillRect(Math.round(this.bx + 30 - cx), Math.round(this.floorY - 4 - cy), 36, 4); return; }
      if (this.under) { if (this.state === 'erupt' && (t & 4)) { ctx.fillStyle = '#ff6040'; ctx.fillRect(Math.round(this.bx + 10 - cx), Math.round(this.floorY - 3 - cy), this.bw - 20, 3); } return; }
      const flip = this.dir > 0;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, AF.W, Math.round(this.floorY - cy)); ctx.clip();
      this.drawPart(ctx, a.body, this.bx - 2, this.by - 2, cx, cy, flip);
      // tail segments arcing over back
      const baseX = this.bx + (this.dir < 0 ? this.bw - 8 : 8), baseY = this.by + 18;
      const tip = this.tailTip();
      for (let i = 0; i < 5; i++) { const k = i / 5; const x = AF.lerp(baseX, tip.x, k) + (this.dir < 0 ? 1 : -1) * Math.sin(k * Math.PI) * 10, y = AF.lerp(baseY, tip.y, k) - Math.sin(k * Math.PI) * 10; this.drawPart(ctx, a.tail, x - 8, y - 8, cx, cy); }
      this.drawPart(ctx, a.sting, tip.x - 9, tip.y - 9, cx, cy);
      ctx.restore();
      if (this.state === 'stunned') for (let i = 0; i < 3; i++) { const aa = t * .15 + i * 2.1; ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(this.bx + 48 + Math.cos(aa) * 16 - cx), Math.round(this.by - 6 + Math.sin(aa) * 4 - cy), 2, 2); }
      if (!this.under && (t & 16) && this.state === 'stunned') AF.text(ctx, 'v', Math.round(this.bx + 48 - cx), Math.round(this.by - 18 - cy), '#40e0ff', { a: 'c' });
    }
  }
  OBJ.scorpion = Scorpion;

  // =====================================================================
  //  W7: THUNDERWING
  // =====================================================================
  class Thunderwing extends Boss {
    constructor(g, d) {
      d.p.name = 'THUNDERWING'; d.p.hp = d.p.hp || 12;
      super(g, d);
      this.bw = 72; this.bh = 36; this.bx = this.A.x + this.A.w / 2 - 36; this.by = this.A.y + 20; this.dir = -1; this.vx = 0; this.vy = 0;
      this.seqList = ['bolts', 'dive', 'shots', 'gust', 'perch', 'dive', 'bolts', 'perch'];
      this.art = art('bird', () => {
        const mk = up => pix(84, 48, p => {
          // wings
          if (up) { p.poly([[30, 22], [4, 0], [10, 14], [0, 18], [26, 30]], '#5070b0'); p.poly([[54, 22], [80, 0], [74, 14], [84, 18], [58, 30]], '#5070b0'); }
          else { p.poly([[30, 22], [2, 38], [12, 30], [4, 46], [28, 32]], '#5070b0'); p.poly([[54, 22], [82, 38], [72, 30], [80, 46], [56, 32]], '#5070b0'); }
          p.shadeEll(42, 26, 18, 11, ['#304070', '#5070b0', '#90b0e8', '#ffffff']);
          p.rect(34, 18, 16, 6, '#fff060'); p.rect(34, 18, 16, 1, '#ffffff');
          p.shadeEll(20, 22, 8, 7, ['#304070', '#5070b0', '#90b0e8']); p.poly([[12, 22], [2, 25], [12, 27]], '#ffd040'); p.rect(16, 19, 3, 2, '#ff2040');
          p.poly([[58, 28], [76, 24], [74, 34]], '#304070');
          p.line(36, 37, 34, 44, '#606878'); p.line(48, 37, 50, 44, '#606878');
        });
        return { up: mk(true), down: mk(false), bat: coreImg(true, '#fff060') };
      });
    }
    batR() { return R(this.bx + 34, this.by + 12, 16, 10); }
    weak() { return this.state === 'perched' ? [this.batR()] : []; }
    armor() { return [R(this.bx + 10, this.by + 6, this.bw - 20, this.bh - 6)]; }
    hurts() { return this.state === 'perched' ? [] : [R(this.bx + 12, this.by + 10, this.bw - 24, this.bh - 14)]; }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .75 : 1;
      const fly = (tx, ty, sp) => { const dx = tx - this.bx, dy = ty - this.by, d = Math.hypot(dx, dy) || 1; this.bx += dx / d * Math.min(sp, d); this.by += dy / d * Math.min(sp, d); if (Math.abs(dx) > 2) this.dir = dx < 0 ? -1 : 1; return d < 3; };
      switch (this.state) {
        case 'idle': fly(A.x + A.w / 2 - 36 + Math.sin(this.t * .02) * 60, A.y + 18 + Math.sin(this.t * .05) * 8, 1.5); if (this.st > 50 * fast) this.set(this.seqList[this.seq++ % this.seqList.length]); break;
        case 'bolts':
          if (this.st === 1) { const n = this.enraged ? 5 : 4; this.cols = []; const off = Math.random(); for (let i = 0; i < n; i++) this.cols.push(A.x + 16 + ((i + off) / n) * (A.w - 32)); this.cols.push(p.cx); AF.Audio.sfx('charge'); }
          if (this.st === 50) { AF.Audio.sfx('thunder'); g.cam.shake(3, 12); g.screenFlash = 6; for (const x of this.cols) g.spawn(new HurtRect(g, x - 6, A.y, 12, this.floorY - A.y, 18)); }
          if (this.st > 80) this.set('idle');
          break;
        case 'dive':
          if (this.st === 1) { this.side = p.cx < A.x + A.w / 2 ? 1 : -1; this.dir = -this.side; }
          if (this.st < 40) fly(this.side > 0 ? A.x + A.w - this.bw - 4 : A.x + 4, A.y + 8, 3);
          if (this.st === 40) { AF.Audio.sfx('warn'); this.sx = this.bx; this.sy = this.by; this.tx2 = this.side > 0 ? A.x + 4 : A.x + A.w - this.bw - 4; }
          if (this.st > 55) { const k = Math.min(1, (this.st - 55) / (this.enraged ? 45 : 55)); this.bx = AF.lerp(this.sx, this.tx2, k); this.by = this.sy + Math.sin(k * Math.PI) * (this.floorY - this.bh - this.sy - 6); this.dir = -this.side; if (this.st % 3 === 0) g.parts.add({ x: this.bx + this.bw / 2, y: this.by + 20, life: 12, col: '#fff060', size: 2, shrink: true }); if (k >= 1) this.set('idle'); }
          break;
        case 'shots':
          fly(A.x + A.w / 2 - 36, A.y + 16, 2);
          if (this.st === 30 || (this.enraged && this.st === 60)) { for (let i = 0; i < 5; i++) { const a = Math.PI / 2 + (i - 2) * .35; g.spawn(new AF.Shot(g, this.bx + this.bw / 2, this.by + this.bh, Math.cos(a) * 2, Math.sin(a) * 2, { spr: AF.SPR.ebolt, size: 9 })); } AF.Audio.sfx('zap'); }
          if (this.st > 80) this.set('idle');
          break;
        case 'gust': {
          if (this.st === 1) { this.side = p.cx < A.x + A.w / 2 ? -1 : 1; }
          if (this.st < 40) fly(this.side < 0 ? A.x + A.w - this.bw - 10 : A.x + 10, this.floorY - this.bh - 30, 3);
          if (this.st === 40) { this.dir = this.side < 0 ? -1 : 1; this.zone = { x: A.x, y: A.y, w: A.w, h: this.floorY - A.y, fx: this.side < 0 ? -.11 : .11, fy: 0, maxX: 2.6, active: true, kind: 'wind' }; g.zones.push(this.zone); AF.Audio.sfx('wind'); }
          if (this.st > 40 && this.st % 30 === 0) { g.spawn(new AF.Shot(g, this.bx + this.bw / 2, this.by + 20, -this.side * -2.6, AF.rr(-.6, .6), { spr: AF.SPR.iceshot, size: 8 })); AF.Audio.sfx('whoosh'); }
          if (this.st > 40 && this.st % 2 === 0) g.parts.add({ x: this.bx + this.bw / 2, y: A.y + Math.random() * (this.floorY - A.y), vx: this.side * -4 * -1, life: 40, col: '#ffffff', size: 1, fade: true });
          if (this.st > 190) { const i = g.zones.indexOf(this.zone); if (i >= 0) g.zones.splice(i, 1); this.set('idle'); }
          break;
        }
        case 'perch':
          if (fly(AF.clamp(p.cx - 36, A.x + 20, A.x + A.w - this.bw - 20), this.floorY - this.bh, 3)) { this.set('perched'); AF.Audio.sfx('land'); g.cam.shake(2, 8); }
          break;
        case 'perched':
          if (this.st % 10 === 0) g.parts.add({ x: this.bx + 42 + AF.rr(-8, 8), y: this.by + 14, vy: -1, life: 12, col: '#fff060', size: 1 });
          if (this.st > (this.enraged ? 110 : 150)) { this.set('idle'); AF.Audio.sfx('whoosh'); }
          break;
      }
    }
    drawBoss(ctx, cx, cy) {
      const flap = this.state === 'perched' ? false : ((this.t >> 3) & 1);
      this.drawPart(ctx, flap ? this.art.up : this.art.down, this.bx - 6, this.by - 6, cx, cy, this.dir > 0);
      if (this.state === 'perched') { this.drawPart(ctx, this.art.bat, this.batR().x - 1, this.batR().y - 4, cx, cy); if (this.t & 8) { ctx.globalAlpha = .35; ctx.fillStyle = '#fff060'; ctx.beginPath(); ctx.arc(Math.round(this.bx + 42 - cx), Math.round(this.by + 16 - cy), 14, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
      if (this.state === 'bolts' && this.st < 50 && this.cols) for (const x of this.cols) { ctx.globalAlpha = (this.t & 4) ? .35 : .15; ctx.fillStyle = '#fff080'; ctx.fillRect(Math.round(x - 6 - cx), Math.round(this.A.y - cy), 12, this.floorY - this.A.y); ctx.globalAlpha = 1; }
      if (this.state === 'bolts' && this.st >= 50 && this.st < 68 && this.cols) for (const x of this.cols) { let lx = x; for (let y = this.A.y; y < this.floorY; y += 8) { const nx = x + Math.round(Math.sin(y * 1.3 + this.t) * 4); ctx.fillStyle = '#c0e0ff'; ctx.fillRect(Math.round(Math.min(lx, nx) - 2 - cx), Math.round(y - cy), Math.abs(nx - lx) + 4, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(Math.min(lx, nx) - cx), Math.round(y - cy), Math.abs(nx - lx) + 1, 8); lx = nx; } }
    }
  }
  OBJ.thunderwing = Thunderwing;

  // =====================================================================
  //  W8: OMEGA GUARDIAN
  // =====================================================================
  class Omega extends Boss {
    constructor(g, d) {
      d.p.name = 'OMEGA GUARDIAN'; d.p.hp = d.p.hp || 20;
      super(g, d);
      this.bw = 64; this.bh = 92; this.bx = this.A.x + this.A.w - 96; this.by = this.floorY - this.bh; this.dir = -1; this.fist = null;
      this.seqList = ['fire', 'beam', 'ice', 'punch', 'missiles', 'beam'];
      this.art = art('omega', () => ({
        body: pix(68, 96, p => {
          p.rect(12, 66, 16, 30, '#2a2840'); p.rect(40, 66, 16, 30, '#2a2840'); p.rect(10, 90, 20, 6, '#1a1830'); p.rect(38, 90, 20, 6, '#1a1830');
          p.rect(4, 22, 60, 46, '#4a4670'); p.rect(4, 22, 60, 3, '#8a86c0'); p.rect(4, 64, 60, 4, '#2a2840');
          p.rect(16, 2, 36, 22, '#3a3860'); p.rect(16, 2, 36, 2, '#7a76a8'); p.rect(20, 8, 28, 8, '#100818'); p.rect(24, 10, 20, 3, '#ff3070');
          p.rect(22, 30, 24, 24, '#1a1830');
          p.rect(0, 22, 6, 30, '#ff6020'); p.rect(62, 22, 6, 30, '#40c0ff');
          for (let i = 0; i < 4; i++) p.rect(8 + i * 14, 58, 8, 3, '#30f0c0');
        }),
        coreO: coreImg(true, '#ff3070'), coreC: coreImg(false),
        fist: pix(24, 20, p => { p.rect(0, 2, 20, 16, '#4a4670'); p.rect(0, 2, 20, 3, '#8a86c0'); p.rect(18, 4, 6, 12, '#2a2840'); for (let y = 6; y < 16; y += 3) p.rect(1, y, 4, 2, '#1a1830'); })
      }));
    }
    coreR() { return R(this.bx + 23, this.by + 32, 18, 18); }
    weak() { return this.state === 'vent' ? [this.coreR()] : []; }
    armor() { return [R(this.bx, this.by, this.bw, this.bh)]; }
    hurts() { const r = [R(this.bx + 6, this.by + 4, this.bw - 12, this.bh - 4)]; if (this.fist) r.push(R(this.fist.x, this.fist.y, 22, 18)); return r; }
    think() {
      const g = this.g, A = this.A, p = this.pl, fast = this.enraged ? .7 : 1;
      const minX = A.x + 16, maxX = A.x + A.w - this.bw - 16;
      const mouthX = () => this.dir < 0 ? this.bx : this.bx + this.bw, mouthY = this.by + 40;
      if (this.fist) { const f = this.fist; f.x += f.vx; if (!f.back && (f.x < A.x + 4 || f.x > A.x + A.w - 26)) { f.back = true; f.vx = -f.vx; AF.Audio.sfx('clink'); g.cam.shake(2, 6); } if (f.back && Math.abs(f.x - this.bx) < 30) this.fist = null; }
      switch (this.state) {
        case 'idle':
          this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.bx = AF.clamp(this.bx + this.dir * .45, minX, maxX);
          if (this.st > 45 * fast && !this.fist) this.set(this.seqList[this.seq++ % this.seqList.length]);
          break;
        case 'vent': if (this.st % 4 === 0) AF.fx.steam(g, this.bx + this.bw / 2, this.by + 30); if (this.st > (this.enraged ? 90 : 120)) this.set('idle'); break;
        case 'fire':
          if (this.st % 16 === 8 && this.st < 60) { const dx = p.cx - mouthX(); g.spawn(new AF.Shot(g, mouthX(), this.by + 26, dx / 50, -4.5, { grav: .18, spr: AF.SPR.fireball, size: 9, trail: '#ff8020', explode: true })); AF.Audio.sfx('fire'); }
          if (this.st > 70) this.set('vent');
          break;
        case 'ice':
          if (this.st % 18 === 9 && this.st < 70) { const a = Math.atan2(p.cy - mouthY, p.cx - mouthX()); for (const o of [-.2, 0, .2]) g.spawn(new AF.Shot(g, mouthX(), mouthY, Math.cos(a + o) * 3, Math.sin(a + o) * 3, { spr: AF.SPR.iceshot, size: 8 })); AF.Audio.sfx('laser'); }
          if (this.st > 80) this.set('vent');
          break;
        case 'beam': {
          if (this.st === 1) { this.beamY = Math.random() < .5 ? this.floorY - 10 : this.floorY - 34; AF.Audio.sfx('charge'); this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; }
          if (this.st === 50) { AF.Audio.sfx('zap'); g.cam.shake(2, 30); }
          if (this.st >= 50 && this.st < 100) { const x0 = this.dir < 0 ? A.x : mouthX(), w = this.dir < 0 ? mouthX() - A.x : A.x + A.w - mouthX(); if (AF.rectsHit(p.x, p.y, p.w, p.h, x0, this.beamY - 4, w, 8)) p.hurt(1, mouthX()); }
          if (this.st > 110) this.set('vent');
          break;
        }
        case 'punch':
          if (this.st === 1) { this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.aimY = AF.clamp(p.y + 4, this.floorY - 54, this.floorY - 20); AF.Audio.sfx('charge'); }
          if (this.st === 34) { this.fist = { x: this.dir < 0 ? this.bx - 22 : this.bx + this.bw, y: this.aimY, vx: this.dir * 4.6, back: false }; AF.Audio.sfx('dash'); }
          if (this.st > 40 && !this.fist) this.set('vent');
          break;
        case 'missiles':
          if (this.st % 14 === 7 && this.st < (this.enraged ? 80 : 60)) { const s = new AF.Shot(g, this.bx + this.bw / 2, this.by, AF.rr(-2, 2), -3, { spr: AF.SPR.missile, size: 9, homing: .07, hittable: true, life: 240, explode: true, trail: '#a0a0b0' }); s.homeT = 120; g.spawn(s); AF.Audio.sfx('shoot'); }
          if (this.st > 90) this.set('vent');
          break;
      }
    }
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      this.drawPart(ctx, a.body, this.bx - 2, this.by - 2, cx, cy, this.dir > 0);
      const c = this.coreR();
      this.drawPart(ctx, this.state === 'vent' ? a.coreO : a.coreC, c.x - 1, c.y - 1, cx, cy);
      if (this.state === 'vent' && (t & 8)) { ctx.globalAlpha = .3; ctx.fillStyle = '#ff3070'; ctx.beginPath(); ctx.arc(Math.round(c.x + 9 - cx), Math.round(c.y + 9 - cy), 16, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
      if (this.fist) this.drawPart(ctx, a.fist, this.fist.x, this.fist.y, cx, cy, this.fist.vx < 0);
      else { this.drawPart(ctx, a.fist, this.bx - 18, this.by + 40, cx, cy, true); this.drawPart(ctx, a.fist, this.bx + this.bw - 6, this.by + 40, cx, cy); }
      if (this.state === 'beam') {
        const x0 = this.dir < 0 ? this.A.x : (this.dir < 0 ? this.bx : this.bx + this.bw), x1 = this.dir < 0 ? this.bx : this.A.x + this.A.w;
        if (this.st < 50 && (t & 4)) { ctx.fillStyle = '#ff3070'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - cy), x1 - x0, 1); }
        if (this.st >= 50 && this.st < 100) { ctx.fillStyle = '#ff3070'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - 5 - cy), x1 - x0, 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - 2 - cy), x1 - x0, 4); }
      }
      if (this.state === 'punch' && this.st < 34 && (t & 4)) { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round((this.dir < 0 ? this.A.x : this.bx + this.bw) - cx), Math.round(this.aimY + 9 - cy), this.dir < 0 ? this.bx - this.A.x : this.A.x + this.A.w - this.bx - this.bw, 1); }
    }
  }
  OBJ.omega = Omega;
})();
