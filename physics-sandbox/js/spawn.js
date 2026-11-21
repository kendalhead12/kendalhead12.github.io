// Spawn catalog, spawning, undo, clearing, save/load and thumbnails.
import * as THREE from 'three';
import { G } from './state.js';
import { settings } from './config.js';
import { CREATURES, CREATURE_BY_ID } from './creatures/defs.js';
import { livingCount, cleanupCorpses } from './creatures/creature.js';
import { PROPS, PROP_BY_ID, Prop, spawnBrickWall, weldBodies, removeWeld } from './props.js';
import { VEHICLES, VEHICLE_BY_ID, Vehicle, buildVehicleMesh } from './vehicles.js';
import { WEAPONS, giveWeapon, buildWeaponModel } from './weapons.js';
import { TOOLS, selectTool, placeSpawner } from './interact.js';
import { play } from './audio.js';
import { ring, burst } from './effects.js';

export const CATEGORIES = ['Humans', 'Zombies', 'Monsters', 'Weapons', 'Props', 'Vehicles', 'Tools'];

export const CATALOG = [
  ...CREATURES.map(c => ({ type: 'creature', id: c.id, name: c.name, desc: c.desc, category: c.category, def: c })),
  ...WEAPONS.map(w => ({ type: 'weapon', id: w.id, name: w.name, desc: w.desc, category: 'Weapons', def: w })),
  ...PROPS.filter(p => !p.hidden).map(p => ({ type: 'prop', id: p.id, name: p.name, desc: p.desc, category: 'Props', def: p })),
  ...VEHICLES.map(v => ({ type: 'vehicle', id: v.id, name: v.name, desc: v.desc, category: 'Vehicles', def: v })),
  ...TOOLS.map(t => ({ type: 'tool', id: t.id, name: t.name, desc: t.desc, category: 'Tools', def: t })),
];

export function spawnCreatureById(id, pos, opts = {}) {
  const def = CREATURE_BY_ID[id]; if (!def) return null;
  if (livingCount() >= settings.populationLimit) { if (!opts.quiet) G.ui.toast(`NPC population limit reached (${settings.populationLimit})`); return null; }
  const c = new def.cls(def, pos, opts);
  cleanupCorpses();
  if (!opts.noUndo) G.undoStack.push({ type: 'spawn', entity: c });
  return c;
}

// Spawn the selected catalog item at a world point (from crosshair raycast)
export function spawnItem(item, point, normal, yaw) {
  let ent = null;
  const up = normal && normal.y > 0.5;
  const p = point.clone();
  if (item.type === 'creature') {
    ent = spawnCreatureById(item.id, p.add(new THREE.Vector3(0, 0.05, 0)), { yaw });
  } else if (item.type === 'prop') {
    if (item.id === 'brickwall') {
      const bricks = spawnBrickWall(p, yaw, 7, 8, false);
      G.undoStack.push({ type: 'group', entities: bricks });
      play('spawn', p, 0.6); ring(p.clone().add(new THREE.Vector3(0, 0.05, 0)), 0x7fe0ff, 1.5, 0.35);
      return bricks[0];
    }
    const tmp = item.def.build();
    const box = new THREE.Box3().setFromObject(tmp.mesh);
    const h = box.max.y - box.min.y;
    const pos = up ? p.add(new THREE.Vector3(0, -box.min.y + 0.02, 0)) : p.addScaledVector(normal || new THREE.Vector3(0, 1, 0), Math.max(h, box.max.x - box.min.x) * 0.6);
    void h;
    ent = new Prop(item.def, pos, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), { fixed: !!item.def.startFrozen });
    G.undoStack.push({ type: 'spawn', entity: ent });
  } else if (item.type === 'vehicle') {
    ent = new Vehicle(item.def, p, yaw);
    G.undoStack.push({ type: 'spawn', entity: ent });
  }
  if (ent) {
    play('spawn', point, 0.6);
    ring(point.clone().add(new THREE.Vector3(0, 0.05, 0)), 0x7fe0ff, 1.2, 0.35);
  }
  return ent;
}

export function activateItem(item) {
  if (item.type === 'weapon') { giveWeapon(item.id); G.ui.toast(`${item.name} added to your inventory`); return 'close'; }
  if (item.type === 'tool') { selectTool(item.id); return item.def.panel ? 'keep' : 'close'; }
  G.spawnSelection = item;
  G.ui.toast(`Selected ${item.name}: left-click to place, right-click to stop. Hold Q to reopen.`, 3);
  return 'close';
}

export function undo() {
  while (G.undoStack.length) {
    const a = G.undoStack.pop();
    if (a.type === 'spawn') { if (a.entity.removed) continue; a.entity.remove(); }
    else if (a.type === 'group') { const live = a.entities.filter(e => !e.removed); if (!live.length) continue; live.forEach(e => e.remove()); }
    else if (a.type === 'weld') { if (!G.welds.includes(a.weld)) continue; removeWeld(a.weld); }
    play('remove', null, 0.6);
    G.ui.toast('Undone');
    return;
  }
  G.ui.toast('Nothing to undo');
}

export function clearCreatures(deadOnly = false) {
  for (const c of [...G.creatures]) if (!deadOnly || !c.alive) c.remove();
}
export function clearProps() { for (const p of [...G.props]) p.remove(); for (const v of [...G.vehicles]) v.remove(); }
export function clearSpawners() { for (const s of [...G.spawners]) s.remove(); }
export function freezeAll() {
  for (const p of G.props) if (!p.frozen) p.setFrozen(true);
  for (const c of G.creatures) if (c.ragdoll && !c.ragdoll.frozen) c.freeze(1e9, false);
  G.ui.toast('Froze all props and ragdolls');
}

// ---------- save / load ----------
const SKEY = 'chaosSandbox.saves.v1';
export function listSaves() { try { return JSON.parse(localStorage.getItem(SKEY) || '{}'); } catch (e) { return {}; } }
export function serialize() {
  const v = (b) => { const t = b.translation(); return [+t.x.toFixed(3), +t.y.toFixed(3), +t.z.toFixed(3)]; };
  const q = (b) => { const r = b.rotation(); return [+r.x.toFixed(4), +r.y.toFixed(4), +r.z.toFixed(4), +r.w.toFixed(4)]; };
  const bodies = [];
  const data = { map: G.mapId, time: Date.now(), props: [], vehicles: [], creatures: [], spawners: [], welds: [] };
  for (const p of G.props) { if (p.def.debris) continue; data.props.push({ id: p.defId, p: v(p.body), q: q(p.body), f: p.frozen ? 1 : 0, s: p.mesh.scale.x !== 1 ? [p.mesh.scale.x, p.mesh.scale.y, p.mesh.scale.z] : undefined }); bodies.push(p.body); }
  for (const c of G.vehicles) { data.vehicles.push({ id: c.defId, p: v(c.body), q: q(c.body), f: c.body.isDynamic() ? 0 : 1 }); bodies.push(c.body); }
  for (const c of G.creatures) {
    if (!c.alive) continue;
    const pos = c.position;
    data.creatures.push({ id: c.defId, p: [pos.x, pos.y, pos.z], yaw: c.yaw, h: c.health, mh: c.maxHealth, ap: c.rig.spec.appearanceSeed ? undefined : undefined });
  }
  for (const s of G.spawners) data.spawners.push({ p: [s.pos.x, s.pos.y, s.pos.z], c: s.creature, i: s.interval, m: s.max });
  for (const w of G.welds) { const a = bodies.indexOf(w.b1), b = bodies.indexOf(w.b2); if (a >= 0 && b >= 0) data.welds.push([a, b]); }
  return data;
}
export function saveGame(name) {
  const all = listSaves();
  all[name] = serialize();
  try { localStorage.setItem(SKEY, JSON.stringify(all)); G.ui.toast(`Saved "${name}"`); return true; }
  catch (e) { G.ui.toast('Could not save (storage full or blocked)'); return false; }
}
export function deleteSave(name) { const all = listSaves(); delete all[name]; try { localStorage.setItem(SKEY, JSON.stringify(all)); } catch (e) {} }
export async function loadGame(name, loadMapFn) {
  const data = listSaves()[name]; if (!data) return;
  await loadMapFn(data.map, { skipInitial: true });
  applySave(data);
  G.ui.toast(`Loaded "${name}"`);
}
export function applySave(data) {
  const bodies = [];
  for (const p of data.props) {
    const def = PROP_BY_ID[p.id]; if (!def) continue;
    const pr = new Prop(def, new THREE.Vector3(...p.p), new THREE.Quaternion(...p.q), { fixed: !!p.f });
    if (p.s) pr.mesh.scale.set(...p.s);
    bodies.push(pr.body);
  }
  for (const v of data.vehicles) {
    const def = VEHICLE_BY_ID[v.id]; if (!def) continue;
    const veh = new Vehicle(def, new THREE.Vector3(...v.p).add(new THREE.Vector3(0, -def.clearance - def.size[1] / 2 - 0.2, 0)), 0);
    veh.body.setRotation({ x: v.q[0], y: v.q[1], z: v.q[2], w: v.q[3] }, true);
    if (v.f) veh.body.setBodyType(G.RAPIER.RigidBodyType.Fixed, true);
    bodies.push(veh.body);
  }
  for (const c of data.creatures) {
    const cr = spawnCreatureById(c.id, new THREE.Vector3(...c.p), { yaw: c.yaw, health: c.h, maxHealth: c.mh, quiet: true, noUndo: true });
    void cr;
  }
  for (const s of data.spawners || []) placeSpawner(new THREE.Vector3(...s.p), { creature: s.c, interval: s.i, max: s.m });
  for (const [a, b] of data.welds || []) if (bodies[a] && bodies[b]) weldBodies(bodies[a], bodies[b]);
  G.undoStack.length = 0;
}

// ---------- thumbnails ----------
let thumbRenderer = null, thumbScene, thumbCam;
const thumbCache = {};
export function thumbnail(item) {
  const key = item.type + ':' + item.id;
  if (thumbCache[key]) return thumbCache[key];
  if (item.type === 'tool') return (thumbCache[key] = toolIcon(item));
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(128, 128);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
    const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 3, 4); thumbScene.add(d);
    thumbCam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  }
  let obj;
  try {
    if (item.type === 'creature') { obj = item.def.buildRig({}).root; obj.rotation.y = 0.5; }
    else if (item.type === 'prop') obj = item.id === 'brickwall' ? brickwallPreview() : item.def.build().mesh;
    else if (item.type === 'vehicle') { obj = buildVehicleMesh(item.def).mesh; obj.rotation.y = 0.8; }
    else if (item.type === 'weapon') { obj = buildWeaponModel(item.id); obj.rotation.set(0.2, -1.2, 0); }
  } catch (e) { obj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x888888 })); }
  const g = new THREE.Group(); g.add(obj); thumbScene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) || 1;
  const k = item.type === 'creature' ? 0.72 : 1;
  thumbCam.position.set(c.x + r * 0.9 * k, c.y + r * 0.45 * k, c.z + r * 1.9 * k);
  thumbCam.lookAt(c);
  thumbRenderer.clear();
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(g);
  return (thumbCache[key] = url);
}
function brickwallPreview() {
  const g = new THREE.Group();
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xa14a32 }));
    b.position.set(c * 0.41 + (r % 2) * 0.2, r * 0.205, 0); g.add(b);
  }
  return g;
}
function toolIcon(item) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#20384e'); g.addColorStop(1, '#0e1a26');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const glyph = { remover: '✖', weld: '⛓', freeze: '❄', health: '✚', possess: '◉', spawner: '⟳', camera: '🎥', time: '⏱', factions: '⚑' }[item.id] || '?';
  x.fillStyle = '#7fe0ff'; x.font = '64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(glyph, 64, 66);
  return c.toDataURL();
}
export { burst };
