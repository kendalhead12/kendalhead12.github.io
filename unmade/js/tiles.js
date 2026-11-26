'use strict';
// ============================================================
//  Tilesets (procedural 16x16 tiles) and environment props
// ============================================================
(function () {
  const Pix = U.Pix, Art = U.Art;
  const T = U.Tiles = { sets: {} };
  const TS = 16;
  // info: { tx, ty, at(dx,dy) -> char, set }
  T.def = function (name, def) { T.sets[name] = def; };
  T.isWallCh = (set, ch) => { const d = T.sets[set]; return !!(d.walls && d.walls.includes(ch)); };
  T.tileOf = (set, ch) => { const d = T.sets[set]; const l = d.legend[ch]; if (l == null) return d.legend.default || null; return typeof l === 'string' ? l : l.tile; };
  T.spawnOf = (set, ch) => { const d = T.sets[set]; const l = d.legend[ch]; return l && typeof l === 'object' ? l.spawn : null; };
  T.solid = (set, ch) => { const d = T.sets[set]; const key = T.tileOf(set, ch); const t = d.tiles[key]; return !t || !!t.solid; };

  // build a room's static background
  T.render = function (room) {
    const set = T.sets[room.tileset];
    const w = room.w, h = room.h;
    const p = new Pix(w * TS, h * TS);
    const anim = [];
    const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? ' ' : (room.map[y][x] || ' ');
    for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
      const ch = at(tx, ty);
      const key = T.tileOf(room.tileset, ch);
      const tile = set.tiles[key];
      if (!tile) continue;
      const info = { tx, ty, ch, at: (dx, dy) => at(tx + dx, ty + dy), isWall: (dx, dy) => { const c = at(tx + dx, ty + dy); return c === ' ' || T.isWallCh(room.tileset, c); }, set: room.tileset, room };
      try { tile.draw(p, tx * TS, ty * TS, info); } catch (e) { U.reportErr(e); }
      if (tile.anim || tile.light) anim.push({ tile, x: tx * TS, y: ty * TS, info });
    }
    return { canvas: p.c, anim };
  };

  const H = (tx, ty, s) => U.hash(tx, ty, s);

  // =====================================================================
  //  DARK HALLWAYS
  // =====================================================================
  const HC = { floor: '#2a2446', floorL: '#342c56', floorD: '#211c38', seam: '#1e1934', wall: '#4a3e6e', wallL: '#5b4f84', mortar: '#382f5a', wallD: '#2a2344', top: '#141024', rim: '#2b2549', moss: '#2e5c54', mossL: '#3f7d6c', glow: '#86f0d2' };
  function hallFloor(p, x, y, i, alt) {
    p.rect(x, y, TS, TS, HC.floor);
    p.noise(x, y, TS, TS, HC.floorL, .07, i.tx * 31 + i.ty * 7 + 1);
    p.noise(x, y, TS, TS, HC.floorD, .06, i.tx * 13 + i.ty * 29 + 2);
    p.hl(x, x + 15, y, HC.seam); p.vl(x + ((i.ty % 2) ? 8 : 0), y, y + 15, HC.seam);
    if (alt || H(i.tx, i.ty, 5) < .12) { const cx = x + 3 + Math.floor(H(i.tx, i.ty, 6) * 9), cy = y + 3 + Math.floor(H(i.tx, i.ty, 7) * 9); p.line(cx, cy, cx + 3, cy + 2, HC.seam); p.line(cx + 3, cy + 2, cx + 4, cy + 5, HC.seam); }
    if (alt) { p.rect(x + 10, y + 4, 2, 2, HC.wallL); p.px(x + 11, y + 5, HC.floorD); }
  }
  function hallWall(p, x, y, i) {
    const below = i.isWall(0, 1), below2 = i.isWall(0, 2);
    if (!below || (below && !below2 && i.at(0, 1) !== ' ')) {
      // face
      p.rect(x, y, TS, TS, HC.wall);
      for (let r = 0; r < 4; r++) {
        const yy = y + r * 4; p.hl(x, x + 15, yy, HC.mortar);
        const off = ((r + i.ty * 4) % 2) ? 4 : 12;
        p.vl(x + off, yy, yy + 3, HC.mortar);
        p.hl(x + off + 1, x + Math.min(15, off + 6), yy + 1, HC.wallL);
      }
      p.noise(x, y, TS, TS, HC.wallD, .05, i.tx * 3 + i.ty * 101);
      if (!below) { p.hl(x, x + 15, y + 15, HC.wallD); p.hl(x, x + 15, y + 14, HC.mortar); }
      if (below && !below2) { /* upper face */ }
    } else {
      p.rect(x, y, TS, TS, HC.top);
      if (!i.isWall(-1, 0) && i.at(-1, 0) !== ' ') p.vl(x, y, y + 15, HC.rim);
      if (!i.isWall(1, 0) && i.at(1, 0) !== ' ') p.vl(x + 15, y, y + 15, HC.rim);
      if (!i.isWall(0, -1) && i.at(0, -1) !== ' ') p.hl(x, x + 15, y, HC.rim);
      p.noise(x, y, TS, TS, '#1a1530', .05, i.tx + i.ty * 57);
    }
  }
  T.def('hall', {
    walls: '#Ld',
    legend: { '.': 'floor', ',': 'floor2', 'm': 'moss', '=': 'carpet', '#': 'wall', 'L': 'lantern', 'd': 'door', 'x': 'chasm', 'b': 'bridge', 'B': 'bridgev', 'w': 'water', 'r': 'rubble', ' ': 'void', 'P': { tile: 'floor', spawn: 'pillar' }, default: 'void' },
    tiles: {
      void: { solid: true, draw(p, x, y) { p.rect(x, y, TS, TS, '#000'); } },
      floor: { draw: (p, x, y, i) => hallFloor(p, x, y, i, false) },
      floor2: { draw: (p, x, y, i) => hallFloor(p, x, y, i, true) },
      moss: { draw(p, x, y, i) { hallFloor(p, x, y, i); p.noise(x, y, TS, TS, HC.moss, .45, i.tx * 5 + i.ty); p.noise(x, y, TS, TS, HC.mossL, .15, i.tx * 9 + i.ty * 2); if (H(i.tx, i.ty, 3) < .5) p.px(x + 4 + Math.floor(H(i.tx, i.ty, 4) * 8), y + 4 + Math.floor(H(i.tx, i.ty, 8) * 8), HC.glow); } },
      carpet: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#4c2452'); p.noise(x, y, TS, TS, '#5a2c62', .1, i.tx + i.ty * 9);
        const g = '#a8843a';
        if (i.at(-1, 0) !== '=') p.vl(x + 1, y, y + 15, g); if (i.at(1, 0) !== '=') p.vl(x + 14, y, y + 15, g);
        if (i.at(0, -1) !== '=') p.hl(x, x + 15, y + 1, g); if (i.at(0, 1) !== '=') p.hl(x, x + 15, y + 14, g);
        if ((i.tx + i.ty) % 2 === 0) { p.px(x + 7, y + 7, '#7a4a3a'); p.px(x + 8, y + 8, '#7a4a3a'); }
      } },
      wall: { solid: true, draw: hallWall },
      lantern: { solid: true, light: { r: 46, oy: 10 }, draw(p, x, y, i) {
        hallWall(p, x, y, i);
        p.rect(x + 7, y + 2, 2, 3, '#7c7a96'); p.rect(x + 5, y + 4, 6, 2, '#9a98b4'); p.rect(x + 5, y + 6, 6, 7, '#20304a'); p.rect(x + 4, y + 13, 8, 2, '#9a98b4');
        p.vl(x + 5, y + 6, y + 12, '#9a98b4'); p.vl(x + 10, y + 6, y + 12, '#9a98b4');
      }, anim(ctx, x, y, t, i) {
        const f = Math.sin(t * .2 + i.tx) * .5 + .5;
        ctx.fillStyle = '#7fd4ff'; ctx.fillRect(x + 6, y + 8, 4, 4);
        ctx.fillStyle = '#d8f4ff'; ctx.fillRect(x + 7, y + 9 - (f > .5 ? 1 : 0), 2, 3);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 7, y + 10, 1, 1);
      } },
      door: { draw(p, x, y, i) {
        const lower = !i.isWall(0, 1) || i.at(0, 1) !== 'd';
        hallWall(p, x, y, { ...i, isWall: (dx, dy) => dy > 0 ? (dy === 1 ? i.at(0, 1) === 'd' : false) : i.isWall(dx, dy) });
        if (lower && i.at(0, -1) === 'd') p.rect(x + 1, y, 14, 16, '#07050d');
        else if (lower) { p.rect(x + 2, y + 4, 12, 12, '#07050d'); p.rect(x + 4, y + 2, 8, 2, '#07050d'); }
        else { p.rect(x + 2, y + 8, 12, 8, '#07050d'); p.rect(x + 4, y + 5, 8, 3, '#07050d'); p.rect(x + 6, y + 4, 4, 1, '#07050d'); p.hl(x + 3, x + 12, y + 3, HC.wallL); }
      } },
      chasm: { solid: true, draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#05030a');
        const up = i.at(0, -1);
        if (up !== 'x' && up !== 'b' && up !== 'B' && up !== ' ') { p.rect(x, y, TS, 6, '#1b1632'); p.hl(x, x + 15, y + 2, '#14102a'); p.hl(x, x + 15, y + 5, '#0c0918'); p.noise(x, y, TS, 6, '#262044', .15, i.tx); }
        if (H(i.tx, i.ty, 11) < .08) p.px(x + 5, y + 9, '#2a2450');
      } },
      bridge: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#05030a');
        p.rect(x, y + 3, TS, 10, '#6a4a32');
        for (let k = 0; k < 4; k++) p.vl(x + k * 4 + (i.tx % 2), y + 3, y + 12, '#4e3524');
        p.noise(x, y + 3, TS, 10, '#7d5a3e', .08, i.tx);
        p.hl(x, x + 15, y + 2, '#a8865a'); p.hl(x, x + 15, y + 13, '#a8865a');
        if (i.tx % 2 === 0) { p.rect(x + 1, y, 2, 3, '#7a5a3a'); p.rect(x + 1, y + 13, 2, 3, '#7a5a3a'); }
      } },
      bridgev: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#05030a');
        p.rect(x + 3, y, 10, TS, '#6a4a32');
        for (let k = 0; k < 4; k++) p.hl(x + 3, x + 12, y + k * 4 + (i.ty % 2), '#4e3524');
        p.vl(x + 2, y, y + 15, '#a8865a'); p.vl(x + 13, y, y + 15, '#a8865a');
      } },
      water: { solid: true, draw(p, x, y, i) { p.rect(x, y, TS, TS, '#141c44'); p.noise(x, y, TS, TS, '#1c2a5a', .2, i.tx + i.ty); if (!i.isWall(0, -1) && i.at(0, -1) !== 'w') p.hl(x, x + 15, y, '#3a4a8a'); },
        anim(ctx, x, y, t, i) { ctx.fillStyle = '#3c5cae'; const o = Math.floor((t * .3 + i.tx * 5) % 16); ctx.fillRect(x + o, y + 5, 3, 1); ctx.fillRect(x + ((o + 8) % 16), y + 11, 3, 1); } },
      rubble: { solid: true, draw(p, x, y, i) { hallFloor(p, x, y, i); p.ellipse(x + 6, y + 9, 5, 4, '#4c4468'); p.ellipse(x + 11, y + 11, 4, 3, '#5a5280'); p.ellipse(x + 5, y + 8, 3, 2, '#6a6294'); p.px(x + 10, y + 9, '#7a72a4'); p.hl(x + 2, x + 14, y + 14, '#1a1530'); } },
    },
  });

  // =====================================================================
  //  EX-QUEEN'S HOME
  // =====================================================================
  const HM = { paper: '#c9a77c', paperD: '#b48f62', stripe: '#d6b88e', wain: '#7a5232', wainD: '#5e3c22', wainL: '#946642', top: '#2e1c10', floor: '#9a6a42', floorD: '#7c5232', floorL: '#ab7a50' };
  function homeWall(p, x, y, i) {
    const below = i.isWall(0, 1), below2 = i.isWall(0, 2);
    if (!below || !below2) {
      p.rect(x, y, TS, TS, HM.paper);
      for (let k = 0; k < 16; k += 4) p.vl(x + k + 1, y, y + 15, HM.stripe);
      p.noise(x, y, TS, TS, HM.paperD, .04, i.tx * 7 + i.ty);
      if (!below) { p.rect(x, y + 9, TS, 7, HM.wain); p.hl(x, x + 15, y + 9, HM.wainL); p.hl(x, x + 15, y + 15, HM.wainD); for (let k = 3; k < 16; k += 5) p.vl(x + k, y + 10, y + 14, HM.wainD); }
      else { p.hl(x, x + 15, y, HM.paperD); }
    } else {
      p.rect(x, y, TS, TS, HM.top);
      if (!i.isWall(-1, 0) && i.at(-1, 0) !== ' ') p.vl(x, y, y + 15, '#4a3020');
      if (!i.isWall(1, 0) && i.at(1, 0) !== ' ') p.vl(x + 15, y, y + 15, '#4a3020');
      if (!i.isWall(0, -1) && i.at(0, -1) !== ' ') p.hl(x, x + 15, y, '#4a3020');
    }
  }
  T.def('home', {
    walls: '#Wd',
    legend: { '.': 'floor', '=': 'rug', '#': 'wall', 'W': 'window', 'd': 'door', ' ': 'void', '_': 'mat', default: 'void' },
    tiles: {
      void: { solid: true, draw(p, x, y) { p.rect(x, y, TS, TS, '#000'); } },
      floor: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, HM.floor);
        for (let r = 0; r < 4; r++) { p.hl(x, x + 15, y + r * 4 + 3, HM.floorD); const s = (r * 7 + i.tx * 5 + i.ty * 3) % 16; p.vl(x + s, y + r * 4, y + r * 4 + 2, HM.floorD); p.hl(x + ((s + 3) % 12), x + ((s + 3) % 12) + 3, y + r * 4, HM.floorL); }
        p.noise(x, y, TS, TS, HM.floorL, .03, i.tx + i.ty * 31);
      } },
      rug: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#9a2c3c'); p.noise(x, y, TS, TS, '#a83a4a', .12, i.tx * 3 + i.ty);
        const g = '#d8a84a';
        if (i.at(-1, 0) !== '=') { p.vl(x + 1, y, y + 15, g); p.vl(x, y, y + 15, '#6a1a2a'); }
        if (i.at(1, 0) !== '=') { p.vl(x + 14, y, y + 15, g); p.vl(x + 15, y, y + 15, '#6a1a2a'); }
        if (i.at(0, -1) !== '=') { p.hl(x, x + 15, y + 1, g); p.hl(x, x + 15, y, '#6a1a2a'); }
        if (i.at(0, 1) !== '=') { p.hl(x, x + 15, y + 14, g); p.hl(x, x + 15, y + 15, '#6a1a2a'); }
        if ((i.tx + i.ty) % 2) { p.px(x + 7, y + 6, g); p.hl(x + 6, x + 8, y + 7, g); p.px(x + 7, y + 8, g); }
      } },
      mat: { draw(p, x, y, i) { T.sets.home.tiles.floor.draw(p, x, y, i); p.rect(x + 1, y + 3, 14, 10, '#4a6a3a'); p.rect(x + 2, y + 4, 12, 8, '#5a7e48'); } },
      wall: { solid: true, draw: homeWall },
      window: { solid: true, draw(p, x, y, i) {
        homeWall(p, x, y, i);
        p.rect(x + 2, y + 1, 12, 8, '#5a3a22'); p.rect(x + 3, y + 2, 10, 6, '#18204a'); p.px(x + 5, y + 3, '#9ad8ff'); p.px(x + 10, y + 5, '#6ab8e8');
        p.vl(x + 7, y + 2, y + 7, '#5a3a22'); p.hl(x + 3, x + 12, y + 4, '#5a3a22');
      } },
      door: { draw(p, x, y, i) {
        homeWall(p, x, y, { ...i, isWall: (dx, dy) => dy === 1 ? i.at(0, 1) === 'd' : dy === 2 ? false : i.isWall(dx, dy) });
        if (i.at(0, 1) === 'd') { p.rect(x + 2, y + 6, 12, 10, '#140c08'); p.rect(x + 4, y + 4, 8, 2, '#140c08'); p.hl(x + 1, x + 14, y + 3, HM.wain); }
        else p.rect(x + 2, y, 12, 16, '#140c08');
      } },
    },
  });

  // =====================================================================
  //  FROSTWOOD
  // =====================================================================
  const FC = { snow: '#e9f1fb', snowL: '#ffffff', snowD: '#d4e0ef', snowDD: '#bccbe0', path: '#d2dcea', pathD: '#bfcbdd', rock: '#7c8aa8', rockL: '#97a5c2', rockD: '#5e6b88', rockDD: '#465170', ice: '#a6dbf4', iceL: '#d6f2ff', iceD: '#84c2e4' };
  function snow(p, x, y, i) {
    p.rect(x, y, TS, TS, FC.snow);
    p.noise(x, y, TS, TS, FC.snowD, .05, i.tx * 11 + i.ty * 3);
    p.noise(x, y, TS, TS, FC.snowL, .04, i.tx * 7 + i.ty * 19);
  }
  function frostWall(p, x, y, i) {
    const below = i.isWall(0, 1), below2 = i.isWall(0, 2);
    if (!below || !below2) {
      p.rect(x, y, TS, TS, FC.rock);
      p.noise(x, y, TS, TS, FC.rockL, .12, i.tx * 3 + i.ty * 7);
      p.noise(x, y, TS, TS, FC.rockD, .1, i.tx * 13 + i.ty);
      const s = Math.floor(H(i.tx, i.ty, 2) * 10);
      p.line(x + s, y, x + s + 3, y + 7, FC.rockD); p.line(x + s + 3, y + 7, x + s + 1, y + 15, FC.rockD);
      if (!below) { p.hl(x, x + 15, y + 15, FC.rockDD); p.hl(x, x + 15, y + 14, FC.rockD); }
      if (!i.isWall(0, -1)) { p.rect(x, y, TS, 3, FC.snowL); p.hl(x, x + 15, y + 3, FC.snowD); for (let k = 0; k < 16; k += 3) p.px(x + k + (i.tx % 2), y + 4, FC.snowD); }
    } else {
      p.rect(x, y, TS, TS, '#dde7f4'); p.noise(x, y, TS, TS, '#cfdbec', .1, i.tx + i.ty * 5);
      if (!i.isWall(-1, 0) && i.at(-1, 0) !== ' ') p.vl(x, y, y + 15, FC.snowDD);
      if (!i.isWall(1, 0) && i.at(1, 0) !== ' ') p.vl(x + 15, y, y + 15, FC.snowDD);
      if (!i.isWall(0, -1) && i.at(0, -1) !== ' ') p.hl(x, x + 15, y, FC.snowDD);
    }
  }
  T.def('frost', {
    walls: '#',
    legend: { '.': 'snow', ',': 'snow2', ':': 'path', '#': 'wall', 'i': 'ice', 'I': 'river', 'f': 'fence', 'b': 'bridge', 'x': 'chasm', 'r': 'rock', ' ': 'void', 'T': { tile: 'snow', spawn: 'pine' }, 't': { tile: 'snow', spawn: 'pinesmall' }, default: 'void' },
    tiles: {
      void: { solid: true, draw(p, x, y) { p.rect(x, y, TS, TS, '#dfe8f4'); } },
      snow: { draw: snow },
      snow2: { draw(p, x, y, i) { snow(p, x, y, i); const k = Math.floor(H(i.tx, i.ty, 4) * 3); if (k === 0) { p.vl(x + 5, y + 8, y + 10, '#8aa0b4'); p.vl(x + 7, y + 7, y + 10, '#8aa0b4'); p.vl(x + 9, y + 9, y + 10, '#8aa0b4'); } else if (k === 1) { p.ellipse(x + 8, y + 9, 4, 2, FC.snowD); p.ellipse(x + 8, y + 8, 3, 2, FC.snowL); } else { p.px(x + 4, y + 5, FC.snowDD); p.px(x + 6, y + 9, FC.snowDD); p.px(x + 10, y + 6, FC.snowDD); p.px(x + 12, y + 10, FC.snowDD); } } },
      path: { draw(p, x, y, i) { p.rect(x, y, TS, TS, FC.path); p.noise(x, y, TS, TS, FC.pathD, .12, i.tx * 5 + i.ty * 3); p.noise(x, y, TS, TS, FC.snow, .05, i.tx + i.ty * 13); } },
      wall: { solid: true, draw: frostWall },
      ice: { ice: true, draw(p, x, y, i) {
        p.rect(x, y, TS, TS, FC.ice); p.noise(x, y, TS, TS, FC.iceD, .06, i.tx + i.ty * 3);
        if ((i.tx + i.ty * 3) % 4 === 0) { p.line(x + 3, y + 12, x + 9, y + 6, FC.iceL); p.line(x + 6, y + 13, x + 11, y + 8, FC.iceL); }
        if (i.at(0, -1) !== 'i') p.hl(x, x + 15, y, FC.iceD); if (i.at(-1, 0) !== 'i') p.vl(x, y, y + 15, FC.iceD);
      } },
      river: { solid: true, draw(p, x, y, i) { p.rect(x, y, TS, TS, '#5c9ccc'); p.noise(x, y, TS, TS, '#78b4de', .1, i.tx * 7 + i.ty); if (i.at(0, -1) !== 'I') { p.rect(x, y, TS, 2, FC.snowL); p.hl(x, x + 15, y + 2, '#3a7aaa'); } },
        anim(ctx, x, y, t, i) { ctx.fillStyle = '#a8d8f8'; const o = Math.floor((t * .4 + i.ty * 7) % 16); ctx.fillRect(x + o, y + 6, 4, 1); ctx.fillRect(x + ((o + 9) % 16), y + 12, 3, 1); } },
      fence: { solid: true, draw(p, x, y, i) {
        snow(p, x, y, i);
        const w = '#7a5236', wD = '#5a3a22';
        if (i.at(0, -1) === 'f' || i.at(0, 1) === 'f') {
          p.rect(x + 5, y, 2, 16, w); p.rect(x + 9, y, 2, 16, w); p.vl(x + 6, y, y + 15, wD); p.vl(x + 10, y, y + 15, wD);
          p.rect(x + 4, y + 3, 8, 4, w); p.hl(x + 4, x + 11, y + 6, wD); p.hl(x + 4, x + 11, y + 3, FC.snowL);
          if (i.at(0, -1) !== 'f') p.hl(x + 5, x + 10, y, FC.snowL);
          return;
        }
        p.rect(x, y + 6, TS, 2, w); p.rect(x, y + 11, TS, 2, w); p.hl(x, x + 15, y + 8, wD); p.hl(x, x + 15, y + 13, wD);
        p.rect(x + 2, y + 3, 3, 12, w); p.rect(x + 11, y + 3, 3, 12, w); p.vl(x + 4, y + 4, y + 14, wD); p.vl(x + 13, y + 4, y + 14, wD);
        p.hl(x + 2, x + 4, y + 3, FC.snowL); p.hl(x + 11, x + 13, y + 3, FC.snowL); p.hl(x, x + 15, y + 6, FC.snowL);
      } },
      bridge: { draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#3a4660');
        p.rect(x, y + 3, TS, 10, '#8a6444'); for (let k = 0; k < 4; k++) p.vl(x + k * 4 + (i.tx % 2), y + 3, y + 12, '#6a4a30');
        p.noise(x, y + 3, TS, 10, FC.snow, .12, i.tx * 3);
        p.hl(x, x + 15, y + 2, '#a8865a'); p.hl(x, x + 15, y + 13, '#a8865a');
        if (i.tx % 2 === 0) { p.rect(x + 1, y, 2, 3, '#7a5a3a'); p.rect(x + 1, y + 13, 2, 3, '#7a5a3a'); p.px(x + 1, y, FC.snowL); p.px(x + 2, y, FC.snowL); }
      } },
      chasm: { solid: true, draw(p, x, y, i) {
        p.rect(x, y, TS, TS, '#46546f'); p.noise(x, y, TS, TS, '#56647f', .1, i.tx + i.ty * 9);
        const up = i.at(0, -1);
        if (up !== 'x' && up !== 'b' && up !== ' ') { p.rect(x, y, TS, 6, FC.rockD); p.hl(x, x + 15, y, FC.snowL); p.hl(x, x + 15, y + 1, FC.snowD); p.hl(x, x + 15, y + 5, FC.rockDD); }
      }, anim(ctx, x, y, t, i) { ctx.globalAlpha = .25; ctx.fillStyle = '#dfe8f4'; const o = (t * .15 + i.tx * 9) % 32 - 8; ctx.fillRect(x + o, y + 9, 10, 2); ctx.globalAlpha = 1; } },
      rock: { solid: true, draw(p, x, y, i) { snow(p, x, y, i); p.ellipse(x + 8, y + 10, 7, 5, FC.rockD); p.ellipse(x + 7, y + 9, 6, 4, FC.rock); p.ellipse(x + 6, y + 7, 4, 2, FC.snowL); p.hl(x + 2, x + 14, y + 15, FC.snowDD); } },
    },
  });

  // =====================================================================
  //  THE CREATOR'S WORKSHOP (prologue)
  // =====================================================================
  const WC = { floor: '#4a4a52', floorD: '#3e3e46', floorL: '#56565e', grate: '#34343c', grateD: '#24242a', wall: '#5c606a', wallD: '#44474f', wallL: '#70747e', top: '#18181d', rivet: '#8a8e98' };
  function wsWall(p, x, y, i) {
    const below = i.isWall(0, 1), below2 = i.isWall(0, 2);
    if (!below || !below2) {
      p.rect(x, y, TS, TS, WC.wall); p.vl(x, y, y + 15, WC.wallD); p.vl(x + 1, y, y + 15, WC.wallL);
      p.px(x + 4, y + 3, WC.rivet); p.px(x + 12, y + 3, WC.rivet); p.px(x + 4, y + 12, WC.rivet); p.px(x + 12, y + 12, WC.rivet);
      if (!below) { p.rect(x, y + 12, TS, 4, '#2a2a30'); p.hl(x, x + 15, y + 12, '#c8a030'); p.hl(x, x + 15, y + 13, '#2a2a30'); for (let k = 0; k < 16; k += 4) p.rect(x + k, y + 12, 2, 1, '#2a2a30'); }
    } else {
      p.rect(x, y, TS, TS, WC.top);
      if (!i.isWall(0, -1) && i.at(0, -1) !== ' ') p.hl(x, x + 15, y, '#33333a');
      if (!i.isWall(-1, 0) && i.at(-1, 0) !== ' ') p.vl(x, y, y + 15, '#33333a');
      if (!i.isWall(1, 0) && i.at(1, 0) !== ' ') p.vl(x + 15, y, y + 15, '#33333a');
    }
  }
  T.def('ws', {
    walls: '#',
    legend: { '.': 'floor', ',': 'grate', 'c': 'cable', '#': 'wall', ' ': 'void', default: 'void' },
    tiles: {
      void: { solid: true, draw(p, x, y) { p.rect(x, y, TS, TS, '#000'); } },
      floor: { draw(p, x, y, i) { p.rect(x, y, TS, TS, WC.floor); p.noise(x, y, TS, TS, WC.floorD, .1, i.tx * 7 + i.ty); p.noise(x, y, TS, TS, WC.floorL, .05, i.tx + i.ty * 23); p.hl(x, x + 15, y, WC.floorD); p.vl(x, y, y + 15, WC.floorD); } },
      grate: { draw(p, x, y) { p.rect(x, y, TS, TS, WC.grate); for (let k = 1; k < 16; k += 3) for (let j = 1; j < 16; j += 3) p.rect(x + k, y + j, 2, 2, WC.grateD); } },
      cable: { draw(p, x, y, i) { T.sets.ws.tiles.floor.draw(p, x, y, i); p.line(x, y + 8, x + 6, y + 6, '#141418'); p.line(x + 6, y + 6, x + 15, y + 10, '#141418'); p.line(x, y + 9, x + 6, y + 7, '#2a2a34'); } },
      wall: { solid: true, draw: wsWall },
    },
  });

  // =====================================================================
  //  PROPS — sprites with feet anchored at bottom-centre
  // =====================================================================
  const P = U.Props = { defs: {} };
  P.def = (id, d) => { P.defs[id] = d; };
  P.sprite = (id, state) => Art.cached('prop|' + id + '|' + (state || ''), () => { const d = P.defs[id]; const c = d.draw(state); return d.noOutline ? c : Art.outline(c, d.outline || '#120c18'); });

  // ---- hallways ----
  P.def('pillar', { solid: [12, 6], draw() {
    const p = new Pix(16, 36);
    p.rect(1, 30, 14, 6, '#3a3058'); p.hl(1, 14, 30, '#5b4f84');
    p.rect(3, 6, 10, 24, '#4e4374'); p.vl(3, 6, 29, '#5e5288'); p.vl(12, 6, 29, '#3a3058'); p.vl(7, 8, 28, '#43386a');
    p.rect(0, 2, 16, 5, '#3a3058'); p.hl(0, 15, 2, '#5b4f84'); p.rect(2, 0, 12, 2, '#4e4374');
    p.noise(3, 6, 10, 24, '#2a2344', .06, 4);
    return p.c;
  } });
  P.def('lampstand', { solid: [8, 4], light: { r: 52, oy: -22 }, draw() {
    const p = new Pix(10, 28);
    p.rect(2, 25, 6, 3, '#3a3a50'); p.rect(4, 8, 2, 17, '#5a5a74'); p.vl(5, 8, 24, '#3a3a50');
    p.rect(1, 1, 8, 2, '#9a98b4'); p.rect(1, 3, 8, 6, '#20304a'); p.vl(1, 3, 8, '#9a98b4'); p.vl(8, 3, 8, '#9a98b4'); p.rect(0, 9, 10, 1, '#9a98b4');
    return p.c;
  }, anim(ctx, x, y, t) { const f = Math.sin(t * .2 + x) > 0 ? 1 : 0; ctx.fillStyle = '#7fd4ff'; ctx.fillRect(x - 3, y - 25, 6, 4); ctx.fillStyle = '#e8f8ff'; ctx.fillRect(x - 1, y - 25 - f, 2, 3); } });
  P.def('sign', { solid: [14, 5], draw() {
    const p = new Pix(14, 16);
    p.rect(1, 1, 12, 11, '#6a6290'); p.rect(2, 2, 10, 9, '#5a5280'); p.hl(1, 12, 1, '#8a82b0');
    for (let k = 3; k < 10; k += 2) p.hl(3, 10, k, '#3a3460');
    p.rect(5, 12, 4, 4, '#4a4270');
    return p.c;
  } });
  P.def('woodsign', { solid: [12, 5], draw() {
    const p = new Pix(14, 16);
    p.rect(6, 8, 2, 8, '#6a4a2a'); p.rect(0, 1, 14, 8, '#a8784a'); p.hl(0, 13, 1, '#c8946a'); p.hl(0, 13, 8, '#7a5232');
    for (let k = 3; k < 8; k += 2) p.hl(2, 11, k, '#6a4a2a'); p.hl(0, 13, 0, '#f4f8ff');
    return p.c;
  } });
  // The Creator's mark: a circle above two lines. It looks like someone you know.
  P.def('symbol', { noOutline: true, draw(state) {
    const p = new Pix(12, 14), col = state === 'bright' ? '#d8d0ff' : '#6e64a0';
    for (let y = 0; y < 9; y++) for (let x = 1; x < 12; x++) { const d = Math.hypot(x + .5 - 6.5, y + .5 - 4.5); if (d <= 4.4 && d > 3.1) p.px(x, y, col); }
    p.px(5, 4, col); p.px(8, 4, col);
    p.vl(4, 9, 12, col); p.vl(8, 9, 12, col); p.px(3, 13, col); p.px(9, 13, col);
    return p.c;
  } });
  P.def('rock', { solid: [14, 10], draw() {
    const p = new Pix(16, 16);
    p.ellipse(8, 9, 7, 6, '#5c5480'); p.ellipse(7, 8, 6, 5, '#6e6694'); p.ellipse(6, 6, 3, 2, '#8a82b0'); p.px(10, 11, '#4a4270'); p.px(11, 10, '#4a4270'); p.hl(3, 12, 15, '#3a3460');
    return p.c;
  } });
  P.def('plate', { noOutline: true, flat: true, draw(state) {
    const p = new Pix(14, 14);
    p.rect(0, 0, 14, 14, '#1a1630'); p.rect(1, 1, 12, 12, state === 'on' ? '#3a7a8a' : '#5a5282'); p.rect(3, 3, 8, 8, state === 'on' ? '#7ad8e8' : '#6e66a0'); p.hl(1, 12, 1, state === 'on' ? '#9af0ff' : '#8078b0');
    return p.c;
  } });
  P.def('spikes', { noOutline: true, flat: true, draw(state) {
    const p = new Pix(16, 16);
    p.rect(0, 0, 16, 16, '#221c38'); for (let k = 0; k < 4; k++) for (let j = 0; j < 4; j++) {
      const x = k * 4 + 1, y = j * 4 + 1;
      if (state === 'up') { p.tri(x, y + 3, x + 1, y, x + 3, y + 3, '#c8c4e0'); p.px(x + 1, y + 2, '#8a86a8'); }
      else p.rect(x + 1, y + 1, 2, 2, '#141024');
    }
    return p.c;
  } });
  P.def('gate', { solid: [16, 8], draw(state) {
    const p = new Pix(16, 30);
    if (state === 'open') { p.rect(0, 0, 16, 3, '#6a6890'); return p.c; }
    p.rect(0, 0, 16, 3, '#6a6890'); for (let k = 1; k < 16; k += 4) { p.rect(k, 3, 2, 27, '#8a88aa'); p.vl(k + 1, 3, 29, '#5a5880'); }
    p.rect(0, 14, 16, 2, '#6a6890');
    return p.c;
  } });
  P.def('candybowl', { solid: [12, 6], draw() {
    const p = new Pix(14, 18);
    p.rect(5, 9, 4, 7, '#6a6290'); p.rect(3, 15, 8, 3, '#5a5280');
    p.ellipse(7, 7, 6, 3, '#c8c0e8'); p.ellipse(7, 6, 5, 2, '#3a3460');
    [[4, 5, '#ff7ce0'], [7, 4, '#7fd4ff'], [9, 5, '#ffe23a'], [6, 6, '#5cff6a']].forEach(([x, y, c]) => p.rect(x, y, 2, 2, c));
    return p.c;
  } });
  P.def('glowcap', { noOutline: false, draw() {
    const p = new Pix(10, 9);
    p.rect(2, 5, 1, 4, '#d8d0c0'); p.rect(6, 4, 2, 5, '#d8d0c0');
    p.ellipse(2, 4, 2, 1.5, '#5cd8c0'); p.ellipse(7, 3, 3, 2, '#7ff0d8'); p.px(6, 2, '#e0fff8');
    return p.c;
  }, light: { r: 18, oy: -4 } });
  P.def('box', { solid: [14, 8], draw(state) {
    const p = new Pix(16, 14);
    p.rect(1, 4, 14, 10, '#7a5232'); p.hl(1, 14, 4, '#946642'); p.hl(1, 14, 9, '#5e3c22'); p.vl(8, 4, 13, '#5e3c22');
    if (state !== 'open') { p.rect(0, 1, 16, 4, '#8a5e3a'); p.hl(0, 15, 1, '#a8784a'); p.rect(7, 4, 2, 2, '#d8ac44'); }
    else { p.rect(1, 2, 14, 3, '#2a1a0e'); }
    return p.c;
  } });
  P.def('paper', { noOutline: true, flat: true, draw() {
    const p = new Pix(10, 8);
    p.rect(0, 1, 10, 7, '#c8d8f0'); p.rect(1, 0, 8, 1, '#c8d8f0'); p.hl(1, 8, 2, '#5a7ab8'); p.hl(1, 6, 4, '#5a7ab8'); p.circle(6, 5, 1, '#5a7ab8'); p.px(9, 7, '#8aa0c8');
    return p.c;
  } });
  P.def('house', { solid: [92, 26], draw() {
    const p = new Pix(96, 76);
    const st = '#5a5078', stD = '#463e62', stL = '#6c6290', roof = '#2c4a6a', roofD = '#1e3650', roofL = '#3a6088';
    p.rect(6, 32, 84, 44, st); p.noise(6, 32, 84, 44, stL, .1, 3); p.noise(6, 32, 84, 44, stD, .1, 5);
    for (let y = 36; y < 76; y += 6) p.hl(6, 89, y, stD);
    p.tri(0, 34, 48, 2, 96, 34, roof); p.tri(6, 32, 48, 6, 90, 32, roofL);
    for (let y = 8; y < 34; y += 4) p.hl(48 - (y - 2) * 1.45, 48 + (y - 2) * 1.45, y, roofD);
    p.rect(0, 32, 96, 3, roofD);
    p.rect(40, 50, 16, 26, '#2a1a10'); p.rect(42, 52, 12, 24, '#5a3a22'); p.vl(48, 52, 75, '#3a2414'); p.px(45, 64, '#d8ac44'); p.px(51, 64, '#d8ac44');
    const win = (x) => { p.rect(x, 44, 16, 14, '#3a2414'); p.rect(x + 2, 46, 12, 10, '#ffd88a'); p.vl(x + 8, 46, 55, '#3a2414'); p.hl(x + 2, x + 13, 50, '#3a2414'); p.rect(x + 2, 46, 5, 3, '#fff0c8'); };
    win(14); win(66);
    p.rect(70, 8, 8, 18, stD); p.rect(68, 6, 12, 3, st);
    return p.c;
  }, light: { r: 60, oy: -24 } });
  P.def('lumtree', { solid: [12, 6], draw() {
    const p = new Pix(52, 66);
    p.rect(22, 34, 8, 32, '#4a3e6e'); p.vl(22, 34, 65, '#5b4f84'); p.vl(29, 34, 65, '#2a2344');
    p.line(26, 40, 12, 30, '#4a3e6e'); p.line(26, 44, 40, 32, '#4a3e6e');
    p.ellipse(26, 18, 25, 16, '#2a6a8a'); p.ellipse(26, 15, 22, 12, '#3a8aaa'); p.ellipse(22, 11, 13, 6, '#5ab0d0');
    for (let k = 0; k < 18; k++) p.px(4 + U.hash(k, 1) * 44, 6 + U.hash(k, 2) * 22, '#c8f4ff');
    p.hl(4, 48, 33, '#1e4a62');
    return p.c;
  }, light: { r: 70, oy: -40, col: 'blue' } });

  // ---- home ----
  P.def('fireplace', { solid: [40, 10], light: { r: 64, oy: -6, col: 'warm' }, draw() {
    const p = new Pix(42, 34);
    p.rect(0, 4, 42, 30, '#7a6a6a'); p.noise(0, 4, 42, 30, '#8a7a7a', .2, 3); p.noise(0, 4, 42, 30, '#5a4a4a', .12, 4);
    p.rect(0, 0, 42, 5, '#5a3a22'); p.hl(0, 41, 0, '#7a5232');
    p.rect(9, 12, 24, 22, '#1a0c08'); p.rect(11, 10, 20, 2, '#1a0c08');
    p.rect(12, 28, 18, 3, '#5a3a22'); p.hl(12, 29, 28, '#7a5232');
    return p.c;
  }, anim(ctx, x, y, t) {
    for (let k = 0; k < 6; k++) { const h = 6 + Math.abs(Math.sin(t * .15 + k * 1.7)) * 9; ctx.fillStyle = k % 2 ? '#ff9a2a' : '#ffd84a'; ctx.fillRect(x - 8 + k * 3, y - 7 - h, 3, h); }
    ctx.fillStyle = '#fff6c8'; ctx.fillRect(x - 3, y - 11, 6, 4);
  } });
  P.def('armchair', { solid: [20, 8], draw() {
    const p = new Pix(22, 24);
    p.rect(2, 0, 18, 14, '#8a2a3a'); p.rect(0, 8, 22, 12, '#9a3444'); p.rect(4, 12, 14, 6, '#b04656'); p.rect(0, 8, 4, 12, '#7a2232'); p.rect(18, 8, 4, 12, '#7a2232');
    p.rect(2, 20, 3, 4, '#3a2414'); p.rect(17, 20, 3, 4, '#3a2414'); p.hl(2, 19, 0, '#a84454');
    return p.c;
  } });
  P.def('table', { solid: [28, 8], draw(state) {
    const p = new Pix(30, 22);
    p.rect(0, 4, 30, 10, '#8a5a36'); p.rect(0, 2, 30, 4, '#a8784a'); p.hl(0, 29, 13, '#6a4226');
    p.rect(2, 14, 3, 8, '#6a4226'); p.rect(25, 14, 3, 8, '#6a4226');
    p.rect(3, 3, 24, 2, '#e8e0d0');
    if (state === 'pie') { p.ellipse(15, 3, 6, 2, '#c87a3a'); p.ellipse(15, 2, 5, 1.5, '#5a3a8a'); p.px(13, 2, '#9a7ad8'); p.px(17, 2, '#9a7ad8'); }
    else { p.rect(12, 0, 6, 4, '#e8e8f0'); p.circle(14, 0, 2, '#d84a6a'); p.circle(17, 1, 2, '#f0c040'); p.vl(15, 1, 3, '#4a8a4a'); }
    return p.c;
  } });
  P.def('bookshelf', { solid: [32, 8], draw() {
    const p = new Pix(32, 36);
    p.rect(0, 0, 32, 36, '#5a3a22'); p.rect(2, 2, 28, 32, '#3a2414');
    const cols = ['#a83a3a', '#3a6aa8', '#3a8a5a', '#c8a040', '#7a4aa8', '#a85a3a', '#4a7a8a'];
    for (let s = 0; s < 3; s++) { const y = 3 + s * 11; p.rect(2, y + 9, 28, 2, '#5a3a22'); let x = 3; let k = s * 3; while (x < 28) { const w = 2 + (k % 2); const h = 6 + (k % 3); p.rect(x, y + 9 - h, w, h, cols[k % cols.length]); x += w + (k % 4 === 0 ? 1 : 0); k++; } }
    return p.c;
  } });
  P.def('bed', { solid: [22, 26], draw() {
    const p = new Pix(24, 34);
    p.rect(0, 0, 24, 8, '#6a4226'); p.hl(0, 23, 0, '#8a5a36');
    p.rect(1, 6, 22, 26, '#e8e0d0'); p.rect(3, 8, 18, 7, '#ffffff'); p.rect(1, 16, 22, 16, '#4a6ab0'); p.hl(1, 22, 16, '#6a8ad0');
    for (let k = 0; k < 4; k++) p.px(6 + k * 4, 22 + (k % 2) * 4, '#ffe23a');
    p.rect(0, 31, 24, 3, '#6a4226');
    return p.c;
  } });
  P.def('toybox', { solid: [18, 8], draw() {
    const p = new Pix(18, 16);
    p.rect(0, 4, 18, 12, '#d8a84a'); p.hl(0, 17, 4, '#f0c870'); p.rect(0, 2, 18, 3, '#c89838');
    p.rect(3, 0, 4, 3, '#d84a4a'); p.circle(12, 1, 2, '#4a8ad8'); p.rect(7, 8, 4, 4, '#ffe23a'); p.px(8, 9, '#d84a4a');
    return p.c;
  } });
  P.def('drawing', { noOutline: true, flat: true, draw() {
    const p = new Pix(16, 12);
    p.rect(0, 0, 16, 12, '#f4f0e4'); p.rect(0, 0, 16, 1, '#c8c0a8');
    p.rect(1, 8, 14, 3, '#6ac85a'); p.rect(1, 1, 14, 7, '#9ad8ff');
    p.circle(12, 3, 2, '#ffd83a'); p.px(9, 3, '#ffb82a'); p.px(12, 0 + 1, '#ffb82a'); p.px(14, 5, '#ffb82a');
    p.rect(4, 6, 2, 2, '#1a1a1a'); p.px(4, 9, '#1a1a1a'); p.px(5, 9, '#1a1a1a');
    p.px(11, 3, '#1a1a1a'); p.px(13, 3, '#1a1a1a');
    return p.c;
  } });
  P.def('mirror', { solid: [14, 4], draw() {
    const p = new Pix(14, 24);
    p.rect(0, 0, 14, 24, '#c8a040'); p.rect(2, 2, 10, 20, '#a8c8e0'); p.line(4, 18, 9, 5, '#d8ecff'); p.line(5, 19, 10, 6, '#c0dcf0');
    return p.c;
  } });
  P.def('plant', { solid: [10, 6], draw() {
    const p = new Pix(14, 20);
    p.rect(3, 13, 8, 7, '#a85a3a'); p.hl(2, 11, 13, '#c87a5a');
    p.ellipse(7, 7, 6, 6, '#3a7a4a'); p.ellipse(5, 5, 3, 3, '#4a9a5a'); p.px(9, 4, '#6ac87a'); p.px(4, 9, '#2a5a3a');
    return p.c;
  } });
  P.def('dresser', { solid: [24, 8], draw() {
    const p = new Pix(24, 22);
    p.rect(0, 0, 24, 22, '#7a4a2a'); p.hl(0, 23, 0, '#9a6a42');
    for (let k = 0; k < 3; k++) { p.rect(2, 3 + k * 6, 20, 5, '#8a5a36'); p.rect(11, 5 + k * 6, 2, 1, '#d8ac44'); }
    return p.c;
  } });
  P.def('desk', { solid: [26, 8], draw(state) {
    const p = new Pix(28, 22);
    p.rect(0, 6, 28, 6, '#8a5a36'); p.hl(0, 27, 6, '#a8784a'); p.rect(1, 12, 3, 10, '#6a4226'); p.rect(24, 12, 3, 10, '#6a4226');
    p.rect(4, 1, 9, 6, '#e8e0c8'); p.hl(5, 11, 3, '#9a8a6a'); p.hl(5, 10, 5, '#9a8a6a');
    p.rect(18, 2, 2, 5, '#3a2a5a'); p.rect(21, 4, 4, 3, '#c8a040');
    return p.c;
  } });
  P.def('stairs', { noOutline: true, flat: true, draw() {
    const p = new Pix(32, 32);
    for (let k = 0; k < 6; k++) { const s = 30 - k * 4; p.rect(0, k * 5 + 2, 32, 5, k % 2 ? '#5a3a22' : '#6a4a2a'); p.hl(0, 31, k * 5 + 2, '#8a6a42'); }
    p.rect(0, 0, 32, 2, '#2a1a0e'); p.g.globalAlpha = 1;
    for (let k = 0; k < 32; k++) { p.g.fillStyle = 'rgba(0,0,0,' + (k / 40) + ')'; p.g.fillRect(0, k, 32, 1); }
    return p.c;
  } });
  P.def('rugstar', { noOutline: true, flat: true, draw() { const p = new Pix(8, 8); p.px(3, 0, '#d8a84a'); return p.c; } });

  // ---- frostwood ----
  P.def('pine', { solid: [8, 5], draw(state) {
    const p = new Pix(34, 50);
    const g = '#245a3a', gL = '#2f7048', gD = '#1a4430', s = '#f4f8ff', sD = '#d4e0ef';
    p.rect(14, 40, 6, 10, '#6a4a2e'); p.vl(19, 40, 49, '#4a3220');
    const layer = (y, w, h) => { p.tri(17 - w, y + h, 17, y, 17 + w, y + h, g); p.tri(17 - w + 3, y + h - 1, 17, y + 2, 17, y + h - 1, gL); p.hl(17 - w, 17 + w, y + h, gD); for (let k = -w; k <= w; k += 3) p.px(17 + k, y + h, s); p.tri(17 - w * .45, y + h * .45, 17, y, 17 + w * .45, y + h * .45, s); p.px(17 + w * .3, y + h * .45, sD); };
    layer(22, 16, 20); layer(11, 12, 16); layer(0, 8, 13);
    if (state === 'dead') { p.g.globalCompositeOperation = 'source-atop'; p.g.fillStyle = 'rgba(90,90,110,0.6)'; p.g.fillRect(0, 0, 34, 50); }
    return p.c;
  } });
  P.def('pinesmall', { solid: [6, 4], draw() {
    const p = new Pix(22, 32);
    p.rect(9, 26, 4, 6, '#6a4a2e');
    p.tri(0, 27, 11, 8, 22, 27, '#245a3a'); p.tri(3, 17, 11, 0, 19, 17, '#2f7048'); p.tri(6, 8, 11, 0, 16, 8, '#f4f8ff'); p.hl(1, 21, 27, '#1a4430');
    [2, 6, 10, 14, 18].forEach(x => p.px(x, 27, '#f4f8ff'));
    return p.c;
  } });
  P.def('snowman', { solid: [12, 6], draw(state) {
    const p = new Pix(16, 26);
    const s = '#f4f8ff', sD = '#c8d6ea';
    p.circle(8, 19, 7, s); p.circle(8, 10, 5, s);
    p.noise(1, 12, 14, 14, sD, .1, 2);
    p.px(8, 9, '#2a2a3a'); p.px(8, 12, '#2a2a3a'); p.px(8, 15, '#2a2a3a');
    p.line(3, 9, 0, 6, '#6a4a2e'); p.line(13, 9, 15, 5, '#6a4a2e');
    if (state !== 'headless' && state !== 'you') { p.circle(8, 3, 3.5, s); p.px(7, 2, '#1a1a1a'); p.px(9, 2, '#1a1a1a'); p.px(8, 4, '#ff8a2a'); }
    return p.c;
  } });
  P.def('station', { solid: [30, 10], draw() {
    const p = new Pix(32, 36);
    const cb = '#c8a070', cbD = '#a8805a', cbL = '#d8b488';
    p.rect(2, 14, 28, 22, cb); p.rect(2, 14, 28, 3, cbD); p.vl(2, 14, 35, cbD); p.vl(29, 14, 35, cbD);
    p.rect(0, 6, 32, 9, '#d84a4a'); p.hl(0, 31, 6, '#f06a6a'); for (let k = 0; k < 32; k += 6) p.rect(k, 6, 3, 9, '#f4f4f4');
    p.rect(3, 0, 2, 7, cbD); p.rect(27, 0, 2, 7, cbD); p.hl(0, 31, 5, '#f4f8ff');
    p.rect(6, 20, 20, 8, cbL); p.hl(8, 23, 22, '#5a3a22'); p.hl(8, 19, 25, '#5a3a22');
    p.rect(24, 30, 4, 3, '#e8e0f0');
    return p.c;
  } });
  P.def('lamp', { solid: [6, 4], light: { r: 56, oy: -30, col: 'warm' }, draw() {
    const p = new Pix(10, 34);
    p.rect(4, 8, 2, 24, '#2a2a34'); p.rect(2, 31, 6, 3, '#2a2a34');
    p.rect(1, 2, 8, 7, '#2a2a34'); p.rect(2, 3, 6, 5, '#ffe08a'); p.rect(0, 0, 10, 2, '#2a2a34'); p.hl(0, 9, 0, '#f4f8ff');
    return p.c;
  } });
  function cabin(p, w, h, roofCol, wallCol, door, sign) {
    const roofH = Math.floor(h * .45);
    p.rect(4, roofH - 2, w - 8, h - roofH + 2, wallCol);
    for (let y = roofH; y < h; y += 5) { p.hl(4, w - 5, y, '#5a3a22'); p.hl(4, w - 5, y + 1, '#a8784a'); }
    p.tri(0, roofH + 2, w / 2, 0, w, roofH + 2, roofCol);
    p.tri(4, roofH, w / 2, 3, w - 4, roofH, '#f4f8ff');
    p.tri(10, roofH, w / 2, 8, w - 10, roofH, roofCol);
    p.rect(0, roofH, w, 3, '#f4f8ff'); p.hl(0, w - 1, roofH + 3, '#c8d6ea');
    if (door) { const dx = Math.floor(w / 2) - 7; p.rect(dx, h - 22, 14, 22, '#3a2414'); p.rect(dx + 2, h - 20, 10, 20, '#6a4226'); p.px(dx + 10, h - 10, '#d8ac44'); }
  }
  P.def('house_sk', { solid: [76, 24], draw() {
    const p = new Pix(80, 66);
    cabin(p, 80, 66, '#2a5a8a', '#8a5a36', true);
    const win = (x, y) => { p.rect(x, y, 14, 12, '#3a2414'); p.rect(x + 1, y + 1, 12, 10, '#ffe08a'); p.vl(x + 7, y + 1, y + 10, '#3a2414'); p.hl(x + 1, x + 12, y + 5, '#3a2414'); };
    win(10, 40); win(56, 40);
    p.rect(30, 30, 20, 8, '#f4f4f4'); p.rect(31, 31, 18, 6, '#2f7d34'); p.hl(33, 46, 33, '#ffffff'); p.hl(33, 42, 35, '#ffffff');
    return p.c;
  }, light: { r: 50, oy: -18, col: 'warm' } });
  P.def('inn', { solid: [76, 24], draw() {
    const p = new Pix(80, 66);
    cabin(p, 80, 66, '#8a2a3a', '#9a6a42', true);
    const win = (x, y) => { p.rect(x, y, 14, 12, '#3a2414'); p.rect(x + 1, y + 1, 12, 10, '#ffd070'); p.vl(x + 7, y + 1, y + 10, '#3a2414'); };
    win(10, 40); win(56, 40);
    p.rect(26, 28, 28, 9, '#3a2414'); p.rect(27, 29, 26, 7, '#e8d0a0'); p.hl(29, 50, 31, '#8a2a3a'); p.hl(29, 44, 33, '#8a2a3a');
    return p.c;
  }, light: { r: 50, oy: -18, col: 'warm' } });
  P.def('shop', { solid: [60, 14], draw() {
    const p = new Pix(64, 50);
    p.rect(4, 12, 4, 38, '#6a4226'); p.rect(56, 12, 4, 38, '#6a4226');
    p.rect(0, 4, 64, 12, '#c83a4a'); for (let k = 0; k < 64; k += 8) p.rect(k, 4, 4, 12, '#f4f4f4'); p.hl(0, 63, 15, '#8a2a3a'); p.hl(0, 63, 3, '#f4f8ff'); p.hl(0, 63, 4, '#f4f8ff');
    p.rect(2, 32, 60, 18, '#8a5a36'); p.rect(2, 30, 60, 4, '#a8784a'); p.hl(2, 61, 30, '#c8946a');
    p.rect(10, 26, 6, 5, '#f4f4f4'); p.rect(11, 25, 4, 2, '#7fd4ff'); p.rect(22, 27, 8, 4, '#c87a3a'); p.rect(40, 25, 5, 6, '#6a4226'); p.rect(46, 27, 8, 4, '#e8e0f0');
    for (let y = 36; y < 50; y += 4) p.hl(2, 61, y, '#7a4a2a');
    return p.c;
  } });
  P.def('mailbox', { solid: [8, 4], draw(state) {
    const p = new Pix(10, 18);
    p.rect(4, 8, 2, 10, '#5a3a22'); p.rect(0, 1, 10, 8, state === 'red' ? '#c83a3a' : '#3a6ad8'); p.hl(0, 9, 1, '#f4f8ff'); p.rect(8, 3, 2, 3, '#ffe23a');
    return p.c;
  } });
  P.def('bench', { solid: [26, 6], draw() {
    const p = new Pix(28, 14);
    p.rect(0, 5, 28, 3, '#8a5a36'); p.hl(0, 27, 5, '#a8784a'); p.rect(0, 0, 28, 3, '#7a4a2a'); p.rect(2, 8, 2, 6, '#4a3220'); p.rect(24, 8, 2, 6, '#4a3220'); p.hl(0, 27, 0, '#f4f8ff');
    return p.c;
  } });
  P.def('iceswitch', { noOutline: true, flat: true, draw(state) {
    const p = new Pix(14, 14);
    p.rect(0, 0, 14, 14, '#5a6a8a'); p.rect(1, 1, 12, 12, state === 'on' ? '#5cd86a' : '#d84a4a'); p.rect(4, 4, 6, 6, state === 'on' ? '#a8ffb0' : '#ff9a9a');
    return p.c;
  } });
  P.def('snowpile', { solid: [18, 6], draw() {
    const p = new Pix(22, 12);
    p.ellipse(11, 8, 10, 4, '#d4e0ef'); p.ellipse(10, 6, 8, 4, '#f4f8ff'); p.ellipse(7, 5, 4, 2, '#ffffff');
    return p.c;
  } });
  P.def('rack', { solid: [24, 6], draw() {
    const p = new Pix(26, 26);
    p.rect(2, 4, 2, 22, '#5a3a22'); p.rect(22, 4, 2, 22, '#5a3a22'); p.rect(0, 4, 26, 2, '#7a5232'); p.hl(0, 25, 3, '#f4f8ff');
    for (let k = 0; k < 4; k++) { const c = ['#c83a3a', '#3a6ad8', '#e8c040', '#5aa85a'][k]; p.rect(5 + k * 4, 6, 3, 12, c); p.rect(5 + k * 4, 17, 3, 2, '#f4f4f4'); }
    return p.c;
  } });

  // ---- workshop ----
  P.def('wsdesk', { solid: [38, 8], draw() {
    const p = new Pix(40, 30);
    p.rect(0, 14, 40, 6, '#5a5e68'); p.hl(0, 39, 14, '#7a7e88'); p.rect(2, 20, 3, 10, '#3a3e46'); p.rect(35, 20, 3, 10, '#3a3e46');
    p.rect(14, 0, 16, 12, '#1a1c22'); p.rect(15, 1, 14, 10, '#0e2a1e'); p.rect(20, 12, 4, 3, '#2a2c32');
    p.rect(2, 10, 10, 4, '#c8d8f0'); p.hl(3, 10, 11, '#5a7ab8'); p.hl(3, 8, 12, '#5a7ab8');
    p.rect(33, 9, 4, 5, '#e8e8e8'); p.px(37, 10, '#e8e8e8'); p.px(37, 11, '#e8e8e8'); p.rect(34, 10, 2, 1, '#5a3a22');
    p.rect(8, 6, 5, 4, '#ffe86a');
    return p.c;
  }, anim(ctx, x, y, t) {
    ctx.fillStyle = '#5cff8a';
    const lines = Math.floor(t / 20) % 5;
    for (let k = 0; k < 4; k++) if (k <= lines) ctx.fillRect(x - 4, y - 28 + k * 2, 3 + ((k * 5 + 3) % 8), 1);
    if (Math.floor(t / 30) % 2) ctx.fillRect(x - 4 + 2, y - 28 + 8, 2, 1);
  }, light: { r: 40, oy: -22, col: 'green' } });
  P.def('wschair', { solid: [10, 4], draw() {
    const p = new Pix(14, 20);
    p.rect(2, 0, 10, 10, '#2a2c34'); p.rect(1, 9, 12, 4, '#3a3c44'); p.rect(6, 13, 2, 4, '#5a5e68'); p.hl(2, 11, 17, '#5a5e68'); p.px(2, 18, '#1a1a1a'); p.px(11, 18, '#1a1a1a'); p.px(6, 19, '#1a1a1a');
    return p.c;
  } });
  P.def('wsshelf', { solid: [30, 8], draw() {
    const p = new Pix(32, 34);
    p.rect(0, 0, 2, 34, '#5a5e68'); p.rect(30, 0, 2, 34, '#5a5e68');
    for (let s = 0; s < 3; s++) { const y = 10 + s * 11; p.rect(0, y, 32, 2, '#7a7e88');
      for (let k = 0; k < 5; k++) { const c = ['#c8a030', '#8a8e98', '#3a6a8a', '#a84a3a', '#5a5e68'][(k + s) % 5]; p.rect(3 + k * 6, y - 5 + (k % 2), 4, 5 - (k % 2), c); } }
    return p.c;
  } });
  P.def('wsboard', { noOutline: false, draw() {
    const p = new Pix(44, 26);
    p.rect(0, 0, 44, 26, '#3a3a42'); p.rect(1, 1, 42, 24, '#24508a');
    p.circle(14, 13, 8, '#c8e0ff'); p.circle(14, 13, 6, '#24508a'); p.circle(14, 13, 2, '#c8e0ff');
    p.hl(24, 40, 5, '#c8e0ff'); p.hl(24, 36, 8, '#c8e0ff'); p.hl(24, 39, 11, '#c8e0ff'); p.rect(26, 15, 12, 7, '#c8e0ff'); p.rect(27, 16, 10, 5, '#24508a'); p.line(27, 16, 36, 20, '#c8e0ff');
    p.px(4, 4, '#ff5a5a'); p.px(40, 22, '#ff5a5a');
    return p.c;
  } });
  P.def('machine', { solid: [52, 14], draw(state) {
    const p = new Pix(64, 64);
    p.rect(4, 54, 56, 10, '#3a3c44'); p.hl(4, 59, 54, '#5a5e68'); for (let k = 8; k < 58; k += 8) p.rect(k, 58, 4, 2, '#c8a030');
    p.ellipse(32, 30, 27, 27, '#5a5e68'); p.ellipse(32, 30, 22, 22, '#3a3c44'); p.ellipse(32, 30, 19, 19, state === 'on' ? '#e8f4ff' : '#0a0a10');
    if (state === 'on') { p.ellipse(32, 30, 14, 14, '#9ad8ff'); p.ellipse(32, 30, 8, 8, '#ffffff'); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; p.rect(32 + Math.cos(a) * 24.5 - 1, 30 + Math.sin(a) * 24.5 - 1, 3, 3, k % 3 ? '#8a8e98' : '#c8a030'); }
    p.rect(0, 20, 6, 30, '#2a2c34'); p.rect(58, 20, 6, 30, '#2a2c34'); p.line(3, 50, 3, 62, '#141418'); p.line(61, 50, 61, 62, '#141418');
    p.rect(26, 2, 12, 4, '#c8a030'); p.hl(28, 35, 3, '#1a1a1a');
    return p.c;
  } });
  P.def('crate', { solid: [16, 8], draw() {
    const p = new Pix(18, 18);
    p.rect(0, 0, 18, 18, '#8a6a42'); p.rect(2, 2, 14, 14, '#7a5a36'); p.line(2, 2, 15, 15, '#9a7a52'); p.line(15, 2, 2, 15, '#9a7a52'); p.hl(0, 17, 0, '#a8885a');
    return p.c;
  } });
  P.def('wsdoor', { solid: [16, 6], draw() {
    const p = new Pix(18, 30);
    p.rect(0, 0, 18, 30, '#2a2c34'); p.rect(2, 2, 14, 28, '#4a4e58'); p.rect(4, 6, 10, 6, '#1a1c22'); p.rect(12, 16, 2, 4, '#c8a030');
    return p.c;
  } });

  // ---- save point (procedural, animated) ----
  P.drawSave = function (ctx, x, y, t) {
    const a = t * .05;
    const rx = Math.max(1, Math.abs(Math.cos(a)) * 5), ry = 5;
    const yy = y - 10 + Math.sin(t * .06) * 1.5;
    ctx.fillStyle = 'rgba(255,240,180,0.15)'; ctx.beginPath(); ctx.arc(x, yy, 9, 0, 7); ctx.fill();
    for (let k = 0; k < 24; k++) {
      const ang = k / 24 * Math.PI * 2;
      const px = Math.round(x + Math.cos(ang) * rx), py = Math.round(yy + Math.sin(ang) * ry);
      ctx.fillStyle = Math.cos(ang + a) > 0 ? '#fff6c8' : '#e8c860';
      ctx.fillRect(px, py, 1, 1);
    }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x), Math.round(yy - 1), 1, 3); ctx.fillRect(Math.round(x - 1), Math.round(yy), 3, 1);
    if ((t >> 3) % 6 === 0) { ctx.fillStyle = '#fff6c8'; ctx.fillRect(Math.round(x + 4), Math.round(yy - 6), 1, 1); }
  };
})();
