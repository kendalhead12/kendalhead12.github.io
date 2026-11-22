// Turns a posed rig into jointed Rapier bodies, and drives the rig from those bodies.
import * as THREE from 'three';
import { G } from '../state.js';
import { createBody, removeBody, groups, GROUP } from '../physics.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

const LIMITS = {
  knee: [0, 2.5], elbow: [-2.5, 0], hip: [-1.9, 0.6], spine: [-0.45, 1.25], neck: [-0.7, 0.8],
};

export function createRagdoll(rig, { velocity, owner, totalMass, damping = 1, skip = null } = {}) {
  const R = G.RAPIER;
  rig.root.updateMatrixWorld(true);
  const parts = {};
  const fracSum = rig.segments.reduce((a, s) => a + s.massFrac, 0);
  const mass = totalMass || rig.mass || 70;
  for (const seg of rig.segments) {
    if (skip && skip.has(seg.name)) continue;  // severed / eaten parts
    const bone = rig.bones[seg.name];
    bone.matrixWorld.decompose(_p, _q, _s);
    const c = seg.center.clone().applyQuaternion(_q).add(_p);
    const desc = R.RigidBodyDesc.dynamic().setTranslation(c.x, c.y, c.z).setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
      .setLinearDamping(0.08).setAngularDamping(0.9 * damping).setCanSleep(true);
    if (velocity) desc.setLinvel(velocity.x, velocity.y, velocity.z);
    if (seg.name === 'head' || seg.name === 'chest') desc.setCcdEnabled(true);
    let cd;
    const sh = seg.shape;
    if (sh.type === 'box') cd = R.ColliderDesc.cuboid(sh.hx, sh.hy, sh.hz);
    else if (sh.type === 'ball') cd = R.ColliderDesc.ball(sh.r);
    else cd = R.ColliderDesc.capsule(Math.max(0.01, sh.len / 2 - sh.r), sh.r);
    cd.setMass(mass * seg.massFrac / fracSum).setFriction(0.85).setRestitution(0.05)
      .setCollisionGroups(groups(GROUP.RAGDOLL))
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(mass * 25);
    const body = createBody(desc, [cd], { type: 'ragdoll', entity: owner, part: seg.name });
    parts[seg.name] = { body, seg, bone, joint: null, detached: false };
  }
  for (const seg of rig.segments) {
    if (!seg.parent) continue;
    const child = parts[seg.name], par = parts[seg.parent];
    if (!child || !par) continue;
    const bone = rig.bones[seg.name];
    bone.matrixWorld.decompose(_p, _q, _s);
    const pt = par.body.translation(), pr = par.body.rotation();
    const pq = new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w);
    const a1 = _p.clone().sub(new THREE.Vector3(pt.x, pt.y, pt.z)).applyQuaternion(pq.clone().invert());
    const a2 = seg.center.clone().multiplyScalar(-1);
    let jd;
    const lim = LIMITS[seg.kind];
    if (lim) jd = R.JointData.revolute({ x: a1.x, y: a1.y, z: a1.z }, { x: a2.x, y: a2.y, z: a2.z }, { x: 1, y: 0, z: 0 });
    else jd = R.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: a2.x, y: a2.y, z: a2.z });
    const j = G.world.createImpulseJoint(jd, par.body, child.body, true);
    j.setContactsEnabled(false);
    if (lim) j.setLimits(lim[0], lim[1]);
    child.joint = j;
  }
  // detach rig root transform: the bones are driven in world space now
  rig.root.position.set(0, 0, 0);
  rig.root.quaternion.identity();
  rig.root.scale.set(1, 1, 1);
  return { parts, rig, frozen: false };
}

const _wq = {}, _wp = {};
export function syncRagdoll(rd) {
  const rig = rd.rig;
  for (const seg of rig.segments) {
    const part = rd.parts[seg.name];
    if (!part) continue;
    const t = part.body.translation(), r = part.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const p = seg.center.clone().applyQuaternion(q).multiplyScalar(-1).add(new THREE.Vector3(t.x, t.y, t.z));
    _wq[seg.name] = q; _wp[seg.name] = p;
    const bone = part.bone;
    if (!seg.parent) { bone.position.copy(p); bone.quaternion.copy(q); }
    else {
      if (!rd.parts[seg.parent]) { bone.position.copy(p); bone.quaternion.copy(q); continue; }
      const pq = _wq[seg.parent], pp = _wp[seg.parent];
      const inv = pq.clone().invert();
      bone.position.copy(p).sub(pp).applyQuaternion(inv);
      bone.quaternion.copy(inv).multiply(q);
    }
  }
}

// Removing a body also removes every joint attached to it, so only bodies are removed here
// (removing an already-removed joint makes Rapier panic and poisons the wasm instance).
export function destroyRagdoll(rd) {
  for (const n in rd.parts) { const p = rd.parts[n]; p.joint = null; removeBody(p.body); }
  rd.parts = {};
}

export function detachPart(rd, name) {
  const p = rd.parts[name];
  if (!p || p.detached || !p.joint || p.body._removed) return false;
  G.world.removeImpulseJoint(p.joint, true);
  p.detached = true; p.joint = null;
  return true;
}

export function ragdollPelvis(rd) {
  const b = rd.parts.pelvis.body;
  return { pos: b.translation(), vel: b.linvel(), rot: b.rotation() };
}

export function setRagdollFrozen(rd, frozen) {
  const R = G.RAPIER;
  rd.frozen = frozen;
  for (const n in rd.parts) rd.parts[n].body.setBodyType(frozen ? R.RigidBodyType.Fixed : R.RigidBodyType.Dynamic, true);
}

export function ragdollSpeed(rd) {
  let m = 0;
  for (const n in rd.parts) { const v = rd.parts[n].body.linvel(); m = Math.max(m, Math.hypot(v.x, v.y, v.z)); }
  return m;
}
