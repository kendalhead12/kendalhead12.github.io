// Built-in roster. Generated at startup from procedural pixel art, then stored
// exactly like user-made characters (so they can be edited, duplicated, exported).

import type { AttackDef, Box, CharacterDef, ProjectileDef, TimelineEvent, AnimationDef } from '../engine/types';
import { FORMAT_VERSION } from '../engine/types';
import { defaultAlert, defaultCharacterEffects, newAttack, newProjectile } from '../engine/defaults';
import { anim, BodySpec, generatePortrait, generateProjectileSheet, generateSheet, GeneratedSheet, standardAnimations } from './procgen';

const SCALE = 2;
type Limb = 'hF' | 'fF' | 'hB' | 'fB' | 'head' | 'body';

interface AtkSpec extends Partial<AttackDef> { poses: string[]; act: [number, number]; limb?: Limb; bw?: number; bh?: number; noBox?: boolean }

function limbBox(gs: GeneratedSheet, pose: string, limb: Limb, bw: number, bh: number): Box {
  const J = gs.joints[pose];
  if (limb === 'body') return { x: 0, y: J.hip.y * SCALE - 10, w: bw, h: bh };
  const e = J[limb];
  const ex = e.x * SCALE, ey = e.y * SCALE;
  return { x: Math.round(ex - bw + 8), y: Math.round(ey - bh / 2), w: bw, h: bh };
}

function atk(gs: GeneratedSheet, spec: AtkSpec): AttackDef {
  const { poses, act, limb = 'hF', bw = 30, bh = 18, noBox, ...rest } = spec;
  const a = newAttack(spec.type || 'light', spec.name || 'Attack');
  Object.assign(a, rest);
  if (rest.input) a.input = { ...rest.input };
  a.frames = poses.map((n, i) => ({
    ref: { sheet: 'body', index: gs.index[n] },
    boxes: !noBox && i >= act[0] && i <= act[1] ? [limbBox(gs, n, limb, bw, bh)] : [],
  }));
  a.activeFrom = act[0]; a.activeTo = act[1];
  if (noBox) a.hitbox = { x: 0, y: 0, w: 0, h: 0 };
  else if (a.frames[act[0]]?.boxes[0]) a.hitbox = { ...a.frames[act[0]].boxes[0] };
  return a;
}

/** Shared normals every built-in starts with; individual fighters override. */
function baseNormals(gs: GeneratedSheet, o: { power?: number } = {}): AttackDef[] {
  const k = o.power ?? 1;
  return [
    atk(gs, { name: 'Jab', type: 'light', input: { button: 'L', dir: 'any', motion: 'none' }, poses: ['jabA', 'jabB', 'jabC'], act: [1, 1], limb: 'hF', bw: 34, bh: 18, damage: Math.round(30 * k), startup: 4, active: 3, recovery: 7, sound: 'punch' }),
    atk(gs, { name: 'Crouch Jab', type: 'light', input: { button: 'L', dir: 'down', motion: 'none' }, poses: ['crouch', 'cJab', 'crouch'], act: [1, 1], limb: 'hF', bw: 34, bh: 16, damage: Math.round(25 * k), hitLevel: 'low', startup: 4, active: 3, recovery: 7, sound: 'punch' }),
    atk(gs, { name: 'Sweep', type: 'medium', input: { button: 'M', dir: 'down', motion: 'none' }, poses: ['sweepA', 'sweep', 'sweep', 'sweepA'], act: [1, 2], limb: 'fF', bw: 48, bh: 18, damage: Math.round(60 * k), hitLevel: 'low', knockdown: true, startup: 8, active: 4, recovery: 18, sound: 'kick' }),
    atk(gs, { name: 'Rising Upper', type: 'heavy', input: { button: 'H', dir: 'down', motion: 'none' }, poses: ['upperA', 'upperB', 'upperB', 'upperA'], act: [1, 2], limb: 'hF', bw: 34, bh: 70, damage: Math.round(80 * k), launcher: true, knockup: 10, startup: 7, active: 5, recovery: 22, sound: 'punch' }),
    atk(gs, { name: 'Air Punch', type: 'light', stance: 'air', input: { button: 'L', dir: 'any', motion: 'none' }, poses: ['jumpTuck', 'airPunch', 'airPunch'], act: [1, 2], limb: 'hF', bw: 34, bh: 22, damage: Math.round(35 * k), hitLevel: 'overhead', startup: 4, active: 6, recovery: 6, sound: 'punch' }),
    atk(gs, { name: 'Air Kick', type: 'medium', stance: 'air', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['jumpTuck', 'airKick', 'airKick'], act: [1, 2], limb: 'fF', bw: 38, bh: 26, damage: Math.round(55 * k), hitLevel: 'overhead', startup: 6, active: 7, recovery: 8, sound: 'kick' }),
    atk(gs, { name: 'Air Heavy Kick', type: 'heavy', stance: 'air', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['jumpTuck', 'airKickH', 'airKickH', 'jumpTuck'], act: [1, 2], limb: 'fF', bw: 44, bh: 26, damage: Math.round(80 * k), hitLevel: 'overhead', startup: 8, active: 6, recovery: 10, shake: 2, sound: 'kick' }),
    atk(gs, { name: 'Throw', type: 'throw', input: { button: 'G', dir: 'any', motion: 'none' }, poses: ['graspA', 'graspA', 'graspB', 'tossA', 'tossB', 'tossB'], act: [1, 1], limb: 'hF', bw: 26, bh: 40, damage: Math.round(110 * k), startup: 4, active: 3, recovery: 30, throwRange: 52, throwDir: 'forward', sound: 'throw' }),
  ];
}

function replace(list: AttackDef[], name: string, a: AttackDef) {
  const i = list.findIndex(x => x.name === name);
  if (i >= 0) list[i] = a; else list.push(a);
}

let evN = 0;
const ev = (t: number, track: TimelineEvent['track'], o: Partial<TimelineEvent>): TimelineEvent => ({ id: `ev${++evN}`, t, track, ...o });

function finalize(c: Omit<CharacterDef, 'formatVersion'>): CharacterDef {
  return { formatVersion: FORMAT_VERSION, ...c, updatedAt: Date.now() } as CharacterDef;
}

// ============================================================================
export function buildKaito(): CharacterDef {
  const body: BodySpec = { skin: '#f0c08a', hair: '#2a2030', top: '#f4f4f0', pants: '#e8e8e2', belt: '#1e1e1e', gloves: '#c83232', boots: '#d9a066', accent: '#c03030', outline: '#140c18', eye: '#202060', build: 1, tall: 1, hairStyle: 'spiky', headband: '#d02828' };
  const gs = generateSheet(body, 'Kaito Body');
  const fx = generateProjectileSheet('#bfefff', '#2f7bff');
  const anims: Record<string, AnimationDef> = {
    ...standardAnimations(gs),
    mr_pose: anim(gs, ['power0', 'power1', 'power1'], 6, false),
    mr_dash: anim(gs, ['dash', 'dash2'], 14, true),
    mr_hit: anim(gs, ['jabB', 'strB'], 12, false),
    mr_kick: anim(gs, ['kneeUp', 'kickHigh'], 12, false),
    mr_blast: anim(gs, ['fireA', 'fireB', 'fireC'], 10, false),
  };
  const kiblast: ProjectileDef = {
    ...newProjectile('Ki Blast'), id: 'kiblast',
    spawnAnim: [{ sheet: 'fx', index: 0 }, { sheet: 'fx', index: 1 }], travelAnim: [2, 3, 4, 5].map(i => ({ sheet: 'fx', index: i })), impactAnim: [6, 7, 8, 9].map(i => ({ sheet: 'fx', index: i })),
    fps: 14, scale: 2.4, size: 16, damage: 70, speed: 5, color: '#bfefff', color2: '#2f7bff', trail: 'fx:energy', trailRate: 3, sound: 'projectile',
  };
  const attacks = baseNormals(gs);
  attacks.push(
    atk(gs, { name: 'Front Kick', type: 'medium', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['kneeUp', 'kickMid', 'kickMid', 'kneeUp'], act: [1, 2], limb: 'fF', bw: 40, bh: 20, damage: 55, startup: 7, active: 4, recovery: 12, sound: 'kick' }),
    atk(gs, { name: 'Straight Punch', type: 'heavy', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['strA', 'strB', 'strC', 'jabC'], act: [1, 2], limb: 'hF', bw: 44, bh: 22, damage: 90, moveX: 1.5, startup: 10, active: 5, recovery: 18, shake: 2, sound: 'punch' }),
    atk(gs, { name: 'Ki Blast', type: 'special', input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, poses: ['fireA', 'fireA', 'fireB', 'fireB', 'fireC'], act: [2, 3], noBox: true, projectile: 'kiblast', spawnAt: 13, spawnOffset: { x: 52, y: 78 }, startup: 12, active: 4, recovery: 22, damage: 0, startEffect: 'fx:energy', sound: 'special' }),
    atk(gs, { name: 'Rising Dragon', type: 'special', input: { button: 'S', dir: 'up', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dp' }, poses: ['dpA', 'dpB', 'dpB', 'dpC', 'dpC', 'jumpDown'], act: [1, 2], limb: 'hF', bw: 36, bh: 80, damage: 110, startup: 3, active: 9, recovery: 30, invincible: 8, moveY: 10.5, moveX: 2, launcher: true, knockup: 11, knockdown: true, shake: 4, glow: '#ffb84a', activeEffect: 'fx:fire', hitEffect: 'fx:bigspark', sound: 'special', cancel: 'super' }),
    atk(gs, { name: 'Hurricane Kick', type: 'special', input: { button: 'S', dir: 'back', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcb' }, poses: ['roundA', 'spinA', 'spinB', 'spinA', 'spinB', 'spinA', 'spinB', 'jumpDown'], act: [1, 6], limb: 'fF', bw: 50, bh: 30, damage: 38, hits: 3, startup: 8, active: 30, recovery: 14, moveX: 3.6, moveY: 3.4, afterimage: true, startEffect: 'fx:dust', sound: 'kick' }),
  );
  const meteor = atk(gs, { name: 'Meteor Rush', type: 'super', input: { button: 'SH', dir: 'any', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dqcf' }, poses: ['power0', 'power1'], act: [1, 1], noBox: true, energyCost: 100, invincible: 80, damage: 0, sound: 'super' });
  meteor.cinematic = {
    useTimeline: true, length: 192,
    alert: { ...defaultAlert('METEOR RUSH'), at: 12, duration: 60, subtitle: 'KAITO — SUPER ART', bgColor: '#a0001a', streakColor: '#ff7a3a' },
    timeline: [
      ev(0, 'character', { anim: 'mr_pose', vx: 0, vy: 0, dur: 78 }),
      ev(14, 'effects', { effect: 'fx:energy', ox: 0, oy: 70, dur: 10 }),
      ev(12, 'sound', { sound: 'super' }),
      ev(78, 'character', { anim: 'mr_dash', vx: 9, vy: 0, dur: 12, afterimage: true }),
      ev(78, 'camera', { zoom: 1.3, focus: 'center', dur: 110, shake: 0 }),
      ev(90, 'damage', { damage: 40, box: { x: 0, y: 20, w: 70, h: 110 }, kbx: 0.5, kby: 0, opener: true, hitEffect: 'fx:bigspark' }),
      ev(90, 'character', { anim: 'mr_hit', vx: 0.5, vy: 0, dur: 18 }),
      ev(92, 'opponent', { oppState: 'hit', dur: 16 }),
      ev(108, 'character', { anim: 'mr_kick', vx: 0, vy: 0, dur: 24 }),
      ev(108, 'damage', { damage: 50, box: { x: 0, y: 40, w: 80, h: 100 }, kbx: 0.5, kby: 0, hitEffect: 'fx:bigspark' }),
      ev(108, 'opponent', { oppState: 'float', dur: 24 }),
      ev(120, 'effects', { bg: '#ff6a00', bgStyle: 'streaks', dur: 66, darken: 0.4 }),
      ev(132, 'character', { anim: 'mr_blast', vx: 0, vy: 0, dur: 50 }),
      ev(132, 'effects', { effect: 'fx:energy', ox: 40, oy: 80, dur: 10, slowmo: 0.5 }),
      ev(140, 'damage', { damage: 90, box: { x: 0, y: 0, w: 140, h: 160 }, kbx: 7, kby: 9, final: true, launch: true, hitEffect: 'fx:shockwave' }),
      ev(140, 'dialogue', { text: 'It ends here!', speaker: 'self', dur: 50 }),
      ev(168, 'effects', { effect: 'fx:explosion', ox: 110, oy: 60, flash: '#ffffff', shake: 10 }),
      ev(168, 'sound', { sound: 'explosion' }),
    ],
  };
  attacks.push(meteor);

  return finalize({
    id: 'builtin_kaito', name: 'Kaito', description: 'A disciplined wandering martial artist. Balanced, with a fireball, an invincible uppercut and a cinematic rush super.', author: 'Pixel Fighter Engine', color: '#d02828',
    stats: { maxHealth: 1000, walkSpeed: 2.4, runSpeed: 5, jumpHeight: 125, attackPower: 1, defense: 1, dashSpeed: 7, weight: 1, width: 36, height: 124, airJumps: 0 },
    portrait: generatePortrait(body, '#d02828'), sheets: [gs.sheet, fx], scale: SCALE, facesLeft: false, animations: anims, attacks,
    projectiles: [kiblast], effectPresets: [], effects: defaultCharacterEffects('#ff8a6a'),
    dialogue: {
      intro: ['Let us test our spirits.', 'My fists will speak for me.'],
      victory: ['The answer lies in the heart of battle.', 'Train harder. Then find me again.', 'A good fight. But not good enough.'],
      vsVictory: [
        { opponent: 'Vera Volt', lines: ['Your lightning is fast, Vera, but your stance is sloppy.', 'Speed is nothing without patience, Vera.'] },
        { opponent: 'Brakk', lines: ['Strength without discipline, Brakk. That is why you fell.'] },
        { opponent: 'Nyx', lines: ['Hiding in the shadows will not save you from the light, Nyx.'] },
        { opponent: 'Kaito', lines: ['Fighting myself... the hardest opponent of all.'] },
      ],
      preFight: [
        { opponent: 'Brakk', lines: ['Brakk. I hope you have learned some control.'] },
        { opponent: 'Nyx', lines: ['Show yourself, Nyx. I know you are here.'] },
        { opponent: 'Vera Volt', lines: ['Vera. Let us keep this one honest.'] },
      ],
      taunt: ['Come!'],
    },
    sounds: {}, voices: {},
  });
}

// ============================================================================
export function buildVera(): CharacterDef {
  const body: BodySpec = { skin: '#f6d0b0', hair: '#ffd84a', top: '#2a5bd7', pants: '#1a2050', belt: '#7ff7ff', gloves: '#ffe14a', boots: '#f0f0ff', accent: '#7ff7ff', outline: '#0c0c1a', eye: '#1a8aff', build: 0.86, tall: 1.03, hairStyle: 'ponytail', sleeveless: false };
  const gs = generateSheet(body, 'Vera Body');
  const anims: Record<string, AnimationDef> = { ...standardAnimations(gs) };
  const orb: ProjectileDef = { ...newProjectile('Volt Orb'), id: 'voltorb', shape: 'orb', color: '#ffffff', color2: '#ffe14a', size: 14, speed: 3, motion: 'homing', curve: 0.08, lifetime: 160, damage: 40, hits: 2, hitstun: 22, trail: 'fx:energy', trailRate: 2, impactEffect: 'fx:lightning', sound: 'thunder' };
  const bolt: ProjectileDef = { ...newProjectile('Thunder Fall'), id: 'thunderfall', shape: 'bolt', color: '#ffffff', color2: '#7fd1ff', size: 18, speed: 9, angle: -90, motion: 'straight', lifetime: 40, damage: 85, knockdown: true, trail: 'fx:lightning', trailRate: 4, impactEffect: 'fx:shockwave', collision: 'pierce', sound: 'thunder' };
  const field: ProjectileDef = { ...newProjectile('Static Field'), id: 'staticfield', shape: 'ring', color: '#e0ffff', color2: '#3a9aff', size: 34, speed: 0, motion: 'stationary', lifetime: 50, damage: 25, hits: 3, hitstun: 16, trail: 'fx:energy', trailRate: 4, impactEffect: 'fx:lightning', collision: 'pierce', opacity: 0.85, sound: 'thunder' };
  const beam: ProjectileDef = { ...newProjectile('Requiem Beam'), id: 'requiem', shape: 'beam', color: '#ffffff', color2: '#4ac8ff', size: 40, speed: 14, motion: 'beam', lifetime: 64, damage: 32, hits: 8, hitstun: 14, knockback: 1.5, trail: 'fx:lightning', trailRate: 3, impactEffect: 'fx:spark', collision: 'pierce', strength: 5, knockdown: true, sound: 'thunder' };
  const attacks = baseNormals(gs, { power: 0.95 });
  attacks.push(
    atk(gs, { name: 'Snap Kick', type: 'medium', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['kneeUp', 'kickLow', 'kickLow', 'kneeUp'], act: [1, 2], limb: 'fF', bw: 40, bh: 22, damage: 48, startup: 6, active: 4, recovery: 10, sound: 'kick' }),
    atk(gs, { name: 'Volt Roundhouse', type: 'heavy', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['roundA', 'kickHigh', 'kickHigh', 'kneeUp'], act: [1, 2], limb: 'fF', bw: 46, bh: 30, damage: 82, startup: 9, active: 5, recovery: 17, glow: '#7ff7ff', hitEffect: 'fx:lightning', sound: 'kick' }),
    atk(gs, { name: 'Volt Orb', type: 'special', input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, poses: ['fireA', 'fireB', 'fireB', 'fireC'], act: [1, 2], noBox: true, projectile: 'voltorb', spawnAt: 11, spawnOffset: { x: 50, y: 80 }, startup: 10, active: 4, recovery: 20, cooldown: 60, startEffect: 'fx:energy', sound: 'special' }),
    atk(gs, { name: 'Spark Dash', type: 'special', input: { button: 'S', dir: 'forward', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'hcb' }, poses: ['dash', 'strB', 'strB', 'strB', 'strC'], act: [1, 3], limb: 'hF', bw: 50, bh: 40, damage: 45, hits: 2, startup: 6, active: 14, recovery: 18, moveX: 9, afterimage: true, glow: '#7ff7ff', knockdown: true, hitEffect: 'fx:lightning', startEffect: 'fx:streak', sound: 'dash' }),
    atk(gs, { name: 'Thunder Fall', type: 'special', input: { button: 'S', dir: 'up', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dp' }, poses: ['power0', 'power1', 'power1', 'power0'], act: [1, 2], noBox: true, projectile: 'thunderfall', spawnAt: 14, spawnOffset: { x: 150, y: 300 }, startup: 14, active: 6, recovery: 24, energyCost: 0, startEffect: 'fx:lightning', sound: 'special' }),
    atk(gs, { name: 'Static Field', type: 'special', input: { button: 'S', dir: 'down', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcb' }, poses: ['crouch', 'meditate', 'meditate', 'crouch'], act: [1, 2], noBox: true, projectile: 'staticfield', spawnAt: 8, spawnOffset: { x: 10, y: 60 }, startup: 8, active: 20, recovery: 14, cooldown: 50, sound: 'special' }),
  );
  const sup = atk(gs, { name: 'Thunder Requiem', type: 'super', input: { button: 'SH', dir: 'any', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dqcf' }, poses: ['power0', 'power1', 'fireB', 'fireB', 'fireC'], act: [2, 3], noBox: true, projectile: 'requiem', spawnAt: 10, spawnOffset: { x: 50, y: 80 }, startup: 10, active: 60, recovery: 24, energyCost: 100, invincible: 20, glow: '#7ff7ff', sound: 'super' });
  sup.cinematic = { useTimeline: false, length: 120, timeline: [], alert: { ...defaultAlert('THUNDER REQUIEM'), subtitle: 'VERA VOLT — 100,000 VOLTS', bgColor: '#0a2a8a', streakColor: '#7ff7ff', textColor: '#fff36b', duration: 64, style: 'band' } };
  attacks.push(sup);
  const eff = defaultCharacterEffects('#7ff7ff');
  eff.ghostDash.color = '#5fe0ff'; eff.ghostDash.count = 6; eff.hitSpark = 'fx:spark';
  return finalize({
    id: 'builtin_vera', name: 'Vera Volt', description: 'A hyperactive electric street fighter. Fast, fragile, and full of tricky lightning projectiles.', author: 'Pixel Fighter Engine', color: '#2a7bff',
    stats: { maxHealth: 900, walkSpeed: 2.9, runSpeed: 5.8, jumpHeight: 135, attackPower: 0.95, defense: 0.9, dashSpeed: 8.5, weight: 0.9, width: 32, height: 124, airJumps: 0 },
    portrait: generatePortrait(body, '#2a7bff'), sheets: [gs.sheet], scale: SCALE, facesLeft: false, animations: anims, attacks,
    projectiles: [orb, bolt, field, beam], effectPresets: [], effects: eff,
    dialogue: {
      intro: ['Let\'s make some sparks!', 'Try to keep up!'],
      victory: ['Shocking, right?', 'Too slow! Way too slow!', 'That was electrifying!'],
      vsVictory: [
        { opponent: 'Kaito', lines: ['Still meditating, Kaito? I finished before you finished breathing!'] },
        { opponent: 'Brakk', lines: ['Big guy, slow guy. Bye guy!', 'Brakk, you should really try cardio.'] },
        { opponent: 'Nyx', lines: ['Tag, Nyx! You\'re it... and you\'re also out.'] },
      ],
      preFight: [
        { opponent: 'Kaito', lines: ['Kaito! Race you to the finish!'] },
        { opponent: 'Brakk', lines: ['Ooh, a big target. Can\'t miss!'] },
      ],
      taunt: ['Zap!'],
    },
    sounds: {}, voices: {},
  });
}

// ============================================================================
export function buildBrakk(): CharacterDef {
  const body: BodySpec = { skin: '#c98b5a', hair: '#3a2010', top: '#4a6b2a', pants: '#5b3a1e', belt: '#d0a030', gloves: '#6b4a2a', boots: '#3a2a1a', accent: '#d0a030', outline: '#120a06', eye: '#3a1a00', build: 1.4, tall: 1.08, hairStyle: 'bald', beard: '#3a2010', sleeveless: true, pads: '#9a9aa0' };
  const gs = generateSheet(body, 'Brakk Body');
  const anims: Record<string, AnimationDef> = {
    ...standardAnimations(gs),
    mb_charge: anim(gs, ['shoulder'], 8, true),
    mb_lift: anim(gs, ['graspB', 'tossA'], 8, false),
    mb_slam: anim(gs, ['tossB', 'slam'], 12, false),
    mb_roar: anim(gs, ['power0', 'power1'], 6, false),
  };
  const quake: ProjectileDef = { ...newProjectile('Quake Wave'), id: 'quake', shape: 'wave', color: '#ffe0a0', color2: '#a0602a', size: 26, speed: 4.2, motion: 'straight', lifetime: 90, damage: 75, knockdown: true, trail: 'fx:dust', trailRate: 3, impactEffect: 'fx:dust', collision: 'clash', strength: 2, sound: 'heavy' };
  const attacks = baseNormals(gs, { power: 1.15 });
  replace(attacks, 'Jab', atk(gs, { name: 'Heavy Jab', type: 'light', input: { button: 'L', dir: 'any', motion: 'none' }, poses: ['jabA', 'jabB', 'jabC'], act: [1, 1], limb: 'hF', bw: 38, bh: 22, damage: 38, startup: 6, active: 3, recovery: 9, sound: 'punch' }));
  replace(attacks, 'Throw', atk(gs, { name: 'Suplex', type: 'throw', input: { button: 'G', dir: 'any', motion: 'none' }, poses: ['graspA', 'graspA', 'graspB', 'tossA', 'tossB', 'slam'], act: [1, 1], limb: 'hF', bw: 26, bh: 40, damage: 150, startup: 4, active: 3, recovery: 34, throwRange: 58, throwDir: 'back', shake: 6, sound: 'throw' }));
  attacks.push(
    atk(gs, { name: 'Headbutt', type: 'medium', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['strA', 'headbutt', 'headbutt', 'strA'], act: [1, 2], limb: 'head', bw: 34, bh: 30, damage: 65, startup: 9, active: 4, recovery: 14, moveX: 1.2, sound: 'heavy' }),
    atk(gs, { name: 'Hammer Fist', type: 'heavy', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['tossA', 'tossA', 'slam', 'slam', 'strA'], act: [2, 3], limb: 'hF', bw: 48, bh: 50, damage: 115, hitLevel: 'overhead', startup: 16, active: 5, recovery: 20, shake: 5, hitEffect: 'fx:bigspark', sound: 'heavy' }),
    atk(gs, { name: 'Quake Slam', type: 'special', input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, poses: ['tossA', 'tossA', 'slam', 'slam', 'slam'], act: [2, 3], limb: 'hF', bw: 40, bh: 30, damage: 40, projectile: 'quake', spawnAt: 16, spawnOffset: { x: 50, y: 0 }, startup: 16, active: 6, recovery: 24, shake: 4, activeEffect: 'fx:dust', sound: 'heavy' }),
    atk(gs, { name: 'Bull Charge', type: 'special', input: { button: 'S', dir: 'forward', motion: 'none' }, input2: { button: 'A', dir: 'back', motion: 'none' }, poses: ['strA', 'shoulder', 'shoulder', 'shoulder', 'strC'], act: [1, 3], limb: 'body', bw: 50, bh: 90, damage: 100, startup: 12, active: 18, recovery: 20, moveX: 7.5, knockdown: true, priority: 5, afterimage: true, startEffect: 'fx:dust', hitEffect: 'fx:bigspark', shake: 5, sound: 'dash' }),
    atk(gs, { name: 'Bear Hug', type: 'throw', input: { button: 'S', dir: 'down', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'hcb' }, poses: ['graspA', 'graspA', 'graspB', 'graspB', 'tossA', 'slam'], act: [1, 1], limb: 'hF', bw: 30, bh: 60, damage: 190, startup: 6, active: 4, recovery: 38, throwRange: 66, throwDir: 'forward', shake: 8, energyGain: 15, hitEffect: 'fx:dust', sound: 'throw' }),
  );
  const sup = atk(gs, { name: 'Mountain Breaker', type: 'super', input: { button: 'SH', dir: 'any', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dqcf' }, poses: ['power0', 'power1'], act: [1, 1], noBox: true, energyCost: 100, invincible: 70, sound: 'super' });
  sup.cinematic = {
    useTimeline: true, length: 170,
    alert: { ...defaultAlert('MOUNTAIN BREAKER'), at: 0, duration: 58, subtitle: 'BRAKK — EARTH SHATTER', bgColor: '#5a2a00', streakColor: '#ffb040', textColor: '#ffe9a0', font: 'Press Start 2P', style: 'fullscreen' },
    timeline: [
      ev(0, 'character', { anim: 'mb_roar', dur: 60 }),
      ev(0, 'effects', { effect: 'fx:dust', ox: 0, oy: 0 }),
      ev(60, 'character', { anim: 'mb_charge', vx: 8, dur: 18, afterimage: true }),
      ev(60, 'effects', { effect: 'fx:streak', ox: -10, oy: 60 }),
      ev(66, 'damage', { damage: 45, box: { x: 0, y: 0, w: 70, h: 130 }, kbx: 0, kby: 0, opener: true, hitEffect: 'fx:bigspark' }),
      ev(78, 'character', { anim: 'mb_lift', vx: 0, dur: 24 }),
      ev(72, 'opponent', { oppState: 'pull', dur: 10 }),
      ev(84, 'opponent', { oppState: 'float', dur: 24 }),
      ev(84, 'camera', { zoom: 1.35, focus: 'self', dur: 70 }),
      ev(102, 'character', { anim: 'mb_slam', dur: 30 }),
      ev(106, 'damage', { damage: 80, box: { x: 0, y: 0, w: 100, h: 150 }, kbx: 0, kby: 0, hitEffect: 'fx:dust' }),
      ev(106, 'opponent', { oppState: 'knockdown', dur: 20 }),
      ev(106, 'effects', { effect: 'fx:shockwave', ox: 50, oy: 0, shake: 10, bg: '#ff8a20', bgStyle: 'radial', dur: 40 }),
      ev(128, 'character', { anim: 'mb_roar', dur: 40 }),
      ev(132, 'damage', { damage: 110, box: { x: -40, y: 0, w: 200, h: 160 }, kbx: 6, kby: 12, final: true, launch: true, hitEffect: 'fx:explosion' }),
      ev(132, 'effects', { effect: 'fx:explosion', ox: 60, oy: 20, flash: '#fff2c0', shake: 12 }),
      ev(132, 'sound', { sound: 'explosion' }),
      ev(140, 'dialogue', { text: 'CRUMBLE!', speaker: 'self', dur: 30 }),
    ],
  };
  attacks.push(sup);
  const eff = defaultCharacterEffects('#ffb040');
  eff.landDust.size = 5; eff.landDust.intensity = 1.6; eff.jumpDust.size = 4; eff.hitSpark = 'fx:bigspark'; eff.ghostDash.color = '#ffb040';
  return finalize({
    id: 'builtin_brakk', name: 'Brakk', description: 'A mountain-born wrestler. Slow but brutally strong, with command grabs and earth-shaking slams.', author: 'Pixel Fighter Engine', color: '#6b8a2a',
    stats: { maxHealth: 1250, walkSpeed: 1.8, runSpeed: 3.8, jumpHeight: 105, attackPower: 1.15, defense: 1.15, dashSpeed: 5.5, weight: 1.4, width: 46, height: 136, airJumps: 0 },
    portrait: generatePortrait(body, '#6b8a2a'), sheets: [gs.sheet], scale: SCALE, facesLeft: false, animations: anims, attacks,
    projectiles: [quake], effectPresets: [], effects: eff,
    dialogue: {
      intro: ['BRAKK SMASH... politely.', 'Stand still. It hurts less.'],
      victory: ['The mountain does not move!', 'HAH! Next!', 'You fought well. You bounced better.'],
      vsVictory: [
        { opponent: 'Kaito', lines: ['Your little fireballs tickle, Kaito.'] },
        { opponent: 'Vera Volt', lines: ['Lightning? Hah! I have been struck by worse on a Tuesday.', 'Caught you, little spark.'] },
        { opponent: 'Nyx', lines: ['Cannot dodge what you cannot outrun, little shadow.'] },
      ],
      preFight: [
        { opponent: 'Vera Volt', lines: ['Hold still, buzzing fly.'] },
        { opponent: 'Kaito', lines: ['Kaito! Today you meet the mountain.'] },
      ],
      taunt: ['HRAAH!'],
    },
    sounds: {}, voices: {},
  });
}

// ============================================================================
export function buildNyx(): CharacterDef {
  const body: BodySpec = { skin: '#e8c09a', hair: '#3a2a5a', top: '#3a2a5a', pants: '#24183a', belt: '#c02a6a', gloves: '#1a1424', boots: '#1a1424', accent: '#c02a6a', outline: '#0a0612', eye: '#ff3a8a', build: 0.9, tall: 1, hairStyle: 'hood', mask: '#24183a', scarf: '#c02a6a' };
  const gs = generateSheet(body, 'Nyx Body');
  const anims: Record<string, AnimationDef> = {
    ...standardAnimations(gs),
    sd_vanish: anim(gs, ['crouch', 'dash2'], 12, false),
    sd_slash: anim(gs, ['slashA', 'slashB'], 14, false),
    sd_flip: anim(gs, ['flipA', 'flipB'], 10, false),
    sd_pose: anim(gs, ['intro0', 'taunt'], 4, false),
  };
  const kunai: ProjectileDef = { ...newProjectile('Kunai'), id: 'kunai', shape: 'blade', color: '#e0e0f0', color2: '#c02a6a', size: 10, speed: 8.5, motion: 'straight', lifetime: 70, damage: 40, hitstun: 16, knockback: 2, trail: 'fx:streak', trailRate: 2, impactEffect: 'fx:spark', collision: 'destroy', sound: 'whoosh' };
  const airKunai: ProjectileDef = { ...kunai, id: 'airkunai', name: 'Air Kunai', angle: -35 };
  const attacks = baseNormals(gs, { power: 0.9 });
  replace(attacks, 'Jab', atk(gs, { name: 'Quick Jab', type: 'light', input: { button: 'L', dir: 'any', motion: 'none' }, poses: ['jabA', 'jabB', 'jabC'], act: [1, 1], limb: 'hF', bw: 32, bh: 18, damage: 26, startup: 3, active: 3, recovery: 6, sound: 'punch' }));
  attacks.push(
    atk(gs, { name: 'Shadow Slash', type: 'medium', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['slashA', 'slashB', 'slashB', 'jabC'], act: [1, 2], limb: 'hF', bw: 50, bh: 40, damage: 50, startup: 6, active: 4, recovery: 11, glow: '#c02a6a', sound: 'whoosh' }),
    atk(gs, { name: 'Spin Heel', type: 'heavy', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['roundA', 'kickHigh', 'kickHigh', 'kneeUp'], act: [1, 2], limb: 'fF', bw: 46, bh: 30, damage: 75, startup: 9, active: 5, recovery: 16, sound: 'kick' }),
    atk(gs, { name: 'Kunai', type: 'special', input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, poses: ['jabA', 'throwKunai', 'throwKunai', 'jabC'], act: [1, 2], noBox: true, projectile: 'kunai', spawnAt: 7, spawnOffset: { x: 44, y: 88 }, startup: 7, active: 4, recovery: 14, sound: 'whoosh' }),
    atk(gs, { name: 'Air Kunai', type: 'special', stance: 'air', input: { button: 'S', dir: 'any', motion: 'none' }, poses: ['jumpTuck', 'throwKunai', 'throwKunai'], act: [1, 2], noBox: true, projectile: 'airkunai', spawnAt: 6, spawnOffset: { x: 30, y: 60 }, startup: 6, active: 4, recovery: 10, cooldown: 20, sound: 'whoosh' }),
    atk(gs, { name: 'Crescent Flip', type: 'special', input: { button: 'S', dir: 'up', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dp' }, poses: ['crouch', 'flipA', 'flipB', 'flipB', 'jumpDown'], act: [1, 2], limb: 'fF', bw: 44, bh: 70, damage: 95, startup: 4, active: 10, recovery: 26, invincible: 6, moveY: 9.5, moveX: 1.5, launcher: true, knockup: 10, glow: '#c02a6a', activeEffect: 'fx:streak', sound: 'kick' }),
  );
  // Shadow Step: a timeline-driven special with no alert (shows the timeline works for normal specials too)
  const step = atk(gs, { name: 'Shadow Step', type: 'special', input: { button: 'S', dir: 'forward', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcb' }, poses: ['crouch', 'slashB'], act: [1, 1], noBox: true, energyCost: 25, sound: 'whoosh' });
  step.cinematic = {
    useTimeline: true, length: 40, alert: { ...defaultAlert('SHADOW STEP'), enabled: false },
    timeline: [
      ev(0, 'character', { anim: 'sd_vanish', vx: 0, dur: 8 }),
      ev(4, 'effects', { effect: 'fx:smoke', ox: 0, oy: 40 }),
      ev(9, 'character', { teleport: 'behindOpponent', anim: 'sd_slash', vx: 0, dur: 20, afterimage: true }),
      ev(9, 'effects', { effect: 'fx:smoke', ox: 0, oy: 40 }),
      ev(14, 'damage', { damage: 70, box: { x: 0, y: 20, w: 64, h: 100 }, kbx: 5, kby: 0, hitEffect: 'fx:pixels' }),
    ],
  };
  attacks.push(step);
  const sup = atk(gs, { name: 'Shadow Dance', type: 'super', input: { button: 'SH', dir: 'any', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dqcf' }, poses: ['intro0', 'taunt'], act: [1, 1], noBox: true, energyCost: 100, invincible: 60, sound: 'super' });
  sup.cinematic = {
    useTimeline: true, length: 176,
    alert: { ...defaultAlert('SHADOW DANCE'), at: 0, duration: 56, subtitle: 'NYX — THOUSAND CUTS', bgColor: '#2a0a3a', streakColor: '#ff3a8a', textColor: '#ffd0f0', style: 'band' },
    timeline: [
      ev(0, 'character', { anim: 'sd_pose', dur: 56 }),
      ev(58, 'character', { anim: 'sd_vanish', vx: 11, dur: 12, afterimage: true }),
      ev(64, 'damage', { damage: 30, box: { x: 0, y: 20, w: 70, h: 110 }, kbx: 0, opener: true, hitEffect: 'fx:pixels' }),
      ev(70, 'opponent', { oppState: 'float', dur: 80 }),
      ev(70, 'effects', { bg: '#1a0028', bgStyle: 'streaks', dur: 90, darken: 0.5, slowmo: 0.6 }),
      ev(70, 'camera', { zoom: 1.4, focus: 'opponent', dur: 90 }),
      ev(76, 'character', { teleport: 'behindOpponent', anim: 'sd_slash', dur: 14, afterimage: true }),
      ev(78, 'damage', { damage: 30, box: { x: -20, y: 0, w: 90, h: 140 }, hitEffect: 'fx:pixels' }),
      ev(92, 'character', { teleport: 'frontOfOpponent', anim: 'sd_flip', dur: 14, afterimage: true }),
      ev(94, 'damage', { damage: 30, box: { x: -20, y: 0, w: 90, h: 140 }, hitEffect: 'fx:pixels' }),
      ev(108, 'character', { teleport: 'behindOpponent', anim: 'sd_slash', dur: 14, afterimage: true }),
      ev(110, 'damage', { damage: 30, box: { x: -20, y: 0, w: 90, h: 140 }, hitEffect: 'fx:pixels' }),
      ev(124, 'character', { teleport: 'frontOfOpponent', anim: 'sd_slash', dur: 30, afterimage: true }),
      ev(128, 'dialogue', { text: 'Vanish.', speaker: 'self', dur: 40 }),
      ev(140, 'damage', { damage: 90, box: { x: -40, y: 0, w: 140, h: 160 }, kbx: 7, kby: 9, final: true, launch: true, hitEffect: 'fx:explosion' }),
      ev(140, 'effects', { effect: 'fx:shockwave', ox: 20, oy: 70, flash: '#ff3a8a', shake: 8 }),
    ],
  };
  attacks.push(sup);
  const eff = defaultCharacterEffects('#c02a6a');
  eff.ghostDash.color = '#b04aff'; eff.ghostDash.count = 7; eff.ghostDash.alpha = 0.6; eff.jumpDust.style = 'ring'; eff.jumpDust.color = '#d0a0ff'; eff.hitSpark = 'fx:pixels';
  return finalize({
    id: 'builtin_nyx', name: 'Nyx', description: 'A silent shadow ninja. Fragile, but blindingly fast with a double jump, kunai and teleports.', author: 'Pixel Fighter Engine', color: '#8a3ac0',
    stats: { maxHealth: 850, walkSpeed: 3, runSpeed: 6.4, jumpHeight: 130, attackPower: 0.9, defense: 0.85, dashSpeed: 9.5, weight: 0.85, width: 32, height: 120, airJumps: 1 },
    portrait: generatePortrait(body, '#8a3ac0'), sheets: [gs.sheet], scale: SCALE, facesLeft: false, animations: anims, attacks,
    projectiles: [kunai, airKunai], effectPresets: [], effects: eff,
    dialogue: {
      intro: ['...', 'You will not see me coming.'],
      victory: ['Silence returns.', 'You fought shadows. Shadows won.', 'Not even a whisper.'],
      vsVictory: [
        { opponent: 'Kaito', lines: ['Your honor is a predictable rhythm, Kaito.'] },
        { opponent: 'Vera Volt', lines: ['Speed is nothing without silence, Vera.'] },
        { opponent: 'Brakk', lines: ['The mountain fell without hearing my footsteps.'] },
      ],
      preFight: [{ opponent: 'Kaito', lines: ['Your light casts a long shadow, Kaito.'] }],
      taunt: ['Hmph.'],
    },
    sounds: {}, voices: {},
  });
}

export function buildBuiltinRoster(): CharacterDef[] {
  return [buildKaito(), buildVera(), buildBrakk(), buildNyx()];
}

// ============================================================================
/** Grey training dummy used by editor previews. */
let dummyCache: CharacterDef | null = null;
export function buildDummy(): CharacterDef {
  if (dummyCache) return dummyCache;
  const body: BodySpec = { skin: '#b8b0a0', hair: '#8a8478', top: '#9a9488', pants: '#7a7468', belt: '#5a5448', gloves: '#b8b0a0', boots: '#6a6458', accent: '#ffffff', outline: '#1a1814', eye: '#1a1814', build: 1.05, tall: 1, hairStyle: 'bald' };
  const gs = generateSheet(body, 'Dummy');
  dummyCache = finalize({
    id: 'training_dummy', name: 'Training Dummy', description: 'Stands still and takes hits.', color: '#8a8478',
    stats: { maxHealth: 1000, walkSpeed: 2, runSpeed: 4, jumpHeight: 110, attackPower: 1, defense: 1, dashSpeed: 6, weight: 1, width: 36, height: 124, airJumps: 0 },
    portrait: generatePortrait(body, '#5a5a5a'), sheets: [gs.sheet], scale: SCALE, facesLeft: false, animations: standardAnimations(gs),
    attacks: baseNormals(gs).filter(a => a.type !== 'throw').slice(0, 1), projectiles: [], effectPresets: [], effects: { ...defaultCharacterEffects('#aaaaaa'), aura: { enabled: false, color: '#fff', whenMeterFull: true } },
    dialogue: { intro: [], victory: ['...'], vsVictory: [], preFight: [], taunt: [] }, sounds: {}, voices: {},
  });
  return dummyCache;
}

/** Pixel Body Builder: a complete starter fighter generated from a few choices. */
export function buildFromBody(body: BodySpec, name: string, color: string, energy: string) {
  const gs = generateSheet(body, name + ' Body');
  const anims: Record<string, AnimationDef> = {
    ...standardAnimations(gs),
    super_pose: anim(gs, ['power0', 'power1', 'power1'], 6, false),
    super_dash: anim(gs, ['dash', 'dash2'], 14, true),
    super_hit: anim(gs, ['jabB', 'strB'], 12, false),
    super_kick: anim(gs, ['kneeUp', 'kickHigh'], 12, false),
    super_blast: anim(gs, ['fireA', 'fireB', 'fireC'], 10, false),
  };
  const proj: ProjectileDef = { ...newProjectile('Energy Ball'), id: 'energyball', color: '#ffffff', color2: energy, trail: 'fx:energy' };
  const attacks = baseNormals(gs);
  attacks.push(
    atk(gs, { name: 'Front Kick', type: 'medium', input: { button: 'M', dir: 'any', motion: 'none' }, poses: ['kneeUp', 'kickMid', 'kickMid', 'kneeUp'], act: [1, 2], limb: 'fF', bw: 40, bh: 20, damage: 55, startup: 7, active: 4, recovery: 12, sound: 'kick' }),
    atk(gs, { name: 'Straight Punch', type: 'heavy', input: { button: 'H', dir: 'any', motion: 'none' }, poses: ['strA', 'strB', 'strC', 'jabC'], act: [1, 2], limb: 'hF', bw: 44, bh: 22, damage: 90, moveX: 1.5, startup: 10, active: 5, recovery: 18, shake: 2, sound: 'punch' }),
    atk(gs, { name: 'Energy Ball', type: 'special', input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, poses: ['fireA', 'fireA', 'fireB', 'fireB', 'fireC'], act: [2, 3], noBox: true, projectile: 'energyball', spawnAt: 13, spawnOffset: { x: 52, y: 78 }, startup: 12, active: 4, recovery: 22, sound: 'special' }),
    atk(gs, { name: 'Rising Uppercut', type: 'special', input: { button: 'S', dir: 'up', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dp' }, poses: ['dpA', 'dpB', 'dpB', 'dpC', 'dpC', 'jumpDown'], act: [1, 2], limb: 'hF', bw: 36, bh: 80, damage: 100, startup: 3, active: 9, recovery: 30, invincible: 7, moveY: 10, moveX: 2, launcher: true, knockup: 11, knockdown: true, glow: energy, sound: 'special' }),
  );
  const sup = atk(gs, { name: 'Ultimate Rush', type: 'super', input: { button: 'SH', dir: 'any', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dqcf' }, poses: ['power0', 'power1'], act: [1, 1], noBox: true, energyCost: 100, invincible: 70, sound: 'super' });
  sup.cinematic = {
    useTimeline: true, length: 170,
    alert: { ...defaultAlert('ULTIMATE RUSH'), at: 6, duration: 56, subtitle: name.toUpperCase(), bgColor: color, streakColor: energy },
    timeline: [
      ev(0, 'character', { anim: 'super_pose', dur: 62 }),
      ev(62, 'character', { anim: 'super_dash', vx: 9, dur: 12, afterimage: true }),
      ev(62, 'camera', { zoom: 1.3, focus: 'center', dur: 100 }),
      ev(74, 'damage', { damage: 40, box: { x: 0, y: 20, w: 70, h: 110 }, opener: true, hitEffect: 'fx:bigspark' }),
      ev(74, 'character', { anim: 'super_hit', vx: 0.5, dur: 18 }),
      ev(92, 'character', { anim: 'super_kick', dur: 24 }),
      ev(92, 'damage', { damage: 50, box: { x: 0, y: 40, w: 80, h: 100 }, hitEffect: 'fx:bigspark' }),
      ev(92, 'opponent', { oppState: 'float', dur: 24 }),
      ev(104, 'effects', { bg: energy, bgStyle: 'streaks', dur: 56, darken: 0.4 }),
      ev(116, 'character', { anim: 'super_blast', dur: 50 }),
      ev(124, 'damage', { damage: 90, box: { x: 0, y: 0, w: 140, h: 160 }, kbx: 7, kby: 9, final: true, launch: true, hitEffect: 'fx:shockwave' }),
      ev(140, 'effects', { effect: 'fx:explosion', ox: 110, oy: 60, flash: '#ffffff', shake: 10 }),
    ],
  };
  attacks.push(sup);
  return { sheet: gs.sheet, animations: anims, attacks, projectiles: [proj], portrait: generatePortrait(body, color) };
}
