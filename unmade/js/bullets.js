'use strict';
// ============================================================
//  Reusable projectile system (with snapshot/rewind support)
// ============================================================
(function () {
  // bullet types: 'norm' (white), 'heal' (green), 'fake' (gold "health beam"),
  // 'still' (blue: only hurts if you move), 'move' (orange: only hurts if you stay still)
  const TYPE_COL = { norm: '#ffffff', heal: '#5cff6a', fake: '#ffd84a', still: '#4fd8ff', move: '#ff9a2a' };
  U.BulletCol = TYPE_COL;
  class Bullets {
    constructor(B) { this.B = B; this.list = []; }
    add(o) {
      const b = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, r: 3, shape: 'circle', w: 6, h: 6, rot: 0, vr: 0, type: 'norm', dmg: 4, life: 900, t: 0, alpha: 1, hit: true, warn: 0, clip: true, dead: false, scale: 1 }, o);
      if (!b.col) b.col = TYPE_COL[b.type] || '#fff';
      this.list.push(b);
      return b;
    }
    ring(x, y, n, speed, o, a0) { const out = []; for (let i = 0; i < n; i++) { const a = (a0 || 0) + i / n * Math.PI * 2; out.push(this.add(Object.assign({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }, o))); } return out; }
    aimAt(x, y, speed, tx, ty, o) { const a = Math.atan2(ty - y, tx - x); return this.add(Object.assign({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed }, o)); }
    update() {
      const B = this.B, box = B.box;
      for (const b of this.list) {
        if (b.dead) continue;
        b.t++;
        if (b.update) b.update(b, B);
        if (!b.manual) { b.vx += b.ax; b.vy += b.ay; b.x += b.vx; b.y += b.vy; b.rot += b.vr; }
        if (b.t > b.life) b.dead = true;
        const m = b.margin == null ? 60 : b.margin;
        if (b.x < box.x - m || b.x > box.x + box.w + m || b.y < box.y - m - 40 || b.y > box.y + box.h + m) { if (!b.keep) b.dead = true; }
      }
      this.list = this.list.filter(b => !b.dead);
    }
    // returns bullets touching a circle (x, y, r)
    hits(x, y, r) {
      const out = [];
      for (const b of this.list) {
        if (b.dead || !b.hit || b.t < b.warn || b.alpha < .3) continue;
        if (b.shape === 'rect' || b.shape === 'beam') {
          const c = Math.cos(-b.rot), s = Math.sin(-b.rot);
          const dx = x - b.x, dy = y - b.y;
          const lx = dx * c - dy * s, ly = dx * s + dy * c;
          if (Math.abs(lx) < b.w * b.scale / 2 + r - 1 && Math.abs(ly) < b.h * b.scale / 2 + r - 1) out.push(b);
        } else {
          const rr = b.r * b.scale + r - .5;
          if ((x - b.x) * (x - b.x) + (y - b.y) * (y - b.y) < rr * rr) out.push(b);
        }
      }
      return out;
    }
    draw(ctx) {
      const B = this.B, box = B.box;
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x + 3, box.y + 3, box.w - 6, box.h - 6); ctx.clip();
      for (const b of this.list) if (b.clip !== false) this.drawOne(ctx, b);
      ctx.restore();
      for (const b of this.list) if (b.clip === false) this.drawOne(ctx, b);
    }
    drawOne(ctx, b) {
      ctx.globalAlpha = Math.max(0, Math.min(1, b.alpha));
      if (b.t < b.warn) {
        // telegraph
        ctx.globalAlpha = (Math.floor(b.t / 4) % 2) ? .6 : .25;
        if (b.warnDraw) b.warnDraw(ctx, b);
        else if (b.shape === 'rect' || b.shape === 'beam') { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.strokeStyle = b.col; ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore(); }
        else { ctx.strokeStyle = b.col; ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 1, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 1;
        return;
      }
      if (b.draw) b.draw(ctx, b);
      else if (b.spr) {
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); if (b.rot) ctx.rotate(b.rot);
        const w = b.spr.width * b.scale, h = b.spr.height * b.scale;
        ctx.drawImage(b.spr, -w / 2, -h / 2, w, h); ctx.restore();
      } else if (b.shape === 'rect' || b.shape === 'beam') {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.fillStyle = b.col; ctx.fillRect(-b.w * b.scale / 2, -b.h * b.scale / 2, b.w * b.scale, b.h * b.scale); ctx.restore();
      } else {
        const r = b.r * b.scale;
        ctx.fillStyle = b.col;
        if (r <= 1.5) ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 3, 3);
        else { ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), r + .5, 0, Math.PI * 2); ctx.fill(); if (r >= 3 && b.type !== 'norm') { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - r * .5), 2, 2); } }
      }
      ctx.globalAlpha = 1;
    }
    clear() { this.list.length = 0; }
    // ----- time-magic support (rewinding projectile movement) -----
    snapshot() { return this.list.map(b => ({ ref: b, x: b.x, y: b.y, vx: b.vx, vy: b.vy, rot: b.rot, t: b.t, alpha: b.alpha })); }
    restore(snap) { this.list = snap.map(s => Object.assign(s.ref, { x: s.x, y: s.y, vx: s.vx, vy: s.vy, rot: s.rot, t: s.t, alpha: s.alpha, dead: false })); }
  }
  U.Bullets = Bullets;

  // ---------- shared bullet art ----------
  const Art = U.Art;
  U.BulletArt = {
    flame: (col) => Art.cached('bflame|' + col, () => { const p = new U.Pix(9, 11); p.ellipse(4, 7, 3.5, 3.5, col); p.tri(1, 6, 4, 0, 7, 6, col); p.ellipse(4, 7, 1.5, 2, '#ffffff'); return p.c; }),
    beam: () => Art.cached('bbeam', () => { const p = new U.Pix(9, 9); p.px(4, 0, '#fff6c8'); p.px(4, 8, '#fff6c8'); p.px(0, 4, '#fff6c8'); p.px(8, 4, '#fff6c8'); p.rect(3, 1, 3, 7, '#ffd84a'); p.rect(1, 3, 7, 3, '#ffd84a'); p.rect(3, 3, 3, 3, '#ffffff'); return p.c; }),
    snowflake: (col) => Art.cached('bflake|' + col, () => { const p = new U.Pix(7, 7); p.vl(3, 0, 6, col); p.hl(0, 6, 3, col); p.px(1, 1, col); p.px(5, 1, col); p.px(1, 5, col); p.px(5, 5, col); return p.c; }),
    bomb: () => Art.cached('bbomb', () => { const p = new U.Pix(12, 13); p.circle(6, 7, 5, '#ffffff'); p.circle(6, 7, 3, '#b8b8b8'); p.rect(5, 0, 2, 3, '#ffffff'); p.px(7, 0, '#ffffff'); p.px(4, 5, '#ffffff'); return p.c; }),
    star: () => Art.cached('bstar', () => { const p = new U.Pix(9, 9); p.vl(4, 0, 8, '#fff'); p.hl(0, 8, 3, '#fff'); p.rect(2, 2, 5, 5, '#fff'); p.px(1, 7, '#fff'); p.px(7, 7, '#fff'); p.px(4, 4, '#888'); return p.c; }),
    drop: () => Art.cached('bdrop', () => { const p = new U.Pix(5, 8); p.ellipse(2, 5, 2, 2.5, '#fff'); p.vl(2, 0, 3, '#fff'); return p.c; }),
    leaf: () => Art.cached('bleaf', () => { const p = new U.Pix(7, 4); p.ellipse(3, 2, 3, 1.5, '#fff'); p.px(3, 2, '#888'); return p.c; }),
    pancake: () => Art.cached('bpancake', () => { const p = new U.Pix(14, 7); p.ellipse(7, 3, 6.5, 3, '#ffffff'); p.ellipse(7, 3, 5, 1.8, '#c8c8c8'); p.rect(5, 1, 4, 2, '#ffffff'); return p.c; }),
    needle: () => Art.cached('bneedle', () => { const p = new U.Pix(10, 3); p.hl(0, 9, 1, '#fff'); p.px(9, 0, '#fff'); p.px(9, 2, '#fff'); return p.c; }),
    cone: () => Art.cached('bcone', () => { const p = new U.Pix(8, 10); p.ellipse(4, 5, 3.5, 4.5, '#ffffff'); for (let y = 2; y < 9; y += 2) p.hl(1, 6, y, '#999'); p.vl(4, 0, 1, '#fff'); return p.c; }),
    shard: () => Art.cached('bshard', () => { const p = new U.Pix(6, 10); p.tri(0, 9, 3, 0, 6, 9, '#ffffff'); p.vl(3, 3, 8, '#bdeeff'); return p.c; }),
    moth: (f) => Art.cached('bmoth|' + f, () => { const p = new U.Pix(9, 7); p.ellipse(2, 3, 2, f ? 1 : 3, '#fff'); p.ellipse(6, 3, 2, f ? 1 : 3, '#fff'); p.rect(4, 1, 1, 5, '#999'); return p.c; }),
    cat: (f) => Art.cached('bcat|' + f, () => { const p = new U.Pix(20, 12); p.rect(4, 4, 11, 5, '#fff'); p.circle(16, 4, 3.5, '#fff'); p.tri(13, 2, 14, -2, 16, 1, '#fff'); p.tri(17, 1, 19, -2, 20, 2, '#fff'); p.px(16, 3, '#000'); p.px(18, 3, '#000'); p.line(4, 5, 0, 1, '#fff'); if (f) { p.rect(4, 9, 2, 3, '#fff'); p.rect(12, 9, 2, 3, '#fff'); } else { p.rect(6, 9, 2, 3, '#fff'); p.rect(10, 9, 2, 3, '#fff'); } return p.c; }),
    eight: () => Art.cached('beight', () => { const p = new U.Pix(10, 16); p.circle(5, 4, 4, '#fff'); p.circle(5, 4, 2, '#000'); p.circle(5, 11, 4.5, '#fff'); p.circle(5, 11, 2.5, '#000'); return p.c; }),
    flag: () => Art.cached('bflag', () => { const p = new U.Pix(8, 12); p.vl(0, 0, 11, '#fff'); p.rect(1, 0, 7, 5, '#fff'); p.rect(2, 1, 3, 3, '#888'); return p.c; }),
    pebble: () => Art.cached('bpebble', () => { const p = new U.Pix(5, 5); p.circle(2, 2, 2, '#bbbbbb'); p.px(1, 1, '#fff'); return p.c; }),
  };
})();
