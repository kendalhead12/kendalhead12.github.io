// Procedural sound effects (WebAudio) and voice lines (speech synthesis).
import { G } from './state.js';
import { settings, onSettingsChange } from './config.js';

let ctx = null, master = null, noiseBuf = null;
const listenerPos = { x: 0, y: 0, z: 0 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) { return; }
  master = ctx.createGain();
  master.gain.value = settings.volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
onSettingsChange((k, v) => { if (k === 'volume' && master) master.gain.value = v; });

export function updateListener(cam) {
  if (!ctx) return;
  const p = cam.getWorldPosition(new G.THREE.Vector3());
  const f = new G.THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new G.THREE.Quaternion()));
  listenerPos.x = p.x; listenerPos.y = p.y; listenerPos.z = p.z;
  const L = ctx.listener;
  if (L.positionX) {
    L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z;
    L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z;
    L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
  } else if (L.setPosition) { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
}

function dist(pos) {
  if (!pos) return 0;
  const dx = pos.x - listenerPos.x, dy = pos.y - listenerPos.y, dz = pos.z - listenerPos.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Output node: positional panner if pos given.
function out(pos, vol = 1, maxDist = 80) {
  const g = ctx.createGain();
  g.gain.value = vol;
  if (pos) {
    const p = ctx.createPanner();
    p.panningModel = 'equalpower';
    p.distanceModel = 'inverse';
    p.refDistance = 3; p.maxDistance = maxDist; p.rolloffFactor = 1.1;
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
    g.connect(p); p.connect(master);
  } else g.connect(master);
  return g;
}

function noise(dest, t, dur, { type = 'lowpass', freq = 1000, q = 1, vol = 1, attack = 0.002, decay, freqEnd } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + (decay || dur));
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}

function tone(dest, t, dur, { type = 'sine', freq = 440, freqEnd, vol = 0.5, attack = 0.005, vibrato = 0, vibRate = 6, filter } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  let node = o;
  if (vibrato) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = vibRate;
    const lg = ctx.createGain(); lg.gain.value = vibrato;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  if (filter) {
    const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.freq; f.Q.value = filter.q || 1;
    node.connect(f); node = f;
  }
  node.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

const SFX = {
  pistol: (d, t) => { noise(d, t, 0.25, { freq: 3500, freqEnd: 300, vol: 1.2 }); tone(d, t, 0.12, { freq: 160, freqEnd: 50, vol: 0.8, type: 'square', filter: { freq: 600 } }); },
  revolver: (d, t) => { noise(d, t, 0.4, { freq: 2500, freqEnd: 200, vol: 1.5 }); tone(d, t, 0.2, { freq: 120, freqEnd: 40, vol: 1, type: 'square', filter: { freq: 500 } }); },
  shotgun: (d, t) => { noise(d, t, 0.55, { freq: 2000, freqEnd: 120, vol: 1.8 }); tone(d, t, 0.25, { freq: 90, freqEnd: 30, vol: 1.2, type: 'sawtooth', filter: { freq: 400 } }); },
  rifle: (d, t) => { noise(d, t, 0.22, { freq: 4500, freqEnd: 400, vol: 1.1 }); tone(d, t, 0.1, { freq: 200, freqEnd: 60, vol: 0.7, type: 'square', filter: { freq: 700 } }); },
  smg: (d, t) => { noise(d, t, 0.15, { freq: 5000, freqEnd: 600, vol: 0.9 }); tone(d, t, 0.07, { freq: 240, freqEnd: 80, vol: 0.5, type: 'square', filter: { freq: 800 } }); },
  sniper: (d, t) => { noise(d, t, 0.9, { freq: 3000, freqEnd: 100, vol: 2 }); tone(d, t, 0.35, { freq: 110, freqEnd: 30, vol: 1.3, type: 'sawtooth', filter: { freq: 500 } }); },
  empty: (d, t) => { tone(d, t, 0.04, { freq: 1800, vol: 0.3, type: 'square' }); },
  reload: (d, t) => { tone(d, t, 0.05, { freq: 900, vol: 0.3, type: 'square' }); tone(d, t + 0.18, 0.06, { freq: 600, vol: 0.35, type: 'square' }); noise(d, t + 0.3, 0.08, { freq: 3000, type: 'bandpass', vol: 0.4 }); },
  swing: (d, t) => { noise(d, t, 0.22, { type: 'bandpass', freq: 600, freqEnd: 2200, q: 2, vol: 0.5, attack: 0.08 }); },
  punch: (d, t) => { noise(d, t, 0.12, { freq: 400, vol: 1.2 }); tone(d, t, 0.1, { freq: 120, freqEnd: 50, vol: 0.9 }); },
  bat: (d, t) => { noise(d, t, 0.15, { freq: 900, vol: 1.2 }); tone(d, t, 0.15, { freq: 300, freqEnd: 120, vol: 0.6, type: 'triangle' }); },
  metal: (d, t) => { for (const f of [800, 1270, 2130]) tone(d, t, 0.6, { freq: f, vol: 0.2, type: 'sine' }); noise(d, t, 0.08, { freq: 2000, vol: 0.6 }); },
  slice: (d, t) => { noise(d, t, 0.18, { type: 'highpass', freq: 2500, vol: 0.8 }); noise(d, t + 0.02, 0.1, { freq: 500, vol: 0.6 }); },
  thud: (d, t, v = 1) => { tone(d, t, 0.18, { freq: 90, freqEnd: 40, vol: 0.8 * v }); noise(d, t, 0.1, { freq: 350, vol: 0.6 * v }); },
  wood: (d, t) => { tone(d, t, 0.12, { freq: 220, freqEnd: 140, vol: 0.5, type: 'triangle' }); noise(d, t, 0.08, { freq: 1200, type: 'bandpass', vol: 0.5 }); },
  break: (d, t) => { for (let i = 0; i < 4; i++) noise(d, t + i * 0.03, 0.15, { freq: 1500 + i * 300, type: 'bandpass', vol: 0.6 }); tone(d, t, 0.2, { freq: 160, freqEnd: 60, vol: 0.5, type: 'triangle' }); },
  glass: (d, t) => { for (let i = 0; i < 6; i++) tone(d, t + i * 0.025, 0.3, { freq: 2500 + Math.random() * 3000, vol: 0.15 }); noise(d, t, 0.3, { type: 'highpass', freq: 4000, vol: 0.7 }); },
  explosion: (d, t) => { noise(d, t, 1.6, { freq: 1500, freqEnd: 60, vol: 2.2 }); tone(d, t, 0.9, { freq: 70, freqEnd: 25, vol: 1.6, type: 'sawtooth', filter: { freq: 200 } }); },
  zap: (d, t) => { tone(d, t, 0.3, { freq: 2400, freqEnd: 400, vol: 0.4, type: 'sawtooth', filter: { freq: 3000 } }); noise(d, t, 0.3, { type: 'highpass', freq: 5000, vol: 0.3 }); },
  freeze: (d, t) => { tone(d, t, 0.5, { freq: 3000, freqEnd: 1500, vol: 0.25, vibrato: 400, vibRate: 30 }); noise(d, t, 0.5, { type: 'highpass', freq: 6000, vol: 0.4 }); },
  energy: (d, t) => { tone(d, t, 0.25, { freq: 900, freqEnd: 200, vol: 0.5, type: 'square', filter: { freq: 2000 } }); tone(d, t, 0.25, { freq: 1350, freqEnd: 300, vol: 0.3, type: 'sawtooth', filter: { freq: 2000 } }); },
  energyHit: (d, t) => { noise(d, t, 0.5, { freq: 3000, freqEnd: 200, vol: 1 }); tone(d, t, 0.4, { freq: 400, freqEnd: 60, vol: 0.6, type: 'square', filter: { freq: 900 } }); },
  shockwave: (d, t) => { tone(d, t, 0.8, { freq: 120, freqEnd: 30, vol: 1.6, type: 'sine' }); noise(d, t, 0.7, { freq: 800, freqEnd: 80, vol: 1.4 }); tone(d, t, 0.3, { freq: 600, freqEnd: 100, vol: 0.5, type: 'sawtooth', filter: { freq: 1000 } }); },
  punt: (d, t) => { tone(d, t, 0.25, { freq: 300, freqEnd: 80, vol: 0.9, type: 'square', filter: { freq: 1200 } }); noise(d, t, 0.2, { freq: 2000, vol: 0.8 }); },
  physgun: (d, t) => { tone(d, t, 0.15, { freq: 500, freqEnd: 900, vol: 0.25, type: 'triangle' }); },
  toolgun: (d, t) => { tone(d, t, 0.12, { freq: 1200, freqEnd: 2400, vol: 0.25, type: 'square', filter: { freq: 3000 } }); },
  spawn: (d, t) => { tone(d, t, 0.15, { freq: 600, freqEnd: 1200, vol: 0.25, type: 'triangle' }); },
  remove: (d, t) => { tone(d, t, 0.2, { freq: 1200, freqEnd: 300, vol: 0.25, type: 'triangle' }); },
  ui: (d, t) => { tone(d, t, 0.05, { freq: 1400, vol: 0.15, type: 'triangle' }); },
  hurt: (d, t) => { tone(d, t, 0.2, { freq: 200, freqEnd: 90, vol: 0.5, type: 'sawtooth', filter: { freq: 800 } }); },
  ricochet: (d, t) => { tone(d, t, 0.25, { freq: 3000 + Math.random() * 2000, freqEnd: 1200, vol: 0.15 }); },
  // creature vocalizations (synthesised, not speech)
  scream: (d, t, v = 1, pitch = 1) => {
    const f = 520 * pitch;
    tone(d, t, 0.9, { freq: f, freqEnd: f * 1.25, vol: 0.35 * v, type: 'sawtooth', vibrato: 30, vibRate: 7, filter: { type: 'bandpass', freq: 1400, q: 2 } });
    tone(d, t, 0.9, { freq: f * 2, freqEnd: f * 2.4, vol: 0.12 * v, type: 'sawtooth', vibrato: 50, vibRate: 7, filter: { type: 'bandpass', freq: 2600, q: 3 } });
    noise(d, t, 0.9, { type: 'bandpass', freq: 2200, q: 2, vol: 0.15 * v, attack: 0.05 });
  },
  pain: (d, t, v = 1, pitch = 1) => { tone(d, t, 0.35, { freq: 300 * pitch, freqEnd: 180 * pitch, vol: 0.35 * v, type: 'sawtooth', filter: { type: 'bandpass', freq: 900, q: 2 } }); },
  groan: (d, t, v = 1, pitch = 1) => {
    tone(d, t, 1.3, { freq: 95 * pitch, freqEnd: 70 * pitch, vol: 0.45 * v, type: 'sawtooth', vibrato: 6, vibRate: 4, attack: 0.25, filter: { type: 'bandpass', freq: 500, q: 3 } });
    noise(d, t, 1.2, { type: 'bandpass', freq: 400, q: 4, vol: 0.2 * v, attack: 0.3 });
  },
  zombieAttack: (d, t, v = 1) => { tone(d, t, 0.5, { freq: 160, freqEnd: 90, vol: 0.5 * v, type: 'sawtooth', vibrato: 20, vibRate: 15, filter: { type: 'bandpass', freq: 700, q: 2 } }); },
  growl: (d, t, v = 1) => {
    tone(d, t, 1.6, { freq: 55, freqEnd: 45, vol: 0.9 * v, type: 'sawtooth', vibrato: 8, vibRate: 11, attack: 0.2, filter: { freq: 350 } });
    noise(d, t, 1.5, { freq: 300, q: 5, type: 'bandpass', vol: 0.4 * v, attack: 0.3 });
  },
  roar: (d, t, v = 1) => {
    tone(d, t, 2.4, { freq: 90, freqEnd: 40, vol: 1.3 * v, type: 'sawtooth', vibrato: 14, vibRate: 13, attack: 0.15, filter: { freq: 700 } });
    tone(d, t, 2.2, { freq: 180, freqEnd: 70, vol: 0.6 * v, type: 'square', vibrato: 20, vibRate: 9, attack: 0.2, filter: { freq: 900 } });
    noise(d, t, 2.4, { freq: 900, freqEnd: 200, vol: 0.9 * v, attack: 0.2 });
  },
  stomp: (d, t, v = 1) => { tone(d, t, 0.35, { freq: 60, freqEnd: 25, vol: 1.1 * v }); noise(d, t, 0.2, { freq: 200, vol: 0.6 * v }); },
  crunch: (d, t, v = 1) => { for (let i = 0; i < 3; i++) noise(d, t + i * 0.04, 0.12, { freq: 900 + i * 400, type: 'bandpass', q: 1.5, vol: 0.8 * v }); tone(d, t, 0.2, { freq: 140, freqEnd: 60, vol: 0.6 * v, type: 'triangle' }); },
  bones: (d, t) => { for (let i = 0; i < 5; i++) tone(d, t + i * 0.035, 0.08, { freq: 700 + Math.random() * 900, vol: 0.25, type: 'triangle' }); },
  engine: (d, t) => { tone(d, t, 0.5, { freq: 60, freqEnd: 90, vol: 0.4, type: 'sawtooth', filter: { freq: 400 } }); },
  horn: (d, t) => { tone(d, t, 0.6, { freq: 400, vol: 0.4, type: 'square', filter: { freq: 1200 } }); tone(d, t, 0.6, { freq: 500, vol: 0.3, type: 'square', filter: { freq: 1200 } }); },
  splash: (d, t) => { noise(d, t, 0.6, { freq: 1200, freqEnd: 300, vol: 0.9, attack: 0.02 }); },
  tear: (d, t) => { noise(d, t, 0.35, { type: 'bandpass', freq: 500, freqEnd: 2400, q: 3, vol: 1.1, attack: 0.02 }); noise(d, t + 0.05, 0.25, { freq: 700, freqEnd: 150, vol: 0.9 }); tone(d, t, 0.15, { freq: 180, freqEnd: 70, vol: 0.5, type: 'triangle' }); },
  gore: (d, t) => { noise(d, t, 0.45, { freq: 900, freqEnd: 120, q: 4, vol: 1.2 }); noise(d, t + 0.03, 0.3, { type: 'bandpass', freq: 350, q: 6, vol: 0.8 }); tone(d, t, 0.25, { freq: 110, freqEnd: 45, vol: 0.6, type: 'sine' }); },
  chew: (d, t) => { noise(d, t, 0.1, { type: 'bandpass', freq: 600 + Math.random() * 500, q: 3, vol: 0.7 }); noise(d, t + 0.04, 0.08, { freq: 400, vol: 0.5 }); },
  squish: (d, t) => { noise(d, t, 0.25, { freq: 600, freqEnd: 150, vol: 0.9 }); tone(d, t, 0.2, { freq: 200, freqEnd: 70, vol: 0.4, type: 'triangle' }); },
};

const recent = {};
// play(name, pos?, vol?, extra...) — pos undefined = 2D (UI / player)
export function play(name, pos, vol = 1, ...args) {
  if (!ctx || !SFX[name]) return;
  const maxDist = { explosion: 250, sniper: 250, shotgun: 160, roar: 200, scream: 90 }[name] || 90;
  if (pos && dist(pos) > maxDist) return;
  // simple voice limiting
  const now = ctx.currentTime;
  recent[name] = (recent[name] || []).filter(x => now - x < 0.08);
  if (recent[name].length > 3) return;
  recent[name].push(now);
  const d = out(pos, vol, maxDist);
  SFX[name](d, now + 0.005, ...args);
}

// ---- Voice lines ----
let speaking = null;
let voices = [];
if ('speechSynthesis' in window) {
  const load = () => { voices = speechSynthesis.getVoices().filter(v => /en/i.test(v.lang)); };
  load(); speechSynthesis.onvoiceschanged = load;
}

// priority: 0 idle, 1 angry, 2 scared
export function speak(text, pos, { pitch = 1, rate = 1, voiceIndex = 0, priority = 0 } = {}) {
  if (!settings.voices || !('speechSynthesis' in window)) return;
  const d = dist(pos);
  if (d > 30) return;
  if (speechSynthesis.speaking) {
    if (!speaking || priority <= speaking.priority) return;
    speechSynthesis.cancel();
  }
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = pitch; u.rate = rate;
  u.volume = Math.max(0.05, Math.min(1, (1 - d / 30) * settings.volume * 1.3));
  if (voices.length) u.voice = voices[voiceIndex % voices.length];
  speaking = { priority };
  u.onend = () => { speaking = null; };
  try { speechSynthesis.speak(u); } catch (e) {}
}

export function stopSpeech() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }
