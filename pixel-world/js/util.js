// Pixel World — shared utilities: seeded RNG, noise, colors, compression helpers.
(function () {
'use strict';
const PW = (typeof window !== 'undefined' ? window : globalThis).PW = (typeof window !== 'undefined' ? window : globalThis).PW || {};
const U = PW.U = {};

// ---------- Seeded RNG (mulberry32 with exposed state so it can be saved) ----------
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a, b) { return a + this.next() * (b - a); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  wpick(items, weights) {
    let s = 0; for (const w of weights) s += w;
    let r = this.next() * s;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
    return items[items.length - 1];
  }
  gauss() { return (this.next() + this.next() + this.next() - 1.5) / 1.5; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
}
U.RNG = RNG;

U.hashStr = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
U.hash2 = (x, y, s) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return h >>> 0;
};
U.hf = (x, y, s) => U.hash2(x, y, s) / 4294967296;

// value noise in [0,1)
U.noise = (x, y, s) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = U.hf(xi, yi, s), b = U.hf(xi + 1, yi, s), c = U.hf(xi, yi + 1, s), d = U.hf(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
U.fbm = (x, y, oct, s) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { sum += amp * U.noise(x * f, y * f, s + i * 101); norm += amp; amp *= 0.5; f *= 2.03; }
  return sum / norm;
};
U.ridge = (x, y, oct, s) => {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { const n = 1 - Math.abs(U.noise(x * f, y * f, s + i * 77) * 2 - 1); sum += amp * n * n; norm += amp; amp *= 0.5; f *= 2.1; }
  return sum / norm;
};

U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
U.lerp = (a, b, t) => a + (b - a) * t;
U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
U.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---------- colors ----------
U.hsl = (h, s, l) => {
  h = ((h % 1) + 1) % 1;
  const k = (n) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};
U.rgb2hsl = (c) => {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
};
U.mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
U.shade = (c, f) => f >= 0 ? U.mix(c, [255, 255, 255], f) : U.mix(c, [0, 0, 0], -f);
U.css = (c, a) => a === undefined ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
U.hex = (c) => '#' + c.map(v => U.clamp(v | 0, 0, 255).toString(16).padStart(2, '0')).join('');
U.fromHex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
U.pack = (c) => (c[0] << 16) | (c[1] << 8) | c[2];

// ---------- compression ----------
// RLE for Uint8Array -> Uint8Array of [value,count] pairs (count<=255)
U.rle8 = (a) => {
  const out = []; let i = 0; const n = a.length;
  while (i < n) { const v = a[i]; let c = 1; while (i + c < n && a[i + c] === v && c < 255) c++; out.push(v, c); i += c; }
  return Uint8Array.from(out);
};
U.unrle8 = (r, n) => { const a = new Uint8Array(n); let p = 0; for (let i = 0; i < r.length; i += 2) { a.fill(r[i], p, p + r[i + 1]); p += r[i + 1]; } return a; };
U.b64 = (u8) => {
  if (typeof btoa === 'undefined') return Buffer.from(u8).toString('base64');
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
};
U.unb64 = (str) => {
  if (typeof atob === 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
  const s = atob(str); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
};
U.pack8 = (a) => U.b64(U.rle8(a));
U.unpack8 = (s, n) => U.unrle8(U.unb64(s), n);
// RLE for any numeric array -> plain array [value,count,...]
U.rleN = (a) => { const out = []; let i = 0; const n = a.length; while (i < n) { const v = a[i]; let c = 1; while (i + c < n && a[i + c] === v) c++; out.push(v, c); i += c; } return out; };
U.unrleN = (r, n, Ctor) => { const a = new (Ctor || Uint16Array)(n); let p = 0; for (let i = 0; i < r.length; i += 2) { a.fill(r[i], p, p + r[i + 1]); p += r[i + 1]; } return a; };
// incremental diff between two equal-length arrays: [start,len,v...]
U.diff = (prev, cur) => {
  const out = []; const n = cur.length; let i = 0;
  while (i < n) {
    if (prev[i] === cur[i]) { i++; continue; }
    const st = i; const vals = [];
    // allow small gaps of equal values inside a run to reduce overhead
    while (i < n) {
      if (prev[i] !== cur[i]) { vals.push(cur[i]); i++; continue; }
      let g = 0; while (i + g < n && g < 3 && prev[i + g] === cur[i + g]) g++;
      if (g < 3 && i + g < n) { for (let k = 0; k < g; k++) vals.push(cur[i + k]); i += g; } else break;
    }
    out.push(st, vals.length); for (const v of vals) out.push(v);
  }
  return out;
};
U.applyDiff = (arr, d) => { let p = 0; while (p < d.length) { const st = d[p], len = d[p + 1]; for (let k = 0; k < len; k++) arr[st + k] = d[p + 2 + k]; p += 2 + len; } };

// ---------- formatting ----------
U.fmt = (n) => {
  n = Math.round(n);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString('en-US');
};
U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
U.yearStr = (y) => 'Year ' + Math.floor(y);

// ---------- binary min-heap keyed by Float32 ----------
class Heap {
  constructor(cap) { this.idx = new Int32Array(cap); this.key = new Float32Array(cap); this.n = 0; }
  push(i, k) {
    if (this.n >= this.idx.length) { const ni = new Int32Array(this.idx.length * 2); ni.set(this.idx); this.idx = ni; const nk = new Float32Array(this.key.length * 2); nk.set(this.key); this.key = nk; }
    let p = this.n++; const I = this.idx, K = this.key;
    while (p > 0) { const q = (p - 1) >> 1; if (K[q] <= k) break; I[p] = I[q]; K[p] = K[q]; p = q; }
    I[p] = i; K[p] = k;
  }
  pop() {
    const I = this.idx, K = this.key; const top = I[0]; this.lastKey = K[0];
    const n = --this.n; if (n <= 0) return top;
    const i = I[n], k = K[n]; let p = 0;
    for (;;) { let c = 2 * p + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= k) break; I[p] = I[c]; K[p] = K[c]; p = c; }
    I[p] = i; K[p] = k; return top;
  }
}
U.Heap = Heap;

// precomputed spiral of offsets sorted by distance (used for building placement)
U.SPIRAL = (() => {
  const R = 22, out = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d <= R) out.push([dx, dy, d]); }
  out.sort((a, b) => a[2] - b[2] || (a[1] - b[1]) || (a[0] - b[0]));
  return out;
})();

U.download = (name, text) => {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
})();
