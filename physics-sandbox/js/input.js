// Keyboard / mouse state and pointer lock.
export const keys = {};
export const mouse = { left: false, right: false, dx: 0, dy: 0 };
const handlers = { keydown: [], keyup: [], mousedown: [], mouseup: [], wheel: [], move: [], lockchange: [] };
export function on(evt, fn) { handlers[evt].push(fn); }
let canvas = null;
export function isLocked() { return document.pointerLockElement === canvas; }
export function lock() { if (canvas && !isLocked()) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} } }
export function unlock() { if (isLocked()) document.exitPointerLock(); }

export function initInput(el) {
  canvas = el;
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') && e.code !== 'Escape') return;
    if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
    const first = !keys[e.code];
    keys[e.code] = true;
    handlers.keydown.forEach(f => f(e, first));
  });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; handlers.keyup.forEach(f => f(e)); });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.left = mouse.right = false; });
  el.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.left = true; if (e.button === 2) mouse.right = true;
    handlers.mousedown.forEach(f => f(e));
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false; if (e.button === 2) mouse.right = false;
    handlers.mouseup.forEach(f => f(e));
  });
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('wheel', (e) => { if (isLocked()) handlers.wheel.forEach(f => f(e)); }, { passive: true });
  document.addEventListener('mousemove', (e) => { if (isLocked()) handlers.move.forEach(f => f(e.movementX, e.movementY)); });
  document.addEventListener('pointerlockchange', () => handlers.lockchange.forEach(f => f(isLocked())));
}
