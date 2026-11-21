'use strict';
// ============================================================
//  Parallax backgrounds (procedural, per world & act variant)
// ============================================================
(function () {
  const BW = 512; // repeating layer width
  const Pix = () => null;
  function grad(cols, h) { const p = new AF.Pix(AF.W, h || AF.H); AF.ditherGrad(p, 0, 0, AF.W, h || AF.H, cols); return p.canvas(); }
  function noise1(seed) { const r = AF.seeded(seed); const v = []; for (let i = 0; i < 64; i++) v.push(r()); return x => { const i = Math.floor(x) & 63, f = x - Math.floor(x), a = v[i], b = v[(i + 1) & 63]; return a + (b - a) * (f * f * (3 - 2 * f)); }; }
  function ridge(p, base, amp, cols, seed, freq, snow, flat) {
    const n = noise1(seed);
    for (let x = 0; x < BW; x++) {
      const u = x / BW * 64 * (freq || .25);
      let h = n(u) * .6 + n(u * 2.3 + 7) * .3 + n(u * 5.1 + 3) * .1;
      // make periodic: blend end into start
      const t = x / BW; const u2 = (x - BW) / BW * 64 * (freq || .25);
      const h2 = n(u2 + 64) * .6 + n((u2 + 64) * 2.3 + 7) * .3 + n((u2 + 64) * 5.1 + 3) * .1;
      h = flat ? h : h;
      const top = Math.round(base - h * amp);
      for (let y = top; y < p.h; y++) {
        let c = cols[0];
        if (y === top) c = cols[2] || cols[0];
        else if (y < top + 3 && cols[1]) c = cols[1];
        if (snow && y < top + snow + Math.round(Math.sin(x * .7) * 1.5)) c = y === top ? '#ffffff' : '#d8e8ff';
        p.set(x, y, c);
      }
    }
  }
  // make layers seamless by drawing with wrap-around noise sampled on a circle
  function wrapRidge(p, base, amp, cols, seed, bumps, opts) {
    opts = opts || {};
    const r = AF.seeded(seed), K = [];
    for (let i = 0; i < 6; i++) K.push([Math.floor(r() * (bumps || 3) * (i + 1)) + 1, r() * 6.28, r() / (i + 1)]);
    for (let x = 0; x < BW; x++) {
      let h = 0; for (const k of K) h += Math.sin(x / BW * 6.2832 * k[0] + k[1]) * k[2];
      if (opts.peaky) h = Math.abs(h) * 1.4 - .3;
      const top = Math.round(base - h * amp);
      for (let y = Math.max(0, top); y < p.h; y++) {
        let c = cols[0];
        if (y < top + 1 && cols[2]) c = cols[2]; else if (y < top + 3 && cols[1]) c = cols[1];
        if (opts.snow && y < top + opts.snow + ((x * 7) % 5 === 0 ? 2 : 0)) c = y < top + 2 ? '#ffffff' : '#c8d8f8';
        if (opts.dither && y > top + 3 && ((x + y) & 1) && y < top + 8) c = cols[1] || c;
        p.set(x, y, c);
      }
    }
  }
  function trees(p, base, cols, seed, n, hmin, hmax, kind) {
    const r = AF.seeded(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * BW, h = hmin + r() * (hmax - hmin);
      const draw = (xx) => {
        if (kind === 'pine') {
          for (let k = 0; k < 4; k++) { const w = (4 - k) * h / 7, y0 = base - h + k * h / 5; p.poly([[xx, y0 - h / 6], [xx + w, y0 + h / 4], [xx - w, y0 + h / 4]], cols[k % 2 ? 0 : 1]); }
          p.rect(xx - 1, base - h / 4, 3, h / 4, cols[2] || cols[0]);
          if (cols[3]) for (let k = 0; k < 3; k++) { const w = (4 - k) * h / 7, y0 = base - h + k * h / 5 + h / 4; p.rect(xx - w + 1, y0 - 1, w * 1.4, 1, cols[3]); }
        } else if (kind === 'round') {
          p.rect(xx - 2, base - h * .5, 4, h * .5, cols[2] || cols[0]);
          p.ell(xx, base - h * .65, h * .32, h * .3, cols[0]);
          p.ell(xx - h * .1, base - h * .72, h * .22, h * .2, cols[1]);
        } else if (kind === 'palm') {
          for (let k = 0; k < h; k++) p.rect(xx + Math.sin(k / h * 1.5) * 4, base - k, 3, 1, cols[2]);
          const tx = xx + Math.sin(1.5) * 4 + 1, ty = base - h;
          for (let a = 0; a < 6; a++) { const ang = a / 6 * 3.14 + .2; for (let k = 0; k < 12; k++) p.rect(tx + Math.cos(ang) * k * (a < 3 ? -1 : 1) * .9, ty + Math.sin(ang * .5) * k * .4 + k * k * .03, 2, 2, cols[a & 1]); }
        } else if (kind === 'cactus') {
          p.rect(xx - 2, base - h, 5, h, cols[0]); p.rect(xx - 1, base - h, 1, h, cols[1]);
          p.rect(xx - 7, base - h * .6, 5, 3, cols[0]); p.rect(xx - 7, base - h * .85, 3, h * .25, cols[0]);
          p.rect(xx + 3, base - h * .45, 5, 3, cols[0]); p.rect(xx + 6, base - h * .7, 3, h * .25, cols[0]);
        }
      };
      draw(x); if (x < 40) draw(x + BW); if (x > BW - 40) draw(x - BW);
    }
  }
  function layer(w, h) { return new AF.Pix(w || BW, h || AF.H); }
  function clouds(p, y0, n, seed, cols, big) {
    const r = AF.seeded(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * BW, y = y0 + r() * 30, s = (big ? 14 : 7) + r() * (big ? 14 : 8);
      const blob = (xx) => {
        for (let k = 0; k < 5; k++) { const bx = xx + (k - 2) * s * .55, by = y - Math.sin(k / 4 * 3.14) * s * .45; p.ell(bx, by, s * .6, s * .45, cols[1]); }
        p.rect(xx - s * 1.4, y, s * 2.8, s * .3, cols[1]);
        for (let k = 0; k < 5; k++) { const bx = xx + (k - 2) * s * .55, by = y - Math.sin(k / 4 * 3.14) * s * .45; p.ell(bx - 1, by - 2, s * .45, s * .3, cols[0]); }
        if (cols[2]) p.rect(xx - s * 1.3, y + s * .3 - 1, s * 2.6, 1, cols[2]);
      };
      blob(x); if (x < 60) blob(x + BW); if (x > BW - 60) blob(x - BW);
    }
  }
  function buildings(p, base, cols, seed, n, hmin, hmax, lights, chimney) {
    const r = AF.seeded(seed);
    let x = 0;
    while (x < BW) {
      const w = 14 + Math.floor(r() * 26), h = hmin + r() * (hmax - hmin);
      const top = Math.round(base - h);
      p.rect(x, top, w, base - top + 200, cols[0]);
      p.rect(x, top, w, 1, cols[1]);
      if (lights) for (let wy = top + 4; wy < base - 2; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < .45) p.rect(wx, wy, 2, 2, r() < .8 ? lights[0] : lights[1]);
      if (chimney && r() < .5) { p.rect(x + w / 2, top - 16, 4, 16, cols[0]); p.rect(x + w / 2 - 1, top - 17, 6, 2, cols[1]); }
      if (r() < .3) { p.rect(x + 3, top - 4, 1, 4, cols[0]); p.set(x + 3, top - 5, '#ff4040'); }
      x += w + Math.floor(r() * 4);
    }
  }
  function rays(p, cols, seed) {
    const r = AF.seeded(seed);
    for (let i = 0; i < 6; i++) {
      const x0 = r() * BW, w = 10 + r() * 20, sl = .45;
      for (let y = 0; y < p.h; y++) for (let x = Math.round(x0 + y * sl); x < x0 + y * sl + w; x++) if (((x + y) & 1) === 0 && (y & 1)) p.set(((x % BW) + BW) % BW, y, cols[0]);
    }
  }

  function build(world, act) {
    const L = []; let sky, actors = null, fg = null, tint = null;
    const r = AF.seeded(world * 100 + act);
    switch (world) {
      case 1: {
        if (act === 3) sky = grad(['#f8a060', '#f8c880', '#f8e0a0', '#c8e0a0']);
        else if (act === 2) sky = grad(['#3890f0', '#60b8f8', '#a0e0ff', '#d0f8ff']);
        else sky = grad(['#4aa0f8', '#78c8f8', '#b0e8ff', '#e0fff0']);
        let p = layer(BW, 160); clouds(p, 20, 6, 11, ['#ffffff', '#d8ecff', '#b8d0f0'], false); L.push({ img: p.canvas(), f: .05, auto: .06, y: 0 });
        p = layer(BW, 160); wrapRidge(p, 100, 22, act === 3 ? ['#a88a90', '#c8a8a8'] : ['#78b8c8', '#98d0d8'], 3, 3); L.push({ img: p.canvas(), f: .1, y: 0 });
        p = layer(BW, 160); wrapRidge(p, 118, 10, act === 3 ? ['#5a7050', '#708a60'] : ['#3a9070', '#58b088'], 5, 6); trees(p, 125, ['#2a7858', '#3a9068', '#2a5a40'], 7, 26, 26, 46, 'round'); L.push({ img: p.canvas(), f: .22, y: 6 });
        if (act !== 2) {
          p = layer(BW, 200);
          // giant trunks with canopy
          for (let i = 0; i < 5; i++) {
            const x = 40 + i * 104 + r() * 30, w = 18 + r() * 10;
            p.rect(x, 20, w, 200, '#5a3820'); p.rect(x + 3, 20, 4, 200, '#7a5030'); p.rect(x + w - 4, 20, 3, 200, '#3a2210');
            for (let k = 0; k < 8; k++) p.rect(x + 8 + (k % 3) * 3, 30 + k * 20, 2, 6, '#3a2210');
            p.ell(x + w / 2, 18, 46, 26, '#1e6a38'); p.ell(x + w / 2 - 8, 10, 34, 16, '#2e8a48'); p.ell(x + w / 2 - 14, 6, 18, 8, '#48a858');
          }
          L.push({ img: p.canvas(), f: .4, y: -10, vy: .2 });
          p = layer(BW, 160); rays(p, ['#fff8c0'], 17); L.push({ img: p.canvas(), f: .45, y: 0, alpha: .25 });
        } else {
          p = layer(BW, 200); clouds(p, 120, 9, 31, ['#ffffff', '#e8f4ff', '#c0d8f0'], true); for (let x = 0; x < BW; x++) for (let y = 140; y < 200; y++) p.set(x, y, '#e8f4ff');
          trees(p, 150, ['#2e8a48', '#48a858', '#5a3820'], 33, 8, 40, 60, 'round');
          L.push({ img: p.canvas(), f: .3, y: 10, vy: .15 });
        }
        break;
      }
      case 2: {
        if (act === 3) sky = grad(['#020818', '#041838', '#082a58', '#0a3a6a']);
        else sky = grad(['#06204a', '#0a3a78', '#1460a0', '#1e88c0']);
        let p = layer(BW, 160);
        // caustic light bands
        for (let y = 0; y < 60; y++) for (let x = 0; x < BW; x++) if (Math.sin(x * .05 + Math.sin(y * .2) * 2) > .92 && ((x + y) & 1)) p.set(x, y, '#3ab0e0');
        L.push({ img: p.canvas(), f: .05, y: 0, auto: .1 });
        p = layer(BW, 160); wrapRidge(p, 130, 18, ['#082848', '#0c3860'], 21, 4); trees(p, 132, ['#0a3050', '#0c3860', '#0a3050'], 23, 14, 20, 40, 'round'); L.push({ img: p.canvas(), f: .15, y: 0 });
        if (act !== 3) {
          // aquarium wall with big glass windows
          p = layer(BW, 200);
          p.rect(0, 0, BW, 200, act === 2 ? '#2a3848' : '#1a4058');
          for (let i = 0; i < 4; i++) {
            const x = i * 128 + 14, w = 100;
            p.rect(x, 26, w, 110, '#0a2a50'); AF.ditherGrad(p, x + 4, 30, w - 8, 102, ['#145a98', '#0c3a70', '#082850']);
            p.rect(x, 26, w, 4, act === 2 ? '#6a7888' : '#c0d8e8'); p.rect(x, 132, w, 4, '#3a5a78'); p.rect(x, 26, 4, 110, '#5a8aa8'); p.rect(x + w - 4, 26, 4, 110, '#2a4a68');
            p.rect(x + w / 2 - 1, 30, 2, 102, '#2a4a68');
            for (let k = 0; k < 8; k++) p.set(x + 8 + k * 2, 34 + k * 2, '#80c8f0');
            // coral & seaweed inside
            for (let k = 0; k < 4; k++) { const cx = x + 12 + k * 24; p.ell(cx, 128, 6, 5, ['#e05888', '#f08848', '#a050d0', '#50c8a0'][(i + k) % 4]); p.rect(cx - 1, 112, 2, 16, '#2a8a5a'); }
          }
          if (act === 2) for (let x = 0; x < BW; x += 64) { p.rect(x + 8, 150, 48, 50, '#3a4858'); p.rect(x + 8, 150, 48, 3, '#6a7888'); p.ell(x + 32, 150, 20, 8, '#4a5868'); }
          L.push({ img: p.canvas(), f: .35, y: -10, vy: .2 });
          actors = 'fish';
        } else actors = 'deepfish';
        break;
      }
      case 3: {
        if (act === 2) {
          sky = grad(['#04061a', '#0a1038', '#141a58', '#1a2068']);
          let p = layer(BW, 200);
          for (let i = 0; i < 14; i++) { const x = r() * BW, h = 20 + r() * 60; p.poly([[x - 8, 0], [x + 8, 0], [x, h]], '#1a2860'); p.poly([[x - 3, 0], [x + 2, 0], [x, h * .7]], '#2a4088'); }
          wrapRidge(p, 170, 25, ['#121a48', '#1a2a68'], 41, 5, { peaky: true });
          for (let i = 0; i < 18; i++) { const x = r() * BW, y = 120 + r() * 60, s = 3 + r() * 6; p.poly([[x, y - s * 2], [x + s, y], [x, y + s], [x - s, y]], i & 1 ? '#40c0f0' : '#a070f0'); p.set(x, y - s, '#ffffff'); }
          L.push({ img: p.canvas(), f: .25, y: -20, vy: .2 });
          actors = 'crystalglow';
        } else {
          sky = act === 3 ? grad(['#5a6a98', '#8898c0', '#b8c8e0', '#d8e0f0']) : grad(['#1a2a98', '#2a48c8', '#4a78e8', '#8ab0f8']);
          let p = layer(BW, 160);
          if (act === 1) for (let i = 0; i < 40; i++) p.set(r() * BW, r() * 60, '#ffffff');
          L.push({ img: p.canvas(), f: .02, y: 0 });
          p = layer(BW, 160); wrapRidge(p, 92, 40, ['#6878c8', '#8898e0'], 43, 3, { peaky: true, snow: 10 }); L.push({ img: p.canvas(), f: .08, y: 0 });
          p = layer(BW, 160); wrapRidge(p, 118, 18, ['#4858a8', '#5868b8'], 45, 5, { snow: 5 }); trees(p, 126, ['#1a3a60', '#2a4a78', '#102030', '#e0f0ff'], 47, 22, 24, 40, 'pine'); L.push({ img: p.canvas(), f: .18, y: 4 });
          p = layer(BW, 200); wrapRidge(p, 150, 10, ['#e8f0ff', '#ffffff', '#ffffff'], 49, 6); trees(p, 155, ['#1a4a50', '#2a6a68', '#0a2020', '#f0f8ff'], 51, 10, 40, 64, 'pine'); L.push({ img: p.canvas(), f: .35, y: 0, vy: .2 });
        }
        break;
      }
      case 4: {
        if (act === 1) sky = grad(['#3a0a18', '#8a1a20', '#d84020', '#f89040']);
        else sky = grad(['#100408', '#2a0a10', '#4a1414', '#6a2018']);
        let p = layer(BW, 160);
        if (act === 1) {
          for (let i = 0; i < 10; i++) { const x = r() * BW, y = 20 + r() * 50; p.ell(x, y, 30 + r() * 20, 6 + r() * 4, '#5a2028'); p.ell(x + 6, y - 3, 20, 4, '#7a3030'); }
          L.push({ img: p.canvas(), f: .05, auto: .05, y: 0 });
          p = layer(BW, 160); wrapRidge(p, 120, 50, ['#3a1418', '#5a2020'], 61, 2, { peaky: true });
          for (let x = 0; x < BW; x += 128) { p.ell(x + 64, 68, 10, 4, '#ff6a18'); for (let y = 70; y < 160; y++) { const w = 2 + (y - 70) * .08; p.rect(x + 64 + Math.sin(y * .1) * 3 - w / 2, y, w, 1, y % 3 ? '#ff6a18' : '#ffc040'); } }
          L.push({ img: p.canvas(), f: .1, y: 0 });
        } else {
          for (let i = 0; i < 8; i++) { const x = r() * BW; for (let y = 0; y < 160; y++) p.rect(x + Math.sin(y * .05) * 2, y, 4, 1, y % 4 ? '#c83010' : '#ff8020'); }
          L.push({ img: p.canvas(), f: .1, y: 0 });
        }
        p = layer(BW, 200); wrapRidge(p, 150, 25, ['#1e0a0e', '#2e1014'], 63, 5, { peaky: true });
        for (let i = 0; i < 6; i++) { const x = r() * BW; p.rect(x, 110, 2, 90, '#4a2a18'); p.rect(x + 12, 110, 2, 90, '#4a2a18'); for (let y = 112; y < 200; y += 12) p.line(x, y, x + 13, y + 10, '#4a2a18'); }
        L.push({ img: p.canvas(), f: .3, y: -10, vy: .2 });
        actors = 'embers';
        break;
      }
      case 5: {
        if (act === 2) {
          sky = grad(['#1a1420', '#2a2030', '#3a2a38', '#4a3440']);
          actors = 'gears';
          let p = layer(BW, 200);
          for (let x = 0; x < BW; x += 32) { p.rect(x, 0, 6, 200, '#2a2230'); p.rect(x + 1, 0, 1, 200, '#4a3a48'); }
          for (let y = 0; y < 200; y += 40) p.rect(0, y, BW, 3, '#3a3040');
          L.push({ img: p.canvas(), f: .15, y: 0, vy: .1 });
        } else {
          sky = act === 3 ? grad(['#0a0820', '#2a1440', '#5a2050', '#a04050']) : grad(['#3a1850', '#8a3060', '#e06850', '#f8b060']);
          let p = layer(BW, 160); clouds(p, 30, 5, 71, ['#c86070', '#a04060'], false); L.push({ img: p.canvas(), f: .04, auto: .05, y: 0 });
          p = layer(BW, 160); buildings(p, 130, ['#4a2050', '#6a3068'], 73, 0, 30, 80, ['#f8d060', '#f88040'], true); L.push({ img: p.canvas(), f: .12, y: 0 });
          p = layer(BW, 200); buildings(p, 160, ['#201028', '#3a2040'], 75, 0, 40, 100, ['#ffe080', '#80f0ff'], true); L.push({ img: p.canvas(), f: .28, y: -10, vy: .15 });
          actors = 'smoke';
        }
        break;
      }
      case 6: {
        if (act === 2) {
          sky = grad(['#2a1408', '#4a2810', '#6a3c18', '#7a4820']);
          let p = layer(BW, 200);
          for (let x = 0; x < BW; x += 64) {
            p.rect(x + 20, 0, 24, 200, '#8a5a2c'); p.rect(x + 22, 0, 4, 200, '#b07a40'); p.rect(x + 40, 0, 4, 200, '#5a3418');
            for (let y = 20; y < 200; y += 30) { p.rect(x + 26, y, 12, 12, '#6a4020'); p.ell(x + 32, y + 6, 3, 3, '#d8a050'); p.rect(x + 31, y + 2, 2, 8, '#5a3418'); }
          }
          for (let y = 0; y < 200; y += 24) for (let x = 0; x < BW; x++) if ((x >> 3) % 2) p.set(x, y, '#3a2010');
          L.push({ img: p.canvas(), f: .3, y: 0, vy: .2 });
          actors = 'torches';
        } else {
          sky = act === 3 ? grad(['#5a2060', '#c04050', '#f88040', '#f8c060']) : grad(['#58a8f0', '#a8d8f8', '#f8e8b0', '#f8d080']);
          let p = layer(BW, 160);
          p.ell(380, 40, 16, 16, act === 3 ? '#ff6030' : '#fff8d0'); p.ell(380, 40, 13, 13, act === 3 ? '#ffa040' : '#ffffff');
          L.push({ img: p.canvas(), f: .02, y: 0 });
          p = layer(BW, 160); wrapRidge(p, 118, 16, ['#d89850', '#e8b068'], 81, 3);
          for (let i = 0; i < 3; i++) { const x = 60 + i * 170; p.poly([[x, 120], [x + 28, 82], [x + 56, 120]], '#c88848'); p.poly([[x + 28, 82], [x + 56, 120], [x + 38, 120]], '#a06830'); }
          L.push({ img: p.canvas(), f: .1, y: 0 });
          p = layer(BW, 200); wrapRidge(p, 150, 14, ['#e8b060', '#f8d080', '#fff0b0'], 83, 5); trees(p, 152, ['#3a8a3a', '#2a6a2a', '#7a5028'], 85, 5, 30, 46, 'palm'); trees(p, 160, ['#3a8a40', '#58b058'], 87, 6, 16, 24, 'cactus');
          L.push({ img: p.canvas(), f: .3, y: -10, vy: .15 });
          actors = 'heat';
        }
        break;
      }
      case 7: {
        if (act === 2) { sky = grad(['#100c20', '#241c3a', '#3a2c50', '#4a3a60']); actors = 'storm'; }
        else if (act === 3) { sky = grad(['#203070', '#5060a8', '#a080b0', '#f0b080']); actors = 'storm2'; }
        else { sky = grad(['#2870e0', '#4898f8', '#88c8ff', '#c8e8ff']); }
        let p = layer(BW, 160);
        clouds(p, 30, 7, 91, act === 2 ? ['#5a4a70', '#3a3050', '#2a2040'] : ['#ffffff', '#e0f0ff', '#b8d0f0'], true);
        L.push({ img: p.canvas(), f: .05, auto: .15, y: 0 });
        p = layer(BW, 160);
        for (let i = 0; i < 4; i++) { const x = 30 + i * 128 + r() * 40, y = 60 + r() * 40, w = 20 + r() * 20; p.ell(x, y, w, 6, act === 2 ? '#3a3050' : '#8a9ac0'); p.poly([[x - w, y], [x + w, y], [x, y + w]], act === 2 ? '#2a2040' : '#6a7aa0'); trees(p, y - 4, ['#4a8a6a', '#6aa888', '#4a6a5a'], 93 + i, 2, 12, 20, 'round'); }
        L.push({ img: p.canvas(), f: .15, y: 0 });
        p = layer(BW, 200); clouds(p, 150, 12, 95, act === 2 ? ['#4a3a60', '#30284a', '#20183a'] : ['#ffffff', '#f0f8ff', '#d0e4f8'], true);
        for (let x = 0; x < BW; x++) for (let y = 165; y < 200; y++) p.set(x, y, act === 2 ? '#30284a' : '#f0f8ff');
        L.push({ img: p.canvas(), f: .3, auto: .1, y: -10, vy: .2 });
        break;
      }
      case 8: {
        sky = act >= 3 ? grad(['#100418', '#240830', '#3a0c40', '#200820']) : grad(['#060a14', '#0c1424', '#121e34', '#182840']);
        let p = layer(BW, 200);
        for (let x = 0; x < BW; x += 64) {
          p.rect(x, 0, 64, 200, '#101828'); p.rect(x + 2, 0, 60, 200, '#182238');
          p.rect(x + 8, 40, 48, 30, '#0a0e18'); p.rect(x + 10, 42, 44, 26, act >= 3 ? '#401030' : '#0a3038');
          for (let k = 0; k < 6; k++) p.rect(x + 12, 45 + k * 4, 10 + ((k * 13 + x) % 28), 1, act >= 3 ? '#ff4080' : '#30f0c0');
          p.rect(x, 100, 64, 2, '#2a3858'); p.rect(x + 30, 0, 2, 200, '#0a0e18');
        }
        L.push({ img: p.canvas(), f: .15, y: 0, vy: .1 });
        p = layer(BW, 200);
        for (let i = 0; i < 4; i++) {
          const x = 30 + i * 128;
          p.rect(x, 70, 28, 90, '#2a3a4a'); p.rect(x + 3, 76, 22, 78, act >= 3 ? '#5a1040' : '#1a6a40'); p.rect(x + 3, 76, 22, 6, act >= 3 ? '#a02060' : '#30c070');
          p.rect(x - 2, 66, 32, 6, '#4a5a6a'); p.rect(x - 2, 154, 32, 8, '#4a5a6a');
          p.ell(x + 14, 112, 7, 9, act >= 3 ? '#200818' : '#0a3020'); p.ell(x + 12, 108, 2, 2, '#ffffff');
          p.rect(x + 8, 80, 1, 70, '#80f0b0');
        }
        L.push({ img: p.canvas(), f: .3, y: -10, vy: .2 });
        actors = 'lab';
        break;
      }
    }
    return { sky, layers: L, actors };
  }
  const cache = {};
  AF.getBG = function (world, act) { const k = world + '-' + act; if (!cache[k]) cache[k] = build(world, act); return cache[k]; };

  // small background actor sprites
  let fishSpr = null;
  function getFish() {
    if (fishSpr) return fishSpr;
    fishSpr = [];
    const cols = [['#f08030', '#ffd060'], ['#40c0f0', '#c0f0ff'], ['#f0e040', '#ffffff'], ['#c060e0', '#f0b0ff']];
    for (const c of cols) {
      const p = new AF.Pix(14, 9);
      p.ell(6, 4.5, 5, 3.2, c[0]); p.poly([[10, 4], [14, 1], [14, 8]], c[0]); p.rect(3, 3, 5, 1, c[1]); p.set(3, 3, '#101018');
      p.outline('#0a1a30'); fishSpr.push(p.canvas());
    }
    const s = new AF.Pix(40, 14); // silhouette big fish (deep)
    s.ell(18, 7, 16, 5, '#0a2848'); s.poly([[32, 7], [40, 1], [40, 13]], '#0a2848'); s.poly([[14, 3], [20, 0], [22, 4]], '#0a2848');
    fishSpr.push(s.canvas());
    return fishSpr;
  }

  // draw entire background
  AF.drawBG = function (ctx, bg, camX, camY, t, lvH) {
    ctx.drawImage(bg.sky, 0, 0);
    const ny = lvH ? AF.clamp(camY / Math.max(1, lvH - AF.H), 0, 1) : 0;
    for (const l of bg.layers) {
      let x = -((camX * l.f + (l.auto ? t * l.auto : 0)) % BW); if (x > 0) x -= BW;
      const y = Math.round((l.y || 0) - (l.vy ? ny * (l.img.height - AF.H + (l.y || 0)) * l.vy * 3 : 0));
      if (l.alpha) ctx.globalAlpha = l.alpha;
      for (let xx = Math.floor(x); xx < AF.W; xx += BW) ctx.drawImage(l.img, xx, y);
      ctx.globalAlpha = 1;
    }
    if (bg.actors) drawActors(ctx, bg.actors, camX, camY, t);
  };
  function drawActors(ctx, kind, camX, camY, t) {
    if (kind === 'fish' || kind === 'deepfish') {
      const fs = getFish();
      for (let i = 0; i < (kind === 'fish' ? 7 : 3); i++) {
        const sp = .3 + (i % 3) * .15, dir = i & 1 ? 1 : -1;
        const span = 700;
        let x = ((i * 137 + t * sp * dir) % span + span) % span - 60 - camX * .35 % 1;
        x = ((x - camX * .35) % span + span) % span - 60;
        const y = 40 + (i * 23) % 80 + Math.sin(t * .03 + i) * 4;
        const img = kind === 'fish' ? fs[i % 4] : fs[4];
        if (dir > 0) AF.drawSpr(ctx, { c: img, w: img.width, h: img.height, ax: 0, ay: 0 }, x, y, -1);
        else ctx.drawImage(img, Math.round(x), Math.round(y));
      }
    } else if (kind === 'embers') {
      for (let i = 0; i < 26; i++) {
        const x = ((i * 53 - camX * .5 + Math.sin(t * .02 + i) * 10) % 260 + 260) % 260 - 10;
        const y = 170 - ((t * (.4 + (i % 5) * .15) + i * 37) % 190);
        ctx.fillStyle = i % 3 ? '#ff8020' : '#ffd040'; ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 2), 1 + (i % 2));
      }
    } else if (kind === 'crystalglow') {
      for (let i = 0; i < 16; i++) {
        const x = ((i * 71 - camX * .25) % 300 + 300) % 300 - 30, y = ((i * 47 - camY * .2) % 180 + 180) % 180 - 10;
        const a = .3 + Math.sin(t * .05 + i) * .3; if (a <= 0) continue;
        ctx.globalAlpha = a; ctx.fillStyle = i & 1 ? '#80e0ff' : '#c0a0ff'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'gears') {
      drawGearBG(ctx, 60 - (camX * .2) % 300, 60 - (camY * .2) % 260, 40, t * .01, '#3a2e40');
      drawGearBG(ctx, 180 - (camX * .2) % 300, 140 - (camY * .2) % 260, 30, -t * .013, '#3a2e40');
      drawGearBG(ctx, 260 - (camX * .25) % 340, 30 - (camY * .25) % 260, 50, t * .008, '#2e2434');
      drawGearBG(ctx, 120 - (camX * .25) % 340, 220 - (camY * .25) % 260, 36, -t * .01, '#2e2434');
    } else if (kind === 'smoke') {
      for (let i = 0; i < 8; i++) {
        const bx = ((i * 97 - camX * .28) % 400 + 400) % 400 - 60, ph = (t * .3 + i * 20) % 80;
        ctx.globalAlpha = .35 * (1 - ph / 80); ctx.fillStyle = '#c8a0b0';
        ctx.beginPath(); ctx.arc(Math.round(bx + ph * .4), Math.round(60 - ph), 4 + ph * .12, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'torches') {
      for (let i = 0; i < 4; i++) {
        const x = ((i * 64 + 32 - camX * .3) % 256 + 256) % 256 - 8;
        const f = (t >> 2) % 3;
        ctx.fillStyle = '#ff8020'; ctx.fillRect(Math.round(x) - 1, 52 - f, 3, 4 + f); ctx.fillStyle = '#ffe060'; ctx.fillRect(Math.round(x), 54 - f, 1, 2 + f);
        ctx.globalAlpha = .12; ctx.fillStyle = '#ffa040'; ctx.beginPath(); ctx.arc(Math.round(x), 54, 14 + f, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      }
    } else if (kind === 'heat') {
      // nothing heavy; subtle shimmer handled by particles
    } else if (kind === 'storm' || kind === 'storm2') {
      if (kind === 'storm' && (t % 300) < 6 && ((t % 300) & 2)) { ctx.globalAlpha = .35; ctx.fillStyle = '#e0e0ff'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      ctx.fillStyle = kind === 'storm' ? '#8080c0' : '#c0d0ff';
      for (let i = 0; i < 40; i++) { const x = ((i * 37 + t * 3) % 260) - 10, y = ((i * 53 + t * 7) % 180) - 10; ctx.fillRect(x, y, 1, 4); }
    } else if (kind === 'lab') {
      for (let i = 0; i < 10; i++) {
        const x = ((i * 61 - camX * .3) % 300 + 300) % 300 - 20, y = 150 - ((t * .5 + i * 30) % 80);
        ctx.fillStyle = '#80ffc0'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
  }
  function drawGearBG(ctx, x, y, r, a, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const ang = a + i / (teeth * 2) * Math.PI * 2, rr = i & 1 ? r : r + 6;
      const ang2 = a + (i + 1) / (teeth * 2) * Math.PI * 2;
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr); ctx.lineTo(x + Math.cos(ang2) * rr, y + Math.sin(ang2) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1420'; ctx.beginPath(); ctx.arc(x, y, r * .35, 0, 7); ctx.fill();
  }
  AF.BGW = BW;
})();
