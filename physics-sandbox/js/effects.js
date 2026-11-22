// Particles, decals, tracers, flashes, speech bubbles and camera shake.
import * as THREE from 'three';
import { G } from './state.js';
import { settings, fxScale } from './config.js';

const POOL = 1500;
let inst, parts = [], freeIdx = [];
const dummy = new THREE.Object3D();
const decals = [];
const tracers = [];
const lights = [];
const bubbles = [];
const rings = [];
let splatTex, holeTex, scorchTex, stainTex, poolTex;

export function initEffects() {
  const geo = new THREE.IcosahedronGeometry(0.62, 0);
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, flatShading: true });
  inst = new THREE.InstancedMesh(geo, m, POOL);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.count = POOL;
  inst.frustumCulled = false;
  inst.castShadow = false;
  const col = new THREE.Color();
  for (let i = 0; i < POOL; i++) {
    dummy.position.set(0, -9999, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix); inst.setColorAt(i, col.set(0xffffff));
    parts.push({ life: 0 }); freeIdx.push(i);
  }
  G.scene.add(inst);
  splatTex = makeSplat('#8a0b0b', true);
  stainTex = makeSplat('#7a0a0a', false);
  holeTex = makeHole();
  poolTex = makePool();
  scorchTex = makeScorch();

  for (let i = 0; i < 3; i++) {
    const l = new THREE.PointLight(0xffaa55, 0, 12, 2);
    l.userData.t = 0;
    G.scene.add(l); lights.push(l);
  }
}

function makeSplat(color, drips) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.beginPath(); x.arc(64, 64, 26, 0, Math.PI * 2); x.fill();
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 30, s = 4 + Math.random() * 10;
    x.beginPath(); x.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, s, 0, Math.PI * 2); x.fill();
    if (drips) { x.lineWidth = s * 0.8; x.strokeStyle = color; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); x.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makePool() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#5a0505';
  // irregular blob from overlapping circles
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * 6.28, r = Math.random() * 55;
    x.beginPath(); x.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 40 + Math.random() * 40, 0, 6.3); x.fill();
  }
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 120);
  g.addColorStop(0, 'rgba(40,0,0,0.55)'); g.addColorStop(1, 'rgba(120,10,10,0)');
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeHole() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.25, 'rgba(20,20,20,0.95)'); g.addColorStop(0.5, 'rgba(40,40,40,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeScorch() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(0.6, 'rgba(20,15,10,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// spawn particles. type: blood | spark | dust | debris | ice | energy | water | bone | gib(cartoon) | wood | glass
const TYPES = {
  blood: { color: [0x9a0d0d, 0x6e0707, 0xb81515], size: [0.03, 0.07], speed: 3.5, grav: 1, life: [0.5, 1.1], emissive: 0, splat: true },
  drip: { color: [0x7a0808, 0x8e0d0d], size: [0.014, 0.028], speed: 1, grav: 1, life: [0.8, 1.6], emissive: 0, splat: true, splatChance: 0.55, splatSize: [0.04, 0.12] },
  spark: { color: [0xffd27a, 0xffb347, 0xfff2b0], size: [0.015, 0.035], speed: 7, grav: 0.6, life: [0.15, 0.4], emissive: 1 },
  dust: { color: [0xb0a898, 0x9a9288, 0xc8c0b0], size: [0.05, 0.12], speed: 1.5, grav: -0.05, life: [0.4, 0.9], emissive: 0, grow: 2.5 },
  debris: { color: [0x777777, 0x555555, 0x8a8a8a], size: [0.04, 0.1], speed: 4, grav: 1, life: [0.8, 1.6], emissive: 0 },
  wood: { color: [0x9b6b3a, 0x7a5228, 0xb8834a], size: [0.04, 0.12], speed: 4, grav: 1, life: [0.8, 1.6], emissive: 0 },
  glass: { color: [0xcfe8ff, 0xaad4ff, 0xffffff], size: [0.02, 0.06], speed: 4, grav: 1, life: [0.6, 1.4], emissive: 0.3 },
  ice: { color: [0xbfefff, 0x8fdcff, 0xffffff], size: [0.03, 0.07], speed: 3, grav: 0.7, life: [0.4, 1], emissive: 0.6 },
  energy: { color: [0xc77dff, 0x9d4dff, 0xf0c0ff], size: [0.03, 0.08], speed: 6, grav: 0, life: [0.2, 0.6], emissive: 1 },
  water: { color: [0xa8d8ff, 0x7fc4f0, 0xe8f6ff], size: [0.04, 0.09], speed: 4, grav: 1, life: [0.5, 1], emissive: 0.2 },
  bone: { color: [0xefe8d6, 0xd8d0bb, 0xfffaf0], size: [0.03, 0.08], speed: 4, grav: 1, life: [0.8, 1.6], emissive: 0 },
  // non-blood "cartoon" hit puffs used when blood effects are off
  impact: { color: [0xffffff, 0xffe066, 0xfff7cc], size: [0.03, 0.06], speed: 3, grav: 0, life: [0.15, 0.35], emissive: 1 },
  fire: { color: [0xff7b00, 0xffb000, 0xff4500], size: [0.08, 0.2], speed: 3, grav: -0.4, life: [0.3, 0.8], emissive: 1, grow: 1.5 },
  smoke: { color: [0x444444, 0x333333, 0x555555], size: [0.2, 0.4], speed: 1.5, grav: -0.15, life: [0.8, 1.8], emissive: 0, grow: 3 },
  melon: { color: [0xe83a4a, 0x2e8b2e, 0xf06070], size: [0.04, 0.1], speed: 4, grav: 1, life: [0.8, 1.5], emissive: 0 },
};

const _c = new THREE.Color();
export function burst(type, pos, count, dir, spread = 1, speedMul = 1) {
  if ((type === 'blood' || type === 'drip') && !settings.blood) { if (type === 'drip') return; type = 'impact'; }
  const T = TYPES[type]; if (!T) return;
  const n = Math.max(1, Math.round(count * (type === 'spark' || type === 'dust' ? 1 : fxScale())));
  for (let k = 0; k < n; k++) {
    const i = freeIdx.pop(); if (i === undefined) return;
    const p = parts[i];
    const sp = T.speed * speedMul * (0.4 + Math.random() * 0.8);
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(spread);
    if (dir) v.add(dir.clone().normalize());
    v.normalize().multiplyScalar(sp);
    p.pos = pos.clone(); p.vel = v; p.type = type; p.T = T;
    p.size = T.size[0] + Math.random() * (T.size[1] - T.size[0]);
    p.life = p.max = T.life[0] + Math.random() * (T.life[1] - T.life[0]);
    p.rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, 0);
    p.splatted = false;
    _c.set(T.color[(Math.random() * T.color.length) | 0]);
    if (T.emissive) _c.multiplyScalar(1 + T.emissive * 1.5);
    inst.setColorAt(i, _c);
  }
  inst.instanceColor.needsUpdate = true;
}

export function updateEffects(dt) {
  const g = settings.gravity;
  for (let i = 0; i < POOL; i++) {
    const p = parts[i];
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) {
      dummy.position.set(0, -9999, 0); dummy.scale.setScalar(0); dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix); freeIdx.push(i); continue;
    }
    p.vel.y -= g * p.T.grav * dt;
    p.vel.multiplyScalar(1 - 0.8 * dt);
    p.pos.addScaledVector(p.vel, dt);
    const ground = G.map ? G.map.groundAt(p.pos.x, p.pos.z) : 0;
    if (p.pos.y < ground + 0.02 && p.T.grav > 0) {
      p.pos.y = ground + 0.02; p.vel.set(p.vel.x * 0.3, 0, p.vel.z * 0.3);
      if (p.T.splat && !p.splatted && settings.blood && Math.random() < (p.T.splatChance ?? 0.25)) {
        p.splatted = true;
        const sz = p.T.splatSize || [0.15, 0.4];
        addDecal(new THREE.Vector3(p.pos.x, ground + 0.015, p.pos.z), new THREE.Vector3(0, 1, 0), 'blood', sz[0] + Math.random() * (sz[1] - sz[0]));
      }
      if (p.T.splat) p.life = Math.min(p.life, 0.05);
    }
    const f = p.life / p.max;
    const s = p.size * (p.T.grow ? 1 + (1 - f) * p.T.grow : Math.min(1, f * 3));
    dummy.position.copy(p.pos);
    p.rot.x += dt * 5; dummy.rotation.copy(p.rot);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;

  // decals fade
  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i];
    if (d.userData.ttl !== undefined) {
      d.userData.ttl -= dt;
      if (d.userData.ttl < 3) d.material.opacity = Math.max(0, d.userData.ttl / 3) * d.userData.op;
      if (d.userData.ttl <= 0) { d.parent && d.parent.remove(d); if (!d.userData.shared) d.material.dispose(); decals.splice(i, 1); }
    }
  }
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.userData.t -= dt;
    t.material.opacity = Math.max(0, t.userData.t / t.userData.max) * t.userData.op;
    if (t.userData.t <= 0) { G.scene.remove(t); t.geometry.dispose(); t.material.dispose(); tracers.splice(i, 1); }
  }
  for (const l of lights) { if (l.userData.t > 0) { l.userData.t -= dt; l.intensity = Math.max(0, l.userData.t / l.userData.max) * l.userData.i; } }
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]; b.userData.t -= dt;
    if (b.userData.follow) { const p = b.userData.follow(); if (p) b.position.copy(p); }
    b.material.opacity = Math.min(1, b.userData.t * 2);
    if (b.userData.t <= 0) { b.parent && b.parent.remove(b); b.material.map.dispose(); b.material.dispose(); bubbles.splice(i, 1); }
  }
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.userData.t += dt;
    const k = r.userData.t / r.userData.max;
    r.scale.setScalar(0.5 + k * r.userData.size);
    r.material.opacity = (1 - k) * 0.7;
    if (k >= 1) { G.scene.remove(r); r.geometry.dispose(); r.material.dispose(); rings.splice(i, 1); }
  }
  for (let i = pools.length - 1; i >= 0; i--) {
    const d = pools[i], g = d.userData.grow;
    g.t += dt;
    const k = Math.min(1, g.t / g.secs);
    d.scale.setScalar(0.05 + (1 - Math.pow(1 - k, 2)) * g.size);
    if (k >= 1 || !d.parent) pools.splice(i, 1);
  }
  G.shake = Math.max(0, G.shake - dt * 2.5);
}

// type: blood | stain | hole | scorch
const sharedMats = {};
function decalMat(type) {
  if (sharedMats[type]) return sharedMats[type];
  const map = { blood: splatTex, stain: stainTex, pool: poolTex }[type];
  return (sharedMats[type] = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.25, metalness: 0, opacity: type === 'pool' ? 0.95 : 0.92 }));
}
export function addDecal(pos, normal, type, size = 0.2, parent = null) {
  if ((type === 'blood' || type === 'stain' || type === 'pool') && !settings.blood) return;
  const shared = type === 'blood' || type === 'stain' || type === 'pool';
  const map = { hole: holeTex, scorch: scorchTex }[type];
  const m = shared ? decalMat(type) : new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  const d = new THREE.Mesh(planeGeo, m);
  d.scale.setScalar(size);
  d.position.copy(pos).addScaledVector(normal, 0.01);
  d.lookAt(pos.clone().add(normal));
  d.rotateZ(Math.random() * 6.28);
  d.userData.op = m.opacity;
  d.userData.shared = shared;
  if (type === 'pool') d.renderOrder = -1;
  if (type === 'hole' || type === 'scorch') d.userData.ttl = type === 'hole' ? 25 : 40;
  if (parent) { parent.worldToLocal(d.position); const q = parent.getWorldQuaternion(new THREE.Quaternion()).invert(); d.quaternion.premultiply(q); d.scale.divideScalar(parent.getWorldScale(new THREE.Vector3()).x); parent.add(d); }
  else G.scene.add(d);
  decals.push(d);
  const cap = Math.round(250 * Math.max(0.3, fxScale()));
  while (decals.length > cap) { const o = decals.shift(); o.parent && o.parent.remove(o); if (!o.userData.shared) o.material.dispose(); }
  return d;
}
const planeGeo = new THREE.PlaneGeometry(1, 1);

// slowly spreading pool of blood under a body
const pools = [];
export function bloodPool(pos, size = 1.2, secs = 9) {
  const d = addDecal(pos, new THREE.Vector3(0, 1, 0), 'pool', 0.05);
  if (!d) return;
  d.userData.grow = { t: 0, secs, size: size * (0.85 + Math.random() * 0.3) };
  pools.push(d);
}

export function clearDecals() {
  for (const d of decals) { d.parent && d.parent.remove(d); if (!d.userData.shared) d.material.dispose(); }
  decals.length = 0; pools.length = 0;
}

export function tracer(from, to, color = 0xffe9a8, width = 1, life = 0.08, op = 0.9) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, linewidth: width });
  const l = new THREE.Line(geo, m);
  l.userData = { t: life, max: life, op };
  G.scene.add(l); tracers.push(l);
}

// Thick beam (for freeze ray, tool gun etc.)
export function beam(from, to, color, life = 0.15, radius = 0.03) {
  const len = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(radius, radius, len, 6, 1, true);
  geo.translate(0, len / 2, 0); geo.rotateX(Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  const b = new THREE.Mesh(geo, m);
  b.position.copy(from); b.lookAt(to);
  b.userData = { t: life, max: life, op: 0.8 };
  G.scene.add(b); tracers.push(b);
}

export function flash(pos, color = 0xffaa55, intensity = 6, life = 0.06, range = 12) {
  let l = lights.find(x => x.userData.t <= 0) || lights[0];
  l.position.copy(pos); l.color.set(color); l.distance = range;
  l.userData.t = l.userData.max = life; l.userData.i = intensity; l.intensity = intensity;
}

export function ring(pos, color = 0xffffff, size = 10, life = 0.5, normal) {
  const geo = new THREE.RingGeometry(0.8, 1, 48);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const r = new THREE.Mesh(geo, m);
  r.position.copy(pos);
  if (normal) r.lookAt(pos.clone().add(normal)); else r.rotation.x = -Math.PI / 2;
  r.userData = { t: 0, max: life, size };
  G.scene.add(r); rings.push(r);
}

export function shake(amount, pos) {
  if (pos && G.camera) {
    const d = G.camera.getWorldPosition(new THREE.Vector3()).distanceTo(pos);
    amount *= Math.max(0, 1 - d / 40);
  }
  G.shake = Math.min(1.5, G.shake + amount);
}

// Speech bubble sprite above a creature. follow() returns world position.
export function speechBubble(text, follow, color = '#ffffff', dur = 2.6) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  x.font = 'bold 34px system-ui, sans-serif';
  const w = Math.min(900, x.measureText(text).width + 40);
  c.width = w; c.height = 64;
  x.font = 'bold 34px system-ui, sans-serif';
  x.fillStyle = 'rgba(15,18,24,0.78)';
  roundRect(x, 0, 0, w, 64, 16); x.fill();
  x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = 'center';
  x.fillText(text, w / 2, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: true, fog: false }));
  s.scale.set(w / 64 * 0.32, 0.32, 1);
  s.userData = { t: dur, follow };
  s.renderOrder = 10;
  const p = follow(); if (p) s.position.copy(p);
  G.scene.add(s); bubbles.push(s);
  return s;
}
function roundRect(x, a, b, w, h, r) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}
export function removeBubblesFor(follow) {
  for (const b of bubbles) if (b.userData.follow === follow) b.userData.t = Math.min(b.userData.t, 0.01);
}
