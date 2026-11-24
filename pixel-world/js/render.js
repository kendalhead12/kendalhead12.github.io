// Pixel World — Canvas renderer: terrain texture, detail chunks, map-mode overlays, ink-bleed borders,
// people, particles, clouds, labels and minimap.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U, T = PW.T, S = PW.S, SP = PW.SP;
const R = PW.R = {};
const GR = 4, DR = 8, CH = 16;
const BLD = S.BLD, M = T.M, B = T.B;
R.GR = GR;

let st, w, W, H, N;
let tex, texCtx, texData, built, builtCtx, builtData;
let ovl, ovlCtx, ovlData, ovlDirty = true, ovlLast = 0, ovlVer = -1;
let brd, brdCtx, brdData, brdDirty = true, brdLast = 0, brdVer = -1;
let fromCol, flip, animUntil = 0;
const chunks = new Map(); let frameNo = 0;
const dirtyTerrain = new Set(), dirtyBuilt = new Set();
let labels = [];
let mmImg = null, mmLast = 0;
R.mode = 'political'; R.sel = 0; R.tl = null; R.showClouds = true; R.showLabels = true; R.particlesOn = true;
R.cam = { x: 0, y: 0, z: 4, tz: 4, ax: null };
R.people = new Map(); R.particles = []; R.clouds = []; R.cursor = null; R.now = 0; R.simSpeed = 1; R.highlightSet = 0;

function canvas(wd, ht) { const c = document.createElement('canvas'); c.width = wd; c.height = ht; return c; }

R.init = (cv, mini) => {
  R.cv = cv; R.ctx = cv.getContext('2d'); R.mini = mini; R.mctx = mini.getContext('2d');
  SP.init();
  R.cloudShadow = SP.clouds.map(c => { const s = canvas(c.width, c.height); const g = s.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); return s; });
  R.resize(); window.addEventListener('resize', R.resize);
  S.hooks.pre = onPre; S.hooks.post = onPost; S.hooks.tile = (i) => markBuilt(i); S.hooks.era = onEra; S.hooks.terrain = (i) => R.terrainTile(i);
};
R.resize = () => {
  const dpr = Math.min(2, window.devicePixelRatio || 1); R.dpr = dpr;
  R.cw = R.cv.clientWidth || window.innerWidth; R.ch = R.cv.clientHeight || window.innerHeight;
  R.cv.width = Math.round(R.cw * dpr); R.cv.height = Math.round(R.ch * dpr);
};

R.setState = (s) => {
  st = s; w = s.world; W = w.W; H = w.H; N = w.N;
  tex = canvas(W * GR, H * GR); texCtx = tex.getContext('2d'); texData = texCtx.createImageData(W * GR, H * GR);
  built = canvas(W * GR, H * GR); builtCtx = built.getContext('2d'); builtData = builtCtx.createImageData(W * GR, H * GR);
  ovl = canvas(W, H); ovlCtx = ovl.getContext('2d'); ovlData = ovlCtx.createImageData(W, H);
  brd = canvas(W * 3, H * 3); brdCtx = brd.getContext('2d'); brdData = brdCtx.createImageData(W * 3, H * 3);
  fromCol = new Uint32Array(N); flip = new Float32Array(N); animUntil = 0;
  chunks.clear(); dirtyTerrain.clear(); dirtyBuilt.clear();
  renderTerrainRect(0, 0, W, H);
  for (let i = 0; i < N; i++) if (st.bld[i] || st.road[i] || st.rail[i]) builtTile(i);
  builtCtx.putImageData(builtData, 0, 0);
  ovlDirty = brdDirty = true; R.people.clear(); R.particles.length = 0; mmLast = 0;
  R.clouds = [];
  for (let k = 0; k < Math.round(W * H / 5000) + 6; k++) R.clouds.push({ x: Math.random() * W, y: Math.random() * H, s: k % SP.clouds.length, sc: 0.6 + Math.random() * 0.9, v: 0.6 + Math.random() * 0.6 });
  R.mini.width = 220; R.mini.height = Math.max(60, Math.round(220 * H / W));
  R.fit();
};
R.fit = () => { const c = R.cam; c.x = W / 2; c.y = H / 2; c.z = c.tz = Math.min(R.cw / W, R.ch / H) * 0.95; c.ax = null; };
R.minZ = () => Math.min(R.cw / W, R.ch / H) * 0.4;
R.zoomAt = (sx, sy, f) => {
  const c = R.cam; const nz = U.clamp(c.tz * f, R.minZ(), 48);
  const wx = (sx - R.cw / 2) / c.z + c.x, wy = (sy - R.ch / 2) / c.z + c.y;
  c.tz = nz; c.ax = { wx, wy, sx, sy };
};
R.focus = (x, y, z) => { const c = R.cam; c.fx = x; c.fy = y; if (z) c.tz = Math.max(c.tz, z); c.ax = null; };
R.s2w = (sx, sy) => [(sx - R.cw / 2) / R.cam.z + R.cam.x, (sy - R.ch / 2) / R.cam.z + R.cam.y];
R.w2s = (wx, wy) => [(wx - R.cam.x) * R.cam.z + R.cw / 2, (wy - R.cam.y) * R.cam.z + R.ch / 2];

// ---------------- terrain texture ----------------
function hb(u, v) {
  const x = u - 0.5, y = v - 0.5; let x0 = Math.floor(x), y0 = Math.floor(y); const fx = x - x0, fy = y - y0;
  const cx = (a) => a < 0 ? 0 : a >= W ? W - 1 : a, cy = (a) => a < 0 ? 0 : a >= H ? H - 1 : a;
  const X0 = cx(x0), X1 = cx(x0 + 1), Y0 = cy(y0) * W, Y1 = cy(y0 + 1) * W; const h = w.hgt;
  return (h[Y0 + X0] * (1 - fx) + h[Y0 + X1] * fx) * (1 - fy) + (h[Y1 + X0] * (1 - fx) + h[Y1 + X1] * fx) * fy;
}
const CANOPY = { 2: [[40, 96, 40], [80, 146, 60]], 3: [[24, 88, 34], [56, 140, 50]], 7: [[30, 62, 54], [232, 240, 244]], 8: [[52, 80, 48], [96, 124, 70]] };
const o3 = [0, 0, 0];
function pixel(u, v) {
  const seed = w.seed;
  const j1 = U.noise(u * 1.7, v * 1.7, seed + 11) - 0.5, j2 = U.noise(u * 1.7 + 31.7, v * 1.7 + 17.3, seed + 12) - 0.5;
  let tx = Math.floor(u + j1 * 0.95), ty = Math.floor(v + j2 * 0.95);
  if (tx < 0) tx = 0; else if (tx >= W) tx = W - 1; if (ty < 0) ty = 0; else if (ty >= H) ty = H - 1;
  const i = ty * W + tx; const m = w.layers[i * 4 + w.depth[i] - 1]; const b = w.biome[i];
  let r, g, bb;
  if (m <= 1) {
    const c = w.coast[i];
    if (w.fresh[i] && m === 1) { r = 66; g = 142; bb = 190; }
    else if (m === 1) { const t = Math.min(1, (c - 1) / 4); r = 78 - t * 20; g = 154 - t * 24; bb = 196 - t * 14; }
    else { const t = Math.min(1, (c - 1) / 12); r = 42 - t * 18; g = 90 - t * 34; bb = 156 - t * 32; }
    const wave = U.noise(u * 0.9 + v * 0.4, v * 2.4, seed + 5) - 0.5; r += wave * 10; g += wave * 12; bb += wave * 12;
    if (c === 1 && U.noise(u * 3, v * 3, seed + 9) > 0.62) { r += 40; g += 40; bb += 30; }
  } else {
    const pal = T.BIOMES[b].ground; const col = pal[U.hash2(Math.floor(u * 4), Math.floor(v * 4), seed) % pal.length];
    r = col[0]; g = col[1]; bb = col[2];
    let f = U.clamp((hb(u - 0.6, v - 0.6) - hb(u + 0.6, v + 0.6)) * 1.5, -0.32, 0.32);
    if (m === M.MOUNTAIN) f += (U.noise(u * 3, v * 3, seed + 8) - 0.5) * 0.4;
    else if (m === M.STONE) f += (U.noise(u * 4, v * 4, seed + 8) - 0.5) * 0.25;
    else if (b === B.DESERT) f += Math.sin(u * 1.8 + v * 0.7 + U.noise(u * 0.5, v * 0.5, seed) * 6) * 0.05;
    if (m === M.FOREST && CANOPY[b]) {
      const cn = U.noise(u * 2.8, v * 2.8, seed + 21) + (U.hf(Math.floor(u * 4), Math.floor(v * 4), seed + 3) - 0.5) * 0.16;
      if (cn > 0.38) { const [d, l] = CANOPY[b]; const t = U.clamp((cn - 0.38) * 2.2, 0, 1); r = d[0] + (l[0] - d[0]) * t; g = d[1] + (l[1] - d[1]) * t; bb = d[2] + (l[2] - d[2]) * t; }
      else f -= 0.12;
    }
    if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; bb += (255 - bb) * f; } else { r *= 1 + f; g *= 1 + f; bb *= 1 + f; }
  }
  o3[0] = r; o3[1] = g; o3[2] = bb;
}
function renderTerrainRect(x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  if (x1 <= x0 || y1 <= y0) return;
  const d = texData.data, TW = W * GR;
  for (let py = y0 * GR; py < y1 * GR; py++) {
    const v = (py + 0.5) / GR;
    for (let px = x0 * GR; px < x1 * GR; px++) {
      pixel((px + 0.5) / GR, v); const k = (py * TW + px) * 4;
      d[k] = o3[0]; d[k + 1] = o3[1]; d[k + 2] = o3[2]; d[k + 3] = 255;
    }
  }
  texCtx.putImageData(texData, 0, 0, x0 * GR, y0 * GR, (x1 - x0) * GR, (y1 - y0) * GR);
  markChunksRect(x0, y0, x1, y1);
}
R.terrainRect = (x0, y0, x1, y1) => { renderTerrainRect(x0 - 2, y0 - 2, x1 + 2, y1 + 2); ovlDirty = true; brdDirty = true; mmLast = 0; };
R.terrainTile = (i) => { dirtyTerrain.add(i); };
R.fullRedraw = () => { renderTerrainRect(0, 0, W, H); mmLast = 0; };

// ---------------- built layer (buildings & roads at GR) ----------------
function eraAt(i) { const r = st.region[i]; if (r) { const s = st.sets.get(r); if (s) { const c = st.countries.get(s.country); if (c) return c.era; } } return st.roadEra[i]; }
function houseKind(i) {
  const r = st.region[i]; if (!r) return 0; const s = st.sets.get(r); if (!s) return 0; const c = st.countries.get(s.country); if (!c) return 0;
  const era = c.era; if (era < 2 || s.tier < 2) return 0;
  const d = Math.hypot(i % W - s.x, ((i / W) | 0) - s.y);
  const core = Math.sqrt(s.nh) * 0.32 + (era >= 4 ? 1.2 : 0.4) + (s.tier - 2) * 0.8;
  if (d > core) return 0;
  if (era === 5 && s.tier >= 3 && d < core * 0.65) return 2;
  return 1;
}
const ROOF = [[201, 162, 74], [176, 74, 50], [90, 74, 82], [84, 84, 94], [140, 70, 52], [210, 212, 214]];
const ROADC = [[150, 120, 80], [168, 135, 90], [160, 144, 112], [150, 142, 124], [100, 100, 104], [70, 70, 78]];
function roadAt(i) { return i >= 0 && i < N && (st.road[i] || st.bld[i] === BLD.CENTER || st.bld[i] === BLD.PORT); }
function builtTile(i) {
  const d = builtData.data, TW = W * GR; const x = i % W, y = (i / W) | 0; const bx = x * GR, by = y * GR;
  const put = (sx, sy, c, a) => { const k = ((by + sy) * TW + bx + sx) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = a == null ? 255 : a; };
  for (let sy = 0; sy < GR; sy++) for (let sx = 0; sx < GR; sx++) d[((by + sy) * TW + bx + sx) * 4 + 3] = 0;
  const b = st.bld[i], r = st.road[i]; const era = eraAt(i);
  if (r) {
    const c = r === 2 && era >= 5 ? [60, 60, 66] : ROADC[era];
    put(1, 1, c); put(2, 1, c); put(1, 2, c); put(2, 2, c);
    if (x > 0 && roadAt(i - 1)) { put(0, 1, c); put(0, 2, c); }
    if (x < W - 1 && roadAt(i + 1)) { put(3, 1, c); put(3, 2, c); }
    if (y > 0 && roadAt(i - W)) { put(1, 0, c); put(2, 0, c); }
    if (y < H - 1 && roadAt(i + W)) { put(1, 3, c); put(2, 3, c); }
    if (x > 0 && y > 0 && roadAt(i - W - 1) && !roadAt(i - 1) && !roadAt(i - W)) put(0, 0, c);
    if (x < W - 1 && y > 0 && roadAt(i - W + 1) && !roadAt(i + 1) && !roadAt(i - W)) put(3, 0, c);
    if (x > 0 && y < H - 1 && roadAt(i + W - 1) && !roadAt(i - 1) && !roadAt(i + W)) put(0, 3, c);
    if (x < W - 1 && y < H - 1 && roadAt(i + W + 1) && !roadAt(i + 1) && !roadAt(i + W)) put(3, 3, c);
    if (st.rail[i]) { put(2, 2, [50, 40, 40]); put(3, 3, [50, 40, 40]); }
  }
  if (!b) return;
  switch (b) {
    case BLD.HOUSE: {
      const k = houseKind(i);
      if (k === 2) { for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 3; sx++) put(sx, sy, sy === 0 ? [120, 170, 210] : [70, 110, 150]); put(3, 3, [40, 50, 60]); }
      else if (k === 1) { const c = era >= 4 ? [150, 90, 70] : ROOF[era]; for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) put(sx, sy, sy === 0 ? U.shade(c, 0.2) : c); put(0, 3, [60, 50, 50]); put(1, 3, [60, 50, 50]); put(2, 3, [60, 50, 50]); }
      else { const c = ROOF[era]; put(1, 0, c); put(2, 0, U.shade(c, -0.2)); put(1, 1, c); put(2, 1, U.shade(c, -0.2)); const wl = era === 0 ? [139, 90, 52] : era >= 5 ? [236, 234, 228] : [200, 190, 170]; put(1, 2, wl); put(2, 2, wl); }
      break;
    }
    case BLD.FARM: { const cs = [[200, 176, 74], [138, 184, 74], [216, 192, 96]][U.hash2(i, 5, 1) % 3]; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) put(sx, sy, (sy & 1) ? cs : U.shade(cs, -0.25), 235); break; }
    case BLD.CENTER: { const c = [[180, 120, 60], [210, 200, 180], [150, 144, 132], [232, 220, 192], [154, 90, 64], [90, 140, 190]][era]; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) put(sx, sy, (sx + sy) % 3 === 0 ? U.shade(c, -0.3) : c); put(1, 0, [230, 60, 50]); break; }
    case BLD.MARKET: put(0, 1, [200, 60, 60]); put(1, 1, [240, 240, 240]); put(2, 1, [60, 100, 200]); put(3, 1, [240, 240, 240]); put(1, 2, [120, 80, 40]); put(2, 2, [120, 80, 40]); break;
    case BLD.TEMPLE: for (let sy = 0; sy < 3; sy++) for (let sx = 1; sx < 3; sx++) put(sx, sy + 1, [236, 228, 210]); put(1, 0, [210, 170, 60]); break;
    case BLD.FACTORY: for (let sy = 1; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) put(sx, sy, era >= 5 ? [160, 168, 176] : [120, 60, 44]); put(3, 0, [60, 50, 50]); break;
    case BLD.PORT: for (let sx = 0; sx < 4; sx++) { put(sx, 1, [138, 104, 64]); put(sx, 2, [110, 80, 48]); } break;
    case BLD.WALL: { const c = [128, 122, 112]; put(1, 1, c); put(2, 1, c); put(1, 2, c); put(2, 2, c); const wl = (j) => j >= 0 && j < N && st.bld[j] === BLD.WALL; if (wl(i - 1)) { put(0, 1, c); put(0, 2, c); } if (wl(i + 1)) { put(3, 1, c); put(3, 2, c); } if (wl(i - W)) { put(1, 0, c); put(2, 0, c); } if (wl(i + W)) { put(1, 3, c); put(2, 3, c); } break; }
    case BLD.RUIN: put(0, 2, [110, 106, 98]); put(2, 1, [130, 126, 118]); put(3, 3, [100, 96, 90]); break;
  }
}
function markBuilt(i) {
  const x = i % W, y = (i / W) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) dirtyBuilt.add(yy * W + xx); }
}
function onEra(c) {
  for (const s of st.liveSets) if (s.country === c.id) for (const i of s.tiles) if (st.bld[i] || st.road[i]) dirtyBuilt.add(i);
  for (const rd of c.roads) for (const i of rd.t) dirtyBuilt.add(i);
  ovlDirty = true;
}
function processDirty() {
  if (dirtyTerrain.size) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1; const few = dirtyTerrain.size < 150;
    for (const i of dirtyTerrain) {
      const x = i % W, y = (i / W) | 0; T.updateTile(w, i);
      if (few) renderTerrainRect(x - 1, y - 1, x + 2, y + 2);
      else { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    }
    dirtyTerrain.clear();
    if (!few && x1 >= 0) renderTerrainRect(x0 - 2, y0 - 2, x1 + 3, y1 + 3);
    mmLast = 0;
  }
  if (dirtyBuilt.size) {
    let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0;
    for (const i of dirtyBuilt) {
      builtTile(i); dirtyBuilt.delete(i);
      const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      markChunkTile(x, y);
      if (++n > 4000) break;
    }
    if (x1 >= 0) builtCtx.putImageData(builtData, 0, 0, x0 * GR, y0 * GR, (x1 - x0 + 1) * GR, (y1 - y0 + 1) * GR);
  }
}

// ---------------- detail chunks (DR px / tile) ----------------
function markChunkTile(x, y) {
  const a = Math.floor((x - 1) / CH), b = Math.floor((x + 1) / CH), c = Math.floor(y / CH), d = Math.floor((y + 3) / CH);
  for (let cy = c; cy <= d; cy++) for (let cx = a; cx <= b; cx++) { const ch = chunks.get(cx + cy * 1000); if (ch) ch.dirty = true; }
}
function markChunksRect(x0, y0, x1, y1) {
  for (let cy = Math.floor(y0 / CH); cy <= Math.floor((y1 + 3) / CH); cy++) for (let cx = Math.floor((x0 - 1) / CH); cx <= Math.floor((x1 + 1) / CH); cx++) { const ch = chunks.get(cx + cy * 1000); if (ch) ch.dirty = true; }
}
const CROPS = [['#c8b04a', '#a89030'], ['#8ab84a', '#6a9a3a'], ['#d8c060', '#b89a40'], ['#a0c060', '#7a9a40']];
function roadStyle(r, era) {
  if (r === 1) return { w: 2, c: ['#a08458', '#a08458', '#9a8a70', '#8a8478', '#6a6a6e', '#4a4a50'][era] };
  if (era >= 5) return { w: 4, c: '#3a3a40', dash: '#e8c040' };
  return { w: era <= 1 ? 2 : 3, c: ['#9a7a50', '#a8875a', '#a0906a', '#908a7a', '#5a5a5e', '#3a3a40'][era], edge: era >= 3 ? '#6a6660' : null };
}
function drawRoadTile(g, i, ox, oy) {
  const r = st.road[i]; const era = Math.max(st.roadEra[i], eraAt(i)); const sty = roadStyle(r, era);
  const x = i % W, y = (i / W) | 0; const cx = ox + 4, cy = oy + 4, hw = sty.w / 2;
  if (T.isWater(w, i)) { g.fillStyle = era >= 3 ? '#8a8478' : '#7a5a34'; g.fillRect(ox, cy - 2, 8, 4); g.fillRect(cx - 2, oy, 4, 8); }
  g.fillStyle = sty.c;
  const has = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && roadAt(yy * W + xx); };
  const E = has(1, 0), Wt = has(-1, 0), S2 = has(0, 1), Nn = has(0, -1);
  g.fillRect(cx - hw, cy - hw, sty.w, sty.w);
  if (E) g.fillRect(cx, cy - hw, 4, sty.w); if (Wt) g.fillRect(ox, cy - hw, 4, sty.w);
  if (S2) g.fillRect(cx - hw, cy, sty.w, 4); if (Nn) g.fillRect(cx - hw, oy, sty.w, 4);
  const diag = [[1, 1, !E && !S2], [-1, 1, !Wt && !S2], [1, -1, !E && !Nn], [-1, -1, !Wt && !Nn]];
  for (const [dx, dy, ok] of diag) if (ok && has(dx, dy)) for (let t = 0; t <= 4; t++) g.fillRect(cx + t * dx - hw, cy + t * dy - hw, sty.w, sty.w);
  if (sty.dash) { g.fillStyle = sty.dash; if (E || Wt) g.fillRect(ox + 1, cy, 2, 1); if (S2 || Nn) g.fillRect(cx, oy + 1, 1, 2); }
  if (st.rail[i]) {
    g.fillStyle = '#7a6a5a'; const rx = cx + 2, ry = cy + 2;
    const rh = (dx, dy) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && st.rail[yy * W + xx]; };
    g.fillStyle = '#2e2622';
    if (rh(1, 0)) g.fillRect(rx, ry, 4, 1); if (rh(-1, 0)) g.fillRect(rx - 4, ry, 4, 1);
    if (rh(0, 1)) g.fillRect(rx, ry, 1, 4); if (rh(0, -1)) g.fillRect(rx, ry - 4, 1, 4);
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (rh(dx, dy) && !rh(dx, 0) && !rh(0, dy)) for (let t = 0; t <= 4; t++) g.fillRect(rx + t * dx, ry + t * dy, 1, 1);
  }
}
function drawFarm(g, i, ox, oy, era) {
  const [a, b] = CROPS[U.hash2(i, 5, 1) % CROPS.length];
  if (era <= 1) { g.fillStyle = '#7a5a3a'; g.fillRect(ox + 1, oy + 1, 6, 6); g.fillStyle = a; for (let yy = 1; yy < 7; yy += 2) g.fillRect(ox + 1, oy + yy, 6, 1); }
  else if (era <= 3) { for (let yy = 0; yy < 8; yy++) { g.fillStyle = yy % 2 ? b : a; g.fillRect(ox, oy + yy, 8, 1); } g.fillStyle = '#6a4a2a'; g.fillRect(ox, oy, 8, 1); g.fillRect(ox, oy, 1, 8); }
  else { g.fillStyle = a; g.fillRect(ox, oy, 8, 8); g.fillStyle = b; for (let xx = 1; xx < 8; xx += 3) g.fillRect(ox + xx, oy, 1, 8); }
}
function drawWall(g, i, ox, oy) {
  const wl = (j) => j >= 0 && j < N && st.bld[j] === BLD.WALL; const x = i % W;
  g.fillStyle = '#8a8478'; g.fillRect(ox + 2, oy + 1, 4, 6);
  if (x < W - 1 && wl(i + 1)) g.fillRect(ox + 4, oy + 2, 4, 4); if (x > 0 && wl(i - 1)) g.fillRect(ox, oy + 2, 4, 4);
  if (wl(i + W)) g.fillRect(ox + 2, oy + 4, 4, 4); if (wl(i - W)) g.fillRect(ox + 2, oy, 4, 4);
  g.fillStyle = '#b0aa9c'; g.fillRect(ox + 2, oy + 1, 1, 1); g.fillRect(ox + 4, oy + 1, 1, 1); g.fillStyle = '#5a564e'; g.fillRect(ox + 2, oy + 6, 4, 1);
}
function blit(g, spr, ox, oy, dx, dy) { if (spr) g.drawImage(spr, ox + ((8 - spr.width) >> 1) + (dx || 0), oy + 8 - spr.height + (dy || 0)); }
function drawStanding(g, i, ox, oy) {
  const b = st.bld[i]; const h = U.hash2(i, 77, w.seed);
  if (b) {
    const era = eraAt(i);
    switch (b) {
      case BLD.HOUSE: { const k = houseKind(i); const arr = k === 2 ? SP.tower[5] : k === 1 ? SP.tower[era] : SP.house[era]; blit(g, arr[h % arr.length], ox, oy); break; }
      case BLD.CENTER: blit(g, SP.center[era], ox, oy); break;
      case BLD.TEMPLE: blit(g, SP.temple[era], ox, oy); break;
      case BLD.MARKET: blit(g, SP.market[era], ox, oy); break;
      case BLD.FACTORY: blit(g, SP.factory[era], ox, oy); break;
      case BLD.PORT: blit(g, SP.port[era], ox, oy); break;
      case BLD.WALL: drawWall(g, i, ox, oy); break;
      case BLD.RUIN: blit(g, SP.ruin, ox, oy); break;
    }
    return;
  }
  if (st.road[i]) return;
  const bi = w.biome[i]; const p = h % 100;
  switch (bi) {
    case B.TEMPFOREST: { const t = SP.tree.oak; blit(g, t[h % 3], ox, oy, (h >> 3 & 3) - 2, -((h >> 5) & 2)); if (h & 64) blit(g, t[(h >> 7) % 3], ox, oy, 2 + ((h >> 9) & 1), 1); break; }
    case B.JUNGLE: { const t = SP.tree.jungle; blit(g, t[0], ox, oy, (h & 3) - 2, -1); blit(g, t[(h >> 4) & 1], ox, oy, 2, 1); break; }
    case B.TAIGA: { const t = SP.tree.snowpine; blit(g, t[h & 1], ox, oy, (h >> 3 & 3) - 2, -1); if (h & 64) blit(g, t[(h >> 7) & 1], ox, oy, 2, 1); break; }
    case B.SWAMP: if (p < 22) blit(g, SP.tree.willow[0], ox, oy); else if (p < 50) blit(g, SP.deco.reed, ox, oy, (h >> 8 & 3) - 2, -2); else if (p < 65) blit(g, SP.deco.puddle, ox, oy, 0, -2); if (T.top(w, i) === M.FOREST && p >= 22) blit(g, SP.tree.willow[0], ox, oy, 1, 0); break;
    case B.GRASSLAND: if (p < 6) blit(g, SP.deco.flower[h % 3], ox, oy, (h >> 8 & 3) - 2, -2); else if (p < 10) blit(g, SP.deco.bush, ox, oy, 0, -1); break;
    case B.SAVANNA: if (p < 9) blit(g, SP.tree.acacia[0], ox, oy); else if (p < 22) blit(g, SP.deco.tuft, ox, oy, (h >> 8 & 3) - 2, -2); break;
    case B.DESERT: if (p < 4) blit(g, SP.deco.cactus, ox, oy); else if (p < 11) blit(g, SP.deco.dune, ox, oy, 0, -1); break;
    case B.TUNDRA: if (p < 8) blit(g, SP.deco.rock, ox, oy, 0, -2); else if (p < 20) blit(g, SP.deco.tuft, ox, oy, 0, -2); break;
    case B.HILLS: if (p < 40) blit(g, SP.hill, ox, oy); else if (p < 60) blit(g, SP.deco.rock, ox, oy, 0, -2); break;
    case B.MOUNTAIN: if (p < 78) blit(g, SP.mount[w.temp[i] < 100 ? 1 : (h & 1) ? 2 : 0], ox, oy, ((h >> 3) & 3) - 2, -((h >> 6) & 3)); break;
    case B.SNOWFIELD: { const d = w.depth[i]; if (d >= 2 && w.layers[i * 4 + d - 2] === M.MOUNTAIN && p < 78) blit(g, SP.mount[1], ox, oy, ((h >> 3) & 3) - 2, -((h >> 6) & 3)); break; }
  }
}
function buildChunk(cx, cy, ch) {
  const S2 = CH * DR;
  if (!ch) { ch = { cv: canvas(S2, S2), dirty: true, used: 0 }; chunks.set(cx + cy * 1000, ch); }
  const g = ch.cv.getContext('2d'); g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, S2, S2);
  g.drawImage(tex, cx * CH * GR, cy * CH * GR, CH * GR, CH * GR, 0, 0, S2, S2);
  const x0 = cx * CH, y0 = cy * CH;
  for (let ty = y0; ty < Math.min(H, y0 + CH); ty++) for (let tx = x0; tx < Math.min(W, x0 + CH); tx++) {
    const i = ty * W + tx; const ox = (tx - x0) * DR, oy = (ty - y0) * DR;
    if (st.bld[i] === BLD.FARM) drawFarm(g, i, ox, oy, eraAt(i));
    if (st.road[i]) drawRoadTile(g, i, ox, oy);
  }
  for (let ty = Math.max(0, y0 - 1); ty < Math.min(H, y0 + CH + 3); ty++) for (let tx = Math.max(0, x0 - 1); tx < Math.min(W, x0 + CH + 1); tx++) {
    const i = ty * W + tx; drawStanding(g, i, (tx - x0) * DR, (ty - y0) * DR);
  }
  ch.dirty = false; ch.used = frameNo;
  if (chunks.size > 420) { let old = null, ou = 1e18, ok = 0; for (const [k, c] of chunks) if (c.used < ou) { ou = c.used; old = c; ok = k; } if (old) chunks.delete(ok); }
  return ch;
}

// ---------------- sources (live vs timelapse) ----------------
function liveSrc() { return { live: true, region: st.region, road: st.road, sets: st.liveSets, set: (id) => st.sets.get(id), cty: (id) => st.countries.get(id), area: (s) => s.tiles.length }; }
function tlSrc() { const v = R.tl; return { live: false, region: v.region, road: v.road, sets: Array.from(v.sets.values()), set: (id) => v.sets.get(id), cty: (id) => v.cty.get(id), area: (s) => s.area }; }
R.src = () => R.tl ? tlSrc() : liveSrc();

// ---------------- ink bleed ----------------
function polColorOf(s) { const c = st.countries.get(s.country); if (!c) return -1; if (s.occupier) { const o = st.countries.get(s.occupier); if (o) return U.pack(U.shade(o.color, 0.45)); } return U.pack(c.color); }
function onPre(s, tiles) { const col = polColorOf(s); for (const i of tiles) fromCol[i] = st.region[i] && col >= 0 ? (0x1000000 | col) : 0; }
const bfsQ = []; let bfsMark = null, bfsStamp = 1, bfsDist = null;
function onPost(s, src, tiles) {
  if (!tiles || !tiles.length) return;
  const now = R.now;
  if (!bfsMark || bfsMark.length !== N) { bfsMark = new Int32Array(N); bfsDist = new Float32Array(N); }
  const stamp = ++bfsStamp; for (const i of tiles) bfsMark[i] = stamp;
  bfsQ.length = 0;
  const ctrl = (i) => { const r = st.region[i]; if (!r) return 0; const o = st.sets.get(r); return o ? (o.occupier || o.country) : 0; };
  if (src) for (const i of tiles) {
    const x = i % W;
    for (const n of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (n >= 0 && n < N && bfsMark[n] !== stamp && ctrl(n) === src) { bfsQ.push(i); bfsDist[i] = 0; bfsMark[i] = -stamp; break; }
  }
  if (!bfsQ.length) { let best = tiles[0], bd = 1e9; for (const i of tiles) { const d = Math.hypot(i % W - s.x, ((i / W) | 0) - s.y); if (d < bd) { bd = d; best = i; } } bfsQ.push(best); bfsDist[best] = 0; bfsMark[best] = -stamp; }
  let maxd = 0;
  for (let q = 0; q < bfsQ.length; q++) {
    const c = bfsQ[q]; const x = c % W; const dc = bfsDist[c]; if (dc > maxd) maxd = dc;
    for (const n of [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, c - W, c + W]) if (n >= 0 && n < N && bfsMark[n] === stamp) { bfsMark[n] = -stamp; bfsDist[n] = dc + 1 + U.hf(n, 3, 7) * 0.8; bfsQ.push(n); }
  }
  const dur = U.clamp(0.6 + maxd * 0.07, 0.8, 2.8) / Math.min(4, Math.max(1, R.simSpeed / 10));
  for (const i of tiles) {
    const d = bfsMark[i] === -stamp ? bfsDist[i] : maxd;
    const n = U.noise((i % W) / 2.5, ((i / W) | 0) / 2.5, 41) - 0.5;
    flip[i] = now + Math.max(0, (d / (maxd + 1)) * dur + n * dur * 0.35);
  }
  animUntil = Math.max(animUntil, now + dur * 1.5 + 0.3);
  ovlDirty = true; brdDirty = true;
}
R.animating = () => R.now < animUntil;

// ---------------- overlays ----------------
const DIPC = { self: [70, 130, 255], allied: [50, 180, 80], friendly: [150, 214, 140], neutral: [176, 172, 160], rival: [236, 150, 56], war: [222, 44, 44], truce: [232, 214, 96], none: [140, 136, 128] };
const POPRAMP = [[20, 30, 80], [40, 80, 170], [40, 170, 170], [120, 210, 80], [240, 220, 60], [240, 120, 40], [200, 30, 40]];
function ramp(t, rp) { t = U.clamp(t, 0, 0.9999) * (rp.length - 1); const k = Math.floor(t); return U.mix(rp[k], rp[k + 1], t - k); }
let sc = new Int32Array(1024), sc2 = new Int32Array(1024), langCum = new Map(), popInfo = new Map();
function setColors(src) {
  const maxId = st.ids.s + 2; if (sc.length < maxId) { sc = new Int32Array(maxId + 1024); sc2 = new Int32Array(maxId + 1024); }
  sc.fill(-1, 0, maxId); sc2.fill(-1, 0, maxId); langCum.clear(); popInfo.clear();
  const mode = R.mode, sel = R.sel;
  for (const s of src.sets) {
    const c = src.cty(s.country); if (!c) continue;
    let col = null;
    if (mode === 'political' || mode === 'admin' || mode === 'terrain') {
      col = c.color;
      if (mode === 'admin') col = U.shade(col, ((U.hash2(s.id, 1, 2) % 5) - 2) * 0.09);
      if (s.occupier) { const o = src.cty(s.occupier); if (o) { sc2[s.id] = U.pack(col); col = U.shade(o.color, 0.45); } }
      if (sel) { if (s.country !== sel && s.occupier !== sel) col = U.mix(col, [150, 150, 150], 0.45); else col = U.shade(col, 0.12); }
    } else if (mode === 'diplomacy') {
      if (!src.live) col = c.color;
      else if (sel) {
        const k = s.country === sel ? 'self' : (S.relGet(sel, s.country) || { s: 'none' }).s;
        col = DIPC[k] || DIPC.neutral;
      } else col = S.warsOf(s.country).length ? DIPC.war : S.allies(s.country).length ? DIPC.allied : DIPC.neutral;
      if (s.occupier && src.live) { sc2[s.id] = U.pack(col); col = U.shade(DIPC.war, 0.4); }
    } else if (mode === 'tech') {
      const e = c.era, f = c.tech - e; col = U.shade(S.ERAS[e].color, (f - 0.5) * 0.4);
    } else if (mode === 'language') {
      const keys = s.langs ? Object.keys(s.langs) : [String(s.dom)]; const cum = []; let acc = 0;
      for (const k of keys) { const lg = st.langs.get(+k); if (!lg) continue; acc += s.langs ? s.langs[k] : 1; cum.push([acc, U.pack(lg.color)]); }
      langCum.set(s.id, cum); const lg = st.langs.get(s.dom); col = lg ? lg.color : [120, 120, 120];
    } else if (mode === 'population') {
      const a = Math.max(1, src.area(s)); popInfo.set(s.id, [s.pop / a, s.x, s.y, Math.sqrt(a / Math.PI) + 1]); col = [0, 0, 0];
    } else col = c.color;
    if (col) sc[s.id] = U.pack(col);
  }
}
function infraColor(i, src) {
  if (T.isWater(w, i)) { const r = src.road[i] & 3; return r ? 0x8a7a5a : 0x0e1626; }
  const r = src.road[i] & 3, rail = src.live ? st.rail[i] : (src.road[i] >> 2);
  if (src.live) {
    const b = st.bld[i];
    if (b === BLD.CENTER) return 0xfff0a0; if (b === BLD.FACTORY) return 0xff7850; if (b === BLD.PORT) return 0x50dcff; if (b === BLD.MARKET) return 0xffa0dc; if (b === BLD.TEMPLE) return 0xf0e8ff;
    if (b === BLD.HOUSE) return houseKind(i) ? 0xffe8a0 : 0xd8b060; if (b === BLD.FARM) return 0x4a6a3a; if (b === BLD.WALL) return 0xa09888;
  }
  if (rail) return 0xe85050;
  if (r === 2) { const e = src.live ? Math.max(st.roadEra[i], eraAt(i)) : 3; return e >= 5 ? 0xffaa3c : e >= 3 ? 0xd8d0b8 : 0xb09870; }
  if (r === 1) return 0x948a78;
  return 0x1e242c;
}
function refreshOverlay() {
  const src = R.src(); const reg = src.region; const d = ovlData.data; const mode = R.mode; const now = R.now;
  setColors(src);
  const bleed = (mode === 'political' || mode === 'admin') && src.live && now < animUntil;
  let k = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++, k += 4) {
    const i = y * W + x; const r = reg[i]; let c = -1;
    if (mode === 'infra') c = infraColor(i, src);
    else if (r) {
      c = sc[r];
      if (c >= 0) {
        if (sc2[r] >= 0 && ((x + y) & 3) === 0) c = sc2[r];
        if (mode === 'language') { const cum = langCum.get(r); if (cum && cum.length > 1) { const hv = U.hf(x, y, 17); for (const [a, col] of cum) if (hv < a) { c = col; break; } } }
        else if (mode === 'population') { const p = popInfo.get(r); if (p) { const dd = Math.hypot(x - p[1], y - p[2]) / p[3]; const v = p[0] * (0.25 + 1.6 * Math.exp(-dd * dd * 1.5)); c = U.pack(ramp(Math.log10(v + 1) / 3.4, POPRAMP)); } }
      }
    } else if (mode === 'population' && T.isLand(w, i)) c = 0x0c1020;
    if (bleed && flip[i] > now) { const f = fromCol[i]; c = f ? (f & 0xffffff) : -1; }
    else if (bleed && c >= 0 && flip[i] > 0 && now - flip[i] < 0.22) c = U.pack(U.shade([(c >> 16) & 255, (c >> 8) & 255, c & 255], -0.3));
    if (c < 0) d[k + 3] = 0; else { d[k] = (c >> 16) & 255; d[k + 1] = (c >> 8) & 255; d[k + 2] = c & 255; d[k + 3] = 255; }
  }
  ovlCtx.putImageData(ovlData, 0, 0);
}
function refreshBorders() {
  const src = R.src(); const reg = src.region; const d = brdData.data; d.fill(0);
  const TW = W * 3; const maxId = st.ids.s + 2; const cto = new Int32Array(maxId);
  for (const s of src.sets) cto[s.id] = s.country;
  const lab = new Map();
  const px = (x, y, a) => { const k = (y * TW + x) * 4; d[k] = 24; d[k + 1] = 20; d[k + 2] = 30; if (d[k + 3] < a) d[k + 3] = a; };
  const vEdge = (x, y, nat) => { for (let r = 0; r < 3; r++) { px(x * 3 + 2, y * 3 + r, nat ? 230 : 110); if (nat && x < W - 1) px(x * 3 + 3, y * 3 + r, 230); } };
  const hEdge = (x, y, nat) => { for (let c = 0; c < 3; c++) { px(x * 3 + c, y * 3 + 2, nat ? 230 : 110); if (nat && y < H - 1) px(x * 3 + c, y * 3 + 3, 230); } };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; const r = reg[i]; if (!r) continue; const c = cto[r]; if (!c) continue;
    let L = lab.get(c); if (!L) { L = { n: 0, sx: 0, sy: 0, x0: x, x1: x }; lab.set(c, L); } L.n++; L.sx += x; L.sy += y; if (x < L.x0) L.x0 = x; if (x > L.x1) L.x1 = x;
    if (x < W - 1) { const r2 = reg[i + 1]; if (r2 !== r) { if (r2) vEdge(x, y, cto[r2] !== c); else if (T.isLand(w, i + 1)) vEdge(x, y, true); } }
    if (y < H - 1) { const r2 = reg[i + W]; if (r2 !== r) { if (r2) hEdge(x, y, cto[r2] !== c); else if (T.isLand(w, i + W)) hEdge(x, y, true); } }
    if (x > 0 && !reg[i - 1] && T.isLand(w, i - 1)) vEdge(x - 1, y, true);
    if (y > 0 && !reg[i - W] && T.isLand(w, i - W)) hEdge(x, y - 1, true);
  }
  brdCtx.putImageData(brdData, 0, 0);
  labels = [];
  for (const [cid, L] of lab) { const c = src.cty(cid); if (!c) continue; labels.push({ cid, x: L.sx / L.n + 0.5, y: L.sy / L.n + 0.5, n: L.n, wd: L.x1 - L.x0 + 1, name: c.name, root: c.root || c.name }); }
  labels.sort((a, b) => b.n - a.n);
}
R.invalidate = () => { ovlDirty = true; brdDirty = true; mmLast = 0; };
R.labels = () => labels;

// ---------------- people ----------------
const SHIRTS = ['#c8b8a0', '#7a5a3a', '#5a7a9a', '#9a4a3a', '#5a8a4a', '#e8e0d0', '#8a6aa0', '#3a4a6a'];
const SKIN = ['#f0c8a0', '#d8a878', '#b07848', '#8a5a34', '#5a3a22'];
function personColors(seed, cc) { return { skin: SKIN[seed % 5], shirt: cc, pants: ['#3a3a5a', '#5a3a22', '#2a2a2a', '#4a5a3a'][(seed >> 3) & 3], hair: ['#2a1a10', '#5a3a1a', '#c8a040', '#1a1a1a', '#8a8a8a'][(seed >> 5) % 5] }; }
function drawPerson(g, sx, sy, p, cols, walk, t, act) {
  const bob = walk ? (Math.floor(t * 8) % 2) : 0;
  const lx = Math.floor(t * 8) % 2;
  g.fillStyle = cols.pants;
  if (walk) { g.fillRect(sx - p, sy - 2 * p, p, 2 * p - (lx ? p : 0)); g.fillRect(sx, sy - 2 * p, p, 2 * p - (lx ? 0 : p)); }
  else { g.fillRect(sx - p, sy - 2 * p, 2 * p, 2 * p); }
  g.fillStyle = cols.shirt; g.fillRect(sx - p, sy - 5 * p - bob, 2 * p, 3 * p);
  g.fillStyle = cols.skin; g.fillRect(sx - p, sy - 7 * p - bob, 2 * p, 2 * p);
  g.fillStyle = cols.hair; g.fillRect(sx - p, sy - 7 * p - bob, 2 * p, p * 0.6);
  if (act === 'work') { g.fillStyle = '#7a5a30'; const a = Math.sin(t * 6) > 0; g.fillRect(sx + p, sy - (a ? 6 : 4) * p, p * 0.7, 3 * p); }
}
const WORK = { [BLD.FARM]: ['Farmer', 'Gatherer'], [BLD.PORT]: ['Fisher', 'Sailor', 'Dock Worker'], [BLD.MARKET]: ['Merchant', 'Baker', 'Chef'], [BLD.TEMPLE]: ['Priest', 'Monk', 'Shaman'], [BLD.FACTORY]: ['Factory Worker', 'Engineer', 'Steel'] };
function updatePeople(dt, vx0, vy0, vx1, vy1) {
  const z = R.cam.z; const spd = R.simSpeed <= 0 ? 0 : Math.min(3, Math.max(1, R.simSpeed / 2));
  const want = new Set();
  if (z >= 7 && !R.tl) {
    for (const s of st.liveSets) {
      if (s.x < vx0 - 4 || s.x > vx1 + 4 || s.y < vy0 - 4 || s.y > vy1 + 4) continue;
      want.add(s.id);
      let arr = R.people.get(s.id);
      const n = U.clamp(Math.round(Math.sqrt(s.pop) * 0.5), 2, 26);
      if (!arr) { arr = []; R.people.set(s.id, arr); }
      while (arr.length < n) { const slot = arr.length; const q = { slot, x: s.x + 0.5, y: s.y + 0.5, tx: s.x + 0.5, ty: s.y + 0.5, wait: Math.random() * 2, act: 'walk', seed: U.hash2(s.id, slot, 3) }; pickTarget(s, q); q.x = q.tx; q.y = q.ty; arr.push(q); }
      if (arr.length > n) arr.length = n;
      for (const p of arr) {
        if (p.wait > 0) { p.wait -= dt * spd; if (p.wait <= 0) pickTarget(s, p); continue; }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
        if (d < 0.08) { p.wait = 1 + Math.random() * 3; p.act = p.workAt ? 'work' : 'idle'; continue; }
        const m = Math.min(d, 1.1 * dt * spd); p.x += dx / d * m; p.y += dy / d * m; p.act = 'walk';
      }
    }
  }
  for (const k of R.people.keys()) if (!want.has(k)) R.people.delete(k);
}
function pickTarget(s, p) {
  const tiles = s.tiles; if (!tiles.length) return;
  let best = -1;
  for (let k = 0; k < 6; k++) { const i = tiles[(Math.random() * tiles.length) | 0]; if (st.bld[i] || st.road[i]) { best = i; break; } }
  if (best < 0) best = s.y * W + s.x;
  p.workAt = WORK[st.bld[best]] ? st.bld[best] : 0;
  p.tx = best % W + 0.3 + Math.random() * 0.4; p.ty = ((best / W) | 0) + 0.55 + Math.random() * 0.35;
}
function drawPeople(g, t) {
  const z = R.cam.z; const p = Math.max(1, z / 8);
  for (const [sid, arr] of R.people) {
    const s = st.sets.get(sid); if (!s) continue; const c = st.countries.get(s.country); if (!c) continue;
    const cc = U.css(U.shade(c.color, -0.1));
    for (const q of arr) {
      const [sx, sy] = R.w2s(q.x, q.y);
      if (sx < -20 || sy < -20 || sx > R.cw + 20 || sy > R.ch + 20) continue;
      drawPerson(g, Math.round(sx), Math.round(sy), p, personColors(q.seed, (q.seed & 3) ? SHIRTS[(q.seed >> 7) % SHIRTS.length] : cc), q.act === 'walk', t + q.slot * 0.37, q.act === 'work' ? 'work' : '');
    }
  }
}
function drawBands(g, t) {
  const z = R.cam.z;
  for (const b of st.bands) {
    const [sx, sy] = R.w2s(b.x, b.y); if (sx < -40 || sy < -40 || sx > R.cw + 40 || sy > R.ch + 40) continue;
    const c = b.country ? st.countries.get(b.country) : null; const col = c ? c.color : [240, 230, 200];
    const onWater = T.isWater(w, (b.y | 0) * W + (b.x | 0));
    if (z < 5) {
      g.fillStyle = '#1a1a1a'; g.fillRect(sx - 3, sy - 3, 6, 6); g.fillStyle = U.css(col); g.fillRect(sx - 2, sy - 2, 4, 4);
      continue;
    }
    const p = Math.max(1, z / 8);
    if (onWater) { const spr = SP.boat[b.era >= 3 ? 1 : 0]; g.drawImage(spr, sx - spr.width * p / 2, sy - spr.height * p + Math.sin(t * 3) * p, spr.width * p, spr.height * p); continue; }
    if (b.state === 'camp') {
      for (let k = 0; k < Math.min(4, Math.ceil(b.members.length / 3)); k++) { const a = k * 2.1 + 0.5; const tsx = sx + Math.cos(a) * z * 0.7, tsy = sy + Math.sin(a) * z * 0.5; const spr = SP.tent[k & 1]; g.drawImage(spr, tsx - spr.width * p / 2, tsy - spr.height * p, spr.width * p, spr.height * p); }
      const f = SP.fire[Math.floor(t * 6) % 2]; g.drawImage(f, sx - f.width * p / 2, sy - f.height * p, f.width * p, f.height * p);
    }
    const cc = U.css(col); const moving = b.state !== 'camp' && R.simSpeed > 0;
    b.members.forEach((h, k) => {
      const a = k * 2.399 + (b.state === 'camp' ? t * 0.2 : 0), r = (0.35 + 0.16 * Math.sqrt(k)) * z * (b.state === 'camp' ? 1.3 : 0.8);
      const hx = Math.round(sx + Math.cos(a) * r), hy = Math.round(sy + Math.sin(a) * r * 0.6);
      const age = Math.floor(st.year) - h.born; const pp = age < 14 ? p * 0.7 : p;
      drawPerson(g, hx, hy, pp, personColors(h.id * 7 + 3, cc), moving, t + k * 0.3, b.state === 'camp' && k % 3 === 0 ? 'work' : '');
    });
  }
}
R.pick = (wx, wy) => {
  let best = null, bd = 0.6;
  for (const [sid, arr] of R.people) for (const q of arr) { const d = Math.hypot(q.x - wx, q.y - 0.4 - wy); if (d < bd) { bd = d; best = { type: 'resident', sid, slot: q.slot }; } }
  for (const b of st.bands) {
    b.members.forEach((h, k) => {
      const a = k * 2.399, r = (0.35 + 0.16 * Math.sqrt(k)) * (b.state === 'camp' ? 1.3 : 0.8);
      const hx = b.x + Math.cos(a) * r, hy = b.y + Math.sin(a) * r * 0.6;
      const d = Math.hypot(hx - wx, hy - 0.4 - wy); if (d < bd) { bd = d; best = { type: 'band', band: b, h }; }
    });
    if (R.cam.z < 5 && Math.hypot(b.x - wx, b.y - wy) < 1.2) best = { type: 'band', band: b, h: b.members[0] };
  }
  return best;
};

// ---------------- particles & sparkles ----------------
function spawnParticles(vx0, vy0, vx1, vy1, dt) {
  if (!R.particlesOn || R.cam.z < 7 || R.tl) return;
  const P = R.particles; if (P.length > 260) return;
  const n = Math.min(60, Math.round((vx1 - vx0) * (vy1 - vy0) / 60));
  for (let k = 0; k < n; k++) {
    const x = Math.floor(vx0 + Math.random() * (vx1 - vx0)), y = Math.floor(vy0 + Math.random() * (vy1 - vy0));
    if (x < 0 || y < 0 || x >= W || y >= H) continue; const i = y * W + x; const b = st.bld[i]; const bi = w.biome[i];
    const r = Math.random();
    if (b === BLD.FACTORY && r < 0.5) P.push({ x: x + 0.85, y: y - 0.3, vx: 0.15, vy: -0.4, life: 3, max: 3, k: 'smoke' });
    else if (b === BLD.HOUSE && r < 0.02 && eraAt(i) >= 1 && eraAt(i) <= 3) P.push({ x: x + 0.7, y: y + 0.1, vx: 0.08, vy: -0.25, life: 2, max: 2, k: 'puff' });
    else if (!b && (bi === B.TAIGA || bi === B.TUNDRA || bi === B.SNOWFIELD) && r < 0.08) P.push({ x: x + Math.random(), y: y - 1, vx: 0.1, vy: 0.4, life: 4, max: 4, k: 'snow' });
    else if (!b && bi === B.TEMPFOREST && r < 0.012) P.push({ x: x + Math.random(), y: y, vx: 0.2, vy: 0.25, life: 3, max: 3, k: 'leaf' });
    else if (!b && bi === B.SWAMP && r < 0.03) P.push({ x: x + Math.random(), y: y + Math.random(), vx: 0, vy: 0, life: 2.5, max: 2.5, k: 'fly' });
    else if (!b && bi === B.DESERT && r < 0.01) P.push({ x: x, y: y + 0.5, vx: 0.8, vy: 0, life: 2, max: 2, k: 'dust' });
  }
}
function drawParticles(g, dt, t) {
  const P = R.particles; const z = R.cam.z; const sp = R.simSpeed > 0 ? 1 : 0.15;
  for (let k = P.length - 1; k >= 0; k--) {
    const p = P[k]; p.life -= dt; if (p.life <= 0) { P.splice(k, 1); continue; }
    p.x += p.vx * dt * sp; p.y += p.vy * dt * sp;
    if (p.k === 'fly') { p.x += Math.sin(t * 3 + k) * 0.01; p.y += Math.cos(t * 2 + k) * 0.01; }
    if (p.k === 'leaf') p.x += Math.sin(t * 4 + k) * 0.01;
    const [sx, sy] = R.w2s(p.x, p.y); const a = Math.min(1, p.life / p.max * 1.5);
    const s = Math.max(1, z / 8);
    switch (p.k) {
      case 'smoke': case 'puff': { const g2 = 1 - p.life / p.max; g.fillStyle = `rgba(${p.k === 'smoke' ? 90 : 200},${p.k === 'smoke' ? 90 : 200},${p.k === 'smoke' ? 96 : 205},${a * 0.6})`; const r = s * (1.5 + g2 * 3); g.fillRect(sx - r, sy - r, r * 2, r * 2); break; }
      case 'snow': g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(sx, sy, s, s); break;
      case 'leaf': g.fillStyle = `rgba(${200 + (k % 3) * 20},${120 + (k % 4) * 20},40,${a})`; g.fillRect(sx, sy, s, s); break;
      case 'fly': g.fillStyle = `rgba(230,255,120,${a * (0.5 + 0.5 * Math.sin(t * 8 + k))})`; g.fillRect(sx, sy, s, s); break;
      case 'dust': g.fillStyle = `rgba(230,210,160,${a * 0.5})`; g.fillRect(sx, sy, s * 2, s); break;
    }
  }
}
function drawSparkles(g, vx0, vy0, vx1, vy1, t) {
  const z = R.cam.z; if (z < 4) return;
  const p = Math.max(1, z / 8);
  g.fillStyle = 'rgba(220,240,255,0.55)';
  for (let y = Math.max(0, vy0); y < Math.min(H, vy1); y++) for (let x = Math.max(0, vx0); x < Math.min(W, vx1); x++) {
    const h = U.hash2(x, y, 911); if (h % 11) continue; const i = y * W + x; if (!T.isWater(w, i)) continue;
    const ph = (t * 0.5 + (h >>> 8) / 16777216) % 1; if (ph > 0.3) continue;
    const [sx, sy] = R.w2s(x + ((h >>> 4) & 7) / 8, y + ((h >>> 12) & 7) / 8);
    g.fillRect(sx, sy, p * (ph < 0.15 ? 2 : 3), p);
  }
}

// ---------------- frame ----------------
R.draw = (dt, now) => {
  if (!st) return;
  R.now = now; frameNo++;
  const g = R.ctx, c = R.cam, dpr = R.dpr;
  processDirty();
  // camera smoothing
  if (c.fx != null) { c.x += (c.fx - c.x) * Math.min(1, dt * 6); c.y += (c.fy - c.y) * Math.min(1, dt * 6); if (Math.hypot(c.fx - c.x, c.fy - c.y) < 0.05) { c.fx = c.fy = null; } }
  const oz = c.z; c.z += (c.tz - c.z) * Math.min(1, dt * 12); if (Math.abs(c.tz - c.z) < 0.001) c.z = c.tz;
  if (c.ax && oz !== c.z) { c.x = c.ax.wx - (c.ax.sx - R.cw / 2) / c.z; c.y = c.ax.wy - (c.ax.sy - R.ch / 2) / c.z; }
  if (c.z === c.tz) c.ax = null;
  c.x = U.clamp(c.x, 0, W); c.y = U.clamp(c.y, 0, H);
  const z = c.z;
  const vx0 = Math.floor(c.x - R.cw / 2 / z) - 1, vy0 = Math.floor(c.y - R.ch / 2 / z) - 1, vx1 = Math.ceil(c.x + R.cw / 2 / z) + 1, vy1 = Math.ceil(c.y + R.ch / 2 / z) + 1;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#0d1a33'; g.fillRect(0, 0, R.cw, R.ch);
  const [ox, oy] = R.w2s(0, 0);
  // terrain
  if (z >= 6 && !R.tl) {
    g.imageSmoothingEnabled = false;
    const cx0 = Math.max(0, Math.floor(vx0 / CH)), cy0 = Math.max(0, Math.floor(vy0 / CH)), cx1 = Math.min(Math.ceil(W / CH) - 1, Math.floor(vx1 / CH)), cy1 = Math.min(Math.ceil(H / CH) - 1, Math.floor(vy1 / CH));
    const t0 = performance.now(); const sz = CH * z;
    const pending = [];
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
      let ch = chunks.get(cx + cy * 1000);
      if ((!ch || ch.dirty) && performance.now() - t0 < 9) ch = buildChunk(cx, cy, ch);
      const dx = Math.floor(ox + cx * sz), dy = Math.floor(oy + cy * sz), dw = Math.floor(ox + (cx + 1) * sz) - dx, dh = Math.floor(oy + (cy + 1) * sz) - dy;
      if (ch) { ch.used = frameNo; g.drawImage(ch.cv, dx, dy, dw, dh); }
      else { g.drawImage(tex, cx * CH * GR, cy * CH * GR, CH * GR, CH * GR, dx, dy, dw, dh); g.drawImage(built, cx * CH * GR, cy * CH * GR, CH * GR, CH * GR, dx, dy, dw, dh); }
    }
  } else {
    g.imageSmoothingEnabled = z < GR;
    g.drawImage(tex, ox, oy, W * z, H * z);
    if (!R.tl && z >= 1.2) g.drawImage(built, ox, oy, W * z, H * z);
  }
  if (!R.tl) drawSparkles(g, vx0, vy0, vx1, vy1, now);
  // overlay
  const mode = R.mode;
  const verNow = st.ownVer;
  if (mode !== 'terrain' || R.tl) {
    const need = ovlDirty || (R.animating() && (mode === 'political' || mode === 'admin')) || verNow !== ovlVer;
    if (need && (now - ovlLast > (R.animating() ? 0.03 : 0.12) || ovlDirty)) { refreshOverlay(); ovlLast = now; ovlDirty = false; ovlVer = verNow; }
    let a;
    if (mode === 'infra') a = 0.88;
    else if (mode === 'terrain') a = 0.5;
    else { a = U.clamp(0.85 - (z - 3) * 0.11, mode === 'political' || mode === 'admin' ? 0.2 : 0.38, 0.85); }
    g.globalAlpha = a; g.imageSmoothingEnabled = false; g.drawImage(ovl, ox, oy, W * z, H * z); g.globalAlpha = 1;
  }
  // borders
  if (mode !== 'terrain' || R.tl) {
    if ((brdDirty || verNow !== brdVer) && now - brdLast > (R.animating() ? 0.1 : 0.3)) { refreshBorders(); brdLast = now; brdDirty = false; brdVer = verNow; }
    if (z < 5) { g.imageSmoothingEnabled = true; g.globalAlpha = mode === 'admin' || mode === 'political' || mode === 'diplomacy' ? 0.95 : 0.6; g.drawImage(brd, ox, oy, W * z, H * z); g.globalAlpha = 1; }
    else drawVectorBorders(g, vx0, vy0, vx1, vy1, mode);
  }
  // living things
  const simDt = dt;
  if (!R.tl) {
    updatePeople(simDt, vx0, vy0, vx1, vy1);
    if (z >= 7) drawPeople(g, now);
    drawBands(g, now);
    spawnParticles(vx0, vy0, vx1, vy1, dt);
    drawParticles(g, dt, now);
  }
  // clouds
  if (R.showClouds && z < 14) {
    const a = U.clamp(0.5 - z * 0.03, 0.1, 0.45);
    for (const cl of R.clouds) {
      cl.x += cl.v * dt * 0.8 * (R.simSpeed > 0 ? 1 : 0.2); if (cl.x > W + 20) { cl.x = -20; cl.y = Math.random() * H; }
      const spr = SP.clouds[cl.s]; const ww = spr.width / 4 * cl.sc * z, hh = spr.height / 4 * cl.sc * z;
      const [sx, sy] = R.w2s(cl.x, cl.y); if (sx > R.cw || sy > R.ch || sx + ww < 0 || sy + hh < 0) continue;
      g.imageSmoothingEnabled = false;
      g.globalAlpha = a * 0.35; g.drawImage(R.cloudShadow[cl.s], sx + z * 2, sy + z * 3, ww, hh);
      g.globalAlpha = a; g.drawImage(spr, sx, sy, ww, hh);
    }
    g.globalAlpha = 1;
  }
  drawSettlementMarkers(g, vx0, vy0, vx1, vy1);
  if (R.showLabels && (mode === 'political' || mode === 'diplomacy' || mode === 'tech' || mode === 'admin' || mode === 'language' || R.tl)) drawCountryLabels(g);
  drawCursor(g);
  drawMinimap(now);
};
function drawVectorBorders(g, vx0, vy0, vx1, vy1, mode) {
  const src = R.src(); const reg = src.region; const z = R.cam.z;
  const ctyOf = (r) => { const s = src.set(r); return s ? s.country : 0; };
  const nat = new Path2D(), regp = new Path2D(), selp = new Path2D(); const sel = R.sel;
  const [ox, oy] = R.w2s(0, 0);
  for (let y = Math.max(0, vy0); y < Math.min(H, vy1); y++) for (let x = Math.max(0, vx0); x < Math.min(W, vx1); x++) {
    const i = y * W + x; const r = reg[i];
    const c = r ? ctyOf(r) : 0; const land = r || T.isLand(w, i);
    if (x < W - 1) {
      const r2 = reg[i + 1];
      if (r2 !== r && (r || r2)) { const c2 = r2 ? ctyOf(r2) : 0; const land2 = r2 || T.isLand(w, i + 1); if (land && land2) { const p = c2 !== c ? nat : regp; p.moveTo(ox + (x + 1) * z, oy + y * z); p.lineTo(ox + (x + 1) * z, oy + (y + 1) * z); } if (sel && (c === sel) !== (c2 === sel)) { selp.moveTo(ox + (x + 1) * z, oy + y * z); selp.lineTo(ox + (x + 1) * z, oy + (y + 1) * z); } }
    }
    if (y < H - 1) {
      const r2 = reg[i + W];
      if (r2 !== r && (r || r2)) { const c2 = r2 ? ctyOf(r2) : 0; const land2 = r2 || T.isLand(w, i + W); if (land && land2) { const p = c2 !== c ? nat : regp; p.moveTo(ox + x * z, oy + (y + 1) * z); p.lineTo(ox + (x + 1) * z, oy + (y + 1) * z); } if (sel && (c === sel) !== (c2 === sel)) { selp.moveTo(ox + x * z, oy + (y + 1) * z); selp.lineTo(ox + (x + 1) * z, oy + (y + 1) * z); } }
    }
  }
  g.lineCap = 'square';
  if (mode === 'admin' || mode === 'political' || mode === 'diplomacy') { g.strokeStyle = mode === 'admin' ? 'rgba(20,16,28,0.55)' : 'rgba(20,16,28,0.3)'; g.lineWidth = Math.max(1, z * (mode === 'admin' ? 0.07 : 0.05)); g.setLineDash(z > 10 ? [z * 0.25, z * 0.18] : []); g.stroke(regp); g.setLineDash([]); }
  g.strokeStyle = 'rgba(18,14,24,0.85)'; g.lineWidth = Math.max(1.6, z * 0.16); g.stroke(nat);
  if (sel) { g.strokeStyle = `rgba(255,236,120,${0.6 + 0.35 * Math.sin(R.now * 4)})`; g.lineWidth = Math.max(2, z * 0.2); g.stroke(selp); }
}
function drawSettlementMarkers(g, vx0, vy0, vx1, vy1) {
  const z = R.cam.z; const src = R.src();
  if (z < 1.6) return;
  g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (const s of src.sets) {
    if (s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1) continue;
    const tier = s.tier; const cap = s.capital;
    if (z < 3.2 && !cap && tier < 4) continue;
    if (z < 5 && !cap && tier < 3) continue;
    if (z < 7 && !cap && tier < 2) continue;
    const [sx, sy] = R.w2s(s.x + 0.5, s.y + 0.5);
    const detail = z >= 6 && !R.tl;
    if (!detail) {
      const r = Math.max(2, Math.min(7, 1.5 + tier * 1.1 + (cap ? 1 : 0)));
      g.fillStyle = '#1a1420'; g.fillRect(sx - r - 1, sy - r - 1, r * 2 + 2, r * 2 + 2);
      g.fillStyle = cap ? '#ffe070' : '#f4f0e6'; g.fillRect(sx - r, sy - r, r * 2, r * 2);
      if (cap) { g.fillStyle = '#c83a2a'; g.fillRect(sx - r / 2, sy - r / 2, r, r); }
    }
    if (R.highlightSet === s.id) { g.strokeStyle = '#ffe070'; g.lineWidth = 2; g.strokeRect(sx - z, sy - z, z * 2, z * 2); }
    const showName = cap ? z >= 2.5 : tier >= 4 ? z >= 3.5 : tier >= 3 ? z >= 5.5 : tier >= 2 ? z >= 7 : z >= 10;
    if (showName && R.showLabels) {
      const fs = Math.round(U.clamp(9 + tier * 1.5 + (cap ? 2 : 0) + (z > 10 ? 2 : 0), 9, 18));
      g.font = `${cap ? 'bold ' : ''}${fs}px "Pixelify Sans", monospace`;
      const ty = detail ? sy - z * 1.6 : sy - 7;
      g.lineWidth = 3; g.strokeStyle = 'rgba(15,12,20,0.85)'; g.strokeText(s.name, sx, ty); g.fillStyle = cap ? '#ffe9a0' : '#ffffff'; g.fillText(s.name, sx, ty);
    }
  }
}
function drawCountryLabels(g) {
  const z = R.cam.z; if (z > 16) return;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const placed = [];
  for (const L of labels) {
    let fs = Math.sqrt(L.n) * z * 0.36; if (fs < 9) continue; fs = Math.min(fs, 72);
    const [sx, sy] = R.w2s(L.x, L.y); if (sx < -300 || sy < -100 || sx > R.cw + 300 || sy > R.ch + 100) continue;
    let text = fs >= 15 ? L.name : L.root; text = text.toUpperCase();
    g.font = `bold ${Math.round(fs)}px "Pixelify Sans", monospace`;
    let tw = g.measureText(text).width; const maxW = Math.max(L.wd * z * 1.15, 40);
    if (tw > maxW) { fs = fs * maxW / tw; if (fs < 9) { text = L.root.toUpperCase(); fs = Math.min(Math.sqrt(L.n) * z * 0.36, 72); g.font = `bold ${Math.round(fs)}px "Pixelify Sans", monospace`; tw = g.measureText(text).width; if (tw > maxW) fs = fs * maxW / tw; } if (fs < 8) continue; g.font = `bold ${Math.round(fs)}px "Pixelify Sans", monospace`; tw = g.measureText(text).width; }
    const box = [sx - tw / 2, sy - fs / 2, sx + tw / 2, sy + fs / 2];
    if (placed.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
    placed.push(box);
    const a = U.clamp(1.2 - z / 14, 0.25, 0.92);
    g.lineWidth = Math.max(2, fs / 7); g.strokeStyle = `rgba(20,14,26,${a * 0.75})`; g.strokeText(text, sx, sy);
    g.fillStyle = `rgba(255,250,236,${a})`; g.fillText(text, sx, sy);
    const cty = R.src().cty(L.cid);
    if (cty && cty.flag && fs >= 13 && z < 9) {
      const fh = Math.round(U.clamp(fs * 0.55, 9, 22)), fw = Math.round(fh * 1.5);
      g.globalAlpha = a; g.fillStyle = 'rgba(20,14,26,0.8)'; g.fillRect(sx - fw / 2 - 1, sy + fs * 0.55 - 1, fw + 2, fh + 2);
      g.drawImage(PW.F.canvas(cty.flag, 48, 32), sx - fw / 2, sy + fs * 0.55, fw, fh); g.globalAlpha = 1;
      box[3] += fh + 2;
    }
  }
}
function drawCursor(g) {
  const cu = R.cursor; if (!cu) return; const z = R.cam.z;
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.5;
  if (cu.line) { const [a, b] = R.w2s(cu.line[0] + 0.5, cu.line[1] + 0.5), [c2, d] = R.w2s(cu.line[2] + 0.5, cu.line[3] + 0.5); g.lineWidth = Math.max(1.5, cu.r * 2 * z); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); g.lineWidth = 1.5; }
  const [sx, sy] = R.w2s(cu.x + 0.5, cu.y + 0.5);
  if (cu.r != null) { g.beginPath(); g.arc(sx, sy, Math.max(3, (cu.r + 0.5) * z), 0, 7); g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(sx, sy, Math.max(3, (cu.r + 0.5) * z) + 1.5, 0, 7); g.stroke(); }
  else { g.strokeRect(sx - z / 2, sy - z / 2, z, z); }
}
function drawMinimap(now) {
  const m = R.mini, g = R.mctx; if (!m || m.offsetParent === null) return;
  if (!mmImg || now - mmLast > 0.8) {
    if (!mmImg) mmImg = canvas(m.width, m.height);
    if (mmImg.width !== m.width || mmImg.height !== m.height) { mmImg.width = m.width; mmImg.height = m.height; }
    const mg = mmImg.getContext('2d'); mg.imageSmoothingEnabled = true; mg.drawImage(tex, 0, 0, m.width, m.height);
    if (R.mode !== 'terrain') { mg.globalAlpha = 0.65; mg.imageSmoothingEnabled = false; mg.drawImage(ovl, 0, 0, m.width, m.height); mg.globalAlpha = 1; }
    mmLast = now;
  }
  g.clearRect(0, 0, m.width, m.height); g.drawImage(mmImg, 0, 0);
  const sx = m.width / W, sy = m.height / H; const c = R.cam;
  const vw = R.cw / c.z, vh = R.ch / c.z;
  g.strokeStyle = '#ffe070'; g.lineWidth = 1.5; g.strokeRect((c.x - vw / 2) * sx, (c.y - vh / 2) * sy, vw * sx, vh * sy);
}
R.miniTo = (mx, my) => { const m = R.mini; R.cam.x = mx / m.width * W; R.cam.y = my / m.height * H; R.cam.fx = null; };
R.chunkCount = () => chunks.size;

// small world map renderer for galleries: returns a canvas with land/water and an optional highlighted mask
R.miniWorld = (scale) => {
  const c = canvas(Math.max(1, Math.round(W * scale)), Math.max(1, Math.round(H * scale))); const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(tex, 0, 0, c.width, c.height);
  g.fillStyle = 'rgba(30,26,40,0.35)'; g.fillRect(0, 0, c.width, c.height);
  return c;
};
R.texCanvas = () => tex;
// cropped world map (tile rect) scaled to the given pixel width
R.cropWorld = (x0, y0, cw, ch, outW) => {
  const sc = outW / cw; const c = canvas(Math.round(cw * sc), Math.round(ch * sc)); const g = c.getContext('2d');
  g.imageSmoothingEnabled = sc < GR; g.fillStyle = '#0d1a33'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(tex, x0 * GR, y0 * GR, cw * GR, ch * GR, 0, 0, c.width, c.height);
  g.fillStyle = 'rgba(30,26,40,0.3)'; g.fillRect(0, 0, c.width, c.height);
  return c;
};
})();
