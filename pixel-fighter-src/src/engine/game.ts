// Game loop: fixed 60 Hz simulation steps, rendering every animation frame.
import { Sim, SimConfig, SimEvent, TrainingOptions } from './sim';
import { Renderer } from './render';
import { audio } from './audio';
import { AIController, DummyController } from './ai';
import type { Settings } from './types';
import { emptyInput, InputFrame, numpad } from './input';
import { gamepadPausePressed, isKeyDown, merge, readGamepad, readKeyboard, touchState, setGameKeyCapture } from './controls';
import { preloadAll } from './assets';

export type ControllerSpec =
  | { kind: 'human'; player: 1 | 2; gamepad: number | 'any'; touch: boolean }
  | { kind: 'ai'; level: number }
  | { kind: 'dummy'; mode: TrainingOptions['dummy']; level: number };

interface Controller { poll(sim: Sim, idx: number): InputFrame }

class HumanController implements Controller {
  constructor(public spec: Extract<ControllerSpec, { kind: 'human' }>, public settings: Settings) { }
  poll(): InputFrame {
    const kb = readKeyboard(this.spec.player === 1 ? this.settings.p1Keys : this.settings.p2Keys);
    const pad = readGamepad(this.spec.gamepad);
    return this.spec.touch ? merge(kb, pad, touchState) : merge(kb, pad);
  }
}

export interface GameOptions {
  config: SimConfig;
  controllers: [ControllerSpec, ControllerSpec];
  settings: Settings;
  onEvent?: (e: SimEvent, sim: Sim) => void;
  onPauseToggle?: (paused: boolean) => void;
  showHitboxes?: boolean;
  training?: boolean;
}

export class Game {
  sim: Sim;
  renderer: Renderer;
  ctrls: Controller[];
  raf = 0; last = 0; acc = 0;
  running = false;
  paused = false;
  showHitboxes = false;
  speed = 1;
  pauseLatch = false;
  trainingInfo = { lastDamage: 0, lastCombo: 0, maxCombo: 0, frameData: '', inputs: [] as string[] };
  private lastInputStr = '';

  constructor(public canvas: HTMLCanvasElement, public opts: GameOptions) {
    this.sim = new Sim(opts.config);
    this.renderer = new Renderer(canvas, opts.settings);
    this.showHitboxes = !!opts.showHitboxes;
    this.ctrls = opts.controllers.map(c => {
      if (c.kind === 'human') return new HumanController(c, opts.settings);
      if (c.kind === 'ai') return new AIController(c.level, Math.floor(Math.random() * 1e6));
      return new DummyController(c.mode, new AIController(c.level, 7));
    });
    audio.setVolume(opts.settings.volume);
    audio.tts = opts.settings.tts;
    const imgs: string[] = [];
    for (const ch of opts.config.chars) { imgs.push(ch.portrait, ...ch.sheets.map(s => s.image)); audio.preload([...Object.values(ch.sounds), ...Object.values(ch.voices)]); }
    imgs.push(...opts.config.stage.layers.map(l => l.image));
    preloadAll(imgs);
  }

  start() {
    if (this.running) return;
    this.running = true;
    setGameKeyCapture(true);
    this.last = performance.now();
    audio.playMusic(this.opts.config.stage.music, this.opts.config.stage.musicTheme);
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    setGameKeyCapture(false);
    audio.stopMusic();
  }
  setPaused(p: boolean) { this.paused = p; this.opts.onPauseToggle?.(p); }
  setDummyMode(mode: TrainingOptions['dummy']) {
    const c = this.ctrls[1];
    if (c instanceof DummyController) c.mode = mode;
    if (this.sim.cfg.training) this.sim.cfg.training.dummy = mode;
  }

  frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // pause key
    const pausePressed = this.opts.settings.p1Keys.pause.some(isKeyDown) || gamepadPausePressed('any');
    if (pausePressed && !this.pauseLatch) this.setPaused(!this.paused);
    this.pauseLatch = pausePressed;
    if (!this.paused) {
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= 1 / 60 && steps < 5) {
        this.stepOnce();
        this.acc -= 1 / 60; steps++;
      }
      if (steps >= 5) this.acc = 0;
    }
    this.renderer.draw(this.sim, {
      showHitboxes: this.showHitboxes,
      training: this.opts.training ? this.trainingInfo : undefined,
      paused: this.paused,
    });
  }

  stepOnce() {
    const inputs = this.ctrls.map((c, i) => c.poll(this.sim, i)) as [InputFrame, InputFrame];
    if (this.opts.training) this.recordInputs(inputs[0]);
    this.sim.step(inputs);
    for (const e of this.sim.drain()) this.dispatch(e);
    if (this.opts.training) {
      const d = this.sim.f[1];
      if (d.comboHits > 0) { this.trainingInfo.lastCombo = d.comboHits; this.trainingInfo.lastDamage = d.comboDamage; this.trainingInfo.maxCombo = Math.max(this.trainingInfo.maxCombo, d.comboHits); }
      const p = this.sim.f[0];
      if (p.atk && p.atkT === 1) this.trainingInfo.frameData = `${p.atk.name.slice(0, 10)} ${p.atk.startup}/${p.atk.active}/${p.atk.recovery}`;
    }
  }

  recordInputs(f: InputFrame) {
    const n = numpad(f, this.sim.f[0].facing);
    const btns = (['L', 'M', 'H', 'S', 'G', 'D'] as const).filter(b => f[b]).join('');
    const s = `${['', '↙', '↓', '↘', '←', '•', '→', '↖', '↑', '↗'][n]}${btns}`;
    if (s !== this.lastInputStr) {
      this.lastInputStr = s;
      if (s !== '•') { this.trainingInfo.inputs.unshift(s); if (this.trainingInfo.inputs.length > 10) this.trainingInfo.inputs.pop(); }
    }
  }

  dispatch(e: SimEvent) {
    const sim = this.sim;
    this.renderer.handle(sim, e);
    switch (e.type) {
      case 'sound': audio.play(e.key, e.owner >= 0 ? sim.f[e.owner].def : null); break;
      case 'voice': {
        const f = sim.f[e.owner];
        audio.voiceLine(f.def, e.key);
        break;
      }
      case 'say': audio.speak(e.text); break;
    }
    this.opts.onEvent?.(e, sim);
  }
}

export { emptyInput };
