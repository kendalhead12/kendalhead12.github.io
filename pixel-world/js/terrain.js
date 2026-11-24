// Pixel World — terrain materials, layered tiles, biomes, climate and world generation.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const T = PW.T = {};

const M = T.M = { DEEP: 0, SHALLOW: 1, SOIL: 2, GRASS: 3, SAND: 4, STONE: 5, MOUNTAIN: 6, SNOW: 7, FOREST: 8 };
T.MATS = [
  { id: 0, key: 'deep', name: 'Deep Ocean', water: true, color: [30, 64, 124], h: 0.0 },
  { id: 1, key: 'shallow', name: 'Shallow Water', water: true, color: [56, 128, 178], h: 0.12 },
  { id: 2, key: 'soil', name: 'Soil', water: false, color: [128, 94, 62], h: 0.3 },
  { id: 3, key: 'grass', name: 'Grass', water: false, color: [98, 166, 72], h: 0.32 },
  { id: 4, key: 'sand', name: 'Sand', water: false, color: [226, 204, 142], h: 0.29 },
  { id: 5, key: 'stone', name: 'Stone', water: false, color: [134, 132, 128], h: 0.55 },
  { id: 6, key: 'mountain', name: 'Mountains', water: false, color: [112, 102, 96], h: 0.92 },
  { id: 7, key: 'snow', name: 'Snow', water: false, color: [238, 243, 250], h: 0.5 },
  { id: 8, key: 'forest', name: 'Forest', water: false, color: [48, 112, 50], h: 0.36 },
];
T.DEPTH = 4;

const B = T.B = { OCEAN: 0, GRASSLAND: 1, TEMPFOREST: 2, JUNGLE: 3, DESERT: 4, SAVANNA: 5, TUNDRA: 6, TAIGA: 7, SWAMP: 8, BEACH: 9, MOUNTAIN: 10, HILLS: 11, SNOWFIELD: 12, BARREN: 13, SHALLOWS: 14, FRESH: 15 };
// food: farmable yield, wood/stone: resources, habit: how attractive it is for humans
T.BIOMES = [
  { name: 'Deep Ocean', ground: [[30, 64, 124]], food: 0, wood: 0, stone: 0, habit: 0, fish: 0.2, cond: 'Open sea' },
  { name: 'Grassland', ground: [[104, 170, 74], [96, 160, 68], [116, 178, 82], [110, 166, 70]], food: 1.0, wood: 0.2, stone: 0.1, habit: 1.0, deco: 'flower', cond: 'Temperate, fertile' },
  { name: 'Temperate Forest', ground: [[72, 128, 56], [66, 120, 52], [80, 136, 60]], food: 0.6, wood: 1.0, stone: 0.1, habit: 0.75, tree: 'oak', cond: 'Mild and humid' },
  { name: 'Tropical Jungle', ground: [[46, 118, 52], [40, 108, 46], [54, 128, 56]], food: 0.7, wood: 1.0, stone: 0.05, habit: 0.55, tree: 'jungle', cond: 'Hot and very wet' },
  { name: 'Desert', ground: [[232, 206, 142], [224, 194, 128], [238, 216, 158], [228, 200, 136]], food: 0.08, wood: 0, stone: 0.3, habit: 0.15, deco: 'cactus', cond: 'Hot and arid' },
  { name: 'Savanna', ground: [[190, 182, 92], [178, 172, 82], [198, 188, 102], [184, 166, 84]], food: 0.8, wood: 0.3, stone: 0.1, habit: 0.85, deco: 'acacia', cond: 'Hot, seasonal rains' },
  { name: 'Tundra', ground: [[148, 158, 128], [158, 166, 140], [140, 150, 124], [170, 176, 156]], food: 0.25, wood: 0.05, stone: 0.3, habit: 0.3, deco: 'rock', cond: 'Cold and windswept' },
  { name: 'Snowy Forest', ground: [[214, 226, 232], [204, 218, 226], [224, 234, 240]], food: 0.3, wood: 0.8, stone: 0.1, habit: 0.3, tree: 'pine', cond: 'Freezing winters' },
  { name: 'Swamp', ground: [[82, 108, 68], [70, 98, 62], [92, 116, 74], [64, 92, 72]], food: 0.5, wood: 0.5, stone: 0, habit: 0.4, deco: 'reed', cond: 'Warm and waterlogged' },
  { name: 'Beach', ground: [[234, 214, 156], [226, 206, 146], [240, 222, 168]], food: 0.4, wood: 0, stone: 0, habit: 0.7, cond: 'Sandy coast' },
  { name: 'Mountains', ground: [[118, 108, 102], [104, 96, 92], [132, 122, 114]], food: 0.02, wood: 0.1, stone: 1.0, habit: 0.05, cond: 'High peaks' },
  { name: 'Rocky Hills', ground: [[138, 136, 130], [126, 124, 120], [150, 146, 138]], food: 0.2, wood: 0.1, stone: 1.0, habit: 0.35, deco: 'rock', cond: 'Rugged hills' },
  { name: 'Snowfield', ground: [[236, 242, 250], [226, 234, 244], [244, 248, 252]], food: 0, wood: 0, stone: 0.1, habit: 0.03, cond: 'Permanent ice' },
  { name: 'Barren Soil', ground: [[132, 98, 66], [122, 90, 60], [142, 106, 72]], food: 0.45, wood: 0, stone: 0.2, habit: 0.6, cond: 'Bare earth' },
  { name: 'Coastal Shallows', ground: [[58, 130, 180]], food: 0, wood: 0, stone: 0, habit: 0, fish: 0.6, cond: 'Shallow sea' },
  { name: 'Lake / River', ground: [[64, 140, 186]], food: 0, wood: 0, stone: 0, habit: 0, fish: 0.5, cond: 'Fresh water' },
];
// biome brushes: [biome name, material, temperature, moisture]
T.BIOME_BRUSH = [
  { name: 'Grassland', mat: M.GRASS, t: 0.5, m: 0.45 },
  { name: 'Temperate Forest', mat: M.FOREST, t: 0.5, m: 0.6 },
  { name: 'Tropical Jungle', mat: M.FOREST, t: 0.85, m: 0.85 },
  { name: 'Desert', mat: M.SAND, t: 0.85, m: 0.12 },
  { name: 'Savanna', mat: M.GRASS, t: 0.8, m: 0.35 },
  { name: 'Tundra', mat: M.GRASS, t: 0.12, m: 0.35 },
  { name: 'Snowy Forest', mat: M.FOREST, t: 0.15, m: 0.6 },
  { name: 'Swamp', mat: M.GRASS, t: 0.6, m: 0.9 },
];

T.createWorld = (W, H, seed) => {
  const N = W * H;
  return {
    W, H, N, seed,
    layers: new Uint8Array(N * 4), depth: new Uint8Array(N),
    temp: new Uint8Array(N), moist: new Uint8Array(N), elev: new Uint8Array(N),
    fresh: new Uint8Array(N), biome: new Uint8Array(N), hgt: new Float32Array(N), coast: new Uint8Array(N),
    version: 0,
  };
};

T.top = (w, i) => w.layers[i * 4 + w.depth[i] - 1];
T.isWater = (w, i) => T.MATS[w.layers[i * 4 + w.depth[i] - 1]].water;
T.isLand = (w, i) => !T.MATS[w.layers[i * 4 + w.depth[i] - 1]].water;
T.isOcean = (w, i) => T.isWater(w, i) && !w.fresh[i];

T.calcBiome = (w, i) => {
  const m = T.top(w, i); const t = w.temp[i] / 255, mo = w.moist[i] / 255;
  switch (m) {
    case M.DEEP: return B.OCEAN;
    case M.SHALLOW: return w.fresh[i] ? B.FRESH : B.SHALLOWS;
    case M.GRASS: if (t < 0.22) return B.TUNDRA; if (mo > 0.72 && t > 0.35) return B.SWAMP; if (t > 0.68) return B.SAVANNA; return B.GRASSLAND;
    case M.FOREST: if (t < 0.3) return B.TAIGA; if (t > 0.66 && mo > 0.45) return B.JUNGLE; if (mo > 0.8 && t > 0.4) return B.SWAMP; return B.TEMPFOREST;
    case M.SAND: if (t > 0.5 && mo < 0.45) return B.DESERT; return B.BEACH;
    case M.STONE: return B.HILLS;
    case M.MOUNTAIN: return B.MOUNTAIN;
    case M.SNOW: return B.SNOWFIELD;
    default: return B.BARREN;
  }
};
T.updateTile = (w, i) => {
  w.biome[i] = T.calcBiome(w, i);
  const m = T.top(w, i);
  w.hgt[i] = T.MATS[m].h + (T.MATS[m].water ? 0 : w.elev[i] / 255 * 0.25);
};
T.refreshAll = (w) => { for (let i = 0; i < w.N; i++) T.updateTile(w, i); T.recomputeCoast(w); w.version++; };

// 2-pass chamfer distance transform (8-neighbour, unit cost); src(i)->bool
T.distField = (W, H, src, cap) => {
  cap = cap || 255; const N = W * H; const d = new Uint8Array(N);
  for (let i = 0; i < N; i++) d[i] = src(i) ? 0 : cap;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let v = d[i]; if (v === 0) continue;
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + 1); if (x < W - 1) v = Math.min(v, d[i - W + 1] + 1); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let v = d[i]; if (v === 0) continue;
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + 1); if (x > 0) v = Math.min(v, d[i + W - 1] + 1); }
    d[i] = v;
  }
  return d;
};
// coast: for water tiles = distance to land, for land tiles = distance to water (both >= 1)
T.recomputeCoast = (w) => {
  const toLand = T.distField(w.W, w.H, (i) => T.isLand(w, i), 30);
  const toWater = T.distField(w.W, w.H, (i) => T.isWater(w, i), 30);
  for (let i = 0; i < w.N; i++) w.coast[i] = T.isWater(w, i) ? toLand[i] : toWater[i];
};

// ----- layered editing -----
T.push = (w, i, m) => {
  const d = w.depth[i]; const L = w.layers; const t = L[i * 4 + d - 1];
  if (t === m) return false;
  const mw = T.MATS[m].water, tw = T.MATS[t].water;
  if (mw && tw) L[i * 4 + d - 1] = m;
  else if (d >= 4) { L[i * 4] = L[i * 4 + 1]; L[i * 4 + 1] = L[i * 4 + 2]; L[i * 4 + 2] = L[i * 4 + 3]; L[i * 4 + 3] = m; }
  else { L[i * 4 + d] = m; w.depth[i] = d + 1; }
  if (m === M.DEEP) w.fresh[i] = 0;
  return true;
};
T.pop = (w, i) => {
  const d = w.depth[i];
  if (d > 1) { w.depth[i] = d - 1; return true; }
  const t = w.layers[i * 4]; if (t === M.DEEP) return false;
  w.layers[i * 4] = T.MATS[t].water ? M.DEEP : M.SHALLOW; if (w.layers[i * 4] === M.DEEP) w.fresh[i] = 0;
  return true;
};
// encode a full tile (stack + fresh + climate) for undo
T.getCode = (w, i) => {
  const L = w.layers, b = i * 4;
  return [w.depth[i] | (L[b] << 4) | (L[b + 1] << 8) | (L[b + 2] << 12) | (L[b + 3] << 16) | (w.fresh[i] << 20), w.temp[i] | (w.moist[i] << 8)];
};
T.setCode = (w, i, c) => {
  const L = w.layers, b = i * 4, v = c[0];
  w.depth[i] = v & 15; L[b] = (v >> 4) & 15; L[b + 1] = (v >> 8) & 15; L[b + 2] = (v >> 12) & 15; L[b + 3] = (v >> 16) & 15; w.fresh[i] = (v >> 20) & 1;
  w.temp[i] = c[1] & 255; w.moist[i] = (c[1] >> 8) & 255;
};
T.stackNames = (w, i) => { const out = []; for (let k = 0; k < w.depth[i]; k++) out.push(T.MATS[w.layers[i * 4 + k]].name); return out; };

T.food = (w, i) => {
  let f = T.BIOMES[w.biome[i]].food; const W = w.W; const x = i % W;
  // fresh water nearby boosts farmland (river valleys)
  if ((x > 0 && w.fresh[i - 1] && T.isWater(w, i - 1)) || (x < W - 1 && w.fresh[i + 1] && T.isWater(w, i + 1)) || (i >= W && w.fresh[i - W] && T.isWater(w, i - W)) || (i + W < w.N && w.fresh[i + W] && T.isWater(w, i + W))) f += 0.5;
  else if (T.isLand(w, i) && w.coast[i] === 1) f += 0.2; // fishing
  return f;
};
T.habit = (w, i) => {
  if (T.isWater(w, i)) return 0;
  let h = T.BIOMES[w.biome[i]].habit;
  if (w.coast[i] <= 2) h += 0.15;
  return h;
};
T.buildable = (w, i) => { if (T.isWater(w, i)) return false; const m = T.top(w, i); return m !== M.MOUNTAIN && m !== M.SNOW; };

// ---------------- world generation ----------------
T.blank = (o) => {
  const w = T.createWorld(o.W, o.H, o.seed); const s = o.seed;
  for (let y = 0; y < o.H; y++) for (let x = 0; x < o.W; x++) {
    const i = y * o.W + x; w.layers[i * 4] = M.DEEP; w.depth[i] = 1;
    const lat = 1 - Math.abs((y + 0.5) / o.H - 0.5) * 2;
    w.temp[i] = U.clamp(Math.round((0.05 + lat * 0.9 + (U.fbm(x / 60, y / 60, 3, s + 7) - 0.5) * 0.2) * 255), 0, 255);
    w.moist[i] = U.clamp(Math.round((U.fbm(x / 45, y / 45, 4, s + 13) * 1.2 - 0.1) * 255), 0, 255);
    w.elev[i] = Math.round(U.fbm(x / 20, y / 20, 3, s + 3) * 120);
  }
  T.refreshAll(w); return w;
};

T.generate = (o) => {
  const W = o.W, H = o.H, N = W * H; const w = T.createWorld(W, H, o.seed);
  const rng = new U.RNG((o.seed ^ 0x9e3779b9) >>> 0);
  const S = []; for (let k = 0; k < 12; k++) S.push(rng.int(1, 1e9));
  const landRatio = U.clamp(o.land == null ? 0.4 : o.land, 0.08, 0.85);
  const islands = U.clamp(o.islands == null ? 0.4 : o.islands, 0, 1);
  const mn = Math.min(W, H), sc = mn / 180;
  const e = new Float32Array(N), rid = new Float32Array(N);
  // continents: irregular ellipses, domain-warped
  const nC = rng.int(2, 3) + (W >= 300 ? 1 : 0) + (W >= 450 ? 1 : 0);
  const conts = [];
  for (let k = 0; k < nC; k++) conts.push({ x: rng.range(0.14, 0.86) * W, y: rng.range(0.2, 0.8) * H, rx: rng.range(0.1, 0.24) * W, ry: rng.range(0.14, 0.32) * H, rot: rng.range(0, Math.PI), str: rng.range(0.75, 1.05) });
  const warp = mn * 0.16;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const qx = x + (U.fbm(x / (55 * sc), y / (55 * sc), 4, S[0]) - 0.5) * warp * 2;
    const qy = y + (U.fbm(x / (55 * sc) + 7.7, y / (55 * sc) + 3.1, 4, S[1]) - 0.5) * warp * 2;
    let m = 0;
    for (const c of conts) {
      const dx = qx - c.x, dy = qy - c.y; const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const ux = (dx * cs + dy * sn) / c.rx, uy = (-dx * sn + dy * cs) / c.ry;
      m = Math.max(m, c.str * (1 - Math.sqrt(ux * ux + uy * uy)));
    }
    const n = U.fbm(qx / (42 * sc), qy / (42 * sc), 6, S[2]);
    const isl = U.fbm(x / (11 * sc), y / (11 * sc), 3, S[3]);
    let v = m * 0.95 + (n - 0.5) * 1.15 + Math.max(0, isl - 0.6) * islands * 2.6 + (islands - 0.4) * 0.05;
    const bx = Math.min(x, W - 1 - x) / (W * 0.07), by = Math.min(y, H - 1 - y) / (H * 0.07);
    v -= (1 - Math.min(1, bx, by)) * 0.9;
    e[i] = v;
    rid[i] = U.ridge(qx / (34 * sc), qy / (34 * sc), 4, S[4]);
  }
  const sorted = Float32Array.from(e).sort();
  const sea = sorted[U.clamp(Math.floor((1 - landRatio) * N), 0, N - 1)];
  const emax = sorted[N - 1], emin = sorted[0];
  const land = new Uint8Array(N), lh = new Float32Array(N);
  for (let i = 0; i < N; i++) { land[i] = e[i] > sea ? 1 : 0; lh[i] = land[i] ? (e[i] - sea) / (emax - sea + 1e-6) : -(sea - e[i]) / (sea - emin + 1e-6); }
  // mountains & hills from ridged noise along high ground
  const ms = new Float32Array(N); const landVals = [];
  for (let i = 0; i < N; i++) if (land[i]) { ms[i] = lh[i] * 0.55 + Math.pow(rid[i], 2.2) * 0.75; landVals.push(ms[i]); }
  landVals.sort((a, b) => a - b);
  const LC = landVals.length || 1;
  const mThr = landVals[Math.floor(LC * 0.925)] || 9, hThr = landVals[Math.floor(LC * 0.86)] || 9, peakThr = landVals[Math.floor(LC * 0.985)] || 9;
  // climate
  const toOcean = T.distField(W, H, (i) => !land[i], 60);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; const lat = 1 - Math.abs((y + 0.5) / H - 0.5) * 2;
    const hh = land[i] ? Math.max(0, lh[i]) : 0;
    let t = 0.04 + lat * 0.94 - hh * 0.32 - (land[i] && ms[i] >= mThr ? 0.12 : 0) + (U.fbm(x / (60 * sc), y / (60 * sc), 3, S[5]) - 0.5) * 0.26;
    let mo = U.fbm(x / (40 * sc) + 3, y / (40 * sc) + 7, 5, S[6]) * 1.35 - 0.2;
    mo += (1 - Math.min(toOcean[i], 24) / 24) * 0.22;
    mo -= Math.exp(-Math.pow((lat - 0.62) / 0.11, 2)) * 0.22; // subtropical dry belt
    mo += Math.max(0, lat - 0.86) / 0.14 * 0.18; // wet equator
    w.temp[i] = U.clamp(Math.round(t * 255), 0, 255);
    w.moist[i] = U.clamp(Math.round(mo * 255), 0, 255);
    w.elev[i] = land[i] ? U.clamp(Math.round(lh[i] * 255), 0, 255) : 0;
  }
  // ---- rivers & lakes via priority-flood drainage ----
  const filled = new Float32Array(N), parent = new Int32Array(N).fill(-1), seen = new Uint8Array(N);
  const heap = new U.Heap(N); const order = [];
  for (let i = 0; i < N; i++) if (!land[i]) { seen[i] = 1; filled[i] = e[i]; heap.push(i, e[i]); }
  const nb4 = [1, -1, W, -W];
  while (heap.n > 0) {
    const c = heap.pop(); if (land[c]) order.push(c);
    const cx = c % W;
    for (let k = 0; k < 4; k++) {
      const n = c + nb4[k]; if (n < 0 || n >= N) continue; const nx = n % W; if (Math.abs(nx - cx) > 1) continue;
      if (seen[n]) continue; seen[n] = 1;
      filled[n] = Math.max(e[n], filled[c] + 1e-5); parent[n] = c;
      heap.push(n, filled[n] + U.hf(n, 3, S[7]) * 0.004);
    }
  }
  const acc = new Float32Array(N);
  for (let k = order.length - 1; k >= 0; k--) { const i = order[k]; acc[i] += 1 + w.moist[i] / 255; const p = parent[i]; if (p >= 0 && land[p]) acc[p] += acc[i]; }
  const accVals = order.map(i => acc[i]).sort((a, b) => a - b);
  const rThr = Math.max(14, accVals[Math.floor(accVals.length * 0.972)] || 14);
  const river = new Uint8Array(N);
  for (const i of order) if (acc[i] >= rThr && w.temp[i] > 30) river[i] = 1;
  // lakes: filled depressions of moderate size
  const lake = new Uint8Array(N); const lseen = new Uint8Array(N); const depth = (i) => filled[i] - e[i];
  let lakeCount = 0; const maxLakes = Math.round(N / 3500);
  for (let i = 0; i < N && lakeCount < maxLakes; i++) {
    if (!land[i] || lseen[i] || depth(i) < 0.006) continue;
    const grp = [i]; lseen[i] = 1;
    for (let g = 0; g < grp.length && grp.length < 400; g++) {
      const c = grp[g]; const cx = c % W;
      for (let k = 0; k < 4; k++) { const n = c + nb4[k]; if (n < 0 || n >= N || Math.abs(n % W - cx) > 1) continue; if (!lseen[n] && land[n] && depth(n) >= 0.006) { lseen[n] = 1; grp.push(n); } }
    }
    if (grp.length >= 3 && grp.length <= 160) { for (const c of grp) lake[c] = 1; lakeCount++; }
  }
  // a few extra noise-placed lakes if the drainage produced few
  for (let tries = 0; lakeCount < Math.max(3, maxLakes * 0.5) && tries < 200; tries++) {
    const x = rng.int(4, W - 5), y = rng.int(4, H - 5), i = y * W + x;
    if (!land[i] || toOcean[i] < 6 || ms[i] >= hThr) continue;
    const r = rng.range(1.5, 4.5 * sc + 1.5);
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      if (Math.hypot(dx, dy * 1.3) + (U.noise(xx / 2.5, yy / 2.5, S[8]) - 0.5) * 2.5 < r) { const j = yy * W + xx; if (land[j]) lake[j] = 1; }
    }
    lakeCount++;
  }
  // moisture boost along rivers
  const toFresh = T.distField(W, H, (i) => river[i] || lake[i], 8);
  for (let i = 0; i < N; i++) if (land[i] && toFresh[i] < 4) w.moist[i] = Math.min(255, w.moist[i] + (4 - toFresh[i]) * 12);
  // ---- assign layered materials ----
  for (let i = 0; i < N; i++) {
    const b = i * 4; const L = w.layers;
    if (!land[i]) { L[b] = lh[i] < -0.07 ? M.DEEP : M.SHALLOW; w.depth[i] = 1; continue; }
    const t = w.temp[i] / 255, mo = w.moist[i] / 255; const st = [M.SOIL];
    if (ms[i] >= mThr) { st.push(M.MOUNTAIN); if (t < 0.42 || ms[i] >= peakThr) st.push(M.SNOW); }
    else if (ms[i] >= hThr) { st.push(M.STONE); if (t < 0.16) st.push(M.SNOW); }
    else if (t < 0.11) st.push(M.SNOW);
    else if (t > 0.6 && mo < 0.33) st.push(M.SAND);
    else {
      st.push(M.GRASS);
      const fThr = 0.5 + (U.noise(i % W / 6, (i / W | 0) / 6, S[9]) - 0.5) * 0.2;
      if (mo > fThr && !(mo > 0.8 && t > 0.4 && lh[i] < 0.12)) st.push(M.FOREST);
      if (mo > 0.6 && t > 0.4 && lh[i] < 0.1) w.moist[i] = Math.max(w.moist[i], 200); // lowland swamps
    }
    // beaches: sand layered over the land beside the ocean
    if (toOcean[i] === 1 && t > 0.3 && st.length <= 3 && st[1] !== M.MOUNTAIN && st[1] !== M.STONE && U.hf(i, 11, S[10]) < 0.75) st.push(M.SAND);
    if (river[i] || lake[i]) { st.push(M.SHALLOW); w.fresh[i] = 1; }
    while (st.length > 4) st.splice(1, 1);
    for (let k = 0; k < st.length; k++) L[b + k] = st[k];
    w.depth[i] = st.length;
  }
  // ocean water hugging the coast is shallow
  const toLandW = T.distField(W, H, (i) => land[i] && !river[i] && !lake[i], 4);
  for (let i = 0; i < N; i++) if (!land[i] && toLandW[i] <= 1) w.layers[i * 4] = M.SHALLOW;
  T.refreshAll(w);
  return w;
};
})();
