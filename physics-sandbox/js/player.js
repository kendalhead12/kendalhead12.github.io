// First-person player: kinematic character controller, noclip, free camera, vehicles, possession, health.
import * as THREE from 'three';
import { G } from './state.js';
import { settings } from './config.js';
import { createBody, removeBody, groups, GROUP, raycast } from './physics.js';
import { keys, mouse } from './input.js';
import { play } from './audio.js';
import { burst } from './effects.js';

export class Player {
  constructor() {
    this.isPlayer = true;
    this.faction = 'player';
    this.kind = 'player';
    this.radius = 0.32; this.height = 1.78; this.eyeH = 1.64; this.mass = 80;
    this.maxHealth = 100; this.health = 100; this.alive = true;
    this.yaw = 0; this.pitch = 0; this.recoilPitch = 0;
    this.vel = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.onGround = false; this.speed = 0; this.sprinting = false;
    this.noclip = false; this.freeCam = null; this.possessing = null; this.inVehicle = null;
    this.lookDX = 0; this.lookDY = 0;
    this.damageFlash = 0;
    this.camOffsetY = 0;
  }
  spawn(pos, yaw = 0) {
    if (this.body) removeBody(this.body);
    const R = G.RAPIER;
    this.pos.copy(pos);
    const halfH = this.height / 2 - this.radius;
    this.body = createBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + this.height / 2, pos.z),
      [R.ColliderDesc.capsule(halfH, this.radius).setCollisionGroups(groups(GROUP.PLAYER, 0xffff & ~GROUP.DEBRIS))], { type: 'player', entity: this });
    this.collider = this.body.collider(0);
    if (this.ctrl) G.world.removeCharacterController(this.ctrl);
    this.ctrl = G.world.createCharacterController(0.02);
    this.ctrl.enableAutostep(0.45, 0.2, false);
    this.ctrl.enableSnapToGround(0.35);
    this.ctrl.setMaxSlopeClimbAngle(52 * Math.PI / 180);
    this.ctrl.setMinSlopeSlideAngle(60 * Math.PI / 180);
    this.ctrl.setApplyImpulsesToDynamicBodies(true);
    this.ctrl.setCharacterMass(80);
    this.ctrl.setSlideEnabled(true);
    this.yaw = yaw; this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth; this.alive = true;
    this.noclip = false; this.freeCam = null;
  }
  get position() { return this.pos.clone(); }
  get velocity() { return this.vel.clone(); }
  eyePos() { return this.pos.clone().add(new THREE.Vector3(0, this.eyeH, 0)); }
  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  look(dx, dy) {
    const s = 0.0022 * settings.sensitivity * (G.aimFov ? G.aimFov / settings.fov : 1);
    this.lookDX = THREE.MathUtils.lerp(this.lookDX, dx, 0.3); this.lookDY = THREE.MathUtils.lerp(this.lookDY, dy, 0.3);
    if (this.freeCam) { this.freeCam.yaw -= dx * s; this.freeCam.pitch = THREE.MathUtils.clamp(this.freeCam.pitch - dy * s * (settings.invertY ? -1 : 1), -1.55, 1.55); return; }
    this.yaw -= dx * s;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * s * (settings.invertY ? -1 : 1), -1.55, 1.55);
  }
  recoil(a) { this.recoilPitch += a; this.pitch = Math.min(1.55, this.pitch + a); this.yaw += (Math.random() - 0.5) * a * 0.4; }

  update(dt, stepped) {
    this.lookDX *= 0.85; this.lookDY *= 0.85;
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
    if (!this.alive) { this.deadTime += dt; this.updateDeathCam(dt); if (this.deadTime > 3.5) this.respawn(); return; }
    if (this.freeCam) { this.updateFreeCam(dt); return; }
    if (this.inVehicle) { this.updateVehicle(dt); return; }
    if (this.possessing) { this.updatePossess(dt); return; }
    this.updateWalk(dt, stepped);
    this.updateCamera(dt);
  }

  moveInput() {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    return { f, r };
  }

  updateWalk(dt, stepped) {
    const { f, r } = this.moveInput();
    const fwd = this.forward();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f).addScaledVector(right, r);
    if (wish.lengthSq() > 0) wish.normalize();
    this.sprinting = keys.ShiftLeft && f > 0 && !this.noclip;
    const inWater = G.map && G.map.waterLevel !== undefined && this.pos.y + 0.9 < G.map.waterLevel;
    if (this.noclip) {
      const sp = keys.ShiftLeft ? 30 : 10;
      const camDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
      const v = camDir.multiplyScalar(f).addScaledVector(right, r);
      if (keys.Space) v.y += 1; if (keys.ControlLeft) v.y -= 1;
      this.pos.addScaledVector(v, sp * dt);
      this.vel.set(0, 0, 0);
      this.body.setTranslation({ x: this.pos.x, y: this.pos.y + this.height / 2, z: this.pos.z }, true);
      this.speed = 0; this.onGround = false;
      return;
    }
    const speed = inWater ? 3 : (this.sprinting ? 8.2 : 4.6);
    const accel = this.onGround ? 60 : 12;
    const target = wish.multiplyScalar(speed);
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const diff = target.sub(hv);
    const maxd = accel * dt;
    if (diff.length() > maxd) diff.setLength(maxd);
    this.vel.x += diff.x; this.vel.z += diff.z;
    if (inWater) {
      this.vel.y += (-settings.gravity * 0.15) * dt;
      if (keys.Space) this.vel.y = Math.min(this.vel.y + 14 * dt, 3);
      this.vel.y *= (1 - dt * 2);
    } else {
      this.vel.y -= settings.gravity * dt;
      if (keys.Space && this.onGround && G.realTime - (this.lastJump || 0) > 0.25) { this.vel.y = 5.6; this.lastJump = G.realTime; this.onGround = false; }
    }
    // knockback impulse
    if (this.knock) { this.vel.add(this.knock); this.knock = null; }
    // moving platforms
    const plat = this.platformDelta();
    const delta = this.vel.clone().multiplyScalar(dt).add(plat);
    if (!stepped) { G.world.propagateModifiedBodyPositionsToColliders(); G.world.updateSceneQueries(); }
    const heldHandles = this.heldColliderHandles();
    this.ctrl.computeColliderMovement(this.collider, delta, undefined, undefined, heldHandles ? (c) => !heldHandles.has(c.handle) : undefined);
    const m = this.ctrl.computedMovement();
    this.onGround = this.ctrl.computedGrounded();
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    if (this.onGround && this.vel.y < 0) {
      if (this.vel.y < -14 && !settings.playerInvincible) this.takeDamage((-this.vel.y - 14) * 7, { type: 'fall' });
      this.vel.y = -0.5;
    }
    if (m.y < delta.y * 0.5 && this.vel.y > 0 && Math.abs(m.y) < 1e-3) this.vel.y = 0; // head bump
    this.body.setTranslation({ x: this.pos.x, y: this.pos.y + this.height / 2, z: this.pos.z }, true);
    this.speed = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
    if (this.pos.y < (G.map ? G.map.killY : -60)) this.respawn();
  }
  // colliders of the object we're carrying, so we don't climb on it (computed outside Rapier callbacks)
  heldColliderHandles() {
    const h = G.interact && G.interact.hold;
    if (!h || !h.body || h.body._removed) return null;
    const set = new Set();
    const n = h.body.numColliders();
    for (let i = 0; i < n; i++) set.add(h.body.collider(i).handle);
    return set;
  }
  platformDelta() {
    const out = new THREE.Vector3();
    if (!G.map || !G.map.platforms || !G.map.platforms.length) return out;
    const hit = raycast(new THREE.Vector3(this.pos.x, this.pos.y + 0.3, this.pos.z), new THREE.Vector3(0, -1, 0), 0.6, { excludeBody: this.body });
    if (hit && hit.owner && hit.owner.platform) out.copy(hit.owner.platform.delta);
    return out;
  }
  updateCamera(dt) {
    const cam = G.camera;
    const bob = this.onGround && !this.noclip ? Math.min(1, this.speed / 6) : 0;
    this.bobT = (this.bobT || 0) + dt * (this.sprinting ? 11 : 8) * bob;
    const eye = this.eyePos();
    cam.position.set(eye.x, eye.y + Math.sin(this.bobT * 2) * 0.03 * bob, eye.z);
    const sh = G.shake * 0.04;
    cam.rotation.set(this.pitch + (Math.random() - 0.5) * sh, this.yaw + (Math.random() - 0.5) * sh, Math.sin(this.bobT) * 0.004 * bob + (Math.random() - 0.5) * sh * 0.5, 'YXZ');
    this.recoilPitch *= Math.max(0, 1 - dt * 10);
    const fov = G.aimFov || settings.fov;
    const target = this.sprinting ? fov + 5 : fov;
    if (Math.abs(cam.fov - target) > 0.05) { cam.fov += (target - cam.fov) * Math.min(1, dt * 12); cam.updateProjectionMatrix(); }
    G.showViewmodel = !this.freeCam && !this.inVehicle && !this.possessing && this.alive;
  }

  // ----- noclip / free camera -----
  toggleNoclip() { if (this.inVehicle || this.possessing || this.freeCam) return; this.noclip = !this.noclip; this.vel.set(0, 0, 0); G.ui.toast(this.noclip ? 'Noclip ON' : 'Noclip OFF'); }
  toggleFreeCam() {
    if (this.freeCam) { this.freeCam = null; G.ui.toast('Free camera OFF'); return; }
    this.freeCam = { pos: G.camera.position.clone(), yaw: G.camera.rotation.y, pitch: G.camera.rotation.x };
    G.ui.toast('Free camera ON — the world keeps running. Press C to return.', 3);
  }
  updateFreeCam(dt) {
    const fc = this.freeCam;
    const { f, r } = this.moveInput();
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(fc.pitch, fc.yaw, 0, 'YXZ'));
    const right = new THREE.Vector3(Math.cos(fc.yaw), 0, -Math.sin(fc.yaw));
    const v = dir.multiplyScalar(f).addScaledVector(right, r);
    if (keys.Space) v.y += 1; if (keys.ControlLeft) v.y -= 1;
    fc.pos.addScaledVector(v, (keys.ShiftLeft ? 30 : 8) * dt);
    G.camera.position.copy(fc.pos);
    G.camera.rotation.set(fc.pitch, fc.yaw, 0, 'YXZ');
    if (G.camera.fov !== settings.fov) { G.camera.fov = settings.fov; G.camera.updateProjectionMatrix(); }
    G.showViewmodel = false;
  }

  // ----- vehicles -----
  enterVehicle(v) {
    if (v.driver) return;
    if (G.interact) G.interact.releaseHold(false);
    this.inVehicle = v; v.driver = this;
    this.collider.setEnabled(false);
    this.camDist = 7;
    G.ui.toast('W/S throttle, A/D steer, Space brake, F exit', 3);
    play('horn', v.position, 0.4);
  }
  exitVehicle() {
    const v = this.inVehicle; if (!v) return;
    this.inVehicle = null; v.driver = null;
    const p = v.position;
    const side = new THREE.Vector3(-1, 0, 0).applyQuaternion(v.quaternion).multiplyScalar(v.def.size[0] / 2 + 0.8);
    const out = p.clone().add(side);
    out.y = Math.max(out.y, G.map.groundAt(out.x, out.z)) + 0.2;
    this.pos.copy(out);
    this.body.setTranslation({ x: out.x, y: out.y + this.height / 2, z: out.z }, true);
    this.collider.setEnabled(true);
    this.vel.set(0, 0, 0);
  }
  updateVehicle(dt) {
    const v = this.inVehicle;
    if (v.removed) { this.inVehicle = null; this.collider.setEnabled(true); return; }
    const { f, r } = this.moveInput();
    v.drive({ throttle: f, steer: -r, brake: keys.Space }, dt);
    const p = v.position;
    this.pos.copy(p); this.pos.y -= 0.6;
    this.body.setTranslation({ x: p.x, y: p.y + 3, z: p.z }, true);
    // chase camera
    const back = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const camPos = p.clone().addScaledVector(back, this.camDist).add(new THREE.Vector3(0, 2.2 - this.pitch * 3, 0));
    const hit = raycast(p.clone().add(new THREE.Vector3(0, 1.2, 0)), camPos.clone().sub(p).sub(new THREE.Vector3(0, 1.2, 0)).normalize(), this.camDist + 1, { excludeBody: v.body, filter: (c, o) => !o || o.type === 'world' });
    if (hit && hit.dist < this.camDist) camPos.copy(hit.point).addScaledVector(back, -0.3);
    G.camera.position.lerp(camPos, Math.min(1, dt * 10));
    G.camera.lookAt(p.clone().add(new THREE.Vector3(0, 1, 0)));
    if (G.camera.fov !== settings.fov) { G.camera.fov = settings.fov; G.camera.updateProjectionMatrix(); }
    G.showViewmodel = false;
    this.speed = 0;
  }

  // ----- possession -----
  possess(c) {
    if (!c || !c.alive || !c.body) return;
    if (G.interact) G.interact.releaseHold(false);
    this.possessing = c; c.controlled = true; c.controlInput = { x: 0, z: 0, yaw: c.yaw, run: false };
    this.yaw = c.yaw + Math.PI; this.pitch = 0;
    this.collider.setEnabled(false);
    G.ui.toast(`Possessing ${c.name}. WASD move, Shift run, LMB attack, F to leave.`, 4);
  }
  endPossession() {
    const c = this.possessing; if (!c) return;
    this.possessing = null;
    c.controlled = false; c.controlInput = null;
    this.collider.setEnabled(true);
    // step out behind the creature
    const p = c.removed ? this.pos.clone() : c.position;
    const back = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw)).multiplyScalar(c.radius + 1.2);
    const out = p.add(back); out.y = G.map.groundAt(out.x, out.z) + 0.1;
    this.pos.copy(out);
    this.body.setTranslation({ x: out.x, y: out.y + this.height / 2, z: out.z }, true);
  }
  updatePossess(dt) {
    const c = this.possessing;
    if (!c.alive || c.removed || c.ragdoll) { this.endPossession(); return; }
    const { f, r } = this.moveInput();
    const ci = c.controlInput;
    ci.z = f; ci.x = r; ci.run = keys.ShiftLeft; ci.yaw = this.yaw + Math.PI;
    if (keys.Space) ci.jump = true;
    if (mouse.left) ci.attack = true;
    const head = c.eyePos();
    const fwd = new THREE.Vector3(Math.sin(ci.yaw), 0, Math.cos(ci.yaw));
    G.camera.position.copy(head).addScaledVector(fwd, c.radius * 0.6 + 0.1);
    G.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (G.camera.fov !== settings.fov) { G.camera.fov = settings.fov; G.camera.updateProjectionMatrix(); }
    this.pos.copy(c.position).add(new THREE.Vector3(0, 30, 0));
    this.body.setTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z }, true);
    G.showViewmodel = false;
  }

  // ----- health -----
  takeDamage(amount, info = {}) {
    if (!this.alive || amount <= 0) return;
    if (this.inVehicle && info.type !== 'blast') amount *= 0.25;
    if (info.impulse && info.dir && !this.inVehicle) {
      const k = Math.min(10, info.impulse / this.mass);
      this.knock = info.dir.clone().setY(Math.max(0.25, info.dir.y)).normalize().multiplyScalar(k);
    }
    if (settings.playerInvincible || this.possessing || this.freeCam) return;
    this.health -= amount;
    this.damageFlash = Math.min(1, this.damageFlash + amount / 40);
    if (info.dir) this.lastHitDir = info.dir.clone();
    play('hurt', null, 0.8);
    G.shake = Math.min(1.5, G.shake + amount / 60);
    if (this.health <= 0) this.die(info);
    G.ui && G.ui.updateHud();
  }
  die(info) {
    this.alive = false; this.health = 0; this.deadTime = 0;
    if (this.inVehicle) this.exitVehicle();
    if (G.interact) G.interact.releaseHold(false);
    this.deathCam = { y: this.eyePos().y, roll: 0 };
    burst('blood', this.eyePos().add(new THREE.Vector3(0, -0.5, 0)), 20);
    G.ui.showDeath(info && info.attacker ? (info.attacker.name || 'something') : null);
  }
  updateDeathCam(dt) {
    const d = this.deathCam;
    d.y = Math.max(this.pos.y + 0.3, d.y - dt * 3);
    d.roll = Math.min(1.2, d.roll + dt * 2);
    G.camera.position.set(this.pos.x, d.y, this.pos.z);
    G.camera.rotation.set(this.pitch * 0.5 - d.roll * 0.3, this.yaw, d.roll, 'YXZ');
    G.showViewmodel = false;
  }
  respawn() {
    const s = G.map.spawnPoint;
    this.pos.copy(s.pos); this.yaw = s.yaw; this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.body.setTranslation({ x: s.pos.x, y: s.pos.y + this.height / 2, z: s.pos.z }, true);
    this.health = this.maxHealth; this.alive = true;
    G.ui.hideDeath(); G.ui.updateHud();
  }
}
