'use strict';
// ============================================================
//  Play scene: runs a level
// ============================================================
(function () {
  const TS = AF.TS, T = AF.T, F = AF.TF, I = AF.Input;
  const DUST = { 1: '#d8c8a0', 2: '#c0e0f0', 3: '#ffffff', 4: '#a08070', 5: '#b0b0c0', 6: '#f0d090', 7: '#ffffff', 8: '#a0a0c0' };

  class Play {
    constructor(world, act, opts) {
      opts = opts || {};
      this.world = world; this.act = act; this.key = AF.actKey(world, act);
      this.opts = opts;
      const def = AF.LEVELS[this.key]();
      this.def = def;
      this.lv = new AF.Level(def);
      this.lv.game = this;
      this.parts = new AF.Parts(); this.cam = new AF.Camera();
      this.ents = []; this.bodies = []; this.zones = []; this.grabbables = []; this.mirrors = []; this.shadows = []; this.sig = {};
      this.atk = []; this.t = 0; this.hitstop = 0; this.enemyCount = 0;
      this.stats = opts.stats || { kills: 0, hits: 0, time: 0, coins: 0, score: 0, medals: [] };
      this.actRec = AF.actData(world, act);
      this.platStyle = def.platStyle || ({ 1: 'leaf', 2: 'metal', 3: 'ice', 4: 'basalt', 5: 'metal', 6: 'sand', 7: 'cloud', 8: 'tech' })[world];
      this.dustCol = DUST[world]; this.snowSteps = def.snowSteps;
      this.vertical = !!def.vertical;
      this.bg = AF.getBG(def.bgWorld || world, def.bgAct || act);
      this.skin = AF.SPR.aaron;
      AF.syncAbilities(world, act);
      // checkpoint
      this.restoreCk = opts.ck ? opts.ck.idx : 0;
      this.checkpoint = opts.ck || null;
      const sp = opts.ck ? { x: opts.ck.x, y: opts.ck.y } : { x: def.spawn.x * TS + 8, y: (def.spawn.y + 1) * TS };
      this.player = new AF.Player(this, sp.x - 6, sp.y);
      if (opts.hp) this.player.hp = opts.hp;
      this.bodies.push(this.player);
      this.ckIdx = 0;
      for (const d of def.objs) {
        const C = AF.OBJ[d.type];
        if (!C) { console.warn('Unknown object', d.type); continue; }
        if (d.type === 'medal' && this.stats.medals.indexOf(d.p.id) >= 0) continue;
        const e = new C(this, d);
        this.ents.push(e);
      }
      this.lv.solids = this.ents.filter(e => e.collides);
      this.boss = this.ents.find(e => e.isBoss) || null;
      this.cam.snap(this);
      this.intro = opts.ck ? 0 : 150; this.dialog = null; this.dqueue = []; this.paused = false; this.pauseSel = 0; this.cleared = false; this.toastT = 0;
      this.respawnFade = opts.ck ? 30 : 0;
      this.music = def.music || AF.WORLDS[world].music;
      AF.Audio.music(this.music);
      this.flashEnergy = 0; this.bossBar = 0; this.screenFlash = 0;
      if (def.onStart) def.onStart(this);
      this.pendingTalk = (!opts.ck && def.talkStart) ? def.talkStart : null;
    }
    // ---------------- API for entities ----------------
    spawn(e) { this.ents.push(e); if (e.collides) this.lv.solids.push(e); if (e.isEnemy && this.bodies.indexOf(e) < 0) this.bodies.push(e); return e; }
    attack(b) { this.atk.push(b); }
    setSig(ch, v) { if (ch) this.sig[ch] = v; }
    addCoins(n) {
      this.stats.coins += n; AF.save.bank += n; this.addScore(10 * n);
      this.coinCount = (this.coinCount || 0) + n;
      if (Math.floor((this.coinCount - n) / 100) < Math.floor(this.coinCount / 100)) { AF.save.lives = Math.min(99, AF.save.lives + 1); AF.Audio.sfx('oneup'); AF.fx.score(this, this.player.cx, this.player.y - 10, '1UP!', '#60ff60'); }
    }
    addScore(n, x, y) { this.stats.score += n; if (x !== undefined && n >= 100) AF.fx.score(this, x, y, '' + n); }
    gotMedal(id) { if (this.stats.medals.indexOf(id) < 0) this.stats.medals.push(id); this.addScore(1000); }
    gotArtifact() {
      const w = this.world - 1, had = AF.save.artifacts[w];
      AF.save.artifacts[w] = true; AF.writeSave();
      AF.Audio.sfx('artifact'); this.addScore(5000);
      if (!had) this.talk([{ who: 'sys', text: 'SECRET ARTIFACT FOUND! ' + AF.ARTIFACTS[w][0] + '.' }, { who: 'sys', text: AF.ARTIFACTS[w][1] }, { who: 'sys', text: 'Bonus content unlocked in EXTRAS!' }]);
      else this.toast('ARTIFACT (ALREADY FOUND)');
    }
    gainAbility(ab) {
      AF.save.abilities[ab] = true; AF.writeSave();
      AF.Audio.sfx('ability');
      for (let i = 0; i < 16; i++) AF.fx.sparkle(this, this.player.cx, this.player.cy);
      AF.fx.ring(this, this.player.cx, this.player.cy, '#ffffff', 4, 30);
      const info = AF.ABILITY_INFO[ab];
      this.abilityBanner = { name: info[0], t: 200 };
      this.talk([{ who: 'sys', text: 'NEW ABILITY: ' + info[0] + '!' }, { who: 'sys', text: info[1] + ' ' + info[2] }]);
    }
    talk(lines) { for (const l of lines) this.dqueue.push(l); if (!this.dialog) this.nextLine(); }
    nextLine() {
      const l = this.dqueue.shift();
      if (!l) { this.dialog = null; if (this.afterTalk) { const f = this.afterTalk; this.afterTalk = null; f(); } return; }
      this.dialog = { line: l, chars: 0, t: 0 };
      if (l.who === 'achmed' && (!this.lastWho || this.lastWho !== 'achmed')) AF.Audio.sfx('radio');
      this.lastWho = l.who;
    }
    toast(msg) { this.toastMsg = msg; this.toastT = 150; }
    breakTile(tx, ty) {
      const t = this.lv.get(tx, ty);
      const col = { [T.BREAK]: '#a0a0a8', [T.METAL]: '#8a92a8', [T.CRACK]: '#a08060', [T.SANDW]: '#d8a050' }[t] || '#a08060';
      this.lv.set(tx, ty, T.EMPTY);
      AF.fx.debris(this, tx * TS + 8, ty * TS + 8, col, 8); AF.Audio.sfx('break'); this.addScore(10);
      this.cam.shake(1.5, 6);
    }
    onSlam(p) { for (const e of this.ents) if (e.onSlam) e.onSlam(p); }
    startBoss() { if (this.boss && !this.boss.active) this.boss.activate(); }
    onPit() {
      if (this.cleared || this.player.state === 'dead' || this.pitT) return;
      const p = this.player;
      p.hp -= 2; AF.Audio.sfx('hurt');
      if (p.hp <= 0) { p.hp = 0; p.y = this.lv.ph + 100; p.die(); p.st = 60; return; }
      this.pitT = 40; p.locked = true; p.vx = 0; p.vy = 0;
    }
    respawnAtCheckpoint() {
      const p = this.player;
      let ck = this.checkpoint || { x: this.def.spawn.x * TS + 8, y: (this.def.spawn.y + 1) * TS };
      if (this.boss && this.boss.active && !this.boss.dying) { const B = this.boss; ck = { x: B.A.x + B.A.w / 2 - 40, y: B.floorY }; let tx = Math.floor(ck.x / TS); while (tx < this.lv.w && !(AF.TFLAGS[Math.max(0, this.lv.get(tx, Math.floor(B.floorY / TS)))] & F.SOLID)) tx++; ck.x = tx * TS + 8; }
      p.x = ck.x - p.w / 2; p.y = ck.y - p.h; p.vx = p.vy = 0; p.grav = 1; p.inv = 120; p.locked = false; p.state = 'normal'; p.hanging = null; p.swing = null; p.climbing = false;
      this.cam.snap(this);
    }
    onPlayerDeath() {
      AF.save.lives--; AF.save.deaths++;
      if (AF.save.lives < 0) {
        AF.save.lives = 3; AF.writeSave();
        AF.go(new AF.GameOverScene(this.world, this.act));
        return;
      }
      AF.writeSave();
      const st = this.stats; st.time = this.stats.time;
      AF.go(new Play(this.world, this.act, { ck: this.checkpoint, stats: st, retry: true }), 'fade');
    }
    clearStage() {
      if (this.cleared) return;
      this.cleared = true;
      const p = this.player;
      p.locked = true; p.autoVX = 0; p.inv = 0;
      AF.Audio.stopMusic(); AF.Audio.music('clear');
      this.clearT = 0;
      for (const e of this.ents) if (e.isEnemy && !e.dead && e.near()) { e.die({}); }
    }
    // ---------------- main loop ----------------
    update() {
      if (this.paused) return this.updPause();
      if (I.pressed.pause && !this.dialog && !this.cleared && this.player.state !== 'dead' && this.intro < 30) { this.paused = true; this.pauseSel = 0; AF.Audio.sfx('pause'); AF.Audio.setDuck(.35); return; }
      if (this.dialog) return this.updDialog();
      if (this.hitstop > 0) { this.hitstop--; this.parts.update(); return; }
      if (this.pitT) { if (--this.pitT === 0) this.respawnAtCheckpoint(); this.parts.update(); return; }
      this.t++; AF.tick++;
      if (!this.cleared && this.player.state !== 'dead' && this.intro < 30) this.stats.time++;
      if (this.intro > 0) this.intro--;
      if (this.toastT > 0) this.toastT--;
      if (this.abilityBanner && --this.abilityBanner.t <= 0) this.abilityBanner = null;
      if (this.respawnFade > 0) this.respawnFade--;
      if (this.screenFlash > 0) this.screenFlash--;
      if (this.flashEnergy > 0) this.flashEnergy--;
      const p = this.player;
      p.locked = p.locked || (this.intro > 30);
      if (this.intro === 30) p.locked = false;
      if (this.intro <= 20 && this.pendingTalk) { const tk = this.pendingTalk; this.pendingTalk = null; this.talk(tk); }
      // entities first (platforms move & carry), then player
      for (let i = 0; i < this.ents.length; i++) { const e = this.ents[i]; if (!e.dead) e.update(); }
      p.update();
      // attacks
      for (const b of this.atk) this.processAttack(b);
      this.atk.length = 0;
      // contacts
      if (p.state !== 'dead') for (const e of this.ents) {
        if (e.dead || !AF.rectsHit(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) continue;
        if (e.isPickup && this.embedded(e)) continue;
        e.touch(p);
      }
      // cleanup
      let removed = false;
      for (let i = this.ents.length - 1; i >= 0; i--) if (this.ents[i].dead) { this.ents.splice(i, 1); removed = true; }
      if (removed) { this.lv.solids = this.lv.solids.filter(e => !e.dead); this.bodies = this.bodies.filter(b => !b.dead); }
      for (let i = this.shadows.length - 1; i >= 0; i--) if (--this.shadows[i].t <= 0) this.shadows.splice(i, 1);
      this.parts.update();
      this.cam.update(this);
      this.lv.computeSecretRegion(p.cx, p.cy);
      this.lv.updateSecrets(p.cx, p.cy);
      this.ambient();
      if (this.def.onUpdate) this.def.onUpdate(this);
      if (this.cleared) this.updClear();
      if (this.bossBar !== undefined && this.boss && this.boss.active) this.bossBar = AF.approach(this.bossBar, this.boss.hp / this.boss.maxHp, .01);
    }
    inSecret(e) { const tx = Math.floor(e.cx / TS), ty = Math.floor(e.cy / TS); return this.lv.get(tx, ty) === T.SECRET && this.lv.secretAlpha[ty * this.lv.w + tx] > .5; }
    embedded(e) { return (AF.flagAt(this.lv, e.cx, e.cy) & F.SOLID) !== 0 && AF.tileAt(this.lv, e.cx, e.cy) !== T.SECRET; }
    processAttack(b) {
      const p = this.player;
      for (const e of this.ents) {
        if (e.dead || !e.hittable || e === b.owner) continue;
        if (e.hitBoxes) { // bosses with multiple boxes
          if (e.hitTest(b)) { if (b.bounce) p.kickBounce(); if (b.proj && b.owner) b.owner.dead = true; }
          continue;
        }
        if (!AF.rectsHit(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) continue;
        if (e.isPickup && this.embedded(e)) continue;
        if (e.hit(b)) { if (b.bounce) p.kickBounce(); if (b.proj && b.owner && !e.isPickup) b.owner.dead = true; }
      }
      // break tiles
      if (b.brk) {
        const x0 = Math.floor(b.x / TS), x1 = Math.floor((b.x + b.w - 1) / TS), y0 = Math.floor(b.y / TS), y1 = Math.floor((b.y + b.h - 1) / TS);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
          const t = this.lv.get(tx, ty);
          if (t === T.BREAK && b.brk >= 1) this.breakTile(tx, ty);
          else if (t === T.METAL && b.brk === 2) this.breakTile(tx, ty);
          else if (t === T.CRACK && b.brk === 3) this.breakTile(tx, ty);
          else if (t === T.SANDW && b.brk === 4) this.breakTile(tx, ty);
          else if ((t === T.METAL || t === T.CRACK || t === T.SANDW) && b.kind !== 'slam' && b.kind !== 'dash' && !this.clinkT) { this.clinkT = 20; AF.Audio.sfx('clink'); AF.fx.hit(this, tx * TS + 8, ty * TS + 8); const hint = t === T.METAL ? 'Too strong! Needs a CHARGED PUNCH.' : t === T.CRACK ? 'Cracked floor... a GROUND SLAM could break it.' : 'Sandstone! A DASH could smash it.'; if (!this.hinted || this.hinted !== t) { this.hinted = t; this.toast(hint); } }
        }
      }
      if (this.clinkT) this.clinkT--;
    }
    ambient() {
      const w = this.world, t = this.t, c = this.cam;
      const rx = () => c.x + Math.random() * (AF.W + 40) - 20;
      if (this.def.ambient === false) return;
      if (w === 1 && t % 14 === 0) this.parts.add({ x: rx(), y: c.y - 8, vx: AF.rr(-.3, .3), vy: AF.rr(.3, .6), life: 400, spr: null, col: AF.pick(['#68d040', '#f0b830', '#58c040']), size: 2, fn: q => { q.x += Math.sin(q.t * .05) * .5; } });
      if (w === 3 && this.act !== 2 && t % 3 === 0) this.parts.add({ x: rx(), y: c.y - 4, vx: this.def.storm ? AF.rr(-2.5, -1) : AF.rr(-.6, .2), vy: AF.rr(.5, 1.2), life: 300, col: '#ffffff', size: Math.random() < .3 ? 2 : 1, front: true });
      if (w === 4 && t % 5 === 0) this.parts.add({ x: rx(), y: c.y + AF.H + 4, vx: AF.rr(-.3, .3), vy: AF.rr(-1, -.4), life: 220, col: AF.pick(['#ff8020', '#ffd040', '#ff4010']), size: 1, front: true });
      if (w === 6 && this.def.sandstorm && t % 1 === 0) this.parts.add({ x: c.x + AF.W + 10, y: c.y + Math.random() * AF.H, vx: AF.rr(-5, -3), vy: AF.rr(-.3, .3), life: 90, col: AF.pick(['#f0c878', '#e0a850']), size: 1, front: true });
      if (w === 7 && t % 40 === 0) this.parts.add({ x: c.x + AF.W + 20, y: c.y + Math.random() * AF.H, vx: -.6, life: 600, col: '#ffffff', size: 3, fade: false });
      if (w === 5 && t % 30 === 0) this.parts.add({ x: rx(), y: c.y + AF.H, vy: -.8, vx: .2, life: 140, col: '#d8d0e0', size: 3, fade: true });
      if (w === 2 && t % 20 === 0) { const z = this.lv.liquids[0]; if (z) AF.fx.bubble(this, rx(), c.y + AF.H); }
    }
    updClear() {
      const p = this.player;
      this.clearT++;
      if (this.clearT === 40) { p.state = 'victory'; p.animT = 0; }
      if (this.clearT === 60) {
        // compute tally
        const time = this.stats.time, sec = time / 60;
        const timeBonus = sec < 60 ? 10000 : sec < 90 ? 5000 : sec < 120 ? 3000 : sec < 180 ? 2000 : sec < 240 ? 1000 : sec < 300 ? 500 : 100;
        const coinBonus = this.stats.coins * 50;
        const medBonus = this.stats.medals.length * 2000;
        const noHit = this.stats.hits === 0 ? 5000 : 0;
        this.tally = { rows: [['TIME BONUS', timeBonus], ['COIN BONUS', coinBonus], ['MEDALLIONS', medBonus], ['NO DAMAGE', noHit]], shown: 0, total: 0, t: 0 };
      }
      if (this.tally) {
        const tl = this.tally; tl.t++;
        if (tl.shown < tl.rows.length && tl.t % 20 === 0) { tl.total += tl.rows[tl.shown][1]; tl.shown++; AF.Audio.sfx('coin'); }
        if (tl.shown >= tl.rows.length && !tl.done && (I.pressed.confirm || I.pressed.jump || I.pressed.attack || tl.t > 400)) { tl.done = true; this.finish(tl.total); }
      }
    }
    finish(bonus) {
      const st = this.stats, rec = this.actRec;
      const total = st.score + bonus;
      AF.save.score += total;
      rec.done = true;
      for (const m of st.medals) rec.med |= (1 << m);
      if (!rec.best || st.time < rec.best) rec.best = st.time;
      if (!rec.hi || total > rec.hi) rec.hi = total;
      let next = null;
      if (this.act === 3) {
        AF.save.bosses[this.world] = true;
        if (this.world < 8 && AF.save.unlocked <= this.world) { AF.save.unlocked = this.world + 1; AF.save.mapNode = this.world + 1; this.newWorld = true; }
        if (this.world === 8) next = 'final';
      }
      AF.syncAbilities(this.world, this.act);
      AF.writeSave();
      if (next === 'final') { AF.go(new AF.Cutscene(AF.CUTS.prefinal(), () => new Play(8, 4)), 'fade'); return; }
      if (this.act === 4) { AF.go(new AF.Cutscene(AF.CUTS.ending(), () => new AF.CreditsScene(true)), 'fade'); return; }
      const after = () => new AF.MapScene({ fromWorld: this.world, unlockAnim: this.newWorld ? this.world + 1 : 0 });
      if (this.act === 3 && AF.CUTS.afterBoss[this.world]) AF.go(new AF.Cutscene(AF.CUTS.afterBoss[this.world](), after), 'fade');
      else AF.go(after(), 'fade');
    }
    updDialog() {
      const d = this.dialog;
      d.t++;
      const full = d.line.text.length;
      if (d.chars < full) { d.chars = Math.min(full, d.chars + 1); if (d.t % 3 === 0 && d.line.text[d.chars] !== ' ') AF.Audio.sfx(d.line.who === 'achmed' ? 'achtext' : 'text'); }
      if (I.pressed.confirm || I.pressed.jump || I.pressed.attack) {
        if (d.chars < full) d.chars = full; else this.nextLine();
      }
      this.parts.update();
    }
    updPause() {
      const items = ['RESUME', 'RESTART', 'OPTIONS', 'RETURN TO MAP'];
      if (this.optMenu) { if (this.optMenu.update()) this.optMenu = null; return; }
      if (I.pressed.up) { this.pauseSel = (this.pauseSel + items.length - 1) % items.length; AF.Audio.sfx('select'); }
      if (I.pressed.down) { this.pauseSel = (this.pauseSel + 1) % items.length; AF.Audio.sfx('select'); }
      if (I.pressed.pause && !I.pressed.confirm) { this.unpause(); return; }
      if (I.pressed.back) { this.unpause(); return; }
      if (I.pressed.confirm || I.pressed.attack) {
        AF.Audio.sfx('confirm');
        const s = items[this.pauseSel];
        if (s === 'RESUME') this.unpause();
        else if (s === 'RESTART') { AF.Audio.setDuck(1); AF.go(new Play(this.world, this.act), 'fade'); }
        else if (s === 'OPTIONS') this.optMenu = new AF.OptionsMenu(true);
        else { AF.Audio.setDuck(1); AF.writeSave(); AF.go(new AF.MapScene({ fromWorld: this.world }), 'fade'); }
      }
    }
    unpause() { this.paused = false; AF.Audio.setDuck(1); I.clear(); }

    // ---------------- render ----------------
    draw(ctx) {
      const cam = this.cam, cx = cam.vx, cy = cam.vy, lv = this.lv, t = this.t;
      AF.drawBG(ctx, this.bg, cx, cy, t, lv.ph);
      if (this.def.darkness) { ctx.fillStyle = 'rgba(0,0,20,' + this.def.darkness + ')'; ctx.fillRect(0, 0, AF.W, AF.H); }
      lv.drawTiles(ctx, cx, cy, true, t);
      for (const d of this.def.decor) if (!d.p.front) AF.drawDecor(ctx, d, cx, cy, t);
      // entities behind tiles (z<0)
      for (const e of this.ents) if (e.z < 0 && !e.dead) e.draw(ctx, cx, cy);
      lv.drawTiles(ctx, cx, cy, false, t);
      for (const s of this.shadows) { const x = Math.round(s.x - cx); if ((s.t >> 2) & 1) { ctx.fillStyle = '#ff4040'; ctx.fillRect(x - 3, Math.round(cam.y - cy) + 2, 6, 2); } }
      this.parts.draw(ctx, cx, cy, false);
      for (const e of this.ents) if (e.z >= 0 && e.z < 5 && !e.dead && !(e.isPickup && (this.embedded(e) || this.inSecret(e)))) e.draw(ctx, cx, cy);
      this.player.draw(ctx, cx, cy);
      for (const e of this.ents) if (e.z >= 5 && !e.dead) e.draw(ctx, cx, cy);
      lv.drawLiquids(ctx, cx, cy, t);
      for (const d of this.def.decor) if (d.p.front) AF.drawDecor(ctx, d, cx, cy, t);
      this.parts.draw(ctx, cx, cy, true);
      const pl = this.player;
      this.sandK = AF.approach(this.sandK || 0, (this.def.sandstorm || this.zones.some(z => z.kind === 'sand' && z.active && AF.rectsHit(pl.x, pl.y, pl.w, pl.h, z.x, z.y, z.w, z.h))) ? 1 : 0, .02);
      if (this.sandK > 0) { ctx.globalAlpha = (.42 + Math.sin(t * .02) * .08) * this.sandK; ctx.fillStyle = '#e0b070'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; if (t % 1 === 0) for (let i = 0; i < 2; i++) this.parts.add({ x: cx + AF.W + 10, y: cy + Math.random() * AF.H, vx: AF.rr(-6, -3), vy: AF.rr(-.3, .3), life: 60, col: AF.pick(['#f0c878', '#e0a850', '#fff0c0']), size: 1, front: true }); }
      if (this.def.storm && this.world === 3) { ctx.globalAlpha = .18; ctx.fillStyle = '#e0e8ff'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.def.vignette) this.drawVignette(ctx);
      if (this.screenFlash > 0) { ctx.globalAlpha = this.screenFlash / 20; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.def.onDraw) this.def.onDraw(this, ctx, cx, cy);
      AF.drawHUD(ctx, this);
      if (this.intro > 0) AF.drawTitleCard(ctx, this);
      if (this.respawnFade > 0) { ctx.globalAlpha = this.respawnFade / 30; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.pitT) { ctx.globalAlpha = Math.min(1, (40 - this.pitT) / 15); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.player.state === 'dead' && this.player.st > 60) { ctx.globalAlpha = Math.min(1, (this.player.st - 60) / 40); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.tally) AF.drawTally(ctx, this);
      if (this.dialog) AF.drawDialog(ctx, this.dialog);
      if (this.paused) AF.drawPause(ctx, this);
    }
    drawVignette(ctx) {
      const p = this.player, x = Math.round(p.cx - this.cam.vx), y = Math.round(p.cy - this.cam.vy);
      if (!this._vg) { this._vg = AF.makeCanvas(AF.W * 2, AF.H * 2); const c = this._vg.getContext('2d'); const gr = c.createRadialGradient(AF.W, AF.H, 30, AF.W, AF.H, 110); gr.addColorStop(0, 'rgba(0,0,10,0)'); gr.addColorStop(1, 'rgba(0,0,10,' + this.def.vignette + ')'); c.fillStyle = gr; c.fillRect(0, 0, AF.W * 2, AF.H * 2); }
      ctx.drawImage(this._vg, x - AF.W, y - AF.H);
    }
  }
  AF.Play = Play;
})();
