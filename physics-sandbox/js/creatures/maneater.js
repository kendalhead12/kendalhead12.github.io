// The Maneater: a ~10ft hunched humanoid monster that hunts, grabs and lifts its prey.
import * as THREE from 'three';
import { G, emitNoise } from '../state.js';
import { settings } from '../config.js';
import { rand } from './creature.js';
import { Hunter } from './zombie.js';
import { buildHumanoid } from './rig.js';
import { play } from '../audio.js';
import { burst, shake, addDecal } from '../effects.js';
import { goreOn, severPart, afterSever, spawnChunks, subtree } from '../gore.js';

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
    this.startAction('lift', 1.3, { onDone: () => this.startEating() });
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
  releaseGrab(silent = false, toss = null) {
    const t = this.grabbing;
    this.grabbing = null; this.eating = null; this.meal = null;
    if (this.action && ['lift', 'feed', 'reach', 'eat'].includes(this.action.name)) this.action = null;
    if (t && !t.removed) {
      t.grabbedBy = null;
      if (t.body) { t.setHeld(false); if (t.collider) t.collider.setSensor(false); }
      if (!t.alive && t.body && !t.ragdoll) {
        // drop (or throw away) what's left of the body
        const v = toss || new THREE.Vector3(0, -1, 0);
        if (settings.ragdolls) t.becomeRagdoll(v); else { t.deathFall = { t: 0 }; t.removeCapsule(); }
      } else if (t.alive && t.crippled && t.body) {
        // no legs left: drop to the ground and bleed out
        if (settings.ragdolls) { t.knockDown({ dir: new THREE.Vector3(0, -1, 0), impulse: t.knockThreshold * 1.2 }); t.getupTimer = 1e9; }
      } else if (t.alive && t.scare && !silent) { t.rig.setFace('scared'); t.scare(this, this.position, { shock: false }); }
    }
  }

  // ---------- eating ----------
  mouthPos() {
    const hr = this.rig.headR;
    return this.rig.bones.head.localToWorld(new THREE.Vector3(0, hr * 0.62, hr * 1.05));
  }
  startEating() {
    const t = this.grabbing;
    if (!t) return;
    if (!goreOn()) { this.feed(); return; }   // non-graphic attack when gore is disabled
    this.eating = t;
    const arms = Math.random() < 0.5 ? ['uArmL', 'uArmR'] : ['uArmR', 'uArmL'];
    const r = Math.random();
    let plan, end;
    if (r < 0.38) { plan = [arms[0], 'head', arms[1], 'chest', 'thighL', 'thighR']; end = 'devour'; }       // eats everything
    else if (r < 0.72) { plan = (Math.random() < 0.6 ? [arms[0]] : []).concat(['head', 'chest']); end = 'discard'; } // eats the top half
    else { plan = ['thighL', 'thighR', 'head']; end = 'discard'; }                                                     // eats the legs first
    this.meal = { steps: plan.map(part => ({ part, rip: /Arm|thigh/.test(part) && Math.random() < 0.25 })), i: 0, t: 0, end, stains: 0, chewT: 0, k: 0 };
    this.startAction('eat', 999);
    play('growl', this.position, 1);
  }
  updateMeal(dt) {
    const m = this.meal, t = this.grabbing;
    let step = m.steps[m.i];
    while (step && t.severed.has(step.part)) { m.i++; m.t = 0; step = m.steps[m.i]; }
    if (!step) { this.finishMeal(); return; }
    m.t += dt;
    const BRING = 0.5, CHEW = step.rip ? 0.6 : 1.0;
    m.phase = m.t < BRING ? 'bring' : 'chew';
    m.rip = step.rip;
    m.k = m.t < BRING ? Math.sin(m.t / BRING * Math.PI / 2) : (step.rip ? Math.max(0.3, 1 - (m.t - BRING) / CHEW) : 1 - Math.max(0, (m.t - BRING - CHEW * 0.7) / (CHEW * 0.3)) * 0.4);
    if (m.t >= BRING && !step.done) { step.done = true; this.bite(step); }
    if (m.phase === 'chew' && !step.rip) {
      m.chewT += dt;
      if (m.chewT > 0.22) {
        m.chewT = 0;
        const mp = this.mouthPos();
        play('chew', mp, 0.8);
        burst('drip', mp, 2, new THREE.Vector3(0, -1, 0), 0.5, 0.4);
      }
    }
    if (m.t >= BRING + CHEW) { m.i++; m.t = 0; }
  }
  bite(step) {
    const t = this.grabbing;
    const mp = this.mouthPos();
    if (step.rip) {
      // tear it off with the other hand and fling it away
      const side = new THREE.Vector3(-Math.cos(this.yaw), 0.8, Math.sin(this.yaw)).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      severPart(t, step.part, { dir: side.add(this.forward()).normalize(), force: 9 });
      play('roar', this.position, 0.5);
    } else {
      severPart(t, step.part, { eaten: true, silent: true });
      play('crunch', mp, 1.2); play('gore', mp, 1);
      burst('blood', mp, 30, this.forward().negate().add(new THREE.Vector3(0, -0.5, 0)), 0.9, 1.1);
      if (step.part === 'chest' || step.part === 'thighL' || step.part === 'thighR') spawnChunks(mp, 3, new THREE.Vector3(0, -1, 0), 1.5);
      if (this.meal.stains++ < 8) addDecal(mp, this.forward(), 'stain', 0.08 + Math.random() * 0.08, this.rig.bones.head);
    }
    shake(0.5, mp);
    if (t.alive) { t.setFaceFor('pain', 1.5); if (t.scream) t.scream(); }
    afterSever(t, step.part);
  }
  finishMeal() {
    const t = this.grabbing;
    const m = this.meal;
    if (m.end === 'devour') {
      const mp = this.mouthPos();
      burst('blood', mp, 25, new THREE.Vector3(0, -1, 0), 0.8);
      spawnChunks(t.position.add(new THREE.Vector3(0, 0.6, 0)), 6, new THREE.Vector3(0, -1, 0), 2);
      const g = G.map.groundBelow(this.position.add(this.forward()));
      import('../effects.js').then(e => e.bloodPool(new THREE.Vector3(mp.x, g + 0.012, mp.z), 1.6));
      this.grabbing = null; this.eating = null; this.meal = null; this.action = null;
      t.grabbedBy = null;
      t.remove();
    } else {
      const toss = this.forward().multiplyScalar(-0.5).add(new THREE.Vector3(-Math.cos(this.yaw) * 5, 3, Math.sin(this.yaw) * 5).multiplyScalar(Math.random() < 0.5 ? 1 : -1));
      this.releaseGrab(true, toss);
      play('thud', this.position, 0.8);
    }
    play('growl', this.position, 1);
    this.feedCooldown = G.time + 20;
    this._lastAtk = G.time + 1.5;
  }

  // ---------- scavenging corpses ----------
  findCorpse() {
    let best = null, bd = 26;
    const p = this.position;
    for (const c of G.creatures) {
      if (c.alive || c.removed || !c.ragdoll || c.kind === 'maneater' || c.kind === 'skeleton' || c.kind === 'dummy' || c.eatenBy) continue;
      const left = Object.keys(c.ragdoll.parts).filter(n => n !== 'pelvis').length;
      if (left < 1) continue;
      const d = c.position.distanceTo(p);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  scavenge(dt) {
    const c = this.corpse;
    if (!c || c.removed || !c.ragdoll) { this.endScavenge(); return; }
    const cp = c.position;
    const d = Math.hypot(cp.x - this.position.x, cp.z - this.position.z);
    if (d > 1.9) { this.setPathTo(cp); this.followPath(Math.max(this.walkSpeed * 1.5, this.runSpeed * 0.5)); return; }
    this.stop(); this.faceTo(cp);
    if (!this.action) this.startAction('crouchFeed', 1.4, { hitAt: 0.6, onHit: () => this.biteCorpse() });
  }
  biteCorpse() {
    const c = this.corpse;
    if (!c || c.removed || !c.ragdoll) return;
    const names = Object.keys(c.ragdoll.parts).filter(n => n !== 'pelvis');
    const mp = this.mouthPos();
    if (!names.length) {
      // nothing left but the hips: finish it off
      const t = c.ragdoll.parts.pelvis.body.translation();
      spawnChunks(new THREE.Vector3(t.x, t.y, t.z), 4, new THREE.Vector3(0, 1, 0), 1.5);
      c.remove();
      this.endScavenge();
      return;
    }
    // the part nearest the mouth, preferring outer limbs (subtree size 1)
    names.sort((a, b) => {
      const pa = c.ragdoll.parts[a].body.translation(), pb = c.ragdoll.parts[b].body.translation();
      const sa = subtree(c.rig, a).length, sb = subtree(c.rig, b).length;
      return (Math.hypot(pa.x - mp.x, pa.y - mp.y, pa.z - mp.z) + sa * 0.3) - (Math.hypot(pb.x - mp.x, pb.y - mp.y, pb.z - mp.z) + sb * 0.3);
    });
    const name = names[0];
    const bt = c.ragdoll.parts[name].body.translation();
    const at = new THREE.Vector3(bt.x, bt.y, bt.z);
    severPart(c, name, { eaten: true, silent: true });
    burst('blood', at, 24, new THREE.Vector3(0, 1, 0), 1, 1);
    play('crunch', at, 1.1); play('gore', at, 0.9);
    this.corpseBites = (this.corpseBites || 0) + 1;
    if ((this.mealStains = (this.mealStains || 0) + 1) < 10) addDecal(mp, this.forward(), 'stain', 0.1, this.rig.bones.head);
    // sometimes it leaves the rest
    if (this.corpseBites >= this.corpseLimit) this.endScavenge();
  }
  endScavenge() {
    if (this.corpse) this.corpse.eatenBy = null;
    this.corpse = null; this.corpseBites = 0;
    if (this.state === 'scavenge') this.state = 'wander';
    if (this.action && this.action.name === 'crouchFeed') this.action = null;
    this.feedCooldown = G.time + 15;
    play('growl', this.position, 0.8);
  }
  act(dt) {
    if (this.grabbing) { this.stop(); return; }
    if (this.state === 'scavenge') { this.scavenge(dt); return; }
    super.act(dt);
  }
  update(dt) {
    super.update(dt);
    if (this.grabbing && this.alive && !this.ragdoll) {
      const t = this.grabbing;
      if (t.removed || !t.body || (!t.alive && !this.eating)) { this.releaseGrab(); return; }
      const rig = this.rig;
      rig.root.updateMatrixWorld(true);
      const hand = rig.bones.lArmR.localToWorld(rig.handLocal.clone());
      // hold the prey by the torso, facing the Maneater
      const feet = hand.clone().add(new THREE.Vector3(0, -t.height * 0.72, 0)).addScaledVector(this.forward(), 0.12);
      t.yaw = t.targetYaw = this.yaw + Math.PI;
      if (this.meal) {
        this.updateMeal(dt);
        if (!this.grabbing) return;
        // bring the part being eaten up to the mouth
        const step = this.meal.steps[this.meal.i];
        if (step && !t.severed.has(step.part)) {
          const seg = t.rig.segments.find(s => s.name === step.part);
          t.rig.root.updateMatrixWorld(true);
          const partPos = t.rig.bones[step.part].localToWorld(seg.center.clone());
          const off = this.mouthPos().sub(partPos).addScaledVector(this.forward(), 0.15);
          if (step.rip) off.multiplyScalar(0.4);
          this.meal.off = (this.meal.off || new THREE.Vector3()).lerp(off, Math.min(1, dt * 8));
        }
        if (this.meal.off) feet.addScaledVector(this.meal.off, this.meal.k);
      }
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
    if (this.target && this.state === 'chase') { if (this.corpse) this.endScavenge(); return; }
    if (this.state !== 'scavenge' && !this.corpse && goreOn() && G.time > (this.feedCooldown || 0)) {
      const c = this.findCorpse();
      if (c) { this.corpse = c; c.eatenBy = this; this.state = 'scavenge'; this.corpseBites = 0; this.corpseLimit = Math.random() < 0.4 ? 99 : 3 + ((Math.random() * 3) | 0); this.path = null; }
    }
    if (this.corpse && this.state !== 'scavenge') this.endScavenge();
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
    if (this.rig.jaw && (!this.action || !['feed', 'roar', 'eat', 'crouchFeed'].includes(this.action.name))) this.rig.jaw.rotation.x = 0.08 + Math.sin(t * 2.3) * 0.05;
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
      case 'eat': {
        const m = this.meal || { k: 0, phase: 'bring' };
        b.uArmR.rotation.x = -1.75; b.lArmR.rotation.x = -1.1; b.uArmR.rotation.z = 0.15;
        if (m.rip && m.phase === 'chew') { b.uArmL.rotation.x = -0.4; b.uArmL.rotation.z = 0.9; b.lArmL.rotation.x = -0.2; }
        else { b.uArmL.rotation.x = -1.7; b.lArmL.rotation.x = -0.9; b.uArmL.rotation.z = -0.2; }
        const bite = m.phase === 'bring' ? m.k : 0;
        b.chest.rotation.x = 0.15 + bite * 0.25 + (m.phase === 'chew' ? Math.sin(t * 9) * 0.04 : 0);
        b.head.rotation.x = -0.3 + bite * 0.35 + (m.phase === 'chew' ? Math.sin(t * 14) * 0.08 : 0);
        b.head.rotation.z = m.phase === 'chew' ? Math.sin(t * 7) * 0.12 : 0;
        if (jaw) jaw.rotation.x = m.phase === 'bring' ? 0.2 + 0.85 * m.k : 0.15 + Math.abs(Math.sin(t * 14)) * 0.45;
        break;
      }
      case 'crouchFeed': {
        b.pelvis.position.y = b.pelvis.userData.rest.y * 0.42;
        b.thighL.rotation.x = -1.45; b.thighR.rotation.x = -1.2; b.shinL.rotation.x = 2.2; b.shinR.rotation.x = 1.9;
        const lunge = Math.max(0, Math.sin(Math.min(1, k / 0.6) * Math.PI));
        b.chest.rotation.x = 1.15 + lunge * 0.25; b.head.rotation.x = -0.35 + lunge * 0.3 + (k > 0.6 ? Math.sin(t * 14) * 0.08 : 0);
        b.uArmL.rotation.x = -1.1; b.uArmR.rotation.x = -1.0 - lunge * 0.3; b.lArmL.rotation.x = -0.4; b.lArmR.rotation.x = -0.4;
        b.uArmL.rotation.z = 0.35; b.uArmR.rotation.z = -0.35;
        if (jaw) jaw.rotation.x = k < 0.6 ? 0.2 + lunge * 0.8 : 0.15 + Math.abs(Math.sin(t * 14)) * 0.4;
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
