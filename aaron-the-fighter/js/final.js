'use strict';
// ============================================================
//  FINAL BOSS: DR. ACHMED (3 phases)
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T, OBJ = AF.OBJ;
  const R = (x, y, w, h) => ({ x, y, w, h });
  const art = AF.bossArt, pix = AF.bossPix;

  function achmedHead() {
    return pix(16, 16, p => {
      p.ell(8, 8, 5.5, 6, '#e8b088'); p.ell(7, 5, 4, 3.5, '#f8c8a0');
      p.ell(2.5, 8, 2, 3, '#f0f0ff'); p.ell(13.5, 8, 2, 3, '#f0f0ff');
      p.rect(4, 3, 8, 2, '#403050'); p.set(5, 3, '#60e0ff'); p.set(10, 3, '#60e0ff');
      p.set(6, 7, '#ff2020'); p.set(10, 7, '#ff2020'); p.rect(5, 6, 3, 1, '#40203a'); p.rect(9, 6, 3, 1, '#40203a');
      p.rect(5, 10, 7, 2, '#f0f0ff'); p.rect(7, 12, 3, 1, '#601020');
    });
  }

  class Achmed extends AF.Boss {
    constructor(g, d) {
      d.p.name = 'DR. ACHMED: BATTLE WALKER'; d.p.hp = 12;
      super(g, d);
      this.phase = 1; this.gens = [6, 6];
      this.bw = 84; this.bh = 104; this.bx = this.A.x + this.A.w - 110; this.by = this.floorY - this.bh; this.dir = -1; this.fist = null; this.vy = 0;
      this.seqList = ['beam', 'punch', 'rockets', 'stomp', 'beam', 'rockets'];
      this.art = art('achmed', () => ({
        head: achmedHead(),
        walker: pix(88, 72, p => {
          p.rect(6, 20, 76, 40, '#5a4a8a'); p.rect(6, 20, 76, 3, '#9a8ac8'); p.rect(6, 56, 76, 4, '#3a2a60');
          p.ell(44, 20, 18, 16, '#80e0ff'); p.ell(40, 15, 8, 6, '#e0faff');
          p.rect(0, 30, 10, 16, '#3a3060'); p.rect(78, 30, 10, 16, '#3a3060');
          p.rect(18, 44, 52, 6, '#ffd040'); for (let x = 20; x < 68; x += 8) p.rect(x, 44, 4, 6, '#202020');
          p.rect(64, 28, 22, 8, '#404858'); p.rect(80, 29, 8, 6, '#202030');
        }),
        leg: pix(18, 40, p => { p.rect(5, 0, 8, 32, '#3a3060'); p.rect(5, 0, 3, 32, '#6a5aa0'); p.rect(0, 32, 18, 8, '#2a2048'); p.rect(0, 32, 18, 2, '#6a5aa0'); }),
        gen: pix(16, 16, p => { p.shadeEll(8, 8, 7, 7, ['#806000', '#ffd040', '#fff8a0', '#ffffff']); p.set(6, 5, '#ffffff'); }),
        genX: pix(16, 16, p => { p.circ(8, 8, 6, '#3a2a2a'); p.set(6, 6, '#ff6020'); p.set(9, 9, '#ff6020'); }),
        fist: pix(24, 20, p => { p.rect(0, 2, 20, 16, '#5a4a8a'); p.rect(0, 2, 20, 3, '#9a8ac8'); p.rect(18, 4, 6, 12, '#3a2a60'); }),
        machine: pix(132, 68, p => {
          p.ell(66, 30, 64, 28, '#3a3060'); p.ell(66, 26, 58, 20, '#5a4a8a'); p.ell(60, 20, 40, 10, '#8a7ac0');
          for (let i = 0; i < 8; i++) { const x = 14 + i * 15; p.rect(x, 40, 6, 10, '#2a2048'); p.rect(x + 1, 48, 4, 3, '#ff3070'); }
          p.ell(66, 18, 14, 12, '#80e0ff'); p.ell(62, 14, 6, 5, '#e0faff');
          p.rect(4, 26, 10, 8, '#ffd040'); p.rect(118, 26, 10, 8, '#ffd040');
          p.rect(54, 52, 24, 14, '#2a2048');
        }),
        core: pix(22, 22, p => { p.shadeEll(11, 11, 9, 9, ['#600820', '#ff3070', '#ff90c0', '#ffffff']); p.set(8, 7, '#ffffff'); p.set(9, 7, '#ffffff'); }),
        capsule: pix(40, 36, p => {
          p.ell(20, 22, 18, 11, '#5a4a8a'); p.ell(20, 19, 15, 6, '#9a8ac8'); p.rect(4, 22, 32, 3, '#ffd040');
          p.ell(20, 12, 11, 10, '#80e0ff'); p.ell(17, 8, 4, 3, '#e0faff');
          p.rect(10, 31, 4, 5, '#3a3060'); p.rect(26, 31, 4, 5, '#3a3060'); p.rect(11, 34, 2, 2, '#ff8020'); p.rect(27, 34, 2, 2, '#ff8020');
        })
      }));
    }
    // ---------------- geometry ----------------
    genR(i) { return R(this.bx + (i ? this.bw - 14 : -2), this.by + 52, 16, 16); }
    genHit(i) { return R(this.bx + (i ? this.bw - 18 : -6), this.by + 50, 24, this.floorY - this.by - 54); }
    coreR() { return R(this.mx + 55, this.my + 50, 22, 22); }
    capR() { return R(this.cx2 - 16, this.cy2 - 14, 32, 28); }
    weak() {
      if (this.trans) return [];
      if (this.phase === 1) return [0, 1].filter(i => this.gens[i] > 0).map(i => Object.assign(this.genHit(i), { gen: i }));
      if (this.phase === 2) return this.state === 'stunned2' || this.coreOpen ? [R(this.mx + 50, this.my + 46, 32, 30)] : [];
      return [this.capR()].concat([]);
    }
    armor() {
      if (this.trans) return [];
      if (this.phase === 1) return [R(this.bx + 6, this.by + 6, this.bw - 12, 60)];
      if (this.phase === 2) return [R(this.mx + 4, this.my + 4, 124, 46)];
      return [];
    }
    hurts() {
      if (this.trans) return [];
      const r = [];
      if (this.phase === 1) { r.push(R(this.bx + 8, this.by + 10, this.bw - 16, this.bh - 10)); if (this.fist) r.push(R(this.fist.x, this.fist.y, 22, 18)); }
      if (this.phase === 2) r.push(R(this.mx + 10, this.my + 6, 112, 44));
      if (this.phase === 3) r.push(this.capR());
      return r;
    }
    hitTest(b) {
      if (this.phase === 3 && this.decoys) for (const dd of this.decoys) if (!dd.gone && AF.rectsHit(b.x, b.y, b.w, b.h, dd.x - 16, dd.y - 14, 32, 28)) { dd.gone = true; AF.fx.puff(this.g, dd.x, dd.y); AF.Audio.sfx('teleport'); return true; }
      return super.hitTest(b);
    }
    damage(n, b, r) {
      if (this.phase === 1 && r && r.gen !== undefined) {
        this.gens[r.gen] = Math.max(0, this.gens[r.gen] - n); this.flash = 8; this.g.hitstop = 5; AF.fx.hit(this.g, r.x + 8, r.y + 8, true); AF.Audio.sfx('bighit');
        this.hp = this.gens[0] + this.gens[1];
        if (this.gens[r.gen] <= 0) { AF.fx.boom(this.g, r.x + 8, r.y + 8, true); AF.Audio.sfx('explode'); this.g.cam.shake(3, 12); }
        if (this.hp <= 0) this.toPhase(2);
        return;
      }
      if (this.phase === 2) {
        this.hp -= n; this.flash = 10; this.g.hitstop = 5; AF.fx.hit(this.g, b.x + b.w / 2, b.y + b.h / 2, true); AF.Audio.sfx('bighit'); this.g.cam.shake(2, 6);
        this.collapseCheck();
        if (this.hp <= 0) this.toPhase(3);
        return;
      }
      super.damage(n, b);
    }
    toPhase(n) {
      const g = this.g;
      this.trans = 1; this.fist = null; this.coreOpen = false;
      for (const e of g.ents) if (e instanceof AF.Shot || e instanceof AF.Wave || e instanceof AF.Faller || e.minion) e.dead = true;
      AF.Audio.sfx('bigexplode'); g.cam.shake(5, 40); g.screenFlash = 16;
      const b = n === 2 ? R(this.bx, this.by, this.bw, this.bh) : R(this.mx, this.my, 132, 60);
      for (let i = 0; i < 8; i++) AF.fx.boom(g, b.x + Math.random() * b.w, b.y + Math.random() * b.h, true);
      AF.after(g, 50, () => {
        if (n === 2) g.talk([{ who: 'achmed', text: "My Battle Walker?! You'll pay for that, Aaron!", mood: 'angry', radio: false }, { who: 'achmed', text: 'BEHOLD... THE ULTIMATE MACHINE!', mood: 'laugh', radio: false }, { who: 'aaron', text: "Does EVERYTHING you build have 'ultimate' in the name?", mood: 'grin' }]);
        else g.talk([{ who: 'achmed', text: 'My beautiful machine! NOOO!', mood: 'angry', radio: false }, { who: 'achmed', text: "Fine! I'll finish you MYSELF!", mood: 'mad', radio: false }, { who: 'aaron', text: 'Bring it on, Doc!', mood: 'angry' }]);
        g.afterTalk = () => this.startPhase(n);
      });
    }
    startPhase(n) {
      const g = this.g, A = this.A;
      this.phase = n; this.trans = 0; this.seq = 0; this.set('idle'); this.enraged = false;
      if (n === 2) {
        this.name = 'DR. ACHMED: ULTIMATE MACHINE'; this.hp = this.maxHp = 12; g.bossBar = 1;
        this.mx = A.x + A.w / 2 - 66; this.my = A.y + 4; this.beamAng = 0; this.beams = 0;
        this.seqList = ['homing', 'barrier', 'beams', 'debris', 'area', 'homing', 'beams', 'barrier'];
        // platforms to reach the core
        const mk = (x, y, p) => { const e = new OBJ.plat(g, { x, y, p: Object.assign({ w: 3, style: 'tech' }, p || {}) }); g.spawn(e); g.lv.solids.push(e); return e; };
        const fx = A.x / TS, fy = this.floorY / TS;
        this.platsP2 = [mk(fx + 1, fy - 3, { kind: 'sine', ax: 1, per: 220 }), mk(fx + 11, fy - 3, { kind: 'sine', ax: 1, per: 220, phase: 110 }), mk(fx + 6, fy - 6, { kind: 'sine', ax: 2.5, per: 300 })];
        AF.Audio.curName = ''; AF.Audio.music('final');
      }
      if (n === 3) {
        this.name = 'DR. ACHMED: LAST STAND'; this.hp = this.maxHp = 12; g.bossBar = 1;
        this.cx2 = A.x + A.w / 2; this.cy2 = A.y + 40; this.decoys = null;
        this.seqList = ['shots', 'dive', 'decoys', 'mines', 'shots', 'dive'];
      }
    }
    collapseCheck() {
      const g = this.g, lv = g.lv, A = this.A, fy = this.floorY / TS;
      const stage = this.hp <= 4 ? 2 : this.hp <= 8 ? 1 : 0;
      if (stage > (this.collapsed || 0)) {
        this.collapsed = stage;
        const cols = stage === 1 ? [A.x / TS, A.x / TS + 1, A.x / TS + 13, A.x / TS + 14] : [A.x / TS + 2, A.x / TS + 12];
        for (const x of cols) for (let y = fy; y < lv.h; y++) if (lv.get(x, y) !== T.EMPTY) { lv.set(x, y, T.EMPTY); AF.fx.debris(g, x * TS + 8, y * TS + 8, '#4a4670', 4); }
        AF.Audio.sfx('break'); g.cam.shake(5, 30); g.toast('THE ARENA IS COLLAPSING!');
      }
    }
    think() {
      if (this.trans) return;
      if (this.phase === 1) this.think1(); else if (this.phase === 2) this.think2(); else this.think3();
    }
    // ---------------- PHASE 1: Battle Walker ----------------
    think1() {
      const g = this.g, A = this.A, p = this.pl, fast = (this.gens[0] <= 0 || this.gens[1] <= 0) ? .75 : 1;
      const minX = A.x + 16, maxX = A.x + A.w - this.bw - 16;
      if (this.fist) { const f = this.fist; f.x += f.vx; if (!f.back && (f.x < A.x + 4 || f.x > A.x + A.w - 26)) { f.back = true; f.vx = -f.vx; AF.Audio.sfx('clink'); g.cam.shake(2, 6); } if (f.back && Math.abs(f.x - (this.bx + this.bw / 2 - 11)) < 40) this.fist = null; }
      switch (this.state) {
        case 'idle': this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.bx = AF.clamp(this.bx + this.dir * .5, minX, maxX); if (this.st > 50 * fast && !this.fist) this.set(this.seqList[this.seq++ % this.seqList.length]); break;
        case 'beam': {
          if (this.st === 1) { this.beamY = Math.random() < .5 ? this.floorY - 10 : this.floorY - 36; this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; AF.Audio.sfx('charge'); }
          const gx = this.dir < 0 ? this.bx : this.bx + this.bw;
          if (this.st >= 50 && this.st < 95) { const x0 = this.dir < 0 ? A.x : gx, w = this.dir < 0 ? gx - A.x : A.x + A.w - gx; if (AF.rectsHit(p.x, p.y, p.w, p.h, x0, this.beamY - 4, w, 8)) p.hurt(1, gx); if (this.st === 50) { AF.Audio.sfx('zap'); g.cam.shake(2, 40); } }
          if (this.st > 105) this.set('idle');
          break;
        }
        case 'punch':
          if (this.st === 1) { this.dir = p.cx < this.bx + this.bw / 2 ? -1 : 1; this.aimY = AF.clamp(p.y + 4, this.floorY - 54, this.floorY - 20); AF.Audio.sfx('charge'); }
          if (this.st === 32) { this.fist = { x: this.bx + this.bw / 2 - 11, y: this.aimY, vx: this.dir * 4.6, back: false }; AF.Audio.sfx('dash'); }
          if (this.st > 40) this.set('idle');
          break;
        case 'rockets':
          if (this.st % 15 === 5 && this.st < 50) { const s = new AF.Shot(g, this.bx + this.bw / 2, this.by + 10, AF.rr(-2, 2), -3, { spr: AF.SPR.missile, size: 9, homing: .07, hittable: true, life: 220, explode: true, trail: '#a0a0b0' }); s.homeT = 110; g.spawn(s); AF.Audio.sfx('shoot'); }
          if (this.st > 70) this.set('idle');
          break;
        case 'stomp':
          if (this.st === 25 || this.st === 55) { AF.Audio.sfx('slam'); g.cam.shake(4, 12); g.spawn(new AF.Wave(g, this.bx, this.floorY, -1, { speed: 2.8 })); g.spawn(new AF.Wave(g, this.bx + this.bw, this.floorY, 1, { speed: 2.8 })); }
          if (this.st > 80) this.set('idle');
          break;
      }
    }
    // ---------------- PHASE 2: Ultimate Machine ----------------
    think2() {
      const g = this.g, A = this.A, p = this.pl;
      const fast = this.hp <= 6 ? .75 : 1;
      this.mx = A.x + A.w / 2 - 66 + Math.sin(this.t * .012) * 30;
      this.my = A.y + 4 + Math.sin(this.t * .03) * 3;
      // rotating beams hurt
      if (this.beams > 0) {
        this.beams--; this.beamAng += .022 * (this.hp <= 6 ? 1.3 : 1);
        const c = { x: this.mx + 66, y: this.my + 30 };
        for (let k = 0; k < 2; k++) {
          const a = this.beamAng + k * Math.PI;
          const ex = c.x + Math.cos(a) * 110, ey = c.y + Math.sin(a) * 110;
          if (this.beams < 250 - 40 && distSeg(p.cx, p.cy, c.x, c.y, ex, ey) < 7) p.hurt(1, ex);
        }
      }
      this.coreOpen = this.state === 'tired';
      switch (this.state) {
        case 'idle': if (this.st > 60 * fast) this.set(this.seqList[this.seq++ % this.seqList.length]); break;
        case 'homing':
          if (this.st % 20 === 10 && this.st < 70) { const s = new AF.Shot(g, this.mx + 66, this.my + 50, AF.rr(-1.5, 1.5), 1.5, { spr: AF.SPR.ebolt, size: 10, homing: .05, hittable: true, life: 240, trail: '#ff80c0' }); s.homeT = 130; g.spawn(s); AF.Audio.sfx('zap'); }
          if (this.st > 90) this.set('tired');
          break;
        case 'barrier':
          if (this.st === 1) { this.bside = p.cx < A.x + A.w / 2 ? 1 : -1; AF.Audio.sfx('alarm'); }
          if (this.st === 40) { this.barrier = { x: this.bside > 0 ? A.x + A.w - 10 : A.x + 4, dir: -this.bside }; AF.Audio.sfx('zap'); }
          if (this.barrier) { const b = this.barrier; b.x += b.dir * 1.6; if (AF.rectsHit(p.x, p.y, p.w, p.h, b.x, this.floorY - 44, 6, 44)) p.hurt(1, b.x); if (g.t % 2 === 0) g.parts.add({ x: b.x + 3, y: this.floorY - Math.random() * 44, life: 6, col: '#fff060', size: 1 }); if (b.x < A.x - 10 || b.x > A.x + A.w + 10) { this.barrier = null; this.set('tired'); } }
          break;
        case 'beams':
          if (this.st === 1) { this.beams = 250; this.beamAng = Math.random() * 6; AF.Audio.sfx('charge'); }
          if (this.st > 250) this.set('tired');
          break;
        case 'debris':
          if (this.st === 10) { AF.Audio.sfx('crumble'); g.cam.shake(3, 30); this.rain(AF.SPR.debris, 7, { gap: 10, big: true, col: '#707088' }); }
          if (this.st > 110) this.set('tired');
          break;
        case 'area':
          if (this.st === 1) { AF.Audio.sfx('alarm'); g.toast('GET OFF THE FLOOR!'); }
          if (this.st > 70 && this.st < 130) { if (p.onGround && p.y + p.h >= this.floorY - 1 && !p.ground) p.hurt(1, p.cx); if (g.t % 2 === 0) g.parts.add({ x: A.x + Math.random() * A.w, y: this.floorY - 2, vy: -1, life: 8, col: AF.pick(['#fff060', '#80f0ff']), size: 1 }); if (this.st === 71) AF.Audio.sfx('zap'); }
          if (this.st > 140) this.set('tired');
          break;
        case 'tired':
          this.my = A.y + 4 + Math.min(1, this.st / 30) * 26;
          if (this.st > (this.hp <= 6 ? 110 : 150)) this.set('idle');
          break;
      }
    }
    // ---------------- PHASE 3: Flying capsule ----------------
    think3() {
      const g = this.g, A = this.A, p = this.pl;
      const fly = (tx, ty, sp) => { const dx = tx - this.cx2, dy = ty - this.cy2, d = Math.hypot(dx, dy) || 1; this.cx2 += dx / d * Math.min(sp, d); this.cy2 += dy / d * Math.min(sp, d); return d < 3; };
      const hov = { x: A.x + A.w / 2 + Math.sin(this.t * .03) * 70, y: A.y + 36 + Math.sin(this.t * .07) * 12 };
      if (this.decoys) { let i = 0; for (const dd of this.decoys) { const a = this.t * .04 + i * 2.094; dd.x = this.cx2 + Math.cos(a) * 46; dd.y = this.cy2 + Math.sin(a) * 18; i++; if (!dd.gone && this.t % 50 === i * 15) { const aa = Math.atan2(p.cy - dd.y, p.cx - dd.x); g.spawn(new AF.Shot(g, dd.x, dd.y, Math.cos(aa) * 2, Math.sin(aa) * 2, { spr: AF.SPR.bullet, size: 5 })); } } }
      switch (this.state) {
        case 'idle': fly(hov.x, hov.y, 2.4); if (this.st > 40) this.set(this.seqList[this.seq++ % this.seqList.length]); break;
        case 'shots':
          fly(hov.x, hov.y, 2);
          if (this.st % 8 === 0 && this.st > 10 && this.st <= 50) { const a = Math.atan2(p.cy - this.cy2, p.cx - this.cx2) + AF.rr(-.1, .1); g.spawn(new AF.Shot(g, this.cx2, this.cy2 + 10, Math.cos(a) * 3.2, Math.sin(a) * 3.2, { spr: AF.SPR.bullet, size: 5 })); AF.Audio.sfx('laser'); }
          if (this.st > 70) this.set('idle');
          break;
        case 'dive':
          if (this.st === 1) { AF.Audio.sfx('warn'); }
          if (this.st < 30) { this.cx2 += AF.rr(-1, 1); }
          if (this.st === 30) { const a = Math.atan2(p.cy - this.cy2, p.cx - this.cx2); this.dvx = Math.cos(a) * 4.4; this.dvy = Math.sin(a) * 4.4; AF.Audio.sfx('dash'); }
          if (this.st > 30) { this.cx2 += this.dvx; this.cy2 += this.dvy; if (this.st % 2 === 0) g.parts.add({ x: this.cx2, y: this.cy2, life: 10, col: '#c060ff', size: 3, shrink: true }); if (this.cy2 > this.floorY - 16 || this.cx2 < A.x + 16 || this.cx2 > A.x + A.w - 16 || this.st > 80) { this.cy2 = Math.min(this.cy2, this.floorY - 16); this.cx2 = AF.clamp(this.cx2, A.x + 16, A.x + A.w - 16); g.cam.shake(3, 10); AF.Audio.sfx('slam'); this.set('dazed'); } }
          break;
        case 'dazed': if (this.st > 70) this.set('idle'); break;
        case 'decoys':
          fly(hov.x, hov.y, 2);
          if (this.st === 10) { this.decoys = [{ x: this.cx2, y: this.cy2 }, { x: this.cx2, y: this.cy2 }]; AF.Audio.sfx('teleport'); }
          if (this.st > 200) { this.decoys = null; this.set('idle'); }
          break;
        case 'mines':
          fly(hov.x, A.y + 30, 2.2);
          if (this.st % 20 === 10 && this.st < 70) { const s = new AF.Shot(g, this.cx2, this.cy2 + 12, AF.rr(-1.2, 1.2), 0, { spr: AF.SPR.mine, size: 10, grav: .05, life: 200, explode: true, hittable: true, wall: true }); s.update = function () { this.t++; this.vy = Math.min(this.vy + .05, .8); this.vx *= .98; this.x += this.vx; this.y += this.vy; if (this.y > g.lv.ph) this.dead = true; if (AF.rectSolid(g.lv, this.x, this.y + this.h, this.w, 1)) this.vy = 0; if (--this.life <= 0 || Math.hypot(g.player.cx - this.cx, g.player.cy - this.cy) < 20 && this.t > 30) { this.kill(); g.spawn(new AF.HurtRect(g, this.cx - 16, this.cy - 16, 32, 32, 8)); } }; g.spawn(s); AF.Audio.sfx('enemyshot'); }
          if (this.st > 90) this.set('idle');
          break;
      }
    }
    body() { if (this.phase === 1) return R(this.bx, this.by, this.bw, this.bh); if (this.phase === 2) return R(this.mx, this.my, 132, 60); return this.capR(); }
    onDefeated() {
      const g = this.g;
      AF.save.finalDone = true; AF.writeSave();
      g.talk([{ who: 'achmed', text: "NOOO! My research... my robots... my LAB!", mood: 'angry', radio: false }, { who: 'achmed', text: "This isn't over, Aaron! You haven't seen the last of... *crash*", mood: 'mad', radio: false }]);
      g.afterTalk = () => g.clearStage();
    }
    // ---------------- drawing ----------------
    drawBoss(ctx, cx, cy) {
      const a = this.art, t = this.t;
      if (this.phase === 1) {
        if (this.trans) { if (t & 2) return; }
        const step = this.state === 'idle' ? Math.sin(this.t * .1) * 2 : 0;
        this.drawPart(ctx, a.leg, this.bx + 12, this.floorY - 40 + Math.max(0, step), cx, cy);
        this.drawPart(ctx, a.leg, this.bx + this.bw - 30, this.floorY - 40 + Math.max(0, -step), cx, cy);
        this.drawPart(ctx, a.walker, this.bx - 2, this.by - 4, cx, cy, this.dir > 0);
        ctx.drawImage(a.head, Math.round(this.bx + 34 - cx), Math.round(this.by + 4 - cy));
        for (let i = 0; i < 2; i++) { const r = this.genR(i); this.drawPart(ctx, this.gens[i] > 0 ? a.gen : a.genX, r.x, r.y, cx, cy); if (this.gens[i] > 0 && (t & 8)) { ctx.globalAlpha = .3; ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.arc(Math.round(r.x + 8 - cx), Math.round(r.y + 8 - cy), 11, 0, 7); ctx.fill(); ctx.globalAlpha = 1; } }
        if (this.fist) this.drawPart(ctx, a.fist, this.fist.x, this.fist.y, cx, cy, this.fist.vx < 0);
        if (this.state === 'beam') {
          const gx = this.dir < 0 ? this.bx : this.bx + this.bw, x0 = this.dir < 0 ? this.A.x : gx, x1 = this.dir < 0 ? gx : this.A.x + this.A.w;
          if (this.st < 50 && (t & 4)) { ctx.fillStyle = '#ff3070'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - cy), x1 - x0, 1); }
          if (this.st >= 50 && this.st < 95) { ctx.fillStyle = '#c040ff'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - 5 - cy), x1 - x0, 10); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x0 - cx), Math.round(this.beamY - 2 - cy), x1 - x0, 4); }
        }
        if (this.state === 'punch' && this.st < 32 && (t & 4)) { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round(this.A.x - cx), Math.round(this.aimY + 9 - cy), this.A.w, 1); }
      } else if (this.phase === 2) {
        if (this.trans && (t & 2)) return;
        this.drawPart(ctx, a.machine, this.mx, this.my, cx, cy);
        ctx.drawImage(a.head, Math.round(this.mx + 58 - cx), Math.round(this.my + 8 - cy));
        const c = this.coreR();
        this.drawPart(ctx, a.core, c.x, c.y, cx, cy);
        if (this.coreOpen && (t & 8)) { ctx.globalAlpha = .35; ctx.fillStyle = '#ff3070'; ctx.beginPath(); ctx.arc(Math.round(c.x + 11 - cx), Math.round(c.y + 11 - cy), 18, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (!this.coreOpen) { ctx.fillStyle = 'rgba(120,120,160,.75)'; ctx.fillRect(Math.round(c.x - cx), Math.round(c.y - cy), 22, 22); ctx.fillStyle = '#c0c0e0'; ctx.fillRect(Math.round(c.x - cx), Math.round(c.y + 10 - cy), 22, 2); }
        if (this.beams > 0) {
          const ccx = this.mx + 66, ccy = this.my + 30, warm = this.beams > 210;
          for (let k = 0; k < 2; k++) {
            const ang = this.beamAng + k * Math.PI;
            ctx.strokeStyle = warm ? ((t & 4) ? '#ff3070' : '#802040') : '#ff3070'; ctx.lineWidth = warm ? 1 : 5;
            ctx.beginPath(); ctx.moveTo(Math.round(ccx - cx), Math.round(ccy - cy)); ctx.lineTo(Math.round(ccx + Math.cos(ang) * 110 - cx), Math.round(ccy + Math.sin(ang) * 110 - cy)); ctx.stroke();
            if (!warm) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(Math.round(ccx - cx), Math.round(ccy - cy)); ctx.lineTo(Math.round(ccx + Math.cos(ang) * 110 - cx), Math.round(ccy + Math.sin(ang) * 110 - cy)); ctx.stroke(); }
          }
        }
        if (this.barrier || (this.state === 'barrier' && this.st < 40)) {
          const x = this.barrier ? this.barrier.x : (this.bside > 0 ? this.A.x + this.A.w - 10 : this.A.x + 4);
          if (this.barrier) { for (let y = 0; y < 44; y += 2) { ctx.fillStyle = ((y + t) & 4) ? '#fff060' : '#80f0ff'; ctx.fillRect(Math.round(x + Math.sin(y + t) * 2 - cx), Math.round(this.floorY - 44 + y - cy), 6, 2); } }
          else if (t & 4) { ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(x - cx), Math.round(this.floorY - 44 - cy), 6, 44); }
        }
        if (this.state === 'area' && this.st < 70 && (t & 4)) { ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(this.A.x - cx), Math.round(this.floorY - 2 - cy), this.A.w, 2); }
        if (this.state === 'area' && this.st >= 70 && this.st < 130) { ctx.fillStyle = (t & 2) ? '#fff060' : '#80f0ff'; for (let x = 0; x < this.A.w; x += 5) ctx.fillRect(Math.round(this.A.x + x - cx), Math.round(this.floorY - 2 - ((x * 7 + t) % 6) - cy), 1, 4); }
      } else {
        if (this.trans) return;
        if (this.decoys) for (const dd of this.decoys) if (!dd.gone) { ctx.globalAlpha = (t & 4) ? .55 : .75; ctx.drawImage(a.capsule, Math.round(dd.x - 20 - cx), Math.round(dd.y - 18 - cy)); ctx.drawImage(a.head, Math.round(dd.x - 8 - cx), Math.round(dd.y - 16 - cy)); ctx.globalAlpha = 1; }
        const shake = this.state === 'dive' && this.st < 30 ? AF.rr(-1, 1) : 0;
        this.drawPart(ctx, a.capsule, this.cx2 - 20 + shake, this.cy2 - 18, cx, cy);
        ctx.drawImage(this.flashOn() ? AF.whiteOf(a.head) : a.head, Math.round(this.cx2 - 8 + shake - cx), Math.round(this.cy2 - 16 - cy));
        if (this.state === 'dazed') for (let i = 0; i < 3; i++) { const aa = t * .15 + i * 2.1; ctx.fillStyle = '#fff060'; ctx.fillRect(Math.round(this.cx2 + Math.cos(aa) * 14 - cx), Math.round(this.cy2 - 22 + Math.sin(aa) * 4 - cy), 2, 2); }
      }
    }
  }
  function distSeg(px, py, x0, y0, x1, y1) { const dx = x1 - x0, dy = y1 - y0, l = dx * dx + dy * dy; let t = ((px - x0) * dx + (py - y0) * dy) / l; t = AF.clamp(t, 0, 1); return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t)); }
  OBJ.achmed = Achmed;
})();
