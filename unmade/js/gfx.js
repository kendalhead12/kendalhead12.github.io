'use strict';
// ============================================================
//  Pixel-art helpers: procedural drawing, outlines, B&W conversion
// ============================================================
(function () {
  class Pix {
    constructor(w, h) { this.c = U.mk(w, h); this.g = this.c.g; this.w = w; this.h = h; }
    px(x, y, col) { if (!col) return; this.g.fillStyle = col; this.g.fillRect(Math.round(x), Math.round(y), 1, 1); return this; }
    rect(x, y, w, h, col) { if (!col || w <= 0 || h <= 0) return this; this.g.fillStyle = col; this.g.fillRect(x, y, w, h); return this; }
    clear(x, y, w, h) { this.g.clearRect(x, y, w, h); return this; }
    hl(x0, x1, y, col) { return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, col); }
    vl(x, y0, y1, col) { return this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, col); }
    ellipse(cx, cy, rx, ry, col) {
      if (!col) return this;
      this.g.fillStyle = col;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        const dy = (y + .5 - cy - .5) / (ry + .5);
        if (Math.abs(dy) > 1) continue;
        const hw = (rx + .5) * Math.sqrt(1 - dy * dy);
        const x0 = Math.round(cx - hw + .5), x1 = Math.round(cx + hw - .5);
        if (x1 >= x0) this.g.fillRect(x0, y, x1 - x0 + 1, 1);
      }
      return this;
    }
    circle(cx, cy, r, col) { return this.ellipse(cx, cy, r, r, col); }
    line(x0, y0, x1, y1, col) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy; this.g.fillStyle = col;
      for (let n = 0; n < 500; n++) {
        this.g.fillRect(x0, y0, 1, 1);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      return this;
    }
    tri(ax, ay, bx, by, cx, cy, col) {
      if (!col) return this;
      this.g.fillStyle = col;
      const minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
      const minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
      const s = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + .5, py = y + .5;
        const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) this.g.fillRect(x, y, 1, 1);
      }
      return this;
    }
    // string pixel map: rows of chars mapped through palette (missing / '.' => transparent)
    map(rows, pal, ox, oy) {
      ox = ox || 0; oy = oy || 0;
      rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const col = pal[r[x]]; if (col) this.px(ox + x, oy + y, col); } });
      return this;
    }
    noise(x, y, w, h, col, density, seed) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (U.hash(x + i, y + j, seed || 1) < density) this.px(x + i, y + j, col);
      return this;
    }
    // recolour pixels within rect where predicate(r,g,b,a)
    shade(x, y, w, h, fn) {
      const d = this.g.getImageData(x, y, w, h);
      for (let i = 0; i < d.data.length; i += 4) { if (d.data[i + 3]) fn(d.data, i); }
      this.g.putImageData(d, x, y);
      return this;
    }
  }
  U.Pix = Pix;

  const Art = U.Art = { cache: {} };
  Art.cached = function (key, fn) { let v = Art.cache[key]; if (!v) { v = fn(); Art.cache[key] = v; } return v; };

  // add a 1px outline around opaque pixels (returns new canvas, +1px margin each side)
  Art.outline = function (src, color, opts) {
    opts = opts || {};
    const w = src.width + 2, h = src.height + 2;
    const out = U.mk(w, h);
    out.g.drawImage(src, 1, 1);
    const d = out.g.getImageData(0, 0, w, h), a = d.data;
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 40;
    const m = /^#(..)(..)(..)$/.exec(color || '#140c1c');
    const cr = parseInt(m[1], 16), cg = parseInt(m[2], 16), cb = parseInt(m[3], 16);
    const mark = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) || (opts.diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)))) mark.push(x, y);
    }
    for (let i = 0; i < mark.length; i += 2) { const k = (mark[i + 1] * w + mark[i]) * 4; a[k] = cr; a[k + 1] = cg; a[k + 2] = cb; a[k + 3] = 255; }
    out.g.putImageData(d, 0, 0);
    return out;
  };
  // Black & white battle look: grey-quantised fills, white silhouette outline.
  Art.bw = function (src, opts) {
    opts = opts || {};
    const w = src.width + 2, h = src.height + 2;
    const out = U.mk(w, h);
    out.g.drawImage(src, 1, 1);
    const d = out.g.getImageData(0, 0, w, h), a = d.data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < a.length; i += 4, p++) {
      if (a[i + 3] < 40) { a[i + 3] = 0; continue; }
      alpha[p] = 1;
      const lum = .299 * a[i] + .587 * a[i + 1] + .114 * a[i + 2];
      let v;
      if (lum < 46) v = 0; else if (lum < 105) v = 92; else if (lum < 175) v = 178; else v = 255;
      if (opts.invertDark && v === 0) v = 0;
      a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255;
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (alpha[p]) continue;
      const n = (xx, yy) => xx >= 0 && yy >= 0 && xx < w && yy < h && alpha[yy * w + xx];
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { const i = p * 4; a[i] = a[i + 1] = a[i + 2] = 255; a[i + 3] = 255; }
    }
    out.g.putImageData(d, 0, 0);
    return out;
  };
  Art.flip = function (src) { const c = U.mk(src.width, src.height); c.g.translate(src.width, 0); c.g.scale(-1, 1); c.g.drawImage(src, 0, 0); return c; };
  Art.scale = function (src, s) { const c = U.mk(src.width * s, src.height * s); c.g.imageSmoothingEnabled = false; c.g.drawImage(src, 0, 0, c.width, c.height); return c; };
  Art.tint = function (src, color, amt) {
    const c = U.mk(src.width, src.height); c.g.drawImage(src, 0, 0);
    c.g.globalCompositeOperation = 'source-atop'; c.g.globalAlpha = amt == null ? 1 : amt; c.g.fillStyle = color; c.g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  Art.crop = function (src, x, y, w, h) { const c = U.mk(w, h); c.g.drawImage(src, x, y, w, h, 0, 0, w, h); return c; };
  // silhouette (for shadows / fear flashes)
  Art.silhouette = (src, color) => Art.tint(src, color || '#000', 1);

  // draw helper: sprite with feet at (x, y)
  Art.drawFeet = function (ctx, spr, x, y, opts) {
    if (!spr) return;
    const s = (opts && opts.scale) || 1;
    const w = spr.width * s, h = spr.height * s;
    const dx = Math.round(x - w / 2), dy = Math.round(y - h + ((opts && opts.oy) || 0));
    if (opts && opts.alpha != null) ctx.globalAlpha = opts.alpha;
    ctx.drawImage(spr, dx, dy, w, h);
    if (opts && opts.alpha != null) ctx.globalAlpha = 1;
  };

  // drop shadow ellipse
  Art.shadow = function (ctx, x, y, rx, a) {
    ctx.globalAlpha = a == null ? .3 : a; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(Math.round(x), Math.round(y), rx, Math.max(1, rx * .4), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  };
})();
