// The Maneater: a ~10ft hunched humanoid monster that hunts, grabs and lifts its prey.
import * as THREE from 'three';
import { G, emitNoise } from '../state.js';
import { settings } from '../config.js';
import { rand } from './creature.js';
import { Hunter } from './zombie.js';
import { buildHumanoid } from './rig.js';
import { play } from '../audio.js';
import { burst, shake } from '../effects.js';

export function maneaterRig(scale = 1.72, skin = 0x56524c) {
  return () => buildHumanoid({
    scale, skin, shirt: skin, pants: skin, shoes: 0x3a3632, hairStyle: 'none', sleeves: 'none', nose: false, face: 'neutral',
    uArm: 0.42, lArm: 0.43, thighR: 0.07, shinR: 0.055, uArmR: 0.048, lArmR: 0.042, torsoW: 0.42, torsoD: 0.24, headR: 0.13,
    shoulderW: 0.24, mass: 420,
    extras: (rig, { addMesh, M, L, boxGeo, sphereGeo }) => {
      rig.face.visible = false;
      const head = rig.bones.head;
      const hr = rig.headR;
      const dark = M(0x1a0f0f, { roughness: 1 });
      const tooth = M(0xf3ecd8, { roughness: 0.4 });
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffd04a, emissive: 0xff8a00, emissiveIntensity: 3.5 });
      // brow ridge + glowing eyes
      addMesh(head, boxGeo(hr * 1.7, hr * 0.25, hr * 0.4), M(skin), [0, hr * 1.35, hr * 0.75]);
      for (const s of [-1, 1]) { const e = addMesh(head, sphereGeo(hr * 0.16, 10), eyeMat, [s * hr * 0.42, hr * 1.15, hr * 0.86], null, false); e.scale.set(1.3, 0.7, 0.6); }
      // wide mouth: dark cavity, upper teeth, hinged jaw with lower teeth
      addMesh(head, boxGeo(hr * 1.55, hr * 0.35, hr * 0.5), dark, [0, hr * 0.62, hr * 0.72], null, false);
      const coneG = new THREE.ConeGeometry(hr * 0.07, hr * 0.28, 5);
      for (let i = 0; i < 9; i++) { const x = (i - 4) * hr * 0.17; addMesh(head, coneG, tooth, [x, hr * 0.68, hr * 0.94], [Math.PI, 0, 0], false); }
      const jaw = new THREE.Group(); jaw.position.set(0, hr * 0.55, hr * 0.15); head.add(jaw);
      const jm = new THREE.Mesh(boxGeo(hr * 1.6, hr * 0.28, hr * 1.0), M(skin)); jm.position.set(0, -hr * 0.1, hr * 0.45); jm.castShadow = true; jaw.add(jm);
      for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(coneG, tooth); t.position.set((i - 3.5) * hr * 0.18, hr * 0.08, hr * 0.85); jaw.add(t); }
      rig.jaw = jaw;
      // claws
      const clawG = new THREE.ConeGeometry(L(0.018), L(0.14), 5);
      for (const n of ['L', 'R']) {
        const fa = rig.bones['lArm' + n];
        const hand = fa.children.find(c => c.name === 'hand'); if (hand) hand.scale.set(1.8, 1.6, 1.6);
        for (let i = 0; i < 4; i++) addMesh(fa, clawG, tooth, [(i - 1.5) * L(0.025), -L(0.43) - L(0.12), L(0.02)], [Math.PI, 0, 0], false);
      }
      // spine ridges
      const ridge = new THREE.ConeGeometry(L(0.03), L(0.1), 5);
      for (let i = 0; i < 5; i++) addMesh(rig.bones.chest, ridge, M(0x3a3632), [0, L(0.08 + i * 0.09), -L(0.13)], [-1.2, 0, 0]);
      rig.handLocal = new THREE.Vector3(0, -L(0.43) - L(0.06), L(0.03));
    },
  });
}

export class Maneater extends Hunter {
  constructor(def, pos, opts) {
    super(def, pos, opts);
    this.grabbing = null;
    this.lastRoar = -99;
    this.damageWhileGrab = 0;
    this.fovCos = -0.5;
  }
  canGrab(t) {
    if (!this.def.canGrab || !t || t.isPlayer || !t.alive || t.grabbedBy || !t.body) return false;
    return (t.mass || 70) < 160 && t.kind !== 'maneater';
  }
  attack(t) {
    if (this.grabbing) return;
    if (this.canGrab(t)) {
      play('growl', this.position, 0.8);
      this.startAction('reach', 0.45, { onDone: () => this.tryCatch(t) });
    } else {
      play('growl', this.position, 0.6);
      this.startAction('swipe', 0.85, { side: Math.random() < 0.5 ? 'L' : 'R', hitAt: 0.5, onHit: () => this.landHit(t) });
    }
  }
  tryCatch(t) {
    if (!this.alive || !t || !t.alive || t.grabbedBy || !t.body) return;
    const d = t.position.distanceTo(this.position);
    if (d > (this.def.reach ?? 1.6) + 1.0) return;
    this.grabbing = t; t.grabbedBy = this;
    t.setHeld(true);
    if (t.collider) t.collider.setSensor(true);
    t.action = null;
    if (t.onGrabbed) t.onGrabbed(this);
    this.damageWhileGrab = 0;
    this.stop();
    shake(0.3, this.position);
    play('crunch', this.position, 0.4);
    this.startAction('lift', 1.3, { onDone: () => this.feed() });
  }
  feed() {
    if (!this.grabbing) return;
    const bites = [0.55, 1.15, 1.75];
    this.startAction('feed', 2.3, {
      onDone: () => this.finishGrab(),
    });
    this.action.bites = bites; this.action.bitten = 0;
  }
  biteFx() {
    const t = this.grabbing; if (!t) return;
    const hp = t.rig.bones.chest.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.3, 0));
    play('crunch', hp, 1);
    shake(0.45, hp);
    burst(settings.blood ? 'blood' : 'impact', hp, 10, this.forward().negate(), 1);
    t.setFaceFor('pain', 0.4);
  }
  finishGrab() {
    const t = this.grabbing;
    this.releaseGrab(true);
    if (t && t.alive) {
      const toss = this.forward().add(new THREE.Vector3(rand(-0.5, 0.5), 0.6, 0)).normalize();
      t.die({ attacker: this, dir: toss, impulse: t.mass * 8, part: 'chest', type: 'claw' });
    }
    play('growl', this.position, 1);
    this._lastAtk = G.time + 1.5;
  }
  releaseGrab(silent = false) {
    const t = this.grabbing;
    this.grabbing = null;
    if (this.action && ['lift', 'feed', 'reach'].includes(this.action.name)) this.action = null;
    if (t) {
      t.grabbedBy = null;
      if (t.body) { t.setHeld(false); if (t.collider) t.collider.setSensor(false); }
      if (t.alive && t.scare && !silent) { t.rig.setFace('scared'); t.scare(this, this.position, { shock: false }); }
    }
  }
  update(dt) {
    super.update(dt);
    if (this.grabbing && this.alive && !this.ragdoll) {
      const t = this.grabbing;
      if (!t.alive || t.removed || !t.body) { this.releaseGrab(); return; }
      const rig = this.rig;
      rig.root.updateMatrixWorld(true);
      const hand = rig.bones.lArmR.localToWorld(rig.handLocal.clone());
      // hold the prey by the torso, facing the Maneater
      const feet = hand.clone().add(new THREE.Vector3(0, -t.height * 0.72, 0)).addScaledVector(this.forward(), 0.12);
      t.yaw = t.targetYaw = this.yaw + Math.PI;
      t.setKinematicPos(feet);
      if (this.action && this.action.name === 'feed' && this.action.bites) {
        const a = this.action;
        while (a.bitten < a.bites.length && a.t >= a.bites[a.bitten]) { a.bitten++; this.biteFx(); }
      }
    }
  }
  think() {
    if (this.grabbing) return;
    super.think();
  }
  onNewTarget(t) {
    if (Math.random() < 0.4) this.roar();
  }
  roar() {
    if (G.time - this.lastRoar < 9 || this.grabbing) return;
    this.lastRoar = G.time;
    this.startAction('roar', 1.9);
    this.stop();
    play('roar', this.position, 1.2);
    shake(0.8, this.position);
    emitNoise(this.position, 45, 'roar', this);
  }
  onDamaged(amount, info) {
    if (this.grabbing) {
      this.damageWhileGrab += amount;
      if (this.damageWhileGrab > this.maxHealth * 0.12) { this.releaseGrab(); this.roar(); }
      return;
    }
    if (amount > 15 && Math.random() < 0.5) this.roar();
    if (info.attacker && info.attacker !== this && this.attitudeTo(info.attacker) !== 'friendly') {
      this.addGrudge(info.attacker, 30);
      if (!this.target) { this.target = info.attacker; this.lastSeen = G.time; this.lastKnown = info.attacker.position.clone(); this.state = 'chase'; }
    }
  }
  onBlocked(hit) {
    // shove objects out of the way
    const o = hit.owner;
    if (!o || (o.type !== 'prop' && o.type !== 'vehicle') || !o.entity.body || !o.entity.body.isDynamic()) return;
    if (G.time - (this._lastShove || 0) < 1) return;
    this._lastShove = G.time;
    const body = o.entity.body;
    const side = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
    const dir = side.add(this.forward().multiplyScalar(0.6)).add(new THREE.Vector3(0, 0.7, 0)).normalize();
    const m = Math.min(body.mass(), 1500);
    body.applyImpulse(dir.multiplyScalar(m * 9), true);
    body.applyTorqueImpulse({ x: rand(-1, 1) * m, y: rand(-1, 1) * m, z: rand(-1, 1) * m }, true);
    if (o.entity) o.entity.lastThrower = this;
    if (!this.action) this.startAction('swipe', 0.7, { side: 'R' });
    play('thud', hit.point, 1.2);
    shake(0.25, hit.point);
    this._blocked = null;
  }
  onFootstep() {
    play('stomp', this.position, this.def.scaleSfx ?? 0.8);
    shake(0.12 * (this.def.scaleSfx ?? 1), this.position);
  }
  extraAnim(b, t, dt) {
    if (this.rig.jaw && (!this.action || !['feed', 'roar'].includes(this.action.name))) this.rig.jaw.rotation.x = 0.08 + Math.sin(t * 2.3) * 0.05;
  }
  animCustom(b, a, k, t) {
    const jaw = this.rig.jaw;
    switch (a.name) {
      case 'reach': {
        const e = Math.min(1, k * 1.6);
        b.uArmR.rotation.x = -1.55 * e; b.lArmR.rotation.x = -0.15; b.uArmR.rotation.z = -0.1;
        b.uArmL.rotation.x = -1.2 * e; b.uArmL.rotation.z = 0.25;
        b.chest.rotation.x += 0.15 * e; if (jaw) jaw.rotation.x = 0.4 * e;
        break;
      }
      case 'lift': {
        const e = 1 - Math.pow(1 - k, 2);
        b.uArmR.rotation.x = -1.55 - 0.75 * e; b.lArmR.rotation.x = -0.15 - 0.5 * e; b.uArmR.rotation.z = -0.1 + 0.15 * e;
        b.uArmL.rotation.x = -0.6; b.uArmL.rotation.z = 0.3; b.chest.rotation.x = 0.35 - 0.25 * e; b.head.rotation.x = -0.5;
        if (jaw) jaw.rotation.x = 0.2 + 0.15 * Math.sin(t * 6);
        break;
      }
      case 'feed': {
        b.uArmR.rotation.x = -2.3; b.lArmR.rotation.x = -0.65; b.uArmR.rotation.z = 0.05;
        b.uArmL.rotation.x = -1.6; b.lArmL.rotation.x = -0.9; b.uArmL.rotation.z = -0.15;
        // lunging bites
        let lunge = 0;
        for (const bt of (a.bites || [])) { const d = a.t - bt; if (d > -0.25 && d < 0.2) lunge = Math.max(lunge, 1 - Math.abs(d + 0.025) / 0.225); }
        b.chest.rotation.x = 0.1 + lunge * 0.35; b.head.rotation.x = -0.35 + lunge * 0.55;
        if (jaw) jaw.rotation.x = 0.9 * (1 - lunge) + 0.05;
        break;
      }
      case 'roar': {
        const e = Math.sin(Math.min(1, k * 1.1) * Math.PI);
        b.chest.rotation.x = 0.5 - 0.65 * e; b.head.rotation.x = -0.45 - 0.5 * e;
        b.uArmL.rotation.z = 0.2 + 1.0 * e; b.uArmR.rotation.z = -0.2 - 1.0 * e;
        b.uArmL.rotation.x = -0.5 * e; b.uArmR.rotation.x = -0.5 * e; b.lArmL.rotation.x = -0.7 * e; b.lArmR.rotation.x = -0.7 * e;
        if (jaw) jaw.rotation.x = 1.0 * e + Math.sin(t * 40) * 0.05 * e;
        break;
      }
    }
  }
}
