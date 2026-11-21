'use strict';
// ============================================================
//  Items, effects, HUD icons, object sprites
// ============================================================
(function () {
  const OL = '#140a18';
  const P = (w, h) => new AF.Pix(w, h);
  const S = AF.SPR = AF.SPR || {};

  function coinFrames(big) {
    const fr = [];
    const W = big ? 12 : 10, H = big ? 16 : 12;
    const widths = big ? [5.5, 4, 1.2, 4] : [4.5, 3.2, 1, 3.2];
    for (let i = 0; i < 4; i++) {
      const p = P(W + 2, H + 2), cx = (W + 2) / 2, cy = (H + 2) / 2, rx = widths[i], ry = H / 2;
      if (rx < 1.5) { p.rect(cx - 1, 1, 2, H, '#c88000'); p.rect(cx - 1, 1, 1, H, '#ffe070'); }
      else {
        p.ell(cx, cy, rx, ry, '#c87800'); p.ell(cx - .5, cy - .5, rx - .8, ry - .8, '#ffc828');
        p.ell(cx + .3, cy + .3, Math.max(.5, rx - 2.2), ry - 2.4, '#e8a000');
        if (rx > 3) { p.rect(Math.round(cx - .5), Math.round(cy - ry / 2), 1, Math.round(ry), '#ffe890'); }
        p.set(Math.round(cx - rx / 2), Math.round(cy - ry / 2), '#ffffff');
      }
      p.outline(OL);
      fr.push(p.spr(p.w / 2, p.h / 2));
    }
    return fr;
  }
  function heart(full, sz) {
    const rows = full === 2 ?
      ['.##.##.', '#WW#rr#', '#Wrrrr#', '#rrrrR#', '.#rrR#.', '..#R#..', '...#...'] :
      full ? ['.rr.rr.', 'rWWrrrr', 'rWrrrrr', 'rrrrrrR', '.rrrRR.', '..rRR..', '...R...'] :
        ['.kk.kk.', 'kddkddk', 'kdddddk', 'kdddddk', '.kdddk.', '..kdk..', '...k...'];
    return AF.strSpr(rows, { r: '#f02848', R: '#a01030', W: '#ffd0d8', k: '#4a3050', d: '#2a1a34', '#': '#f02848' }, { ax: 0, ay: 0 });
  }
  function medalFrames() {
    const fr = [];
    for (let i = 0; i < 4; i++) {
      const p = P(18, 18), rx = [7, 5, 2, 5][i];
      if (rx > 2) {
        p.ell(9, 9, rx, 7, '#a06000'); p.ell(9, 9, rx - 1, 6, '#ffc030'); p.ell(9, 9, Math.max(1, rx - 2.5), 4.5, '#e09010');
        p.ell(9, 9, Math.max(1, rx * .45), 2.5, i === 0 ? '#40e0ff' : '#30a0e0'); p.set(8, 8, '#ffffff');
        p.set(9 - Math.round(rx * .5), 4, '#fff0a0');
      } else { p.rect(8, 2, 2, 14, '#c88000'); p.rect(8, 2, 1, 14, '#ffe070'); }
      p.outline(OL);
      fr.push(p.spr(9, 9));
    }
    return fr;
  }
  function boomFrames() {
    const fr = [];
    for (let i = 0; i < 6; i++) {
      const p = P(32, 32), k = i / 5;
      const r = 5 + k * 11;
      if (i < 5) {
        p.circ(16, 16, r, i < 2 ? '#ffffff' : '#ff6020');
        p.circ(16, 16, r * .75, i < 2 ? '#fff0a0' : '#ffb030');
        if (i > 1) p.circ(16 - r * .2, 16 - r * .2, r * .4, '#fff0a0');
        if (i > 2) for (let a = 0; a < 8; a++) { const ang = a * .785 + i; p.circ(16 + Math.cos(ang) * r * .8, 16 + Math.sin(ang) * r * .8, r * .28, '#606070'); }
      } else { for (let a = 0; a < 7; a++) { const ang = a * .9; p.circ(16 + Math.cos(ang) * 12, 16 + Math.sin(ang) * 12, 3, '#505060'); } }
      fr.push(p.spr(16, 24));
    }
    return fr;
  }
  function hitFrames(big) {
    const fr = [];
    for (let i = 0; i < 3; i++) {
      const s = (big ? 14 : 9) * (1 - i * .25), p = P(32, 32);
      const pts = [];
      for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283, r = k & 1 ? s * .4 : s; pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]); }
      p.poly(pts, i === 2 ? '#ffb030' : '#ffffff');
      if (i < 2) { const pts2 = pts.map(([x, y]) => [16 + (x - 16) * .55, 16 + (y - 16) * .55]); p.poly(pts2, '#fff060'); }
      fr.push(p.spr(16, 16));
    }
    return fr;
  }
  function puffFrames() {
    const fr = [];
    for (let i = 0; i < 4; i++) { const p = P(16, 16), r = 3 + i * 1.5; p.circ(8 - r * .5, 8, r * .7, '#f0f0f0'); p.circ(8 + r * .5, 8, r * .7, '#f0f0f0'); p.circ(8, 7, r * .8, '#ffffff'); if (i > 1) p.circ(8, 8, r * .4, 0); fr.push(p.spr(8, 8)); }
    return fr;
  }
  function twinkle() {
    const fr = [];
    for (let i = 0; i < 3; i++) { const p = P(9, 9), s = [4, 3, 1][i]; p.rect(4, 4 - s, 1, s * 2 + 1, '#ffffff'); p.rect(4 - s, 4, s * 2 + 1, 1, '#ffffff'); p.set(4, 4, '#fff080'); fr.push(p.spr(4, 4)); }
    return fr;
  }
  function shockFrames() {
    const fr = [];
    for (let i = 0; i < 4; i++) { const p = P(64, 16), w = 12 + i * 8; for (let k = -1; k <= 1; k += 2) { const x = 32 + k * w; p.ell(x, 11, 4, 5 - i, '#ffffff'); p.ell(x, 12, 3, 3 - i * .6, '#c0e0ff'); } p.rect(32 - w, 14, w * 2, 2, '#e0e0e0'); fr.push(p.spr(32, 16)); }
    return fr;
  }

  AF.buildMiscArt = function () {
    S.coin = coinFrames(false);
    S.bigcoin = coinFrames(true);
    S.heartFull = heart(1); S.heartEmpty = heart(0);
    S.medal = medalFrames();
    S.fx = { boom: boomFrames(), hit: hitFrames(false), bighit: hitFrames(true), puff: puffFrames(), twinkle: twinkle(), shock: shockFrames() };
    { const p = P(6, 6); p.circ(3, 3, 2.5, '#a0e8ff'); p.set(2, 2, '#ffffff'); p.outline('#3080c0'); S.fx.bubble = [p.spr(3, 3)]; }
    // heart pickup
    { const p = P(12, 11); p.str(['.rr..rr.', 'rWrrrrRr', 'rWrrrrRr', 'rrrrrrRr', '.rrrrRR.', '..rrRR..', '...RR...'], { r: '#ff3050', R: '#b01030', W: '#ffd0e0' }, 2, 2); p.outline(OL); S.heart = p.spr(6, 11); }
    // energy orb
    S.orb = [];
    for (let i = 0; i < 2; i++) { const p = P(14, 14); p.shadeEll(7, 7, 5 + i * .5, 5 + i * .5, ['#1840c0', '#3a80f0', '#80c8ff', '#ffffff']); p.set(5, 4, '#ffffff'); p.outline(i ? '#a0f0ff' : '#0a1860'); S.orb.push(p.spr(7, 7)); }
    // 1UP
    { const f = AF.aaronFace(); const c = AF.makeCanvas(20, 26), x = c.getContext('2d'); x.drawImage(f.c, 1, 0); const t = AF.textImg('1UP', '#60ff60', '#103010'); x.drawImage(t, 10 - (t.width >> 1), 17); S.oneup = new AF.Spr(c, 10, 26); }
    // HUD icons
    { const p = P(9, 9); p.circ(4.5, 4.5, 3.5, '#ffc030'); p.circ(4.5, 4.5, 2, '#40c0ff'); p.set(3, 3, '#ffffff'); p.outline(OL); S.medalSmall = p.spr(0, 0); }
    { const p = P(9, 9); p.circ(4.5, 4.5, 3.5, '#3a2a48'); p.circ(4.5, 4.5, 2, '#2a1a38'); p.outline(OL); S.medalEmpty = p.spr(0, 0); }
    // energy cell icons
    { const p = P(7, 9); p.rect(1, 1, 5, 7, '#40a0ff'); p.rect(1, 1, 5, 2, '#a0e0ff'); p.outline(OL); S.cellFull = p.spr(0, 0); }
    { const p = P(7, 9); p.rect(1, 1, 5, 7, '#202040'); p.outline(OL); S.cellEmpty = p.spr(0, 0); }
    // energy wave projectile
    S.wave = [];
    for (let i = 0; i < 2; i++) { const p = P(20, 16); p.ell(12, 8, 7, 6, '#4090ff'); p.ell(13, 8, 5, 4.5, '#a0e0ff'); p.ell(14, 8, 3, 2.5, '#ffffff'); for (let k = 0; k < 3; k++) p.rect(2 + k * 2 + i, 6 + k, 6, 1, '#80c0ff'); p.outline('#102070'); S.wave.push(p.spr(10, 8)); }
    // artifact (ancient relic tablet with glowing gem)
    S.artifact = [];
    for (let i = 0; i < 2; i++) { const p = P(16, 18); p.rect(2, 3, 12, 14, '#8a6a3a'); p.rect(3, 2, 10, 1, '#8a6a3a'); p.rect(3, 4, 10, 12, '#c8a060'); p.circ(8, 9, 3, i ? '#ff60ff' : '#c040e0'); p.set(7, 8, '#ffffff'); p.rect(4, 14, 8, 1, '#8a6a3a'); p.rect(5, 5, 2, 1, '#8a6a3a'); p.outline(OL); S.artifact.push(p.spr(8, 17)); }
    // ability capsule (crystal orb on pedestal)
    S.capsule = [];
    for (let i = 0; i < 4; i++) { const p = P(22, 28); p.rect(5, 20, 12, 6, '#6a6a80'); p.rect(4, 19, 14, 2, '#a0a0b8'); p.rect(6, 25, 10, 2, '#4a4a60'); const hue = ['#ff6080', '#ffd040', '#60ff90', '#60c0ff'][i]; p.shadeEll(11, 11, 7, 7, ['#3a2060', hue, AF.mix(hue, '#ffffff', .5), '#ffffff']); p.rect(9, 6, 2, 2, '#ffffff'); p.outline(OL); S.capsule.push(p.spr(11, 27)); }

    // -------- objects --------
    // spring
    S.spring = [];
    for (let i = 0; i < 2; i++) { const p = P(18, 18), top = i ? 10 : 2; p.rect(2, top, 14, 4, '#f03030'); p.rect(2, top, 14, 1, '#ff9090'); p.rect(2, top + 3, 14, 1, '#a01818'); for (let y = top + 4; y < 15; y += 2) { p.rect(5, y, 8, 1, '#c0c0d0'); p.rect(5, y + 1, 8, 1, '#707088'); } p.rect(3, 15, 12, 3, '#505068'); p.rect(3, 15, 12, 1, '#9090a8'); p.outline(OL); S.spring.push(p.spr(9, 18)); }
    // mushrooms
    S.mushroom = [];
    for (let i = 0; i < 2; i++) { const p = P(30, 20), sq = i ? 3 : 0; p.rect(11, 10, 8, 10, '#f0e0c0'); p.rect(11, 10, 2, 10, '#c8b090'); p.ell(15, 9 + sq, 13, 8 - sq, '#d02848'); p.ell(14, 7 + sq, 11, 5.5 - sq, '#f04060'); p.ell(9, 6 + sq, 3, 2, '#ffffff'); p.ell(18, 5 + sq, 2.5, 1.8, '#ffffff'); p.ell(23, 9 + sq, 2, 1.5, '#ffffff'); p.rect(3, 13, 24, 1, '#901830'); p.outline(OL); S.mushroom.push(p.spr(15, 20)); }
    // checkpoint (lamp post)
    S.check = [];
    for (let i = 0; i < 2; i++) { const p = P(12, 34); p.rect(5, 8, 2, 24, '#5a5a70'); p.rect(5, 8, 1, 24, '#9a9ab0'); p.rect(2, 31, 8, 3, '#3a3a50'); p.circ(6, 5, 4, i ? '#ffe040' : '#5050a0'); p.circ(5, 4, 1.5, i ? '#ffffff' : '#8080c0'); p.rect(3, 9, 6, 1, '#3a3a50'); p.outline(OL); S.check.push(p.spr(6, 34)); }
    // goal: tall flag pole, flag frames (achmed flag -> aaron flag)
    S.goal = [];
    for (let i = 0; i < 2; i++) { const p = P(30, 52); p.rect(3, 4, 3, 46, '#c8c8d8'); p.rect(3, 4, 1, 46, '#ffffff'); p.circ(4.5, 3, 3, '#ffd040'); p.rect(0, 48, 10, 4, '#4a4a60');
      const fc = i ? ['#e82030', '#ff7060'] : ['#6020a0', '#a050e0'];
      p.poly([[6, 6], [28, 9], [26, 14], [28, 20], [6, 22]], fc[0]); p.poly([[6, 6], [28, 9], [27, 11], [6, 10]], fc[1]);
      if (i) { p.circ(15, 14, 4, '#f8c898'); p.rect(12, 10, 7, 3, '#6a3414'); p.set(17, 14, '#1a1438'); } else { p.circ(15, 14, 4, '#e0e0f0'); p.rect(12, 15, 7, 2, '#202020'); p.set(13, 13, '#ff2020'); p.set(17, 13, '#ff2020'); }
      p.outline(OL); S.goal.push(p.spr(5, 52)); }
    // crate & blocks
    { const p = P(16, 16); p.rect(0, 0, 16, 16, '#a86a30'); p.rect(1, 1, 14, 14, '#c88a48'); p.rect(1, 1, 14, 1, '#e8b070'); p.line(2, 2, 13, 13, '#8a5420'); p.line(13, 2, 2, 13, '#8a5420'); p.rect(0, 0, 16, 2, '#6a3a14'); p.rect(0, 14, 16, 2, '#6a3a14'); p.rect(0, 0, 2, 16, '#6a3a14'); p.rect(14, 0, 2, 16, '#6a3a14'); p.rect(0, 0, 16, 1, OL); p.rect(0, 15, 16, 1, OL); p.rect(0, 0, 1, 16, OL); p.rect(15, 0, 1, 16, OL); S.crate = p.spr(0, 0); }
    { const p = P(16, 16); p.rect(0, 0, 16, 16, '#58b8f0'); p.rect(1, 1, 14, 14, '#90d8ff'); p.poly([[1, 1], [14, 1], [1, 14]], '#b8ecff'); p.line(3, 11, 11, 3, '#ffffff'); p.rect(0, 0, 16, 1, '#2a5ab0'); p.rect(0, 15, 16, 1, '#2a5ab0'); p.rect(0, 0, 1, 16, '#2a5ab0'); p.rect(15, 0, 1, 16, '#2a5ab0'); S.iceblock = p.spr(0, 0); }
    { const p = P(16, 16); p.rect(0, 0, 16, 16, '#7a6a5a'); p.rect(1, 1, 14, 14, '#a8988a'); p.rect(1, 1, 14, 1, '#d0c0b0'); p.rect(4, 4, 8, 8, '#8a7a6a'); p.rect(5, 5, 6, 6, '#c8a050'); p.set(7, 7, '#fff0a0'); p.rect(0, 0, 16, 1, OL); p.rect(0, 15, 16, 1, OL); p.rect(0, 0, 1, 16, OL); p.rect(15, 0, 1, 16, OL); S.stoneblock = p.spr(0, 0); }
    // switch (floor button) & lever
    S.button = [];
    for (let i = 0; i < 2; i++) { const p = P(16, 8); p.rect(1, 5, 14, 3, '#5a5a70'); p.rect(1, 5, 14, 1, '#9090a8'); p.rect(4, i ? 4 : 1, 8, i ? 1 : 4, i ? '#40e060' : '#f04040'); p.rect(4, i ? 4 : 1, 8, 1, i ? '#a0ffb0' : '#ff9090'); p.outline(OL); S.button.push(p.spr(8, 8)); }
    S.lever = [];
    for (let i = 0; i < 2; i++) { const p = P(16, 16); p.rect(3, 11, 10, 5, '#6a6a80'); p.rect(3, 11, 10, 1, '#a0a0b8'); p.line(8, 12, i ? 13 : 3, 3, '#4a3a2a'); p.line(9, 12, i ? 14 : 4, 3, '#8a6a4a'); p.circ(i ? 13.5 : 3.5, 3, 2.2, i ? '#40e060' : '#f04040'); p.outline(OL); S.lever.push(p.spr(8, 16)); }
    // crystal switch (punchable)
    S.crystal = [];
    for (let i = 0; i < 2; i++) { const p = P(14, 20); const c = i ? ['#ffe060', '#fff8c0', '#ffffff'] : ['#3060a0', '#5090d0', '#90c8f0']; p.poly([[7, 1], [13, 8], [7, 19], [1, 8]], c[0]); p.poly([[7, 1], [7, 19], [1, 8]], c[1]); p.poly([[7, 1], [4, 7], [7, 9]], c[2]); p.outline(OL); S.crystal.push(p.spr(7, 20)); }
    // leaf platforms
    S.leaf = (() => { const p = P(36, 10); p.ell(18, 5, 17, 4, '#2c9028'); p.ell(18, 4, 15, 3, '#58c040'); p.line(3, 5, 33, 5, '#1e6a1c'); for (let k = 6; k < 32; k += 6) { p.line(k, 5, k + 3, 2, '#1e6a1c'); p.line(k, 5, k + 3, 8, '#1e6a1c'); } p.set(10, 3, '#a8f070'); p.set(20, 3, '#a8f070'); p.outline(OL); return p.spr(18, 2); })();
    S.leafY = (() => { const p = P(36, 10); p.ell(18, 5, 17, 4, '#c08018'); p.ell(18, 4, 15, 3, '#f0b830'); p.line(3, 5, 33, 5, '#906010'); for (let k = 6; k < 32; k += 6) { p.line(k, 5, k + 3, 2, '#906010'); p.line(k, 5, k + 3, 8, '#906010'); } p.outline(OL); return p.spr(18, 2); })();
    S.acorn = (() => { const p = P(10, 12); p.ell(5, 7, 4, 4.5, '#b06a28'); p.ell(4, 6, 2, 2.5, '#d8903c'); p.ell(5, 3, 4.5, 2.5, '#6a4018'); p.rect(5, 0, 1, 2, '#4a2a10'); p.outline(OL); return p.spr(5, 6); })();
    S.macorn = (() => { const p = P(12, 14); p.ell(6, 8, 5, 5, '#707888'); p.ell(5, 7, 2.5, 2.5, '#b0b8c8'); p.ell(6, 4, 5.5, 3, '#4a5060'); p.rect(5, 0, 2, 2, '#303040'); p.set(6, 9, '#ff3030'); p.outline(OL); return p.spr(6, 7); })();
    // mine cart
    S.cart = (() => { const p = P(28, 18); p.rect(2, 2, 24, 11, '#6a6a7a'); p.rect(3, 3, 22, 9, '#8a8a9a'); p.rect(3, 3, 22, 1, '#c0c0d0'); p.rect(2, 7, 24, 2, '#5a3a1a'); p.circ(7, 14, 3, '#303040'); p.circ(21, 14, 3, '#303040'); p.set(7, 14, '#a0a0b0'); p.set(21, 14, '#a0a0b0'); p.outline(OL); return p.spr(14, 18); })();
    // teleporter
    S.tele = [];
    for (let i = 0; i < 2; i++) { const p = P(24, 10); p.ell(12, 6, 11, 3.5, '#3a3a58'); p.ell(12, 5, 9, 2.5, i ? '#80ffe0' : '#30c0a0'); p.ell(12, 5, 5, 1.2, '#ffffff'); p.outline(OL); S.tele.push(p.spr(12, 10)); }
    // fan / vent
    S.fan = [];
    for (let i = 0; i < 2; i++) { const p = P(32, 10); p.rect(0, 2, 32, 8, '#4a4a60'); p.rect(0, 2, 32, 1, '#8a8aa0'); for (let x = 2 + i * 2; x < 30; x += 4) p.rect(x, 4, 2, 5, '#20202c'); p.outline(OL); S.fan.push(p.spr(16, 10)); }
    // grab bar handle
    S.grab = (() => { const p = P(8, 8); p.rect(3, 0, 2, 4, '#8a8aa0'); p.rect(0, 4, 8, 3, '#f0c020'); p.rect(0, 4, 8, 1, '#fff080'); p.outline(OL); return p.spr(4, 0); })();
    // laser emitter
    S.emitter = (() => { const p = P(12, 10); p.rect(1, 0, 10, 7, '#4a4a60'); p.rect(1, 0, 10, 2, '#8a8aa0'); p.rect(4, 7, 4, 3, '#202030'); p.set(5, 8, '#ff2040'); p.outline(OL); return p.spr(6, 0); })();
    // door (gate)
    S.door = (() => { const p = P(16, 48); p.rect(0, 0, 16, 48, '#3a3a50'); for (let x = 2; x < 16; x += 4) { p.rect(x, 0, 2, 48, '#8a8aa8'); p.rect(x, 0, 1, 48, '#c8c8e0'); } for (let y = 4; y < 48; y += 12) p.rect(0, y, 16, 2, '#5a5a78'); p.rect(0, 0, 1, 48, OL); p.rect(15, 0, 1, 48, OL); p.rect(0, 47, 16, 1, OL); return p.spr(0, 0); })();
    // geyser vent base
    S.vent = (() => { const p = P(20, 8); p.rect(2, 2, 16, 6, '#3a2a2a'); p.rect(2, 2, 16, 1, '#7a5a5a'); p.rect(6, 0, 8, 3, '#2a1818'); p.rect(7, 1, 6, 1, '#ff6020'); p.outline(OL); return p.spr(10, 8); })();
    // floating crate (wooden barrel)
    S.barrel = (() => { const p = P(20, 16); p.rect(1, 1, 18, 14, '#a86a30'); p.rect(1, 1, 18, 2, '#d89a58'); p.rect(5, 1, 2, 14, '#6a6a7a'); p.rect(13, 1, 2, 14, '#6a6a7a'); p.outline(OL); return p.spr(10, 16); })();
    // mirror (light puzzle) 4 orientations
    S.mirror = [];
    for (let i = 0; i < 2; i++) { const p = P(16, 16); p.rect(2, 12, 12, 4, '#8a6a3a'); p.rect(2, 12, 12, 1, '#c8a060'); if (i === 0) p.thick(3, 10, 12, 1, 1.2, '#c0e8ff'); else p.thick(3, 1, 12, 10, 1.2, '#c0e8ff'); p.outline(OL); S.mirror.push(p.spr(8, 16)); }
    S.receptor = [];
    for (let i = 0; i < 2; i++) { const p = P(16, 16); p.rect(1, 1, 14, 14, '#8a6a3a'); p.rect(2, 2, 12, 12, '#c89a50'); p.circ(8, 8, 4, i ? '#fff080' : '#5a3a1a'); if (i) p.circ(8, 8, 2, '#ffffff'); p.outline(OL); S.receptor.push(p.spr(8, 16)); }
    S.emitterSun = (() => { const p = P(16, 16); p.rect(1, 1, 14, 14, '#8a6a3a'); p.rect(2, 2, 12, 12, '#c89a50'); p.circ(8, 8, 5, '#ffd040'); p.circ(8, 8, 3, '#ffffff'); for (let a = 0; a < 8; a++) p.set(8 + Math.round(Math.cos(a * .785) * 6.5), 8 + Math.round(Math.sin(a * .785) * 6.5), '#ffa020'); p.outline(OL); return p.spr(8, 16); })();
    // rolling boulder
    S.boulder = [];
    for (let i = 0; i < 4; i++) { const p = P(32, 32); p.shadeEll(16, 16, 14, 14, ['#5a3a20', '#8a6038', '#b88a58', '#e0b880']); const a = i * Math.PI / 2; for (let k = 0; k < 3; k++) { const aa = a + k * 2.1; p.line(16 + Math.cos(aa) * 4, 16 + Math.sin(aa) * 4, 16 + Math.cos(aa) * 11, 16 + Math.sin(aa) * 11, '#4a2a10'); } p.outline(OL); S.boulder.push(p.spr(16, 32)); }
    // snowball (avalanche)
    S.snowball = [];
    for (let i = 0; i < 4; i++) { const p = P(48, 48); p.shadeEll(24, 24, 22, 22, ['#8898c8', '#c0d0f0', '#e8f0ff', '#ffffff']); const a = i * Math.PI / 2; for (let k = 0; k < 4; k++) { const aa = a + k * 1.57; p.ell(24 + Math.cos(aa) * 12, 24 + Math.sin(aa) * 12, 3, 2, '#a8b8e0'); } p.outline('#3a4a80'); S.snowball.push(p.spr(24, 48)); }
    // icicle
    S.icicle = (() => { const p = P(10, 20); p.poly([[1, 0], [9, 0], [5, 19]], '#90d8ff'); p.poly([[1, 0], [5, 0], [5, 19]], '#d8f4ff'); p.outline('#2a5ab0'); return p.spr(5, 0); })();
    // rocks (falling volcanic rock)
    S.rock = (() => { const p = P(16, 16); p.shadeEll(8, 8, 6.5, 6, ['#2a1414', '#5a2a24', '#8a4030', '#ff9030']); p.set(6, 9, '#ff6a18'); p.set(9, 6, '#ffc040'); p.outline(OL); return p.spr(8, 8); })();
    // fireball
    S.fireball = [];
    for (let i = 0; i < 2; i++) { const p = P(14, 14); p.circ(7, 7, 5 + i * .5, '#ff4010'); p.circ(7, 7, 3.5, '#ffa020'); p.circ(6, 6, 2, '#fff080'); p.outline('#801000'); S.fireball.push(p.spr(7, 7)); }
    S.iceshot = (() => { const p = P(14, 10); p.poly([[1, 5], [6, 1], [13, 5], [6, 9]], '#90d8ff'); p.poly([[1, 5], [6, 1], [8, 5]], '#ffffff'); p.outline('#2a5ab0'); return p.spr(7, 5); })();
    S.ebolt = [];
    for (let i = 0; i < 2; i++) { const p = P(12, 12); p.circ(6, 6, 4, '#fff060'); p.circ(6, 6, 2, '#ffffff'); for (let k = 0; k < 4; k++) { const a = k * 1.57 + i * .7; p.line(6, 6, 6 + Math.cos(a) * 6, 6 + Math.sin(a) * 6, '#80f0ff'); } S.ebolt.push(p.spr(6, 6)); }
    S.bullet = (() => { const p = P(8, 8); p.circ(4, 4, 2.5, '#ff4060'); p.set(3, 3, '#ffffff'); p.outline('#400010'); return p.spr(4, 4); })();
    S.missile = (() => { const p = P(16, 8); p.rect(3, 2, 10, 4, '#c0c0d0'); p.rect(3, 2, 10, 1, '#ffffff'); p.poly([[13, 2], [16, 4], [13, 6]], '#f04040'); p.rect(1, 1, 3, 2, '#808090'); p.rect(1, 5, 3, 2, '#808090'); p.outline(OL); return p.spr(8, 4); })();
    S.torpedo = (() => { const p = P(20, 8); p.ell(10, 4, 8, 2.5, '#606878'); p.ell(10, 3, 7, 1.2, '#a0a8b8'); p.rect(1, 1, 3, 6, '#404858'); p.set(17, 4, '#ff3030'); p.outline(OL); return p.spr(10, 4); })();
    S.mine = [];
    for (let i = 0; i < 2; i++) { const p = P(12, 12); p.circ(6, 6, 4, '#404050'); p.set(6, 6, i ? '#ff2020' : '#802020'); for (let k = 0; k < 4; k++) { const a = k * 1.57 + .78; p.set(6 + Math.round(Math.cos(a) * 5), 6 + Math.round(Math.sin(a) * 5), '#ffe040'); } p.outline(OL); S.mine.push(p.spr(6, 6)); }
    S.debris = (() => { const p = P(16, 14); p.rect(1, 2, 14, 10, '#5a5a70'); p.rect(1, 2, 14, 2, '#9090a8'); p.line(3, 6, 12, 9, '#30303e'); p.rect(10, 1, 3, 3, '#f0c020'); p.outline(OL); return p.spr(8, 7); })();
  };
})();
