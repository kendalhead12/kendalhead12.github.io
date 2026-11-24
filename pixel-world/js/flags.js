// Pixel World — procedural flags: generation, drawing and caching.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const F = PW.F = {};

F.PATTERNS = ['solid', 'hbi', 'vbi', 'htri', 'vtri', 'nordic', 'cross', 'saltire', 'diag', 'canton', 'chevron', 'stripes', 'border', 'quarter', 'hband', 'pale'];
F.PATTERN_NAMES = { solid: 'Solid', hbi: 'Horizontal bicolour', vbi: 'Vertical bicolour', htri: 'Horizontal tricolour', vtri: 'Vertical tricolour', nordic: 'Nordic cross', cross: 'Centred cross', saltire: 'Saltire', diag: 'Diagonal', canton: 'Canton', chevron: 'Chevron', stripes: 'Stripes', border: 'Bordure', quarter: 'Quartered', hband: 'Central band', pale: 'Hoist pale' };
F.EMBLEMS = ['none', 'star', 'circle', 'crescent', 'sun', 'diamond', 'ring', 'stars3', 'cross', 'triangle', 'tower', 'tree'];
F.EMBLEM_NAMES = { none: 'None', star: 'Star', circle: 'Disc', crescent: 'Crescent', sun: 'Sun', diamond: 'Diamond', ring: 'Ring', stars3: 'Three stars', cross: 'Small cross', triangle: 'Hoist triangle', tower: 'Tower', tree: 'Tree' };
const BASE = ['#ffffff', '#1a1a1a', '#c8102e', '#f4c430', '#0b3d91', '#1e7b3a', '#d4a017', '#7b1e2a', '#14284b', '#e8701a', '#5fa8d3', '#5b2a86', '#e9e4d0'];

F.generate = (rng, natColor) => {
  const nat = U.hex(natColor);
  const pool = rng.shuffle(BASE.slice()).filter(c => c !== nat);
  const c = [nat, pool[0], pool[1]];
  if (rng.chance(0.5)) { const t = c[0]; c[0] = c[1]; c[1] = t; }
  const p = rng.wpick(F.PATTERNS, [3, 6, 5, 8, 8, 4, 3, 2, 3, 3, 3, 3, 2, 2, 4, 3]);
  const e = rng.chance(0.55) ? rng.wpick(F.EMBLEMS.slice(1), [6, 4, 3, 3, 2, 2, 2, 2, 2, 1, 1]) : 'none';
  let ec = pool[2] || '#ffffff';
  if (ec === c[0] || ec === c[1]) ec = c[0] === '#ffffff' ? '#1a1a1a' : '#ffffff';
  return { p, c, e, ec, ep: rng.chance(0.3) ? 'canton' : 'center' };
};
F.variant = (rng, f, natColor) => {
  const n = F.generate(rng, natColor);
  if (rng.chance(0.4)) n.c = f.c.slice();
  return n;
};

function star(ctx, cx, cy, r, pts) {
  ctx.beginPath(); pts = pts || 5;
  for (let k = 0; k < pts * 2; k++) { const a = -Math.PI / 2 + k * Math.PI / pts; const rr = k % 2 ? r * 0.42 : r; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
F.draw = (ctx, f, x, y, w, h) => {
  const [a, b, c] = f.c; ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const R = (col, rx, ry, rw, rh) => { ctx.fillStyle = col; ctx.fillRect(x + rx, y + ry, rw, rh); };
  R(a, 0, 0, w, h);
  switch (f.p) {
    case 'hbi': R(b, 0, h / 2, w, h / 2); break;
    case 'vbi': R(b, w / 2, 0, w / 2, h); break;
    case 'htri': R(b, 0, h / 3, w, h / 3); R(c, 0, 2 * h / 3, w, h / 3 + 1); break;
    case 'vtri': R(b, w / 3, 0, w / 3, h); R(c, 2 * w / 3, 0, w / 3 + 1, h); break;
    case 'nordic': R(c, w * 0.28, 0, w * 0.16, h); R(c, 0, h * 0.42, w, h * 0.16); R(b, w * 0.31, 0, w * 0.1, h); R(b, 0, h * 0.45, w, h * 0.1); break;
    case 'cross': R(b, w * 0.42, 0, w * 0.16, h); R(b, 0, h * 0.4, w, h * 0.2); break;
    case 'saltire': ctx.strokeStyle = b; ctx.lineWidth = Math.max(1, h * 0.18); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke(); break;
    case 'diag': ctx.fillStyle = b; ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); break;
    case 'canton': R(b, 0, 0, w * 0.45, h * 0.5); break;
    case 'chevron': R(b, 0, h / 2, w, h / 2); ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.42, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); break;
    case 'stripes': for (let k = 1; k < 7; k += 2) R(b, 0, k * h / 7, w, h / 7 + 0.5); break;
    case 'border': R(b, w * 0.1, h * 0.14, w * 0.8, h * 0.72); break;
    case 'quarter': R(b, w / 2, 0, w / 2, h / 2); R(b, 0, h / 2, w / 2, h / 2); break;
    case 'hband': R(b, 0, h * 0.25, w, h * 0.5); break;
    case 'pale': R(b, 0, 0, w * 0.3, h); break;
  }
  if (f.e && f.e !== 'none') {
    const cx = f.ep === 'canton' ? x + w * 0.22 : x + w / 2, cy = f.ep === 'canton' ? y + h * 0.25 : y + h / 2;
    const r = (f.ep === 'canton' ? 0.17 : 0.27) * h;
    ctx.fillStyle = f.ec; ctx.strokeStyle = f.ec;
    switch (f.e) {
      case 'star': star(ctx, cx, cy, r); break;
      case 'circle': ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, 7); ctx.fill(); break;
      case 'crescent': ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.fillStyle = (f.ep === 'canton' && f.p === 'canton') ? b : (f.p === 'hband' || f.p === 'cross' || f.p === 'htri' || f.p === 'vtri' || f.p === 'border') ? b : a; ctx.beginPath(); ctx.arc(cx + r * 0.38, cy - r * 0.1, r * 0.8, 0, 7); ctx.fill(); break;
      case 'sun': ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 7); ctx.fill(); ctx.lineWidth = Math.max(1, r * 0.15); for (let k = 0; k < 12; k++) { const an = k * Math.PI / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * r * 0.62, cy + Math.sin(an) * r * 0.62); ctx.lineTo(cx + Math.cos(an) * r, cy + Math.sin(an) * r); ctx.stroke(); } break;
      case 'diamond': ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.7, cy); ctx.closePath(); ctx.fill(); break;
      case 'ring': ctx.lineWidth = Math.max(1, r * 0.25); ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, 7); ctx.stroke(); break;
      case 'stars3': for (let k = -1; k <= 1; k++) star(ctx, cx + k * r * 0.95, cy, r * 0.42); break;
      case 'cross': ctx.fillRect(cx - r * 0.18, cy - r * 0.8, r * 0.36, r * 1.6); ctx.fillRect(cx - r * 0.8, cy - r * 0.18, r * 1.6, r * 0.36); break;
      case 'triangle': ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * 0.36, y + h / 2); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill(); break;
      case 'tower': ctx.fillRect(cx - r * 0.45, cy - r * 0.5, r * 0.9, r * 1.3); for (let k = -1; k <= 1; k++) ctx.fillRect(cx + k * r * 0.36 - r * 0.12, cy - r * 0.8, r * 0.24, r * 0.32); break;
      case 'tree': ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.7, cy + r * 0.4); ctx.lineTo(cx - r * 0.7, cy + r * 0.4); ctx.closePath(); ctx.fill(); ctx.fillRect(cx - r * 0.12, cy + r * 0.3, r * 0.24, r * 0.6); break;
    }
  }
  ctx.restore();
};
const cache = new Map();
F.canvas = (f, w, h) => {
  const key = JSON.stringify(f) + w + 'x' + h;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 600) cache.clear();
    c = document.createElement('canvas'); c.width = w; c.height = h; F.draw(c.getContext('2d'), f, 0, 0, w, h); cache.set(key, c);
  }
  return c;
};
F.dataURL = (f, w, h) => F.canvas(f, w || 48, h || 32).toDataURL();
F.img = (f, w, h, cls) => `<img class="${cls || 'flag'}" src="${F.dataURL(f, w * 2 || 48, h * 2 || 32)}" width="${w || 24}" height="${h || 16}" alt="flag">`;
})();
