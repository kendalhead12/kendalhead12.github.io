// Pixel World — serialization, IndexedDB save slots, JSON export/import.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U, T = PW.T, S = PW.S, H = PW.H;
const Save = PW.Save = {};
const VERSION = 1;

const strip = (k, v) => (k && k[0] === '_') ? undefined : v;
Save.serialize = (st, meta) => {
  const w = st.world;
  const o = {
    v: VERSION, app: 'pixel-world', name: meta.name, id: meta.id, savedAt: Date.now(), cam: meta.cam, mode: meta.mode,
    world: { W: w.W, H: w.H, seed: w.seed, layers: U.pack8(w.layers), depth: U.pack8(w.depth), temp: U.pack8(w.temp), moist: U.pack8(w.moist), elev: U.pack8(w.elev), fresh: U.pack8(w.fresh) },
    year: st.year, seed: st.seed, rng: st.rng.s, ids: st.ids,
    countries: Array.from(st.countries.values()),
    sets: Array.from(st.sets.values()).map(s => Object.assign({}, s, { tiles: undefined })),
    langs: Array.from(st.langs.values()),
    bands: st.bands, wars: Array.from(st.wars.values()), rel: Array.from(st.rel.entries()),
    events: st.events, wstats: st.wstats,
    region: U.rleN(st.region), bld: U.pack8(st.bld), road: U.pack8(st.road), rail: U.pack8(st.rail), roadEra: U.pack8(st.roadEra),
    hist: H.toJSON(st.hist),
  };
  return JSON.stringify(o, strip);
};
Save.deserialize = (text) => {
  const o = typeof text === 'string' ? JSON.parse(text) : text;
  if (!o || o.app !== 'pixel-world' || !o.world) throw new Error('This file is not a Pixel World save.');
  const ww = o.world; const w = T.createWorld(ww.W, ww.H, ww.seed); const N = w.N;
  w.layers = U.unpack8(ww.layers, N * 4); w.depth = U.unpack8(ww.depth, N); w.temp = U.unpack8(ww.temp, N); w.moist = U.unpack8(ww.moist, N); w.elev = U.unpack8(ww.elev, N); w.fresh = U.unpack8(ww.fresh, N);
  T.refreshAll(w);
  const st = S.newState(w, o.seed);
  st.year = o.year; st.rng.s = o.rng; st.ids = o.ids;
  for (const c of o.countries) st.countries.set(c.id, c);
  for (const s of o.sets) { s.tiles = []; st.sets.set(s.id, s); if (s.name) st.names.add(s.name); }
  for (const l of o.langs) st.langs.set(l.id, l);
  st.bands = o.bands || []; for (const war of o.wars || []) st.wars.set(war.id, war);
  st.rel = new Map(o.rel || []); st.events = o.events || []; st.wstats = o.wstats || [];
  st.region = U.unrleN(o.region, N, Uint16Array); st.bld = U.unpack8(o.bld, N); st.road = U.unpack8(o.road, N); st.rail = U.unpack8(o.rail, N); st.roadEra = U.unpack8(o.roadEra, N);
  for (let i = 0; i < N; i++) { const r = st.region[i]; if (!r) continue; const s = st.sets.get(r); if (!s) { st.region[i] = 0; continue; } st.tpos[i] = s.tiles.length; s.tiles.push(i); }
  for (const s of st.sets.values()) { s.food = 0; for (const i of s.tiles) s.food += T.food(w, i); }
  // rebuild the settlement-centre grid
  st.grid = new Map();
  for (const s of st.sets.values()) if (s.ruined == null) { const k = ((s.x / 8) | 0) + ((s.y / 8) | 0) * 4096; if (!st.grid.has(k)) st.grid.set(k, []); st.grid.get(k).push(s.id); }
  st.hist = H.fromJSON(st, o.hist);
  st.adjDirty = true; S.aggregate();
  return { st, meta: { name: o.name, id: o.id, cam: o.cam, mode: o.mode } };
};

// ---------- IndexedDB ----------
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
    const rq = indexedDB.open('pixel-world', 1);
    rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' }); if (!d.objectStoreNames.contains('data')) d.createObjectStore('data', { keyPath: 'id' }); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
function tx(stores, mode, fn) { return db().then(d => new Promise((res, rej) => { const t = d.transaction(stores, mode); const out = fn(t); t.oncomplete = () => res(out && out.result !== undefined ? out.result : out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaction aborted')); })); }
Save.list = () => db().then(d => new Promise((res, rej) => { const rq = d.transaction('meta').objectStore('meta').getAll(); rq.onsuccess = () => res(rq.result.sort((a, b) => b.savedAt - a.savedAt)); rq.onerror = () => rej(rq.error); }));
Save.put = (id, meta, text) => tx(['meta', 'data'], 'readwrite', (t) => { t.objectStore('meta').put(Object.assign({ id, savedAt: Date.now(), bytes: text.length }, meta)); t.objectStore('data').put({ id, text }); });
Save.get = (id) => db().then(d => new Promise((res, rej) => { const rq = d.transaction('data').objectStore('data').get(id); rq.onsuccess = () => res(rq.result ? rq.result.text : null); rq.onerror = () => rej(rq.error); }));
Save.del = (id) => tx(['meta', 'data'], 'readwrite', (t) => { t.objectStore('meta').delete(id); t.objectStore('data').delete(id); });
Save.rename = (id, name) => db().then(d => new Promise((res, rej) => {
  const t = d.transaction('meta', 'readwrite'); const os = t.objectStore('meta'); const rq = os.get(id);
  rq.onsuccess = () => { const m = rq.result; if (m) { m.name = name; os.put(m); } }; t.oncomplete = () => res(); t.onerror = () => rej(t.error);
}));
})();
