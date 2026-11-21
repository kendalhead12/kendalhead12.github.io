// Spawnable creature definitions.
import { Human, humanRig } from './human.js';
import { Zombie, Dummy, Hunter, zombieRig, skeletonRig, dummyRig } from './zombie.js';
import { Maneater, maneaterRig } from './maneater.js';

const human = (id, name, desc, variant, personality, extra = {}) => ({
  id, name, desc, category: 'Humans', kind: 'human', faction: 'human', cls: Human,
  buildRig: humanRig(variant), personality, health: 100, mass: 70, walkSpeed: 1.45, runSpeed: 5.6,
  painSound: 'pain', knockThreshold: 260, getupTime: 2.2, ...extra,
});

export const CREATURES = [
  human('citizen', 'Citizen', 'An ordinary person with a random personality: brave, timid, calm or hot-headed.', {}, null),
  human('brave', 'Brave Citizen', 'Stands their ground, investigates noises and fights back against zombies.', {}, { bravery: 0.92, temper: 0.55 }),
  human('timid', 'Timid Citizen', 'Easily frightened. Freezes, screams, panics and hides.', {}, { bravery: 0.08, temper: 0.15 }),
  human('hothead', 'Hot-Headed Citizen', 'Short temper. Picks arguments and throws punches.', {}, { bravery: 0.7, temper: 0.97 }),
  human('scientist', 'Scientist', 'A researcher in a lab coat. Curious but cautious.', { shirt: 0xf2f2f2, sleeves: 'long', pants: 0x3a3f4a }, { bravery: 0.35, temper: 0.2 }),
  human('worker', 'Construction Worker', 'Hard hat and hi-vis vest. Tough and stubborn.', { shirt: 0xff7a1a, hairStyle: 'helmet', capColor: 0xf2c200, pants: 0x3a4a6a }, { bravery: 0.75, temper: 0.6 }, { health: 130, punchMul: 1.3 }),
  human('officer', 'Security Officer', 'Brave, protective and quick to fight.', { shirt: 0x24324a, pants: 0x1c2433, hairStyle: 'cap', capColor: 0x1c2433, sleeves: 'long' }, { bravery: 0.95, temper: 0.7 }, { health: 140, punchMul: 1.4 }),
  {
    id: 'dummy', name: 'Training Dummy', desc: 'A wooden mannequin with detachable limbs. Never fights back.', category: 'Humans',
    kind: 'dummy', faction: 'dummy', cls: Dummy, buildRig: dummyRig(), health: 300, mass: 45, walkSpeed: 0, runSpeed: 0,
    detachable: true, limbHealth: 35, bloodType: 'wood', knockThreshold: 160, getupTime: 9999, deadFace: 'dummy', thinkMul: 4,
  },
  // Zombies
  {
    id: 'walker', name: 'Walker Zombie', desc: 'Slow but persistent. Follows noise and never stops coming.', category: 'Zombies',
    kind: 'zombie', faction: 'zombie', cls: Zombie, buildRig: zombieRig({}), animStyle: 'zombie', health: 120, mass: 70,
    walkSpeed: 0.7, runSpeed: 1.5, strideLen: 1.0, damage: [9, 15], attackDur: 0.8, stumbleChance: 0.45, knockThreshold: 200,
    getupTime: 2.5, idleSound: 'groan', groanRate: 0.06, attackSound: 'zombieAttack', painSound: 'groan', deathSound: 'groan', turnSpeed: 4,
  },
  {
    id: 'runner', name: 'Runner Zombie', desc: 'Fast and aggressive. Sprints at anything that moves.', category: 'Zombies',
    kind: 'zombie', faction: 'zombie', cls: Zombie, buildRig: zombieRig({ scale: 0.97, torsoW: 0.32 }), animStyle: 'zombie', health: 80, mass: 62,
    walkSpeed: 1.2, runSpeed: 6.4, damage: [7, 12], attackDur: 0.5, attackCooldown: 0.7, stumbleChance: 0.6, knockThreshold: 170,
    getupTime: 1.4, idleSound: 'groan', groanRate: 0.08, attackSound: 'zombieAttack', painSound: 'groan', deathSound: 'groan', sightMul: 1.1, turnSpeed: 10,
  },
  {
    id: 'brute', name: 'Brute Zombie', desc: 'Huge, strong and very hard to knock down. Hits like a truck.', category: 'Zombies',
    kind: 'zombie', faction: 'zombie', cls: Zombie, buildRig: zombieRig({ scale: 1.3, torsoW: 0.48, torsoD: 0.3, belly: 0.3, uArmR: 0.075, lArmR: 0.068, thighR: 0.1, shinR: 0.085, mass: 220 }),
    animStyle: 'zombie', health: 600, mass: 220, radius: 0.36, walkSpeed: 0.9, runSpeed: 2.6, damage: [22, 34], hitImpulse: 1400, attackDur: 1.0, attackCooldown: 1.6,
    reach: 1.4, stumbleChance: 0.06, knockThreshold: 2600, getupTime: 3, idleSound: 'groan', groanRate: 0.05, attackSound: 'zombieAttack', painSound: 'groan', deathSound: 'groan', turnSpeed: 3,
  },
  {
    id: 'crawler', name: 'Crawler Zombie', desc: 'Drags itself along the ground. Hard to spot, easy to trip over.', category: 'Zombies',
    kind: 'crawler', faction: 'zombie', cls: Zombie, buildRig: zombieRig({}), animStyle: 'crawler', capsuleHeight: 0.62, radius: 0.3,
    health: 70, mass: 60, walkSpeed: 0.5, runSpeed: 1.3, strideLen: 0.7, damage: [6, 11], reach: 1.3, attackDur: 0.6, stumbleChance: 0.2,
    knockThreshold: 180, getupTime: 2, idleSound: 'groan', groanRate: 0.05, attackSound: 'zombieAttack', painSound: 'groan', deathSound: 'groan', turnSpeed: 3,
  },
  // Monsters
  {
    id: 'maneater', name: 'Maneater', desc: 'A 10-foot hunched horror with long arms, claws and glowing eyes. Hunts humans, grabs them and lifts them off the ground.',
    category: 'Monsters', kind: 'maneater', faction: 'monster', cls: Maneater, buildRig: maneaterRig(1.72), animStyle: 'monster',
    health: 1500, mass: 420, radius: 0.5, walkSpeed: 1.6, runSpeed: 6.6, strideLen: 2.2, reach: 1.7, damage: [30, 45], hitImpulse: 2200, hitType: 'claw',
    attackDur: 0.85, attackCooldown: 1.1, canGrab: true, noKnockdown: true, knockThreshold: 99999, idleSound: 'growl', groanRate: 0.07,
    deathSound: 'roar', painSound: null, sightMul: 1.25, turnSpeed: 5, accel: 10, scaleSfx: 1,
  },
  {
    id: 'juvenile', name: 'Juvenile Maneater', desc: 'A smaller, faster Maneater. Too small to lift prey, so it slashes instead.',
    category: 'Monsters', kind: 'maneater', faction: 'monster', cls: Maneater, buildRig: maneaterRig(1.15, 0x6a5f55), animStyle: 'monster',
    health: 420, mass: 140, radius: 0.36, walkSpeed: 1.8, runSpeed: 7.2, strideLen: 1.6, reach: 1.3, damage: [15, 24], hitImpulse: 700, hitType: 'claw',
    attackDur: 0.6, attackCooldown: 0.8, canGrab: false, knockThreshold: 1400, getupTime: 1.5, idleSound: 'growl', groanRate: 0.05, deathSound: 'growl', sightMul: 1.1, scaleSfx: 0.45,
  },
  {
    id: 'skeleton', name: 'Skeleton', desc: 'A rattling animated skeleton. Its bones come apart when it is hit hard.',
    category: 'Monsters', kind: 'skeleton', faction: 'monster', cls: Hunter, buildRig: skeletonRig(), animStyle: 'skeleton',
    health: 90, mass: 35, walkSpeed: 1.3, runSpeed: 3.8, damage: [8, 14], attackDur: 0.6, detachable: true, limbHealth: 18, bloodType: 'bone',
    knockThreshold: 120, getupTime: 9999, stumbleChance: 0.3, painSound: 'bones', deathSound: 'bones', attackSound: 'bones', hitSound: 'bat', deadFace: 'skull',
  },
];

export const CREATURE_BY_ID = Object.fromEntries(CREATURES.map(c => [c.id, c]));
