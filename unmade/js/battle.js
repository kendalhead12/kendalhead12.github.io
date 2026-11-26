'use strict';
// ============================================================
//  Battle engine: turn-based menus + bullet-hell dodging.
//  Flows are generator scripts so bosses can script anything.
// ============================================================
(function () {
  U.Enemies = {};
  U.Enemy = (id, def) => { def.id = id; U.Enemies[id] = def; };
  const B = U.Battle = {};
  const TEXTBOX = { x: 16, y: 120, w: 288, h: 74 };
  const BTNS = [{ id: 'fight', label: 'FIGHT' }, { id: 'act', label: 'ACT' }, { id: 'item', label: 'ITEM' }, { id: 'mercy', label: 'MERCY' }];
  const BTN_X = [12, 89, 166, 243], BTN_W = 66, BTN_Y = 214, BTN_H = 20;
  const HUD_Y = 200;
  const Typer = U.Typer;
  const St = () => U.State;
  const R = () => U.State.run;

  // ---------------- icons ----------------
  const ICON = {
    fight: ['..##....', '..##....', '..##....', '..##....', '..####..', '..#####.', '.######.', '........'],
    act: ['.######.', '#......#', '#.#..#.#', '#......#', '.######.', '..#.....', '.#......', '........'],
    item: ['...##...', '..#..#..', '.######.', '.#....#.', '.#.##.#.', '.#....#.', '.######.', '........'],
    mercy: ['#......#', '.#....#.', '..#..#..', '...##...', '..#..#..', '.#....#.', '#......#', '........'],
  };
  function icon(id, col) { return U.Art.cached('icon|' + id + '|' + col, () => { const p = new U.Pix(8, 8); p.map(ICON[id], { '#': col }); return p.c; }); }

  // ---------------- start / end ----------------
  B.start = function (opts) {
    return { start() { B.begin(opts, this); }, update() { return this.done; } };
  };
  B.begin = function (opts, cmd) {
    B.opts = opts; B.cmd = cmd;
    B.prev = U.scene;
    B.t = 0; B.turn = 0; B.over = false; B.result = null; B.flags = {}; B.expGain = 0; B.goldGain = 0; B.killed = []; B.sparedList = [];
    B.area = opts.area || (U.World.room && U.World.room.area);
    B.fear = !opts.noFear && U.State.fearActive();
    B.enemies = [];
    const ids = opts.enemies || [];
    ids.forEach((id, i) => B.enemies.push(makeEnemy(id, i, ids.length)));
    B.box = Object.assign({}, TEXTBOX); B.boxT = Object.assign({}, TEXTBOX);
    B.soul = { x: 160, y: 160, r: 3, inv: 0, visible: false, moving: false, col: null, lock: false };
    B.bullets = new U.Bullets(B);
    B.fx = []; B.parts = new U.Particles(); B.bubbles = null;
    B.mode = 'idle'; B.menu = { btn: 0, level: 'main', sel: 0, page: 0 };
    B.typer = null; B.flavor = '';
    B.broken = opts.broken || {};
    B.hideHUD = !!opts.hideHUD; B.hideButtons = !!opts.hideButtons;
    B.noDeath = !!opts.noDeath; B.onDeath = opts.onDeath || null;
    B.canFlee = opts.canFlee != null ? opts.canFlee : !B.enemies.some(e => e.def.boss);
    B.runner = new U.Runner();
    B.enter = { t: 0, sx: 160, sy: 120 };
    if (U.World.player && B.prev === U.World) { B.enter.sx = U.World.player.x - U.World.cam.x; B.enter.sy = U.World.player.y - U.World.cam.y - 6; }
    B.exit = null;
    B.bg = opts.bg || null;
    const m = opts.music !== undefined ? opts.music : (B.enemies[0] && B.enemies[0].def.music) || 'battle';
    B.music = m;
    U.Audio.stopMusic(.05);
    U.Audio.sfx('battle');
    B.flagsInit = true;
    U.scene = B;
    const first = B.enemies[0];
    const flow = opts.flow || (first && first.def.flow) || (opts.empty ? emptyFlow : defaultFlow);
    B.flow = flow;
  };
  function startFlow() {
    if (B.music) U.Audio.music(B.music, B.fear ? { rate: .82, semis: -1 } : null);
    B.runner.run(B.flow(B));
  }
  B.end = function (outcome) {
    if (B.exit) return;
    B.over = true;
    B.exit = { t: 0, outcome };
  };
  function finishExit() {
    const outcome = B.exit.outcome;
    B.exit = null;
    U.scene = B.prev || U.World;
    U.FX.fade = 1;
    U.Script.run((function* () { yield U.FX.fadeTo(0, 14); })(), true);
    if (U.scene === U.World) U.World.playMusic();
    const c = B.cmd; B.cmd = null;
    if (c) { c.value = { outcome, killed: B.killed.slice(), spared: B.sparedList.slice(), flags: B.flags, turn: B.turn }; c.done = true; }
  }

  // ---------------- enemies ----------------
  const LAYOUT = { 1: [160], 2: [104, 216], 3: [62, 160, 258] };
  function makeEnemy(id, i, n) {
    const def = U.Enemies[id];
    if (!def) throw new Error('No enemy ' + id);
    const e = {
      id, def, name: def.name, hp: def.hp, maxhp: def.hp, atk: def.atk || 4, df: def.df || 0,
      x: (LAYOUT[n] || LAYOUT[3])[i] || 160, y: def.baseY || 118, st: {}, acted: {}, shake: 0, alpha: 1, dead: false, spared: false,
      dying: 0, hpShow: 0, hpDisp: def.hp, mood: 'normal', t: U.randi(0, 100), ox: 0, oy: 0, flash: 0, expr: def.expr || null, visible: true,
    };
    if (def.init) def.init(B, e);
    return e;
  }
  B.addEnemy = function (id, x) { const e = makeEnemy(id, 0, 1); if (x != null) e.x = x; B.enemies.push(e); return e; };
  B.living = () => B.enemies.filter(e => !e.dead && !e.spared && e.visible !== false && !e.gone);
  B.isSpareable = e => !!(e.spareOK || (e.def.spareable && e.def.spareable(B, e)));
  B.checkWin = () => B.enemies.length > 0 && B.living().length === 0;

  // ---------------- commands ----------------
  B.textMode = function () { B.boxT = Object.assign({}, TEXTBOX); };
  B.boxTo = function (w, h, cx, by) {
    const bx = Math.round((cx || 160) - w / 2), y = Math.round((by || TEXTBOX.y + TEXTBOX.h) - h);
    B.boxT = { x: bx, y, w, h };
    return U.cmd.until(() => Math.abs(B.box.w - w) < 1 && Math.abs(B.box.h - h) < 1 && Math.abs(B.box.x - bx) < 1 && Math.abs(B.box.y - y) < 1);
  };
  // narration in the box
  B.say = function (...lines) {
    lines = lines.flat().filter(l => l != null);
    return {
      start() { B.textMode(); this.i = 0; this.f = U.frame; B.mode = 'text'; B.typer = new Typer(lines[0] || '', { bullet: true, maxChars: 44, voice: 'narr' }); },
      update() {
        if (!lines.length) { B.typer = null; return true; }
        const I = U.Input; if (U.frame === this.f) return false;
        if (I.pressed.cancel && !B.typer.done) { B.typer.skip(); return false; }
        if (I.pressed.confirm) {
          if (!B.typer.done) { B.typer.skip(); return false; }
          this.i++;
          if (this.i >= lines.length) { B.typer = null; B.mode = 'idle'; return true; }
          B.typer = new Typer(lines[this.i], { bullet: true, maxChars: 44, voice: 'narr' });
        }
        return false;
      },
    };
  };
  // speech bubbles: list of {e, lines} — all shown together, confirm advances
  B.bubble = function (e, ...lines) { return B.bubbles_([{ e, lines: lines.flat() }]); };
  B.bubbles_ = function (list, opts) {
    opts = opts || {};
    list = list.filter(x => x.lines && x.lines.length);
    return {
      start() { this.i = 0; this.f = U.frame; this.auto = 0; this.set(); },
      set() {
        B.bubbles = list.filter(x => x.lines[this.i] != null).map(x => {
          let ln = x.lines[this.i]; let expr = null;
          const m = /^@(\w+)\s*/.exec(ln); if (m) { expr = m[1]; ln = ln.slice(m[0].length); x.e.expr = expr; }
          const voice = x.e.def.voiceFor ? x.e.def.voiceFor(x.e.expr) : (x.e.def.voice || 'monster');
          return { e: x.e, typer: new Typer(ln, { voice, maxChars: x.e.def.bubbleChars || 17, color: '#000', lineH: 11 }) };
        });
      },
      update() {
        if (!list.length) { B.bubbles = null; return true; }
        const I = U.Input;
        const done = B.bubbles.every(b => b.typer.done);
        if (opts.auto && done) { if (++this.auto > opts.auto) { this.auto = 0; return this.next(); } return false; }
        if (U.frame === this.f) return false;
        if (I.pressed.confirm || (I.pressed.cancel && !done)) {
          if (!done) { B.bubbles.forEach(b => b.typer.skip()); return false; }
          if (I.pressed.confirm) return this.next();
        }
        return false;
      },
      next() {
        this.i++;
        if (list.every(x => x.lines[this.i] == null)) { B.bubbles = null; return true; }
        this.set(); return false;
      },
    };
  };
  B.waitConfirm = () => ({ f: U.frame, update() { return U.frame !== this.f && U.Input.pressed.confirm; } });

  // player menu -> action object
  B.menuCmd = function () {
    return {
      start() {
        B.textMode(); B.mode = 'menu';
        const m = B.menu; m.level = 'main'; m.sel = 0; m.page = 0;
        if (B.broken[BTNS[m.btn].id]) m.btn = BTNS.findIndex(b => !B.broken[b.id]);
        B.typer = new Typer(B.flavor || '', { bullet: true, maxChars: 44, voice: 'narr' });
        this.f = U.frame;
      },
      update() {
        if (U.frame === this.f) return false;
        const r = menuInput();
        if (r) { this.value = r; B.mode = 'idle'; B.typer = null; return true; }
        return false;
      },
    };
  };
  function menuOptions() {
    const m = B.menu;
    if (m.level === 'target') return B.living().map(e => e.name);
    if (m.level === 'act') return actsOf(m.target);
    if (m.level === 'item') return R().items.map(id => U.Items[id].name);
    if (m.level === 'mercy') return B.canFlee ? ['Spare', 'Flee'] : ['Spare'];
    return [];
  }
  function actsOf(e) { const a = typeof e.def.acts === 'function' ? e.def.acts(B, e) : (e.def.acts || ['Check']); return a; }
  function menuInput() {
    const I = U.Input, m = B.menu;
    if (m.level === 'main') {
      let d = 0; if (I.tap('left')) d = -1; if (I.tap('right')) d = 1;
      if (d) { let k = m.btn; for (let i = 0; i < 4; i++) { k = (k + d + 4) % 4; if (!B.broken[BTNS[k].id]) break; } if (k !== m.btn) { m.btn = k; U.Audio.sfx('move'); } }
      if (I.pressed.confirm) {
        const id = BTNS[m.btn].id;
        if (B.broken[id]) { U.Audio.sfx('wrong'); return null; }
        if (id === 'item' && !R().items.length) { U.Audio.sfx('wrong'); return null; }
        U.Audio.sfx('select');
        m.sel = 0; m.page = 0;
        if (id === 'fight' || id === 'act') { m.level = 'target'; m.action = id; }
        else if (id === 'item') m.level = 'item';
        else m.level = 'mercy';
      }
      return null;
    }
    const opts = menuOptions();
    const n = opts.length;
    const cols = (m.level === 'act' || m.level === 'item') ? 2 : 1;
    const per = m.level === 'item' ? 4 : 6;
    if (I.tap('up')) { if (cols === 2) { if (m.sel - 2 >= 0) m.sel -= 2; } else m.sel = (m.sel + n - 1) % n; U.Audio.sfx('move'); }
    if (I.tap('down')) { if (cols === 2) { if (m.sel + 2 < n) m.sel += 2; } else m.sel = (m.sel + 1) % n; U.Audio.sfx('move'); }
    if (cols === 2 && I.tap('left')) { if (m.sel % 2 === 1) m.sel--; else if (m.level === 'item' && m.sel - per + 1 >= 0) m.sel = m.sel - per + 1; U.Audio.sfx('move'); }
    if (cols === 2 && I.tap('right')) { if (m.sel % 2 === 0 && m.sel + 1 < n) m.sel++; else if (m.level === 'item' && m.sel + per - 1 < n) m.sel = m.sel + per - 1; U.Audio.sfx('move'); }
    m.sel = U.clamp(m.sel, 0, Math.max(0, n - 1));
    m.page = Math.floor(m.sel / per);
    if (I.pressed.cancel) {
      U.Audio.sfx('back');
      if (m.level === 'act') { m.level = 'target'; m.sel = B.living().indexOf(m.target); }
      else m.level = 'main';
      return null;
    }
    if (I.pressed.confirm && n) {
      U.Audio.sfx('select');
      if (m.level === 'target') {
        const e = B.living()[m.sel];
        if (m.action === 'fight') return { type: 'fight', target: e };
        m.target = e; m.level = 'act'; m.sel = 0; return null;
      }
      if (m.level === 'act') return { type: 'act', target: m.target, act: opts[m.sel] };
      if (m.level === 'item') return { type: 'item', index: m.sel };
      if (m.level === 'mercy') return { type: m.sel === 0 ? 'spare' : 'flee' };
    }
    return null;
  }

  // FIGHT: timing meter -> accuracy 0..1 (or -1 for a miss)
  B.fightCmd = function () {
    return {
      start() { B.textMode(); B.mode = 'fight'; B.meter = { x: TEXTBOX.x + 6, stop: false, t: 0, flash: 0 }; this.f = U.frame; this.w = 0; },
      update() {
        const M = B.meter;
        if (M.stop) { M.flash++; if (++this.w > 20) { B.mode = 'idle'; return true; } return false; }
        M.x += 3.6;
        if (U.frame !== this.f && U.Input.pressed.confirm) {
          M.stop = true;
          const c = TEXTBOX.x + TEXTBOX.w / 2;
          this.value = Math.max(0, 1 - Math.abs(M.x - c) / (TEXTBOX.w / 2 - 6));
          if (this.value <= 0.02) this.value = -1;
          return false;
        }
        if (M.x > TEXTBOX.x + TEXTBOX.w - 8) { this.value = -1; B.mode = 'idle'; return true; }
        return false;
      },
    };
  };
  // attack animation + damage. returns damage dealt
  B.hitCmd = function (e, acc, opts) {
    opts = opts || {};
    return {
      start() {
        this.t = 0;
        const hands = R().weapon === 'hands';
        this.hands = hands;
        let dmg = 0;
        if (acc >= 0) {
          const base = St().attack() - e.df + U.rand(0, 2);
          const mult = acc > .94 ? 2.2 : 2 * acc;
          dmg = Math.max(1, Math.round(base * mult));
          this.crit = acc > .94;
        }
        if (opts.dmg != null) dmg = opts.dmg;
        if (e.def.onHit) { const r = e.def.onHit(B, e, dmg, acc); if (r != null) dmg = r; }
        this.dmg = dmg; this.value = dmg;
        this.dur = hands ? 64 : 46;
        if (dmg > 0 || e.st.dodged) B.fx.push(hands ? { kind: 'hands', e, t: 0 } : { kind: 'kick', e, t: 0, crit: this.crit });
        if (hands) U.Audio.sfx('hands');
      },
      update() {
        this.t++;
        const impact = this.hands ? 40 : 14;
        if (this.t === impact) {
          if (this.dmg > 0) {
            U.Audio.sfx(this.hands ? 'clap' : this.crit ? 'crit' : 'hit');
            e.shake = this.hands ? 10 : 6; e.hpShow = 90;
            e.hp = Math.max(e.def.minHp != null ? e.def.minHp : -999, e.hp - this.dmg);
            U.FX.shake(this.hands ? 5 : 2, 12);
            B.parts.burst(e.x, e.y - e.h / 2, this.hands ? 22 : 10, { col: '#fff', smin: 1, smax: 3.5, lmin: 12, lmax: 26, size: 2 });
          } else U.Audio.sfx('miss');
          B.fx.push({ kind: 'num', e, t: 0, text: this.dmg > 0 ? String(this.dmg) : (e.st.missText || 'MISS'), col: this.dmg > 0 ? '#ff4040' : '#bbbbbb' });
        }
        return this.t >= this.dur;
      },
    };
  };
  B.killCmd = function (e) {
    return {
      start() { e.dying = 1; U.Audio.sfx('dust'); this.t = 0; },
      update() {
        this.t++; e.dying = this.t;
        if (this.t % 2 === 0) { const w = e.w || 40; const cut = e.y - e.h + (e.h * this.t / 50); for (let k = 0; k < 3; k++) B.parts.add({ x: e.x + U.rand(-w / 2, w / 2), y: cut, vx: U.rand(-.3, .3), vy: U.rand(-1.4, -.4), life: U.randi(20, 40), col: U.choose(['#ffffff', '#d8d8d8', '#a0a0a0']), size: U.choose([1, 1, 2]) }); }
        if (this.t >= 56) {
          e.dead = true;
          St().recordKill(e.id, B.area, !!e.def.boss);
          B.killed.push(e.id);
          B.expGain += e.def.exp || 0; B.goldGain += e.def.gold || 0;
          if (e.def.onKilled) e.def.onKilled(B, e);
          return true;
        }
        return false;
      },
    };
  };
  B.spareCmd = function (e) {
    return {
      start() { e.spared = true; e.sparing = 1; U.Audio.sfx('spare'); this.t = 0; B.parts.burst(e.x, e.y - (e.h || 40) / 2, 16, { col: '#fff', smin: .8, smax: 2.4, lmin: 16, lmax: 30, size: 1, drag: .94 }); },
      update() {
        this.t++; e.sparing = this.t;
        if (this.t >= 24) {
          St().recordSpare(e.id, B.area);
          B.sparedList.push(e.id);
          B.goldGain += e.def.spareGold != null ? e.def.spareGold : Math.floor((e.def.gold || 0) / 2);
          if (e.def.onSpared) e.def.onSpared(B, e);
          return true;
        }
        return false;
      },
    };
  };
  // dodge phase: patterns = [{ box:{w,h}, dur, init(B,p), update(B,p,t) }]
  B.dodgeCmd = function (patterns, opts) {
    opts = opts || {};
    patterns = patterns.filter(Boolean);
    return {
      start() {
        const w = Math.max(...patterns.map(p => (p.box && p.box.w) || 100)), h = Math.max(...patterns.map(p => (p.box && p.box.h) || 90));
        this.dur = Math.max(...patterns.map(p => p.dur || 240));
        this.resize = B.boxTo(w, h, opts.cx, opts.by);
        this.phase = 0; this.t = 0;
        B.mode = 'dodge-prep'; B.hitsThisTurn = 0;
        B.soul.visible = true; B.soul.inv = 0;
        this.end = 0;
      },
      update() {
        if (this.phase === 0) {
          const box = B.box;
          B.soul.x = box.x + box.w / 2; B.soul.y = box.y + box.h / 2 + (patterns[0].soulOy || 0);
          if (this.resize.update()) {
            this.phase = 1; B.mode = 'dodge';
            patterns.forEach(p => { p.t = 0; if (p.init) p.init(B, p); });
          }
          return false;
        }
        if (this.phase === 1) {
          this.t++;
          patterns.forEach(p => { p.t = this.t; if (p.update) p.update(B, p, this.t); });
          if (B.over && !B.exit) return false;
          if (this.t >= this.dur || patterns.every(p => p.done)) {
            this.phase = 2; this.end = 0;
            B.bullets.list.forEach(b => { b.hit = false; b.fadeOut = true; });
          }
          return false;
        }
        if (this.phase === 2) {
          this.end++;
          B.bullets.list.forEach(b => { b.alpha -= .12; });
          if (this.end === 8) { B.bullets.clear(); B.soul.visible = false; B.mode = 'idle'; patterns.forEach(p => p.finish && p.finish(B, p)); this.value = { hits: B.hitsThisTurn }; B.textMode(); }
          if (this.end > 8 && this.end > 14) return true;
          return false;
        }
        return true;
      },
    };
  };

  // ---------------- damage to the player ----------------
  B.damage = function (n, src) {
    const S = B.soul;
    if (S.inv > 0 || B.over) return;
    const r = R();
    n = Math.max(1, Math.round(n - St().defense() / 3));
    r.hp -= n;
    S.inv = 48;
    B.hitsThisTurn++;
    U.Audio.sfx('hurt'); U.FX.shake(2, 8);
    if (src && src.onHit) src.onHit(src, B);
    if (r.hp <= 0) {
      if (B.onDeath && B.onDeath(B)) return;
      if (B.noDeath) { r.hp = 1; return; }
      r.hp = 0;
      B.gameOver();
    }
  };
  B.heal = function (n) { const got = St().heal(n); if (got > 0) { U.Audio.sfx('heal'); B.parts.burst(B.soul.x, B.soul.y, 6, { col: '#5cff6a', smin: .5, smax: 1.5, lmin: 10, lmax: 20 }); } };
  B.gameOver = function () {
    B.over = true;
    B.runner.stop();
    U.Audio.stopMusic(0);
    U.GameOver.start(B.soul.x, B.soul.y, B.opts.gameOverText);
  };

  // ---------------- standard flows ----------------
  function* defaultFlow(B) {
    B.flavor = pickIntro();
    while (!B.over) {
      const a = yield B.menuCmd();
      yield* B.doAction(a);
      if (B.over) return;
      if (B.checkWin()) { yield* B.winFlow(); return; }
      yield* B.enemyTurn();
      if (B.over) return;
      B.turn++;
      B.flavor = B.pickFlavor();
    }
  }
  B.defaultFlow = defaultFlow;
  function* emptyFlow(B) {
    B.flavor = '';
    yield 20;
    yield B.say('{x}...', '{x}But nothing came.');
    B.end('empty');
  }
  function pickIntro() {
    const e = B.enemies[0]; if (!e) return '';
    if (B.fear && e.def.fear && e.def.fear.intro) return e.def.fear.intro;
    const t = typeof e.def.intro === 'function' ? e.def.intro(B, e) : e.def.intro;
    if (B.enemies.length > 1 && !e.def.introMulti) return B.enemies.map(x => x.name).join(' and ') + ' drew near!';
    return t || (e.name + ' appeared.');
  }
  B.pickFlavor = function () {
    const live = B.living(); if (!live.length) return '';
    const e = U.choose(live);
    if (B.fear && e.def.fear && e.def.fear.flavor && Math.random() < .75) return U.choose(e.def.fear.flavor);
    if (B.isSpareable(e) && e.def.spareFlavor) return typeof e.def.spareFlavor === 'function' ? e.def.spareFlavor(B, e) : e.def.spareFlavor;
    if (e.hp < e.maxhp * .3 && e.def.lowFlavor) return e.def.lowFlavor;
    const f = typeof e.def.flavor === 'function' ? e.def.flavor(B, e) : e.def.flavor;
    return Array.isArray(f) ? U.choose(f) : (f || e.name + ' is here.');
  };
  B.doAction = function* (a) {
    if (!a) return;
    if (a.type === 'fight') {
      const acc = yield B.fightCmd();
      yield B.hitCmd(a.target, acc);
      if (a.target.hp <= 0 && !a.target.def.noKill) yield* B.killFlow(a.target);
      else if (a.target.def.afterHit) yield* a.target.def.afterHit(B, a.target);
    } else if (a.type === 'act') {
      a.target.acted[a.act] = (a.target.acted[a.act] || 0) + 1;
      let lines;
      if (a.act === 'Check' && !(a.target.def.checkCustom)) {
        const d = a.target.def;
        const chk = typeof d.check === 'function' ? d.check(B, a.target) : d.check;
        lines = [d.name.toUpperCase() + ' - ATK ' + a.target.atk + ' DEF ' + a.target.df + '\n' + (B.fear && d.fear && d.fear.check ? d.fear.check : chk)];
      } else lines = a.target.def.act ? a.target.def.act(B, a.target, a.act) : ['Nothing happened.'];
      if (lines && lines.next) { yield* lines; }
      else if (lines && lines.length) yield B.say(...lines);
    } else if (a.type === 'item') {
      const lines = U.State.useItem(a.index);
      yield B.say(...lines);
    } else if (a.type === 'spare') {
      const live = B.living();
      for (const e of live) {
        if (B.isSpareable(e)) yield B.spareCmd(e);
        else if (e.def.onSpare) { const r = e.def.onSpare(B, e); if (r && r.next) yield* r; else if (r && r.length) yield B.say(...r); }
      }
    } else if (a.type === 'flee') {
      const chance = .5 + B.turn * .1;
      if (Math.random() < chance || U.params.has('flee')) { yield* B.fleeFlow(); }
    }
  };
  B.killFlow = function* (e) {
    if (e.def.deathFlow) { yield* e.def.deathFlow(B, e); return; }
    if (e.def.deathLines) { const l = typeof e.def.deathLines === 'function' ? e.def.deathLines(B, e) : e.def.deathLines; if (l && l.length) yield B.bubble(e, ...l); }
    yield B.killCmd(e);
  };
  B.fleeFlow = function* () {
    St().recordFlee(B.area);
    U.Audio.sfx('swoosh');
    B.soul.visible = false;
    B.fx.push({ kind: 'flee', t: 0 });
    yield B.say(U.choose(['You hopped away as fast as your little legs could carry you.', "You're outta here.", 'You hop away. Nobody follows.']));
    B.end('flee');
  };
  B.winFlow = function* () {
    const exp = B.expGain, gold = B.goldGain;
    R().gold += gold;
    if (!exp && !gold && B.enemies.some(e => e.def.boss)) { B.end(B.killed.length ? 'kill' : 'spare'); return; }
    let lines = ['YOU WON!\nYou earned ' + exp + ' EXP and ' + gold + ' G.'];
    if (exp > 0) { const up = St().addExp(exp); if (up) { lines[0] += '\nYour LV increased.'; U.Audio.sfx('levelup'); } }
    if (B.opts.winText) lines = B.opts.winText(lines);
    yield B.say(...lines);
    B.end(B.killed.length ? 'kill' : 'spare');
  };
  B.enemyTurn = function* () {
    const live = B.living();
    const skip = new Set();
    const talk = live.map(e => {
      let lines = null;
      if (B.fear && !e.def.boss && e.def.fear && Math.random() < .2) { skip.add(e); lines = ['...', U.choose(e.def.fear.talk || ['...'])]; }
      else if (B.fear && !e.def.boss && e.def.fear && e.def.fear.talk && Math.random() < .7) lines = [U.choose(e.def.fear.talk)];
      else lines = e.def.talk ? e.def.talk(B, e) : null;
      if (typeof lines === 'string') lines = [lines];
      return { e, lines };
    });
    if (talk.some(x => x.lines && x.lines.length)) yield B.bubbles_(talk);
    const pats = live.filter(e => !skip.has(e)).map(e => e.def.attack ? e.def.attack(B, e) : null).filter(Boolean);
    if (pats.length) yield B.dodgeCmd(pats);
    else if (skip.size) { B.flavor = U.choose(live).name + ' is too scared to move.'; }
  };

  // ---------------- per-frame ----------------
  B.update = function () {
    B.t++;
    if (B.enter) {
      B.enter.t++;
      if (B.enter.t === 4 || B.enter.t === 12 || B.enter.t === 20) U.Audio.sfx('move');
      if (B.enter.t > 40) { B.enter = null; startFlow(); }
      return;
    }
    if (B.exit) { B.exit.t++; if (B.exit.t === 1) U.Audio.stopMusic(.3); if (B.exit.t > 16) finishExit(); return; }
    // box animation
    const bx = B.box, bt = B.boxT;
    for (const k of ['x', 'y', 'w', 'h']) { const d = bt[k] - bx[k]; bx[k] = Math.abs(d) < 1 ? bt[k] : bx[k] + d * .3; }
    // soul
    const S = B.soul;
    if (B.mode === 'dodge' && !S.lock) {
      const ax = U.Input.axis();
      let sp = U.Input.down.cancel ? 1 : 2;
      if (B.soulSpeed) sp *= B.soulSpeed;
      const k = ax.x && ax.y ? .75 : 1;
      const ox = S.x, oy = S.y;
      S.x += ax.x * sp * k; S.y += ax.y * sp * k;
      S.x = U.clamp(S.x, bx.x + 3 + S.r + 1, bx.x + bx.w - 4 - S.r - 1);
      S.y = U.clamp(S.y, bx.y + 3 + S.r + 1, bx.y + bx.h - 4 - S.r - 1);
      S.moving = Math.abs(S.x - ox) + Math.abs(S.y - oy) > .1;
    }
    if (S.inv > 0) S.inv--;
    if (B.mode === 'dodge' || B.bulletsLive) {
      B.bullets.update();
      if (S.visible && !B.over) {
        for (const b of B.bullets.hits(S.x, S.y, S.r)) {
          if (b.type === 'heal') { B.heal(b.heal || 1); b.dead = true; if (b.onHit) b.onHit(b, B); continue; }
          if (S.inv > 0 && !b.ignoreInv) continue;
          if (b.type === 'still' && !S.moving) continue;
          if (b.type === 'move' && S.moving) continue;
          if (b.custom) { b.custom(b, B); continue; }
          B.damage(b.dmg, b);
          if (b.pierce === false) b.dead = true;
        }
      }
    }
    for (const e of B.enemies) {
      e.t++;
      if (e.shake > 0) { e.shake *= .88; if (e.shake < .3) e.shake = 0; }
      if (e.hpShow > 0) { e.hpShow--; }
      e.hpDisp = U.approach(e.hpDisp, Math.max(0, e.hp), Math.max(.5, e.maxhp / 60));
      if (e.def.update) e.def.update(B, e);
    }
    for (const f of B.fx) f.t++;
    B.fx = B.fx.filter(f => f.t < (f.kind === 'num' ? 60 : f.kind === 'hands' ? 66 : f.kind === 'flee' ? 40 : f.kind === 'custom' ? (f.dur || 60) : 30));
    B.parts.update();
    if (B.typer) B.typer.update();
    if (B.bubbles) B.bubbles.forEach(b => b.typer.update());
    if (B.flowUpdate) B.flowUpdate(B);
    B.runner.update();
  };

  // ---------------- drawing ----------------
  B.draw = function (ctx) {
    const W = U.W, H = U.H;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (B.enter) { drawEnter(ctx); return; }
    const ox = U.FX.ox, oy = U.FX.oy;
    ctx.save(); ctx.translate(ox, oy);
    // background grid
    if (B.bg) B.bg(ctx, B);
    else {
      ctx.fillStyle = '#101010';
      for (let x = 10; x < W; x += 30) ctx.fillRect(x, 6, 1, 108);
      for (let y = 6; y < 115; y += 27) ctx.fillRect(10, y, 300, 1);
    }
    if (B.drawBack) B.drawBack(ctx, B);
    // enemies
    for (const e of B.enemies) drawEnemy(ctx, e);
    if (B.drawMid) B.drawMid(ctx, B);
    // box
    const b = B.box;
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h));
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(b.x) + 3, Math.round(b.y) + 3, Math.round(b.w) - 6, Math.round(b.h) - 6);
    drawBoxContents(ctx);
    B.bullets.draw(ctx);
    // soul
    const S = B.soul;
    if (S.visible && !(S.inv > 0 && (S.inv >> 2) % 2 === 0)) {
      const spr = U.Chars.soul(S.col);
      ctx.drawImage(spr, Math.round(S.x - 4), Math.round(S.y - 4));
    }
    // fx
    for (const f of B.fx) drawFx(ctx, f);
    B.parts.draw(ctx);
    // bubbles
    if (B.bubbles) B.bubbles.forEach(drawBubble);
    function drawBubble(bb) {
      const e = bb.e, t = bb.typer;
      const lines = t.lines.length, w = (e.def.bubbleChars || 17) * 6 + 10, h = lines * 11 + 9;
      let x = Math.round(e.x + (e.w || 40) / 2 + 8), y = Math.round(e.y - (e.h || 60) + 4);
      let left = false;
      if (x + w > 314 || e.def.bubbleLeft) { x = Math.round(e.x - (e.w || 40) / 2 - 8 - w); left = true; }
      x = U.clamp(x, 4, 316 - w); y = U.clamp(y, 4, 110 - h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
      const ty = y + 8;
      if (left) { ctx.beginPath(); ctx.moveTo(x + w - 1, ty - 3); ctx.lineTo(x + w + 6, ty); ctx.lineTo(x + w - 1, ty + 3); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x + 1, ty - 3); ctx.lineTo(x - 6, ty); ctx.lineTo(x + 1, ty + 3); ctx.fill(); }
      t.draw(ctx, x + 5, y + 5);
    }
    if (B.drawTop) B.drawTop(ctx, B);
    // HUD + buttons
    if (!B.hideHUD) drawHUD(ctx);
    if (!B.hideButtons) drawButtons(ctx);
    ctx.restore();
    if (B.exit) { ctx.globalAlpha = Math.min(1, B.exit.t / 14); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  };
  function drawEnter(ctx) {
    const t = B.enter.t;
    const spr = U.Chars.soul();
    if (t < 24) { if ((t >> 2) % 2 === 0) ctx.drawImage(spr, Math.round(B.enter.sx - 4), Math.round(B.enter.sy - 4)); }
    else {
      const k = U.ease.inOut(Math.min(1, (t - 24) / 14));
      const tx = BTN_X[0] + 6, ty = BTN_Y + 6;
      ctx.drawImage(spr, Math.round(U.lerp(B.enter.sx, tx, k) - 4), Math.round(U.lerp(B.enter.sy, ty, k) - 4));
    }
  }
  function drawEnemy(ctx, e) {
    if (e.gone || e.visible === false) return;
    if (e.dead && !e.def.keepDead) return;
    let spr = e.def.sprite ? e.def.sprite(B, e) : null;
    if (!spr && e.def.art) {
      const mood = e.dyingMood || (B.fear && !e.def.boss ? 'scared' : e.mood);
      spr = U.Monsters.bw(e.def.art, Math.floor((B.t + e.t) / (e.def.frameRate || 10)) % (e.def.frames || 4), mood);
    }
    if (!spr) return;
    const sc = e.def.scale || 2;
    const w = spr.width * sc, h = spr.height * sc;
    e.w = w; e.h = h;
    let x = e.x - w / 2 + e.ox, y = e.y - h + e.oy;
    if (e.def.idle) { const o = e.def.idle(B, e); x += o.x || 0; y += o.y || 0; }
    else y += Math.round(Math.sin((B.t + e.t) * .05) * 1.2);
    if (e.shake) x += Math.round(Math.sin(B.t * 1.7) * e.shake);
    if (B.fear && !e.def.boss && !e.dead && !e.spared && B.t % 3 === 0) e.trem = U.randi(-1, 1);
    if (B.fear && !e.def.boss) x += e.trem || 0;
    x = Math.round(x); y = Math.round(y);
    ctx.save();
    if (e.spared) ctx.globalAlpha = .4;
    if (e.alpha < 1) ctx.globalAlpha *= e.alpha;
    if (e.dying) {
      const cut = h * Math.min(1, e.dying / 50);
      ctx.beginPath(); ctx.rect(x - 2, y + cut, w + 4, h - cut + 2); ctx.clip();
    }
    ctx.drawImage(spr, x, y, w, h);
    ctx.restore();
    if (e.def.drawExtra) e.def.drawExtra(ctx, B, e, x, y, w, h);
    if (e.hpShow > 0 && !e.dead) {
      const bw = Math.max(50, Math.min(100, e.maxhp)), bx = Math.round(e.x - bw / 2), by = Math.round(e.y + 4);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx, by, bw, 6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, Math.round(bw * Math.max(0, e.hpDisp) / e.maxhp), 6);
    }
  }
  function drawFx(ctx, f) {
    if (f.kind === 'num') {
      const e = f.e; const y = e.y - (e.h || 60) - 6 - Math.min(14, f.t * 1.2) + (f.t > 12 ? Math.min(4, (f.t - 12) * .5) : 0);
      U.Font.draw(ctx, f.text, Math.round(e.x), Math.round(y), f.col, { align: 'center', scale: 2, shadow: '#000' });
    } else if (f.kind === 'kick') {
      // a quick leg swoosh across the target
      const e = f.e, k = Math.min(1, f.t / 14);
      const sx = e.x - 46, sy = e.y + 6, tx = e.x + 2, ty = e.y - (e.h || 60) * .55;
      const x = U.lerp(sx, tx, U.ease.out(k)), y = U.lerp(sy, ty, U.ease.out(k)) - Math.sin(k * Math.PI) * 18;
      if (f.t < 22) {
        ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x - 24, y + 22); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 24, y + 22); ctx.lineTo(x, y); ctx.stroke(); ctx.lineWidth = 1;
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x + 3, y - 1, 8, 5, -.6, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + 3, y - 1, 6.5, 3.8, -.6, 0, 7); ctx.fill();
        ctx.globalAlpha = .4; for (let i = 1; i < 4; i++) { const kk = Math.max(0, k - i * .08); const xx = U.lerp(sx, tx, U.ease.out(kk)), yy = U.lerp(sy, ty, U.ease.out(kk)) - Math.sin(kk * Math.PI) * 18; ctx.fillRect(Math.round(xx), Math.round(yy), 3, 3); } ctx.globalAlpha = 1;
      }
      if (f.t >= 14 && f.t < 30) {
        const r = (f.t - 14) * (f.crit ? 2.2 : 1.5);
        ctx.strokeStyle = '#fff'; ctx.globalAlpha = 1 - (f.t - 14) / 16;
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * r * .4, ty + Math.sin(a) * r * .4); ctx.lineTo(tx + Math.cos(a) * r, ty + Math.sin(a) * r); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    } else if (f.kind === 'hands') {
      const e = f.e, cy = e.y - (e.h || 60) * .5;
      const grow = U.clamp(f.t / 30, 0, 1), clap = U.clamp((f.t - 30) / 10, 0, 1);
      const sc = 1 + grow * 4;
      const gap = U.lerp(60, 8, U.ease.in(clap));
      const hl = U.Chars.hand(false, true), hr = U.Chars.hand(true, true);
      if (f.t < 52) {
        ctx.globalAlpha = Math.min(1, f.t / 8);
        ctx.drawImage(hl, Math.round(e.x - gap - hl.width * sc), Math.round(cy - hl.height * sc / 2), hl.width * sc, hl.height * sc);
        ctx.drawImage(hr, Math.round(e.x + gap), Math.round(cy - hr.height * sc / 2), hr.width * sc, hr.height * sc);
        ctx.globalAlpha = 1;
      }
      if (f.t >= 40 && f.t < 60) { const r = (f.t - 40) * 4; ctx.strokeStyle = '#ff6060'; ctx.globalAlpha = 1 - (f.t - 40) / 20; ctx.beginPath(); ctx.arc(e.x, cy, r, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    } else if (f.kind === 'flee') {
      const x = B.box.x + 20 - f.t * 4, y = B.box.y + B.box.h / 2;
      const spr = U.Chars.soul(); ctx.drawImage(spr, Math.round(x), Math.round(y));
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x) + 2, Math.round(y) + 9, 1, 3 + (f.t >> 2) % 2); ctx.fillRect(Math.round(x) + 6, Math.round(y) + 9, 1, 3 + ((f.t >> 2) + 1) % 2);
    } else if (f.kind === 'custom' && f.draw) f.draw(ctx, f, B);
  }
  function drawBoxContents(ctx) {
    const b = B.box;
    const tb = TEXTBOX;
    const textReady = Math.abs(b.w - tb.w) < 2 && Math.abs(b.h - tb.h) < 2;
    if (!textReady) return;
    const x = tb.x + 14, y = tb.y + 14;
    if (B.mode === 'menu') {
      const m = B.menu;
      if (m.level === 'main') { if (B.typer) B.typer.draw(ctx, x, y); }
      else drawList(ctx, x, y);
    } else if (B.mode === 'text' || B.typer) { if (B.typer) B.typer.draw(ctx, x, y); }
    if (B.mode === 'fight') drawMeter(ctx);
  }
  function drawList(ctx, x, y) {
    const m = B.menu, opts = menuOptions();
    const soul = U.Chars.soul();
    const cols = (m.level === 'act' || m.level === 'item') ? 2 : 1;
    const per = m.level === 'item' ? 4 : 6;
    const start = m.page * per;
    for (let i = start; i < Math.min(opts.length, start + per); i++) {
      const k = i - start;
      const cx = x + 16 + (cols === 2 ? (k % 2) * 136 : 0), cy = y + (cols === 2 ? Math.floor(k / 2) : k) * 16;
      let col = '#fff';
      if (m.level === 'target') { const e = B.living()[i]; if (e && B.isSpareable(e)) col = '#ffe23a'; }
      if (m.level === 'mercy' && i === 0 && B.living().some(e => B.isSpareable(e))) col = '#ffe23a';
      U.Font.draw(ctx, (cols === 1 || m.level === 'act' ? '' : '') + opts[i], cx, cy, col);
      if (m.level === 'target' && m.action === 'fight') {
        const e = B.living()[i];
        if (e) { const bx = cx + 120; ctx.fillStyle = '#3a3a3a'; ctx.fillRect(bx, cy, 60, 7); ctx.fillStyle = '#fff'; ctx.fillRect(bx, cy, Math.round(60 * Math.max(0, e.hp) / e.maxhp), 7); }
      }
      if (i === m.sel) ctx.drawImage(soul, cx - 13, cy - 1);
    }
    if (m.level === 'item' && opts.length > per) U.Font.draw(ctx, 'PAGE ' + (m.page + 1), x + 196, y + 34, '#8a8a8a');
  }
  function drawMeter(ctx) {
    const tb = TEXTBOX, M = B.meter;
    const cx = tb.x + tb.w / 2, cy = tb.y + tb.h / 2;
    ctx.strokeStyle = '#6a6a6a';
    for (let k = 1; k <= 5; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, (tb.w / 2 - 8) * k / 5, (tb.h / 2 - 8) * (0.35 + k * .13), 0, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(cx - 1, tb.y + 6, 2, tb.h - 12);
    ctx.strokeStyle = '#3a3a3a'; for (let x = tb.x + 10; x < tb.x + tb.w - 8; x += 12) { ctx.beginPath(); ctx.moveTo(x, cy - 3); ctx.lineTo(x, cy + 3); ctx.stroke(); }
    const fl = M.stop && (M.flash >> 2) % 2 === 0;
    ctx.fillStyle = fl ? '#000' : '#fff'; ctx.fillRect(Math.round(M.x) - 3, tb.y + 5, 6, tb.h - 10);
    ctx.fillStyle = fl ? '#fff' : '#000'; ctx.fillRect(Math.round(M.x) - 1, tb.y + 7, 2, tb.h - 14);
  }
  function drawHUD(ctx) {
    const r = R(); if (!r) return;
    U.Font.draw(ctx, r.name, 14, HUD_Y, '#fff');
    U.Font.draw(ctx, 'LV ' + r.lv, 74, HUD_Y, '#fff');
    U.Font.draw(ctx, 'HP', 122, HUD_Y, '#fff');
    const mh = St().maxhp(), bw = Math.round(Math.max(24, mh * 1.2));
    ctx.fillStyle = '#b01818'; ctx.fillRect(138, HUD_Y - 1, bw, 9);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(138, HUD_Y - 1, Math.round(bw * Math.max(0, r.hp) / mh), 9);
    U.Font.draw(ctx, Math.max(0, r.hp) + ' / ' + mh, 138 + bw + 8, HUD_Y, '#fff');
    if (B.drawHUDExtra) B.drawHUDExtra(ctx, B);
  }
  function drawButtons(ctx) {
    const soul = U.Chars.soul();
    BTNS.forEach((bt, i) => {
      const x = BTN_X[i], y = BTN_Y;
      const sel = B.mode === 'menu' && B.menu.btn === i && B.menu.level === 'main' || (B.mode === 'menu' && B.menu.btn === i);
      const broken = B.broken[bt.id];
      if (broken) {
        // shattered button: only the repaired fraction is drawn
        const frac = typeof broken === 'number' ? broken : 0;
        ctx.fillStyle = '#3a3a3a';
        for (let k = 0; k < 6; k++) { if (k / 6 < frac) continue; ctx.fillRect(x + 4 + k * 10, y + 8 + ((k * 7) % 5), 4, 2); }
        if (frac > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, BTN_W * frac, BTN_H); ctx.clip(); drawBtn(ctx, bt, x, y, false); ctx.restore(); }
        return;
      }
      drawBtn(ctx, bt, x, y, sel);
      if (sel) ctx.drawImage(soul, x + 4, y + 6);
    });
  }
  function drawBtn(ctx, bt, x, y, sel) {
    const col = sel ? '#ffffff' : '#8c8c8c';
    ctx.fillStyle = col; ctx.fillRect(x, y, BTN_W, BTN_H); ctx.fillStyle = '#000'; ctx.fillRect(x + (sel ? 2 : 1), y + (sel ? 2 : 1), BTN_W - (sel ? 4 : 2), BTN_H - (sel ? 4 : 2));
    if (!sel) ctx.drawImage(icon(bt.id, col), x + 5, y + 6);
    U.Font.draw(ctx, bt.label, x + 18 + (5 - bt.label.length) * 3, y + 7, col);
  }
})();
