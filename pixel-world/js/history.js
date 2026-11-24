// Pixel World — world history snapshots (RLE keyframes + incremental diffs) and reconstruction for timelapse.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const H = PW.H = {};
H.KEY = 20; // keyframe interval (in snapshots)

H.create = (st) => ({ snaps: [], lastReg: new Uint16Array(st.world.N), lastRoad: new Uint8Array(st.world.N), cur: null });
function roadLayer(st) { const N = st.world.N, a = new Uint8Array(N); for (let i = 0; i < N; i++) a[i] = st.road[i] | (st.rail[i] << 2); return a; }
H.record = (st) => {
  const h = st.hist; const k = h.snaps.length; const key = k % H.KEY === 0;
  const road = roadLayer(st);
  const snap = {
    y: Math.floor(st.year), key,
    reg: key ? U.rleN(st.region) : U.diff(h.lastReg, st.region),
    road: key ? U.rleN(road) : U.diff(h.lastRoad, road),
    sets: [], cty: [],
  };
  for (const s of st.liveSets) if (s.ruined == null) snap.sets.push([s.id, s.country, s.occupier, Math.round(s.pop), s.dom]);
  for (const c of st.live) snap.cty.push([c.id, c.names.length - 1, c.flags.length - 1, c.colors.length - 1, Math.round(c.tech * 10)]);
  h.snaps.push(snap); h.lastReg.set(st.region); h.lastRoad.set(road);
};
H.reconstruct = (st, k) => {
  const h = st.hist, N = st.world.N;
  const kf = k - (k % H.KEY);
  if (!h.cur || h.cur.k > k || h.cur.k < kf) h.cur = { k: kf, reg: U.unrleN(h.snaps[kf].reg, N, Uint16Array), road: U.unrleN(h.snaps[kf].road, N, Uint8Array) };
  while (h.cur.k < k) { h.cur.k++; const s = h.snaps[h.cur.k]; U.applyDiff(h.cur.reg, s.reg); U.applyDiff(h.cur.road, s.road); }
  return h.cur;
};
// a renderer-friendly view of snapshot k
H.view = (st, k) => {
  const snap = st.hist.snaps[k]; if (!snap) return null;
  const cur = H.reconstruct(st, k);
  const sets = new Map(), cty = new Map();
  for (const [id, c, occ, pop, dom] of snap.sets) { const s = st.sets.get(id); if (!s) continue; sets.set(id, { id, country: c, occupier: occ, pop, dom, x: s.x, y: s.y, name: s.name, tier: PW.S.tierOf(pop), capital: false, area: 0 }); }
  for (const [id, ni, fi, ci, tech] of snap.cty) {
    const c = st.countries.get(id); if (!c) continue;
    cty.set(id, { id, name: (c.names[ni] || c.names[0]).n, flag: (c.flags[fi] || c.flags[0]).f, color: (c.colors[ci] || c.colors[0]).c, tech: (tech || 0) / 10, era: Math.min(5, Math.floor((tech || 0) / 10)), lang: c.lang });
  }
  const R = cur.reg; for (let i = 0; i < R.length; i++) if (R[i]) { const s = sets.get(R[i]); if (s) s.area++; }
  // capitals: largest settlement of each country at that time (approximation)
  const best = new Map(); for (const s of sets.values()) { const b = best.get(s.country); if (!b || s.pop > b.pop) best.set(s.country, s); }
  for (const s of best.values()) s.capital = true;
  return { k, year: snap.y, region: R, road: cur.road, sets, cty };
};
H.toJSON = (h) => ({ snaps: h.snaps });
H.fromJSON = (st, d) => {
  const h = H.create(st); h.snaps = (d && d.snaps) || [];
  if (h.snaps.length) { const cur = H.reconstruct(Object.assign({}, st, { hist: h }), h.snaps.length - 1); h.lastReg.set(cur.reg); h.lastRoad.set(cur.road); h.cur = null; }
  return h;
};
// index of snapshot nearest to a year
H.indexOf = (st, year) => { const s = st.hist.snaps; let lo = 0, hi = s.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m].y <= year) lo = m; else hi = m - 1; } return lo; };
})();
