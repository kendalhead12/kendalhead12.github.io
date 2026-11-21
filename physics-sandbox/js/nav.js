// Grid navigation for NPCs: obstacle grid built from map geometry + A* with line-of-sight smoothing.
import * as THREE from 'three';

export class NavGrid {
  constructor(minX, minZ, maxX, maxZ, cell = 1) {
    this.minX = minX; this.minZ = minZ; this.cell = cell;
    this.w = Math.ceil((maxX - minX) / cell); this.h = Math.ceil((maxZ - minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h);
    this.maxX = maxX; this.maxZ = maxZ;
  }
  ix(x) { return Math.floor((x - this.minX) / this.cell); }
  iz(z) { return Math.floor((z - this.minZ) / this.cell); }
  inside(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  cellBlocked(i, j) { return !this.inside(i, j) || this.blocked[j * this.w + i] === 1; }
  isBlocked(x, z) { return this.cellBlocked(this.ix(x), this.iz(z)); }
  markRect(x0, z0, x1, z1, pad = 0.35) {
    const a = this.ix(Math.min(x0, x1) - pad), b = this.ix(Math.max(x0, x1) + pad);
    const c = this.iz(Math.min(z0, z1) - pad), d = this.iz(Math.max(z0, z1) + pad);
    for (let j = c; j <= d; j++) for (let i = a; i <= b; i++) if (this.inside(i, j)) this.blocked[j * this.w + i] = 1;
  }
  markCircle(x, z, r, pad = 0.35) {
    const R = r + pad;
    for (let j = this.iz(z - R); j <= this.iz(z + R); j++) for (let i = this.ix(x - R); i <= this.ix(x + R); i++) {
      if (!this.inside(i, j)) continue;
      const cx = this.minX + (i + 0.5) * this.cell, cz = this.minZ + (j + 0.5) * this.cell;
      if ((cx - x) ** 2 + (cz - z) ** 2 <= R * R) this.blocked[j * this.w + i] = 1;
    }
  }
  markFn(fn) { // fn(x,z) -> true if blocked
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) {
      if (fn(this.minX + (i + 0.5) * this.cell, this.minZ + (j + 0.5) * this.cell)) this.blocked[j * this.w + i] = 1;
    }
  }
  lineClear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / (this.cell * 0.5));
    for (let k = 0; k <= n; k++) {
      const t = n ? k / n : 0;
      if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }
  nearestFree(x, z, maxR = 8) {
    if (!this.isBlocked(x, z)) return { x, z };
    for (let r = 1; r <= maxR; r++) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos(a / 16 * 6.283) * r * this.cell, pz = z + Math.sin(a / 16 * 6.283) * r * this.cell;
        if (!this.isBlocked(px, pz)) return { x: px, z: pz };
      }
    }
    return null;
  }
  findPath(sx, sz, gx, gz, maxIter = 6000) {
    if (this.lineClear(sx, sz, gx, gz)) return [new THREE.Vector3(gx, 0, gz)];
    const s0 = this.nearestFree(sx, sz, 3), g0 = this.nearestFree(gx, gz, 6);
    if (!s0 || !g0) return null;
    const si = this.ix(s0.x), sj = this.iz(s0.z), gi = this.ix(g0.x), gj = this.iz(g0.z);
    const W = this.w;
    const start = sj * W + si, goal = gj * W + gi;
    const gScore = new Map(), came = new Map();
    const heap = new MinHeap();
    gScore.set(start, 0);
    heap.push(start, 0);
    const closed = new Set();
    let iter = 0, found = false, best = start, bestH = Infinity;
    while (heap.size && iter++ < maxIter) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const ci = cur % W, cj = (cur / W) | 0;
      const h0 = Math.hypot(gi - ci, gj - cj);
      if (h0 < bestH) { bestH = h0; best = cur; }
      const gc = gScore.get(cur);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (this.cellBlocked(ni, nj)) continue;
        if (di && dj && (this.cellBlocked(ci + di, cj) || this.cellBlocked(ci, cj + dj))) continue;
        const nk = nj * W + ni;
        const ng = gc + (di && dj ? 1.414 : 1);
        if (ng < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, ng); came.set(nk, cur);
          heap.push(nk, ng + Math.hypot(gi - ni, gj - nj));
        }
      }
    }
    const end = found ? goal : best;
    const cells = [];
    for (let c = end; c !== undefined; c = came.get(c)) { cells.push(c); if (c === start) break; }
    cells.reverse();
    const pts = cells.map(c => new THREE.Vector3(this.minX + ((c % W) + 0.5) * this.cell, 0, this.minZ + (((c / W) | 0) + 0.5) * this.cell));
    if (found) pts.push(new THREE.Vector3(gx, 0, gz));
    // string-pull smoothing
    const out = [];
    let ax = sx, az = sz, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let m = pts.length - 1; m > k; m--) { if (this.lineClear(ax, az, pts[m].x, pts[m].z)) { far = m; break; } }
      out.push(pts[far]); ax = pts[far].x; az = pts[far].z; k = far + 1;
    }
    return out.length ? out : null;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) {
    this.k.push(k); this.p.push(p);
    let i = this.k.length - 1;
    while (i > 0) { const pa = (i - 1) >> 1; if (this.p[pa] <= p) break; this.swap(i, pa); i = pa; }
  }
  pop() {
    const top = this.k[0]; const lk = this.k.pop(), lp = this.p.pop();
    if (this.k.length) {
      this.k[0] = lk; this.p[0] = lp;
      let i = 0; const n = this.k.length;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < n && this.p[l] < this.p[m]) m = l; if (r < n && this.p[r] < this.p[m]) m = r;
        if (m === i) break; this.swap(i, m); i = m; }
    }
    return top;
  }
  swap(a, b) { [this.k[a], this.k[b]] = [this.k[b], this.k[a]]; [this.p[a], this.p[b]] = [this.p[b], this.p[a]]; }
}
