'use strict';
// ============================================================
//  Particles & effects
// ============================================================
(function () {
  class Parts {
    constructor() { this.list = []; }
    add(o) {
      if (this.list.length > 500) this.list.shift();
      const p = Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 30, t: 0, size: 1, col: '#ffffff', fr: 1, drag: 1, front: false }, o);
      p.max = p.life; this.list.push(p); return p;
    }
    update() {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.t++; p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag; p.x += p.vx; p.y += p.vy;
        if (p.fn) p.fn(p);
        if (p.t >= p.life) this.list.splice(i, 1);
      }
    }
    draw(ctx, cx, cy, front) {
      for (const p of this.list) {
        if (!!p.front !== !!front) continue;
        const x = Math.round(p.x - cx), y = Math.round(p.y - cy);
        if (x < -40 || y < -40 || x > AF.W + 40 || y > AF.H + 40) continue;
        const k = p.t / p.life;
        if (p.fade) ctx.globalAlpha = Math.max(0, 1 - k);
        if (p.spr) {
          const frames = p.spr, fi = Math.min(frames.length - 1, Math.floor(k * frames.length));
          AF.drawSpr(ctx, frames[fi], x, y, p.dir || 1);
        } else if (p.text) {
          AF.text(ctx, p.text, x, y - Math.min(10, p.t * .6), p.col, { a: 'c' });
        } else if (p.ring) {
          ctx.strokeStyle = p.col; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, p.ring + k * p.grow, 0, 7); ctx.stroke();
        } else {
          ctx.fillStyle = p.col; const s = p.shrink ? Math.max(1, Math.round(p.size * (1 - k))) : p.size;
          ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s);
        }
        ctx.globalAlpha = 1;
      }
    }
    clear() { this.list.length = 0; }
  }
  AF.Parts = Parts;

  // convenience emitters (g = play scene)
  AF.fx = {
    dust(g, x, y, n, col) { for (let i = 0; i < (n || 4); i++) g.parts.add({ x: x + AF.rr(-4, 4), y: y - 1, vx: AF.rr(-.8, .8), vy: AF.rr(-.8, -.1), life: AF.ri(12, 22), col: col || '#e8e0d0', size: 2, shrink: true, drag: .92 }); },
    puff(g, x, y) { g.parts.add({ x, y, spr: AF.SPR.fx.puff, life: 16 }); },
    hit(g, x, y, big) { g.parts.add({ x, y, spr: big ? AF.SPR.fx.bighit : AF.SPR.fx.hit, life: big ? 16 : 10, front: true }); for (let i = 0; i < (big ? 8 : 4); i++) g.parts.add({ x, y, vx: AF.rr(-2.5, 2.5), vy: AF.rr(-2.5, 1), g: .1, life: 14, col: AF.pick(['#ffffff', '#fff080', '#ffb040']), size: 2, shrink: true, front: true }); },
    boom(g, x, y, big) { g.parts.add({ x, y: y + 8, spr: AF.SPR.fx.boom, life: 24, front: true }); if (big) for (let i = 0; i < 10; i++) g.parts.add({ x, y, vx: AF.rr(-3, 3), vy: AF.rr(-4, 0), g: .15, life: 30, col: AF.pick(['#ff8020', '#ffd040', '#606070']), size: 3, shrink: true }); },
    sparkle(g, x, y, col) { g.parts.add({ x: x + AF.rr(-6, 6), y: y + AF.rr(-6, 6), spr: AF.SPR.fx.twinkle, life: 18, front: true }); },
    debris(g, x, y, col, n) { for (let i = 0; i < (n || 6); i++) g.parts.add({ x: x + AF.rr(-6, 6), y: y + AF.rr(-6, 6), vx: AF.rr(-2.5, 2.5), vy: AF.rr(-4, -1), g: .25, life: 40, col: col || '#a08060', size: AF.ri(2, 4), front: true }); },
    score(g, x, y, txt, col) { g.parts.add({ x, y, text: txt, life: 40, col: col || '#ffffff', front: true }); },
    splash(g, x, y, col) { for (let i = 0; i < 10; i++) g.parts.add({ x: x + AF.rr(-6, 6), y, vx: AF.rr(-1.5, 1.5), vy: AF.rr(-3.5, -1), g: .18, life: 30, col: col || AF.pick(['#ffffff', '#a0e0ff']), size: 2 }); },
    bubble(g, x, y) { g.parts.add({ x, y, vx: AF.rr(-.2, .2), vy: -.6, life: 60, spr: AF.SPR.fx.bubble, fn: p => { p.x += Math.sin(p.t * .2) * .2; if (g.lv.liquidAt(p.x, p.y - 2) === null) p.t = p.life; } }); },
    ring(g, x, y, col, r, grow) { g.parts.add({ x, y, ring: r || 2, grow: grow || 20, col: col || '#ffffff', life: 18, front: true }); },
    snow(g, x, y) { for (let i = 0; i < 3; i++) g.parts.add({ x: x + AF.rr(-3, 3), y: y - 1, vx: AF.rr(-1, 1), vy: AF.rr(-1.2, -.3), g: .08, life: 20, col: AF.pick(['#ffffff', '#d8e8ff']), size: 1 }); },
    ember(g, x, y) { g.parts.add({ x, y, vx: AF.rr(-.4, .4), vy: AF.rr(-1.2, -.4), life: AF.ri(30, 60), col: AF.pick(['#ff8020', '#ffd040', '#ff4010']), size: 1, fade: true }); },
    steam(g, x, y) { g.parts.add({ x: x + AF.rr(-3, 3), y, vx: AF.rr(-.3, .3), vy: AF.rr(-1.5, -.8), life: 40, col: AF.pick(['#f0f0f8', '#c8c8d8']), size: 3, fade: true, drag: .98 }); }
  };
})();
