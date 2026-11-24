// Pixel World — procedural languages: phonology, word & name generation, dialects.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const L = PW.L = {};

const CONS = ['p', 't', 'k', 'b', 'd', 'g', 'm', 'n', 's', 'z', 'f', 'v', 'r', 'l', 'h', 'th', 'sh', 'ch', 'j', 'w', 'y', 'kh', 'x', 'q', 'ts', 'zh', 'gh', 'c', 'dh', 'ph'];
const CLUST = ['tr', 'dr', 'br', 'kr', 'gr', 'pr', 'st', 'sk', 'sl', 'fl', 'gl', 'pl', 'bl', 'kl', 'sn', 'sv', 'thr', 'sp', 'vr', 'fr'];
const VOW = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'o', 'y'];
const DIPH = ['ae', 'ai', 'au', 'ei', 'ia', 'io', 'oa', 'ou', 'ea', 'ie', 'ue', 'aa', 'ee', 'oo', 'eo', 'ua'];
const FIN = ['n', 'r', 'l', 's', 'm', 'th', 'k', 'd', 't', 'x', 'sh', 'nd', 'rn', 'st', 'rd', 'ng', 'lk', 'z', 'v', 'sk'];
const PATS = ['CV', 'CVC', 'V', 'VC', 'CVV', 'CCV', 'CCVC', 'CVF'];
const ADJ = ['ian', 'ese', 'ic', 'ish', 'an', 'i', 'ite', 'ene', 'ar', 'ean', 'ic', 'ian'];
const DIRS = ['Northern', 'Southern', 'Eastern', 'Western', 'Coastal', 'Highland', 'Lowland', 'Old', 'New', 'Upper', 'Lower', 'Island'];

function sub(rng, arr, n) { return rng.shuffle(arr.slice()).slice(0, n); }

L.makePhonology = (rng) => {
  const ph = {
    C: sub(rng, CONS, rng.int(8, 14)),
    CL: sub(rng, CLUST, rng.int(0, 5)),
    V: Array.from(new Set(sub(rng, VOW, rng.int(3, 6)))),
    D: sub(rng, DIPH, rng.int(0, 4)),
    F: sub(rng, FIN, rng.int(2, 6)),
    pw: PATS.map(() => rng.range(0.1, 1)),
    maxSyl: rng.int(2, 3),
    adj: rng.pick(ADJ),
  };
  if (!ph.V.length) ph.V = ['a'];
  ph.pw[0] += 1.2; // CV always common
  const mk = (n) => { const out = []; for (let k = 0; k < n; k++) out.push(L.rawWord(ph, rng, 1, 1).toLowerCase()); return out; };
  ph.place = mk(rng.int(2, 4)).map(s => s.length < 2 ? s + rng.pick(ph.V) : s);
  ph.land = [rng.pick(['ia', 'a', 'or', 'en', 'ar', 'is', 'um', 'and', 'ea', 'ica', 'ovia', 'ent']), rng.pick(['ia', 'a', 'on', 'ir', 'ostan', 'ad', 'el', 'ara'])];
  ph.fam = mk(rng.int(1, 3));
  ph.fem = [rng.pick(['a', 'ia', 'e', 'ra', 'ina', 'ys', 'el'])];
  ph.masc = [rng.pick(['o', 'us', 'an', 'ir', 'ek', 'or', '', 'im'])];
  return ph;
};

L.rawWord = (ph, rng, mn, mx) => {
  const n = rng.int(mn, mx); let w = '';
  for (let s = 0; s < n; s++) {
    const p = rng.wpick(PATS, ph.pw);
    for (const ch of p) {
      if (ch === 'C') w += (s === 0 && ph.CL.length && rng.chance(0.15)) ? rng.pick(ph.CL) : rng.pick(ph.C);
      else if (ch === 'V') w += (ph.D.length && rng.chance(0.14)) ? rng.pick(ph.D) : rng.pick(ph.V);
      else if (ch === 'F') w += rng.pick(ph.F);
    }
  }
  return w;
};
const clean = (w) => {
  w = w.replace(/([aeiouy]{2})[aeiouy]+/g, '$1').replace(/([^aeiouy]{2})[^aeiouy]+/g, '$1').replace(/^([aeiouy])\1/, '$1').replace(/(.)\1\1+/g, '$1$1').replace(/([^aeiouy])\1/g, '$1').replace(/^([^aeiouy]{3,})/, (m) => m.slice(-2));
  if (!/[aeiouy]/.test(w)) w += 'a';
  if (w.length > 11) w = w.slice(0, 11);
  return w;
};
L.word = (lang, rng, mn, mx) => U.cap(clean(L.rawWord(lang.ph, rng, mn || 1, mx || lang.ph.maxSyl)));

L.placeName = (lang, rng) => {
  let w = clean(L.rawWord(lang.ph, rng, 1, 2));
  if (rng.chance(0.55)) w = w.replace(/[aeiouy]+$/, '') + rng.pick(lang.ph.place);
  w = clean(w); if (w.length < 3) w += rng.pick(lang.ph.place);
  return U.cap(w);
};
L.countryRoot = (lang, rng) => {
  let w = clean(L.rawWord(lang.ph, rng, 1, 2));
  if (rng.chance(0.6)) w = w.replace(/[aeiouy]+$/, '') + rng.pick(lang.ph.land);
  w = clean(w); if (w.length < 4) w += rng.pick(lang.ph.land);
  return U.cap(w);
};
L.adjOf = (lang, root) => {
  let base = root.replace(/(ia|a|e|i|o|u|y|um|is)$/i, '');
  if (base.length < 3) base = root;
  let suf = lang.ph.adj; const lb = base.toLowerCase();
  if (lb.endsWith(suf) || lb.endsWith(suf.slice(0, 2)) || (suf.length > 1 && lb.endsWith(suf.slice(1)))) suf = suf === 'ian' ? 'ese' : 'ian';
  if (/[aeiouy]$/.test(lb) && /^[aeiouy]/.test(suf)) suf = suf.slice(1) || 'n';
  return base + suf;
};
L.personName = (lang, rng, sex) => {
  let g = clean(L.rawWord(lang.ph, rng, 1, 2));
  const end = sex ? rng.pick(lang.ph.fem) : rng.pick(lang.ph.masc);
  if (rng.chance(0.6)) g = g.replace(/[aeiouy]+$/, '') + end;
  g = clean(g); if (g.length < 3) g += rng.pick(lang.ph.V);
  let f = clean(L.rawWord(lang.ph, rng, 1, 2));
  if (rng.chance(0.45)) f = clean(f + rng.pick(lang.ph.fam));
  return [U.cap(g), U.cap(f)];
};

L.create = (st, rng, parent, nameHint) => {
  const id = st.ids.l++;
  let ph;
  if (parent) {
    ph = JSON.parse(JSON.stringify(parent.ph));
    // sound shifts: swap a few consonants / vowels, new suffixes
    for (let k = 0; k < rng.int(1, 3); k++) ph.C[rng.int(0, ph.C.length - 1)] = rng.pick(CONS);
    if (rng.chance(0.6)) ph.V[rng.int(0, ph.V.length - 1)] = rng.pick(VOW);
    if (rng.chance(0.5)) ph.D.push(rng.pick(DIPH));
    if (rng.chance(0.5)) ph.place[rng.int(0, ph.place.length - 1)] = clean(L.rawWord(ph, rng, 1, 1).toLowerCase());
    if (rng.chance(0.4)) ph.adj = rng.pick(ADJ);
    ph.pw = ph.pw.map(w => Math.max(0.05, w + rng.range(-0.3, 0.3)));
  } else ph = L.makePhonology(rng);
  const lang = { id, ph, born: Math.floor(st.year), parent: parent ? parent.id : 0, dialect: false, home: 0, extinct: null };
  const root = nameHint || L.countryRoot(lang, rng);
  lang.root = root;
  lang.name = L.adjOf(lang, root);
  const hue = parent ? (U.rgb2hsl(parent.color)[0] + rng.range(-0.08, 0.08)) : rng.next();
  lang.color = U.hsl(hue, rng.range(0.5, 0.8), rng.range(0.45, 0.62));
  st.langs.set(id, lang);
  return lang;
};
L.dialect = (st, rng, parent, dirWord) => {
  const d = L.create(st, rng, parent);
  d.dialect = true; d.parent = parent.id;
  d.name = (dirWord || rng.pick(DIRS)) + ' ' + parent.name;
  d.color = U.hsl(U.rgb2hsl(parent.color)[0] + rng.range(-0.05, 0.05), 0.6, U.clamp(U.rgb2hsl(parent.color)[2] + rng.range(-0.12, 0.12), 0.3, 0.75));
  return d;
};
// a dialect matures into a full language with its own name
L.mature = (st, rng, d) => {
  const old = d.name;
  d.dialect = false;
  const root = L.countryRoot(d, rng); d.root = root; d.name = L.adjOf(d, root);
  d.color = U.hsl(U.rgb2hsl(d.color)[0] + rng.range(-0.15, 0.15), rng.range(0.5, 0.8), rng.range(0.45, 0.62));
  return old;
};
L.family = (st, lang) => { let l = lang; let guard = 0; while (l && l.parent && guard++ < 50) { const p = st.langs.get(l.parent); if (!p) break; l = p; } return l ? l.id : 0; };
L.DIRS = DIRS;
})();
