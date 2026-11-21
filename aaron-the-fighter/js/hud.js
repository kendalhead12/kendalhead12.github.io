'use strict';
// ============================================================
//  HUD, dialogue boxes, title cards, tally, pause, portraits
// ============================================================
(function () {
  let capsule = null;
  function makeCapsule() {
    const w = 60, h = 23, p = new AF.Pix(w, h);
    // pill: rounded left side, slanted right end
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = 11, inLeft = x >= r || Math.hypot(x - r + .5, y - h / 2 + .5) <= r;
      const right = x <= w - 1 - Math.max(0, (y - 8) * .6);
      if (inLeft && right) p.set(x, y, '#08081a');
    }
    // borders: blue inner, white outer
    const src = p.d.slice();
    const isIn = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!isIn(x, y)) continue;
      const edge = !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1);
      const edge2 = !isIn(x - 2, y) || !isIn(x + 2, y) || !isIn(x, y - 2) || !isIn(x, y + 2);
      if (edge) p.set(x, y, '#ffffff'); else if (edge2) p.set(x, y, '#3058e0');
    }
    p.outline('#000000');
    return p.canvas();
  }
  AF.drawHUD = function (ctx, g) {
    if (!capsule) capsule = makeCapsule();
    const p = g.player, t = g.t;
    if (g.hideHUD) return;
    // --- coin capsule (top-left) ---
    ctx.drawImage(capsule, 1, 1);
    AF.drawSpr(ctx, AF.SPR.bigcoin[(t >> 3) & 3], 12, 13, 1);
    AF.bigText(ctx, AF.pad(g.coinCount || 0, 3), 24, 4);
    // score beneath
    AF.bigText(ctx, AF.pad(AF.save.score + g.stats.score, 7), 4, 25);
    // --- timer (top-center) ---
    if (AF.opts.timer) AF.bigText(ctx, AF.fmtTime(g.stats.time), 152, 4, 'c');
    // --- hearts (top-right) ---
    const mh = AF.maxHearts();
    for (let i = 0; i < mh; i++) {
      const x = AF.W - 4 - (mh - i) * 10, y = 4;
      const full = i < p.hp;
      const s = full ? AF.SPR.heartFull : AF.SPR.heartEmpty;
      const bob = full && p.hp <= 2 && ((t >> 3) & 1) && i === p.hp - 1 ? -1 : 0;
      ctx.drawImage(s.c, x, y + bob);
    }
    // energy cells
    const me = AF.maxEnergy();
    for (let i = 0; i < me; i++) {
      const x = AF.W - 4 - (me - i) * 8, y = 15;
      const s = i < p.energy ? AF.SPR.cellFull : AF.SPR.cellEmpty;
      if (g.flashEnergy > 0 && (g.flashEnergy & 4)) continue;
      ctx.drawImage(s.c, x, y);
    }
    // --- lives (bottom-left) ---
    ctx.drawImage(AF.SPR.aaron.icon.c, 2, AF.H - 21);
    AF.bigText(ctx, AF.bigDigits.x ? 'x' : '', 20, AF.H - 15);
    AF.bigText(ctx, '' + Math.max(0, AF.save.lives), 27, AF.H - 15);
    // --- world/act + medallions (bottom-right) ---
    const lbl = g.act === 4 ? 'FINAL' : g.world + '-' + g.act;
    AF.text(ctx, lbl, AF.W - 32, AF.H - 21, '#ffe060', { a: 'c' });
    for (let i = 0; i < 3; i++) {
      const has = g.stats.medals.indexOf(i) >= 0 || (g.actRec.med & (1 << i));
      const got = g.stats.medals.indexOf(i) >= 0;
      ctx.globalAlpha = got || !has ? 1 : .5;
      ctx.drawImage((has ? AF.SPR.medalSmall : AF.SPR.medalEmpty).c, AF.W - 46 + i * 10, AF.H - 12);
      ctx.globalAlpha = 1;
    }
    // --- boss bar ---
    if (g.boss && g.boss.active && !g.boss.dead) {
      const b = g.boss, w = 120, x = (AF.W - w) >> 1, y = AF.H - 13;
      ctx.fillStyle = '#000000'; ctx.fillRect(x - 2, y - 2, w + 4, 9);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
      ctx.fillStyle = '#300818'; ctx.fillRect(x, y, w, 5);
      const k = AF.clamp(b.hp / b.maxHp, 0, 1);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(x, y, Math.round(w * AF.clamp(g.bossBar, 0, 1)), 5);
      ctx.fillStyle = b.enraged ? '#ff3060' : '#f04848'; ctx.fillRect(x, y, Math.round(w * k), 5);
      ctx.fillStyle = '#ff9090'; ctx.fillRect(x, y, Math.round(w * k), 1);
      AF.text(ctx, b.name, AF.W / 2, y - 11, '#ffffff', { a: 'c' });
    }
    // --- toast / banners ---
    if (g.toastT > 0 && g.toastMsg) {
      const a = Math.min(1, g.toastT / 20);
      ctx.globalAlpha = a;
      const lines = AF.wrap(g.toastMsg, 200);
      const h = lines.length * 9 + 6, y = 44;
      ctx.fillStyle = 'rgba(8,8,26,.85)'; ctx.fillRect(14, y, AF.W - 28, h);
      ctx.fillStyle = '#3058e0'; ctx.fillRect(14, y, AF.W - 28, 1); ctx.fillRect(14, y + h - 1, AF.W - 28, 1);
      lines.forEach((l, i) => AF.text(ctx, l, AF.W / 2, y + 3 + i * 9, '#ffffff', { a: 'c' }));
      ctx.globalAlpha = 1;
    }
    if (g.abilityBanner) {
      const b = g.abilityBanner, k = Math.min(1, (200 - b.t) / 15);
      const y = 30 + (1 - k) * -40;
      ctx.fillStyle = '#000'; ctx.fillRect(0, y, AF.W, 16);
      ctx.fillStyle = (g.t & 8) ? '#ffe040' : '#ff9020'; ctx.fillRect(0, y + 1, AF.W, 14);
      AF.text(ctx, 'NEW ABILITY: ' + b.name, AF.W / 2, y + 4, '#ffffff', { a: 'c', o: '#401000' });
    }
  };

  // ---------------- Title card ----------------
  AF.drawTitleCard = function (ctx, g) {
    const t = 150 - g.intro; // 0..150
    const W = AF.WORLDS[g.world];
    const inK = AF.ease.out(AF.clamp(t / 22, 0, 1)), outK = AF.ease.in(AF.clamp((t - 110) / 30, 0, 1));
    if (t < 110) { ctx.globalAlpha = .55 * (1 - AF.clamp((t - 90) / 20, 0, 1)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
    // diagonal colored band
    const bx = -AF.W + inK * AF.W - outK * AF.W * 1.2;
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(bx, 44); ctx.lineTo(bx + AF.W + 20, 44); ctx.lineTo(bx + AF.W, 80); ctx.lineTo(bx, 80); ctx.fill();
    ctx.fillStyle = W ? W.col : '#c060ff'; ctx.beginPath(); ctx.moveTo(bx, 46); ctx.lineTo(bx + AF.W + 17, 46); ctx.lineTo(bx + AF.W - 2, 78); ctx.lineTo(bx, 78); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx, 46, AF.W + 10, 3);
    const name = g.act === 4 ? 'FINAL BATTLE' : W.name;
    AF.text(ctx, name, Math.round(bx + AF.W / 2), 52, '#ffffff', { a: 'c', o: '#000000' });
    const sub = g.act === 4 ? 'DR. ACHMED' : W.acts[g.act - 1];
    AF.text(ctx, sub, Math.round(bx + AF.W / 2), 64, '#ffffa0', { a: 'c', o: '#000000' });
    // ACT badge from right
    const ax = AF.W + 10 - inK * 90 + outK * 140;
    ctx.fillStyle = '#000'; ctx.fillRect(ax - 2, 84, 74, 26);
    ctx.fillStyle = '#e82030'; ctx.fillRect(ax, 86, 70, 22);
    ctx.fillStyle = '#ff7060'; ctx.fillRect(ax, 86, 70, 3);
    AF.text(ctx, g.act === 4 ? 'BOSS' : 'ACT', ax + 6, 93, '#ffffff', { o: '#400000' });
    AF.bigText(ctx, g.act === 4 ? '!' : '' + g.act, ax + 40, 92);
    if (g.act === 4) AF.text(ctx, '!!', ax + 44, 93, '#ffffff', { o: '#400000' });
  };

  // ---------------- Portraits ----------------
  const portraitCache = {};
  AF.portrait = function (who, mood) {
    const k = who + (mood || '');
    if (portraitCache[k]) return portraitCache[k];
    let c;
    if (who === 'aaron') c = AF.aaronPortrait(mood);
    else if (who === 'achmed') c = achmedPortrait(mood);
    else if (who === 'sys') { const p = new AF.Pix(40, 40); p.shadeEll(20, 20, 14, 14, ['#3a2060', '#ff6080', '#ffc0d0', '#ffffff']); p.rect(16, 10, 8, 14, '#ffffff'); p.rect(16, 27, 8, 5, '#ffffff'); p.outline('#140a18'); c = p.canvas(); }
    else if (who === 'radio') { const p = new AF.Pix(40, 40); p.rect(6, 12, 28, 22, '#505868'); p.rect(8, 14, 24, 10, '#20f0a0'); p.rect(19, 2, 2, 10, '#808898'); p.circ(20, 2, 2, '#ff4040'); for (let i = 0; i < 4; i++) p.rect(10 + i * 6, 27, 3, 4, '#202830'); p.outline('#140a18'); c = p.canvas(); }
    portraitCache[k] = c;
    return c;
  };
  function achmedPortrait(mood) {
    const h = new AF.Pix(20, 20);
    // lab coat shoulders
    h.rect(2, 16, 16, 4, '#e8e8f0'); h.rect(8, 16, 4, 4, '#6020a0'); h.rect(2, 16, 3, 4, '#b0b0c8');
    // head (bald, big forehead)
    h.ell(10, 9, 6.5, 7, '#e8b088'); h.ell(9, 6, 4.5, 4, '#f8c8a0');
    // wild white hair sides
    h.ell(3, 9, 2.5, 3.5, '#f0f0ff'); h.ell(17, 9, 2.5, 3.5, '#f0f0ff'); h.set(1, 6, '#f0f0ff'); h.set(18, 6, '#f0f0ff'); h.set(2, 12, '#d0d0e0'); h.set(18, 12, '#d0d0e0');
    // goggles on forehead
    h.rect(5, 4, 10, 2, '#403050'); h.circ(7.5, 4.5, 1.5, '#60e0ff'); h.circ(12.5, 4.5, 1.5, '#60e0ff');
    // eyes (evil)
    const angry = mood === 'angry' || mood === 'mad';
    h.rect(6, 8, 3, 1, '#40203a'); h.rect(11, 8, 3, 1, '#40203a');
    h.set(7, 9, angry ? '#ff2020' : '#202030'); h.set(12, 9, angry ? '#ff2020' : '#202030'); h.set(6, 9, '#ffffff'); h.set(11, 9, '#ffffff');
    if (angry) { h.set(6, 7, '#40203a'); h.set(13, 7, '#40203a'); }
    // nose & mustache
    h.rect(9, 10, 2, 2, '#d89870');
    h.rect(6, 12, 8, 2, '#f0f0ff'); h.set(5, 13, '#f0f0ff'); h.set(14, 13, '#f0f0ff'); h.set(4, 14, '#d0d0e0'); h.set(15, 14, '#d0d0e0');
    if (mood === 'laugh' || mood === 'talk') h.rect(8, 14, 4, 2, '#601020'); else h.rect(8, 14, 4, 1, '#904040');
    const p = new AF.Pix(40, 40);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const v = h.d[y * 20 + x]; if (v) { p.d[(y * 2) * 40 + x * 2] = v; p.d[(y * 2) * 40 + x * 2 + 1] = v; p.d[(y * 2 + 1) * 40 + x * 2] = v; p.d[(y * 2 + 1) * 40 + x * 2 + 1] = v; } }
    p.outline('#140a18');
    return p.canvas();
  }

  // ---------------- Dialogue box ----------------
  const NAMES = { aaron: 'AARON', achmed: 'DR. ACHMED', sys: '', radio: 'RADIO' };
  AF.drawDialog = function (ctx, d) {
    const l = d.line, who = l.who;
    const y = AF.H - 50, h = 48;
    ctx.fillStyle = '#000000'; ctx.fillRect(2, y - 1, AF.W - 4, h + 1);
    ctx.fillStyle = who === 'achmed' ? '#2a0830' : who === 'sys' ? '#0a1838' : '#081830';
    ctx.fillRect(3, y, AF.W - 6, h - 1);
    ctx.fillStyle = who === 'achmed' ? '#c040ff' : '#3a78ff'; ctx.fillRect(3, y, AF.W - 6, 1); ctx.fillRect(3, y + h - 2, AF.W - 6, 1); ctx.fillRect(3, y, 1, h - 1); ctx.fillRect(AF.W - 4, y, 1, h - 1);
    let tx = 10;
    if (who !== 'sys') {
      const por = AF.portrait(who, l.mood);
      ctx.fillStyle = '#000'; ctx.fillRect(6, y + 3, 42, 42);
      ctx.fillStyle = who === 'achmed' ? '#3a1050' : '#16305a'; ctx.fillRect(7, y + 4, 40, 40);
      if (who === 'achmed' && l.radio !== false) { // static lines for radio transmission
        ctx.drawImage(por, 7, y + 4);
        ctx.globalAlpha = .25; ctx.fillStyle = '#c0a0ff'; for (let i = 0; i < 40; i += 3) ctx.fillRect(7, y + 4 + ((i + AF.tick) % 40), 40, 1); ctx.globalAlpha = 1;
      } else ctx.drawImage(por, 7, y + 4);
      tx = 54;
      AF.text(ctx, NAMES[who] || '', tx, y + 4, who === 'achmed' ? '#e080ff' : '#80c0ff');
    }
    const shown = l.text.slice(0, d.chars);
    const lines = AF.wrap(l.text, AF.W - tx - 10);
    let count = 0;
    lines.forEach((ln, i) => {
      const part = ln.slice(0, Math.max(0, d.chars - count));
      count += ln.length + 1;
      AF.text(ctx, part, tx, y + (who === 'sys' ? 6 : 15) + i * 9, '#ffffff', { o: null, sh: '#000000' });
    });
    if (d.chars >= l.text.length && (AF.tick & 16)) AF.text(ctx, 'v', AF.W - 12, y + h - 11, '#ffe060', { o: null });
  };

  // ---------------- Tally ----------------
  AF.drawTally = function (ctx, g) {
    const tl = g.tally;
    const k = Math.min(1, tl.t / 20);
    ctx.globalAlpha = .6 * k; ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1;
    const bx = Math.round(-200 + k * 200);
    ctx.fillStyle = '#000'; ctx.fillRect(bx, 18, AF.W, 22);
    ctx.fillStyle = AF.WORLDS[g.world] ? AF.WORLDS[g.world].col : '#ffe040'; ctx.fillRect(bx, 20, AF.W, 18);
    AF.text(ctx, g.act === 3 ? 'BOSS DEFEATED!' : g.act === 4 ? 'VICTORY!' : 'ACT ' + g.act + ' CLEAR!', bx + AF.W / 2, 25, '#ffffff', { a: 'c', o: '#000' });
    let y = 52;
    for (let i = 0; i < tl.shown; i++) {
      AF.text(ctx, tl.rows[i][0], 40, y, '#ffe060');
      AF.bigText(ctx, '' + tl.rows[i][1], 200, y - 2, 'r');
      y += 15;
    }
    if (tl.shown >= tl.rows.length) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(40, y - 3, 160, 1);
      AF.text(ctx, 'TOTAL', 40, y + 2, '#ffffff');
      AF.bigText(ctx, '' + (tl.total + g.stats.score), 200, y, 'r');
      AF.text(ctx, 'TIME ' + AF.fmtTime(g.stats.time) + '   MEDALLIONS ' + g.stats.medals.length + '/3', AF.W / 2, y + 18, '#a0c0ff', { a: 'c' });
      if (tl.t & 16) AF.text(ctx, 'PRESS JUMP', AF.W / 2, AF.H - 14, '#ffffff', { a: 'c' });
    }
  };

  // ---------------- Pause menu ----------------
  AF.drawPause = function (ctx, g) {
    ctx.globalAlpha = .6; ctx.fillStyle = '#000010'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1;
    if (g.optMenu) { g.optMenu.draw(ctx); return; }
    AF.panel(ctx, 60, 30, 120, 96);
    AF.text(ctx, 'PAUSED', AF.W / 2, 38, '#ffe060', { a: 'c' });
    const items = ['RESUME', 'RESTART', 'OPTIONS', 'RETURN TO MAP'];
    items.forEach((s, i) => {
      const sel = i === g.pauseSel;
      AF.text(ctx, s, AF.W / 2, 56 + i * 14, sel ? '#ffffff' : '#8090c0', { a: 'c' });
      if (sel) AF.text(ctx, '~', 72, 56 + i * 14, '#ffe060');
    });
    const W = AF.WORLDS[g.world];
    AF.text(ctx, (g.act === 4 ? 'FINAL' : W.short + ' ' + g.world + '-' + g.act), AF.W / 2, 114, '#60a0ff', { a: 'c' });
  };
  AF.panel = function (ctx, x, y, w, h, col) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = col || '#3058e0'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#0c0c2a'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  };
})();
