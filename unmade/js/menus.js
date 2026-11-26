'use strict';
// ============================================================
//  Menus & non-world scenes: title, naming, prologue, settings,
//  pause, field menu, save, shop, game over, chapter end
// ============================================================
(function () {
  const F = U.Font, I = () => U.Input, A = () => U.Audio;
  const M = U.Menus = { stack: [] };
  Object.defineProperty(M, 'active', { get() { return M.stack.length > 0; } });
  M.push = o => { M.stack.push(o); o.f = U.frame; if (o.open) o.open(); return o; };
  M.pop = () => M.stack.pop();
  M.update = function () { const top = M.stack[M.stack.length - 1]; if (top && U.frame !== top.f) top.update(); };
  M.draw = function (ctx) { M.stack.forEach(o => o.draw(ctx)); };
  // wrap an overlay as a script command
  M.cmd = o => ({ start() { o.done = (v) => { M.stack = M.stack.filter(x => x !== o); this.value = v; this.fin = true; }; M.push(o); }, update() { return this.fin; } });

  function panel(ctx, x, y, w, h) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#000'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6); }
  M.panel = panel;
  function soulAt(ctx, x, y) { ctx.drawImage(U.Chars.soul(), x, y); }
  // generic vertical list navigation
  function nav(o, n) {
    if (I().tap('up')) { o.sel = (o.sel + n - 1) % n; A().sfx('move'); }
    if (I().tap('down')) { o.sel = (o.sel + 1) % n; A().sfx('move'); }
  }

  // ---------------- confirm ----------------
  M.confirm = function (lines, yes, no) {
    return M.cmd({
      sel: 1, update() { if (I().pressed.left || I().pressed.right) { this.sel = 1 - this.sel; A().sfx('move'); } if (I().pressed.confirm) { A().sfx('select'); this.done(this.sel === 0); } if (I().pressed.cancel) { A().sfx('back'); this.done(false); } },
      draw(ctx) {
        panel(ctx, 30, 70, 260, 96);
        lines.forEach((l, i) => F.draw(ctx, l, 160, 86 + i * 13, '#fff', { align: 'center' }));
        const opts = [yes || 'Yes', no || 'No'];
        opts.forEach((o, i) => { const x = 100 + i * 90; F.draw(ctx, o, x, 146, i === this.sel ? '#ffe23a' : '#fff'); if (i === this.sel) soulAt(ctx, x - 13, 145); });
      },
    });
  };

  // ---------------- settings ----------------
  const SPEEDS = ['Slow', 'Normal', 'Fast', 'Instant'];
  const TOUCH = ['auto', 'on', 'off'];
  M.settings = function (fromTitle) {
    return M.cmd({
      sel: 0, items() {
        const o = U.opts;
        const l = [
          ['Music Volume', Math.round(o.music * 10) + '/10', d => { o.music = U.clamp(Math.round(o.music * 10 + d) / 10, 0, 1); A().applyVolumes(); }],
          ['Sound Volume', Math.round(o.sfx * 10) + '/10', d => { o.sfx = U.clamp(Math.round(o.sfx * 10 + d) / 10, 0, 1); A().applyVolumes(); A().sfx('move'); }],
          ['Text Speed', SPEEDS[o.textSpeed], d => { o.textSpeed = (o.textSpeed + d + 4) % 4; }],
          ['Reduce Flashing', o.reduceFlash ? 'ON' : 'OFF', () => { o.reduceFlash = !o.reduceFlash; }],
          ['Reduce Screen Shake', o.reduceShake ? 'ON' : 'OFF', () => { o.reduceShake = !o.reduceShake; }],
          ['Touch Controls', o.touch.toUpperCase(), d => { o.touch = TOUCH[(TOUCH.indexOf(o.touch) + (d || 1) + 3) % 3]; U.Input.refreshTouch(); }],
          ['Fullscreen', document.fullscreenElement ? 'ON' : 'OFF', () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { /* */ } }],
        ];
        if (fromTitle) l.push(['Erase All Data', '', 'erase']);
        l.push(['Done', '', 'back']);
        return l;
      },
      update() {
        const items = this.items(); nav(this, items.length);
        const it = items[this.sel];
        if (typeof it[2] === 'function') {
          if (I().tap('left')) { it[2](-1); A().sfx('move'); U.saveOpts(); }
          if (I().tap('right')) { it[2](1); A().sfx('move'); U.saveOpts(); }
        }
        if (I().pressed.confirm) {
          A().sfx('select');
          if (it[2] === 'back') { U.saveOpts(); this.done(); return; }
          if (it[2] === 'erase') { U.Script.run(eraseFlow(this)); return; }
          it[2](1); U.saveOpts();
        }
        if (I().pressed.cancel) { A().sfx('back'); U.saveOpts(); this.done(); }
      },
      draw(ctx) {
        panel(ctx, 24, 18, 272, 204);
        F.draw(ctx, 'SETTINGS', 160, 30, '#fff', { align: 'center' });
        this.items().forEach((it, i) => {
          const y = 52 + i * 16, sel = i === this.sel;
          const col = it[2] === 'erase' ? (sel ? '#ff6060' : '#a03030') : sel ? '#ffe23a' : '#fff';
          F.draw(ctx, it[0], 54, y, col); F.draw(ctx, it[1], 270, y, col, { align: 'right' });
          if (sel) soulAt(ctx, 40, y - 1);
        });
        F.draw(ctx, 'LEFT/RIGHT to change  Z to toggle', 160, 206, '#6a6a6a', { align: 'center' });
      },
    });
  };
  function* eraseFlow(set) {
    const a = yield M.confirm(['Erase ALL UNMADE data?', 'Your save file and every', 'remembered timeline will be gone.', 'Settings are kept.']);
    if (!a) return;
    const b = yield M.confirm(['Are you completely sure?', 'This cannot be undone.'], 'Erase', 'Keep');
    if (!b) return;
    U.State.eraseAll();
    A().sfx('shatter');
    set.done();
    U.Title.start(true);
  }

  // ---------------- pause ----------------
  M.openPause = function () {
    A().sfx('select');
    U.Script.run((function* () {
      const o = { sel: 0, opts: ['Resume', 'Settings', 'Quit to Title'],
        update() { nav(this, 3); if (I().pressed.cancel || I().pressed.pause) { A().sfx('back'); this.done(null); } if (I().pressed.confirm) { A().sfx('select'); this.done(this.sel); } },
        draw(ctx) { panel(ctx, 100, 70, 120, 84); F.draw(ctx, 'PAUSED', 160, 82, '#fff', { align: 'center' }); this.opts.forEach((t, i) => { F.draw(ctx, t, 128, 102 + i * 16, i === this.sel ? '#ffe23a' : '#fff'); if (i === this.sel) soulAt(ctx, 114, 101 + i * 16); }); } };
      const r = yield M.cmd(o);
      if (r === 1) yield M.settings(false);
      if (r === 2) { const q = yield M.confirm(['Quit to the title screen?', 'Progress since your last', 'save will be lost.']); if (q) U.Title.start(); }
    })());
  };

  // ---------------- field menu (C) ----------------
  M.openField = function () {
    A().sfx('select');
    U.Script.run((function* () {
      const S = U.State, r = S.run;
      const main = { sel: 0, opts: ['ITEM', 'STAT'],
        update() { nav(this, 2); if (I().pressed.cancel || I().pressed.menu) { A().sfx('back'); this.done(null); } if (I().pressed.confirm) { if (this.sel === 0 && !r.items.length) { A().sfx('wrong'); return; } A().sfx('select'); this.done(this.sel); } },
        draw(ctx) { drawSide(ctx); panel(ctx, 8, 70, 74, 50); this.opts.forEach((t, i) => { F.draw(ctx, t, 34, 84 + i * 16, r.items.length || i ? '#fff' : '#6a6a6a'); if (i === this.sel) soulAt(ctx, 20, 83 + i * 16); }); } };
      function drawSide(ctx) {
        const top = U.World.player && U.World.player.y - U.World.cam.y < 90;
        panel(ctx, 8, top ? 170 : 8, 74, 58);
        const y0 = top ? 182 : 20;
        F.draw(ctx, r.name, 16, y0, '#fff');
        F.draw(ctx, 'LV ' + r.lv, 16, y0 + 12, '#fff'); F.draw(ctx, 'HP ' + r.hp + '/' + S.maxhp(), 16, y0 + 22, '#fff'); F.draw(ctx, 'G  ' + r.gold, 16, y0 + 32, '#fff');
      }
      while (true) {
        const c = yield M.cmd(main);
        if (c == null) return;
        if (c === 1) { yield M.cmd({ update() { if (I().pressed.cancel || I().pressed.confirm || I().pressed.menu) { A().sfx('back'); this.done(); } }, draw(ctx) { drawSide(ctx); drawStats(ctx); } }); continue; }
        // items
        const it = { sel: 0, update() {
          const n = r.items.length; if (!n) { this.done(null); return; } nav(this, n);
          if (I().pressed.cancel) { A().sfx('back'); this.done(null); }
          if (I().pressed.confirm) { A().sfx('select'); this.done(this.sel); }
        }, draw(ctx) { drawSide(ctx); panel(ctx, 88, 8, 224, 168); r.items.forEach((id, i) => { F.draw(ctx, U.Items[id].name, 112, 22 + i * 16, '#fff'); if (i === this.sel) soulAt(ctx, 98, 21 + i * 16); }); } };
        const idx = yield M.cmd(it);
        if (idx == null) continue;
        const sub = { sel: 0, update() { if (I().pressed.left) { this.sel = (this.sel + 2) % 3; A().sfx('move'); } if (I().pressed.right) { this.sel = (this.sel + 1) % 3; A().sfx('move'); } if (I().pressed.cancel) { A().sfx('back'); this.done(null); } if (I().pressed.confirm) { A().sfx('select'); this.done(this.sel); } },
          draw(ctx) { it.draw(ctx); ['USE', 'INFO', 'DROP'].forEach((t, i) => { const x = 112 + i * 64; F.draw(ctx, t, x, 154, i === this.sel ? '#ffe23a' : '#fff'); if (i === this.sel) soulAt(ctx, x - 13, 153); }); } };
        const act = yield M.cmd(sub);
        if (act == null) continue;
        const id = r.items[idx], item = U.Items[id];
        if (act === 0) { const lines = S.useItem(idx); yield U.Dlg.say('narr', ...lines); return; }
        if (act === 1) { const extra = item.type === 'food' ? ' Heals ' + item.heal + ' HP.' : item.type === 'weapon' ? ' Weapon AT ' + item.at + '.' : ' Armor DF ' + item.df + '.'; yield U.Dlg.say('narr', '"' + item.name + '" -' + extra + '\n' + item.desc); return; }
        if (act === 2) { S.removeAt(idx); yield U.Dlg.say('narr', id === 'hands' ? 'You try to drop the HANDS. They do not let go.' : 'You threw away the ' + item.name + '.'); if (id === 'hands') r.items.push('hands'); return; }
      }
      function drawStats(ctx) {
        panel(ctx, 88, 8, 224, 196);
        const x = 104;
        F.draw(ctx, '"' + r.name + '"', x, 22, '#fff');
        F.draw(ctx, 'LV  ' + r.lv, x, 46, '#fff'); F.draw(ctx, 'HP  ' + r.hp + ' / ' + S.maxhp(), x, 60, '#fff');
        F.draw(ctx, 'AT  ' + S.baseAT() + ' (' + S.weaponAT() + ')', x, 84, '#fff'); F.draw(ctx, 'EXP: ' + r.exp, x + 110, 84, '#fff');
        F.draw(ctx, 'DF  ' + S.baseDF() + ' (' + S.armorDF() + ')', x, 98, '#fff'); F.draw(ctx, 'NEXT: ' + S.nextExp(), x + 110, 98, '#fff');
        F.draw(ctx, 'FEET: ' + U.Items[r.weapon].name, x, 124, r.weapon === 'hands' ? '#ff6060' : '#fff');
        F.draw(ctx, 'ARMOR: ' + U.Items[r.armor].name, x, 138, '#fff');
        F.draw(ctx, 'GOLD: ' + r.gold, x, 162, '#fff');
        if (r.kills >= 20 && S.genocideTrack()) F.draw(ctx, 'KILLS: ' + r.kills, x + 110, 162, '#ff6060');
        F.draw(ctx, 'TIME: ' + U.fmtTime(r.time), x, 182, '#8a8a8a');
      }
    })());
  };

  // ---------------- save menu ----------------
  M.saveMenu = function (label) {
    return M.cmd({
      sel: 0, saved: false,
      update() {
        if (this.saved) { if (I().pressed.confirm || I().pressed.cancel) { this.done('saved'); } return; }
        if (I().pressed.left || I().pressed.right) { this.sel = 1 - this.sel; A().sfx('move'); }
        if (I().pressed.cancel) { A().sfx('back'); this.done('cancel'); }
        if (I().pressed.confirm) { if (this.sel === 0) { A().sfx('save'); this.saved = true; U.State.save(U.World.id, U.World.player.x, U.World.player.y, label); } else { A().sfx('back'); this.done('cancel'); } }
      },
      draw(ctx) {
        const r = U.State.run, col = this.saved ? '#ffe23a' : '#fff';
        panel(ctx, 40, 60, 240, 100);
        F.draw(ctx, r.name, 58, 76, col); F.draw(ctx, 'LV ' + r.lv, 150, 76, col); F.draw(ctx, U.fmtTime(r.time), 262, 76, col, { align: 'right' });
        F.draw(ctx, label || '', 58, 96, col);
        if (this.saved) F.draw(ctx, 'File saved.', 58, 132, col);
        else ['Save', 'Return'].forEach((t, i) => { const x = 74 + i * 110; F.draw(ctx, t, x, 132, i === this.sel ? '#ffe23a' : '#fff'); if (i === this.sel) soulAt(ctx, x - 13, 131); });
      },
    });
  };

  // ---------------- shop ----------------
  M.shop = function (def) {
    return M.cmd({
      level: 'main', sel: 0, msg: def.greet,
      update() {
        const r = U.State.run;
        if (this.level === 'main') {
          nav(this, 4);
          if (I().pressed.cancel) { this.done(); return; }
          if (I().pressed.confirm) { A().sfx('select'); if (this.sel === 0) { this.level = 'buy'; this.sel = 0; this.msg = def.buyMsg; } else if (this.sel === 1) { this.level = 'sell'; this.sel = 0; this.msg = r.items.length ? def.sellMsg : def.sellNone; if (!r.items.length) this.level = 'main'; } else if (this.sel === 2) { this.level = 'talk'; this.sel = 0; } else { this.done(); } }
          return;
        }
        if (this.level === 'buy') {
          const n = def.items.length + 1; nav(this, n);
          if (I().pressed.cancel || (I().pressed.confirm && this.sel === n - 1)) { A().sfx('back'); this.level = 'main'; this.sel = 0; this.msg = def.greet; return; }
          if (I().pressed.confirm) {
            const it = def.items[this.sel], item = U.Items[it.id];
            if (r.gold < it.price) { A().sfx('wrong'); this.msg = def.poor; return; }
            if (!U.State.give(it.id)) { A().sfx('wrong'); this.msg = def.full; return; }
            r.gold -= it.price; A().sfx('cash'); this.msg = def.thanks;
          }
          return;
        }
        if (this.level === 'sell') {
          const n = r.items.length + 1; nav(this, n);
          if (I().pressed.cancel || (I().pressed.confirm && this.sel >= n - 1)) { A().sfx('back'); this.level = 'main'; this.sel = 1; this.msg = def.greet; return; }
          if (I().pressed.confirm) {
            const id = r.items[this.sel], it = U.Items[id];
            if (id === 'hands' || !it.sell) { A().sfx('wrong'); this.msg = def.noBuy; return; }
            U.State.removeAt(this.sel); r.gold += it.sell; A().sfx('cash'); this.msg = def.sold;
            this.sel = Math.min(this.sel, r.items.length);
          }
          return;
        }
        if (this.level === 'talk') {
          const n = def.talk.length + 1; nav(this, n);
          if (I().pressed.cancel || (I().pressed.confirm && this.sel === n - 1)) { A().sfx('back'); this.level = 'main'; this.sel = 2; this.msg = def.greet; return; }
          if (I().pressed.confirm) { A().sfx('select'); this.msg = def.talk[this.sel][1]; }
        }
      },
      draw(ctx) {
        const r = U.State.run;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
        if (def.drawBg) def.drawBg(ctx);
        panel(ctx, 4, 136, 312, 100);
        // message
        const t = new U.Typer(this.msg || '', { maxChars: 30, bullet: true }); t.skip(); t.draw(ctx, 16, 150);
        ctx.fillStyle = '#fff'; ctx.fillRect(204, 136, 3, 100);
        const x = 222;
        let opts;
        if (this.level === 'main') opts = ['Buy', 'Sell', 'Talk', 'Exit'];
        else if (this.level === 'buy') opts = def.items.map(it => it.price + 'G ' + U.Items[it.id].name).concat(['Back']);
        else if (this.level === 'sell') opts = r.items.map(id => (U.Items[id].sell || 0) + 'G ' + U.Items[id].name).concat(['Back']);
        else opts = def.talk.map(t => t[0]).concat(['Back']);
        if (this.level === 'buy' || this.level === 'sell' || this.level === 'talk') {
          panel(ctx, 4, 136, 204, 100);
          opts.forEach((o, i) => { F.draw(ctx, o.slice(0, 28), 30, 148 + i * 13, i === this.sel ? '#ffe23a' : '#fff'); if (i === this.sel) soulAt(ctx, 16, 147 + i * 13); });
          const tt = new U.Typer(this.msg || '', { maxChars: 15, bullet: false }); tt.skip(); tt.draw(ctx, 218, 150);
          if (this.level === 'buy' && this.sel < def.items.length) { const it = U.Items[def.items[this.sel].id]; F.draw(ctx, it.type === 'food' ? 'Heals ' + it.heal + 'HP' : it.type === 'weapon' ? 'AT ' + it.at : 'DF ' + it.df, 218, 202, '#8a8a8a'); }
        } else opts.forEach((o, i) => { F.draw(ctx, o, x + 14, 152 + i * 16, '#fff'); if (i === this.sel) soulAt(ctx, x, 151 + i * 16); });
        F.draw(ctx, r.gold + 'G', 306, 224, '#fff', { align: 'right' });
        F.draw(ctx, r.items.length + '/' + U.State.MAX_ITEMS, 230, 224, '#8a8a8a');
      },
    });
  };

  // =====================================================================
  //  TITLE
  // =====================================================================
  const T = U.Title = {};
  T.start = function (fresh) {
    U.Script.stop(); M.stack.length = 0; U.Dlg.active = false;
    U.FX.fade = 0; U.FX.tint = null; U.canvas.style.filter = '';
    U.State.loadMeta();
    U.scene = T;
    T.t = 0; T.sel = 0; T.splash = !T.unlocked; T.msg = null; T.parts = [];
    for (let i = 0; i < 40; i++) T.parts.push({ x: U.rand(0, 320), y: U.rand(0, 240), s: U.rand(.1, .4) });
    const meta = U.State.meta;
    T.creatorMsg = null;
    if (meta.resets > 0 && Math.random() < .35) {
      T.creatorMsg = U.choose(['YOU KEEP COMING BACK. GOOD.', 'THE HATCH WAS NEVER LOCKED.', 'INSTANCE ' + (meta.resets + 1) + '. CONTINUE OBSERVATION.', 'DO YOU REMEMBER THE WORKSHOP?', 'IT WAS NEVER AN ACCIDENT.', 'YOU ARE NOT THE FIRST DRAFT.']);
    }
    if (!T.splash) A().music('title');
  };
  T.options = function () {
    const has = U.State.hasSave();
    const o = [];
    if (has) o.push(['CONTINUE', 'continue'], ['RESET', 'reset']); else o.push(['NEW GAME', 'new']);
    o.push(['SETTINGS', 'settings']);
    return o;
  };
  T.update = function () {
    T.t++;
    for (const p of T.parts) { p.y -= p.s; if (p.y < -2) { p.y = 242; p.x = U.rand(0, 320); } }
    if (M.active || U.Script.busy) return;
    if (T.splash) { if (I().anyPressed) { T.splash = false; T.unlocked = true; A().unlock(); A().music('title'); A().sfx('select'); I().eat(); } return; }
    const o = T.options();
    if (I().tap('up')) { T.sel = (T.sel + o.length - 1) % o.length; A().sfx('move'); }
    if (I().tap('down')) { T.sel = (T.sel + 1) % o.length; A().sfx('move'); }
    T.sel = U.clamp(T.sel, 0, o.length - 1);
    if (I().pressed.confirm) {
      A().sfx('select');
      const id = o[T.sel][1];
      if (id === 'continue') U.Game.continueGame();
      else if (id === 'new') U.Naming.start();
      else if (id === 'settings') U.Script.run((function* () { yield M.settings(true); })());
      else if (id === 'reset') U.Script.run((function* () {
        const ok = yield M.confirm(['RESET the story?', 'Your save file will be erased', 'and the story starts over.', '(Some things may remember.)'], 'Reset', 'Back');
        if (ok) U.Game.resetGame();
      })());
    }
  };
  T.draw = function (ctx) {
    const meta = U.State.meta;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
    const geno = meta.lastRoute === 'genocide';
    for (const p of T.parts) { ctx.fillStyle = geno ? 'rgba(255,80,80,0.5)' : 'rgba(170,190,255,0.45)'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    // logo
    const glitch = T.t % 240 < 6 || (geno && T.t % 90 < 3);
    const lx = 160, ly = 58;
    if (glitch) { F.draw(ctx, 'UNMADE', lx + U.randi(-3, 3), ly, '#ff2a5a', { align: 'center', scale: 5 }); F.draw(ctx, 'UNMADE', lx + U.randi(-3, 3), ly, '#2affd0', { align: 'center', scale: 5 }); }
    F.draw(ctx, 'UNMADE', lx, ly, geno ? '#ffd0d0' : '#ffffff', { align: 'center', scale: 5 });
    // a crack through the logo
    ctx.fillStyle = '#000'; ctx.fillRect(lx + 30, ly - 2, 2, 12); ctx.fillRect(lx + 32, ly + 10, 2, 10); ctx.fillRect(lx + 30, ly + 20, 2, 18);
    // protagonist
    const you = U.Chars.you('down', (T.t >> 4) % 3 === 1 ? 0 : 0);
    ctx.drawImage(you, 160 - you.width, 104, you.width * 2, you.height * 2);
    if (geno) { const hl = U.Chars.hand(false, true), hr = U.Chars.hand(true, true); const b = Math.sin(T.t * .05) * 2; ctx.drawImage(hl, 132, 108 + b, 16, 16); ctx.drawImage(hr, 172, 108 - b, 16, 16); }
    if (T.splash) {
      if ((T.t >> 5) % 2 === 0) F.draw(ctx, 'PRESS Z OR TAP TO START', 160, 168, '#fff', { align: 'center' });
      F.draw(ctx, 'ARROWS/WASD move   Z confirm   X cancel   C menu', 160, 222, '#5a5a5a', { align: 'center' });
      return;
    }
    const o = T.options();
    o.forEach(([t], i) => { const y = 150 + i * 16; F.draw(ctx, t, 160, y, i === T.sel ? '#ffe23a' : '#fff', { align: 'center' }); if (i === T.sel) ctx.drawImage(U.Chars.soul(), 160 - F.width(t) / 2 - 15, y - 1); });
    const info = U.State.saveInfo();
    if (info) F.draw(ctx, info.name + '  LV ' + info.lv + '  ' + U.fmtTime(info.time) + '  ' + (info.saveLabel || ''), 160, 132, '#9a9a9a', { align: 'center' });
    if (T.creatorMsg && T.t > 120 && T.t < 400) {
      ctx.globalAlpha = Math.min(1, (T.t - 120) / 60) * Math.min(1, (400 - T.t) / 60) * .7;
      F.draw(ctx, T.creatorMsg, 160, 214, '#b8b8c8', { align: 'center', creator: .5 });
      ctx.globalAlpha = 1;
    }
    F.draw(ctx, 'v1.0  Chapter 1', 4, 230, '#3a3a3a');
  };

  // =====================================================================
  //  NAMING
  // =====================================================================
  const N = U.Naming = {};
  const ROWS = ['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'VWXYZ', 'abcdefg', 'hijklmn', 'opqrstu', 'vwxyz'];
  N.start = function () { U.scene = N; N.name = ''; N.r = 0; N.c = 0; N.confirm = null; N.t = 0; U.Input.textMode = true; U.Input.typed.length = 0; A().music('workshop'); };
  N.cells = function () { const out = []; ROWS.forEach((row, r) => { for (let c = 0; c < row.length; c++) out.push({ ch: row[c], r, c, x: 52 + c * 34, y: 64 + r * 16 }); }); [['Quit', 'quit'], ['Backspace', 'bs'], ['Done', 'done']].forEach(([t, id], i) => out.push({ ch: t, id, r: ROWS.length, c: i * 2, x: 52 + i * 84, y: 204 })); return out; };
  const SPECIAL = {
    SUN: ['That name is taken.', false], KILO: ['...', false], CREATOR: ['No.', false], CALIA: ['Find your own name.', true], SUPERKENDAL: ['KENDAL-TASTIC!!', true],
    FUNNYGUYDEV: ['nah.', false], CATTY: ['Ten coins says you regret this.', true], HANDS: ['You do not have any.', true], BLANK: ['A fitting name.', true],
  };
  N.finish = function () {
    const nm = N.name.trim() || 'BLANK'; N.name = nm;
    const sp = SPECIAL[nm.toUpperCase()];
    N.confirm = { sel: 0, msg: sp ? sp[0] : 'Is this name correct?', ok: sp ? sp[1] : true };
    U.Input.textMode = false; U.Input.typed.length = 0;
    A().sfx('select');
  };
  N.update = function () {
    N.t++;
    if (N.confirm) {
      const c = N.confirm;
      if (I().pressed.left || I().pressed.right) { c.sel = 1 - c.sel; A().sfx('move'); }
      if (I().pressed.cancel) { N.confirm = null; U.Input.textMode = true; A().sfx('back'); return; }
      if (I().pressed.confirm) {
        if (c.sel === 1 || !c.ok) { N.confirm = null; U.Input.textMode = true; A().sfx('back'); return; }
        A().sfx('save'); U.Input.textMode = false; U.Game.newGame(N.name);
      }
      return;
    }
    // typed keys
    while (U.Input.typed.length) {
      const k = U.Input.typed.shift();
      if (k === '\b') N.name = N.name.slice(0, -1);
      else if (k === '\n') { N.finish(); return; }
      else if (/^[a-zA-Z]$/.test(k) && N.name.length < 8) { N.name += k; A().sfx('move'); }
    }
    const cells = N.cells();
    const rowCells = r => cells.filter(c => c.r === r);
    if (I().tap('up')) { N.r = (N.r + ROWS.length) % (ROWS.length + 1); A().sfx('move'); }
    if (I().tap('down')) { N.r = (N.r + 1) % (ROWS.length + 1); A().sfx('move'); }
    if (I().tap('left')) { const rc = rowCells(N.r); N.c = (rc.findIndex(c => c.c >= N.c) + rc.length - 1) % rc.length; N.c = rc[N.c].c; A().sfx('move'); }
    if (I().tap('right')) { const rc = rowCells(N.r); const i = rc.findIndex(c => c.c >= N.c); N.c = rc[(i + 1) % rc.length].c; A().sfx('move'); }
    let cur = rowCells(N.r).reduce((b, c) => Math.abs(c.c - N.c) < Math.abs(b.c - N.c) ? c : b);
    if (I().pressed.cancel) { N.name = N.name.slice(0, -1); A().sfx('back'); }
    if (I().pressed.confirm) {
      if (cur.id === 'quit') { U.Input.textMode = false; U.Title.start(); return; }
      if (cur.id === 'bs') { N.name = N.name.slice(0, -1); A().sfx('back'); return; }
      if (cur.id === 'done') { N.finish(); return; }
      if (N.name.length < 8) { N.name += cur.ch; A().sfx('select'); }
    }
  };
  N.draw = function (ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
    if (N.confirm) {
      const c = N.confirm;
      F.draw(ctx, c.msg, 160, 50, '#fff', { align: 'center' });
      const s = 2 + Math.min(2, N.t * 0); F.draw(ctx, N.name, 160 + U.randi(0, 0), 100, '#fff', { align: 'center', scale: 3, shake: c.ok ? 0 : 1 });
      const opts = c.ok ? ['Yes', 'No'] : ['Go back', 'Go back'];
      (c.ok ? opts : ['Go back']).forEach((o, i) => { const x = c.ok ? 100 + i * 100 : 130; F.draw(ctx, o, x, 170, (c.ok ? i === c.sel : true) ? '#ffe23a' : '#fff'); if (c.ok ? i === c.sel : true) ctx.drawImage(U.Chars.soul(), x - 13, 169); });
      return;
    }
    F.draw(ctx, 'NAME THE CREATION.', 160, 18, '#fff', { align: 'center' });
    F.draw(ctx, N.name + ((N.t >> 4) % 2 ? '_' : ' '), 160, 40, '#fff', { align: 'center', scale: 2 });
    const cells = N.cells();
    const curRow = cells.filter(c => c.r === N.r); const cur = curRow.reduce((b, c) => Math.abs(c.c - N.c) < Math.abs(b.c - N.c) ? c : b);
    for (const c of cells) {
      const on = c === cur;
      F.draw(ctx, c.ch, c.x + (on ? 0 : (U.hash(c.x, c.y, N.t >> 3) < .05 ? 1 : 0)), c.y, on ? '#ffe23a' : '#fff');
    }
  };

  // =====================================================================
  //  PROLOGUE (story slides)
  // =====================================================================
  const PR = U.Prologue = {};
  const SLIDES = [
    { text: 'Long ago, two peoples shared one universe:\nHUMANS and MONSTERS.', art: 'peace' },
    { text: 'One day, a war broke out between them.', art: 'war' },
    { text: 'The humans won. With a great spell, they sealed the monsters away in a distant pocket of space.', art: 'seal' },
    { text: "Deep inside the King's palace, a barrier still holds them there.\nThey call it the SOURCE WALL.", art: 'wall' },
    { text: 'Many years later, somewhere very far away...', art: 'window' },
    { text: '...someone was building a machine.', art: 'machine' },
  ];
  function slideArt(id) {
    return U.Art.cached('slide|' + id, () => {
      const p = new U.Pix(200, 110), g = p.g;
      const sky = (c1, c2) => { for (let y = 0; y < 110; y++) { p.hl(0, 199, y, y < 60 ? c1 : c2); } };
      const human = (x, y, col) => { p.circle(x, y - 14, 3, col); p.rect(x - 2, y - 11, 5, 7, col); p.vl(x - 1, y - 4, y, col); p.vl(x + 1, y - 4, y, col); p.line(x - 2, y - 10, x - 5, y - 6, col); p.line(x + 2, y - 10, x + 5, y - 6, col); };
      const monster = (x, y, col) => { p.ellipse(x, y - 9, 6, 8, col); p.tri(x - 6, y - 14, x - 4, y - 22, x - 2, y - 15, col); p.tri(x + 2, y - 15, x + 4, y - 22, x + 6, y - 14, col); p.px(x - 2, y - 11, '#000'); p.px(x + 2, y - 11, '#000'); };
      if (id === 'peace') { sky('#2a3a6a', '#1a2a4a'); p.circle(160, 26, 12, '#ffe08a'); p.ellipse(100, 120, 130, 40, '#1e3a2a'); human(80, 86, '#d8d8e8'); monster(118, 86, '#b8c8e8'); human(60, 90, '#a8a8b8'); monster(140, 90, '#8898b8'); }
      else if (id === 'war') { sky('#5a1a1a', '#2a0a0a'); p.ellipse(100, 120, 130, 40, '#1a0808'); for (let i = 0; i < 4; i++) human(30 + i * 16, 90, '#e8c8c8'); for (let i = 0; i < 4; i++) monster(118 + i * 18, 90, '#c8a8a8'); for (let i = 0; i < 10; i++) p.line(90 + U.hash(i, 1) * 20, 40 + U.hash(i, 2) * 40, 95 + U.hash(i, 3) * 20, 45 + U.hash(i, 4) * 40, '#ffd08a'); }
      else if (id === 'seal') { sky('#0a0a1a', '#0a0a1a'); for (let r = 46; r > 2; r -= 6) { p.circle(100, 55, r, r % 12 ? '#2a1a5a' : '#4a3a8a'); } p.circle(100, 55, 6, '#000'); for (let i = 0; i < 6; i++) { const a = i + .5; monster(100 + Math.cos(a) * (14 + i * 4), 60 + Math.sin(a) * (10 + i * 3), '#8a8aba'); } }
      else if (id === 'wall') { sky('#120a2a', '#0a0618'); p.rect(70, 40, 60, 60, '#2a2244'); p.tri(64, 42, 100, 10, 136, 42, '#3a3058'); p.rect(60, 50, 10, 50, '#2a2244'); p.rect(130, 50, 10, 50, '#2a2244'); p.tri(58, 52, 65, 34, 72, 52, '#3a3058'); p.tri(128, 52, 135, 34, 142, 52, '#3a3058'); for (let x = 0; x < 200; x += 3) p.vl(x, 0, 110, x % 9 ? null : '#4a6aff'); p.rect(94, 74, 12, 26, '#ffe08a'); }
      else if (id === 'window') { sky('#000', '#000'); p.rect(86, 40, 28, 22, '#3a3a2a'); p.rect(88, 42, 24, 18, '#ffe08a'); p.vl(100, 42, 59, '#3a3a2a'); p.hl(88, 111, 51, '#3a3a2a'); p.rect(30, 62, 140, 48, '#0a0a0a'); }
      else if (id === 'machine') { sky('#141418', '#1e1e24'); const m = U.Props.sprite('machine'); g.drawImage(m, 68, 30); const y = U.Chars.you('left', 0); g.drawImage(y, 150, 78); p.circle(100, 62, 3, '#9ad8ff'); }
      return p.c;
    });
  }
  PR.start = function () { U.scene = PR; PR.i = 0; PR.t = 0; PR.typer = new U.Typer(SLIDES[0].text, { maxChars: 40, voice: 'narr' }); A().music('title', { rate: .85 }); U.FX.fade = 0; };
  PR.update = function () {
    PR.t++;
    PR.typer.update();
    if (I().pressed.menu) { PR.finish(); return; }
    if (I().pressed.confirm || (PR.typer.done && PR.t > 300)) {
      if (!PR.typer.done) { PR.typer.skip(); return; }
      PR.i++; PR.t = 0;
      if (PR.i >= SLIDES.length) { PR.finish(); return; }
      PR.typer = new U.Typer(SLIDES[PR.i].text, { maxChars: 40, voice: 'narr' });
    }
  };
  PR.finish = function () { U.Script.run((function* () { yield U.FX.fadeTo(1, 30); U.Game.enterWorkshop(); yield U.FX.fadeTo(0, 30); })()); PR.update = () => {}; };
  PR.draw = function (ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
    const s = SLIDES[Math.min(PR.i, SLIDES.length - 1)];
    const art = slideArt(s.art);
    const a = Math.min(1, PR.t / 30);
    ctx.globalAlpha = a; ctx.drawImage(art, 60, 18); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff'; ctx.strokeRect(59.5, 17.5, 201, 111);
    PR.typer.draw(ctx, 40, 146);
    F.draw(ctx, 'C: skip', 316, 230, '#3a3a3a', { align: 'right' });
  };

  // =====================================================================
  //  GAME OVER
  // =====================================================================
  const GO = U.GameOver = {};
  GO.start = function (x, y, text) {
    U.Script.stop(); M.stack.length = 0; U.Dlg.active = false;
    U.scene = GO; GO.t = 0; GO.x = x; GO.y = y; GO.shards = null; GO.typer = null;
    const S = U.State;
    GO.lines = text || U.choose([
      ['...', "Don't stop here.", '$NAME. Get up.'],
      ["This isn't how it ends.", 'Not yet.'],
      ['You are not finished.', '$NAME, stay REAL.'],
      ['...', 'Try again.'],
    ]);
    GO.li = 0;
  };
  GO.update = function () {
    GO.t++;
    if (GO.t === 30) { A().sfx('crack'); }
    if (GO.t === 70) { A().sfx('shatter'); GO.shards = []; for (let i = 0; i < 7; i++) GO.shards.push({ x: GO.x, y: GO.y, vx: U.rand(-2, 2), vy: U.rand(-3, -1), r: U.rand(0, 6) }); }
    if (GO.shards) GO.shards.forEach(s => { s.x += s.vx; s.y += s.vy; s.vy += .12; s.r += .2; });
    if (GO.t === 140) A().music('gameover');
    if (GO.t >= 200) {
      if (!GO.typer) GO.typer = new U.Typer(GO.lines[0], { maxChars: 36, voice: 'creator', color: '#c8c8d8' });
      GO.typer.update();
      if (I().pressed.confirm) {
        if (!GO.typer.done) GO.typer.skip();
        else if (++GO.li < GO.lines.length) GO.typer = new U.Typer(GO.lines[GO.li], { maxChars: 36, voice: 'creator', color: '#c8c8d8' });
        else { GO.update = () => {}; U.Script.run((function* () { yield U.FX.fadeTo(1, 40); A().stopMusic(.5); U.Game.retry(); yield U.FX.fadeTo(0, 20); })()); }
      }
    }
  };
  GO.draw = function (ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
    const soul = U.Chars.soul();
    if (GO.t < 70) {
      ctx.drawImage(soul, Math.round(GO.x - 4), Math.round(GO.y - 4));
      if (GO.t >= 30) { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(GO.x), Math.round(GO.y - 4), 1, 9); }
    } else if (GO.shards) {
      ctx.fillStyle = '#ff2424';
      GO.shards.forEach(s => { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.r); ctx.fillRect(-1, -2, 3, 4); ctx.restore(); });
    }
    if (GO.t > 140) {
      ctx.globalAlpha = Math.min(1, (GO.t - 140) / 50);
      F.draw(ctx, 'GAME', 160, 40, '#fff', { align: 'center', scale: 6 });
      F.draw(ctx, 'OVER', 160, 92, '#fff', { align: 'center', scale: 6 });
      ctx.globalAlpha = 1;
    }
    if (GO.typer) GO.typer.draw(ctx, 52, 170);
  };

  // =====================================================================
  //  CHAPTER END
  // =====================================================================
  const CE = U.ChapterEnd = {};
  const ROUTE_TEXT = {
    pacifist: ['Nobody has been hurt.', 'Yet.'],
    neutral: ["You've made some choices.", 'Some of them were kind.'],
    nomercy: ['Nobody you met is still standing.', 'You never looked back.'],
    genocide: ['There is nobody left.', 'Not here.'],
  };
  CE.start = function () {
    U.Script.stop(); M.stack.length = 0;
    const route = U.State.completeChapter(1);
    U.State.save(U.World.id, U.World.player.x, U.World.player.y, 'Frostwood - The Bridge');
    U.scene = CE; CE.t = 0; CE.route = route; U.FX.fade = 0;
    A().music(route === 'genocide' ? 'empty' : 'end');
    U.canvas.style.filter = '';
  };
  CE.update = function () { CE.t++; if (CE.t > 240 && I().pressed.confirm) { A().sfx('select'); U.Title.start(); } };
  CE.draw = function (ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 240);
    const r = U.State.run, a = k => Math.max(0, Math.min(1, (CE.t - k) / 40));
    ctx.globalAlpha = a(0); F.draw(ctx, 'CHAPTER 1', 160, 26, '#fff', { align: 'center', scale: 2 });
    F.draw(ctx, 'LANTERNS AND SNOW', 160, 50, '#9a9a9a', { align: 'center' });
    ctx.globalAlpha = a(60); F.draw(ctx, 'PATH SO FAR:', 160, 82, '#fff', { align: 'center' });
    const col = { pacifist: '#7fe0ff', neutral: '#ffffff', nomercy: '#ffb050', genocide: '#ff4040' }[CE.route];
    F.draw(ctx, U.State.ROUTES[CE.route], 160, 96, col, { align: 'center', scale: 2 });
    ROUTE_TEXT[CE.route].forEach((l, i) => F.draw(ctx, l, 160, 122 + i * 12, '#bbbbbb', { align: 'center' }));
    ctx.globalAlpha = a(140);
    F.draw(ctx, 'LV ' + r.lv + '   KILLS ' + r.kills + '   SPARES ' + r.spares + '   TIME ' + U.fmtTime(r.time), 160, 160, '#8a8a8a', { align: 'center' });
    F.draw(ctx, 'To be continued...', 160, 186, '#fff', { align: 'center' });
    ctx.globalAlpha = a(240) * ((CE.t >> 5) % 2 ? 1 : .5);
    F.draw(ctx, 'Your game was saved.  Press Z.', 160, 216, '#6a6a6a', { align: 'center' });
    ctx.globalAlpha = 1;
  };
})();
