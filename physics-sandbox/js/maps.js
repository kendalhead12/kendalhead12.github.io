// The five sandbox maps. Each builds static geometry + colliders + nav grid and returns a map object.
import * as THREE from 'three';
import { mergeGeometries } from '../lib/BufferGeometryUtils.js';
import { G } from './state.js';
import { settings } from './config.js';
import { createStaticCollider, createBody, raycast, groups, GROUP } from './physics.js';
import { setupEnvironment, canvasTexture, noiseFill, mat } from './render.js';
import { NavGrid } from './nav.js';
import { Prop, PROP_BY_ID, spawnBrickWall } from './props.js';
import { Vehicle, VEHICLE_BY_ID } from './vehicles.js';
import { play } from './audio.js';

export const MAPS = [
  { id: 'superflat', name: 'Superflat', desc: 'An endless white-and-grey grid under a bright blue sky. Perfect for physics experiments.' },
  { id: 'city', name: 'Abandoned City', desc: 'Empty streets, tall buildings, streetlights and abandoned cars. Some buildings can be entered.' },
  { id: 'forest', name: 'Forest', desc: 'Rolling hills, dense trees, rocks, grass and a lake.' },
  { id: 'facility', name: 'Testing Facility', desc: 'An indoor laboratory with test chambers, observation rooms, elevators and physics equipment.' },
  { id: 'desert', name: 'Desert', desc: 'Vast dunes, towering rock formations and abandoned structures.' },
];

// ---------- noise ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z, oct = 4) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2; } return s / n; }
const rng = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- textures ----------
const T = {
  grid: () => canvasTexture('grid', 256, 256, (x, w, h) => {
    x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e2e2e2'; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
    x.strokeStyle = '#a8a8a8'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3);
    x.strokeStyle = '#c8c8c8'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  }),
  asphalt: () => canvasTexture('asphalt', 256, 256, (x, w, h) => { noiseFill(x, w, h, '#3c3e42', 0.18, 9000, 2); for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(20,20,20,0.5)'; x.lineWidth = 1; x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); } }),
  sidewalk: () => canvasTexture('sidewalk', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#a8a69e', 0.12, 3000, 2); x.strokeStyle = 'rgba(60,60,60,0.5)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); }),
  facade: (k, base, win) => canvasTexture('facade' + k, 128, 128, (x, w, h) => {
    noiseFill(x, w, h, base, 0.1, 1500, 2);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const lit = Math.random() < 0.08, broken = Math.random() < 0.15;
      x.fillStyle = broken ? '#111' : lit ? '#c8b070' : win;
      x.fillRect(c * 64 + 12, r * 64 + 14, 40, 38);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(c * 64 + 12, r * 64 + 14, 40, 6);
      x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(c * 64 + 10, r * 64 + 52, 44, 4);
    }
  }),
  concrete: () => canvasTexture('concreteW', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#8e8c86', 0.14, 3000, 2); x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, 0, w, 2); x.fillRect(0, 0, 2, h); }),
  grass: () => canvasTexture('grass', 256, 256, (x, w, h) => { noiseFill(x, w, h, '#ffffff', 0.25, 12000, 2); }),
  sand: () => canvasTexture('sand', 256, 256, (x, w, h) => { noiseFill(x, w, h, '#ffffff', 0.12, 9000, 1); x.strokeStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 30; i++) { x.beginPath(); const y = i * 9; x.moveTo(0, y); x.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + 3); x.stroke(); } }),
  rock: () => canvasTexture('rock', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#ffffff', 0.3, 5000, 3); }),
  labFloor: () => canvasTexture('labfloor', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#d8dcdf', 0.05, 800, 2); x.strokeStyle = '#9aa2a8'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); }),
  labWall: () => canvasTexture('labwall', 128, 128, (x, w, h) => { x.fillStyle = '#e8ecee'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b8c0c6'; x.lineWidth = 2; x.strokeRect(1, 1, w - 2, h - 2); x.fillStyle = '#ff9a1a'; x.fillRect(0, h - 10, w, 6); }),
  hazardFloor: () => canvasTexture('hazfloor', 128, 128, (x, w, h) => { x.fillStyle = '#222'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c200'; for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 16 + h, h); x.lineTo(i * 32 + h, h); x.fill(); } }),
  wood: () => canvasTexture('shackwood', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#8a6a4a', 0.2, 2000, 2); x.fillStyle = 'rgba(40,25,10,0.5)'; for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 2, h); }),
};

// ---------- builder ----------
class Builder {
  constructor() {
    this.group = new THREE.Group();
    this.batches = new Map(); // material -> geometries
    this.obstacles = [];      // {x0,z0,x1,z1} or {x,z,r}
    this.buttons = []; this.platforms = []; this.updaters = [];
  }
  // world-sized UVs on a box so textures tile evenly
  boxGeo(w, h, d, tile) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (tile) {
      const uv = g.attributes.uv;
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
    }
    return g;
  }
  addGeo(geo, material, pos, rot, { shadow = true } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot || [0, 0, 0]))), new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(m);
    const key = material.uuid + (shadow ? 's' : 'n');
    if (!this.batches.has(key)) this.batches.set(key, { material, shadow, geos: [] });
    this.batches.get(key).geos.push(geo.index ? geo.toNonIndexed() : geo);
  }
  // static box: centre position, full sizes
  box(x, y, z, w, h, d, material, { tile = 0, collide = true, nav = true, rotY = 0, shadow = true, owner } = {}) {
    this.addGeo(this.boxGeo(w, h, d, tile), material, [x, y, z], [0, rotY, 0], { shadow });
    if (collide) {
      const R = G.RAPIER;
      const cd = R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z).setFriction(0.8).setCollisionGroups(groups(GROUP.WORLD));
      if (rotY) { const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY); cd.setRotation(q); }
      createStaticCollider(cd, owner || { type: 'world' });
    }
    if (nav && collide && y - h / 2 < 1.6 && y + h / 2 > 0.35) {
      if (!rotY) this.obstacles.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
      else { const r = Math.max(w, d) / 2; this.obstacles.push({ x, z, r: Math.min(r, Math.min(w, d) / 2 + 0.3) }); }
    }
  }
  cyl(x, y, z, r, h, material, { collide = true, nav = true, seg = 12 } = {}) {
    this.addGeo(new THREE.CylinderGeometry(r, r, h, seg), material, [x, y, z]);
    if (collide) createStaticCollider(G.RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, y, z).setCollisionGroups(groups(GROUP.WORLD)));
    if (nav && collide && y - h / 2 < 1.6) this.obstacles.push({ x, z, r });
  }
  ramp(x, y, z, w, len, rise, material, rotY = 0) {
    // inclined slab, low end at -z (before rotation)
    const ang = Math.atan2(rise, len);
    const L = Math.hypot(len, rise);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-ang, rotY, 0, 'YXZ'));
    const geo = this.boxGeo(w, 0.2, L, 2);
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y + rise / 2, z), q, new THREE.Vector3(1, 1, 1)));
    this.addGeo(geo, material, [0, 0, 0]);
    createStaticCollider(G.RAPIER.ColliderDesc.cuboid(w / 2, 0.1, L / 2).setTranslation(x, y + rise / 2, z).setRotation(q).setCollisionGroups(groups(GROUP.WORLD)));
  }
  mesh(m) { this.group.add(m); return m; }
  finalize() {
    for (const { material, shadow, geos } of this.batches.values()) {
      // strip to common attributes
      for (const g of geos) { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
      const merged = mergeGeometries(geos, false);
      const m = new THREE.Mesh(merged, material);
      m.castShadow = shadow; m.receiveShadow = true;
      this.group.add(m);
    }
    G.scene.add(this.group);
  }
  navGrid(minX, minZ, maxX, maxZ, cell, extraFn) {
    const nav = new NavGrid(minX, minZ, maxX, maxZ, cell);
    for (const o of this.obstacles) { if (o.r !== undefined) nav.markCircle(o.x, o.z, o.r); else nav.markRect(o.x0, o.z0, o.x1, o.z1); }
    if (extraFn) nav.markFn(extraFn);
    return nav;
  }
  terrain(size, seg, heightFn, material, colorFn) {
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightFn(x, z);
      pos.setY(i, y);
      if (colorFn) { const c = colorFn(x, y, z); colors.push(c.r, c.g, c.b); }
    }
    if (colorFn) geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.receiveShadow = true;
    this.group.add(m);
    const verts = new Float32Array(pos.array);
    const idx = new Uint32Array(geo.index.array);
    createStaticCollider(G.RAPIER.ColliderDesc.trimesh(verts, idx).setFriction(0.9).setCollisionGroups(groups(GROUP.WORLD)));
    return m;
  }
  // kinematic moving platform; update(t) returns target position
  platform(w, h, d, material, start, fn) {
    const R = G.RAPIER;
    const mesh = new THREE.Mesh(this.boxGeo(w, h, d, 1), material);
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
    const p = { delta: new THREE.Vector3(), mesh, fn, pos: start.clone() };
    p.body = createBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y, start.z),
      [R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setFriction(1).setCollisionGroups(groups(GROUP.WORLD))], { type: 'world', platform: p });
    mesh.position.copy(start);
    this.platforms.push(p);
    return p;
  }
  // rotating kinematic arm
  rotor(center, armLen, material, speed) {
    const R = G.RAPIER;
    const mesh = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLen * 2, 0.4, 0.5), material); arm.castShadow = true; mesh.add(arm);
    this.group.add(mesh);
    const body = createBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(center.x, center.y, center.z),
      [R.ColliderDesc.cuboid(armLen, 0.2, 0.25).setCollisionGroups(groups(GROUP.WORLD))], { type: 'world' });
    let a = 0;
    this.updaters.push((dt) => {
      if (G.map && G.map.rotorsOn === false) return;
      a += speed * dt;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
      body.setNextKinematicRotation(q);
      mesh.position.copy(center); mesh.quaternion.copy(q);
    });
  }
  button(pos, label, onPress, color = 0xd02020) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.12), mat(0x444a50, { metalness: 0.6 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
    cap.rotation.x = Math.PI / 2; cap.position.z = 0.08;
    g.add(base, cap); g.position.copy(pos);
    this.group.add(g);
    const b = { pos: pos.clone(), label, press: () => { play('ui', pos, 1); cap.position.z = 0.05; setTimeout(() => cap.position.z = 0.08, 200); onPress(); G.ui.toast(label); } };
    this.buttons.push(b);
    return g;
  }
}

function heightLookup(fn) { return { groundAt: fn }; }

function finishMap(b, base) {
  b.finalize();
  const map = {
    killY: -60, nav: null, buttons: b.buttons, platforms: b.platforms, group: b.group,
    walkable(x, z) {
      if (this.bounds && (Math.abs(x) > this.bounds || Math.abs(z) > this.bounds)) return false;
      if (this.waterLevel !== undefined && this.groundAt(x, z) < this.waterLevel - 0.4) return false;
      return !this.nav || !this.nav.isBlocked(x, z);
    },
    groundBelow(p) {
      const hit = raycast(new THREE.Vector3(p.x, p.y + 1.5, p.z), new THREE.Vector3(0, -1, 0), 60, { filter: (c, o) => o && o.type === 'world' });
      return hit ? hit.point.y : this.groundAt(p.x, p.z);
    },
    update(dt) {
      for (const p of b.platforms) {
        const target = p.fn(G.time, p);
        p.delta.copy(target).sub(p.pos);
        p.pos.copy(target);
        p.body.setNextKinematicTranslation({ x: target.x, y: target.y, z: target.z });
        p.mesh.position.copy(target);
      }
      for (const u of b.updaters) u(dt);
      if (base.update) base.update(dt);
    },
    ...base,
  };
  return map;
}

// ======================= MAPS =======================
function buildSuperflat() {
  setupEnvironment({ skyTop: 0x1f6fe0, skyBottom: 0x9ed0ff, fog: 0xb8dcff, fogScale: 1.4, sunIntensity: 2.8, hemiIntensity: 1.3, hemiGround: 0xcfcfcf, sunDir: [0.5, 1.1, 0.35] });
  const b = new Builder();
  const tex = T.grid().clone(); tex.needsUpdate = true; tex.repeat.set(1000, 1000);
  tex.anisotropy = G.renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  b.mesh(ground);
  createStaticCollider(G.RAPIER.ColliderDesc.cuboid(2000, 1, 2000).setTranslation(0, -1, 0).setFriction(0.8).setCollisionGroups(groups(GROUP.WORLD)));
  return finishMap(b, { id: 'superflat', spawnPoint: { pos: new THREE.Vector3(0, 0.05, 6), yaw: 0 }, groundAt: () => 0 });
}

function buildCity() {
  setupEnvironment({ skyTop: 0x6a92c0, skyBottom: 0xc8d4dc, fog: 0xb4c0c8, fogScale: 0.55, sunIntensity: 1.8, sunColor: 0xffe8d0, hemiIntensity: 1.25, hemiSky: 0xc0d0e0, hemiGround: 0x6a6660, sunDir: [0.4, 0.9, -0.5], sunGlow: 0.4 });
  const b = new Builder();
  const rand = rng(1234);
  const asphalt = T.asphalt().clone(); asphalt.needsUpdate = true; asphalt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; b.mesh(ground);
  createStaticCollider(G.RAPIER.ColliderDesc.cuboid(400, 1, 400).setTranslation(0, -1, 0).setCollisionGroups(groups(GROUP.WORLD)));
  const walk = mat(0xffffff, { map: T.sidewalk(), roughness: 0.9 });
  const facades = [['#8a7a6a', '#2a3440'], ['#a09888', '#30404c'], ['#6a6e74', '#1e2a34'], ['#9a6a52', '#2a3038'], ['#b8b0a0', '#3a4a58']].map(([c, w], i) => mat(0xffffff, { map: T.facade(i, c, w), roughness: 0.85 }));
  const roof = mat(0x4a4a4a, { roughness: 1 });
  const concrete = mat(0xffffff, { map: T.concrete(), roughness: 0.95 });
  const pole = mat(0x3a3e44, { metalness: 0.7, roughness: 0.4 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe0a0, emissiveIntensity: 1.5 });
  const lineM = new THREE.MeshBasicMaterial({ color: 0xd8d0a0 });
  const P = 52, BS = 36, N = 2;  // block period, block size, blocks each side
  const interiors = new Set(['0,1', '-1,0', '1,-1']);
  const doorSpots = [];
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const cx = i * P, cz = j * P;
    b.box(cx, 0.06, cz, BS, 0.12, BS, walk, { tile: 3, nav: false });
    if (i === 0 && j === 0) { // central plaza with fountain-ish planter
      b.box(cx, 0.5, cz, 6, 0.8, 6, concrete, { tile: 2 });
      continue;
    }
    if (interiors.has(`${i},${j}`)) { doorSpots.push(buildEnterable(b, cx, cz, facades[(i + j + 5) % 5], concrete, rand)); continue; }
    // 2-4 buildings per block with alleys
    const split = rand() < 0.5;
    const parts = split ? [[-BS / 4 - 1, 0, BS / 2 - 3, BS - 6], [BS / 4 + 1, 0, BS / 2 - 3, BS - 6]] : [[0, -BS / 4 - 1, BS - 6, BS / 2 - 3], [0, BS / 4 + 1, BS - 6, BS / 2 - 3]];
    for (const [ox, oz, w, d] of parts) {
      const h = 9 + Math.floor(rand() * 9) * 4;
      const f = facades[Math.floor(rand() * facades.length)];
      b.box(cx + ox, h / 2 + 0.12, cz + oz, w, h, d, f, { tile: 4 });
      b.box(cx + ox, h + 0.3, cz + oz, w + 0.4, 0.4, d + 0.4, roof, { nav: false });
    }
  }
  // streetlights + lane lines
  for (let i = -N; i <= N + 1; i++) {
    const s = i * P - P / 2;
    for (let k = -130; k <= 130; k += 26) {
      for (const [x, z, ry] of [[s - 7.6, k, 0], [k, s - 7.6, Math.PI / 2]]) {
        if (Math.abs(x) > 128 || Math.abs(z) > 128) continue;
        b.cyl(x, 3, z, 0.12, 6, pole, { seg: 8 });
        b.box(x + (ry ? 0 : 0.8), 6, z + (ry ? 0.8 : 0), ry ? 0.15 : 1.8, 0.15, ry ? 1.8 : 0.15, pole, { collide: false });
        b.box(x + (ry ? 0 : 1.5), 5.85, z + (ry ? 1.5 : 0), 0.5, 0.15, 0.5, lamp, { collide: false, shadow: false });
      }
    }
    for (let k = -130; k <= 130; k += 6) {
      if (Math.abs(s) > 130) continue;
      b.addGeo(new THREE.PlaneGeometry(0.2, 2.5).rotateX(-Math.PI / 2), lineM, [s, 0.012, k], null, { shadow: false });
      b.addGeo(new THREE.PlaneGeometry(2.5, 0.2).rotateX(-Math.PI / 2), lineM, [k, 0.012, s], null, { shadow: false });
    }
  }
  const map = finishMap(b, {
    id: 'city', spawnPoint: { pos: new THREE.Vector3(0, 0.2, 10), yaw: 0 }, groundAt: () => 0, bounds: 150,
    spawnInitial() {
      // abandoned vehicles, debris and furniture
      for (let k = 0; k < 14; k++) {
        const street = (Math.floor(rand() * 4) - 2) * P + P / 2;
        const along = (rand() - 0.5) * 220;
        const horiz = rand() < 0.5;
        const pos = horiz ? new THREE.Vector3(along, 0, street + (rand() - 0.5) * 6) : new THREE.Vector3(street + (rand() - 0.5) * 6, 0, along);
        const def = k < 3 ? VEHICLE_BY_ID[['sedan', 'pickup', 'sedan'][k]] : VEHICLE_BY_ID.wreck;
        new Vehicle(def, pos, (horiz ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.6);
      }
      const junk = ['dumpster', 'crate', 'barrel', 'cone', 'cone', 'tire', 'cardboard', 'explosive', 'oildrum'];
      for (let k = 0; k < 40; k++) {
        const id = junk[Math.floor(rand() * junk.length)];
        const i = Math.floor(rand() * 5) - 2, j = Math.floor(rand() * 5) - 2;
        const side = Math.floor(rand() * 4);
        const off = (rand() - 0.5) * 30;
        const e = BS / 2 + 1.5;
        const p = [[off, e], [off, -e], [e, off], [-e, off]][side];
        const pos = new THREE.Vector3(i * P + p[0], 1, j * P + p[1]);
        new Prop(PROP_BY_ID[id], pos);
      }
      for (const spot of doorSpots) {
        for (const [id, x, z] of spot.furniture) new Prop(PROP_BY_ID[id], new THREE.Vector3(x, spot.floorY, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6));
        for (const w of spot.windows) { const g = new Prop(PROP_BY_ID.glass, w, new THREE.Quaternion(), { fixed: true }); g.mesh.scale.set(1.45, 1.2, 1); }
      }
      spawnBrickWall(new THREE.Vector3(8, 0.12, -14), 0, 9, 7);
    },
  });
  map.nav = b.navGrid(-150, -150, 150, 150, 1);
  return map;
}

// A building you can walk into: ground floor, ramp to a second floor, windows and furniture.
function buildEnterable(b, cx, cz, facade, concrete, rand) {
  const W = 26, D = 24, H1 = 4.2, H2 = 4.0, t = 0.3, y0 = 0.12;
  const inner = mat(0xd8d0c4, { roughness: 0.95 });
  const floorM = mat(0x8a6a4a, { roughness: 0.8 });
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  const Htot = H1 + H2;
  // floor
  b.box(cx, y0 + 0.05, cz, W, 0.1, D, floorM, { nav: false, tile: 2 });
  // back + side walls (with windows on upper floor)
  b.box(cx, y0 + Htot / 2, z0 + t / 2, W, Htot, t, facade, { tile: 4 });
  b.box(x0 + t / 2, y0 + Htot / 2, cz, t, Htot, D, facade, { tile: 4 });
  b.box(x1 - t / 2, y0 + Htot / 2, cz, t, Htot, D, facade, { tile: 4 });
  // front wall with door (front faces +z) and window holes
  const door = 3;
  const segW = (W - door) / 2;
  b.box(x0 + segW / 2, y0 + H1 / 2, z1 - t / 2, segW, H1, t, facade, { tile: 4 });
  b.box(x1 - segW / 2, y0 + H1 / 2, z1 - t / 2, segW, H1, t, facade, { tile: 4 });
  b.box(cx, y0 + H1 - 0.6, z1 - t / 2, door, 1.2, t, facade, { tile: 4 });
  // upper front wall with window openings
  const wy = y0 + H1 + H2 / 2;
  const nWin = 4, winW = 2.4;
  const gap = (W - nWin * winW) / (nWin + 1);
  for (let k = 0; k <= nWin; k++) { const xs = x0 + k * (gap + winW); b.box(xs + gap / 2, wy, z1 - t / 2, gap, H2, t, facade, { tile: 4 }); }
  for (let k = 0; k < nWin; k++) {
    const xc = x0 + gap + winW / 2 + k * (gap + winW);
    b.box(xc, y0 + H1 + 0.5, z1 - t / 2, winW, 1.0, t, facade, { tile: 4, nav: false });
    b.box(xc, y0 + Htot - 0.5, z1 - t / 2, winW, 1.0, t, facade, { tile: 4, nav: false });
    b.windows = b.windows || [];
    b.windows.push(new THREE.Vector3(xc, y0 + H1 + 2.0, z1 - t / 2));
  }
  // second floor slab with a hole for the ramp
  const holeW = 3, holeL = 9;
  b.box(cx + holeW / 2, y0 + H1, cz, W - holeW - t * 2, 0.25, D - t * 2, inner, { nav: false });
  b.box(x0 + t + holeW / 2, y0 + H1, z0 + t + (D - holeL - t * 2) / 2 + holeL, holeW, 0.25, D - holeL - t * 2, inner, { nav: false });
  b.ramp(x0 + t + holeW / 2, y0, z0 + t + holeL / 2 + 0.6, holeW - 0.2, holeL, H1, concrete, 0);
  // interior divider wall on ground floor
  b.box(cx + 4, y0 + H1 / 2, cz - 3, 0.2, H1, 10, inner);
  // roof
  b.box(cx, y0 + Htot + 0.15, cz, W, 0.3, D, mat(0x4a4a4a), { nav: false });
  const furniture = [['table', cx + 7, cz + 4], ['chair', cx + 6, cz + 5], ['chair', cx + 8, cz + 3], ['sofa', cx - 4, cz - 6], ['crate', cx + 9, cz - 8], ['crate_small', cx + 9.5, cz - 6.5], ['cardboard', cx - 8, cz + 6]];
  // glass windows as frozen breakable panes
  const wins = b.windows.splice(0);
  return { furniture, floorY: y0 + 0.5, windows: wins, glass: true, init: () => {} };
}

function buildForest() {
  setupEnvironment({ skyTop: 0x3a7ad8, skyBottom: 0xbad8f0, fog: 0xa8c8d8, fogScale: 0.6, sunIntensity: 2.4, sunColor: 0xfff0d0, hemiIntensity: 1.1, hemiSky: 0xbfe0ff, hemiGround: 0x4a5a30, sunDir: [-0.4, 1, 0.5] });
  const b = new Builder();
  const lake = { x: 45, z: 35, r: 32 };
  const waterLevel = -1.2;
  const h = (x, z) => {
    let y = fbm(x * 0.012, z * 0.012, 4) * 10 + fbm(x * 0.05, z * 0.05, 2) * 1.2;
    // soften valleys into meadows that stay above the lake's water level
    if (y < 0) y = -0.7 * (1 - Math.exp(y / 0.7));
    const dc = Math.hypot(x, z); if (dc < 18) y *= Math.max(0, (dc - 8) / 10); // flat clearing
    const dl = Math.hypot(x - lake.x, z - lake.z);
    if (dl < lake.r + 15) { const k = Math.max(0, 1 - dl / (lake.r + 15)); y = y * (1 - k) - 4.5 * Math.pow(Math.min(1, (lake.r + 15 - dl) / 20), 1.2); }
    const edge = Math.max(Math.abs(x), Math.abs(z)); if (edge > 150) y += (edge - 150) * 0.6;
    return y;
  };
  const grassM = new THREE.MeshStandardMaterial({ map: (() => { const t = T.grass().clone(); t.needsUpdate = true; t.repeat.set(80, 80); return t; })(), vertexColors: true, roughness: 0.95 });
  b.terrain(360, 180, h, grassM, (x, y, z) => {
    const c = new THREE.Color(0x4f7a2e);
    if (y < waterLevel + 0.6) c.lerp(new THREE.Color(0xb8a878), Math.min(1, (waterLevel + 0.6 - y) / 1.2));
    else c.lerp(new THREE.Color(0x6a8a3a), THREE.MathUtils.clamp(fbm(x * 0.05, z * 0.05) + 0.3, 0, 1) * 0.6);
    return c;
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(lake.r + 18, 48), new THREE.MeshStandardMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.set(lake.x, waterLevel, lake.z); b.mesh(water);
  // trees (instanced)
  const r = rng(77);
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1, 7); trunkGeo.translate(0, 0.5, 0);
  const leafGeo = new THREE.ConeGeometry(1, 1, 8); leafGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(0x5a3e26, { roughness: 1 }), 420);
  const leaves = new THREE.InstancedMesh(leafGeo, mat(0x2e5a24, { roughness: 0.9 }), 420 * 3);
  trunks.castShadow = leaves.castShadow = true; trunks.receiveShadow = leaves.receiveShadow = true;
  const M = new THREE.Matrix4(); let ti = 0, li = 0;
  const trees = [];
  for (let k = 0; k < 3000 && ti < 420; k++) {
    const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300;
    if (Math.hypot(x, z) < 16 || Math.hypot(x - lake.x, z - lake.z) < lake.r + 6) continue;
    const y = h(x, z); if (y < waterLevel + 0.5) continue;
    const s = 0.8 + r() * 0.7, th = 4 * s;
    M.compose(new THREE.Vector3(x, y - 0.2, z), new THREE.Quaternion(), new THREE.Vector3(s, th, s)); trunks.setMatrixAt(ti++, M);
    for (let l = 0; l < 3; l++) { const ls = (2.4 - l * 0.6) * s; M.compose(new THREE.Vector3(x, y + th * 0.55 + l * 1.5 * s, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6), new THREE.Vector3(ls, 2.6 * s, ls)); leaves.setMatrixAt(li++, M); }
    createStaticCollider(G.RAPIER.ColliderDesc.cylinder(th / 2, 0.3 * s).setTranslation(x, y + th / 2, z).setCollisionGroups(groups(GROUP.WORLD)));
    b.obstacles.push({ x, z, r: 0.35 * s });
    trees.push([x, z]);
  }
  trunks.count = ti; leaves.count = li; b.mesh(trunks); b.mesh(leaves);
  // rocks
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, mat(0xffffff, { map: T.rock(), color: 0x8a8a84, roughness: 1 }), 90);
  rocks.castShadow = rocks.receiveShadow = true;
  let ri = 0;
  for (let k = 0; k < 400 && ri < 90; k++) {
    const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300;
    if (Math.hypot(x, z) < 12) continue;
    const y = h(x, z); const s = 0.5 + r() * 1.8;
    M.compose(new THREE.Vector3(x, y + s * 0.3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s * 1.3, s, s * 1.1));
    rocks.setMatrixAt(ri++, M);
    createStaticCollider(G.RAPIER.ColliderDesc.ball(s * 0.95).setTranslation(x, y + s * 0.3, z).setCollisionGroups(groups(GROUP.WORLD)));
    if (s > 0.7) b.obstacles.push({ x, z, r: s });
  }
  rocks.count = ri; b.mesh(rocks);
  // grass tufts
  if (settings.grass) {
    const tuft = new THREE.ConeGeometry(0.06, 0.45, 3); tuft.translate(0, 0.2, 0);
    const grass = new THREE.InstancedMesh(tuft, mat(0x5a8a32, { roughness: 1 }), 7000);
    let gi = 0;
    for (let k = 0; k < 14000 && gi < 7000; k++) {
      const a = r() * 6.283, d = Math.sqrt(r()) * 110;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      const y = h(x, z); if (y < waterLevel + 0.3) continue;
      const s = 0.6 + r() * 0.9;
      M.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4)), new THREE.Vector3(s, s, s));
      grass.setMatrixAt(gi++, M);
    }
    grass.count = gi; b.mesh(grass);
  }
  // fallen logs (static) + a wooden dock
  const wood = mat(0x6a4a2a, { roughness: 1 });
  for (let k = 0; k < 8; k++) { const x = (r() - 0.5) * 200, z = (r() - 0.5) * 200; if (Math.hypot(x - lake.x, z - lake.z) < lake.r + 4 || Math.hypot(x, z) < 15) continue; const y = h(x, z); const g = new THREE.CylinderGeometry(0.35, 0.4, 6, 8); g.rotateZ(Math.PI / 2); b.addGeo(g, wood, [x, y + 0.3, z], [0, r() * 3, 0]); }
  b.box(lake.x - lake.r + 4, waterLevel + 0.5, lake.z, 10, 0.2, 2.4, mat(0x8a6a4a), { tile: 1, nav: false });
  const map = finishMap(b, {
    id: 'forest', spawnPoint: { pos: new THREE.Vector3(0, 0.3, 6), yaw: 0 }, groundAt: h, waterLevel, bounds: 150,
    spawnInitial() {
      for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; new Prop(PROP_BY_ID[k % 3 ? 'crate_small' : 'crate'], new THREE.Vector3(Math.cos(a) * 12, h(Math.cos(a) * 12, Math.sin(a) * 12) + 1, Math.sin(a) * 12)); }
      new Vehicle(VEHICLE_BY_ID.buggy, new THREE.Vector3(-8, h(-8, 0), 0), 0.5);
    },
  });
  map.nav = b.navGrid(-160, -160, 160, 160, 1.5, (x, z) => {
    const y = h(x, z); if (y < waterLevel - 0.4) return true;
    const sl = Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2;
    return sl > 1.1;
  });
  return map;
}

function buildFacility() {
  setupEnvironment({ skyTop: 0x4a5a6a, skyBottom: 0x8a9aa8, fog: 0x9aa4ac, fogScale: 0.5, sunIntensity: 1.5, sunColor: 0xf0f6ff, hemiIntensity: 1.8, hemiSky: 0xf2f6ff, hemiGround: 0x9aa0a6, sunDir: [0.15, 1, 0.1], sunGlow: 0 });
  const b = new Builder();
  const floor = mat(0xffffff, { map: T.labFloor(), roughness: 0.55, metalness: 0.05 });
  const wall = mat(0xffffff, { map: T.labWall(), roughness: 0.7 });
  const ceil = mat(0xd0d4d8, { roughness: 0.9 });
  const metal = mat(0x5a6068, { metalness: 0.7, roughness: 0.35 });
  const haz = mat(0xffffff, { map: T.hazardFloor() });
  const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.3 });
  const W = 104, D = 74, H = 9, t = 0.4;
  // outer floor (outside ground too, so the building sits on something)
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(0x6a6e70, { roughness: 1 }));
  outside.rotation.x = -Math.PI / 2; outside.position.y = -0.02; outside.receiveShadow = true; b.mesh(outside);
  createStaticCollider(G.RAPIER.ColliderDesc.cuboid(300, 1, 300).setTranslation(0, -1, 0).setCollisionGroups(groups(GROUP.WORLD)));
  b.box(0, 0.05, 0, W, 0.1, D, floor, { tile: 3, nav: false });
  // outer walls
  b.box(0, H / 2, -D / 2, W, H, t, wall, { tile: 3 }); b.box(0, H / 2, D / 2, W, H, t, wall, { tile: 3 });
  b.box(-W / 2, H / 2, 0, t, H, D, wall, { tile: 3 }); b.box(W / 2, H / 2, 0, t, H, D, wall, { tile: 3 });
  // ceiling (does not cast shadows so the sun acts like overhead lighting)
  b.box(0, H + 0.2, 0, W, 0.4, D, ceil, { nav: false, shadow: false });
  for (let x = -44; x <= 44; x += 11) for (let z = -30; z <= 30; z += 10) b.box(x, H - 0.02, z, 4, 0.06, 1.2, panel, { collide: false, shadow: false });
  // chambers: north row (z<0) and south row (z>0), each 22 wide x 20 deep, central hall between
  const hallHalf = 12;
  const chambers = [];
  for (const side of [-1, 1]) {
    const zWall = side * hallHalf;
    const cz = side * (hallHalf + (D / 2 - hallHalf) / 2);
    for (let k = 0; k < 4; k++) {
      const x0 = -40 + k * 22, xc = x0 + 11;
      chambers.push({ x: xc, z: cz, side, idx: k });
      // wall facing hall with door + observation window
      b.box(x0 + 2.5, H / 2, zWall, 5, H, t, wall, { tile: 3 });           // left of door
      b.box(x0 + 6.5, 7, zWall, 3, 4, t, wall, { tile: 3, nav: false });   // above door
      b.box(x0 + 6.5, 0.6, zWall, 0.01, 0.1, t, wall, { collide: false });
      // window section x0+8 .. x0+20: low wall + glass + high wall
      b.box(x0 + 14, 0.6, zWall, 12, 1.2, t, wall, { tile: 3 });
      b.box(x0 + 14, 6.6, zWall, 12, 4.8, t, wall, { tile: 3, nav: false });
      b.box(x0 + 21, H / 2, zWall, 2, H, t, wall, { tile: 3 });
      b.glassSpots = b.glassSpots || [];
      for (let g = 0; g < 4; g++) b.glassSpots.push({ x: x0 + 9.9 + g * 2.75, y: 2.25, z: zWall, rot: 0 });
      // door gap is x0+5..x0+8
      if (k < 3) b.box(x0 + 22, H / 2, cz, t, H, D / 2 - hallHalf, wall, { tile: 3 }); // divider
    }
  }
  // west observation deck (upper floor) at x -52..-44 along the hall
  const deckY = 5;
  b.box(-48 + 0.2, deckY, 0, 7.6, 0.3, hallHalf * 2 - 0.4, metal, { nav: false });
  for (let z = -10; z <= 10; z += 4) b.box(-44.2, deckY + 0.6, z, 0.1, 1.2, 3.6, new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.3, roughness: 0.05 }), { nav: false });
  b.box(-44.2, deckY + 1.2, 0, 0.12, 0.08, hallHalf * 2 - 0.4, metal, { collide: false });
  // stairs up to the deck (steps)
  for (let s = 0; s < 20; s++) b.box(-41.5 + 0, 0.125 + s * 0.25, -10.5 + s * 0.45 - 0.0, 2.5, 0.25, 0.46, metal, { nav: s < 6 });
  // elevator platform with frame
  const ex = -42, ez = 8;
  b.box(ex - 1.8, H / 2, ez, 0.15, H, 3.6, metal, { tile: 1 }); b.box(ex + 1.8, H / 2, ez, 0.15, H, 3.6, metal, { tile: 1 });
  let elevTarget = 0, elevY = 0.1, elevAuto = true, lastSwitch = 0;
  const elev = b.platform(3.4, 0.25, 3.4, haz, new THREE.Vector3(ex, 0.1, ez), (time) => {
    if (elevAuto && time - lastSwitch > 7) { elevTarget = elevTarget ? 0 : 1; lastSwitch = time; }
    const goal = elevTarget ? deckY + 0.02 : 0.1;
    const dt = 1 / 60;
    elevY += THREE.MathUtils.clamp(goal - elevY, -1.6 * dt, 1.6 * dt);
    return new THREE.Vector3(ex, elevY, ez);
  });
  b.button(new THREE.Vector3(ex + 2.4, 1.3, ez - 2), 'Elevator called', () => { elevAuto = false; elevTarget = elevTarget ? 0 : 1; }, 0x20a0d0);
  b.button(new THREE.Vector3(-45, deckY + 1.3, ez - 2.5), 'Elevator called', () => { elevAuto = false; elevTarget = elevTarget ? 0 : 1; }, 0x20a0d0);
  void elev;
  // ---- chamber equipment ----
  const state = { pistons: true };
  for (const c of chambers) {
    const label = ['Impact Lab', 'Piston Lab', 'Centrifuge', 'Launch Lab'][c.idx];
    if (c.idx === 0) { // ramps
      b.ramp(c.x - 4, 0.1, c.z + c.side * -1, 4, 8, 2.5, haz, c.side > 0 ? 0 : Math.PI);
      b.box(c.x + 5, 1.5, c.z + c.side * 6, 6, 3, 0.6, metal, { tile: 1 });
    } else if (c.idx === 1) { // pistons that push sideways
      for (let p = 0; p < 3; p++) {
        const pz = c.z + (p - 1) * 5;
        const base = new THREE.Vector3(c.x - 8, 1, pz);
        b.box(c.x - 10.2, 1, pz, 1.2, 2, 2, metal);
        b.platform(1.2, 1.6, 1.8, haz, base, (time, plat) => {
          if (!state.pistons) return plat.pos.clone();
          const ph = (time * 0.7 + p * 0.33) % 1;
          const ext = ph < 0.12 ? ph / 0.12 : ph < 0.4 ? 1 : ph < 0.8 ? 1 - (ph - 0.4) / 0.4 : 0;
          return new THREE.Vector3(c.x - 9 + ext * 9, 1, pz);
        });
      }
      b.button(new THREE.Vector3(c.x + 8, 1.3, c.z - c.side * 8.8), 'Pistons toggled', () => { state.pistons = !state.pistons; });
    } else if (c.idx === 2) { // spinning arm
      b.cyl(c.x, 1.5, c.z, 0.6, 3, metal);
      b.rotor(new THREE.Vector3(c.x, 1.0, c.z), 7.5, haz, 1.6);
      b.button(new THREE.Vector3(c.x + 9.5, 1.3, c.z - c.side * 8.8), 'Centrifuge toggled', () => { G.map.rotorsOn = G.map.rotorsOn === false; });
    } else { // launch pads + drop tower
      for (let p = 0; p < 3; p++) {
        const px = c.x - 6 + p * 6, pz = c.z;
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 24), new THREE.MeshStandardMaterial({ color: 0x30ff90, emissive: 0x20d070, emissiveIntensity: 1.2 }));
        pad.position.set(px, 0.15, pz); b.mesh(pad);
        b.launchPads = b.launchPads || []; b.launchPads.push(new THREE.Vector3(px, 0.15, pz));
      }
      b.box(c.x + 7, 3.5, c.z + c.side * 6, 3, 0.3, 3, metal, { nav: false });
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.box(c.x + 7 + dx, 1.75, c.z + c.side * 6 + dz, 0.2, 3.5, 0.2, metal);
    }
    // sign
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d');
    x.fillStyle = '#1a2a3a'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#7fe0ff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText(label.toUpperCase(), 128, 42);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tx }));
    sign.position.set(c.x - 4.5, 6, c.side * hallHalf - c.side * 0.25); if (c.side < 0) sign.rotation.y = 0; else sign.rotation.y = Math.PI;
    b.mesh(sign);
  }
  // hall decoration: crates, desks
  const launchPads = b.launchPads || [];
  const glassSpots = b.glassSpots || [];
  const map = finishMap(b, {
    id: 'facility', spawnPoint: { pos: new THREE.Vector3(0, 0.2, 0), yaw: Math.PI / 2 }, groundAt: () => 0.1, bounds: 52,
    update(dt) {
      // launch pads fling anything standing on them
      for (const p of launchPads) {
        for (const c of G.creatures) if (c.body && !c.ragdoll && c.alive && c.position.distanceTo(p) < 1.3 && c.body.linvel().y < 1) { c.knockDown({ dir: new THREE.Vector3(0, 1, 0), impulse: 99999 }); if (c.ragdoll) for (const n in c.ragdoll.parts) c.ragdoll.parts[n].body.setLinvel({ x: (Math.random() - 0.5) * 2, y: 16, z: (Math.random() - 0.5) * 2 }, true); play('punt', p, 0.8); }
        for (const pr of G.props) if (pr.body.isDynamic()) { const q = pr.body.translation(); if (Math.hypot(q.x - p.x, q.z - p.z) < 1.2 && q.y < 1.6 && pr.body.linvel().y < 1) { pr.body.setLinvel({ x: 0, y: 16, z: 0 }, true); play('punt', p, 0.6); } }
        const pl = G.player; if (pl.alive && !pl.noclip && Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < 1.2 && pl.pos.y < 0.6 && pl.vel.y <= 0.5) { pl.vel.y = 15; play('punt', p, 0.8); }
      }
    },
    spawnInitial() {
      for (const g of glassSpots) { const pr = new Prop(PROP_BY_ID.glass, new THREE.Vector3(g.x, g.y, g.z), new THREE.Quaternion(), { fixed: true }); pr.mesh.scale.set(1.62, 1.85, 1); }
      const c0 = chambers.find(c => c.idx === 0 && c.side < 0);
      if (c0) for (let k = 0; k < 3; k++) import('./spawn.js').then(m => m.spawnCreatureById('dummy', new THREE.Vector3(c0.x + 4 + k * 1.5, 0.2, c0.z - 3), { quiet: true, noUndo: true }));
      for (let k = 0; k < 8; k++) new Prop(PROP_BY_ID[['crate', 'barrel', 'crate_small', 'explosive'][k % 4]], new THREE.Vector3(20 + (k % 3) * 1.2, 1 + Math.floor(k / 3), -6 + (k % 2)));
      new Prop(PROP_BY_ID.table, new THREE.Vector3(-10, 0.6, 4)); new Prop(PROP_BY_ID.chair, new THREE.Vector3(-10, 0.5, 5));
      new Prop(PROP_BY_ID.ball, new THREE.Vector3(5, 2, 3));
    },
  });
  map.nav = b.navGrid(-54, -39, 54, 39, 1);
  return map;
}

function buildDesert() {
  setupEnvironment({ skyTop: 0x3a88d8, skyBottom: 0xf0dcb8, fog: 0xe8d4b0, fogScale: 0.7, sunIntensity: 3.2, sunColor: 0xfff0d8, hemiIntensity: 1.1, hemiSky: 0xdce8ff, hemiGround: 0xc8a878, sunDir: [0.6, 0.8, 0.3] });
  const b = new Builder();
  const flats = [{ x: 0, z: 0, r: 22 }, { x: 60, z: -40, r: 18 }, { x: -70, z: 50, r: 16 }, { x: -40, z: -70, r: 14 }, { x: 90, z: 70, r: 14 }];
  const h = (x, z) => {
    let y = Math.sin(x * 0.03 + Math.sin(z * 0.02) * 2) * 3.2 + fbm(x * 0.01, z * 0.01, 3) * 6 + Math.sin((x + z) * 0.08) * 0.5;
    for (const f of flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r + 12) { const k = Math.max(0, 1 - (d - f.r) / 12); y = y * (1 - Math.min(1, k)) + (d < f.r ? 0 : 0); } }
    const edge = Math.max(Math.abs(x), Math.abs(z)); if (edge > 200) y += (edge - 200) * 0.5;
    return y;
  };
  const sandT = T.sand().clone(); sandT.needsUpdate = true; sandT.repeat.set(100, 100);
  b.terrain(480, 200, h, new THREE.MeshStandardMaterial({ map: sandT, vertexColors: true, roughness: 1 }), (x, y) => new THREE.Color(0xd8b884).lerp(new THREE.Color(0xc89a64), THREE.MathUtils.clamp(-y / 6 + 0.3, 0, 1)));
  const r = rng(99);
  const rockM = mat(0xffffff, { map: T.rock(), color: 0xb06a44, roughness: 1 });
  // mesas / rock formations
  for (let k = 0; k < 16; k++) {
    const x = (r() - 0.5) * 380, z = (r() - 0.5) * 380;
    if (flats.some(f => Math.hypot(x - f.x, z - f.z) < f.r + 10)) continue;
    const rad = 4 + r() * 9, hh = 8 + r() * 22;
    const g = new THREE.CylinderGeometry(rad * (0.7 + r() * 0.2), rad, hh, 10, 4);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = 1 + vnoise(p.getX(i) * 0.3 + k, p.getY(i) * 0.3) * 0.18; p.setX(i, p.getX(i) * n); p.setZ(i, p.getZ(i) * n); }
    g.computeVertexNormals();
    const y = h(x, z);
    b.addGeo(g, rockM, [x, y + hh / 2 - 1, z]);
    createStaticCollider(G.RAPIER.ColliderDesc.cylinder(hh / 2, rad).setTranslation(x, y + hh / 2 - 1, z).setCollisionGroups(groups(GROUP.WORLD)));
    b.obstacles.push({ x, z, r: rad + 0.5 });
    if (r() < 0.5) { const cap = new THREE.CylinderGeometry(rad * 1.05, rad * 0.8, 1.5, 10); b.addGeo(cap, rockM, [x, y + hh - 0.5, z]); }
  }
  // boulders
  const boulder = new THREE.DodecahedronGeometry(1, 0);
  for (let k = 0; k < 60; k++) {
    const x = (r() - 0.5) * 380, z = (r() - 0.5) * 380; if (Math.hypot(x, z) < 14) continue;
    const s = 0.5 + r() * 2, y = h(x, z);
    b.addGeo(boulder.clone().scale(s * 1.2, s, s), rockM, [x, y + s * 0.4, z], [r(), r() * 3, r()]);
    createStaticCollider(G.RAPIER.ColliderDesc.ball(s).setTranslation(x, y + s * 0.4, z).setCollisionGroups(groups(GROUP.WORLD)));
    if (s > 0.8) b.obstacles.push({ x, z, r: s });
  }
  // cacti
  const cactM = mat(0x4a7a3a, { roughness: 0.9 });
  for (let k = 0; k < 70; k++) {
    const x = (r() - 0.5) * 360, z = (r() - 0.5) * 360; if (Math.hypot(x, z) < 12) continue;
    const y = h(x, z), hh = 2 + r() * 2.5;
    b.cyl(x, y + hh / 2, z, 0.25, hh, cactM, { seg: 8 });
    const arm = new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8);
    b.addGeo(arm.clone(), cactM, [x + 0.55, y + hh * 0.6, z]); b.addGeo(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8).rotateZ(Math.PI / 2), cactM, [x + 0.3, y + hh * 0.42, z]);
  }
  // abandoned structures
  const wood = mat(0xffffff, { map: T.wood(), roughness: 1 });
  const rust = mat(0x8a5a3a, { roughness: 0.9, metalness: 0.4 });
  const shack = (cx, cz, rot) => {
    const y = 0, W = 7, D = 6, H = 3;
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    const wallSeg = (lx, lz, w, d, hh = H, yy = y + hh / 2) => { const [x, z] = P(lx, lz); b.box(x, yy, z, w, hh, d, wood, { rotY: rot, tile: 2 }); };
    wallSeg(0, -D / 2, W, 0.2); wallSeg(-W / 2, 0, 0.2, D); wallSeg(W / 2, -1.2, 0.2, D - 2.4);
    wallSeg(-W / 2 + 1.5, D / 2, 3, 0.2); wallSeg(W / 2 - 1.2, D / 2, 2.4, 0.2); wallSeg(0.6, D / 2, 1.2, 0.2, 0.8, H - 0.4);
    const [rx, rz] = P(-0.8, 0); b.box(rx, y + H + 0.1, rz, W * 0.75, 0.15, D + 0.4, rust, { rotY: rot, nav: false });
  };
  shack(60, -40, 0.3); shack(-70, 50, -0.8); shack(-40, -70, 1.6); shack(70, -30, 2.1);
  // gas station at (90,70)
  const gx = 90, gz = 70;
  b.box(gx, 5, gz, 14, 0.5, 9, mat(0xd8d0c0), { nav: false });
  for (const [dx, dz] of [[-6, -3.5], [6, -3.5], [-6, 3.5], [6, 3.5]]) b.cyl(gx + dx, 2.4, gz + dz, 0.22, 4.8, mat(0xc0c0c0, { metalness: 0.5 }));
  for (const dx of [-2.5, 2.5]) b.box(gx + dx, 0.8, gz, 0.8, 1.6, 0.6, mat(0xb03020));
  b.box(gx, 2, gz - 11, 10, 4, 6, wood, { tile: 2 });
  // water tower near spawn
  const tx = -22, tz = -18;
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) b.box(tx + dx, 4.5, tz + dz, 0.3, 9, 0.3, rust);
  b.cyl(tx, 10.5, tz, 2.6, 3.2, rust, { nav: false });
  const map = finishMap(b, {
    id: 'desert', spawnPoint: { pos: new THREE.Vector3(0, 0.3, 6), yaw: 0 }, groundAt: h, bounds: 200,
    spawnInitial() {
      new Vehicle(VEHICLE_BY_ID.buggy, new THREE.Vector3(6, 0.2, -6), 0.8);
      new Vehicle(VEHICLE_BY_ID.pickup, new THREE.Vector3(84, 0.2, 76), 2.0);
      for (const [x, z] of [[55, -34], [-64, 44], [92, 62], [-30, -60], [14, 18]]) new Vehicle(VEHICLE_BY_ID.wreck, new THREE.Vector3(x, h(x, z) + 0.2, z), r() * 6);
      for (let k = 0; k < 18; k++) { const id = ['barrel', 'oildrum', 'tire', 'crate', 'explosive'][k % 5]; const x = flats[k % 5].x + (r() - 0.5) * 16, z = flats[k % 5].z + (r() - 0.5) * 16; new Prop(PROP_BY_ID[id], new THREE.Vector3(x, h(x, z) + 1, z)); }
    },
  });
  map.nav = b.navGrid(-210, -210, 210, 210, 1.5, (x, z) => Math.hypot(h(x + 1, z) - h(x - 1, z), h(x, z + 1) - h(x, z - 1)) / 2 > 1.2);
  return map;
}

const BUILDERS = { superflat: buildSuperflat, city: buildCity, forest: buildForest, facility: buildFacility, desert: buildDesert };
export function buildMap(id) {
  const m = (BUILDERS[id] || buildSuperflat)();
  m.fogColor = G.scene.fog ? G.scene.fog.color.getHex() : 0xffffff;
  return m;
}
void heightLookup;
