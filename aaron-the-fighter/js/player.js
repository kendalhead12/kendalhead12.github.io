'use strict';
// ============================================================
//  Player: Aaron
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T, F = AF.TF, I = AF.Input;
  const C = {
    accel: .13, decel: .24, turn: .36, max: 2.25, airAccel: .11, airDecel: .04,
    iceAccel: .03, iceDecel: .012, iceMax: 2.8,
    grav: .24, maxFall: 5.2, jumpV: 5.05, djumpV: 4.55, cut: 1.9,
    coyote: 7, buffer: 8, crawlMax: .9, climb: 1.15,
    swAccel: .08, swMax: 1.4, swGrav: .035, swDrag: .955, swStroke: 2.1, swExit: 4.8,
    o2: 20 * 60
  };
  AF.PC = C;
  const H_STAND = 28, H_CROUCH = 18, H_LOW = 14, W = 12;

  class Player {
    constructor(g, x, y) {
      this.g = g;
      this.w = W; this.h = H_STAND;
      this.x = x; this.y = y - this.h;
      this.vx = 0; this.vy = 0; this.grav = 1; this.facing = 1;
      this.state = 'normal'; this.st = 0;
      this.onGround = false; this.ground = null; this.groundTile = 0;
      this.hp = AF.maxHearts(); this.energy = AF.maxEnergy();
      this.inv = 0; this.coyote = 0; this.jumpBuf = 0; this.jumpCut = false; this.djumpUsed = false; this.airDashUsed = false;
      this.combo = 0; this.comboWin = 0; this.atkId = 0; this.chargeT = 0;
      this.rollCD = 0; this.o2 = C.o2; this.drownT = 0;
      this.anim = 'idle0'; this.animT = 0; this.blinkT = 120; this.landT = 0;
      this.crouch = false; this.low = false; this.climbing = false; this.swimming = false; this.hanging = null; this.swing = null;
      this.grabCD = 0; this.pushing = 0; this.extVX = 0; this.lookDown = 0; this.stepT = 0; this.fallStart = 0;
      this.locked = false; this.qsT = 0; this.hurtFlash = 0; this.spinT = 0;
      this.frozen = 0;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get feetY() { return this.grav > 0 ? this.y + this.h : this.y; }
    get ab() { return AF.save.abilities; }
    setH(h) {
      if (h === this.h) return;
      if (this.grav > 0) this.y += this.h - h;
      this.h = h;
    }
    canStand() {
      const ny = this.grav > 0 ? this.y + this.h - H_STAND : this.y;
      return !AF.rectSolid(this.g.lv, this.x + 1, ny, this.w - 2, H_STAND);
    }
    canSet(h) { const ny = this.grav > 0 ? this.y + this.h - h : this.y; return !AF.rectSolid(this.g.lv, this.x + .5, ny, this.w - 1, h); }

    // ------------------------------------------------------------
    update() {
      const g = this.g, lv = g.lv;
      this.st++; this.animT++;
      if (this.inv > 0) this.inv--;
      if (this.comboWin > 0) this.comboWin--;
      if (this.rollCD > 0) this.rollCD--;
      if (this.grabCD > 0) this.grabCD--;
      if (this.landT > 0) this.landT--;
      if (this.frozen > 0) { this.frozen--; return; }
      if (this.state === 'dead') return this.updDead();
      if (this.locked || this.introLocked) { this.physicsLocked(); return; }

      // input buffering
      if (I.pressed.jump) this.jumpBuf = C.buffer; else if (this.jumpBuf > 0) this.jumpBuf--;
      if (this.onGround) { this.coyote = C.coyote; this.djumpUsed = false; this.airDashUsed = false; }
      else if (this.coyote > 0) this.coyote--;

      // environment probes
      const liq = lv.liquidAt(this.cx, this.cy);
      const wasSwim = this.swimming;
      if (this.leapT > 0) this.leapT--;
      this.swimming = !!(liq && liq.kind === 'water') && !(this.leapT > 0);
      if (this.swimming && !wasSwim) { AF.Audio.sfx('splash'); AF.fx.splash(g, this.cx, liq.top); this.vy *= .3; if (this.state === 'roll' || this.state === 'dash' || this.state === 'slam' || this.state === 'airdash') this.toNormal(); }
      if (!this.swimming && wasSwim && liq === null) { const z = lv.surfaceAt(this.cx); if (z && Math.abs(z.top - this.cy) < 20) AF.fx.splash(g, this.cx, z.top); }
      this.headUnder = !!lv.liquidAt(this.cx, this.grav > 0 ? this.y + 3 : this.y + this.h - 3);
      this.updOxygen();

      // hazards: harmful liquids
      const liqF = lv.liquidAt(this.cx, this.grav > 0 ? this.y + this.h - 2 : this.y + 2);
      if (liqF && liqF.kind !== 'water') {
        this.hurt(1, this.cx, true);
        if (this.state !== 'dead') { this.vy = -6 * this.grav; this.state = 'normal'; this.onGround = false; this.coyote = 0; }
      }

      switch (this.state) {
        case 'normal': this.updNormal(); break;
        case 'attack': this.updAttack(); break;
        case 'kick': this.updKick(); break;
        case 'charge': this.updCharge(); break;
        case 'cpunch': this.updCPunch(); break;
        case 'slam': this.updSlam(); break;
        case 'slamland': this.updSlamLand(); break;
        case 'special': this.updSpecial(); break;
        case 'roll': case 'dash': this.updRoll(); break;
        case 'airdash': this.updAirDash(); break;
        case 'hurt': this.updHurt(); break;
        case 'climb': this.updClimb(); break;
        case 'hang': this.updHang(); break;
        case 'swing': this.updSwing(); break;
        case 'victory': this.physicsLocked(); break;
      }

      this.checkTiles();
      // pit
      if ((this.grav > 0 && this.y > lv.ph + 24) || (this.grav < 0 && this.y + this.h < -40)) g.onPit();
      if (this.y < -48 && this.grav > 0) { this.y = -48; if (this.vy < 0) this.vy = 0; }
      this.pickAnim();
    }

    // ---------------- common movement ----------------
    horiz(maxMul) {
      const dx = I.dirX();
      const icy = this.onGround && (this.groundTile === T.ICE || (this.ground && this.ground.icy));
      const qs = this.qsT > 0;
      let max = (this.crouch ? C.crawlMax : icy ? C.iceMax : C.max) * (maxMul || 1);
      if (qs) max = .7;
      const acc = this.onGround ? (icy ? C.iceAccel : C.accel) : C.airAccel;
      const dec = this.onGround ? (icy ? C.iceDecel : C.decel) : C.airDecel;
      if (dx !== 0) {
        if (this.vx * dx < 0) this.vx += dx * (icy ? C.iceAccel * 1.6 : this.onGround ? C.turn : C.airAccel * 1.6);
        else if (Math.abs(this.vx) < max) this.vx = Math.min(max, Math.abs(this.vx + dx * acc)) * dx;
        else if (this.onGround) this.vx = AF.approach(this.vx, dx * max, dec);
        if (!this.attacking) this.facing = dx;
      } else this.vx = AF.approach(this.vx, 0, dec);
    }
    applyGrav(mul) {
      this.vy += C.grav * (mul || 1) * this.grav;
      if (this.vy * this.grav > C.maxFall) this.vy = C.maxFall * this.grav;
    }
    applyForces() {
      const g = this.g;
      // conveyor
      if (this.onGround && (this.groundTile === T.CONVL || this.groundTile === T.CONVR)) this.extVX = this.groundTile === T.CONVL ? -.9 : .9;
      else if (this.onGround && this.ground && this.ground.convey) this.extVX = this.ground.convey;
      else if (this.onGround) this.extVX = 0;
      else this.extVX *= .96;
      // wind/current zones
      for (const z of g.zones) {
        if (!z.active || !AF.rectsHit(this.x, this.y, this.w, this.h, z.x, z.y, z.w, z.h)) continue;
        const s = (this.state === 'climb' || this.hanging) ? .3 : 1;
        this.vx += z.fx * s; this.vy += z.fy * s;
        if (z.fy < 0 && this.vy < z.maxUp) this.vy = z.maxUp;
        if (z.fx && Math.abs(this.vx) > Math.abs(z.maxX || 4)) this.vx = AF.sign(this.vx) * Math.abs(z.maxX || 4);
      }
    }
    move() {
      const lv = this.g.lv;
      const ox = this.vx;
      this.vx += this.extVX;
      const wasG = this.onGround;
      const pvy = this.vy;
      AF.moveBody(this, lv);
      if (this.hitWall === 0) this.vx = ox; else this.vx = 0;
      if (this.pushedEnt) { this.vx = AF.sign(ox) * Math.min(Math.abs(ox), .95); this.pushedEnt = null; }
      if (this.onGround && !wasG) {
        this.djumpUsed = false; this.airDashUsed = false;
        if (pvy * this.grav > 3.6) { this.landT = 6; AF.Audio.sfx('land'); AF.fx.dust(this.g, this.cx, this.feetY, 5, this.g.dustCol); }
      }
      if (!this.onGround && wasG && this.vy * this.grav >= 0) { /* walked off */ }
      this.dropThrough = false;
    }
    tryJump() {
      if (this.jumpBuf <= 0) return false;
      const g = this.g;
      if (this.onGround || this.coyote > 0) {
        if (this.crouch && I.down.down && this.onGround && this.standingOnOneWay()) { // drop through
          this.dropThrough = true; this.y += 2 * this.grav; this.onGround = false; this.jumpBuf = 0; this.coyote = 0; return true;
        }
        if (this.crouch && !this.canStand()) return false;
        let v = C.jumpV;
        if (this.qsT > 0) v = 3.2;
        this.vy = -v * this.grav; this.jumpCut = true; this.jumpBuf = 0; this.coyote = 0; this.onGround = false;
        this.setH(H_STAND); this.crouch = false;
        AF.Audio.sfx('jump');
        AF.fx.dust(g, this.cx, this.feetY, 3, g.dustCol);
        return true;
      }
      if (this.ab.double && !this.djumpUsed) {
        this.djumpUsed = true; this.vy = -C.djumpV * this.grav; this.jumpCut = true; this.jumpBuf = 0; this.spinT = 16;
        AF.Audio.sfx('djump'); AF.fx.ring(g, this.cx, this.feetY, '#ffffff', 3, 10);
        return true;
      }
      return false;
    }
    standingOnOneWay() {
      if (this.ground && this.ground.oneWay) return true;
      const f = AF.flagAt(this.g.lv, this.cx, this.feetY + this.grav * 2);
      return (f & F.ONEWAY) !== 0 || (f & F.CLIMB) !== 0;
    }
    jumpCutCheck() { if (this.jumpCut && !I.down.jump && this.vy * this.grav < -C.cut) { this.vy = -C.cut * this.grav; this.jumpCut = false; } if (this.vy * this.grav >= 0) this.jumpCut = false; }

    // ---------------- states ----------------
    updNormal() {
      const g = this.g;
      if (this.swimming) return this.updSwim();
      // crouch / crawl
      const wantCrouch = I.down.down && this.onGround && !this.qsT;
      if (wantCrouch && !this.crouch) { this.crouch = true; this.setH(H_CROUCH); }
      if (this.crouch) {
        const moving = Math.abs(this.vx) > .1 || I.dirX() !== 0;
        const needH = moving ? H_LOW : H_CROUCH;
        if (this.h !== needH && (needH < this.h || this.canSet(needH))) this.setH(needH);
        if (!wantCrouch || !this.onGround) { if (this.canStand()) { this.crouch = false; this.setH(H_STAND); } }
      }
      this.lookDown = this.crouch && Math.abs(this.vx) < .1 ? Math.min(40, (this.lookDown || 0) + 1) : 0;
      // ladder grab
      if ((I.down.up || (I.down.down && this.onGround)) && this.grabCD === 0 && this.tryClimb()) return;
      this.horiz();
      // attacks & actions
      if (I.pressed.attack) { if (this.startAttack()) return; }
      if (I.pressed.special) { if (this.startSpecial()) return; }
      if (I.pressed.dash) { if (this.startDash()) return; }
      this.tryJump();
      this.jumpCutCheck();
      this.applyGrav();
      this.applyForces();
      this.move();
      // push detection
      this.pushing = (this.onGround && this.hitWall && this.hitWall === I.dirX()) ? this.pushing + 1 : 0;
      // grab bars / swing ropes
      if (!this.onGround && this.grabCD === 0) this.checkGrab();
      // footsteps
      if (this.onGround && Math.abs(this.vx) > 1) {
        this.stepT += Math.abs(this.vx);
        if (this.stepT > 18) { this.stepT = 0; AF.Audio.sfx('step'); if (g.lv.world === 3 || g.snowSteps) AF.fx.snow(g, this.cx - this.facing * 3, this.feetY); else if (Math.abs(this.vx) > 1.8) AF.fx.dust(g, this.cx - this.facing * 4, this.feetY, 1, g.dustCol); }
      }
    }
    updSwim() {
      const g = this.g;
      if (this.crouch) { this.crouch = false; if (this.canStand()) this.setH(H_STAND); }
      const dx = I.dirX(), dy = I.dirY();
      const mx = C.swMax;
      if (dx) { this.vx += dx * C.swAccel; this.facing = dx; } else this.vx *= C.swDrag;
      if (dy) this.vy += dy * C.swAccel * this.grav; else this.vy += C.swGrav * this.grav;
      this.vx = AF.clamp(this.vx, -mx, mx); this.vy = AF.clamp(this.vy, -mx * 1.1, mx * 1.1);
      // stroke / leap out
      if (I.pressed.jump) {
        const z = this.g.lv.liquidAt(this.cx, this.cy);
        const nearTop = z && (this.grav > 0 ? (this.cy - z.top) < 14 : false);
        if (nearTop) { this.vy = -C.swExit * this.grav; this.swimming = false; this.leapT = 14; this.jumpCut = false; this.jumpBuf = 0; this.djumpUsed = false; AF.Audio.sfx('splash'); AF.fx.splash(g, this.cx, z.top); this.y -= 2; }
        else { const ang = Math.atan2(dy || (dx ? 0 : -1), dx || 0); this.vx += Math.cos(ang) * C.swStroke * .6; this.vy += Math.sin(ang) * C.swStroke * .9; this.spinT = 0; AF.Audio.sfx('bubble'); for (let i = 0; i < 3; i++) AF.fx.bubble(g, this.cx + this.facing * 6, this.y + 6); }
      }
      if (I.pressed.attack) { if (this.startAttack()) return; }
      if (I.pressed.special) { if (this.startSpecial()) return; }
      if (this.g.t % 40 === 0) AF.fx.bubble(g, this.cx + this.facing * 6, this.y + 6);
      this.applyForces();
      // don't let swimmer pop out of surface without jumping
      const z = this.g.lv.liquidAt(this.cx, this.cy);
      AF.moveBody(this, this.g.lv);
      const z2 = this.g.lv.surfaceAt(this.cx);
      if (z2 && this.vy < 0 && this.cy < z2.top + 4 && !I.pressed.jump && this.grav > 0) { this.y = z2.top + 4 - this.h / 2; this.vy = 0; }
      if (I.dirY() > 0 && this.onGround) this.vy = 0;
    }
    updOxygen() {
      const g = this.g;
      if (this.headUnder && this.state !== 'dead') {
        this.o2--;
        if (this.o2 <= 0) { this.o2 = 0; this.drownT++; if (this.drownT % 90 === 1) { this.inv = 0; this.hurt(1, this.cx, true); } }
        else if (this.o2 < 6 * 60 && this.o2 % 60 === 0) AF.Audio.sfx('warn');
      } else { this.o2 = Math.min(C.o2, this.o2 + 10); this.drownT = 0; }
    }
    tryClimb() {
      const lv = this.g.lv;
      const fC = AF.flagAt(lv, this.cx, this.cy), fBelow = AF.flagAt(lv, this.cx, this.feetY + 4 * this.grav);
      if (I.down.up && (fC & F.CLIMB)) { this.enterClimb(); return true; }
      if (I.down.down && this.onGround && (fBelow & F.CLIMB) && !(fC & F.CLIMB) && this.grav > 0) { this.enterClimb(); this.y += 6; return true; }
      return false;
    }
    enterClimb() {
      this.state = 'climb'; this.climbing = true; this.crouch = false; this.setH(H_STAND);
      const tx = Math.floor(this.cx / TS); this.x = tx * TS + TS / 2 - this.w / 2; this.vx = 0; this.vy = 0;
    }
    updClimb() {
      const lv = this.g.lv;
      const dy = I.dirY(), dx = I.dirX();
      this.vy = dy * C.climb; this.vx = 0;
      if (dx) {
        const nx = this.cx + dx * 9;
        if (AF.flagAt(lv, nx, this.cy) & F.CLIMB) this.vx = dx * .9;
        this.facing = dx;
      }
      AF.moveX(this, lv, this.vx);
      const pb = this.y;
      this.y += this.vy;
      if (AF.rectSolid(lv, this.x, this.y, this.w, this.h)) { this.y = pb; this.vy = 0; }
      const f = AF.flagAt(lv, this.cx, this.cy), fFeet = AF.flagAt(lv, this.cx, this.y + this.h - 1);
      if (!(f & F.CLIMB) && !(fFeet & F.CLIMB)) { this.exitClimb(); return; }
      if (!(f & F.CLIMB) && dy < 0) { // reached top: step onto it
        const ty = Math.floor((this.y + this.h) / TS);
        if (!(AF.TFLAGS[lv.get(Math.floor(this.cx / TS), ty - 1)] & F.CLIMB)) { this.y = ty * TS - this.h; this.exitClimb(); this.onGround = true; return; }
      }
      if (dy > 0 && AF.rectSolid(lv, this.x, this.y + 1, this.w, this.h)) { this.exitClimb(); return; }
      if (I.pressed.jump) { this.exitClimb(); this.vy = -4.2 * this.grav; this.vx = dx * 1.5; this.grabCD = 12; AF.Audio.sfx('jump'); return; }
      if (I.pressed.attack) { this.exitClimb(); this.grabCD = 10; return; }
      if (dy !== 0 || dx !== 0) this.climbAnimT = (this.climbAnimT || 0) + 1;
    }
    exitClimb() { this.state = 'normal'; this.climbing = false; this.grabCD = Math.max(this.grabCD, 6); }

    checkGrab() {
      const g = this.g;
      for (const e of g.grabbables) {
        if (e.dead) continue;
        if (e.grabKind === 'bar') {
          const hx = this.cx, hy = this.y + 2;
          if (I.down.down) continue;
          if (hx >= e.x - 2 && hx <= e.x + e.w + 2 && hy >= e.y - 6 && hy <= e.y + e.h + 6 && this.vy * this.grav > -2.5) {
            this.hanging = e; this.state = 'hang'; this.vx = 0; this.vy = 0; this.hangOff = AF.clamp(this.cx - e.x, 4, e.w - 4);
            this.y = e.y + e.h - 1; this.x = e.x + this.hangOff - this.w / 2; AF.Audio.sfx('land'); return;
          }
        } else if (e.grabKind === 'rope') {
          const pts = e.points();
          for (let i = 2; i < pts.length; i++) {
            const p = pts[i];
            if (p.x > this.x - 7 && p.x < this.x + this.w + 7 && p.y > this.y - 8 && p.y < this.y + 20) {
              this.swing = e; this.state = 'swing'; e.grab(this, i / (pts.length - 1)); this.vx = 0; this.vy = 0; AF.Audio.sfx('land'); return;
            }
          }
        }
      }
    }
    updHang() {
      const e = this.hanging;
      if (!e || e.dead) { this.hanging = null; this.state = 'normal'; return; }
      const dx = I.dirX();
      if (dx) { this.hangOff = AF.clamp(this.hangOff + dx * .9, 4, e.w - 4); this.facing = dx; this.hangMove = (this.hangMove || 0) + 1; }
      this.x = e.x + this.hangOff - this.w / 2; this.y = e.y + e.h - 1; this.vx = 0; this.vy = 0;
      if (AF.rectSolid(this.g.lv, this.x, this.y, this.w, this.h)) { this.hanging = null; this.state = 'normal'; this.grabCD = 20; return; }
      if (I.pressed.jump) { this.hanging = null; this.state = 'normal'; this.vy = -C.jumpV * .95; this.jumpCut = true; this.grabCD = 14; this.djumpUsed = false; AF.Audio.sfx('jump'); }
      else if (I.pressed.down) { this.hanging = null; this.state = 'normal'; this.grabCD = 16; this.vy = 1; }
    }
    updSwing() {
      const e = this.swing;
      if (!e) { this.state = 'normal'; return; }
      e.pump(I.dirX());
      if (I.dirX()) this.facing = I.dirX();
      const p = e.holdPoint();
      this.x = p.x - this.w / 2; this.y = p.y - 2;
      if (I.pressed.jump) {
        const v = e.release();
        this.swing = null; this.state = 'normal'; this.vx = AF.clamp(v.x, -4.2, 4.2); this.vy = Math.min(v.y, 0) - 3.2; this.extVX = 0;
        this.grabCD = 18; this.djumpUsed = false; this.jumpCut = false; AF.Audio.sfx('jump');
        this.launchT = 40;
      }
    }

    // ---------------- combat ----------------
    get attacking() { return this.state === 'attack' || this.state === 'kick' || this.state === 'cpunch' || this.state === 'special' || this.state === 'charge'; }
    power() { return 1 + (AF.save.upgrades.power ? 1 : 0); }
    startAttack() {
      const g = this.g;
      if (!this.onGround && !this.swimming) {
        if (I.down.down && this.ab.slam) { this.state = 'slam'; this.st = 0; this.vx = 0; this.vy = 0; AF.Audio.sfx('whoosh'); return true; }
        this.state = 'kick'; this.st = 0; this.atkId++; AF.Audio.sfx('whoosh'); return true;
      }
      if (this.crouch && !this.canStand()) return false;
      if (this.crouch) { this.crouch = false; this.setH(H_STAND); }
      this.combo = (this.comboWin > 0 && this.combo < 3) ? this.combo + 1 : 1;
      this.state = 'attack'; this.st = 0; this.atkId++; this.attackHeld = true; this.nextQueued = false;
      AF.Audio.sfx('whoosh');
      if (this.combo === 3) this.vx = this.facing * 1.6;
      return true;
    }
    atkBox(dx, dy, w, h, dmg, kind, knock, extra) {
      const x = this.facing > 0 ? this.x + this.w + dx : this.x - dx - w;
      const y = this.grav > 0 ? this.y + dy : this.y + this.h - dy - h;
      this.g.attack(Object.assign({ x, y, w, h, dmg: dmg * this.power(), kind, id: this.atkId, dir: this.facing, knock: knock || 1.5, owner: this }, extra || {}));
    }
    updAttack() {
      const dur = [0, 15, 15, 22][this.combo];
      const act0 = this.combo === 3 ? 5 : 3, act1 = this.combo === 3 ? 11 : 7;
      if (this.st >= act0 && this.st <= act1) this.atkBox(-2, 7, 18, 13, this.combo === 3 ? 2 : 1, 'punch', this.combo === 3 ? 3.5 : 1.6, { brk: 1, big: this.combo === 3 });
      if (this.st === act0) AF.Audio.sfx('punch');
      if (I.pressed.attack && this.st > 4) this.nextQueued = true;
      if (!I.down.attack) this.attackHeld = false;
      this.vx = AF.approach(this.vx, 0, this.combo === 3 ? .12 : .3);
      if (I.pressed.jump && this.st > act1) { this.toNormal(); this.tryJump(); return; }
      this.applyGrav(); this.applyForces(); this.move();
      if (!this.onGround && !this.swimming && this.st > 6) { this.toNormal(); return; }
      if (this.st >= dur) {
        if (this.nextQueued && this.combo < 3) { this.comboWin = 2; this.startAttack(); return; }
        if (this.attackHeld && this.ab.charge && this.combo === 1 && I.down.attack && this.onGround) { this.state = 'charge'; this.st = 0; this.chargeT = 0; AF.Audio.sfx('charge'); return; }
        this.comboWin = this.combo < 3 ? 14 : 0;
        if (this.combo === 3) this.combo = 0;
        this.toNormal();
      }
    }
    updCharge() {
      const g = this.g;
      this.chargeT++;
      this.vx = AF.approach(this.vx, 0, .3);
      if (this.chargeT === 34) { AF.Audio.sfx('charged'); AF.fx.ring(g, this.cx, this.cy, '#ffe060', 4, 14); }
      if (this.chargeT % 4 === 0) g.parts.add({ x: this.cx + AF.rr(-10, 10), y: this.cy + AF.rr(-10, 10), vx: 0, vy: 0, life: 10, col: this.chargeT >= 34 ? '#ffe060' : '#ffffff', size: 1, fn: p => { p.x += (this.cx - p.x) * .2; p.y += (this.cy - p.y) * .2; } });
      if (I.dirX()) this.facing = I.dirX();
      this.applyGrav(); this.move();
      if (!I.down.attack) {
        if (this.chargeT >= 34) { this.state = 'cpunch'; this.st = 0; this.atkId++; this.vx = this.facing * 3.6; AF.Audio.sfx('bighit'); g.cam.shake(2, 8); }
        else this.toNormal();
      }
      if (I.pressed.jump) { this.toNormal(); this.tryJump(); }
    }
    updCPunch() {
      if (this.st >= 2 && this.st <= 14) this.atkBox(-4, 4, 22, 18, 4, 'charge', 4.5, { brk: 2, big: true });
      if (this.st % 3 === 0) AF.fx.dust(this.g, this.cx - this.facing * 6, this.feetY, 1, this.g.dustCol);
      this.vx = AF.approach(this.vx, 0, .18);
      this.applyGrav(); this.move();
      if (this.st >= 26) this.toNormal();
    }
    updKick() {
      if (this.st >= 2 && this.st <= 20) this.atkBox(-6, 14, 16, 16, 1, 'kick', 2, { bounce: true });
      this.horiz();
      this.jumpCutCheck();
      if (I.pressed.jump) this.tryJump();
      if (I.pressed.dash) { if (this.startDash()) return; }
      this.applyGrav(); this.applyForces(); this.move();
      if (this.onGround || this.swimming || this.st >= 24) this.toNormal();
    }
    kickBounce() { if (this.state === 'kick' || this.state === 'normal') { this.vy = -3.8 * this.grav; this.djumpUsed = false; this.airDashUsed = false; } }
    updSlam() {
      const g = this.g;
      if (this.st < 10) { this.vx = 0; this.vy = 0; this.spinT = 10; return; }
      if (this.st === 10) AF.Audio.sfx('dash');
      this.vy = 7.2 * this.grav; this.vx = 0;
      this.atkBox(-this.w - 2, 4, this.w + 4, this.h + 2, 2, 'slam', 2.5, { brk: 3, down: true });
      if (this.st % 2 === 0) g.parts.add({ x: this.cx + AF.rr(-4, 4), y: this.y, vy: -1, life: 10, col: '#ffffff', size: 2, fade: true });
      const prevY = this.y;
      this.move();
      if (this.swimming) { this.toNormal(); return; }
      if (this.onGround) {
        // break cracked floor beneath and keep falling
        const lv = g.lv, ty = Math.floor((this.grav > 0 ? this.y + this.h + 2 : this.y - 2) / TS);
        let broke = false;
        for (let tx = Math.floor(this.x / TS); tx <= Math.floor((this.x + this.w - 1) / TS); tx++) { const t = lv.get(tx, ty); if (t === T.CRACK || t === T.BREAK) { g.breakTile(tx, ty); broke = true; } }
        if (broke) { this.onGround = false; this.vy = 4 * this.grav; g.cam.shake(3, 10); return; }
        this.state = 'slamland'; this.st = 0; AF.Audio.sfx('slam'); g.cam.shake(4, 14);
        this.atkId++;
        this.g.attack({ x: this.x - 26, y: this.grav > 0 ? this.y + this.h - 14 : this.y, w: this.w + 52, h: 14, dmg: 2 * this.power(), kind: 'slam', id: this.atkId, dir: 0, knock: 3, owner: this, brk: 3, down: true });
        AF.fx.dust(g, this.cx - 10, this.feetY, 5, g.dustCol); AF.fx.dust(g, this.cx + 10, this.feetY, 5, g.dustCol);
        g.parts.add({ x: this.cx, y: this.feetY, spr: AF.SPR.fx.shock, life: 16, front: true });
        g.onSlam(this);
      }
    }
    updSlamLand() { this.vx = 0; this.applyGrav(); this.move(); if (this.st >= 14) this.toNormal(); }
    startSpecial() {
      if (this.energy < 1) { AF.Audio.sfx('cancel'); this.g.flashEnergy = 20; return false; }
      if (this.crouch && !this.canStand()) return false;
      this.energy -= 1; this.state = 'special'; this.st = 0; this.crouch = false; this.setH(H_STAND);
      return true;
    }
    updSpecial() {
      if (this.st === 5) { AF.Audio.sfx('shoot'); this.g.spawn(new AF.EnergyWave(this.g, this.facing > 0 ? this.x + this.w : this.x - 16, this.y + 8, this.facing, this.grav)); }
      this.vx = AF.approach(this.vx, 0, .25);
      if (!this.swimming) this.applyGrav(.6); else this.vy *= .9;
      this.move();
      if (this.st >= 18) this.toNormal();
    }
    startDash() {
      const g = this.g;
      if (!this.onGround) {
        if (this.ab.airdash && !this.airDashUsed && !this.swimming) {
          this.airDashUsed = true; this.state = 'airdash'; this.st = 0; this.vy = 0; this.vx = this.facing * 4.6; this.atkId++;
          if (I.dirX()) { this.facing = I.dirX(); this.vx = this.facing * 4.6; }
          AF.Audio.sfx('dash'); AF.fx.ring(g, this.cx, this.cy, '#c0e8ff', 3, 12); return true;
        }
        return false;
      }
      if (this.rollCD > 0) return false;
      if (I.dirX()) this.facing = I.dirX();
      const dash = this.ab.dash;
      this.state = dash ? 'dash' : 'roll'; this.st = 0; this.atkId++;
      this.crouch = false; this.setH(H_LOW);
      this.vx = this.facing * (dash ? 4.4 : 3.2);
      AF.Audio.sfx(dash ? 'dash' : 'roll');
      AF.fx.dust(g, this.cx - this.facing * 6, this.feetY, 4, g.dustCol);
      return true;
    }
    updRoll() {
      const g = this.g, dash = this.state === 'dash';
      const dur = dash ? 20 : 22;
      this.vx = this.facing * (dash ? AF.lerp(4.4, 2.4, this.st / dur) : AF.lerp(3.2, 1.4, this.st / dur));
      if (dash) {
        this.atkBox(-4, 0, 8, this.h, 1, 'dash', 2.5, { brk: 4 });
        if (this.st % 2 === 0) g.parts.add({ x: this.cx - this.facing * 8, y: this.cy + AF.rr(-4, 4), vx: -this.facing, life: 10, col: '#ffffff', size: 1, fade: true });
        // break sandstone walls directly ahead
        const tx = Math.floor((this.facing > 0 ? this.x + this.w + 3 : this.x - 3) / TS);
        for (let ty = Math.floor(this.y / TS) - 1; ty <= Math.floor((this.y + this.h - 1) / TS); ty++) { const t = g.lv.get(tx, ty); if (t === T.SANDW || t === T.BREAK) g.breakTile(tx, ty); }
      }
      if (this.st % 6 === 0 && this.onGround) AF.fx.dust(g, this.cx - this.facing * 4, this.feetY, 1, g.dustCol);
      if (I.pressed.jump && this.st > 3 && this.canStand()) { this.endRoll(); this.tryJump(); return; }
      this.applyGrav(); this.applyForces(); this.move();
      if (this.st >= dur || this.swimming) this.endRoll();
    }
    endRoll() {
      this.state = 'normal'; this.rollCD = 10;
      if (this.canStand()) this.setH(H_STAND); else { this.crouch = true; this.setH(H_LOW); }
    }
    updAirDash() {
      const g = this.g;
      this.vy = 0;
      this.atkBox(-4, 2, 10, this.h - 4, 1, 'dash', 2.5, { brk: 0 });
      if (this.st % 2 === 0) g.parts.add({ x: this.cx - this.facing * 8, y: this.cy + AF.rr(-6, 6), vx: -this.facing * .5, life: 12, col: '#c0e8ff', size: 2, fade: true });
      this.move();
      if (this.st >= 14 || this.hitWall || this.onGround) { this.state = 'normal'; this.vx = this.facing * 2.2; }
    }
    updHurt() {
      this.applyGrav(); this.move();
      this.vx = AF.approach(this.vx, 0, .05);
      if (this.st >= 22 || (this.onGround && this.st > 8)) this.toNormal();
    }
    updDead() {
      this.vy += .22; this.y += this.vy; this.x += this.vx * .3;
      if (this.st === 100) this.g.onPlayerDeath();
    }
    toNormal() { this.state = 'normal'; this.st = 0; if (this.h !== H_STAND && !this.crouch) { if (this.canStand()) this.setH(H_STAND); else { this.crouch = true; this.setH(H_LOW); } } }
    physicsLocked() {
      if (this.swimming) { this.vy *= .9; this.vx *= .9; }
      else { this.vx = AF.approach(this.vx, this.autoVX || 0, .2); this.applyGrav(); }
      if (this.autoVX) this.facing = AF.sign(this.autoVX);
      this.move();
    }

    hurt(n, fromX, force) {
      const g = this.g;
      if (this.state === 'dead' || g.cleared) return false;
      if (!force && (this.inv > 0 || ((this.state === 'roll' || this.state === 'dash' || this.state === 'airdash') && this.st < 16))) return false;
      if (force && this.inv > 0) return false;
      this.hp -= n; this.inv = 100;
      g.stats.hits++;
      AF.Audio.sfx('hurt'); g.cam.shake(2, 8);
      if (this.hanging) this.hanging = null;
      if (this.swing) { this.swing.release(); this.swing = null; }
      if (this.climbing) this.exitClimb();
      if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
      this.state = 'hurt'; this.st = 0;
      this.vx = (this.cx >= fromX ? 1 : -1) * 2.2; this.vy = -3 * this.grav;
      if (this.swimming) { this.vy *= .4; this.vx *= .5; }
      this.crouch = false; if (this.canStand()) this.setH(H_STAND);
      g.hitstop = 4;
      return true;
    }
    die() {
      if (this.state === 'dead') return;
      this.state = 'dead'; this.st = 0; this.vy = -4.5; this.vx = 0; this.hp = 0;
      this.hanging = null; this.swing = null; this.climbing = false;
      AF.Audio.stopMusic(); AF.Audio.sfx('die');
      this.g.cam.shake(3, 10);
    }
    heal(n) { this.hp = Math.min(AF.maxHearts(), this.hp + n); }

    // ---------------- tile hazards & quicksand ----------------
    checkTiles() {
      const lv = this.g.lv;
      if (this.state === 'dead') return;
      // spikes: check lower/upper part of tiles
      const x0 = Math.floor((this.x + 2) / TS), x1 = Math.floor((this.x + this.w - 3) / TS);
      const y0 = Math.floor((this.y + 1) / TS), y1 = Math.floor((this.y + this.h - 1) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const t = lv.get(tx, ty);
        if (t === T.SPIKE && this.y + this.h > ty * TS + 9) { if (this.hurt(1, tx * TS + 8)) { this.vy = -4.6 * this.grav; } else if (this.vy * this.grav > 0 && this.grav > 0) this.vy = -3.5; }
        if (t === T.SPIKED && this.y < ty * TS + 7) { if (this.hurt(1, tx * TS + 8)) { this.vy = 2; } }
      }
      // quicksand
      const ft = AF.flagAt(lv, this.cx, this.y + this.h - 4);
      if (ft & F.QS && this.grav > 0) {
        this.qsT++;
        if (this.vy > .35) this.vy = .35;
        this.onGround = true; this.coyote = 2;
        if (this.qsT % 8 === 0) AF.fx.dust(this.g, this.cx, this.y + this.h - 4, 1, '#e0b060');
        const headIn = AF.flagAt(lv, this.cx, this.y + 2) & F.QS;
        if (headIn && this.qsT % 70 === 0) this.hurt(1, this.cx, true);
      } else this.qsT = 0;
      // electric floor (handled via zones in objects) / conveyors handled in applyForces
    }

    // ---------------- animation ----------------
    pickAnim() {
      const s = this.state;
      let a = this.anim;
      const t = this.animT;
      if (s === 'dead') a = 'dead';
      else if (s === 'hurt') a = 'hurt';
      else if (s === 'victory') a = (t >> 4) & 1 ? 'victory1' : 'victory';
      else if (s === 'climb') a = ((this.climbAnimT || 0) >> 3) & 1 ? 'climb1' : 'climb0';
      else if (s === 'hang') a = ((this.hangMove || 0) >> 3) & 1 ? 'hang1' : 'hang';
      else if (s === 'swing') a = 'hang';
      else if (s === 'roll' || (s === 'slam' && this.st < 10)) a = 'roll' + ((this.st >> 2) & 3);
      else if (s === 'dash') a = 'dash';
      else if (s === 'airdash') a = 'airdash';
      else if (s === 'slam') a = 'slam';
      else if (s === 'slamland') a = 'slamland';
      else if (s === 'charge') a = this.chargeT >= 34 && (t & 2) ? 'charge' : 'charge';
      else if (s === 'cpunch') a = this.st < 18 ? 'cpunch' : 'punch1b';
      else if (s === 'attack') {
        const act0 = this.combo === 3 ? 5 : 3;
        if (this.combo === 1) a = this.st < act0 ? 'punch1b' : this.st < 11 ? 'punch1' : 'punch1b';
        else if (this.combo === 2) a = this.st < act0 ? 'punch1b' : this.st < 11 ? 'punch2' : 'punch1b';
        else a = this.st < act0 ? 'windup' : this.st < 16 ? 'punch3' : 'punch1b';
      }
      else if (s === 'kick') a = this.st < 2 ? 'apex' : 'kick';
      else if (s === 'special') a = this.st < 4 ? 'punch1b' : 'special';
      else if (this.swimming) a = 'swim' + (Math.abs(this.vx) + Math.abs(this.vy) > .4 ? (t >> 3) % 3 : (t >> 5) % 2);
      else if (this.crouch) a = (Math.abs(this.vx) > .1) ? ((t >> 3) & 1 ? 'crawl1' : 'crawl0') : (this.h <= H_LOW ? 'crawl0' : 'crouch');
      else if (!this.onGround) {
        if (this.spinT > 0) { this.spinT--; a = 'roll' + ((this.spinT >> 2) & 3); }
        else { const vy = this.vy * this.grav; a = vy < -1.4 ? 'jump' : vy < 1.4 ? 'apex' : 'fall'; }
      }
      else if (this.pushing > 4) a = (t >> 4) & 1 ? 'push1' : 'push0';
      else if (this.landT > 0) a = 'land';
      else if (Math.abs(this.vx) > 1.75) { const rate = Math.abs(this.vx) > 2.2 ? 4 : 5; a = 'run' + (Math.floor(t / rate) % 6); }
      else if (Math.abs(this.vx) > .15 || (I.dirX() && this.hitWall)) a = 'walk' + (Math.floor(t / 6) % 6);
      else {
        this.blinkT--;
        if (this.blinkT < 0) this.blinkT = AF.ri(120, 240);
        a = this.blinkT < 7 ? 'blink' : ((t >> 5) & 1 ? 'idle1' : 'idle0');
        if (this.lookUpT) a = 'lookup';
      }
      this.anim = a;
    }
    draw(ctx, cx, cy) {
      if (this.inv > 0 && this.state !== 'dead' && ((this.inv >> 2) & 1) && this.state !== 'hurt') return;
      const spr = this.g.skin[this.anim] || this.g.skin.idle0;
      const x = this.cx - cx;
      let y = (this.grav > 0 ? this.y + this.h : this.y) - cy;
      if (this.swimming && this.anim.startsWith('swim')) y = this.cy - cy + 2;
      const white = this.state === 'charge' && this.chargeT >= 34 && (this.g.t & 4);
      AF.drawSpr(ctx, spr, x, y, this.facing, white, this.grav < 0);
      // oxygen bubble meter
      if (this.headUnder && this.o2 < C.o2 - 30) {
        const k = this.o2 / C.o2;
        const bx = Math.round(x - 8), by = Math.round(this.y - cy - 10);
        ctx.fillStyle = '#100818'; ctx.fillRect(bx - 1, by - 1, 18, 5);
        ctx.fillStyle = k < .3 ? ((this.g.t & 8) ? '#ff4040' : '#ff9090') : '#60d0ff'; ctx.fillRect(bx, by, Math.round(16 * k), 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, Math.round(16 * k), 1);
      }
    }
  }
  AF.Player = Player;
})();
