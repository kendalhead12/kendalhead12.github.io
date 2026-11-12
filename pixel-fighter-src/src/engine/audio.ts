// Audio: synthesized retro SFX + custom uploaded clips + simple chiptune music.
import type { CharacterDef, Settings } from './types';

type Synth = (ctx: AudioContext, out: AudioNode, t: number) => void;

function env(ctx: AudioContext, out: AudioNode, t: number, a: number, d: number, peak = 1) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  g.connect(out);
  return g;
}
function osc(ctx: AudioContext, type: OscillatorType, f0: number, f1: number, t: number, dur: number, out: AudioNode) {
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext, t: number, dur: number, out: AudioNode, freq = 2000, q = 1, type: BiquadFilterType = 'bandpass') {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  s.connect(f); f.connect(out); s.start(t); s.stop(t + dur);
}

const SYNTH: Record<string, Synth> = {
  punch: (c, o, t) => { noise(c, t, 0.08, env(c, o, t, 0.005, 0.08, 0.5), 1800, 0.8); },
  kick: (c, o, t) => { noise(c, t, 0.1, env(c, o, t, 0.005, 0.1, 0.5), 900, 0.7); },
  whoosh: (c, o, t) => { noise(c, t, 0.14, env(c, o, t, 0.02, 0.12, 0.35), 2600, 2); },
  hit: (c, o, t) => { noise(c, t, 0.1, env(c, o, t, 0.002, 0.1, 0.9), 900, 0.6); osc(c, 'square', 180, 60, t, 0.08, env(c, o, t, 0.002, 0.08, 0.35)); },
  hitHeavy: (c, o, t) => { noise(c, t, 0.22, env(c, o, t, 0.002, 0.22, 1), 500, 0.5); osc(c, 'square', 140, 40, t, 0.2, env(c, o, t, 0.002, 0.2, 0.5)); },
  block: (c, o, t) => { osc(c, 'square', 900, 600, t, 0.05, env(c, o, t, 0.002, 0.06, 0.25)); noise(c, t, 0.05, env(c, o, t, 0.002, 0.05, 0.4), 4000, 3); },
  jump: (c, o, t) => { osc(c, 'square', 220, 520, t, 0.1, env(c, o, t, 0.005, 0.1, 0.12)); },
  land: (c, o, t) => { noise(c, t, 0.06, env(c, o, t, 0.002, 0.06, 0.3), 400, 0.6); },
  dash: (c, o, t) => { noise(c, t, 0.16, env(c, o, t, 0.01, 0.16, 0.4), 1500, 1.5, 'highpass'); },
  projectile: (c, o, t) => { osc(c, 'sawtooth', 300, 900, t, 0.18, env(c, o, t, 0.01, 0.2, 0.18)); noise(c, t, 0.2, env(c, o, t, 0.01, 0.2, 0.25), 3000, 1); },
  special: (c, o, t) => { osc(c, 'square', 440, 880, t, 0.12, env(c, o, t, 0.005, 0.15, 0.15)); osc(c, 'square', 660, 1320, t + 0.06, 0.12, env(c, o, t + 0.06, 0.005, 0.15, 0.1)); },
  super: (c, o, t) => { [0, 0.08, 0.16, 0.24].forEach((d, i) => osc(c, 'square', 330 * (1 + i * 0.25), 660 * (1 + i * 0.25), t + d, 0.12, env(c, o, t + d, 0.005, 0.18, 0.14))); noise(c, t, 0.5, env(c, o, t, 0.05, 0.5, 0.25), 6000, 0.5, 'highpass'); },
  thunder: (c, o, t) => { noise(c, t, 0.35, env(c, o, t, 0.002, 0.35, 0.7), 1200, 0.3); osc(c, 'sawtooth', 1200, 200, t, 0.2, env(c, o, t, 0.002, 0.2, 0.12)); },
  explosion: (c, o, t) => { noise(c, t, 0.8, env(c, o, t, 0.005, 0.8, 1), 300, 0.4, 'lowpass'); osc(c, 'sine', 90, 30, t, 0.6, env(c, o, t, 0.005, 0.6, 0.6)); },
  throw: (c, o, t) => { noise(c, t, 0.12, env(c, o, t, 0.01, 0.12, 0.4), 700, 1); },
  grab: (c, o, t) => { osc(c, 'square', 200, 150, t, 0.06, env(c, o, t, 0.002, 0.06, 0.25)); },
  heavy: (c, o, t) => { noise(c, t, 0.2, env(c, o, t, 0.01, 0.2, 0.6), 300, 0.8); },
  clash: (c, o, t) => { osc(c, 'square', 1400, 900, t, 0.1, env(c, o, t, 0.002, 0.12, 0.2)); osc(c, 'square', 1800, 1200, t, 0.1, env(c, o, t, 0.002, 0.12, 0.15)); },
  ko: (c, o, t) => { noise(c, t, 1, env(c, o, t, 0.005, 1, 0.9), 200, 0.4, 'lowpass'); [0, 0.15, 0.3].forEach(d => osc(c, 'square', 300 - d * 300, 80, t + d, 0.3, env(c, o, t + d, 0.005, 0.3, 0.2))); },
  round: (c, o, t) => { [0, 0.1].forEach(d => osc(c, 'square', 523, 523, t + d, 0.08, env(c, o, t + d, 0.005, 0.08, 0.15))); },
  fight: (c, o, t) => { osc(c, 'square', 523, 1046, t, 0.3, env(c, o, t, 0.005, 0.3, 0.18)); osc(c, 'square', 659, 1318, t, 0.3, env(c, o, t, 0.005, 0.3, 0.12)); },
  select: (c, o, t) => { osc(c, 'square', 880, 880, t, 0.04, env(c, o, t, 0.002, 0.05, 0.12)); },
  confirm: (c, o, t) => { osc(c, 'square', 660, 1320, t, 0.12, env(c, o, t, 0.002, 0.14, 0.15)); },
  back: (c, o, t) => { osc(c, 'square', 440, 220, t, 0.1, env(c, o, t, 0.002, 0.1, 0.12)); },
  hurt: () => { /* silent by default; characters can upload a hurt sound */ },
  victory: (c, o, t) => { [523, 659, 784, 1046].forEach((f, i) => osc(c, 'square', f, f, t + i * 0.12, 0.1, env(c, o, t + i * 0.12, 0.005, 0.14, 0.14))); },
};
export const SYNTH_NAMES = Object.keys(SYNTH);

/** Character sound slots that the editor exposes. */
export const SOUND_SLOTS: { key: string; label: string; synth: string }[] = [
  { key: 'punch', label: 'Punches', synth: 'punch' },
  { key: 'kick', label: 'Kicks', synth: 'kick' },
  { key: 'jump', label: 'Jumping', synth: 'jump' },
  { key: 'land', label: 'Landing', synth: 'land' },
  { key: 'dash', label: 'Dashing', synth: 'dash' },
  { key: 'projectile', label: 'Projectiles', synth: 'projectile' },
  { key: 'special', label: 'Special attacks', synth: 'special' },
  { key: 'super', label: 'Super attacks', synth: 'super' },
  { key: 'hit', label: 'Landing a hit', synth: 'hit' },
  { key: 'hurt', label: 'Taking damage', synth: 'hurt' },
  { key: 'block', label: 'Blocking', synth: 'block' },
  { key: 'victory', label: 'Victory screen', synth: 'victory' },
  { key: 'select', label: 'Character selected', synth: 'confirm' },
];
export const VOICE_SLOTS: { key: string; label: string }[] = [
  { key: 'intro', label: 'Introduction' },
  { key: 'victory', label: 'Victory line' },
  { key: 'select', label: 'Selected on roster' },
  { key: 'ko', label: 'Knocked out' },
  { key: 'hurt', label: 'Hurt grunt' },
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; music!: GainNode; voice!: GainNode;
  buffers = new Map<string, AudioBuffer | 'loading' | 'error'>();
  settings: Settings['volume'] = { master: 0.8, music: 0.5, sfx: 0.8, voice: 1 };
  musicEl: HTMLAudioElement | null = null;
  seqTimer: number | null = null;
  tts = false;
  lastPlay = new Map<string, number>();

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC() as AudioContext;
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    this.music = this.ctx.createGain(); this.music.connect(this.master);
    this.voice = this.ctx.createGain(); this.voice.connect(this.master);
    this.applyVolume();
    return this.ctx;
  }
  setVolume(v: Settings['volume']) { this.settings = { ...v }; this.applyVolume(); }
  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.value = this.settings.master;
    this.sfx.gain.value = this.settings.sfx;
    this.music.gain.value = this.settings.music * 0.5;
    this.voice.gain.value = this.settings.voice;
    if (this.musicEl) this.musicEl.volume = Math.min(1, this.settings.master * this.settings.music);
  }

  async decode(src: string): Promise<AudioBuffer | null> {
    const ctx = this.ensure(); if (!ctx) return null;
    const c = this.buffers.get(src);
    if (c && c !== 'loading' && c !== 'error') return c;
    if (c === 'loading' || c === 'error') return null;
    this.buffers.set(src, 'loading');
    try {
      const res = await fetch(src);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.buffers.set(src, buf);
      return buf;
    } catch { this.buffers.set(src, 'error'); return null; }
  }
  preload(srcs: string[]) { for (const s of srcs) if (s && s.startsWith('data:')) this.decode(s); }

  playBuffer(buf: AudioBuffer, bus: GainNode, rate = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rate;
    s.connect(bus); s.start();
  }

  /** Play a sound key or data URL, honoring a character's custom sound overrides. */
  play(key: string, def?: CharacterDef | null, bus: 'sfx' | 'voice' = 'sfx') {
    const ctx = this.ensure(); if (!ctx || !key) return;
    const now = performance.now();
    const throttleKey = key + (def?.id || '');
    if ((this.lastPlay.get(throttleKey) || 0) > now - 30) return;
    this.lastPlay.set(throttleKey, now);
    const out = bus === 'voice' ? this.voice : this.sfx;
    let src = '';
    if (key.startsWith('data:')) src = key;
    else if (def?.sounds[key]) src = def.sounds[key];
    if (src) {
      const b = this.buffers.get(src);
      if (b && b !== 'loading' && b !== 'error') this.playBuffer(b, out);
      else this.decode(src).then(buf => buf && this.playBuffer(buf, out));
      return;
    }
    const synth = SYNTH[key] || (key === 'light' || key === 'medium' ? SYNTH.punch : null);
    if (synth) synth(ctx, out, ctx.currentTime + 0.001);
  }

  voiceLine(def: CharacterDef, key: string, fallbackText?: string) {
    const clip = key.startsWith('atk:') ? def.attacks.find(a => 'atk:' + a.id === key)?.voice : def.voices[key];
    if (clip) { this.play(clip, def, 'voice'); return; }
    if (fallbackText) this.speak(fallbackText);
  }
  speak(text: string) {
    if (!this.tts || !('speechSynthesis' in window)) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.volume = Math.min(1, this.settings.master * this.settings.voice);
      u.rate = 1.05; u.pitch = 0.9;
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }

  // ---------------- music ----------------
  stopMusic() {
    if (this.musicEl) { this.musicEl.pause(); this.musicEl.src = ''; this.musicEl = null; }
    if (this.seqTimer !== null) { clearInterval(this.seqTimer); this.seqTimer = null; }
  }
  playMusic(src: string, theme = 1) {
    this.stopMusic();
    if (this.settings.music <= 0) return;
    if (src) {
      const el = new Audio(src); el.loop = true; el.volume = Math.min(1, this.settings.master * this.settings.music);
      el.play().catch(() => { /* needs gesture */ });
      this.musicEl = el;
      return;
    }
    const ctx = this.ensure(); if (!ctx) return;
    // tiny chiptune sequencer
    const scales = [[0, 3, 5, 7, 10], [0, 2, 3, 7, 8], [0, 3, 5, 6, 7, 10], [0, 2, 4, 7, 9], [0, 2, 3, 5, 7, 8, 10], [0, 3, 7, 10, 12]];
    const scale = scales[theme % scales.length];
    const root = [45, 43, 40, 47, 42, 44][theme % 6];
    const bpm = [140, 150, 160, 132, 124, 146][theme % 6];
    const stepDur = 60 / bpm / 4;
    let seed = theme * 9301 + 49297;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const melody: number[] = [], bass: number[] = [];
    const prog = [0, 0, 3, 4, 0, 0, 5, 4];
    for (let i = 0; i < 64; i++) melody.push(rnd() < 0.62 ? scale[Math.floor(rnd() * scale.length)] + (rnd() < 0.3 ? 12 : 0) : -1);
    for (let bar = 0; bar < 8; bar++) for (let s = 0; s < 8; s++) bass.push(s % 2 === 0 ? prog[bar] === 0 ? 0 : scale[prog[bar] % scale.length] : -1);
    const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    let step = 0;
    let next = ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.2) {
        const m = melody[step % 64];
        if (m >= 0 && step % 64 >= (step >= 64 ? 0 : 16)) osc(this.ctx, 'square', mtof(root + 24 + m), mtof(root + 24 + m), next, stepDur * 0.9, env(this.ctx, this.music, next, 0.005, stepDur * 1.6, 0.05));
        const b = bass[(step >> 1) % 64];
        if (step % 2 === 0 && b >= 0) osc(this.ctx, 'triangle', mtof(root + b), mtof(root + b), next, stepDur * 1.8, env(this.ctx, this.music, next, 0.005, stepDur * 1.8, 0.18));
        if (step % 4 === 0) noise(this.ctx, next, 0.05, env(this.ctx, this.music, next, 0.001, 0.05, step % 8 === 0 ? 0.12 : 0.05), step % 8 === 0 ? 150 : 5000, 0.8, step % 8 === 0 ? 'lowpass' : 'highpass');
        if (step % 8 === 4) noise(this.ctx, next, 0.08, env(this.ctx, this.music, next, 0.001, 0.08, 0.08), 1800, 0.6);
        next += stepDur; step++;
      }
    };
    tick();
    this.seqTimer = window.setInterval(tick, 50);
  }
}

export const audio = new AudioEngine();
