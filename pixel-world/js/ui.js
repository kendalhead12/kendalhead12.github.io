// Pixel World — user interface: toolbars, side panels, modals, gallery, diplomacy, statistics, timelapse, saves.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U, T = PW.T, S = PW.S, R = PW.R, F = PW.F, H = PW.H, Ch = PW.Ch, Tools = PW.Tools, Save = PW.Save, L = PW.L;
const UI = PW.UI = {};
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = U.esc;
const st = () => S.st;
const SPEEDS = [0, 1, 2, 5, 10, 50, 100];
const MODES = [
  ['terrain', 'Terrain', 'Natural terrain and buildings'], ['political', 'Political', 'Countries and national borders'], ['admin', 'Admin', 'Villages and regional borders'],
  ['language', 'Language', 'Geographic language distribution'], ['population', 'Population', 'Population density heatmap'], ['diplomacy', 'Diplomacy', 'Allies, rivals and conflicts'],
  ['tech', 'Technology', 'Civilization development levels'], ['infra', 'Infrastructure', 'Roads, railroads, ports and cities'],
];
const TOOLS = [
  ['inspect', 'Inspect', 'Inspect & pan (I)'], ['pencil', 'Pencil', 'Paint terrain (B)'], ['eraser', 'Eraser', 'Remove the top layer (E)'], ['bucket', 'Fill', 'Paint bucket: fill an enclosed area (F)'],
  ['line', 'Line', 'Draw a straight line (L)'], ['picker', 'Picker', 'Pick a terrain material from the map (K)'], ['smooth', 'Smooth', 'Smooth coastlines (M)'],
  ['human', 'Human', 'Spawn one human (H)'], ['group', 'Group', 'Spawn a group of humans (G)'],
];
UI.cfg = { clouds: true, particles: true, labels: true, notify: true, autosave: 3 };
UI.state = { speed: 1, prev: 1, name: 'New World', id: null, lastAuto: 0, side: null, tl: null };
const AREA_KM = 400;

// ---------- pixel icons ----------
const ICONS = {
  inspect: ['...#.#...', '..#o#o#..', '..#o#o##.', '.##o#o#o#', '#o#oooo#.', '#ooooooo#', '.#oooooo#', '..#ooooo#', '...#####.'],
  pencil: ['......##.', '.....#oo#', '....#oo#.', '...#oo#..', '..#oo#...', '.#oo#....', '#yy#.....', '#y#......', '##.......'],
  eraser: ['.....###.', '....#ooo#', '...#ooo#.', '..#ooo#..', '.#ppo#...', '#ppp#....', '#pp#.....', '.##......', '...######'],
  bucket: ['..###....', '.#...#...', '#.####b..', '#oooo#bb.', '#oooo#.b.', '.#ooo#.b.', '..#oo#.b.', '...###...', '.........'],
  line: ['.......##', '......##.', '.....##..', '....##...', '...##....', '..##.....', '.##......', '##.......', '.........'],
  picker: ['......##.', '.....####', '......##.', '.....#.#.', '....#o#..', '...#o#...', '..#o#....', '.#o#.....', '#.#......'],
  smooth: ['.........', '.##...##.', '#..#.#..#', '....#....', '.##...##.', '#..#.#..#', '....#....', '.........', '.........'],
  human: ['...###...', '...#o#...', '...###...', '..#####..', '.#.###.#.', '...###...', '...#.#...', '..##.##..', '.........'],
  group: ['..#...#..', '.###.###.', '..#...#..', '.###.###.', '#.#.#.#.#', '..#...#..', '.#.#.#.#.', '.#.#.#.#.', '.........'],
  undo: ['...#.....', '..##.....', '.#######.', '..##....#', '...#....#', '........#', '.......#.', '..#####..', '.........'],
};
ICONS.redo = ICONS.undo.map(r => r.split('').reverse().join(''));
const iconCache = {};
function icon(name) {
  if (iconCache[name]) return iconCache[name];
  const p = ICONS[name]; const c = document.createElement('canvas'); c.width = 9; c.height = 9; const g = c.getContext('2d');
  const pal = { '#': '#f4ecd8', o: '#c8b898', y: '#f0c040', p: '#e86a8a', b: '#5ab0f0' };
  p.forEach((row, y) => row.split('').forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return (iconCache[name] = c.toDataURL());
}
const ico = (n) => `<img class="ico" src="${icon(n)}" alt="">`;

// ---------- helpers ----------
const flagImg = (f, w, h) => F.img(f, w || 24, h || 16);
const cname = (c) => c ? c.name : 'Unknown';
const chip = (c) => c ? `<span class="chip" data-cid="${c.id}">${flagImg(c.flag, 18, 12)}<span>${esc(c.name)}</span></span>` : '<span class="chip">—</span>';
const langName = (id) => { const l = st().langs.get(id); return l ? l.name : '—'; };
const statusBadge = (s) => `<span class="badge b-${s}">${s === 'allied' ? 'Allied' : s === 'war' ? 'At war' : U.cap(s)}</span>`;
const bar = (v, col) => `<span class="bar"><i style="width:${U.clamp(v, 0, 100).toFixed(0)}%;${col ? 'background:' + col : ''}"></i></span>`;
const yr = (y) => `Year ${y}`;
const span = (a, b) => `${a}–${b == null ? 'Present' : b}`;
UI.esc = esc;

UI.init = () => {
  try { Object.assign(UI.cfg, JSON.parse(localStorage.getItem('pw-cfg') || '{}')); } catch (e) { /* storage unavailable */ }
  R.showClouds = UI.cfg.clouds; R.particlesOn = UI.cfg.particles; R.showLabels = UI.cfg.labels;
  // speed buttons
  $('#speeds').innerHTML = SPEEDS.map(s => `<button class="spd" data-speed="${s}" title="${s ? s + 'x speed' : 'Pause (P)'}">${s ? s + 'x' : '❚❚'}</button>`).join('');
  $('#speeds').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) UI.setSpeed(+b.dataset.speed); });
  // map modes
  $('#modes').innerHTML = MODES.map(([k, n, d], i) => `<button data-mode="${k}" title="${d} (${i + 1})"><span class="mdot md-${k}"></span><span>${n}</span></button>`).join('');
  $('#modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) UI.setMode(b.dataset.mode); });
  // toolbar
  const mats = T.MATS.map((m, i) => `<button class="sw" data-mat="${i}" title="${m.name}" style="--c:${U.css(m.color)}"><i></i><span>${m.name.replace('Shallow Water', 'Shallow').replace('Deep Ocean', 'Ocean').replace('Mountains', 'Mountain')}</span></button>`).join('');
  const bios = T.BIOME_BRUSH.map((b, i) => { const bi = T.BIOMES.findIndex(x => x.name === b.name); const c = T.BIOMES[bi].ground[0]; return `<button class="sw" data-bio="${i}" title="${b.name} brush: sets the climate and terrain" style="--c:${U.css(c)}"><i></i><span>${b.name.replace('Temperate ', 'Temp. ').replace('Tropical ', '')}</span></button>`; }).join('');
  $('#toolbar').innerHTML = `
    <div class="tgroup tools">${TOOLS.map(([k, n, d]) => `<button class="tool" data-tool="${k}" title="${d}">${ico(k)}<span>${n}</span></button>`).join('')}</div>
    <div class="tgroup brush"><label title="Brush radius ([ / ])">Brush <b id="bsz">2</b></label><input id="brush" type="range" min="0" max="30" value="2"></div>
    <div class="tgroup pal"><div class="paltabs"><button data-pt="mat" class="on">Terrain</button><button data-pt="bio">Biomes</button></div><div class="swatches" id="sw-mat">${mats}</div><div class="swatches hidden" id="sw-bio">${bios}</div></div>
    <div class="tgroup hist"><button class="tool" id="undo" title="Undo (Ctrl+Z)">${ico('undo')}<span>Undo</span></button><button class="tool" id="redo" title="Redo (Ctrl+Y)">${ico('redo')}<span>Redo</span></button></div>`;
  $('#toolbar').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]'); if (t) return UI.setTool(t.dataset.tool);
    const m = e.target.closest('[data-mat]'); if (m) { Tools.mat = +m.dataset.mat; Tools.biome = -1; if (!['pencil', 'bucket', 'line'].includes(Tools.tool)) UI.setTool('pencil'); UI.syncTools(); return; }
    const b = e.target.closest('[data-bio]'); if (b) { Tools.biome = +b.dataset.bio; if (!['pencil', 'bucket', 'line'].includes(Tools.tool)) UI.setTool('pencil'); UI.syncTools(); return; }
    const pt = e.target.closest('[data-pt]'); if (pt) { $$('[data-pt]').forEach(x => x.classList.toggle('on', x === pt)); $('#sw-mat').classList.toggle('hidden', pt.dataset.pt !== 'mat'); $('#sw-bio').classList.toggle('hidden', pt.dataset.pt !== 'bio'); return; }
    if (e.target.closest('#undo')) Tools.doUndo(); if (e.target.closest('#redo')) Tools.doRedo();
  });
  $('#brush').addEventListener('input', (e) => Tools.setSize(+e.target.value));
  // menu
  $('#menu').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (!b) return; $('#top').classList.remove('menu-open'); UI.open(b.dataset.open); });
  $('#burger').addEventListener('click', () => $('#top').classList.toggle('menu-open'));
  $('#minimap').addEventListener('pointerdown', (e) => { const m = $('#minimap'); const r = m.getBoundingClientRect(); const go = (ev) => R.miniTo((ev.clientX - r.left) * m.width / r.width, (ev.clientY - r.top) * m.height / r.height); go(e); const mv = (ev) => go(ev); const upf = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upf); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upf); });
  $('#mmToggle').addEventListener('click', () => $('#minimapWrap').classList.toggle('collapsed'));
  // global delegation for chips & links
  document.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cid]'); if (c && !e.target.closest('.modal [data-nolink]')) { e.preventDefault(); const id = +c.dataset.cid; const ct = S.C(id); if (ct) { if (ct.fallen != null) UI.openGallery(id); else { UI.closeModal(); UI.openCountry(id); const cap = st().sets.get(ct.capital); if (cap) R.focus(cap.x + 0.5, cap.y + 0.5); } } return; }
    const s = e.target.closest('[data-sid]'); if (s) { e.preventDefault(); const set = st().sets.get(+s.dataset.sid); if (set) { R.focus(set.x + 0.5, set.y + 0.5, 9); R.highlightSet = set.id; if (!e.target.closest('.modal')) UI.openSet(set.id); else { UI.closeModal(); UI.openSet(set.id); } } return; }
    const f = e.target.closest('[data-focus]'); if (f) { const [x, y] = f.dataset.focus.split(',').map(Number); R.focus(x + 0.5, y + 0.5, 6); return; }
    if (!e.target.closest('#person') && !e.target.closest('#view')) UI.hidePerson();
  });
  const MAJOR = ['war', 'fall', 'indep', 'collapse', 'unite', 'found', 'peace'];
  S.hooks.notify = (ev) => { if (!UI.cfg.notify || UI.state.tl) return; if (UI.state.speed >= 10 && !MAJOR.includes(ev.k)) return; if (UI.state.speed >= 50 && ev.k === 'peace') return; UI.toast(ev.t, { ev }); };
  UI.setMode('political'); UI.setTool('inspect'); UI.setSpeed(1); UI.syncTools();
};
UI.saveCfg = () => { try { localStorage.setItem('pw-cfg', JSON.stringify(UI.cfg)); } catch (e) { /* ignore */ } };

// ---------- top bar & tools ----------
UI.setSpeed = (s) => { if (UI.state.tl) return; if (s > 0) UI.state.prev = s; UI.state.speed = s; $$('#speeds .spd').forEach(b => b.classList.toggle('on', +b.dataset.speed === s)); $('#top').classList.toggle('paused', s === 0); };
UI.togglePause = () => UI.setSpeed(UI.state.speed ? 0 : (UI.state.prev || 1));
UI.setMode = (m) => { R.mode = m; R.invalidate(); $$('#modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); UI.legend(); };
UI.setModeIndex = (n) => { if (MODES[n]) UI.setMode(MODES[n][0]); };
UI.setTool = (t) => { Tools.tool = t; R.cursor = null; UI.syncTools(); if (t !== 'transfer' && t !== 'indep') $('#pickHint').classList.add('hidden'); };
UI.syncTools = () => {
  $$('#toolbar [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === Tools.tool));
  $$('#toolbar [data-mat]').forEach(b => b.classList.toggle('on', Tools.biome < 0 && +b.dataset.mat === Tools.mat));
  $$('#toolbar [data-bio]').forEach(b => b.classList.toggle('on', +b.dataset.bio === Tools.biome));
  $('#bsz').textContent = Tools.size; $('#brush').value = Tools.size;
  $('#undo').disabled = !Tools.undo.length; $('#redo').disabled = !Tools.redo.length;
  document.body.dataset.tool = Tools.tool;
};
UI.escape = () => { if ($('#modalRoot').children.length) return UI.closeModal(); if (UI.state.tl) return UI.exitTimelapse(); if (Tools.tool === 'transfer' || Tools.tool === 'indep') return UI.setTool('inspect'); UI.closeSide(); };
UI.legend = () => {
  const m = R.mode; let h = '';
  if (m === 'tech') h = S.ERAS.map(e => `<span><i style="background:${U.css(e.color)}"></i>${e.name}</span>`).join('');
  else if (m === 'diplomacy') h = R.sel ? [['self', 'Selected'], ['allied', 'Allied'], ['friendly', 'Friendly'], ['neutral', 'Neutral'], ['rival', 'Rival'], ['war', 'At war'], ['truce', 'Truce']].map(([k, n]) => `<span><i class="b-${k}"></i>${n}</span>`).join('') : '<span>Click a country to see its relations</span><span><i class="b-war"></i>At war</span><span><i class="b-allied"></i>In an alliance</span>';
  else if (m === 'population') h = '<span>Sparse</span><span class="ramp"></span><span>Dense</span>';
  else if (m === 'infra') h = '<span><i style="background:#fff0a0"></i>City centre</span><span><i style="background:#d8d0b8"></i>Road</span><span><i style="background:#ffaa3c"></i>Highway</span><span><i style="background:#e85050"></i>Railway</span><span><i style="background:#50dcff"></i>Port</span><span><i style="background:#ff7850"></i>Industry</span>';
  else if (m === 'language') h = '<span>Each colour is a language; speckles show minority languages</span>';
  else if (m === 'admin') h = '<span>Thin lines: administrative regions · thick: national borders</span>';
  $('#legend').innerHTML = h; $('#legend').classList.toggle('hidden', !h);
};

// ---------- world creation ----------
UI.newWorld = (o) => {
  const seed = o.seed >>> 0;
  const w = o.mode === 'random' ? T.generate({ W: o.W, H: o.H, seed, land: o.land, islands: o.islands }) : T.blank({ W: o.W, H: o.H, seed });
  const s = S.newState(w, seed);
  UI.state.name = o.name || 'New World'; UI.state.id = 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  R.setState(s); Tools.reset(); UI.closeSide(); R.sel = 0;
  if (o.tribes) S.seedTribes(o.tribes);
  S.forceRecord();
  if (o.mode === 'custom') { UI.setTool('pencil'); Tools.mat = T.M.SOIL; Tools.biome = -1; Tools.size = 1; UI.syncTools(); UI.setSpeed(0); UI.toast('Draw a continent outline with the pencil, then use Fill inside it. Biome brushes paint climate.', { kind: 'info', ttl: 12000 }); }
  UI.setMode(o.mode === 'random' ? 'political' : 'terrain');
  UI.updateTop(true);
};

// ---------- toasts ----------
UI.toast = (text, o) => {
  o = o || {}; const box = $('#toasts');
  const d = document.createElement('div'); d.className = 'toast ' + (o.kind || (o.ev ? 'ev-' + o.ev.k : ''));
  const c = o.ev && o.ev.c && o.ev.c.length ? S.C(o.ev.c[0]) : null;
  d.innerHTML = `${c ? flagImg(c.flag, 21, 14) : ''}<div>${o.ev ? `<b>Year ${o.ev.y}</b> ` : ''}${esc(text)}</div>`;
  d.addEventListener('click', () => { if (o.ev) { if (o.ev.x != null) R.focus(o.ev.x + 0.5, o.ev.yy + 0.5, 5); else if (c) { const cap = st().sets.get(c.capital); if (cap) R.focus(cap.x + 0.5, cap.y + 0.5, 5); } if (c && c.fallen == null) UI.openCountry(c.id); } d.remove(); });
  box.prepend(d);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, o.ttl || 6500);
};

// ---------- modal system ----------
UI.modal = (title, html, o) => {
  o = o || {}; UI.closeModal();
  const root = $('#modalRoot');
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal ${o.cls || ''}" role="dialog" aria-label="${esc(title)}"><div class="mh"><h2>${title}</h2><button class="x" title="Close (Esc)">✕</button></div><div class="mb">${html}</div></div>`;
  m.addEventListener('pointerdown', (e) => { if (e.target === m) UI.closeModal(); });
  m.querySelector('.x').addEventListener('click', () => UI.closeModal());
  root.appendChild(m); UI._onClose = o.onClose;
  return m.querySelector('.mb');
};
UI.closeModal = () => { const r = $('#modalRoot'); if (r.children.length) { r.innerHTML = ''; const f = UI._onClose; UI._onClose = null; if (f) f(); } };
UI.ask = (title, value, label) => new Promise((res) => {
  const b = UI.modal(title, `<form class="ask"><label>${esc(label || 'Name')}</label><input type="text" maxlength="60" value="${esc(value || '')}"><div class="btnrow"><button type="button" class="ghost cancel">Cancel</button><button class="primary">OK</button></div></form>`, { cls: 'small', onClose: () => res(null) });
  const inp = b.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  b.querySelector('.cancel').addEventListener('click', () => UI.closeModal());
  b.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value.trim(); UI._onClose = null; UI.closeModal(); res(v || null); });
});
function tabs(body, names, render) {
  const bar = document.createElement('div'); bar.className = 'tabs'; const cont = document.createElement('div'); cont.className = 'tabc';
  bar.innerHTML = names.map((n, i) => `<button data-t="${i}" class="${i ? '' : 'on'}">${n}</button>`).join('');
  body.appendChild(bar); body.appendChild(cont);
  const go = (i) => { $$('button', bar).forEach(b => b.classList.toggle('on', +b.dataset.t === i)); cont.innerHTML = ''; render(i, cont); };
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) go(+b.dataset.t); });
  go(0); return go;
}

UI.open = (what) => {
  switch (what) {
    case 'new': return UI.openNew();
    case 'saves': return UI.openSaves();
    case 'nations': return UI.openNations(0);
    case 'archive': return UI.openNations(1);
    case 'diplomacy': return UI.openDiplomacy();
    case 'stats': return UI.openStats();
    case 'timelapse': return UI.startTimelapse();
    case 'settings': return UI.openSettings();
    case 'help': return UI.openHelp();
  }
};

// ---------- New world ----------
UI.openNew = (welcome) => {
  const seed = Math.floor(Math.random() * 1e9);
  const b = UI.modal(welcome ? 'Welcome to Pixel World' : 'Create a New World', `
    ${welcome ? `<p class="lead">A god sandbox about geography, languages, diplomacy and thousands of years of history. Shape continents, place your first humans and watch nations rise, split, unite and fall.</p>${welcome.auto ? `<div class="btnrow left"><button class="primary" id="nw-continue">Continue “${esc(welcome.auto.name)}” (Year ${welcome.auto.year})</button></div><hr>` : ''}` : ''}
    <form id="nw" class="form">
      <label>World name<input name="name" value="${esc(welcome ? 'Terra Nova' : 'New World')}" maxlength="40"></label>
      <fieldset class="seg"><legend>Generation</legend>
        <label><input type="radio" name="mode" value="random" checked><span>Random continents</span></label>
        <label><input type="radio" name="mode" value="blank"><span>Blank ocean</span></label>
        <label><input type="radio" name="mode" value="custom"><span>Hand-drawn continents</span></label>
      </fieldset>
      <label>World size<select name="size"><option value="192x128">Small (192×128)</option><option value="288x192" selected>Medium (288×192)</option><option value="384x256">Large (384×256)</option><option value="512x320">Huge (512×320)</option></select></label>
      <label>Seed<span class="row"><input name="seed" value="${seed}" inputmode="numeric"><button type="button" class="ghost" id="nw-rnd">Random</button></span></label>
      <label class="rnd-only">Land coverage <b id="lv">40%</b><input type="range" name="land" min="10" max="75" value="40"></label>
      <label class="rnd-only">Island frequency <b id="iv">40%</b><input type="range" name="islands" min="0" max="100" value="40"></label>
      <label>Starting tribes <b id="tv">8</b><input type="range" name="tribes" min="0" max="20" value="8"></label>
      <div class="btnrow"><button class="primary">Create world</button></div>
    </form>`, { cls: 'mid' });
  const f = $('#nw', b);
  const sync = () => { const m = f.mode.value; $$('.rnd-only', f).forEach(x => x.classList.toggle('dim', m !== 'random')); $('#lv', f).textContent = f.land.value + '%'; $('#iv', f).textContent = f.islands.value + '%'; $('#tv', f).textContent = f.tribes.value; };
  f.addEventListener('input', sync); f.addEventListener('change', (e) => { if (e.target.name === 'mode') f.tribes.value = e.target.value === 'random' ? 8 : 0; sync(); }); sync();
  $('#nw-rnd', b).addEventListener('click', () => { f.seed.value = Math.floor(Math.random() * 1e9); });
  if (welcome && welcome.auto) $('#nw-continue', b).addEventListener('click', () => { UI.closeModal(); UI.loadSave(welcome.auto.id); });
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const [Wd, Ht] = f.size.value.split('x').map(Number);
    const sv = f.seed.value.trim(); const seedN = /^\d+$/.test(sv) ? +sv : U.hashStr(sv);
    UI.closeModal();
    UI.busy('Generating world…', () => UI.newWorld({ name: f.name.value.trim() || 'New World', mode: f.mode.value, W: Wd, H: Ht, seed: seedN, land: f.land.value / 100, islands: f.islands.value / 100, tribes: +f.tribes.value }));
  });
};
UI.busy = (msg, fn) => { const d = $('#busy'); d.textContent = msg; d.classList.remove('hidden'); setTimeout(() => { try { fn(); } catch (err) { console.error(err); UI.toast('Error: ' + err.message, { kind: 'warn' }); } d.classList.add('hidden'); }, 40); };

// ---------- side panel: country ----------
UI.openCountry = (cid, opts) => { UI.state.side = { type: 'country', id: cid, set: opts && opts.set, tab: (UI.state.side && UI.state.side.type === 'country' && UI.state.side.id === cid) ? UI.state.side.tab : 0 }; R.sel = cid; R.invalidate(); UI.legend(); UI.renderSide(true); };
UI.openSet = (sid) => { const s = st().sets.get(sid); if (!s) return; UI.state.side = { type: 'set', id: sid }; R.highlightSet = sid; R.sel = s.country; R.invalidate(); UI.renderSide(true); };
UI.openTile = (x, y) => { UI.state.side = { type: 'tile', x, y }; UI.renderSide(true); };
UI.closeSide = () => { UI.state.side = null; $('#side').classList.add('hidden'); document.body.classList.remove('side-open'); if (R.sel) { R.sel = 0; R.invalidate(); UI.legend(); } R.highlightSet = 0; };
UI.inspect = (tx, ty) => {
  const s = st(); const i = ty * s.world.W + tx; const r = s.region[i];
  if (r) { const set = s.sets.get(r); if (R.mode === 'admin') UI.openSet(r); else UI.openCountry(set.country, { set: r }); R.highlightSet = r; }
  else UI.openTile(tx, ty);
};
UI.renderSide = (force) => {
  const sd = UI.state.side; const el = $('#side'); if (!sd) { el.classList.add('hidden'); return; }
  const scroll = el.querySelector('.sbody') ? el.querySelector('.sbody').scrollTop : 0;
  let html = '';
  if (sd.type === 'country') { const c = S.C(sd.id); if (!c) return UI.closeSide(); if (c.fallen != null) { html = countryFallenHTML(c); } else html = countryHTML(c, sd); }
  else if (sd.type === 'set') { const s = st().sets.get(sd.id); if (!s) return UI.closeSide(); html = setHTML(s); }
  else if (sd.type === 'tile') html = tileHTML(sd.x, sd.y);
  el.innerHTML = `<button class="x side-x" title="Close">✕</button>${html}`;
  el.classList.remove('hidden'); document.body.classList.add('side-open');
  const sb = el.querySelector('.sbody'); if (sb && !force) sb.scrollTop = scroll;
  el.querySelector('.side-x').addEventListener('click', UI.closeSide);
  $$('[data-stab]', el).forEach(b => b.addEventListener('click', () => { sd.tab = +b.dataset.stab; UI.renderSide(true); }));
  $$('[data-act]', el).forEach(b => b.addEventListener('click', () => sideAction(b.dataset.act, sd)));
};
function sideAction(a, sd) {
  const c = sd.type === 'country' ? S.C(sd.id) : sd.type === 'set' ? S.C(st().sets.get(sd.id).country) : null;
  switch (a) {
    case 'gallery': UI.openGallery(c.id); break;
    case 'dip': UI.openDiplomacy(c.id); break;
    case 'rename': UI.ask('Rename country', c.name, 'Country name').then(v => { if (v) { S.rename(c, v); R.invalidate(); UI.renderSide(true); } }); break;
    case 'flag': UI.openFlagEditor(c.id); break;
    case 'focus': { const cap = st().sets.get(c.capital); if (cap) R.focus(cap.x + 0.5, cap.y + 0.5); break; }
    case 'country': UI.openCountry(c.id); break;
    case 'setfocus': { const s = st().sets.get(sd.id); R.focus(s.x + 0.5, s.y + 0.5, 10); break; }
    case 'indep': { UI.toast(S.act.independence(sd.id), { kind: 'info' }); R.invalidate(); UI.renderSide(true); break; }
    case 'renameSet': { const s = st().sets.get(sd.id); UI.ask('Rename settlement', s.name, 'Settlement name').then(v => { if (v) { const old = s.name; st().names.delete(old); s.name = v; st().names.add(v); S.event(`${old} was renamed ${v}`, { k: 'set', c: [s.country] }); UI.renderSide(true); } }); break; }
  }
}
function govName(c) { return (S.GOVS[c.gov] || {}).name || c.gov; }
function regionalLangs(c) {
  const tot = {}; for (const s of S.countrySets(c)) for (const k in s.langs) tot[k] = (tot[k] || 0) + s.langs[k] * s.pop;
  const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(tot).map(([k, v]) => [+k, v / sum]).sort((a, b) => b[1] - a[1]);
}
function countryHTML(c, sd) {
  const s = st(); const y = Math.floor(s.year);
  const cap = s.sets.get(c.capital); const sets = S.countrySets(c).sort((a, b) => b.pop - a.pop);
  const allies = S.allies(c.id).map(S.C); const rels = S.relsOf(c.id);
  const rivals = rels.filter(([, r]) => r.s === 'rival').map(([o]) => S.C(o)); const trade = rels.filter(([, r]) => r.trade).map(([o]) => S.C(o));
  const wars = S.warsOf(c.id); const langs = regionalLangs(c);
  const tab = sd.tab || 0;
  let body = '';
  if (tab === 0) {
    const reg = sd.set ? s.sets.get(sd.set) : null;
    body = `${reg && reg.country === c.id ? `<div class="note">Region: <a href="#" data-sid="${reg.id}">${esc(reg.name)} ${S.REGION_WORD[c.era]}</a> · ${S.TIERS[reg.tier]} · ${U.fmt(reg.pop)} people${reg.occupier ? ` · <b class="warn">occupied by ${esc(cname(S.C(reg.occupier)))}</b>` : ''}</div>` : ''}
      <dl class="kv">
        <dt>Capital</dt><dd>${cap ? `<a href="#" data-sid="${cap.id}">${esc(cap.name)}</a>` : '—'}</dd>
        <dt>Founded</dt><dd>Year ${c.founded} <span class="dim">(${y - c.founded} years ago)</span></dd>
        <dt>Population</dt><dd>${U.fmt(c.pop)}</dd>
        <dt>Army</dt><dd>${U.fmt(c.army)} soldiers</dd>
        <dt>Land area</dt><dd>${U.fmt(c.area * AREA_KM)} km² <span class="dim">(${c.area} tiles)</span></dd>
        <dt>Settlements</dt><dd>${c.nsets} <span class="dim">(${sets.filter(x => x.tier >= 3).length} cities, ${sets.filter(x => x.tier === 2).length} towns)</span></dd>
        <dt>Government</dt><dd>${govName(c)}</dd>
        <dt>Culture</dt><dd>${esc(c.adj)} <span class="dim">(${c.culture.join(', ')})</span></dd>
        <dt>Official language</dt><dd><span class="ldot" style="background:${U.css((s.langs.get(c.lang) || { color: [128, 128, 128] }).color)}"></span>${esc(langName(c.lang))}</dd>
        <dt>Regional languages</dt><dd>${langs.filter(([k, v]) => k !== c.lang && v >= 0.02).slice(0, 5).map(([k, v]) => `${esc(langName(k))} <span class="dim">${Math.round(v * 100)}%</span>`).join(', ') || '<span class="dim">none</span>'}</dd>
      </dl>
      <div class="meter"><span>Technology: <b>${S.ERAS[c.era].name} Era</b></span>${bar((c.tech - c.era) * 100, U.css(S.ERAS[c.era].color))}</div>
      <div class="meter"><span>Economic development: <b>${c.dev}/100</b> <span class="dim">· GDP ${U.fmt(c.gdp)}</span></span>${bar(c.dev, '#6ac46a')}</div>
      <div class="meter"><span>Stability: <b>${Math.round(c.stability * 100)}%</b></span>${bar(c.stability * 100, c.stability < 0.35 ? '#e05050' : '#d8b040')}</div>
      <h4>Allies</h4><div class="chips">${allies.length ? allies.map(chip).join('') : '<span class="dim">None</span>'}</div>
      <h4>Rivals</h4><div class="chips">${rivals.length ? rivals.map(chip).join('') : '<span class="dim">None</span>'}</div>
      <h4>Current conflicts</h4>${wars.length ? wars.map(warHTML).join('') : '<div class="dim">At peace</div>'}
      <h4>Trade partners</h4><div class="chips">${trade.length ? trade.map(chip).join('') : '<span class="dim">None</span>'}</div>`;
  } else if (tab === 1) {
    body = `<table class="tbl click"><thead><tr><th>Settlement</th><th>Type</th><th class="r">Population</th></tr></thead><tbody>${sets.map(x => `<tr data-sid="${x.id}"><td>${x.capital ? '★ ' : ''}${esc(x.name)}${x.occupier ? ' <span class="warn">(occupied)</span>' : ''}</td><td>${S.TIERS[x.tier]}</td><td class="r">${U.fmt(x.pop)}</td></tr>`).join('')}</tbody></table>`;
  } else {
    const list = rels.filter(([o]) => S.C(o)).sort((a, b) => b[1].op - a[1].op);
    body = list.length ? `<table class="tbl"><tbody>${list.map(([o, r]) => `<tr><td>${chip(S.C(o))}</td><td>${statusBadge(r.s)}</td><td class="r op ${r.op < 0 ? 'neg' : 'pos'}">${r.op > 0 ? '+' : ''}${Math.round(r.op)}</td></tr>`).join('')}</tbody></table>` : '<div class="dim">No diplomatic contacts yet.</div>';
  }
  return `<div class="shead">${flagImg(c.flag, 66, 44)}<div><h2>${esc(c.name)}</h2><div class="sub">${govName(c)} · <span style="color:${U.css(U.shade(S.ERAS[c.era].color, 0.3))}">${S.ERAS[c.era].name} Era</span></div></div></div>
    <div class="stabs">${['Overview', `Settlements (${c.nsets})`, 'Relations'].map((n, i) => `<button data-stab="${i}" class="${tab === i ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="sbody">${body}</div>
    <div class="sfoot"><button data-act="gallery" class="primary">History gallery</button><button data-act="dip">Diplomacy</button><button data-act="rename">Rename</button><button data-act="flag">Flag & colour</button><button data-act="focus">Go to capital</button></div>`;
}
function countryFallenHTML(c) {
  return `<div class="shead">${flagImg(c.flag, 66, 44)}<div><h2>${esc(c.name)}</h2><div class="sub">Fallen in Year ${c.fallen}</div></div></div><div class="sbody"><p>${esc(c.fallReason)}</p></div><div class="sfoot"><button data-act="gallery" class="primary">History gallery</button></div>`;
}
function warHTML(w) {
  const att = w.att.map(S.C).filter(Boolean), def = w.def.map(S.C).filter(Boolean);
  const sc = U.clamp(w.score, -100, 100);
  return `<div class="war"><div class="wn">⚔ ${esc(w.name)} <span class="dim">since Year ${w.start}</span></div><div class="sides"><div>${att.map(chip).join('')}</div><span class="vs">vs</span><div>${def.map(chip).join('')}</div></div><div class="ws"><span class="dim">War score</span><span class="wbar"><i style="left:50%;width:${Math.abs(sc) / 2}%;${sc < 0 ? 'transform:translateX(-100%);background:#5a8ae0' : 'background:#e05a4a'}"></i></span><b>${sc > 0 ? '+' : ''}${sc}</b></div></div>`;
}
function infraList(s, c) {
  const st2 = st(); const W = st2.world.W; let streets = 0, roads = 0, rail = 0, farms = 0, walls = 0, fac = 0;
  for (const i of s.tiles) { if (st2.road[i] === 1) streets++; else if (st2.road[i] === 2) roads++; if (st2.rail[i]) rail++; const b = st2.bld[i]; if (b === S.BLD.FARM) farms++; else if (b === S.BLD.WALL) walls++; else if (b === S.BLD.FACTORY) fac++; }
  const out = [];
  if (streets) out.push(`${['Footpaths', 'Dirt streets', 'Cobbled streets', 'Paved streets', 'Paved streets', 'Asphalt streets'][c.era]}`);
  if (roads) out.push(c.era >= 5 ? 'Highway' : c.era >= 3 ? 'Improved roads' : 'Dirt roads');
  if (rail) out.push('Railway');
  if (s.port >= 0) out.push(['Fishing dock', 'Harbour', 'Harbour', 'Large port', 'Industrial port', 'Container port'][c.era]);
  if (walls) out.push('Town walls');
  if (s.market >= 0 && st2.bld[s.market] === S.BLD.MARKET) out.push(c.era >= 4 ? 'Shopping district' : 'Market');
  if (s.temple >= 0 && st2.bld[s.temple] === S.BLD.TEMPLE) out.push(c.era >= 2 ? 'Cathedral' : 'Temple');
  if (fac) out.push(`${fac} factor${fac > 1 ? 'ies' : 'y'}`);
  if (farms) out.push(`${farms} farm${farms > 1 ? 's' : ''}`);
  return out;
}
function setHTML(s) {
  const c = S.C(s.country); const st2 = st();
  const langs = Object.entries(s.langs).map(([k, v]) => [+k, v]).sort((a, b) => b[1] - a[1]);
  const dev = Math.round(U.clamp((s.tier * 20) + (c.era * 6) + (s.port >= 0 ? 4 : 0), 1, 100));
  const centre = ['Chieftain’s longhouse', 'Stone hall', c.capital === s.id ? 'Royal castle' : 'Keep', 'Palace', 'Town hall', 'Skyscraper district'][c.era];
  return `<div class="shead">${flagImg(c.flag, 48, 32)}<div><h2>${esc(s.name)}</h2><div class="sub">${S.TIERS[s.tier]}${s.capital ? ' · Capital' : ''} of ${chip(c)}</div></div></div>
    <div class="sbody">
      ${s.ruined != null ? `<div class="note warn">In ruins since Year ${s.ruined}</div>` : ''}
      ${s.occupier ? `<div class="note warn">Occupied by ${chip(S.C(s.occupier))}</div>` : ''}
      <dl class="kv">
        <dt>Region</dt><dd>${esc(s.name)} ${S.REGION_WORD[c.era]}</dd>
        <dt>Founded</dt><dd>Year ${s.founded} <span class="dim">(${Math.floor(st2.year) - s.founded} years ago)</span></dd>
        <dt>Population</dt><dd>${U.fmt(s.pop)} <span class="dim">(peak ${U.fmt(s.peak)})</span></dd>
        <dt>Area</dt><dd>${U.fmt(s.tiles.length * AREA_KM)} km²</dd>
        <dt>Development</dt><dd>${dev}/100 ${bar(dev)}</dd>
        <dt>Landmark</dt><dd>${centre}</dd>
      </dl>
      <h4>Infrastructure</h4><div class="dim">${infraList(s, c).join(' · ') || 'None yet'}</div>
      <h4>Languages spoken</h4>${langs.map(([k, v]) => { const l = st2.langs.get(k); return `<div class="lrow"><span class="ldot" style="background:${U.css(l ? l.color : [128, 128, 128])}"></span>${esc(l ? l.name : '?')}<span class="r">${Math.round(v * 100)}%</span>${bar(v * 100, l ? U.css(l.color) : null)}</div>`; }).join('')}
    </div>
    <div class="sfoot"><button data-act="setfocus" class="primary">Zoom to</button><button data-act="country">View country</button><button data-act="renameSet">Rename</button>${!s.capital && c.nsets > 1 ? '<button data-act="indep">Grant independence</button>' : ''}</div>`;
}
function tileHTML(x, y) {
  const s = st(); const w = s.world; const i = y * w.W + x; const b = T.BIOMES[w.biome[i]];
  const stack = T.stackNames(w, i);
  const band = s.bands.find(bb => Math.hypot(bb.x - x - 0.5, bb.y - y - 0.5) < 2);
  return `<div class="shead"><div class="swbig" style="background:${U.css(b.ground[0])}"></div><div><h2>${b.name}</h2><div class="sub">Tile ${x}, ${y} · ${s.region[i] ? 'Claimed' : 'Unclaimed'}</div></div></div>
  <div class="sbody"><dl class="kv">
    <dt>Terrain layers</dt><dd>${stack.map((n, k) => k === stack.length - 1 ? `<b>${n}</b>` : n).join(' → ')}</dd>
    <dt>Conditions</dt><dd>${b.cond}</dd>
    <dt>Temperature</dt><dd>${bar(w.temp[i] / 2.55, '#e0884a')}</dd>
    <dt>Moisture</dt><dd>${bar(w.moist[i] / 2.55, '#4a9ae0')}</dd>
    <dt>Farm yield</dt><dd>${T.food(w, i).toFixed(2)}</dd>
    <dt>Resources</dt><dd>Wood ${b.wood.toFixed(1)} · Stone ${b.stone.toFixed(1)}${b.fish ? ` · Fish ${b.fish.toFixed(1)}` : ''}</dd>
    <dt>Habitability</dt><dd>${bar(T.habit(w, i) * 85, '#6ac46a')}</dd>
  </dl>${band ? `<p class="note">A band of ${band.members.length} humans is nearby (${band.state === 'camp' ? 'camping' : band.state === 'travel' ? 'migrating' : 'exploring'}).</p>` : ''}
  <p class="dim small">Tip: the Eraser removes only the top layer, revealing what lies beneath.</p></div>`;
}

// ---------- people ----------
UI.showPerson = (p, sx, sy) => {
  let h;
  if (p.type === 'resident') {
    const s = st().sets.get(p.sid); if (!s) return; const r = S.resident(s, p.slot);
    h = `<b>${esc(r.g)} ${esc(r.f)}</b><div class="dim">${r.sex ? 'Female' : 'Male'}, ${r.age} years old</div><dl class="kv"><dt>Occupation</dt><dd>${r.occ}</dd><dt>Nationality</dt><dd>${esc(r.nat)}</dd><dt>Native language</dt><dd>${esc(r.lang)}</dd><dt>Home</dt><dd>${esc(r.home)}</dd></dl>`;
  } else {
    const b = p.band, hm = p.h; if (!hm) return; const c = b.country ? S.C(b.country) : null; const lg = st().langs.get(b.lang);
    const age = Math.floor(st().year) - hm.born;
    h = `<b>${esc(hm.g)} ${esc(hm.f)}</b><div class="dim">${hm.sex ? 'Female' : 'Male'}, ${age} years old</div><dl class="kv"><dt>Occupation</dt><dd>${age < 14 ? 'Child' : hm.occ}</dd><dt>Nationality</dt><dd>${c ? esc(c.name) : 'Stateless wanderer'}</dd><dt>Native language</dt><dd>${esc(lg ? lg.name : '—')}</dd><dt>Band</dt><dd>${b.members.length} people · ${b.state === 'camp' ? 'camping & gathering' : b.state === 'travel' ? 'migrating to new land' : 'exploring'}</dd></dl>`;
  }
  const d = $('#person'); d.innerHTML = h; d.classList.remove('hidden');
  d.style.left = Math.min(sx + 12, window.innerWidth - 250) + 'px'; d.style.top = Math.min(sy + 12, window.innerHeight - 200) + 'px';
};
UI.hidePerson = () => $('#person').classList.add('hidden');

// ---------- hover tooltip ----------
UI.hover = (tx, ty, sx, sy, wx, wy) => {
  const tip = $('#tip'); const s = st(); if (!s) return;
  const w = s.world; if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H || window.matchMedia('(pointer: coarse)').matches) { tip.classList.add('hidden'); return; }
  const i = ty * w.W + tx;
  let src = R.src(); const r = src.region[i]; let line2 = '';
  if (r) { const set = src.set(r); if (set) { const c = src.cty(set.country); line2 = `<div>${c ? esc(c.name) : ''}</div><div class="dim">${esc(set.name)} ${S.REGION_WORD[c ? c.era || 0 : 0]}${set.occupier ? ' · occupied' : ''}</div>`; if (R.mode === 'language') { const lg = s.langs.get(set.dom); if (lg) line2 += `<div class="dim">Speaks ${esc(lg.name)}</div>`; } } }
  tip.innerHTML = `<div><b>${T.BIOMES[w.biome[i]].name}</b> <span class="dim">${T.MATS[T.top(w, i)].name}</span></div>${line2}`;
  tip.classList.remove('hidden'); tip.style.left = (sx + 16) + 'px'; tip.style.top = (sy + 14) + 'px';
};
UI.tip = (v) => { if (!v) $('#tip').classList.add('hidden'); };

// ---------- nations & archive ----------
UI.openNations = (tab) => {
  const b = UI.modal('Nations of the World', '', { cls: 'wide' });
  const go = tabs(b, ['Living nations', 'Fallen civilizations archive'], (t, c) => {
    const list = Array.from(st().countries.values()).filter(x => t ? x.fallen != null : x.fallen == null).sort((a, bb) => t ? bb.fallen - a.fallen : bb.pop - a.pop);
    if (!list.length) { c.innerHTML = `<p class="dim">${t ? 'No civilization has fallen yet.' : 'No nations exist yet. Spawn humans with the Human or Group tools.'}</p>`; return; }
    c.innerHTML = `<div class="grid">${list.map(x => `<div class="card" data-gal="${x.id}">${flagImg(x.flag, 48, 32)}<div><b>${esc(x.name)}</b><div class="dim small">${t ? `${span(x.founded, x.fallen)} · ${esc(x.fallReason)}` : `${U.fmt(x.pop)} people · ${S.ERAS[x.era].name} · ${x.nsets} settlements`}</div></div></div>`).join('')}</div>`;
    $$('[data-gal]', c).forEach(el => el.addEventListener('click', () => { const id = +el.dataset.gal; if (t) UI.openGallery(id); else { UI.closeModal(); UI.openCountry(id); const cc = S.C(id); const cap = st().sets.get(cc.capital); if (cap) R.focus(cap.x + 0.5, cap.y + 0.5); } }));
  });
  if (tab) go(tab);
};

// ---------- historical gallery ----------
function maskCanvas(bs, color, view, base) {
  const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height; const g = cv.getContext('2d');
  g.drawImage(base, 0, 0);
  if (!bs) return cv;
  const sc = base.width / view.w; const [x0, y0, bw, bh] = bs.bb; const m = U.unrleN(bs.r, bw * bh, Uint8Array);
  g.fillStyle = U.css(color);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (m[y * bw + x]) g.fillRect(Math.floor((x0 + x - view.x) * sc), Math.floor((y0 + y - view.y) * sc), Math.ceil(sc), Math.ceil(sc));
  g.strokeStyle = 'rgba(20,14,26,0.9)'; g.lineWidth = Math.max(1, sc * 0.35);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    if (!m[y * bw + x]) continue; const px = (x0 + x - view.x) * sc, py = (y0 + y - view.y) * sc;
    g.beginPath();
    if (x === 0 || !m[y * bw + x - 1]) { g.moveTo(px, py); g.lineTo(px, py + sc); }
    if (x === bw - 1 || !m[y * bw + x + 1]) { g.moveTo(px + sc, py); g.lineTo(px + sc, py + sc); }
    if (y === 0 || !m[(y - 1) * bw + x]) { g.moveTo(px, py); g.lineTo(px + sc, py); }
    if (y === bh - 1 || !m[(y + 1) * bw + x]) { g.moveTo(px, py + sc); g.lineTo(px + sc, py + sc); }
    g.stroke();
  }
  return cv;
}
// a shared viewport around all of a country's recorded borders (3:2, padded)
function galleryView(list) {
  const s = st(); const W = s.world.W, H = s.world.H; let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (const b of list) { x0 = Math.min(x0, b.bb[0]); y0 = Math.min(y0, b.bb[1]); x1 = Math.max(x1, b.bb[0] + b.bb[2]); y1 = Math.max(y1, b.bb[1] + b.bb[3]); }
  if (x1 <= x0) return { x: 0, y: 0, w: W, h: H };
  let w = Math.max(40, (x1 - x0) * 1.5), h = Math.max(27, (y1 - y0) * 1.5);
  if (w / h > 1.5) h = w / 1.5; else w = h * 1.5;
  w = Math.min(W, Math.round(w)); h = Math.min(H, Math.round(h));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return { x: Math.round(U.clamp(cx - w / 2, 0, W - w)), y: Math.round(U.clamp(cy - h / 2, 0, H - h)), w, h };
}
function bordersOf(c) {
  const list = c.borders.slice();
  if (c.maxB && !list.some(b => b.y === c.maxB.y)) list.push(c.maxB);
  if (c.fallen == null) { const now = S.snapBorders(c, 'Present borders'); if (now) list.push(now); }
  list.sort((a, b) => a.y - b.y);
  const mx = list.reduce((m, b) => Math.max(m, b.area || 0), 0);
  return list.map(b => Object.assign({}, b, { largest: b.area === mx && mx > 0 }));
}
UI.openGallery = (cid) => {
  const c = S.C(cid); if (!c) return;
  const s = st(); const W = s.world.W;
  const b = UI.modal(`${flagImg(c.flag, 30, 20)} ${esc(c.name)} — Historical Gallery`, `<div class="ghead dim">${c.fallen != null ? `Existed ${span(c.founded, c.fallen)} · ${esc(c.fallReason)}` : `Founded Year ${c.founded} · ${Math.floor(s.year) - c.founded} years of history`}</div>`, { cls: 'wide' });
  tabs(b, ['Borders', 'Flags', 'Names & governments', 'Population', 'Statistics', 'Events'], (t, el) => {
    if (t === 0) {
      const list = bordersOf(c); if (!list.length) { el.innerHTML = '<p class="dim">No border records yet. Borders are recorded every few decades.</p>'; return; }
      const view = galleryView(list); const base = R.cropWorld(view.x, view.y, view.w, view.h, 300);
      el.innerHTML = '<div class="thumbs"></div>'; const box = el.firstChild;
      list.forEach((bs, k) => {
        const d = document.createElement('div'); d.className = 'thumb';
        const cv = maskCanvas(bs, c.color, view, base); d.appendChild(cv);
        d.insertAdjacentHTML('beforeend', `<div><b>Year ${bs.y}</b>${bs.largest ? ' <span class="badge b-allied">Largest</span>' : ''}<div class="dim small">${esc(bs.label)} · ${U.fmt((bs.area || 0) * AREA_KM)} km²</div></div>`);
        d.addEventListener('click', () => enlarge(list, k, view));
        box.appendChild(d);
      });
    } else if (t === 1) {
      el.innerHTML = `<div class="flags">${c.flags.slice().reverse().map(f => `<div class="fl">${flagImg(f.f, 96, 64)}<div><b>${span(f.from, f.to)}</b><div class="dim small">${F.PATTERN_NAMES[f.f.p] || ''}${f.f.e !== 'none' ? ' · ' + F.EMBLEM_NAMES[f.f.e] : ''}</div></div></div>`).join('')}</div>`;
    } else if (t === 2) {
      el.innerHTML = `<h4>Historical names</h4><ul class="timeline">${c.names.map(n => `<li><b>${esc(n.n)}</b> <span class="dim">(${span(n.from, n.to)})</span></li>`).join('')}</ul>
        <h4>Governments</h4><ul class="timeline">${c.govs.map(g => `<li>${(S.GOVS[g.g] || {}).name || g.g} <span class="dim">(${span(g.from, g.to)})</span></li>`).join('')}</ul>
        <h4>National colours</h4><div class="chips">${c.colors.map(x => `<span class="chip"><span class="ldot" style="background:${U.css(x.c)}"></span>since Year ${x.from}</span>`).join('')}</div>`;
    } else if (t === 3) {
      el.innerHTML = `<canvas class="chart" id="gpop"></canvas><div class="kvgrid" id="gsum"></div>`;
      Ch.line($('#gpop', el), [Ch.countrySeries(c, 1)], {});
      const P = c.peak; const sts = c.stats;
      let bestG = null, worstG = null;
      for (let k = 5; k < sts.length; k++) { const a = sts[k - 5][1], z = sts[k][1]; const d = z - a; if (!bestG || d > bestG[2]) bestG = [sts[k - 5][0], sts[k][0], d]; if (!worstG || d < worstG[2]) worstG = [sts[k - 5][0], sts[k][0], d]; }
      $('#gsum', el).innerHTML = `<div><span class="dim">Highest population</span><b>${U.fmt(P.pop)}</b><span class="dim">Year ${P.popY}</span></div>
        <div><span class="dim">Current population</span><b>${U.fmt(c.pop)}</b></div>
        <div><span class="dim">Fastest growth</span><b>${bestG && bestG[2] > 0 ? '+' + U.fmt(bestG[2]) : '—'}</b><span class="dim">${bestG && bestG[2] > 0 ? `Years ${bestG[0]}–${bestG[1]}` : ''}</span></div>
        <div><span class="dim">Sharpest decline</span><b>${worstG && worstG[2] < 0 ? U.fmt(worstG[2]) : '—'}</b><span class="dim">${worstG && worstG[2] < 0 ? `Years ${worstG[0]}–${worstG[1]}` : ''}</span></div>`;
    } else if (t === 4) {
      el.innerHTML = `<div class="seg mets">${Ch.METRICS.filter(m => m.k !== 1).map((m, i) => `<button data-mk="${m.k}" class="${i ? '' : 'on'}">${m.name}</button>`).join('')}</div><canvas class="chart" id="gst"></canvas>
        <div class="kvgrid"><div><span class="dim">Largest army</span><b>${U.fmt(c.peak.army)}</b><span class="dim">Year ${c.peak.armyY}</span></div><div><span class="dim">Largest territory</span><b>${U.fmt(c.peak.area * AREA_KM)} km²</b><span class="dim">Year ${c.peak.areaY}</span></div><div><span class="dim">Most settlements</span><b>${c.peak.sets}</b><span class="dim">Year ${c.peak.setsY}</span></div><div><span class="dim">Wars fought</span><b>${Array.from(st().wars.values()).filter(w => w.att.includes(c.id) || w.def.includes(c.id)).length}</b></div></div>`;
      const draw = (k) => Ch.line($('#gst', el), [Ch.countrySeries(c, k)], { fmt: k === 5 ? (v) => v.toFixed(1) : U.fmt });
      $$('[data-mk]', el).forEach(bt => bt.addEventListener('click', () => { $$('[data-mk]', el).forEach(x => x.classList.toggle('on', x === bt)); draw(+bt.dataset.mk); }));
      draw(2);
    } else {
      el.innerHTML = `<ul class="events">${c.events.filter(e => e.k !== 'trade' && e.k !== 'band').map(e => `<li><b>Year ${e.y}</b> ${esc(e.t)}</li>`).join('') || '<li class="dim">Nothing recorded yet.</li>'}</ul>`;
    }
  });
  function enlarge(list, k, view) {
    const bs = list[k]; const outW = Math.min(900, window.innerWidth - 60, (window.innerHeight * 0.62) * view.w / view.h);
    const cv = maskCanvas(bs, c.color, view, R.cropWorld(view.x, view.y, view.w, view.h, outW));
    const box = document.createElement('div'); box.className = 'enlarge';
    box.innerHTML = `<div class="eh"><button class="ghost" data-d="-1" ${k ? '' : 'disabled'}>◀</button><b>Year ${bs.y} — ${esc(bs.label)}</b><button class="ghost" data-d="1" ${k < list.length - 1 ? '' : 'disabled'}>▶</button><button class="ghost" data-d="0">Close</button></div>`;
    box.appendChild(cv);
    box.addEventListener('click', (e) => { const d = e.target.closest('[data-d]'); if (!d) return; box.remove(); const dd = +d.dataset.d; if (dd) enlarge(list, k + dd, view); });
    b.appendChild(box);
  }
};

// ---------- flag editor ----------
UI.openFlagEditor = (cid) => {
  const c = S.C(cid); const f = JSON.parse(JSON.stringify(c.flag)); let col = c.color.slice();
  const b = UI.modal(`Flag & colours — ${esc(c.name)}`, `<div class="flagedit"><canvas id="fprev" width="240" height="160"></canvas><form class="form" id="ff">
    <label>Pattern<select name="p">${F.PATTERNS.map(p => `<option value="${p}" ${p === f.p ? 'selected' : ''}>${F.PATTERN_NAMES[p]}</option>`).join('')}</select></label>
    <div class="row3"><label>Colour 1<input type="color" name="c0" value="${f.c[0]}"></label><label>Colour 2<input type="color" name="c1" value="${f.c[1]}"></label><label>Colour 3<input type="color" name="c2" value="${f.c[2]}"></label></div>
    <label>Emblem<select name="e">${F.EMBLEMS.map(p => `<option value="${p}" ${p === f.e ? 'selected' : ''}>${F.EMBLEM_NAMES[p]}</option>`).join('')}</select></label>
    <div class="row3"><label>Emblem colour<input type="color" name="ec" value="${f.ec}"></label><label>Position<select name="ep"><option value="center" ${f.ep !== 'canton' ? 'selected' : ''}>Centre</option><option value="canton" ${f.ep === 'canton' ? 'selected' : ''}>Canton</option></select></label><label>Map colour<input type="color" name="nc" value="${U.hex(col)}"></label></div>
    <div class="btnrow"><button type="button" class="ghost" id="frnd">Randomize</button><button class="primary">Adopt</button></div></form></div><p class="dim small">Previous flags and colours stay in the country's historical gallery.</p>`, { cls: 'mid' });
  const form = $('#ff', b), cv = $('#fprev', b);
  const draw = () => { const g = cv.getContext('2d'); g.clearRect(0, 0, 240, 160); F.draw(g, f, 0, 0, 240, 160); };
  form.addEventListener('input', () => { f.p = form.p.value; f.c = [form.c0.value, form.c1.value, form.c2.value]; f.e = form.e.value; f.ec = form.ec.value; f.ep = form.ep.value; draw(); });
  $('#frnd', b).addEventListener('click', () => { const n = F.generate(new U.RNG(Math.random() * 1e9), U.fromHex(form.nc.value)); Object.assign(f, n); form.p.value = f.p; form.c0.value = f.c[0]; form.c1.value = f.c[1]; form.c2.value = f.c[2]; form.e.value = f.e; form.ec.value = f.ec; form.ep.value = f.ep; draw(); });
  form.addEventListener('submit', (e) => { e.preventDefault(); const nc = U.fromHex(form.nc.value); if (JSON.stringify(f) !== JSON.stringify(c.flag)) S.setFlag(c, JSON.parse(JSON.stringify(f))); if (U.hex(nc) !== U.hex(c.color)) S.setColor(c, nc); R.invalidate(); UI.closeModal(); UI.renderSide(true); });
  draw();
};

// ---------- diplomacy ----------
UI.openDiplomacy = (preA) => {
  const live = st().live.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (live.length < 1) { UI.modal('Diplomacy', '<p class="dim">There are no nations yet.</p>', { cls: 'mid' }); return; }
  const opts = (sel) => live.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const a0 = preA || UI.state.dipA || live[0].id; const b0 = UI.state.dipB && UI.state.dipB !== a0 && S.C(UI.state.dipB) && S.C(UI.state.dipB).fallen == null ? UI.state.dipB : (live.find(c => c.id !== a0) || live[0]).id;
  const b = UI.modal('Diplomacy', `<div class="dip"><div class="dsel"><label>Country A<select id="dA">${opts(a0)}</select></label><label>Country B<select id="dB">${opts(b0)}</select></label></div>
    <div id="dRel" class="drel"></div>
    <div class="dacts">
      <button data-d="war" class="danger">Declare war (A → B)</button><button data-d="peace">Force peace</button>
      <button data-d="ally">Create alliance</button><button data-d="breakAlly">Break alliance</button>
      <button data-d="improve">Improve relations</button><button data-d="worsen">Worsen relations</button>
      <button data-d="unite">Unite (A absorbs B)</button>
    </div>
    <div class="dacts two"><button data-d="pickTransfer">Transfer a region to B… (click map)</button><button data-d="pickIndep">Grant independence to a region… (click map)</button></div>
    <div id="dWorld"></div></div>`, { cls: 'wide' });
  const A = () => +$('#dA', b).value, B = () => +$('#dB', b).value;
  const refresh = () => {
    UI.state.dipA = A(); UI.state.dipB = B();
    const ca = S.C(A()), cb = S.C(B()); const r = S.relGet(A(), B());
    $('#dRel', b).innerHTML = A() === B() ? '<div class="dim">Choose two different countries.</div>' : `${chip(ca)} ${statusBadge(r ? r.s : 'neutral')} ${chip(cb)}<div class="dim small">Opinion ${r ? Math.round(r.op) : 0} · ${r && r.trade ? 'Trading partners' : 'No trade'} · Shared border: ${S.border(A(), B())} tiles · Strength ${U.fmt(ca.army)} vs ${U.fmt(cb.army)}</div>`;
    const wars = Array.from(st().wars.values()).filter(w => w.end == null);
    const alls = []; for (const [k, rr] of st().rel) if (rr.s === 'allied') { const x = S.C(Math.floor(k / 65536)), y = S.C(k % 65536); if (x && y && x.fallen == null && y.fallen == null) alls.push([x, y]); }
    $('#dWorld', b).innerHTML = `<h4>Active wars (${wars.length})</h4>${wars.map(warHTML).join('') || '<div class="dim">The world is at peace.</div>'}<h4>Alliances (${alls.length})</h4><div class="alls">${alls.map(([x, y]) => `<div>${chip(x)}<span class="dim">⇄</span>${chip(y)}</div>`).join('') || '<div class="dim">None</div>'}</div>`;
  };
  b.addEventListener('change', refresh);
  b.addEventListener('click', (e) => {
    const d = e.target.closest('[data-d]'); if (!d) return; const k = d.dataset.d;
    if (k === 'pickTransfer' || k === 'pickIndep') { UI.state.pickTarget = B(); UI.closeModal(); UI.setTool(k === 'pickTransfer' ? 'transfer' : 'indep'); const h = $('#pickHint'); h.innerHTML = k === 'pickTransfer' ? `Click a region on the map to transfer it to <b>${esc(S.C(B()).name)}</b>. <button class="ghost">Done</button>` : 'Click a region on the map to make it independent. <button class="ghost">Done</button>'; h.classList.remove('hidden'); h.querySelector('button').onclick = () => UI.setTool('inspect'); if (R.mode === 'terrain') UI.setMode('admin'); return; }
    if (A() === B()) { UI.toast('Choose two different countries.', { kind: 'warn' }); return; }
    const msg = S.act[k](A(), B()); UI.toast(msg, { kind: 'info' }); R.invalidate();
    if (k === 'unite') { UI.closeModal(); UI.openDiplomacy(A()); return; }
    refresh(); UI.renderSide();
  });
  refresh();
};
UI.regionPicked = (tool, sid) => {
  if (!sid) { UI.toast('That tile does not belong to any region.', { kind: 'warn' }); return; }
  const msg = tool === 'transfer' ? S.act.transfer(sid, UI.state.pickTarget) : S.act.independence(sid);
  UI.toast(msg, { kind: 'info' }); R.invalidate(); UI.renderSide();
};

// ---------- statistics ----------
const RANKS = [
  ['Population', (c) => c.pop, U.fmt], ['Army size', (c) => c.army, U.fmt], ['Land area', (c) => c.area * AREA_KM, (v) => U.fmt(v) + ' km²'],
  ['Economy', (c) => c.gdp, U.fmt], ['Technology', (c) => c.tech, (v, c) => `${S.ERAS[Math.floor(Math.min(5, v))].name} (${v.toFixed(2)})`],
  ['Cities', (c) => S.countrySets(c).filter(s => s.tier >= 3).length + S.countrySets(c).length / 1000, (v) => String(Math.floor(v))],
  ['Country age', (c) => Math.floor(st().year) - c.founded, (v) => v + ' years'],
  ['Population growth', (c) => { const s = c.stats; if (s.length < 6) return 0; const a = s[s.length - 6][1]; return a > 0 ? (c.pop - a) / a * 100 : 0; }, (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '% / 50y'],
];
UI.openStats = (tab) => {
  UI.state.cmp = UI.state.cmp || new Set();
  const b = UI.modal('World Statistics', '', { cls: 'wide' });
  const go = tabs(b, ['Rankings', 'Compare countries', 'World', 'Languages', 'Chronicle'], (t, el) => {
    if (t === 0) {
      let mk = UI.state.rankMetric || 0;
      const draw = () => {
        const [name, fn, fmt] = RANKS[mk]; const live = st().live.slice().sort((a, bb) => fn(bb) - fn(a));
        el.innerHTML = `<div class="seg mets">${RANKS.map((r, i) => `<button data-rk="${i}" class="${i === mk ? 'on' : ''}">${r[0]}</button>`).join('')}</div>
          <table class="tbl rank"><thead><tr><th>#</th><th>Country</th><th class="r">${name}</th><th class="c">Compare</th></tr></thead><tbody>${live.map((c, i) => `<tr><td>${i + 1}</td><td>${chip(c)}</td><td class="r">${fmt(fn(c), c)}</td><td class="c"><input type="checkbox" data-cmp="${c.id}" ${UI.state.cmp.has(c.id) ? 'checked' : ''}></td></tr>`).join('') || '<tr><td colspan="4" class="dim">No nations yet.</td></tr>'}</tbody></table>
          <div class="btnrow"><button class="primary" id="goCmp">Compare selected (${UI.state.cmp.size})</button></div>`;
        $$('[data-rk]', el).forEach(x => x.addEventListener('click', () => { mk = UI.state.rankMetric = +x.dataset.rk; draw(); }));
        $$('[data-cmp]', el).forEach(x => x.addEventListener('change', () => { const id = +x.dataset.cmp; if (x.checked) UI.state.cmp.add(id); else UI.state.cmp.delete(id); $('#goCmp', el).textContent = `Compare selected (${UI.state.cmp.size})`; }));
        $('#goCmp', el).addEventListener('click', () => go(1));
      };
      draw();
    } else if (t === 1) {
      const all = Array.from(st().countries.values()).sort((a, bb) => (a.fallen != null) - (bb.fallen != null) || bb.peak.pop - a.peak.pop);
      if (!UI.state.cmp.size) st().live.slice().sort((a, bb) => bb.pop - a.pop).slice(0, 4).forEach(c => UI.state.cmp.add(c.id));
      let mk = UI.state.cmpMetric || 1;
      el.innerHTML = `<div class="cmp"><div class="cmpl"><input id="cmpq" placeholder="Filter countries…"><div class="cmplist">${all.map(c => `<label data-nm="${esc(c.name.toLowerCase())}"><input type="checkbox" data-c="${c.id}" ${UI.state.cmp.has(c.id) ? 'checked' : ''}>${flagImg(c.flag, 18, 12)}<span>${esc(c.name)}${c.fallen != null ? ' <span class="dim">(fallen)</span>' : ''}</span></label>`).join('')}</div></div>
        <div class="cmpr"><div class="seg mets">${Ch.METRICS.map(m => `<button data-mk="${m.k}" class="${m.k === mk ? 'on' : ''}">${m.name}</button>`).join('')}</div><canvas class="chart tall" id="cmpc"></canvas></div></div>`;
      const draw = () => { const ser = Array.from(UI.state.cmp).map(S.C).filter(Boolean).map(c => Ch.countrySeries(c, mk)); Ch.line($('#cmpc', el), ser, { fmt: mk === 5 ? (v) => v.toFixed(1) : U.fmt }); };
      $$('[data-c]', el).forEach(x => x.addEventListener('change', () => { const id = +x.dataset.c; if (x.checked) UI.state.cmp.add(id); else UI.state.cmp.delete(id); draw(); }));
      $$('[data-mk]', el).forEach(x => x.addEventListener('click', () => { mk = UI.state.cmpMetric = +x.dataset.mk; $$('[data-mk]', el).forEach(y => y.classList.toggle('on', y === x)); draw(); }));
      $('#cmpq', el).addEventListener('input', (e) => { const q = e.target.value.toLowerCase(); $$('.cmplist label', el).forEach(l => l.classList.toggle('hidden', !l.dataset.nm.includes(q))); });
      draw();
    } else if (t === 2) {
      const ws = st().wstats; const ser = (k, name, col) => ({ name, color: col, pts: ws.map(r => [r[0], r[k]]) });
      const M = [[1, 'World population', [240, 200, 90]], [2, 'Number of countries', [120, 180, 240]], [3, 'Number of settlements', [140, 220, 140]], [4, 'Living languages', [220, 140, 220]], [5, 'Soldiers under arms', [230, 100, 90]], [6, 'Active wars', [240, 120, 60]]];
      let mk = 0;
      const last = ws[ws.length - 1] || [0, 0, 0, 0, 0, 0, 0];
      el.innerHTML = `<div class="kvgrid"><div><span class="dim">Year</span><b>${Math.floor(st().year)}</b></div><div><span class="dim">Population</span><b>${U.fmt(last[1])}</b></div><div><span class="dim">Countries</span><b>${st().live.length}</b></div><div><span class="dim">Fallen</span><b>${st().countries.size - st().live.length}</b></div><div><span class="dim">Settlements</span><b>${st().liveSets.length}</b></div><div><span class="dim">Languages</span><b>${last[4]}</b></div></div>
        <div class="seg mets">${M.map((m, i) => `<button data-wk="${i}" class="${i ? '' : 'on'}">${m[1]}</button>`).join('')}</div><canvas class="chart tall" id="wch"></canvas>`;
      const draw = () => Ch.line($('#wch', el), [ser(M[mk][0], M[mk][1], M[mk][2])], {});
      $$('[data-wk]', el).forEach(x => x.addEventListener('click', () => { mk = +x.dataset.wk; $$('[data-wk]', el).forEach(y => y.classList.toggle('on', y === x)); draw(); }));
      draw();
    } else if (t === 3) {
      const sp = S.speakers(); const s2 = st();
      const off = new Map(); for (const c of s2.live) { if (!off.has(c.lang)) off.set(c.lang, []); off.get(c.lang).push(c); }
      const langs = Array.from(s2.langs.values()).sort((a, bb) => (sp.get(bb.id) || 0) - (sp.get(a.id) || 0));
      el.innerHTML = `<table class="tbl"><thead><tr><th>Language</th><th>Family</th><th class="r">Speakers</th><th>Official in</th><th>Since</th></tr></thead><tbody>${langs.map(l => { const fam = s2.langs.get(L.family(s2, l)); const par = l.parent ? s2.langs.get(l.parent) : null; return `<tr class="${l.extinct != null ? 'dimrow' : ''}"><td><span class="ldot" style="background:${U.css(l.color)}"></span><b>${esc(l.name)}</b>${l.dialect ? ' <span class="badge b-neutral">dialect</span>' : ''}${l.extinct != null ? ` <span class="dim">extinct ${l.extinct}</span>` : ''}${par ? `<div class="dim small">from ${esc(par.name)}</div>` : ''}</td><td>${fam && fam !== l ? esc(fam.name) : '<span class="dim">—</span>'}</td><td class="r">${U.fmt(sp.get(l.id) || 0)}</td><td>${(off.get(l.id) || []).map(chip).join('') || '<span class="dim">—</span>'}</td><td>${l.born}</td></tr>`; }).join('') || '<tr><td colspan="5" class="dim">No languages yet.</td></tr>'}</tbody></table>`;
    } else {
      const evs = st().events;
      el.innerHTML = `<div class="row"><input id="chq" placeholder="Search events…"><label class="inl"><input type="checkbox" id="chimp" checked> Important only</label></div><ul class="events" id="chl"></ul>`;
      const draw = () => { const q = $('#chq', el).value.toLowerCase(); const imp = $('#chimp', el).checked; const out = []; for (let k = evs.length - 1; k >= 0 && out.length < 600; k--) { const e = evs[k]; if (imp && !e.imp) continue; if (q && !e.t.toLowerCase().includes(q)) continue; out.push(e); } $('#chl', el).innerHTML = out.map(e => `<li ${e.x != null ? `data-focus="${e.x},${e.yy}"` : ''}><b>Year ${e.y}</b> ${esc(e.t)}</li>`).join('') || '<li class="dim">No events.</li>'; };
      $('#chq', el).addEventListener('input', draw); $('#chimp', el).addEventListener('change', draw); draw();
    }
  });
  if (tab) go(tab);
};

// ---------- timelapse ----------
UI.timelapseActive = () => !!UI.state.tl;
UI.startTimelapse = () => {
  const s = st(); const n = s.hist.snaps.length;
  if (n < 2) { UI.toast('Not enough history has been recorded yet. Snapshots are taken every 10 years.', { kind: 'warn' }); return; }
  UI.closeModal(); UI.hidePerson();
  UI.state.tl = { k: 0, playing: true, rate: 4, acc: 0, filter: 0, prevSpeed: UI.state.speed, prevSel: R.sel, mode: R.mode };
  UI.setSpeed(0); UI.state.tl.prevSpeed = UI.state.prev; UI.closeSide();
  if (R.mode === 'terrain' || R.mode === 'diplomacy') UI.setMode('political');
  document.body.classList.add('tl-on');
  const all = Array.from(s.countries.values()).sort((a, b) => a.name.localeCompare(b.name));
  $('#tlbar').innerHTML = `<div class="tlrow"><button id="tlPrev" title="Previous event">⏮</button><button id="tlPlay" title="Play / pause">❚❚</button><button id="tlNext" title="Next event">⏭</button>
    <select id="tlRate" title="Playback speed"><option value="1">1×</option><option value="2">2×</option><option value="4" selected>4×</option><option value="8">8×</option><option value="16">16×</option></select>
    <input type="range" id="tlSlider" min="0" max="${n - 1}" value="0"><b id="tlYear">Year 0</b>
    <select id="tlFilter"><option value="0">All countries</option>${all.map(c => `<option value="${c.id}">${esc(c.names[0].n)}${c.names.length > 1 ? ' / ' + esc(c.name) : ''}</option>`).join('')}</select>
    <button id="tlExit" class="primary">Exit timelapse</button></div><div id="tlCap" class="tlcap"></div>`;
  $('#tlbar').classList.remove('hidden');
  $('#tlPlay').onclick = () => { const t = UI.state.tl; t.playing = !t.playing; if (t.playing && t.k >= n - 1) t.k = 0; $('#tlPlay').textContent = t.playing ? '❚❚' : '▶'; };
  $('#tlRate').onchange = (e) => { UI.state.tl.rate = +e.target.value; };
  $('#tlSlider').oninput = (e) => { UI.tlSet(+e.target.value); };
  $('#tlFilter').onchange = (e) => { UI.state.tl.filter = +e.target.value; R.sel = UI.state.tl.filter; R.invalidate(); };
  $('#tlPrev').onclick = () => UI.tlJump(-1); $('#tlNext').onclick = () => UI.tlJump(1);
  $('#tlExit').onclick = () => UI.exitTimelapse();
  UI.tlSet(0);
};
UI.tlSet = (k) => {
  const t = UI.state.tl; const s = st(); k = U.clamp(Math.round(k), 0, s.hist.snaps.length - 1); t.k = k;
  R.tl = H.view(s, k); R.invalidate();
  $('#tlSlider').value = k; $('#tlYear').textContent = 'Year ' + R.tl.year;
  const evs = tlEvents(); let cap = null; for (const e of evs) { if (e.y <= R.tl.year && e.y > R.tl.year - 10) cap = e; }
  if (cap) $('#tlCap').innerHTML = `<b>Year ${cap.y}</b> ${esc(cap.t)}`;
  else if (!$('#tlCap').innerHTML) $('#tlCap').innerHTML = '<span class="dim">Watching the world evolve…</span>';
};
function tlEvents() { const f = UI.state.tl.filter; return st().events.filter(e => e.imp && e.k !== 'tech' && (!f || e.c.includes(f))); }
UI.tlJump = (d) => {
  const t = UI.state.tl; const y = R.tl.year; const evs = tlEvents(); let e = null;
  if (d > 0) e = evs.find(x => x.y > y); else for (let k = evs.length - 1; k >= 0; k--) if (evs[k].y < y - (y % 10 === 0 ? 0 : 0) - 1) { e = evs[k]; break; }
  if (!e) { UI.toast(d > 0 ? 'No later events.' : 'No earlier events.', { kind: 'info' }); return; }
  t.playing = false; $('#tlPlay').textContent = '▶';
  let k = H.indexOf(st(), e.y); if (st().hist.snaps[k].y < e.y && k < st().hist.snaps.length - 1) k++;
  UI.tlSet(k); $('#tlCap').innerHTML = `<b>Year ${e.y}</b> ${esc(e.t)}`;
  if (e.x != null) R.focus(e.x + 0.5, e.yy + 0.5);
};
UI.tlUpdate = (dt) => {
  const t = UI.state.tl; if (!t || !t.playing) return;
  t.acc += dt * t.rate; if (t.acc < 1) return;
  const steps = Math.floor(t.acc); t.acc -= steps; const n = st().hist.snaps.length;
  if (t.k >= n - 1) { t.playing = false; $('#tlPlay').textContent = '▶'; return; }
  UI.tlSet(Math.min(n - 1, t.k + steps));
};
UI.tlClick = (tx, ty) => {
  const v = R.tl; const i = ty * st().world.W + tx; const r = v.region[i]; if (!r) return; const s = v.sets.get(r); if (!s) return; const c = v.cty.get(s.country);
  UI.toast(`Year ${v.year}: ${s.name} — ${c ? c.name : '?'} (${S.TIERS[s.tier]}, ${U.fmt(s.pop)} people)`, { kind: 'info' });
};
UI.exitTimelapse = () => {
  const t = UI.state.tl; if (!t) return; UI.state.tl = null; R.tl = null; R.sel = t.prevSel; R.invalidate();
  $('#tlbar').classList.add('hidden'); document.body.classList.remove('tl-on');
  UI.setSpeed(0); UI.state.prev = t.prevSpeed || 1;
  UI.toast('Back to the present. The simulation is paused — press a speed to resume.', { kind: 'info' });
};

// ---------- saves ----------
UI.currentMeta = () => ({ name: UI.state.name, id: UI.state.id, cam: { x: R.cam.x, y: R.cam.y, z: R.cam.tz }, mode: R.mode });
UI.saveTo = (id, name, quiet) => {
  const meta = UI.currentMeta(); meta.name = name || meta.name; meta.id = UI.state.id;
  const text = Save.serialize(st(), meta);
  return Save.put(id, { name: meta.name, year: Math.floor(st().year), size: `${st().world.W}×${st().world.H}`, nations: st().live.length, world: UI.state.id, auto: id.startsWith('auto') }, text)
    .then(() => { if (!quiet) UI.toast(`Saved “${meta.name}” (${(text.length / 1e6).toFixed(1)} MB)`, { kind: 'info' }); })
    .catch((e) => UI.toast('Saving failed: ' + e.message, { kind: 'warn' }));
};
UI.loadText = (text, nameOverride) => {
  const { st: s, meta } = Save.deserialize(text);
  R.setState(s); Tools.reset(); UI.closeSide();
  UI.state.name = nameOverride || meta.name || 'Loaded World'; UI.state.id = meta.id || ('w' + Date.now().toString(36));
  if (meta.cam) { R.cam.x = meta.cam.x; R.cam.y = meta.cam.y; R.cam.z = R.cam.tz = meta.cam.z; }
  UI.setMode(meta.mode || 'political'); UI.setSpeed(0); UI.updateTop(true);
  UI.toast(`Loaded “${UI.state.name}” — Year ${Math.floor(s.year)}. Paused.`, { kind: 'info' });
};
UI.loadSave = (id) => {
  UI.busy('Loading world…', () => {});
  Promise.all([Save.get(id), Save.list()]).then(([text, list]) => { if (!text) throw new Error('Save not found'); const m = list.find(x => x.id === id); UI.loadText(text, m && m.name); }).catch((e) => UI.toast('Loading failed: ' + e.message, { kind: 'warn' }));
};
UI.openSaves = () => {
  const b = UI.modal('Save & Load Worlds', `<div class="saves">
    <div class="row"><input id="svName" value="${esc(UI.state.name)}" maxlength="40"><button class="primary" id="svSave">Save</button><button id="svNew">Save as new slot</button></div>
    <div class="row"><button id="svExport">Export JSON file</button><label class="filebtn">Import JSON file<input type="file" id="svImport" accept=".json,application/json"></label>
      <label class="inl">Autosave <select id="svAuto">${[0, 1, 3, 5, 10].map(m => `<option value="${m}" ${UI.cfg.autosave === m ? 'selected' : ''}>${m ? 'every ' + m + ' min' : 'off'}</option>`).join('')}</select></label></div>
    <h4>Saved worlds</h4><div id="svList" class="svlist"><div class="dim">Loading…</div></div></div>`, { cls: 'mid' });
  const list = () => Save.list().then(items => {
    $('#svList', b).innerHTML = items.length ? items.map(m => `<div class="svi"><div><b>${esc(m.name)}</b>${m.auto ? ' <span class="badge b-neutral">autosave</span>' : ''}<div class="dim small">Year ${m.year} · ${m.size} · ${m.nations} nations · ${new Date(m.savedAt).toLocaleString()} · ${(m.bytes / 1e6).toFixed(1)} MB</div></div><div class="btns"><button data-ld="${m.id}" class="primary">Load</button><button data-rn="${m.id}">Rename</button><button data-dl="${m.id}" class="danger">Delete</button></div></div>`).join('') : '<div class="dim">No saved worlds yet.</div>';
  }).catch(e => { $('#svList', b).innerHTML = `<div class="warn">Browser storage is unavailable (${esc(e.message)}). You can still export and import JSON files.</div>`; });
  list();
  $('#svSave', b).onclick = () => { const n = $('#svName', b).value.trim() || UI.state.name; UI.state.name = n; UI.saveTo('slot_' + UI.state.id, n).then(list); };
  $('#svNew', b).onclick = () => { const n = $('#svName', b).value.trim() || UI.state.name; UI.state.name = n; UI.saveTo('slot_' + UI.state.id + '_' + Date.now().toString(36), n).then(list); };
  $('#svExport', b).onclick = () => { const t = Save.serialize(st(), UI.currentMeta()); U.download(`${UI.state.name.replace(/[^\w-]+/g, '_')}_year${Math.floor(st().year)}.json`, t); };
  $('#svImport', b).onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { UI.closeModal(); UI.loadText(rd.result); } catch (err) { UI.toast('Import failed: ' + err.message, { kind: 'warn' }); } }; rd.readAsText(f); };
  $('#svAuto', b).onchange = (e) => { UI.cfg.autosave = +e.target.value; UI.saveCfg(); };
  $('#svList', b).addEventListener('click', (e) => {
    const ld = e.target.closest('[data-ld]'), rn = e.target.closest('[data-rn]'), dl = e.target.closest('[data-dl]');
    if (ld) { UI.closeModal(); UI.loadSave(ld.dataset.ld); }
    if (rn) { const id = rn.dataset.rn; Save.list().then(items => { const m = items.find(x => x.id === id); UI.ask('Rename world', m ? m.name : '', 'World name').then(v => { if (v) Save.rename(id, v).then(() => { if (UI.state.id && id.includes(UI.state.id)) UI.state.name = v; UI.openSaves(); }); else UI.openSaves(); }); }); }
    if (dl) { if (dl.dataset.confirm) { Save.del(dl.dataset.dl).then(list); } else { dl.dataset.confirm = '1'; dl.textContent = 'Confirm delete'; } }
  });
};
UI.autosave = (now) => {
  const m = UI.cfg.autosave; if (!m || !st() || UI.state.tl) return;
  if (!UI.state.lastAuto) { UI.state.lastAuto = now; return; }
  if (now - UI.state.lastAuto > m * 60) { UI.state.lastAuto = now; UI.saveTo('auto_' + UI.state.id, UI.state.name, true).then(() => { const d = $('#autoInd'); d.classList.add('show'); setTimeout(() => d.classList.remove('show'), 1800); }); }
};

// ---------- settings & help ----------
UI.openSettings = () => {
  const b = UI.modal('Settings', `<form class="form" id="cfg">
    <label class="inl"><input type="checkbox" name="clouds" ${UI.cfg.clouds ? 'checked' : ''}> Moving clouds</label>
    <label class="inl"><input type="checkbox" name="particles" ${UI.cfg.particles ? 'checked' : ''}> Environmental particles (smoke, snow, leaves)</label>
    <label class="inl"><input type="checkbox" name="labels" ${UI.cfg.labels ? 'checked' : ''}> Country & settlement names on the map</label>
    <label class="inl"><input type="checkbox" name="notify" ${UI.cfg.notify ? 'checked' : ''}> World event notifications</label>
    <label>Autosave<select name="autosave">${[0, 1, 3, 5, 10].map(m => `<option value="${m}" ${UI.cfg.autosave === m ? 'selected' : ''}>${m ? 'Every ' + m + ' minutes' : 'Off'}</option>`).join('')}</select></label>
  </form>`, { cls: 'small' });
  $('#cfg', b).addEventListener('change', (e) => { const f = e.currentTarget; UI.cfg.clouds = f.clouds.checked; UI.cfg.particles = f.particles.checked; UI.cfg.labels = f.labels.checked; UI.cfg.notify = f.notify.checked; UI.cfg.autosave = +f.autosave.value; R.showClouds = UI.cfg.clouds; R.particlesOn = UI.cfg.particles; R.showLabels = UI.cfg.labels; UI.saveCfg(); });
};
UI.openHelp = () => {
  UI.modal('How to play', `<div class="help">
    <p><b>Goal:</b> shape a world, place the first humans and watch thousands of years of history unfold. Humans explore, camp, settle, farm and multiply; villages become towns and cities; tribes become kingdoms, empires and republics.</p>
    <h4>Camera</h4><ul><li>Drag with the Inspect tool, right or middle mouse button, or hold <kbd>Space</kbd> to pan. Two fingers on touch screens.</li><li>Mouse wheel / pinch to zoom. Zoom in to see buildings, farms, roads, trees and people.</li><li><kbd>WASD</kbd>/arrows pan, <kbd>+</kbd>/<kbd>-</kbd> zoom, minimap click to jump.</li></ul>
    <h4>Editing terrain</h4><ul><li>Pick a material or biome brush, then use Pencil, Line or Fill. Terrain is layered: painting sand on soil keeps the soil underneath; the Eraser peels off the top layer.</li><li>To hand-draw a continent: draw a closed outline with the Pencil, then use Fill inside it.</li><li>Smooth rounds off jagged coastlines. Picker copies a material from the map. <kbd>[</kbd> <kbd>]</kbd> change brush size, <kbd>Ctrl+Z</kbd>/<kbd>Ctrl+Y</kbd> undo/redo.</li></ul>
    <h4>People & nations</h4><ul><li>Human / Group tools spawn people on land. Each new group speaks a brand-new language.</li><li>Click a country for its information panel; open its <b>History gallery</b> for past borders, flags, names, population graphs and events.</li><li><b>Diplomacy</b> lets you force wars and peace, alliances, unions, territory transfers and independence.</li><li><b>Timelapse</b> replays recorded history without changing the present.</li></ul>
    <h4>Shortcuts</h4><ul><li><kbd>P</kbd> pause · <kbd>1</kbd>–<kbd>8</kbd> map modes · <kbd>I B E F L K M H G</kbd> tools · <kbd>Esc</kbd> close</li></ul></div>`, { cls: 'mid' });
};

// ---------- periodic updates ----------
let lastTop = 0, lastSide = 0;
UI.updateTop = (force) => {
  const s = st(); if (!s) return;
  const y = UI.state.tl && R.tl ? R.tl.year : Math.floor(s.year);
  $('#yearLbl').textContent = 'Year ' + y;
  let pop = 0; for (const c of s.live) pop += c.pop; for (const b of s.bands) pop += b.members.length;
  const nl = new Set(); for (const set of s.liveSets) for (const k in set.langs) nl.add(k); for (const b of s.bands) nl.add(String(b.lang));
  $('#wstats').innerHTML = `<span title="World population"><i>Pop</i>${U.fmt(pop)}</span><span title="Countries"><i>Nations</i>${s.live.length}</span><span title="Settlements"><i>Towns</i>${s.liveSets.length}</span><span title="Languages spoken"><i>Langs</i>${nl.size}</span>`;
  $('#worldName').textContent = UI.state.name;
};
UI.frame = (now) => {
  if (now - lastTop > 0.25) { lastTop = now; UI.updateTop(); }
  if (now - lastSide > 1.2 && UI.state.side && UI.state.speed > 0 && !document.querySelector('#side:hover')) { lastSide = now; UI.renderSide(); }
  UI.autosave(now);
};
})();
