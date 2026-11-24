// Pixel World — small interactive line charts (canvas) with hover read-outs.
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const Ch = PW.Ch = {};

function nice(min, max, n) {
  const span = max - min || 1; const raw = span / n; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / mag; const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(v); return out;
}
// series: [{name, color:[r,g,b], pts:[[x,y],...], dash?}]
Ch.line = (cv, series, o) => {
  o = o || {};
  const fmt = o.fmt || U.fmt;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#e8e4d8', dim = css.getPropertyValue('--ink-dim').trim() || '#9a96a0', grid = css.getPropertyValue('--line').trim() || 'rgba(255,255,255,0.1)', panel = css.getPropertyValue('--panel-2').trim() || '#221e2c';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = cv.clientWidth || 600, chh = cv.clientHeight || 260; cv.width = cw * dpr; cv.height = chh * dpr;
  const g = cv.getContext('2d');
  const pad = { l: 56, r: 14, t: 14, b: 28 };
  let x0 = Infinity, x1 = -Infinity, y0 = 0, y1 = -Infinity;
  for (const s of series) for (const [x, y] of s.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y > y1) y1 = y; if (y < y0) y0 = y; }
  const empty = !isFinite(x0) || series.every(s => s.pts.length < 1);
  if (x0 === x1) { x0 -= 1; x1 += 1; } if (y1 <= y0) y1 = y0 + 1;
  y1 *= 1.06;
  const X = (x) => pad.l + (x - x0) / (x1 - x0) * (cw - pad.l - pad.r);
  const Y = (y) => chh - pad.b - (y - y0) / (y1 - y0) * (chh - pad.t - pad.b);
  let hover = null;
  function base() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, chh);
    g.font = '11px "Pixelify Sans", monospace'; g.fillStyle = dim; g.textBaseline = 'middle';
    if (empty) { g.textAlign = 'center'; g.fillText('No data recorded yet — let time pass.', cw / 2, chh / 2); return; }
    g.strokeStyle = grid; g.lineWidth = 1; g.textAlign = 'right';
    for (const v of nice(y0, y1, 4)) { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(cw - pad.r, y); g.stroke(); g.fillText(fmt(v), pad.l - 6, y); }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (const v of nice(x0, x1, Math.max(2, Math.floor(cw / 90)))) { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, pad.t); g.lineTo(x, chh - pad.b); g.stroke(); g.fillText(String(Math.round(v)), x, chh - pad.b + 6); }
    for (const s of series) {
      if (!s.pts.length) continue;
      g.strokeStyle = U.css(s.color); g.lineWidth = s.width || 2; g.setLineDash(s.dash ? [5, 4] : []);
      g.beginPath(); s.pts.forEach(([x, y], k) => { const px = X(x), py = Y(y); if (k) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke();
      if (s.pts.length === 1) { g.fillStyle = U.css(s.color); g.fillRect(X(s.pts[0][0]) - 2, Y(s.pts[0][1]) - 2, 4, 4); }
    }
    g.setLineDash([]);
  }
  function draw() {
    base();
    if (!hover || empty) return;
    const hx = x0 + (hover - pad.l) / (cw - pad.l - pad.r) * (x1 - x0);
    const rows = [];
    for (const s of series) { let best = null, bd = Infinity; for (const p of s.pts) { const d = Math.abs(p[0] - hx); if (d < bd) { bd = d; best = p; } } if (best) rows.push([s, best]); }
    if (!rows.length) return;
    const yr = rows[0][1][0];
    g.strokeStyle = ink; g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(yr) + 0.5, pad.t); g.lineTo(X(yr) + 0.5, chh - pad.b); g.stroke(); g.globalAlpha = 1;
    for (const [s, p] of rows) { g.fillStyle = U.css(s.color); g.fillRect(X(p[0]) - 3, Y(p[1]) - 3, 6, 6); }
    const lines = [`Year ${Math.round(yr)}`].concat(rows.slice(0, 10).map(([s, p]) => `${s.name}: ${fmt(p[1])}`));
    g.font = '12px "Pixelify Sans", monospace';
    const tw = Math.max(...lines.map(l => g.measureText(l).width)) + 16, th = lines.length * 16 + 8;
    let bx = X(yr) + 12; if (bx + tw > cw) bx = X(yr) - tw - 12; const by = pad.t + 4;
    g.fillStyle = panel; g.globalAlpha = 0.95; g.fillRect(bx, by, tw, th); g.globalAlpha = 1; g.strokeStyle = grid; g.strokeRect(bx + 0.5, by + 0.5, tw, th);
    g.textAlign = 'left'; g.textBaseline = 'top';
    lines.forEach((l, k) => { g.fillStyle = k === 0 ? ink : U.css(rows[k - 1][0].color); g.fillText(l, bx + 8, by + 6 + k * 16); });
  }
  cv.onpointermove = (e) => { const r = cv.getBoundingClientRect(); hover = e.clientX - r.left; if (hover < pad.l || hover > cw - pad.r) hover = null; draw(); };
  cv.onpointerleave = () => { hover = null; draw(); };
  draw();
};
// series helper from country stats arrays [y,pop,army,area,sets,tech,gdp,dev]
Ch.METRICS = [
  { k: 1, name: 'Population' }, { k: 2, name: 'Army size' }, { k: 3, name: 'Land area' }, { k: 4, name: 'Settlements' },
  { k: 5, name: 'Technology' }, { k: 6, name: 'Economy (GDP)' }, { k: 7, name: 'Development index' },
];
Ch.countrySeries = (c, k) => ({ name: c.names[c.names.length - 1].n, color: c.color, pts: c.stats.map(r => [r[0], r[k]]) });
})();
