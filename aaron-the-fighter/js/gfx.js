'use strict';
// ============================================================
//  Pixel painter, sprites, fonts
// ============================================================
(function () {
  const hexCache = new Map();
  // Convert '#rrggbb' to ABGR uint32 for ImageData
  function C(h) {
    if (typeof h === 'number') return h;
    let v = hexCache.get(h);
    if (v !== undefined) return v;
    let s = h.replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    const r = parseInt(s.substr(0, 2), 16), g = parseInt(s.substr(2, 2), 16), b = parseInt(s.substr(4, 2), 16);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    hexCache.set(h, v);
    return v;
  }
  AF.C = C;
  AF.rgb = function (h) { let s = h.replace('#', ''); if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; return [parseInt(s.substr(0, 2), 16), parseInt(s.substr(2, 2), 16), parseInt(s.substr(4, 2), 16)]; };
  AF.hexOf = (r, g, b) => '#' + [r, g, b].map(v => AF.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  AF.mix = function (a, b, t) { const A = AF.rgb(a), B = AF.rgb(b); return AF.hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  AF.shade = function (h, amt) { return amt < 0 ? AF.mix(h, '#000000', -amt) : AF.mix(h, '#ffffff', amt); };
  AF.ramp = function (h) { return [AF.mix(h, '#1a0830', .55), AF.mix(h, '#20104a', .28), h, AF.mix(h, '#ffffe0', .35), AF.mix(h, '#ffffff', .7)]; };

  AF.makeCanvas = function (w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    return c;
  };

  // ---------------- Pix: pixel buffer painter ----------------
  class Pix {
    constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); }
    set(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = C(c); }
    get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0; return this.d[y * this.w + x]; }
    rect(x, y, w, h, c) { const v = C(c); x = Math.round(x); y = Math.round(y); for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.d[j * this.w + i] = v; return this; }
    dither(x, y, w, h, c, phase) { const v = C(c); phase = phase || 0; for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (((i + j + phase) & 1) === 0 && i >= 0 && j >= 0 && i < this.w && j < this.h) this.d[j * this.w + i] = v; return this; }
    ell(cx, cy, rx, ry, c) {
      const v = C(c);
      for (let j = Math.floor(cy - ry - 1); j <= cy + ry + 1; j++) for (let i = Math.floor(cx - rx - 1); i <= cx + rx + 1; i++) {
        const dx = (i + .5 - cx) / rx, dy = (j + .5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && i >= 0 && j >= 0 && i < this.w && j < this.h) this.d[j * this.w + i] = v;
      }
      return this;
    }
    circ(cx, cy, r, c) { return this.ell(cx, cy, r, r, c); }
    // shaded ellipse: cols = [dark, mid, light, highlight]; light from upper-left
    shadeEll(cx, cy, rx, ry, cols, lx, ly) {
      lx = lx === undefined ? -.55 : lx; ly = ly === undefined ? -.65 : ly;
      for (let j = Math.floor(cy - ry - 1); j <= cy + ry + 1; j++) for (let i = Math.floor(cx - rx - 1); i <= cx + rx + 1; i++) {
        const dx = (i + .5 - cx) / rx, dy = (j + .5 - cy) / ry, r2 = dx * dx + dy * dy;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const l = dx * lx + dy * ly + nz * .55;
        let k;
        if (l > .95 && cols.length > 3) k = 3; else if (l > .55) k = 2; else if (l > .1) k = 1; else k = 0;
        if (cols.length === 3 && k === 3) k = 2;
        this.set(i, j, cols[k]);
      }
      return this;
    }
    line(x0, y0, x1, y1, c) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (; ;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return this;
    }
    thick(x0, y0, x1, y1, r, c) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let i = 0; i <= n; i++) { const t = i / n; this.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c); }
      return this;
    }
    poly(pts, c) {
      const v = C(c);
      let minY = 1e9, maxY = -1e9;
      for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
      for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
        const yy = y + .5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i], b = pts[(i + 1) % pts.length];
          if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + (yy - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = v;
      }
      return this;
    }
    // draw string-art: rows of chars, palette maps char -> color; '.' and ' ' transparent
    str(rows, pal, ox, oy, flip) {
      ox = ox || 0; oy = oy || 0;
      for (let j = 0; j < rows.length; j++) {
        const r = rows[j];
        for (let i = 0; i < r.length; i++) {
          const ch = r[i];
          if (ch === '.' || ch === ' ') continue;
          const col = pal[ch]; if (!col) continue;
          this.set(ox + (flip ? r.length - 1 - i : i), oy + j, col);
        }
      }
      return this;
    }
    // recolor existing pixel colors
    recolor(map) { const m = new Map(); for (const k in map) m.set(C(k), C(map[k])); for (let i = 0; i < this.d.length; i++) { const v = m.get(this.d[i]); if (v !== undefined) this.d[i] = v; } return this; }
    outline(c, diag) {
      const v = C(c || '#180c20'), w = this.w, h = this.h, src = this.d.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (src[y * w + x]) continue;
        let n = (x > 0 && src[y * w + x - 1]) || (x < w - 1 && src[y * w + x + 1]) || (y > 0 && src[(y - 1) * w + x]) || (y < h - 1 && src[(y + 1) * w + x]);
        if (!n && diag) n = (x > 0 && y > 0 && src[(y - 1) * w + x - 1]) || (x < w - 1 && y > 0 && src[(y - 1) * w + x + 1]) || (x > 0 && y < h - 1 && src[(y + 1) * w + x - 1]) || (x < w - 1 && y < h - 1 && src[(y + 1) * w + x + 1]);
        if (n) this.d[y * w + x] = v;
      }
      return this;
    }
    // darken pixels in a region (used for back limbs etc.)
    blit(o, dx, dy) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const v = o.d[y * o.w + x]; if (v) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = v; } } return this; }
    canvas() {
      const c = AF.makeCanvas(this.w, this.h), x = c.getContext('2d');
      const id = x.createImageData(this.w, this.h);
      new Uint32Array(id.data.buffer).set(this.d);
      x.putImageData(id, 0, 0);
      return c;
    }
    spr(ax, ay) { return new Spr(this.canvas(), ax === undefined ? this.w >> 1 : ax, ay === undefined ? this.h : ay); }
  }
  AF.Pix = Pix;

  // ---------------- Sprite ----------------
  const flipCache = new WeakMap(), vflipCache = new WeakMap(), whiteCache = new WeakMap();
  function flipped(c) {
    let f = flipCache.get(c); if (f) return f;
    f = AF.makeCanvas(c.width, c.height); const x = f.getContext('2d'); x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    flipCache.set(c, f); return f;
  }
  function vflipped(c) {
    let f = vflipCache.get(c); if (f) return f;
    f = AF.makeCanvas(c.width, c.height); const x = f.getContext('2d'); x.translate(0, c.height); x.scale(1, -1); x.drawImage(c, 0, 0);
    vflipCache.set(c, f); return f;
  }
  function whiteOf(c, col) {
    let f = whiteCache.get(c); if (f) return f;
    f = AF.makeCanvas(c.width, c.height); const x = f.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col || '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    whiteCache.set(c, f); return f;
  }
  AF.flipped = flipped; AF.whiteOf = whiteOf; AF.vflipped = vflipped;
  class Spr {
    constructor(c, ax, ay) { this.c = c; this.w = c.width; this.h = c.height; this.ax = ax; this.ay = ay; }
  }
  AF.Spr = Spr;
  // draw sprite with anchor at (x,y). dir: 1 right, -1 left (mirrored). opts: {white, alpha, vflip}
  AF.drawSpr = function (ctx, s, x, y, dir, white, vflip) {
    if (!s) return;
    let img = s.c;
    let ax = s.ax, ay = s.ay;
    if (dir < 0) { img = flipped(img); ax = s.w - s.ax; }
    if (vflip) { img = vflipped(img); ay = s.h - s.ay; }
    if (white) img = whiteOf(img);
    ctx.drawImage(img, Math.round(x - ax), Math.round(y - ay));
  };
  // helper: build sprite from string art with auto outline
  AF.strSpr = function (rows, pal, opts) {
    opts = opts || {};
    const pad = opts.noOutline ? 0 : 1;
    let w = 0; for (const r of rows) w = Math.max(w, r.length);
    const p = new Pix(w + pad * 2, rows.length + pad * 2);
    p.str(rows, pal, pad, pad);
    if (opts.mirror) { // mirror left half to right
      for (let j = 0; j < rows.length; j++) for (let i = 0; i < w; i++) { const v = p.d[(j + pad) * p.w + i + pad]; if (v) p.d[(j + pad) * p.w + (w * 2 - 1 - i) + pad] = v; }
    }
    if (!opts.noOutline) p.outline(opts.outline || '#180c20', opts.diag);
    return p.spr(opts.ax !== undefined ? opts.ax + pad : p.w >> 1, opts.ay !== undefined ? opts.ay + pad : p.h - (opts.noOutline ? 0 : 1));
  };
  // mirrored string art: give left half rows, mirror to full
  AF.mirrorRows = rows => rows.map(r => r + r.split('').reverse().join(''));

  // ---------------- Font (5x8 proportional) ----------------
  const G = {
    A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
    D: '11110 10001 10001 10001 10001 10001 11110', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
    G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '111 010 010 010 010 010 111',
    J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
    M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
    P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
    S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
    V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
    Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
    '0': '01110 10001 10011 10101 11001 10001 01110', '1': '00100 01100 00100 00100 00100 00100 01110', '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11111 00010 00100 00010 00001 10001 01110', '4': '00010 00110 01010 10010 11111 00010 00010', '5': '11111 10000 11110 00001 00001 10001 01110',
    '6': '00110 01000 10000 11110 10001 10001 01110', '7': '11111 00001 00010 00100 01000 01000 01000', '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00010 01100',
    a: '00000 00000 01110 00001 01111 10001 01111', b: '10000 10000 10110 11001 10001 10001 11110', c: '0000 0000 0111 1000 1000 1000 0111',
    d: '00001 00001 01101 10011 10001 10001 01111', e: '00000 00000 01110 10001 11111 10000 01110', f: '0011 0100 1110 0100 0100 0100 0100',
    g: '00000 00000 01111 10001 10001 01111 00001 01110', h: '10000 10000 10110 11001 10001 10001 10001', i: '1 0 1 1 1 1 1',
    j: '001 000 001 001 001 001 101 010', k: '1000 1000 1001 1010 1100 1010 1001', l: '10 10 10 10 10 10 01',
    m: '00000 00000 11010 10101 10101 10101 10001', n: '00000 00000 10110 11001 10001 10001 10001', o: '00000 00000 01110 10001 10001 10001 01110',
    p: '00000 00000 11110 10001 10001 11110 10000 10000', q: '00000 00000 01111 10001 10001 01111 00001 00001', r: '0000 0000 1011 1100 1000 1000 1000',
    s: '0000 0000 0111 1000 0110 0001 1110', t: '0100 0100 1110 0100 0100 0101 0010', u: '00000 00000 10001 10001 10001 10011 01101',
    v: '00000 00000 10001 10001 10001 01010 00100', w: '00000 00000 10001 10001 10101 10101 01010', x: '00000 00000 10001 01010 00100 01010 10001',
    y: '00000 00000 10001 10001 10001 01111 00001 01110', z: '00000 00000 11111 00010 00100 01000 11111',
    '.': '0 0 0 0 0 0 1', ',': '00 00 00 00 00 01 01 10', '!': '1 1 1 1 1 0 1', '?': '01110 10001 00001 00010 00100 00000 00100',
    ':': '0 0 1 0 0 1 0', ';': '00 00 01 00 00 01 01 10', "'": '1 1 0 0 0 0 0', '"': '101 101 000 000 000 000 000', '-': '000 000 000 111 000 000 000',
    '+': '00000 00100 00100 11111 00100 00100 00000', '/': '00001 00010 00010 00100 01000 01000 10000', '(': '01 10 10 10 10 10 01', ')': '10 01 01 01 01 01 10',
    '*': '00000 10101 01110 11111 01110 10101 00000', '<': '0001 0010 0100 1000 0100 0010 0001', '>': '1000 0100 0010 0001 0010 0100 1000',
    '=': '0000 0000 1111 0000 1111 0000 0000', '%': '11001 11010 00010 00100 01000 01011 10011', '#': '01010 11111 01010 01010 11111 01010 00000',
    '_': '00000 00000 00000 00000 00000 00000 11111', '[': '11 10 10 10 10 10 11', ']': '11 01 01 01 01 01 11',
    '@': '01010 11111 11111 11111 01110 00100 00000', // heart glyph
    '^': '00100 01110 11111 00100 00100 00100 00000', 'v': '00000 00000 10001 10001 10001 01010 00100',
    '~': '00000 00100 00110 11111 00110 00100 00000', // right arrow
    '`': '00000 00100 01100 11111 01100 00100 00000', // left arrow
    '$': '00100 01111 10100 01110 00101 11110 00100', '&': '01100 10010 10100 01000 10101 10010 01101',
    '|': '00100 01110 11111 00000 11111 01110 00100' // up/down arrow
  };
  const GLYPH = {};
  for (const k in G) {
    const rows = G[k].split(' ');
    GLYPH[k] = { w: rows[0].length, rows };
  }
  AF.GLYPH = GLYPH;
  AF.textWidth = function (s) {
    let w = 0;
    for (let i = 0; i < s.length; i++) { const ch = s[i]; if (ch === ' ') { w += 4; continue; } const g = GLYPH[ch] || GLYPH['?']; w += g.w + 1; }
    return Math.max(0, w - 1);
  };
  const txtCache = new Map();
  // returns canvas with rendered text; outline: color or null; shadow adds drop shadow
  AF.textImg = function (s, col, outline, shadow) {
    const key = s + '\u0001' + col + '\u0001' + outline + '\u0001' + shadow;
    let c = txtCache.get(key);
    if (c) return c;
    const tw = AF.textWidth(s), pad = outline ? 1 : 0, sh = shadow ? 1 : 0;
    const p = new Pix(Math.max(1, tw + pad * 2 + sh), 8 + pad * 2 + sh);
    let x = pad;
    const v = C(col);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]; if (ch === ' ') { x += 4; continue; }
      const g = GLYPH[ch] || GLYPH['?'];
      for (let j = 0; j < g.rows.length; j++) for (let k = 0; k < g.w; k++) if (g.rows[j][k] === '1') {
        if (shadow) p.set(x + k + 1, pad + j + 1, shadow);
        p.d[(pad + j) * p.w + x + k] = v;
      }
      x += g.w + 1;
    }
    if (outline) p.outline(outline, true);
    c = p.canvas();
    if (txtCache.size > 600) txtCache.clear();
    txtCache.set(key, c);
    return c;
  };
  // draw text. align: 'l','c','r'
  AF.text = function (ctx, s, x, y, col, opts) {
    s = '' + s;
    opts = opts || {};
    const img = AF.textImg(s, col || '#ffffff', opts.o === undefined ? '#100818' : opts.o, opts.sh);
    let dx = x - (opts.o === null ? 0 : 1);
    if (opts.a === 'c') dx = x - (img.width >> 1);
    else if (opts.a === 'r') dx = x - img.width;
    ctx.drawImage(img, Math.round(dx), Math.round(y - (opts.o === null ? 0 : 1)));
    return img.width;
  };
  // word-wrap text to width in px
  AF.wrap = function (s, width) {
    const words = s.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (AF.textWidth(t) > width && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  };

  // ---------------- Big HUD digits (reference-style chunky outlined) ----------------
  const BD = {
    '0': ['.####.', '##..##', '##..##', '##.###', '##.###', '###.##', '###.##', '##..##', '##..##', '.####.'],
    '1': ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '.####.'],
    '2': ['.####.', '##..##', '....##', '....##', '...##.', '..##..', '.##...', '##....', '##....', '######'],
    '3': ['.####.', '##..##', '....##', '....##', '..###.', '....##', '....##', '....##', '##..##', '.####.'],
    '4': ['...##.', '..###.', '.####.', '##.##.', '##.##.', '######', '...##.', '...##.', '...##.', '...##.'],
    '5': ['######', '##....', '##....', '#####.', '....##', '....##', '....##', '....##', '##..##', '.####.'],
    '6': ['.####.', '##..##', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
    '7': ['######', '....##', '....##', '...##.', '...##.', '..##..', '..##..', '..##..', '..##..', '..##..'],
    '8': ['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
    '9': ['.####.', '##..##', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '##..##', '.####.'],
    ':': ['..', '..', 'yy', 'yy', '..', '..', 'yy', 'yy', '..', '..'],
    'x': ['......', '......', '......', '##..##', '.####.', '..##..', '.####.', '##..##', '......', '......']
  };
  AF.bigDigits = {};
  AF.initBigDigits = function () {
    for (const k in BD) {
      const rows = BD[k];
      const p = new Pix(rows[0].length + 2, rows.length + 2);
      for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch === '#') p.set(i + 1, j + 1, j >= 7 ? '#b8c0e0' : (j >= 5 ? '#e8ecff' : '#ffffff'));
        if (ch === 'y') p.set(i + 1, j + 1, j % 2 ? '#d09000' : '#ffe040');
      }
      // italic-ish shading on right column
      p.outline('#000000', true);
      AF.bigDigits[k] = p.canvas();
    }
  };
  AF.bigText = function (ctx, s, x, y, align) {
    s = '' + s;
    let w = 0; for (const ch of s) w += (AF.bigDigits[ch] ? AF.bigDigits[ch].width - 1 : 4);
    let dx = align === 'c' ? x - (w >> 1) : align === 'r' ? x - w : x;
    for (const ch of s) { const im = AF.bigDigits[ch]; if (im) { ctx.drawImage(im, Math.round(dx), Math.round(y)); dx += im.width - 1; } else dx += 4; }
    return w;
  };

  // dithered gradient fill into Pix
  AF.ditherGrad = function (p, x, y, w, h, cols, vertical) {
    // cols: array of colors from top to bottom; uses 4-step ordered dither between bands
    const n = cols.length - 1;
    const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const t = (vertical === false ? i / (w - 1) : j / (h - 1)) * n;
      let k = Math.floor(t), f = t - k;
      if (k >= n) { k = n - 1; f = 1; }
      const th = (bayer[(y + j) & 3][(x + i) & 3] + .5) / 16;
      p.set(x + i, y + j, f > th ? cols[k + 1] : cols[k]);
    }
  };
})();
