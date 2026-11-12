// Procedural pixel-art fighter generator.
// Draws a posable pixel humanoid into a real PNG sprite sheet so built-in
// characters use exactly the same data path as user-uploaded art.

import { makeCanvas } from '../engine/assets';
import { shade } from '../engine/util';
import type { AnimationDef, FrameRect, SpriteSheet } from '../engine/types';

export const FW = 96, FH = 96, OX = 48, OY = 92;

export interface BodySpec {
  skin: string; hair: string; top: string; pants: string; belt: string; gloves: string; boots: string;
  accent: string; outline: string; eye: string;
  build: number; tall: number;
  hairStyle: 'spiky' | 'long' | 'bald' | 'ponytail' | 'hood' | 'mohawk' | 'short';
  headband?: string; mask?: string; scarf?: string; pads?: string; beard?: string;
  sleeveless?: boolean;
}

export interface Pose {
  hx?: number; hy?: number; air?: boolean;
  t: number;               // torso lean (deg, + forward)
  h?: number;              // head tilt
  aF: [number, number]; aB: [number, number];
  lF: [number, number]; lB: [number, number];
  open?: boolean;          // open hands (energy)
  glowHands?: string;
  blur?: boolean;          // speed lines on front limb
}

interface Joints { hip: P; sh: P; head: P; eF: P; hF: P; eB: P; hB: P; kF: P; fF: P; kB: P; fB: P }
type P = { x: number; y: number };

const D2R = Math.PI / 180;
const dir = (a: number) => ({ x: Math.sin(a * D2R), y: -Math.cos(a * D2R) }); // 0 = down, 90 = forward, 180 = up

function lengths(b: BodySpec) {
  const t = b.tall;
  return { torso: 21 * t, upper: 12 * t, fore: 11 * t, thigh: 15 * t, shin: 15 * t, head: 6 * Math.min(1.1, 0.9 + b.build * 0.1), tw: 12.5 * b.build, limb: 5.4 * b.build, leg: 6.2 * b.build };
}

export function solve(pose: Pose, b: BodySpec): Joints {
  const L = lengths(b);
  const legEnd = (lp: [number, number]) => {
    const k = dir(lp[0]), s = dir(lp[0] + lp[1]);
    return k.y * L.thigh + s.y * L.shin;
  };
  let hy = pose.hy ?? 0;
  if (!pose.air) hy = Math.max(-legEnd(pose.lF), -legEnd(pose.lB)) + 1;
  const hip = { x: pose.hx ?? 0, y: hy };
  const tl = pose.t * D2R;
  const sh = { x: hip.x + Math.sin(tl) * L.torso, y: hip.y + Math.cos(tl) * L.torso };
  const hl = (pose.t + (pose.h ?? 0) * 0.6) * D2R;
  const head = { x: sh.x + Math.sin(hl) * (L.head + 2), y: sh.y + Math.cos(hl) * (L.head + 2) };
  const arm = (a: [number, number], off: number) => {
    const s = { x: sh.x + off, y: sh.y - 1 };
    const u = dir(pose.t + a[0]), f = dir(pose.t + a[0] + a[1]);
    const e = { x: s.x + u.x * L.upper, y: s.y + u.y * L.upper };
    return [e, { x: e.x + f.x * L.fore, y: e.y + f.y * L.fore }];
  };
  const leg = (l: [number, number], off: number) => {
    const s = { x: hip.x + off, y: hip.y };
    const k = dir(l[0]), sv = dir(l[0] + l[1]);
    const kn = { x: s.x + k.x * L.thigh, y: s.y + k.y * L.thigh };
    return [kn, { x: kn.x + sv.x * L.shin, y: kn.y + sv.y * L.shin }];
  };
  const [eF, hF] = arm(pose.aF, 2), [eB, hB] = arm(pose.aB, -2);
  const [kF, fF] = leg(pose.lF, 2), [kB, fB] = leg(pose.lB, -2);
  return { hip, sh, head, eF, hF, eB, hB, kF, fF, kB, fB };
}

// ---- pixel drawing helpers (local coords: x forward, y up; origin = feet) ----
type G = CanvasRenderingContext2D;
let OX_ = OX, OY_ = OY;
const px = (x: number) => Math.round(OX_ + x);
const py = (y: number) => Math.round(OY_ - y);
function dot(g: G, x: number, y: number, r: number, c: string) {
  g.fillStyle = c;
  const R = Math.max(0.5, r);
  const ri = Math.ceil(R);
  for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
    if (dx * dx + dy * dy <= R * R + 0.6) g.fillRect(px(x) + dx, py(y) + dy, 1, 1);
  }
}
function seg(g: G, a: P, b: P, r: number, c: string) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(1, Math.ceil(d * 1.5));
  for (let i = 0; i <= n; i++) dot(g, a.x + (b.x - a.x) * (i / n), a.y + (b.y - a.y) * (i / n), r, c);
}
function seg2(g: G, a: P, b: P, r: number, c: string, o: string) { seg(g, a, b, r + 1, o); seg(g, a, b, r, c); }

export function drawFigure(g: G, pose: Pose, b: BodySpec, frameIdx: number, ox = OX, oy = OY) {
  OX_ = ox; OY_ = oy;
  const J = solve(pose, b);
  const L = lengths(b);
  const O = b.outline;
  const dark = (c: string) => shade(c, -0.2);
  const sleeve = b.sleeveless ? b.skin : b.top;
  // back scarf / headband tails
  const flutter = Math.sin(frameIdx * 1.7) * 2;
  const tailCol = b.scarf || b.headband;
  if (tailCol) {
    const base = b.scarf ? { x: J.sh.x - 1, y: J.sh.y + 2 } : { x: J.head.x - L.head + 1, y: J.head.y + 3 };
    const len = b.scarf ? 16 : 10;
    const tip = { x: base.x - len, y: base.y - 3 + flutter };
    seg2(g, base, { x: (base.x + tip.x) / 2, y: base.y + flutter * 0.5 - 1 }, b.scarf ? 2 : 1, tailCol, O);
    seg2(g, { x: (base.x + tip.x) / 2, y: base.y + flutter * 0.5 - 1 }, tip, b.scarf ? 1.6 : 1, dark(tailCol), O);
  }
  if (b.hairStyle === 'ponytail' || b.hairStyle === 'long') {
    const hb = { x: J.head.x - L.head + 1, y: J.head.y + 2 };
    const tip = { x: hb.x - (b.hairStyle === 'long' ? 4 : 10), y: hb.y - (b.hairStyle === 'long' ? 12 : 6) + flutter };
    seg2(g, hb, tip, b.hairStyle === 'long' ? 3.2 : 2.2, b.hair, O);
  }
  // back leg + back arm (darker)
  seg2(g, J.hip, J.kB, L.leg / 2, dark(b.pants), O);
  seg2(g, J.kB, J.fB, L.leg / 2 - 0.3, dark(b.pants), O);
  drawFoot(g, J.kB, J.fB, dark(b.boots), O);
  seg2(g, { x: J.sh.x - 2, y: J.sh.y - 1 }, J.eB, L.limb / 2, dark(sleeve), O);
  seg2(g, J.eB, J.hB, L.limb / 2 - 0.2, dark(b.skin), O);
  dot(g, J.hB.x, J.hB.y, pose.open ? 2.2 : 2.4, O);
  dot(g, J.hB.x, J.hB.y, pose.open ? 1.4 : 1.7, dark(b.gloves));
  // torso
  const tw = L.tw / 2;
  seg(g, J.hip, J.sh, tw + 1, O);
  seg(g, J.hip, J.sh, tw, b.top);
  // torso highlight & shading
  const tl = pose.t * D2R;
  const side = { x: Math.cos(tl), y: -Math.sin(tl) };
  seg(g, { x: J.hip.x + side.x * (tw - 1.5), y: J.hip.y + side.y * (tw - 1.5) + 3 }, { x: J.sh.x + side.x * (tw - 2), y: J.sh.y + side.y * (tw - 2) - 2 }, 0.8, shade(b.top, 0.25));
  seg(g, { x: J.hip.x - side.x * (tw - 1), y: J.hip.y - side.y * (tw - 1) + 3 }, { x: J.sh.x - side.x * (tw - 1), y: J.sh.y - side.y * (tw - 1) - 2 }, 1, dark(b.top));
  if (b.sleeveless && !b.pads) { // exposed chest V / skin
    const mid = { x: (J.hip.x * 0.35 + J.sh.x * 0.65), y: (J.hip.y * 0.35 + J.sh.y * 0.65) };
    seg(g, mid, { x: J.sh.x + side.x * 1, y: J.sh.y - 1 }, 1.6, b.skin);
  }
  // belt
  const bt = { x: J.hip.x + Math.sin(tl) * 3, y: J.hip.y + Math.cos(tl) * 3 };
  seg(g, { x: bt.x - side.x * tw, y: bt.y - side.y * tw }, { x: bt.x + side.x * tw, y: bt.y + side.y * tw }, 1.3, b.belt);
  seg(g, bt, { x: bt.x - 3, y: bt.y - 5 + flutter * 0.3 }, 0.8, b.belt);
  // front leg
  seg2(g, J.hip, J.kF, L.leg / 2, b.pants, O);
  seg2(g, J.kF, J.fF, L.leg / 2 - 0.3, b.pants, O);
  seg(g, { x: J.hip.x + 1, y: J.hip.y - 1 }, { x: J.kF.x + 1, y: J.kF.y }, 0.6, shade(b.pants, 0.22));
  drawFoot(g, J.kF, J.fF, b.boots, O);
  // head
  drawHead(g, J, b, pose, L.head);
  // shoulder pads
  if (b.pads) { dot(g, J.sh.x + 1, J.sh.y, 4.4, O); dot(g, J.sh.x + 1, J.sh.y, 3.5, b.pads); dot(g, J.sh.x + 2, J.sh.y + 1, 1.2, shade(b.pads, 0.3)); }
  // front arm
  seg2(g, { x: J.sh.x + 2, y: J.sh.y - 1 }, J.eF, L.limb / 2, sleeve, O);
  seg2(g, J.eF, J.hF, L.limb / 2 - 0.2, b.skin, O);
  if (b.gloves !== b.skin) seg(g, { x: J.eF.x * 0.3 + J.hF.x * 0.7, y: J.eF.y * 0.3 + J.hF.y * 0.7 }, J.hF, L.limb / 2 - 0.2, b.gloves);
  dot(g, J.hF.x, J.hF.y, pose.open ? 2.4 : 2.8, O);
  dot(g, J.hF.x, J.hF.y, pose.open ? 1.5 : 2, b.gloves);
  dot(g, J.hF.x + 0.6, J.hF.y + 0.6, 0.5, shade(b.gloves, 0.35));
  if (pose.glowHands) {
    g.globalAlpha = 0.85; dot(g, J.hF.x + 2, J.hF.y, 4, pose.glowHands); dot(g, J.hF.x + 2, J.hF.y, 2, '#ffffff'); g.globalAlpha = 1;
  }
  if (pose.blur) {
    g.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 3; i++) g.fillRect(px(J.hF.x - 10 - i * 3), py(J.hF.y + i * 2 - 2), 6, 1);
  }
  return J;
}

function drawFoot(g: G, k: P, f: P, c: string, o: string) {
  const ang = Math.atan2(f.y - k.y, f.x - k.x);
  // foot points roughly perpendicular-forward to the shin
  const fwd = { x: Math.cos(ang + Math.PI / 2), y: Math.sin(ang + Math.PI / 2) };
  const s = fwd.x < 0 ? -1 : 1;
  const toe = { x: f.x + fwd.x * 4 * s, y: f.y + fwd.y * 4 * s };
  seg2(g, { x: f.x - fwd.x * s, y: f.y - fwd.y * s }, toe, 1.7, c, o);
}

function drawHead(g: G, J: Joints, b: BodySpec, pose: Pose, r: number) {
  const O = b.outline, H = J.head;
  // neck
  seg(g, J.sh, H, 2.2, O); seg(g, J.sh, { x: (J.sh.x + H.x) / 2, y: (J.sh.y + H.y) / 2 }, 1.6, shade(b.skin, -0.15));
  // hood behind
  if (b.hairStyle === 'hood') { dot(g, H.x - 0.5, H.y + 0.5, r + 2.2, O); dot(g, H.x - 0.5, H.y + 0.5, r + 1.2, b.hair); }
  dot(g, H.x, H.y, r + 1, O);
  dot(g, H.x, H.y, r, b.skin);
  dot(g, H.x - 2, H.y - 2, r - 3, shade(b.skin, -0.12));
  // hair
  const hc = b.hair, hd = shade(b.hair, -0.25);
  switch (b.hairStyle) {
    case 'spiky':
      for (let i = 0; i < 5; i++) {
        const a = (165 - i * 24) * D2R; const base = { x: H.x + Math.cos(a) * (r - 2), y: H.y + Math.sin(a) * (r - 2) + 1 };
        const tip = { x: H.x + Math.cos(a) * (r + 4) - 3, y: H.y + Math.sin(a) * (r + 3.5) + 1 };
        seg2(g, base, tip, 1.3, hc, O);
      }
      dot(g, H.x - 2.5, H.y + 2.5, r - 2, hc); dot(g, H.x - 3, H.y + 1.5, r - 3.5, hd);
      seg(g, { x: H.x - 1, y: H.y + r - 1 }, { x: H.x + r - 2, y: H.y + 2.5 }, 1.1, hc);
      break;
    case 'mohawk':
      for (let i = 0; i < 4; i++) seg2(g, { x: H.x - 3 + i * 2, y: H.y + r - 2 }, { x: H.x - 4 + i * 2.6, y: H.y + r + 4 - Math.abs(i - 1.5) }, 1.2, hc, O);
      break;
    case 'long': case 'ponytail': case 'short':
      dot(g, H.x - 2, H.y + 2, r - 1.2, hc); dot(g, H.x - 3, H.y + 1, r - 2.6, hd);
      seg(g, { x: H.x + 1, y: H.y + r - 1 }, { x: H.x + r - 0.5, y: H.y + 1 }, 1.2, hc);
      break;
    case 'hood':
      seg(g, { x: H.x - r, y: H.y + r - 1 }, { x: H.x + r - 1, y: H.y + r - 1 }, 1.3, b.hair);
      break;
    case 'bald':
      dot(g, H.x + 1, H.y + 3, 1, shade(b.skin, 0.3));
      break;
  }
  if (b.beard) { dot(g, H.x + 1, H.y - 3, r - 2.5, b.beard); }
  // headband
  if (b.headband) seg(g, { x: H.x - r + 0.5, y: H.y + 3 }, { x: H.x + r - 0.8, y: H.y + 3.5 }, 0.9, b.headband);
  // mask
  if (b.mask) { seg(g, { x: H.x - 1, y: H.y - 2 }, { x: H.x + r - 0.5, y: H.y - 2 }, 1.8, b.mask); }
  // eye + brow
  const eyeX = H.x + r - 2.5, eyeY = H.y + 0.5;
  g.fillStyle = '#ffffff'; g.fillRect(px(eyeX) - 1, py(eyeY), 2, 1);
  g.fillStyle = b.eye; g.fillRect(px(eyeX), py(eyeY), 1, 1);
  g.fillStyle = O; g.fillRect(px(eyeX) - 2, py(eyeY + 1.5), 3, 1);
  if (!b.mask && !b.beard) { g.fillStyle = shade(b.skin, -0.35); g.fillRect(px(H.x + r - 1.5), py(H.y - 3), 2, 1); }
}

// ============================================================================
// Pose library
// ============================================================================
const STANCE = { t: 8, aF: [55, 95] as [number, number], aB: [35, 105] as [number, number], lF: [22, -28] as [number, number], lB: [-20, -8] as [number, number] };
const CROUCH_L = { lF: [78, -100] as [number, number], lB: [28, -118] as [number, number] };
const p = (o: Partial<Pose>): Pose => ({ ...STANCE, ...o } as Pose);

export function walkPose(ph: number, back = false): Pose {
  const s = Math.cos(ph * Math.PI * 2), c = Math.sin(ph * Math.PI * 2);
  const amp = back ? 18 : 24;
  return p({ t: back ? 2 : 10, lF: [amp * s, -12 - 30 * Math.max(0, c)], lB: [-amp * s, -12 - 30 * Math.max(0, -c)], aF: [55 + 6 * s, 95], aB: [35 - 6 * s, 105] });
}
export function runPose(ph: number): Pose {
  const s = Math.cos(ph * Math.PI * 2), c = Math.sin(ph * Math.PI * 2);
  return p({ t: 28, h: -10, lF: [45 * s, -20 - 70 * Math.max(0, c)], lB: [-45 * s, -20 - 70 * Math.max(0, -c)], aF: [-50 * s + 10, 90], aB: [50 * s + 10, 90] });
}

export const POSES: Record<string, Pose> = {
  idle0: p({}),
  idle1: p({ lF: [24, -34], lB: [-21, -14], aF: [52, 98] }),
  idle2: p({ lF: [25, -38], lB: [-22, -18], aF: [50, 100], aB: [33, 108] }),
  idle3: p({ lF: [24, -34], lB: [-21, -14], aF: [53, 97] }),
  crouch: p({ t: 14, ...CROUCH_L }),
  jumpSquat: p({ t: 14, lF: [55, -80], lB: [5, -75] }),
  jumpUp: p({ air: true, hy: 34, t: 6, lF: [70, -110], lB: [15, -95], aF: [70, 80], aB: [20, 90] }),
  jumpTuck: p({ air: true, hy: 30, t: 20, lF: [95, -130], lB: [60, -130], aF: [80, 90], aB: [50, 90] }),
  jumpDown: p({ air: true, hy: 32, t: 4, lF: [30, -45], lB: [-12, -30], aF: [80, 60], aB: [40, 60] }),
  dash: p({ t: 32, h: -12, lF: [55, -50], lB: [-45, -25], aF: [-35, 30], aB: [-45, 25] }),
  dash2: p({ t: 30, h: -12, lF: [35, -70], lB: [-50, -10], aF: [-40, 30], aB: [-50, 25] }),
  backdash: p({ air: true, hy: 30, t: -15, lF: [25, -50], lB: [-5, -60], aF: [60, 90], aB: [30, 100] }),
  block: p({ t: -6, h: 5, aF: [72, 108], aB: [62, 112], lF: [20, -30], lB: [-24, -10] }),
  crouchBlock: p({ t: 6, ...CROUCH_L, aF: [72, 108], aB: [62, 112] }),
  hit0: p({ t: -18, h: -25, aF: [25, 40], aB: [-25, 30], lF: [26, -20], lB: [-24, -12] }),
  hit1: p({ t: -28, h: -30, aF: [10, 30], aB: [-40, 20], lF: [28, -18], lB: [-26, -16] }),
  crouchHit: p({ t: -15, h: -25, ...CROUCH_L, aF: [25, 50], aB: [-20, 40] }),
  airHit: p({ air: true, hy: 30, t: -55, h: -30, aF: [150, 10], aB: [120, 20], lF: [65, -30], lB: [40, -50] }),
  airHit2: p({ air: true, hy: 30, t: -80, h: -20, aF: [170, 10], aB: [140, 20], lF: [80, -40], lB: [55, -30] }),
  down0: p({ air: true, hy: 4, t: -86, h: 0, aF: [100, -20], aB: [70, 0], lF: [88, -6], lB: [80, -14] }),
  down1: p({ air: true, hy: 4, t: -88, h: 5, aF: [120, -10], aB: [80, 0], lF: [85, -12], lB: [92, 0] }),
  getup0: p({ air: true, hy: 6, t: -40, h: 10, aF: [-40, 60], aB: [-60, 40], lF: [70, -80], lB: [80, -100] }),
  getup1: p({ t: 20, ...CROUCH_L, aF: [40, 80], aB: [20, 90] }),
  grabbed: p({ t: 22, h: -20, aF: [70, -40], aB: [40, -30], lF: [10, -10], lB: [-10, -10] }),
  ko0: p({ t: -30, h: -30, aF: [20, 20], aB: [-30, 10], lF: [30, -40], lB: [-20, -50] }),
  victory0: p({ t: 0, h: 5, aF: [175, 10], aB: [-35, -80], lF: [12, -6], lB: [-12, -4] }),
  victory1: p({ t: 0, h: 8, aF: [178, 5], aB: [-35, -80], lF: [12, -6], lB: [-12, -4] }),
  victory2: p({ t: 2, h: 0, aF: [35, 120], aB: [35, 120], lF: [10, -4], lB: [-10, -4] }),
  bow: p({ t: 35, h: 20, aF: [10, 5], aB: [5, 5], lF: [8, -4], lB: [-8, -4] }),
  intro0: p({ t: 0, aF: [30, 122], aB: [30, 122], lF: [10, -5], lB: [-10, -5] }),
  intro1: p({ t: -4, h: -5, aF: [100, 60], aB: [20, 30], lF: [20, -25], lB: [-20, -10], open: true }),
  // ---- attacks ----
  jabA: p({ t: 10, aF: [70, 100], aB: [30, 110] }),
  jabB: p({ t: 14, aF: [90, 2], aB: [30, 110], lF: [26, -24] }),
  jabC: p({ t: 12, aF: [80, 40], aB: [32, 108] }),
  strA: p({ t: 0, aF: [40, 115], aB: [60, 80], lF: [20, -28], lB: [-22, -10] }),
  strB: p({ hx: 4, t: 26, h: -5, aF: [92, 0], aB: [-20, 60], lF: [42, -40], lB: [-38, -2], blur: true }),
  strC: p({ hx: 3, t: 22, aF: [88, 10], aB: [-15, 70], lF: [40, -40], lB: [-36, -2] }),
  kneeUp: p({ t: -4, lF: [85, -125], lB: [-6, -4], aF: [60, 90], aB: [20, 100] }),
  kickMid: p({ t: -18, lF: [88, -2], lB: [-8, -2], aF: [40, 100], aB: [0, 80] }),
  kickHigh: p({ t: -34, h: 10, lF: [128, 0], lB: [-12, -2], aF: [20, 100], aB: [-20, 60] }),
  kickLow: p({ t: -10, lF: [60, -5], lB: [-10, -6], aF: [50, 100], aB: [20, 100] }),
  roundA: p({ t: -10, lF: [100, -130], lB: [-10, -4], aF: [30, 100], aB: [60, 80] }),
  cJab: p({ t: 16, ...CROUCH_L, aF: [92, 4], aB: [35, 105] }),
  sweepA: p({ t: 10, lF: [70, -120], lB: [40, -130], aF: [10, 30], aB: [-30, 40] }),
  sweep: p({ t: 6, hy: 12, air: true, lF: [92, -2], lB: [40, -120], aF: [-10, 20], aB: [-40, 20] }),
  upperA: p({ t: 20, ...CROUCH_L, aF: [20, 60], aB: [30, 100] }),
  upperB: p({ t: 6, h: 10, aF: [168, 6], aB: [20, 90], lF: [22, -20], lB: [-15, -4] }),
  airPunch: p({ air: true, hy: 30, t: 22, lF: [80, -110], lB: [20, -100], aF: [60, 4], aB: [20, 90] }),
  airKick: p({ air: true, hy: 30, t: -6, lF: [62, -2], lB: [20, -110], aF: [80, 80], aB: [10, 90] }),
  airKickH: p({ air: true, hy: 32, t: -20, lF: [95, -2], lB: [10, -100], aF: [30, 90], aB: [-10, 60] }),
  airStomp: p({ air: true, hy: 32, t: 10, lF: [20, -2], lB: [40, -110], aF: [120, 40], aB: [100, 40] }),
  fireA: p({ t: -6, aF: [-25, 95], aB: [-35, 95], lF: [30, -40], lB: [-30, -6], open: true }),
  fireB: p({ hx: 3, t: 18, aF: [90, 0], aB: [86, 4], lF: [44, -40], lB: [-38, 0], open: true }),
  fireC: p({ hx: 2, t: 14, aF: [86, 10], aB: [80, 12], lF: [42, -40], lB: [-36, 0], open: true }),
  dpA: p({ t: 22, ...CROUCH_L, aF: [15, 50], aB: [20, 90] }),
  dpB: p({ air: true, hy: 30, t: 8, h: 10, aF: [165, 4], aB: [20, 80], lF: [70, -95], lB: [-6, -20] }),
  dpC: p({ air: true, hy: 30, t: 2, h: 14, aF: [178, 2], aB: [10, 70], lF: [60, -80], lB: [-10, -30] }),
  spinA: p({ air: true, hy: 30, t: 0, lF: [92, -2], lB: [-10, -60], aF: [80, 0], aB: [-90, 0] }),
  spinB: p({ air: true, hy: 30, t: 0, lF: [-10, -60], lB: [-92, -2], aF: [-80, 0], aB: [90, 0] }),
  power0: p({ t: 0, h: -10, aF: [30, 4], aB: [-30, 4], lF: [30, -30], lB: [-30, -20], open: true }),
  power1: p({ t: 4, h: 15, aF: [150, 30], aB: [150, 30], lF: [32, -32], lB: [-32, -22], open: true }),
  graspA: p({ t: 18, aF: [88, 10], aB: [82, 14], lF: [34, -36], lB: [-30, -4], open: true }),
  graspB: p({ t: -10, aF: [50, 90], aB: [40, 100], lF: [24, -30], lB: [-26, -8] }),
  tossA: p({ t: -25, h: -5, aF: [160, 20], aB: [150, 20], lF: [22, -20], lB: [-30, -20] }),
  tossB: p({ hx: 4, t: 35, h: 10, aF: [100, 0], aB: [90, 0], lF: [40, -30], lB: [-40, -10], open: true }),
  slam: p({ t: 40, h: 20, aF: [60, 0], aB: [55, 0], lF: [45, -60], lB: [-40, -20] }),
  headbutt: p({ hx: 4, t: 38, h: 15, aF: [10, 40], aB: [-10, 40], lF: [40, -40], lB: [-36, -2] }),
  shoulder: p({ hx: 4, t: 30, h: -10, aF: [20, 120], aB: [-30, 60], lF: [50, -50], lB: [-40, -6] }),
  throwKunai: p({ t: 14, aF: [100, -10], aB: [-40, 60], lF: [34, -36], lB: [-30, -6], open: true }),
  slashA: p({ t: 6, aF: [150, 20], aB: [-30, 60], lF: [30, -30], lB: [-30, -10] }),
  slashB: p({ hx: 3, t: 28, aF: [60, 0], aB: [-30, 60], lF: [44, -40], lB: [-38, -2], blur: true }),
  flipA: p({ air: true, hy: 30, t: -40, h: -10, lF: [150, -10], lB: [40, -110], aF: [-40, 40], aB: [-60, 40] }),
  flipB: p({ air: true, hy: 30, t: -100, h: -10, lF: [175, 0], lB: [120, -100], aF: [-70, 20], aB: [-90, 20] }),
  meditate: p({ t: 0, h: -5, aF: [60, 80], aB: [60, 80], lF: [12, -6], lB: [-12, -4], glowHands: '#ffffff', open: true }),
  taunt: p({ t: -5, h: 10, aF: [100, 70], aB: [-30, -80], lF: [14, -8], lB: [-14, -4], open: true }),
};

/** Additional poses procedurally created for cycles. */
for (let i = 0; i < 6; i++) { POSES['walk' + i] = walkPose(i / 6); POSES['wback' + i] = walkPose(1 - i / 6, true); POSES['run' + i] = runPose(i / 6); }

export const POSE_ORDER = Object.keys(POSES);

export interface GeneratedSheet { sheet: SpriteSheet; index: Record<string, number>; joints: Record<string, Joints> }

/** Render the whole pose library for a body into a single sprite sheet. */
export function generateSheet(b: BodySpec, name: string, id = 'body'): GeneratedSheet {
  const cols = 12;
  const rows = Math.ceil(POSE_ORDER.length / cols);
  const [c, g] = makeCanvas(cols * FW, rows * FH);
  const frames: FrameRect[] = [];
  const index: Record<string, number> = {};
  const joints: Record<string, Joints> = {};
  POSE_ORDER.forEach((k, i) => {
    const x = (i % cols) * FW, y = Math.floor(i / cols) * FH;
    const J = drawFigure(g, POSES[k], b, i, x + OX, y + OY);
    joints[k] = J;
    frames.push({ x, y, w: FW, h: FH, ox: OX, oy: OY });
    index[k] = i;
  });
  return { sheet: { id, name, image: c.toDataURL('image/png'), width: c.width, height: c.height, frames }, index, joints };
}

export function anim(gs: GeneratedSheet, names: string[], fps: number, loop: boolean, sheetId = 'body'): AnimationDef {
  return { frames: names.map(n => ({ sheet: sheetId, index: gs.index[n] })), fps, loop };
}

export function standardAnimations(gs: GeneratedSheet): Record<string, AnimationDef> {
  const w = (n: string) => [0, 1, 2, 3, 4, 5].map(i => n + i);
  return {
    idle: anim(gs, ['idle0', 'idle1', 'idle2', 'idle3'], 6, true),
    walk: anim(gs, w('walk'), 10, true),
    walkBack: anim(gs, w('wback'), 9, true),
    run: anim(gs, w('run'), 14, true),
    crouch: anim(gs, ['crouch'], 8, true),
    jumpSquat: anim(gs, ['jumpSquat'], 12, false),
    jumpUp: anim(gs, ['jumpUp', 'jumpTuck'], 8, false),
    jumpDown: anim(gs, ['jumpDown'], 8, false),
    land: anim(gs, ['jumpSquat'], 12, false),
    dash: anim(gs, ['dash', 'dash2'], 12, true),
    backdash: anim(gs, ['backdash'], 8, false),
    block: anim(gs, ['block'], 8, true),
    crouchBlock: anim(gs, ['crouchBlock'], 8, true),
    hit: anim(gs, ['hit0', 'hit1'], 10, false),
    crouchHit: anim(gs, ['crouchHit'], 8, false),
    airHit: anim(gs, ['airHit', 'airHit2'], 6, false),
    knockdown: anim(gs, ['down0', 'down1'], 6, false),
    getup: anim(gs, ['getup0', 'getup1'], 7, false),
    grabbed: anim(gs, ['grabbed'], 8, true),
    ko: anim(gs, ['ko0', 'airHit2', 'down0', 'down1'], 6, false),
    victory: anim(gs, ['victory2', 'victory0', 'victory1', 'victory0', 'victory1'], 5, true),
    intro: anim(gs, ['intro0', 'intro0', 'intro1', 'idle0'], 3, false),
  };
}

/** Pixel art portrait (bust) for a body spec. */
export function generatePortrait(b: BodySpec, bg: string): string {
  const S = 64;
  const [c, g] = makeCanvas(S, S);
  const grad = g.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, shade(bg, 0.25)); grad.addColorStop(1, shade(bg, -0.55));
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = -S; i < S; i += 6) { g.beginPath(); g.moveTo(i, S); g.lineTo(i + S, 0); g.lineTo(i + S + 2, 0); g.lineTo(i + 2, S); g.fill(); }
  // Draw the head & shoulders small, then upscale 3x with nearest-neighbour for chunky pixels
  const N = 22;
  const [hc, hg] = makeCanvas(N, N);
  const pose: Pose = { t: 4, h: 4, aF: [10, 5], aB: [-10, 5], lF: [0, 0], lB: [0, 0], air: true, hy: 0 };
  const J = solve(pose, b);
  drawFigure(hg, pose, b, 0, 11 - J.head.x, 9 + J.head.y);
  g.imageSmoothingEnabled = false;
  g.drawImage(hc, 0, 0, N, N, -1, 0, N * 3, N * 3);
  g.strokeStyle = '#000'; g.lineWidth = 2; g.strokeRect(1, 1, S - 2, S - 2);
  return c.toDataURL('image/png');
}

/** Small animated projectile sheet: 4 travel frames, 2 spawn, 4 impact (24x24 each). */
export function generateProjectileSheet(c1: string, c2: string, kind: 'orb' | 'flame' = 'orb'): SpriteSheet {
  const S = 24, N = 10;
  const [c, g] = makeCanvas(S * N, S);
  const frames: FrameRect[] = [];
  const disc = (cx: number, cy: number, r: number, col: string) => {
    g.fillStyle = col;
    for (let y = -Math.ceil(r); y <= r; y++) for (let x = -Math.ceil(r); x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
  };
  for (let i = 0; i < N; i++) {
    const ox = i * S, cx = ox + 12, cy = 12;
    if (i < 2) { // spawn
      const r = 3 + i * 3; disc(cx, cy, r + 1, c2); disc(cx, cy, r, c1); disc(cx, cy, r * 0.5, '#ffffff');
    } else if (i < 6) { // travel
      const k = i - 2;
      for (let t = 0; t < 4; t++) disc(cx - 4 - t * 2.4, cy + Math.sin(k + t) * 1.5, 4 - t * 0.8, c2);
      disc(cx + 1, cy, 7 + (k % 2), shade(c2, -0.2)); disc(cx + 1, cy, 6, c2); disc(cx + 2, cy, 4.4, c1); disc(cx + 3, cy - 1, 2, '#ffffff');
      if (kind === 'flame') { disc(cx - 2, cy - 4 + (k % 2), 2, c1); disc(cx - 2, cy + 4 - (k % 2), 2, c1); }
    } else { // impact
      const k = i - 6, r = 5 + k * 2.5;
      g.globalAlpha = 1 - k * 0.2;
      disc(cx, cy, r, c2); disc(cx, cy, Math.max(0, r - 2 - k), c1);
      if (k < 2) disc(cx, cy, r * 0.4, '#ffffff');
      if (k >= 2) { g.globalCompositeOperation = 'destination-out'; disc(cx, cy, r - 3, '#000'); g.globalCompositeOperation = 'source-over'; }
      g.globalAlpha = 1;
    }
    frames.push({ x: ox, y: 0, w: S, h: S, ox: 12, oy: 12 });
  }
  return { id: 'fx', name: 'Projectile FX', image: c.toDataURL('image/png'), width: c.width, height: c.height, frames };
}

export const BODY_PRESETS: Record<string, BodySpec> = {
  fighter: { skin: '#f0c08a', hair: '#2a2030', top: '#f4f4f0', pants: '#e8e8e2', belt: '#222222', gloves: '#c03030', boots: '#d9a066', accent: '#c03030', outline: '#140c18', eye: '#202060', build: 1, tall: 1, hairStyle: 'spiky', headband: '#d02828' },
};
