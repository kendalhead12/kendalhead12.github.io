// Pixel World — civilization simulation (aggregated settlements, countries, bands, diplomacy, wars, languages).
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U, T = PW.T, L = PW.L, F = PW.F;
const S = PW.S = {};

S.YPS = 0.4; // simulated years per real second at 1x
S.ERAS = [
  { name: 'Primitive', color: [156, 112, 72] },
  { name: 'Ancient', color: [214, 172, 84] },
  { name: 'Medieval', color: [184, 70, 64] },
  { name: 'Early Modern', color: [78, 122, 196] },
  { name: 'Industrial', color: [112, 104, 128] },
  { name: 'Modern', color: [52, 206, 214] },
];
S.TIERS = ['Hamlet', 'Village', 'Town', 'City', 'Metropolis'];
S.tierOf = (p) => p >= 30000 ? 4 : p >= 3000 ? 3 : p >= 300 ? 2 : p >= 30 ? 1 : 0;
S.REGION_WORD = ['Lands', 'District', 'County', 'Province', 'Province', 'Prefecture'];
const BLD = S.BLD = { NONE: 0, HOUSE: 1, FARM: 2, CENTER: 3, MARKET: 4, WALL: 5, PORT: 6, FACTORY: 7, TEMPLE: 8, RUIN: 9 };
S.TECH = [
  ['Fire Making', 'Stone Tools', 'Agriculture', 'Pottery', 'Animal Husbandry'],
  ['Bronze Working', 'Writing', 'The Wheel', 'Masonry', 'Mathematics'],
  ['Iron Smelting', 'Feudalism', 'Castle Building', 'Windmills', 'Astronomy'],
  ['The Printing Press', 'Gunpowder', 'Ocean Navigation', 'Banking', 'The Scientific Method'],
  ['The Steam Engine', 'Railways', 'Electricity', 'The Telegraph', 'Steel Production'],
  ['Computers', 'Aviation', 'Nuclear Power', 'The Internet', 'Space Flight'],
];
S.OCC = [
  ['Hunter', 'Gatherer', 'Farmer', 'Toolmaker', 'Shaman', 'Fisher', 'Woodcutter'],
  ['Farmer', 'Mason', 'Potter', 'Priest', 'Soldier', 'Merchant', 'Fisher', 'Scribe', 'Woodcutter'],
  ['Farmer', 'Blacksmith', 'Knight', 'Merchant', 'Monk', 'Carpenter', 'Baker', 'Guard', 'Woodcutter', 'Fisher'],
  ['Merchant', 'Sailor', 'Printer', 'Artisan', 'Musketeer', 'Farmer', 'Clerk', 'Scholar', 'Fisher'],
  ['Factory Worker', 'Engineer', 'Miner', 'Railwayman', 'Clerk', 'Teacher', 'Soldier', 'Farmer', 'Dock Worker'],
  ['Programmer', 'Doctor', 'Teacher', 'Engineer', 'Driver', 'Artist', 'Scientist', 'Office Worker', 'Farmer', 'Chef'],
];
S.CULTURE_TRAITS = ['Seafaring', 'Pastoral', 'Mercantile', 'Martial', 'Scholarly', 'Agrarian', 'Pious', 'Artistic', 'Nomadic', 'Industrious'];
S.GOVS = {
  tribe: { name: 'Tribal Council', fam: 'tribal', era: [0, 0], form: 'Tribe of {R}', mil: 0.08, stab: 0, tech: 0.9, w: 3 },
  chiefdom: { name: 'Chiefdom', fam: 'tribal', era: [0, 1], form: '{A} Chiefdom', mil: 0.08, stab: 0, tech: 1, w: 3 },
  kingdom: { name: 'Monarchy', fam: 'mon', era: [1, 3], form: 'Kingdom of {R}', mil: 0.05, stab: 0.03, tech: 1, w: 4 },
  citystate: { name: 'City-State', fam: 'rep', era: [1, 3], form: 'City-State of {R}', mil: 0.04, stab: 0.02, tech: 1.15, w: 1.5, maxSets: 3 },
  theocracy: { name: 'Theocracy', fam: 'theo', era: [1, 3], form: 'Holy {A} State', mil: 0.05, stab: 0.05, tech: 0.85, w: 1 },
  empire: { name: 'Empire', fam: 'mon', era: [1, 4], form: '{A} Empire', mil: 0.06, stab: -0.03, tech: 1, w: 3, minSets: 9 },
  duchy: { name: 'Principality', fam: 'mon', era: [2, 3], form: 'Principality of {R}', mil: 0.05, stab: 0.02, tech: 1, w: 1.5, maxSets: 5 },
  feudal: { name: 'Feudal Monarchy', fam: 'mon', era: [2, 2], form: 'Kingdom of {R}', mil: 0.06, stab: -0.02, tech: 0.95, w: 2 },
  merchant: { name: 'Merchant Republic', fam: 'rep', era: [2, 3], form: 'Serene Republic of {R}', mil: 0.03, stab: 0.02, tech: 1.2, w: 1, maxSets: 8 },
  khanate: { name: 'Khanate', fam: 'mon', era: [1, 2], form: 'Khanate of {R}', mil: 0.09, stab: -0.04, tech: 0.85, w: 1 },
  republic: { name: 'Republic', fam: 'rep', era: [3, 5], form: 'Republic of {R}', mil: 0.035, stab: 0.03, tech: 1.15, w: 3 },
  constmon: { name: 'Constitutional Monarchy', fam: 'mon', era: [3, 5], form: 'Kingdom of {R}', mil: 0.035, stab: 0.05, tech: 1.1, w: 2 },
  federation: { name: 'Federation', fam: 'rep', era: [4, 5], form: '{A} Federation', mil: 0.035, stab: 0.02, tech: 1.1, w: 1.5, minSets: 8 },
  democracy: { name: 'Democracy', fam: 'rep', era: [4, 5], form: 'Democratic Republic of {R}', mil: 0.03, stab: 0.05, tech: 1.2, w: 3 },
  dictatorship: { name: 'Dictatorship', fam: 'auth', era: [4, 5], form: '{A} State', mil: 0.07, stab: -0.02, tech: 0.95, w: 1 },
  communist: { name: 'Socialist Republic', fam: 'auth', era: [4, 5], form: "People's Republic of {R}", mil: 0.06, stab: 0, tech: 1.0, w: 1 },
  junta: { name: 'Military Junta', fam: 'auth', era: [3, 5], form: 'State of {R}', mil: 0.09, stab: -0.06, tech: 0.85, w: 0.6 },
};
const GROW = [0.03, 0.02, 0.013, 0.016, 0.026, 0.014];
const FOODMUL = [5, 12, 22, 40, 90, 200];
const CAPMUL = [1.2, 1.4, 1.6, 2, 3, 4];
const MAXSETS = [3, 7, 14, 22, 32, 45];
const GOVCAP = [3, 6, 10, 14, 20, 30];

let st = null;
S.hooks = {};
const hook = (n, a, b, c) => { const f = S.hooks[n]; if (f) f(a, b, c); };
S.the = (name) => 'the ' + name;
S.The = (name) => 'The ' + name;

S.newState = (world, seed) => {
  const N = world.N;
  st = {
    world, year: 0, seed, rng: new U.RNG((seed ^ 0x51ed27) >>> 0),
    ids: { c: 1, s: 1, l: 1, h: 1, b: 1, w: 1 },
    countries: new Map(), sets: new Map(), langs: new Map(), bands: [], wars: new Map(), rel: new Map(),
    events: [], wstats: [], names: new Set(),
    region: new Uint16Array(N), bld: new Uint8Array(N), road: new Uint8Array(N), rail: new Uint8Array(N), roadEra: new Uint8Array(N), tpos: new Int32Array(N),
    grid: new Map(), adjSet: new Map(), adjPairs: new Map(), adjCty: new Map(), adjDirty: true, live: [], liveSets: [],
    ownVer: 1, hist: null,
  };
  st.hist = PW.H ? PW.H.create(st) : null;
  S.st = st; return st;
};
S.use = (s) => { st = s; S.st = s; };
S.C = (id) => st.countries.get(id);

// ---------- events ----------
S.event = (text, o) => {
  o = o || {};
  const ev = { y: Math.floor(st.year), t: text, k: o.k || 'misc', c: o.c || [], x: o.x, yy: o.yy, imp: o.imp ? 1 : 0 };
  st.events.push(ev);
  for (const id of ev.c) { const c = st.countries.get(id); if (c) c.events.push({ y: ev.y, t: text, k: ev.k }); }
  if (o.imp) hook('notify', ev);
  return ev;
};

// ---------- spatial grid of settlement centres ----------
const GC = 8;
const gkey = (x, y) => ((x / GC) | 0) + ((y / GC) | 0) * 4096;
function gridAdd(s) { const k = gkey(s.x, s.y); let a = st.grid.get(k); if (!a) { a = []; st.grid.set(k, a); } a.push(s.id); }
function gridDel(s) { const a = st.grid.get(gkey(s.x, s.y)); if (a) { const j = a.indexOf(s.id); if (j >= 0) a.splice(j, 1); } }
S.nearestSet = (x, y, r, filter) => {
  let best = null, bd = r;
  const c0 = Math.floor((x - r) / GC), c1 = Math.floor((x + r) / GC), r0 = Math.floor((y - r) / GC), r1 = Math.floor((y + r) / GC);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const a = st.grid.get(cx + cy * 4096); if (!a) continue;
    for (const id of a) { const s = st.sets.get(id); if (!s || s.ruined != null) continue; if (filter && !filter(s)) continue; const d = Math.hypot(s.x - x, s.y - y); if (d <= bd) { bd = d; best = s; } }
  }
  return best;
};
S.nearCenter = (x, y, r) => !!S.nearestSet(x, y, r);

// ---------- tile ownership ----------
function claim(i, s) {
  const old = st.region[i]; if (old === s.id) return;
  if (old) unclaim(i);
  st.region[i] = s.id; st.tpos[i] = s.tiles.length; s.tiles.push(i); s.food += T.food(st.world, i);
  st.adjDirty = true; st.ownVer++;
}
function unclaim(i) {
  const id = st.region[i]; if (!id) return; const s = st.sets.get(id);
  if (s) {
    const p = st.tpos[i]; const last = s.tiles.pop();
    if (last !== i && p < s.tiles.length) { s.tiles[p] = last; st.tpos[last] = p; }
    s.food = Math.max(0, s.food - T.food(st.world, i));
  }
  st.region[i] = 0; st.adjDirty = true; st.ownVer++;
}
S.claim = claim; S.unclaim = unclaim;
// building on forest clears it (the forest layer is removed, revealing what lies beneath)
function clearForest(i) { const w = st.world; if (T.top(w, i) === T.M.FOREST && w.depth[i] > 1) { T.pop(w, i); T.updateTile(w, i); hook('terrain', i); } }
function setBld(i, b) { if (st.bld[i] !== b) { st.bld[i] = b; if (b && b !== BLD.RUIN && b !== BLD.WALL) clearForest(i); hook('tile', i); } }
function setRoad(i, r, era) { if (st.road[i] !== r || st.roadEra[i] !== era) { st.road[i] = r; st.roadEra[i] = era; if (r) clearForest(i); hook('tile', i); } }

function computeAdj() {
  const W = st.world.W, H = st.world.H, R = st.region; const pairs = new Map();
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const i = row + x, r = R[i]; if (!r) continue;
      if (x < W - 1) { const r2 = R[i + 1]; if (r2 && r2 !== r) { const k = r < r2 ? r * 65536 + r2 : r2 * 65536 + r; pairs.set(k, (pairs.get(k) || 0) + 1); } }
      if (y < H - 1) { const r2 = R[i + W]; if (r2 && r2 !== r) { const k = r < r2 ? r * 65536 + r2 : r2 * 65536 + r; pairs.set(k, (pairs.get(k) || 0) + 1); } }
    }
  }
  st.adjPairs = pairs; const adj = new Map();
  for (const k of pairs.keys()) {
    const a = Math.floor(k / 65536), b = k % 65536;
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  st.adjSet = adj; st.adjDirty = false;
}
function computeCountryAdj() {
  const m = new Map();
  for (const [k, n] of st.adjPairs) {
    const a = st.sets.get(Math.floor(k / 65536)), b = st.sets.get(k % 65536); if (!a || !b) continue;
    if (a.country === b.country) continue;
    const ca = a.country, cb = b.country; const key = ca < cb ? ca * 65536 + cb : cb * 65536 + ca;
    m.set(key, (m.get(key) || 0) + n);
  }
  st.adjCty = m;
}
S.border = (a, b) => st.adjCty.get(a < b ? a * 65536 + b : b * 65536 + a) || 0;
S.neighbors = (cid) => { const out = []; for (const k of st.adjCty.keys()) { const a = Math.floor(k / 65536), b = k % 65536; if (a === cid) out.push(b); else if (b === cid) out.push(a); } return out; };

// ---------- relations ----------
const relKey = (a, b) => a < b ? a * 65536 + b : b * 65536 + a;
S.rel = (a, b) => { const k = relKey(a, b); let r = st.rel.get(k); if (!r) { r = { op: 0, s: 'neutral', trade: false, truce: 0, since: Math.floor(st.year) }; st.rel.set(k, r); const ix = st._relIdx; if (ix) { if (!ix.has(a)) ix.set(a, []); if (!ix.has(b)) ix.set(b, []); ix.get(a).push([b, r]); ix.get(b).push([a, r]); } } return r; };
S.relGet = (a, b) => st.rel.get(relKey(a, b));
S.status = (a, b) => { const r = S.relGet(a, b); return r ? r.s : 'neutral'; };
S.allies = (cid) => { if (!st._relIdx) buildRelIdx(); if (st._relIdx) return (st._relIdx.get(cid) || []).filter(([o, r]) => r.s === 'allied').map(([o]) => o); const out = []; for (const [k, r] of st.rel) if (r.s === 'allied') { const a = Math.floor(k / 65536), b = k % 65536; if (a === cid) out.push(b); else if (b === cid) out.push(a); } return out.filter(id => { const c = S.C(id); return c && c.fallen == null; }); };
S.relsOf = (cid) => { if (!st._relIdx) buildRelIdx(); if (st._relIdx) return st._relIdx.get(cid) || []; const out = []; for (const [k, r] of st.rel) { const a = Math.floor(k / 65536), b = k % 65536; const o = a === cid ? b : b === cid ? a : 0; if (!o) continue; const c = S.C(o); if (c && c.fallen == null) out.push([o, r]); } return out; };
function buildRelIdx() {
  const m = new Map();
  for (const [k, r] of st.rel) {
    const a = Math.floor(k / 65536), b = k % 65536; const A = st.countries.get(a), B = st.countries.get(b);
    if (!A || !B || A.fallen != null || B.fallen != null) continue;
    if (!m.has(a)) m.set(a, []); if (!m.has(b)) m.set(b, []);
    m.get(a).push([b, r]); m.get(b).push([a, r]);
  }
  st._relIdx = m;
}
function setStatus(a, b, s) { const r = S.rel(a, b); if (r.s !== s) { r.s = s; r.since = Math.floor(st.year); } return r; }

// ---------- countries ----------
function pickColor(rng) {
  const used = st.live.length ? st.live.map(c => U.rgb2hsl(c.color)[0]) : [];
  let best = rng.next(), bd = -1;
  for (let k = 0; k < 24; k++) { const h = rng.next(); let d = 1; for (const u of used) { const dd = Math.min(Math.abs(h - u), 1 - Math.abs(h - u)); if (dd < d) d = dd; } if (d > bd) { bd = d; best = h; } }
  return U.hsl(best, rng.range(0.5, 0.78), rng.range(0.42, 0.6));
}
function pickGov(era, nsets, cur, otherFam) {
  const rng = st.rng; const opts = [], ws = [];
  for (const k in S.GOVS) {
    const g = S.GOVS[k];
    if (era < g.era[0] || era > g.era[1]) continue;
    if (g.minSets && nsets < g.minSets) continue;
    if (g.maxSets && nsets > g.maxSets) continue;
    if (k === cur) continue;
    if (k === 'tribe' && cur) continue; // tribes only exist at founding
    if (otherFam && cur && S.GOVS[cur] && S.GOVS[cur].fam === g.fam) continue;
    opts.push(k); ws.push(g.w);
  }
  if (!opts.length) return cur || (era === 0 ? 'tribe' : 'kingdom');
  return rng.wpick(opts, ws);
}
S.pickGov = pickGov;
S.formName = (gov, root, adj) => (S.GOVS[gov] || S.GOVS.kingdom).form.replace('{R}', root).replace('{A}', adj);

S.newCountry = (o) => {
  const rng = st.rng; const id = st.ids.c++; const y = Math.floor(st.year);
  const lang = st.langs.get(o.lang);
  const root = o.root || L.countryRoot(lang, rng);
  const adj = L.adjOf(lang, root);
  const tech = o.tech || 0; const era = Math.min(5, Math.floor(tech));
  const gov = o.gov || (era === 0 ? (rng.chance(0.7) ? 'tribe' : 'chiefdom') : pickGov(era, 1, null));
  const color = o.color || pickColor(rng);
  const flag = F.generate(rng, color);
  const name = S.formName(gov, root, adj);
  const traits = { agg: rng.range(0.4, 1.6), exp: rng.range(0.6, 1.5), open: rng.range(0.5, 1.5) };
  const ct = [];
  const pool = S.CULTURE_TRAITS.slice();
  if (traits.agg > 1.2) ct.push('Martial'); if (traits.open > 1.2) ct.push('Mercantile');
  while (ct.length < 2) { const t = rng.pick(pool); if (!ct.includes(t)) ct.push(t); }
  const c = {
    id, root, adj, name, gov, lang: lang.id, color, flag, founded: y, fallen: null, fallReason: '',
    tech, era, stability: 0.75, armyF: 1, army: 0, pop: 0, area: 0, nsets: 0, gdp: 0, dev: 0, capital: 0, parent: o.parent || 0,
    names: [{ n: name, from: y, to: null }], flags: [{ f: flag, from: y, to: null }], govs: [{ g: gov, from: y, to: null }], colors: [{ c: color, from: y }],
    events: [], stats: [], borders: [], maxB: null,
    peak: { pop: 0, popY: y, area: 0, areaY: y, army: 0, armyY: y, sets: 0, setsY: y },
    traits, culture: ct.slice(0, 2), roads: [], langSep: {}, techMark: Math.floor(tech * 5), trade: 0, golden: 0, lastSnap: { y: -9999, area: 0 }, cx: 0, cy: 0,
  };
  if (!lang.home) lang.home = id;
  st.countries.set(id, c); st.live.push(c);
  return c;
};
function rename(c, name, by) {
  if (name === c.name) return false;
  const y = Math.floor(st.year);
  c.names[c.names.length - 1].to = y;
  c.names.push({ n: name, from: y, to: null }); c.name = name; st.ownVer++;
  return true;
}
function setFlag(c, f) {
  const y = Math.floor(st.year); c.flags[c.flags.length - 1].to = y; c.flags.push({ f, from: y, to: null }); c.flag = f;
}
S.rename = (c, name) => { const old = c.name; if (rename(c, name)) S.event(`${S.The(old)} was renamed ${S.the(name)}`, { k: 'name', c: [c.id] }); };
S.setFlag = (c, f) => { setFlag(c, f); S.event(`${S.The(c.name)} adopted a new flag`, { k: 'flag', c: [c.id] }); st.ownVer++; };
S.setColor = (c, col) => { c.color = col; c.colors.push({ c: col, from: Math.floor(st.year) }); S.event(`${S.The(c.name)} changed its national colour`, { k: 'flag', c: [c.id] }); st.ownVer++; };

function reform(c, why) {
  const rng = st.rng; const old = c.gov;
  let g = pickGov(c.era, c.nsets, old, why === 'revolution');
  if (why === 'empire') g = 'empire';
  if (g === old) return;
  const y = Math.floor(st.year); const oldName = c.name;
  c.gov = g; c.govs[c.govs.length - 1].to = y; c.govs.push({ g, from: y, to: null });
  if (why === 'revolution' && rng.chance(0.25)) { const lang = st.langs.get(c.lang); c.root = L.countryRoot(lang, rng); c.adj = L.adjOf(lang, c.root); }
  rename(c, S.formName(g, c.root, c.adj));
  if (rng.chance(why === 'revolution' ? 0.8 : 0.4)) setFlag(c, F.variant(rng, c.flag, c.color));
  const verb = why === 'revolution' ? 'After a revolution, ' + S.the(oldName) + ' became' : why === 'empire' ? S.The(oldName) + ' was proclaimed' : S.The(oldName) + ' reformed into';
  const txt = oldName === c.name ? `${S.The(c.name)} adopted a new government: ${S.GOVS[g].name}` : `${verb} ${S.the(c.name)}`;
  S.event(txt, { k: 'gov', c: [c.id], imp: why !== 'era' || c.nsets > 2, x: c.cx, yy: c.cy });
  if (why === 'revolution') c.stability = Math.max(c.stability, 0.45);
}

// ---------- settlements ----------
function domLang(langs) { let b = 0, bv = -1; for (const k in langs) if (langs[k] > bv) { bv = langs[k]; b = +k; } return b; }
S.domLang = domLang;
function uniqueName(lang) {
  const rng = st.rng; let n = '';
  for (let k = 0; k < 12; k++) { n = L.placeName(lang, rng); if (!st.names.has(n)) break; }
  if (st.names.has(n)) n = n + ' ' + ['Nova', 'Minor', 'Major', 'II', 'Vale'][rng.int(0, 4)];
  st.names.add(n); return n;
}
S.found = (x, y, cid, langs, pop, name) => {
  const w = st.world, W = w.W; const i = y * W + x;
  const c = st.countries.get(cid);
  const dom = domLang(langs);
  const lang = st.langs.get(dom) || st.langs.get(c.lang);
  const s = {
    id: st.ids.s++, name: name || uniqueName(lang), country: cid, occupier: 0, x, y, founded: Math.floor(st.year), pop,
    langs: Object.assign({}, langs), dom, tiles: [], food: 0, capital: false, ruined: null,
    hc: 0, fc: 0, nh: 0, nf: 0, temple: -1, market: -1, port: -1, nfac: 0, walls: false, linked: false, tier: S.tierOf(pop), peak: pop, coastal: false,
  };
  if (name) st.names.add(name);
  st.sets.set(s.id, s); st.liveSets.push(s); gridAdd(s);
  hook('pre', s, []);
  const touched = [];
  for (const [dx, dy, d] of U.SPIRAL) {
    if (d > 12) break;
    const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= w.H) continue;
    const j = yy * W + xx; if (!T.isLand(w, j)) continue;
    const r = st.region[j];
    if (r === 0) { if (d <= 2.3) { claim(j, s); touched.push(j); } }
    else if (r !== s.id) {
      const o = st.sets.get(r);
      if (o && o.country === cid && !(o.x === xx && o.y === yy) && d < Math.hypot(xx - o.x, yy - o.y)) { claim(j, s); touched.push(j); }
    }
  }
  if (st.region[i] !== s.id) { claim(i, s); touched.push(i); }
  setBld(i, BLD.CENTER); if (st.road[i]) setRoad(i, 0, 0);
  if (!c.capital || !st.sets.get(c.capital) || st.sets.get(c.capital).ruined != null || st.sets.get(c.capital).country !== cid) { c.capital = s.id; s.capital = true; c.cx = x; c.cy = y; }
  hook('post', s, cid, touched);
  st.ownVer++;
  return s;
};
S.destroySet = (s, reason) => {
  if (s.ruined != null) return;
  const tiles = s.tiles.slice();
  hook('pre', s, tiles);
  for (const i of tiles) {
    unclaim(i);
    const b = st.bld[i];
    if (b === BLD.HOUSE || b === BLD.CENTER || b === BLD.MARKET || b === BLD.TEMPLE || b === BLD.FACTORY) setBld(i, T.buildable(st.world, i) ? BLD.RUIN : 0);
    else if (b === BLD.FARM || b === BLD.WALL || b === BLD.PORT) setBld(i, 0);
  }
  s.ruined = Math.floor(st.year); s.pop = 0; gridDel(s);
  st.liveSets = st.liveSets.filter(o => o !== s);
  hook('post', s, 0, tiles);
  const c = S.C(s.country);
  S.event(`${s.name} was ${reason}`, { k: 'set', c: [s.country], x: s.x, yy: s.y, imp: s.tier >= 2 });
  if (c && c.fallen == null) {
    if (s.capital) { s.capital = false; S.reassignCapital(c); }
    if (!countrySets(c).length) S.fall(c, 'lost its last settlement');
  }
  st.ownVer++;
};
function countrySets(c) { const out = []; for (const s of st.liveSets) if (s.country === c.id) out.push(s); return out; }
S.countrySets = countrySets;
S.reassignCapital = (c) => {
  const ss = countrySets(c).filter(s => !s.occupier);
  const pool = ss.length ? ss : countrySets(c);
  if (!pool.length) return null;
  let best = pool[0]; for (const s of pool) if (s.pop > best.pop) best = s;
  for (const s of countrySets(c)) s.capital = false;
  best.capital = true; c.capital = best.id; c.cx = best.x; c.cy = best.y;
  S.event(`${S.The(c.name)} moved its capital to ${best.name}`, { k: 'capital', c: [c.id] });
  return best;
};
// change who owns / occupies a settlement (ink-bleed animated by the renderer)
S.setControl = (s, country, occupier) => {
  if (s.country === country && s.occupier === occupier) return;
  hook('pre', s, s.tiles);
  const oldC = s.country;
  const wasCap = s.capital && oldC !== country;
  s.country = country; s.occupier = occupier || 0;
  if (wasCap) s.capital = false;
  hook('post', s, s.occupier || s.country, s.tiles);
  st.ownVer++; st.adjDirty = true;
  if (oldC !== country) {
    const oc = S.C(oldC);
    if (oc && oc.fallen == null) {
      if (wasCap || oc.capital === s.id) S.reassignCapital(oc);
      if (!countrySets(oc).length) return 'fell';
    }
    const nc = S.C(country);
    if (nc && (!nc.capital || !st.sets.get(nc.capital) || st.sets.get(nc.capital).country !== nc.id)) { nc.capital = s.id; s.capital = true; nc.cx = s.x; nc.cy = s.y; }
  }
  return '';
};
S.annex = (s, cid, why) => {
  const old = S.C(s.country);
  if (old && old.fallen == null && countrySets(old).length === 1) old._final = S.snapBorders(old, 'Final borders');
  const r = S.setControl(s, cid, 0);
  if (r === 'fell' && old) S.fall(old, why || `conquered by ${S.the(S.C(cid).name)}`, cid);
};

// ---------- humans & bands ----------
S.newHuman = (lang, era, rng, sex, age) => {
  if (sex == null) sex = rng.int(0, 1);
  const [g, f] = L.personName(lang, rng, sex);
  return { id: st.ids.h++, g, f, sex, born: Math.floor(st.year) - (age == null ? rng.int(16, 34) : age), life: rng.int(45, 80), occ: rng.pick(S.OCC[era || 0]) };
};
S.spawnBand = (x, y, n, o) => {
  o = o || {}; const w = st.world; const rng = st.rng; const i = y * w.W + x;
  if (x < 0 || y < 0 || x >= w.W || y >= w.H || !T.isLand(w, i)) return null;
  let cid = 0, lang = null;
  const r = st.region[i];
  if (o.lang) lang = st.langs.get(o.lang);
  else if (r) { const s = st.sets.get(r); cid = s.country; lang = st.langs.get(s.dom) || st.langs.get(S.C(cid).lang); }
  if (!lang) lang = L.create(st, rng);
  const era = o.era || 0;
  const b = { id: st.ids.b++, x: x + 0.5, y: y + 0.5, tx: x + 0.5, ty: y + 0.5, lang: lang.id, country: o.country != null ? o.country : cid, members: [], state: o.dest ? 'travel' : 'explore', camp: 0, sail: !!o.sail, colony: !!o.colony, origin: o.origin || 0, born: Math.floor(st.year), age: 0, stuck: 0, era };
  if (o.dest) { b.tx = o.dest[0] + 0.5; b.ty = o.dest[1] + 0.5; }
  for (let k = 0; k < n; k++) b.members.push(S.newHuman(lang, era, rng, n === 1 ? null : k % 2));
  st.bands.push(b);
  return b;
};
function passable(b, x, y) {
  const w = st.world; if (x < 0 || y < 0 || x >= w.W || y >= w.H) return false;
  const i = (y | 0) * w.W + (x | 0);
  if (T.isLand(w, i)) return true;
  if (b.sail) return true;
  const ci = (b.y | 0) * w.W + (b.x | 0); return T.isWater(w, ci); // allow leaving water if stranded
}
S.realtime = (dy) => {
  if (!st || dy <= 0) return;
  const rng = st.rng;
  for (const b of st.bands) {
    if (b.state === 'camp') continue;
    let rem = (b.state === 'travel' ? 9 : 4.5) * dy;
    while (rem > 0) {
      const step = Math.min(0.3, rem); rem -= step;
      const dx = b.tx - b.x, dyy = b.ty - b.y, d = Math.hypot(dx, dyy);
      if (d < 0.3) { b.arrived = true; break; }
      const a = Math.atan2(dyy, dx); let moved = false;
      for (const off of [0, 0.5, -0.5, 1.1, -1.1, 1.7, -1.7, 2.4, -2.4]) {
        const nx = b.x + Math.cos(a + off) * step, ny = b.y + Math.sin(a + off) * step;
        if (passable(b, nx, ny)) { b.x = nx; b.y = ny; moved = true; break; }
      }
      if (!moved) { b.stuck++; b.tx = U.clamp(b.x + rng.range(-8, 8), 1, st.world.W - 2); b.ty = U.clamp(b.y + rng.range(-8, 8), 1, st.world.H - 2); break; }
    }
  }
};
function removeBand(b) { const k = st.bands.indexOf(b); if (k >= 0) st.bands.splice(k, 1); }
function tickBand(b) {
  const w = st.world, rng = st.rng, y = Math.floor(st.year), W = w.W;
  b.members = b.members.filter(h => y - h.born < h.life);
  const lang = st.langs.get(b.lang);
  const ad = b.members.filter(h => y - h.born >= 16 && y - h.born <= 45);
  const pairs = Math.min(ad.filter(h => h.sex === 0).length, ad.filter(h => h.sex === 1).length);
  if (b.members.length < 12) for (let p = 0; p < pairs; p++) if (rng.chance(0.25) && lang) { const ch = S.newHuman(lang, b.era, rng, null, 0); ch.f = ad[p].f; b.members.push(ch); }
  if (!b.members.length) { removeBand(b); return; }
  b.age++;
  if (b.age > 30 && b.state !== 'travel') {
    // a band that never found a home disperses into the nearest settlement (or dies out)
    const home = S.nearestSet(b.x, b.y, 30);
    if (home) { home.pop += b.members.length; mixLang(home, b.lang, b.members.length / (home.pop + 1)); }
    removeBand(b); return;
  }
  const tx = b.x | 0, ty = b.y | 0, i = ty * W + tx;
  if (b.members.length < 3) {
    for (const o of st.bands) if (o !== b && Math.hypot(o.x - b.x, o.y - b.y) < 3) { o.members.push(...b.members); removeBand(b); return; }
  }
  if (b.members.length > 16 && b.state !== 'travel' && st.bands.length < 40) {
    const half = b.members.splice(0, Math.floor(b.members.length / 2));
    const nb = S.spawnBand(tx, ty, 0, { lang: b.lang, country: b.country, era: b.era }); if (nb) { nb.members = half; nb.tx = U.clamp(b.x + rng.range(-15, 15), 1, W - 2); nb.ty = U.clamp(b.y + rng.range(-15, 15), 1, w.H - 2); }
  }
  if (b.state !== 'travel' && T.isLand(w, i)) {
    const r = st.region[i];
    if (r) {
      const s = st.sets.get(r);
      if (s && s.ruined == null && (b.country === 0 || b.country === s.country) && b.age > 3) {
        s.pop += b.members.length; mixLang(s, b.lang, b.members.length / (s.pop + 1));
        S.event(`A band of ${b.members.length} wanderers joined ${s.name}`, { k: 'band', c: [s.country] });
        removeBand(b); return;
      }
    }
  }
  if (b.state === 'travel') {
    if (b.arrived || Math.hypot(b.tx - b.x, b.ty - b.y) < 1.2 || b.age > 25) {
      if (canSettle(tx, ty)) { settleBand(b); return; }
      b.state = 'explore'; b.colony = false;
    } else return;
  }
  const h = T.habit(w, i);
  if (T.isLand(w, i) && h >= 0.55 && !st.region[i] && !S.nearCenter(tx, ty, 7)) {
    b.state = 'camp'; b.camp++;
    const need = b.members.length >= 2 ? 2 : 5;
    if (b.camp >= need && rng.chance(0.65)) { settleBand(b); return; }
  } else { b.state = 'explore'; b.camp = 0; }
  if (b.state === 'explore' && (b.arrived || rng.chance(0.5))) {
    b.arrived = false; let best = null, bs = -99;
    for (let k = 0; k < 14; k++) {
      const a = rng.range(0, 6.283), d = rng.range(3, 11);
      const x = Math.round(b.x + Math.cos(a) * d), yy = Math.round(b.y + Math.sin(a) * d);
      if (x < 1 || yy < 1 || x >= W - 1 || yy >= w.H - 1) continue;
      const j = yy * W + x;
      let sc = T.habit(w, j) + rng.next() * 0.35 - (st.region[j] ? 0.8 : 0) - (T.isWater(w, j) ? 9 : 0);
      if (sc > bs) { bs = sc; best = [x, yy]; }
    }
    if (best) { b.tx = best[0] + 0.5; b.ty = best[1] + 0.5; }
  }
}
function canSettle(x, y) {
  const w = st.world; const i = y * w.W + x;
  return x > 0 && y > 0 && x < w.W - 1 && y < w.H - 1 && T.isLand(w, i) && T.buildable(w, i) && !st.region[i] && !S.nearCenter(x, y, 6);
}
function settleBand(b) {
  const w = st.world, rng = st.rng; const x = b.x | 0, y = b.y | 0; const i = y * w.W + x;
  if (!T.isLand(w, i) || !T.buildable(w, i)) { b.state = 'explore'; return; }
  const n = b.members.length; let cid = 0; let newC = null;
  const r = st.region[i];
  if (r) { const s = st.sets.get(r); if (b.country === 0 || b.country === s.country) cid = s.country; else { b.state = 'explore'; return; } if (S.nearCenter(x, y, 6)) { b.state = 'explore'; return; } }
  else if (b.country && b.colony) { const pc = S.C(b.country); if (pc && pc.fallen == null) cid = pc.id; }
  const parentC = b.country ? S.C(b.country) : null;
  if (!cid) {
    newC = S.newCountry({ lang: b.lang, tech: parentC ? parentC.tech * 0.85 : 0 });
    cid = newC.id;
  }
  const s = S.found(x, y, cid, { [b.lang]: 1 }, n * 2);
  removeBand(b);
  if (newC) {
    const from = parentC ? ` by settlers from ${S.the(parentC.name)}` : ` by a band of ${n}`;
    S.event(`${S.The(newC.name)} was founded at ${s.name}${from}`, { k: 'found', c: [cid].concat(parentC ? [parentC.id] : []), x, yy: y, imp: true });
  } else S.event(`The settlement of ${s.name} was founded`, { k: 'set', c: [cid], x, yy: y });
}
function mixLang(s, lid, frac) {
  frac = U.clamp(frac, 0, 0.9);
  for (const k in s.langs) s.langs[k] *= (1 - frac);
  s.langs[lid] = (s.langs[lid] || 0) + frac;
  normLangs(s);
}
function normLangs(s) {
  let sum = 0; for (const k in s.langs) sum += s.langs[k];
  if (sum <= 0) { s.langs = { [S.C(s.country).lang]: 1 }; sum = 1; }
  for (const k in s.langs) { s.langs[k] /= sum; if (s.langs[k] < 0.008) delete s.langs[k]; }
  let sum2 = 0; for (const k in s.langs) sum2 += s.langs[k]; for (const k in s.langs) s.langs[k] /= sum2;
  s.dom = domLang(s.langs);
}
S.seedTribes = (n) => {
  const w = st.world, rng = st.rng; let made = 0;
  for (let tries = 0; tries < 4000 && made < n; tries++) {
    const x = rng.int(2, w.W - 3), y = rng.int(2, w.H - 3), i = y * w.W + x;
    if (!T.isLand(w, i) || T.habit(w, i) < 0.6 || st.region[i]) continue;
    if (st.bands.some(b => Math.hypot(b.x - x, b.y - y) < Math.min(w.W, w.H) / 6)) continue;
    S.spawnBand(x, y, rng.int(5, 8)); made++;
  }
  return made;
};

// ---------- per-settlement yearly update ----------
function tickSettlement(s) {
  const c = S.C(s.country); if (!c) return;
  const rng = st.rng, w = st.world, era = c.era;
  let cap = Math.max(12, s.food * FOODMUL[era]) * (s.capital ? CAPMUL[era] : 1) * (s.port >= 0 ? 1.2 : 1) * (1 + Math.min(c.trade, 5) * 0.04);
  s.cap = cap;
  const r = GROW[era] * (0.6 + c.stability * 0.6) * (s.occupier ? 0.3 : 1) * (c.golden > st.year ? 1.3 : 1);
  s.pop += s.pop * r * (1 - s.pop / cap) + (s.pop < 30 ? rng.range(-0.2, 0.5) : 0);
  if (s.pop > cap * 1.15) s.pop = cap * 1.15;
  if (s.pop < 1.5 && st.year - s.founded > 15) { S.destroySet(s, 'abandoned'); return; }
  if (s.pop > s.peak) s.peak = s.pop;
  const nt = S.tierOf(s.pop);
  if (nt > s.tier) { s.tier = nt; if (nt >= 2) S.event(`${s.name} grew into a ${S.TIERS[nt].toLowerCase()}`, { k: 'set', c: [c.id], x: s.x, yy: s.y, imp: nt >= 4 }); }
  else if (nt < s.tier - 1 || (nt < s.tier && s.pop < [0, 25, 250, 2500, 25000][s.tier])) s.tier = nt;
  expand(s, c);
  build(s, c);
  if ((s.id + st.year) % 5 === 0) langTick(s, c);
  // emigration: a band leaves to find new land
  if (s.pop > 60 && era <= 4 && !s.occupier && st.bands.length < 30) {
    const p = (0.0022 + (s.pop / cap > 0.92 ? 0.006 : 0)) * (era >= 4 ? 0.3 : 1);
    if (rng.chance(p)) emigrate(s, c);
  }
}
function expand(s, c) {
  const w = st.world, W = w.W, rng = st.rng, era = c.era;
  const target = Math.min(280, Math.round(10 + Math.sqrt(s.pop) * 1.6 * (1 + era * 0.15)));
  if (s.tiles.length >= target || !s.tiles.length) return;
  const rmax = 4 + Math.sqrt(target) * 0.95;
  const K = 4 + era;
  for (let k = 0; k < K; k++) {
    const t = s.tiles[rng.int(0, s.tiles.length - 1)];
    const dir = rng.int(0, 3); const tx = t % W, ty = (t / W) | 0;
    const nx = tx + (dir === 0 ? 1 : dir === 1 ? -1 : 0), ny = ty + (dir === 2 ? 1 : dir === 3 ? -1 : 0);
    if (nx < 0 || ny < 0 || nx >= W || ny >= w.H) continue;
    const n = ny * W + nx; if (st.region[n] || !T.isLand(w, n)) continue;
    if (Math.hypot(nx - s.x, ny - s.y) > rmax) continue;
    const m = T.top(w, n);
    const p = m === T.M.MOUNTAIN || m === T.M.SNOW ? 0.12 : 0.35 + T.habit(w, n) * 0.65;
    if (rng.chance(p)) claim(n, s);
  }
}
const mod3 = (v) => ((v % 3) + 3) % 3;
function placeOn(s, c, type, startKey) {
  const w = st.world, W = w.W, SP = U.SPIRAL; const era = c.era;
  let k = s[startKey];
  const rlim = Math.sqrt(s.tiles.length / Math.PI) * 1.5 + 2.5;
  for (let n = 0; k < SP.length && n < 140; k++, n++) {
    const [dx, dy, dd] = SP[k]; if (dd > rlim) { k = SP.length; break; }
    const x = s.x + dx, y = s.y + dy;
    if (x < 0 || y < 0 || x >= W || y >= w.H) continue;
    const i = y * W + x;
    if (st.region[i] !== s.id || st.bld[i] || !T.buildable(w, i)) continue;
    if (type === BLD.FARM) {
      if (st.road[i]) continue;
      const m = T.top(w, i); if (m === T.M.FOREST || m === T.M.STONE || T.food(w, i) < 0.4) continue;
    } else {
      if (st.road[i]) continue;
      if (era >= 1 && s.tier >= 1 && !(dx === 0 && dy === 0) && (mod3(dx) === 0 || mod3(dy) === 0)) { setRoad(i, 1, era); continue; }
      if (era === 0 && U.hf(x, y, 99) < 0.4) continue;
    }
    setBld(i, type); s[startKey] = k; return i;
  }
  s[startKey] = k;
  return -1;
}
function build(s, c) {
  const w = st.world, era = c.era, y = st.year, W = w.W;
  if ((y + s.id) % 30 === 0) { // recount and reset cursors
    let nh = 0, nf = 0; for (const i of s.tiles) { const b = st.bld[i]; if (b === BLD.HOUSE) nh++; else if (b === BLD.FARM) nf++; }
    s.nh = nh; s.nf = nf; s.hc = 0; s.fc = 0;
  }
  const targetH = Math.min(Math.floor(s.tiles.length * 0.42), Math.round(1 + Math.sqrt(s.pop) * 0.55 * [0.8, 1, 1.1, 1.2, 1.3, 1.3][era]));
  const targetF = era >= 4 ? Math.round(targetH * 0.25) : Math.round(targetH * 0.6) + 1;
  for (let k = 0; k < 2 && s.nh < targetH; k++) { if (placeOn(s, c, BLD.HOUSE, 'hc') >= 0) s.nh++; else break; }
  if (s.nf < targetF) {
    if (s.fc < s.hc) s.fc = s.hc;
    if (placeOn(s, c, BLD.FARM, 'fc') >= 0) s.nf++;
  }
  if ((y + s.id) % 5 !== 0) return;
  const valid = (i, t) => i >= 0 && st.bld[i] === t && st.region[i] === s.id;
  if (era >= 1 && s.tier >= 1 && !valid(s.temple, BLD.TEMPLE)) { const sv = s.hc; s.temple = placeOn(s, c, BLD.TEMPLE, 'hc'); if (s.temple < 0) s.hc = sv; }
  if (era >= 2 && s.tier >= 2 && !valid(s.market, BLD.MARKET)) { const sv = s.hc; s.market = placeOn(s, c, BLD.MARKET, 'hc'); if (s.market < 0) s.hc = sv; }
  if (era >= 1 && !valid(s.port, BLD.PORT)) {
    let best = -1, bd = 1e9;
    for (const i of s.tiles) {
      if (w.coast[i] !== 1 || st.bld[i] || !T.isLand(w, i)) continue;
      const x = i % W, yy = (i / W) | 0;
      let ocean = false;
      for (const n of [i - 1, i + 1, i - W, i + W]) if (n >= 0 && n < w.N && T.isWater(w, n) && (!w.fresh[n] || w.coast[n] > 1)) ocean = true;
      if (!ocean) continue;
      const d = Math.hypot(x - s.x, yy - s.y); if (d < bd) { bd = d; best = i; }
    }
    s.coastal = best >= 0;
    if (best >= 0 && bd < 9) { setBld(best, BLD.PORT); s.port = best; if (st.road[best]) setRoad(best, 0, 0); }
    else s.port = -1;
  }
  if (era >= 4 && s.tier >= 2 && s.nfac < s.tier - 1) { if (s.fc < s.hc) s.fc = s.hc; const i = placeOn(s, c, BLD.FACTORY, 'fc'); if (i >= 0) s.nfac++; }
  if (era >= 2 && era <= 3 && s.tier >= 2 && !s.walls) {
    const Rw = Math.ceil(Math.sqrt(Math.max(4, s.nh)) * 0.75) + 1.5;
    for (const [dx, dy, d] of U.SPIRAL) {
      if (d > Rw + 0.5) break; if (Math.abs(d - Rw) > 0.5) continue;
      const x = s.x + dx, yy = s.y + dy; if (x < 0 || yy < 0 || x >= W || yy >= w.H) continue;
      const i = yy * W + x;
      if (st.region[i] === s.id && !st.bld[i] && !st.road[i] && T.buildable(w, i)) setBld(i, BLD.WALL);
    }
    s.walls = true;
  }
  if (!s.linked && era >= 1 && (y + s.id) % 10 === 0) linkSettlement(s, c);
}
function emigrate(s, c) {
  const w = st.world, rng = st.rng, W = w.W;
  let best = null, bs = -99;
  const far = c.era >= 3 && s.port >= 0;
  for (let k = 0; k < 40; k++) {
    const a = rng.range(0, 6.283), d = rng.range(14, far ? 90 : 50);
    const x = Math.round(s.x + Math.cos(a) * d), y = Math.round(s.y + Math.sin(a) * d);
    if (!canSettle(x, y)) continue;
    const i = y * W + x; const h = T.habit(w, i); if (h < 0.5) continue;
    const sc = h - d * 0.004 + rng.next() * 0.2; if (sc > bs) { bs = sc; best = [x, y]; }
  }
  if (!best) return;
  const n = rng.int(3, 7);
  const dd = Math.hypot(best[0] - s.x, best[1] - s.y);
  const b = S.spawnBand(s.x, s.y, n, { lang: s.dom || c.lang, country: c.id, dest: best, sail: c.era >= 1, colony: rng.chance(dd < 28 ? 0.8 : 0.3), origin: s.id, era: c.era });
  if (b) { s.pop = Math.max(2, s.pop - n * 2); S.event(`Emigrants left ${s.name} in search of new land`, { k: 'band', c: [c.id] }); }
}
function langTick(s, c) {
  const rate = [0.004, 0.006, 0.01, 0.014, 0.022, 0.03][c.era] * 5 * c.traits.open * (s.occupier ? 0.3 : 1);
  s.langs[c.lang] = (s.langs[c.lang] || 0) + rate;
  const nbs = st.adjSet.get(s.id);
  if (nbs && nbs.length) {
    const o = st.sets.get(nbs[st.rng.int(0, nbs.length - 1)]);
    if (o && o.ruined == null) {
      const wgt = 0.07 * o.pop / (o.pop + s.pop + 1) * (o.country === s.country ? 1 : 0.4);
      for (const k in o.langs) s.langs[k] = (s.langs[k] || 0) + o.langs[k] * wgt;
    }
  }
  if (s.port >= 0 && c.trade > 0) {
    for (const [oid, r] of S.relsOf(c.id)) if (r.trade && st.rng.chance(0.3)) { const oc = S.C(oid); s.langs[oc.lang] = (s.langs[oc.lang] || 0) + 0.006; }
  }
  normLangs(s);
}

// ---------- roads (A*) ----------
let AS = null;
function astar(a, b, maxN) {
  const w = st.world, W = w.W, N = w.N;
  if (!AS || AS.N !== N) AS = { N, g: new Float32Array(N), from: new Int32Array(N), stamp: new Int32Array(N), cur: 0, heap: new U.Heap(4096) };
  AS.cur++; const cur = AS.cur, g = AS.g, from = AS.from, stamp = AS.stamp, heap = AS.heap; heap.n = 0;
  const bx = b % W, by = (b / W) | 0;
  g[a] = 0; from[a] = -1; stamp[a] = cur; heap.push(a, 0);
  let n = 0;
  while (heap.n > 0 && n++ < maxN) {
    const c = heap.pop(); if (c === b) break;
    const cx = c % W, cy = (c / W) | 0;
    for (let k = 0; k < 8; k++) {
      const dx = [1, -1, 0, 0, 1, 1, -1, -1][k], dy = [0, 0, 1, -1, 1, -1, 1, -1][k];
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= w.H) continue;
      const ni = ny * W + nx;
      let cost;
      if (T.isWater(w, ni)) { if (!w.fresh[ni] && w.coast[ni] > 1) continue; cost = w.fresh[ni] ? 6 : 12; }
      else { const m = T.top(w, ni); cost = m === T.M.MOUNTAIN ? 8 : m === T.M.STONE ? 2.2 : m === T.M.FOREST ? 1.5 : m === T.M.SNOW ? 4 : 1; }
      if (st.road[ni] >= 2) cost *= 0.5;
      const b2 = st.bld[ni]; if (b2 && ni !== b) cost += 4;
      if (k >= 4) { cost *= 1.42; if (T.isWater(w, cx + nx - cx + cy * W) || T.isWater(w, nx - dx + ny * W)) cost += 3; }
      const ng = g[c] + cost;
      if (stamp[ni] !== cur || ng < g[ni]) { stamp[ni] = cur; g[ni] = ng; from[ni] = c; heap.push(ni, ng + Math.hypot(nx - bx, ny - by)); }
    }
  }
  if (stamp[b] !== cur) return null;
  const path = []; let p = b; let guard = 0;
  while (p !== -1 && guard++ < 5000) { path.push(p); if (p === a) break; p = from[p]; }
  return path[path.length - 1] === a ? path.reverse() : null;
}
function linkSettlement(s, c) {
  let best = null, bd = 48;
  for (const o of st.liveSets) { if (o === s || o.country !== c.id) continue; const d = Math.hypot(o.x - s.x, o.y - s.y); if (d < bd) { bd = d; best = o; } }
  s.linked = true;
  if (!best) return;
  const W = st.world.W;
  const path = astar(s.y * W + s.x, best.y * W + best.x, 9000);
  if (!path) return;
  const rd = { t: path, rail: 0 };
  for (const i of path) { if (st.bld[i] === BLD.CENTER || st.bld[i] === BLD.PORT) continue; if (st.bld[i] === BLD.WALL) setBld(i, 0); if (st.bld[i] === BLD.FARM || st.bld[i] === BLD.HOUSE) setBld(i, 0); setRoad(i, 2, Math.max(c.era, st.roadEra[i])); }
  if (c.era >= 4) layRail(rd, c);
  c.roads.push(rd);
}
function layRail(rd, c) { rd.rail = 1; for (const i of rd.t) if (!st.rail[i]) { st.rail[i] = 1; hook('tile', i); } }

// ---------- countries yearly ----------
function aggregate() {
  st.live = []; for (const c of st.countries.values()) if (c.fallen == null) { st.live.push(c); c._sets = []; c.pop = 0; c.area = 0; c.ports = 0; }
  st.liveSets = [];
  for (const s of st.sets.values()) {
    if (s.ruined != null) continue;
    const c = st.countries.get(s.country); if (!c || c.fallen != null) continue;
    st.liveSets.push(s); c._sets.push(s); c.pop += s.pop; c.area += s.tiles.length; if (s.port >= 0) c.ports++;
  }
  for (const c of st.live) {
    c.nsets = c._sets.length;
    const cap = st.sets.get(c.capital); if (cap && cap.ruined == null && cap.country === c.id) { c.cx = cap.x; c.cy = cap.y; }
  }
}
S.aggregate = aggregate;
function atWarAny(c) { for (const w of st.wars.values()) if (w.end == null && (w.att.includes(c.id) || w.def.includes(c.id))) return w; return null; }
S.warsOf = (cid) => { const out = []; for (const w of st.wars.values()) if (w.end == null && (w.att.includes(cid) || w.def.includes(cid))) out.push(w); return out; };
function tickCountry(c) {
  const rng = st.rng, y = Math.floor(st.year);
  if (c.fallen != null) return;
  if (!c.nsets) { if (y - c.founded > 1) S.fall(c, 'lost all its territory'); return; }
  const g = S.GOVS[c.gov] || S.GOVS.kingdom;
  const war = atWarAny(c);
  c.armyF = Math.min(1, c.armyF + 0.06);
  c.army = Math.round(c.pop * g.mil * (war ? 1.6 : 1) * c.armyF * (1 + c.traits.agg * 0.2));
  // trade partners
  let trade = 0, maxNb = c.tech;
  for (const [oid, r] of S.relsOf(c.id)) { if (r.trade) { trade++; const o = S.C(oid); if (o.tech > maxNb) maxNb = o.tech; } }
  for (const nb of S.neighbors(c.id)) { const o = S.C(nb); if (o && o.fallen == null && o.tech > maxNb) maxNb = o.tech; }
  c.trade = trade;
  // technology
  let gain = 0.00125 * (1 + Math.log10(c.pop + 1) * 0.5) * (1 + 0.1 * Math.min(trade, 6)) * (0.5 + c.stability * 0.7) * g.tech * (0.6 + rng.next() * 0.8) / (1 + c.era * 0.55);
  if (c.culture.includes('Scholarly')) gain *= 1.15;
  if (c.golden > y) gain *= 1.4;
  if (maxNb > c.tech) gain += (maxNb - c.tech) * 0.005;
  c.tech = Math.min(5.999, c.tech + gain);
  const mark = Math.floor(c.tech * 5);
  if (mark > c.techMark) {
    c.techMark = mark; const e = Math.floor(mark / 5), k = mark % 5;
    if (S.TECH[e]) S.event(`${S.The(c.name)} developed ${S.TECH[e][k]}`, { k: 'tech', c: [c.id] });
  }
  const ne = Math.min(5, Math.floor(c.tech));
  if (ne > c.era) {
    c.era = ne;
    S.event(`${S.The(c.name)} entered the ${S.ERAS[ne].name} Era`, { k: 'era', c: [c.id], imp: true, x: c.cx, yy: c.cy });
    onEra(c);
  }
  // stability
  let offShare = 0; for (const s of c._sets) offShare += (s.langs[c.lang] || 0) * s.pop; offShare = c.pop > 0 ? offShare / c.pop : 1;
  c.offShare = offShare;
  let target = 0.72 + g.stab - 0.012 * Math.max(0, c.nsets - GOVCAP[c.era]) - 0.14 * (1 - offShare) + 0.03 * Math.min(trade, 3) + (c.golden > y ? 0.1 : 0);
  if (war) target -= 0.08;
  c.stability = U.clamp(c.stability + (target - c.stability) * 0.08 + rng.gauss() * 0.025, 0.02, 1);
  // government
  const G = S.GOVS[c.gov];
  if (!G || c.era < G.era[0] || c.era > G.era[1] || (G.maxSets && c.nsets > G.maxSets + 2) || (G.minSets && c.nsets < G.minSets - 3)) reform(c, 'era');
  else if (G.fam === 'tribal' && c.era >= 1 && rng.chance(0.04)) reform(c, 'era');
  else if (c.stability < 0.3 && rng.chance(0.02)) reform(c, 'revolution');
  else if (rng.chance(0.003)) reform(c, 'reform');
  else if (S.GOVS[c.gov].fam === 'mon' && c.gov !== 'empire' && c.nsets >= 10 && c.era <= 4 && rng.chance(0.02)) reform(c, 'empire');
  // colonisation
  if (c.nsets < MAXSETS[c.era] && !c._sets.every(s => s.occupier)) {
    const pressure = U.clamp(c.pop / (c.nsets * [25, 120, 300, 600, 1500, 3000][c.era]), 0.2, 2);
    if (rng.chance(0.045 * c.traits.exp * (1 + c.era * 0.2) * pressure)) colonize(c);
  }
  // random fortunes
  if (rng.chance(c.era <= 3 ? 0.0016 : 0.0005) && c.pop > 200) {
    const f = rng.range(0.6, 0.85); let lost = 0; for (const s of c._sets) { lost += s.pop * (1 - f); s.pop *= f; }
    c.stability -= 0.1;
    S.event(`A great plague struck ${S.the(c.name)}, killing ${U.fmt(lost)} people`, { k: 'disaster', c: [c.id], imp: true, x: c.cx, yy: c.cy });
  } else if (rng.chance(0.001) && c.pop > 100) {
    for (const s of c._sets) s.pop *= 0.88; S.event(`Famine swept through ${S.the(c.name)}`, { k: 'disaster', c: [c.id] });
  } else if (rng.chance(0.0018) && c.golden <= y && c.stability > 0.5) {
    c.golden = y + 30; c.stability = Math.min(1, c.stability + 0.1);
    S.event(`${S.The(c.name)} entered a golden age`, { k: 'golden', c: [c.id], imp: true, x: c.cx, yy: c.cy });
  }
  // official language drift
  if ((y + c.id) % 25 === 0) {
    const tot = {}; for (const s of c._sets) for (const k in s.langs) tot[k] = (tot[k] || 0) + s.langs[k] * s.pop;
    let best = c.lang, bv = tot[c.lang] || 0; for (const k in tot) if (tot[k] > bv) { bv = tot[k]; best = +k; }
    if (best !== c.lang && (tot[c.lang] || 0) < 0.3 * c.pop && bv > 0.5 * c.pop) {
      const ol = st.langs.get(c.lang), nl = st.langs.get(best); c.lang = best;
      S.event(`${S.The(c.name)} adopted ${nl.name} as its official language, replacing ${ol.name}`, { k: 'lang', c: [c.id], imp: true });
    }
  }
  // economy
  const pc = (0.4 + Math.pow(c.tech, 1.6) * 0.5) * (1 + 0.08 * Math.min(trade, 6)) * (0.5 + 0.5 * c.stability);
  c.gdp = c.pop * pc; c.dev = Math.round(U.clamp(pc / 13.6 * 100, 1, 100));
  // peaks
  const P = c.peak;
  if (c.pop > P.pop) { P.pop = c.pop; P.popY = y; }
  if (c.area > P.area) { P.area = c.area; P.areaY = y; }
  if (c.army > P.army) { P.army = c.army; P.armyY = y; }
  if (c.nsets > P.sets) { P.sets = c.nsets; P.setsY = y; }
}
function onEra(c) {
  const sets = countrySets(c);
  if (c.era === 4) for (const s of sets) { if (s.walls) { for (const i of s.tiles) if (st.bld[i] === BLD.WALL) setBld(i, 0); s.walls = false; } }
  if (c.era >= 1) for (const s of sets) if (!s.linked) linkSettlement(s, c);
  for (const rd of c.roads) { for (const i of rd.t) if (st.road[i] && st.roadEra[i] < c.era) setRoad(i, st.road[i], c.era); if (c.era >= 4 && !rd.rail) layRail(rd, c); }
  for (const s of sets) for (const i of s.tiles) if (st.road[i] === 1) st.roadEra[i] = c.era;
  hook('era', c);
}
function colonize(c) {
  const w = st.world, rng = st.rng, W = w.W;
  const src = rng.wpick(c._sets, c._sets.map(s => s.occupier ? 0 : Math.sqrt(s.pop)));
  if (!src || src.pop < 25) return;
  const overseas = c.era >= 3 && src.port >= 0 && rng.chance(0.3);
  let best = null, bs = -99;
  for (let k = 0; k < 30; k++) {
    const a = rng.range(0, 6.283), d = overseas ? rng.range(15, 80) : rng.range(6, 12 + c.era * 2);
    const x = Math.round(src.x + Math.cos(a) * d), y = Math.round(src.y + Math.sin(a) * d);
    if (x < 1 || y < 1 || x >= W - 1 || y >= w.H - 1) continue;
    const i = y * W + x;
    if (!T.isLand(w, i) || !T.buildable(w, i)) continue;
    if (overseas && w.coast[i] > 2) continue;
    const r = st.region[i];
    if (r) { const o = st.sets.get(r); if (!o || o.country !== c.id) continue; }
    if (S.nearCenter(x, y, 6)) continue;
    const h = T.habit(w, i); if (h < 0.45) continue;
    const sc = h + T.food(w, i) * 0.3 - d * 0.01 + (r ? 0 : 0.3) + rng.next() * 0.2;
    if (sc > bs) { bs = sc; best = [x, y]; }
  }
  if (!best) return;
  const pop = Math.min(src.pop * 0.15, 40) + 5; src.pop -= pop * 0.8;
  const s = S.found(best[0], best[1], c.id, src.langs, pop);
  S.event(`${S.The(c.name)} founded the ${overseas ? 'overseas colony' : 'settlement'} of ${s.name}`, { k: 'set', c: [c.id], x: s.x, yy: s.y, imp: overseas });
  if (c.era >= 1) linkSettlement(s, c);
}

// ---------- diplomacy ----------
function strength(ids) { let s = 0; for (const id of ids) { const c = S.C(id); if (c && c.fallen == null) s += c.army * (1 + c.tech * 0.5) * (0.5 + c.stability); } return s; }
function diplomacy() {
  const rng = st.rng, live = st.live, y = Math.floor(st.year);
  const fam = new Map(); for (const c of live) fam.set(c.id, L.family(st, st.langs.get(c.lang)));
  for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
    const A = live[a], B = live[b];
    if (A.fallen != null || B.fallen != null) continue;
    const border = S.border(A.id, B.id);
    const dist = Math.hypot(A.cx - B.cx, A.cy - B.cy);
    let r = S.relGet(A.id, B.id);
    const known = border > 0 || dist < 40 + Math.max(A.era, B.era) * 15 || (A.era >= 3 && B.era >= 3 && A.ports && B.ports);
    if (!known && (!r || r.s === 'neutral')) continue;
    if (!r) r = S.rel(A.id, B.id);
    const fa = fam.get(A.id), fb = fam.get(B.id);
    let target = 0;
    if (fa === fb) target += 20;
    if (r.trade) target += 15;
    if (r.s === 'allied') target += 25;
    target -= Math.min(35, border * 0.4);
    if (S.GOVS[A.gov] && S.GOVS[B.gov] && S.GOVS[A.gov].fam === S.GOVS[B.gov].fam) target += 8;
    if (r.s === 'war') target -= 70;
    r.op = U.clamp(r.op + (target - r.op) * 0.04 + rng.gauss() * 4, -100, 100);
    if (r.s === 'war') continue;
    if (r.s === 'truce') { if (y >= r.truce) setStatus(A.id, B.id, 'neutral'); else continue; }
    if (r.s === 'allied') {
      if (r.op < 15 && rng.chance(0.2)) { setStatus(A.id, B.id, 'neutral'); S.event(`The alliance between ${S.the(A.name)} and ${S.the(B.name)} was dissolved`, { k: 'dip', c: [A.id, B.id], imp: true }); }
      continue;
    }
    const ns = r.op > 35 ? 'friendly' : r.op < -35 ? 'rival' : 'neutral';
    if (ns !== r.s) { if (ns === 'rival') S.event(`${S.The(A.name)} and ${S.the(B.name)} became rivals`, { k: 'dip', c: [A.id, B.id] }); setStatus(A.id, B.id, ns); }
    if (r.s === 'friendly' && r.op > 55 && rng.chance(0.02)) { setStatus(A.id, B.id, 'allied'); S.event(`${S.The(A.name)} formed an alliance with ${S.the(B.name)}`, { k: 'dip', c: [A.id, B.id], imp: true, x: A.cx, yy: A.cy }); continue; }
    if (!r.trade && r.op > 10 && (border > 0 || (A.ports && B.ports && A.era >= 1 && B.era >= 1)) && rng.chance(0.03)) { r.trade = true; S.event(`${S.The(A.name)} established trade relations with ${S.the(B.name)}`, { k: 'trade', c: [A.id, B.id] }); }
    else if (r.trade && r.op < -35) { r.trade = false; S.event(`Trade between ${S.the(A.name)} and ${S.the(B.name)} collapsed`, { k: 'trade', c: [A.id, B.id] }); }
    if (border > 0) {
      const sa = strength([A.id]), sb = strength([B.id]);
      const [att, def, ratio] = sa >= sb ? [A, B, sa / (sb + 1)] : [B, A, sb / (sa + 1)];
      if ((r.s === 'rival' && r.op < -40 && rng.chance(0.025 * att.traits.agg)) || (r.s === 'neutral' && ratio > 2.5 && rng.chance(0.004 * att.traits.agg))) {
        if (S.warsOf(att.id).length < 2) declareWar(att, def, 'conquest');
      }
    }
  }
}
function declareWar(a, b, type) {
  if (a.id === b.id || S.status(a.id, b.id) === 'war') return null;
  const rng = st.rng; const y = Math.floor(st.year);
  const war = { id: st.ids.w++, name: '', att: [a.id], def: [b.id], start: y, end: null, score: 0, years: 0, type, outcome: '' };
  war.name = type === 'independence' ? `${a.adj} War of Independence` : `${a.adj}–${b.adj} War`;
  if (S.allies(a.id).includes(b.id)) setStatus(a.id, b.id, 'neutral');
  for (const al of S.allies(b.id)) if (al !== a.id && !war.def.includes(al) && S.status(al, a.id) !== 'war' && rng.chance(0.75)) war.def.push(al);
  for (const al of S.allies(a.id)) if (al !== b.id && !war.def.includes(al) && !war.att.includes(al) && !war.def.some(d => S.status(al, d) === 'allied') && rng.chance(0.45)) war.att.push(al);
  for (const x of war.att) for (const z of war.def) { const r = setStatus(x, z, 'war'); r.trade = false; r.op = Math.min(r.op, -50); }
  st.wars.set(war.id, war);
  const joined = war.att.length + war.def.length > 2 ? ` (${war.att.length + war.def.length} nations involved)` : '';
  const all = war.att.concat(war.def);
  S.event(type === 'independence' ? `${S.The(a.name)} rose up against ${S.the(b.name)}: the ${war.name} began` : `${S.The(a.name)} declared war on ${S.the(b.name)}${joined}`, { k: 'war', c: all, imp: true, x: b.cx, yy: b.cy });
  return war;
}
S.declareWar = declareWar;
function warScore(war) {
  const at = new Set(war.att), df = new Set(war.def);
  let dT = 0, dO = 0, aT = 0, aO = 0;
  for (const s of st.liveSets) {
    const v = (s.pop + 5) * (s.capital ? 2 : 1);
    if (df.has(s.country)) { dT += v; if (at.has(s.occupier)) dO += v; }
    else if (at.has(s.country)) { aT += v; if (df.has(s.occupier)) aO += v; }
  }
  return Math.round(100 * ((dT ? dO / dT : 0) - (aT ? aO / aT : 0)));
}
function occupyStep(win, lose) {
  const rng = st.rng; const wI = new Set(win), lI = new Set(lose);
  const ctrl = (s) => s.occupier || s.country;
  const adjCtrl = (s) => { const nb = st.adjSet.get(s.id); if (!nb) return 0; for (const id of nb) { const o = st.sets.get(id); if (o && o.ruined == null && wI.has(ctrl(o))) return ctrl(o); } return 0; };
  const lib = st.liveSets.filter(s => wI.has(s.country) && lI.has(s.occupier));
  if (lib.length && rng.chance(0.55)) { const s = rng.pick(lib); S.setControl(s, s.country, 0); return; }
  const cands = [];
  for (const s of st.liveSets) {
    if (!lI.has(s.country) || s.occupier) continue;
    const oc = adjCtrl(s); if (oc) cands.push([s, oc]);
  }
  if (!cands.length && rng.chance(0.25)) {
    const navy = win.map(S.C).filter(c => c && c.fallen == null && c.ports && c.era >= 2);
    if (navy.length) for (const s of st.liveSets) if (lI.has(s.country) && !s.occupier && s.coastal) cands.push([s, navy[0].id]);
  }
  if (!cands.length) return;
  const [s, oc] = rng.wpick(cands, cands.map(([s]) => 1 / Math.sqrt(s.pop + 10) * (s.capital ? 0.5 : 1)));
  S.setControl(s, s.country, oc);
  const lc = S.C(s.country);
  if (s.capital) { lc.stability -= 0.1; S.event(`${S.The(S.C(oc).name)} captured ${s.name}, the capital of ${S.the(lc.name)}`, { k: 'war', c: [oc, lc.id], imp: true, x: s.x, yy: s.y }); }
}
function tickWar(war) {
  const rng = st.rng;
  war.att = war.att.filter(id => { const c = S.C(id); return c && c.fallen == null; });
  war.def = war.def.filter(id => { const c = S.C(id); return c && c.fallen == null; });
  if (!war.att.length || !war.def.length) { endWar(war, war.att.length ? 'the defenders ceased to exist' : 'the attackers ceased to exist'); return; }
  const sA = strength(war.att), sD = strength(war.def);
  const pa = U.clamp(sA / (sA + sD + 1e-6), 0.08, 0.92);
  const attempts = 1 + (rng.chance(0.6) ? 1 : 0) + (rng.chance(0.3) ? 1 : 0);
  for (let k = 0; k < attempts; k++) { if (rng.next() < pa) occupyStep(war.att, war.def); else occupyStep(war.def, war.att); }
  for (const id of war.att.concat(war.def)) { const c = S.C(id); c.armyF = Math.max(0.15, c.armyF * rng.range(0.86, 0.95)); c.stability = Math.max(0.02, c.stability - 0.01); }
  for (const s of st.liveSets) if (s.occupier && (war.att.includes(s.occupier) || war.def.includes(s.occupier))) s.pop *= 0.985;
  war.years++;
  war.score = warScore(war);
  if (war.score >= 75 || war.score <= -60 || (war.years > 4 && rng.chance(0.07 + war.years * 0.012))) S.makePeace(war);
}
function endWar(war, outcome) {
  war.end = Math.floor(st.year); war.outcome = outcome;
  for (const x of war.att) for (const z of war.def) { const r = S.relGet(x, z); if (r && r.s === 'war') { r.s = 'truce'; r.truce = Math.floor(st.year) + 20; r.since = war.end; } }
  // return occupations between the sides
  for (const s of st.liveSets) {
    if (s.occupier && ((war.att.includes(s.occupier) && war.def.includes(s.country)) || (war.def.includes(s.occupier) && war.att.includes(s.country)))) S.setControl(s, s.country, 0);
  }
  S.event(`The ${war.name} ended: ${outcome}`, { k: 'peace', c: war.att.concat(war.def), imp: true });
}
S.makePeace = (war) => {
  const rng = st.rng; const score = war.score;
  const A = S.C(war.att[0]), D = S.C(war.def[0]);
  const at = new Set(war.att), df = new Set(war.def);
  const occByA = st.liveSets.filter(s => df.has(s.country) && at.has(s.occupier));
  const occByD = st.liveSets.filter(s => at.has(s.country) && df.has(s.occupier));
  const ownAdj = (s) => { const nb = st.adjSet.get(s.id) || []; return nb.some(id => { const o = st.sets.get(id); return o && o.country === s.occupier && !o.occupier; }); };
  let outcome = '';
  const annexAll = (list) => { const fellBy = {}; for (const s of list) { const oc = s.occupier; S.annex(s, oc); } };
  const ret = (list) => { for (const s of list) if (s.ruined == null) S.setControl(s, s.country, 0); };
  if (war.type === 'independence') {
    if (score >= -15) { annexAll(occByA); ret(occByD); outcome = `${S.the(A.name)} secured its independence`; }
    else {
      ret(occByA);
      const rebels = countrySets(A); A._final = S.snapBorders(A, 'Final borders');
      for (const s of rebels) S.setControl(s, D.id, 0);
      outcome = `the rebellion was crushed and ${S.the(A.name)} was reabsorbed into ${S.the(D.name)}`;
      if (A.fallen == null) S.fall(A, `reconquered by ${S.the(D.name)}`, D.id);
    }
  } else if (score >= 70) { const n = occByA.length; annexAll(occByA); outcome = `decisive victory for ${S.the(A.name)}, which annexed ${n} settlement${n === 1 ? '' : 's'}`; }
  else if (score >= 25) { const take = occByA.filter(ownAdj); annexAll(take); ret(occByA.filter(s => !take.includes(s))); ret(occByD); outcome = take.length ? `${S.the(A.name)} annexed ${take.map(s => s.name).slice(0, 3).join(', ')}${take.length > 3 ? '…' : ''}` : 'a negotiated peace restored the old borders'; }
  else if (score <= -50) {
    annexAll(occByD); ret(occByA);
    outcome = `crushing defeat for ${S.the(A.name)}`;
    if (A.fallen == null && rng.chance(0.4)) { const g = rebelGroup(A); if (g && g.length) { const nc = S.independence(g, { war: false, quiet: true }); if (nc) outcome += `, and ${S.the(nc.name)} was released as an independent state`; } }
  } else if (score <= -25) { const take = occByD.filter(ownAdj); annexAll(take); ret(occByD.filter(s => !take.includes(s))); ret(occByA); outcome = take.length ? `${S.the(D.name)} annexed ${take.map(s => s.name).slice(0, 3).join(', ')}` : 'white peace'; }
  else { ret(occByA); ret(occByD); outcome = 'white peace; pre-war borders were restored'; }
  endWar(war, outcome);
};
function rebelGroup(c) {
  const rng = st.rng; const sets = countrySets(c).filter(s => !s.capital && !s.occupier);
  if (!sets.length) return null;
  const cap = st.sets.get(c.capital) || sets[0];
  sets.sort((a, b) => Math.hypot(b.x - cap.x, b.y - cap.y) - Math.hypot(a.x - cap.x, a.y - cap.y));
  const top = sets.slice(0, Math.max(1, Math.ceil(sets.length * 0.4)));
  const foreign = top.filter(s => s.dom !== c.lang);
  const seed = foreign.length ? rng.pick(foreign) : rng.pick(top);
  const max = Math.max(1, Math.floor(countrySets(c).length * 0.4));
  const grp = [seed], seen = new Set([seed.id]);
  for (let g = 0; g < grp.length && grp.length < max; g++) {
    for (const id of st.adjSet.get(grp[g].id) || []) {
      const o = st.sets.get(id);
      if (!o || seen.has(id) || o.ruined != null || o.country !== c.id || o.capital || o.occupier) continue;
      seen.add(id);
      if (o.dom === seed.dom || rng.chance(0.3)) { grp.push(o); if (grp.length >= max) break; }
    }
  }
  return grp;
}
S.independence = (sets, o) => {
  o = o || {}; sets = sets.filter(s => s && s.ruined == null);
  if (!sets.length) return null;
  const rng = st.rng; let big = sets[0]; for (const s of sets) if (s.pop > big.pop) big = s;
  const parent = S.C(big.country);
  if (countrySets(parent).length <= sets.length) return null; // can't release everything
  const nc = S.newCountry({ lang: big.dom || parent.lang, tech: parent.tech * 0.97, parent: parent.id, gov: pickGov(parent.era, sets.length, null) });
  nc.stability = 0.65;
  for (const s of sets) { S.setControl(s, nc.id, 0); }
  for (const s of countrySets(nc)) s.capital = false;
  big.capital = true; nc.capital = big.id; nc.cx = big.x; nc.cy = big.y;
  const r = S.rel(nc.id, parent.id); r.op = o.war ? -70 : 10;
  if (!o.quiet) S.event(o.collapse ? `${S.The(nc.name)} emerged from the collapse of ${S.the(parent.name)}` : o.war ? `${S.The(nc.name)} declared independence from ${S.the(parent.name)}` : `${S.The(nc.name)} peacefully separated from ${S.the(parent.name)}`, { k: 'indep', c: [nc.id, parent.id], imp: true, x: big.x, yy: big.y });
  if (o.war) declareWar(nc, parent, 'independence');
  aggregateOne(nc); aggregateOne(parent);
  return nc;
};
function aggregateOne(c) { c._sets = countrySets(c); c.nsets = c._sets.length; c.pop = 0; c.area = 0; for (const s of c._sets) { c.pop += s.pop; c.area += s.tiles.length; } }
S.unite = (a, b, why) => {
  if (!a || !b || a === b || a.fallen != null || b.fallen != null) return;
  for (const w of S.warsOf(b.id)) { if (w.att.includes(a.id) || w.def.includes(a.id)) endWar(w, 'the two nations were united'); }
  b._final = S.snapBorders(b, 'Final borders');
  const big = b.nsets >= a.nsets * 0.5;
  for (const s of countrySets(b)) S.setControl(s, a.id, 0);
  if (b.fallen == null) S.fall(b, `united with ${S.the(a.name)}`, a.id);
  if (big && !/^United /.test(a.name) && st.rng.chance(0.5)) rename(a, 'United ' + a.name);
  S.event(`${S.The(b.name)} was united with ${S.the(a.name)}${why ? ' ' + why : ''}`, { k: 'unite', c: [a.id, b.id], imp: true, x: a.cx, yy: a.cy });
};
function collapse(c) {
  const sets = countrySets(c); if (sets.length < 5) return;
  const k = Math.min(4, Math.max(2, Math.floor(sets.length / 4)));
  const cap = st.sets.get(c.capital) || sets[0];
  const seeds = [cap];
  while (seeds.length < k) { let best = null, bd = -1; for (const s of sets) { const d = Math.min(...seeds.map(z => Math.hypot(z.x - s.x, z.y - s.y))); if (d > bd) { bd = d; best = s; } } if (!best || bd < 4) break; seeds.push(best); }
  const groups = seeds.map(() => []);
  for (const s of sets) { let bi = 0, bd = 1e9; seeds.forEach((z, i) => { const d = Math.hypot(z.x - s.x, z.y - s.y); if (d < bd) { bd = d; bi = i; } }); groups[bi].push(s); }
  const names = [];
  for (let i = 1; i < groups.length; i++) if (groups[i].length) { const nc = S.independence(groups[i], { war: false, collapse: true, quiet: true }); if (nc) names.push(nc.name); }
  c.stability = 0.5;
  if (names.length) S.event(`${S.The(c.name)} collapsed! ${names.length} successor state${names.length > 1 ? 's' : ''} emerged: ${names.join(', ')}`, { k: 'collapse', c: [c.id], imp: true, x: c.cx, yy: c.cy });
}
function politics() {
  const rng = st.rng; const y = Math.floor(st.year);
  for (const c of st.live.slice()) {
    if (c.fallen != null || c.nsets < 3) continue;
    const war = atWarAny(c);
    if (c.stability < 0.15 && c.nsets >= 6 && rng.chance(0.06)) { collapse(c); continue; }
    const p = 0.0004 + (1 - c.stability) * 0.005 + (1 - (c.offShare == null ? 1 : c.offShare)) * 0.006 + Math.max(0, c.nsets - GOVCAP[c.era]) * 0.0005;
    if (c.nsets >= 5 && rng.chance(p)) {
      const g = rebelGroup(c);
      if (g && g.length) S.independence(g, { war: !war && c.stability < 0.45 && rng.chance(0.65) });
    }
  }
  if (y % 5 === 0) for (const c of st.live) {
    if (c.fallen != null) continue;
    for (const nb of S.neighbors(c.id)) {
      const o = S.C(nb); if (!o || o.fallen != null || o.id < c.id) continue;
      const r = S.relGet(c.id, o.id); if (!r || (r.s !== 'allied' && r.s !== 'friendly') || r.op < 45) continue;
      const fa = L.family(st, st.langs.get(c.lang)), fb = L.family(st, st.langs.get(o.lang));
      if (fa !== fb || c.stability < 0.5 || o.stability < 0.5 || S.warsOf(c.id).length || S.warsOf(o.id).length) continue;
      if (rng.chance(0.06)) { const [big, small] = c.pop >= o.pop ? [c, o] : [o, c]; S.unite(big, small, 'in a peaceful union'); break; }
    }
  }
}
S.fall = (c, reason, by) => {
  if (c.fallen != null) return;
  const y = Math.floor(st.year);
  c.fallen = y; c.fallReason = reason;
  c.names[c.names.length - 1].to = y; c.flags[c.flags.length - 1].to = y; c.govs[c.govs.length - 1].to = y;
  if (c._final) { c.borders.push(c._final); c._final = null; }
  for (const w of st.wars.values()) if (w.end == null) {
    w.att = w.att.filter(id => id !== c.id); w.def = w.def.filter(id => id !== c.id);
    if (!w.att.length || !w.def.length) endWar(w, `${S.the(c.name)} ceased to exist`);
  }
  for (const k of Array.from(st.rel.keys())) { const a = Math.floor(k / 65536), b = k % 65536; if (a === c.id || b === c.id) st.rel.delete(k); }
  st._relIdx = null;
  st.live = st.live.filter(o => o !== c);
  S.event(`${S.The(c.name)} has fallen: ${reason}`, { k: 'fall', c: [c.id].concat(by ? [by] : []), imp: true, x: c.cx, yy: c.cy });
  st.ownVer++;
};

// ---------- languages over time ----------
function langEvolution() {
  const rng = st.rng; const y = Math.floor(st.year);
  for (const c of st.live) {
    const Lg = st.langs.get(c.lang); if (!Lg) continue;
    if (!Lg.home || Lg.home === c.id) { Lg.home = c.id; continue; }
    const hc = S.C(Lg.home);
    if (!hc || hc.fallen != null || hc.lang !== Lg.id) { Lg.home = c.id; continue; }
    c.langSep[Lg.id] = (c.langSep[Lg.id] || 0) + 10;
    if (c.langSep[Lg.id] >= 220 + (U.hash2(c.id, Lg.id, 5) % 200) && (Math.hypot(c.cx - hc.cx, c.cy - hc.cy) > 18 || !S.border(c.id, hc.id))) {
      const dx = c.cx - hc.cx, dy = c.cy - hc.cy;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'Eastern' : 'Western') : (dy > 0 ? 'Southern' : 'Northern');
      const d = L.dialect(st, rng, Lg, rng.chance(0.25) ? c.adj : dir); d.home = c.id;
      for (const s of countrySets(c)) if (s.langs[Lg.id]) { s.langs[d.id] = (s.langs[d.id] || 0) + s.langs[Lg.id]; delete s.langs[Lg.id]; normLangs(s); }
      c.lang = d.id; delete c.langSep[Lg.id];
      S.event(`${Lg.name} as spoken in ${S.the(c.name)} became a distinct dialect: ${d.name}`, { k: 'lang', c: [c.id] });
    }
  }
  for (const lg of st.langs.values()) {
    if (lg.extinct != null || !lg.dialect) continue;
    if (y - lg.born > 200 + (U.hash2(lg.id, 3, 9) % 200) && rng.chance(0.2)) {
      const old = L.mature(st, rng, lg);
      const hc = S.C(lg.home);
      S.event(`The ${old} dialect evolved into a separate language: ${lg.name}`, { k: 'lang', c: hc ? [hc.id] : [], imp: true });
    }
  }
  if (y % 50 === 0) {
    const sp = S.speakers();
    for (const lg of st.langs.values()) if (lg.extinct == null && !(sp.get(lg.id) > 0) && y - lg.born > 20 && !st.bands.some(b => b.lang === lg.id)) { lg.extinct = y; S.event(`The ${lg.name} language died out`, { k: 'lang' }); }
  }
}
S.speakers = () => { const m = new Map(); for (const s of st.liveSets) for (const k in s.langs) m.set(+k, (m.get(+k) || 0) + s.langs[k] * s.pop); return m; };

// ---------- recording ----------
S.snapBorders = (c, label) => {
  const W = st.world.W; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; const tiles = [];
  let area = 0;
  for (const s of st.liveSets) if (s.country === c.id) for (const i of s.tiles) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; tiles.push(i); area++; }
  if (!tiles.length) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1; const m = new Uint8Array(bw * bh);
  for (const i of tiles) m[((i / W | 0) - y0) * bw + (i % W - x0)] = 1;
  return { y: Math.floor(st.year), label, bb: [x0, y0, bw, bh], r: U.rleN(m), area, pop: Math.round(c.pop) };
};
function record() {
  const y = Math.floor(st.year);
  let tp = 0, ta = 0;
  for (const c of st.live) {
    c.stats.push([y, Math.round(c.pop), c.army, c.area, c.nsets, +c.tech.toFixed(2), Math.round(c.gdp), c.dev]);
    tp += c.pop; ta += c.army;
    if (c.area <= 0) continue;
    if (!c.borders.length && y - c.founded >= 5) { const b = S.snapBorders(c, 'Founding territory'); if (b) { c.borders.push(b); c.lastSnap = { y, area: c.area }; } }
    else if (y - c.lastSnap.y >= 50) {
      const ch = (c.area - c.lastSnap.area) / Math.max(1, c.lastSnap.area);
      if (Math.abs(ch) > 0.2 || y - c.lastSnap.y >= 200) { const b = S.snapBorders(c, ch > 0.2 ? 'Territorial expansion' : ch < -0.2 ? 'Territorial decline' : 'Borders'); if (b) { c.borders.push(b); c.lastSnap = { y, area: c.area }; } }
    }
    if (c.area >= 6 && (!c.maxB || c.area > c.maxB.area * 1.06)) c.maxB = S.snapBorders(c, 'Largest historical extent');
  }
  const sp = S.speakers(); let nl = 0; for (const v of sp.values()) if (v > 0) nl++;
  st.wstats.push([y, Math.round(tp), st.live.length, st.liveSets.length, nl, ta, Array.from(st.wars.values()).filter(w => w.end == null).length]);
  if (PW.H && st.hist) PW.H.record(st);
}
S.forceRecord = () => { if (PW.H && st.hist) PW.H.record(st); };

// ---------- the yearly tick ----------
S.tick = () => {
  st.year++;
  if (st.adjDirty) computeAdj();
  aggregate();
  computeCountryAdj();
  for (const s of st.liveSets.slice()) if (s.ruined == null) tickSettlement(s);
  for (const b of st.bands.slice()) tickBand(b);
  aggregate();
  for (const c of st.live.slice()) tickCountry(c);
  diplomacy();
  for (const w of Array.from(st.wars.values())) if (w.end == null) tickWar(w);
  politics();
  if (st.year % 10 === 5) langEvolution();
  if (st.year % 10 === 0) { aggregate(); record(); }
};

// ---------- terrain edits affecting civilisation ----------
S.onTerrainEdit = (list) => {
  if (!st) return;
  const w = st.world; const killed = new Set();
  for (const i of list) {
    const land = T.isLand(w, i);
    if (!land) {
      if (st.region[i]) { const s = st.sets.get(st.region[i]); if (s && s.x + s.y * w.W === i) killed.add(s); unclaim(i); }
      if (st.bld[i]) setBld(i, 0);
      if (st.road[i] && !w.fresh[i]) setRoad(i, 0, 0);
      if (st.rail[i]) st.rail[i] = 0;
    } else if (st.bld[i] && !T.buildable(w, i) && st.bld[i] !== BLD.CENTER) setBld(i, 0);
  }
  for (const s of killed) S.destroySet(s, 'swallowed by the sea');
  for (const s of st.liveSets) if (s.tiles.length && list.length > 0) { /* food recalculated lazily */ }
  const touched = new Set(); for (const i of list) if (st.region[i]) touched.add(st.region[i]);
  for (const id of touched) { const s = st.sets.get(id); if (s) { s.food = 0; for (const i of s.tiles) s.food += T.food(w, i); } }
  st.ownVer++;
};

// ---------- player actions ----------
S.act = {
  war: (a, b) => { const A = S.C(a), B = S.C(b); if (!A || !B || a === b) return 'Pick two different countries.'; if (S.status(a, b) === 'war') return 'They are already at war.'; if (S.allies(a).includes(b)) setStatus(a, b, 'neutral'); const r = S.rel(a, b); r.s = 'neutral'; const w = declareWar(A, B, 'conquest'); return w ? `${S.The(A.name)} declared war on ${S.the(B.name)}.` : 'War could not be declared.'; },
  peace: (a, b) => { for (const w of st.wars.values()) if (w.end == null && ((w.att.includes(a) && w.def.includes(b)) || (w.att.includes(b) && w.def.includes(a)))) { w.score = warScore(w); S.makePeace(w); return `Peace was signed: ${w.outcome}.`; } return 'These countries are not at war.'; },
  ally: (a, b) => { if (a === b) return 'Pick two different countries.'; if (S.status(a, b) === 'war') S.act.peace(a, b); const r = setStatus(a, b, 'allied'); r.op = Math.max(r.op, 65); S.event(`${S.The(S.C(a).name)} formed an alliance with ${S.the(S.C(b).name)}`, { k: 'dip', c: [a, b], imp: true }); return 'Alliance formed.'; },
  breakAlly: (a, b) => { if (S.status(a, b) !== 'allied') return 'They are not allied.'; const r = setStatus(a, b, 'neutral'); r.op -= 25; S.event(`The alliance between ${S.the(S.C(a).name)} and ${S.the(S.C(b).name)} was broken`, { k: 'dip', c: [a, b], imp: true }); return 'Alliance broken.'; },
  improve: (a, b) => { const r = S.rel(a, b); r.op = Math.min(100, r.op + 25); if (r.s === 'rival' && r.op > -35) r.s = 'neutral'; else if (r.s === 'neutral' && r.op > 35) r.s = 'friendly'; return `Relations improved (opinion ${Math.round(r.op)}).`; },
  worsen: (a, b) => { const r = S.rel(a, b); r.op = Math.max(-100, r.op - 25); if (r.s === 'friendly' && r.op < 35) r.s = 'neutral'; else if (r.s === 'neutral' && r.op < -35) { r.s = 'rival'; S.event(`${S.The(S.C(a).name)} and ${S.the(S.C(b).name)} became rivals`, { k: 'dip', c: [a, b] }); } return `Relations worsened (opinion ${Math.round(r.op)}).`; },
  transfer: (sid, to) => { const s = st.sets.get(sid), C2 = S.C(to); if (!s || !C2 || s.ruined != null) return 'Invalid region.'; if (s.country === to) return 'That region already belongs to this country.'; const from = S.C(s.country); S.annex(s, to, `its last region was transferred to ${S.the(C2.name)}`); S.event(`${s.name} was transferred from ${S.the(from.name)} to ${S.the(C2.name)}`, { k: 'transfer', c: [from.id, to], imp: true, x: s.x, yy: s.y }); aggregate(); return `${s.name} now belongs to ${S.the(C2.name)}.`; },
  unite: (a, b) => { const A = S.C(a), B = S.C(b); if (!A || !B || a === b) return 'Pick two different countries.'; S.unite(A, B, 'by decree'); aggregate(); return `${S.The(B.name)} was united into ${S.the(A.name)}.`; },
  independence: (sid) => { const s = st.sets.get(sid); if (!s || s.ruined != null) return 'Invalid region.'; const c = S.C(s.country); if (countrySets(c).length <= 1) return 'A country cannot be granted independence from itself.'; if (s.occupier) S.setControl(s, s.country, 0); const nc = S.independence([s], { war: false }); aggregate(); return nc ? `${S.The(nc.name)} is now independent.` : 'Could not grant independence.'; },
};

// a cosmetic resident for the renderer (deterministic per settlement + slot)
S.resident = (s, slot) => {
  const rng = new U.RNG(U.hash2(s.id, slot, Math.floor(st.year / 40)) + 1);
  const keys = Object.keys(s.langs); const lid = +rng.wpick(keys, keys.map(k => s.langs[k])) || s.dom;
  const lang = st.langs.get(lid) || st.langs.get(S.C(s.country).lang);
  const c = S.C(s.country);
  const sex = rng.int(0, 1); const [g, f] = L.personName(lang, rng, sex);
  const age = rng.int(4, 78);
  const occ = age < 15 ? 'Child' : age > 66 ? 'Elder' : rng.pick(S.OCC[c.era]);
  return { g, f, sex, age, occ, lang: lang.name, nat: c.name, home: s.name };
};
})();
