'use strict';
// ============================================================
//  Enemies: 24 types, 3 per world
// ============================================================
(function () {
  const TS = AF.TS, OBJ = AF.OBJ;

  class Enemy extends AF.Ent {
    constructor(g, d, w, h, hp, spr) {
      super(g, d.x * TS + (TS - w) / 2, (d.y + 1) * TS - h, w, h);
      this.p = d.p || {};
      this.hp = hp; this.maxHp = hp; this.dir = this.p.dir || -1; this.grav = 1; this.flash = 0; this.kb = 0;
      this.state = 'idle'; this.stT = 0; this.stompable = true; this.dmg = 1; this.score = 100; this.hittable = true; this.armorFront = false;
      this.spr = AF.SPR.en[spr]; this.frame = 0; this.home = { x: this.x, y: this.y }; this.cool = AF.ri(30, 90); this.flying = false; this.isEnemy = true;
      this.range = 110; this.wake = false;
      g.bodies.push(this); g.enemyCount++;
    }
    get pl() { return this.g.player; }
    set_(s) { this.state = s; this.stT = 0; }
    pdx() { return this.pl.cx - this.cx; }
    pdy() { return this.pl.cy - this.cy; }
    sees(r, band) { const dx = this.pdx(), dy = this.pdy(); return Math.abs(dx) < (r || this.range) && Math.abs(dy) < (band || 40) && this.pl.state !== 'dead'; }
    face() { this.dir = this.pdx() >= 0 ? 1 : -1; }
    update() {
      if (!this.near(120)) { if (!this.wake) return; }
      this.wake = true;
      this.t++; this.stT++;
      if (this.flash > 0) this.flash--;
      if (this.cool > 0) this.cool--;
      if (this.kb > 0) {
        this.kb--;
        this.vx *= .88;
        if (!this.flying) this.vy = Math.min(5, this.vy + .25); else this.vy *= .85;
        AF.moveBody(this, this.g.lv);
        return;
      }
      this.ai();
      if (this.y > this.g.lv.ph + 40) this.dead = true;
    }
    phys() { this.vy = Math.min(5, this.vy + .25); AF.moveBody(this, this.g.lv); }
    patrol(sp) {
      const lv = this.g.lv;
      if (this.onGround) {
        const fx = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
        if (!AF.groundAt(lv, fx, this.y + this.h + 3) || lv.liquidAt(fx, this.y + this.h + 3) && lv.liquidAt(fx, this.y + this.h + 3).kind !== 'water') this.dir *= -1;
      }
      this.vx = this.dir * sp;
      this.phys();
      if (this.hitWall) this.dir *= -1;
    }
    hover(sp) { // flyer drift toward home
      this.vx += (this.home.x - this.x) * .002; this.vy += (this.home.y - this.y) * .002; this.vx *= .96; this.vy *= .96;
    }
    flyMove() { this.x += this.vx; this.y += this.vy; }
    shoot(vx, vy, o) { const s = new AF.Shot(this.g, this.cx + this.dir * this.w * .4, this.cy, vx, vy, o); this.g.spawn(s); if (this.near()) AF.Audio.sfx('enemyshot'); return s; }
    aim(speed) { const dx = this.pdx(), dy = this.pdy(), d = Math.hypot(dx, dy) || 1; return [dx / d * speed, dy / d * speed]; }
    blocks(box) { // armor check
      if (box.kind === 'charge' || box.kind === 'slam') return false;
      if (this.armorFront) { const fromFront = box.dir === -this.dir || (box.dir === 0); if (fromFront && box.kind !== 'kick' && !(box.y + box.h < this.y + 4)) return true; }
      return false;
    }
    hit(box) {
      if (this.dead || this.lastHit === box.id || this.invuln) return false;
      this.lastHit = box.id;
      const g = this.g;
      if (this.blocks(box)) { AF.Audio.sfx('clink'); AF.fx.hit(g, box.dir > 0 ? this.x : this.x + this.w, this.cy); this.vx = (box.dir || 1) * 1; if (box.owner === this.pl) this.pl.vx = -(box.dir || 1) * 1.5; this.onBlock && this.onBlock(); return true; }
      this.hp -= box.dmg; this.flash = 12;
      g.hitstop = box.big ? 6 : 3;
      AF.fx.hit(g, AF.clamp(box.x + box.w / 2, this.x, this.x + this.w), AF.clamp(box.y + box.h / 2, this.y, this.y + this.h), box.big);
      AF.Audio.sfx(box.big ? 'bighit' : 'hit');
      if (box.big) g.cam.shake(2, 6);
      if (this.hp <= 0) { this.die(box); return true; }
      this.kb = 14; this.vx = (box.dir || AF.sign(this.cx - this.pl.cx) || 1) * box.knock * (this.heavy ? .4 : 1); this.vy = this.flying ? 0 : -1.8 * (this.heavy ? .3 : 1);
      this.onHurt && this.onHurt(box);
      return true;
    }
    die(box) {
      const g = this.g;
      this.dead = true;
      AF.fx.boom(g, this.cx, this.cy); AF.Audio.sfx('explode');
      g.addScore(this.score, this.cx, this.y);
      g.stats.kills++;
      const n = this.coins || AF.ri(1, 2);
      for (let i = 0; i < n; i++) g.spawn(new OBJ.coin(g, { x: 0, y: 0, p: { free: true, px: this.cx - 5, py: this.y, vx: AF.rr(-1.5, 1.5), vy: AF.rr(-4, -2) } }));
      const r = Math.random();
      if (r < .12) g.spawn(new OBJ.heart(g, { x: this.cx / TS - .5, y: this.y / TS, p: {} }));
      else if (r < .26) g.spawn(new OBJ.orb(g, { x: this.cx / TS - .5, y: this.y / TS, p: {} }));
      this.onDie && this.onDie();
    }
    touch(p) {
      if (this.dead || this.harmless) return;
      // stomp
      const falling = p.vy * p.grav > .5;
      const above = p.grav > 0 ? (p.y + p.h - p.vy <= this.y + 7) : (p.y - p.vy >= this.y + this.h - 7);
      if (falling && above && p.state !== 'hurt') {
        if (this.stompable && !this.spiky()) {
          this.hit({ id: 'st' + this.g.t + Math.random(), dmg: 1 * p.power(), dir: 0, knock: 0, kind: 'stomp', x: p.x, y: p.y + p.h - 4, w: p.w, h: 4 });
          p.vy = (AF.Input.down.jump ? -5.6 : -4.2) * p.grav; p.djumpUsed = false; p.airDashUsed = false; p.jumpCut = AF.Input.down.jump;
          if (p.state === 'kick' || p.state === 'slam') p.toNormal();
          AF.Audio.sfx('boing');
          return;
        }
      }
      if (p.state === 'slam' && this.stompable) return;
      p.hurt(this.dmg, this.cx);
    }
    spiky() { return !this.stompable; }
    fr(i) { return this.spr[Math.min(i, this.spr.length - 1)]; }
    draw(ctx, cx, cy) {
      const s = this.fr(this.frame);
      AF.drawSpr(ctx, s, this.cx - cx, this.flying ? this.cy - cy : this.y + this.h - cy, -this.dir * (this.flipArt ? -1 : 1) * -1 === 1 ? 1 : -1, this.flash > 0 && (this.flash & 2));
      if (this.hp < this.maxHp && this.maxHp >= 3 && this.flash > 0) {
        const x = Math.round(this.cx - cx - 8), y = Math.round(this.y - cy - 6);
        ctx.fillStyle = '#140a18'; ctx.fillRect(x - 1, y - 1, 18, 4); ctx.fillStyle = '#ff4060'; ctx.fillRect(x, y, Math.round(16 * this.hp / this.maxHp), 2);
      }
    }
  }
  AF.Enemy = Enemy;
  const reg = (n, c) => { OBJ[n] = c; return c; };

  // ======== WORLD 1 ========
  reg('beetle', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 12, 2, 'beetle'); this.range = 90; }
    ai() {
      if (this.state === 'idle') { this.patrol(.5); this.frame = (this.t >> 3) & 1; if (this.sees(this.range, 24) && this.cool <= 0 && AF.sign(this.pdx()) === this.dir) { this.set_('alert'); AF.Audio.sfx('warn'); } }
      else if (this.state === 'alert') { this.vx = 0; this.phys(); this.frame = 2; if (this.stT > 20) this.set_('charge'); }
      else if (this.state === 'charge') { this.patrol(1.5); this.frame = (this.t >> 2) & 1; if (this.stT > 70) { this.set_('idle'); this.cool = 90; } }
    }
  });
  reg('thorn', class extends Enemy {
    constructor(g, d) { super(g, d, 22, 12, 2, 'thorn'); this.stompable = false; this.score = 150; }
    ai() { this.patrol(this.flash ? 0 : .35); this.frame = (this.t >> 4) & 1; }
  });
  reg('wasp', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 12, 1, 'wasp'); this.flying = true; this.home.y -= 8; this.y = this.home.y; this.range = 100; }
    ai() {
      this.frame = (this.t >> 1) & 1;
      if (this.state === 'idle') {
        this.x = this.home.x + Math.sin(this.t * .02) * 30; this.y = this.home.y + Math.sin(this.t * .07) * 6;
        this.dir = Math.cos(this.t * .02) >= 0 ? 1 : -1;
        if (this.cool <= 0 && Math.hypot(this.pdx(), this.pdy()) < this.range) { this.set_('wind'); this.face(); AF.Audio.sfx('warn'); }
      } else if (this.state === 'wind') { this.y -= .3; if (this.stT > 22) { const a = this.aim(2.8); this.vx = a[0]; this.vy = a[1]; this.set_('dive'); } }
      else if (this.state === 'dive') { this.flyMove(); if (this.stT > 40 || AF.rectSolid(this.g.lv, this.x, this.y, this.w, this.h)) { this.set_('back'); } }
      else if (this.state === 'back') { const dx = this.home.x - this.x, dy = this.home.y - this.y, d = Math.hypot(dx, dy); this.dir = AF.sign(dx) || 1; if (d < 3) { this.set_('idle'); this.cool = 100; this.t = 0; } else { this.x += dx / d * 1.3; this.y += dy / d * 1.3; } }
    }
  });

  // ======== WORLD 2 ========
  reg('robofish', class extends Enemy {
    constructor(g, d) { super(g, d, 20, 10, 2, 'robofish'); this.flying = true; this.range = 100; }
    ai() {
      const lv = this.g.lv, inW = lv.liquidAt(this.cx, this.cy);
      this.frame = (this.t >> 3) & 1;
      if (!inW) { this.vy = Math.min(4, this.vy + .25); this.x += this.vx * .5; this.y += this.vy; if (AF.rectSolid(lv, this.x, this.y + this.h, this.w, 2)) { this.vy = -2; this.y -= 2; } return; }
      if (this.state === 'idle') {
        this.vx = this.dir * .6; this.vy = Math.sin(this.t * .05) * .3;
        const nx = this.x + this.vx * 10 + (this.dir > 0 ? this.w : 0);
        if (AF.rectSolid(lv, nx, this.y, 2, this.h) || !lv.liquidAt(nx, this.cy) || Math.abs(this.x - this.home.x) > 80) this.dir = this.x > this.home.x ? -1 : 1;
        if (this.cool <= 0 && this.pl.swimming && Math.hypot(this.pdx(), this.pdy()) < this.range) { this.face(); this.set_('charge'); const a = this.aim(2.2); this.vx = a[0]; this.vy = a[1]; }
      } else if (this.state === 'charge') { if (this.stT > 45) { this.set_('idle'); this.cool = 90; } }
      const ox = this.x, oy = this.y; this.x += this.vx; this.y += this.vy;
      if (AF.rectSolid(lv, this.x, this.y, this.w, this.h) || !lv.liquidAt(this.cx, this.y)) { this.x = ox; this.y = oy; this.dir *= -1; if (this.state === 'charge') this.set_('idle'); }
      if (this.vx) this.dir = AF.sign(this.vx);
    }
  });
  reg('jelly', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 14, 2, 'jelly'); this.flying = true; this.t = AF.ri(0, 150); }
    ai() {
      const ph = this.t % 180;
      this.y = this.home.y + Math.sin(this.t * .03) * 12;
      this.zap = ph > 120;
      this.frame = this.zap ? ((this.t & 2) ? 2 : 0) : ((this.t >> 4) & 1);
      this.stompable = !this.zap;
      if (this.zap && ph === 121 && this.near()) AF.Audio.sfx('zap');
      if (this.zap) { const p = this.pl; if (Math.hypot(this.pdx(), this.pdy()) < 22) p.hurt(1, this.cx); if (this.t % 3 === 0) this.g.parts.add({ x: this.cx + AF.rr(-14, 14), y: this.cy + AF.rr(-14, 14), life: 6, col: '#ffff80', size: 1 }); }
    }
    blocks(box) { return this.zap && box.kind !== 'wave'; }
    onBlock() { this.pl.hurt(1, this.cx); }
  });
  reg('crab', class extends Enemy {
    constructor(g, d) { super(g, d, 24, 14, 3, 'crab'); this.armorFront = true; this.score = 200; this.range = 70; }
    ai() {
      if (this.state === 'idle') { this.patrol(.4); this.frame = (this.t >> 4) & 1; if (this.cool <= 0 && this.sees(this.range, 24)) { this.face(); this.set_('snap'); } }
      else { this.vx = 0; this.phys(); this.frame = this.stT > 16 ? 2 : 0; if (this.stT === 18) { AF.Audio.sfx('clink'); const bx = this.dir > 0 ? this.x + this.w : this.x - 16; if (AF.rectsHit(this.pl.x, this.pl.y, this.pl.w, this.pl.h, bx, this.y - 6, 16, 18)) this.pl.hurt(1, this.cx); } if (this.stT > 40) { this.set_('idle'); this.cool = 70; } }
    }
  });

  // ======== WORLD 3 ========
  reg('snowdrone', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 14, 2, 'snowdrone'); this.flying = true; this.home.y -= 16; this.y = this.home.y; }
    ai() {
      this.frame = (this.t >> 2) & 1;
      const dx = this.pdx();
      if (Math.abs(dx) < 160 && Math.abs(this.pdy()) < 140) { this.vx = AF.approach(this.vx, AF.clamp(dx * .02, -1, 1), .03); }
      else this.vx = AF.approach(this.vx, (this.home.x - this.x) * .01, .03);
      this.x += this.vx; this.y = this.home.y + Math.sin(this.t * .05) * 4;
      if (AF.rectSolid(this.g.lv, this.x, this.y, this.w, this.h)) this.x -= this.vx * 2;
      if (this.cool <= 0 && Math.abs(dx) < 20 && this.pdy() > 0) { this.cool = 80; const s = this.shoot(0, .5, { grav: .15, spr: AF.SPR.fx.puff[1], size: 8 }); s.y = this.y + this.h; }
    }
  });
  reg('icebat', class extends Enemy {
    constructor(g, d) { super(g, d, 14, 12, 1, 'icebat'); this.flying = true; this.y = d.y * TS; this.home.y = this.y; this.state = 'hang'; }
    ai() {
      if (this.state === 'hang') { this.frame = 2; if (this.cool <= 0 && Math.abs(this.pdx()) < 70 && this.pdy() > 0 && this.pdy() < 120) { this.set_('swoop'); this.face(); this.sx = this.x; this.sy = this.y; this.tx = this.pl.cx; this.ty = this.pl.cy; AF.Audio.sfx('whoosh'); } }
      else if (this.state === 'swoop') {
        this.frame = (this.t >> 2) & 1;
        const k = this.stT / 70;
        this.x = AF.lerp(this.sx, this.sx + (this.tx - this.sx) * 2, k);
        this.y = this.sy + Math.sin(k * Math.PI) * (this.ty - this.sy + 6);
        if (k >= 1) { this.set_('hang'); this.cool = 60; this.home.x = this.x; }
      }
    }
    draw(ctx, cx, cy) { const s = this.fr(this.frame); AF.drawSpr(ctx, s, this.cx - cx, this.state === 'hang' ? this.y - cy : this.cy - cy, this.dir > 0 ? 1 : -1, this.flash > 0 && (this.flash & 2)); }
  });
  reg('slime', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 12, 2, 'slime'); }
    ai() {
      this.phys();
      if (this.onGround) {
        this.vx = AF.approach(this.vx, 0, .2);
        this.frame = this.stT < 6 ? 2 : (this.t >> 4) & 1;
        if (this.stT > 60 && this.near()) { this.face(); this.vy = -4; this.vx = this.dir * (this.sees(140, 80) ? 1.3 : .6); this.stT = 0; this.frame = 1; }
      } else this.frame = 1;
      if (this.justLanded) this.stT = 0;
    }
  });

  // ======== WORLD 4 ========
  reg('firesprite', class extends Enemy {
    constructor(g, d) { super(g, d, 14, 16, 2, 'sprite'); this.flying = true; this.stompable = false; this.home.y -= 10; }
    ai() {
      this.frame = this.state === 'shoot' ? 2 : (this.t >> 3) & 1;
      this.x = this.home.x + Math.sin(this.t * .025) * 20; this.y = this.home.y + Math.sin(this.t * .06) * 8;
      this.face();
      if (this.state === 'idle' && this.cool <= 0 && Math.hypot(this.pdx(), this.pdy()) < 140) { this.set_('shoot'); }
      if (this.state === 'shoot' && this.stT === 16) { const a = this.aim(1.8); this.shoot(a[0], a[1], { spr: AF.SPR.fireball, size: 8, trail: '#ff8020' }); }
      if (this.state === 'shoot' && this.stT > 30) { this.set_('idle'); this.cool = 110; }
      if (this.t % 6 === 0) AF.fx.ember(this.g, this.cx, this.y + this.h);
    }
  });
  reg('mcrawler', class extends Enemy {
    constructor(g, d) { super(g, d, 24, 12, 3, 'mcrawler'); this.stompable = false; this.score = 200; }
    ai() {
      this.patrol(this.state === 'erupt' ? 0 : .45); this.frame = (this.t >> 4) & 1;
      if (this.state === 'idle' && this.cool <= 0 && this.sees(120, 60)) { this.set_('erupt'); AF.Audio.sfx('fire'); }
      if (this.state === 'erupt') { if (this.stT === 20) for (let i = -1; i <= 1; i++) this.shoot(i * 1.2, -4.5, { grav: .2, spr: AF.SPR.fireball, size: 7 }); if (this.stT > 30) { this.set_('idle'); this.cool = 150; } }
    }
  });
  reg('turret', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 16, 3, 'turret'); this.heavy = true; this.score = 200; }
    ai() {
      this.phys(); this.vx = 0;
      if (Math.abs(this.pdx()) < 160 && Math.abs(this.pdy()) < 60) {
        this.face();
        if (this.cool <= 0) { this.cool = 95; this.frame = 1; this.shoot(this.dir * 2.4, 0, { spr: AF.SPR.fireball, size: 8, trail: '#ff6020' }); AF.Audio.sfx('fire'); }
      }
      if (this.cool < 80) this.frame = 0;
    }
  });

  // ======== WORLD 5 ========
  reg('secbot', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 26, 3, 'secbot'); this.score = 250; this.range = 120; }
    ai() {
      if (this.state === 'idle') { this.patrol(.5); this.frame = (this.t >> 3) & 1; if (this.cool <= 0 && this.sees(this.range, 30) && AF.sign(this.pdx()) === this.dir) { this.set_('aim'); AF.Audio.sfx('alarm'); } }
      else if (this.state === 'aim') { this.vx = 0; this.phys(); this.frame = 2; if (this.stT === 20 || this.stT === 30 || this.stT === 40) this.shoot(this.dir * 3, 0, { spr: AF.SPR.bullet, size: 6 }); if (this.stT > 60) { this.set_('idle'); this.cool = 80; } }
    }
  });
  reg('drone', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 12, 2, 'drone'); this.flying = true; this.home.y -= 16; this.y = this.home.y; }
    ai() {
      this.frame = (this.t >> 1) & 1;
      const near = Math.hypot(this.pdx(), this.pdy()) < 150;
      if (this.state === 'idle') {
        const tx = near ? this.pl.cx - 40 * AF.sign(this.pdx() || 1) : this.home.x, ty = near ? this.pl.y - 30 : this.home.y;
        this.vx = AF.approach(this.vx, AF.clamp((tx - this.cx) * .03, -1.2, 1.2), .05); this.vy = AF.approach(this.vy, AF.clamp((ty - this.cy) * .03, -1, 1), .05);
        this.flyMove(); this.face();
        if (near && this.cool <= 0) { this.set_('lunge'); AF.Audio.sfx('warn'); }
      } else if (this.state === 'lunge') {
        if (this.stT < 16) { this.x += AF.rr(-1, 1); } else if (this.stT === 16) { const a = this.aim(3); this.vx = a[0]; this.vy = a[1]; } else { this.flyMove(); if (this.stT > 50) { this.set_('idle'); this.cool = 110; } }
      }
      if (AF.rectSolid(this.g.lv, this.x, this.y, this.w, this.h)) { this.x -= this.vx * 2; this.y -= this.vy * 2; this.vx = -this.vx; this.vy = -this.vy; }
    }
  });
  reg('gearcrawler', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 18, 2, 'gear'); this.stompable = false; }
    ai() {
      this.patrol(1.4); this.frame = ((this.t >> 2) % 4);
      if (this.onGround && this.cool <= 0 && this.sees(70, 20) && AF.sign(this.pdx()) === this.dir) { this.vy = -4.5; this.cool = 100; AF.Audio.sfx('boing'); }
    }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, this.fr(this.dir > 0 ? this.frame : 3 - this.frame), this.cx - cx, this.y + this.h - cy, 1, this.flash > 0 && (this.flash & 2)); }
  });

  // ======== WORLD 6 ========
  reg('sandworm', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 16, 3, 'worm'); this.flying = true; this.state = 'hide'; this.invuln = true; this.baseY = (d.y + 1) * TS; this.trail = []; this.stompable = false; this.score = 250; }
    ai() {
      const pl = this.pl;
      if (this.state === 'hide') { this.invuln = true; this.y = this.baseY + 8; if (this.cool <= 0 && Math.abs(this.pdx()) < 90 && Math.abs(pl.y + pl.h - this.baseY) < 40) { this.set_('warn'); this.face(); this.x = AF.clamp(pl.cx - this.dir * 40, this.home.x - 80, this.home.x + 80); } }
      else if (this.state === 'warn') { if (this.t % 3 === 0) AF.fx.dust(this.g, this.cx, this.baseY, 2, '#e0b060'); if (this.stT > 34) { this.set_('leap'); this.sx = this.cx; AF.Audio.sfx('crumble'); this.invuln = false; } }
      else if (this.state === 'leap') {
        const k = this.stT / 60;
        this.x = this.sx + this.dir * k * 90 - this.w / 2; this.y = this.baseY - Math.sin(k * Math.PI) * 60 - this.h / 2;
        this.trail.unshift([this.cx, this.cy]); if (this.trail.length > 30) this.trail.pop();
        this.frame = (this.t >> 2) & 1;
        if (k >= 1) { this.set_('hide'); this.cool = 90; this.trail = []; AF.fx.dust(this.g, this.cx, this.baseY, 6, '#e0b060'); }
      }
    }
    draw(ctx, cx, cy) {
      if (this.state === 'hide') return;
      if (this.state === 'warn') { ctx.fillStyle = '#c08a40'; ctx.fillRect(Math.round(this.cx - cx) - 8, Math.round(this.baseY - cy) - 3 - ((this.t >> 2) & 1), 16, 3); return; }
      for (let i = this.trail.length - 1; i > 0; i -= 5) { const q = this.trail[i]; if (q[1] < this.baseY) AF.drawSpr(ctx, this.spr[2], q[0] - cx, q[1] - cy, 1); }
      AF.drawSpr(ctx, this.spr[this.frame], this.cx - cx, this.cy - cy, 1, this.flash > 0 && (this.flash & 2));
    }
  });
  reg('scarab', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 12, 2, 'scarab'); this.flying = true; this.home.y -= 20; }
    ai() {
      this.frame = (this.t >> 1) & 1;
      if (this.state === 'idle') {
        this.x = this.home.x + Math.sin(this.t * .018) * 50; this.y = this.home.y + Math.sin(this.t * .036) * 14; this.dir = Math.cos(this.t * .018) > 0 ? 1 : -1;
        if (this.cool <= 0 && Math.abs(this.pdx()) < 80 && this.pdy() > 0) { this.set_('swoop'); this.sx = this.x; this.sy = this.y; this.face(); }
      } else { const k = this.stT / 60; this.x = this.sx + this.dir * k * 100; this.y = this.sy + Math.sin(k * Math.PI) * Math.max(20, this.pdy() + 10); if (k >= 1) { this.home.x = this.x; this.home.y = this.sy; this.t = 0; this.set_('idle'); this.cool = 100; } }
    }
  });
  reg('scorpbot', class extends Enemy {
    constructor(g, d) { super(g, d, 24, 16, 3, 'scorp'); this.score = 250; this.range = 130; if (d.p.mini) { this.hp = this.maxHp = 1; this.mini = true; this.score = 50; } }
    ai() {
      if (this.state === 'idle') { this.patrol(this.mini ? 1 : .5); this.frame = (this.t >> 3) & 1; if (!this.mini && this.cool <= 0 && this.sees(this.range, 50)) { this.face(); this.set_('tail'); } }
      else { this.vx = 0; this.phys(); this.frame = 2; if (this.stT === 18) { const a = this.aim(2.2); this.shoot(a[0], a[1] - 1.2, { spr: AF.SPR.ebolt, grav: .04, size: 8, trail: '#80f0ff' }); } if (this.stT > 36) { this.set_('idle'); this.cool = 120; } }
    }
  });

  // ======== WORLD 7 ========
  reg('flybot', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 14, 2, 'flybot'); this.flying = true; this.home.y -= 12; }
    ai() {
      this.frame = (this.t >> 2) & 1;
      this.x = this.home.x + Math.sin(this.t * .02) * 24; this.y = this.home.y + Math.sin(this.t * .05) * 10; this.face();
      if (this.cool <= 0 && Math.hypot(this.pdx(), this.pdy()) < 150) { this.cool = 120; const a = this.aim(2.2); this.shoot(a[0], a[1]); }
    }
  });
  reg('wisp', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 16, 2, 'wisp'); this.flying = true; this.stompable = false; this.alpha = 1; this.home.y -= 10; }
    ai() {
      this.frame = this.state === 'cast' ? 2 : (this.t >> 3) & 1;
      if (this.state === 'idle') { this.y = this.home.y + Math.sin(this.t * .05) * 6; this.face(); if (this.cool <= 0 && Math.hypot(this.pdx(), this.pdy()) < 160) this.set_('fade'); }
      else if (this.state === 'fade') { this.alpha = 1 - this.stT / 20; this.invuln = true; if (this.stT >= 20) { const side = Math.random() < .5 ? -1 : 1; let nx = this.pl.cx + side * 56 - this.w / 2, ny = this.pl.y - 24; if (AF.rectSolid(this.g.lv, nx, ny, this.w, this.h)) { nx = this.pl.cx - side * 56 - this.w / 2; } if (!AF.rectSolid(this.g.lv, nx, ny, this.w, this.h)) { this.x = nx; this.y = ny; this.home.y = ny; } this.set_('appear'); } }
      else if (this.state === 'appear') { this.alpha = this.stT / 15; if (this.stT >= 15) { this.invuln = false; this.set_('cast'); this.face(); } }
      else if (this.state === 'cast') { if (this.stT === 20) { for (let i = -1; i <= 1; i++) { const a = Math.atan2(this.pdy(), this.pdx()) + i * .3; this.shoot(Math.cos(a) * 2, Math.sin(a) * 2, { spr: AF.SPR.ebolt, size: 8 }); } } if (this.stT > 40) { this.set_('idle'); this.cool = 150; } }
    }
    draw(ctx, cx, cy) { ctx.globalAlpha = AF.clamp(this.alpha, 0, 1); super.draw(ctx, cx, cy); ctx.globalAlpha = 1; }
  });
  reg('ldrone', class extends Enemy {
    constructor(g, d) { super(g, d, 22, 12, 3, 'ldrone'); this.flying = true; this.home.y -= 32; this.y = this.home.y; this.span = (d.p.span || 4) * TS; this.score = 250; }
    ai() {
      if (this.state === 'idle') { this.frame = 0; this.x = this.home.x + Math.sin(this.t * .015) * this.span; if (this.cool <= 0 && Math.abs(this.pdx()) < 10 && this.pdy() > 0) { this.set_('charge'); AF.Audio.sfx('warn'); } }
      else if (this.state === 'charge') { this.frame = (this.t >> 1) & 1; if (this.stT % 2 === 0) this.g.parts.add({ x: this.cx + AF.rr(-8, 8), y: this.y + this.h, life: 6, col: '#fff060', size: 1 }); if (this.stT > 30) { const s = this.shoot(0, 5, { spr: AF.SPR.ebolt, size: 8, trail: '#fff060' }); s.x = this.cx - 4; AF.Audio.sfx('zap'); this.set_('idle'); this.cool = 70; } }
    }
  });

  // ======== WORLD 8 ========
  reg('guard', class extends Enemy {
    constructor(g, d) { super(g, d, 18, 30, 5, 'guard'); this.armorFront = true; this.score = 400; this.range = 140; this.heavy = true; }
    ai() {
      if (this.state === 'idle') { this.patrol(.45); this.frame = (this.t >> 3) & 1; if (this.sees(this.range, 40)) { this.face(); this.set_('chase'); } }
      else if (this.state === 'chase') { this.face(); this.patrol(.9); this.frame = (this.t >> 2) & 1; if (Math.abs(this.pdx()) < 30 && this.cool <= 0) { this.set_('wind'); AF.Audio.sfx('warn'); } if (!this.sees(200, 80)) this.set_('idle'); }
      else if (this.state === 'wind') { this.vx = 0; this.phys(); this.frame = 0; if (this.stT > 18) { this.set_('slash'); this.vx = this.dir * 2.5; AF.Audio.sfx('whoosh'); } }
      else if (this.state === 'slash') { this.frame = 2; this.vx *= .9; this.phys(); const bx = this.dir > 0 ? this.x + this.w : this.x - 20; if (this.stT < 12 && AF.rectsHit(this.pl.x, this.pl.y, this.pl.w, this.pl.h, bx, this.y + 8, 20, 12)) this.pl.hurt(1, this.cx); if (this.stT > 24) { this.set_('chase'); this.cool = 60; } }
    }
    onHurt() { this.face(); if (this.state === 'idle') this.set_('chase'); }
  });
  reg('lturret', class extends Enemy {
    constructor(g, d) { super(g, d, 16, 16, 4, 'lturret'); this.heavy = true; this.ceil = !!d.p.ceil; if (this.ceil) this.y = d.y * TS; this.score = 300; this.flying = true; }
    ai() {
      this.frame = this.state === 'charge' && (this.t & 2) ? 1 : 0;
      const dist = Math.hypot(this.pdx(), this.pdy());
      if (this.state === 'idle') { if (this.cool <= 0 && dist < 170) { this.set_('charge'); this.ang = Math.atan2(this.pdy(), this.pdx()); AF.Audio.sfx('charge'); } }
      else if (this.state === 'charge') { const ta = Math.atan2(this.pdy(), this.pdx()); if (this.stT < 30) this.ang += AF.clamp(ta - this.ang, -.05, .05); if (this.stT > 44) this.set_('fire'); }
      else if (this.state === 'fire') { if (this.stT % 5 === 0 && this.stT <= 15) { this.g.spawn(new AF.Shot(this.g, this.cx + Math.cos(this.ang) * 8, this.cy + Math.sin(this.ang) * 8, Math.cos(this.ang) * 4.5, Math.sin(this.ang) * 4.5, { spr: AF.SPR.bullet, size: 5 })); AF.Audio.sfx('laser'); } if (this.stT > 25) { this.set_('idle'); this.cool = 90; } }
    }
    draw(ctx, cx, cy) {
      if (this.state === 'charge' && this.stT < 44) { ctx.strokeStyle = (this.t & 4) ? '#ff2060' : '#802040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(this.cx - cx) + .5, Math.round(this.cy - cy) + .5); ctx.lineTo(Math.round(this.cx - cx + Math.cos(this.ang) * 200) + .5, Math.round(this.cy - cy + Math.sin(this.ang) * 200) + .5); ctx.stroke(); }
      AF.drawSpr(ctx, this.fr(this.frame), this.cx - cx, this.ceil ? this.y - cy : this.y + this.h - cy, 1, this.flash > 0 && (this.flash & 2), this.ceil);
    }
  });
  reg('exbot', class extends Enemy {
    constructor(g, d) { super(g, d, 22, 22, 4, 'exbot'); this.score = 400; }
    ai() {
      this.phys();
      if (this.onGround) {
        this.vx = AF.approach(this.vx, 0, .25);
        this.frame = this.stT < 8 ? 1 : 0;
        if (this.stT === 12 && this.landed2) { this.face(); for (let i = -1; i <= 1; i++) this.shoot(this.dir * 2, i * .8 - .5, { spr: AF.SPR.bullet, size: 6 }); this.frame = 2; }
        if (this.stT > 70 && this.near()) { this.face(); this.vy = -5; this.vx = this.dir * 1.4; this.stT = 0; this.landed2 = true; }
      }
      if (this.justLanded) { this.stT = 0; AF.Audio.sfx('land'); this.g.cam.shake(1, 4); }
    }
  });

  // ======== mini-enemies summoned by bosses ========
  reg('bug', class extends Enemy {
    constructor(g, d) { super(g, d, 12, 10, 1, 'beetle'); this.score = 20; this.coins = 0; this.dir = d.p.dir || (Math.random() < .5 ? -1 : 1); }
    ai() { this.patrol(1); this.frame = (this.t >> 2) & 1; }
    draw(ctx, cx, cy) { AF.drawSpr(ctx, this.fr(this.frame), this.cx - cx, this.y + this.h - cy, this.dir, this.flash > 0 && (this.flash & 2)); }
  });

  // fix generic draw facing (sprites face right when dir=1)
  Enemy.prototype.draw = function (ctx, cx, cy) {
    const s = this.fr(this.frame);
    AF.drawSpr(ctx, s, this.cx - cx, this.flying ? this.cy - cy : this.y + this.h - cy, this.dir > 0 ? 1 : -1, this.flash > 0 && (this.flash & 2));
    if (this.maxHp >= 3 && this.hp < this.maxHp && this.flash > 0) {
      const x = Math.round(this.cx - cx - 8), y = Math.round(this.y - cy - 6);
      ctx.fillStyle = '#140a18'; ctx.fillRect(x - 1, y - 1, 18, 4); ctx.fillStyle = '#ff4060'; ctx.fillRect(x, y, Math.round(16 * this.hp / this.maxHp), 2);
    }
  };
})();
