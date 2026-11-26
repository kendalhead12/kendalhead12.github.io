'use strict';
// ============================================================
//  Overworld: rooms, entities, movement, collision, encounters,
//  lighting, weather and cutscene helpers
// ============================================================
(function () {
  const TS = 16;
  U.Rooms = {};
  U.defRoom = (id, def) => { def.id = id; U.Rooms[id] = def; };
  const W = U.World = {
    room: null, id: null, ents: [], player: null, cam: { x: 0, y: 0 }, camLock: null, bg: null, anim: [], t: 0,
    parts: new U.Particles(), weather: [], trans: false, alertT: 0, encDist: 0, encNext: 400, light: null,
  };
  const S = () => U.State;
  const run = () => U.State.run;

  // ---------------- entities ----------------
  let entSeq = 0;
  W.spawn = function (o) {
    const e = Object.assign({ uid: ++entSeq, kind: 'prop', x: 0, y: 0, z: 0, dir: 'down', frame: 0, anim: 0, visible: true, alpha: 1 }, o);
    if (o.tx != null) e.x = o.tx * TS + 8 + (o.ox || 0);
    if (o.ty != null) e.y = o.ty * TS + 14 + (o.oy || 0);
    if (e.prop && !e.solid && U.Props.defs[e.prop] && U.Props.defs[e.prop].solid && e.solid !== false) e.solid = U.Props.defs[e.prop].solid;
    if (e.prop && !e.light && U.Props.defs[e.prop] && U.Props.defs[e.prop].light) e.light = U.Props.defs[e.prop].light;
    if (e.prop && U.Props.defs[e.prop] && U.Props.defs[e.prop].flat) e.flat = true;
    if (e.kind === 'npc' && !e.solid && e.solid !== false) e.solid = [12, 6];
    if (e.kind === 'save') { e.solid = [12, 6]; e.light = e.light || { r: 30, oy: -10, col: 'warm' }; }
    if (e.kind === 'trigger') e.visible = false;
    W.ents.push(e);
    if (e.init) e.init(e, W);
    return e;
  };
  W.remove = e => { W.ents = W.ents.filter(x => x !== e); };
  W.find = id => W.ents.find(e => e.id === id);

  // ---------------- room loading ----------------
  W.load = function (id, at, dir) {
    const def = U.Rooms[id];
    if (!def) { console.warn('no room', id); return; }
    W.room = def; W.id = id;
    const map = (typeof def.map === 'function' ? def.map() : def.map).slice();
    def.w = Math.max(...map.map(r => r.length)); def.h = map.length;
    def.cur = map.map(r => r.padEnd(def.w, ' '));
    W.mapRows = def.cur;
    const r = U.Tiles.render({ tileset: def.tileset, w: def.w, h: def.h, map: def.cur });
    W.bg = r.canvas; W.anim = r.anim;
    W.ents = []; W.parts.clear(); W.camLock = null;
    // legend spawns (trees, pillars...)
    for (let ty = 0; ty < def.h; ty++) for (let tx = 0; tx < def.w; tx++) {
      const sp = U.Tiles.spawnOf(def.tileset, def.cur[ty][tx]);
      if (sp) W.spawn({ kind: 'prop', prop: sp, tx, ty, state: def.dead ? 'dead' : undefined });
    }
    // player
    if (!W.player) W.player = { kind: 'player', x: 0, y: 0, z: 0, dir: 'down', frame: 0, anim: 0, visible: true, alpha: 1 };
    const P = W.player;
    W.ents.push(P);
    if (Array.isArray(at)) { P.x = at[0] * TS + 8; P.y = at[1] * TS + 14; }
    else if (at && at.x != null) { P.x = at.x; P.y = at.y; }
    if (dir) P.dir = dir;
    P.pose = null; P.z = 0; P.visible = true; P.alpha = 1; P.slide = null;
    const list = typeof def.ents === 'function' ? def.ents(W, U.State) : (def.ents || []);
    list.filter(Boolean).forEach(o => W.spawn(o));
    // weather
    W.weather = [];
    if (def.snow) for (let i = 0; i < (def.snow === true ? 70 : def.snow); i++) W.weather.push({ x: U.rand(0, 340), y: U.rand(0, 260), s: U.rand(.25, .8), d: U.rand(0, 6.28), sz: Math.random() < .25 ? 2 : 1 });
    if (def.dust) for (let i = 0; i < 26; i++) W.weather.push({ x: U.rand(0, 340), y: U.rand(0, 260), s: U.rand(.05, .2), d: U.rand(0, 6.28), sz: 1, dust: true });
    if (def.area && run().areas[def.area]) run().areas[def.area].visited = true;
    run().room = id;
    W.encDist = 0; W.encNext = U.rand(240, 560);
    W.snapCam();
    W.playMusic();
    if (def.load) def.load(W, U.State);
  };
  W.playMusic = function () {
    const def = W.room; if (!def) return;
    let m = typeof def.music === 'function' ? def.music(U.State) : def.music;
    if (m === undefined) return;
    const silent = def.area && U.State.exhausted(def.area) && U.State.genocideTrack();
    if (silent) m = 'empty';
    U.canvas.style.filter = silent ? 'saturate(0.35) contrast(1.05)' : '';
    if (m) U.Audio.music(m, def.musicOpts); else U.Audio.stopMusic(.6);
  };
  // fade, load, fade back (as a command, for scripts)
  W.goCmd = function (id, at, dir, opts) {
    opts = opts || {};
    return U.cmd.gen((function* () {
      W.trans = true;
      if (!opts.instant) { U.Audio.sfx(opts.sfx || 'door'); yield U.FX.fadeTo(1, opts.frames || 12); }
      W.load(id, at, dir);
      if (opts.after) opts.after(W);
      yield 2;
      yield U.FX.fadeTo(0, opts.frames || 12);
      W.trans = false;
      const def = W.room;
      if (def.enter) yield* def.enter(W, U.State);
    })());
  };
  W.go = (id, at, dir, opts) => U.Script.run((function* () { yield W.goCmd(id, at, dir, opts); })());

  W.locked = () => (U.Script.busy && !W.freeMove) || U.Dlg.active || (U.Menus && U.Menus.active) || W.trans || U.scene !== W;

  // ---------------- collision ----------------
  W.tileAt = (px, py) => { const tx = Math.floor(px / TS), ty = Math.floor(py / TS); if (tx < 0 || ty < 0 || tx >= W.room.w || ty >= W.room.h) return ' '; return W.mapRows[ty][tx]; };
  W.tileKey = (px, py) => U.Tiles.tileOf(W.room.tileset, W.tileAt(px, py));
  W.solidTile = (px, py) => U.Tiles.solid(W.room.tileset, W.tileAt(px, py));
  W.entBox = e => { const [w, h] = e.solid; return { x: e.x - w / 2, y: e.y - h, w, h }; };
  W.blocked = function (x, y, w, h, self) {
    // tiles
    const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - .01) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - .01) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= W.room.w || ty >= W.room.h) return true;
      if (U.Tiles.solid(W.room.tileset, W.mapRows[ty][tx])) return true;
    }
    if (W.room.walls) for (const b of W.room.walls) if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return true;
    for (const e of W.ents) {
      if (e === self || !e.solid || e.ghost || e === W.player) continue;
      if (e.blocks && !e.blocks(e)) continue;
      const b = W.entBox(e);
      if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return e;
    }
    return false;
  };
  const PW = 10, PH = 6;
  W.pBox = (x, y) => ({ x: x - PW / 2, y: y - PH, w: PW, h: PH });

  // ---------------- player ----------------
  function movePlayer() {
    const P = W.player, I = U.Input;
    // ice sliding
    if (P.slide) {
      const nx = P.x + P.slide.x * 2.5, ny = P.y + P.slide.y * 2.5;
      const b = W.pBox(nx, ny);
      if (W.blocked(b.x, b.y, b.w, b.h, P)) { P.slide = null; }
      else {
        P.x = nx; P.y = ny;
        const key = W.tileKey(P.x, P.y - 3);
        if (key !== 'ice') P.slide = null;
      }
      P.frame = 0;
      if (W.room.onMove) W.room.onMove(W, P);
      return 0;
    }
    const ax = I.axis();
    let moved = 0;
    if (ax.x || ax.y) {
      const sp = I.down.cancel ? 2.2 : 1.5;
      let dx = ax.x * sp, dy = ax.y * sp;
      if (ax.x && ax.y) { dx *= .78; dy *= .78; }
      // direction
      if (ax.y && !ax.x) P.dir = ax.y < 0 ? 'up' : 'down';
      else if (ax.x && !ax.y) P.dir = ax.x < 0 ? 'left' : 'right';
      else { const v = ax.y < 0 ? 'up' : 'down', h = ax.x < 0 ? 'left' : 'right'; if (P.dir !== v && P.dir !== h) P.dir = h; }
      const ox = P.x, oy = P.y;
      if (dx) {
        let b = W.pBox(P.x + dx, P.y);
        if (!W.blocked(b.x, b.y, b.w, b.h, P)) P.x += dx;
        else if (!dy) { for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { b = W.pBox(P.x + dx, P.y + n); const b2 = W.pBox(P.x, P.y + n); if (!W.blocked(b.x, b.y, b.w, b.h, P) && !W.blocked(b2.x, b2.y, b2.w, b2.h, P)) { P.y += Math.sign(n) * Math.min(1, Math.abs(n)); break; } } }
      }
      if (dy) {
        let b = W.pBox(P.x, P.y + dy);
        const hit = W.blocked(b.x, b.y, b.w, b.h, P);
        if (!hit) P.y += dy;
        else {
          if (hit && hit.push && typeof hit === 'object') hit.push(hit, 0, Math.sign(dy), W);
          if (!dx) for (const n of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { b = W.pBox(P.x + n, P.y + dy); const b2 = W.pBox(P.x + n, P.y); if (!W.blocked(b.x, b.y, b.w, b.h, P) && !W.blocked(b2.x, b2.y, b2.w, b2.h, P)) { P.x += Math.sign(n) * Math.min(1, Math.abs(n)); break; } }
        }
      }
      if (dx) { const b = W.pBox(P.x + dx, P.y); const hit = W.blocked(b.x, b.y, b.w, b.h, P); if (hit && typeof hit === 'object' && hit.push) hit.push(hit, Math.sign(dx), 0, W); }
      moved = Math.hypot(P.x - ox, P.y - oy);
      P.anim += moved * .09;
      P.frame = [1, 0, 2, 0][Math.floor(P.anim) % 4];
      // start sliding on ice
      if (moved > 0 && W.tileKey(P.x, P.y - 3) === 'ice') {
        P.slide = Math.abs(ax.x) >= Math.abs(ax.y) && ax.x ? { x: ax.x, y: 0 } : { x: 0, y: ax.y };
        U.Audio.sfx('slide');
      }
    } else { P.frame = 0; P.anim = 0; }
    if (moved && W.room.onMove) W.room.onMove(W, P);
    return moved;
  }
  function checkExits() {
    const P = W.player, b = W.pBox(P.x, P.y);
    for (const ex of (W.room.exits || [])) {
      if (ex.when && !ex.when(U.State)) continue;
      const r = { x: ex.x * TS, y: ex.y * TS, w: (ex.w || 1) * TS, h: (ex.h || 1) * TS };
      if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) {
        if (ex.run) { U.Script.run(ex.run(W, U.State)); return true; }
        W.go(ex.to, ex.at, ex.dir, { sfx: ex.sfx || 'step' });
        return true;
      }
    }
    return false;
  }
  function checkTriggers() {
    const P = W.player, b = W.pBox(P.x, P.y);
    for (const e of W.ents) {
      if (e.kind !== 'trigger' || e.done) continue;
      if (e.once && U.State.flag(e.once)) continue;
      if (e.when && !e.when(U.State, W)) continue;
      const r = { x: e.tx * TS, y: e.ty * TS, w: (e.tw || 1) * TS, h: (e.th || 1) * TS };
      if (b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y) {
        if (e.once) U.State.flag(e.once, true);
        if (!e.repeat) e.done = true;
        U.Script.run(e.run(W, U.State, e));
        return true;
      }
    }
    return false;
  }
  function interact() {
    const P = W.player;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[P.dir];
    const px = P.x + d[0] * 11, py = P.y - 3 + d[1] * 11;
    let best = null, bd = 1e9;
    for (const e of W.ents) {
      if (e === P || !(e.talk || e.kind === 'save' || e.kind === 'item' || e.kind === 'sign' || e.kind === 'door')) continue;
      if (e.hidden) continue;
      let bx, by, bw, bh;
      if (e.ibox) { bx = e.x + e.ibox[0]; by = e.y + e.ibox[1]; bw = e.ibox[2]; bh = e.ibox[3]; }
      else if (e.solid) { const b = W.entBox(e); bx = b.x - 3; by = b.y - 6; bw = b.w + 6; bh = b.h + 9; }
      else { bx = e.x - 8; by = e.y - 12; bw = 16; bh = 14; }
      if (px >= bx && px <= bx + bw && py >= by && py <= by + bh) {
        const dd = U.dist(px, py, e.x, e.y); if (dd < bd) { bd = dd; best = e; }
      }
    }
    if (!best) return false;
    if (best.kind === 'npc' && best.faceOnTalk !== false) best.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[P.dir];
    if (best.talk) U.Script.run(best.talk(W, U.State, best));
    else if (best.kind === 'save') U.Script.run(W.saveScript(best));
    else if (best.kind === 'item') U.Script.run(W.itemScript(best));
    else if (best.kind === 'sign') U.Script.run((function* () { yield U.Dlg.say('sign', ...(typeof best.text === 'function' ? best.text(U.State) : best.text)); })());
    else if (best.kind === 'door') { if (best.locked && best.locked(U.State)) U.Script.run((function* () { yield U.Dlg.say('narr', ...best.lockedText); })()); else W.go(best.to, best.at, best.dir); }
    return true;
  }

  // ---------------- built-in scripts ----------------
  W.saveScript = function* (e) {
    U.Audio.sfx('heal');
    U.State.fullHeal();
    const area = W.room.area;
    let lines = typeof e.text === 'function' ? e.text(U.State) : e.text;
    if (U.State.genocideTrack() && area && U.State.run.kills > 0) {
      const left = U.State.remaining(area);
      lines = [left > 0 ? '{r}' + left + ' left.' : '{r}Determination is a strange word for this.'];
      if (left <= 0) lines = ['{r}...'];
    }
    yield U.Dlg.say('narr', ...(lines || ['(The quiet light makes you feel REAL.)', 'HP fully restored.']));
    const r = yield U.Menus.saveMenu(e.label || W.room.name);
    if (r === 'saved') U.State.save(W.id, W.player.x, W.player.y, e.label || W.room.name);
  };
  W.itemScript = function* (e) {
    const it = U.Items[e.item];
    if (!U.State.give(e.item)) { yield U.Dlg.say('narr', 'You are carrying too much to take the ' + it.name + '.'); return; }
    U.Audio.sfx('item');
    if (e.flag) U.State.flag(e.flag, true);
    W.remove(e);
    yield U.Dlg.say('narr', ...(e.text || []), 'You got the {y}' + it.name + '{w}.');
  };

  // ---------------- encounters ----------------
  W.encounterGroup = function (area) {
    const A = U.Areas[area];
    const left = U.State.remaining(area);
    const fear = U.State.fearActive();
    let tbl = A.table.filter(t => !t.when || t.when(U.State));
    if (!tbl.length) return null;
    let tot = tbl.reduce((a, t) => a + (t.w || 1), 0), r = Math.random() * tot, pick = tbl[0];
    for (const t of tbl) { r -= (t.w || 1); if (r <= 0) { pick = t; break; } }
    let g = pick.g.slice();
    if (g.length > left && left > 0) g = g.slice(0, left);
    return { enemies: g, fear };
  };
  W.encounter = function* () {
    const area = W.room.area;
    W.alertT = 26; U.Audio.sfx('alert');
    yield 24;
    if (U.State.remaining(area) <= 0) {
      U.State.area(area).emptied = true;
      yield U.Battle.start({ empty: true, area });
      if (W.room.afterEmpty) yield* W.room.afterEmpty(W, U.State);
      if (U.Hooks.afterEmpty) yield* U.Hooks.afterEmpty(W, area);
      return;
    }
    const g = W.encounterGroup(area);
    if (!g) return;
    yield U.Battle.start({ enemies: g.enemies, area });
  };
  U.Hooks = U.Hooks || {};

  // ---------------- update ----------------
  W.update = function () {
    W.t++;
    const P = W.player;
    if (W.alertT > 0) W.alertT--;
    for (const e of W.ents) { if (e.update) e.update(e, W); if (e.walking) { e.anim += .12; e.frame = [1, 0, 2, 0][Math.floor(e.anim) % 4]; } }
    if (W.room.update) W.room.update(W, U.State);
    W.parts.update();
    if (W.freeMove && !W.locked()) { movePlayer(); }
    else if (!W.locked()) {
      const I = U.Input;
      if (I.pressed.pause) { U.Menus.openPause(); }
      else if (I.pressed.menu && !P.slide) { U.Menus.openField(); }
      else if (I.pressed.confirm && !P.slide && interact()) { /* */ }
      else {
        const moved = movePlayer();
        if (!checkExits() && !checkTriggers() && moved && W.room.enc && W.room.area && !P.slide) {
          const A = U.State.area(W.room.area);
          if (!(A.emptied && U.State.remaining(W.room.area) <= 0)) {
            W.encDist += moved;
            if (W.encDist > W.encNext && !U.params.has('noenc')) { W.encDist = 0; W.encNext = U.rand(260, 620); U.Script.run(W.encounter()); }
          }
        }
      }
    } else if (P.slide && !U.Dlg.active) movePlayer();
    else { if (!P.scripted) { P.frame = P.walking ? P.frame : 0; } }
    // camera
    W.updateCam();
    // weather
    for (const f of W.weather) {
      if (f.dust) { f.x += Math.cos(f.d + W.t * .01) * f.s; f.y -= f.s * .6; }
      else { f.y += f.s * (W.room.snowSpeed || 1); f.x += Math.sin(f.d + W.t * .02) * .25; }
      if (f.y > 250) { f.y = -5; f.x = U.rand(0, 340); } if (f.y < -6) { f.y = 248; f.x = U.rand(0, 340); }
      if (f.x > 335) f.x = -5; if (f.x < -6) f.x = 334;
    }
  };
  W.updateCam = function () {
    const P = W.player, R = W.room;
    let tx, ty;
    if (W.camLock) { tx = W.camLock.x - U.W / 2; ty = W.camLock.y - U.H / 2; }
    else { tx = P.x - U.W / 2; ty = P.y - 8 - U.H / 2; }
    const mw = R.w * TS, mh = R.h * TS;
    tx = mw <= U.W ? (mw - U.W) / 2 : U.clamp(tx, 0, mw - U.W);
    ty = mh <= U.H ? (mh - U.H) / 2 : U.clamp(ty, 0, mh - U.H);
    if (W.camLock && W.camLock.ease) { W.cam.x = U.lerp(W.cam.x, tx, W.camLock.ease); W.cam.y = U.lerp(W.cam.y, ty, W.camLock.ease); }
    else { W.cam.x = tx; W.cam.y = ty; }
  };
  W.snapCam = function () { const l = W.camLock; if (l) l.ease = 0; W.updateCam(); if (l) l.ease = .08; };

  // ---------------- drawing ----------------
  function drawEnt(ctx, e, cx, cy) {
    if (!e.visible) return;
    const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
    if (e.alpha < 1) ctx.globalAlpha = Math.max(0, e.alpha);
    if (e.draw) e.draw(ctx, e, x, y, W);
    else if (e === W.player) drawPlayer(ctx, e, x, y);
    else if (e.kind === 'npc') {
      if (e.char === 'sun') {
        const bob = Math.round(Math.sin(W.t * .06 + e.uid) * 2);
        U.Art.shadow(ctx, x, y, 5, .25);
        const spr = U.Chars.sunFrame(false, e.expr || 'happy', Math.floor(W.t / 8) % 6);
        ctx.drawImage(spr, x - spr.width / 2, y - spr.height - 8 + bob - e.z);
      } else {
        if (!e.noShadow) U.Art.shadow(ctx, x, y, 6, .22);
        const spr = U.Chars.ow(e.char, e.dir, e.frame || 0);
        if (spr) ctx.drawImage(spr, x - Math.floor(spr.width / 2), y - spr.height + 1 - (e.z || 0) + (e.shakeT ? U.randi(-1, 1) : 0));
      }
    } else if (e.kind === 'save') U.Props.drawSave(ctx, x, y, W.t);
    else if (e.prop) {
      const spr = U.Props.sprite(e.prop, e.state);
      if (e.flat) ctx.drawImage(spr, x - Math.floor(spr.width / 2), y - spr.height + (e.flatOy || 2));
      else ctx.drawImage(spr, x - Math.floor(spr.width / 2), y - spr.height + 1 - (e.z || 0));
      const pd = U.Props.defs[e.prop]; if (pd && pd.anim && !e.noAnim) pd.anim(ctx, x, y, W.t, e);
    }
    if (e.after) e.after(ctx, e, x, y, W);
    if (e.emote) { U.Font.draw(ctx, e.emote, x, y - (e.emoteY || 34), '#fff', { align: 'center', shadow: '#000' }); }
    ctx.globalAlpha = 1;
  }
  function drawPlayer(ctx, P, x, y) {
    if (P.pose === 'lying') {
      const spr = U.Chars.you('down', 0, P.expr);
      ctx.save(); ctx.translate(x, y - 6); ctx.rotate(-Math.PI / 2); ctx.drawImage(spr, -spr.width / 2, -spr.height / 2); ctx.restore();
      return;
    }
    if (P.pose === 'hidden') return;
    U.Art.shadow(ctx, x, y, 5, .25);
    const spr = U.Chars.you(P.dir, P.frame, P.expr);
    ctx.drawImage(spr, x - Math.floor(spr.width / 2), y - spr.height + 1 - (P.z || 0));
    // HANDS (genocide only) float beside you, growing with every kill
    if (U.State.run && U.State.run.weapon === 'hands') {
      const k = U.clamp(1 + U.State.run.kills / 40, 1, 1.8);
      const bob = Math.sin(W.t * .08) * 1.5;
      const hl = U.Chars.hand(false, true), hr = U.Chars.hand(true, true);
      const hw = Math.round(hl.width * k), hh = Math.round(hl.height * k);
      ctx.drawImage(hl, Math.round(x - 10 - hw), Math.round(y - 14 - hh / 2 + bob - (P.z || 0)), hw, hh);
      ctx.drawImage(hr, Math.round(x + 10), Math.round(y - 14 - hh / 2 - bob - (P.z || 0)), hw, hh);
    }
  }
  W.draw = function (ctx) {
    const R = W.room;
    if (!R) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, U.W, U.H); return; }
    const cx = Math.round(W.cam.x - U.FX.ox), cy = Math.round(W.cam.y - U.FX.oy);
    ctx.fillStyle = R.bgCol || '#000'; ctx.fillRect(0, 0, U.W, U.H);
    ctx.drawImage(W.bg, -cx, -cy);
    for (const a of W.anim) if (a.tile.anim) a.tile.anim(ctx, a.x - cx, a.y - cy, W.t, a.info);
    if (R.drawUnder) R.drawUnder(ctx, cx, cy, W);
    const flat = W.ents.filter(e => e.flat && e.visible);
    flat.forEach(e => drawEnt(ctx, e, cx, cy));
    const list = W.ents.filter(e => !e.flat).sort((a, b) => (a.y + (a.zSort || 0)) - (b.y + (b.zSort || 0)));
    list.forEach(e => drawEnt(ctx, e, cx, cy));
    W.parts.draw(ctx, cx, cy);
    if (R.drawOver) R.drawOver(ctx, cx, cy, W);
    // darkness and lights
    const dark = typeof R.dark === 'function' ? R.dark(U.State, W) : R.dark;
    if (dark > 0) drawDark(ctx, dark, cx, cy);
    // weather
    if (W.weather.length) {
      ctx.fillStyle = R.dust ? 'rgba(180,200,255,0.5)' : '#ffffff';
      for (const f of W.weather) ctx.fillRect(Math.round(f.x - (cx * .2) % 340), Math.round(f.y), f.sz, f.sz);
    }
    if (W.alertT > 0) {
      const P = W.player; const x = Math.round(P.x - cx), y = Math.round(P.y - cy - 30);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 3, 11, 13); ctx.fillStyle = '#000'; ctx.fillRect(x - 4, y - 2, 9, 11);
      U.Font.draw(ctx, '!', x - 2, y, '#ff3838');
    }
  };
  let darkC = null;
  function drawDark(ctx, dark, cx, cy) {
    if (!darkC) darkC = U.mk(U.W, U.H);
    const g = darkC.g;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, U.W, U.H);
    g.fillStyle = 'rgba(0,0,0,' + dark + ')'; g.fillRect(0, 0, U.W, U.H);
    g.globalCompositeOperation = 'destination-out';
    const lights = [];
    const P = W.player;
    const pl = W.room.plight == null ? 34 : W.room.plight;
    if (pl > 0 && P.visible && P.pose !== 'hidden') lights.push({ x: P.x, y: P.y - 8, r: pl });
    for (const e of W.ents) if (e.light && e.visible && e !== P) { const L = typeof e.light === 'function' ? e.light(e, W) : e.light; if (L) lights.push({ x: e.x + (L.ox || 0), y: e.y + (L.oy || 0), r: L.r * (1 + Math.sin(W.t * .1 + e.uid) * .03), col: L.col }); }
    for (const a of W.anim) if (a.tile.light) lights.push({ x: a.x + 8, y: a.y + (a.tile.light.oy || 8), r: a.tile.light.r });
    if (W.extraLights) W.extraLights.forEach(l => lights.push(l));
    for (const L of lights) {
      const x = L.x - cx, y = L.y - cy;
      if (x < -L.r || y < -L.r || x > U.W + L.r || y > U.H + L.r) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, L.r);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.45, 'rgba(0,0,0,.9)'); gr.addColorStop(.75, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(Math.round(x), Math.round(y), L.r, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    ctx.drawImage(darkC, 0, 0);
    // coloured glows
    ctx.globalCompositeOperation = 'lighter';
    for (const L of lights) {
      if (!L.col) continue;
      const col = L.col === 'warm' ? 'rgba(255,160,60,0.16)' : L.col === 'green' ? 'rgba(80,255,140,0.12)' : L.col === 'sun' ? 'rgba(255,210,60,0.22)' : 'rgba(80,160,255,0.15)';
      const x = L.x - cx, y = L.y - cy, gr = ctx.createRadialGradient(x, y, 0, x, y, L.r * .8);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), L.r * .8, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------- cutscene helpers (commands) ----------------
  W.walk = function (e, tx, ty, speed, opts) {
    speed = speed || 1; opts = opts || {};
    return {
      start() { this.tx = tx != null ? tx : e.x; this.ty = ty != null ? ty : e.y; e.walking = !opts.float; e.scripted = true; },
      update() {
        const dx = this.tx - e.x, dy = this.ty - e.y, d = Math.hypot(dx, dy);
        if (d <= speed) { e.x = this.tx; e.y = this.ty; e.walking = false; e.frame = 0; e.scripted = false; if (opts.face) e.dir = opts.face; return true; }
        if (!opts.keepDir) { if (Math.abs(dx) > Math.abs(dy)) e.dir = dx < 0 ? 'left' : 'right'; else e.dir = dy < 0 ? 'up' : 'down'; }
        e.x += dx / d * speed; e.y += dy / d * speed;
        if (e === W.player) { e.anim += speed * .09; e.frame = [1, 0, 2, 0][Math.floor(e.anim) % 4]; }
        return false;
      },
    };
  };
  // walk in tile units, axis by axis (x first unless yFirst)
  W.walkTo = function* (e, tx, ty, speed, yFirst) {
    const px = tx * TS + 8, py = ty * TS + 14;
    if (yFirst) { yield W.walk(e, e.x, py, speed); yield W.walk(e, px, py, speed); }
    else { yield W.walk(e, px, e.y, speed); yield W.walk(e, px, py, speed); }
  };
  W.hop = function (e, h, frames) {
    return { t: 0, update() { this.t++; e.z = Math.sin(Math.PI * this.t / frames) * h; if (this.t >= frames) { e.z = 0; return true; } return false; } };
  };
  W.pan = function (x, y, ease) { W.camLock = { x, y, ease: ease || .08 }; return U.cmd.until(() => Math.abs(W.cam.x - U.clamp(x - U.W / 2, 0, Math.max(0, W.room.w * TS - U.W))) < 1 && Math.abs(W.cam.y - U.clamp(y - U.H / 2, 0, Math.max(0, W.room.h * TS - U.H))) < 1); };
  W.unpan = function () { W.camLock = { x: W.player.x, y: W.player.y - 8, ease: .1 }; return { t: 0, update() { W.camLock.x = W.player.x; W.camLock.y = W.player.y - 8; if (++this.t > 40) { W.camLock = null; return true; } return false; } }; };
  W.emote = function (e, ch, frames) { e.emote = ch; e.emoteY = e.char === 'sun' ? 30 : e === W.player ? 26 : 34; U.Audio.sfx(ch === '!' ? 'alert' : 'move'); return { t: frames || 30, update() { if (--this.t <= 0) { e.emote = null; return true; } return false; } }; };
  W.npc = (id, char, tx, ty, dir, extra) => W.spawn(Object.assign({ id, kind: 'npc', char, tx, ty, dir: dir || 'down' }, extra || {}));
})();
