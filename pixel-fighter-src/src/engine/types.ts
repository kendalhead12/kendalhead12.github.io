// ============================================================================
// Pixel Fighter Engine — data-driven formats.
// Every character, stage and effect is plain JSON so it can be saved to
// IndexedDB, exported as a file and imported again.
// ============================================================================

export const FORMAT_VERSION = 1;
export const TICKS_PER_SECOND = 60;

export interface Box { x: number; y: number; w: number; h: number } // y up, x forward, relative to origin (feet)

export interface FrameRect {
  x: number; y: number; w: number; h: number;
  ox: number; oy: number;     // origin inside the rect (feet/anchor point), in source pixels
  flipX?: boolean;            // draw mirrored
  dx?: number; dy?: number;   // extra draw offset in source pixels (frame-by-frame nudging)
}

export interface SpriteSheet {
  id: string;
  name: string;
  image: string;              // data URL (PNG)
  width: number; height: number;
  frames: FrameRect[];
}

export interface FrameRef { sheet: string; index: number; ticks?: number }

export interface AnimationDef {
  frames: FrameRef[];
  fps: number;
  loop: boolean;
  loopStart?: number;
}

/** Standard animation slots the engine knows how to use. Custom names are allowed for attacks. */
export const STANDARD_ANIMS = [
  'idle', 'walk', 'walkBack', 'run', 'crouch', 'jumpSquat', 'jumpUp', 'jumpDown', 'land',
  'dash', 'backdash', 'block', 'crouchBlock', 'hit', 'crouchHit', 'airHit', 'knockdown', 'getup',
  'grabbed', 'ko', 'victory', 'intro',
] as const;
export type StandardAnim = typeof STANDARD_ANIMS[number];

export const ANIM_HELP: Record<string, string> = {
  idle: 'Standing still. Should loop.',
  walk: 'Walking toward the opponent.',
  walkBack: 'Walking away (also used while blocking-walk). Falls back to Walk.',
  run: 'Running after double-tapping forward. Falls back to Walk.',
  crouch: 'Holding down.',
  jumpSquat: 'Short crouch before leaving the ground.',
  jumpUp: 'Rising in the air.',
  jumpDown: 'Falling. Falls back to Jump Up.',
  land: 'Touching down after a jump.',
  dash: 'Quick forward dash.',
  backdash: 'Quick hop backwards. Falls back to Dash.',
  block: 'Standing guard.',
  crouchBlock: 'Crouching guard. Falls back to Block.',
  hit: 'Getting hit while standing.',
  crouchHit: 'Getting hit while crouching.',
  airHit: 'Launched / juggled in the air.',
  knockdown: 'Lying on the ground.',
  getup: 'Standing back up.',
  grabbed: 'Being held in a throw.',
  ko: 'Defeated.',
  victory: 'Victory pose.',
  intro: 'Round intro pose.',
};

export type AttackType = 'light' | 'medium' | 'heavy' | 'special' | 'super' | 'throw';
export type Button = 'L' | 'M' | 'H' | 'S' | 'G' | 'A' | 'SH'; // A = any of L/M/H, SH = Special + Heavy together
export type DirReq = 'any' | 'neutral' | 'forward' | 'back' | 'down' | 'up' | 'downforward';
export type Motion = 'none' | 'qcf' | 'qcb' | 'dp' | 'hcb' | 'dqcf';
export type Stance = 'ground' | 'air' | 'both';
export type HitLevel = 'mid' | 'low' | 'overhead';

export interface AttackFrame { ref: FrameRef | null; boxes: Box[] }

export interface CinematicAlert {
  enabled: boolean;
  at: number;                 // tick (from move start) when the alert appears
  text: string;               // shown name, defaults to attack name
  subtitle: string;
  portrait: 'character' | 'custom' | 'none';
  customPortrait?: string;    // data URL
  bgColor: string;
  streakColor: string;
  textColor: string;
  font: string;
  duration: number;           // ticks
  freeze: boolean;            // freeze gameplay during the alert
  darken: number;             // 0..1
  zoom: number;               // camera zoom during alert (1 = none)
  flash: boolean;
  shake: number;
  style: 'band' | 'fullscreen' | 'corner';
  sound?: string;             // sound key or data URL
}

export type TimelineTrack = 'character' | 'opponent' | 'camera' | 'effects' | 'projectiles' | 'sound' | 'dialogue' | 'damage';
export const TIMELINE_TRACKS: TimelineTrack[] = ['character', 'opponent', 'camera', 'effects', 'projectiles', 'sound', 'dialogue', 'damage'];

export interface TimelineEvent {
  id: string;
  t: number;                  // tick offset from the start of the move
  track: TimelineTrack;
  dur?: number;               // for events with duration
  // character
  anim?: string;              // animation name to switch to
  vx?: number; vy?: number;   // set velocity (forward-relative)
  teleport?: 'none' | 'behindOpponent' | 'frontOfOpponent';
  afterimage?: boolean;
  // opponent (only applied when locked by an opener hit)
  oppState?: 'hit' | 'airHit' | 'knockdown' | 'float' | 'pull';
  // camera
  zoom?: number;
  focus?: 'self' | 'opponent' | 'center';
  shake?: number;
  // effects
  effect?: string;            // effect preset id
  ox?: number; oy?: number;   // offset relative to character (forward-relative)
  flash?: string;             // flash color
  bg?: string;                // background overlay color
  bgStyle?: 'solid' | 'streaks' | 'radial';
  slowmo?: number;            // time scale (e.g. 0.3)
  darken?: number;
  // projectiles
  projectile?: string;
  // sound
  sound?: string;
  // dialogue
  text?: string;
  speaker?: 'self' | 'opponent';
  // damage
  damage?: number;
  box?: Box;
  kbx?: number; kby?: number;
  opener?: boolean;           // must connect or the rest of the move is cancelled
  final?: boolean;            // releases the opponent
  launch?: boolean;
  hitEffect?: string;
}

export interface AttackDef {
  id: string;
  name: string;
  type: AttackType;
  input: { button: Button; dir: DirReq; motion: Motion };
  input2?: { button: Button; dir: DirReq; motion: Motion } | null; // optional alternative (e.g. motion input)
  stance: Stance;             // where it can be used
  damage: number;
  chip: number;               // damage dealt through block (fraction 0..1)
  knockback: number;          // horizontal push
  knockup: number;            // vertical launch on hit (if launcher or airborne)
  launcher: boolean;
  knockdown: boolean;
  blockable: boolean;
  hitLevel: HitLevel;
  startup: number; active: number; recovery: number;   // ticks
  hitstun: number; blockstun: number; hitstop: number;
  energyCost: number;         // meter cost (0..300)
  energyGain: number;
  cooldown: number;           // ticks before it can be used again
  hits: number;               // multi-hit count during active window
  priority: number;           // used when hitboxes clash
  cancel: 'none' | 'chain' | 'special' | 'super';
  moveX: number;              // forward velocity during startup/active
  moveY: number;              // vertical velocity at start (for rising attacks)
  invincible: number;         // ticks of invulnerability from start
  frames: AttackFrame[];      // the attack's own animation
  activeFrom: number; activeTo: number; // indices into frames (inclusive) where hitbox is live
  hitbox: Box;                // default hitbox if active frame has no drawn boxes
  projectile?: string;        // projectile id to spawn
  spawnAt: number;            // tick (from start) to spawn the projectile
  spawnOffset: { x: number; y: number };
  startEffect?: string; hitEffect?: string; activeEffect?: string;
  shake: number;              // screen shake on hit
  afterimage: boolean;
  glow?: string;              // glowing outline color during the move
  sound?: string;             // swing sound key or data URL
  hitSound?: string;
  voice?: string;             // voice clip data URL (e.g. shouting the move name)
  throwRange?: number;
  throwDir?: 'forward' | 'back';
  cinematic?: { alert: CinematicAlert; timeline: TimelineEvent[]; length: number; useTimeline: boolean };
}

export type ProjectileMotion = 'straight' | 'curve' | 'homing' | 'stationary' | 'arc' | 'wave' | 'beam';
export type ProjectileCollision = 'destroy' | 'pierce' | 'clash' | 'absorb';

export interface ProjectileDef {
  id: string;
  name: string;
  spawnAnim: FrameRef[]; travelAnim: FrameRef[]; impactAnim: FrameRef[];
  fps: number;
  shape: 'orb' | 'blade' | 'bolt' | 'ring' | 'beam' | 'star' | 'wave';  // used when no sprite frames are set
  color: string; color2: string;
  damage: number; speed: number; size: number; scale: number;
  angle: number;              // degrees, 0 = forward, positive = upward
  lifetime: number;           // ticks
  knockback: number; knockup: number;
  hitstun: number;
  hits: number;               // number of hits before vanishing
  motion: ProjectileMotion;
  curve: number;              // curvature / homing strength / wave amplitude
  gravity: number;
  collision: ProjectileCollision;
  strength: number;           // used when projectiles collide
  opacity: number;
  trail: string;              // effect preset id or '' for none
  trailRate: number;
  impactEffect: string;
  knockdown: boolean;
  blockable: boolean;
  sound?: string;
  impactSound?: string;
}

export type ParticleKind = 'spark' | 'smoke' | 'dust' | 'energy' | 'fire' | 'lightning' | 'flash' | 'shockwave' | 'streak' | 'ring' | 'pixel' | 'star';

export interface EffectDef {
  id: string;
  name: string;
  kind: ParticleKind;
  color: string; color2: string;
  count: number;
  size: number;
  speed: number;
  life: number;               // ticks
  gravity: number;
  spread: number;             // degrees
  direction: number;          // degrees, 0 = forward, 90 = up
  shake: number;
  glow: boolean;
}

export interface CharacterEffects {
  ghostDash: { enabled: boolean; count: number; color: string; alpha: number; spacing: number; fade: number };
  jumpDust: { enabled: boolean; color: string; size: number; intensity: number; style: 'dust' | 'puff' | 'ring' | 'sparkle' };
  landDust: { enabled: boolean; color: string; size: number; intensity: number; style: 'dust' | 'puff' | 'ring' | 'sparkle'; hardLanding: boolean };
  runStreaks: { enabled: boolean; color: string };
  hitSpark: string;           // effect preset id used for regular hits
  blockSpark: string;
  aura: { enabled: boolean; color: string; whenMeterFull: boolean };
  superFlash: string;
}

export interface OpponentLines { opponent: string; lines: string[] }

export interface CharacterDef {
  formatVersion: number;
  id: string;
  name: string;
  description: string;
  author?: string;
  color: string;              // theme color for UI
  stats: {
    maxHealth: number; walkSpeed: number; runSpeed: number; jumpHeight: number;
    attackPower: number; defense: number; dashSpeed: number; weight: number;
    width: number; height: number;   // body hurtbox in world pixels
    airJumps: number;
  };
  portrait: string;           // data URL ('' = auto from idle frame)
  sheets: SpriteSheet[];
  scale: number;              // sprite pixel -> world pixel
  facesLeft: boolean;         // the source art faces left
  animations: Record<string, AnimationDef>;
  attacks: AttackDef[];
  projectiles: ProjectileDef[];
  effectPresets: EffectDef[];
  effects: CharacterEffects;
  dialogue: {
    intro: string[];
    victory: string[];
    vsVictory: OpponentLines[];
    preFight: OpponentLines[];
    taunt: string[];
  };
  sounds: Record<string, string>;   // key -> data URL
  voices: Record<string, string>;   // intro | victory | ko | hurt -> data URL
  updatedAt?: number;
}

export interface StageLayer {
  id: string;
  name: string;
  image: string;              // data URL
  parallax: number;           // 0 = fixed to screen, 1 = moves with world
  y: number;                  // vertical offset (world px from top)
  x: number;
  scale: number;
  repeatX: boolean;
  scrollSpeed: number;        // auto scroll px/sec
  frames: number;             // horizontal animation frames in the image
  fps: number;
  opacity: number;
  foreground: boolean;        // drawn in front of fighters
}

export type Weather = 'none' | 'rain' | 'snow' | 'leaves' | 'embers' | 'sakura' | 'ash' | 'fireflies' | 'storm';

export interface StageDef {
  formatVersion: number;
  id: string;
  name: string;
  width: number;              // world width
  floorY: number;             // pixels from top of 360-high view to the floor
  skyTop: string; skyBottom: string;
  layers: StageLayer[];
  music: string;              // data URL or '' (built-in tune)
  musicTheme: number;         // built-in tune seed when no music uploaded
  weather: Weather;
  weatherDensity: number;
  ambient: 'none' | 'dust' | 'fireflies' | 'bubbles' | 'sparkles';
  camLeft: number; camRight: number;  // camera bounds (inset from stage edges)
  floorColor: string;
  reflection: boolean;
  updatedAt?: number;
}

export interface KeyBindings {
  up: string[]; down: string[]; left: string[]; right: string[];
  L: string[]; M: string[]; H: string[]; S: string[]; G: string[]; D: string[];
  pause: string[];
}

export interface Settings {
  p1Keys: KeyBindings;
  p2Keys: KeyBindings;
  volume: { master: number; music: number; sfx: number; voice: number };
  aiLevel: number;            // 1..8
  rounds: number;             // rounds needed to win
  roundTime: number;          // seconds, 0 = infinite
  touchControls: 'auto' | 'on' | 'off';
  shake: number;              // 0..2 multiplier
  hitstop: number;            // 0..2 multiplier
  particles: number;          // 0..2 multiplier
  damageScaling: boolean;
  tts: boolean;               // speak dialogue with browser speech when no voice clip
  showInputs: boolean;
  cinematics: 'all' | 'supers' | 'off';  // which moves show their cinematic alert
  scanlines: boolean;
}

export type ButtonState = { up: boolean; down: boolean; left: boolean; right: boolean; L: boolean; M: boolean; H: boolean; S: boolean; G: boolean; D: boolean };
