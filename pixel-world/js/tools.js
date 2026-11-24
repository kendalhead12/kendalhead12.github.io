// Pixel World — input (mouse/touch/keyboard), terrain editing tools, flood fill, undo/redo.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U, T = PW.T, S = PW.S, R = PW.R;
const Tools = PW.Tools = { tool: 'inspect', mat: T.M.GRASS, biome: -1, size: 2, undo: [], redo: [], cur: null };
let cv, pointers = new Map(), pan = null, pinch = null, space = false, hoverT = 0, lastMove = null;

Tools.init = (canvas) => {
  cv = canvas;
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (!pointers.size) { R.cursor = null; PW.UI && PW.UI.tip(null); } });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const f = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY) * 0.0016); R.zoomAt(e.offsetX, e.offsetY, f); }, { passive: false });
  window.addEventListener('keydown', key);
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') space = false; });
};
const st = () => S.st;
const W = () => S.st.world;
function tileAt(sx, sy) { const [wx, wy] = R.s2w(sx, sy); return [Math.floor(wx), Math.floor(wy), wx, wy]; }
const painting = () => ['pencil', 'eraser', 'smooth', 'line'].includes(Tools.tool);

function down(e) {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY, sx: e.offsetX, sy: e.offsetY });
  if (pointers.size === 2) {
    if (Tools.cur) cancelOrCommit();
    pan = null; const [a, b] = Array.from(pointers.values());
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    return;
  }
  if (pointers.size > 2) return;
  if (PW.UI && PW.UI.timelapseActive()) { pan = { x: e.offsetX, y: e.offsetY, moved: 0, click: false }; return; }
  const panBtn = e.button === 1 || e.button === 2 || space;
  if (panBtn || Tools.tool === 'inspect' || Tools.tool === 'transfer' || Tools.tool === 'indep') { pan = { x: e.offsetX, y: e.offsetY, moved: 0, click: !panBtn }; return; }
  const [tx, ty] = tileAt(e.offsetX, e.offsetY);
  toolDown(tx, ty, e);
}
function move(e) {
  const p = pointers.get(e.pointerId);
  const [tx, ty, wx, wy] = tileAt(e.offsetX, e.offsetY);
  if (p) { p.x = e.offsetX; p.y = e.offsetY; }
  if (pinch && pointers.size === 2) {
    const [a, b] = Array.from(pointers.values());
    const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const c = R.cam; c.x -= (mx - pinch.mx) / c.z; c.y -= (my - pinch.my) / c.z; c.fx = null;
    if (pinch.d > 10) { const f = d / pinch.d; const nz = U.clamp(c.z * f, R.minZ(), 48); const [wx2, wy2] = R.s2w(mx, my); c.z = c.tz = nz; c.x = wx2 - (mx - R.cw / 2) / c.z; c.y = wy2 - (my - R.ch / 2) / c.z; }
    pinch.d = d; pinch.mx = mx; pinch.my = my; return;
  }
  if (pan && p) {
    const dx = e.offsetX - pan.x, dy = e.offsetY - pan.y; pan.moved += Math.abs(dx) + Math.abs(dy);
    if (pan.moved > 6 || !pan.click) { const c = R.cam; c.x -= dx / c.z; c.y -= dy / c.z; c.fx = null; }
    pan.x = e.offsetX; pan.y = e.offsetY;
  }
  updateCursor(tx, ty);
  if (Tools.cur && p) toolMove(tx, ty);
  const now = performance.now();
  if (!p && now - hoverT > 60) { hoverT = now; PW.UI && PW.UI.hover(tx, ty, e.offsetX, e.offsetY, wx, wy); }
}
function up(e) {
  const p = pointers.get(e.pointerId); pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) pinch = null; pan = null; return; }
  if (pan) {
    if (pan.click && pan.moved <= 6 && p) { const [tx, ty, wx, wy] = tileAt(e.offsetX, e.offsetY); click(tx, ty, wx, wy, e); }
    pan = null; return;
  }
  if (Tools.cur) toolUp();
}
function key(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
  const c = R.cam; const step = 60 / c.z;
  if (e.code === 'Space') { space = true; e.preventDefault(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? Tools.doRedo() : Tools.doUndo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); Tools.doRedo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': c.x -= step; c.fx = null; break;
    case 'ArrowRight': case 'd': case 'D': c.x += step; c.fx = null; break;
    case 'ArrowUp': case 'w': case 'W': c.y -= step; c.fx = null; break;
    case 'ArrowDown': case 's': case 'S': c.y += step; c.fx = null; break;
    case '+': case '=': R.zoomAt(R.cw / 2, R.ch / 2, 1.4); break;
    case '-': case '_': R.zoomAt(R.cw / 2, R.ch / 2, 1 / 1.4); break;
    case 'p': case 'P': PW.UI && PW.UI.togglePause(); break;
    case '[': Tools.setSize(Tools.size - 1); break;
    case ']': Tools.setSize(Tools.size + 1); break;
    case 'Escape': PW.UI && PW.UI.escape(); break;
    default: {
      const map = { 'i': 'inspect', 'b': 'pencil', 'e': 'eraser', 'f': 'bucket', 'l': 'line', 'k': 'picker', 'm': 'smooth', 'h': 'human', 'g': 'group' };
      const t = map[e.key.toLowerCase()]; if (t) PW.UI && PW.UI.setTool(t);
      const n = parseInt(e.key, 10); if (n >= 1 && n <= 8 && PW.UI) PW.UI.setModeIndex(n - 1);
    }
  }
}
Tools.setSize = (n) => { Tools.size = U.clamp(n, 0, 30); PW.UI && PW.UI.syncTools(); };

function updateCursor(tx, ty) {
  if (painting() || Tools.tool === 'bucket' || Tools.tool === 'picker' || Tools.tool === 'human' || Tools.tool === 'group' || Tools.tool === 'transfer' || Tools.tool === 'indep') {
    const r = painting() ? Tools.size : null;
    R.cursor = Object.assign(R.cursor || {}, { x: tx, y: ty, r });
    if (!(Tools.cur && Tools.cur.line)) R.cursor.line = null;
  } else R.cursor = null;
}

// ---------- strokes ----------
function begin() { Tools.cur = { changes: new Map(), touched: new Set(), x0: 1e9, y0: 1e9, x1: -1, y1: -1, lastCoast: 0 }; }
function rec(i) { const c = Tools.cur; if (!c.changes.has(i)) c.changes.set(i, T.getCode(W(), i)); const w = W(); const x = i % w.W, y = (i / w.W) | 0; if (x < c.x0) c.x0 = x; if (y < c.y0) c.y0 = y; if (x > c.x1) c.x1 = x; if (y > c.y1) c.y1 = y; }
function paintTile(i) {
  const w = W(); const c = Tools.cur;
  if (Tools.tool === 'eraser') { if (c.touched.has(i)) return; c.touched.add(i); rec(i); T.pop(w, i); T.updateTile(w, i); return; }
  if (Tools.biome >= 0) {
    const bb = T.BIOME_BRUSH[Tools.biome]; rec(i);
    w.temp[i] = Math.round(bb.t * 255); w.moist[i] = Math.round(bb.m * 255);
    if (bb.mat === T.M.FOREST && T.top(w, i) !== T.M.GRASS && T.top(w, i) !== T.M.FOREST) T.push(w, i, T.M.GRASS);
    T.push(w, i, bb.mat); T.updateTile(w, i); return;
  }
  if (T.top(w, i) === Tools.mat) return;
  rec(i); T.push(w, i, Tools.mat); if (Tools.mat === T.M.SHALLOW) w.fresh[i] = 0; T.updateTile(w, i);
}
function stamp(cx, cy) {
  const w = W(); const r = Tools.size;
  if (Tools.tool === 'smooth') return smooth(cx, cy, r);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r * 0.8) continue;
    const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
    paintTile(y * w.W + x);
  }
}
function smooth(cx, cy, r) {
  const w = W(); r = Math.max(1, r); const list = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r + r) continue;
    const x = cx + dx, y = cy + dy; if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue;
    const i = y * w.W + x; let land = 0; const counts = {};
    for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { const j = i + yy * w.W + xx; if (T.isLand(w, j)) { land++; const m = T.top(w, j); counts[m] = (counts[m] || 0) + 1; } }
    const isL = T.isLand(w, i);
    if (!isL && land >= 6) { let best = T.M.GRASS, bv = 0; for (const k in counts) if (counts[k] > bv) { bv = counts[k]; best = +k; } list.push([i, 'land', best]); }
    else if (isL && land <= 3) list.push([i, 'water']);
  }
  for (const [i, kind, m] of list) { rec(i); if (kind === 'land') T.push(w, i, m); else T.push(w, i, T.M.SHALLOW); T.updateTile(w, i); }
}
function segment(x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let err = dx + dy, n = 0;
  for (;;) { stamp(x0, y0); if ((x0 === x1 && y0 === y1) || n++ > 4000) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
function liveRefresh(final) {
  const c = Tools.cur; if (!c || c.x1 < 0) return;
  const now = performance.now();
  if (final || now - c.lastCoast > 120) { T.recomputeCoast(W()); c.lastCoast = now; R.terrainRect(c.x0 - (final ? 12 : 3), c.y0 - (final ? 12 : 3), c.x1 + (final ? 13 : 4), c.y1 + (final ? 13 : 4)); }
  else R.terrainRect(c.x0, c.y0, c.x1 + 1, c.y1 + 1);
}
function toolDown(tx, ty, e) {
  const w = W(); const inb = tx >= 0 && ty >= 0 && tx < w.W && ty < w.H;
  switch (Tools.tool) {
    case 'pencil': case 'eraser': case 'smooth':
      begin(); Tools.cur.lx = tx; Tools.cur.ly = ty; stamp(tx, ty); liveRefresh(); break;
    case 'line': begin(); Tools.cur.line = [tx, ty, tx, ty]; R.cursor = { x: tx, y: ty, r: Tools.size, line: [tx, ty, tx, ty] }; break;
    case 'bucket': if (inb) { begin(); fill(tx, ty); commit(); } break;
    case 'picker': if (inb) { Tools.mat = T.top(w, ty * w.W + tx); Tools.biome = -1; PW.UI.setTool('pencil'); PW.UI.toast(`Picked ${T.MATS[Tools.mat].name}`, { kind: 'info' }); } break;
    case 'human': case 'group': {
      if (!inb) break;
      const b = S.spawnBand(tx, ty, Tools.tool === 'human' ? 1 : 6);
      if (!b) PW.UI.toast('Humans can only be placed on land.', { kind: 'warn' });
      else { const lg = st().langs.get(b.lang); PW.UI.toast(`${Tools.tool === 'human' ? 'A human' : 'A group of 6 humans'} appeared, speaking ${lg ? lg.name : 'an unknown tongue'}.`, { kind: 'info' }); }
      break;
    }
  }
}
function toolMove(tx, ty) {
  const c = Tools.cur;
  if (c.line) { c.line[2] = tx; c.line[3] = ty; R.cursor = { x: tx, y: ty, r: Tools.size, line: c.line.slice() }; return; }
  if (tx === c.lx && ty === c.ly && Tools.tool !== 'smooth') return;
  segment(c.lx, c.ly, tx, ty); c.lx = tx; c.ly = ty; liveRefresh();
}
function toolUp() {
  const c = Tools.cur;
  if (c.line) { const [a, b, x, y] = c.line; segment(a, b, x, y); R.cursor = null; }
  commit();
}
function cancelOrCommit() { commit(); }
function commit() {
  const c = Tools.cur; Tools.cur = null; if (!c) return;
  if (!c.changes.size) return;
  const w = W(); const list = [];
  for (const [i, old] of c.changes) list.push([i, old, T.getCode(w, i)]);
  T.recomputeCoast(w); R.terrainRect(c.x0 - 12, c.y0 - 12, c.x1 + 13, c.y1 + 13);
  Tools.undo.push({ list, box: [c.x0, c.y0, c.x1, c.y1] }); if (Tools.undo.length > 60) Tools.undo.shift();
  Tools.redo.length = 0;
  S.onTerrainEdit(list.map(a => a[0])); w.version++;
  PW.UI && PW.UI.syncTools();
}

function fill(tx, ty) {
  const w = W(); const s = ty * w.W + tx; const startWater = T.isWater(w, s); const tm = T.top(w, s);
  const target = Tools.biome >= 0 ? T.BIOME_BRUSH[Tools.biome].mat : Tools.mat;
  if (!startWater && tm === target && Tools.biome < 0) return;
  const same = (i) => startWater ? T.isWater(w, i) && !(w.fresh[i] && !w.fresh[s]) : (T.top(w, i) === tm && !T.isWater(w, i));
  const seen = new Uint8Array(w.N); const q = [s]; seen[s] = 1; const out = [];
  while (q.length) {
    const i = q.pop(); out.push(i); const x = i % w.W;
    if (x > 0 && !seen[i - 1] && same(i - 1)) { seen[i - 1] = 1; q.push(i - 1); }
    if (x < w.W - 1 && !seen[i + 1] && same(i + 1)) { seen[i + 1] = 1; q.push(i + 1); }
    if (i >= w.W && !seen[i - w.W] && same(i - w.W)) { seen[i - w.W] = 1; q.push(i - w.W); }
    if (i + w.W < w.N && !seen[i + w.W] && same(i + w.W)) { seen[i + w.W] = 1; q.push(i + w.W); }
  }
  if (startWater && out.length > w.N * 0.5 && T.MATS[target].water === false) PW.UI.toast(`Filled ${out.length.toLocaleString()} tiles — the area was not enclosed. Undo with Ctrl+Z if that was a mistake.`, { kind: 'warn' });
  for (const i of out) paintTile(i);
}

// ---------- undo / redo ----------
function applyList(list, idx) {
  const w = W(); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const e of list) { const i = e[0]; T.setCode(w, i, e[idx]); T.updateTile(w, i); const x = i % w.W, y = (i / w.W) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  T.recomputeCoast(w); R.terrainRect(x0 - 12, y0 - 12, x1 + 13, y1 + 13);
  S.onTerrainEdit(list.map(a => a[0]));
}
Tools.doUndo = () => { const u = Tools.undo.pop(); if (!u) return PW.UI.toast('Nothing to undo', { kind: 'info' }); applyList(u.list, 1); Tools.redo.push(u); PW.UI.syncTools(); };
Tools.doRedo = () => { const u = Tools.redo.pop(); if (!u) return PW.UI.toast('Nothing to redo', { kind: 'info' }); applyList(u.list, 2); Tools.undo.push(u); PW.UI.syncTools(); };
Tools.reset = () => { Tools.undo.length = 0; Tools.redo.length = 0; Tools.cur = null; };

// ---------- clicks (inspect & map-pick tools) ----------
function click(tx, ty, wx, wy, e) {
  if (PW.UI.timelapseActive()) return PW.UI.tlClick(tx, ty);
  const w = W(); if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) return;
  const i = ty * w.W + tx;
  if (Tools.tool === 'transfer' || Tools.tool === 'indep') return PW.UI.regionPicked(Tools.tool, st().region[i]);
  const p = R.pick(wx, wy);
  if (p) return PW.UI.showPerson(p, e.offsetX, e.offsetY);
  PW.UI.inspect(tx, ty);
}
})();
