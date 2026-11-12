// Original example stages, drawn procedurally at half resolution and shown at 2x for chunky pixels.
import { makeCanvas } from '../engine/assets';
import { newLayer, newStage } from '../engine/defaults';
import type { StageDef, StageLayer } from '../engine/types';
import { Rng, shade } from '../engine/util';

type G = CanvasRenderingContext2D;
const R = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

function layer(name: string, c: HTMLCanvasElement, o: Partial<StageLayer>): StageLayer {
  return { ...newLayer(name), image: c.toDataURL('image/png'), scale: 2, ...o };
}

function mountains(w: number, h: number, base: string, seed: number, peaks = 6, snow?: string) {
  const [c, g] = makeCanvas(w, h);
  const rng = new Rng(seed);
  const pts: number[] = [];
  for (let x = 0; x <= w; x++) pts.push(0);
  for (let i = 0; i < peaks; i++) {
    const cx = rng.range(0, w), ph = rng.range(h * 0.35, h * 0.95), wd = rng.range(w * 0.08, w * 0.22);
    for (let x = 0; x <= w; x++) {
      // wrap so the layer tiles seamlessly
      let d = Math.abs(x - cx); d = Math.min(d, w - d);
      pts[x] = Math.max(pts[x], ph - d * (ph / wd) * 0.9);
    }
  }
  for (let x = 0; x < w; x++) {
    const top = h - pts[x];
    R(g, x, top, 1, h - top, base);
    R(g, x, top, 1, 2, shade(base, 0.25));
    if (snow && pts[x] > h * 0.62) R(g, x, top, 1, Math.min(6, (pts[x] - h * 0.62) * 0.4 + 2), snow);
  }
  return c;
}

// ---------------------------------------------------------------------------
function dojo(): StageDef {
  const s = newStage('Sunset Dojo'); s.id = 'builtin_dojo';
  s.width = 1100; s.floorY = 316; s.skyTop = '#ff9a5a'; s.skyBottom = '#7a3a6a'; s.floorColor = '#6a3a1e';
  s.weather = 'sakura'; s.weatherDensity = 0.6; s.ambient = 'dust'; s.reflection = true; s.musicTheme = 1;
  const far = mountains(400, 70, '#6a3a6a', 3, 7);
  const [sun, sg] = makeCanvas(60, 60);
  for (let y = -26; y <= 26; y++) for (let x = -26; x <= 26; x++) if (x * x + y * y < 26 * 26) R(sg, 30 + x, 30 + y, 1, 1, y > 6 && (y % 4 === 0) ? '#ff9a5a' : '#ffe0a0');
  // dojo wall
  const W = 550, H = 170;
  const [wall, wg] = makeCanvas(W, H);
  R(wg, 0, 20, W, H - 20, '#8a5a32');
  for (let x = 0; x < W; x += 3) R(wg, x, 20, 1, H - 20, (x / 3) % 3 === 0 ? '#7a4e2a' : '#946238');
  R(wg, 0, 14, W, 8, '#3a2214'); R(wg, 0, 22, W, 3, '#2a180e');
  for (let i = 0; i < 4; i++) { // windows looking out onto hills
    const wx = 40 + i * 135;
    R(wg, wx - 3, 50, 86, 64, '#3a2214');
    const grd = wg.createLinearGradient(0, 52, 0, 112); grd.addColorStop(0, '#ffb070'); grd.addColorStop(1, '#c86a70'); wg.fillStyle = grd; wg.fillRect(wx, 53, 80, 58);
    for (let x = 0; x < 80; x++) R(wg, wx + x, 92 + Math.sin(x * 0.12 + i) * 5, 1, 19 - Math.sin(x * 0.12 + i) * 5, '#6a8a5a');
    for (let x = 0; x < 80; x += 20) R(wg, wx + x, 53, 2, 58, '#3a2214');
    R(wg, wx, 80, 80, 2, '#3a2214');
  }
  for (let x = 0; x < W; x += 135) { R(wg, x + 120, 25, 16, H - 25, '#4a2c18'); R(wg, x + 122, 25, 4, H - 25, '#6a4228'); }
  // banners
  [80, 300].forEach((bx, i) => { R(wg, bx, 26, 22, 40, i ? '#c02a2a' : '#2a4ac0'); R(wg, bx + 6, 34, 10, 10, '#f0e0c0'); R(wg, bx, 66, 22, 3, '#d8b040'); });
  // floor planks
  const [floor, fg] = makeCanvas(W, 30);
  for (let y = 0; y < 30; y++) R(fg, 0, y, W, 1, shade('#9a6034', -y / 60));
  for (let y = 0; y < 30; y += 5) R(fg, 0, y, W, 1, '#5a3418');
  const rng = new Rng(7);
  for (let y = 0; y < 30; y += 5) for (let x = rng.int(40); x < W; x += 40 + rng.int(40)) R(fg, x, y, 1, 5, '#5a3418');
  R(fg, 0, 0, W, 1, '#c88a50');
  s.layers = [
    layer('Sun', sun, { parallax: 0.02, x: 380, y: 36, repeatX: false }),
    layer('Far hills', far, { parallax: 0.15, y: 100 }),
    layer('Dojo wall', wall, { parallax: 1, y: 316 - H * 2 }),
    layer('Floor', floor, { parallax: 1, y: 316 }),
  ];
  return s;
}

// ---------------------------------------------------------------------------
function rooftop(): StageDef {
  const s = newStage('Neon Rooftop'); s.id = 'builtin_rooftop';
  s.width = 1200; s.floorY = 318; s.skyTop = '#05051a'; s.skyBottom = '#3a1a5a'; s.floorColor = '#1a1a26';
  s.weather = 'rain'; s.weatherDensity = 1; s.ambient = 'none'; s.reflection = true; s.musicTheme = 2;
  const rng = new Rng(11);
  const city = (w: number, h: number, base: string, lit: string, seed: number, tall: number) => {
    const [c, g] = makeCanvas(w, h); const r = new Rng(seed);
    let x = 0;
    while (x < w) {
      const bw = 14 + r.int(26), bh = h * (0.3 + r.next() * tall);
      R(g, x, h - bh, bw, bh, base); R(g, x, h - bh, 1, bh, shade(base, 0.15));
      for (let wy = h - bh + 4; wy < h - 3; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (r.chance(0.35)) R(g, wx, wy, 1, 2, r.chance(0.2) ? '#ff5ec4' : lit);
      if (r.chance(0.3)) R(g, x + bw / 2, h - bh - 6, 1, 6, base);
      x += bw + r.int(4);
    }
    return c;
  };
  const far = city(400, 110, '#1a1240', '#5a6ac0', 1, 0.6);
  const mid = city(500, 130, '#120c24', '#ffd25a', 2, 0.7);
  // animated neon sign (2 frames side by side)
  const [sign, sgc] = makeCanvas(160, 40);
  for (let f = 0; f < 2; f++) {
    const ox = f * 80;
    R(sgc, ox + 4, 4, 72, 30, '#120c24'); R(sgc, ox + 4, 4, 72, 2, f ? '#ff5ec4' : '#5a2a4a');
    const col = f ? '#ff5ec4' : '#7a2a5a', col2 = f ? '#5ef0ff' : '#2a5a6a';
    // "PIXEL" lettering as blocks
    const word = [[1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1], [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1], [1, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1], [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1]];
    word.forEach((row, y) => row.forEach((v, x) => v && R(sgc, ox + 10 + x * 4, 9 + y * 4, 3, 3, x > 9 ? col2 : col)));
  }
  const W = 600;
  const [roof, rg] = makeCanvas(W, 80);
  R(rg, 0, 50, W, 30, '#2a2a3a');
  for (let x = 0; x < W; x += 60) { R(rg, x + 10, 30, 30, 20, '#3a3a4e'); R(rg, x + 12, 32, 26, 2, '#5a5a70'); for (let i = 0; i < 4; i++) R(rg, x + 14 + i * 6, 38, 3, 10, '#22222e'); }
  for (let x = 0; x < W; x += 6) R(rg, x, 46, 2, 6, '#5a5a70');
  R(rg, 0, 44, W, 2, '#6a6a80');
  rng.next();
  const [floor, fg] = makeCanvas(W, 30);
  for (let y = 0; y < 30; y++) R(fg, 0, y, W, 1, shade('#2a2a3a', -y / 50));
  for (let x = 0; x < W; x += 24) R(fg, x, 0, 1, 30, '#1a1a26');
  R(fg, 0, 0, W, 1, '#5ef0ff');
  s.layers = [
    layer('Far city', far, { parallax: 0.1, y: 98 }),
    layer('Mid city', mid, { parallax: 0.3, y: 60 }),
    layer('Neon sign', sign, { parallax: 0.3, x: 300, y: 70, repeatX: false, frames: 2, fps: 2 }),
    layer('Rooftop rail', roof, { parallax: 1, y: 318 - 160 }),
    layer('Floor', floor, { parallax: 1, y: 318 }),
  ];
  return s;
}

// ---------------------------------------------------------------------------
function volcano(): StageDef {
  const s = newStage('Volcano Core'); s.id = 'builtin_volcano';
  s.width = 1000; s.floorY = 314; s.skyTop = '#1a0400'; s.skyBottom = '#8a1a00'; s.floorColor = '#2a0e08';
  s.weather = 'embers'; s.weatherDensity = 1.2; s.ambient = 'sparkles'; s.musicTheme = 3;
  const far = mountains(400, 120, '#3a0e06', 21, 5);
  // animated lava falls: 4 frames
  const FWd = 60, FHd = 140;
  const [lava, lg] = makeCanvas(FWd * 4, FHd);
  for (let f = 0; f < 4; f++) {
    const ox = f * FWd;
    R(lg, ox + 6, 0, 48, FHd, '#2a0a04');
    for (let y = 0; y < FHd; y++) {
      const wob = Math.sin((y + f * 6) * 0.25) * 2;
      R(lg, ox + 20 + wob, y, 20, 1, ((y + f * 5) % 10) < 5 ? '#ff7a10' : '#ffb030');
      R(lg, ox + 26 + wob, y, 6, 1, '#ffe080');
    }
  }
  const W = 500;
  const [rocks, rkg] = makeCanvas(W, 90);
  const r = new Rng(5);
  for (let i = 0; i < 40; i++) { const x = r.range(0, W), w = r.range(10, 50), h = r.range(10, 60); R(rkg, x, 90 - h, w, h, i % 2 ? '#3a1408' : '#4a1a0a'); R(rkg, x, 90 - h, w, 2, '#6a2a12'); }
  const [floor, fg] = makeCanvas(W, 30);
  for (let y = 0; y < 30; y++) R(fg, 0, y, W, 1, shade('#4a1a0a', -y / 40));
  for (let i = 0; i < 60; i++) { const x = r.range(0, W), y = r.range(4, 28); R(fg, x, y, r.range(4, 14), 1, '#ff5a10'); }
  R(fg, 0, 0, W, 2, '#ff8a30');
  s.layers = [
    layer('Far peaks', far, { parallax: 0.15, y: 80 }),
    layer('Lava fall A', lava, { parallax: 0.4, x: 120, y: 40, repeatX: false, frames: 4, fps: 8 }),
    layer('Lava fall B', lava, { parallax: 0.4, x: 560, y: 60, repeatX: false, frames: 4, fps: 7 }),
    layer('Rocks', rocks, { parallax: 0.8, y: 314 - 180 }),
    layer('Floor', floor, { parallax: 1, y: 314 }),
  ];
  return s;
}

// ---------------------------------------------------------------------------
function shrine(): StageDef {
  const s = newStage('Frozen Shrine'); s.id = 'builtin_shrine';
  s.width = 1000; s.floorY = 316; s.skyTop = '#7ab0e0'; s.skyBottom = '#dff0ff'; s.floorColor = '#c8d8e8';
  s.weather = 'snow'; s.weatherDensity = 1; s.ambient = 'none'; s.musicTheme = 4;
  const far = mountains(400, 110, '#8aa0c8', 31, 6, '#ffffff');
  const mid = mountains(400, 80, '#5a7aa8', 32, 8, '#e8f4ff');
  const W = 500;
  const [gate, gg] = makeCanvas(W, 150);
  const torii = (x: number) => {
    R(gg, x, 30, 8, 120, '#c02a2a'); R(gg, x + 70, 30, 8, 120, '#c02a2a');
    R(gg, x - 14, 20, 106, 8, '#c02a2a'); R(gg, x - 18, 14, 114, 6, '#2a1a1a'); R(gg, x - 4, 44, 86, 6, '#c02a2a');
    R(gg, x - 18, 12, 114, 2, '#ffffff'); R(gg, x + 2, 30, 2, 120, '#e04a4a');
  };
  torii(150);
  for (let i = 0; i < 5; i++) { const x = 20 + i * 100; if (x > 120 && x < 260) continue; R(gg, x + 6, 120, 6, 30, '#6a6a7a'); R(gg, x, 110, 18, 10, '#8a8a9a'); R(gg, x + 4, 112, 10, 6, '#ffe080'); R(gg, x - 2, 108, 22, 3, '#ffffff'); }
  const [floor, fg] = makeCanvas(W, 30);
  for (let y = 0; y < 30; y++) R(fg, 0, y, W, 1, shade('#e8f0ff', -y / 50));
  const r = new Rng(9);
  for (let i = 0; i < 80; i++) R(fg, r.range(0, W), r.range(2, 30), r.range(2, 8), 1, '#b0c8e0');
  s.layers = [
    layer('Snow peaks', far, { parallax: 0.1, y: 90 }),
    layer('Near ridge', mid, { parallax: 0.3, y: 160 }),
    layer('Shrine', gate, { parallax: 1, y: 316 - 300 }),
    layer('Snowy ground', floor, { parallax: 1, y: 316 }),
  ];
  return s;
}

// ---------------------------------------------------------------------------
function forest(): StageDef {
  const s = newStage('Forest Temple'); s.id = 'builtin_forest';
  s.width = 1100; s.floorY = 318; s.skyTop = '#0a2a2a'; s.skyBottom = '#3a6a4a'; s.floorColor = '#1a2a10';
  s.weather = 'leaves'; s.weatherDensity = 0.8; s.ambient = 'fireflies'; s.musicTheme = 5;
  const trees = (w: number, h: number, col: string, seed: number, n: number) => {
    const [c, g] = makeCanvas(w, h); const r = new Rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r.range(0, w), tw = r.range(4, 9), th = r.range(h * 0.5, h);
      R(g, x, h - th, tw, th, shade(col, -0.3));
      for (let k = 0; k < 5; k++) { const cy = h - th + k * 10, cw = 30 - k * 3 + r.range(0, 8); R(g, x + tw / 2 - cw / 2, cy, cw, 12, k % 2 ? col : shade(col, 0.1)); }
    }
    return c;
  };
  const far = trees(400, 150, '#1a4a3a', 41, 18);
  const mid = trees(500, 200, '#2a5a2a', 42, 14);
  const W = 550;
  const [temple, tg] = makeCanvas(W, 130);
  R(tg, 180, 40, 190, 90, '#5a4a3a'); R(tg, 160, 30, 230, 12, '#3a2a20'); R(tg, 170, 20, 210, 10, '#2a1e16'); R(tg, 250, 70, 50, 60, '#1a1210');
  for (let i = 0; i < 6; i++) R(tg, 190 + i * 32, 42, 6, 88, '#7a6a5a');
  for (let i = 0; i < 30; i++) { R(tg, 180 + (i * 37) % 190, 40 + (i * 23) % 80, 6, 3, '#3a6a2a'); }
  const [floor, fg] = makeCanvas(W, 30);
  for (let y = 0; y < 30; y++) R(fg, 0, y, W, 1, shade('#3a4a20', -y / 40));
  const r = new Rng(3);
  for (let i = 0; i < 120; i++) R(fg, r.range(0, W), r.range(0, 4), 1, r.range(2, 4), '#5a8a2a');
  for (let i = 0; i < 40; i++) R(fg, r.range(0, W), r.range(6, 28), 3, 2, '#6a6a5a');
  s.layers = [
    layer('Far trees', far, { parallax: 0.15, y: 40 }),
    layer('Mid trees', mid, { parallax: 0.45, y: -82 }),
    layer('Temple', temple, { parallax: 0.8, x: 60, y: 318 - 260, repeatX: false }),
    layer('Forest floor', floor, { parallax: 1, y: 318 }),
  ];
  return s;
}

export function buildBuiltinStages(): StageDef[] {
  return [dojo(), rooftop(), volcano(), shrine(), forest()].map(s => ({ ...s, updatedAt: Date.now() }));
}
