// ============================================================================
// Deterministic fixed-step (60 Hz) fighting simulation.
// No DOM, no rendering — the renderer and audio read state + drain events.
// ============================================================================
import type { AttackDef, AttackFrame, Box, CharacterDef, ProjectileDef, StageDef, TimelineEvent, AttackType, FrameRef } from './types';
import { InputBuffer, InputFrame, emptyInput, numpad, Btn } from './input';
import { boxesOverlap, clamp, Rng } from './util';
import { BUILTIN_EFFECTS } from './defaults';

export const VIEW_W = 640, VIEW_H = 360;
export const GRAVITY = 0.6;
const RANK: Record<AttackType, number> = { light: 1, medium: 2, heavy: 3, throw: 3, special: 4, super: 5 };
export const METER_MAX = 300;

export type SimEvent =
  | { type: 'fx'; effect: string; x: number; y: number; facing: number; owner: number; scale?: number }
  | { type: 'sound'; key: string; owner: number }
  | { type: 'shake'; amount: number }
  | { type: 'flash'; color: string; dur: number }
  | { type: 'dust'; kind: 'jump' | 'land' | 'hardLand' | 'dash' | 'run'; x: number; y: number; owner: number; facing: number }
  | { type: 'say'; owner: number; text: string; dur: number }
  | { type: 'voice'; owner: number; key: string }
  | { type: 'hit'; owner: number; x: number; y: number; damage: number; blocked: boolean; heavy: boolean }
  | { type: 'roundStart'; round: number }
  | { type: 'ko'; loser: number; timeOver: boolean }
  | { type: 'roundOver'; winner: number }
  | { type: 'matchOver'; winner: number };

export interface TrainingOptions {
  dummy: 'stand' | 'crouch' | 'jump' | 'block' | 'cpu';
  infiniteHealth: boolean;
  infiniteMeter: boolean;
}

export interface SimConfig {
  chars: [CharacterDef, CharacterDef];
  stage: StageDef;
  roundsToWin: number;
  roundTime: number;          // seconds (0 = infinite)
  training?: TrainingOptions | null;
  damageScaling: boolean;
  cinematics: 'all' | 'supers' | 'off';
  seed?: number;
  skipIntro?: boolean;
  hitstopScale?: number;
}

export type FState =
  | 'intro' | 'idle' | 'walk' | 'walkBack' | 'crouch' | 'jumpSquat' | 'air' | 'land' | 'run' | 'dash' | 'backdash'
  | 'attack' | 'hitstun' | 'blockstun' | 'airHit' | 'knockdown' | 'getup' | 'grabbed' | 'cine' | 'locked' | 'recover'
  | 'ko' | 'victory' | 'airDash';

export interface CineState {
  atk: AttackDef; t: number; opened: boolean; hasOpener: boolean; locked: boolean;
  vx: number; vy: number; velUntil: number; afterUntil: number;
}

export interface Projectile {
  uid: number; def: ProjectileDef; owner: number; x: number; y: number; vx: number; vy: number; facing: number;
  t: number; hitsLeft: number; hitCd: number; state: 'spawn' | 'travel' | 'impact'; stateT: number; dead: boolean;
  strength: number; beamLen: number; ox: number; oy: number; y0: number;
}

export class Fighter {
  def: CharacterDef; idx: number;
  x = 0; y = 0; vx = 0; vy = 0; facing = 1;
  hp = 1000; meter = 0;
  state: FState = 'idle'; stateT = 0;
  anim = 'idle'; animT = 0; animFrames: FrameRef[] | null = null; // explicit frame list (attacks)
  atk: AttackDef | null = null; atkT = 0; atkHitSlot = -1; atkConnected = false; atkWhiffEnd = 0;
  stun = 0; invuln = 0; airJumps = 0; airActions = 0; juggle = 0;
  cooldowns: Record<string, number> = {};
  input = new InputBuffer();
  comboHits = 0; comboDamage = 0; // as defender
  grabbing = -1; grabbedT = 0; throwTech = false;
  cine: CineState | null = null;
  lockFloat = false;
  afterimage = false; glow = '';
  hardLanding = false; lastAirVy = 0;
  wins = 0;
  maxCombo = 0; totalDamage = 0;
  spawned: Set<string> = new Set();
  hitFlash = 0;
  guarding = false;
  constructor(def: CharacterDef, idx: number) { this.def = def; this.idx = idx; this.hp = def.stats.maxHealth; }
  get grounded() { return this.y <= 0 && this.vy <= 0; }
  get attackTotal() { const a = this.atk; return a ? a.startup + a.active + a.recovery : 0; }
}

export class Sim {
  cfg: SimConfig;
  f: [Fighter, Fighter];
  stage: StageDef;
  tick = 0;
  phase: 'intro' | 'ready' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd' = 'intro';
  phaseT = 0;
  round = 1;
  timer = 0;
  projectiles: Projectile[] = [];
  events: SimEvent[] = [];
  private _hitstop = 0;
  get hitstop() { return this._hitstop; }
  /** Hit-stop scales with the user's setting whenever it is raised. */
  set hitstop(v: number) { this._hitstop = v > this._hitstop ? Math.round(v * (this.cfg?.hitstopScale ?? 1)) : v; }
  freeze = 0; freezeOwner = -1; freezeOwnerRuns = false;
  slowmo = 1; slowUntil = 0; slowAcc = 0;
  cam = { x: 0, zoom: 1, targetZoom: 1, focus: 0, override: 0, y: 0 };
  alert: { owner: number; atk: AttackDef; t: number; dur: number } | null = null;
  bgOverlay: { color: string; style: string; until: number; darken: number; owner: number } | null = null;
  bubbles: { owner: number; text: string; until: number }[] = [];
  combo: [{ hits: number; dmg: number; t: number }, { hits: number; dmg: number; t: number }] = [{ hits: 0, dmg: 0, t: 0 }, { hits: 0, dmg: 0, t: 0 }];
  winner = -1; lastKoTimeOver = false;
  rng: Rng;
  puid = 0;
  paused = false;
  showHitboxes = false;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.stage = cfg.stage;
    this.rng = new Rng(cfg.seed ?? 1234);
    this.f = [new Fighter(cfg.chars[0], 0), new Fighter(cfg.chars[1], 1)];
    this.resetRound(true);
    if (cfg.skipIntro || cfg.training) { this.setPhase('ready'); this.bubbles = []; for (const f of this.f) this.setState(f, 'idle'); }
  }

  // --------------------------------------------------------------------------
  emit(e: SimEvent) { this.events.push(e); }
  drain(): SimEvent[] { const e = this.events; this.events = []; return e; }
  other(f: Fighter) { return this.f[1 - f.idx]; }
  setPhase(p: Sim['phase']) { this.phase = p; this.phaseT = 0; }

  resetRound(first = false) {
    const mid = this.stage.width / 2;
    const [a, b] = this.f;
    for (const f of this.f) {
      f.hp = f.def.stats.maxHealth; f.vx = f.vy = 0; f.y = 0; f.stun = 0; f.invuln = 0; f.atk = null; f.cine = null;
      f.comboHits = 0; f.comboDamage = 0; f.grabbing = -1; f.juggle = 0; f.afterimage = false; f.glow = ''; f.cooldowns = {};
      f.input.reset();
      if (first) f.meter = this.cfg.training?.infiniteMeter ? METER_MAX : 0;
      this.setState(f, first && !this.cfg.training ? 'intro' : 'idle');
    }
    a.x = mid - 110; b.x = mid + 110; a.facing = 1; b.facing = -1;
    this.projectiles = [];
    this.timer = this.cfg.roundTime > 0 ? this.cfg.roundTime * 60 : 0;
    this.cam.x = mid; this.cam.zoom = this.cam.targetZoom = 1; this.cam.override = 0;
    this.alert = null; this.bgOverlay = null; this.freeze = 0; this.hitstop = 0; this.slowmo = 1;
    this.combo = [{ hits: 0, dmg: 0, t: 0 }, { hits: 0, dmg: 0, t: 0 }];
    if (first) {
      this.setPhase('intro');
      // pre-fight dialogue
      for (const f of this.f) {
        const o = this.other(f);
        const pf = f.def.dialogue.preFight.find(p => p.opponent.toLowerCase() === o.def.name.toLowerCase() && p.lines.length);
        const line = pf ? this.rng.pick(pf.lines) : f.def.dialogue.intro.length ? this.rng.pick(f.def.dialogue.intro) : '';
        if (line) this.bubbles.push({ owner: f.idx, text: line, until: this.tick + 150 + f.idx * 10 });
        if (f.def.voices.intro) this.emit({ type: 'voice', owner: f.idx, key: 'intro' });
      }
    } else this.setPhase('ready');
  }

  // --------------------------------------------------------------------------
  step(inputs: [InputFrame, InputFrame]) {
    if (this.paused) return;
    // slow motion: only advance the world on some ticks
    if (this.slowmo < 1) {
      this.slowAcc += this.slowmo;
      if (this.slowAcc < 1) { this.tickVisualOnly(); return; }
      this.slowAcc -= 1;
    }
    this.tick++;
    this.phaseT++;
    const fightable = this.phase === 'fight' || this.phase === 'ko' || (this.phase === 'roundEnd');
    for (let i = 0; i < 2; i++) {
      const allow = this.phase === 'fight' && this.f[i].state !== 'locked' && this.f[i].state !== 'grabbed';
      this.f[i].input.push(allow ? inputs[i] : emptyInput());
    }
    this.updatePhase(inputs);
    if (this.slowUntil && this.tick >= this.slowUntil) { this.slowmo = 1; this.slowUntil = 0; }
    if (this.alert) { this.alert.t++; if (this.alert.t >= this.alert.dur) this.alert = null; }
    this.bubbles = this.bubbles.filter(b => b.until > this.tick);
    if (this.bgOverlay && this.tick >= this.bgOverlay.until) this.bgOverlay = null;
    for (const c of this.combo) if (c.t > 0) c.t--;

    if (this.hitstop > 0) { this.hitstop--; this.updateCamera(); return; }

    if (this.freeze > 0) {
      this.freeze--;
      // only the owner of a timeline cinematic keeps running during an alert freeze
      if (this.freezeOwnerRuns && this.freezeOwner >= 0) {
        const o = this.f[this.freezeOwner];
        this.updateFighter(o);
        this.physics(o);
      }
      this.updateCamera();
      return;
    }

    if (fightable || this.phase === 'intro' || this.phase === 'ready' || this.phase === 'matchEnd') {
      for (const f of this.f) this.updateFighter(f);
      for (const f of this.f) this.physics(f);
      this.pushApart();
      this.updateProjectiles();
      if (this.phase === 'fight' || this.phase === 'ko') this.resolveHits();
      this.training();
    }
    if (this.phase === 'fight' && this.cfg.roundTime > 0 && !this.cfg.training) {
      if (this.timer > 0 && !this.anyCine()) this.timer--;
      if (this.timer <= 0) this.doKO(-1, true);
    }
    this.updateCamera();
  }

  tickVisualOnly() { this.updateCamera(); }
  anyCine() { return this.f.some(f => f.state === 'cine' || f.state === 'locked'); }

  updatePhase(inputs: [InputFrame, InputFrame]) {
    switch (this.phase) {
      case 'intro': {
        const skip = this.phaseT > 20 && inputs.some(i => i.L || i.M || i.H || i.S);
        if (this.phaseT > 170 || skip) { this.bubbles = []; this.setPhase('ready'); for (const f of this.f) this.setState(f, 'idle'); }
        break;
      }
      case 'ready':
        if (this.phaseT === 1) this.emit({ type: 'roundStart', round: this.round });
        if (this.phaseT === 1) this.emit({ type: 'sound', key: 'round', owner: -1 });
        if (this.phaseT === 50) this.emit({ type: 'sound', key: 'fight', owner: -1 });
        if (this.phaseT >= (this.cfg.training ? 2 : 80)) this.setPhase('fight');
        break;
      case 'ko': {
        const [a, b] = this.f;
        const settled = this.f.every(f => f.grounded && !['airHit', 'cine', 'locked', 'grabbed'].includes(f.state) && (f.state !== 'attack'));
        if (this.phaseT > 60 && settled || this.phaseT > 300) {
          this.slowmo = 1;
          const w = this.winner;
          if (w >= 0) { this.f[w].wins++; this.setState(this.f[w], 'victory'); }
          this.emit({ type: 'roundOver', winner: w });
          this.setPhase('roundEnd');
          void a; void b;
        }
        break;
      }
      case 'roundEnd': {
        if (this.phaseT === 30 && this.winner >= 0) this.emit({ type: 'voice', owner: this.winner, key: 'victory' });
        if (this.phaseT > 150) {
          const need = this.cfg.roundsToWin;
          const champ = this.f.find(f => f.wins >= need);
          if (champ) { this.winner = champ.idx; this.setPhase('matchEnd'); this.setState(champ, 'victory'); }
          else { this.round++; this.resetRound(false); }
        }
        break;
      }
      case 'matchEnd':
        if (this.phaseT === 110) this.emit({ type: 'matchOver', winner: this.winner });
        break;
    }
  }

  doKO(loser: number, timeOver: boolean) {
    if (this.phase !== 'fight') return;
    if (this.cfg.training) return;
    if (timeOver) {
      const [a, b] = this.f;
      const ra = a.hp / a.def.stats.maxHealth, rb = b.hp / b.def.stats.maxHealth;
      loser = ra === rb ? -1 : ra < rb ? 0 : 1;
    }
    this.winner = loser < 0 ? -1 : 1 - loser;
    this.lastKoTimeOver = timeOver;
    this.setPhase('ko');
    this.emit({ type: 'ko', loser, timeOver });
    this.emit({ type: 'sound', key: 'ko', owner: -1 });
    if (loser >= 0) {
      const l = this.f[loser];
      if (l.def.voices.ko) this.emit({ type: 'voice', owner: loser, key: 'ko' });
      if (!timeOver) { this.slowmo = 0.35; this.slowUntil = this.tick + 50; this.emit({ type: 'flash', color: '#ffffff', dur: 8 }); }
    }
  }

  // --------------------------------------------------------------------------
  setState(f: Fighter, s: FState) {
    f.state = s; f.stateT = 0;
    const map: Partial<Record<FState, string>> = {
      idle: 'idle', walk: 'walk', walkBack: 'walkBack', crouch: 'crouch', jumpSquat: 'jumpSquat', air: 'jumpUp', land: 'land',
      run: 'run', dash: 'dash', backdash: 'backdash', airDash: 'dash', hitstun: 'hit', blockstun: 'block', airHit: 'airHit',
      knockdown: 'knockdown', getup: 'getup', grabbed: 'grabbed', locked: 'hit', ko: 'ko', victory: 'victory', intro: 'intro', recover: 'jumpDown',
    };
    if (s === 'attack' || s === 'cine') return;
    if (s === 'blockstun' && this.isCrouching(f)) return this.play(f, 'crouchBlock');
    if (s === 'hitstun' && this.isCrouching(f)) return this.play(f, 'crouchHit');
    if (s === 'recover' && f.grounded) return this.play(f, 'idle');
    this.play(f, map[s] || 'idle');
  }
  isCrouching(f: Fighter) { return f.grounded && f.input.held('down') && !f.input.held('up'); }

  play(f: Fighter, anim: string, frames: FrameRef[] | null = null) {
    if (f.anim === anim && !frames && f.animFrames === null) return;
    f.anim = anim; f.animT = 0; f.animFrames = frames;
  }

  // --------------------------------------------------------------------------
  updateFighter(f: Fighter) {
    const o = this.other(f);
    const st = f.def.stats;
    f.stateT++; f.animT++;
    if (f.invuln > 0) f.invuln--;
    if (f.hitFlash > 0) f.hitFlash--;
    if (this.cfg.training?.infiniteMeter) f.meter = METER_MAX;
    const inp = f.input;
    const neutral = ['idle', 'walk', 'walkBack', 'crouch', 'run', 'land'].includes(f.state);
    const canFace = neutral || f.state === 'jumpSquat';
    if (canFace && f.grounded) {
      const want = o.x >= f.x ? 1 : -1;
      if (want !== f.facing && Math.abs(o.x - f.x) > 2) f.facing = want;
    }
    const fwdHeld = f.facing > 0 ? inp.held('right') && !inp.held('left') : inp.held('left') && !inp.held('right');
    const backHeld = f.facing > 0 ? inp.held('left') && !inp.held('right') : inp.held('right') && !inp.held('left');
    const fight = this.phase === 'fight';

    switch (f.state) {
      case 'intro': f.vx = 0; if (this.phase !== 'intro') this.setState(f, 'idle'); break;
      case 'victory': f.vx *= 0.8; break;
      case 'ko': if (f.grounded && f.stateT > 4) f.vx *= 0.8; break;

      case 'idle': case 'walk': case 'walkBack': case 'crouch': case 'run': case 'land': {
        if (f.state === 'land' && f.stateT < 4) { f.vx *= 0.6; break; }
        if (!fight) { f.vx = 0; if (f.state !== 'idle') this.setState(f, 'idle'); break; }
        if (this.tryAttack(f)) break;
        if (this.tryDash(f, fwdHeld, backHeld)) break;
        if (inp.held('up')) {
          this.setState(f, 'jumpSquat');
          f.vx = f.state === 'run' ? 0 : f.vx;
          f.airJumps = st.airJumps;
          (f as any)._jumpDir = fwdHeld ? 1 : backHeld ? -1 : 0;
          (f as any)._jumpRun = f.anim === 'run';
          break;
        }
        if (inp.held('down')) {
          f.vx = 0; if (f.state !== 'crouch') this.setState(f, 'crouch');
          f.guarding = backHeld && this.threat(f);
          if (f.guarding) this.play(f, 'crouchBlock'); else this.play(f, 'crouch');
          break;
        }
        if (f.state === 'run') {
          if (fwdHeld) { f.vx = st.runSpeed * f.facing; if (f.stateT % 8 === 0) this.emit({ type: 'dust', kind: 'run', x: f.x, y: 0, owner: f.idx, facing: f.facing }); break; }
          this.setState(f, 'idle');
        }
        if (fwdHeld) {
          if (f.state !== 'walk') this.setState(f, 'walk');
          f.vx = st.walkSpeed * f.facing;
        } else if (backHeld) {
          f.guarding = this.threat(f);
          if (f.guarding) { f.vx = 0; this.play(f, 'block'); if (f.state !== 'walkBack') { f.state = 'walkBack'; f.stateT = 0; } }
          else { if (f.state !== 'walkBack' || f.anim === 'block') { this.setState(f, 'walkBack'); } f.vx = -st.walkSpeed * 0.85 * f.facing; }
        } else {
          f.vx = 0; if (f.state !== 'idle') this.setState(f, 'idle');
        }
        break;
      }

      case 'jumpSquat':
        f.vx *= 0.5;
        if (f.stateT >= 4) {
          const dir = (f as any)._jumpDir as number;
          const vy0 = Math.sqrt(2 * GRAVITY * st.jumpHeight);
          f.vy = vy0;
          f.vx = dir * ((f as any)._jumpRun ? st.runSpeed * 0.85 : Math.max(st.walkSpeed * 1.35, 2.8)) * f.facing;
          f.y = 0.1;
          f.airActions = 0;
          this.setState(f, 'air');
          this.emit({ type: 'dust', kind: 'jump', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          this.emit({ type: 'sound', key: 'jump', owner: f.idx });
        }
        break;

      case 'air': case 'airDash': {
        if (f.state === 'airDash') { f.vy = Math.max(f.vy, 0) * 0; if (f.stateT > 14) { this.setState(f, 'air'); f.afterimage = false; } break; }
        this.play(f, f.vy > 0 ? 'jumpUp' : 'jumpDown');
        if (!fight) break;
        if (this.tryAttack(f)) break;
        if (inp.pressedNow('D') && f.airActions < 1 && f.y > 30) {
          f.airActions++; this.setState(f, 'airDash'); f.vx = (backHeld ? -1 : 1) * st.dashSpeed * 0.9 * f.facing; f.vy = 0;
          f.afterimage = f.def.effects.ghostDash.enabled;
          this.emit({ type: 'sound', key: 'dash', owner: f.idx });
          break;
        }
        const prev = inp.hist[1];
        if (inp.held('up') && prev && !prev.up && f.airJumps > 0 && f.stateT > 6) {
          f.airJumps--; f.vy = Math.sqrt(2 * GRAVITY * st.jumpHeight * 0.8);
          f.vx = (fwdHeld ? 1 : backHeld ? -1 : 0) * Math.max(st.walkSpeed * 1.3, 2.6) * f.facing;
          this.play(f, 'jumpUp'); f.animT = 0;
          this.emit({ type: 'dust', kind: 'jump', x: f.x, y: f.y, owner: f.idx, facing: f.facing });
          this.emit({ type: 'sound', key: 'jump', owner: f.idx });
        }
        break;
      }

      case 'dash':
        f.vx = f.facing * st.dashSpeed * (1 - f.stateT / 22);
        if (f.stateT % 4 === 0) this.emit({ type: 'dust', kind: 'dash', x: f.x, y: 0, owner: f.idx, facing: f.facing });
        if (f.stateT > 10 && this.tryAttack(f)) { f.afterimage = false; break; }
        if (f.stateT >= 16) {
          f.afterimage = false;
          if (fwdHeld) { this.setState(f, 'run'); } else this.setState(f, 'idle');
        }
        break;
      case 'backdash':
        if (f.stateT === 1) { f.vy = 4.5; f.y = 0.1; f.invuln = Math.max(f.invuln, 6); }
        f.vx = -f.facing * st.dashSpeed * 0.8;
        if (f.grounded && f.stateT > 3) { f.afterimage = false; this.setState(f, 'land'); }
        break;

      case 'attack': this.updateAttack(f); break;
      case 'cine': this.updateCine(f); break;

      case 'hitstun': case 'blockstun':
        f.vx *= 0.86;
        if (f.state === 'blockstun') f.guarding = true;
        f.stun--;
        if (f.stun <= 0) { this.setState(f, 'idle'); this.endCombo(f); }
        break;
      case 'airHit':
        if (f.stateT > 3 && f.grounded) {
          this.setState(f, 'knockdown'); f.vx *= 0.3;
          this.emit({ type: 'dust', kind: 'hardLand', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          this.emit({ type: 'shake', amount: 3 });
          this.emit({ type: 'sound', key: 'land', owner: f.idx });
        }
        break;
      case 'knockdown':
        f.vx *= 0.8;
        f.invuln = 2;
        if (f.hp <= 0 && this.phase !== 'fight') { this.setState(f, 'ko'); this.play(f, 'knockdown'); f.animT = 99; break; }
        if (f.stateT > 38) { this.setState(f, 'getup'); f.invuln = 22; this.endCombo(f); }
        break;
      case 'getup':
        f.vx = 0;
        if (f.stateT > 20) this.setState(f, 'idle');
        break;
      case 'grabbed': {
        const g = this.f[f.grabbing >= 0 ? f.grabbing : 1 - f.idx];
        f.grabbedT++;
        // throw tech: press grab right after being grabbed (only normal throws)
        if (f.grabbedT <= 8 && f.input.buffered('G', 8) && g.atk && g.atk.input.button === 'G' && f.throwTech === false && !this.cfg.training) {
          f.throwTech = true;
          this.techThrow(g, f);
        }
        break;
      }
      case 'locked': break;
      case 'recover':
        f.vx *= f.grounded ? 0.7 : 1;
        if (f.grounded && f.stateT > 12) this.setState(f, 'idle');
        break;
    }
  }

  threat(f: Fighter) {
    const o = this.other(f);
    const d = Math.abs(o.x - f.x);
    if ((o.state === 'attack' && d < 220) || (o.state === 'cine' && d < 260)) return true;
    return this.projectiles.some(p => p.owner !== f.idx && !p.dead && p.state !== 'impact' && Math.abs(p.x - f.x) < 200);
  }

  tryDash(f: Fighter, fwd: boolean, back: boolean) {
    const tap = f.input.recentDoubleTap(2);
    const dashBtn = f.input.buffered('D', 3);
    const tapFwd = tap && ((tap === 'right') === (f.facing > 0));
    const tapBack = tap && !tapFwd;
    if ((dashBtn && !back) || tapFwd) {
      if (dashBtn) f.input.consume('D'); f.input.consumeDoubleTap();
      this.setState(f, tapFwd && !dashBtn ? 'run' : 'dash');
      if (f.state === 'dash') f.afterimage = f.def.effects.ghostDash.enabled;
      this.emit({ type: 'sound', key: 'dash', owner: f.idx });
      this.emit({ type: 'dust', kind: 'dash', x: f.x, y: 0, owner: f.idx, facing: f.facing });
      return true;
    }
    if ((dashBtn && back) || tapBack) {
      if (dashBtn) f.input.consume('D'); f.input.consumeDoubleTap();
      this.setState(f, 'backdash'); f.afterimage = f.def.effects.ghostDash.enabled;
      this.emit({ type: 'sound', key: 'dash', owner: f.idx });
      return true;
    }
    void fwd;
    return false;
  }

  // --------------------------------------------------------------------------
  // Attack selection
  canAfford(f: Fighter, a: AttackDef) {
    if (a.energyCost > f.meter) return false;
    const cd = f.cooldowns[a.id];
    if (cd !== undefined && this.tick < cd) return false;
    return true;
  }
  inputMatches(f: Fighter, inp: { button: string; dir: any; motion: any }): string[] | null {
    const ib = f.input;
    let btns: Btn[] = [];
    if (inp.button === 'SH') {
      if (!(ib.buffered('S', 6) && ib.buffered('H', 6))) return null;
      btns = ['S', 'H'];
    } else if (inp.button === 'A') {
      const b = (['H', 'M', 'L'] as Btn[]).find(x => ib.buffered(x));
      if (!b) return null;
      btns = [b];
    } else {
      if (!ib.buffered(inp.button as Btn)) return null;
      btns = [inp.button as Btn];
    }
    if (inp.motion !== 'none') { if (!ib.motion(inp.motion, f.facing)) return null; }
    else if (!ib.dirOk(inp.dir, f.facing)) return null;
    return btns;
  }
  findAttack(f: Fighter, maxRank = 99, cancelFrom: AttackDef | null = null): { a: AttackDef; btns: string[] } | null {
    const air = !f.grounded;
    let best: { a: AttackDef; btns: string[]; score: number } | null = null;
    for (const a of f.def.attacks) {
      if (a.stance === 'ground' && air) continue;
      if (a.stance === 'air' && !air) continue;
      if (RANK[a.type] > maxRank) continue;
      if (cancelFrom) {
        const r0 = RANK[cancelFrom.type], r1 = RANK[a.type];
        const ok = cancelFrom.cancel === 'chain' ? (r1 > r0 || (r0 === 1 && r1 === 1)) && a.type !== 'throw'
          : cancelFrom.cancel === 'special' ? r1 >= 4 : cancelFrom.cancel === 'super' ? r1 >= 5 : false;
        if (!ok) continue;
        if (a.id === cancelFrom.id && a.type !== 'light') continue;
      }
      if (!this.canAfford(f, a)) continue;
      for (const inp of [a.input, a.input2]) {
        if (!inp) continue;
        const btns = this.inputMatches(f, inp);
        if (!btns) continue;
        let score = RANK[a.type] * 2;
        if (inp.motion !== 'none') score += 100 + (inp.motion === 'dqcf' ? 30 : inp.motion === 'hcb' || inp.motion === 'dp' ? 20 : 10);
        if (inp.button === 'SH') score += 60;
        if (inp.dir !== 'any') score += 15;
        if (!best || score > best.score) best = { a, btns, score };
      }
    }
    return best;
  }

  tryAttack(f: Fighter, cancelFrom: AttackDef | null = null): boolean {
    if (f.airActions >= 3 && !f.grounded) return false;
    const r = this.findAttack(f, 99, cancelFrom);
    if (!r) return false;
    for (const b of r.btns) f.input.consume(b as Btn);
    this.startAttack(f, r.a);
    return true;
  }

  startAttack(f: Fighter, a: AttackDef) {
    const o = this.other(f);
    if (f.grounded) { const want = o.x >= f.x ? 1 : -1; if (Math.abs(o.x - f.x) > 2 && !cancelBlocked(f)) f.facing = want; }
    f.meter = Math.max(0, f.meter - a.energyCost);
    if (a.cooldown > 0) f.cooldowns[a.id] = this.tick + a.cooldown;
    if (!f.grounded) f.airActions++;
    f.atk = a; f.atkT = 0; f.atkHitSlot = -1; f.atkConnected = false; f.atkWhiffEnd = 0; f.spawned = new Set();
    f.glow = a.glow || '';
    f.afterimage = a.afterimage;
    if (a.invincible > 0) f.invuln = Math.max(f.invuln, a.invincible);
    if (a.startEffect) this.emit({ type: 'fx', effect: a.startEffect, x: f.x, y: f.y + 50, facing: f.facing, owner: f.idx });
    if (a.sound) this.emit({ type: 'sound', key: a.sound, owner: f.idx });
    if (a.voice) this.emit({ type: 'voice', owner: f.idx, key: 'atk:' + a.id });
    if (f.grounded && a.moveY > 0) { /* rising attacks leave ground after startup */ }
    if (f.grounded && a.moveX === 0) f.vx = 0;
    const showAlert = a.cinematic?.alert.enabled && (this.cfg.cinematics === 'all' || (this.cfg.cinematics === 'supers' && a.type === 'super'));
    if (a.cinematic?.useTimeline) {
      f.cine = { atk: a, t: -1, opened: false, hasOpener: a.cinematic.timeline.some(e => e.track === 'damage' && e.opener), locked: false, vx: 0, vy: 0, velUntil: 0, afterUntil: 0 };
      f.vx = 0;
      this.setState(f, 'cine');
      this.play(f, 'atk:' + a.id, a.frames.map(fr => fr.ref).filter(Boolean) as FrameRef[]);
      if (!showAlert) (f.cine as any).noAlert = true;
    } else {
      this.setState(f, 'attack');
      this.play(f, 'atk:' + a.id, null);
      if (showAlert) this.startAlert(f, a, false);
    }
    if (a.type === 'super') this.emit({ type: 'flash', color: f.def.effects.superFlash || '#ffffff', dur: 4 });
  }

  startAlert(f: Fighter, a: AttackDef, ownerRuns: boolean) {
    const al = a.cinematic!.alert;
    this.alert = { owner: f.idx, atk: a, t: 0, dur: al.duration };
    if (al.freeze) { this.freeze = al.duration; this.freezeOwner = f.idx; this.freezeOwnerRuns = ownerRuns; }
    if (al.shake) this.emit({ type: 'shake', amount: al.shake });
    if (al.flash) this.emit({ type: 'flash', color: '#ffffff', dur: 6 });
    this.emit({ type: 'sound', key: al.sound || 'super', owner: f.idx });
    if (al.zoom && al.zoom !== 1) { this.cam.targetZoom = al.zoom; this.cam.override = this.tick + al.duration; this.cam.focus = f.x; }
  }

  /** Which attack animation frame is visible at tick t, and its phase. */
  static attackFrameAt(a: AttackDef, t: number): { idx: number; phase: 'startup' | 'active' | 'recovery' } {
    const n = a.frames.length;
    if (!n) return { idx: -1, phase: t < a.startup ? 'startup' : t < a.startup + a.active ? 'active' : 'recovery' };
    const from = clamp(a.activeFrom, 0, n - 1), to = clamp(Math.max(a.activeTo, a.activeFrom), 0, n - 1);
    const pick = (lo: number, hi: number, start: number, len: number, fallback: number) => {
      const cnt = hi - lo + 1;
      if (cnt <= 0 || len <= 0) return fallback;
      return lo + Math.min(cnt - 1, Math.floor(((t - start) / len) * cnt));
    };
    if (t < a.startup) return { idx: pick(0, from - 1, 0, a.startup, from), phase: 'startup' };
    if (t < a.startup + a.active) return { idx: pick(from, to, a.startup, a.active, from), phase: 'active' };
    return { idx: pick(to + 1, n - 1, a.startup + a.active, a.recovery, to), phase: 'recovery' };
  }

  updateAttack(f: Fighter) {
    const a = f.atk!;
    const t = f.atkT++;
    const total = a.startup + a.active + a.recovery;
    // movement
    if (t < a.startup + a.active) {
      if (a.moveX) f.vx = a.moveX * f.facing;
      if (a.moveY && t === Math.max(0, a.startup - 2)) { f.vy = a.moveY; f.y = Math.max(f.y, 0.1); }
    } else if (f.grounded) f.vx *= 0.75;
    // projectile
    if (a.projectile && t === a.spawnAt && !f.spawned.has(a.projectile)) {
      f.spawned.add(a.projectile);
      this.spawnProjectile(f, a.projectile, a.spawnOffset.x, a.spawnOffset.y);
    }
    if (a.activeEffect && t >= a.startup && t < a.startup + a.active && (t - a.startup) % 4 === 0)
      this.emit({ type: 'fx', effect: a.activeEffect, x: f.x + f.facing * 20, y: f.y + 60, facing: f.facing, owner: f.idx });
    // throw check
    if (a.type === 'throw' && t >= a.startup && t < a.startup + a.active && f.grabbing < 0) this.checkThrow(f);
    if (a.type === 'throw' && f.grabbing >= 0) {
      const g = this.f[f.grabbing];
      g.x = f.x + f.facing * (f.def.stats.width / 2 + g.def.stats.width / 2 - 6); g.y = 6; g.vx = g.vy = 0;
      if (t === total - 8) this.releaseThrow(f, g);
    }
    if (a.type === 'throw' && f.grabbing < 0 && !f.atkConnected && t === a.startup + a.active) f.atkWhiffEnd = t + 18;
    // cancels
    if (f.atkConnected && t >= a.startup && t < total - 2 && a.cancel !== 'none') {
      if (this.tryAttack(f, a)) return;
    }
    if (t + 1 >= total || (f.atkWhiffEnd && t >= f.atkWhiffEnd)) this.endAttack(f);
  }

  endAttack(f: Fighter) {
    f.atk = null; f.afterimage = false; f.glow = '';
    if (f.grounded) this.setState(f, 'idle');
    else this.setState(f, f.vy > 2 || f.airActions >= 3 ? 'recover' : 'air');
  }

  // --------------------------------------------------------------------------
  checkThrow(f: Fighter) {
    const o = this.other(f);
    const a = f.atk!;
    if (!o.grounded || o.invuln > 0) return;
    if (['hitstun', 'blockstun', 'knockdown', 'getup', 'airHit', 'grabbed', 'locked', 'cine', 'ko', 'jumpSquat'].includes(o.state)) return;
    const dist = Math.abs(o.x - f.x) - (f.def.stats.width + o.def.stats.width) / 2;
    const dirOk = (o.x - f.x) * f.facing > -10;
    if (dist > (a.throwRange ?? 46) - 20 || !dirOk) return;
    // two simultaneous throws -> tech
    if (o.state === 'attack' && o.atk?.type === 'throw' && o.atkT >= o.atk.startup && o.atkT < o.atk.startup + o.atk.active) { this.techThrow(f, o); return; }
    f.grabbing = o.idx; f.atkConnected = true;
    o.grabbing = f.idx; o.grabbedT = 0; o.throwTech = false;
    if (o.state === 'attack') { o.atk = null; o.afterimage = false; }
    if (o.state === 'cine') { this.cancelCine(o); }
    this.setState(o, 'grabbed');
    this.emit({ type: 'sound', key: 'grab', owner: f.idx });
    this.emit({ type: 'fx', effect: 'fx:flash', x: (f.x + o.x) / 2, y: 70, facing: f.facing, owner: f.idx, scale: 0.5 });
  }
  techThrow(a: Fighter, d: Fighter) {
    a.grabbing = -1; d.grabbing = -1;
    for (const f of [a, d]) { f.atk = null; this.setState(f, 'blockstun'); f.stun = 14; f.vx = (f.x < this.other(f).x ? -1 : 1) * 5; }
    this.emit({ type: 'fx', effect: 'fx:block', x: (a.x + d.x) / 2, y: 70, facing: 1, owner: a.idx });
    this.emit({ type: 'sound', key: 'block', owner: a.idx });
    this.bubbles.push({ owner: d.idx, text: 'TECH!', until: this.tick + 40 });
  }
  releaseThrow(f: Fighter, g: Fighter) {
    const a = f.atk!;
    f.grabbing = -1; g.grabbing = -1;
    const dir = a.throwDir === 'back' ? -f.facing : f.facing;
    if (a.throwDir === 'back') { g.x = f.x - f.facing * 30; }
    this.dealDamage(f, g, a.damage, true);
    g.vx = dir * Math.max(3, a.knockback); g.vy = Math.max(5, a.knockup); g.y = 1;
    g.facing = -dir;
    this.setState(g, 'airHit');
    f.meter = Math.min(METER_MAX, f.meter + a.energyGain);
    this.emit({ type: 'fx', effect: a.hitEffect || 'fx:bigspark', x: g.x, y: 40, facing: dir, owner: f.idx });
    this.emit({ type: 'sound', key: a.hitSound || 'hitHeavy', owner: f.idx });
    this.emit({ type: 'shake', amount: a.shake || 4 });
    this.hitstop = 6;
    if (g.hp <= 0) this.doKO(g.idx, false);
  }

  // --------------------------------------------------------------------------
  // Cinematic timelines
  updateCine(f: Fighter) {
    const c = f.cine!;
    const a = c.atk;
    const cin = a.cinematic!;
    c.t++;
    const t = c.t;
    const o = this.other(f);
    if (t === cin.alert.at && cin.alert.enabled && !(c as any).noAlert) this.startAlert(f, a, true);
    // velocity events
    if (t < c.velUntil) { f.vx = c.vx * f.facing; if (c.vy) f.vy = c.vy; }
    else if (c.velUntil && t === c.velUntil) { f.vx = 0; c.vy = 0; }
    f.afterimage = t < c.afterUntil;
    for (const e of cin.timeline) { if (f.state !== 'cine' || !f.cine) return; if (e.t === t) this.fireEvent(f, o, e); }
    if (f.state !== 'cine') return; // aborted
    if (c.locked) {
      // keep the opponent in front of the attacker unless floating
      if (o.state === 'locked' && o.lockFloat) { o.vy = 0; o.y += (70 - o.y) * 0.2; }
    }
    if (t >= cin.length) this.finishCine(f, false);
  }

  fireEvent(f: Fighter, o: Fighter, e: TimelineEvent) {
    const c = f.cine;
    if (!c) return;
    const until = this.tick + (e.dur ?? 30);
    switch (e.track) {
      case 'character': {
        if (e.teleport && e.teleport !== 'none') {
          const side = Math.sign(o.x - f.x) || f.facing;
          const nx = e.teleport === 'behindOpponent' ? o.x + side * 46 : o.x - side * 46;
          this.emit({ type: 'fx', effect: 'fx:smoke', x: f.x, y: 40, facing: f.facing, owner: f.idx });
          f.x = clamp(nx, 30, this.stage.width - 30);
          f.facing = o.x >= f.x ? 1 : -1;
          this.emit({ type: 'fx', effect: 'fx:smoke', x: f.x, y: 40, facing: f.facing, owner: f.idx });
        }
        if (e.anim) this.play(f, e.anim, null), f.animT = 0;
        if (e.vx !== undefined || e.vy !== undefined) {
          c.vx = e.vx ?? 0; c.vy = e.vy ?? 0; c.velUntil = c.t + (e.dur ?? 10);
          if (c.vy) { f.vy = c.vy; f.y = Math.max(f.y, 0.1); }
        }
        if (e.afterimage) c.afterUntil = c.t + (e.dur ?? 20);
        break;
      }
      case 'opponent': {
        if (!c.locked || o.state !== 'locked') break;
        o.lockFloat = false;
        switch (e.oppState) {
          case 'hit': this.play(o, 'hit'); o.animT = 0; break;
          case 'airHit': this.play(o, 'airHit'); o.vy = 5; o.y = Math.max(o.y, 1); break;
          case 'knockdown': o.y = 0; o.vy = 0; this.play(o, 'knockdown'); break;
          case 'float': o.lockFloat = true; this.play(o, 'airHit'); break;
          case 'pull': o.x = clamp(f.x + f.facing * (f.def.stats.width / 2 + o.def.stats.width / 2 + 4), 20, this.stage.width - 20); this.play(o, 'hit'); break;
        }
        break;
      }
      case 'camera':
        this.cam.targetZoom = e.zoom ?? 1;
        this.cam.override = until;
        this.cam.focus = e.focus === 'opponent' ? o.x : e.focus === 'self' ? f.x : (f.x + o.x) / 2;
        (this.cam as any).focusMode = e.focus || 'center'; (this.cam as any).focusOwner = f.idx;
        if (e.shake) this.emit({ type: 'shake', amount: e.shake });
        break;
      case 'effects':
        if (e.effect) this.emit({ type: 'fx', effect: e.effect, x: f.x + (e.ox ?? 0) * f.facing, y: f.y + (e.oy ?? 0), facing: f.facing, owner: f.idx });
        if (e.flash) this.emit({ type: 'flash', color: e.flash, dur: 8 });
        if (e.shake) this.emit({ type: 'shake', amount: e.shake });
        if (e.bg) this.bgOverlay = { color: e.bg, style: e.bgStyle || 'solid', until, darken: e.darken ?? 0.3, owner: f.idx };
        if (e.slowmo && e.slowmo < 1) { this.slowmo = e.slowmo; this.slowUntil = this.tick + Math.round((e.dur ?? 30) * e.slowmo) + 1; }
        break;
      case 'projectiles':
        if (e.projectile) this.spawnProjectile(f, e.projectile, e.ox ?? 40, e.oy ?? 60);
        break;
      case 'sound':
        if (e.sound) this.emit({ type: 'sound', key: e.sound, owner: f.idx });
        break;
      case 'dialogue':
        if (e.text) {
          const who = e.speaker === 'opponent' ? o.idx : f.idx;
          this.bubbles.push({ owner: who, text: e.text, until });
          this.emit({ type: 'say', owner: who, text: e.text, dur: e.dur ?? 40 });
        }
        break;
      case 'damage': this.cineDamage(f, o, e); break;
    }
  }

  cineDamage(f: Fighter, o: Fighter, e: TimelineEvent) {
    const c = f.cine!;
    const dmg = e.damage ?? 0;
    const effect = e.hitEffect || f.def.effects.hitSpark;
    if (c.locked && o.state === 'locked') {
      // guaranteed hit while the opponent is held by the cinematic
      this.dealDamage(f, o, dmg, false);
      this.emit({ type: 'fx', effect, x: o.x, y: o.y + o.def.stats.height * 0.55, facing: f.facing, owner: f.idx });
      this.emit({ type: 'sound', key: dmg >= 80 ? 'hitHeavy' : 'hit', owner: f.idx });
      this.emit({ type: 'hit', owner: f.idx, x: o.x, y: o.y + 60, damage: dmg, blocked: false, heavy: dmg >= 80 });
      this.hitstop = Math.min(10, 3 + Math.round(dmg / 25));
      o.hitFlash = 3;
      if (e.final) this.releaseLock(f, o, e);
      return;
    }
    // Not locked: real hit check. Openers that miss cancel the rest of the move.
    const box = this.worldBox(f, e.box || { x: 0, y: 0, w: 60, h: 100 });
    const hurt = this.hurtbox(o);
    const hits = hurt && boxesOverlap(box, hurt) && o.invuln <= 0 && !['knockdown', 'getup', 'ko'].includes(o.state);
    if (!hits) {
      if (e.opener || (c.hasOpener && !c.opened)) this.abortCine(f, 'miss');
      return;
    }
    const blocked = this.canBlock(o, f, 'mid', true);
    if (blocked) {
      this.applyBlock(f, o, { damage: dmg, chip: 0.2, kb: e.kbx ?? 3, blockstun: 18, hitstop: 8 });
      if (e.opener || (c.hasOpener && !c.opened)) this.abortCine(f, 'blocked');
      return;
    }
    if (e.opener) {
      c.opened = true; c.locked = true;
      if (o.state === 'attack' || o.state === 'cine') { if (o.state === 'cine') this.cancelCine(o); o.atk = null; }
      this.setState(o, 'locked'); o.vx = 0; o.lockFloat = false;
      this.dealDamage(f, o, dmg, false);
      o.hitFlash = 4;
      this.emit({ type: 'fx', effect, x: o.x, y: o.y + o.def.stats.height * 0.55, facing: f.facing, owner: f.idx });
      this.emit({ type: 'sound', key: 'hitHeavy', owner: f.idx });
      this.emit({ type: 'hit', owner: f.idx, x: o.x, y: o.y + 60, damage: dmg, blocked: false, heavy: true });
      this.hitstop = 8;
      if (e.final) this.releaseLock(f, o, e);
      return;
    }
    // normal (non-locking) timeline hit
    this.applyHit(f, o, {
      damage: dmg, kb: e.kbx ?? 3, ku: e.kby ?? 6, hitstun: 22, hitstop: 8, launcher: !!e.launch, knockdown: !!e.final || !!e.launch,
      effect, sound: 'hitHeavy', shake: 3, x: o.x, y: o.y + 60,
    });
  }

  releaseLock(f: Fighter, o: Fighter, e?: TimelineEvent) {
    const c = f.cine;
    if (c) c.locked = false;
    o.lockFloat = false;
    if (o.state !== 'locked') return;
    o.vx = (e?.kbx ?? 4) * f.facing;
    o.vy = e?.launch ? (e.kby ?? 8) : Math.max(4, e?.kby ?? 4);
    o.y = Math.max(1, o.y);
    this.setState(o, 'airHit');
    o.juggle = 99; // no further juggles after a super
    this.emit({ type: 'shake', amount: 6 });
    if (o.hp <= 0) this.doKO(o.idx, false);
  }

  abortCine(f: Fighter, why: 'miss' | 'blocked') {
    const o = this.other(f);
    if (f.cine?.locked) this.releaseLock(f, o);
    f.cine = null; f.afterimage = false;
    this.cam.override = 0; this.cam.targetZoom = 1;
    if (this.bgOverlay?.owner === f.idx) this.bgOverlay = null;
    if (this.slowUntil) { this.slowmo = 1; this.slowUntil = 0; }
    this.setState(f, 'recover');
    f.stateT = why === 'miss' ? -14 : -4;
    f.vx *= 0.3;
    this.play(f, f.grounded ? 'idle' : 'jumpDown');
  }

  cancelCine(f: Fighter) {
    if (!f.cine) return;
    const o = this.other(f);
    if (f.cine.locked) this.releaseLock(f, o);
    f.cine = null; f.afterimage = false;
    if (this.bgOverlay?.owner === f.idx) this.bgOverlay = null;
    if (this.alert?.owner === f.idx) { this.alert = null; this.freeze = 0; }
    this.cam.override = 0;
  }

  finishCine(f: Fighter, _aborted: boolean) {
    const o = this.other(f);
    if (f.cine?.locked) this.releaseLock(f, o);
    f.cine = null; f.afterimage = false; f.vx = 0;
    this.cam.override = 0; this.cam.targetZoom = 1;
    this.setState(f, f.grounded ? 'idle' : 'recover');
  }

  // --------------------------------------------------------------------------
  // Projectiles
  findProjectile(f: Fighter, id: string): ProjectileDef | undefined { return f.def.projectiles.find(p => p.id === id); }

  spawnProjectile(f: Fighter, id: string, ox: number, oy: number) {
    const def = this.findProjectile(f, id);
    if (!def) return;
    const ang = (def.angle * Math.PI) / 180;
    const p: Projectile = {
      uid: ++this.puid, def, owner: f.idx, x: f.x + ox * f.facing, y: f.y + oy, vx: Math.cos(ang) * def.speed * f.facing, vy: Math.sin(ang) * def.speed,
      facing: f.facing, t: 0, hitsLeft: Math.max(1, def.hits), hitCd: 0, state: def.spawnAnim.length ? 'spawn' : 'travel', stateT: 0, dead: false,
      strength: def.strength, beamLen: 0, ox, oy, y0: f.y + oy,
    };
    if (def.motion === 'arc' && def.angle === 0) { p.vx = Math.cos(0.6) * def.speed * f.facing; p.vy = Math.sin(0.6) * def.speed; }
    if (def.motion === 'stationary') { p.vx = 0; p.vy = 0; }
    this.projectiles.push(p);
    if (def.sound) this.emit({ type: 'sound', key: def.sound, owner: f.idx });
  }

  projBox(p: Projectile): Box {
    const s = p.def.size * p.def.scale;
    if (p.def.motion === 'beam') {
      const x0 = p.x, x1 = p.x + p.beamLen * p.facing;
      return { x: Math.min(x0, x1), y: p.y - s / 2, w: Math.abs(x1 - x0), h: s };
    }
    if (p.def.shape === 'wave') return { x: p.x - s / 2, y: p.y, w: s, h: s * 1.6 };
    return { x: p.x - s / 2, y: p.y - s / 2, w: s, h: s };
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.t++; p.stateT++;
      const d = p.def;
      if (p.hitCd > 0) p.hitCd--;
      if (p.state === 'impact') {
        const len = Math.max(1, d.impactAnim.length) * (60 / Math.max(1, d.fps));
        if (p.stateT > Math.max(len, 10)) p.dead = true;
        continue;
      }
      if (p.state === 'spawn') {
        const len = d.spawnAnim.length * (60 / Math.max(1, d.fps));
        if (p.stateT >= len) { p.state = 'travel'; p.stateT = 0; }
        else continue;
      }
      const owner = this.f[p.owner], target = this.f[1 - p.owner];
      switch (d.motion) {
        case 'straight': break;
        case 'curve': {
          const a = Math.atan2(p.vy, p.vx) + (d.curve * 0.02) * p.facing;
          const sp = Math.hypot(p.vx, p.vy);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
          break;
        }
        case 'homing': {
          const tx = target.x - p.x, ty = target.y + target.def.stats.height * 0.5 - p.y;
          const want = Math.atan2(ty, tx), cur = Math.atan2(p.vy, p.vx);
          let diff = want - cur; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
          const a = cur + clamp(diff, -d.curve, d.curve);
          p.vx = Math.cos(a) * d.speed; p.vy = Math.sin(a) * d.speed;
          break;
        }
        case 'stationary': p.vx = 0; p.vy = 0; break;
        case 'arc': p.vy -= d.gravity; break;
        case 'wave': p.y = p.y0 + Math.sin(p.t * 0.15) * d.curve * 30; p.vy = 0; break;
        case 'beam':
          p.x = owner.x + p.ox * owner.facing; p.y = owner.y + p.oy; p.facing = owner.facing;
          p.beamLen = Math.min(560, p.beamLen + d.speed * 2.5);
          if (owner.state !== 'attack' && owner.state !== 'cine') p.t = Math.max(p.t, d.lifetime - 8);
          break;
      }
      if (d.motion !== 'beam') { p.x += p.vx; p.y += p.vy; }
      if (d.trail && p.t % Math.max(1, d.trailRate) === 0) this.emit({ type: 'fx', effect: d.trail, x: p.x, y: p.y, facing: -p.facing, owner: p.owner, scale: 0.6 });
      if (p.t >= d.lifetime || p.x < -60 || p.x > this.stage.width + 60 || p.y > 600) { this.impact(p, false); continue; }
      if (p.y < 0 && d.motion !== 'stationary' && d.shape !== 'wave') { p.y = 0; this.impact(p, true); continue; }
    }
    // projectile vs projectile
    const ps = this.projectiles.filter(p => !p.dead && p.state === 'travel');
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      if (a.owner === b.owner || a.dead || b.dead) continue;
      if (!boxesOverlap(this.projBox(a), this.projBox(b))) continue;
      const sa = a.def.collision === 'absorb' ? 99 : a.strength, sb = b.def.collision === 'absorb' ? 99 : b.strength;
      const m = Math.min(sa, sb);
      a.strength -= m; b.strength -= m;
      this.emit({ type: 'fx', effect: 'fx:flash', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, facing: 1, owner: a.owner });
      this.emit({ type: 'sound', key: 'clash', owner: a.owner });
      if (a.strength <= 0 && a.def.collision !== 'absorb') this.impact(a, true);
      if (b.strength <= 0 && b.def.collision !== 'absorb') this.impact(b, true);
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  impact(p: Projectile, effect: boolean) {
    if (p.state === 'impact') return;
    p.state = 'impact'; p.stateT = 0;
    if (effect && p.def.impactEffect) this.emit({ type: 'fx', effect: p.def.impactEffect, x: p.x, y: p.y, facing: p.facing, owner: p.owner });
    if (effect && p.def.impactSound) this.emit({ type: 'sound', key: p.def.impactSound, owner: p.owner });
    if (!p.def.impactAnim.length && !effect) p.dead = true;
  }

  // --------------------------------------------------------------------------
  // Boxes & hits
  worldBox(f: Fighter, b: Box): Box {
    const x = f.facing > 0 ? f.x + b.x : f.x - b.x - b.w;
    return { x, y: f.y + b.y, w: b.w, h: b.h };
  }
  hurtbox(f: Fighter): Box | null {
    if (['knockdown', 'getup', 'ko', 'victory', 'intro'].includes(f.state)) return null;
    const s = f.def.stats;
    let h = s.height, w = s.width;
    if (f.state === 'crouch' || (f.state === 'blockstun' && f.anim === 'crouchBlock') || f.anim === 'crouchHit') h *= 0.66;
    if (f.state === 'attack' && f.atk?.input.dir === 'down' && f.grounded) h *= 0.7;
    if (!f.grounded && (f.state === 'air' || f.state === 'airHit')) h *= 0.82;
    if (f.state === 'airHit') { w *= 1.2; }
    return { x: f.x - w / 2, y: f.y, w, h };
  }
  attackBoxes(f: Fighter): Box[] {
    const a = f.atk;
    if (!a || f.state !== 'attack' || a.type === 'throw') return [];
    const t = f.atkT - 1;
    if (t < a.startup || t >= a.startup + a.active) return [];
    const { idx } = Sim.attackFrameAt(a, t);
    const fr: AttackFrame | undefined = a.frames[idx];
    let boxes = fr && fr.boxes.length ? fr.boxes : (a.hitbox.w > 0 ? [a.hitbox] : []);
    return boxes.map(b => this.worldBox(f, b));
  }

  canBlock(d: Fighter, a: Fighter, level: string, blockable: boolean) {
    if (!blockable) return false;
    if (!d.grounded) return false;
    if (!['idle', 'walk', 'walkBack', 'crouch', 'blockstun', 'land'].includes(d.state)) return false;
    const awayRight = a.x < d.x; // attacker on left → hold right to block
    const inp = d.input.cur;
    const holdingAway = awayRight ? inp.right && !inp.left : inp.left && !inp.right;
    const train = this.cfg.training;
    const dummyBlocks = train && d.idx === 1 && train.dummy === 'block';
    if (!holdingAway && !dummyBlocks) return false;
    const crouching = inp.down || (dummyBlocks && level === 'low');
    if (level === 'low' && !crouching) return false;
    if (level === 'overhead' && crouching) return false;
    return true;
  }

  dealDamage(a: Fighter, d: Fighter, raw: number, scaled: boolean) {
    const scale = scaled && this.cfg.damageScaling ? Math.max(0.3, 1 - d.comboHits * 0.1) : 1;
    let dmg = Math.round(raw * a.def.stats.attackPower / Math.max(0.2, d.def.stats.defense) * scale);
    if (raw > 0) dmg = Math.max(1, dmg);
    d.hp -= dmg;
    if (this.cfg.training?.infiniteHealth && d.hp <= 0) d.hp = 1;
    d.comboHits++; d.comboDamage += dmg;
    a.totalDamage += dmg;
    const c = this.combo[a.idx];
    c.hits = d.comboHits; c.dmg = d.comboDamage; c.t = 90;
    a.maxCombo = Math.max(a.maxCombo, d.comboHits);
    d.meter = Math.min(METER_MAX, d.meter + dmg * 0.05);
    return dmg;
  }
  endCombo(d: Fighter) {
    d.comboHits = 0; d.comboDamage = 0; d.juggle = 0;
    if (this.cfg.training?.infiniteHealth && d.hp < d.def.stats.maxHealth) (d as any)._refill = 40;
  }

  applyBlock(a: Fighter, d: Fighter, p: { damage: number; chip: number; kb: number; blockstun: number; hitstop: number }) {
    const chip = Math.round(p.damage * p.chip);
    if (chip > 0) { d.hp = Math.max(this.cfg.training?.infiniteHealth ? 1 : 1, d.hp - chip); }
    const crouch = d.input.cur.down;
    this.setState(d, 'blockstun');
    this.play(d, crouch ? 'crouchBlock' : 'block');
    d.stun = p.blockstun;
    const dir = Math.sign(d.x - a.x) || -a.facing;
    d.vx = dir * p.kb * 0.8;
    // pushback the attacker if the defender is cornered
    if (d.x <= d.def.stats.width / 2 + 2 || d.x >= this.stage.width - d.def.stats.width / 2 - 2) a.vx = -dir * p.kb * 0.6;
    this.hitstop = Math.round(p.hitstop * 0.7);
    a.meter = Math.min(METER_MAX, a.meter + 3); d.meter = Math.min(METER_MAX, d.meter + 4);
    this.emit({ type: 'fx', effect: d.def.effects.blockSpark || 'fx:block', x: d.x - dir * d.def.stats.width / 2, y: d.y + d.def.stats.height * 0.6, facing: -dir, owner: a.idx });
    this.emit({ type: 'sound', key: 'block', owner: d.idx });
    this.emit({ type: 'hit', owner: a.idx, x: d.x, y: d.y + 60, damage: chip, blocked: true, heavy: false });
  }

  applyHit(a: Fighter, d: Fighter, p: {
    damage: number; kb: number; ku: number; hitstun: number; hitstop: number; launcher: boolean; knockdown: boolean;
    effect?: string; sound?: string; shake?: number; x: number; y: number; gain?: number; dir?: number;
  }) {
    if (d.state === 'cine') this.cancelCine(d);
    if (d.state === 'attack') { d.atk = null; d.afterimage = false; d.glow = ''; }
    if (d.grabbing >= 0) { const g = this.f[d.grabbing]; g.grabbing = -1; d.grabbing = -1; if (g.state === 'grabbed') this.setState(g, 'airHit'); }
    const dmg = this.dealDamage(a, d, p.damage, true);
    const dir = p.dir ?? (Math.sign(d.x - a.x) || a.facing);
    const airborne = !d.grounded || d.state === 'airHit';
    d.hitFlash = 3;
    if (airborne || p.launcher || p.knockdown) {
      d.juggle++;
      this.setState(d, 'airHit');
      d.vx = dir * p.kb * 0.7;
      d.vy = p.launcher ? p.ku : airborne ? Math.max(3.5, p.ku * 0.55) : Math.max(4, p.ku * 0.7);
      d.y = Math.max(d.y, 1);
      if (d.juggle > 7) d.invuln = 60;
    } else {
      this.setState(d, 'hitstun');
      d.stun = p.hitstun;
      d.vx = dir * p.kb;
      if (d.x <= d.def.stats.width / 2 + 2 || d.x >= this.stage.width - d.def.stats.width / 2 - 2) a.vx = -dir * p.kb * 0.7;
    }
    this.hitstop = Math.round(p.hitstop);
    a.meter = Math.min(METER_MAX, a.meter + (p.gain ?? 6));
    a.atkConnected = true;
    this.emit({ type: 'fx', effect: p.effect || a.def.effects.hitSpark || 'fx:spark', x: p.x, y: p.y, facing: -dir, owner: a.idx });
    this.emit({ type: 'sound', key: p.sound || (p.damage >= 80 ? 'hitHeavy' : 'hit'), owner: a.idx });
    this.emit({ type: 'sound', key: 'hurt', owner: d.idx });
    if (d.def.voices.hurt && this.rng.chance(0.35)) this.emit({ type: 'voice', owner: d.idx, key: 'hurt' });
    if (p.shake) this.emit({ type: 'shake', amount: p.shake });
    if (p.damage >= 80) this.emit({ type: 'fx', effect: 'fx:flash', x: p.x, y: p.y, facing: -dir, owner: a.idx, scale: 0.7 });
    this.emit({ type: 'hit', owner: a.idx, x: p.x, y: p.y, damage: dmg, blocked: false, heavy: p.damage >= 80 });
    if (d.hp <= 0) {
      if (d.state !== 'airHit') { this.setState(d, 'airHit'); d.vy = 7; d.vx = dir * 3; d.y = 1; }
      this.doKO(d.idx, false);
    }
  }

  resolveHits() {
    const [A, B] = this.f;
    const results: (() => void)[] = [];
    const boxesA = this.attackBoxes(A), boxesB = this.attackBoxes(B);
    const tryHit = (a: Fighter, d: Fighter, boxes: Box[]) => {
      if (!boxes.length || !a.atk) return false;
      const atk = a.atk;
      const t = a.atkT - 1;
      const slotLen = Math.max(1, Math.floor(atk.active / Math.max(1, atk.hits)));
      const slot = Math.floor((t - atk.startup) / slotLen);
      if (slot === a.atkHitSlot || slot >= Math.max(1, atk.hits)) return false;
      const hurt = this.hurtbox(d);
      if (!hurt || d.invuln > 0) return false;
      const hb = boxes.find(b => boxesOverlap(b, hurt));
      if (!hb) return false;
      a.atkHitSlot = slot;
      const cx = clamp((Math.max(hb.x, hurt.x) + Math.min(hb.x + hb.w, hurt.x + hurt.w)) / 2, hurt.x, hurt.x + hurt.w);
      const cy = (Math.max(hb.y, hurt.y) + Math.min(hb.y + hb.h, hurt.y + hurt.h)) / 2;
      results.push(() => {
        if (this.canBlock(d, a, atk.hitLevel, atk.blockable)) {
          a.atkConnected = true;
          this.applyBlock(a, d, { damage: atk.damage, chip: atk.chip, kb: atk.knockback, blockstun: atk.blockstun, hitstop: atk.hitstop });
        } else {
          this.applyHit(a, d, {
            damage: atk.damage, kb: atk.knockback, ku: atk.knockup, hitstun: atk.hitstun, hitstop: atk.hitstop * 1,
            launcher: atk.launcher, knockdown: atk.knockdown && slot >= atk.hits - 1, effect: atk.hitEffect, sound: atk.hitSound, shake: atk.shake,
            x: cx, y: cy, gain: atk.energyGain,
          });
        }
      });
      return true;
    };
    const hitA = tryHit(A, B, boxesA);
    const hitB = tryHit(B, A, boxesB);
    // hitbox clash with no hurtbox contact: priority decides
    if (!hitA && !hitB && boxesA.length && boxesB.length && boxesA.some(a => boxesB.some(b => boxesOverlap(a, b)))) {
      const pa = A.atk!.priority, pb = B.atk!.priority;
      const recoil = (f: Fighter) => { f.atk = null; this.setState(f, 'blockstun'); f.stun = 12; f.vx = -f.facing * 3; };
      if (pa >= pb) recoil(B); if (pb >= pa) recoil(A);
      this.hitstop = 6;
      this.emit({ type: 'fx', effect: 'fx:flash', x: (A.x + B.x) / 2, y: 70, facing: 1, owner: 0 });
      this.emit({ type: 'sound', key: 'clash', owner: 0 });
    }
    for (const r of results) r();
    // projectiles vs fighters
    for (const p of this.projectiles) {
      if (p.dead || p.state !== 'travel' || p.hitCd > 0) continue;
      const d = this.f[1 - p.owner], a = this.f[p.owner];
      const hurt = this.hurtbox(d);
      if (!hurt || d.invuln > 0) continue;
      const pb = this.projBox(p);
      if (!boxesOverlap(pb, hurt)) continue;
      const def = p.def;
      const dir = d.x >= (p.def.motion === 'beam' ? a.x : p.x - p.vx) ? 1 : -1;
      if (this.canBlock(d, a, 'mid', def.blockable)) {
        this.applyBlock(a, d, { damage: def.damage, chip: 0.15, kb: def.knockback, blockstun: Math.round(def.hitstun * 0.75), hitstop: 6 });
      } else {
        this.applyHit(a, d, {
          damage: def.damage, kb: def.knockback, ku: def.knockup, hitstun: def.hitstun, hitstop: 6, launcher: false,
          knockdown: def.knockdown && p.hitsLeft <= 1, effect: def.impactEffect, sound: def.impactSound || 'hit', shake: 2,
          x: clamp(p.x, hurt.x, hurt.x + hurt.w), y: clamp(p.y, hurt.y + 10, hurt.y + hurt.h - 10), gain: 8, dir,
        });
      }
      p.hitsLeft--;
      p.hitCd = def.motion === 'beam' || def.collision === 'pierce' ? Math.max(5, Math.floor(def.lifetime / Math.max(1, def.hits + 1))) : 10;
      if (p.hitsLeft <= 0 && def.collision !== 'pierce' && def.motion !== 'beam') this.impact(p, false);
      else if (p.hitsLeft <= 0) { p.hitCd = 9999; if (def.motion !== 'beam' && def.motion !== 'stationary') this.impact(p, false); }
    }
  }

  // --------------------------------------------------------------------------
  physics(f: Fighter) {
    const st = f.def.stats;
    if (f.state === 'locked' || f.state === 'grabbed') {
      if (f.state === 'locked' && !f.lockFloat && f.y > 0) { f.vy -= GRAVITY; f.y = Math.max(0, f.y + f.vy); if (f.y === 0) f.vy = 0; }
      f.x += f.vx; f.vx *= 0.8;
      f.x = clamp(f.x, st.width / 2, this.stage.width - st.width / 2);
      return;
    }
    const wasAir = f.y > 0;
    const floating = f.state === 'airDash' || (f.state === 'cine' && f.cine && f.cine.vy === 0 && f.cine.velUntil > f.cine.t && f.y > 0 && false);
    if (!floating) f.vy -= GRAVITY * (f.state === 'airHit' ? 0.85 : 1);
    if (f.y <= 0 && f.vy < 0 && !wasAir) f.vy = 0;
    f.x += f.vx; f.y += f.vy;
    if (f.y > 0) f.lastAirVy = f.vy;
    if (f.y <= 0) {
      f.y = 0;
      if (wasAir) {
        const hard = f.lastAirVy < -Math.sqrt(2 * GRAVITY * st.jumpHeight) * 1.12;
        f.vy = 0;
        if (f.state === 'air' || f.state === 'airDash' || f.state === 'recover' || f.state === 'backdash') {
          this.emit({ type: 'dust', kind: hard ? 'hardLand' : 'land', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          this.emit({ type: 'sound', key: 'land', owner: f.idx });
          f.afterimage = false;
          if (f.state !== 'backdash') { f.vx = 0; this.setState(f, 'land'); } else { this.setState(f, 'land'); f.vx *= 0.3; }
        } else if (f.state === 'attack' && f.atk && f.atk.stance === 'air') {
          this.emit({ type: 'dust', kind: 'land', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          f.atk = null; f.glow = ''; f.afterimage = false; f.vx = 0; this.setState(f, 'land');
        } else if (f.state === 'attack') {
          this.emit({ type: 'dust', kind: hard ? 'hardLand' : 'land', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          if (f.atk && f.atkT > f.atk.startup + f.atk.active) { this.endAttack(f); this.setState(f, 'land'); f.stateT = -6; }
        } else if (f.state === 'cine') {
          this.emit({ type: 'dust', kind: 'land', x: f.x, y: 0, owner: f.idx, facing: f.facing });
        } else if (f.state === 'ko') {
          this.emit({ type: 'dust', kind: 'hardLand', x: f.x, y: 0, owner: f.idx, facing: f.facing });
          this.emit({ type: 'shake', amount: 4 });
        }
      }
    }
    if (f.grounded && ['hitstun', 'blockstun', 'knockdown', 'getup', 'ko'].includes(f.state)) f.vx *= 0.9;
    f.x = clamp(f.x, st.width / 2, this.stage.width - st.width / 2);
    // keep both fighters inside one screen
    const o = this.other(f);
    const maxSep = VIEW_W - 70;
    if (Math.abs(f.x - o.x) > maxSep) f.x = o.x + Math.sign(f.x - o.x) * maxSep;
    // passive meter regen when aura is enabled? (no) — refill dummy in training
    if ((f as any)._refill > 0) { (f as any)._refill--; if ((f as any)._refill === 0) f.hp = f.def.stats.maxHealth; }
  }

  pushApart() {
    const [a, b] = this.f;
    if (a.state === 'grabbed' || b.state === 'grabbed' || a.state === 'locked' || b.state === 'locked') return;
    if (a.state === 'cine' || b.state === 'cine') return;
    const ha = a.def.stats.height * 0.8, hb = b.def.stats.height * 0.8;
    const yOverlap = a.y < b.y + hb && b.y < a.y + ha;
    if (!yOverlap) return;
    const half = (a.def.stats.width + b.def.stats.width) / 2 * 0.8;
    const dx = b.x - a.x;
    if (Math.abs(dx) >= half) return;
    const push = (half - Math.abs(dx)) / 2;
    const s = dx === 0 ? (a.facing > 0 ? 1 : -1) : Math.sign(dx);
    a.x -= push * s; b.x += push * s;
    // corner correction
    for (const f of this.f) {
      const w = f.def.stats.width / 2;
      if (f.x < w) { const o = this.other(f); o.x += w - f.x; f.x = w; }
      if (f.x > this.stage.width - w) { const o = this.other(f); o.x -= f.x - (this.stage.width - w); f.x = this.stage.width - w; }
    }
  }

  training() {
    const t = this.cfg.training;
    if (!t) return;
    const d = this.f[1];
    if (t.infiniteHealth && d.hp <= 0) d.hp = 1;
    const p = this.f[0];
    if (t.infiniteHealth && p.hp < p.def.stats.maxHealth && p.state === 'idle' && p.stateT > 60) p.hp = p.def.stats.maxHealth;
  }

  updateCamera() {
    const [a, b] = this.f;
    const mid = (a.x + b.x) / 2;
    let target = mid;
    if (this.cam.override && this.tick < this.cam.override) {
      const mode = (this.cam as any).focusMode as string;
      const ow = this.f[(this.cam as any).focusOwner ?? 0];
      target = mode === 'self' ? ow.x : mode === 'opponent' ? this.other(ow).x : mid;
    } else if (this.cam.override) { this.cam.override = 0; this.cam.targetZoom = 1; }
    this.cam.zoom += (this.cam.targetZoom - this.cam.zoom) * 0.12;
    const half = VIEW_W / 2 / this.cam.zoom;
    target = clamp(target, half + this.stage.camLeft, this.stage.width - half - this.stage.camRight);
    if (this.stage.width - this.stage.camLeft - this.stage.camRight < half * 2) target = this.stage.width / 2;
    this.cam.x += (target - this.cam.x) * 0.2;
    const top = Math.max(a.y, b.y);
    this.cam.y += ((top > 150 ? (top - 150) * 0.6 : 0) - this.cam.y) * 0.1;
  }

  /** Current animation frame reference for rendering. */
  frameOf(f: Fighter): { ref: FrameRef | null; fallback: string } {
    const def = f.def;
    if (f.state === 'attack' && f.atk) {
      const { idx } = Sim.attackFrameAt(f.atk, Math.max(0, f.atkT - 1));
      const fr = f.atk.frames[idx];
      if (fr?.ref) return { ref: fr.ref, fallback: 'attack' };
      return { ref: animFrame(def, f.atk.type === 'heavy' || f.atk.type === 'super' ? 'idle' : 'idle', f.atkT), fallback: 'attack' };
    }
    if (f.animFrames && f.anim.startsWith('atk:')) {
      // cinematic attack pose before the first timeline animation event
      const fr = f.animFrames[Math.min(f.animFrames.length - 1, Math.floor(f.animT / 8))];
      return { ref: fr || null, fallback: 'attack' };
    }
    return { ref: animFrame(def, f.anim, f.animT), fallback: f.anim };
  }
}

function cancelBlocked(f: Fighter) { return !f.grounded; }

export const ANIM_FALLBACK: Record<string, string[]> = {
  walkBack: ['walk', 'idle'], run: ['walk', 'idle'], crouch: ['idle'], jumpSquat: ['crouch', 'idle'], jumpUp: ['idle'],
  jumpDown: ['jumpUp', 'idle'], land: ['jumpSquat', 'crouch', 'idle'], dash: ['run', 'walk', 'idle'], backdash: ['dash', 'jumpUp', 'idle'],
  block: ['idle'], crouchBlock: ['block', 'crouch', 'idle'], hit: ['idle'], crouchHit: ['hit', 'crouch', 'idle'], airHit: ['hit', 'jumpUp', 'idle'],
  knockdown: ['airHit', 'hit', 'idle'], getup: ['crouch', 'idle'], grabbed: ['hit', 'idle'], ko: ['knockdown', 'hit', 'idle'],
  victory: ['intro', 'idle'], intro: ['idle'], walk: ['idle'],
};

export function resolveAnim(def: CharacterDef, name: string): { name: string; anim: CharacterDef['animations'][string] } | null {
  const a = def.animations[name];
  if (a && a.frames.length) return { name, anim: a };
  for (const fb of ANIM_FALLBACK[name] || ['idle']) {
    const b = def.animations[fb];
    if (b && b.frames.length) return { name: fb, anim: b };
  }
  const idle = def.animations.idle;
  if (idle && idle.frames.length) return { name: 'idle', anim: idle };
  return null;
}

export function animFrame(def: CharacterDef, name: string, t: number): FrameRef | null {
  const r = resolveAnim(def, name);
  if (!r) return null;
  const a = r.anim;
  const n = a.frames.length;
  // per-frame tick overrides
  const durs = a.frames.map(f => f.ticks && f.ticks > 0 ? f.ticks : Math.max(1, Math.round(60 / Math.max(1, a.fps))));
  const total = durs.reduce((s, d) => s + d, 0);
  let tt = t;
  if (a.loop) {
    const ls = clamp(a.loopStart ?? 0, 0, n - 1);
    const pre = durs.slice(0, ls).reduce((s, d) => s + d, 0);
    if (tt >= total) tt = pre + ((tt - pre) % Math.max(1, total - pre));
  } else tt = Math.min(tt, total - 1);
  for (let i = 0; i < n; i++) { if (tt < durs[i]) return a.frames[i]; tt -= durs[i]; }
  return a.frames[n - 1];
}

export function findEffect(def: CharacterDef | null, id: string) {
  return (def?.effectPresets.find(e => e.id === id)) || BUILTIN_EFFECTS.find(e => e.id === id);
}

export { numpad };
