'use strict';
// ============================================================
//  Physics: AABB bodies vs tiles & solid entities
// ============================================================
(function () {
  const TS = AF.TS, F = AF.TF;
  const EPS = 0.001;

  // is tile solid for horizontal movement
  function solidH(lv, tx, ty, b) {
    const t = lv.get(tx, ty);
    if (t === -1) return true;
    const f = AF.TFLAGS[t];
    return (f & F.SOLID) !== 0;
  }

  AF.moveX = function (b, lv, dx, ignore) {
    if (dx === 0) return false;
    b.x += dx;
    let hit = false;
    const y0 = Math.floor((b.y + EPS) / TS), y1 = Math.floor((b.y + b.h - EPS) / TS);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - EPS) / TS);
      for (let ty = y0; ty <= y1; ty++) if (solidH(lv, tx, ty, b)) { b.x = tx * TS - b.w; hit = true; break; }
    } else {
      const tx = Math.floor((b.x + EPS) / TS);
      for (let ty = y0; ty <= y1; ty++) if (solidH(lv, tx, ty, b)) { b.x = (tx + 1) * TS; hit = true; break; }
    }
    if (!b.noEntCollide) for (const s of lv.solids) {
      if (s === ignore || s === b || !s.solid || s.oneWay || s.dead) continue;
      if (!AF.rectsHit(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) continue;
      // only collide if we were not already inside (prevents snapping)
      if (dx > 0 && b.x + b.w - dx <= s.x + EPS + .5) { b.x = s.x - b.w; hit = true; if (s.onPushed) { s.onPushed(b, 1); b.pushedEnt = s; } }
      else if (dx < 0 && b.x - dx >= s.x + s.w - EPS - .5) { b.x = s.x + s.w; hit = true; if (s.onPushed) { s.onPushed(b, -1); b.pushedEnt = s; } }
    }
    if (hit) { b.vx = 0; b.hitWall = dx > 0 ? 1 : -1; }
    return hit;
  };

  AF.moveY = function (b, lv, dy, ignore) {
    const g = b.grav || 1;
    const prevTop = b.y, prevBot = b.y + b.h;
    b.y += dy;
    let landed = false, ceil = false;
    const x0 = Math.floor((b.x + EPS) / TS), x1 = Math.floor((b.x + b.w - EPS) / TS);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - EPS) / TS);
      for (let tx = x0; tx <= x1; tx++) {
        const t = lv.get(tx, ty); if (t === -1) continue;
        const f = AF.TFLAGS[t];
        let block = (f & F.SOLID) !== 0;
        if (!block && g > 0 && !b.dropThrough && prevBot <= ty * TS + EPS + .01) {
          if (f & F.ONEWAY) block = true;
          else if ((f & F.CLIMB) && b.ladderTop && !(AF.TFLAGS[lv.get(tx, ty - 1)] & F.CLIMB)) block = true;
        }
        if (block) { b.y = ty * TS - b.h; if (g > 0) { landed = true; b.groundTile = t; b.ground = null; } else ceil = true; break; }
      }
    } else if (dy < 0) {
      const ty = Math.floor((b.y + EPS) / TS);
      for (let tx = x0; tx <= x1; tx++) {
        const t = lv.get(tx, ty); if (t === -1) continue;
        const f = AF.TFLAGS[t];
        let block = (f & F.SOLID) !== 0;
        if (!block && g < 0 && (f & F.ONEWAY) && prevTop >= (ty + 1) * TS - EPS - .01) block = true;
        if (block) { b.y = (ty + 1) * TS; if (g < 0) { landed = true; b.groundTile = t; b.ground = null; } else ceil = true; break; }
      }
    }
    if (!b.noEntCollide) for (const s of lv.solids) {
      if (s === ignore || s === b || !s.solid || s.dead) continue;
      if (!AF.rectsHit(b.x, b.y, b.w, b.h, s.x, s.y, s.w, s.h)) continue;
      if (dy > 0) {
        if (s.oneWay && (g < 0 || b.dropThrough || prevBot > s.y + 2.5)) continue;
        if (!s.oneWay && prevBot > s.y + 4 + Math.abs(s.dy || 0)) continue;
        b.y = s.y - b.h;
        if (g > 0) { landed = true; b.ground = s; b.groundTile = 0; } else ceil = true;
      } else if (dy < 0) {
        if (s.oneWay && (g > 0 || prevTop < s.y + s.h - 2.5)) continue;
        if (!s.oneWay && prevTop < s.y + s.h - 4 - Math.abs(s.dy || 0)) continue;
        b.y = s.y + s.h;
        if (g < 0) { landed = true; b.ground = s; b.groundTile = 0; } else ceil = true;
      }
    }
    if (landed || ceil) b.vy = 0;
    return { landed, ceil };
  };

  // full move with gravity flag handling; returns landed bool
  AF.moveBody = function (b, lv) {
    b.hitWall = 0;
    const wasGround = b.onGround;
    // steps to avoid tunneling
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) / 7));
    let landed = false, ceil = false;
    for (let i = 0; i < steps; i++) {
      AF.moveX(b, lv, b.vx / steps);
      const r = AF.moveY(b, lv, b.vy / steps);
      if (r.landed) landed = true; if (r.ceil) ceil = true;
    }
    if (!landed) { b.ground = null; }
    b.onGround = landed;
    b.hitCeil = ceil;
    b.justLanded = landed && !wasGround;
    return landed;
  };

  // probe whether a rect overlaps any solid tile
  AF.rectSolid = function (lv, x, y, w, h, includeOneWay) {
    const x0 = Math.floor((x + EPS) / TS), x1 = Math.floor((x + w - EPS) / TS), y0 = Math.floor((y + EPS) / TS), y1 = Math.floor((y + h - EPS) / TS);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const t = lv.get(tx, ty); if (t === -1) return true;
      const f = AF.TFLAGS[t]; if (f & F.SOLID) return true;
    }
    for (const s of lv.solids) if (s.solid && !s.oneWay && !s.dead && AF.rectsHit(x, y, w, h, s.x, s.y, s.w, s.h)) return true;
    return false;
  };
  // tile flags at a point
  AF.flagAt = function (lv, px, py) { return AF.TFLAGS[Math.max(0, lv.get(Math.floor(px / TS), Math.floor(py / TS)))] || 0; };
  AF.tileAt = function (lv, px, py) { return lv.get(Math.floor(px / TS), Math.floor(py / TS)); };
  // ground ahead check for patrolling walkers: is there floor below point?
  AF.groundAt = function (lv, px, py) {
    const t = lv.get(Math.floor(px / TS), Math.floor(py / TS));
    if (t === -1) return true;
    const f = AF.TFLAGS[t];
    if (f & (F.SOLID | F.ONEWAY)) return true;
    for (const s of lv.solids) if (s.solid && !s.dead && px >= s.x && px < s.x + s.w && py >= s.y && py < s.y + s.h) return true;
    return false;
  };
})();
