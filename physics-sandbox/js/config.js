// Sandbox + graphics settings. Changes apply immediately through listeners.
const KEY = 'chaosSandbox.settings.v1';

export const defaults = {
  npcRetaliation: true,
  npcFear: true,
  npcIntelligence: 'medium',  // low | medium | high
  npcInvincible: false,
  playerInvincible: false,
  infiniteAmmo: false,
  blood: true,
  gore: true,                 // dismemberment, gibs, Maneaters eating prey (needs blood on)
  damageFx: 'medium',         // low | medium | high
  fxIntensity: 1,             // 0..2 visual-effects intensity slider
  ragdolls: true,
  gravity: 9.81,
  gameSpeed: 1,
  friendlyFire: false,
  populationLimit: 60,
  voices: true,
  // graphics
  shadows: 'high',            // off | low | high
  resScale: 1,
  drawDistance: 700,
  fov: 75,
  grass: true,
  // controls/audio
  sensitivity: 1,
  volume: 0.7,
  invertY: false,
};

export const settings = { ...defaults };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const k in saved) if (k in defaults) settings[k] = saved[k];
} catch (e) { /* storage unavailable */ }

const listeners = [];
export function onSettingsChange(fn) { listeners.push(fn); }

export function setSetting(key, value) {
  settings[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) {}
  for (const fn of listeners) fn(key, value);
}

export function resetSettings() {
  for (const k in defaults) setSetting(k, defaults[k]);
}

// Effects multiplier used by particle counts etc.
export function fxScale() {
  const base = { low: 0.4, medium: 1, high: 1.8 }[settings.damageFx] || 1;
  return base * settings.fxIntensity;
}

export function aiProfile() {
  return {
    low: { think: 0.5, sight: 22, pathfind: false, warn: false, hide: false, memory: 8 },
    medium: { think: 0.25, sight: 32, pathfind: true, warn: true, hide: true, memory: 20 },
    high: { think: 0.12, sight: 45, pathfind: true, warn: true, hide: true, memory: 40 },
  }[settings.npcIntelligence] || { think: 0.25, sight: 32, pathfind: true, warn: true, hide: true, memory: 20 };
}

// ---- Factions ----
// relation[a][b] = how faction a feels about faction b: 'friendly' | 'neutral' | 'hostile'
export const FACTIONS = ['player', 'human', 'zombie', 'monster', 'dummy'];
export const FACTION_NAMES = { player: 'Player', human: 'Humans', zombie: 'Zombies', monster: 'Monsters', dummy: 'Dummies' };
const FKEY = 'chaosSandbox.factions.v1';
export const defaultRelations = {
  player: { player: 'friendly', human: 'neutral', zombie: 'hostile', monster: 'hostile', dummy: 'neutral' },
  human: { player: 'neutral', human: 'neutral', zombie: 'hostile', monster: 'hostile', dummy: 'neutral' },
  zombie: { player: 'hostile', human: 'hostile', zombie: 'friendly', monster: 'hostile', dummy: 'neutral' },
  monster: { player: 'hostile', human: 'hostile', zombie: 'hostile', monster: 'friendly', dummy: 'neutral' },
  dummy: { player: 'neutral', human: 'neutral', zombie: 'neutral', monster: 'neutral', dummy: 'neutral' },
};
export const relations = JSON.parse(JSON.stringify(defaultRelations));
try {
  const saved = JSON.parse(localStorage.getItem(FKEY) || '{}');
  for (const a in saved) for (const b in saved[a]) if (relations[a] && relations[a][b]) relations[a][b] = saved[a][b];
} catch (e) {}

export function setRelation(a, b, v) {
  relations[a][b] = v;
  try { localStorage.setItem(FKEY, JSON.stringify(relations)); } catch (e) {}
}
export function resetRelations() {
  for (const a in defaultRelations) for (const b in defaultRelations[a]) relations[a][b] = defaultRelations[a][b];
  try { localStorage.setItem(FKEY, JSON.stringify(relations)); } catch (e) {}
}
export function relation(a, b) { return (relations[a] && relations[a][b]) || 'neutral'; }
