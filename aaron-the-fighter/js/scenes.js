'use strict';
// ============================================================
//  Scenes: title/main menu, world map, act select, shop, options,
//  level select, extras, credits, game over
// ============================================================
(function () {
  const I = AF.Input;
  const ok = () => I.pressed.confirm || I.pressed.attack;
  const back = () => I.pressed.back;

  AF.ARTIFACTS = [
    ['THE VERDANT SEED', 'A seed that glows with life. Achmed tried to clone it and failed 47 times.'],
    ['THE TIDE PEARL', 'A pearl that hums like the ocean. Fish seem to follow it everywhere.'],
    ['THE FROST CROWN', 'An ancient ice crown that never melts. Very cold. Do not wear.'],
    ['THE EMBER HEART', 'A stone that is always warm. Great for camping trips.'],
    ['THE BRASS COG', 'The first gear of the old city. Still turns by itself.'],
    ['THE SUN TABLET', 'Carvings show a hero with spiky hair defeating a bald villain.'],
    ['THE SKY FEATHER', 'A feather that falls upward. Physics is just a suggestion.'],
    ['PROJECT OMEGA FILE', 'A blueprint labeled BACKUP PLAN. That cannot be good...']
  ];

  // ---------------- Logo ----------------
  let logoC = null;
  AF.logo = function () {
    if (logoC) return logoC;
    const draw = (txt, scale, cols) => {
      const w = AF.textWidth(txt) * scale + 8, h = 8 * scale + 8;
      const p = new AF.Pix(w, h);
      let x = 3;
      for (const ch of txt) {
        if (ch === ' ') { x += 4 * scale; continue; }
        const g = AF.GLYPH[ch] || AF.GLYPH['?'];
        for (let j = 0; j < g.rows.length; j++) for (let k = 0; k < g.w; k++) if (g.rows[j][k] === '1') {
          for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) {
            const yy = 3 + j * scale + a;
            const c = cols[Math.min(cols.length - 1, Math.floor((j * scale + a) / (7 * scale) * cols.length))];
            p.set(x + k * scale + b, yy, c);
          }
        }
        x += (g.w + 1) * scale;
      }
      // 3d extrusion
      const src = p.d.slice();
      for (let y = h - 1; y >= 0; y--) for (let xx = w - 1; xx >= 0; xx--) if (!src[y * w + xx]) { if ((xx > 0 && y > 0 && src[(y - 1) * w + xx - 1]) || (xx > 1 && y > 1 && src[(y - 2) * w + xx - 2])) p.set(xx, y, '#802010'); }
      p.outline('#000000', true);
      return p.canvas();
    };
    const a = draw('AARON', 4, ['#fff8a0', '#ffe040', '#ffb020', '#ff7010']);
    const b = draw('THE FIGHTER!', 2, ['#ffffff', '#c0e0ff', '#80a8ff']);
    const c = AF.makeCanvas(Math.max(a.width, b.width) + 4, a.height + b.height + 2), x = c.getContext('2d');
    x.drawImage(a, (c.width - a.width) >> 1, 0); x.drawImage(b, (c.width - b.width) >> 1, a.height - 2);
    logoC = c; return c;
  };

  // ---------------- Generic vertical menu helper ----------------
  class Menu {
    constructor(items, sel) { this.items = items; this.sel = sel || 0; this.fixSel(1); }
    fixSel(d) { let n = 0; while (this.items[this.sel] && this.items[this.sel].disabled && n++ < 20) this.sel = (this.sel + d + this.items.length) % this.items.length; }
    update() {
      if (I.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; this.fixSel(-1); AF.Audio.sfx('select'); }
      if (I.pressed.down) { this.sel = (this.sel + 1) % this.items.length; this.fixSel(1); AF.Audio.sfx('select'); }
      const it = this.items[this.sel];
      if (it.adjust) { if (I.pressed.left) { it.adjust(-1); AF.Audio.sfx('select'); } if (I.pressed.right) { it.adjust(1); AF.Audio.sfx('select'); } }
      if (ok() || I.pressed.jump) { AF.Audio.sfx('confirm'); if (it.act) it.act(); else if (it.adjust) it.adjust(1); return true; }
      return false;
    }
    draw(ctx, x, y, gap, align) {
      this.items.forEach((it, i) => {
        const sel = i === this.sel;
        const label = typeof it.label === 'function' ? it.label() : it.label;
        const col = it.disabled ? '#505070' : sel ? '#ffffff' : '#90a0d0';
        AF.text(ctx, label, x, y + i * gap, col, { a: align || 'c' });
        if (sel) { const w = AF.textWidth(label); const lx = align === 'l' ? x - 10 : x - (w >> 1) - 10; AF.text(ctx, '~', lx + ((AF.tick >> 3) & 1), y + i * gap, '#ffe060'); }
      });
    }
  }
  AF.Menu = Menu;

  // ---------------- Options ----------------
  class OptionsMenu {
    constructor(inGame) {
      this.inGame = inGame; this.confirmErase = 0;
      const o = AF.opts;
      const onoff = v => v ? 'ON' : 'OFF';
      this.menu = new Menu([
        { label: () => 'MUSIC VOLUME  ' + bar(o.music), adjust: d => { o.music = AF.clamp(Math.round((o.music + d * .1) * 10) / 10, 0, 1); AF.Audio.applyVolumes(); } },
        { label: () => 'SFX VOLUME    ' + bar(o.sfx), adjust: d => { o.sfx = AF.clamp(Math.round((o.sfx + d * .1) * 10) / 10, 0, 1); AF.Audio.applyVolumes(); AF.Audio.sfx('coin'); } },
        { label: () => 'SCREEN SHAKE  ' + onoff(o.shake), adjust: () => { o.shake = !o.shake; } },
        { label: () => 'TOUCH CONTROLS  ' + o.touch.toUpperCase(), adjust: d => { const v = ['auto', 'on', 'off']; o.touch = v[(v.indexOf(o.touch) + (d > 0 ? 1 : 2)) % 3]; AF.updateTouchVisibility(); } },
        { label: () => 'PIXEL-PERFECT SCALE  ' + onoff(o.pixel), adjust: () => { o.pixel = !o.pixel; AF.resize(); } },
        { label: () => 'SCANLINES  ' + onoff(o.crt), adjust: () => { o.crt = !o.crt; } },
        { label: () => 'SHOW TIMER  ' + onoff(o.timer), adjust: () => { o.timer = !o.timer; } },
        { label: 'CONTROLS', act: () => { this.showControls = true; } },
        { label: () => this.confirmErase ? 'REALLY ERASE? PRESS AGAIN' : 'ERASE SAVE DATA', act: () => { if (this.inGame) { AF.Audio.sfx('cancel'); return; } if (this.confirmErase) { AF.storage.del(AF.SAVE_KEY); AF.save = AF.newSave(); this.confirmErase = 0; this.erased = 90; } else this.confirmErase = 1; }, disabled: inGame },
        { label: 'BACK', act: () => { this.done = true; } }
      ]);
      function bar(v) { const n = Math.round(v * 10); return '[' + '#'.repeat(n) + '-'.repeat(10 - n) + ']'; }
    }
    update() {
      if (this.showControls) { if (ok() || back() || I.pressed.jump) { this.showControls = false; AF.Audio.sfx('cancel'); } return false; }
      if (this.erased) this.erased--;
      if (back()) { AF.writeOpts(); AF.Audio.sfx('cancel'); return true; }
      if (this.menu.sel !== 8) this.confirmErase = 0;
      this.menu.update();
      if (this.done) { AF.writeOpts(); return true; }
      return false;
    }
    draw(ctx) {
      AF.panel(ctx, 16, 10, AF.W - 32, AF.H - 20);
      if (this.showControls) {
        AF.text(ctx, 'CONTROLS', AF.W / 2, 16, '#ffe060', { a: 'c' });
        const rows = [['MOVE', 'ARROWS / WASD'], ['JUMP', 'SPACE  (Z)'], ['ATTACK', 'J  (X)'], ['SPECIAL', 'K  (C)'], ['DASH / ROLL', 'SHIFT  (L)'], ['CROUCH', 'DOWN'], ['CLIMB', 'UP on ladders/vines'], ['PAUSE', 'ENTER / ESC'], ['SLAM', 'DOWN + ATTACK in air'], ['CHARGE', 'HOLD ATTACK'], ['TOUCH', 'On-screen pad + buttons']];
        rows.forEach((r, i) => { AF.text(ctx, r[0], 28, 30 + i * 10, '#80c0ff'); AF.text(ctx, r[1], 104, 30 + i * 10, '#ffffff'); });
        return;
      }
      AF.text(ctx, 'OPTIONS', AF.W / 2, 16, '#ffe060', { a: 'c' });
      this.menu.draw(ctx, 30, 32, 11, 'l');
      if (this.erased) AF.text(ctx, 'SAVE ERASED', AF.W / 2, AF.H - 22, '#ff6060', { a: 'c' });
      else AF.text(ctx, 'LEFT/RIGHT TO CHANGE', AF.W / 2, AF.H - 22, '#6070a0', { a: 'c' });
    }
  }
  AF.OptionsMenu = OptionsMenu;

  // ---------------- Title / Main Menu ----------------
  class TitleScene {
    constructor() {
      this.t = 0; this.stage = 0; this.bg = AF.getBG(1, 1);
      AF.Audio.music('title');
      this.build();
    }
    build() {
      const has = AF.hasSave();
      this.confirm = null;
      this.menu = new Menu([
        { label: 'START GAME', act: () => { if (has) this.confirm = new Menu([{ label: 'NO', act: () => { this.confirm = null; } }, { label: 'YES, START OVER', act: () => this.newGame() }]); else this.newGame(); } },
        { label: 'CONTINUE', disabled: !has, act: () => AF.go(new AF.MapScene({}), 'iris') },
        { label: 'LEVEL SELECT', disabled: !has, act: () => AF.go(new LevelSelectScene(), 'fade') },
        { label: 'OPTIONS', act: () => { this.opt = new OptionsMenu(false); } },
        { label: 'EXTRAS', disabled: !has, act: () => AF.go(new ExtrasScene(), 'fade') },
        { label: 'CREDITS', act: () => AF.go(new CreditsScene(false), 'fade') }
      ], has ? 1 : 0);
    }
    newGame() {
      const opts = AF.opts;
      AF.save = AF.newSave(); AF.save.started = true; AF.writeSave(); AF.opts = opts;
      AF.go(new AF.Cutscene(AF.CUTS.intro(), () => new AF.MapScene({ first: true })), 'fade');
    }
    update() {
      this.t++;
      if (this.opt) { if (this.opt.update()) { this.opt = null; this.build(); } return; }
      if (this.stage === 0) { if (I.anyPressed || I.tapped) { this.stage = 1; AF.Audio.sfx('confirm'); I.clear(); } return; }
      if (this.confirm) { if (back()) this.confirm = null; else this.confirm.update(); return; }
      this.menu.update();
    }
    draw(ctx) {
      const t = this.t;
      AF.drawBG(ctx, this.bg, t * .8, 0, t, 0);
      ctx.fillStyle = 'rgba(0,0,30,.25)'; ctx.fillRect(0, 0, AF.W, AF.H);
      // ground strip
      const ts = AF.tileset(1);
      for (let x = -((t * .8) % 16); x < AF.W; x += 16) { ctx.drawImage(ts.atlas, 16 * (0 * 16 + 13) % 256, 0, 16, 16, Math.round(x), 136, 16, 16); ctx.drawImage(ts.atlas, (15 % 16) * 16, 0, 16, 16, Math.round(x), 152, 16, 16); }
      // logo with bob
      const lg = AF.logo();
      const ly = 10 + Math.round(Math.sin(t * .05) * 2);
      ctx.drawImage(lg, (AF.W - lg.width) >> 1, ly);
      // Aaron running
      const a = AF.SPR.aaron;
      AF.drawSpr(ctx, a['run' + (Math.floor(t / 4) % 6)], 36, 137, 1);
      // menu
      if (this.stage === 0) {
        if (t & 32) AF.text(ctx, I.isTouchDevice() ? 'TAP TO START' : 'PRESS ANY KEY', AF.W / 2, 104, '#ffffff', { a: 'c' });
      } else {
        AF.panel(ctx, 74, 70, 92, 64);
        this.menu.draw(ctx, AF.W / 2, 74, 10);
      }
      if (this.confirm) { AF.panel(ctx, 50, 60, 140, 46, '#c03040'); AF.text(ctx, 'OVERWRITE SAVE DATA?', AF.W / 2, 66, '#ffffff', { a: 'c' }); this.confirm.draw(ctx, AF.W / 2, 80, 12); }
      AF.text(ctx, '(c) 2026 AARON THE FIGHTER', AF.W / 2, AF.H - 9, '#c0d0ff', { a: 'c' });
      if (this.opt) this.opt.draw(ctx);
    }
  }
  AF.TitleScene = TitleScene;

  // ---------------- World map ----------------
  const NODES = [null, [44, 120], [26, 80], [58, 50], [104, 46], [150, 68], [196, 114], [204, 48], [120, 96], [120, 96]];
  let mapImg = null;
  function buildMap() {
    if (mapImg) return mapImg;
    const p = new AF.Pix(AF.W, AF.H);
    // ocean
    AF.ditherGrad(p, 0, 0, AF.W, AF.H, ['#1848a8', '#2060c0', '#2878d0']);
    for (let i = 0; i < 90; i++) { const x = (i * 53) % AF.W, y = (i * 37) % AF.H; p.rect(x, y, 3, 1, '#60a0f0'); }
    // continent blob
    const land = (x, y) => {
      let v = 0;
      v += Math.exp(-(((x - 120) / 105) ** 2 + ((y - 80) / 62) ** 2) * 1.2);
      v += Math.sin(x * .07) * .05 + Math.sin(y * .09 + x * .02) * .06;
      return v;
    };
    for (let y = 0; y < AF.H; y++) for (let x = 0; x < AF.W; x++) {
      const v = land(x, y);
      if (v > .42) p.set(x, y, '#f0e0a0');
      if (v > .46) p.set(x, y, '#58b048');
      if (v > .46 && ((x + y) & 1) && v < .5) p.set(x, y, '#48a040');
    }
    // regions
    const blob = (cx, cy, rx, ry, c1, c2) => { for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < 1 && land(x, y) > .46) p.set(x, y, d > .7 && ((x + y) & 1) ? c2 : c1); } };
    blob(46, 118, 26, 18, '#2c9028', '#38a030');
    blob(28, 80, 16, 16, '#3a8ab0', '#58b8d0');
    blob(60, 40, 30, 20, '#e0e8ff', '#b8c8f0');
    blob(104, 32, 24, 18, '#5a2a24', '#7a3a2c');
    blob(150, 64, 24, 18, '#7a7a90', '#9a9ab0');
    blob(194, 110, 30, 22, '#f0c870', '#e0b050');
    blob(120, 92, 16, 13, '#4a3a6a', '#5a4a80');
    // icons
    const tree = (x, y) => { p.rect(x - 1, y, 2, 4, '#5a3418'); p.circ(x, y - 2, 4, '#1e6a1c'); p.circ(x - 1, y - 3, 2, '#68d040'); };
    [[34, 114], [50, 124], [58, 112], [40, 126]].forEach(q => tree(q[0], q[1]));
    p.ell(26, 80, 8, 6, '#a0e0ff'); p.ell(26, 78, 6, 4, '#e0f8ff'); p.rect(22, 80, 8, 4, '#5a8aa8');
    p.poly([[46, 46], [58, 26], [70, 46]], '#a8b8e0'); p.poly([[54, 32], [58, 26], [62, 32]], '#ffffff'); p.poly([[62, 46], [72, 32], [82, 46]], '#90a0d0'); p.poly([[69, 36], [72, 32], [75, 36]], '#ffffff');
    p.poly([[90, 40], [104, 16], [118, 40]], '#3a1c20'); p.rect(100, 16, 8, 4, '#ff6020'); p.rect(102, 20, 3, 14, '#ff8020');
    for (let i = 0; i < 4; i++) p.rect(140 + i * 6, 54 - i * 3, 5, 14 + i * 3, ['#5a5a70', '#6a6a80', '#4a4a60', '#7a7a90'][i]); p.rect(158, 46, 2, 8, '#4a4a60');
    p.poly([[186, 114], [196, 100], [206, 114]], '#d09048'); p.poly([[196, 100], [206, 114], [200, 114]], '#a06830');
    // sky islands (top right, over ocean)
    p.ell(204, 30, 16, 6, '#58b048'); p.poly([[188, 30], [220, 30], [204, 44]], '#7a6080'); p.ell(204, 28, 12, 3, '#90e870'); p.ell(224, 18, 8, 4, '#ffffff'); p.ell(186, 16, 9, 4, '#ffffff');
    // lab fortress
    p.rect(112, 84, 16, 12, '#3a3060'); p.rect(110, 82, 20, 3, '#6a5aa0'); p.rect(118, 76, 4, 6, '#3a3060'); p.rect(119, 74, 2, 2, '#ff3070');
    p.outline('#102040');
    mapImg = p.canvas();
    return mapImg;
  }
  class MapScene {
    constructor(o) {
      o = o || {};
      this.t = 0; this.node = AF.clamp(o.fromWorld || AF.save.mapNode || 1, 1, AF.save.unlocked);
      if (o.unlockAnim) { this.unlockAnim = o.unlockAnim; this.unlockT = 0; }
      this.pos = NODES[this.node].slice(); this.target = null; this.panel = null; this.shop = null; this.first = o.first;
      AF.Audio.music('map');
      AF.writeSave();
      if (o.first) this.hint = 200;
    }
    update() {
      this.t++;
      if (this.unlockAnim) { this.unlockT++; if (this.unlockT === 30) AF.Audio.sfx('medal'); if (this.unlockT > 110) { this.unlockAnim = 0; } return; }
      if (this.shop) { if (this.shop.update()) this.shop = null; return; }
      if (this.opt) { if (this.opt.update()) this.opt = null; return; }
      if (this.panel) return this.updPanel();
      if (this.target) {
        const tp = NODES[this.target], dx = tp[0] - this.pos[0], dy = tp[1] - this.pos[1], d = Math.hypot(dx, dy);
        if (d < 2) { this.pos = tp.slice(); this.node = this.target; this.target = null; AF.save.mapNode = this.node; }
        else { this.pos[0] += dx / d * 2; this.pos[1] += dy / d * 2; this.face = dx >= 0 ? 1 : -1; }
        return;
      }
      const un = AF.save.unlocked;
      if ((I.pressed.right || I.pressed.down) && this.node < un) { this.target = this.node + 1; AF.Audio.sfx('select'); }
      else if ((I.pressed.left || I.pressed.up) && this.node > 1) { this.target = this.node - 1; AF.Audio.sfx('select'); }
      if (ok() || I.pressed.jump) { AF.Audio.sfx('confirm'); this.openPanel(); }
      if (I.pressed.dash || I.pressed.special) { AF.Audio.sfx('confirm'); this.shop = new ShopMenu(); }
      if (back() || I.pressed.pause) { AF.Audio.sfx('cancel'); AF.go(new TitleScene(), 'fade'); }
    }
    openPanel() {
      const w = this.node;
      const items = [];
      for (let a = 1; a <= 3; a++) items.push({ a, label: 'ACT ' + a, disabled: !AF.actUnlocked(w, a) });
      if (w === 8 && AF.actData(8, 3).done) items.push({ a: 4, label: 'FINAL', disabled: false });
      this.panel = { sel: 0, items };
    }
    updPanel() {
      const P = this.panel;
      if (I.pressed.up) { P.sel = (P.sel + P.items.length - 1) % P.items.length; AF.Audio.sfx('select'); }
      if (I.pressed.down) { P.sel = (P.sel + 1) % P.items.length; AF.Audio.sfx('select'); }
      if (back()) { this.panel = null; AF.Audio.sfx('cancel'); return; }
      if (ok() || I.pressed.jump) {
        const it = P.items[P.sel];
        if (it.disabled) { AF.Audio.sfx('cancel'); return; }
        AF.Audio.sfx('confirm');
        const w = this.node, a = it.a;
        if (a === 4) AF.go(new AF.Cutscene(AF.CUTS.prefinal(), () => new AF.Play(8, 4)), 'iris');
        else AF.go(new AF.Play(w, a), 'iris');
      }
    }
    draw(ctx) {
      const t = this.t;
      ctx.drawImage(buildMap(), 0, 0);
      // paths
      const un = AF.save.unlocked;
      for (let i = 1; i < 8; i++) {
        const a = NODES[i], b = NODES[i + 1];
        const open = i + 1 <= un, anim = this.unlockAnim === i + 1;
        const n = 14;
        for (let k = 1; k < n; k++) {
          if (anim && k / n > this.unlockT / 60) break;
          const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
          ctx.fillStyle = '#000'; ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
          ctx.fillStyle = open || anim ? '#fff0a0' : '#606078'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      }
      // nodes
      for (let w = 1; w <= 8; w++) {
        const [x, y] = NODES[w];
        const open = w <= un || (this.unlockAnim === w && this.unlockT > 60);
        const done = AF.save.bosses[w];
        const pulse = (this.unlockAnim === w && this.unlockT > 60 && (t & 4));
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
        ctx.fillStyle = pulse ? '#ffffff' : open ? AF.WORLDS[w].col : '#505060'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x - 3, y - 4, 3, 2);
        AF.text(ctx, '' + w, x, y - 3, open ? '#ffffff' : '#a0a0b0', { a: 'c' });
        if (done) { ctx.drawImage(AF.SPR.medalSmall.c, x + 3, y - 10); }
        if (!open) { ctx.fillStyle = '#202030'; ctx.fillRect(x - 3, y + 6, 6, 4); ctx.fillStyle = '#a0a0b0'; ctx.fillRect(x - 2, y + 7, 4, 2); }
      }
      // Aaron icon
      const walking = !!this.target;
      const spr = AF.SPR.aaron[walking ? 'walk' + (Math.floor(t / 5) % 6) : ((t >> 5) & 1 ? 'idle1' : 'idle0')];
      AF.drawSpr(ctx, spr, this.pos[0], this.pos[1] + 2, this.face || 1);
      // top banner
      const W = AF.WORLDS[this.target || this.node];
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, 14); ctx.fillStyle = W.col; ctx.fillRect(0, 13, AF.W, 1);
      AF.text(ctx, 'WORLD ' + (this.target || this.node) + ': ' + W.name, 6, 3, '#ffffff');
      AF.text(ctx, 'MEDALS ' + AF.totalMedals() + '/72', AF.W - 4, 3, '#ffe060', { a: 'r' });
      // bottom bar
      ctx.fillStyle = '#000'; ctx.fillRect(0, AF.H - 14, AF.W, 14);
      ctx.drawImage(AF.SPR.coin[0].c, 4, AF.H - 13);
      AF.text(ctx, '' + AF.save.bank, 16, AF.H - 11, '#ffe060');
      ctx.drawImage(AF.SPR.aaron.icon.c, 52, AF.H - 18);
      AF.text(ctx, 'x' + AF.save.lives, 70, AF.H - 11, '#ffffff');
      AF.text(ctx, 'ARTIFACTS ' + AF.save.artifacts.filter(Boolean).length + '/8', 92, AF.H - 11, '#e080ff');
      AF.text(ctx, I.lastDevice === 'touch' ? 'DASH:SHOP' : 'SHIFT:SHOP', AF.W - 4, AF.H - 11, '#80c0ff', { a: 'r' });
      if (this.hint > 0) { this.hint--; AF.panel(ctx, 30, 50, 180, 30); AF.text(ctx, 'Use LEFT/RIGHT to travel.', AF.W / 2, 56, '#ffffff', { a: 'c' }); AF.text(ctx, 'Press JUMP to enter a world!', AF.W / 2, 67, '#ffe060', { a: 'c' }); }
      if (this.panel) this.drawPanel(ctx);
      if (this.shop) this.shop.draw(ctx);
      if (this.unlockAnim && this.unlockT > 60) { AF.panel(ctx, 40, 64, 160, 22, '#ffb020'); AF.text(ctx, 'NEW WORLD UNLOCKED!', AF.W / 2, 68, '#ffffff', { a: 'c' }); AF.text(ctx, AF.WORLDS[this.unlockAnim].name, AF.W / 2, 77, '#ffe060', { a: 'c' }); }
    }
    drawPanel(ctx) {
      const P = this.panel, w = this.node, W = AF.WORLDS[w];
      const x = 34, y = 26, pw = 172, ph = 14 + P.items.length * 22 + 12;
      AF.panel(ctx, x, y, pw, ph, W.col);
      AF.text(ctx, W.name, AF.W / 2, y + 5, '#ffffff', { a: 'c' });
      P.items.forEach((it, i) => {
        const yy = y + 17 + i * 22, sel = i === P.sel;
        if (sel) { ctx.fillStyle = 'rgba(80,120,255,.35)'; ctx.fillRect(x + 4, yy - 2, pw - 8, 20); }
        const name = it.a === 4 ? 'FINAL: DR. ACHMED' : 'ACT ' + it.a + ' - ' + W.acts[it.a - 1];
        AF.text(ctx, it.disabled ? 'ACT ' + it.a + ' - LOCKED' : name, x + 8, yy, it.disabled ? '#505070' : sel ? '#ffffff' : '#a0b0e0');
        if (!it.disabled && it.a <= 3) {
          const d = AF.actData(w, it.a);
          for (let m = 0; m < 3; m++) ctx.drawImage(((d.med >> m) & 1 ? AF.SPR.medalSmall : AF.SPR.medalEmpty).c, x + 8 + m * 10, yy + 9);
          if (d.done) AF.text(ctx, 'CLEAR', x + 44, yy + 10, '#60ff80');
          if (d.best) AF.text(ctx, 'BEST ' + AF.fmtTime(d.best), x + pw - 6, yy + 10, '#ffe060', { a: 'r' });
          if (it.a === 3) AF.text(ctx, AF.save.bosses[w] ? 'BOSS DOWN' : 'BOSS: ' + W.boss, x + (d.done ? 80 : 44), yy + 10, AF.save.bosses[w] ? '#60ff80' : '#ff8080');
        } else if (it.a === 4) AF.text(ctx, AF.save.finalDone ? 'DEFEATED!' : 'THE FINAL BATTLE', x + 8, yy + 10, AF.save.finalDone ? '#60ff80' : '#ff6080');
      });
      if (w === 2 || w > 1) { }
      AF.text(ctx, 'ARTIFACT: ' + (AF.save.artifacts[w - 1] ? 'FOUND' : '???'), AF.W / 2, y + ph - 10, AF.save.artifacts[w - 1] ? '#e080ff' : '#605080', { a: 'c' });
    }
  }
  AF.MapScene = MapScene;

  // ---------------- Shop ----------------
  class ShopMenu {
    constructor() {
      this.sel = 0; this.msg = 'Welcome, friend! Coins buy upgrades.'; AF.Audio.music('shop');
      const U = AF.save.upgrades;
      this.items = [
        { name: 'HEART CONTAINER', desc: '+1 max heart', cost: () => [150, 300, 500][U.hearts], max: () => U.hearts >= 3, buy: () => U.hearts++ },
        { name: 'ENERGY CELL', desc: '+1 special energy', cost: () => [200, 400][U.energy], max: () => U.energy >= 2, buy: () => U.energy++ },
        { name: 'POWER GLOVES', desc: 'Double attack power', cost: () => 600, max: () => U.power >= 1, buy: () => U.power = 1 },
        { name: 'COIN MAGNET', desc: 'Pull in nearby coins', cost: () => 250, max: () => U.magnet >= 1, buy: () => U.magnet = 1 },
        { name: 'EXTRA LIFE', desc: '+1 life', cost: () => 100, max: () => AF.save.lives >= 99, buy: () => AF.save.lives++ },
        { name: 'LEAVE', desc: '', leave: true }
      ];
    }
    update() {
      if (I.pressed.up) { this.sel = (this.sel + this.items.length - 1) % this.items.length; AF.Audio.sfx('select'); }
      if (I.pressed.down) { this.sel = (this.sel + 1) % this.items.length; AF.Audio.sfx('select'); }
      if (back()) { AF.Audio.music('map'); return true; }
      if (ok() || I.pressed.jump) {
        const it = this.items[this.sel];
        if (it.leave) { AF.Audio.sfx('cancel'); AF.Audio.music('map'); return true; }
        if (it.max()) { this.msg = 'You already have the max!'; AF.Audio.sfx('cancel'); }
        else if (AF.save.bank < it.cost()) { this.msg = 'Not enough coins, pal. Go punch more robots!'; AF.Audio.sfx('cancel'); }
        else { AF.save.bank -= it.cost(); it.buy(); AF.writeSave(); this.msg = 'Thanks! ' + it.name + ' is yours!'; AF.Audio.sfx('oneup'); }
      }
      return false;
    }
    draw(ctx) {
      AF.panel(ctx, 10, 8, AF.W - 20, AF.H - 16, '#e0a020');
      AF.text(ctx, "BOLT'S UPGRADE SHOP", AF.W / 2, 13, '#ffe060', { a: 'c' });
      // shopkeeper robot
      const t = AF.tick, x = 30, y = 30;
      ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 26, 30);
      ctx.fillStyle = '#80a0c0'; ctx.fillRect(x, y + 8, 24, 20); ctx.fillStyle = '#a0c0e0'; ctx.fillRect(x + 2, y, 20, 10);
      ctx.fillStyle = '#102030'; ctx.fillRect(x + 4, y + 3, 16, 5); ctx.fillStyle = '#60ff90'; ctx.fillRect(x + 6 + ((t >> 4) & 1), y + 4, 3, 2); ctx.fillRect(x + 14 + ((t >> 4) & 1), y + 4, 3, 2);
      ctx.fillStyle = '#ffe040'; ctx.fillRect(x + 10, y + 14, 4, 4); ctx.fillStyle = '#ff4060'; ctx.fillRect(x + 11, y - 4, 2, 4);
      const lines = AF.wrap(this.msg, 150);
      lines.forEach((l, i) => AF.text(ctx, l, 62, 30 + i * 9, '#ffffff'));
      this.items.forEach((it, i) => {
        const yy = 66 + i * 12, sel = i === this.sel;
        const maxed = it.max && it.max();
        AF.text(ctx, it.name, 26, yy, sel ? '#ffffff' : '#a0b0e0');
        if (sel) AF.text(ctx, '~', 16, yy, '#ffe060');
        if (!it.leave) AF.text(ctx, maxed ? 'SOLD OUT' : '' + it.cost(), AF.W - 24, yy, maxed ? '#60ff80' : AF.save.bank >= it.cost() ? '#ffe060' : '#ff6060', { a: 'r' });
      });
      const it = this.items[this.sel];
      AF.text(ctx, it.desc || '', AF.W / 2, AF.H - 26, '#80c0ff', { a: 'c' });
      ctx.drawImage(AF.SPR.coin[0].c, AF.W / 2 - 26, AF.H - 17);
      AF.text(ctx, 'BANK ' + AF.save.bank, AF.W / 2 - 12, AF.H - 15, '#ffe060');
    }
  }

  // ---------------- Level select ----------------
  class LevelSelectScene {
    constructor() { this.w = 1; this.a = 1; AF.Audio.music('map'); }
    update() {
      const un = AF.save.unlocked;
      if (I.pressed.left) { this.w = Math.max(1, this.w - 1); AF.Audio.sfx('select'); }
      if (I.pressed.right) { this.w = Math.min(un, this.w + 1); AF.Audio.sfx('select'); }
      const maxA = (this.w === 8 && AF.actData(8, 3).done) ? 4 : 3;
      if (I.pressed.up) { this.a = Math.max(1, this.a - 1); AF.Audio.sfx('select'); }
      if (I.pressed.down) { this.a = Math.min(maxA, this.a + 1); AF.Audio.sfx('select'); }
      this.a = Math.min(this.a, maxA);
      if (back()) { AF.Audio.sfx('cancel'); AF.go(new TitleScene(), 'fade'); }
      if (ok() || I.pressed.jump) {
        if (!AF.actUnlocked(this.w, this.a)) { AF.Audio.sfx('cancel'); return; }
        AF.Audio.sfx('confirm');
        AF.go(this.a === 4 ? new AF.Cutscene(AF.CUTS.prefinal(), () => new AF.Play(8, 4)) : new AF.Play(this.w, this.a), 'iris');
      }
    }
    draw(ctx) {
      const bg = AF.getBG(this.w, 1);
      AF.drawBG(ctx, bg, AF.tick * .5, 0, AF.tick, 0);
      AF.panel(ctx, 14, 10, AF.W - 28, AF.H - 20, AF.WORLDS[this.w].col);
      AF.text(ctx, 'LEVEL SELECT', AF.W / 2, 15, '#ffe060', { a: 'c' });
      AF.text(ctx, '` WORLD ' + this.w + ' ~', AF.W / 2, 30, '#ffffff', { a: 'c' });
      AF.text(ctx, AF.WORLDS[this.w].name, AF.W / 2, 40, AF.WORLDS[this.w].col, { a: 'c' });
      const maxA = (this.w === 8 && AF.actData(8, 3).done) ? 4 : 3;
      for (let a = 1; a <= maxA; a++) {
        const y = 56 + (a - 1) * 20, sel = a === this.a, un = AF.actUnlocked(this.w, a);
        if (sel) { ctx.fillStyle = 'rgba(80,120,255,.35)'; ctx.fillRect(22, y - 3, AF.W - 44, 18); }
        AF.text(ctx, un ? (a === 4 ? 'FINAL: DR. ACHMED' : a + '. ' + AF.WORLDS[this.w].acts[a - 1]) : a + '. LOCKED', 30, y, un ? (sel ? '#ffffff' : '#a0b0e0') : '#505070');
        if (un && a <= 3) { const d = AF.actData(this.w, a); for (let m = 0; m < 3; m++) ctx.drawImage(((d.med >> m) & 1 ? AF.SPR.medalSmall : AF.SPR.medalEmpty).c, 30 + m * 10, y + 8); if (d.best) AF.text(ctx, AF.fmtTime(d.best), AF.W - 30, y + 8, '#ffe060', { a: 'r' }); }
      }
      AF.text(ctx, 'LEFT/RIGHT: WORLD   UP/DOWN: ACT', AF.W / 2, AF.H - 20, '#6070a0', { a: 'c' });
    }
  }
  AF.LevelSelectScene = LevelSelectScene;

  // ---------------- Extras ----------------
  class ExtrasScene {
    constructor() { this.sel = 0; this.track = 0; AF.Audio.music('map'); this.tracks = ['title', 'map', 'forest', 'aqua', 'ice', 'lava', 'city', 'desert', 'sky', 'lab', 'boss', 'final', 'ending', 'shop', 'cutscene']; }
    update() {
      const n = AF.save.artifacts.filter(Boolean).length;
      if (I.pressed.up) { this.sel = (this.sel + 9) % 10; AF.Audio.sfx('select'); }
      if (I.pressed.down) { this.sel = (this.sel + 1) % 10; AF.Audio.sfx('select'); }
      if (this.sel === 8 && n >= 4) {
        if (I.pressed.left) { this.track = (this.track + this.tracks.length - 1) % this.tracks.length; AF.Audio.sfx('select'); }
        if (I.pressed.right) { this.track = (this.track + 1) % this.tracks.length; AF.Audio.sfx('select'); }
        if (ok() || I.pressed.jump) { AF.Audio.curName = ''; AF.Audio.music(this.tracks[this.track]); }
      }
      if (this.sel === 9 && n >= 8 && (ok() || I.pressed.jump)) { AF.save.altSkin = !AF.save.altSkin; AF.writeSave(); AF.buildSkins(); AF.Audio.sfx('confirm'); }
      if (back()) { AF.Audio.sfx('cancel'); AF.go(new TitleScene(), 'fade'); }
    }
    draw(ctx) {
      ctx.fillStyle = '#0a0a24'; ctx.fillRect(0, 0, AF.W, AF.H);
      AF.panel(ctx, 6, 4, AF.W - 12, AF.H - 8, '#c060ff');
      AF.text(ctx, 'EXTRAS - SECRET ARTIFACTS', AF.W / 2, 8, '#ffe060', { a: 'c' });
      const n = AF.save.artifacts.filter(Boolean).length;
      for (let i = 0; i < 8; i++) {
        const has = AF.save.artifacts[i], y = 20 + i * 11, sel = i === this.sel;
        if (has) ctx.drawImage(AF.SPR.artifact[0].c, 12, y - 3, 8, 9);
        AF.text(ctx, has ? AF.ARTIFACTS[i][0] : '??? (WORLD ' + (i + 1) + ')', 24, y, has ? (sel ? '#ffffff' : '#e0a0ff') : '#505070');
        if (sel) AF.text(ctx, '~', 10, y, '#ffe060');
      }
      const y8 = 20 + 8 * 11;
      AF.text(ctx, n >= 4 ? 'JUKEBOX: ` ' + this.tracks[this.track].toUpperCase() + ' ~' : 'JUKEBOX (4 ARTIFACTS)', 24, y8, n >= 4 ? (this.sel === 8 ? '#ffffff' : '#a0e0ff') : '#505070');
      AF.text(ctx, n >= 8 ? 'RETRO OUTFIT: ' + (AF.save.altSkin ? 'ON' : 'OFF') : 'RETRO OUTFIT (8 ARTIFACTS)', 24, y8 + 11, n >= 8 ? (this.sel === 9 ? '#ffffff' : '#a0ffa0') : '#505070');
      if (this.sel === 8 || this.sel === 9) AF.text(ctx, '~', 10, y8 + (this.sel - 8) * 11, '#ffe060');
      if (this.sel < 8 && AF.save.artifacts[this.sel]) { const l = AF.wrap(AF.ARTIFACTS[this.sel][1], 210); l.forEach((s, i) => AF.text(ctx, s, AF.W / 2, AF.H - 26 + i * 9, '#c0c0e0', { a: 'c' })); }
      else AF.text(ctx, 'MEDALS ' + AF.totalMedals() + '/72  SCORE ' + AF.save.score, AF.W / 2, AF.H - 18, '#ffe060', { a: 'c' });
    }
  }

  // ---------------- Credits ----------------
  class CreditsScene {
    constructor(ending) {
      this.t = 0; this.ending = ending; AF.Audio.music('ending');
      this.lines = ['AARON THE FIGHTER!', '', '', 'STARRING', 'AARON', '', 'AND', 'DR. ACHMED', '', '', 'GAME DESIGN', 'PROGRAMMING', 'PIXEL ART', 'MUSIC & SOUND', 'CLAUDE', '', '', 'BASED ON AN IDEA BY', 'THE PLAYER', '', '', 'WORLDS', 'EMERALD FOREST', 'CRYSTAL AQUARIUM', 'FROSTBITE MOUNTAIN', 'MAGMA MOUNTAIN', 'CLOCKWORK CITY', 'SUNSCORCH DESERT', 'SKYBOUND ISLANDS', "ACHMED'S LABORATORY", '', '', 'SPECIAL THANKS', 'BOLT THE SHOPKEEPER', 'ALL THE FOREST CRITTERS', 'YOU, FOR PLAYING!', '', '', '', 'THE END?', '', '', ''];
    }
    update() {
      this.t++;
      const end = this.lines.length * 14 + AF.H + 40;
      if (this.t * .45 > end || ((ok() || back() || I.pressed.jump) && this.t > 60)) {
        if (this.ending) AF.go(new AF.MapScene({ fromWorld: 8 }), 'fade'); else AF.go(new TitleScene(), 'fade');
      }
    }
    draw(ctx) {
      ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, AF.W, AF.H);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? '#404070' : '#8080c0'; ctx.fillRect((i * 61) % AF.W, (i * 37 + (this.t >> 2)) % AF.H, 1, 1); }
      const off = AF.H - this.t * .45;
      this.lines.forEach((l, i) => {
        const y = off + i * 14; if (y < -10 || y > AF.H) return;
        const head = ['STARRING', 'AND', 'GAME DESIGN', 'WORLDS', 'SPECIAL THANKS', 'BASED ON AN IDEA BY'].indexOf(l) >= 0;
        AF.text(ctx, l, AF.W / 2, y, i === 0 ? '#ffe060' : head ? '#80a0ff' : '#ffffff', { a: 'c' });
      });
      if (this.lines.length * 14 + off < AF.H / 2) AF.drawSpr(ctx, AF.SPR.aaron['victory' + ((this.t >> 4) & 1 ? '1' : '')], AF.W / 2, AF.H / 2 + 60, 1);
    }
  }
  AF.CreditsScene = CreditsScene;

  // ---------------- Game over ----------------
  class GameOverScene {
    constructor(w, a) { this.t = 0; this.w = w; this.a = a; AF.Audio.music('gameover'); this.menu = new Menu([{ label: 'TRY AGAIN', act: () => AF.go(new AF.Play(w, a), 'fade') }, { label: 'RETURN TO MAP', act: () => AF.go(new MapScene({ fromWorld: w }), 'fade') }, { label: 'TITLE SCREEN', act: () => AF.go(new TitleScene(), 'fade') }]); }
    update() { this.t++; if (this.t > 60) this.menu.update(); }
    draw(ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H);
      const k = Math.min(1, this.t / 40);
      const por = AF.portrait('achmed', 'laugh');
      ctx.globalAlpha = k; ctx.drawImage(por, AF.W / 2 - 20, 16); ctx.globalAlpha = 1;
      AF.text(ctx, 'GAME OVER', AF.W / 2, 64, '#ff4060', { a: 'c' });
      if (this.t > 30) AF.text(ctx, '"MWAHAHA! Is that all, Aaron?"', AF.W / 2, 78, '#e080ff', { a: 'c' });
      if (this.t > 60) { this.menu.draw(ctx, AF.W / 2, 100, 12); }
    }
  }
  AF.GameOverScene = GameOverScene;
})();
