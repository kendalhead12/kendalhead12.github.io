// Rapier world wrapper: bodies, collider ownership, raycasts, fixed-step simulation, impact events.
import * as THREE from 'three';
import RAPIER from 'rapier';
import { G } from './state.js';
import { settings, onSettingsChange } from './config.js';

export const GROUP = { WORLD: 1, PLAYER: 2, CREATURE: 4, RAGDOLL: 8, PROP: 16, VEHICLE: 32, DEBRIS: 64 };
export const ALL = 0xffff;
export function groups(member, filter = ALL) { return (member << 16) | filter; }

const owners = new Map(); // collider handle -> owner info {type, entity, part}
let eventQueue = null;
let accumulator = 0;
export const FIXED_DT = 1 / 60;
const impactHandlers = [];

export async function initPhysics() {
  await RAPIER.init();
  G.RAPIER = RAPIER;
}

export function createWorld() {
  if (G.world) { G.world.free(); owners.clear(); }
  G.world = new RAPIER.World({ x: 0, y: -settings.gravity, z: 0 });
  G.world.timestep = FIXED_DT;
  eventQueue = new RAPIER.EventQueue(true);
  accumulator = 0;
  return G.world;
}

onSettingsChange((k, v) => {
  if (k === 'gravity' && G.world) {
    G.world.gravity = { x: 0, y: -v, z: 0 };
    G.world.bodies.forEach(b => b.wakeUp());
  }
});

export function setOwner(collider, owner) { owners.set(collider.handle, owner); }
export function getOwner(collider) { return collider ? owners.get(collider.handle) : null; }

export function createBody(desc, colliderDescs, owner) {
  const body = G.world.createRigidBody(desc);
  for (const cd of colliderDescs) {
    const c = G.world.createCollider(cd, body);
    if (owner) owners.set(c.handle, owner);
  }
  return body;
}

export function createStaticCollider(desc, owner = { type: 'world' }) {
  const c = G.world.createCollider(desc);
  owners.set(c.handle, owner);
  return c;
}

export function removeBody(body) {
  if (!body || !G.world || body._removed) return;
  body._removed = true;
  // joints attached to this body disappear with it
  if (G.welds.length) G.welds = G.welds.filter(w => w.b1 !== body && w.b2 !== body);
  const n = body.numColliders();
  for (let i = 0; i < n; i++) owners.delete(body.collider(i).handle);
  G.world.removeRigidBody(body);
}

export function bodyAlive(body) {
  try { return !!body && !body._removed && G.world.bodies.contains(body.handle); }
  catch (e) { return false; }
}

const _ray = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 0 } };
// Returns {point: Vector3, normal: Vector3, dist, collider, owner} or null
export function raycast(origin, dir, maxDist, opts = {}) {
  const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
  const f = opts.filter;
  const hit = G.world.castRayAndGetNormal(ray, maxDist, true, undefined, opts.groups, undefined, opts.excludeBody,
    f ? (c) => { try { return !!f(c, owners.get(c.handle)); } catch (e) { return false; } } : undefined);
  if (!hit) return null;
  const t = hit.timeOfImpact;
  return {
    point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t),
    normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    dist: t,
    collider: hit.collider,
    owner: owners.get(hit.collider.handle) || null,
  };
}

// All colliders intersecting a sphere -> unique owners list with body
export function overlapSphere(center, radius, filter) {
  const out = [];
  const shape = new RAPIER.Ball(radius);
  const hits = [];
  G.world.intersectionsWithShape({ x: center.x, y: center.y, z: center.z }, { x: 0, y: 0, z: 0, w: 1 }, shape, (c) => { hits.push(c); return true; });
  for (const c of hits) {
    const o = owners.get(c.handle);
    if (!filter || filter(c, o)) out.push({ collider: c, owner: o });
  }
  return out;
}

// true if the collider (and its body) still exist — check before touching anything returned by an earlier query
export function colliderAlive(c) {
  if (!c || !G.world.getCollider(c.handle)) return false;
  const b = c.parent();
  return !b || (!b._removed && G.world.bodies.contains(b.handle));
}

export function onImpact(fn) { impactHandlers.push(fn); }

// Advance physics with a fixed step; `simDt` already includes game speed.
export function stepPhysics(simDt, preStep) {
  if (!G.world) return 0;
  accumulator += simDt;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 4) {
    if (preStep) preStep(FIXED_DT);
    G.world.step(eventQueue);
    accumulator -= FIXED_DT;
    steps++;
    // collect first, act afterwards: never call into Rapier from inside its callbacks
    const evs = [];
    eventQueue.drainContactForceEvents((ev) => { evs.push([ev.collider1(), ev.collider2(), ev.totalForceMagnitude()]); });
    for (const [h1, h2, f] of evs) {
      const c1 = G.world.getCollider(h1), c2 = G.world.getCollider(h2);
      if (!c1 || !c2) continue;
      const o1 = owners.get(h1), o2 = owners.get(h2);
      for (const h of impactHandlers) { try { h(c1, o1, c2, o2, f); } catch (e) { console.warn(e); } }
    }
  }
  if (accumulator > FIXED_DT * 4) accumulator = 0;
  return steps;
}

export const tmpV = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export function syncMesh(mesh, body) {
  const t = body.translation(), r = body.rotation();
  mesh.position.set(t.x, t.y, t.z);
  mesh.quaternion.set(r.x, r.y, r.z, r.w);
}
export function v3(o) { return new THREE.Vector3(o.x, o.y, o.z); }
