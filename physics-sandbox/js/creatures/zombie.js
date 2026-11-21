// Zombies (walker / runner / brute / crawler), skeletons and training dummies.
import * as THREE from 'three';
import { G } from '../state.js';
import { settings, aiProfile } from '../config.js';
import { Creature, rand, pick } from './creature.js';
import { buildHumanoid } from './rig.js';
import { humanAppearance } from './human.js';
import { play } from '../audio.js';
import { burst } from '../effects.js';

// Generic hostile melee AI shared by zombies and skeletons.
export class Hunter extends Creature {
  constructor(def, pos, opts) {
    super(def, pos, opts);
    this.target = null;
    this.lastSeen = -99;
    this.lastKnown = null;
    this.lastNoiseCheck = G.time;
    this.state = 'wander';
    this.voicePitch = rand(0.8, 1.2);
    this.fovCos = def.fovCos ?? -0.3;
  }
  pickTarget() {
    const seen = this.perceive(aiProfile().sight * (this.def.sightMul ?? 0.8));
    let n = 0;
    for (const s of seen) {
      if (!this.isHostile(s.ent)) continue;
      if (s.ent.isPlayer && (s.ent.noclip || s.ent.inVehicle && s.dist > 3)) continue;
      if (n++ > 2) break;
      if (s.dist < 3 || this.canSee(s.ent)) return s.ent;
    }
    return null;
  }
  think() {
    const t = this.pickTarget();
    if (t) {
      if (t !== this.target) this.onNewTarget && this.onNewTarget(t);
      this.target = t; this.lastSeen = G.time; this.lastKnown = t.position.clone(); this.state = 'chase';
    } else if (this.target && (!this.target.alive || G.time - this.lastSeen > 6)) {
      this.target = null; this.state = this.lastKnown ? 'search' : 'wander';
    }
    // noises attract
    const heard = this.hearNoises(this.lastNoiseCheck);
    this.lastNoiseCheck = G.time;
    if (!this.target && heard.length) {
      const n = heard[heard.length - 1];
      if (!n.source || n.source === G.player || (n.source.faction && this.isHostile(n.source)) || n.type === 'explosion' || n.type === 'gunshot' || n.type === 'scream') {
        this.lastKnown = n.pos.clone(); this.state = 'search'; this.searchStart = G.time; this.path = null;
      }
    }
    if (this.lastAttacker && this.lastAttacker.alive && !this.target && this.lastAttacker !== this && this.attitudeTo(this.lastAttacker) !== 'friendly') {
      this.target = this.lastAttacker; this.lastSeen = G.time; this.lastKnown = this.target.position.clone(); this.state = 'chase';
      this.addGrudge(this.lastAttacker, 20);
    }
    if (Math.random() < (this.def.groanRate ?? 0.05) && this.def.idleSound) play(this.def.idleSound, this.position, 0.8, 1, this.voicePitch);
  }
  act(dt) {
    const p = this.position;
    if (this.state === 'chase' && this.target) {
      const tp = this.target.position;
      const d = Math.hypot(tp.x - p.x, tp.z - p.z);
      const reach = (this.def.reach ?? 1.1) + (this.target.radius || 0.3);
      if (d > reach * 0.8) {
        this.setPathTo(tp);
        this.followPath(this.runSpeed);
      } else { this.stop(); this.faceTo(tp); }
      if (d < reach && !this.action && G.time - (this._lastAtk || 0) > (this.def.attackCooldown ?? 1.2)) {
        this._lastAtk = G.time;
        this.attack(this.target);
      }
    } else if (this.state === 'search' && this.lastKnown) {
      if (!this.path) this.setPathTo(this.lastKnown, true);
      const rem = this.followPath(this.walkSpeed * 1.6);
      if (rem < 1.5 || G.time - (this.searchStart || 0) > 15) { this.state = 'wander'; this.lastKnown = null; this.path = null; }
    } else {
      // wander slowly
      if (!this.path || this.stateTime > 12 || this.followPath(this.walkSpeed) < 0.6) {
        if (this.stateTime > 2 || !this.path) {
          this.stateTime = 0;
          const a = Math.random() * Math.PI * 2, r = rand(3, 12);
          const g = new THREE.Vector3(p.x + Math.sin(a) * r, 0, p.z + Math.cos(a) * r);
          if (G.map.walkable(g.x, g.z)) this.setPathTo(g, true); else this.path = null;
          if (Math.random() < 0.3) this.path = null;
        }
        this.stop();
      }
    }
  }
  attack(t) {
    const side = Math.random() < 0.5 ? 'L' : 'R';
    if (this.def.attackSound) play(this.def.attackSound, this.position, 0.9, 1);
    this.startAction(this.def.attackAnim || 'swipe', this.def.attackDur ?? 0.7, {
      side, hitAt: (this.def.attackDur ?? 0.7) * 0.55, onHit: () => this.landHit(t),
    });
  }
  landHit(t) {
    if (!this.alive || !t || !t.alive) return;
    const tp = t.position, p = this.position;
    const d = Math.hypot(tp.x - p.x, tp.z - p.z);
    if (d > (this.def.reach ?? 1.1) + 0.6 + (t.radius || 0.3)) return;
    const dir = new THREE.Vector3(tp.x - p.x, 0.3, tp.z - p.z).normalize();
    const point = t.isPlayer ? t.eyePos().add(new THREE.Vector3(0, -0.3, 0)) : t.position.add(new THREE.Vector3(0, (t.height || 1.7) * 0.7, 0));
    const [a, b] = this.def.damage || [10, 18];
    t.takeDamage(rand(a, b), { type: this.def.hitType || 'bite', dir, point, attacker: this, part: 'chest', impulse: this.def.hitImpulse ?? 150 });
    play(this.def.hitSound || 'punch', point, 0.9);
  }
  possessedAttack() {
    const f = this.forward();
    let best = null, bd = 2.5;
    for (const c of G.creatures) {
      if (c === this || !c.alive) continue;
      const d = c.position.distanceTo(this.position);
      if (d < bd && c.position.clone().sub(this.position).setY(0).normalize().dot(f) > 0.3) { best = c; bd = d; }
    }
    this.attack(best);
  }
  onDamaged(amount, info) {
    // stumble when struck
    if (amount > 0 && this.def.stumbleChance && Math.random() < this.def.stumbleChance && !this.ragdoll && info.type !== 'blast'
      && (info.impulse || 0) > this.knockThreshold * 0.35 && settings.ragdolls) {
      this.knockDown({ ...info, impulse: Math.max(info.impulse || 0, this.knockThreshold * 1.1) });
    } else if (amount > 0 && !this.action) {
      this.pushVel = (this.pushVel || new THREE.Vector3()).add((info.dir || new THREE.Vector3()).clone().setY(0).multiplyScalar(1.5));
    }
  }
}

export class Zombie extends Hunter {}

// ---------- appearance builders ----------
const ZSKIN = [0x8fa37a, 0x7d9168, 0x9aa88a, 0xa4a690, 0x6f8466];
export function zombieRig(variant) {
  return (opts = {}) => {
    const ap = humanAppearance();
    const v = { ...ap, skin: pick(ZSKIN), shirt: dim(ap.shirt), pants: dim(ap.pants), face: 'zombie', hairStyle: pick(['short', 'none', 'long']), ...variant };
    const rig = buildHumanoid(v);
    // torn clothing patches
    rig.root.userData.zombie = true;
    return rig;
  };
}
function dim(c) { const col = new THREE.Color(c); col.multiplyScalar(0.55); col.lerp(new THREE.Color(0x4a4030), 0.35); return col.getHex(); }

export function skeletonRig() {
  return () => buildHumanoid({
    skin: 0xe8e0cc, shirt: 0xe8e0cc, pants: 0xe8e0cc, shoes: 0xd8d0bc, hairStyle: 'none', face: 'skull', nose: false,
    thighR: 0.035, shinR: 0.03, uArmR: 0.028, lArmR: 0.024, torsoW: 0.3, torsoD: 0.16, sleeves: 'none',
    extras: (rig, { addMesh, M, L, boxGeo, capsuleGeo }) => {
      // replace torso box with ribs
      rig.torsoMesh.visible = false;
      const bone = M(0xe8e0cc);
      const chest = rig.bones.chest;
      addMesh(chest, capsuleGeo(L(0.025), L(0.5)), bone, [0, L(0.25), -L(0.06)]);
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(L(0.14 - i * 0.008), L(0.014), 6, 14, Math.PI * 1.6), bone);
        r.rotation.set(Math.PI / 2, 0, Math.PI * 0.7);
        r.position.set(0, L(0.2 + i * 0.055), 0);
        r.castShadow = true; chest.add(r); rig.meshes.push(r);
      }
      const pel = rig.bones.pelvis.children[0]; pel.scale.set(1, 0.6, 0.7);
    },
  });
}

export function dummyRig() {
  return () => buildHumanoid({
    skin: 0xd9b98c, shirt: 0xd9b98c, pants: 0xc9a97c, shoes: 0x8a6a4a, hairStyle: 'none', face: 'dummy', nose: false, sleeves: 'none',
    extras: (rig, { addMesh, M, L, sphereGeo }) => {
      const joint = M(0x777777, { metalness: 0.7, roughness: 0.35 });
      for (const n of ['uArmL', 'uArmR', 'lArmL', 'lArmR', 'thighL', 'thighR', 'shinL', 'shinR', 'head']) addMesh(rig.bones[n], sphereGeo(L(0.06)), joint, [0, 0, 0]);
      // target rings on the chest
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      for (let i = 4; i > 0; i--) { x.fillStyle = i % 2 ? '#c03030' : '#f0e8d8'; x.beginPath(); x.arc(32, 32, i * 7.5, 0, 6.3); x.fill(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L(0.22), L(0.22)), new THREE.MeshStandardMaterial({ map: t, transparent: true }));
      p.position.set(0, L(0.3), L(0.101)); rig.bones.chest.add(p);
    },
  });
}

// Dummies just stand there (optionally wobble) and take hits.
export class Dummy extends Creature {
  constructor(def, pos, opts) { super(def, pos, opts); this.state = 'idle'; }
  think() {}
  act() { this.stop(); }
  onDamaged(amount, info) {
    play('wood', this.position.add(new THREE.Vector3(0, 1.2, 0)), 0.6);
    this._wobble = 1;
    this._wobbleDir = (info.dir || new THREE.Vector3(1, 0, 0)).clone();
  }
  extraAnim(b, t, dt) {
    if (this._wobble > 0) {
      this._wobble = Math.max(0, this._wobble - dt * 1.5);
      const w = Math.sin(t * 18) * 0.25 * this._wobble;
      b.chest.rotation.x += w * this._wobbleDir.z; b.chest.rotation.z -= w * this._wobbleDir.x;
    }
    b.uArmL.rotation.z = 0.35; b.uArmR.rotation.z = -0.35;
  }
}

export function spawnBlood(pos) { burst('blood', pos, 8); }
