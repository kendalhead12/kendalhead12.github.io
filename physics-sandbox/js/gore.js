// Gore: severed body parts, physics gibs, flesh chunks, whole-body gibbing, bleeding and blood pools.
// Everything here is disabled unless both "Blood Effects" and "Dismemberment & Gibs" are on.
import * as THREE from 'three';
import { G, newId } from './state.js';
import { settings } from './config.js';
import { createBody, removeBody, groups, GROUP, syncMesh } from './physics.js';
import { burst, addDecal, bloodPool, shake } from './effects.js';
import { play } from './audio.js';
import { detachPart } from './creatures/ragdoll.js';

export const goreOn = () => !!(settings.gore && settings.blood);
const rand = (a, b) => a + Math.random() * (b - a);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

// ---------- materials & geometry ----------
let M = null;
function mats() {
  if (M) return M;
  M = {
    flesh: [0x7a0e0e, 0x8e1c1c, 0x5c0909, 0xa0303a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.32, metalness: 0.05 })),
    fat: new THREE.MeshStandardMaterial({ color: 0xd8b48a, roughness: 0.5 }),
    bone: new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.45 }),
    stump: new THREE.MeshStandardMaterial({ color: 0x6a0707, roughness: 0.3 }),
  };
  M.chunkGeos = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const s = 0.7 + Math.random() * 0.6; p.setXYZ(k, p.getX(k) * s, p.getY(k) * s * 0.8, p.getZ(k) * s); }
    g.computeVertexNormals();
    M.chunkGeos.push(g);
  }
  M.stumpGeo = new THREE.SphereGeometry(1, 10, 6);
  M.boneGeo = new THREE.CylinderGeometry(1, 1, 1, 6);
  return M;
}

// ---------- rig helpers ----------
export function segOf(rig, name) { return rig.segments.find(s => s.name === name); }
export function subtree(rig, name) {
  const out = [name];
  for (const s of rig.segments) if (s.parent && out.includes(s.parent) && !out.includes(s.name)) out.push(s.name);
  return out;
}
function boneSet(rig) { return new Set(Object.values(rig.bones)); }
// Copy the visible meshes of a bone (and optionally its child bones) into a new group in the bone's local frame.
// Object3D.clone() deep-copies userData through JSON, so entity back-references must be lifted first
function safeClone(obj) {
  const saved = [];
  obj.traverse(o => { if (o.userData && o.userData.entity !== undefined) { saved.push([o, o.userData.entity]); delete o.userData.entity; } });
  const c = obj.clone(true);
  for (const [o, e] of saved) o.userData.entity = e;
  return c;
}
function cloneBone(rig, bone, recursive) {
  const bones = boneSet(rig);
  const g = new THREE.Group();
  for (const ch of bone.children) {
    if (bones.has(ch)) { if (recursive && ch.visible) g.add(safeClone(ch)); }
    else if (ch.visible) g.add(safeClone(ch));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.entity = null; } });
  return g;
}
// red wound cap with a bone end, placed on `parent` at `local`, pointing along `axis`
function addStump(parent, local, axis, radius) {
  if (!goreOn()) return;
  const m = mats();
  const g = new THREE.Group();
  const cap = new THREE.Mesh(m.stumpGeo, m.stump); cap.scale.set(radius * 1.05, radius * 0.45, radius * 1.05); g.add(cap);
  const b = new THREE.Mesh(m.boneGeo, m.bone); b.scale.set(radius * 0.28, radius * 0.9, radius * 0.28); b.position.y = radius * 0.3; g.add(b);
  g.position.copy(local);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  parent.add(g);
  return g;
}
function shapeRadius(seg) { const s = seg.shape; return s.type === 'box' ? Math.min(s.hx, s.hz) : s.r; }

// ---------- Gibs: loose body parts & flesh chunks (kept in G.props so tools work on them) ----------
const GIB_DEF_LIMB = { id: 'gib', name: 'Body Part', material: 'flesh', gib: true, health: 120 };
const GIB_DEF_CHUNK = { id: 'gib', name: 'Flesh', material: 'flesh', gib: true, health: 25, debris: true };
const gibs = [];

export class Gib {
  constructor({ mesh, pos, quat, collider, mass, vel, angvel, chunk = false, bleedLocal = null, bleedAxis = null }) {
    this.id = newId();
    this.def = { ...(chunk ? GIB_DEF_CHUNK : GIB_DEF_LIMB), mass };
    this.kind = 'prop';
    this.health = this.def.health;
    this.mesh = mesh;
    mesh.traverse(o => { if (o.isMesh) { o.castShadow = !chunk; o.receiveShadow = true; o.userData.entity = this; } });
    G.scene.add(mesh);
    const R = G.RAPIER;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setLinearDamping(0.15).setAngularDamping(0.6).setCcdEnabled(!chunk);
    if (quat) desc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    if (vel) desc.setLinvel(vel.x, vel.y, vel.z);
    if (angvel) desc.setAngvel(angvel);
    collider.setMass(Math.max(0.05, mass)).setFriction(0.9).setRestitution(0.05)
      .setCollisionGroups(groups(chunk ? GROUP.DEBRIS : GROUP.PROP, chunk ? (0xffff & ~GROUP.CREATURE & ~GROUP.PLAYER) : 0xffff));
    this.body = createBody(desc, [collider], { type: 'prop', entity: this });
    this.frozen = false;
    this.chunk = chunk;
    this.expires = G.time + (chunk ? rand(25, 40) : rand(90, 140));
    this.bleed = bleedLocal && goreOn() ? { local: bleedLocal, axis: bleedAxis || new THREE.Vector3(0, 1, 0), until: G.time + rand(6, 12), acc: 0 } : null;
    this.lastSplat = 0;
    syncMesh(mesh, this.body);
    G.props.push(this);
    gibs.push(this);
    while (gibs.length > 160) gibs.shift().remove();
  }
  get position() { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); }
  update(dt) {
    if (this.removed) return;
    syncMesh(this.mesh, this.body);
    const t = this.body.translation();
    if (G.time > this.expires || t.y < (G.map ? G.map.killY : -50)) { this.remove(); return; }
    const v = this.body.linvel();
    const sp = Math.hypot(v.x, v.y, v.z);
    // wet splat where it lands
    if (sp > 4) this._fast = true;
    else if (this._fast && sp < 2.5 && G.time - this.lastSplat > 0.3 && goreOn()) {
      this._fast = false; this.lastSplat = G.time;
      const g = G.map ? G.map.groundAt(t.x, t.z) : 0;
      if (t.y - g < 0.6) { addDecal(new THREE.Vector3(t.x, g + 0.015, t.z), new THREE.Vector3(0, 1, 0), 'blood', this.chunk ? 0.2 : 0.45); if (!this.chunk) play('squish', this.position, 0.35); }
    }
    if (this.bleed && G.time < this.bleed.until && nearCamera(this.position, 50)) {
      this.bleed.acc += dt;
      if (this.bleed.acc > 0.09) {
        this.bleed.acc = 0;
        const q = this.body.rotation();
        const qq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const wp = this.bleed.local.clone().applyQuaternion(qq).add(new THREE.Vector3(t.x, t.y, t.z));
        burst('drip', wp, 1, this.bleed.axis.clone().applyQuaternion(qq), 0.5, 0.4);
      }
      if (!this.pooled && sp < 0.3 && G.time > this.bleed.until - 4) { this.pooled = true; poolAt(this.position, 0.45); }
    }
  }
  takeDamage(amount, info = {}) {
    if (this.removed) return;
    this.health -= amount;
    if (this.health <= 0) this.destroy(info);
  }
  destroy(info = {}) {
    if (this.removed) return;
    const p = this.position;
    this.remove();
    if (!goreOn()) return;
    burst('blood', p, 18, info.dir || null, 1);
    play('squish', p, 0.8);
    if (!this.chunk) spawnChunks(p, Math.max(2, Math.round(this.def.mass / 3)), info.dir || new THREE.Vector3(0, 1, 0), 3);
  }
  setFrozen(on) {
    if (this.removed) return;
    this.frozen = on;
    this.body.setBodyType(on ? G.RAPIER.RigidBodyType.Fixed : G.RAPIER.RigidBodyType.Dynamic, true);
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    removeBody(this.body);
    G.scene.remove(this.mesh);
    const i = G.props.indexOf(this); if (i >= 0) G.props.splice(i, 1);
    const k = gibs.indexOf(this); if (k >= 0) gibs.splice(k, 1);
  }
}

function nearCamera(p, d) { return G.camera.position.distanceToSquared(p) < d * d; }

export function spawnChunks(pos, count, dir = new THREE.Vector3(0, 1, 0), speed = 4, spread = 0.25) {
  if (!goreOn()) return;
  const m = mats();
  const R = G.RAPIER;
  for (let i = 0; i < count; i++) {
    const s = rand(0.035, 0.09) * (1 + spread);
    const isBone = Math.random() < 0.18;
    const mesh = new THREE.Mesh(m.chunkGeos[(Math.random() * m.chunkGeos.length) | 0], isBone ? m.bone : (Math.random() < 0.15 ? m.fat : m.flesh[(Math.random() * m.flesh.length) | 0]));
    mesh.scale.set(s * rand(0.8, 1.6), s * rand(0.6, 1.2), s * rand(0.8, 1.4));
    const g = new THREE.Group(); g.add(mesh);
    const off = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(spread);
    const v = dir.clone().normalize().add(new THREE.Vector3(rand(-1, 1), rand(-0.3, 1), rand(-1, 1)).multiplyScalar(0.8)).normalize().multiplyScalar(speed * rand(0.5, 1.3));
    new Gib({
      mesh: g, pos: pos.clone().add(off), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 6), rand(0, 6), 0)),
      collider: R.ColliderDesc.ball(s), mass: s * 20, vel: v, angvel: { x: rand(-15, 15), y: rand(-15, 15), z: rand(-15, 15) }, chunk: true,
    });
  }
}

// Spawn a loose physics copy of a rig segment (with or without its children)
function spawnSegmentGib(c, seg, { vel, recursive = true, bleed = true }) {
  const rig = c.rig;
  const bone = rig.bones[seg.name];
  rig.root.updateMatrixWorld(true);
  bone.matrixWorld.decompose(_p, _q, _s);
  const center = seg.center.clone().applyQuaternion(_q).add(_p);
  const vis = cloneBone(rig, bone, recursive);
  vis.position.copy(seg.center).negate();
  const mesh = new THREE.Group(); mesh.add(vis);
  const R = G.RAPIER, sh = seg.shape;
  let cd;
  if (sh.type === 'box') cd = R.ColliderDesc.cuboid(sh.hx, sh.hy, sh.hz);
  else if (sh.type === 'ball') cd = R.ColliderDesc.ball(sh.r);
  else cd = R.ColliderDesc.capsule(Math.max(0.01, sh.len / 2 - sh.r), sh.r);
  const names = recursive ? subtree(rig, seg.name) : [seg.name];
  const frac = names.reduce((a, n) => a + segOf(rig, n).massFrac, 0);
  // the cut end is the bone's pivot (local origin) = -center in body space
  const cut = seg.center.clone().negate();
  if (bleed && goreOn()) addStump(vis, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), shapeRadius(seg));
  return new Gib({
    mesh, pos: center, quat: _q.clone(), collider: cd, mass: (c.mass || 70) * frac, vel,
    angvel: { x: rand(-8, 8), y: rand(-8, 8), z: rand(-8, 8) }, bleedLocal: bleed ? cut : null, bleedAxis: cut.clone().normalize(),
  });
}

// ---------- severing ----------
// Removes `name` (and everything attached below it) from creature `c`.
// opts: eaten (part disappears), chunks (part bursts into chunks), dir/force (fling direction), silent
export function severPart(c, name, opts = {}) {
  const rig = c.rig;
  const seg = segOf(rig, name);
  if (!seg || name === 'pelvis' || c.removed) return false;
  c.severed = c.severed || new Set();
  if (c.severed.has(name)) return false;
  const names = subtree(rig, name);
  const dir = (opts.dir || new THREE.Vector3(rand(-1, 1), 1, rand(-1, 1))).clone().normalize();
  const force = opts.force ?? 4;
  const bone = rig.bones[name];
  rig.root.updateMatrixWorld(true);
  const pivot = bone.getWorldPosition(new THREE.Vector3());
  const centerW = bone.localToWorld(seg.center.clone());
  const rd = c.ragdoll;
  if (rd && rd.parts[name]) {
    if (opts.eaten || opts.chunks) {
      for (const n of names) { const p = rd.parts[n]; if (p) { removeBody(p.body); delete rd.parts[n]; } }
      bone.visible = false;
    } else {
      detachPart(rd, name);
      const b = rd.parts[name].body;
      b.applyImpulse(dir.clone().multiplyScalar(force * b.mass()), true);
      if (goreOn()) {
        addStump(bone, new THREE.Vector3(), new THREE.Vector3(0, 1, 0), shapeRadius(seg));
        addBleed(c, bone, new THREE.Vector3(), { secs: rand(6, 10), spurt: false });
      }
    }
  } else {
    bone.visible = false;
    if (!opts.eaten && !opts.chunks) {
      const v = c.velocity.clone().addScaledVector(dir, force);
      spawnSegmentGib(c, seg, { vel: v, recursive: true });
    }
  }
  for (const n of names) c.severed.add(n);
  if (opts.chunks) spawnChunks(centerW, Math.round(6 + seg.massFrac * 60), dir, force * 0.8, shapeRadius(seg) * 2);
  // stump on the parent side
  if (seg.parent && goreOn()) {
    const parentBone = rig.bones[seg.parent];
    const local = bone.userData.rest.clone();
    addStump(parentBone, local, local.clone().normalize().lengthSq() ? local.clone().normalize() : new THREE.Vector3(0, 1, 0), shapeRadius(seg));
    addBleed(c, parentBone, local, { secs: rand(10, 16), spurt: true, axis: local.clone().normalize() });
  }
  if (goreOn()) {
    burst('blood', pivot, opts.chunks ? 40 : 26, dir, 1, opts.chunks ? 1.6 : 1.1);
    const g = G.map ? G.map.groundAt(pivot.x, pivot.z) : 0;
    for (let i = 0; i < 3; i++) addDecal(new THREE.Vector3(pivot.x + rand(-0.8, 0.8), g + 0.015, pivot.z + rand(-0.8, 0.8)), new THREE.Vector3(0, 1, 0), 'blood', rand(0.3, 0.7));
  }
  if (!opts.silent) { play(opts.chunks ? 'gore' : 'tear', pivot, 1); if (opts.chunks) play('crunch', pivot, 0.8); }
  return true;
}

// ---------- bleeding ----------
export function addBleed(c, bone, local, { secs = 12, spurt = false, axis = null } = {}) {
  if (!goreOn()) return;
  c.bleeds = c.bleeds || [];
  if (c.bleeds.length >= 8) c.bleeds.shift();
  c.bleeds.push({ bone, local: local.clone(), until: G.time + secs, start: G.time, spurt, axis: axis || null, acc: Math.random() * 0.1 });
}

export function updateBleeds(c, dt) {
  if (!c.bleeds || !c.bleeds.length) { maybePool(c); return; }
  const near = nearCamera(c.position, 60);
  let spurting = 0;
  for (let i = c.bleeds.length - 1; i >= 0; i--) {
    const b = c.bleeds[i];
    if (G.time > b.until || !b.bone.parent) { c.bleeds.splice(i, 1); continue; }
    if (b.spurt) spurting++;
    if (!near) continue;
    b.acc += dt;
    const age = G.time - b.start, life = b.until - b.start;
    const strength = Math.max(0.15, 1 - age / life);
    const interval = b.spurt ? 0.07 : 0.16 / strength;
    if (b.acc < interval) continue;
    b.acc = 0;
    const wp = b.bone.localToWorld(b.local.clone());
    if (b.spurt && c.alive !== undefined) {
      // arterial pulses, weaker over time, and only while the heart beats (alive) or briefly after
      const beat = Math.max(0, Math.sin(G.time * (c.alive ? 9 : 5)));
      const out = b.axis ? b.bone.localToWorld(b.local.clone().add(b.axis)).sub(wp).normalize() : new THREE.Vector3(0, 1, 0);
      const pulse = (c.alive ? 1 : Math.max(0, 1 - (G.time - (c.diedAt || G.time)) / 4)) * strength;
      if (beat > 0.3 && pulse > 0.05) burst('blood', wp, 2, out, 0.25, 0.9 * pulse * beat);
      else burst('drip', wp, 1, new THREE.Vector3(0, -1, 0), 0.4, 0.3);
    } else burst('drip', wp, 1, new THREE.Vector3(0, -1, 0), 0.5, 0.2);
  }
  // bleeding out
  if (c.alive && spurting > 0 && !c.invincible && !settings.npcInvincible) {
    c.health -= dt * 3.5 * spurting;
    if (c.health <= 0) c.die({ type: 'bleed' });
  }
  maybePool(c);
}
function maybePool(c) {
  if (c.alive || c.pooled || !goreOn() || G.time - (c.diedAt || 0) < 1.2) return;
  const settled = c.ragdoll ? (() => { const p = c.ragdoll.parts.pelvis; if (!p) return true; const v = p.body.linvel(); return Math.hypot(v.x, v.y, v.z) < 0.4; })() : !c.grabbedBy;
  if (!settled) return;
  c.pooled = true;
  const src = c.ragdoll && c.ragdoll.parts.chest ? c.ragdoll.parts.chest.body.translation() : c.ragdoll ? c.ragdoll.parts.pelvis.body.translation() : c.position;
  const wounds = (c.severed ? c.severed.size : 0) + (c._wounds || 0);
  poolAt(new THREE.Vector3(src.x, src.y, src.z), Math.min(2.4, 0.9 + wounds * 0.12) * (c.rig.scale || 1));
}
function poolAt(p, size) {
  const g = G.map ? G.map.groundBelow(p) : 0;
  if (p.y - g > 1.2) return;
  bloodPool(new THREE.Vector3(p.x, g + 0.012, p.z), size);
}

// ---------- whole-body gibbing ----------
export function gibCreature(c, { dir = new THREE.Vector3(0, 1, 0), point = null, force = 8 } = {}) {
  if (!goreOn() || c.removed) return false;
  const rig = c.rig;
  rig.root.updateMatrixWorld(true);
  const center = c.ragdoll && c.ragdoll.parts.pelvis ? (() => { const t = c.ragdoll.parts.pelvis.body.translation(); return new THREE.Vector3(t.x, t.y + 0.3, t.z); })() : c.position.add(new THREE.Vector3(0, c.height * 0.55, 0));
  const origin = point ? point.clone() : center.clone().addScaledVector(dir, -1);
  const severed = c.severed || new Set();
  for (const seg of rig.segments) {
    if (severed.has(seg.name)) continue;
    const bone = rig.bones[seg.name];
    const wc = bone.localToWorld(seg.center.clone());
    const out = wc.clone().sub(origin).normalize().add(new THREE.Vector3(0, 0.6, 0)).normalize();
    const big = seg.name === 'chest' || seg.name === 'pelvis';
    const toChunks = big ? Math.random() < 0.7 : seg.name === 'head' ? Math.random() < 0.6 : Math.random() < 0.25;
    if (toChunks) spawnChunks(wc, Math.round(5 + seg.massFrac * 55), out, force * 0.9, shapeRadius(seg) * 2.2);
    else spawnSegmentGib(c, seg, { vel: out.multiplyScalar(force * rand(0.5, 1.1)), recursive: false, bleed: true });
  }
  burst('blood', center, 70, dir, 1.4, 1.8);
  const g = G.map ? G.map.groundAt(center.x, center.z) : 0;
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.28, r = rand(0.3, 3); addDecal(new THREE.Vector3(center.x + Math.cos(a) * r, g + 0.015, center.z + Math.sin(a) * r), new THREE.Vector3(0, 1, 0), 'blood', rand(0.35, 1.1)); }
  if (center.y - g < 2) poolAt(center, 1.4);
  play('gore', center, 1.3); play('crunch', center, 1);
  shake(0.35, center);
  c._gibbed = true;
  if (c.alive) c.die({ type: 'gib', dir, silentRagdoll: true });
  c.remove();
  return true;
}

// ---------- damage hook (called from Creature.takeDamage) ----------
const LIMB_HP = { uArmL: 55, uArmR: 55, lArmL: 45, lArmR: 45, thighL: 80, thighR: 80, shinL: 65, shinR: 65, head: 95 };
// returns 'gibbed' when the creature no longer exists
export function goreDamage(c, amount, info) {
  if (!goreOn() || amount <= 0 || c.removed || (c.def.bloodType && c.def.bloodType !== 'blood')) return null;
  const big = c.mass > 200;
  c.partDmg = c.partDmg || {};
  // headshots burst (bullets / blunt) or cut off (blades) the head instead of gibbing the body
  if (info.part === 'head' && !c.severed.has('head') && info.type !== 'blast') {
    c.partDmg.head = (c.partDmg.head || 0) + amount;
    const sharp = info.sound === 'slice' || info.type === 'claw';
    if (c.partDmg.head >= LIMB_HP.head * (big ? 4 : 1) * (sharp ? 0.6 : 1)) {
      severPart(c, 'head', { dir: info.dir, force: 5, chunks: !sharp });
      afterSever(c, 'head');
    }
    return null;
  }
  // whole-body gibbing
  const blast = info.type === 'blast' && (amount >= (big ? 400 : 110) || (amount >= 75 && c.health <= 0 && !big));
  const crush = info.type === 'impact' && amount >= (big ? 600 : 140) && c.health <= 0;
  const overkill = c.health < -c.maxHealth * (c.alive ? 1.2 : 1.6) && !big;
  if (blast || crush || overkill) {
    if (gibCreature(c, { dir: info.dir || new THREE.Vector3(0, 1, 0), point: info.blast ? null : info.point, force: blast ? 9 : 6 })) return 'gibbed';
  }
  // explosions rip off a limb or two
  if (info.type === 'blast' && amount > 25 && !big && Math.random() < 0.5) {
    const limbs = ['uArmL', 'uArmR', 'thighL', 'thighR', 'lArmL', 'lArmR', 'shinL', 'shinR'].filter(n => !(c.severed && c.severed.has(n)));
    const n = limbs[(Math.random() * limbs.length) | 0];
    if (n) { severPart(c, n, { dir: info.dir, force: 7 }); afterSever(c, n); }
  }
  // per-part damage
  let part = info.part;
  if (!part || !LIMB_HP[part] || (c.severed && c.severed.has(part))) return null;
  c.partDmg[part] = (c.partDmg[part] || 0) + amount;
  const sharp = info.sound === 'slice' || info.type === 'claw';
  const limit = LIMB_HP[part] * (big ? 4 : 1) * (sharp ? 0.6 : 1);
  if (c.partDmg[part] < limit && !(sharp && amount >= 40 && part !== 'head' && !big)) return null;
  if (part === 'head') {
    // sharp blades decapitate; bullets and blunt hits burst the head
    severPart(c, 'head', { dir: info.dir, force: 5, chunks: !sharp });
  } else severPart(c, part, { dir: info.dir, force: sharp ? 4 : 6 });
  afterSever(c, part);
  return null;
}

// consequences of losing a part for a living creature
export function afterSever(c, part) {
  if (!c.alive) return;
  if (part === 'head' || part === 'chest') { c.die({ type: 'gore', part }); return; }
  if (/thigh|shin/.test(part)) {
    c.crippled = true;
    if (settings.ragdolls && !c.ragdoll && c.body && !c.grabbedBy && !c.held) c.knockDown({ dir: new THREE.Vector3(0, -1, 0), impulse: c.knockThreshold * 1.2 });
    c.getupTimer = 1e9;
  }
  if (c.onLimbLost) c.onLimbLost(part);
}

// Remove an already-dead ragdoll's part as "eaten" (used by Maneaters feeding on corpses)
export function eatRagdollPart(c, name) { return severPart(c, name, { eaten: true, silent: true }); }
