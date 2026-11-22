// Holding objects (E pickup, physics gun, gravity gun), F interactions, tool gun tools and NPC spawners.
import * as THREE from 'three';
import { G, newId } from './state.js';
import { settings } from './config.js';
import { raycast, GROUP } from './physics.js';
import { beam, burst, ring } from './effects.js';
import { play } from './audio.js';
import { weaponState as W, playerTrace, updateToolScreen } from './weapons.js';
import { weldBodies, removeWeld } from './props.js';

const I = { hold: null, weldFirst: null, rotating: false };
G.interact = I;

// ----- what did we hit? -----
function bodyOf(hit) {
  const o = hit.owner;
  if (!o) return null;
  if (o.type === 'prop') return { kind: 'prop', ent: o.entity, body: o.entity.body };
  if (o.type === 'vehicle') return { kind: 'vehicle', ent: o.entity, body: o.entity.body };
  if (o.type === 'ragdoll') { const p = o.entity.ragdoll && o.entity.ragdoll.parts[o.part]; return p ? { kind: 'ragdoll', ent: o.entity, body: p.body, part: o.part } : null; }
  if (o.type === 'creature') return { kind: 'creature', ent: o.entity, body: o.entity.body };
  return null;
}

function camRay() {
  const origin = G.camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.getWorldQuaternion(new THREE.Quaternion()));
  return { origin, dir };
}

// ----- holding -----
function startHold(info, hitPoint, mode) {
  const b = info.body;
  const t = b.translation(), r = b.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const { origin } = camRay();
  const local = hitPoint.clone().sub(new THREE.Vector3(t.x, t.y, t.z)).applyQuaternion(q.clone().invert());
  const camYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), G.player.yaw);
  I.hold = {
    ...info, mode, local: mode === 'physgun' ? local : new THREE.Vector3(),
    dist: mode === 'physgun' ? origin.distanceTo(hitPoint) : (mode === 'gravgun' ? 2.6 : 1.7),
    rel: camYaw.clone().invert().multiply(q),  // orientation relative to the player's yaw
    lastPos: hitPoint.clone(), vel: new THREE.Vector3(),
  };
  if (info.kind === 'prop' && info.ent.frozen) { info.ent.setFrozen(false); info.ent.thawAt = 0; }
  if (info.kind === 'creature') {
    if (info.ent.frozenTime > 0) info.ent.unfreeze();
    info.ent.setHeld(true);
  }
  if (info.kind === 'ragdoll') {
    if (info.ent.ragdoll.frozen || !b.isDynamic()) { b.setBodyType(G.RAPIER.RigidBodyType.Dynamic, true); }
    info.ent.heldPart = info.part;
  }
  if (info.kind === 'vehicle' && !b.isDynamic()) b.setBodyType(G.RAPIER.RigidBodyType.Dynamic, true);
  b.wakeUp();
  if (mode === 'physgun') play('physgun', null, 0.6);
}

I.releaseHold = function (throwIt = false, launch = 0) {
  const h = I.hold; if (!h) return;
  I.hold = null; I.rotating = false;
  if (h.ent && h.ent.removed) return;
  const { dir } = camRay();
  if (h.kind === 'creature') {
    const c = h.ent;
    if (!c.alive || !c.body) return;
    c.setHeld(false);
    const v = h.vel.clone();
    if (launch) v.addScaledVector(dir, launch);
    c.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    if (v.length() > 7 && settings.ragdolls) c.knockDown({ dir: v.clone().normalize(), impulse: c.mass * v.length() * 1.2 });
    c.lastAttacker = G.player;
    if (c.addGrudge && c.kind === 'human' && v.length() > 4) c.addGrudge(G.player, 25);
    return;
  }
  if (h.kind === 'ragdoll') h.ent.heldPart = null;
  const b = h.body;
  if (!b || b._removed || !b.isDynamic()) return;
  if (launch) {
    const m = Math.min(b.mass(), 300);
    b.applyImpulse(dir.clone().multiplyScalar(m * launch), true);
    if (h.ent) h.ent.lastThrower = G.player;
  }
  if (h.kind === 'prop' || h.kind === 'vehicle') h.ent.lastThrower = G.player;
};

export function holdStep(dt) {
  const h = I.hold; if (!h) return;
  if (h.body && h.body._removed && h.kind !== 'creature') { I.hold = null; return; }
  if (!G.player.alive || (h.ent && h.ent.removed) || (h.kind === 'ragdoll' && !h.ent.ragdoll) || (h.kind === 'creature' && (!h.ent.body || !h.ent.alive || h.ent.ragdoll))) { I.hold = null; return; }
  const { origin, dir } = camRay();
  const target = origin.clone().addScaledVector(dir, h.dist);
  if (h.mode !== 'physgun') { // keep it off the floor
    const g = G.map.groundAt(target.x, target.z);
    target.y = Math.max(target.y, g + 0.4);
  }
  if (h.kind === 'creature') {
    const c = h.ent;
    const feet = target.clone().add(new THREE.Vector3(0, -c.height * 0.6, 0));
    const prev = c.position;
    h.vel.lerp(feet.clone().sub(prev).divideScalar(Math.max(dt, 1e-3)), 0.3);
    c.setKinematicPos(feet);
    c.yaw = c.targetYaw = G.player.yaw;
    return;
  }
  const b = h.body;
  if (!b.isDynamic()) return;
  const t = b.translation(), r = b.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const cur = h.local.clone().applyQuaternion(q).add(new THREE.Vector3(t.x, t.y, t.z));
  const err = target.clone().sub(cur);
  const strength = h.mode === 'physgun' ? 12 : 9;
  const maxV = h.mode === 'physgun' ? 45 : 18;
  const v = err.multiplyScalar(strength);
  if (v.length() > maxV) v.setLength(maxV);
  // heavy things lag behind when using the hands
  if (h.mode === 'pickup' && b.mass() > 40) v.multiplyScalar(40 / b.mass());
  b.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
  h.vel.copy(v);
  // orientation
  const camYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), G.player.yaw);
  const want = camYaw.multiply(h.rel);
  const dq = want.clone().multiply(q.clone().invert());
  if (dq.w < 0) { dq.x *= -1; dq.y *= -1; dq.z *= -1; dq.w *= -1; }
  const ang = 2 * Math.acos(Math.min(1, dq.w));
  if (ang > 1e-3 && h.kind !== 'ragdoll') {
    const axis = new THREE.Vector3(dq.x, dq.y, dq.z).normalize();
    const w = axis.multiplyScalar(Math.min(ang * 10, 20));
    b.setAngvel({ x: w.x, y: w.y, z: w.z }, true);
  } else if (h.kind === 'ragdoll') {
    const av = b.angvel(); b.setAngvel({ x: av.x * 0.8, y: av.y * 0.8, z: av.z * 0.8 }, true);
  }
}

// Visual beam for physgun
let beamLine = null;
function updateBeam() {
  const h = I.hold;
  const show = h && h.mode === 'physgun' && W.current === 'physgun';
  if (!beamLine) {
    const geo = new THREE.BufferGeometry().setFromPoints(new Array(20).fill(0).map(() => new THREE.Vector3()));
    beamLine = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x5ad8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
    beamLine.frustumCulled = false;
    G.scene.add(beamLine);
  }
  if (beamLine.parent !== G.scene) G.scene.add(beamLine);
  beamLine.visible = !!show;
  if (!show) return;
  const { origin, dir } = camRay();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const from = origin.clone().addScaledVector(dir, 0.6).addScaledVector(right, 0.16).add(new THREE.Vector3(0, -0.13, 0));
  let to;
  if (h.kind === 'creature') to = h.ent.position.add(new THREE.Vector3(0, h.ent.height * 0.6, 0));
  else { const t = h.body.translation(), r = h.body.rotation(); to = h.local.clone().applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(t.x, t.y, t.z)); }
  const mid = origin.clone().addScaledVector(dir, h.dist * 0.6);
  const pos = beamLine.geometry.attributes.position;
  for (let i = 0; i < 20; i++) {
    const k = i / 19;
    const a = from.clone().lerp(mid, k), b = mid.clone().lerp(to, k);
    const p = a.lerp(b, k);
    p.x += Math.sin(G.realTime * 30 + i) * 0.01; p.y += Math.cos(G.realTime * 27 + i) * 0.01;
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
}

// ----- weapon hooks -----
I.handlesFire = function (id, pressed) {
  if (I.hold && I.hold.mode === 'pickup') { if (pressed) { I.releaseHold(true, 14); play('swing', null, 0.6); } return true; }
  if (id === 'physgun') {
    if (pressed && !I.hold) {
      const hit = playerTrace(400);
      const info = hit && bodyOf(hit);
      if (info && info.body) startHold(info, hit.point, 'physgun');
      else if (hit) beam(G.camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.15, 0)), hit.point, 0x5ad8ff, 0.08, 0.01);
    }
    return true;
  }
  if (id === 'gravgun') {
    if (!pressed) return true;
    if (W.cooldown > 0) return true;
    W.cooldown = 0.5;
    if (I.hold) { I.releaseHold(true, 38); play('punt', null, 1); W.kick = 1.2; return true; }
    const hit = playerTrace(7);
    const info = hit && bodyOf(hit);
    if (info) {
      const { dir } = camRay();
      if (info.kind === 'creature' && info.ent.alive) {
        info.ent.takeDamage(8, { type: 'blast', dir, impulse: 3000, attacker: G.player, part: 'chest', blast: true, point: hit.point });
      } else if (info.body.isDynamic()) {
        const m = Math.min(info.body.mass(), 400);
        info.body.applyImpulseAtPoint(dir.clone().multiplyScalar(m * 22), hit.point, true);
        if (info.ent) info.ent.lastThrower = G.player;
        if (info.ent && info.ent.takeDamage && info.kind !== 'ragdoll') info.ent.takeDamage(5, { type: 'blast', attacker: G.player });
      }
      burst('spark', hit.point, 8, hit.normal, 0.8);
    }
    play('punt', null, 0.9); W.kick = 1;
    return true;
  }
  if (id === 'toolgun') { if (pressed) useTool(false); return true; }
  return false;
};
I.handlesAlt = function (id) {
  if (id === 'physgun') {
    const h = I.hold;
    if (h) { // freeze in place
      if (h.kind === 'prop') h.ent.setFrozen(true);
      else if (h.kind === 'vehicle') h.body.setBodyType(G.RAPIER.RigidBodyType.Fixed, true);
      else if (h.kind === 'ragdoll') { h.body.setBodyType(G.RAPIER.RigidBodyType.Fixed, true); }
      else if (h.kind === 'creature') { I.hold = null; h.ent.freeze(1e9, false); }
      if (I.hold) { I.hold = null; if (h.kind === 'ragdoll') h.ent.heldPart = null; }
      ring(G.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(camRay().dir, h.dist), 0x5ad8ff, 1.2, 0.3, camRay().dir);
      play('freeze', null, 0.5);
    }
    return true;
  }
  if (id === 'gravgun') {
    if (I.hold) { I.releaseHold(false); return true; }
    const hit = playerTrace(25);
    const info = hit && bodyOf(hit);
    if (!info) return true;
    if (info.kind === 'creature') {
      if (!settings.ragdolls || info.ent.mass > 250) return true;
      info.ent.knockDown({ dir: camRay().dir.negate(), impulse: info.ent.knockThreshold * 1.2 });
      const rd = info.ent.ragdoll; if (!rd) return true;
      const hp = rd.parts.chest ? 'chest' : 'pelvis';
      startHold({ kind: 'ragdoll', ent: info.ent, body: rd.parts[hp].body, part: hp }, hit.point, 'gravgun');
      return true;
    }
    if (!info.body.isDynamic() || info.body.mass() > 300) { play('empty', null, 0.5); return true; }
    if (hit.dist < 4) startHold(info, hit.point, 'gravgun');
    else { const { dir } = camRay(); info.body.applyImpulse(dir.clone().multiplyScalar(-Math.min(info.body.mass(), 300) * 9), true); info.body.applyImpulse({ x: 0, y: info.body.mass() * 2, z: 0 }, true); }
    return true;
  }
  if (id === 'toolgun') { useTool(true); return true; }
  return false;
};

// mouse wheel while holding with the physgun changes distance; returns true if consumed
I.wheel = function (dy) {
  if (I.hold && I.hold.mode === 'physgun') { I.hold.dist = THREE.MathUtils.clamp(I.hold.dist * (dy > 0 ? 0.9 : 1.1), 1.5, 300); return true; }
  return false;
};
// rotating with R while holding (mouse deltas)
I.rotateHeld = function (dx, dy) {
  const h = I.hold; if (!h || h.mode !== 'physgun') return false;
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * 0.006);
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * 0.006);
  h.rel.premultiply(qy).premultiply(qx);
  return true;
};
// R with physgun and nothing held: unfreeze aimed object
I.unfreezeAimed = function () {
  const hit = playerTrace(400);
  const info = hit && bodyOf(hit);
  if (!info) return;
  if (info.kind === 'prop' && info.ent.frozen) info.ent.setFrozen(false);
  else if (info.kind === 'vehicle' && !info.body.isDynamic()) info.body.setBodyType(G.RAPIER.RigidBodyType.Dynamic, true);
  else if (info.kind === 'ragdoll') { for (const n in info.ent.ragdoll.parts) info.ent.ragdoll.parts[n].body.setBodyType(G.RAPIER.RigidBodyType.Dynamic, true); info.ent.ragdoll.frozen = false; if (info.ent.frozenTime > 0) info.ent.unfreeze(); }
  else if (info.kind === 'creature' && info.ent.frozenTime > 0) info.ent.unfreeze();
  else return;
  play('physgun', null, 0.5); burst('spark', hit.point, 6, hit.normal, 0.6);
};

// E: pick up / drop
I.pickup = function () {
  if (I.hold) { I.releaseHold(false); return; }
  const hit = playerTrace(2.6);
  const info = hit && bodyOf(hit);
  if (!info) return;
  if ((info.kind === 'prop' && info.body.isDynamic() && info.body.mass() <= 80) || info.kind === 'ragdoll') startHold(info, hit.point, 'pickup');
  else if (info.kind === 'prop' && info.ent.frozen) G.ui.toast('That object is frozen');
  else if (info.kind === 'prop') G.ui.toast('Too heavy to lift');
};
I.drop = function () { if (I.hold) I.releaseHold(false); };

// F: interact
I.use = function () {
  const pl = G.player;
  if (pl.possessing) { pl.endPossession(); return; }
  if (pl.inVehicle) { pl.exitVehicle(); return; }
  const hit = playerTrace(3.5);
  if (hit && hit.owner) {
    const o = hit.owner;
    if (o.type === 'vehicle' && !o.entity.def.wreck) {
      if (o.entity.isUpsideDown()) { o.entity.flip(); return; }
      pl.enterVehicle(o.entity); return;
    }
    if (o.type === 'vehicle' && o.entity.def.wreck) { G.ui.toast('This wreck will never drive again'); return; }
    if (o.type === 'creature' && o.entity.interact) { o.entity.interact(pl); return; }
    if (o.type === 'world' && o.button) { o.button.press(); return; }
  }
  // nearby button
  if (G.map && G.map.buttons) {
    for (const b of G.map.buttons) if (b.pos.distanceTo(pl.eyePos()) < 2.2) { b.press(); return; }
  }
};

export function updateInteract(dt) {
  updateBeam();
}

// ---------- Tools ----------
export const TOOLS = [
  { id: 'remover', name: 'Remover', desc: 'LMB deletes the object or creature you aim at.' },
  { id: 'weld', name: 'Weld', desc: 'LMB on two objects to weld them together. RMB cancels.' },
  { id: 'freeze', name: 'Freeze / Unfreeze', desc: 'LMB toggles freezing of the aimed object, ragdoll or creature.' },
  { id: 'health', name: 'Health Editor', desc: 'LMB a creature to edit its health.' },
  { id: 'possess', name: 'NPC Possession', desc: 'LMB a living creature to take control of it. F to leave.' },
  { id: 'spawner', name: 'NPC Spawner', desc: 'LMB places a spawner that keeps spawning creatures. RMB removes the nearest spawner. Set the creature and interval in the panel.' },
  { id: 'camera', name: 'Camera Tool', desc: 'Toggles a detached free camera (also: C).', instant: true },
  { id: 'time', name: 'Time Controller', desc: 'Slow down, pause or speed up the simulation.', panel: 'time' },
  { id: 'factions', name: 'Faction Editor', desc: 'Decide who is friendly, neutral or hostile to whom.', panel: 'factions' },
];
G.tool = TOOLS[0];
export function selectTool(id) {
  const t = TOOLS.find(x => x.id === id); if (!t) return;
  if (t.panel) { G.ui.openPanel(t.panel); return; }
  if (t.instant) { G.player.toggleFreeCam(); return; }
  G.tool = t; I.weldFirst = null;
  if (!W.owned.includes('toolgun')) W.owned.push('toolgun');
  import('./weapons.js').then(m => { m.equip('toolgun'); updateToolScreen(); });
  if (t.id === 'spawner') G.ui.openPanel('spawner');
  G.ui.toast(`Tool: ${t.name} — ${t.desc}`, 4);
}

function toolFx(point) {
  const { origin } = camRay();
  beam(origin.clone().add(new THREE.Vector3(0, -0.12, 0)), point, 0x7fe0ff, 0.12, 0.012);
  burst('spark', point, 6, null, 0.6);
  play('toolgun', null, 0.6);
}

function useTool(alt) {
  const tool = G.tool;
  const hit = playerTrace(500);
  if (!tool) return;
  if (tool.id === 'spawner') {
    if (alt) { removeNearestSpawner(hit ? hit.point : G.player.position); return; }
    if (hit) { placeSpawner(hit.point); toolFx(hit.point); }
    return;
  }
  if (!hit) return;
  const info = bodyOf(hit);
  switch (tool.id) {
    case 'remover': {
      if (!info || alt) return;
      toolFx(hit.point);
      play('remove', hit.point, 0.8);
      ring(hit.point, 0x7fe0ff, 1, 0.3);
      info.ent.remove();
      break;
    }
    case 'weld': {
      if (alt) { I.weldFirst = null; G.ui.toast('Weld cancelled'); return; }
      if (!info || !info.body) return;
      if (info.kind === 'creature') { G.ui.toast('Cannot weld living creatures (ragdolls work)'); return; }
      toolFx(hit.point);
      if (!I.weldFirst) { I.weldFirst = info; G.ui.toast('Weld: now click a second object'); }
      else {
        if (I.weldFirst.body === info.body) return;
        if ((I.weldFirst.ent && I.weldFirst.ent.removed) || I.weldFirst.body._removed) { I.weldFirst = null; G.ui.toast('The first object is gone — pick again'); return; }
        const w = weldBodies(I.weldFirst.body, info.body);
        G.undoStack.push({ type: 'weld', weld: w });
        I.weldFirst = null; G.ui.toast('Welded!');
      }
      break;
    }
    case 'freeze': {
      if (!info) return;
      toolFx(hit.point);
      if (info.kind === 'prop') info.ent.setFrozen(!info.ent.frozen);
      else if (info.kind === 'vehicle') info.body.setBodyType(info.body.isDynamic() ? G.RAPIER.RigidBodyType.Fixed : G.RAPIER.RigidBodyType.Dynamic, true);
      else if (info.kind === 'ragdoll' || info.kind === 'creature') { if (info.ent.frozenTime > 0) info.ent.unfreeze(); else info.ent.freeze(1e9, false); }
      break;
    }
    case 'health': {
      if (!info || !(info.kind === 'creature' || info.kind === 'ragdoll')) { G.ui.toast('Aim at a creature'); return; }
      toolFx(hit.point);
      G.ui.openHealthEditor(info.ent);
      break;
    }
    case 'possess': {
      if (!info || info.kind !== 'creature' || !info.ent.alive) { G.ui.toast('Aim at a living, standing creature'); return; }
      toolFx(hit.point);
      G.player.possess(info.ent);
      break;
    }
  }
}

// ---------- NPC spawners ----------
export const spawnerConfig = { creature: 'walker', interval: 6, max: 8 };
const padGeo = new THREE.CylinderGeometry(0.8, 0.9, 0.12, 24);
export function placeSpawner(point, cfg = spawnerConfig) {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: 0x333a44, metalness: 0.6, roughness: 0.4 }));
  pad.receiveShadow = true; g.add(pad);
  const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 8, 32), new THREE.MeshStandardMaterial({ color: 0x3affb0, emissive: 0x3affb0, emissiveIntensity: 2 }));
  ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.08; g.add(ringM);
  g.position.copy(point);
  G.scene.add(g);
  const s = { id: newId(), kind: 'spawner', pos: point.clone(), creature: cfg.creature, interval: cfg.interval, max: cfg.max, timer: 1, mesh: g, ring: ringM, spawned: [] };
  s.remove = () => { G.scene.remove(g); const i = G.spawners.indexOf(s); if (i >= 0) G.spawners.splice(i, 1); };
  G.spawners.push(s);
  G.undoStack.push({ type: 'spawn', entity: s });
  return s;
}
function removeNearestSpawner(p) {
  let best = null, bd = 6;
  for (const s of G.spawners) { const d = s.pos.distanceTo(p); if (d < bd) { bd = d; best = s; } }
  if (best) { best.remove(); play('remove', p, 0.8); G.ui.toast('Spawner removed'); }
}
export function updateSpawners(dt, spawnCreature) {
  for (const s of G.spawners) {
    s.ring.rotation.z += dt * 2;
    s.timer -= dt;
    s.spawned = s.spawned.filter(c => c.alive && !c.removed);
    if (s.timer <= 0) {
      s.timer = s.interval;
      if (s.spawned.length >= s.max) continue;
      const c = spawnCreature(s.creature, s.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.1, (Math.random() - 0.5) * 0.6)), { quiet: true, noUndo: true });
      if (c) { s.spawned.push(c); ring(s.pos.clone().add(new THREE.Vector3(0, 0.1, 0)), 0x3affb0, 1.5, 0.4); }
    }
  }
}
export { removeWeld };
