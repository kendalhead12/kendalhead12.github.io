// Human NPCs: wandering, chatting, fear/panic, hiding, warning others, anger and self-defence.
import * as THREE from 'three';
import { G, emitNoise } from '../state.js';
import { settings, aiProfile } from '../config.js';
import { Creature, rand, pick, angleDiff } from './creature.js';
import { buildHumanoid } from './rig.js';
import { play } from '../audio.js';
import { burst } from '../effects.js';

export const LINES = {
  idle: ['What a nice day.', 'Where am I?', 'This place looks strange.', 'Hmm...', 'I wonder what\'s for lunch.', 'Is anyone else here?', 'Nice weather today.', 'I think I\'m lost.'],
  chat: ['Hey, how are you?', 'Not bad, you?', 'Did you see that?', 'Strange place, huh?', 'I heard there are monsters around here.', 'Ha! Good one.', 'I should get going.', 'Have we met before?'],
  argue: ['Watch where you\'re going!', 'Who do you think you are?', 'Say that again!', 'You looking at me?', 'Get out of my face!'],
  angry: ['Hey! What\'s your problem?!', 'You wanna fight?!', 'Back off!', 'That\'s it, you\'re done!', 'Come here!'],
  hurtCalm: ['Ow! Stop that!', 'Hey, quit it!', 'Ouch! Why?!', 'What was that for?'],
  retreat: ['Back off!', 'Leave me alone!', 'Stay away from me!'],
  scared: ['RUN!', 'Somebody help!', 'What is that thing?!', 'Oh no, oh no, oh no!', 'Get away from me!', 'HELP!'],
  monster: ['What is that thing?!', 'MONSTER!', 'RUN! RUN!', 'It\'s huge!'],
  zombie: ['Zombies!', 'They\'re coming!', 'Stay back!', 'Don\'t let them bite you!'],
  warn: ['RUN!', 'Everyone run!', 'Get out of here!', 'Danger! Over there!'],
  witness: ['No!', 'Oh my god!', 'They killed him!', 'Somebody help!'],
  calm: ['Phew... I think it\'s gone.', 'That was close.', 'Fine. Whatever.', 'Just leave me alone.'],
  win: ['That\'ll teach you!', 'And stay down!', 'Hmph.'],
  flinch: ['Whoa!', 'Watch it!', 'Hey!'],
  investigate: ['What was that?', 'Hello? Anyone there?', 'Did you hear that?'],
  grabbed: ['Somebody help!', 'Let me go!', 'NO! NO!', 'HELP ME!'],
  hello: ['Hello there.', 'Can I help you?', 'Hi!', 'Nice to meet you.', 'Yes?'],
};

const SKIN = [0xf1c8a5, 0xe0ac85, 0xc68c5e, 0x9c6a43, 0x6e4528, 0xf5d7bd];
const SHIRT = [0x3b6fb0, 0xb03b3b, 0x3b9a55, 0xd9a520, 0x7a4bb0, 0x2a2a2a, 0xeeeeee, 0x1f8a8a, 0xd86a2a, 0x5a6a7a];
const PANTS = [0x2f3542, 0x3a4a6a, 0x5a4a3a, 0x222222, 0x6a6a6a, 0x2a3a2a];
const HAIR = [0x1a1210, 0x3a2a1a, 0x6a4a2a, 0xc8a050, 0x8a3a1a, 0x9a9a9a];

export function humanAppearance(variant = {}) {
  const fem = Math.random() < 0.45;
  return {
    scale: rand(0.93, 1.05) * (fem ? 0.96 : 1),
    skin: pick(SKIN), shirt: pick(SHIRT), pants: pick(PANTS), hair: pick(HAIR),
    hairStyle: fem ? pick(['long', 'long', 'short']) : pick(['short', 'short', 'none', 'cap']),
    capColor: pick([0xaa2222, 0x2244aa, 0x222222, 0x2a7a2a]),
    sleeves: pick(['short', 'long', 'long']),
    shoulderW: fem ? 0.19 : 0.21, torsoW: fem ? 0.33 : 0.36,
    belly: Math.random() < 0.2 ? rand(0.1, 0.35) : 0,
    ...variant,
  };
}

export class Human extends Creature {
  constructor(def, pos, opts = {}) {
    super(def, pos, opts);
    const p = def.personality || {};
    this.bravery = opts.bravery ?? p.bravery ?? Math.random();
    this.temper = opts.temper ?? p.temper ?? Math.random();
    this.sociability = p.sociability ?? Math.random();
    this.voicePitch = this.rig.spec.hairStyle === 'long' ? rand(1.2, 1.45) : rand(0.85, 1.1);
    this.voice = { pitch: this.voicePitch * rand(0.9, 1.1), rate: rand(0.95, 1.15), voiceIndex: (Math.random() * 6) | 0 };
    this.dangers = [];
    this.threat = null;
    this.fightTarget = null;
    this.lastNoiseCheck = G.time;
    this.state = 'idle';
    this.stateDur = rand(1, 4);
    this.lastScream = -10;
    this.calmLine = false;
  }

  moodFace() {
    switch (this.state) {
      case 'flee': case 'panic': case 'hide': case 'cower': case 'shock': return 'scared';
      case 'fight': case 'argue': return 'angry';
      case 'chat': return 'happy';
      default: return 'neutral';
    }
  }
  setState(s, dur = 3) {
    if (this.state === s) { this.stateDur = Math.max(this.stateDur, dur); return; }
    this.state = s; this.stateTime = 0; this.stateDur = dur;
    this.path = null;
    if (s !== 'chat') this.chatTurn = undefined;
    if (this.faceTimer <= 0) this.rig.setFace(this.moodFace());
    if (s !== 'chat' && this.chatPartner) { const p = this.chatPartner; this.chatPartner = null; if (p.chatPartner === this) { p.chatPartner = null; p.setState('idle', 2); } }
    if (this.action && ['talk', 'argue', 'cower', 'wave'].includes(this.action.name)) this.action = null;
  }

  rememberDanger(pos, secs) {
    this.dangers.push({ pos: pos.clone(), until: G.time + (secs ?? aiProfile().memory), radius: 10 });
    if (this.dangers.length > 8) this.dangers.shift();
  }
  inDanger(p) { return this.dangers.some(d => d.until > G.time && d.pos.distanceTo(p) < d.radius); }

  isThreat(ent) {
    if (!ent || !ent.alive) return false;
    if (ent.kind === 'dummy') return false;
    return this.isHostile(ent);
  }

  // Become scared of `ent` (or a position)
  scare(ent, pos, { shock = true, line = null, warnOthers = true } = {}) {
    if (!settings.npcFear || !this.alive) return;
    const threatPos = pos || (ent && ent.position);
    if (!threatPos) return;
    const wasCalm = !['flee', 'panic', 'hide', 'cower', 'shock'].includes(this.state);
    this.threat = { ent, pos: threatPos.clone(), seen: G.time };
    this.rememberDanger(threatPos);
    if (!wasCalm) return;
    const isMonster = ent && ent.kind === 'maneater';
    if (line) this.say(line, { color: '#ffb0b0', priority: 2 });
    else if (isMonster) this.say(pick(LINES.monster), { color: '#ffb0b0', priority: 2 });
    else if (ent && ent.kind === 'zombie') this.say(pick(LINES.zombie), { color: '#ffb0b0', priority: 2 });
    if (Math.random() < 0.7 || isMonster) this.scream();
    // freeze briefly in shock (timid people freeze longer)
    const shockTime = shock ? (isMonster ? rand(0.5, 1.2) : rand(0.2, 0.9)) * (1.4 - this.bravery) : 0;
    if (shockTime > 0.25) { this.setState('shock', shockTime); this.startAction('shock', shockTime); }
    else this.decideFearResponse();
    if (warnOthers && aiProfile().warn) this.warnOthers();
  }
  scream() {
    if (G.time - this.lastScream < 2.5) return;
    this.lastScream = G.time;
    play('scream', this.position, 1, 1, this.voicePitch);
    emitNoise(this.position, 28, 'scream', this);
  }
  warnOthers() {
    if (G.time - (this._lastWarn || -99) < 5) return;
    this._lastWarn = G.time;
    let n = 0;
    for (const c of G.creatures) {
      if (c === this || !c.alive || c.kind !== 'human' || c.position.distanceTo(this.position) > 18) continue;
      if (n === 0) this.say(pick(LINES.warn), { color: '#ffb0b0', priority: 2 });
      n++;
      setTimeout(() => { if (c.alive && !c.removed) c.scare(this.threat && this.threat.ent, this.threat && this.threat.pos, { warnOthers: false }); }, 300 + Math.random() * 600);
    }
  }
  decideFearResponse() {
    const t = this.threat;
    const ent = t && t.ent;
    const d = t ? t.pos.distanceTo(this.position) : 99;
    const isMonster = ent && ent.kind === 'maneater';
    // brave people stand their ground against zombies that are close
    if (ent && !isMonster && ent.kind !== 'human' && !ent.isPlayer && this.bravery > 0.78 && d < 7) { this.startFight(ent, false); return; }
    if (aiProfile().hide && this.bravery < 0.7 && Math.random() < 0.5) {
      const spot = this.findHideSpot(t.pos);
      if (spot) { this.hideSpot = spot; this.setState('hide', 20); this.setPathTo(spot, true); return; }
    }
    if (this.bravery < 0.3 && Math.random() < 0.5) { this.setState('panic', rand(4, 7)); return; }
    if (d < 2.5 && this.bravery < 0.25) { this.setState('cower', rand(2, 4)); this.startAction('cower', 4); return; }
    this.setState('flee', rand(6, 10));
  }
  findHideSpot(from) {
    const nav = G.map && G.map.nav;
    if (!nav) return null;
    const p = this.position;
    const away = new THREE.Vector3(p.x - from.x, 0, p.z - from.z).normalize();
    for (let i = 0; i < 16; i++) {
      const a = Math.atan2(away.x, away.z) + rand(-1.3, 1.3);
      const r = rand(6, 22);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      if (nav.isBlocked(x, z)) continue;
      if (!nav.lineClear(from.x, from.z, x, z)) return new THREE.Vector3(x, 0, z);
    }
    return null;
  }

  startFight(target, provoked = true) {
    this.fightTarget = target;
    this.addGrudge(target, provoked ? rand(20, 40) : 30);
    this.setState('fight', 30);
    if (provoked || Math.random() < 0.5) this.say(pick(LINES.angry), { color: '#ffd27a', priority: 1 });
    this.setFaceFor('angry', 0);
  }

  onDamaged(amount, info) {
    const a = info.attacker;
    if (this.grabbedBy || this.held) return;
    if (a && a !== this && a.alive !== false) {
      const isPerson = a.isPlayer || a.kind === 'human';
      if (isPerson) {
        const retaliate = a.isPlayer ? settings.npcRetaliation : true;
        const lethal = info.type === 'bullet' || info.type === 'blast' || amount > 30;
        if (lethal && settings.npcFear && (this.bravery < 0.85 || !retaliate)) {
          this.scare(a, a.position, { line: pick(LINES.scared) });
          if (a.isPlayer && retaliate && this.bravery > 0.6) this.addGrudge(a, 40);
          return;
        }
        if (retaliate && (this.temper + this.bravery > 0.85 || this.state === 'fight')) {
          if (this.fightTarget !== a || this.state !== 'fight') this.startFight(a, true);
          else this.addGrudge(a, 30);
        } else if (retaliate && settings.npcFear) {
          this.say(pick(LINES.retreat), { color: '#ffd27a', priority: 1 });
          this.threat = { ent: a, pos: a.position.clone(), seen: G.time };
          this.setState('flee', rand(4, 7));
        } else {
          this.say(pick(LINES.hurtCalm), { color: '#ffd27a', priority: 1 });
          this.faceTo(a.position);
          if (settings.npcFear && this.bravery < 0.5) { this.threat = { ent: a, pos: a.position.clone(), seen: G.time }; this.setState('flee', 4); }
        }
      } else {
        // attacked by a monster/zombie
        if (this.bravery > 0.7 && a.kind !== 'maneater' && this.state !== 'flee') this.startFight(a, false);
        else this.scare(a, a.position, { shock: false });
      }
    } else if (amount > 5 && settings.npcFear && !['flee', 'panic', 'hide'].includes(this.state)) {
      this.scare(null, this.position.clone().add(info.dir ? info.dir.clone().multiplyScalar(-3) : new THREE.Vector3(1, 0, 0)), { shock: false });
    }
  }
  onWitnessDeath(victim, killer) {
    if (!this.alive || this.grabbedBy || this.held) return;
    if (!this.canSee(victim)) return;
    if (!settings.npcFear) { if (killer && killer.isPlayer && settings.npcRetaliation && this.bravery > 0.85) this.startFight(killer, false); return; }
    this.rememberDanger(victim.position, aiProfile().memory * 1.5);
    if (victim.kind === 'human') {
      if (killer && this.attitudeTo(killer) !== 'friendly') {
        if (killer.isPlayer && settings.npcRetaliation && this.bravery > 0.9 && this.temper > 0.6) { this.startFight(killer, false); return; }
        this.scare(killer, killer.position, { line: pick(LINES.witness) });
      } else this.scare(null, victim.position, { line: pick(LINES.witness) });
    }
  }
  onKnockedDown() { this.scream(); }

  // Heard warnings / noises
  checkNoises() {
    const heard = this.hearNoises(this.lastNoiseCheck);
    this.lastNoiseCheck = G.time;
    for (const n of heard) {
      if (['flee', 'panic', 'hide', 'cower', 'shock', 'fight'].includes(this.state)) return;
      if (!settings.npcFear) {
        if (n.type !== 'step') { this.headYawTarget = 0; this.faceTo(n.pos); }
        continue;
      }
      if (n.type === 'scream' || n.type === 'death' || n.type === 'roar') {
        if (n.type === 'roar') { this.scare(n.source, n.pos, { line: pick(LINES.monster) }); return; }
        if (this.bravery > 0.55) { this.investigatePos = n.pos.clone(); this.setState('investigate', 12); this.say(pick(LINES.investigate), { color: '#d8e8ff' }); }
        else this.scare(null, n.pos, { shock: false });
        return;
      }
      if (n.type === 'gunshot' || n.type === 'explosion') {
        if (this.bravery < 0.4) { this.scare(n.source && n.source.isPlayer ? null : n.source, n.pos, { shock: true }); return; }
        if (this.bravery > 0.6 && n.type === 'gunshot') { this.investigatePos = n.pos.clone(); this.setState('investigate', 8); return; }
        this.faceTo(n.pos); this.setState('idle', 2);
      }
    }
  }

  think() {
    const prof = aiProfile();
    this.dangers = this.dangers.filter(d => d.until > G.time);
    if (this.state === 'shock') return;
    const seen = this.perceive(prof.sight);
    // visible threats
    let threat = null, checks = 0;
    for (const s of seen) {
      if (!this.isThreat(s.ent)) continue;
      if (checks++ > 2) break;
      if (this.canSee(s.ent)) { threat = s; break; }
    }
    if (threat) {
      const ent = threat.ent;
      const personish = ent.isPlayer || ent.kind === 'human';
      if (this.state === 'fight' && this.fightTarget === ent) { /* keep fighting */ }
      else if (personish && this.state !== 'flee' && this.state !== 'fight') { this.startFight(ent, false); }
      else if (settings.npcFear) {
        if (this.threat && this.threat.ent === ent) { this.threat.pos.copy(ent.position); this.threat.seen = G.time; }
        else this.scare(ent, ent.position);
        if (this.state === 'hide' && threat.dist < 6) this.setState('flee', 6);
        if (this.state === 'cower' && threat.dist > 6) this.setState('flee', 6);
      } else if (this.bravery > 0.6 && ent.kind !== 'maneater' && threat.dist < 6) this.startFight(ent, false);
    }
    this.checkNoises();
    // dodge fast-moving props
    if (G.time - (this._lastFlinch || 0) > 2.5) {
      const p = this.position;
      for (const pr of G.props) {
        if (!pr.body || pr.removed) continue;
        const t = pr.body.translation();
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d > 5) continue;
        const v = pr.body.linvel();
        const sp = Math.hypot(v.x, v.y, v.z);
        if (sp > 7) {
          this._lastFlinch = G.time;
          if (this.state === 'idle' || this.state === 'wander' || this.state === 'chat') {
            this.say(pick(LINES.flinch), { color: '#ffffff' });
            this.startAction('shock', 0.6);
            this.pushVel = new THREE.Vector3(p.x - t.x, 0, p.z - t.z).normalize().multiplyScalar(3);
          }
          break;
        } else if (d < 3 && (this.state === 'idle') && Math.random() < 0.1) {
          this.headYawTarget = THREE.MathUtils.clamp(angleDiff(this.yaw, Math.atan2(t.x - p.x, t.z - p.z)), -1.1, 1.1);
        }
      }
    }
    // fear decays when threat lost
    if (['flee', 'panic', 'hide', 'cower'].includes(this.state) && this.threat) {
      const lost = G.time - this.threat.seen;
      const far = this.threat.pos.distanceTo(this.position);
      if ((lost > 6 && far > 18) || lost > 25 || (this.threat.ent && !this.threat.ent.alive && lost > 2)) {
        if (this.state !== 'hide' || lost > 12) {
          this.threat = null; this.setState('idle', rand(2, 4));
          if (Math.random() < 0.6) this.say(pick(LINES.calm));
        }
      }
    } else if (['flee', 'panic', 'cower'].includes(this.state) && !this.threat && this.stateTime > this.stateDur) this.setState('idle', 2);
    // fights end
    if (this.state === 'fight') {
      const t = this.fightTarget;
      const ok = t && t.alive && !t.removed && (this.grudges.get(t) || 0) > G.time && !(t.isPlayer && !settings.npcRetaliation) && !(t.isPlayer && (t.noclip || t.possessing || t.inVehicle));
      if (!ok || t.position.distanceTo(this.position) > 25) {
        if (t && !t.alive && Math.random() < 0.7) this.say(pick(LINES.win), { color: '#ffd27a', priority: 1 });
        else if (Math.random() < 0.5) this.say(pick(LINES.calm));
        this.fightTarget = null; if (t) this.grudges.delete(t);
        this.setState('idle', 3);
      }
    }
    // social behaviour
    if (this.state === 'idle' && this.stateTime > 1 && !this.chatPartner && Math.random() < 0.15 * this.sociability) {
      for (const s of seen) {
        const o = s.ent;
        if (o.kind === 'human' && s.dist < 5 && (o.state === 'idle' || o.state === 'wander') && !o.chatPartner && o.alive) {
          this.beginChat(o); break;
        }
      }
    }
    if (this.state === 'idle' && Math.random() < 0.012 * (1 + this.sociability)) this.say(pick(LINES.idle));
  }
  beginChat(o) {
    this.chatPartner = o; o.chatPartner = this;
    this.setState('chat', rand(6, 10)); o.state = 'chat'; o.stateTime = 0; o.stateDur = this.stateDur; o.path = null;
    o.rig.setFace('happy');
    this.chatTurn = 0; this.chatTimer = 0.3;
    this.arguing = this.temper > 0.7 && o.temper > 0.6 && Math.random() < 0.45;
  }

  act(dt) {
    const p = this.position;
    switch (this.state) {
      case 'idle': {
        this.stop();
        if (Math.random() < dt * 0.6) this.headYawTarget = rand(-0.9, 0.9);
        if (this.stateTime > this.stateDur) {
          const target = this.pickWanderTarget();
          if (target) { this.setPathTo(target, true); this.setState('wander', 20); }
          else this.setState('idle', rand(1, 3));
        }
        break;
      }
      case 'wander': {
        this.headYawTarget = Math.sin(G.time * 0.5 + this.id) * 0.3;
        const rem = this.followPath(this.walkSpeed);
        if (rem < 0.6 || this.stateTime > this.stateDur) this.setState('idle', rand(1.5, 5));
        else if (Math.random() < dt * 0.06) this.setState('idle', rand(1, 3));
        break;
      }
      case 'chat': {
        const o = this.chatPartner;
        if (!o || !o.alive || o.removed || o.chatPartner !== this) { this.setState('idle', 2); break; }
        this.stop(); this.faceTo(o.position); this.headYawTarget = 0;
        if (o.position.distanceTo(p) > 2.2) this.moveDir(o.position.clone().sub(p), this.walkSpeed);
        // only the initiator drives the conversation
        if (this.chatTurn !== undefined && this.chatTimer !== undefined && o.chatTurn === undefined) {
          this.chatTimer -= dt;
          if (this.chatTimer <= 0) {
            const speaker = this.chatTurn % 2 === 0 ? this : o;
            if (this.arguing && this.chatTurn >= 1) {
              speaker.say(pick(LINES.argue), { color: '#ffd27a', priority: 1 });
              speaker.startAction('argue', 2.2); speaker.rig.setFace('angry');
              if (this.chatTurn >= 3 && Math.random() < 0.55) {
                // the argument turns into a fight
                const a = Math.random() < 0.5 ? this : o, b = a === this ? o : this;
                this.chatPartner = null; o.chatPartner = null;
                a.startFight(b, true); if (b.temper > 0.4 || b.bravery > 0.5) b.startFight(a, true); else b.scare(a, a.position, { shock: false });
                this.chatTurn = undefined; break;
              }
            } else {
              speaker.say(pick(LINES.chat)); speaker.startAction('talk', 2);
            }
            this.chatTurn++; this.chatTimer = rand(2.2, 3.2);
          }
        }
        if (this.stateTime > this.stateDur) { this.chatTurn = undefined; this.setState('idle', rand(2, 4)); }
        break;
      }
      case 'investigate': {
        const g = this.investigatePos;
        if (!g) { this.setState('idle', 1); break; }
        if (!this.path) this.setPathTo(g, true);
        const rem = this.followPath(this.walkSpeed * 1.4);
        if (rem < 2) { this.stop(); this.headYawTarget = Math.sin(this.stateTime * 1.5) * 1.0; }
        if (this.stateTime > this.stateDur) this.setState('idle', 2);
        break;
      }
      case 'shock': {
        this.stop();
        if (this.threat) this.faceTo(this.threat.pos);
        if (this.stateTime > this.stateDur) { this.action = null; this.decideFearResponse(); }
        break;
      }
      case 'flee': {
        const t = this.threat;
        const from = t ? (t.ent && t.ent.alive && G.time - t.seen < 2 ? t.ent.position : t.pos) : p;
        if (!this.path || G.time - this.pathTime > 1.2 || this.followPathEmpty) {
          const away = new THREE.Vector3(p.x - from.x, 0, p.z - from.z);
          if (away.lengthSq() < 0.01) away.set(Math.random() - 0.5, 0, Math.random() - 0.5);
          away.normalize();
          let goal = null;
          for (let i = 0; i < 6; i++) {
            const a = Math.atan2(away.x, away.z) + rand(-0.7, 0.7) * (1 + i * 0.3);
            const g = new THREE.Vector3(p.x + Math.sin(a) * 16, 0, p.z + Math.cos(a) * 16);
            if (G.map.walkable(g.x, g.z) && !this.inDanger(g)) { goal = g; break; }
          }
          if (!goal) goal = new THREE.Vector3(p.x + away.x * 12, 0, p.z + away.z * 12);
          this.setPathTo(goal, true);
        }
        const rem = this.followPath(this.runSpeed * (0.9 + (1 - this.bravery) * 0.15));
        this.followPathEmpty = rem < 1;
        if (Math.random() < dt * 0.25) { this.scream(); if (Math.random() < 0.5) this.say(pick(LINES.scared), { color: '#ffb0b0', priority: 2 }); }
        if (this.stateTime > this.stateDur && (!t || G.time - t.seen > 4)) this.setState('idle', 2);
        break;
      }
      case 'panic': {
        if (!this.panicDir || Math.random() < dt * 0.8) {
          const a = Math.random() * Math.PI * 2;
          this.panicDir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
          if (this.threat) { const away = p.clone().sub(this.threat.pos).setY(0).normalize(); if (this.panicDir.dot(away) < -0.3) this.panicDir.negate(); }
        }
        this.moveDir(this.panicDir, this.runSpeed * 0.95);
        if (Math.random() < dt * 0.5) this.scream();
        if (Math.random() < dt * 0.3) this.say(pick(LINES.scared), { color: '#ffb0b0', priority: 2 });
        if (this.stateTime > this.stateDur) this.setState(this.threat ? 'flee' : 'idle', 5);
        break;
      }
      case 'hide': {
        const rem = this.followPath(this.runSpeed);
        if (rem < 0.8) {
          this.stop();
          if (!this.action || this.action.name !== 'cower') this.startAction('cower', 30);
          if (this.threat) this.faceTo(this.threat.pos);
        }
        if (this.stateTime > this.stateDur) { this.action = null; this.setState('idle', 2); }
        break;
      }
      case 'cower': {
        this.stop();
        if (!this.action) this.startAction('cower', 30);
        if (this.threat) this.faceTo(this.threat.pos);
        if (this.stateTime > this.stateDur) { this.action = null; this.setState(this.threat ? 'flee' : 'idle', 5); }
        break;
      }
      case 'fight': {
        const t = this.fightTarget;
        if (!t || !t.alive) { this.setState('idle', 1); break; }
        const tp = t.position;
        const d = Math.hypot(tp.x - p.x, tp.z - p.z);
        const reach = 0.95 + (t.radius || 0.3);
        if (d > reach) { this.setPathTo(tp); this.followPath(d > 4 ? this.runSpeed * 0.9 : this.walkSpeed * 1.6); }
        else { this.stop(); this.faceTo(tp); }
        if (d < reach + 0.2 && !this.action && G.time - (this._lastPunch || 0) > rand(0.7, 1.2)) {
          this._lastPunch = G.time;
          this.punch(t);
        }
        if (Math.random() < dt * 0.15) this.say(pick(LINES.angry), { color: '#ffd27a', priority: 1 });
        break;
      }
    }
  }
  punch(t) {
    const side = Math.random() < 0.5 ? 'L' : 'R';
    play('swing', this.position, 0.5);
    this.startAction('punch', 0.5, {
      side, hitAt: 0.25, onHit: () => {
        if (!this.alive || !t || !t.alive) return;
        const tp = t.position, p = this.position;
        const d = Math.hypot(tp.x - p.x, tp.z - p.z);
        if (d > 1.5 + (t.radius || 0.3)) return;
        const dir = new THREE.Vector3(tp.x - p.x, 0.25, tp.z - p.z).normalize();
        const point = t.isPlayer ? t.eyePos() : t.position.add(new THREE.Vector3(0, t.height * 0.75, 0));
        t.takeDamage(rand(7, 12) * (this.def.punchMul || 1), { type: 'melee', dir, point, attacker: this, part: 'chest', impulse: 140 });
        play('punch', point, 0.9);
        burst('impact', point, 4, dir.clone().negate(), 0.5);
      },
    });
  }
  possessedAttack() {
    const f = this.forward();
    let best = null, bd = 2.2;
    for (const c of [...G.creatures, G.player]) {
      if (!c || c === this || !c.alive || c.isPlayer) continue;
      const d = c.position.distanceTo(this.position);
      if (d < bd && c.position.clone().sub(this.position).setY(0).normalize().dot(f) > 0.4) { best = c; bd = d; }
    }
    if (best) this.punch(best); else { this.startAction('punch', 0.5, { side: 'R' }); play('swing', this.position, 0.5); }
  }
  pickWanderTarget() {
    const p = this.position;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, r = rand(4, 16);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      const g = new THREE.Vector3(x, 0, z);
      if (G.map.walkable(x, z) && !this.inDanger(g)) return g;
    }
    return null;
  }
  // Player pressed F on this human
  interact(player) {
    if (!this.alive) return;
    if (this.state === 'fight') { this.say(pick(LINES.angry), { color: '#ffd27a', priority: 1 }); return; }
    if (['flee', 'panic', 'hide', 'cower', 'shock'].includes(this.state)) { this.say(pick(LINES.scared), { color: '#ffb0b0', priority: 2 }); return; }
    this.setState('idle', 3);
    this.faceTo(player.position);
    this.say(pick(LINES.hello));
    this.startAction(Math.random() < 0.4 ? 'wave' : 'talk', 1.6);
  }
  onGrabbed() {
    this.setState('idle', 99);
    this.rig.setFace('scared');
    this.say(pick(LINES.grabbed), { color: '#ffb0b0', priority: 2 });
    this.scream();
  }
  extraAnim(b, t, dt) {
    if ((this.grabbedBy || this.held) && Math.random() < dt * 0.6) {
      if (Math.random() < 0.5) this.scream(); else this.say(pick(LINES.grabbed), { color: '#ffb0b0', priority: 2 });
    }
  }
}

export function humanRig(variant) { return (opts = {}) => buildHumanoid(opts.appearance || humanAppearance(variant)); }
