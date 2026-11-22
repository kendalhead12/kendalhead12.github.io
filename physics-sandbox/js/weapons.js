// Weapon definitions, procedural view models, animation, firing and projectiles.
import * as THREE from 'three';
import { G, emitNoise } from './state.js';
import { settings } from './config.js';
import { raycast, overlapSphere, GROUP, colliderAlive } from './physics.js';
import { applyHit, explosion, meleeTrace } from './combat.js';
import { burst, tracer, flash, beam, ring, shake } from './effects.js';
import { play } from './audio.js';
import { mat } from './render.js';

// ---------- model helpers ----------
function part(g, geo, color, pos, rot, opts) {
  const m = new THREE.Mesh(geo, color && color.isMaterial ? color : mat(color, opts));
  if (pos) m.position.set(...pos); if (rot) m.rotation.set(...rot);
  g.add(m); return m;
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r1, r2, h, s = 14) => new THREE.CylinderGeometry(r1, r2, h, s);
const X = Math.PI / 2;
const GUNMETAL = 0x2a2c30, DARK = 0x1a1a1c, WOOD = 0x6b4426;
const glow = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });

function hand(g, pos, rot) { // gloved hand + forearm
  part(g, B(0.08, 0.09, 0.11), 0xd9a47e, pos, rot);
  const f = part(g, B(0.07, 0.07, 0.2), 0x3b4a5a, [pos[0] + 0.01, pos[1] - 0.05, pos[2] + 0.14], rot);
  return f;
}
function muzzle(g, z, y = 0) { const m = new THREE.Object3D(); m.position.set(0, y, z); g.add(m); g.userData.muzzle = m; }

const MODELS = {
  fists: () => {
    const g = new THREE.Group();
    const L = new THREE.Group(), R = new THREE.Group();
    hand(L, [0, 0, 0]); hand(R, [0, 0, 0]);
    L.position.set(-0.28, -0.05, 0.05); R.position.set(0.02, 0, 0);
    g.add(L, R); g.userData.L = L; g.userData.R = R;
    return g;
  },
  bat: () => { const g = new THREE.Group(); part(g, C(0.022, 0.045, 0.85), 0xc9a06a, [0, 0.38, 0]); part(g, C(0.026, 0.026, 0.03), 0x222222, [0, -0.04, 0]); hand(g, [0, 0, 0.02]); return g; },
  crowbar: () => { const g = new THREE.Group(); part(g, C(0.014, 0.014, 0.75), 0xb02020, [0, 0.33, 0], null, { metalness: 0.6, roughness: 0.4 }); part(g, C(0.014, 0.01, 0.12), 0xb02020, [0, 0.72, 0.05], [0.9, 0, 0], { metalness: 0.6 }); part(g, C(0.014, 0.008, 0.08), 0xb02020, [0, -0.06, 0.03], [-0.6, 0, 0]); hand(g, [0, 0, 0.02]); return g; },
  hammer: () => { const g = new THREE.Group(); part(g, C(0.018, 0.02, 0.5), WOOD, [0, 0.22, 0]); part(g, B(0.06, 0.07, 0.2), 0x777777, [0, 0.47, 0.02], null, { metalness: 0.8, roughness: 0.3 }); hand(g, [0, 0, 0.02]); return g; },
  sword: () => { const g = new THREE.Group(); part(g, B(0.012, 0.85, 0.055), 0xd8dde4, [0, 0.55, 0], null, { metalness: 0.95, roughness: 0.15 }); part(g, B(0.03, 0.03, 0.22), 0xc8a030, [0, 0.12, 0], null, { metalness: 0.8 }); part(g, C(0.018, 0.018, 0.16), 0x3a2010, [0, 0.03, 0]); part(g, new THREE.SphereGeometry(0.025), 0xc8a030, [0, -0.06, 0], null, { metalness: 0.8 }); hand(g, [0, 0.02, 0.02]); return g; },
  pistol: () => { const g = new THREE.Group(); part(g, B(0.045, 0.05, 0.22), GUNMETAL, [0, 0.04, -0.05], null, { metalness: 0.7, roughness: 0.35 }); part(g, B(0.04, 0.12, 0.06), DARK, [0, -0.04, 0.03], [0.25, 0, 0]); part(g, C(0.01, 0.01, 0.04), DARK, [0, 0.045, -0.17], [X, 0, 0]); hand(g, [0, -0.06, 0.06]); muzzle(g, -0.19, 0.045); return g; },
  revolver: () => { const g = new THREE.Group(); part(g, C(0.014, 0.014, 0.24), 0x8a8a90, [0, 0.05, -0.12], [X, 0, 0], { metalness: 0.9, roughness: 0.25 }); part(g, C(0.035, 0.035, 0.06, 6), 0x8a8a90, [0, 0.03, 0.0], [X, 0, 0], { metalness: 0.9, roughness: 0.25 }); part(g, B(0.04, 0.04, 0.12), 0x8a8a90, [0, 0.03, 0.04], null, { metalness: 0.9 }); part(g, B(0.04, 0.12, 0.05), WOOD, [0, -0.05, 0.08], [0.35, 0, 0]); hand(g, [0, -0.07, 0.1]); muzzle(g, -0.25, 0.05); g.userData.drum = g.children[1]; return g; },
  shotgun: () => { const g = new THREE.Group(); part(g, C(0.017, 0.017, 0.75), DARK, [0, 0.03, -0.3], [X, 0, 0], { metalness: 0.7 }); part(g, C(0.015, 0.015, 0.55), DARK, [0, -0.01, -0.22], [X, 0, 0]); g.userData.pump = part(g, B(0.05, 0.05, 0.16), WOOD, [0, -0.01, -0.28]); part(g, B(0.05, 0.07, 0.22), GUNMETAL, [0, 0.01, 0.12], null, { metalness: 0.6 }); part(g, B(0.045, 0.09, 0.3), WOOD, [0, -0.03, 0.36], [-0.12, 0, 0]); hand(g, [0, -0.07, 0.16]); muzzle(g, -0.68, 0.03); return g; },
  rifle: () => { const g = new THREE.Group(); part(g, B(0.05, 0.08, 0.42), GUNMETAL, [0, 0.01, -0.05], null, { metalness: 0.6, roughness: 0.4 }); part(g, C(0.012, 0.012, 0.32), DARK, [0, 0.02, -0.42], [X, 0, 0]); g.userData.mag = part(g, B(0.035, 0.16, 0.07), DARK, [0, -0.1, -0.08], [0.2, 0, 0]); part(g, B(0.045, 0.07, 0.2), DARK, [0, -0.01, 0.27]); part(g, B(0.02, 0.04, 0.16), DARK, [0, 0.07, -0.02]); part(g, B(0.04, 0.1, 0.05), DARK, [0, -0.07, 0.09], [0.3, 0, 0]); hand(g, [0, -0.09, 0.1]); muzzle(g, -0.58, 0.02); return g; },
  sniper: () => { const g = new THREE.Group(); part(g, B(0.05, 0.07, 0.5), 0x3a4a2a, [0, 0.0, 0.0]); part(g, C(0.013, 0.013, 0.6), DARK, [0, 0.01, -0.53], [X, 0, 0], { metalness: 0.7 }); part(g, C(0.025, 0.025, 0.28), DARK, [0, 0.09, -0.02], [X, 0, 0], { metalness: 0.6 }); part(g, C(0.032, 0.032, 0.04), DARK, [0, 0.09, -0.16], [X, 0, 0]); part(g, B(0.045, 0.1, 0.25), 0x3a4a2a, [0, -0.03, 0.33]); g.userData.mag = part(g, B(0.035, 0.08, 0.06), DARK, [0, -0.07, -0.02]); hand(g, [0, -0.08, 0.13]); muzzle(g, -0.83, 0.01); return g; },
  smg: () => { const g = new THREE.Group(); part(g, B(0.05, 0.08, 0.3), DARK, [0, 0.01, -0.03], null, { metalness: 0.5 }); part(g, C(0.012, 0.012, 0.14), DARK, [0, 0.02, -0.24], [X, 0, 0]); g.userData.mag = part(g, B(0.03, 0.2, 0.04), DARK, [0, -0.13, -0.08]); part(g, B(0.03, 0.03, 0.2), GUNMETAL, [0, 0.0, 0.2]); part(g, B(0.04, 0.1, 0.05), DARK, [0, -0.07, 0.06], [0.3, 0, 0]); hand(g, [0, -0.09, 0.08]); muzzle(g, -0.32, 0.02); return g; },
  physgun: () => { const g = new THREE.Group(); part(g, B(0.07, 0.09, 0.36), 0x444a55, [0, 0, 0], null, { metalness: 0.7, roughness: 0.3 }); part(g, C(0.035, 0.05, 0.12), glow(0x3ac8ff, 2.5), [0, 0.01, -0.22], [X, 0, 0]); for (const a of [0, 2.09, 4.19]) part(g, B(0.012, 0.012, 0.14), 0x888888, [Math.cos(a) * 0.05, Math.sin(a) * 0.05, -0.26], null, { metalness: 0.8 }); part(g, C(0.02, 0.02, 0.2), glow(0x3ac8ff, 1.5), [0, 0.06, 0.02], [X, 0, 0]); hand(g, [0, -0.08, 0.1]); muzzle(g, -0.3); return g; },
  gravgun: () => { const g = new THREE.Group(); part(g, B(0.09, 0.1, 0.34), 0xd06a10, [0, 0, 0], null, { metalness: 0.5, roughness: 0.4 }); part(g, C(0.05, 0.06, 0.1), 0x333333, [0, 0, -0.2], [X, 0, 0], { metalness: 0.8 }); g.userData.claws = []; for (const a of [0.5, 2.6, 4.7]) { const c = part(g, B(0.016, 0.016, 0.16), 0x555555, [Math.cos(a) * 0.065, Math.sin(a) * 0.065, -0.29], [0, 0, 0], { metalness: 0.8 }); g.userData.claws.push(c); } part(g, new THREE.SphereGeometry(0.03), glow(0xffa040, 2), [0, 0, -0.24]); hand(g, [0, -0.09, 0.1]); muzzle(g, -0.33); return g; },
  freezeray: () => { const g = new THREE.Group(); part(g, B(0.06, 0.08, 0.3), 0xe8eef2, [0, 0, 0], null, { metalness: 0.4, roughness: 0.3 }); part(g, C(0.045, 0.045, 0.16), new THREE.MeshStandardMaterial({ color: 0x8fe8ff, emissive: 0x3ab8e8, emissiveIntensity: 1.2, transparent: true, opacity: 0.8 }), [0, 0.08, 0.0], [X, 0, 0]); part(g, C(0.02, 0.035, 0.18), 0xb8c8d0, [0, 0, -0.22], [X, 0, 0], { metalness: 0.6 }); part(g, new THREE.SphereGeometry(0.02), glow(0x9af0ff, 3), [0, 0, -0.32]); hand(g, [0, -0.08, 0.08]); muzzle(g, -0.33); return g; },
  energy: () => { const g = new THREE.Group(); part(g, B(0.07, 0.08, 0.32), 0x2a1a3a, [0, 0, 0], null, { metalness: 0.6 }); for (let i = 0; i < 4; i++) part(g, new THREE.TorusGeometry(0.035, 0.008, 6, 14), glow(0xc77dff, 2), [0, 0.01, -0.18 - i * 0.045]); part(g, C(0.014, 0.014, 0.22), 0x555555, [0, 0.01, -0.24], [X, 0, 0]); hand(g, [0, -0.08, 0.08]); muzzle(g, -0.36, 0.01); return g; },
  shockwave: () => { const g = new THREE.Group(); part(g, B(0.1, 0.1, 0.34), 0x505860, [0, 0, 0.02], null, { metalness: 0.6 }); part(g, C(0.12, 0.05, 0.18, 18), 0x707880, [0, 0, -0.24], [X, 0, 0], { metalness: 0.7, roughness: 0.3 }); part(g, C(0.1, 0.1, 0.02, 18), glow(0x6ae8ff, 1.2), [0, 0, -0.33], [X, 0, 0]); part(g, B(0.03, 0.06, 0.2), 0xf0a020, [0, 0.08, 0.0]); hand(g, [0, -0.09, 0.12]); muzzle(g, -0.34); return g; },
  toolgun: () => {
    const g = new THREE.Group(); part(g, B(0.06, 0.09, 0.3), 0x8a8e94, [0, 0, 0], null, { metalness: 0.5, roughness: 0.4 }); part(g, C(0.012, 0.012, 0.16), 0x333333, [0, 0.01, -0.22], [X, 0, 0]);
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = part(g, B(0.005, 0.06, 0.11), new THREE.MeshBasicMaterial({ map: tex }), [-0.034, 0.01, 0.0]);
    g.userData.screen = { canvas: c, tex, mesh: scr };
    hand(g, [0, -0.09, 0.08]); muzzle(g, -0.3, 0.01); return g;
  },
};

// ---------- definitions ----------
export const WEAPONS = [
  { id: 'fists', name: 'Fists', group: 'melee', slot: 1, damage: 10, rate: 2.6, range: 1.7, impulse: 160, sound: 'punch', desc: 'Punch people. They might punch back.' },
  { id: 'bat', name: 'Baseball Bat', group: 'melee', slot: 1, damage: 28, rate: 1.4, range: 2.1, impulse: 520, sound: 'bat', desc: 'Big swings, big knockback.' },
  { id: 'crowbar', name: 'Crowbar', group: 'melee', slot: 1, damage: 24, rate: 2.0, range: 1.9, impulse: 320, sound: 'metal', desc: 'Fast, reliable and iconic-looking.' },
  { id: 'hammer', name: 'Hammer', group: 'melee', slot: 1, damage: 34, rate: 1.2, range: 1.7, impulse: 420, sound: 'thud', desc: 'Short reach, heavy hits.' },
  { id: 'sword', name: 'Sword', group: 'melee', slot: 1, damage: 45, rate: 1.6, range: 2.3, impulse: 260, sound: 'slice', desc: 'Long sharp blade with a wide arc.' },
  { id: 'pistol', name: 'Pistol', group: 'firearm', slot: 2, damage: 22, rate: 6, clip: 15, reserve: 120, spread: 0.012, range: 250, impulse: 90, recoil: 0.025, reloadTime: 1.3, sound: 'pistol', desc: 'Accurate semi-automatic sidearm.' },
  { id: 'revolver', name: 'Revolver', group: 'firearm', slot: 2, damage: 60, rate: 1.6, clip: 6, reserve: 48, spread: 0.006, range: 300, impulse: 260, recoil: 0.07, reloadTime: 2.4, sound: 'revolver', desc: 'Six shots of heavy hitting power.' },
  { id: 'shotgun', name: 'Shotgun', group: 'firearm', slot: 3, damage: 13, pellets: 9, rate: 1.1, clip: 8, reserve: 48, spread: 0.07, range: 60, impulse: 75, recoil: 0.1, reloadTime: 2.6, sound: 'shotgun', desc: 'Pump-action. Devastating up close.' },
  { id: 'smg', name: 'Submachine Gun', group: 'firearm', slot: 3, damage: 14, rate: 13, auto: true, clip: 32, reserve: 256, spread: 0.03, range: 160, impulse: 60, recoil: 0.014, reloadTime: 1.7, sound: 'smg', desc: 'Compact automatic with a high fire rate.' },
  { id: 'rifle', name: 'Assault Rifle', group: 'firearm', slot: 4, damage: 26, rate: 9, auto: true, clip: 30, reserve: 210, spread: 0.016, range: 300, impulse: 110, recoil: 0.02, reloadTime: 2.0, sound: 'rifle', zoomFov: 50, desc: 'Fully automatic all-rounder.' },
  { id: 'sniper', name: 'Sniper Rifle', group: 'firearm', slot: 4, damage: 140, rate: 0.75, clip: 5, reserve: 40, spread: 0.0015, range: 800, impulse: 700, recoil: 0.14, reloadTime: 2.8, sound: 'sniper', zoomFov: 14, scope: true, headMul: 4, desc: 'Right-click to scope. One shot, one ragdoll.' },
  { id: 'physgun', name: 'Physics Gun', group: 'special', slot: 5, desc: 'Hold LMB to grab anything. Scroll to change distance, hold R to rotate, RMB to freeze, R on frozen objects to unfreeze.' },
  { id: 'gravgun', name: 'Gravity Gun', group: 'special', slot: 5, desc: 'RMB pulls and holds objects. LMB launches them with force.' },
  { id: 'freezeray', name: 'Freeze Ray', group: 'special', slot: 6, rate: 8, auto: true, desc: 'Freezes creatures and objects solid for a few seconds.' },
  { id: 'energy', name: 'Energy Blaster', group: 'special', slot: 6, rate: 3.5, clip: 20, reserve: 200, reloadTime: 1.8, auto: true, desc: 'Fires glowing energy bolts that burst on impact.' },
  { id: 'shockwave', name: 'Shockwave Cannon', group: 'special', slot: 6, rate: 0.7, desc: 'LMB blasts a cone of force. RMB sends a ring in every direction.' },
  { id: 'toolgun', name: 'Tool Gun', group: 'tool', slot: 7, desc: 'Uses the tool selected in the spawn menu.' },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export function buildWeaponModel(id) { return MODELS[id] ? MODELS[id]() : new THREE.Group(); }

// ---------- player weapon state ----------
const holder = new THREE.Group();     // sway/bob/recoil root
let model = null;
const W = {
  owned: ['fists', 'crowbar', 'pistol', 'shotgun', 'physgun', 'gravgun', 'toolgun'],
  current: 'physgun',
  ammo: {},
  cooldown: 0, reloading: 0, swing: 0, swingDur: 0, swingSide: 0, draw: 0, kick: 0, aim: 0,
  fireHeld: false, altHeld: false, lastShock: -9,
};
export const weaponState = W;
const projectiles = [];

export function initWeapons() {
  G.vmScene.add(holder);
  for (const w of WEAPONS) if (w.clip) W.ammo[w.id] = { clip: w.clip, reserve: w.reserve };
  equip(W.current, true);
}

export function giveWeapon(id) {
  if (!WEAPON_BY_ID[id]) return;
  if (!W.owned.includes(id)) W.owned.push(id);
  const w = WEAPON_BY_ID[id];
  if (w.clip) W.ammo[id] = { clip: w.clip, reserve: Math.max(W.ammo[id] ? W.ammo[id].reserve : 0, w.reserve) };
  equip(id);
}

export function equip(id, instant = false) {
  if (!W.owned.includes(id)) return;
  if (G.interact) G.interact.releaseHold(false);
  W.current = id;
  if (model) holder.remove(model);
  model = buildWeaponModel(id);
  model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
  holder.add(model);
  W.reloading = 0; W.swing = 0; W.draw = instant ? 0 : 0.35; W.cooldown = 0.25;
  W.def = WEAPON_BY_ID[id];
  const base = BASE[id] || BASE.default;
  model.position.set(...base.pos); model.rotation.set(...base.rot);
  if (id === 'toolgun') updateToolScreen();
  G.ui && G.ui.updateHud();
  play('ui', null, 0.5);
}
const BASE = {
  default: { pos: [0.24, -0.24, -0.66], rot: [0, 0, 0] },
  fists: { pos: [0.18, -0.24, -0.55], rot: [0.15, 0, 0] },
  bat: { pos: [0.3, -0.4, -0.62], rot: [-0.75, 0.1, 0.45] },
  crowbar: { pos: [0.3, -0.38, -0.6], rot: [-0.7, 0.1, 0.4] },
  hammer: { pos: [0.28, -0.36, -0.58], rot: [-0.6, 0.1, 0.35] },
  sword: { pos: [0.3, -0.4, -0.62], rot: [-0.75, 0.1, 0.45] },
  sniper: { pos: [0.24, -0.22, -0.62], rot: [0, 0, 0] },
  shotgun: { pos: [0.24, -0.23, -0.6], rot: [0, 0, 0] },
  rifle: { pos: [0.24, -0.23, -0.6], rot: [0, 0, 0] },
};

export function cycleWeapon(dir) {
  const i = W.owned.indexOf(W.current);
  equip(W.owned[(i + dir + W.owned.length) % W.owned.length]);
}
export function selectSlot(slot) {
  const list = W.owned.filter(id => WEAPON_BY_ID[id].slot === slot);
  if (!list.length) return;
  const i = list.indexOf(W.current);
  equip(list[(i + 1) % list.length]);
}

export function updateToolScreen() {
  if (!model || !model.userData.screen) return;
  const { canvas, tex } = model.userData.screen;
  const x = canvas.getContext('2d');
  x.fillStyle = '#0a1a2a'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#7fe0ff'; x.font = 'bold 18px monospace'; x.textAlign = 'center';
  x.fillText((G.tool && G.tool.name || 'NONE').toUpperCase().slice(0, 11), 64, 38);
  tex.needsUpdate = true;
}

// ---------- firing ----------
function camRay() {
  const origin = G.camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.getWorldQuaternion(new THREE.Quaternion()));
  return { origin, dir };
}
function muzzleWorld() {
  const { origin, dir } = camRay();
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  return origin.clone().addScaledVector(dir, 0.6).addScaledVector(right, W.aim > 0.5 ? 0.02 : 0.16).add(new THREE.Vector3(0, -0.12, 0));
}
const playerFilter = (c, o) => !(o && o.type === 'player');

export function playerTrace(range) {
  const { origin, dir } = camRay();
  return raycast(origin, dir, range, { excludeBody: G.player.body, filter: playerFilter });
}

function fireBullets(def) {
  const { origin, dir } = camRay();
  const n = def.pellets || 1;
  const moving = G.player.speed > 2 ? 1.8 : 1;
  const spread = def.spread * (W.aim > 0.5 ? 0.35 : 1) * moving;
  const from = muzzleWorld();
  for (let i = 0; i < n; i++) {
    const d = dir.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2 * spread, (Math.random() - 0.5) * 2 * spread, (Math.random() - 0.5) * 2 * spread)).normalize();
    const hit = raycast(origin, d, def.range, { excludeBody: G.player.body, filter: playerFilter });
    const end = hit ? hit.point : origin.clone().addScaledVector(d, def.range);
    if (Math.random() < (n > 1 ? 0.4 : 0.8)) tracer(from, end, 0xffe2a0, 1, 0.06, 0.8);
    if (hit) applyHit(hit, { damage: def.damage, dir: d, impulse: def.impulse, attacker: G.player, type: 'bullet', headMul: def.headMul });
  }
  play(def.sound, null, 0.9);
  emitNoise(G.player.position, def.id === 'sniper' ? 120 : 65, 'gunshot', G.player);
  flash(from, 0xffc070, 4, 0.05);
  if (model && model.userData.muzzle) spawnMuzzleFlash();
  W.kick = 1;
  G.player.recoil(def.recoil || 0.02);
}

let mflash = null;
function spawnMuzzleFlash() {
  if (!mflash) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.3, 'rgba(255,190,80,0.9)'); g.addColorStop(1, 'rgba(255,120,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    mflash = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthTest: false }));
    mflash.renderOrder = 99;
  }
  const m = model.userData.muzzle;
  m.add(mflash);
  mflash.scale.setScalar(0.14 + Math.random() * 0.08);
  mflash.material.rotation = Math.random() * 6;
  mflash.visible = true;
  mflash.userData.t = 0.045;
}

function meleeAttack(def) {
  W.swing = 0.0001; W.swingDur = 1 / def.rate; W.swingSide = 1 - W.swingSide;
  W.swingHitDone = false;
  play('swing', null, 0.6);
}
function meleeHit(def) {
  const { origin, dir } = camRay();
  const hit = meleeTrace(origin, dir, def.range, G.player.body);
  if (!hit) return;
  const res = applyHit(hit, { damage: def.damage, dir, impulse: def.impulse, attacker: G.player, type: 'melee', sound: def.sound });
  if (res.kind === 'creature') {
    play(def.sound === 'slice' ? 'slice' : def.sound, hit.point, 1);
    shake(0.08);
  }
  emitNoise(G.player.position, 10, 'melee', G.player);
}

// energy bolts
let boltGeo, boltMat;
function fireEnergy() {
  const { origin, dir } = camRay();
  if (!boltGeo) { boltGeo = new THREE.SphereGeometry(0.09, 10, 8); boltMat = new THREE.MeshBasicMaterial({ color: 0xe0a8ff }); }
  const m = new THREE.Mesh(boltGeo, boltMat);
  const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xa040ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowS.scale.setScalar(0.6); m.add(glowS);
  const from = muzzleWorld();
  m.position.copy(from);
  G.scene.add(m);
  // aim the bolt at what the crosshair points at
  const target = playerTrace(300);
  const aimPt = target ? target.point : origin.clone().addScaledVector(dir, 300);
  const v = aimPt.sub(from).normalize().multiplyScalar(55);
  projectiles.push({ mesh: m, vel: v, life: 4 });
  play('energy', null, 0.8);
  emitNoise(G.player.position, 35, 'gunshot', G.player);
  W.kick = 0.6; G.player.recoil(0.012);
  flash(from, 0xb060ff, 3, 0.08);
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.life -= dt;
    const step = p.vel.length() * dt;
    const dir = p.vel.clone().normalize();
    const hit = raycast(p.mesh.position, dir, step, { excludeBody: G.player.body, filter: playerFilter });
    if (hit || p.life <= 0) {
      const at = hit ? hit.point : p.mesh.position;
      if (hit) applyHit(hit, { damage: 30, dir, impulse: 160, attacker: G.player, type: 'energy' });
      explosion(at, { radius: 2.6, damage: 35, impulse: 16, attacker: G.player, fx: false, sound: null });
      burst('energy', at, 24, hit ? hit.normal : null, 1, 1.2);
      flash(at, 0xb060ff, 10, 0.2, 10);
      ring(at, 0xc080ff, 2.5, 0.3, hit ? hit.normal : undefined);
      play('energyHit', at, 1);
      G.scene.remove(p.mesh);
      projectiles.splice(i, 1);
      continue;
    }
    p.mesh.position.addScaledVector(p.vel, dt);
    if (Math.random() < 0.5) burst('energy', p.mesh.position, 1, null, 0.2, 0.2);
  }
}
export function clearProjectiles() { for (const p of projectiles) G.scene.remove(p.mesh); projectiles.length = 0; }

function shockwaveBlast(cone) {
  const { origin, dir } = camRay();
  const R = cone ? 14 : 9;
  const center = G.player.position.add(new THREE.Vector3(0, 1, 0));
  const seen = new Set();
  for (const { collider, owner } of overlapSphere(center, R)) {
    if (!owner || owner.type === 'world' || owner.type === 'player' || !colliderAlive(collider)) continue;
    const body = collider.parent(); if (!body) continue;
    const bp = body.translation();
    const to = new THREE.Vector3(bp.x - origin.x, bp.y - origin.y, bp.z - origin.z);
    const d = to.length(); to.normalize();
    if (cone && to.dot(dir) < 0.6) continue;
    const k = Math.max(0.15, 1 - d / R);
    const push = (cone ? dir.clone().lerp(to, 0.4) : to.clone().setY(Math.max(to.y, 0.35))).normalize();
    const ent = owner.entity;
    if (owner.type === 'creature' || owner.type === 'ragdoll') {
      if (!seen.has(ent)) { seen.add(ent); ent.takeDamage(12 * k, { type: 'blast', dir: push, impulse: 2500 * k, attacker: G.player, part: owner.part || 'chest', blast: true, point: new THREE.Vector3(bp.x, bp.y, bp.z) }); }
      if (owner.type === 'ragdoll' && !body._removed && body.isDynamic()) body.applyImpulse(push.clone().multiplyScalar(body.mass() * 14 * k), true);
    } else if (body.isDynamic()) {
      body.applyImpulse(push.multiplyScalar(Math.min(body.mass(), 600) * 16 * k), true);
      if (ent && ent.takeDamage) ent.takeDamage(10 * k, { type: 'blast', attacker: G.player });
      if (ent) ent.lastThrower = G.player;
    }
  }
  const p = cone ? origin.clone().addScaledVector(dir, 4) : G.player.position.add(new THREE.Vector3(0, 0.3, 0));
  ring(p, 0x8af0ff, cone ? 4 : R, 0.4, cone ? dir : undefined);
  burst('spark', p, 30, cone ? dir : null, 1.2, 2.5);
  if (!cone) burst('dust', p, 14, null, 1.2, 3);
  play('shockwave', null, 1);
  shake(0.5);
  emitNoise(G.player.position, 50, 'explosion', G.player);
  W.kick = 1.5; G.player.recoil(0.06);
}

function freezeRay() {
  const { origin, dir } = camRay();
  const hit = raycast(origin, dir, 60, { excludeBody: G.player.body, filter: playerFilter });
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, 60);
  beam(muzzleWorld(), end, 0x9af0ff, 0.12, 0.025);
  if (Math.random() < 0.3) play('zap', null, 0.25);
  if (!hit || !hit.owner) return;
  const o = hit.owner;
  burst('ice', hit.point, 3, hit.normal, 0.5);
  if (o.type === 'creature' || o.type === 'ragdoll') {
    const c = o.entity;
    c._freezeCharge = (c._freezeCharge || 0) + 1;
    if (c._freezeCharge >= (c.mass > 200 ? 8 : 3)) { c._freezeCharge = 0; c.freeze(8); }
  } else if (o.type === 'prop' && !o.entity.frozen) {
    o.entity.setFrozen(true); o.entity.thawAt = G.time + 8;
    o.entity.mesh.traverse(m => { if (m.isMesh) { m.userData.prevEmissive = m.material.emissive ? m.material.emissive.getHex() : 0; } });
    play('freeze', hit.point, 0.6);
  }
}

// ---------- per-frame ----------
export function weaponInput(type, down) {
  if (type === 'fire') W.fireHeld = down;
  if (type === 'alt') W.altHeld = down;
  if (down && type === 'fire') tryFire(true);
  if (down && type === 'alt') tryAlt();
}
function canAct() { return G.player && G.player.alive && !G.player.inVehicle && !G.player.possessing && W.draw <= 0; }

function tryFire(pressed) {
  if (!canAct()) return;
  const def = W.def;
  if (G.interact && G.interact.handlesFire(def.id, pressed)) return;
  if (W.cooldown > 0 || W.reloading > 0) return;
  if (!pressed && !def.auto) return;
  if (def.group === 'melee') { meleeAttack(def); W.cooldown = 1 / def.rate; return; }
  if (def.group === 'firearm' || def.id === 'energy') {
    const a = W.ammo[def.id];
    if (a.clip <= 0) { play('empty', null, 0.6); W.cooldown = 0.3; if (a.reserve > 0 || settings.infiniteAmmo) startReload(); return; }
    if (!settings.infiniteAmmo) a.clip--;
    if (def.id === 'energy') fireEnergy(); else fireBullets(def);
    W.cooldown = 1 / def.rate;
    if (def.id === 'shotgun' || def.id === 'sniper' || def.id === 'revolver') W.pumpT = 0.4;
    G.ui && G.ui.updateHud();
    return;
  }
  if (def.id === 'freezeray') { freezeRay(); W.cooldown = 1 / def.rate; return; }
  if (def.id === 'shockwave') { shockwaveBlast(true); W.cooldown = 1 / def.rate; return; }
}
function tryAlt() {
  if (!canAct()) return;
  const def = W.def;
  if (G.interact && G.interact.handlesAlt(def.id)) return;
  if (def.id === 'shockwave' && W.cooldown <= 0) { shockwaveBlast(false); W.cooldown = 1 / def.rate; }
}
export function startReload() {
  const def = W.def;
  if (!def.clip || W.reloading > 0) return;
  const a = W.ammo[def.id];
  if (a.clip >= def.clip || (a.reserve <= 0 && !settings.infiniteAmmo)) return;
  W.reloading = def.reloadTime; W.reloadTotal = def.reloadTime;
  play('reload', null, 0.7);
}
function finishReload() {
  const def = W.def; const a = W.ammo[def.id];
  const need = def.clip - a.clip;
  const take = settings.infiniteAmmo ? need : Math.min(need, a.reserve);
  a.clip += take; if (!settings.infiniteAmmo) a.reserve -= take;
  G.ui && G.ui.updateHud();
}

export function updateWeapons(dt) {
  const def = W.def;
  W.cooldown -= dt; W.draw = Math.max(0, W.draw - dt);
  if (W.reloading > 0) { W.reloading -= dt; if (W.reloading <= 0) { W.reloading = 0; finishReload(); } }
  if (W.fireHeld && def.auto) tryFire(false);
  // melee hit timing
  if (W.swing > 0) {
    W.swing += dt;
    if (!W.swingHitDone && W.swing > W.swingDur * 0.35) { W.swingHitDone = true; meleeHit(def); }
    if (W.swing >= W.swingDur) W.swing = 0;
  }
  // aiming
  const wantAim = W.altHeld && def.group === 'firearm' && W.reloading <= 0 && !G.player.sprinting && canAct();
  W.aim += ((wantAim ? 1 : 0) - W.aim) * Math.min(1, dt * 12);
  G.aimFov = def.zoomFov ? THREE.MathUtils.lerp(settings.fov, def.zoomFov, W.aim) : settings.fov - W.aim * 12;
  G.scoped = def.scope && W.aim > 0.85;
  // thaw frozen props from the freeze ray
  for (const p of G.props) if (p.thawAt && G.time > p.thawAt) { p.thawAt = 0; p.setFrozen(false); burst('ice', p.position, 8, null, 0.8); }
  updateProjectiles(dt);
  animateViewmodel(dt);
}

function animateViewmodel(dt) {
  if (!model) return;
  const pl = G.player;
  const def = W.def;
  const base = BASE[def.id] || BASE.default;
  W.kick = Math.max(0, W.kick - dt * 8);
  const t = G.realTime;
  const bob = pl.onGround ? Math.min(1, pl.speed / 5) : 0;
  const sprint = pl.sprinting && W.swing <= 0 && W.reloading <= 0 ? 1 : 0;
  W.sprintBlend = (W.sprintBlend || 0) + (sprint - (W.sprintBlend || 0)) * Math.min(1, dt * 8);
  const sb = W.sprintBlend;
  holder.position.set(Math.sin(t * 7) * 0.012 * bob - pl.lookDX * 0.0006, -Math.abs(Math.cos(t * 7)) * 0.012 * bob + pl.lookDY * 0.0004 - W.draw * 0.8, 0);
  holder.rotation.set(-sb * 0.5, sb * 0.6, 0);
  const aim = W.aim;
  model.position.set(base.pos[0] * (1 - aim), base.pos[1] * (1 - aim) + aim * -0.12, base.pos[2] + W.kick * 0.06 + aim * 0.05);
  model.rotation.set(base.rot[0] + W.kick * 0.15, base.rot[1], base.rot[2]);
  model.visible = !G.scoped;
  if (W.reloading > 0) {
    const k = 1 - W.reloading / W.reloadTotal;
    const s = Math.sin(k * Math.PI);
    model.rotation.x -= s * 0.6; model.rotation.z += s * 0.5; model.position.y -= s * 0.12;
    if (model.userData.mag) model.userData.mag.position.y = -0.1 - (k > 0.2 && k < 0.6 ? 0.25 : 0);
    if (model.userData.drum) model.userData.drum.rotation.y = k * 12;
  }
  if (W.pumpT > 0 && model.userData.pump) { W.pumpT -= dt; model.userData.pump.position.z = -0.28 + Math.sin((0.4 - W.pumpT) / 0.4 * Math.PI) * 0.1; }
  if (W.swing > 0) {
    const k = W.swing / W.swingDur;
    if (def.id === 'fists') {
      const arm = W.swingSide ? model.userData.L : model.userData.R;
      const e = k < 0.35 ? k / 0.35 : Math.max(0, 1 - (k - 0.35) / 0.65);
      arm.position.z = -e * 0.32; arm.position.y = (W.swingSide ? -0.05 : 0) + e * 0.05;
    } else {
      // diagonal swing from upper right to lower left
      const e = k < 0.3 ? -k / 0.3 : (k < 0.55 ? -1 + (k - 0.3) / 0.25 * 2.2 : 1.2 * (1 - (k - 0.55) / 0.45));
      model.rotation.x = base.rot[0] - Math.max(0, e) * 0.9 + Math.min(0, e) * 0.5;
      model.rotation.z = base.rot[2] + e * 0.5;
      model.rotation.y = base.rot[1] + e * 0.35;
      model.position.x = base.pos[0] - Math.max(0, e) * 0.22;
      model.position.y = base.pos[1] - Math.min(0, e) * 0.06;
    }
  } else if (def.id === 'fists') {
    model.userData.L.position.z = 0.05; model.userData.R.position.z = 0;
  }
  if (model.userData.claws) {
    const open = G.interact && G.interact.hold ? 0.5 : 0.15;
    model.userData.claws.forEach((c, i) => { c.rotation.x = open * (i === 0 ? 1 : 1); });
  }
  if (mflash && mflash.visible) { mflash.userData.t -= dt; if (mflash.userData.t <= 0) mflash.visible = false; }
}
