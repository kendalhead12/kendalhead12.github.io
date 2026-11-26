'use strict';
// ============================================================
//  Character art (procedural pixel art). Overworld sprites are
//  coloured; battle sprites are generated in black & white.
// ============================================================
(function () {
  const Art = U.Art, Pix = U.Pix;
  const OL = '#140c1c';
  const C = U.Chars = { defs: {} };
  C.def = (id, d) => { d.id = id; C.defs[id] = d; };

  // ---------- cached accessors ----------
  C.ow = function (id, dir, frame) {
    const d = C.defs[id]; if (!d) return null;
    dir = dir || 'down'; frame = frame || 0;
    const view = dir === 'up' ? 'back' : dir === 'down' ? 'front' : 'side';
    return Art.cached('ow|' + id + '|' + dir + '|' + frame, () => {
      if (dir === 'right' && !d.noFlip) return Art.flip(C.ow(id, 'left', frame));
      let raw = d.ow(view, frame, dir);
      let out = d.noOutline ? raw : Art.outline(raw, d.outline || OL);
      if (d.post) out = d.post(out, view, frame, dir) || out;
      return out;
    });
  };
  C.bigRaw = function (id, expr, talk) {
    const d = C.defs[id];
    expr = expr || d.defaultExpr || 'normal';
    return Art.cached('bigraw|' + id + '|' + expr + '|' + (talk ? 1 : 0), () => d.big(expr, !!talk));
  };
  C.big = (id, expr, talk) => Art.cached('big|' + id + '|' + expr + '|' + (talk ? 1 : 0), () => Art.outline(C.bigRaw(id, expr, talk), C.defs[id].outline || OL));
  C.bigBW = (id, expr, talk) => Art.cached('bigbw|' + id + '|' + expr + '|' + (talk ? 1 : 0), () => Art.bw(C.bigRaw(id, expr, talk)));
  C.portrait = function (id, expr, talk) {
    const d = C.defs[id]; if (!d || !d.big) return null;
    expr = expr || d.defaultExpr || 'normal';
    return Art.cached('por|' + id + '|' + expr + '|' + (talk ? 1 : 0), () => {
      const b = C.big(id, expr, talk);
      const ph = d.portraitH || 28;
      const crop = Art.crop(b, d.portraitX || 0, d.portraitY || 0, Math.min(b.width, 30), ph);
      return Art.scale(crop, 2);
    });
  };

  // =====================================================================
  //  PROTAGONIST — a small circle with stick legs and a stickman face
  // =====================================================================
  const YOU = { body: '#f4f4f6', shade: '#cfd0dc', hi: '#ffffff', ink: '#1a1a1a' };
  function youBody(view, expr) {
    const p = new Pix(11, 11);
    p.circle(5, 5, 5, YOU.body);
    for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
      const dx = x - 5, dy = y - 5;
      if (dx * dx + dy * dy <= 27 && dx * dx + dy * dy > 12 && dx + dy > 3) p.px(x, y, YOU.shade);
    }
    p.px(3, 2, YOU.hi); p.px(2, 3, YOU.hi);
    const k = YOU.ink;
    if (view === 'front') {
      if (expr === 'closed') { p.hl(2, 3, 5, k); p.hl(7, 8, 5, k); }
      else { p.vl(3, 4, 5, k); p.vl(7, 4, 5, k); }
      if (expr === 'smile') { p.px(3, 7, k); p.hl(4, 6, 8, k); p.px(7, 7, k); }
      else if (expr === 'o') { p.rect(4, 7, 2, 2, k); }
      else p.hl(4, 6, 7, k);
    } else if (view === 'side') {
      p.vl(2, 4, 5, k); p.hl(1, 2, 7, k);
    }
    return p.c;
  }
  function youLegs(g, view, f) {
    g.fillStyle = YOU.ink;
    const P = (x, y) => g.fillRect(x, y, 1, 1);
    if (view === 'side') {
      if (f === 1) { P(5, 13); P(4, 14); P(3, 15); P(2, 15); P(7, 13); P(8, 14); P(9, 15); P(8, 15); }
      else if (f === 2) { P(6, 13); P(6, 14); P(6, 15); P(5, 15); P(7, 13); P(7, 14); P(8, 15); P(7, 15); }
      else { P(5, 13); P(5, 14); P(5, 15); P(4, 15); P(7, 13); P(7, 14); P(7, 15); P(6, 15); }
    } else {
      const l = f === 1 ? 1 : 0, r = f === 2 ? 1 : 0;
      for (let y = 13; y < 16 - l; y++) P(4, y); P(3, 15 - l);
      for (let y = 13; y < 16 - r; y++) P(8, y); P(9, 15 - r);
    }
  }
  C.def('you', {
    name: '', voice: 'none', noOutline: true,
    ow(view, f, dir, expr) {
      const body = Art.outline(youBody(view, expr), '#1a1a1a');
      const c = U.mk(13, 16);
      c.g.drawImage(body, 0, 0);
      youLegs(c.g, view, f);
      return c;
    },
  });
  C.you = (dir, frame, expr) => Art.cached('you|' + dir + '|' + frame + '|' + (expr || ''), () => {
    if (dir === 'right') return Art.flip(C.you('left', frame, expr));
    const view = dir === 'up' ? 'back' : dir === 'down' ? 'front' : 'side';
    return C.defs.you.ow(view, frame, dir, expr);
  });
  // HANDS (genocide weapon) — floating cartoon gloves
  C.hand = (flip, red) => Art.cached('hand|' + flip + '|' + red, () => {
    const p = new Pix(8, 8);
    const w = red ? '#f0e6e6' : '#ffffff', s = red ? '#b89a9a' : '#c8c8d0';
    p.rect(1, 3, 6, 4, w); p.rect(1, 1, 1, 3, w); p.rect(3, 0, 1, 4, w); p.rect(5, 1, 1, 3, w); p.rect(0, 4, 1, 2, w);
    p.hl(1, 6, 6, s); p.px(2, 3, s); p.px(4, 3, s);
    p.rect(2, 7, 4, 1, red ? '#7a1010' : '#8a8aa0');
    let c = Art.outline(p.c, red ? '#3a0606' : OL);
    return flip ? Art.flip(c) : c;
  });
  // the battle SOUL: a red core with a glint
  C.soul = (col) => Art.cached('soul|' + (col || ''), () => {
    const p = new Pix(9, 9);
    p.circle(4, 4, 4, col || '#ff2424');
    p.px(2, 2, '#ffffff'); p.px(3, 2, '#ffd0d0'); p.px(2, 3, '#ffd0d0');
    p.px(6, 6, '#a00000'); p.px(5, 7, '#b00808'); p.px(7, 5, '#b00808');
    return p.c;
  });

  // =====================================================================
  //  SUN — floating cartoon sun with a stickman face
  // =====================================================================
  function sunArt(big, expr, step) {
    const R = big ? 10.5 : 4.6, L = big ? 6.5 : 3.2, N = 10;
    const S = Math.ceil((R + L) * 2) + 2;
    const p = new Pix(S, S), c = S / 2;
    const rot = step * (Math.PI * 2 / N) / 6;
    const body = '#ffd83a', shade = '#f2ae1e', ray = '#ffc42e', rayD = '#f09a1a', hi = '#fff3a8';
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x + .5 - c, dy = y + .5 - c, d = Math.hypot(dx, dy);
      if (d <= R + .2) { p.px(x, y, (dx + dy > R * .95) ? shade : body); continue; }
      if (d <= R + L) {
        const per = Math.PI * 2 / N;
        let a = Math.atan2(dy, dx) - rot; a = ((a % per) + per) % per - per / 2;
        const wdt = (1 - (d - R) / L) * per * .42 + .02;
        if (Math.abs(a) < wdt) p.px(x, y, a > 0 ? rayD : ray);
      }
    }
    const ci = Math.floor(c), k = '#1c1208';
    if (big) {
      p.px(ci - 5, ci - 5, hi); p.px(ci - 4, ci - 6, hi); p.px(ci - 6, ci - 4, hi);
      const ex1 = ci - 4, ex2 = ci + 2, ey = ci - 3;
      const eye = (x, t) => {
        if (t === 'dot') p.rect(x, ey, 2, 3, k);
        else if (t === 'happy') { p.px(x - 1, ey + 2, k); p.hl(x, x + 1, ey + 1, k); p.px(x + 2, ey + 2, k); }
        else if (t === 'narrow') { p.hl(x - 1, x + 2, ey + 1, k); p.hl(x, x + 1, ey + 2, k); }
        else if (t === 'evil') { p.rect(x - 1, ey - 1, 4, 5, k); p.px(x + (x < ci ? 2 : 0), ey + 1, '#ffffff'); }
        else if (t === 'x') { p.px(x - 1, ey, k); p.px(x + 2, ey, k); p.hl(x, x + 1, ey + 1, k); p.px(x - 1, ey + 2, k); p.px(x + 2, ey + 2, k); }
        else if (t === 'wide') { p.rect(x - 1, ey - 1, 3, 4, k); p.px(x - 1, ey - 1, '#ffffff'); }
        else if (t === 'flat') p.hl(x - 1, x + 2, ey + 1, k);
      };
      const E = {
        happy: ['dot', 'dot', 'smile'], wink: ['happy', 'dot', 'smile'], grin: ['narrow', 'narrow', 'grin'],
        evil: ['evil', 'evil', 'teeth'], hurt: ['x', 'x', 'wobble'], annoyed: ['flat', 'flat', 'flat'],
        surprised: ['wide', 'wide', 'o'], laugh: ['happy', 'happy', 'open'], sly: ['dot', 'narrow', 'smirk'],
        blank: ['dot', 'dot', 'flat'], scared: ['wide', 'wide', 'wobble'], sad: ['dot', 'dot', 'frown'],
      }[expr] || ['dot', 'dot', 'smile'];
      eye(ex1, E[0]); eye(ex2, E[1]);
      const my = ci + 2, m = E[2];
      if (m === 'smile') { p.px(ci - 5, my, k); p.px(ci - 4, my + 1, k); p.hl(ci - 3, ci + 2, my + 2, k); p.px(ci + 3, my + 1, k); p.px(ci + 4, my, k); }
      else if (m === 'open') { p.px(ci - 5, my, k); p.hl(ci - 4, ci + 3, my + 1, k); p.hl(ci - 3, ci + 2, my + 2, k); p.hl(ci - 2, ci + 1, my + 3, '#c2304a'); p.px(ci + 4, my, k); }
      else if (m === 'grin' || m === 'teeth') {
        p.rect(ci - 6, my, 12, 4, k);
        for (let i = 0; i < 6; i++) { p.px(ci - 6 + i * 2, my, '#fff'); p.px(ci - 5 + i * 2, my + 1, '#fff'); }
        if (m === 'teeth') for (let i = 0; i < 6; i++) { p.px(ci - 6 + i * 2 + 1, my + 3, '#fff'); p.px(ci - 6 + i * 2, my + 2, '#fff'); }
        p.px(ci - 7, my - 1, k); p.px(ci + 6, my - 1, k);
      }
      else if (m === 'wobble') { for (let i = -4; i <= 4; i++) p.px(ci + i, my + 2 + (i & 1), k); }
      else if (m === 'flat') p.hl(ci - 3, ci + 2, my + 2, k);
      else if (m === 'o') p.rect(ci - 1, my + 1, 3, 3, k);
      else if (m === 'smirk') { p.hl(ci - 2, ci + 3, my + 2, k); p.px(ci + 4, my + 1, k); }
      else if (m === 'frown') { p.hl(ci - 3, ci + 2, my + 1, k); p.px(ci - 4, my + 2, k); p.px(ci + 3, my + 2, k); }
    } else {
      p.px(ci - 2, ci - 2, hi);
      if (expr === 'grin' || expr === 'evil') {
        p.hl(ci - 3, ci - 1, ci - 1, k); p.hl(ci + 1, ci + 3, ci - 1, k);
        p.hl(ci - 3, ci + 3, ci + 1, k); p.px(ci - 2, ci + 1, '#fff'); p.px(ci, ci + 1, '#fff'); p.px(ci + 2, ci + 1, '#fff'); p.hl(ci - 2, ci + 2, ci + 2, k);
      } else {
        p.vl(ci - 2, ci - 2, ci - 1, k); p.vl(ci + 2, ci - 2, ci - 1, k);
        p.px(ci - 3, ci + 1, k); p.hl(ci - 2, ci + 2, ci + 2, k); p.px(ci + 3, ci + 1, k);
      }
    }
    return p.c;
  }
  C.def('sun', {
    name: 'Sun', voice: 'sun', defaultExpr: 'happy', outline: '#2a1606', noFlip: true,
    ow(view, f) { return sunArt(false, 'happy', f % 6); },
    big(expr, talk) {
      if (talk && (expr === 'happy' || expr === 'wink')) expr = expr === 'happy' ? 'laugh' : expr;
      return sunArt(true, expr, 0);
    },
    portraitH: 37,
  });
  C.sunFrame = (big, expr, step) => Art.cached('sunf|' + big + '|' + expr + '|' + step, () => Art.outline(sunArt(big, expr, step), '#2a1606'));
  C.sunBW = (expr, step) => Art.cached('sunbw|' + expr + '|' + step, () => Art.bw(sunArt(true, expr, step)));

  // =====================================================================
  //  HUMANOID TEMPLATES (blocky avatar proportions)
  // =====================================================================
  // ---- overworld 16 x (17 + legH) ----
  function owBody(p, view, f, c) {
    const legH = c.legH || 8, y0 = 17, yEnd = y0 + legH - 1;
    const sk = c.skin, skD = c.skinD;
    if (view !== 'side') {
      // legs
      const legs = [[4, f === 1 ? 1 : 0], [8, f === 2 ? 1 : 0]];
      if (!c.robe) for (const [lx, lift] of legs) {
        const e = yEnd - lift;
        p.rect(lx, y0, 4, e - y0 + 1, c.pants);
        if (c.legSkin) p.rect(lx, y0 + c.legSkin[0], 4, c.legSkin[1], sk);
        p.rect(lx, e - 1, 4, 2, c.shoes);
        p.vl(lx === 4 ? 7 : 11, y0, e - 2, c.pantsD);
        if (c.legSkin) p.vl(lx === 4 ? 7 : 11, y0 + c.legSkin[0], y0 + c.legSkin[0] + c.legSkin[1] - 1, skD);
      }
      else {
        for (let y = 16; y <= yEnd; y++) { const k = Math.floor((y - 16) / 4); p.hl(4 - k, 11 + k, y, c.top); p.px(11 + k, y, c.topD); }
        p.hl(4 - Math.floor((yEnd - 16) / 4), 11 + Math.floor((yEnd - 16) / 4), yEnd, c.trim || c.topD);
      }
      // torso
      p.rect(4, 9, 8, 8, c.top); p.vl(11, 9, 16, c.topD);
      // arms
      const arm = (ax, col, short) => {
        const len = short ? 7 : 8;
        p.rect(ax, 9, 3, len, sk);
        p.rect(ax, 9, 3, Math.min(len, c.sleeve != null ? c.sleeve : 3), col);
      };
      arm(1, view === 'back' ? (c.armR || c.top) : (c.armL || c.top), f === 2);
      arm(12, view === 'back' ? (c.armL || c.top) : (c.armR || c.top), f === 1);
      p.vl(14, 9, 9 + (c.sleeve != null ? c.sleeve : 3) - 1, c.topD);
      // head
      p.rect(4, 1, 8, 8, sk); p.vl(11, 1, 8, skD);
      p.clear(4, 1, 1, 1); p.clear(11, 1, 1, 1); p.clear(4, 8, 1, 1); p.clear(11, 8, 1, 1);
    } else {
      const near = f === 1 ? 4 : f === 2 ? 8 : 6, far = f === 1 ? 9 : f === 2 ? 4 : 7;
      if (!c.robe) {
        const leg = (lx, col, lift) => {
          const e = yEnd - lift;
          p.rect(lx, y0, 4, e - y0 + 1, col);
          if (c.legSkin) p.rect(lx, y0 + c.legSkin[0], 4, c.legSkin[1], col === c.pants ? sk : skD);
          p.rect(lx - 1, e - 1, 5, 2, c.shoes);
        };
        leg(far, c.pantsD, f ? 1 : 0); leg(near, c.pants, 0);
      } else {
        for (let y = 16; y <= yEnd; y++) { const k = Math.floor((y - 16) / 4); p.hl(5 - k, 11 + Math.floor(k / 2), y, c.top); }
        p.hl(5 - Math.floor((yEnd - 16) / 4), 11 + Math.floor((yEnd - 16) / 8), yEnd, c.trim || c.topD);
      }
      p.rect(6, 9, 5, 8, c.top); p.vl(10, 9, 16, c.topD);
      p.rect(5, 1, 7, 8, sk); p.vl(11, 1, 8, skD);
      p.clear(5, 1, 1, 1); p.clear(11, 1, 1, 1); p.clear(5, 8, 1, 1); p.clear(11, 8, 1, 1);
      const ax = f === 1 ? 8 : f === 2 ? 6 : 7;
      p.rect(ax, 9, 3, 8, sk); p.rect(ax, 9, 3, c.sleeve != null ? c.sleeve : 3, c.armL || c.top);
      p.vl(ax + 2, 9, 16, c.sleeve >= 8 ? c.topD : skD);
    }
  }
  // ---- big (battle / portrait) 28 x (30 + legH) ----
  function bigBody(p, c) {
    const legH = c.legH || 14, y0 = 30, yEnd = y0 + legH - 1;
    const sk = c.skin, skD = c.skinD;
    if (!c.robe) {
      for (const lx of [6, 14]) {
        p.rect(lx, y0, 8, legH, c.pants);
        p.vl(lx + 7, y0, yEnd, c.pantsD);
        if (c.legSkin) { p.rect(lx, y0 + c.legSkin[0], 8, c.legSkin[1], sk); p.vl(lx + 7, y0 + c.legSkin[0], y0 + c.legSkin[0] + c.legSkin[1] - 1, skD); }
        p.rect(lx, yEnd - 2, 8, 3, c.shoes); p.hl(lx, lx + 7, yEnd, c.shoesD || c.pantsD);
      }
    } else {
      for (let y = 28; y <= yEnd; y++) { const k = Math.floor((y - 28) / 3); p.hl(6 - k, 21 + k, y, c.top); p.hl(18 + k, 21 + k, y, c.topD); }
      const kk = Math.floor((yEnd - 28) / 3); p.hl(6 - kk, 21 + kk, yEnd, c.trim); p.hl(6 - kk, 21 + kk, yEnd - 1, c.trim);
    }
    p.rect(6, 16, 16, 14, c.top); p.rect(20, 16, 2, 14, c.topD);
    const arm = (ax, col) => {
      p.rect(ax, 16, 5, 14, sk);
      p.rect(ax, 16, 5, c.sleeve != null ? c.sleeve : 6, col);
      p.vl(ax === 1 ? 1 : 26, 16, 29, ax === 1 ? null : skD);
      if ((c.sleeve != null ? c.sleeve : 6) >= 11) p.vl(ax === 1 ? 1 : 26, 16, 15 + c.sleeve, c.topD);
      p.vl(ax + 2, 28, 29, skD);
    };
    arm(1, c.armL || c.top); arm(22, c.armR || c.top);
    if (c.cuffs) { p.hl(1, 5, 16 + c.sleeve - 1, c.cuffs); p.hl(22, 26, 16 + c.sleeve - 1, c.cuffs); }
    p.rect(6, 2, 16, 14, sk); p.rect(20, 2, 2, 14, skD);
    [[6, 2], [7, 2], [6, 3], [21, 2], [20, 2], [21, 3], [6, 15], [21, 15]].forEach(([x, y]) => p.clear(x, y, 1, 1));
  }
  const INK = '#120c14';
  function eye(p, x, t, k) {
    k = k || INK; const y = 8;
    switch (t) {
      case 'dot': p.rect(x, y, 2, 3, k); break;
      case 'happy': p.px(x - 1, y + 2, k); p.hl(x, x + 1, y + 1, k); p.px(x + 2, y + 2, k); break;
      case 'closed': p.hl(x - 1, x + 2, y + 2, k); break;
      case 'wide': p.rect(x - 1, y - 1, 3, 4, k); p.px(x - 1, y - 1, '#ffffff'); break;
      case 'small': p.rect(x, y + 1, 1, 2, k); break;
      case 'half': p.rect(x, y + 1, 2, 2, k); p.hl(x - 1, x + 2, y, k); break;
      case 'x': p.px(x - 1, y, k); p.px(x + 2, y, k); p.hl(x, x + 1, y + 1, k); p.px(x - 1, y + 2, k); p.px(x + 2, y + 2, k); break;
      case 'none': break;
    }
  }
  function brows(p, t, k) {
    k = k || INK; const L = 10, R = 16;
    if (t === 'angry') { p.hl(L - 1, L, 6, k); p.hl(L + 1, L + 2, 7, k); p.hl(R - 1, R, 7, k); p.hl(R + 1, R + 2, 6, k); }
    else if (t === 'sad') { p.hl(L - 1, L, 7, k); p.hl(L + 1, L + 2, 6, k); p.hl(R - 1, R, 6, k); p.hl(R + 1, R + 2, 7, k); }
    else if (t === 'flat') { p.hl(L - 1, L + 2, 6, k); p.hl(R - 1, R + 2, 6, k); }
    else if (t === 'up') { p.hl(L - 1, L + 2, 5, k); p.hl(R - 1, R + 2, 5, k); }
    else if (t === 'one') { p.hl(L - 1, L + 2, 6, k); p.hl(R - 1, R + 2, 5, k); }
  }
  function mouth(p, t, k, tongue) {
    k = k || INK; tongue = tongue || '#d8506e';
    switch (t) {
      case 'smile': p.px(10, 12, k); p.px(17, 12, k); p.hl(11, 16, 13, k); break;
      case 'soft': p.px(11, 12, k); p.px(16, 12, k); p.hl(12, 15, 13, k); break;
      case 'grin': p.px(10, 12, k); p.px(17, 12, k); p.hl(11, 16, 13, k); p.hl(12, 15, 14, k); p.hl(13, 14, 14, tongue); break;
      case 'open': p.rect(12, 12, 4, 3, k); p.hl(13, 14, 14, tongue); break;
      case 'flat': p.hl(11, 16, 13, k); break;
      case 'frown': p.hl(11, 16, 12, k); p.px(10, 13, k); p.px(17, 13, k); break;
      case 'o': p.rect(13, 12, 2, 2, k); break;
      case 'tongue': p.px(10, 12, k); p.px(17, 12, k); p.hl(11, 16, 13, k); p.rect(14, 14, 2, 1, tongue); p.px(15, 15, tongue); break;
      case 'zigzag': [[10, 13], [11, 12], [12, 13], [13, 12], [14, 13], [15, 12], [16, 13], [17, 12]].forEach(([x, y]) => p.px(x, y, k)); break;
      case 'zigopen': p.rect(10, 12, 8, 3, k); [10, 12, 14, 16].forEach(x => p.px(x, 12, '#f4f4f4')); [11, 13, 15, 17].forEach(x => p.px(x, 14, '#f4f4f4')); break;
      case 'smirk': p.hl(12, 16, 13, k); p.px(17, 12, k); break;
      case 'wobble': [[10, 13], [11, 12], [12, 12], [13, 13], [14, 13], [15, 12], [16, 12], [17, 13]].forEach(([x, y]) => p.px(x, y, k)); break;
    }
  }
  function face(p, e, talk, opts) {
    opts = opts || {};
    eye(p, 10, e[0], opts.ink); eye(p, 16, e[1] || e[0], opts.ink);
    brows(p, e[3], opts.brow || opts.ink);
    let m = e[2];
    if (talk) m = opts.talk ? opts.talk(m) : (m === 'grin' || m === 'open' || m === 'zigopen' ? m : 'open');
    mouth(p, m, opts.ink, opts.tongue);
    if (opts.blush && e[4] === 'blush') { p.hl(8, 9, 12, opts.blush); p.hl(18, 19, 12, opts.blush); }
  }

  // =====================================================================
  //  PRINCESS CALIA — goggle cap, long black hair, brown vest & pants, sword
  // =====================================================================
  const CAL = {
    skin: '#f6e1dc', skinD: '#e2c6c0', hair: '#17121c', hairH: '#2e2636', cap: '#6a4428', capD: '#4a2e1a', capH: '#84583a',
    gold: '#d8ac44', goldD: '#a37c26', lens: '#9cc0d2', lensD: '#5a7c90', vest: '#4e3221', vestD: '#3a2416', strap: '#6e4a2c',
    shirt: '#ececf0', shirtD: '#c4c4cc', armor: '#7c828e', armorD: '#5a606c', pants: '#3e2a1a', pantsD: '#2c1d11', boot: '#5c3a20', bootD: '#40280f',
    blade: '#dfe6f0', bladeD: '#9aa6b8', glow: '#7fd8ff',
  };
  C.def('calia', {
    name: 'Calia', voice: 'calia', defaultExpr: 'normal',
    ow(view, f) {
      const c = CAL, p = new Pix(16, 25);
      if (view === 'front') {
        p.rect(3, 2, 10, 12, c.hair);
        owBody(p, view, f, { skin: c.skin, skinD: c.skinD, top: c.vest, topD: c.vestD, armL: c.armor, armR: c.shirt, sleeve: 7, pants: c.pants, pantsD: c.pantsD, shoes: c.boot, legH: 8 });
        p.rect(7, 9, 2, 6, c.shirt); p.px(5, 11, c.gold); p.px(10, 11, c.gold); p.hl(4, 11, 15, c.strap); p.hl(7, 8, 15, c.gold);
        p.rect(4, 0, 8, 3, c.cap); p.hl(5, 10, 0, c.capH); p.vl(11, 0, 2, c.capD);
        p.hl(4, 11, 2, c.goldD); p.hl(5, 6, 2, c.lens); p.hl(9, 10, 2, c.lens);
        p.hl(4, 11, 3, c.hair); p.px(7, 3, c.skin); p.px(8, 3, c.skin);
        p.vl(4, 4, 9, c.hair); p.vl(11, 4, 9, c.hair); p.vl(3, 3, 11, c.hair); p.vl(12, 3, 11, c.hair);
        p.px(6, 5, INK); p.px(9, 5, INK); p.px(6, 4, c.skinD); p.px(9, 4, c.skinD);
        p.hl(6, 9, 7, INK); p.px(7, 7, '#f0f0f0');
        p.px(14, 7, c.gold); p.px(15, 6, c.goldD);
        p.rect(14, 21, 1, 2, c.gold); p.rect(5, 23, 1, 1, c.gold);
      } else if (view === 'back') {
        owBody(p, view, f, { skin: c.skin, skinD: c.skinD, top: c.vest, topD: c.vestD, armL: c.armor, armR: c.shirt, sleeve: 7, pants: c.pants, pantsD: c.pantsD, shoes: c.boot, legH: 8 });
        p.line(13, 6, 3, 18, c.blade); p.line(14, 6, 4, 18, c.bladeD); p.rect(12, 5, 3, 2, c.gold);
        p.rect(4, 1, 8, 12, c.hair); p.rect(3, 3, 10, 8, c.hair); p.vl(8, 4, 12, c.hairH);
        p.rect(4, 0, 8, 3, c.cap); p.vl(11, 0, 2, c.capD); p.hl(4, 11, 2, c.goldD);
      } else {
        p.rect(9, 2, 4, 12, c.hair);
        owBody(p, view, f, { skin: c.skin, skinD: c.skinD, top: c.vest, topD: c.vestD, armL: c.shirt, sleeve: 7, pants: c.pants, pantsD: c.pantsD, shoes: c.boot, legH: 8 });
        p.rect(9, 2, 3, 10, c.hair); p.px(12, 3, c.hair);
        p.rect(5, 0, 7, 3, c.cap); p.hl(6, 10, 0, c.capH); p.hl(5, 11, 2, c.goldD); p.px(5, 2, c.lens); p.px(6, 2, c.lens);
        p.hl(5, 8, 3, c.hair); p.px(6, 5, INK); p.hl(5, 6, 7, INK);
        p.px(11, 7, c.gold); p.px(12, 6, c.goldD);
      }
      return p.c;
    },
    exprs: {
      normal: ['dot', 'dot', 'zigzag', 'angry'], soft: ['dot', 'dot', 'soft', 'flat'], angry: ['dot', 'dot', 'zigopen', 'angry'],
      sad: ['dot', 'dot', 'frown', 'sad'], surprised: ['wide', 'wide', 'o', 'up'], tired: ['half', 'half', 'flat', 'flat'],
      smile: ['happy', 'happy', 'smile', 'flat'], closed: ['closed', 'closed', 'flat', 'sad'], determined: ['dot', 'dot', 'zigzag', 'angry'],
    },
    big(expr, talk) {
      const c = CAL, p = new Pix(30, 46);
      p.rect(4, 3, 20, 26, c.hair);
      p.line(25, 4, 8, 40, c.bladeD); p.line(26, 4, 9, 40, c.blade); p.rect(24, 1, 4, 3, c.gold); p.rect(25, 4, 2, 3, c.goldD); p.px(26, 0, c.gold);
      bigBody(p, { skin: c.skin, skinD: c.skinD, top: c.vest, topD: c.vestD, armL: c.armor, armR: c.shirt, sleeve: 11, pants: c.pants, pantsD: c.pantsD, shoes: c.boot, shoesD: c.bootD, legH: 16 });
      // shirt, straps, buckles, belt
      p.rect(12, 16, 4, 11, c.shirt); p.vl(15, 16, 26, c.shirtD); p.px(11, 16, c.shirt); p.px(16, 16, c.shirt);
      p.vl(9, 17, 26, c.strap); p.vl(18, 17, 26, c.strap);
      p.rect(8, 19, 3, 2, c.gold); p.rect(17, 19, 3, 2, c.gold); p.px(9, 19, c.goldD); p.px(18, 19, c.goldD);
      p.rect(6, 26, 16, 2, c.strap); p.rect(12, 26, 4, 2, c.gold); p.px(13, 26, c.goldD);
      p.rect(6, 22, 3, 2, c.gold); p.rect(19, 22, 3, 2, c.gold);
      // armoured left sleeve (viewer's left), white right sleeve with cracks
      for (let y = 18; y < 26; y += 3) p.hl(1, 5, y, c.armorD);
      p.px(23, 19, c.shirtD); p.px(24, 20, c.shirtD); p.px(24, 23, c.shirtD); p.px(25, 24, c.shirtD);
      // boots with gold trim
      p.hl(6, 13, 40, c.gold); p.hl(14, 21, 40, c.gold); p.rect(6, 41, 8, 5, c.boot); p.rect(14, 41, 8, 5, c.boot); p.hl(6, 21, 45, c.bootD); p.vl(13, 41, 45, c.bootD);
      // aviator cap + goggles
      p.rect(6, 0, 16, 6, c.cap); p.hl(8, 19, 0, c.capH); p.rect(20, 0, 2, 6, c.capD); p.clear(6, 0, 1, 1); p.clear(21, 0, 1, 1);
      p.rect(5, 4, 18, 2, c.capD);
      p.rect(7, 2, 6, 4, c.gold); p.rect(15, 2, 6, 4, c.gold); p.rect(8, 3, 4, 2, c.lens); p.rect(16, 3, 4, 2, c.lens);
      p.px(8, 3, '#e8f6ff'); p.px(16, 3, '#e8f6ff'); p.px(11, 4, c.lensD); p.px(19, 4, c.lensD); p.hl(13, 14, 3, c.goldD);
      // bangs & side hair
      p.hl(6, 21, 6, c.hair); p.px(9, 7, c.hair); p.px(10, 7, c.hair); p.px(17, 7, c.hair); p.px(18, 7, c.hair); p.px(13, 7, c.hair);
      p.rect(5, 6, 2, 14, c.hair); p.rect(21, 6, 2, 14, c.hair); p.rect(6, 7, 1, 6, c.hair); p.rect(21, 7, 1, 6, c.hair);
      p.vl(5, 8, 18, c.hairH);
      face(p, this.exprs[expr] || this.exprs.normal, talk, { talk: m => m === 'zigzag' ? 'zigopen' : m === 'soft' || m === 'smile' ? 'open' : m === 'zigopen' ? m : 'open' });
      return p.c;
    },
  });

  // =====================================================================
  //  SUPERKENDAL — red cap, green #8 jersey, navy shorts, tuxedo cat "Socks"
  // =====================================================================
  const SK = {
    skin: '#f4f4f6', skinD: '#d4d4de', cap: '#d62c2c', capD: '#a81a1a', capH: '#f05050', hair: '#141414',
    jersey: '#2f7d34', jerseyD: '#1d5c22', jerseyH: '#3f9444', white: '#ffffff', shorts: '#2c3a6e', shortsD: '#1e2a52',
    shoe: '#ebe8f6', shoeD: '#b4add4', catB: '#18181c', catW: '#f2f2f2', catE: '#e8c63e', catN: '#e88aa0',
  };
  function skCatOW(p, x, y) {
    const c = SK;
    p.px(x, y, c.catB); p.px(x + 2, y, c.catB);
    p.px(x, y + 1, c.catE); p.px(x + 1, y + 1, c.catW); p.px(x + 2, y + 1, c.catE);
    p.px(x, y + 2, c.catB); p.px(x + 1, y + 2, c.catW); p.px(x + 2, y + 2, c.catB);
    p.hl(x, x + 2, y + 3, c.catB); p.px(x + 3, y + 2, c.catB); p.px(x + 3, y + 3, c.catB);
  }
  C.def('sk', {
    name: 'Superkendal', voice: 'sk', defaultExpr: 'happy',
    ow(view, f) {
      const c = SK, p = new Pix(16, 24);
      const base = { skin: c.skin, skinD: c.skinD, top: c.jersey, topD: c.jerseyD, armL: c.jersey, armR: c.jersey, sleeve: 3, pants: c.shorts, pantsD: c.shortsD, shoes: c.shoe, legH: 7, legSkin: [3, 2] };
      if (view === 'front') {
        owBody(p, view, f, base);
        p.hl(1, 3, 11, c.white); p.hl(12, 14, 11, c.white);
        p.px(5, 10, c.white); p.px(10, 10, c.white);
        p.rect(7, 11, 2, 4, c.white); p.px(7, 12, c.jerseyD); p.px(8, 14, c.jerseyD); p.px(8, 12, c.white);
        p.rect(4, 0, 8, 4, c.cap); p.hl(5, 10, 0, c.capH); p.vl(11, 0, 3, c.capD); p.hl(3, 12, 3, c.capD);
        p.px(7, 1, c.white); p.px(8, 1, c.white);
        p.vl(4, 4, 5, c.hair); p.vl(11, 4, 5, c.hair);
        p.vl(6, 5, 6, INK); p.vl(9, 5, 6, INK);
        p.px(6, 7, INK); p.px(9, 7, INK); p.hl(7, 8, 8, INK); p.px(9, 8, '#d8506e');
        skCatOW(p, 12, 5);
      } else if (view === 'back') {
        owBody(p, view, f, base);
        p.hl(1, 3, 11, c.white); p.hl(12, 14, 11, c.white);
        p.rect(7, 10, 2, 4, c.white); p.px(7, 11, c.jerseyD); p.px(8, 13, c.jerseyD);
        p.rect(4, 2, 8, 7, c.hair); p.rect(4, 0, 8, 3, c.cap); p.vl(11, 0, 2, c.capD);
        p.hl(0, 2, 8, SK.catB); p.px(0, 7, SK.catB); p.px(2, 7, SK.catB); p.px(3, 6, SK.catB); p.hl(0, 2, 6, SK.catB); p.px(1, 5, SK.catB);
      } else {
        owBody(p, view, f, base);
        p.rect(5, 0, 7, 4, c.cap); p.hl(6, 10, 0, c.capH); p.hl(3, 6, 3, c.capD); p.px(6, 1, c.white);
        p.rect(9, 3, 3, 4, c.hair);
        p.vl(6, 5, 6, INK); p.px(5, 7, INK); p.hl(6, 7, 8, INK);
        p.hl(7, 9, 11, c.white);
        skCatOW(p, 8, 5);
      }
      return p.c;
    },
    exprs: {
      happy: ['dot', 'dot', 'tongue'], excited: ['wide', 'wide', 'grin', 'up'], determined: ['dot', 'dot', 'grin', 'angry'],
      thinking: ['dot', 'dot', 'flat', 'one'], sad: ['dot', 'dot', 'frown', 'sad'], confused: ['dot', 'wide', 'wobble', 'one'],
      proud: ['happy', 'happy', 'grin'], shocked: ['wide', 'wide', 'o', 'up'], worried: ['small', 'small', 'wobble', 'sad'],
      teary: ['happy', 'happy', 'wobble', 'sad'],
    },
    big(expr, talk) {
      const c = SK, p = new Pix(30, 42);
      bigBody(p, { skin: c.skin, skinD: c.skinD, top: c.jersey, topD: c.jerseyD, armL: c.jersey, armR: c.jersey, sleeve: 6, pants: c.shorts, pantsD: c.shortsD, shoes: c.shoe, shoesD: c.shoeD, legH: 12, legSkin: [4, 4] });
      p.noise(6, 16, 14, 14, c.jerseyH, .12, 3); p.noise(6, 16, 14, 14, c.jerseyD, .1, 7);
      p.hl(1, 5, 19, c.white); p.hl(1, 5, 21, c.white); p.hl(22, 26, 19, c.white); p.hl(22, 26, 21, c.white);
      const star = (x, y) => { p.px(x + 1, y, c.white); p.hl(x, x + 2, y + 1, c.white); p.px(x, y + 2, c.white); p.px(x + 2, y + 2, c.white); };
      star(9, 17); star(16, 17);
      // number 8
      p.rect(11, 20, 6, 9, c.white); p.rect(13, 21, 2, 2, c.jersey); p.rect(13, 25, 2, 2, c.jersey);
      p.hl(11, 11, 20, c.jersey); p.px(16, 20, c.jersey); p.px(11, 24, c.jersey); p.px(16, 24, c.jersey); p.px(11, 28, c.jersey); p.px(16, 28, c.jersey);
      p.hl(6, 21, 29, c.jerseyD);
      // cap
      p.rect(6, 0, 16, 6, c.cap); p.hl(8, 19, 0, c.capH); p.rect(20, 0, 2, 6, c.capD); p.clear(6, 0, 1, 1); p.clear(21, 0, 1, 1);
      p.rect(4, 5, 20, 2, c.capD); p.hl(5, 22, 5, c.cap);
      p.rect(12, 1, 4, 3, c.white); p.rect(13, 2, 2, 1, c.cap);
      p.rect(6, 7, 2, 4, c.hair); p.rect(20, 7, 2, 4, c.hair);
      face(p, this.exprs[expr] || this.exprs.happy, talk, { tongue: '#e0506e' });
      // Socks the cat, perched on his shoulder
      const cx = 21, cy = 6;
      p.map([
        '.B...B.',
        'BB...BB',
        'BBBBBBB',
        'BYBWBYB',
        'BWWNWWB',
        '.BWWWB.',
        'BBWWWBB',
        'BBWWWBB',
        'BBWBWBB',
        'WWBBBWW',
      ], { B: c.catB, W: c.catW, Y: c.catE, N: c.catN }, cx, cy);
      p.px(28, 12, c.catB); p.px(29, 11, c.catB); p.px(29, 10, c.catB);
      return p.c;
    },
  });

  // =====================================================================
  //  FUNNYGUYDEV — messy hair, headphones, glasses, black polo, grey pants
  // =====================================================================
  const FG = {
    skin: '#8d5a3b', skinD: '#74482e', hair: '#111113', hairH: '#2a2a30', phones: '#1d1d22', phonesH: '#55555e',
    frame: '#0c0c0e', glint: '#dfe8f0', polo: '#19191d', poloD: '#0d0d10', collar: '#2e2e36', white: '#e8e8ec',
    crest: '#d8b040', crestR: '#c03030', pants: '#6c6c72', pantsD: '#54545a', shoe: '#ececf0', shoeD: '#a8a8b0',
  };
  C.def('fgd', {
    name: 'FunnyGuyDev', voice: 'fgd', defaultExpr: 'normal',
    ow(view, f) {
      const c = FG, p = new Pix(16, 24);
      const base = { skin: c.skin, skinD: c.skinD, top: c.polo, topD: c.poloD, armL: c.polo, armR: c.polo, sleeve: 3, pants: c.pants, pantsD: c.pantsD, shoes: c.shoe, legH: 7 };
      if (view === 'front') {
        owBody(p, view, f, base);
        p.px(7, 9, c.collar); p.px(8, 9, c.collar); p.px(5, 10, c.crest); p.px(10, 10, c.white);
        p.px(5, 13, c.white); p.px(7, 13, c.white); p.px(8, 13, c.white); p.px(10, 13, c.white);
        p.rect(4, 0, 8, 3, c.hair); p.px(5, -1 + 1, c.hair); p.px(4, 3, c.hair); p.px(6, 3, c.hair); p.px(9, 3, c.hair); p.px(11, 3, c.hair);
        p.px(3, 1, c.hair); p.px(12, 1, c.hair); p.px(7, 0, c.hairH);
        p.hl(4, 11, 0, c.phones); p.px(7, 0, c.phonesH);
        p.vl(3, 3, 6, c.phones); p.vl(12, 3, 6, c.phones);
        p.hl(5, 10, 5, c.frame); p.px(6, 5, c.glint); p.px(9, 5, c.glint);
        p.px(6, 7, INK); p.px(9, 7, INK); p.hl(7, 8, 8, INK);
      } else if (view === 'back') {
        owBody(p, view, f, base);
        p.rect(4, 0, 8, 8, c.hair); p.px(3, 2, c.hair); p.px(12, 2, c.hair); p.px(5, 8, c.hair); p.px(9, 8, c.hair);
        p.hl(4, 11, 1, c.phones); p.vl(3, 3, 6, c.phones); p.vl(12, 3, 6, c.phones);
        p.px(7, 9, c.collar); p.px(8, 9, c.collar);
      } else {
        owBody(p, view, f, base);
        p.rect(5, 0, 7, 3, c.hair); p.rect(9, 2, 3, 4, c.hair); p.px(4, 2, c.hair); p.px(5, 3, c.hair); p.px(12, 1, c.hair);
        p.rect(8, 3, 2, 4, c.phones); p.px(8, 3, c.phonesH); p.hl(8, 9, 0, c.phones);
        p.hl(4, 7, 5, c.frame); p.px(5, 5, c.glint);
        p.px(5, 7, INK); p.hl(5, 6, 8, INK);
      }
      return p.c;
    },
    exprs: {
      normal: ['dot', 'dot', 'smile'], grin: ['happy', 'happy', 'grin'], wink: ['dot', 'closed', 'smirk'], shut: ['closed', 'closed', 'smile'],
      serious: ['dot', 'dot', 'flat', 'flat'], dark: ['none', 'none', 'flat'], sad: ['closed', 'closed', 'frown', 'sad'],
      smirk: ['half', 'half', 'smirk'], surprised: ['wide', 'wide', 'o'],
    },
    big(expr, talk) {
      const c = FG, p = new Pix(30, 42);
      bigBody(p, { skin: c.skin, skinD: c.skinD, top: c.polo, topD: c.poloD, armL: c.polo, armR: c.polo, sleeve: 6, pants: c.pants, pantsD: c.pantsD, shoes: c.shoe, shoesD: c.shoeD, legH: 12 });
      // polo details
      p.tri(10, 16, 18, 16, 14, 20, c.collar); p.tri(11, 16, 17, 16, 14, 19, c.skin);
      p.px(14, 21, c.white); p.px(14, 23, c.white);
      p.rect(8, 18, 2, 2, c.crest); p.px(9, 19, c.crestR);
      p.px(18, 18, c.white); p.px(19, 19, c.white); p.px(18, 20, c.white);
      [8, 9, 10, 12, 13, 15, 16, 17, 19].forEach(x => p.px(x, 24, c.white));
      p.hl(6, 21, 28, c.collar); p.hl(1, 5, 21, c.collar); p.hl(22, 26, 21, c.collar);
      for (let y = 32; y < 41; y += 3) { p.px(9, y, c.pantsD); p.px(17, y + 1, c.pantsD); }
      // hair
      p.rect(6, 0, 16, 6, c.hair); p.rect(5, 2, 18, 4, c.hair);
      [6, 9, 12, 15, 18, 21].forEach(x => p.clear(x, 0, 1, 1));
      p.px(7, 0, c.hairH); p.px(13, 1, c.hairH); p.px(17, 0, c.hairH);
      [7, 9, 10, 13, 14, 15, 18, 20].forEach(x => p.px(x, 6, c.hair)); p.px(9, 7, c.hair); p.px(14, 7, c.hair); p.px(19, 7, c.hair);
      p.rect(5, 6, 2, 5, c.hair); p.rect(21, 6, 2, 5, c.hair);
      // headphones
      p.hl(7, 20, 0, c.phones); p.px(6, 1, c.phones); p.px(21, 1, c.phones); p.hl(10, 17, 0, c.phonesH);
      p.rect(3, 7, 4, 6, c.phones); p.rect(21, 7, 4, 6, c.phones); p.vl(3, 8, 11, c.phonesH); p.vl(24, 8, 11, c.phonesH);
      p.vl(5, 2, 7, c.phones); p.vl(22, 2, 7, c.phones);
      const e = this.exprs[expr] || this.exprs.normal;
      face(p, e, talk);
      // glasses (drawn over the eyes)
      const lens = (x) => {
        p.hl(x - 2, x + 3, 7, c.frame); p.hl(x - 2, x + 3, 11, c.frame); p.vl(x - 2, 7, 11, c.frame); p.vl(x + 3, 7, 11, c.frame);
        if (expr === 'dark') { p.rect(x - 1, 8, 4, 3, '#ffffff'); }
        else p.px(x + 2, 8, c.glint);
      };
      lens(10); lens(16); p.hl(13, 14, 8, c.frame);
      return p.c;
    },
  });

  // =====================================================================
  //  THE EX-QUEEN — long black hair, silver circlet, indigo robe
  // =====================================================================
  const EQ = { skin: '#f2dfd8', skinD: '#dac4bc', hair: '#1b1520', hairH: '#342a3c', circ: '#d0d4e4', gem: '#5cc0ff', robe: '#3e3372', robeD: '#2c2456', robeH: '#524490', trim: '#cfd2e4' };
  C.def('exqueen', {
    name: 'Ex-Queen', voice: 'exqueen', defaultExpr: 'kind',
    ow(view, f) {
      const c = EQ, p = new Pix(16, 27);
      const base = { skin: c.skin, skinD: c.skinD, top: c.robe, topD: c.robeD, armL: c.robe, armR: c.robe, sleeve: 7, robe: true, trim: c.trim, legH: 10 };
      if (view === 'front') {
        p.rect(3, 2, 10, 13, c.hair);
        owBody(p, view, f, base);
        p.vl(7, 10, 26, c.trim); p.px(6, 9, c.trim); p.px(9, 9, c.trim);
        p.rect(4, 0, 8, 3, c.hair); p.px(7, 1, c.hairH); p.hl(4, 11, 2, c.circ); p.px(7, 2, c.gem); p.px(8, 2, c.gem);
        p.vl(4, 3, 10, c.hair); p.vl(11, 3, 10, c.hair); p.vl(3, 3, 13, c.hair); p.vl(12, 3, 13, c.hair);
        p.px(6, 5, INK); p.px(9, 5, INK); p.hl(7, 8, 7, '#8a4a5a');
      } else if (view === 'back') {
        owBody(p, view, f, base);
        p.rect(4, 0, 8, 15, c.hair); p.rect(3, 3, 10, 10, c.hair); p.vl(8, 3, 14, c.hairH); p.hl(4, 11, 2, c.circ);
      } else {
        p.rect(8, 2, 5, 13, c.hair);
        owBody(p, view, f, base);
        p.rect(9, 0, 4, 12, c.hair); p.rect(5, 0, 6, 3, c.hair); p.hl(5, 10, 2, c.circ); p.px(5, 2, c.gem);
        p.px(6, 5, INK); p.px(5, 7, '#8a4a5a');
      }
      return p.c;
    },
    exprs: {
      kind: ['dot', 'dot', 'soft', 'flat'], happy: ['happy', 'happy', 'smile', 'flat'], worried: ['dot', 'dot', 'wobble', 'sad'],
      stern: ['dot', 'dot', 'flat', 'angry'], sad: ['closed', 'closed', 'frown', 'sad'], surprised: ['wide', 'wide', 'o', 'up'],
      angry: ['dot', 'dot', 'frown', 'angry'], tearful: ['happy', 'happy', 'wobble', 'sad'], hurt: ['half', 'half', 'frown', 'sad'],
    },
    big(expr, talk) {
      const c = EQ, p = new Pix(30, 46);
      p.rect(3, 3, 22, 26, c.hair);
      bigBody(p, { skin: c.skin, skinD: c.skinD, top: c.robe, topD: c.robeD, armL: c.robe, armR: c.robe, sleeve: 11, robe: true, trim: c.trim, legH: 16, cuffs: c.trim });
      // bell sleeves
      p.rect(0, 24, 6, 4, c.robe); p.rect(22, 24, 6, 4, c.robe); p.hl(0, 5, 27, c.trim); p.hl(22, 27, 27, c.trim);
      p.rect(2, 28, 3, 2, c.skin); p.rect(23, 28, 3, 2, c.skin);
      p.vl(13, 18, 45, c.trim); p.vl(14, 18, 45, c.trim);
      p.tri(9, 16, 19, 16, 14, 21, c.trim); p.tri(10, 16, 18, 16, 14, 20, c.skin);
      p.noise(6, 20, 7, 25, c.robeH, .08, 9); p.noise(15, 20, 6, 25, c.robeH, .08, 11);
      p.px(14, 21, c.gem); p.px(13, 22, c.gem);
      // hair + circlet
      p.rect(6, 0, 16, 5, c.hair); p.rect(5, 2, 18, 4, c.hair); p.clear(6, 0, 1, 1); p.clear(21, 0, 1, 1);
      p.vl(13, 0, 4, c.hairH); p.vl(14, 1, 4, c.hairH);
      p.hl(6, 21, 5, c.circ); p.hl(7, 20, 4, c.circ); p.rect(13, 3, 2, 3, c.gem); p.px(13, 3, '#c0ecff');
      p.rect(5, 5, 3, 20, c.hair); p.rect(20, 5, 3, 20, c.hair); p.px(8, 6, c.hair); p.px(19, 6, c.hair);
      p.vl(6, 8, 22, c.hairH); p.vl(21, 8, 22, c.hairH);
      face(p, this.exprs[expr] || this.exprs.kind, talk, { ink: '#1a1020' });
      if (expr !== 'angry' && expr !== 'stern') { p.px(9, 12, '#eec0c0'); p.px(18, 12, '#eec0c0'); }
      return p.c;
    },
  });

  // =====================================================================
  //  CATTY — orange cartoon cat, cream muzzle, very smug
  // =====================================================================
  const CT = { o: '#f59a2b', oD: '#d47a14', oH: '#ffb85c', cream: '#ffe6bd', creamD: '#efcf9a', ear: '#ffbf86', eye: '#ffffff', pupil: '#16121a', nose: '#c2406a', whisker: '#5a3a1a' };
  function cattyBig(expr, talk) {
    const c = CT, p = new Pix(36, 40);
    // tail
    const tail = [[27, 31], [29, 30], [31, 28], [32, 26], [33, 24], [33, 22], [32, 20], [31, 19]];
    tail.forEach(([x, y], i) => { p.rect(x, y, 3, 3, i > 5 ? c.oD : c.o); });
    // body
    p.ellipse(17, 31, 8, 6, c.o); p.ellipse(17, 32, 5, 4, c.cream);
    p.rect(11, 35, 4, 4, c.o); p.rect(20, 35, 4, 4, c.o); p.hl(10, 15, 38, c.cream); p.hl(20, 25, 38, c.cream);
    // arms: one on hip
    p.rect(7, 27, 4, 3, c.o); p.rect(6, 29, 3, 4, c.o); p.rect(6, 32, 3, 2, c.cream);
    p.rect(24, 26, 4, 3, c.o); p.rect(26, 23, 3, 4, c.o);
    if (expr === 'scared') { p.rect(26, 21, 3, 3, c.cream); } else p.rect(26, 22, 3, 2, c.cream);
    // head
    p.tri(5, 11, 9, 0, 15, 7, c.o); p.tri(20, 7, 26, 0, 30, 11, c.o);
    p.tri(8, 8, 9.5, 3, 13, 7, c.ear); p.tri(22, 7, 25.5, 3, 27, 8, c.ear);
    p.ellipse(17, 13, 13, 10, c.o);
    for (let y = 4; y < 24; y++) for (let x = 4; x < 31; x++) { const dx = (x - 17) / 13, dy = (y - 13) / 10; if (dx * dx + dy * dy <= 1 && dx + dy > .75) p.px(x, y, c.oD); }
    p.px(14, 4, c.oD); p.px(16, 3, c.oD); p.px(15, 5, c.oD); p.px(19, 4, c.oD); p.px(18, 5, c.oD);
    p.ellipse(17, 17, 7, 4, c.cream); p.hl(12, 22, 21, c.creamD);
    const k = c.pupil;
    const eyeW = (x) => p.ellipse(x, 11, 3, 4, c.eye);
    const lid = (x) => { p.hl(x - 3, x + 3, 8, c.oD); p.hl(x - 3, x + 3, 9, c.oD); p.hl(x - 2, x + 2, 10, c.oD); };
    const E = expr;
    if (E === 'laugh') { [[9, 12], [10, 11], [11, 10], [12, 10], [13, 11], [14, 12]].forEach(([x, y]) => p.px(x, y, k)); [[20, 12], [21, 11], [22, 10], [23, 10], [24, 11], [25, 12]].forEach(([x, y]) => p.px(x, y, k)); }
    else if (E === 'hurt') { [[10, 9], [13, 12], [11, 10], [12, 11], [13, 9], [10, 12]].forEach(([x, y]) => p.px(x, y, k)); [[21, 9], [24, 12], [22, 10], [23, 11], [24, 9], [21, 12]].forEach(([x, y]) => p.px(x, y, k)); }
    else {
      eyeW(11); eyeW(23);
      if (E === 'shocked' || E === 'scared') { p.rect(11, 11, 1, 2, k); p.rect(23, 11, 1, 2, k); }
      else if (E === 'angry') { p.rect(12, 11, 2, 3, k); p.rect(21, 11, 2, 3, k); p.line(8, 7, 14, 9, c.oD); p.line(20, 9, 26, 7, c.oD); p.line(8, 8, 14, 10, c.oD); p.line(20, 10, 26, 8, c.oD); }
      else { p.rect(12, 11, 2, 3, k); p.rect(22, 11, 2, 3, k); p.px(12, 11, '#fff'); p.px(22, 11, '#fff'); if (E === 'smug' || E === 'smirk') { lid(11); lid(23); } }
      if (E === 'scared') { p.line(8, 9, 13, 7, c.oD); p.line(21, 7, 26, 9, c.oD); }
    }
    p.rect(16, 15, 3, 2, c.nose);
    const m = talk ? (E === 'scared' ? 'wob' : 'open') : ({ smug: 'smirk', smirk: 'smirk', laugh: 'open', angry: 'grr', shocked: 'o', scared: 'wob', hurt: 'wob', normal: 'smile' }[E] || 'smile');
    if (m === 'smirk') { p.hl(14, 19, 19, k); p.px(20, 18, k); p.px(21, 17, k); p.px(13, 18, k); }
    else if (m === 'smile') { p.px(13, 18, k); p.hl(14, 20, 19, k); p.px(21, 18, k); p.px(17, 18, k); }
    else if (m === 'open') { p.rect(14, 18, 7, 3, k); p.hl(15, 19, 20, '#d8506e'); p.px(14, 18, c.cream); p.px(20, 18, c.cream); }
    else if (m === 'grr') { p.rect(13, 18, 9, 2, k); for (let x = 13; x < 22; x += 2) p.px(x, 18, '#fff'); }
    else if (m === 'o') { p.rect(16, 18, 3, 3, k); }
    else if (m === 'wob') { [[13, 19], [14, 18], [15, 19], [16, 18], [17, 19], [18, 18], [19, 19], [20, 18], [21, 19]].forEach(([x, y]) => p.px(x, y, k)); }
    // whiskers
    p.line(3, 15, 9, 16, c.whisker); p.line(3, 18, 9, 17, c.whisker); p.line(26, 16, 32, 15, c.whisker); p.line(26, 17, 32, 18, c.whisker);
    if (E === 'scared') { p.rect(29, 6, 2, 3, '#8ad8ff'); p.px(30, 9, '#8ad8ff'); }
    return p.c;
  }
  C.def('catty', {
    name: 'Catty', voice: 'catty', defaultExpr: 'smug', portraitX: 0, portraitY: 0, portraitH: 26,
    ow(view, f) {
      const c = CT, p = new Pix(16, 20);
      p.tri(1, 5, 3, 0, 6, 3, c.o); p.tri(10, 3, 13, 0, 15, 5, c.o);
      p.ellipse(8, 6, 6.5, 5, c.o);
      const legL = f === 1 ? 1 : 0, legR = f === 2 ? 1 : 0;
      p.rect(5, 15, 2, 4 - legL, c.o); p.rect(10, 15, 2, 4 - legR, c.o); p.hl(5, 6, 18 - legL, c.cream); p.hl(10, 11, 18 - legR, c.cream);
      p.ellipse(8, 13, 4, 3.5, c.o); p.ellipse(8, 14, 2, 2, c.cream);
      p.line(12, 15, 15, 11, c.o); p.px(15, 10, c.oD);
      if (view === 'back') { p.px(5, 3, c.oD); p.px(8, 2, c.oD); p.px(11, 3, c.oD); return p.c; }
      p.ellipse(8, 8, 3, 2, c.cream);
      if (view === 'side') { p.px(4, 5, c.pupil); p.px(4, 6, c.pupil); p.px(2, 8, c.nose); return p.c; }
      p.px(5, 5, c.eye); p.px(5, 6, c.pupil); p.px(11, 5, c.eye); p.px(11, 6, c.pupil); p.hl(4, 6, 4, c.oD); p.hl(10, 12, 4, c.oD);
      p.px(8, 7, c.nose); p.hl(7, 9, 9, c.pupil); p.px(10, 8, c.pupil);
      return p.c;
    },
    big: cattyBig,
  });

  // =====================================================================
  //  Townsfolk (overworld only)
  // =====================================================================
  function npcSheep(view, f) { // Woolly the shopkeeper
    const p = new Pix(18, 20);
    const w = '#f4f2ee', wD = '#d6d2ca', face = '#3e3a46', horn = '#c9a46a';
    p.rect(5, 15, 2, 5 - (f === 1 ? 1 : 0), face); p.rect(11, 15, 2, 5 - (f === 2 ? 1 : 0), face);
    [[5, 10], [9, 8], [13, 10], [4, 14], [9, 14], [14, 14], [9, 11]].forEach(([x, y]) => p.circle(x, y, 4, w));
    [[13, 12], [14, 15], [10, 16]].forEach(([x, y]) => p.circle(x, y, 2, wD));
    if (view !== 'back') {
      p.ellipse(view === 'side' ? 5 : 9, 7, 3, 4, face);
      p.tri(3, 3, 6, 4, 4, 7, horn); p.tri(12, 4, 15, 3, 14, 7, horn);
      p.px(view === 'side' ? 4 : 8, 6, '#fff'); if (view !== 'side') p.px(10, 6, '#fff');
      p.rect(4, 11, 11, 2, '#c83a3a'); p.rect(12, 12, 2, 4, '#c83a3a');
    }
    [[6, 3], [9, 2], [12, 3]].forEach(([x, y]) => p.circle(x, y, 2, w));
    return p.c;
  }
  function npcBear(view, f) { // Mrs. Bearwell, innkeeper
    const p = new Pix(20, 26);
    const w = '#f2efe8', wD = '#d8d2c6', k = '#1a1418', ap = '#e8789a';
    p.rect(5, 21, 4, 5 - (f === 1 ? 1 : 0), w); p.rect(11, 21, 4, 5 - (f === 2 ? 1 : 0), w);
    p.ellipse(10, 16, 8, 7, w); p.ellipse(13, 18, 4, 4, wD);
    p.circle(4, 4, 2.5, w); p.circle(16, 4, 2.5, w);
    p.ellipse(10, 7, 7, 6, w);
    if (view !== 'back') {
      p.rect(5, 13, 10, 9, ap); p.rect(6, 12, 8, 2, ap); p.hl(5, 14, 21, '#c85a7a');
      p.ellipse(view === 'side' ? 6 : 10, 9, 3, 2, wD); p.px(view === 'side' ? 5 : 10, 8, k);
      if (view === 'side') p.px(6, 5, k); else { p.px(7, 6, k); p.px(13, 6, k); }
      p.px(4, 4, '#e8b8c0'); p.px(16, 4, '#e8b8c0');
    }
    return p.c;
  }
  function npcPip(view, f) { // a little snow sprite kid
    const p = new Pix(14, 16);
    const b = '#eef6ff', bD = '#c8dcf0', hat = '#3a6ad8', hatD = '#2a4aa8';
    p.rect(3, 13, 2, 3 - (f === 1 ? 1 : 0), bD); p.rect(9, 13, 2, 3 - (f === 2 ? 1 : 0), bD);
    p.ellipse(7, 9, 5.5, 5, b); p.ellipse(9, 11, 3, 2, bD);
    p.rect(2, 2, 10, 4, hat); p.hl(2, 11, 5, hatD); p.circle(7, 1, 1.5, '#ffffff');
    if (view === 'front') { p.rect(4, 8, 2, 2, '#1a1a2a'); p.rect(8, 8, 2, 2, '#1a1a2a'); p.px(4, 8, '#fff'); p.px(8, 8, '#fff'); p.hl(6, 7, 11, '#1a1a2a'); p.px(3, 10, '#ffb8c8'); p.px(10, 10, '#ffb8c8'); }
    if (view === 'side') { p.rect(3, 8, 2, 2, '#1a1a2a'); }
    return p.c;
  }
  function npcMoose(view, f) { // Old Antler
    const p = new Pix(22, 30);
    const fur = '#6e4c2e', furD = '#523620', coat = '#2f5a3e', coatD = '#224630', ant = '#e0d0a8', k = '#160e0a';
    p.rect(7, 25, 3, 5 - (f === 1 ? 1 : 0), furD); p.rect(12, 25, 3, 5 - (f === 2 ? 1 : 0), furD);
    p.rect(5, 14, 12, 12, coat); p.vl(16, 14, 25, coatD); p.vl(10, 15, 25, '#d8c070');
    p.rect(3, 15, 2, 8, coat); p.rect(17, 15, 2, 8, coat);
    p.ellipse(11, 9, 5, 5, fur);
    p.rect(0, 2, 6, 2, ant); p.rect(0, 0, 2, 3, ant); p.rect(3, 0, 1, 2, ant); p.rect(16, 2, 6, 2, ant); p.rect(20, 0, 2, 3, ant); p.rect(18, 0, 1, 2, ant);
    p.vl(6, 3, 6, ant); p.vl(15, 3, 6, ant);
    if (view !== 'back') {
      p.ellipse(view === 'side' ? 6 : 11, 12, 3, 3, furD); p.px(view === 'side' ? 5 : 10, 12, k); if (view !== 'side') p.px(12, 12, k);
      if (view === 'side') p.px(8, 8, k); else { p.px(9, 8, k); p.px(13, 8, k); p.hl(8, 9, 7, '#e8e8e8'); p.hl(13, 14, 7, '#e8e8e8'); }
      p.rect(9, 15, 4, 6, '#e4e0d4');
    }
    return p.c;
  }
  function npcGuard(view, f) { // royal guard trainee (Frostwood)
    const p = new Pix(16, 24);
    owBody(p, view, f, { skin: '#9ad4b0', skinD: '#7ab894', top: '#7a8494', topD: '#5c6474', armL: '#7a8494', armR: '#7a8494', sleeve: 8, pants: '#4a5262', pantsD: '#3a4252', shoes: '#2a2e38', legH: 7 });
    p.rect(4, 0, 8, 4, '#8c96a8'); p.hl(4, 11, 3, '#5c6474'); p.px(7, 0, '#d84a4a'); p.px(8, 0, '#d84a4a');
    if (view === 'front') { p.px(6, 5, INK); p.px(9, 5, INK); p.hl(7, 8, 7, INK); p.rect(7, 11, 2, 2, '#e8c840'); }
    if (view === 'side') { p.px(6, 5, INK); }
    return p.c;
  }
  C.def('woolly', { name: 'Woolly', voice: 'monster', ow: npcSheep });
  C.def('bearwell', { name: 'Mrs. Bearwell', voice: 'old', ow: npcBear });
  C.def('pip', { name: 'Pip', voice: 'kid', ow: npcPip });
  C.def('antler', { name: 'Old Antler', voice: 'old', ow: npcMoose });
  C.def('guard', { name: 'Guard', voice: 'monster', ow: npcGuard });
})();
