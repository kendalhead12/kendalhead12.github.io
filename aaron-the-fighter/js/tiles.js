'use strict';
// ============================================================
//  Tiles: ids, flags, per-world procedural tilesets (autotiled)
// ============================================================
(function () {
  const T = AF.T = {
    EMPTY: 0, SOLID: 1, ALT: 2, PLAT: 3, SPIKE: 4, SPIKED: 5, LADDER: 6, VINE: 7, BREAK: 8, METAL: 9, CRACK: 10,
    SANDW: 11, ICE: 12, QSAND: 13, CONVL: 14, CONVR: 15, SECRET: 16, EFLOOR: 17, BRIDGE: 18, INVIS: 19, BGWALL: 20, GLASS: 21,
    BGALT: 22, CHAIN: 23
  };
  // flags
  const F = AF.TF = { SOLID: 1, ONEWAY: 2, CLIMB: 4, HURT: 8, SLIP: 16, BREAKABLE: 32, CONVEY: 64, QS: 128 };
  const FLAGS = AF.TFLAGS = new Uint8Array(32);
  FLAGS[T.SOLID] = F.SOLID; FLAGS[T.ALT] = F.SOLID; FLAGS[T.PLAT] = F.ONEWAY; FLAGS[T.BRIDGE] = F.ONEWAY;
  FLAGS[T.SPIKE] = F.HURT; FLAGS[T.SPIKED] = F.HURT; FLAGS[T.LADDER] = F.CLIMB; FLAGS[T.VINE] = F.CLIMB;
  FLAGS[T.BREAK] = F.SOLID | F.BREAKABLE; FLAGS[T.METAL] = F.SOLID | F.BREAKABLE; FLAGS[T.CRACK] = F.SOLID | F.BREAKABLE; FLAGS[T.SANDW] = F.SOLID | F.BREAKABLE;
  FLAGS[T.ICE] = F.SOLID | F.SLIP; FLAGS[T.QSAND] = F.QS; FLAGS[T.CONVL] = F.SOLID | F.CONVEY; FLAGS[T.CONVR] = F.SOLID | F.CONVEY;
  FLAGS[T.EFLOOR] = F.SOLID; FLAGS[T.INVIS] = F.SOLID; FLAGS[T.GLASS] = F.SOLID;

  // ---------------- Themes ----------------
  const TH = AF.THEMES = {
    1: { name: 'forest', cap: 'grass', fill: 'dirt', alt: 'ruins', plat: 'log', ladder: 'vine', spike: ['#8a8aa0', '#d0d0e0', '#50506a'],
      c: { top: ['#1e6a1c', '#38a030', '#68d040', '#b8f070'], fill: ['#4a2a14', '#6e4220', '#8e5a2c', '#b07a40'], alt: ['#3a4a3a', '#5a6e58', '#7e9478', '#a8bca0'], plat: ['#4a2810', '#7a4a20', '#a86c34', '#d09050'] } },
    2: { name: 'aqua', cap: 'trim', fill: 'tiles', alt: 'glassblock', plat: 'grate', ladder: 'ladder', spike: ['#5a6a8a', '#c0d8f0', '#304060'],
      c: { top: ['#1a5a80', '#3a9ac8', '#f0f8ff', '#ffffff'], fill: ['#0c3048', '#14506a', '#1e7890', '#4ab0c0'], alt: ['#205878', '#3a8ab0', '#70c0e0', '#c0f0ff'], plat: ['#303a50', '#56627e', '#8a98b0', '#c8d0e0'] } },
    3: { name: 'ice', cap: 'snow', fill: 'crystal', alt: 'frozenbrick', plat: 'iceledge', ladder: 'ladder', spike: ['#3878d8', '#c8f0ff', '#1a3a90'],
      c: { top: ['#7088d0', '#b8c8f0', '#e8f0ff', '#ffffff'], fill: ['#10184a', '#3060c8', '#58b8f0', '#b0e8ff', '#7a68d8', '#b8a8f8'], alt: ['#3a5a90', '#5a80b8', '#88b0e0', '#c8e0ff'], plat: ['#3070c0', '#60a8e8', '#a8e0ff', '#ffffff'] } },
    4: { name: 'lava', cap: 'crust', fill: 'basalt', alt: 'minewood', plat: 'grate', ladder: 'ladder', spike: ['#5a3a3a', '#c8a0a0', '#301818'],
      c: { top: ['#2a1414', '#5a2a24', '#8a4030', '#ff9030'], fill: ['#1c0c10', '#3a1c20', '#5c2c2c', '#7c4038', '#ff6a18', '#ffc040'], alt: ['#3a2210', '#6a4020', '#946030', '#c08850'], plat: ['#2a2a30', '#4a4a56', '#70707c', '#a0a0b0'] } },
    5: { name: 'city', cap: 'hazard', fill: 'steel', alt: 'brick', plat: 'girder', ladder: 'ladder', spike: ['#606070', '#d0d0e0', '#303040'],
      c: { top: ['#2a2a34', '#f0c020', '#202028', '#fff070'], fill: ['#2a2e40', '#4a5068', '#6a7290', '#9aa2c0'], alt: ['#5a2418', '#8a3a24', '#b45a34', '#d88a5a'], plat: ['#6a2410', '#b84a1c', '#e87830', '#ffb070'] } },
    6: { name: 'desert', cap: 'sand', fill: 'sandstone', alt: 'templebrick', plat: 'slab', ladder: 'ladder', spike: ['#806040', '#e8d0a0', '#503820'],
      c: { top: ['#b07828', '#e0b050', '#f8d880', '#fff0c0'], fill: ['#6a3a18', '#a8642c', '#d09048', '#f0c070'], alt: ['#6a4428', '#a07040', '#c89a60', '#f0d090'], plat: ['#7a5a3a', '#a8865a', '#d0b080', '#f0e0b0'] } },
    7: { name: 'sky', cap: 'skygrass', fill: 'skyrock', alt: 'marble', plat: 'cloudwood', ladder: 'vine', spike: ['#8080a0', '#e0e0ff', '#404060'],
      c: { top: ['#2a8a3a', '#50c050', '#90e870', '#e0ffb0'], fill: ['#4a3a5a', '#7a6080', '#a888a0', '#d8c0c8'], alt: ['#8a88a8', '#b8b8d0', '#e0e0f0', '#ffffff'], plat: ['#6a4a2a', '#9a6a3a', '#c89058', '#f0c080'] } },
    8: { name: 'lab', cap: 'techtop', fill: 'techpanel', alt: 'hazardblock', plat: 'techgrate', ladder: 'ladder', spike: ['#504870', '#d0c0ff', '#282040'],
      c: { top: ['#1a1830', '#3a3860', '#30f0c0', '#c0fff0'], fill: ['#0e0c1c', '#1e1a34', '#2e2a4c', '#46406c', '#30f0c0', '#ff3070'], alt: ['#2a2a20', '#f0c020', '#1a1a10', '#fff080'], plat: ['#2a2840', '#4a4670', '#7a76a8', '#30f0c0'] } }
  };

  // ---------------- fill patterns (32x32, tileable) ----------------
  function pattern(th) {
    const p = new AF.Pix(32, 32), c = th.c.fill, rnd = AF.seeded(th.name.length * 977 + 13);
    const R = () => rnd();
    switch (th.fill) {
      case 'dirt': {
        p.rect(0, 0, 32, 32, c[1]);
        for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x++) if (((x + y * 3) % 7) < 3) p.set(x, y + ((x >> 2) & 1), c[0]);
        for (let i = 0; i < 40; i++) p.set(R() * 32, R() * 32, R() < .5 ? c[2] : c[0]);
        for (let i = 0; i < 5; i++) { const x = R() * 28 + 2, y = R() * 28 + 2, r = 1.5 + R() * 2; p.shadeEll(x, y, r + .5, r, ['#3a2a24', '#6a5a50', '#9a8a7a', '#c8b8a0']); }
        break;
      }
      case 'crystal': {
        p.rect(0, 0, 32, 32, c[0]);
        const cubes = [[8, 8, 0], [24, 8, 1], [0, 24, 1], [16, 24, 0], [32, 24, 1], [8, 40, 0], [24, -8, 0], [-8, 8, 1], [40, 8, 1], [32, -8, 1], [0, -8, 1], [16, 40, 0], [24, 40, 0]];
        for (const [cx, cy, v] of cubes) {
          const a = v ? [c[4], c[5], '#e0d8ff'] : [c[1], c[2], c[3]];
          const s = 7;
          // three facets of an isometric cube
          p.poly([[cx, cy - s], [cx + s, cy - s / 2 + 1], [cx, cy + 1], [cx - s, cy - s / 2 + 1]], a[2]); // top
          p.poly([[cx - s, cy - s / 2 + 1], [cx, cy + 1], [cx, cy + s], [cx - s, cy + s / 2]], a[1]); // left
          p.poly([[cx + s, cy - s / 2 + 1], [cx + s, cy + s / 2], [cx, cy + s], [cx, cy + 1]], a[0]); // right
          p.set(cx - 2, cy - s + 3, '#ffffff'); p.set(cx - 3, cy - s + 3, '#ffffff');
        }
        // wrap: copy is implicit since cubes straddle edges symmetrically
        break;
      }
      case 'tiles': {
        p.rect(0, 0, 32, 32, c[0]);
        for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
          const alt = (tx + ty) & 1;
          p.rect(tx * 8 + 1, ty * 8 + 1, 7, 7, alt ? c[1] : c[2]);
          p.rect(tx * 8 + 1, ty * 8 + 1, 6, 1, alt ? c[2] : c[3]);
          p.set(tx * 8 + 2, ty * 8 + 2, '#ffffff');
        }
        break;
      }
      case 'basalt': {
        // voronoi chunks
        const pts = []; for (let i = 0; i < 7; i++) pts.push([R() * 32, R() * 32, R()]);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          let b = 1e9, b2 = 1e9, bi = 0;
          for (let i = 0; i < pts.length; i++) for (let ox = -32; ox <= 32; ox += 32) for (let oy = -32; oy <= 32; oy += 32) {
            const d = Math.hypot(x - pts[i][0] - ox, y - pts[i][1] - oy);
            if (d < b) { b2 = b; b = d; bi = i; } else if (d < b2) b2 = d;
          }
          const edge = b2 - b < 1.3;
          const hi = (y - pts[bi][1]) < -2 && (x - pts[bi][0]) < 1;
          p.set(x, y, edge ? c[0] : hi ? c[3] : (pts[bi][2] > .5 ? c[2] : c[1]));
        }
        // magma vein
        let x = R() * 32, y = 0; for (let i = 0; i < 40; i++) { p.set(x, y, c[4]); if (R() < .3) p.set(x + 1, y, c[5]); y += 1; x += (R() - .5) * 2; if (y > 31) break; }
        break;
      }
      case 'steel': {
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
          const ox = tx * 16, oy = ty * 16, v = (tx + ty) & 1;
          p.rect(ox, oy, 16, 16, v ? c[1] : c[2]);
          p.rect(ox, oy, 16, 1, c[3]); p.rect(ox, oy, 1, 16, c[3]);
          p.rect(ox, oy + 15, 16, 1, c[0]); p.rect(ox + 15, oy, 1, 16, c[0]);
          for (const [rx, ry] of [[3, 3], [12, 3], [3, 12], [12, 12]]) { p.set(ox + rx, oy + ry, c[3]); p.set(ox + rx + 1, oy + ry + 1, c[0]); }
          if (v) { p.rect(ox + 5, oy + 6, 6, 1, c[0]); p.rect(ox + 5, oy + 9, 6, 1, c[0]); }
        }
        break;
      }
      case 'sandstone': {
        for (let y = 0; y < 32; y++) {
          const band = Math.floor((y + Math.sin(y * .7) * 1.2) / 5) % 3;
          for (let x = 0; x < 32; x++) {
            const wob = Math.sin((x + y * 2) * .39) > .85;
            p.set(x, y, wob ? c[0] : [c[1], c[2], c[1]][band]);
          }
          if (y % 5 === 0) for (let x = 0; x < 32; x++) if ((x * 7 + y) % 9 < 6) p.set(x, y, c[3]);
        }
        for (let i = 0; i < 25; i++) p.set(R() * 32, R() * 32, c[0]);
        break;
      }
      case 'skyrock': {
        p.rect(0, 0, 32, 32, c[1]);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const v = Math.sin(x * .4 + Math.sin(y * .3) * 2) + Math.sin(y * .55); if (v > 1.1) p.set(x, y, c[2]); else if (v < -1.2) p.set(x, y, c[0]); }
        for (let i = 0; i < 14; i++) p.set(R() * 32, R() * 32, c[3]);
        break;
      }
      case 'techpanel': {
        p.rect(0, 0, 32, 32, c[1]);
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
          const ox = tx * 16, oy = ty * 16;
          p.rect(ox + 1, oy + 1, 14, 14, c[2]); p.rect(ox + 1, oy + 1, 14, 1, c[3]); p.rect(ox + 1, oy + 1, 1, 14, c[3]);
          p.rect(ox, oy + 15, 16, 1, c[0]); p.rect(ox + 15, oy, 1, 16, c[0]);
        }
        p.line(4, 6, 12, 6, c[0]); p.line(12, 6, 12, 10, c[0]); p.set(12, 11, c[4]);
        p.line(20, 22, 28, 22, c[0]); p.line(20, 22, 20, 26, c[0]); p.set(20, 27, c[5]);
        p.set(6, 20, c[4]); p.set(26, 4, c[4]);
        break;
      }
    }
    return p;
  }
  function altPattern(th) {
    const p = new AF.Pix(32, 32), c = th.c.alt;
    switch (th.alt) {
      case 'glassblock':
        p.rect(0, 0, 32, 32, c[1]);
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const ox = tx * 16, oy = ty * 16; p.rect(ox + 1, oy + 1, 14, 14, c[2]); p.rect(ox + 2, oy + 2, 3, 1, c[3]); p.rect(ox + 2, oy + 2, 1, 3, c[3]); p.rect(ox + 15, oy, 1, 16, c[0]); p.rect(ox, oy + 15, 16, 1, c[0]); }
        break;
      case 'minewood':
        p.rect(0, 0, 32, 32, c[1]);
        for (let x = 0; x < 32; x += 8) { p.rect(x, 0, 1, 32, c[0]); p.rect(x + 1, 0, 1, 32, c[2]); }
        for (let y = 0; y < 32; y++) if ((y * 5) % 11 === 0) p.set((y * 13) % 32, y, c[0]);
        p.rect(0, 14, 32, 4, c[0]); p.rect(0, 15, 32, 2, '#5a5a66'); p.set(4, 15, '#a0a0b0'); p.set(20, 15, '#a0a0b0');
        break;
      case 'hazardblock':
        p.rect(0, 0, 32, 32, c[0]);
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (((x + y) >> 2) & 1) p.set(x, y, c[1]);
        for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) { const ox = tx * 16, oy = ty * 16; p.rect(ox, oy, 16, 1, c[3]); p.rect(ox, oy + 15, 16, 1, c[2]); p.rect(ox + 15, oy, 1, 16, c[2]); p.rect(ox, oy, 1, 16, c[3]); }
        break;
      default: { // bricks (ruins, frozenbrick, brick, templebrick, marble)
        p.rect(0, 0, 32, 32, c[0]);
        for (let row = 0; row < 4; row++) {
          const off = (row & 1) * 8;
          for (let b = -1; b < 3; b++) {
            const x = b * 16 + off, y = row * 8;
            p.rect(x + 1, y + 1, 15, 7, c[1]); p.rect(x + 1, y + 1, 15, 1, c[2]); p.rect(x + 1, y + 1, 1, 6, c[2]);
            p.set(x + 2, y + 2, c[3]);
          }
        }
        if (th.alt === 'ruins') { for (let i = 0; i < 18; i++) { const x = (i * 13) % 32, y = (i * 7) % 32; p.set(x, y, '#4a8a3a'); p.set(x + 1, y, '#3a7a2a'); } }
        if (th.alt === 'templebrick') { p.rect(4, 3, 3, 3, c[0]); p.set(5, 4, c[3]); p.rect(20, 19, 4, 2, c[0]); p.rect(21, 18, 2, 4, c[0]); }
        if (th.alt === 'marble') { for (let i = 0; i < 32; i++) p.set(i, Math.round(10 + Math.sin(i * .3) * 3), c[1]); }
      }
    }
    return p;
  }
  // ---------------- surface caps ----------------
  function drawCap(p, th, lf, rt, par) {
    const c = th.c.top;
    const wob = x => Math.round(Math.sin((x + par * 16) * .9) * .8 + Math.sin((x + par * 16) * .37));
    switch (th.cap) {
      case 'grass':
        for (let x = 0; x < 16; x++) {
          const d = 4 + wob(x) + ((x * 7 + par * 3) % 5 === 0 ? 2 : 0);
          for (let y = 0; y < d; y++) p.set(x, y, y === 0 ? c[3] : y === 1 ? c[2] : y < d - 1 ? c[1] : c[0]);
          if ((x + par * 5) % 6 === 2) p.set(x, d, c[0]);
        }
        break;
      case 'skygrass':
        for (let x = 0; x < 16; x++) { const d = 4 + wob(x); for (let y = 0; y < d; y++) p.set(x, y, y === 0 ? c[3] : y < 2 ? c[2] : y < d - 1 ? c[1] : c[0]); }
        if (par & 1) { p.set(5, 1, '#ff80c0'); p.set(11, 2, '#fff080'); }
        break;
      case 'snow':
        for (let x = 0; x < 16; x++) {
          const drip = ((x * 5 + par * 7) % 11 < 3) ? 3 : ((x * 3 + par) % 7 < 2 ? 1 : 0);
          const d = 6 + wob(x) + drip;
          for (let y = 0; y < d; y++) p.set(x, y, y === 0 ? c[2] : y < 3 ? c[3] : y < d - 2 ? c[2] : y < d - 1 ? c[1] : c[0]);
        }
        for (let x = 0; x < 16; x += 5) p.set(x + (par & 3), 2, c[1]);
        break;
      case 'sand':
        for (let x = 0; x < 16; x++) { const d = 4 + wob(x); for (let y = 0; y < d; y++) p.set(x, y, y === 0 ? c[3] : y < 2 ? c[2] : y < d - 1 ? c[1] : c[0]); }
        break;
      case 'crust':
        for (let x = 0; x < 16; x++) { const d = 3 + (wob(x) > 0 ? 1 : 0); for (let y = 0; y < d; y++) p.set(x, y, y === 0 ? c[2] : y < d - 1 ? c[1] : c[0]); }
        p.set(3 + par, 1, c[3]); p.set(11 - par, 2, c[3]);
        break;
      case 'trim':
        p.rect(0, 0, 16, 4, c[2]); p.rect(0, 0, 16, 1, c[3]); p.rect(0, 3, 16, 1, c[0]); p.rect(0, 4, 16, 1, c[1]);
        for (let x = 2; x < 16; x += 8) p.set(x, 1, c[1]);
        break;
      case 'hazard':
        for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) p.set(x, y, (((x + y + par * 2) >> 2) & 1) ? c[1] : c[2]);
        p.rect(0, 0, 16, 1, c[3]); p.rect(0, 4, 16, 1, c[0]);
        break;
      case 'techtop':
        p.rect(0, 0, 16, 4, c[1]); p.rect(0, 0, 16, 1, '#6a66a0'); p.rect(0, 2, 16, 1, c[2]); p.rect(0, 4, 16, 1, c[0]);
        if (par & 1) p.set(8, 2, c[3]);
        break;
    }
    // rounded outer corners on caps
    if (!lf) { p.set(0, 0, 0); p.set(0, 1, 0); p.set(1, 0, 0); }
    if (!rt) { p.set(15, 0, 0); p.set(15, 1, 0); p.set(14, 0, 0); }
  }

  function terrainTile(pat, th, mask, par, noCap, edge) {
    const p = new AF.Pix(16, 16);
    const ox = (par & 1) * 16, oy = (par >> 1) * 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.d[y * 16 + x] = pat.d[(y + oy) * 32 + x + ox];
    const up = mask & 1, rt = mask & 2, dn = mask & 4, lf = mask & 8;
    const dark = edge || '#120818';
    const sh = (x, y) => { const v = p.get(x, y); if (v) { const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255; p.set(x, y, AF.hexOf(r * .65, g * .65, b * .75)); } };
    if (!lf) { for (let y = 0; y < 16; y++) { p.set(0, y, dark); sh(1, y); } }
    if (!rt) { for (let y = 0; y < 16; y++) { p.set(15, y, dark); sh(14, y); sh(13, y); } }
    if (!dn) { for (let x = 0; x < 16; x++) { p.set(x, 15, dark); sh(x, 14); sh(x, 13); } }
    if (!up) { if (noCap) { for (let x = 0; x < 16; x++) p.set(x, 0, dark); } else drawCap(p, th, lf, rt, par); }
    // round outer bottom corners
    if (!dn && !lf) { p.set(0, 15, 0); p.set(1, 15, dark); p.set(0, 14, dark); }
    if (!dn && !rt) { p.set(15, 15, 0); p.set(14, 15, dark); p.set(15, 14, dark); }
    if (!up && !lf && noCap) { p.set(0, 0, 0); }
    if (!up && !rt && noCap) { p.set(15, 0, 0); }
    return p;
  }

  // ---------------- special tiles ----------------
  function platTile(th, kind) {
    const p = new AF.Pix(16, 16), c = th.c.plat;
    switch (kind || th.plat) {
      case 'log':
        p.rect(0, 1, 16, 6, c[1]); p.rect(0, 1, 16, 1, c[3]); p.rect(0, 2, 16, 1, c[2]); p.rect(0, 6, 16, 1, c[0]);
        for (let x = 1; x < 16; x += 5) p.set(x, 4, c[0]); p.rect(0, 0, 16, 1, '#120818'); p.rect(0, 7, 16, 1, '#120818');
        break;
      case 'grate': case 'techgrate':
        p.rect(0, 0, 16, 6, c[0]); p.rect(0, 0, 16, 2, c[2]); p.rect(0, 0, 16, 1, c[3]);
        for (let x = 1; x < 16; x += 3) p.rect(x, 2, 1, 3, c[1]); p.rect(0, 5, 16, 1, '#120818');
        if (kind === 'techgrate' || th.plat === 'techgrate') p.set(7, 1, '#30f0c0');
        break;
      case 'iceledge':
        p.rect(0, 0, 16, 5, c[1]); p.rect(0, 0, 16, 1, c[3]); p.rect(0, 1, 16, 1, c[2]); p.rect(0, 5, 16, 1, '#1a3a90');
        p.set(3, 6, c[0]); p.set(4, 6, c[0]); p.set(3, 7, c[0]); p.set(11, 6, c[0]); p.set(11, 7, c[0]); p.set(11, 8, c[1]);
        break;
      case 'girder':
        p.rect(0, 0, 16, 2, c[2]); p.rect(0, 0, 16, 1, c[3]); p.rect(0, 6, 16, 2, c[1]); p.rect(0, 7, 16, 1, c[0]);
        for (let x = 0; x < 16; x++) { const y = 2 + Math.abs(((x % 8) - 4)); p.set(x, Math.min(5, y), c[1]); p.set(x, Math.min(5, y) + 1 > 5 ? 5 : Math.min(5, y), c[1]); }
        p.rect(0, 2, 1, 4, c[1]); p.rect(8, 2, 1, 4, c[1]);
        break;
      case 'slab':
        p.rect(0, 0, 16, 6, c[1]); p.rect(0, 0, 16, 1, c[3]); p.rect(0, 1, 16, 1, c[2]); p.rect(0, 6, 16, 1, '#3a2a18'); p.rect(0, 5, 16, 1, c[0]); p.set(6, 3, c[0]); p.set(13, 2, c[0]);
        break;
      case 'cloudwood':
        p.rect(0, 1, 16, 5, c[1]); p.rect(0, 1, 16, 1, c[3]); p.rect(0, 6, 16, 1, '#2a1a0a'); p.rect(0, 0, 16, 1, '#2a1a0a');
        p.rect(7, 1, 1, 5, c[0]); p.rect(15, 1, 1, 5, c[0]); p.set(2, 3, c[0]);
        break;
      case 'bridge':
        p.rect(0, 1, 16, 1, '#5a3a1a'); for (let x = 0; x < 16; x += 4) { p.rect(x, 2, 3, 4, '#b07838'); p.rect(x, 2, 3, 1, '#e0a860'); p.rect(x, 5, 3, 1, '#6a4018'); }
        p.rect(0, 3, 16, 1, '#4a2a0a'); p.set(1, 3, '#4a2a0a');
        break;
    }
    return p;
  }
  function spikeTile(th, down) {
    const p = new AF.Pix(16, 16), c = th.spike;
    for (let i = 0; i < 4; i++) {
      const bx = i * 4;
      for (let y = 0; y < 8; y++) { const half = Math.floor(y / 4 * 2 + .5) * .5 + .5; const w = Math.min(2, Math.floor(y / 3.5) + 1); for (let x = 2 - w; x < 2 + w; x++) p.set(bx + x, 8 + y, x < 2 ? c[1] : c[0]); }
      p.set(bx + 1, 8, c[1]); p.set(bx + 1, 9, c[1]);
    }
    p.rect(0, 15, 16, 1, c[2]);
    p.outline('#120818');
    if (down) { const q = new AF.Pix(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) q.d[(15 - y) * 16 + x] = p.d[y * 16 + x]; return q; }
    return p;
  }
  function ladderTile(th, vine) {
    const p = new AF.Pix(16, 16);
    if (vine) {
      for (let y = 0; y < 16; y++) { const x = 8 + Math.round(Math.sin(y * .4) * 2); p.set(x, y, '#2a7a20'); p.set(x + 1, y, '#58c040'); p.set(x - 1, y, '#1a4a14'); }
      p.ell(5, 4, 2.5, 1.5, '#58c040'); p.set(4, 4, '#a8f070'); p.ell(12, 11, 2.5, 1.5, '#48b038'); p.set(12, 10, '#a8f070');
      p.outline('#0e3010');
    } else {
      const c = th.name === 'lab' || th.name === 'city' || th.name === 'aqua' ? ['#40465a', '#8890a8', '#c8d0e0'] : ['#5a3418', '#9a6430', '#d09050'];
      p.rect(3, 0, 2, 16, c[1]); p.rect(11, 0, 2, 16, c[1]); p.rect(3, 0, 1, 16, c[2]); p.rect(11, 0, 1, 16, c[2]);
      for (let y = 3; y < 16; y += 6) { p.rect(5, y, 6, 2, c[1]); p.rect(5, y, 6, 1, c[2]); }
      p.outline(c[0]);
    }
    return p;
  }
  function blockTile(kind, th) {
    const p = new AF.Pix(16, 16);
    if (kind === 'break') {
      const c = th.c.alt;
      p.rect(0, 0, 16, 16, c[1]); p.rect(1, 1, 14, 1, c[2]); p.rect(1, 1, 1, 14, c[2]);
      p.line(3, 2, 7, 7, c[0]); p.line(7, 7, 5, 12, c[0]); p.line(7, 7, 12, 9, c[0]); p.line(12, 9, 14, 4, c[0]); p.line(12, 9, 11, 14, c[0]);
      p.rect(0, 15, 16, 1, '#120818'); p.rect(15, 0, 1, 16, '#120818'); p.rect(0, 0, 16, 1, '#120818'); p.rect(0, 0, 1, 16, '#120818');
    } else if (kind === 'metal') {
      p.rect(0, 0, 16, 16, '#5a6278'); p.rect(1, 1, 14, 14, '#8a92a8'); p.rect(1, 1, 14, 1, '#c8d0e0'); p.rect(1, 1, 1, 14, '#c8d0e0');
      p.line(3, 3, 12, 12, '#5a6278'); p.line(12, 3, 3, 12, '#5a6278'); p.line(4, 3, 13, 12, '#b0b8cc'); p.line(13, 3, 4, 12, '#b0b8cc');
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) p.set(x, y, '#30364a');
      p.rect(0, 15, 16, 1, '#1a1a28'); p.rect(15, 0, 1, 16, '#1a1a28');
    } else if (kind === 'crack') {
      const c = th.c.fill;
      p.rect(0, 0, 16, 16, c[2] || c[1]); p.rect(0, 0, 16, 2, c[3] || c[2]);
      p.line(2, 0, 6, 6, '#120818'); p.line(6, 6, 4, 15, '#120818'); p.line(6, 6, 12, 8, '#120818'); p.line(12, 8, 15, 2, '#120818'); p.line(12, 8, 13, 15, '#120818');
      p.rect(0, 15, 16, 1, '#120818'); p.rect(0, 0, 1, 16, '#120818'); p.rect(15, 0, 1, 16, '#120818');
      p.rect(5, 3, 2, 1, '#ffffff');
    } else if (kind === 'sandw') {
      p.rect(0, 0, 16, 16, '#c88a40'); p.rect(1, 1, 14, 1, '#f0c070'); p.rect(0, 8, 16, 1, '#8a5a24');
      p.line(4, 1, 8, 6, '#6a3a14'); p.line(8, 6, 6, 8, '#6a3a14'); p.line(10, 9, 13, 14, '#6a3a14'); p.line(10, 9, 7, 13, '#6a3a14');
      p.rect(0, 15, 16, 1, '#4a2a0a'); p.rect(15, 0, 1, 16, '#4a2a0a'); p.rect(0, 0, 1, 16, '#4a2a0a'); p.rect(0, 0, 16, 1, '#4a2a0a');
    } else if (kind === 'ice') {
      p.rect(0, 0, 16, 16, '#58b8f0'); p.rect(1, 1, 14, 14, '#90d8ff'); p.poly([[1, 1], [15, 1], [1, 15]], '#b8ecff');
      p.line(3, 11, 11, 3, '#ffffff'); p.line(4, 12, 12, 4, '#e0f8ff'); p.rect(0, 15, 16, 1, '#2a5ab0'); p.rect(15, 0, 1, 16, '#2a5ab0'); p.rect(0, 0, 16, 1, '#e8fcff'); p.rect(0, 0, 1, 16, '#2a5ab0');
    } else if (kind === 'glass') {
      p.rect(0, 0, 16, 1, '#c0f0ff'); p.rect(0, 15, 16, 1, '#3a8ab0'); p.rect(0, 0, 1, 16, '#c0f0ff'); p.rect(15, 0, 1, 16, '#3a8ab0');
      p.line(3, 12, 12, 3, '#e0faff'); p.line(6, 13, 13, 6, '#a0e0f0');
    } else if (kind === 'efloor') {
      p.rect(0, 0, 16, 16, '#2a2840'); p.rect(0, 0, 16, 4, '#4a4670'); p.rect(0, 0, 16, 1, '#8a86c0');
      for (let x = 1; x < 16; x += 4) { p.rect(x, 1, 2, 2, '#f0d020'); }
      p.rect(0, 4, 16, 1, '#120818'); p.rect(2, 7, 12, 6, '#3a3858'); p.line(3, 10, 12, 10, '#f0d020');
      p.rect(0, 15, 16, 1, '#120818');
    } else if (kind === 'qsand') {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.set(x, y, ((x * 3 + y * 5 + (y >> 2)) % 7 < 2) ? '#c08a40' : '#d8a458');
      for (let x = 0; x < 16; x++) p.set(x, Math.round(1 + Math.sin(x * .8)), '#f0c878');
      for (let x = 0; x < 16; x++) p.set(x, 0, 0);
      p.ell(8, 9, 4, 2, '#a87030'); p.ell(8, 9, 2, 1, '#8a5a20');
    } else if (kind === 'chain') {
      for (let y = 0; y < 16; y += 4) { p.rect(7, y, 2, 3, '#8a8aa0'); p.set(7, y, '#d0d0e0'); }
      p.outline('#202030');
    }
    return p;
  }
  function convTile(dir, frame) {
    const p = new AF.Pix(16, 16);
    p.rect(0, 0, 16, 16, '#3a3e50'); p.rect(0, 0, 16, 6, '#202430'); p.rect(0, 0, 16, 1, '#6a7088');
    for (let x = 0; x < 16; x++) if (((x - dir * frame * 2) & 7) < 3) p.set(x, 2, '#c0c8d8'), p.set(x, 3, '#c0c8d8');
    // arrows
    const ax = ((8 + dir * frame * 2) % 16 + 16) % 16;
    p.set(ax, 9, '#f0c020'); p.set(ax + dir, 10, '#f0c020'); p.set(ax, 11, '#f0c020');
    p.ell(4, 12, 2.5, 2.5, '#5a6278'); p.ell(12, 12, 2.5, 2.5, '#5a6278'); p.set(4, 12, '#c8d0e0'); p.set(12, 12, '#c8d0e0');
    p.rect(0, 15, 16, 1, '#120818'); p.rect(0, 6, 16, 1, '#120818');
    return p;
  }

  // ---------------- tileset assembly ----------------
  // Atlas index layout:
  //  0..63   SOLID terrain (par*16 + mask)
  //  64..127 ALT terrain
  //  128..191 ICE terrain (uses crystal fill, snow cap)
  //  192 PLAT, 193 BRIDGE, 194 SPIKE, 195 SPIKED, 196 LADDER, 197 VINE, 198 BREAK, 199 METAL, 200 CRACK, 201 SANDW
  //  202 ICEBLOCK, 203 QSAND, 204..207 CONVL frames, 208..211 CONVR frames, 212 EFLOOR, 213 GLASS, 214 CHAIN
  //  256..319 BGWALL (darkened SOLID), 320..383 BGALT (darkened ALT)
  const cache = {};
  AF.tileset = function (world) {
    if (cache[world]) return cache[world];
    const th = TH[world];
    const atlas = AF.makeCanvas(16 * 16, 16 * 24), x = atlas.getContext('2d');
    const put = (idx, pix) => x.drawImage(pix.canvas(), (idx % 16) * 16, Math.floor(idx / 16) * 16);
    const pat = pattern(th), apat = altPattern(th);
    const ith = TH[3], ipat = pattern(ith);
    for (let par = 0; par < 4; par++) for (let m = 0; m < 16; m++) {
      put(par * 16 + m, terrainTile(pat, th, m, par, false));
      put(64 + par * 16 + m, terrainTile(apat, th, m, par, true));
      put(128 + par * 16 + m, terrainTile(ipat, ith, m, par, false, '#0a1040'));
    }
    put(192, platTile(th)); put(193, platTile(th, 'bridge'));
    put(194, spikeTile(th, false)); put(195, spikeTile(th, true));
    put(196, ladderTile(th, th.ladder === 'vine')); put(197, ladderTile(th, true));
    put(198, blockTile('break', th)); put(199, blockTile('metal', th)); put(200, blockTile('crack', th)); put(201, blockTile('sandw', th));
    put(202, blockTile('ice', th)); put(203, blockTile('qsand', th));
    for (let f = 0; f < 4; f++) { put(204 + f, convTile(-1, f)); put(208 + f, convTile(1, f)); }
    put(212, blockTile('efloor', th)); put(213, blockTile('glass', th)); put(214, blockTile('chain', th));
    // background walls: darkened copies
    const dark = AF.makeCanvas(16 * 16, 16 * 8), dx = dark.getContext('2d');
    dx.drawImage(atlas, 0, 0, 256, 128, 0, 0, 256, 128);
    dx.globalCompositeOperation = 'source-atop'; dx.fillStyle = 'rgba(10,6,30,0.58)'; dx.fillRect(0, 0, 256, 128);
    x.drawImage(dark, 0, 256);
    cache[world] = { atlas, th };
    return cache[world];
  };

  // Compute render index for each cell in a level (called at level load / on tile change)
  AF.tileVisual = function (lv, tx, ty) {
    const t = lv.get(tx, ty);
    const par = (tx & 1) + ((ty & 1) << 1);
    const same = (a, b) => {
      const g = lv.get(a, b);
      if (t === T.SOLID || t === T.SECRET) return g === T.SOLID || g === T.SECRET || g === T.INVIS || g === T.ALT || g === T.BREAK || g === T.CRACK || g === T.METAL || g === T.SANDW || g === T.CONVL || g === T.CONVR || g === T.EFLOOR || g === T.ICE || g === -1;
      if (t === T.ALT) return g === T.ALT || g === T.SOLID || g === T.SECRET || g === T.INVIS || g === -1 || g === T.BREAK || g === T.METAL || g === T.CRACK || g === T.SANDW;
      if (t === T.ICE) return g === T.ICE || g === T.SOLID || g === T.INVIS || g === -1 || g === T.CRACK;
      if (t === T.BGWALL || t === T.BGALT) return g !== T.EMPTY;
      return false;
    };
    const mask = (same(tx, ty - 1) ? 1 : 0) | (same(tx + 1, ty) ? 2 : 0) | (same(tx, ty + 1) ? 4 : 0) | (same(tx - 1, ty) ? 8 : 0);
    switch (t) {
      case T.SOLID: case T.SECRET: return par * 16 + mask;
      case T.ALT: return 64 + par * 16 + mask;
      case T.ICE: return 128 + par * 16 + mask;
      case T.PLAT: return 192; case T.BRIDGE: return 193; case T.SPIKE: return 194; case T.SPIKED: return 195;
      case T.LADDER: return 196; case T.VINE: return 197; case T.BREAK: return 198; case T.METAL: return 199; case T.CRACK: return 200;
      case T.SANDW: return 201; case T.QSAND: return 203; case T.CONVL: return 204; case T.CONVR: return 208;
      case T.EFLOOR: return 212; case T.GLASS: return 213; case T.CHAIN: return 214;
      case T.BGWALL: return 256 + par * 16 + 15;
      case T.BGALT: return 256 + 64 + par * 16 + 15;
      default: return -1;
    }
  };
})();
