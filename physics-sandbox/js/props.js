// Physics props: crates, barrels, furniture, breakables, explosives and building pieces.
import * as THREE from 'three';
import { G, newId } from './state.js';
import { createBody, removeBody, groups, GROUP, syncMesh } from './physics.js';
import { mat, canvasTexture, noiseFill } from './render.js';
import { burst, flash } from './effects.js';
import { play } from './audio.js';

// ---- textures ----
const woodTex = () => canvasTexture('wood', 128, 128, (x, w, h) => {
  noiseFill(x, w, h, '#a4743e', 0.12, 1200, 2);
  x.strokeStyle = 'rgba(70,40,15,0.35)'; x.lineWidth = 2;
  for (let i = 0; i < 9; i++) { x.beginPath(); const y = i * 15 + Math.random() * 6; x.moveTo(0, y); x.bezierCurveTo(40, y + 5, 80, y - 5, 128, y + 2); x.stroke(); }
  x.strokeStyle = 'rgba(50,30,10,0.8)'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 120);
  x.beginPath(); x.moveTo(8, 8); x.lineTo(120, 120); x.stroke();
});
const plankTex = () => canvasTexture('plank', 64, 256, (x, w, h) => {
  noiseFill(x, w, h, '#a87a46', 0.12, 800, 2);
  x.strokeStyle = 'rgba(70,40,15,0.4)'; x.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) { x.beginPath(); const xx = i * 11 + 4; x.moveTo(xx, 0); x.bezierCurveTo(xx + 4, 80, xx - 4, 170, xx, 256); x.stroke(); }
});
const metalTex = (c, k) => canvasTexture('metal' + k, 128, 128, (x, w, h) => {
  noiseFill(x, w, h, c, 0.1, 1500, 2);
  x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 3; i++) x.fillRect(0, 18 + i * 44, w, 6);
});
const cardboardTex = () => canvasTexture('cardboard', 128, 128, (x, w, h) => {
  noiseFill(x, w, h, '#c49a6a', 0.08, 900, 2);
  x.fillStyle = 'rgba(120,80,40,0.5)'; x.fillRect(0, 58, w, 12);
  x.fillStyle = 'rgba(40,30,20,0.6)'; x.font = 'bold 18px sans-serif'; x.fillText('THIS SIDE UP', 10, 30); x.fillText('↑ ↑', 46, 110);
});
const concreteTex = () => canvasTexture('concrete', 128, 128, (x, w, h) => { noiseFill(x, w, h, '#9a9a96', 0.15, 3000, 2); });
const brickTex = () => canvasTexture('brick', 128, 64, (x, w, h) => {
  noiseFill(x, w, h, '#a14a32', 0.15, 900, 2);
  x.fillStyle = '#d8d0c0'; x.fillRect(0, 0, w, 3); x.fillRect(0, h - 3, w, 3); x.fillRect(0, 0, 3, h); x.fillRect(w - 3, 0, 3, h);
});
const hazardTex = () => canvasTexture('hazard', 128, 128, (x, w, h) => {
  x.fillStyle = '#c0281e'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#f2d21c'; x.fillRect(0, 44, w, 40);
  x.fillStyle = '#111'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('☢ TNT', 64, 76);
});

// ---- geometry builders. Each returns {mesh, colliders:[ColliderDesc], mass} ----
const R = () => G.RAPIER;
function boxProp(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  return { mesh, colliders: [R().ColliderDesc.cuboid(w / 2, h / 2, d / 2)] };
}
function cylProp(r, h, material, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  return { mesh, colliders: [R().ColliderDesc.cylinder(h / 2, r)] };
}
function group(parts) {
  const g = new THREE.Group();
  const colliders = [];
  for (const p of parts) {
    const m = new THREE.Mesh(p.geo, p.mat);
    m.position.set(...(p.pos || [0, 0, 0])); if (p.rot) m.rotation.set(...p.rot);
    g.add(m);
    if (p.col) {
      const c = p.col();
      c.setTranslation(...(p.pos || [0, 0, 0]));
      if (p.rot) { const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot)); c.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }); }
      colliders.push(c);
    }
  }
  return { mesh: g, colliders };
}

export const PROPS = [
  { id: 'crate', name: 'Wooden Crate', desc: 'A sturdy crate. Breaks into planks.', mass: 25, material: 'wood', health: 60, breakInto: 'planks',
    build: () => boxProp(0.9, 0.9, 0.9, mat(0xffffff, { map: woodTex() })) },
  { id: 'crate_small', name: 'Small Crate', desc: 'Light and stackable.', mass: 10, material: 'wood', health: 35, breakInto: 'planks',
    build: () => boxProp(0.55, 0.55, 0.55, mat(0xffffff, { map: woodTex() })) },
  { id: 'cardboard', name: 'Cardboard Box', desc: 'Very light. Crumples easily.', mass: 3, material: 'soft', health: 15, breakInto: 'dust',
    build: () => boxProp(0.6, 0.45, 0.5, mat(0xffffff, { map: cardboardTex() })) },
  { id: 'barrel', name: 'Metal Barrel', desc: 'A rolling steel drum.', mass: 40, material: 'metal', health: 400,
    build: () => cylProp(0.32, 0.95, mat(0xffffff, { map: metalTex('#2f6a9a', 'b'), metalness: 0.5, roughness: 0.5 })) },
  { id: 'explosive', name: 'Explosive Barrel', desc: 'Handle with care. Explodes when damaged.', mass: 35, material: 'metal', health: 25, explosive: true,
    build: () => cylProp(0.32, 0.95, mat(0xffffff, { map: hazardTex(), metalness: 0.3, roughness: 0.5 })) },
  { id: 'oildrum', name: 'Rusty Drum', desc: 'An old, heavy oil drum.', mass: 60, material: 'metal', health: 500,
    build: () => cylProp(0.34, 1.0, mat(0xffffff, { map: metalTex('#7a4a2a', 'r'), metalness: 0.4, roughness: 0.8 })) },
  { id: 'concrete', name: 'Concrete Block', desc: 'Very heavy. Great for crushing things.', mass: 400, material: 'stone', health: 2000,
    build: () => boxProp(1, 0.8, 1, mat(0xffffff, { map: concreteTex(), roughness: 0.95 })) },
  { id: 'plank', name: 'Wooden Plank', desc: 'A long board for ramps and seesaws.', mass: 8, material: 'wood', health: 40, breakInto: 'dust',
    build: () => boxProp(0.3, 0.06, 2.4, mat(0xffffff, { map: plankTex() })) },
  { id: 'beam', name: 'Steel Beam', desc: 'A long, heavy I-beam for building.', mass: 150, material: 'metal', health: 5000,
    build: () => group([
      { geo: new THREE.BoxGeometry(0.3, 0.04, 4), mat: mat(0x8a5a3a, { metalness: 0.6, roughness: 0.6 }), pos: [0, 0.13, 0], col: () => R().ColliderDesc.cuboid(0.15, 0.02, 2) },
      { geo: new THREE.BoxGeometry(0.3, 0.04, 4), mat: mat(0x8a5a3a, { metalness: 0.6, roughness: 0.6 }), pos: [0, -0.13, 0], col: () => R().ColliderDesc.cuboid(0.15, 0.02, 2) },
      { geo: new THREE.BoxGeometry(0.04, 0.26, 4), mat: mat(0x8a5a3a, { metalness: 0.6, roughness: 0.6 }), pos: [0, 0, 0], col: () => R().ColliderDesc.cuboid(0.02, 0.13, 2) },
    ]) },
  { id: 'cone', name: 'Traffic Cone', desc: 'Orange and slightly bouncy.', mass: 2, material: 'soft', health: 9999,
    build: () => {
      const g = new THREE.Group();
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.6, 16), mat(0xff6a00, { roughness: 0.5 })); c.position.y = 0.04; g.add(c);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.07, 16), mat(0xffffff)); s.position.y = 0.02; g.add(s);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), mat(0xff6a00)); b.position.y = -0.27; g.add(b);
      return { mesh: g, colliders: [R().ColliderDesc.cone(0.3, 0.19)] };
    } },
  { id: 'tire', name: 'Tire', desc: 'Rolls and bounces.', mass: 12, material: 'soft', health: 9999, restitution: 0.5,
    build: () => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 22), mat(0x1c1c1c, { roughness: 0.9 }));
      mesh.rotation.y = Math.PI / 2;
      const g = new THREE.Group(); g.add(mesh);
      return { mesh: g, colliders: [R().ColliderDesc.cylinder(0.13, 0.43).setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })] };
    } },
  { id: 'ball', name: 'Beach Ball', desc: 'Light and very bouncy.', mass: 0.5, material: 'soft', health: 9999, restitution: 0.85,
    build: () => {
      const tex = canvasTexture('beachball', 256, 128, (x, w, h) => { const c = ['#e83a3a', '#ffffff', '#3a7ae8', '#ffd21c', '#ffffff', '#3ac85a']; for (let i = 0; i < 6; i++) { x.fillStyle = c[i]; x.fillRect(i * w / 6, 0, w / 6 + 1, h); } });
      return { mesh: new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), mat(0xffffff, { map: tex, roughness: 0.3 })), colliders: [R().ColliderDesc.ball(0.4)] };
    } },
  { id: 'bowling', name: 'Bowling Ball', desc: 'Small and extremely heavy.', mass: 7, material: 'stone', health: 99999,
    build: () => ({ mesh: new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), mat(0x2a1a6a, { roughness: 0.15, metalness: 0.2 })), colliders: [R().ColliderDesc.ball(0.11)] }) },
  { id: 'melon', name: 'Watermelon', desc: 'Splatters into pieces when it breaks.', mass: 6, material: 'soft', health: 12, breakInto: 'melon',
    build: () => {
      const tex = canvasTexture('melon', 128, 64, (x, w, h) => { x.fillStyle = '#2f7d2f'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d5a1d'; for (let i = 0; i < 10; i++) x.fillRect(i * 13, 0, 5, h); });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), mat(0xffffff, { map: tex, roughness: 0.4 })); m.scale.set(1, 0.85, 1.3);
      const g = new THREE.Group(); g.add(m);
      return { mesh: g, colliders: [R().ColliderDesc.capsule(0.06, 0.18).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 })] };
    } },
  { id: 'glass', name: 'Glass Pane', desc: 'A window pane that shatters into shards.', mass: 15, material: 'glass', health: 8, breakInto: 'shards',
    build: () => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0 }));
      g.add(p);
      const fr = mat(0x5a5a5a, { metalness: 0.6 });
      for (const [x, y, w, h] of [[0, 0.82, 1.68, 0.06], [0, -0.82, 1.68, 0.06], [0.82, 0, 0.06, 1.68], [-0.82, 0, 0.06, 1.68]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), fr); b.position.set(x, y, 0); g.add(b); }
      return { mesh: g, colliders: [R().ColliderDesc.cuboid(0.84, 0.84, 0.035)] };
    } },
  { id: 'brickwall', name: 'Brick Wall', desc: 'A wall of loose bricks you can knock down.', mass: 0, material: 'stone', compound: 'brickwall' },
  { id: 'table', name: 'Table', desc: 'A wooden table.', mass: 20, material: 'wood', health: 90, breakInto: 'planks',
    build: () => {
      const wm = mat(0xffffff, { map: plankTex() });
      const parts = [{ geo: new THREE.BoxGeometry(1.4, 0.06, 0.8), mat: wm, pos: [0, 0.37, 0], col: () => R().ColliderDesc.cuboid(0.7, 0.03, 0.4) }];
      for (const [x, z] of [[0.62, 0.32], [-0.62, 0.32], [0.62, -0.32], [-0.62, -0.32]]) parts.push({ geo: new THREE.BoxGeometry(0.06, 0.72, 0.06), mat: wm, pos: [x, 0, z], col: () => R().ColliderDesc.cuboid(0.03, 0.36, 0.03) });
      return group(parts);
    } },
  { id: 'chair', name: 'Chair', desc: 'A simple wooden chair.', mass: 6, material: 'wood', health: 40, breakInto: 'planks',
    build: () => {
      const wm = mat(0xffffff, { map: plankTex() });
      const parts = [
        { geo: new THREE.BoxGeometry(0.45, 0.05, 0.45), mat: wm, pos: [0, 0, 0], col: () => R().ColliderDesc.cuboid(0.225, 0.025, 0.225) },
        { geo: new THREE.BoxGeometry(0.45, 0.5, 0.05), mat: wm, pos: [0, 0.27, -0.2], col: () => R().ColliderDesc.cuboid(0.225, 0.25, 0.025) },
      ];
      for (const [x, z] of [[0.19, 0.19], [-0.19, 0.19], [0.19, -0.19], [-0.19, -0.19]]) parts.push({ geo: new THREE.BoxGeometry(0.05, 0.45, 0.05), mat: wm, pos: [x, -0.24, z], col: () => R().ColliderDesc.cuboid(0.025, 0.225, 0.025) });
      return group(parts);
    } },
  { id: 'sofa', name: 'Sofa', desc: 'A comfy, heavy couch.', mass: 60, material: 'soft', health: 300,
    build: () => {
      const f = mat(0x7a3a3a, { roughness: 0.95 });
      return group([
        { geo: new THREE.BoxGeometry(2, 0.4, 0.9), mat: f, pos: [0, -0.1, 0], col: () => R().ColliderDesc.cuboid(1, 0.2, 0.45) },
        { geo: new THREE.BoxGeometry(2, 0.6, 0.25), mat: f, pos: [0, 0.3, -0.33], col: () => R().ColliderDesc.cuboid(1, 0.3, 0.125) },
        { geo: new THREE.BoxGeometry(0.22, 0.45, 0.9), mat: f, pos: [0.9, 0.2, 0], col: () => R().ColliderDesc.cuboid(0.11, 0.225, 0.45) },
        { geo: new THREE.BoxGeometry(0.22, 0.45, 0.9), mat: f, pos: [-0.9, 0.2, 0], col: () => R().ColliderDesc.cuboid(0.11, 0.225, 0.45) },
      ]);
    } },
  { id: 'dumpster', name: 'Dumpster', desc: 'A big, heavy metal bin.', mass: 500, material: 'metal', health: 99999,
    build: () => boxProp(2.0, 1.3, 1.2, mat(0xffffff, { map: metalTex('#2a6a3a', 'g'), metalness: 0.5, roughness: 0.6 })) },
  { id: 'ramp', name: 'Ramp', desc: 'A wedge for launching things (and vehicles).', mass: 300, material: 'wood', health: 99999, startFrozen: true,
    build: () => {
      const pts = [[-1.5, -0.6, -2], [1.5, -0.6, -2], [-1.5, -0.6, 2], [1.5, -0.6, 2], [-1.5, 0.9, 2], [1.5, 0.9, 2]];
      const geo = new THREE.BufferGeometry();
      const v = [];
      const tri = (a, b, c) => v.push(...pts[a], ...pts[b], ...pts[c]);
      tri(0, 2, 1); tri(1, 2, 3); tri(0, 4, 2); tri(1, 3, 5); tri(2, 4, 5); tri(2, 5, 3); tri(0, 1, 5); tri(0, 5, 4);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat(0xffffff, { map: plankTex(), side: THREE.DoubleSide }));
      return { mesh, colliders: [R().ColliderDesc.convexHull(new Float32Array(pts.flat()))] };
    } },
  { id: 'balloon', name: 'Balloon', desc: 'Floats upward. Weld it to things to lift them.', mass: 0.3, material: 'soft', health: 5, buoyant: 1.6, breakInto: 'pop',
    build: () => {
      const g = new THREE.Group();
      const colors = [0xff3a5a, 0x3a9aff, 0xffd21c, 0x3ad85a, 0xc85aff];
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), mat(colors[(Math.random() * 5) | 0], { roughness: 0.25 })); b.scale.y = 1.2; g.add(b);
      return { mesh: g, colliders: [R().ColliderDesc.ball(0.3)] };
    } },
  // debris (not in spawn menu)
  { id: 'plankBit', hidden: true, name: 'Plank', mass: 1.5, material: 'wood', health: 9999, debris: true, life: 25,
    build: () => boxProp(0.12, 0.04, 0.5, mat(0xffffff, { map: plankTex() })) },
  { id: 'shard', hidden: true, name: 'Shard', mass: 0.4, material: 'glass', health: 9999, debris: true, life: 15,
    build: () => { const s = 0.15 + Math.random() * 0.2; return boxProp(s, s * 0.8, 0.02, new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.45, roughness: 0.05 })); } },
  { id: 'brick', hidden: true, name: 'Brick', mass: 3, material: 'stone', health: 99999,
    build: () => boxProp(0.4, 0.2, 0.2, mat(0xffffff, { map: brickTex() })) },
];
export const PROP_BY_ID = Object.fromEntries(PROPS.map(p => [p.id, p]));

export class Prop {
  constructor(def, pos, quat, opts = {}) {
    this.id = newId();
    this.def = def; this.defId = def.id;
    this.kind = 'prop';
    this.health = def.health ?? 100;
    const built = def.build();
    this.mesh = built.mesh;
    this.mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.entity = this; } });
    G.scene.add(this.mesh);
    const RR = G.RAPIER;
    const desc = (opts.fixed ? RR.RigidBodyDesc.fixed() : RR.RigidBodyDesc.dynamic()).setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(def.buoyant ? 1.2 : 0.05).setAngularDamping(0.25);
    if (quat) desc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    if (def.mass < 3 || def.id === 'bowling') desc.setCcdEnabled(true);
    const n = built.colliders.length;
    for (const c of built.colliders) {
      c.setMass(def.mass / n).setFriction(def.friction ?? 0.7).setRestitution(def.restitution ?? 0.1)
        .setCollisionGroups(groups(def.debris ? GROUP.DEBRIS : GROUP.PROP, def.debris ? (0xffff & ~GROUP.CREATURE & ~GROUP.PLAYER) : 0xffff))
        .setActiveEvents(RR.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(Math.max(50, def.mass * 60));
    }
    this.body = createBody(desc, built.colliders, { type: 'prop', entity: this });
    this.frozen = !!opts.fixed;
    if (def.life) this.expires = G.time + def.life + Math.random() * 5;
    if (def.buoyant) this.body.setGravityScale(-def.buoyant * 0.3, true);
    syncMesh(this.mesh, this.body);
    G.props.push(this);
  }
  get position() { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); }
  update(dt) {
    if (this.removed) return;
    syncMesh(this.mesh, this.body);
    if (this.expires && G.time > this.expires) { this.remove(); return; }
    const t = this.body.translation();
    if (t.y < (G.map ? G.map.killY : -50) || (this.def.buoyant && t.y > 160)) { this.remove(); return; }
    // water buoyancy
    if (G.map && G.map.waterLevel !== undefined && t.y < G.map.waterLevel && this.body.isDynamic()) {
      const depth = Math.min(1, (G.map.waterLevel - t.y) / 0.5);
      const m = this.body.mass();
      const lift = this.def.material === 'stone' || this.def.material === 'metal' && !this.def.explosive ? 0.6 : 1.4;
      this.body.addForce({ x: 0, y: 0, z: 0 }, false);
      this.body.applyImpulse({ x: 0, y: m * 9.81 * lift * depth * dt, z: 0 }, true);
      const v = this.body.linvel();
      this.body.setLinvel({ x: v.x * (1 - dt * 1.5), y: v.y * (1 - dt * 2), z: v.z * (1 - dt * 1.5) }, true);
      if (!this._splashed && v.y < -3) { this._splashed = true; burst('water', new THREE.Vector3(t.x, G.map.waterLevel, t.z), 20, new THREE.Vector3(0, 1, 0), 0.6); play('splash', new THREE.Vector3(t.x, t.y, t.z), 0.8); }
    } else this._splashed = false;
  }
  takeDamage(amount, info = {}) {
    if (this.removed || this.frozenIndestructible) return;
    this.health -= amount;
    if (info.attacker) this.lastThrower = info.attacker;
    if (this.health <= 0) this.destroy(info);
  }
  destroy(info = {}) {
    if (this.removed) return;
    const p = this.position;
    const q = this.body.rotation();
    const vel = this.body.linvel();
    const d = this.def;
    this.remove();
    if (d.explosive) {
      setTimeout(() => import('./combat.js').then(m => m.explosion(p, { radius: 7, damage: 160, impulse: 55, attacker: info.attacker })), 60);
      return;
    }
    if (d.breakInto === 'planks') {
      play('break', p, 1); burst('wood', p, 20, null, 1);
      const n = d.mass > 15 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const off = new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6);
        const pr = new Prop(PROP_BY_ID.plankBit, p.clone().add(off), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, 0)));
        pr.body.setLinvel({ x: vel.x + off.x * 6, y: vel.y + 2 + Math.random() * 2, z: vel.z + off.z * 6 }, true);
        pr.body.setAngvel({ x: Math.random() * 8, y: Math.random() * 8, z: Math.random() * 8 }, true);
      }
    } else if (d.breakInto === 'shards') {
      play('glass', p, 1); burst('glass', p, 30, null, 1);
      for (let i = 0; i < 8; i++) {
        const off = new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 1.4, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
        const pr = new Prop(PROP_BY_ID.shard, p.clone().add(off), new THREE.Quaternion(q.x, q.y, q.z, q.w));
        const dir = info.dir ? info.dir.clone().multiplyScalar(3) : new THREE.Vector3();
        pr.body.setLinvel({ x: vel.x + dir.x + off.x, y: vel.y + dir.y + 1, z: vel.z + dir.z + off.z }, true);
        pr.body.setAngvel({ x: Math.random() * 10, y: Math.random() * 10, z: Math.random() * 10 }, true);
      }
    } else if (d.breakInto === 'melon') {
      play('squish', p, 1); burst('melon', p, 40, new THREE.Vector3(0, 1, 0), 1.2, 1.3);
    } else if (d.breakInto === 'pop') {
      play('punch', p, 0.6); burst('impact', p, 10, null, 1);
    } else { play('break', p, 0.6); burst('dust', p, 14, null, 1); }
  }
  setFrozen(on) {
    if (this.removed) return;
    const RR = G.RAPIER;
    this.frozen = on;
    this.body.setBodyType(on ? RR.RigidBodyType.Fixed : RR.RigidBodyType.Dynamic, true);
    if (!on) this.body.wakeUp();
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    removeWeldsFor(this.body);
    removeBody(this.body);
    G.scene.remove(this.mesh);
    const i = G.props.indexOf(this); if (i >= 0) G.props.splice(i, 1);
  }
}

// Builds a wall out of loose bricks. Returns the list of bricks.
export function spawnBrickWall(pos, yaw = 0, cols = 7, rows = 8, sleep = true) {
  const bricks = [];
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? 0.2 : 0;
    for (let c = 0; c < cols; c++) {
      const x = (c - (cols - 1) / 2) * 0.41 + off;
      const p = pos.clone().addScaledVector(right, x); p.y += 0.1 + r * 0.205;
      const b = new Prop(PROP_BY_ID.brick, p, q);
      if (sleep) b.body.sleep();
      bricks.push(b);
    }
  }
  return bricks;
}

// ---- welds (fixed joints between bodies) ----
export function weldBodies(b1, b2) {
  const RR = G.RAPIER;
  const t1 = b1.translation(), r1 = b1.rotation(), t2 = b2.translation(), r2 = b2.rotation();
  const q1 = new THREE.Quaternion(r1.x, r1.y, r1.z, r1.w), q2 = new THREE.Quaternion(r2.x, r2.y, r2.z, r2.w);
  const mid = new THREE.Vector3((t1.x + t2.x) / 2, (t1.y + t2.y) / 2, (t1.z + t2.z) / 2);
  const a1 = mid.clone().sub(new THREE.Vector3(t1.x, t1.y, t1.z)).applyQuaternion(q1.clone().invert());
  const a2 = mid.clone().sub(new THREE.Vector3(t2.x, t2.y, t2.z)).applyQuaternion(q2.clone().invert());
  // frames so the current relative rotation is preserved
  const f1 = q1.clone().invert(), f2 = q2.clone().invert();
  const jd = RR.JointData.fixed({ x: a1.x, y: a1.y, z: a1.z }, { x: f1.x, y: f1.y, z: f1.z, w: f1.w }, { x: a2.x, y: a2.y, z: a2.z }, { x: f2.x, y: f2.y, z: f2.z, w: f2.w });
  const j = G.world.createImpulseJoint(jd, b1, b2, true);
  j.setContactsEnabled(false);
  const w = { joint: j, b1, b2 };
  G.welds.push(w);
  return w;
}
export function removeWeld(w) {
  const i = G.welds.indexOf(w); if (i < 0) return;
  G.welds.splice(i, 1);
  if (!w.b1._removed && !w.b2._removed) G.world.removeImpulseJoint(w.joint, true);
}
export function removeWeldsFor(body) {
  for (const w of [...G.welds]) if (w.b1 === body || w.b2 === body) { G.welds.splice(G.welds.indexOf(w), 1); }
}
export function spawnProp(def, pos, quat, opts) {
  return new Prop(def, pos, quat, opts);
}

// flashy helper used by explosive barrels when shot
export function propFlash(p) { flash(p, 0xff7030, 10, 0.1); }
