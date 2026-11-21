// Shared game state. Every module imports G and reads/writes the pieces it needs.
export const G = {
  THREE: null,
  RAPIER: null,
  scene: null,
  camera: null,
  renderer: null,
  vmScene: null,      // viewmodel scene (weapons in hand)
  vmCamera: null,
  world: null,        // Rapier world
  player: null,
  map: null,
  mapId: 'superflat',
  creatures: [],      // living + dead creatures
  props: [],
  vehicles: [],
  spawners: [],
  welds: [],
  noises: [],         // {pos, radius, time, type, source}
  time: 0,            // simulated seconds
  realTime: 0,
  simPaused: false,
  shake: 0,
  playing: false,
  nextId: 1,
  undoStack: [],
  ui: null,
};

export function newId() { return G.nextId++; }

export function emitNoise(pos, radius, type, source) {
  G.noises.push({ pos: pos.clone ? pos.clone() : { ...pos }, radius, type, source, time: G.time });
  if (G.noises.length > 64) G.noises.shift();
}
