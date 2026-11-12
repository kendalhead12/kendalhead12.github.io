// Pure input structures used by the simulation (no DOM here).
import type { ButtonState, Motion, DirReq } from './types';

export type InputFrame = ButtonState;
export const BUTTONS = ['L', 'M', 'H', 'S', 'G', 'D'] as const;
export type Btn = typeof BUTTONS[number];
export const emptyInput = (): InputFrame => ({ up: false, down: false, left: false, right: false, L: false, M: false, H: false, S: false, G: false, D: false });

const HIST = 48;
export const BUFFER_TICKS = 6;

/** Numpad notation relative to facing (6 = forward). */
export function numpad(f: InputFrame, facing: number): number {
  const fwd = facing > 0 ? f.right && !f.left : f.left && !f.right;
  const back = facing > 0 ? f.left && !f.right : f.right && !f.left;
  const v = f.up && !f.down ? 1 : f.down && !f.up ? -1 : 0;
  const h = fwd ? 1 : back ? -1 : 0;
  return 5 + h + v * 3;
}

export class InputBuffer {
  hist: InputFrame[] = [];
  tick = 0;
  lastPress: Record<string, number> = {};
  used: Record<string, number> = {};
  taps: { dir: 'left' | 'right'; t: number }[] = [];
  doubleTap: { dir: 'left' | 'right'; t: number } | null = null;

  push(f: InputFrame) {
    const prev = this.hist[0];
    this.tick++;
    for (const b of BUTTONS) if (f[b] && !(prev && prev[b])) this.lastPress[b] = this.tick;
    for (const d of ['left', 'right'] as const) {
      if (f[d] && !(prev && prev[d])) {
        const last = this.taps.filter(x => x.dir === d).pop();
        if (last && this.tick - last.t <= 14) this.doubleTap = { dir: d, t: this.tick };
        this.taps.push({ dir: d, t: this.tick });
        if (this.taps.length > 6) this.taps.shift();
      }
    }
    this.hist.unshift({ ...f });
    if (this.hist.length > HIST) this.hist.pop();
  }
  get cur(): InputFrame { return this.hist[0] || emptyInput(); }
  held(b: keyof InputFrame) { return !!this.cur[b]; }
  /** Was the button pressed recently and not yet consumed? */
  buffered(b: Btn, within = BUFFER_TICKS) {
    const t = this.lastPress[b];
    return t !== undefined && this.tick - t < within && (this.used[b] ?? -1) < t;
  }
  pressedNow(b: Btn) { return this.lastPress[b] === this.tick; }
  consume(b: Btn) { this.used[b] = this.tick; }
  consumeDoubleTap() { this.doubleTap = null; }
  recentDoubleTap(within = 2) { return this.doubleTap && this.tick - this.doubleTap.t < within ? this.doubleTap.dir : null; }

  dirSeq(facing: number, window = 20): number[] {
    const seq: number[] = [];
    for (let i = Math.min(window, this.hist.length) - 1; i >= 0; i--) {
      const n = numpad(this.hist[i], facing);
      if (seq[seq.length - 1] !== n) seq.push(n);
    }
    return seq;
  }
  /** Lenient motion detection on the recent direction history. */
  motion(m: Motion, facing: number): boolean {
    if (m === 'none') return true;
    const seq = this.dirSeq(facing, m === 'dqcf' ? 34 : m === 'hcb' ? 26 : 20);
    const has = (pattern: number[][]) => {
      let i = 0;
      for (const n of seq) { if (pattern[i].includes(n)) { i++; if (i >= pattern.length) return true; } }
      return false;
    };
    switch (m) {
      case 'qcf': return has([[2], [3, 6], [6]]) || has([[2], [3]]) && numpad(this.cur, facing) === 6 || has([[2], [6]]);
      case 'qcb': return has([[2], [1, 4], [4]]) || has([[2], [4]]);
      case 'dp': return has([[6], [2, 3], [3]]) || has([[6], [2], [6, 3]]);
      case 'hcb': return has([[6], [2, 3], [1, 2], [4]]);
      case 'dqcf': return has([[2], [6], [2], [6]]) || has([[2], [3], [6], [2], [3], [6]]);
    }
    return false;
  }
  dirOk(req: DirReq, facing: number): boolean {
    const n = numpad(this.cur, facing);
    switch (req) {
      case 'any': return true;
      case 'neutral': return n === 5;
      case 'forward': return n === 6 || n === 9;
      case 'back': return n === 4 || n === 7;
      case 'down': return n === 1 || n === 2 || n === 3;
      case 'downforward': return n === 3;
      case 'up': return n === 7 || n === 8 || n === 9;
    }
  }
  reset() { this.hist = []; this.lastPress = {}; this.used = {}; this.taps = []; this.doubleTap = null; }
}
