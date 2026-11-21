// Level reachability checker (dev tool).
// Simulates Aaron's jump arcs (same physics constants & collision code as the game)
// over each level's tiles + sampled platform positions, and reports whether the goal,
// boss arena and all medallions/capsules/artifacts are reachable.
// Usage: node tools/check_levels.js [levelKey ...]
'use strict';
global.window = global;
const path = require('path');
const dir = path.join(__dirname, '..', 'js');
for (const f of ['core', 'tiles', 'physics', 'level', 'levels_a', 'levels_b', 'levels_c', 'levels_d']) require(path.join(dir, f + '.js'));
const AF = global.AF, T = AF.T, F = AF.TF, TS = 16;
const GRAV = .24, MAXF = 5.2, JUMP = 5.05, DJUMP = 4.55, PW = 12, PH = 28;

function check(key) {
  const def = AF.LEVELS[key]();
  const w = def.world, act = def.act;
  const ab = { double: w >= 3 || (w === 3), slam: w >= 4, charge: w >= 5, dash: w >= 6, airdash: w >= 7 };
  if (key === '8-4') Object.assign(ab, { double: true, slam: true, charge: true, dash: true, airdash: true });
  const tiles = new Uint8Array(def.tiles);
  const W = def.w, H = def.h;
  const passable = t => t === T.SECRET || t === T.BREAK || (t === T.CRACK && ab.slam) || (t === T.METAL && ab.charge) || (t === T.SANDW && ab.dash);
  const lv = {
    w: W, h: H, pw: W * TS, ph: H * TS, solids: [],
    get(x, y) { if (x < 0 || x >= W) return -1; if (y < 0 || y >= H) return 0; const t = tiles[y * W + x]; return passable(t) ? 0 : t; }
  };
  const liquids = def.water.map(z => ({ x: z.x, y: z.y, w: z.w, h: z.h, kind: z.kind, top: Math.min(z.y, z.to !== undefined ? z.to : z.y) }));
  // allow water-level controllers: assume max level reachable
  for (const o of def.objs) if (o.type === 'waterctl') { const z = liquids[o.p.idx || 0]; if (z) z.top = Math.min(z.top, o.p.to * TS); }
  const inWater = (px, py) => liquids.find(z => z.kind === 'water' && px >= z.x && px < z.x + z.w && py >= z.top && py < z.y + z.h);
  // platforms -> static samples
  const plats = [];
  for (const o of def.objs) {
    const p = o.p || {};
    if (o.type === 'plat' || o.type === 'bar') {
      const pw = (p.w || 2) * TS, x0 = o.x * TS, y0 = o.y * TS, samples = [];
      const k = p.kind || (o.type === 'bar' ? (p.path ? 'path' : (p.ax || p.ay) ? 'sine' : 'static') : 'path');
      if (p.path) { const pts = [[0, 0]].concat(p.path); for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))); for (let s = 0; s <= n; s++) samples.push([x0 + (a[0] + (b[0] - a[0]) * s / n) * TS, y0 + (a[1] + (b[1] - a[1]) * s / n) * TS]); } }
      else if (k === 'sine') { for (const s of [-1, -.5, 0, .5, 1]) samples.push([x0 + s * (p.ax || 0) * TS, y0 + s * (p.ay || 0) * TS]); }
      else if (k === 'circle') { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + (p.ang || 0); samples.push([x0 + Math.cos(a) * (p.r || 3) * TS, y0 + Math.sin(a) * (p.r || 3) * TS]); } }
      else if (k === 'rise') { samples.push([x0, y0 - (p.dist || 3) * TS]); }
      else samples.push([x0, y0]);
      plats.push({ id: plats.length, bar: o.type === 'bar', samples, w: pw });
    }
  }
  for (const pl of plats) if (!pl.bar) for (const s of pl.samples) lv.solids.push({ solid: true, oneWay: true, x: s[0], y: s[1], w: pl.w, h: 8, plat: pl });
  // solid pushable crates/barrels count as standable boxes at origin
  for (const o of def.objs) if (o.type === 'crate' || o.type === 'iceblock' || o.type === 'barrel') lv.solids.push({ solid: true, oneWay: true, x: o.x * TS, y: o.y * TS, w: 16, h: 16 });
  const springs = def.objs.filter(o => o.type === 'spring' || o.type === 'mushroom').map(o => ({ x: o.x * TS + (o.type === 'mushroom' ? -6 : 0), y: o.y * TS + (o.type === 'mushroom' ? 4 : 6), w: o.type === 'mushroom' ? 28 : 16, h: 10, v: o.p.power || (o.type === 'mushroom' ? 6.8 : 7.6), side: o.p.side || 0 }));
  const ropes = def.objs.filter(o => o.type === 'rope').map(o => ({ x: o.x * TS + 8, y: o.y * TS, len: (o.p.len || 5) * TS, amp: o.p.amp || .7 }));
  const zonesUp = def.objs.filter(o => o.type === 'zone' && (o.p.fy || 0) < 0).map(o => ({ x: o.x * TS, y: o.y * TS, w: (o.p.w || 4) * TS, h: (o.p.h || 4) * TS }));
  const teles = def.objs.filter(o => o.type === 'tele');
  const targets = [];
  for (const o of def.objs) {
    if (o.type === 'medal') targets.push({ name: 'medal' + o.p.id, x: o.x * TS, y: o.y * TS, w: 16, h: 16 });
    if (o.type === 'goal') targets.push({ name: 'goal', x: o.x * TS, y: o.y * TS - 36, w: 16, h: 52 });
    if (o.type === 'trigger' && o.p.boss) targets.push({ name: 'boss', x: o.x * TS, y: 0, w: 16, h: H * TS });
    if (o.type === 'capsule') targets.push({ name: 'capsule', x: o.x * TS - 3, y: o.y * TS - 12, w: 22, h: 28 });
    if (o.type === 'artifact') targets.push({ name: 'artifact', x: o.x * TS, y: o.y * TS, w: 16, h: 16 });
  }
  const reached = new Set();
  const doneSpecial = new Set();
  const hitTargets = (x, y, w, h) => { for (const t of targets) if (x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y) reached.add(t.name); };

  // node key = x(px rounded to 4) , feet y (px)
  const seen = new Set(), queue = [];
  const spikeAt = (px, py) => { const t = lv.get(Math.floor(px / TS), Math.floor(py / TS)); return t === T.SPIKE || t === T.SPIKED; };
  const push = (cx, feet, g) => {
    g = g || 1;
    cx = Math.round(cx / 2) * 2; feet = Math.round(feet);
    if (cx < 6 || cx > lv.pw - 6) return;
    if (spikeAt(cx, feet - 4 * g) || spikeAt(cx - 4, feet - 4 * g) || spikeAt(cx + 4, feet - 4 * g)) return;
    const k = cx + ',' + feet + ',' + g; if (seen.has(k)) return; seen.add(k); queue.push([cx, feet, g]);
  };
  const body = (cx, feet, h, g) => { g = g || 1; h = h || PH; return { x: cx - PW / 2, y: g > 0 ? feet - h : feet, w: PW, h, vx: 0, vy: 0, grav: g }; };
  const gsw = def.objs.filter(o => o.type === 'gravsw').map(o => ({ x: o.x * TS + 8, y: o.y * TS + 8, set: o.p.set }));
  const flipFrom = (b, g) => {
    for (const s of gsw) {
      if (Math.abs(s.x - (b.x + b.w / 2)) < 24 && s.y > b.y - 12 && s.y < b.y + b.h + 12) {
        const ng = s.set !== undefined ? s.set : -g;
        if (ng === g || !once('g' + s.x + ',' + s.y + ',' + ng + ',' + Math.round(b.x / 8))) continue;
        for (const vx of [-2.25, 0, 2.25]) sim(b.x + b.w / 2, ng > 0 ? b.y + b.h : b.y, vx, 0, { g: ng, dj: 1, ad: 1, adDir: vx >= 0 ? 1 : -1 });
      }
    }
  };
  function sim(cx, feet, vx, vy, opt) {
    opt = opt || {};
    const g = opt.g || 1;
    const b = body(cx, feet, opt.h, g);
    b.vx = vx; b.vy = vy;
    let dj = !!(opt.dj && ab.double), ad = !!(opt.ad && ab.airdash), adT = 0;
    for (let f = 0; f < 220; f++) {
      if (adT > 0) { adT--; b.vy = 0; b.vx = opt.adDir * 4.6; }
      else { b.vy += GRAV * g; if (b.vy * g > MAXF) b.vy = MAXF * g; }
      if (dj && b.vy * g > -.5) { dj = false; b.vy = -DJUMP * g; }
      if (ad && !dj && b.vy * g > 0 && adT === 0 && f > 4) { ad = false; adT = 14; }
      if (adT === 0) b.vx = (opt.adDir && f > 4 && !ad && opt.ad) ? opt.adDir * 2.25 : vx;
      const wtr = g > 0 && inWater(b.x + b.w / 2, b.y + b.h / 2);
      if (wtr && b.vy > 0) { swimFrom(b.x + b.w / 2, b.y + b.h / 2); return; }
      if (gsw.length && f % 3 === 0) flipFrom(b, g);
      if (spikeAt(b.x + b.w / 2, g > 0 ? b.y + b.h - 4 : b.y + 4)) return;
      AF.moveBody(b, lv);
      hitTargets(b.x, b.y, b.w, b.h);
      // springs
      for (const s of springs) if (b.vy >= 0 && b.x < s.x + s.w && b.x + b.w > s.x && b.y + b.h >= s.y && b.y + b.h <= s.y + 10) { springFrom(b.x + b.w / 2, s.y, s); }
      // ropes: near any arc point at lower half
      for (const r of ropes) for (let a = -r.amp; a <= r.amp; a += r.amp / 4) for (const k of [.6, .8, 1]) { const px = r.x + Math.sin(a) * r.len * k, py = r.y + Math.cos(a) * r.len * k; if (Math.abs(px - (b.x + 6)) < 9 && Math.abs(py - (b.y + 4)) < 12) ropeFrom(r); }
      for (const pl of plats) if (pl.bar) for (const s of pl.samples) if (b.x + 6 > s[0] - 2 && b.x + 6 < s[0] + pl.w + 2 && Math.abs(b.y + 2 - s[1]) < 10 && b.vy > -2.5) barFrom(pl);
      for (const z of zonesUp) if (b.x < z.x + z.w && b.x + b.w > z.x && b.y < z.y + z.h && b.y + b.h > z.y) updraftFrom(z);
      if (b.onGround) { push(b.x + b.w / 2, g > 0 ? b.y + b.h : b.y, g); if (g > 0 && b.ground && b.ground.plat) ridePlat(b.ground.plat, b.x + b.w / 2 - b.ground.x); return; }
      if (b.y > lv.ph || b.y + b.h < -40) return;
    }
  }
  function once(k) { if (doneSpecial.has(k)) return false; doneSpecial.add(k); return true; }
  function springFrom(cx, top, s) { if (!once('s' + s.x + ',' + s.y)) return; for (const vx of [-2.25, -1, 0, 1, 2.25]) for (const dj of [0, 1]) sim(cx, top, s.side ? s.side * 4 : vx, -s.v, { dj, ad: 1, adDir: vx > 0 ? 1 : -1 }); }
  function ropeFrom(r) { if (!once('r' + r.x)) return; for (const s of [-1, 1]) { const a = s * r.amp; const px = r.x + Math.sin(a) * r.len, py = r.y + Math.cos(a) * r.len; hitTargets(px - 6, py - 2, 12, 28); for (const vx of [s * 2.4, s * 3.4]) for (const dj of [0, 1]) sim(px, py + 26, vx, -4.2, { dj, ad: 1, adDir: s }); } }
  function barFrom(pl) { if (!once('b' + pl.id)) return; for (const s of pl.samples) { for (let ox = 4; ox < pl.w; ox += 8) { const cx = s[0] + ox, feet = s[1] + 6 + PH; hitTargets(cx - 6, feet - PH, 12, PH); for (const vx of [-2.25, 0, 2.25]) { sim(cx, feet, vx, 1, { dj: 1, ad: 1, adDir: vx >= 0 ? 1 : -1 }); sim(cx, feet, vx, -JUMP * .95, { dj: 1 }); } } } }
  function updraftFrom(z) { if (!once('u' + z.x + ',' + z.y)) return; for (let x = z.x + 8; x < z.x + z.w; x += 16) { hitTargets(x - 6, z.y - 4, 12, z.h); for (const vx of [-2.25, 0, 2.25]) sim(x, z.y + 4, vx, -3.5, { dj: 1, ad: 1, adDir: vx >= 0 ? 1 : -1 }); } }
  function ridePlat(pl, off) { if (!once('p' + pl.id + ',' + Math.round(off / 8))) return; for (const s of pl.samples) push(s[0] + AF.clamp(off, 4, pl.w - 4), s[1]); }
  const swamZones = new Set();
  function swimFrom(px, py) {
    const z = inWater(px, py); if (!z) return;
    const k = Math.floor(px / TS) + ',' + Math.floor(py / TS);
    if (swamZones.has(k)) return;
    // flood fill water cells connected
    const st = [[Math.floor(px / TS), Math.floor(py / TS)]];
    while (st.length) {
      const [x, y] = st.pop(); const kk = x + ',' + y;
      if (swamZones.has(kk)) continue;
      const t = lv.get(x, y); if (t === -1 || (AF.TFLAGS[t] & F.SOLID)) continue;
      if (!inWater(x * TS + 8, y * TS + 8)) {
        // surface: leap out
        if (inWater(x * TS + 8, y * TS + 24)) { swamZones.add(kk); for (const vx of [-2.25, -1.2, 0, 1.2, 2.25]) sim(x * TS + 8, y * TS + 30, vx, -4.8, { dj: 1 }); }
        continue;
      }
      swamZones.add(kk);
      hitTargets(x * TS + 2, y * TS + 2, 12, 12);
      // standing on underwater floors
      const below = lv.get(x, y + 1); if (below !== -1 && (AF.TFLAGS[below] & (F.SOLID | F.ONEWAY))) push(x * TS + 8, (y + 1) * TS);
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  const sp = def.spawn; push(sp.x * TS + 8, (sp.y + 1) * TS);
  let guard = 0;
  while (queue.length && guard++ < 60000) {
    const [cx, feet, g] = queue.shift();
    const tx = Math.floor(cx / TS), ty = Math.floor((feet - 1) / TS);
    { const bb = body(cx, feet, PH, g); hitTargets(bb.x, bb.y, bb.w, bb.h); if (gsw.length) flipFrom(bb, g); }
    if (g < 0) {
      for (const d of [-1, 1]) { const b2 = body(cx, feet, 14, g); AF.moveX(b2, lv, d * 8); const nx = b2.x + b2.w / 2; if (Math.abs(nx - cx) < 1) continue; const sb = body(nx, feet, 14, g); sb.vy = -1; const r = AF.moveY(sb, lv, -1.5); if (r.landed) push(nx, sb.y, g); else sim(nx, feet, d * 1.5, 0, { h: 14, g, dj: 1 }); }
      for (const vx of [-2.25, -1.2, 0, 1.2, 2.25]) { sim(cx, feet, vx, JUMP, { g }); if (ab.double) sim(cx, feet, vx, JUMP, { g, dj: 1 }); if (ab.airdash && vx) sim(cx, feet, vx, JUMP, { g, dj: 1, ad: 1, adDir: Math.sign(vx) }); }
      continue;
    }
    // teleporters
    for (const t of teles) if (Math.abs(t.x * TS + 8 - cx) < 12 && Math.abs((t.y + 1) * TS - feet) < 8) { const d = teles.find(q => q.p.id === t.p.to); if (d) push(d.x * TS + 8, (d.y + 1) * TS); }
    // water
    if (inWater(cx, feet - 14)) swimFrom(cx, feet - 14);
    // walk left/right (with crawl)
    for (const d of [-1, 1]) {
      let x = cx + d * 8;
      const b = body(cx, feet, 14); b.vx = d * 8; AF.moveX(b, lv, d * 8);
      if (Math.abs(b.x + b.w / 2 - cx) < 1) continue;
      const nx = b.x + b.w / 2;
      // support?
      const sb = body(nx, feet, 14); sb.vy = 1; const r = AF.moveY(sb, lv, 1.5);
      if (r.landed) push(nx, sb.y + sb.h); else { const fb = body(nx, feet, 14); sim(nx, feet, d * 1.5, 0, { h: 14, dj: 1, ad: 1, adDir: d }); sim(nx, feet, d * .3, 0, { h: 14 }); }
    }
    // standing room for jumps?
    const stand = !AF.rectSolid(lv, cx - 6, feet - PH, 12, PH);
    if (stand) {
      for (const vx of [-2.25, -1.6, -.8, 0, .8, 1.6, 2.25]) {
        sim(cx, feet, vx, -JUMP, {});
        if (ab.double) sim(cx, feet, vx, -JUMP, { dj: 1 });
        if (ab.airdash && vx !== 0) sim(cx, feet, vx, -JUMP, { dj: 1, ad: 1, adDir: Math.sign(vx) });
      }
      // short hops
      for (const vx of [-2.25, 2.25]) sim(cx, feet, vx, -2.6, {});
    }
    // ladders: climb up/down
    for (const ddx of [0]) {
      const f = AF.TFLAGS[Math.max(0, lv.get(tx, ty))] | AF.TFLAGS[Math.max(0, lv.get(tx, ty + 1))];
      if (f & F.CLIMB) {
        // walk the ladder column up and down
        let y = (AF.TFLAGS[Math.max(0, lv.get(tx, ty))] & F.CLIMB) ? ty : ty + 1; while (y >= 0 && (AF.TFLAGS[Math.max(0, lv.get(tx, y))] & F.CLIMB)) y--;
        // top of ladder
        push(tx * TS + 8, (y + 1) * TS);
        let yd = ty; while (yd < H && (AF.TFLAGS[Math.max(0, lv.get(tx, yd))] & F.CLIMB)) yd++;
        for (let yy = y + 1; yy < yd; yy++) { hitTargets(tx * TS + 2, yy * TS - 12, 12, 28); for (const vx of [-2.25, 0, 2.25]) sim(tx * TS + 8, (yy + 1) * TS, vx, -4.2, { dj: 1 }); }
        push(tx * TS + 8, yd * TS);
      }
    }
  }
  if (process.env.DBG) console.log("swam cells", swamZones.size, [...swamZones].slice(0, 40).join(" "));
  if (process.env.MAP) {
    const [m0, m1] = process.env.MAP.split(',').map(Number);
    const R = new Set(); for (const k of seen) { const [x, f] = k.split(',').map(Number); R.add(Math.floor(x / TS) + ',' + (Math.floor((f - 1) / TS))); }
    const ch = { [T.EMPTY]: ' ', [T.SOLID]: '#', [T.ALT]: 'B', [T.PLAT]: '=', [T.LADDER]: 'H', [T.VINE]: 'V', [T.BREAK]: 'b', [T.SECRET]: 's', [T.SPIKE]: '^', [T.ICE]: 'I', [T.METAL]: 'M', [T.CRACK]: 'c', [T.SANDW]: 'w', [T.QSAND]: 'q', [T.BRIDGE]: '=', [T.GLASS]: 'g', [T.BGWALL]: '.', [T.BGALT]: '.' };
    for (let y = 0; y < H; y++) { let row = String(y).padStart(2) + ' '; for (let x = m0; x <= m1; x++) { const t = tiles[y * W + x]; row += R.has(x + ',' + y) ? '@' : (ch[t] || '?'); } console.log(row); }
    let maxX = 0; for (const k of seen) maxX = Math.max(maxX, +k.split(',')[0]); console.log('max x tile', Math.floor(maxX / TS));
  }
  const all = targets.map(t => t.name);
  const missing = all.filter(n => !reached.has(n));
  return { key, missing, nodes: seen.size, medals: all.filter(n => n.startsWith('medal')).length };
}

const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(AF.LEVELS);
let bad = 0;
for (const k of keys) {
  let r;
  try { r = check(k); } catch (e) { console.log(k, 'ERROR', e.message); bad++; continue; }
  const okGoal = !r.missing.includes('goal') && !r.missing.includes('boss');
  console.log((r.missing.length ? 'WARN ' : 'OK   ') + k.padEnd(5) + ' nodes=' + String(r.nodes).padEnd(6) + ' medals=' + r.medals + (r.missing.length ? '  missing: ' + r.missing.join(', ') : ''));
  if (r.missing.length) bad++;
}
process.exitCode = bad ? 1 : 0;
