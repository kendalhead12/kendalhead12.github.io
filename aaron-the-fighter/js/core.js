'use strict';
// ============================================================
//  AARON THE FIGHTER!  - core utilities, constants, save data
// ============================================================
const AF = window.AF = window.AF || {};
AF.W = 240; AF.H = 160; AF.TS = 16;
AF.tick = 0;           // global frame counter (60 fps)

AF.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
AF.lerp = (a, b, t) => a + (b - a) * t;
AF.sign = v => v > 0 ? 1 : v < 0 ? -1 : 0;
AF.approach = (v, t, s) => v < t ? Math.min(v + s, t) : Math.max(v - s, t);
AF.rr = (a, b) => a + Math.random() * (b - a);
AF.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
AF.pick = arr => arr[Math.floor(Math.random() * arr.length)];
AF.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
AF.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
AF.rectsHit = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
AF.seeded = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
AF.ease = {
  out: t => 1 - (1 - t) * (1 - t),
  in: t => t * t,
  inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  back: t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
};
AF.fmtTime = function (frames) {
  const cs = Math.floor((frames % 60) * 100 / 60), s = Math.floor(frames / 60) % 60, m = Math.floor(frames / 3600);
  return m + ':' + (s < 10 ? '0' : '') + s + ':' + (cs < 10 ? '0' : '') + cs;
};
AF.pad = (n, l) => { let s = '' + Math.max(0, Math.floor(n)); while (s.length < l) s = '0' + s; return s; };

// ---------- World metadata ----------
AF.WORLDS = [
  null,
  { name: 'EMERALD FOREST', short: 'FOREST', acts: ['FOREST ENTRANCE', 'TREETOP TROUBLE', 'GUARDIAN OF THE WOODS'], boss: 'MECHANICAL TREANT', music: 'forest', ability: null, col: '#3cc060' },
  { name: 'CRYSTAL AQUARIUM', short: 'AQUARIUM', acts: ['THE GREAT AQUARIUM', 'FLOODED LABORATORY', 'TERROR OF THE DEEP'], boss: 'MECHA-SHARK MK1', music: 'aqua', ability: 'swim', col: '#3ca0f0' },
  { name: 'FROSTBITE MOUNTAIN', short: 'FROSTBITE', acts: ['FROZEN SUMMIT', 'BENEATH THE ICE', 'THE FROZEN BEAST'], boss: 'CRYO-GOLEM', music: 'ice', ability: 'double', col: '#a0e0ff' },
  { name: 'MAGMA MOUNTAIN', short: 'MAGMA', acts: ['VOLCANIC ENTRANCE', 'THE MOLTEN CORE', 'INFERNO ENGINE'], boss: 'MAGMABOT', music: 'lava', ability: 'slam', col: '#ff6020' },
  { name: 'CLOCKWORK CITY', short: 'CLOCKWORK', acts: ['INDUSTRIAL DISTRICT', 'THE CLOCKWORK TOWER', 'IRON ENFORCER'], boss: 'CRUSHER-9000', music: 'city', ability: 'charge', col: '#c0a070' },
  { name: 'SUNSCORCH DESERT', short: 'SUNSCORCH', acts: ['DESERT CROSSING', 'TEMPLE OF THE SUN', 'THE SAND GUARDIAN'], boss: 'SCORPION-X', music: 'desert', ability: 'dash', col: '#f0c040' },
  { name: 'SKYBOUND ISLANDS', short: 'SKYBOUND', acts: ['ABOVE THE CLOUDS', 'STORM FORTRESS', 'THE SKY SENTINEL'], boss: 'THUNDERWING', music: 'sky', ability: 'airdash', col: '#80c0ff' },
  { name: "ACHMED'S LABORATORY", short: 'LABORATORY', acts: ['BREAKING IN', 'THE FINAL EXPERIMENT', 'THE LAST DEFENSE'], boss: 'OMEGA GUARDIAN', music: 'lab', ability: null, col: '#c060ff' }
];
AF.ABILITY_INFO = {
  swim: ['SWIMMING', 'Use the D-pad to swim in any direction.', 'Press JUMP for a quick stroke.'],
  double: ['DOUBLE JUMP', 'Press JUMP again in mid-air', 'to jump a second time!'],
  slam: ['GROUND SLAM', 'In mid-air, hold DOWN + ATTACK', 'to slam the ground. Breaks cracked floors!'],
  charge: ['CHARGED PUNCH', 'Hold ATTACK, then release', 'for a mighty punch. Smashes metal!'],
  dash: ['DASH', 'Press DASH on the ground to', 'burst forward. Breaks sandstone walls!'],
  airdash: ['AIR DASH', 'Press DASH in mid-air', 'to dash across the sky!']
};

// ---------- Save data ----------
AF.SAVE_KEY = 'aaronTheFighter.save.v1';
AF.OPT_KEY = 'aaronTheFighter.opts.v1';
AF.newSave = function () {
  return {
    v: 1, started: false, unlocked: 1, acts: {}, bosses: {}, finalDone: false,
    artifacts: [false, false, false, false, false, false, false, false],
    abilities: { swim: false, double: false, slam: false, charge: false, dash: false, airdash: false },
    lives: 3, bank: 0, score: 0, upgrades: { hearts: 0, energy: 0, power: 0, magnet: 0 },
    mapNode: 1, playTime: 0, seenIntro: false, deaths: 0
  };
};
AF.defaultOpts = function () {
  return { music: 0.6, sfx: 0.8, shake: true, touch: 'auto', pixel: false, timer: true, crt: false };
};
AF.storage = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
AF.loadSave = function () {
  const raw = AF.storage.get(AF.SAVE_KEY);
  let s = null;
  if (raw) { try { s = JSON.parse(raw); } catch (e) { s = null; } }
  const base = AF.newSave();
  if (s && s.v === 1) {
    for (const k in base) if (s[k] === undefined) s[k] = base[k];
    for (const k in base.abilities) if (s.abilities[k] === undefined) s.abilities[k] = false;
    for (const k in base.upgrades) if (s.upgrades[k] === undefined) s.upgrades[k] = 0;
    AF.save = s;
  } else AF.save = base;
  const ro = AF.storage.get(AF.OPT_KEY);
  AF.opts = AF.defaultOpts();
  if (ro) { try { Object.assign(AF.opts, JSON.parse(ro)); } catch (e) { } }
};
AF.writeSave = function () { AF.storage.set(AF.SAVE_KEY, JSON.stringify(AF.save)); };
AF.writeOpts = function () { AF.storage.set(AF.OPT_KEY, JSON.stringify(AF.opts)); };
AF.hasSave = function () { return !!AF.storage.get(AF.SAVE_KEY) && AF.save && AF.save.started; };
AF.actKey = (w, a) => w + '-' + a;
AF.actData = function (w, a) {
  const k = AF.actKey(w, a);
  if (!AF.save.acts[k]) AF.save.acts[k] = { done: false, med: 0, best: 0, hi: 0 };
  return AF.save.acts[k];
};
AF.medCount = function (w, a) { const d = AF.save.acts[AF.actKey(w, a)]; if (!d) return 0; let n = 0; for (let i = 0; i < 3; i++) if (d.med & (1 << i)) n++; return n; };
AF.totalMedals = function () { let n = 0; for (let w = 1; w <= 8; w++) for (let a = 1; a <= 3; a++) n += AF.medCount(w, a); return n; };
AF.actUnlocked = function (w, a) {
  if (w > AF.save.unlocked) return false;
  if (a === 1) return true;
  if (a === 4) return w === 8 && AF.actData(8, 3).done;
  return AF.actData(w, a - 1).done;
};
AF.maxHearts = () => 5 + (AF.save.upgrades.hearts || 0);
AF.maxEnergy = () => 3 + (AF.save.upgrades.energy || 0);
// Abilities granted by reaching later worlds stay available afterward.
AF.syncAbilities = function (world, act) {
  const ab = AF.save.abilities;
  for (let w = 2; w <= 7; w++) {
    const k = AF.WORLDS[w].ability;
    if (!k) continue;
    if (AF.save.unlocked > w || (world > w) || (world === w && act > 1)) ab[k] = true;
  }
};

// ---------- tiny event/timer helper ----------
AF.Timer = class {
  constructor() { this.list = []; }
  after(frames, fn) { this.list.push({ t: frames, fn }); }
  update() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (--e.t <= 0) { this.list.splice(i, 1); e.fn(); }
    }
  }
};
