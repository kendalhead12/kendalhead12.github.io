import type {
  AttackDef, AttackType, CharacterDef, CharacterEffects, CinematicAlert, EffectDef, KeyBindings,
  ProjectileDef, Settings, StageDef, StageLayer, TimelineEvent,
} from './types';
import { FORMAT_VERSION } from './types';
import { uid } from './util';

export const BUILTIN_EFFECTS: EffectDef[] = [
  { id: 'fx:spark', name: 'Hit Sparks', kind: 'spark', color: '#fff6a0', color2: '#ff9a2e', count: 10, size: 2, speed: 3.2, life: 14, gravity: 0.05, spread: 120, direction: 0, shake: 0, glow: true },
  { id: 'fx:bigspark', name: 'Heavy Sparks', kind: 'spark', color: '#ffffff', color2: '#ffcc33', count: 18, size: 3, speed: 4.5, life: 18, gravity: 0.08, spread: 160, direction: 0, shake: 0, glow: true },
  { id: 'fx:block', name: 'Block Flash', kind: 'ring', color: '#9fe8ff', color2: '#3a7bff', count: 1, size: 14, speed: 1.5, life: 10, gravity: 0, spread: 0, direction: 0, shake: 0, glow: true },
  { id: 'fx:smoke', name: 'Smoke', kind: 'smoke', color: '#9a9aa8', color2: '#55555f', count: 8, size: 6, speed: 0.8, life: 40, gravity: -0.03, spread: 120, direction: 90, shake: 0, glow: false },
  { id: 'fx:dust', name: 'Dust Cloud', kind: 'dust', color: '#cdb38a', color2: '#8f7550', count: 8, size: 4, speed: 1.4, life: 24, gravity: -0.01, spread: 160, direction: 90, shake: 0, glow: false },
  { id: 'fx:energy', name: 'Energy Particles', kind: 'energy', color: '#7ff7ff', color2: '#2f6bff', count: 14, size: 2, speed: 2, life: 26, gravity: -0.04, spread: 360, direction: 90, shake: 0, glow: true },
  { id: 'fx:fire', name: 'Fire Burst', kind: 'fire', color: '#ffd23a', color2: '#ff3a1a', count: 16, size: 5, speed: 1.6, life: 26, gravity: -0.08, spread: 140, direction: 90, shake: 0, glow: true },
  { id: 'fx:lightning', name: 'Lightning', kind: 'lightning', color: '#ffffff', color2: '#7fd1ff', count: 4, size: 2, speed: 22, life: 10, gravity: 0, spread: 360, direction: 0, shake: 2, glow: true },
  { id: 'fx:flash', name: 'Impact Flash', kind: 'flash', color: '#ffffff', color2: '#ffe066', count: 1, size: 26, speed: 0, life: 8, gravity: 0, spread: 0, direction: 0, shake: 0, glow: true },
  { id: 'fx:shockwave', name: 'Shockwave', kind: 'shockwave', color: '#ffffff', color2: '#88ccff', count: 1, size: 40, speed: 3, life: 18, gravity: 0, spread: 0, direction: 0, shake: 3, glow: true },
  { id: 'fx:streak', name: 'Motion Streaks', kind: 'streak', color: '#ffffff', color2: '#bde0ff', count: 6, size: 1, speed: 6, life: 10, gravity: 0, spread: 20, direction: 180, shake: 0, glow: false },
  { id: 'fx:ring', name: 'Energy Ring', kind: 'ring', color: '#ffe066', color2: '#ff7a00', count: 1, size: 30, speed: 2.5, life: 16, gravity: 0, spread: 0, direction: 0, shake: 0, glow: true },
  { id: 'fx:explosion', name: 'Explosion', kind: 'fire', color: '#fff2a8', color2: '#ff2a00', count: 40, size: 7, speed: 3.4, life: 34, gravity: -0.04, spread: 360, direction: 90, shake: 8, glow: true },
  { id: 'fx:stars', name: 'Stars', kind: 'star', color: '#fff36b', color2: '#ffffff', count: 6, size: 3, speed: 2, life: 30, gravity: 0.05, spread: 120, direction: 90, shake: 0, glow: true },
  { id: 'fx:pixels', name: 'Pixel Burst', kind: 'pixel', color: '#ff5ec4', color2: '#7a5cff', count: 20, size: 2, speed: 3, life: 24, gravity: 0.12, spread: 180, direction: 90, shake: 0, glow: false },
  { id: 'fx:ice', name: 'Ice Shards', kind: 'spark', color: '#e6fbff', color2: '#5fc8ff', count: 14, size: 3, speed: 3, life: 22, gravity: 0.15, spread: 160, direction: 60, shake: 0, glow: true },
];

export function newEffect(): EffectDef {
  return { id: uid('fx'), name: 'New Effect', kind: 'spark', color: '#ffffff', color2: '#ffcc00', count: 12, size: 3, speed: 3, life: 20, gravity: 0.05, spread: 120, direction: 0, shake: 0, glow: true };
}

export function defaultAlert(name = 'SPECIAL'): CinematicAlert {
  return {
    enabled: true, at: 0, text: name, subtitle: '', portrait: 'character', bgColor: '#b0001e', streakColor: '#ff6a3a',
    textColor: '#ffffff', font: 'Press Start 2P', duration: 70, freeze: true, darken: 0.6, zoom: 1.25, flash: true,
    shake: 2, style: 'band',
  };
}

const TYPE_PRESETS: Record<AttackType, Partial<AttackDef>> = {
  light: { damage: 30, startup: 4, active: 3, recovery: 7, hitstun: 14, blockstun: 9, hitstop: 5, knockback: 2.5, energyGain: 6, cancel: 'chain', priority: 1, hitbox: { x: 10, y: 50, w: 34, h: 14 } },
  medium: { damage: 55, startup: 7, active: 4, recovery: 12, hitstun: 18, blockstun: 12, hitstop: 7, knockback: 3.5, energyGain: 9, cancel: 'chain', priority: 2, hitbox: { x: 10, y: 40, w: 42, h: 18 } },
  heavy: { damage: 90, startup: 11, active: 5, recovery: 20, hitstun: 22, blockstun: 15, hitstop: 10, knockback: 5, energyGain: 13, cancel: 'special', priority: 3, shake: 2, hitbox: { x: 12, y: 40, w: 50, h: 22 } },
  special: { damage: 100, startup: 12, active: 6, recovery: 22, hitstun: 24, blockstun: 16, hitstop: 10, knockback: 6, energyGain: 10, cancel: 'super', priority: 4, chip: 0.15, shake: 3, hitbox: { x: 10, y: 30, w: 50, h: 40 } },
  super: { damage: 260, startup: 8, active: 10, recovery: 30, hitstun: 30, blockstun: 20, hitstop: 14, knockback: 8, energyGain: 0, energyCost: 100, cancel: 'none', priority: 5, chip: 0.25, shake: 6, knockdown: true, hitbox: { x: 0, y: 10, w: 70, h: 70 } },
  throw: { damage: 120, startup: 5, active: 2, recovery: 24, hitstun: 30, blockstun: 0, hitstop: 4, knockback: 6, knockup: 6, energyGain: 10, cancel: 'none', priority: 6, blockable: false, knockdown: true, hitbox: { x: 8, y: 30, w: 26, h: 40 } },
};

export function newAttack(type: AttackType = 'light', name = 'New Attack'): AttackDef {
  const base: AttackDef = {
    id: uid('atk'), name, type,
    input: { button: type === 'light' ? 'L' : type === 'medium' ? 'M' : type === 'heavy' ? 'H' : type === 'throw' ? 'G' : 'S', dir: 'any', motion: 'none' },
    stance: 'ground', damage: 30, chip: 0, knockback: 3, knockup: 5, launcher: false, knockdown: false, blockable: true,
    hitLevel: 'mid', startup: 5, active: 3, recovery: 8, hitstun: 14, blockstun: 9, hitstop: 6, energyCost: 0, energyGain: 6,
    cooldown: 0, hits: 1, priority: 1, cancel: 'chain', moveX: 0, moveY: 0, invincible: 0,
    frames: [], activeFrom: 0, activeTo: 0, hitbox: { x: 10, y: 50, w: 34, h: 14 },
    spawnAt: 0, spawnOffset: { x: 30, y: 55 }, shake: 0, afterimage: false,
    throwRange: 46, throwDir: 'forward',
  };
  Object.assign(base, TYPE_PRESETS[type]);
  base.hitbox = { ...base.hitbox };
  if (type === 'super') base.cinematic = { alert: defaultAlert(name.toUpperCase()), timeline: [], length: 120, useTimeline: false };
  return base;
}

export function newProjectile(name = 'Energy Ball'): ProjectileDef {
  return {
    id: uid('prj'), name, spawnAnim: [], travelAnim: [], impactAnim: [], fps: 12, shape: 'orb',
    color: '#7ff7ff', color2: '#2f6bff', damage: 70, speed: 4.5, size: 14, scale: 1, angle: 0, lifetime: 120,
    knockback: 4, knockup: 4, hitstun: 20, hits: 1, motion: 'straight', curve: 0.5, gravity: 0.15,
    collision: 'clash', strength: 1, opacity: 1, trail: 'fx:energy', trailRate: 3, impactEffect: 'fx:bigspark',
    knockdown: false, blockable: true,
  };
}

export function newTimelineEvent(track: TimelineEvent['track'], t: number): TimelineEvent {
  const e: TimelineEvent = { id: uid('ev'), t, track };
  switch (track) {
    case 'character': e.anim = 'idle'; e.vx = 0; e.vy = 0; e.dur = 20; break;
    case 'opponent': e.oppState = 'hit'; e.dur = 20; break;
    case 'camera': e.zoom = 1.3; e.focus = 'center'; e.dur = 40; e.shake = 0; break;
    case 'effects': e.effect = 'fx:bigspark'; e.ox = 30; e.oy = 50; e.dur = 20; break;
    case 'projectiles': e.projectile = ''; break;
    case 'sound': e.sound = 'heavy'; break;
    case 'dialogue': e.text = 'Here I come!'; e.speaker = 'self'; e.dur = 60; break;
    case 'damage': e.damage = 40; e.box = { x: 0, y: 20, w: 60, h: 60 }; e.kbx = 1; e.kby = 0; e.opener = false; e.hitEffect = 'fx:bigspark'; break;
  }
  return e;
}

export function defaultCharacterEffects(color = '#7ff7ff'): CharacterEffects {
  return {
    ghostDash: { enabled: true, count: 5, color, alpha: 0.55, spacing: 3, fade: 18 },
    jumpDust: { enabled: true, color: '#d8c8a8', size: 3, intensity: 1, style: 'puff' },
    landDust: { enabled: true, color: '#d8c8a8', size: 3, intensity: 1, style: 'dust', hardLanding: true },
    runStreaks: { enabled: true, color: '#ffffff' },
    hitSpark: 'fx:spark', blockSpark: 'fx:block',
    aura: { enabled: true, color, whenMeterFull: true },
    superFlash: '#ffffff',
  };
}

export function newCharacter(name = 'New Fighter'): CharacterDef {
  return {
    formatVersion: FORMAT_VERSION, id: uid('chr'), name, description: '', color: '#ff5e5e',
    stats: { maxHealth: 1000, walkSpeed: 2.2, runSpeed: 4.6, jumpHeight: 90, attackPower: 1, defense: 1, dashSpeed: 6, weight: 1, width: 34, height: 92, airJumps: 0 },
    portrait: '', sheets: [], scale: 1, facesLeft: false, animations: {},
    attacks: [], projectiles: [], effectPresets: [], effects: defaultCharacterEffects('#ff9a9a'),
    dialogue: { intro: [], victory: ['Another victory for me!'], vsVictory: [], preFight: [], taunt: [] },
    sounds: {}, voices: {},
  };
}

export function newLayer(name = 'Layer'): StageLayer {
  return { id: uid('lyr'), name, image: '', parallax: 0.5, y: 0, x: 0, scale: 1, repeatX: true, scrollSpeed: 0, frames: 1, fps: 8, opacity: 1, foreground: false };
}

export function newStage(name = 'New Stage'): StageDef {
  return {
    formatVersion: FORMAT_VERSION, id: uid('stg'), name, width: 1000, floorY: 318, skyTop: '#1a1440', skyBottom: '#6a3a7a',
    layers: [], music: '', musicTheme: 1, weather: 'none', weatherDensity: 1, ambient: 'none', camLeft: 0, camRight: 0,
    floorColor: '#3a2a3a', reflection: false,
  };
}

export const DEFAULT_P1: KeyBindings = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  L: ['KeyJ'], M: ['KeyK'], H: ['KeyL'], S: ['KeyU'], G: ['KeyI'], D: ['KeyO'], pause: ['Escape', 'Enter'],
};
export const DEFAULT_P2: KeyBindings = {
  up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
  L: ['Numpad1', 'Comma'], M: ['Numpad2', 'Period'], H: ['Numpad3', 'Slash'], S: ['Numpad4', 'Semicolon'], G: ['Numpad5', 'Quote'], D: ['Numpad6', 'BracketRight'], pause: ['Backspace'],
};

export function defaultSettings(): Settings {
  return {
    p1Keys: JSON.parse(JSON.stringify(DEFAULT_P1)), p2Keys: JSON.parse(JSON.stringify(DEFAULT_P2)),
    volume: { master: 0.8, music: 0.5, sfx: 0.8, voice: 1 },
    aiLevel: 4, rounds: 2, roundTime: 99, touchControls: 'auto', shake: 1, hitstop: 1, particles: 1,
    damageScaling: true, tts: false, showInputs: false, cinematics: 'all', scanlines: true,
  };
}

/** Make sure older/partial character files have every field the engine expects. */
export function normalizeCharacter(c: Partial<CharacterDef>): CharacterDef {
  const d = newCharacter(c.name || 'Fighter');
  const out: CharacterDef = { ...d, ...c } as CharacterDef;
  out.stats = { ...d.stats, ...(c.stats || {}) };
  out.effects = { ...defaultCharacterEffects(), ...(c.effects || {}) } as CharacterEffects;
  out.effects.ghostDash = { ...defaultCharacterEffects().ghostDash, ...(c.effects?.ghostDash || {}) };
  out.effects.jumpDust = { ...defaultCharacterEffects().jumpDust, ...(c.effects?.jumpDust || {}) };
  out.effects.landDust = { ...defaultCharacterEffects().landDust, ...(c.effects?.landDust || {}) };
  out.effects.aura = { ...defaultCharacterEffects().aura, ...(c.effects?.aura || {}) };
  out.dialogue = { ...d.dialogue, ...(c.dialogue || {}) };
  out.sheets = c.sheets || [];
  out.animations = c.animations || {};
  out.attacks = (c.attacks || []).map(a => {
    const base = newAttack(a.type || 'light', a.name);
    const m = { ...base, ...a } as AttackDef;
    m.input = { ...base.input, ...(a.input || {}) };
    m.hitbox = { ...base.hitbox, ...(a.hitbox || {}) };
    m.spawnOffset = { ...base.spawnOffset, ...(a.spawnOffset || {}) };
    m.frames = a.frames || [];
    if (m.cinematic) m.cinematic = { ...{ alert: defaultAlert(m.name), timeline: [], length: 120, useTimeline: false }, ...m.cinematic, alert: { ...defaultAlert(m.name), ...m.cinematic.alert } };
    return m;
  });
  out.projectiles = (c.projectiles || []).map(p => ({ ...newProjectile(), ...p }));
  out.effectPresets = c.effectPresets || [];
  out.sounds = c.sounds || {};
  out.voices = c.voices || {};
  out.formatVersion = FORMAT_VERSION;
  return out;
}

export function normalizeStage(s: Partial<StageDef>): StageDef {
  const d = newStage(s.name);
  const out = { ...d, ...s } as StageDef;
  out.layers = (s.layers || []).map(l => ({ ...newLayer(), ...l }));
  return out;
}
