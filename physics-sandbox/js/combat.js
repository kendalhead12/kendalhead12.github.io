// Shared damage dispatch: raycast hits, melee, explosions, impact damage.
import * as THREE from 'three';
import { G, emitNoise } from './state.js';
import { burst, addDecal, flash, ring, shake } from './effects.js';
import { play } from './audio.js';
import { overlapSphere, onImpact, raycast, colliderAlive } from './physics.js';

// Apply a hit from a raycast result. info: {damage, dir, impulse, attacker, type}
export function applyHit(hit, info) {
  const o = hit.owner;
  const dir = info.dir.clone().normalize();
  const imp = info.impulse || 0;
  if (!o || o.type === 'world') {
    if (info.type === 'bullet') {
      burst('spark', hit.point, 5, hit.normal, 0.6);
      burst('dust', hit.point, 3, hit.normal, 0.5);
      addDecal(hit.point, hit.normal, 'hole', 0.09);
      if (Math.random() < 0.3) play('ricochet', hit.point, 0.6);
    } else if (info.type === 'melee') {
      burst('dust', hit.point, 4, hit.normal, 0.5);
      play(info.sound === 'slice' ? 'metal' : 'thud', hit.point, 0.7);
    }
    return { kind: 'world' };
  }
  if (o.type === 'creature' || o.type === 'ragdoll') {
    const c = o.entity;
    if (!c || c.removed) return { kind: 'none' };
    const part = o.type === 'ragdoll' ? o.part : c.partFromHeight(hit.point);
    c.takeDamage(info.damage, { ...info, dir, point: hit.point, normal: hit.normal, part, impulse: imp });
    return { kind: 'creature', entity: c, part };
  }
  if (o.type === 'prop') {
    const p = o.entity;
    if (p && !p.removed) {
      if (p.body && p.body.isDynamic()) p.body.applyImpulseAtPoint(dir.clone().multiplyScalar(imp), hit.point, true);
      p.takeDamage(info.damage, { ...info, point: hit.point, normal: hit.normal });
      if (info.type === 'bullet') {
        burst(p.def.material === 'wood' ? 'wood' : p.def.material === 'glass' ? 'glass' : p.def.material === 'flesh' ? 'blood' : 'spark', hit.point, 5, hit.normal, 0.6);
        if (p.def.material !== 'glass' && p.def.material !== 'soft' && p.def.material !== 'flesh') addDecal(hit.point, hit.normal, 'hole', 0.08, p.mesh);
      } else if (info.type === 'melee') {
        play(p.def.material === 'metal' ? 'metal' : p.def.material === 'wood' ? 'wood' : 'thud', hit.point, 0.8);
      }
    }
    return { kind: 'prop', entity: p };
  }
  if (o.type === 'vehicle') {
    const v = o.entity;
    v.body.applyImpulseAtPoint(dir.clone().multiplyScalar(imp), hit.point, true);
    v.takeDamage(info.damage, info);
    if (info.type === 'bullet') { burst('spark', hit.point, 6, hit.normal, 0.6); addDecal(hit.point, hit.normal, 'hole', 0.08, v.mesh); play('metal', hit.point, 0.4); }
    return { kind: 'vehicle', entity: v };
  }
  if (o.type === 'player') {
    G.player.takeDamage(info.damage, { ...info, dir });
    return { kind: 'player' };
  }
  return { kind: 'none' };
}

// Radial blast. Pushes bodies, damages creatures/props.
export function explosion(pos, { radius = 6, damage = 120, impulse = 40, attacker = null, fx = true, sound = 'explosion', type = 'blast' } = {}) {
  if (fx) {
    burst('fire', pos, 30, new THREE.Vector3(0, 1, 0), 1.2, 1.5);
    burst('smoke', pos, 18, new THREE.Vector3(0, 1, 0), 1, 1);
    burst('debris', pos, 16, new THREE.Vector3(0, 1, 0), 1.2, 2);
    flash(pos, 0xffa040, 30, 0.35, radius * 4);
    ring(pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xffb060, radius * 1.2, 0.45);
    const g = G.map ? G.map.groundAt(pos.x, pos.z) : 0;
    if (pos.y - g < 1.5) addDecal(new THREE.Vector3(pos.x, g + 0.02, pos.z), new THREE.Vector3(0, 1, 0), 'scorch', radius * 0.8);
    if (sound) play(sound, pos, 1.3);
    shake(1.2, pos);
  }
  emitNoise(pos, 120, 'explosion', attacker);
  const hit = new Set();
  for (const { collider, owner } of overlapSphere(pos, radius)) {
    if (!owner || !colliderAlive(collider)) continue;
    const body = collider.parent();
    const bp = body ? body.translation() : collider.translation();
    const d = new THREE.Vector3(bp.x - pos.x, bp.y - pos.y, bp.z - pos.z);
    const dist = d.length();
    const k = Math.max(0, 1 - dist / radius);
    d.y += 0.6; d.normalize();
    const ent = owner.entity;
    if (owner.type === 'creature' || owner.type === 'ragdoll') {
      if (hit.has(ent)) {
        if (owner.type === 'ragdoll' && body) body.applyImpulse(d.clone().multiplyScalar(impulse * k * 0.4 * body.mass() / 10), true);
        continue;
      }
      hit.add(ent);
      ent.takeDamage(damage * k, { type, dir: d, point: new THREE.Vector3(bp.x, bp.y, bp.z), impulse: impulse * k * 20, attacker, part: owner.part || 'chest', blast: true });
      if (owner.type === 'ragdoll' && body && !body._removed) body.applyImpulse(d.clone().multiplyScalar(impulse * k * 0.4 * body.mass() / 10), true);
    } else if (owner.type === 'prop' || owner.type === 'vehicle') {
      if (hit.has(ent)) continue; hit.add(ent);
      if (body && body.isDynamic()) body.applyImpulse(d.clone().multiplyScalar(impulse * k * Math.min(body.mass(), 400) * 0.15), true);
      if (body && body.isDynamic()) body.applyTorqueImpulse({ x: (Math.random() - 0.5) * impulse * k, y: 0, z: (Math.random() - 0.5) * impulse * k }, true);
      ent.takeDamage(damage * k, { type, attacker, blast: true, dir: d });
    } else if (owner.type === 'player' && !hit.has('player')) {
      hit.add('player');
      G.player.takeDamage(damage * k * 0.6, { type, dir: d, attacker, impulse: impulse * k });
    }
  }
}

// Melee / NPC attacks: find targets in a short cone in front of an origin.
export function meleeTrace(origin, dir, range, exclude) {
  const offsets = [[0, 0], [0.12, 0], [-0.12, 0], [0, 0.1], [0, -0.12]];
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, dir).normalize();
  let best = null;
  for (const [a, b] of offsets) {
    const d = dir.clone().addScaledVector(right, a).addScaledVector(up, b).normalize();
    const h = raycast(origin, d, range, { excludeBody: exclude, filter: (c, o) => !(o && o.type === 'player' && exclude === G.player?.body) });
    if (h && (!best || (h.owner && h.owner.type !== 'world' && (!best.owner || best.owner.type === 'world')) || h.dist < best.dist - 0.3)) best = h;
  }
  return best;
}

// Impacts between fast bodies and creatures (thrown props, cars, flying ragdolls).
export function initImpactDamage() {
  onImpact((c1, o1, c2, o2, force) => {
    handle(c1, o1, c2, o2);
    handle(c2, o2, c1, o1);
  });
}
const alive = colliderAlive;
function handle(cA, oA, cB, oB) {
  if (!oA || !cA || !cB) return;
  // a previous handler may have removed one of these (e.g. a creature turned into a ragdoll)
  if (!alive(cA) || !alive(cB)) return;
  const victim = oA.entity;
  if ((oA.type === 'creature' || oA.type === 'ragdoll') && victim && !victim.removed) {
    const bodyB = cB.parent(); const bodyA = cA.parent();
    if (!bodyB || !bodyA) return;
    if (oB && oB.entity === victim) return;
    const vb = bodyB.linvel(), va = bodyA.linvel();
    const rel = Math.hypot(vb.x - va.x, vb.y - va.y, vb.z - va.z);
    const massB = bodyB.isDynamic() ? bodyB.mass() : 500;
    if (!oB || oB.type === 'world') {
      // creature slammed into world (falling / thrown)
      if (oA.type === 'ragdoll' && rel > 9) { const point = v(cA.translation()); victim.takeDamage((rel - 9) * 6, { type: 'impact', dir: new THREE.Vector3(0, 1, 0), point, part: oA.part, impulse: 0, silent: rel < 12 }); }
      return;
    }
    const speedB = Math.hypot(vb.x, vb.y, vb.z);
    if (speedB < 5 || massB < 2) return;
    const energy = 0.5 * Math.min(massB, 1500) * rel * rel;
    if (energy < 300) return;
    const now = G.time;
    if (victim._lastImpact && now - victim._lastImpact < 0.25) return;
    victim._lastImpact = now;
    const dmg = Math.min(400, energy / 60);
    const attacker = oB.entity && oB.entity.lastThrower ? oB.entity.lastThrower : (oB.type === 'vehicle' && oB.entity.driver) || null;
    const point = v(cA.translation()); // read before takeDamage, which may remove this collider
    victim.takeDamage(dmg, {
      type: 'impact', dir: new THREE.Vector3(vb.x, vb.y + 2, vb.z).normalize(), point,
      part: oA.part || 'chest', impulse: Math.min(massB, 300) * speedB * 0.4, attacker,
    });
    if (energy > 1500) play('thud', point, Math.min(1.5, energy / 4000));
  }
}
const v = (o) => new THREE.Vector3(o.x, o.y, o.z);
