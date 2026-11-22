// Base class for every NPC: physics capsule, perception, steering, procedural animation,
// damage, death and ragdoll transitions. Subclasses implement think() and act().
import * as THREE from 'three';
import { G, newId, emitNoise } from '../state.js';
import { settings, relation, aiProfile } from '../config.js';
import { createBody, removeBody, raycast, groups, GROUP } from '../physics.js';
import { createRagdoll, syncRagdoll, destroyRagdoll, ragdollPelvis, setRagdollFrozen, ragdollSpeed, detachPart } from './ragdoll.js';
import { burst, addDecal, speechBubble, removeBubblesFor } from '../effects.js';
import { play, speak } from '../audio.js';
import { goreDamage, updateBleeds, addBleed, goreOn } from '../gore.js';

const UP = new THREE.Vector3(0, 1, 0);
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let iceMat = null;

export function angleDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export class Creature {
  constructor(def, pos, opts = {}) {
    this.id = newId();
    this.def = def;
    this.defId = def.id;
    this.kind = def.kind;
    this.faction = def.faction;
    this.name = def.name;
    this.isCreature = true;
    this.opts = opts;
    this.rig = def.buildRig(opts);
    this.rig.root.traverse(o => { if (o.isMesh) o.userData.entity = this; });
    G.scene.add(this.rig.root);
    this.maxHealth = opts.maxHealth ?? def.health;
    this.health = opts.health ?? this.maxHealth;
    this.mass = def.mass ?? 70;
    this.radius = (def.radius ?? 0.3) * this.rig.scale;
    this.height = def.capsuleHeight ? def.capsuleHeight * this.rig.scale : this.rig.height;
    this.walkSpeed = def.walkSpeed ?? 1.4;
    this.runSpeed = def.runSpeed ?? 5;
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.headYaw = 0; this.headYawTarget = 0;
    this.alive = true;
    this.state = 'idle'; this.stateTime = 0;
    this.thinkTimer = Math.random() * 0.3;
    this.desired = new THREE.Vector3();   // desired horizontal velocity
    this.curVel = new THREE.Vector3();
    this.speedNow = 0;
    this.phase = Math.random() * 6;
    this.path = null; this.pathGoal = null; this.pathTime = 0;
    this.action = null;
    this.grudges = new Map();  // entity -> expiry time
    this.lastAttacker = null;
    this.knockThreshold = def.knockThreshold ?? 220;
    this.stuckTime = 0;
    this.avoidSide = Math.random() < 0.5 ? 1 : -1;
    this.bubbleFollow = () => this.headPos(0.35);
    this.faceTimer = 0;
    this.frozenTime = 0;
    this.removed = false;
    this.severed = new Set();
    this.bleeds = [];
    this.created = G.time;
    this.createCapsule(pos);
    G.creatures.push(this);
  }

  // ---------- physics body ----------
  createCapsule(pos) {
    const R = G.RAPIER;
    const halfH = Math.max(0.05, this.height / 2 - this.radius);
    const desc = R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y + this.height / 2 + 0.02, pos.z).lockRotations()
      .setLinearDamping(0.1).setCanSleep(false).setCcdEnabled(true);
    const cd = R.ColliderDesc.capsule(halfH, this.radius).setMass(this.mass).setFriction(0.0)
      .setFrictionCombineRule(R.CoefficientCombineRule.Min).setRestitution(0)
      .setCollisionGroups(groups(GROUP.CREATURE))
      .setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(this.mass * 30);
    this.body = createBody(desc, [cd], { type: 'creature', entity: this });
    this.collider = this.body.collider(0);
  }
  removeCapsule() { if (this.body) { removeBody(this.body); this.body = null; } }

  get position() {
    if (this.body) { const t = this.body.translation(); return new THREE.Vector3(t.x, t.y - this.height / 2, t.z); }
    if (this.ragdoll) { const p = this.ragdoll.parts.pelvis.body.translation(); return new THREE.Vector3(p.x, p.y - 0.5, p.z); }
    return this.rig.root.position.clone();
  }
  get velocity() {
    const b = this.body || (this.ragdoll && this.ragdoll.parts.pelvis.body);
    if (!b) return new THREE.Vector3();
    const v = b.linvel(); return new THREE.Vector3(v.x, v.y, v.z);
  }
  headPos(extra = 0) {
    if (this.ragdoll || !this.body) {
      const hb = this.rig.bones.head; return hb.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, this.rig.headR * 2 + extra, 0));
    }
    const p = this.position; p.y += this.height + 0.1 + extra; return p;
  }
  eyePos() {
    const p = this.position;
    if (this.kind === 'crawler') { p.y += 0.5; return p; }
    p.y += this.height * 0.92; return p;
  }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  partFromHeight(point) {
    const p = this._partFromHeight(point);
    return this.severed.has(p) ? 'chest' : p;
  }
  _partFromHeight(point) {
    const r = (point.y - this.position.y) / this.height;
    const side = new THREE.Vector3(point.x, 0, point.z).sub(new THREE.Vector3(this.position.x, 0, this.position.z));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); // character's right = -X local
    const s = side.dot(right) > 0 ? 'R' : 'L';
    if (this.kind === 'crawler') return r > 0.5 ? 'head' : 'chest';
    if (r > 0.84) return 'head';
    if (r > 0.5) return Math.abs(side.dot(right)) > this.radius * 0.8 ? 'uArm' + s : 'chest';
    if (r > 0.42) return 'pelvis';
    if (r > 0.22) return 'thigh' + s;
    return 'shin' + s;
  }

  // ---------- relationships / perception ----------
  attitudeTo(other) {
    if (!other || other === this || !other.alive) return 'neutral';
    const g = this.grudges.get(other);
    if (g && g > G.time) {
      if (other.isPlayer && !settings.npcRetaliation && this.kind === 'human') return 'neutral';
      return 'hostile';
    }
    return relation(this.faction, other.faction);
  }
  isHostile(other) { return this.attitudeTo(other) === 'hostile'; }
  addGrudge(other, secs = 30) { if (other && other !== this) this.grudges.set(other, G.time + secs); }

  // Visible entities within range. Returns [{ent, dist}] (player included)
  perceive(range) {
    const out = [];
    const eye = this.eyePos();
    const fwd = this.forward();
    const list = G.creatures;
    const consider = (ent) => {
      if (ent === this || !ent.alive || ent.removed) return;
      const p = ent.position;
      const d = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (d > range) return;
      const dir = tmp.set(p.x - eye.x, 0, p.z - eye.z).normalize();
      const inFov = d < 4 || dir.dot(fwd) > (this.fovCos ?? -0.2);
      if (!inFov) return;
      out.push({ ent, dist: d });
    };
    for (const c of list) consider(c);
    if (G.player && G.player.alive && !G.player.noclip && !G.player.possessing) consider(G.player);
    out.sort((a, b) => a.dist - b.dist);
    return out;
  }
  canSee(ent) {
    const a = this.eyePos(), b = ent.isPlayer ? ent.eyePos() : ent.eyePos();
    const dir = b.clone().sub(a); const d = dir.length(); dir.normalize();
    const h = raycast(a, dir, d, { excludeBody: this.body, filter: (c, o) => !(o && o.type === 'ragdoll' && o.entity === this) });
    if (!h) return true;
    if (h.owner && (h.owner.entity === ent || (ent.isPlayer && h.owner.type === 'player'))) return true;
    if (h.owner && (h.owner.type === 'creature')) return true; // other creatures don't block sight
    return h.dist > d - 0.6;
  }
  hearNoises(since) {
    const p = this.position;
    return G.noises.filter(n => n.time > since && n.source !== this && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < n.radius);
  }

  // ---------- speech ----------
  say(text, { color = '#ffffff', priority = 0, voice = true } = {}) {
    if (G.time - (this._lastSay || -99) < 1.2 && priority < 2) return;
    this._lastSay = G.time;
    removeBubblesFor(this.bubbleFollow);
    speechBubble(text, this.bubbleFollow, color);
    if (voice && this.voice) speak(text, this.position, { ...this.voice, priority });
  }

  // ---------- movement ----------
  setPathTo(goal, force = false) {
    const nav = G.map && G.map.nav;
    const p = this.position;
    if (!nav || !aiProfile().pathfind) { this.path = [goal.clone()]; this.pathGoal = goal.clone(); return; }
    if (!force && this.pathGoal && this.pathGoal.distanceTo(goal) < 1.5 && G.time - this.pathTime < 2) return;
    this.pathGoal = goal.clone(); this.pathTime = G.time;
    this.path = nav.findPath(p.x, p.z, goal.x, goal.z, settings.npcIntelligence === 'high' ? 9000 : 4000) || [goal.clone()];
  }
  // Steering toward current path. Returns remaining distance to goal.
  followPath(speed) {
    if (!this.path || !this.path.length) { this.desired.set(0, 0, 0); return 0; }
    const p = this.position;
    let wp = this.path[0];
    let d = Math.hypot(wp.x - p.x, wp.z - p.z);
    while (d < 0.7 && this.path.length > 1) { this.path.shift(); wp = this.path[0]; d = Math.hypot(wp.x - p.x, wp.z - p.z); }
    if (this.path.length === 1 && d < 0.5) { this.desired.set(0, 0, 0); return 0; }
    this.steer(tmp2.set(wp.x - p.x, 0, wp.z - p.z).normalize(), speed);
    let rem = d; for (let i = 1; i < this.path.length; i++) rem += this.path[i].distanceTo(this.path[i - 1]);
    return rem;
  }
  moveDir(dir, speed) { this.steer(dir.clone().setY(0).normalize(), speed); }
  steer(dir, speed) {
    const p = this.position;
    // separation from nearby creatures
    const sep = new THREE.Vector3();
    for (const c of G.creatures) {
      if (c === this || !c.body) continue;
      const q = c.body.translation();
      const dx = p.x - q.x, dz = p.z - q.z; const d2 = dx * dx + dz * dz;
      const r = this.radius + c.radius + 0.25;
      if (d2 < r * r && d2 > 1e-4) { const d = Math.sqrt(d2); sep.x += dx / d * (r - d) / r; sep.z += dz / d * (r - d) / r; }
    }
    const v = dir.clone().addScaledVector(sep, 1.2);
    // obstacle feeler (throttled)
    if (G.time - (this._feelT || 0) > 0.2) {
      this._feelT = G.time;
      const origin = new THREE.Vector3(p.x, p.y + Math.min(0.5, this.height * 0.3), p.z);
      const look = this.radius + 0.9 + speed * 0.25;
      const h = raycast(origin, dir, look, { excludeBody: this.body, filter: (c, o) => !o || (o.type !== 'creature' && o.type !== 'player' && !(o.type === 'ragdoll')) });
      this._blocked = h && h.normal.y < 0.6 ? h : null;
      if (this._blocked && this.onBlocked) this.onBlocked(this._blocked);
    }
    if (this._blocked) {
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.avoidSide);
      v.addScaledVector(side, 1.4);
    }
    v.y = 0;
    if (v.lengthSq() > 1e-6) v.normalize();
    this.desired.copy(v).multiplyScalar(speed);
    if (speed > 0.1) this.targetYaw = Math.atan2(v.x, v.z);
  }
  stop() { this.desired.set(0, 0, 0); }
  faceTo(point) { const p = this.position; this.targetYaw = Math.atan2(point.x - p.x, point.z - p.z); }

  applyMovement(dt) {
    if (!this.body) return;
    const accel = this.def.accel ?? 14;
    const diff = tmp.copy(this.desired).sub(this.curVel);
    const len = diff.length(), maxStep = accel * dt;
    if (len > maxStep) diff.multiplyScalar(maxStep / len);
    this.curVel.add(diff);
    const lv = this.body.linvel();
    const push = this.pushVel || null;
    let vx = this.curVel.x, vz = this.curVel.z;
    if (push) { vx += push.x; vz += push.z; push.multiplyScalar(Math.max(0, 1 - dt * 4)); if (push.lengthSq() < 0.01) this.pushVel = null; }
    this.body.setLinvel({ x: vx, y: Math.min(lv.y, 20), z: vz }, true);
    this.speedNow = Math.hypot(lv.x, lv.z);
    // stuck detection
    if (this.desired.lengthSq() > 0.5 && this.speedNow < 0.25) {
      this.stuckTime += dt;
      if (this.stuckTime > 1.2) {
        this.stuckTime = 0; this.avoidSide *= -1;
        if (this.path && this.pathGoal) this.setPathTo(this.pathGoal, true);
        if (Math.abs(lv.y) < 0.1) this.body.setLinvel({ x: vx, y: 3.2, z: vz }, true);
      }
    } else this.stuckTime = 0;
    const turn = this.def.turnSpeed ?? 8;
    this.yaw += angleDiff(this.yaw, this.targetYaw) * Math.min(1, turn * dt);
  }

  // ---------- update ----------
  update(dt) {
    if (this.removed) return;
    if (this.frozenTime > 0) {
      this.frozenTime -= dt;
      if (this.frozenTime <= 0) this.unfreeze();
      return;
    }
    if (this.bleeds.length || (!this.alive && !this.pooled)) { updateBleeds(this, dt); if (this.removed) return; }
    if (this.ragdoll) {
      syncRagdoll(this.ragdoll);
      if (this.alive) {
        this.getupTimer -= dt;
        if (this.getupTimer <= 0 && ragdollSpeed(this.ragdoll) < 1.2 && !this.heldPart) this.getUp();
      }
      return;
    }
    if (!this.alive) { if (this.grabbedBy && this.body) this.animLimp(); else this.animateDeadFall(dt); return; }
    if (this.faceTimer > 0) { this.faceTimer -= dt; if (this.faceTimer <= 0) this.rig.setFace(this.moodFace()); }
    this.stateTime += dt;
    if (this.held || this.grabbedBy) {
      this.desired.set(0, 0, 0);
      this.animate(dt);
      return;
    }
    if (this.controlled) this.controlUpdate(dt);
    else {
      this.thinkTimer -= dt;
      if (this.thinkTimer <= 0) {
        this.thinkTimer = aiProfile().think * (this.def.thinkMul ?? 1) * (0.8 + Math.random() * 0.4);
        this.think();
      }
      this.act(dt);
    }
    if (this.action) {
      this.action.t += dt;
      const a = this.action;
      if (a.onHit && !a.hitDone && a.t >= a.hitAt) { a.hitDone = true; a.onHit(); }
      if (a.t >= a.dur) { const done = a.onDone; this.action = null; done && done(); }
    }
    this.applyMovement(dt);
    this.syncAlive();
    this.animate(dt);
  }
  syncAlive() {
    if (!this.body) return;
    const t = this.body.translation();
    this.rig.root.position.set(t.x, t.y - this.height / 2, t.z);
    this.rig.root.rotation.set(0, this.yaw, 0);
    if (t.y < (G.map ? G.map.killY : -50)) this.remove();
  }
  think() {}
  act(dt) {}
  moodFace() { return this.rig.spec.face; }
  setFaceFor(kind, secs) { this.rig.setFace(kind); this.faceTimer = secs; }

  startAction(name, dur, opts = {}) {
    this.action = { name, t: 0, dur, ...opts };
  }

  // Possession: driven by the player's input.
  controlUpdate(dt) {
    const c = this.controlInput || { x: 0, z: 0, yaw: this.yaw, run: false };
    const sp = c.run ? this.runSpeed : this.walkSpeed * 1.6;
    const fwd = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const right = new THREE.Vector3(-Math.cos(c.yaw), 0, Math.sin(c.yaw));
    const dir = fwd.multiplyScalar(c.z).addScaledVector(right, c.x);
    if (dir.lengthSq() > 0.01) { dir.normalize(); this.desired.copy(dir).multiplyScalar(sp); }
    else this.desired.set(0, 0, 0);
    this.targetYaw = c.yaw; this.yaw = c.yaw;
    if (c.jump && this.body && Math.abs(this.body.linvel().y) < 0.1) { const v = this.body.linvel(); this.body.setLinvel({ x: v.x, y: 5, z: v.z }, true); }
    c.jump = false;
    if (c.attack && !this.action) { c.attack = false; this.possessedAttack && this.possessedAttack(); }
  }

  // ---------- damage ----------
  takeDamage(amount, info = {}) {
    if (this.removed) return;
    const attacker = info.attacker || null;
    if (attacker && attacker !== this && !settings.friendlyFire) {
      const fa = attacker.isPlayer ? 'player' : attacker.faction;
      if (fa && relation(fa, this.faction) === 'friendly' && !this.grudges.has(attacker)) amount = 0;
    }
    this._lastHitAmount = amount;
    if (info.part === 'head' && info.type !== 'blast') amount *= info.headMul ?? 2.5;
    // hit effects
    const point = info.point || this.headPos(-0.5);
    const dir = info.dir || new THREE.Vector3();
    if (amount > 0 || info.type === 'bullet' || info.type === 'melee') {
      const bloodType = this.def.bloodType || 'blood';
      const n = Math.min(40, 3 + amount * 0.35);
      if (info.type !== 'blast' && info.type !== 'freeze') burst(bloodType, point, n, dir, 0.8);
      if (bloodType === 'blood' && (info.type === 'bullet' || info.type === 'melee' || info.type === 'bite' || info.type === 'claw') && amount > 4) this.addWound(point, info);
    }
    // ragdolled body: push the hit part
    if (this.ragdoll) {
      const part = this.ragdoll.parts[info.part] || this.ragdoll.parts.chest || this.ragdoll.parts.pelvis;
      if (info.impulse && part) part.body.applyImpulseAtPoint(dir.clone().multiplyScalar(info.impulse * 0.12), point, true);
      if (this.def.detachable && amount > 0) this.damagePart(info.part, amount, dir);
    }
    const applied = amount > 0 && !(settings.npcInvincible && !info.forceKill) && !this.invincible;
    if (applied) this.health -= amount;
    if (applied && goreDamage(this, amount, info) === 'gibbed') return;
    if (this.removed || !this.alive) return;
    if (attacker && attacker !== this) this.lastAttacker = attacker;
    if (amount > 0) {
      this.setFaceFor('pain', 0.5);
      if (this.def.painSound && Math.random() < 0.7) play(this.def.painSound, this.position, 0.8, 1, this.voicePitch || 1);
    }
    this.onDamaged(amount, info);
    if (this.health <= 0) { this.die(info); return; }
    const knock = (info.impulse || 0) > this.knockThreshold || (info.blast && (info.impulse || 0) > this.knockThreshold * 0.6);
    if (knock && settings.ragdolls && !this.def.noKnockdown) this.knockDown(info);
    else if (info.impulse && this.body) {
      const k = Math.min(6, info.impulse / this.mass);
      this.pushVel = (this.pushVel || new THREE.Vector3()).add(dir.clone().setY(0).multiplyScalar(k));
    }
  }
  addWound(point, info) {
    this._wounds = (this._wounds || 0) + 1;
    if (this._wounds > 14) return;
    const bone = this.rig.bones[info.part] || this.rig.bones.chest;
    const n = (info.normal && info.normal.lengthSq() > 0) ? info.normal : info.dir.clone().negate();
    addDecal(point, n, 'stain', 0.12 + Math.random() * 0.1, bone);
    if (settings.damageFx !== 'low') addDecal(point, n, 'hole', 0.05, bone);
    if (goreOn() && bone.parent) { bone.updateMatrixWorld(true); addBleed(this, bone, bone.worldToLocal(point.clone()), { secs: 14 + Math.random() * 10 }); }
  }
  onDamaged(amount, info) {}

  knockDown(info) {
    if (this.ragdoll || !this.body) return;
    const v = this.velocity;
    const imp = (info.dir || new THREE.Vector3()).clone().multiplyScalar(Math.min(25, (info.impulse || 0) / this.mass));
    v.add(imp); v.y = Math.max(v.y, 1.5 + imp.length() * 0.2);
    this.becomeRagdoll(v);
    this.getupTimer = (this.def.getupTime ?? 2.5) + Math.random();
    this.action = null;
    if (this.onKnockedDown) this.onKnockedDown();
  }
  becomeRagdoll(velocity) {
    this.removeCapsule();
    this.ragdoll = createRagdoll(this.rig, { velocity, owner: this, totalMass: this.mass, skip: this.severed });
  }
  getUp() {
    const pv = ragdollPelvis(this.ragdoll);
    const pos = new THREE.Vector3(pv.pos.x, pv.pos.y, pv.pos.z);
    const chestQ = (this.ragdoll.parts.chest || this.ragdoll.parts.pelvis).body.rotation();
    const chestUp = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(chestQ.x, chestQ.y, chestQ.z, chestQ.w));
    const faceUp = new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion(chestQ.x, chestQ.y, chestQ.z, chestQ.w)).y > 0;
    this.yaw = this.targetYaw = Math.atan2(chestUp.x, chestUp.z) + (faceUp ? Math.PI : 0);
    destroyRagdoll(this.ragdoll); this.ragdoll = null;
    const g = G.map ? G.map.groundBelow(pos) : 0;
    this.createCapsule(new THREE.Vector3(pos.x, Math.max(g, pos.y - 0.6), pos.z));
    this.rig.reset();
    this.startAction('getup', 0.9, { faceUp });
    this.syncAlive();
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.health = 0;
    this.diedAt = G.time;
    this.action = null;
    this.rig.setFace(this.def.deadFace || 'dead');
    removeBubblesFor(this.bubbleFollow);
    const eatenBy = this.grabbedBy && this.grabbedBy.eating === this ? this.grabbedBy : null;
    if (this.grabbedBy && !eatenBy) this.grabbedBy.releaseGrab && this.grabbedBy.releaseGrab();
    if (this.grabbing) this.releaseGrab && this.releaseGrab();
    if (this.def.deathSound) play(this.def.deathSound, this.position, 1, 1, this.voicePitch || 1);
    emitNoise(this.position, 22, 'death', this);
    // notify witnesses
    const killer = info.attacker || this.lastAttacker;
    for (const c of G.creatures) if (c !== this && c.alive && c.onWitnessDeath && c.position.distanceTo(this.position) < 30) c.onWitnessDeath(this, killer);
    if (info.silentRagdoll || this._gibbed) {
      // the body is about to be removed (gibbed)
    } else if (eatenBy) {
      // stays in the monster's hand
    } else if (settings.ragdolls && this.body) {
      const v = this.velocity;
      if (info.dir && info.impulse) v.addScaledVector(info.dir, Math.min(18, info.impulse / this.mass));
      this.becomeRagdoll(v);
      if (info.part && info.impulse) {
        const part = this.ragdoll.parts[info.part];
        if (part) part.body.applyImpulse(info.dir.clone().multiplyScalar(Math.min(info.impulse, this.mass * 6) * 0.15), true);
      }
      if (this.def.detachable && info.part) this.damagePart(info.part, this._lastHitAmount || 0, info.dir || new THREE.Vector3());
    } else {
      this.deathFall = { t: 0, from: this.yaw };
      this.removeCapsule();
    }
    if (this.onDeath) this.onDeath(info);
    if (G.ui) G.ui.onCreatureDied(this);
  }
  animLimp() {
    const b = this.rig.bones, t = G.time + this.id;
    this.rig.reset();
    b.head.rotation.x = 0.9; b.chest.rotation.x = 0.25;
    b.uArmL.rotation.set(0.25 + Math.sin(t * 2) * 0.08, 0, 0.15); b.uArmR.rotation.set(0.2 + Math.sin(t * 2 + 1) * 0.08, 0, -0.15);
    b.lArmL.rotation.x = -0.25; b.lArmR.rotation.x = -0.3;
    b.thighL.rotation.x = -0.15; b.thighR.rotation.x = 0.05; b.shinL.rotation.x = 0.35; b.shinR.rotation.x = 0.2;
  }
  animateDeadFall(dt) {
    if (!this.deathFall) return;
    const f = this.deathFall;
    if (f.t >= 1) return;
    f.t = Math.min(1, f.t + dt * 1.8);
    const e = f.t * f.t;
    this.rig.reset();
    this.rig.root.rotation.set(-e * Math.PI / 2, this.yaw, 0, 'YXZ');
    this.rig.root.position.y = (G.map ? G.map.groundAt(this.rig.root.position.x, this.rig.root.position.z) : 0) + e * 0.15;
  }
  // Detachable limbs for dummies / skeletons
  damagePart(partName, amount, dir) {
    if (!this.ragdoll || !partName || partName === 'pelvis') return;
    this.partDamage = this.partDamage || {};
    this.partDamage[partName] = (this.partDamage[partName] || 0) + amount;
    if (this.partDamage[partName] > (this.def.limbHealth ?? 40)) {
      if (detachPart(this.ragdoll, partName)) {
        const b = this.ragdoll.parts[partName].body;
        const t = b.translation();
        burst(this.def.bloodType === 'bone' ? 'bone' : 'spark', new THREE.Vector3(t.x, t.y, t.z), 14, dir, 1);
        play(this.def.bloodType === 'bone' ? 'bones' : 'metal', new THREE.Vector3(t.x, t.y, t.z), 0.8);
        b.applyImpulse(dir.clone().multiplyScalar(3).add(new THREE.Vector3(0, 2, 0)), true);
      }
    }
  }

  // ---------- frozen ----------
  // ice=false is used by the physics gun to pin a creature in place without the ice look
  freeze(secs = 8, ice = true) {
    if (this.frozenTime > 0) { this.frozenTime = Math.max(this.frozenTime, secs); return; }
    this.frozenTime = secs;
    this.frozenIce = ice;
    if (ice) {
      if (!iceMat) iceMat = new THREE.MeshStandardMaterial({ color: 0xaee8ff, roughness: 0.15, metalness: 0.1, emissive: 0x1a4a66, transparent: true, opacity: 0.92 });
      this._origMats = [];
      this.rig.root.traverse(o => { if (o.isMesh && o !== this.rig.face) { this._origMats.push([o, o.material]); o.material = iceMat; } });
      play('freeze', this.position, 0.7);
    }
    if (this.ragdoll) setRagdollFrozen(this.ragdoll, true);
    else if (this.body) {
      if (this.held) this.setHeld(false);
      this.desired.set(0, 0, 0); this.curVel.set(0, 0, 0);
      this.body.setBodyType(G.RAPIER.RigidBodyType.Fixed, true);
    }
  }
  unfreeze() {
    this.frozenTime = 0;
    if (this._origMats) for (const [o, m] of this._origMats) o.material = m;
    this._origMats = null;
    if (this.ragdoll && this.ragdoll.frozen) setRagdollFrozen(this.ragdoll, false);
    if (this.body && !this.ragdoll) { this.body.setBodyType(G.RAPIER.RigidBodyType.Dynamic, true); this.body.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    if (this.frozenIce) burst('ice', this.headPos(-0.6), 12, UP, 1);
  }

  // ---------- removal ----------
  remove() {
    if (this.removed) return;
    this.removed = true;
    if (this.grabbing && this.releaseGrab) this.releaseGrab();
    if (this.grabbedBy && this.grabbedBy.releaseGrab) this.grabbedBy.releaseGrab();
    removeBubblesFor(this.bubbleFollow);
    this.removeCapsule();
    if (this.ragdoll) { destroyRagdoll(this.ragdoll); this.ragdoll = null; }
    G.scene.remove(this.rig.root);
    const i = G.creatures.indexOf(this); if (i >= 0) G.creatures.splice(i, 1);
    if (G.player && G.player.possessing === this) G.player.endPossession();
  }

  // ---------- held by physgun / grabbed by monster ----------
  setHeld(on) {
    if (!this.body) return;
    const R = G.RAPIER;
    this.body.setBodyType(on ? R.RigidBodyType.KinematicPositionBased : R.RigidBodyType.Dynamic, true);
    this.held = on;
    if (!on) { this.stateTime = 0; }
  }
  setKinematicPos(p) {
    if (!this.body) return;
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + this.height / 2, z: p.z });
    this.rig.root.position.set(p.x, p.y, p.z);
    this.rig.root.rotation.set(0, this.yaw, 0);
  }

  // ---------- animation ----------
  animate(dt) {
    const rig = this.rig, b = rig.bones;
    rig.reset();
    const t = G.time + this.id * 1.7;
    const sp = this.speedNow;
    const style = this.def.animStyle || 'human';
    const stride = (this.def.strideLen ?? 1.25) * rig.scale;
    this.phase += dt * sp / stride * Math.PI;
    const ph = this.phase;
    const walkAmp = Math.min(1, sp / Math.max(0.5, this.walkSpeed));
    const run = THREE.MathUtils.clamp((sp - this.walkSpeed * 1.3) / Math.max(0.1, this.runSpeed - this.walkSpeed * 1.3), 0, 1);
    this.headYaw += (this.headYawTarget - this.headYaw) * Math.min(1, dt * 4);

    if (style === 'crawler') this.animCrawler(b, ph, walkAmp, t);
    else {
      const A = walkAmp * (0.45 + 0.35 * run);
      b.thighL.rotation.x = -Math.sin(ph) * A;
      b.thighR.rotation.x = Math.sin(ph) * A;
      b.shinL.rotation.x = walkAmp * (0.15 + (0.5 + run * 0.9) * Math.max(0, Math.sin(ph + 2.0)));
      b.shinR.rotation.x = walkAmp * (0.15 + (0.5 + run * 0.9) * Math.max(0, Math.sin(ph + 2.0 + Math.PI)));
      b.uArmL.rotation.x = Math.sin(ph) * A * 0.9;
      b.uArmR.rotation.x = -Math.sin(ph) * A * 0.9;
      b.lArmL.rotation.x = -0.15 - run * 1.1 - walkAmp * 0.15;
      b.lArmR.rotation.x = -0.15 - run * 1.1 - walkAmp * 0.15;
      b.uArmL.rotation.z = 0.07; b.uArmR.rotation.z = -0.07;
      b.pelvis.position.y += Math.abs(Math.cos(ph)) * 0.035 * walkAmp * rig.scale - run * 0.04 * rig.scale;
      b.chest.rotation.x = run * 0.22 + Math.sin(t * 1.6) * 0.015;
      b.chest.rotation.y = Math.sin(ph) * 0.08 * walkAmp;
      b.head.rotation.y = this.headYaw;
      if (style === 'zombie') {
        b.uArmL.rotation.x = -1.3 + Math.sin(t * 2.1) * 0.12 + run * 0.4; b.uArmR.rotation.x = -1.25 + Math.sin(t * 2.4) * 0.12 + run * 0.4;
        b.uArmL.rotation.z = 0.15; b.uArmR.rotation.z = -0.15;
        b.lArmL.rotation.x = -0.15; b.lArmR.rotation.x = -0.25;
        b.chest.rotation.x = 0.25 + run * 0.2; b.head.rotation.z = Math.sin(t * 0.7) * 0.25; b.head.rotation.x = -0.15;
        b.thighL.rotation.z = 0.06; b.thighR.rotation.z = -0.06;
      } else if (style === 'monster') {
        b.chest.rotation.x = 0.5 + run * 0.15 + Math.sin(t * 1.2) * 0.03;
        b.head.rotation.x = -0.45;
        b.uArmL.rotation.x = -0.25 + Math.sin(ph) * A * 0.7; b.uArmR.rotation.x = -0.25 - Math.sin(ph) * A * 0.7;
        b.uArmL.rotation.z = 0.2; b.uArmR.rotation.z = -0.2;
        b.lArmL.rotation.x = -0.4 - run * 0.4; b.lArmR.rotation.x = -0.4 - run * 0.4;
        b.thighL.rotation.x -= 0.3; b.thighR.rotation.x -= 0.3; b.shinL.rotation.x += 0.45; b.shinR.rotation.x += 0.45;
        b.pelvis.position.y -= 0.12 * rig.scale;
        // heavy footsteps
        const step = Math.floor(ph / Math.PI);
        if (step !== this._lastStep) { this._lastStep = step; if (sp > 0.5 && this.onFootstep) this.onFootstep(); }
      } else if (style === 'skeleton') {
        b.head.rotation.z = Math.sin(t * 3) * 0.05;
        b.lArmL.rotation.x -= 0.2; b.lArmR.rotation.x -= 0.4;
      }
      // idle breathing / looking around
      if (sp < 0.3 && style === 'human') {
        b.chest.rotation.x += Math.sin(t * 1.8) * 0.02;
        b.uArmL.rotation.z = 0.1 + Math.sin(t * 1.8) * 0.02; b.uArmR.rotation.z = -0.1 - Math.sin(t * 1.8) * 0.02;
      }
    }
    if (this.action) this.animAction(b, this.action, t);
    if (this.held || this.grabbedBy) this.animStruggle(b, t);
    if (this.extraAnim) this.extraAnim(b, t, dt);
  }
  animCrawler(b, ph, amp, t) {
    const s = this.rig.scale;
    b.pelvis.position.set(0, 0.22 * s, -0.45 * s);
    b.pelvis.rotation.x = 1.42;
    b.chest.rotation.x = 0.05;
    b.head.rotation.x = -1.05; b.head.rotation.z = Math.sin(t) * 0.15;
    const A = 0.35 + amp * 0.4;
    b.uArmL.rotation.x = -2.5 + Math.sin(ph) * A; b.uArmR.rotation.x = -2.5 - Math.sin(ph) * A;
    b.uArmL.rotation.z = 0.35; b.uArmR.rotation.z = -0.35;
    b.lArmL.rotation.x = -0.6 - Math.max(0, Math.cos(ph)) * 0.6; b.lArmR.rotation.x = -0.6 - Math.max(0, -Math.cos(ph)) * 0.6;
    b.thighL.rotation.x = 0.1 + Math.sin(ph) * 0.15 * amp; b.thighR.rotation.x = 0.1 - Math.sin(ph) * 0.15 * amp;
    b.thighL.rotation.z = 0.15; b.thighR.rotation.z = -0.15;
    b.shinL.rotation.x = 0.3; b.shinR.rotation.x = 0.6;
  }
  animStruggle(b, t) {
    const f = 14;
    b.uArmL.rotation.x = -1.8 + Math.sin(t * f) * 0.8; b.uArmR.rotation.x = -1.6 + Math.sin(t * f + 2) * 0.8;
    b.uArmL.rotation.z = 0.5 + Math.sin(t * 9) * 0.3; b.uArmR.rotation.z = -0.5 - Math.sin(t * 11) * 0.3;
    b.lArmL.rotation.x = -0.8 + Math.sin(t * 13) * 0.5; b.lArmR.rotation.x = -0.8 + Math.sin(t * 12 + 1) * 0.5;
    b.thighL.rotation.x = Math.sin(t * 10) * 0.7; b.thighR.rotation.x = -Math.sin(t * 10) * 0.7;
    b.shinL.rotation.x = 0.5 + Math.sin(t * 10 + 1) * 0.5; b.shinR.rotation.x = 0.5 - Math.sin(t * 10 + 1) * 0.5;
    b.head.rotation.y = Math.sin(t * 5) * 0.4; b.chest.rotation.y = Math.sin(t * 7) * 0.2;
    b.pelvis.position.y = b.pelvis.userData.rest.y;
  }
  animAction(b, a, t) {
    const k = a.t / a.dur;
    switch (a.name) {
      case 'punch': {
        const arm = a.side === 'L' ? 'L' : 'R';
        const strike = k < 0.35 ? -k / 0.35 * 0.2 + 0.4 * (k / 0.35) : (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
        if (k < 0.35) { b['uArm' + arm].rotation.x = 0.5 * (k / 0.35); b['lArm' + arm].rotation.x = -1.9; }
        else { b['uArm' + arm].rotation.x = -1.55 * strike; b['lArm' + arm].rotation.x = -1.9 * (1 - strike) - 0.1; }
        b['uArm' + arm].rotation.z = (arm === 'L' ? 1 : -1) * 0.25;
        const other = arm === 'L' ? 'R' : 'L';
        b['uArm' + other].rotation.x = -0.9; b['lArm' + other].rotation.x = -2.0; b['uArm' + other].rotation.z = (other === 'L' ? 1 : -1) * 0.3;
        b.chest.rotation.y = (arm === 'L' ? -1 : 1) * 0.35 * strike;
        break;
      }
      case 'swipe': {
        const arm = a.side || 'R';
        const s = Math.sin(Math.min(1, k * 1.2) * Math.PI);
        b['uArm' + arm].rotation.x = -2.6 + k * 2.4; b['uArm' + arm].rotation.z = (arm === 'L' ? 1 : -1) * (0.6 - k * 0.5);
        b['lArm' + arm].rotation.x = -0.6 * s;
        b.chest.rotation.x += 0.3 * s; b.chest.rotation.y = (arm === 'L' ? -1 : 1) * 0.4 * s;
        break;
      }
      case 'cower': {
        b.uArmL.rotation.x = -2.5; b.uArmR.rotation.x = -2.5; b.lArmL.rotation.x = -2.2; b.lArmR.rotation.x = -2.2;
        b.uArmL.rotation.z = -0.35; b.uArmR.rotation.z = 0.35;
        b.thighL.rotation.x = -1.3; b.thighR.rotation.x = -1.3; b.shinL.rotation.x = 2.2; b.shinR.rotation.x = 2.2;
        b.pelvis.position.y = b.pelvis.userData.rest.y * 0.5; b.chest.rotation.x = 0.6; b.head.rotation.x = 0.4;
        b.chest.rotation.z = Math.sin(t * 25) * 0.02;
        break;
      }
      case 'shock': {
        const e = Math.min(1, k * 5);
        b.uArmL.rotation.x = -1.2 * e; b.uArmR.rotation.x = -1.2 * e; b.lArmL.rotation.x = -1.6 * e; b.lArmR.rotation.x = -1.6 * e;
        b.uArmL.rotation.z = 0.4 * e; b.uArmR.rotation.z = -0.4 * e; b.chest.rotation.x = -0.15 * e; b.head.rotation.x = -0.1 * e;
        break;
      }
      case 'talk': {
        b.uArmR.rotation.x = -0.5 + Math.sin(t * 4) * 0.2; b.lArmR.rotation.x = -1.2 + Math.sin(t * 5) * 0.3;
        b.uArmL.rotation.x = -0.2 + Math.sin(t * 3 + 1) * 0.1; b.lArmL.rotation.x = -0.6;
        b.head.rotation.x = Math.sin(t * 6) * 0.06;
        break;
      }
      case 'argue': {
        b.uArmR.rotation.x = -0.9 + Math.sin(t * 8) * 0.4; b.lArmR.rotation.x = -1.0 + Math.sin(t * 9) * 0.4;
        b.uArmL.rotation.x = -0.9 + Math.sin(t * 7 + 2) * 0.4; b.lArmL.rotation.x = -1.0;
        b.uArmL.rotation.z = 0.5; b.uArmR.rotation.z = -0.5; b.chest.rotation.x = 0.15;
        break;
      }
      case 'wave': {
        b.uArmR.rotation.x = -2.8; b.uArmR.rotation.z = -0.3 + Math.sin(t * 10) * 0.25; b.lArmR.rotation.x = -0.3;
        break;
      }
      case 'getup': {
        const e = 1 - Math.pow(1 - k, 2);
        const s = this.rig.scale;
        b.pelvis.position.y = b.pelvis.userData.rest.y * (0.25 + 0.75 * e);
        b.chest.rotation.x = (a.faceUp ? -1 : 1) * 1.2 * (1 - e);
        b.thighL.rotation.x = -1.4 * (1 - e); b.thighR.rotation.x = -1.2 * (1 - e);
        b.shinL.rotation.x = 2.2 * (1 - e); b.shinR.rotation.x = 2.0 * (1 - e);
        b.uArmL.rotation.x = -0.6 * (1 - e); b.uArmR.rotation.x = -0.6 * (1 - e);
        void s;
        break;
      }
      default:
        if (this.animCustom) this.animCustom(b, a, k, t);
    }
  }
}

// Spawn-limit helper
export function livingCount() { return G.creatures.filter(c => c.alive).length; }
export function cleanupCorpses(max = 45) {
  const dead = G.creatures.filter(c => !c.alive).sort((a, b) => a.diedAt - b.diedAt);
  while (dead.length > max) dead.shift().remove();
}
