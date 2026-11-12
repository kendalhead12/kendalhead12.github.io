// DOM input devices: keyboard, gamepads and the on-screen touch controls.
import type { KeyBindings } from './types';
import { emptyInput, InputFrame } from './input';

const keys = new Set<string>();
let installed = false;
export function installKeyboard() {
  if (installed) return;
  installed = true;
  window.addEventListener('keydown', e => {
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)) return;
    keys.add(e.code);
    if (gameKeyCapture && (e.code.startsWith('Arrow') || e.code === 'Space')) e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
}
let gameKeyCapture = false;
export function setGameKeyCapture(on: boolean) { gameKeyCapture = on; }
export const isKeyDown = (code: string) => keys.has(code);

/** Touch controls write into this shared state. */
export const touchState: InputFrame = emptyInput();

export function readKeyboard(b: KeyBindings): InputFrame {
  const f = emptyInput();
  const any = (codes: string[]) => codes.some(c => keys.has(c));
  f.up = any(b.up); f.down = any(b.down); f.left = any(b.left); f.right = any(b.right);
  f.L = any(b.L); f.M = any(b.M); f.H = any(b.H); f.S = any(b.S); f.G = any(b.G); f.D = any(b.D);
  return f;
}

/** Standard gamepad mapping: A=Light, X=Medium, Y=Heavy, B=Special, LB=Grab, RB=Dash. */
export function readGamepad(index: number | 'any'): InputFrame {
  const f = emptyInput();
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[] : [];
  const list = index === 'any' ? pads : pads.filter(p => p.index === index);
  for (const p of list) {
    const b = (i: number) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
    f.left ||= b(14) || ax < -0.4; f.right ||= b(15) || ax > 0.4; f.up ||= b(12) || ay < -0.5; f.down ||= b(13) || ay > 0.5;
    f.L ||= b(0); f.S ||= b(1); f.M ||= b(2); f.H ||= b(3); f.G ||= b(4); f.D ||= b(5);
    if (b(6)) { f.S = true; f.H = true; } // LT = super shortcut
  }
  return f;
}
export function gamepadPausePressed(index: number | 'any') {
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[] : [];
  return pads.some(p => (index === 'any' || p.index === index) && p.buttons[9]?.pressed);
}

export function merge(...frames: InputFrame[]): InputFrame {
  const out = emptyInput();
  for (const f of frames) for (const k of Object.keys(out) as (keyof InputFrame)[]) out[k] ||= f[k];
  return out;
}

export function keyLabel(code: string): string {
  if (!code) return '—';
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num').replace('Arrow', '').replace('Bracket', '').replace('Semicolon', ';').replace('Quote', "'").replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Backspace', 'Bksp').replace('Escape', 'Esc');
}
