// Drivable raycast vehicles (Rapier vehicle controller) and wrecked car props.
import * as THREE from 'three';
import { G, newId, emitNoise } from './state.js';
import { createBody, removeBody, groups, GROUP, syncMesh } from './physics.js';
import { mat } from './render.js';
import { play } from './audio.js';
import { burst } from './effects.js';
import { removeWeldsFor } from './props.js';

export const VEHICLES = [
  { id: 'sedan', name: 'Sedan', desc: 'A four-door family car. Press F to drive.', color: 0x2a5aa8, size: [1.9, 0.7, 4.3], cabin: [1.7, 0.6, 2.2], mass: 1200, power: 5200, maxSteer: 0.55, wheelR: 0.36, clearance: 0.45 },
  { id: 'pickup', name: 'Pickup Truck', desc: 'Heavy and tough with an open bed.', color: 0xa83a2a, size: [2.1, 0.85, 5.0], cabin: [1.9, 0.7, 1.8], cabinZ: 0.6, mass: 1900, power: 7200, maxSteer: 0.5, wheelR: 0.45, clearance: 0.6 },
  { id: 'buggy', name: 'Dune Buggy', desc: 'Light, fast and bouncy. Great on sand.', color: 0xe8a21c, size: [1.7, 0.4, 3.0], cabin: null, mass: 650, power: 4200, maxSteer: 0.62, wheelR: 0.45, clearance: 0.6, roll: true, soft: true },
  { id: 'wreck', name: 'Wrecked Car', desc: 'A rusty, abandoned car shell. Heavy physics prop.', color: 0x6a4a3a, size: [1.9, 0.7, 4.3], cabin: [1.7, 0.6, 2.2], mass: 1100, wreck: true, wheelR: 0.33, clearance: 0.3 },
];
export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map(v => [v.id, v]));

export function buildVehicleMesh(def) {
  const g = new THREE.Group();
  const [w, h, l] = def.size;
  const paint = mat(def.color, { metalness: def.wreck ? 0.2 : 0.55, roughness: def.wreck ? 0.9 : 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), paint); g.add(body);
  if (def.cabin) {
    const [cw, ch, cl] = def.cabin;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cl), paint); cab.position.set(0, h / 2 + ch / 2, -(def.cabinZ || 0) * -1 - 0.2); g.add(cab);
    const glass = new THREE.MeshStandardMaterial({ color: def.wreck ? 0x222222 : 0x1a2a3a, roughness: 0.1, metalness: 0.6, transparent: true, opacity: def.wreck ? 0.5 : 0.85 });
    const ws = new THREE.Mesh(new THREE.BoxGeometry(cw * 0.94, ch * 0.75, 0.05), glass); ws.position.set(0, h / 2 + ch / 2, cab.position.z + cl / 2 + 0.01); g.add(ws);
    const rs = ws.clone(); rs.position.z = cab.position.z - cl / 2 - 0.01; g.add(rs);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(0.05, ch * 0.7, cl * 0.85), glass); sw.position.set(s * (cw / 2 + 0.01), h / 2 + ch / 2, cab.position.z); g.add(sw); }
  } else {
    // roll cage
    const bar = mat(0x222222, { metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) for (const z of [-0.5, 0.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0), bar); b.position.set(s * 0.7, h / 2 + 0.5, z); g.add(b); }
    for (const z of [-0.5, 0.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.44), bar); b.rotation.z = Math.PI / 2; b.position.set(0, h / 2 + 1.0, z); g.add(b); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), mat(0x222222)); seat.position.set(0, h / 2 + 0.2, -0.3); g.add(seat);
  }
  const lightM = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: def.wreck ? 0x000000 : 0xffffcc, emissiveIntensity: 0.8 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: def.wreck ? 0x000000 : 0x660000 });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.05), lightM); hl.position.set(s * (w / 2 - 0.3), 0.05, l / 2 + 0.01); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.05), tailM); tl.position.set(s * (w / 2 - 0.3), 0.08, -l / 2 - 0.01); g.add(tl);
  }
  if (def.wreck) { // rust patches
    const rust = mat(0x5a3220, { roughness: 1 });
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.4 + Math.random() * 0.5, 0.02, 0.4 + Math.random() * 0.6), rust); r.position.set((Math.random() - 0.5) * w * 0.7, h / 2 + 0.005, (Math.random() - 0.5) * l * 0.8); g.add(r); }
  }
  const wheels = [];
  const tire = mat(0x151515, { roughness: 0.9 }), rim = mat(0xaaaaaa, { metalness: 0.8, roughness: 0.3 });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const wg = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelR, def.wheelR, 0.28, 18), tire); t.rotation.z = Math.PI / 2; wg.add(t);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelR * 0.55, def.wheelR * 0.55, 0.3, 8), rim); r.rotation.z = Math.PI / 2; wg.add(r);
    wg.position.set(sx * (w / 2 - 0.05), -h / 2 - (def.wreck ? 0.05 : 0.0), sz * (l / 2 - 0.75));
    g.add(wg); wheels.push(wg);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { mesh: g, wheels };
}

export class Vehicle {
  constructor(def, pos, yaw = 0) {
    this.id = newId(); this.def = def; this.defId = def.id; this.kind = 'vehicle';
    this.health = def.wreck ? 99999 : 1500;
    const { mesh, wheels } = buildVehicleMesh(def);
    this.mesh = mesh; this.wheels = wheels;
    mesh.traverse(o => { if (o.isMesh) o.userData.entity = this; });
    G.scene.add(mesh);
    const R = G.RAPIER;
    const [w, h, l] = def.size;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const desc = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y + def.clearance + h / 2 + 0.2, pos.z).setRotation(q)
      .setLinearDamping(0.05).setAngularDamping(0.6).setCanSleep(true);
    const cols = [R.ColliderDesc.cuboid(w / 2, h / 2, l / 2).setMass(def.mass * 0.8)];
    if (def.cabin) cols.push(R.ColliderDesc.cuboid(def.cabin[0] / 2, def.cabin[1] / 2, def.cabin[2] / 2).setTranslation(0, h / 2 + def.cabin[1] / 2, -0.2 + (def.cabinZ || 0)).setMass(def.mass * 0.2));
    else cols.push(R.ColliderDesc.cuboid(0.7, 0.5, 0.6).setTranslation(0, h / 2 + 0.5, 0).setMass(def.mass * 0.1));
    if (def.wreck) cols.push(R.ColliderDesc.cuboid(w / 2 - 0.1, 0.2, l / 2 - 0.4).setTranslation(0, -h / 2 - 0.1, 0).setMass(def.mass * 0.1));
    for (const c of cols) c.setFriction(def.wreck ? 0.9 : 0.4).setCollisionGroups(groups(GROUP.VEHICLE)).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(5000);
    this.body = createBody(desc, cols, { type: 'vehicle', entity: this });
    // mass centre lower for stability
    if (!def.wreck) {
      this.ctrl = G.world.createVehicleController(this.body);
      this.ctrl.indexUpAxis = 1;
      this.ctrl.setIndexForwardAxis = 2;
      for (const wg of wheels) {
        const p = wg.position;
        this.ctrl.addWheel({ x: p.x, y: p.y + 0.15, z: p.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, def.clearance * 0.75, def.wheelR);
      }
      for (let i = 0; i < 4; i++) {
        this.ctrl.setWheelSuspensionStiffness(i, def.soft ? 22 : 34);
        this.ctrl.setWheelSuspensionCompression(i, 2.2);
        this.ctrl.setWheelSuspensionRelaxation(i, 2.8);
        this.ctrl.setWheelMaxSuspensionTravel(i, def.clearance);
        this.ctrl.setWheelMaxSuspensionForce(i, def.mass * 60);
        this.ctrl.setWheelFrictionSlip(i, def.soft ? 2.2 : 2.6);
        this.ctrl.setWheelSideFrictionStiffness(i, 1.0);
      }
    }
    this.steer = 0; this.driver = null; this.engineT = 0;
    syncMesh(mesh, this.body);
    G.vehicles.push(this);
  }
  get position() { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y, t.z); }
  get quaternion() { const r = this.body.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); }
  speed() { const v = this.body.linvel(); return Math.hypot(v.x, v.z); }
  // input: {throttle -1..1, steer -1..1, brake bool}
  drive(input, dt) {
    if (!this.ctrl) return;
    const d = this.def;
    this.steer += ((input.steer || 0) * d.maxSteer - this.steer) * Math.min(1, dt * 6);
    const fwdSpeed = this.forwardSpeed();
    let engine = (input.throttle || 0) * d.power;
    if (input.throttle < 0 && fwdSpeed > 1) engine = 0;
    const brake = input.brake ? 60 : (input.throttle < 0 && fwdSpeed > 1 ? 40 : (input.throttle === 0 ? 4 : 0));
    for (let i = 0; i < 4; i++) {
      const front = i < 2;
      this.ctrl.setWheelSteering(i, front ? this.steer : 0);
      this.ctrl.setWheelEngineForce(i, front ? 0 : engine);
      this.ctrl.setWheelBrake(i, brake * (front ? 0.6 : 1));
    }
    this.body.wakeUp();
    this.engineT -= dt;
    if (this.engineT <= 0 && Math.abs(input.throttle) > 0) { this.engineT = 0.45; play('engine', this.position, 0.4 + Math.min(0.6, this.speed() / 30)); }
    emitNoise(this.position, 25, 'engine', G.player);
  }
  forwardSpeed() {
    const v = this.body.linvel();
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion);
    return v.x * f.x + v.y * f.y + v.z * f.z;
  }
  update(dt) {
    if (this.removed) return;
    if (this.ctrl) {
      if (!this.driver) for (let i = 0; i < 4; i++) { this.ctrl.setWheelEngineForce(i, 0); this.ctrl.setWheelBrake(i, 3); }
      this.ctrl.updateVehicle(dt);
    }
    syncMesh(this.mesh, this.body);
    if (this.ctrl) {
      for (let i = 0; i < 4; i++) {
        const wg = this.wheels[i];
        const susp = this.ctrl.wheelSuspensionLength(i);
        const base = this.ctrl.wheelChassisConnectionPointCs(i);
        if (susp !== null && base) wg.position.y = base.y - susp;
        wg.rotation.set(this.ctrl.wheelRotation(i) || 0, this.ctrl.wheelSteering(i) || 0, 0, 'YXZ');
      }
    }
    if (this.body.translation().y < (G.map ? G.map.killY : -50)) this.remove();
  }
  // flip back upright (F when upside down)
  flip() {
    const t = this.body.translation();
    const yaw = new THREE.Euler().setFromQuaternion(this.quaternion, 'YXZ').y;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.setTranslation({ x: t.x, y: t.y + 1.5, z: t.z }, true);
    this.body.setRotation(q, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  isUpsideDown() { return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion).y < 0.3; }
  takeDamage(amount, info) {
    if (this.def.wreck) return;
    this.health -= amount;
    if (this.health < 300 && Math.random() < 0.3) burst('smoke', this.position.add(new THREE.Vector3(0, 0.6, 0)), 3, new THREE.Vector3(0, 1, 0), 0.4);
    if (this.health <= 0 && !this.exploded) {
      this.exploded = true;
      const p = this.position;
      import('./combat.js').then(m => m.explosion(p, { radius: 8, damage: 150, impulse: 50, attacker: info && info.attacker }));
      this.body.applyImpulse({ x: 0, y: this.def.mass * 6, z: 0 }, true);
      this.body.applyTorqueImpulse({ x: this.def.mass * 2, y: 0, z: this.def.mass }, true);
      this.mesh.traverse(o => { if (o.isMesh && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.25); o.material.emissive && o.material.emissive.set(0); } });
      if (this.driver) this.driver.exitVehicle();
      this.ctrl && G.world.removeVehicleController(this.ctrl); this.ctrl = null;
    }
  }
  remove() {
    if (this.removed) return;
    this.removed = true;
    if (this.driver) this.driver.exitVehicle();
    if (this.ctrl) { G.world.removeVehicleController(this.ctrl); this.ctrl = null; }
    removeWeldsFor(this.body);
    removeBody(this.body);
    G.scene.remove(this.mesh);
    const i = G.vehicles.indexOf(this); if (i >= 0) G.vehicles.splice(i, 1);
  }
}
