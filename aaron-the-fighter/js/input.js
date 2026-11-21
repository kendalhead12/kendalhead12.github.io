'use strict';
// ============================================================
//  Input: keyboard, touch, gamepad -> abstract actions
// ============================================================
(function () {
  const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'attack', 'special', 'dash', 'pause', 'confirm', 'back'];
  const KEYMAP = {
    ArrowLeft: ['left'], ArrowRight: ['right'], ArrowUp: ['up'], ArrowDown: ['down'],
    KeyA: ['left'], KeyD: ['right'], KeyW: ['up'], KeyS: ['down'],
    Space: ['jump', 'confirm'], KeyZ: ['jump'], KeyJ: ['attack', 'confirm'], KeyX: ['attack'],
    KeyK: ['special', 'back'], KeyC: ['special'], ShiftLeft: ['dash'], ShiftRight: ['dash'], KeyL: ['dash'],
    Enter: ['pause', 'confirm'], NumpadEnter: ['pause', 'confirm'], Escape: ['pause', 'back'], Backspace: ['back'], KeyP: ['pause']
  };
  const I = AF.Input = {
    down: {}, pressed: {}, released: {}, _raw: {}, _touch: {}, _pad: {}, _latch: {}, lastDevice: 'key', anyPressed: false,
    _prev: {}
  };
  for (const a of ACTIONS) { I.down[a] = false; I.pressed[a] = false; I.released[a] = false; I._raw[a] = 0; I._touch[a] = false; I._pad[a] = false; I._prev[a] = false; }
  const keyDown = new Set();
  function recompute() {
    for (const a of ACTIONS) I._raw[a] = 0;
    keyDown.forEach(code => { const m = KEYMAP[code]; if (m) for (const a of m) I._raw[a] = 1; });
  }
  window.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) e.preventDefault();
    if (e.repeat) return;
    keyDown.add(e.code); recompute(); I.lastDevice = 'key';
    const m = KEYMAP[e.code]; if (m) for (const a of m) I._latch[a] = true;
    if (AF.Audio) AF.Audio.unlock();
  });
  window.addEventListener('keyup', e => { keyDown.delete(e.code); recompute(); });
  window.addEventListener('blur', () => { keyDown.clear(); recompute(); for (const a of ACTIONS) I._touch[a] = false; });

  // called once per fixed update
  I.update = function () {
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const a of ACTIONS) I._pad[a] = false;
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -.4 || b(14)) I._pad.left = true;
      if (ax > .4 || b(15)) I._pad.right = true;
      if (ay < -.5 || b(12)) I._pad.up = true;
      if (ay > .5 || b(13)) I._pad.down = true;
      if (b(0)) { I._pad.jump = true; I._pad.confirm = true; }
      if (b(2)) I._pad.attack = true;
      if (b(1)) { I._pad.special = true; I._pad.back = true; }
      if (b(3) || b(5) || b(4)) I._pad.dash = true;
      if (b(9)) I._pad.pause = true;
      if (b(8)) I._pad.back = true;
    }
    I.anyPressed = false;
    for (const a of ACTIONS) {
      const d = !!(I._raw[a] || I._touch[a] || I._pad[a] || I._latch[a]);
      I._latch[a] = false;
      I.pressed[a] = d && !I._prev[a];
      I.released[a] = !d && I._prev[a];
      I.down[a] = d;
      I._prev[a] = d;
      if (I.pressed[a]) I.anyPressed = true;
    }
    if (I._tapConfirm) { I._tapConfirm = 0; I.pressed.confirm = true; I.tapped = true; I.anyPressed = true; } else I.tapped = false;
  };
  I.clear = function () { for (const a of ACTIONS) { I.pressed[a] = false; } };
  I.dirX = () => (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0);
  I.dirY = () => (I.down.down ? 1 : 0) - (I.down.up ? 1 : 0);

  // ---------------- Touch controls ----------------
  I.setupTouch = function () {
    const root = document.getElementById('touch');
    const dpad = document.getElementById('dpad'), knob = document.getElementById('dpad-knob');
    let dpadId = null;
    function setDir(t) {
      const r = dpad.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const len = Math.hypot(dx, dy), max = r.width * .32;
      const dead = r.width * .12;
      I._touch.left = I._touch.right = I._touch.up = I._touch.down = false;
      if (len > dead) {
        const ang = Math.atan2(dy, dx);
        const oct = Math.round(ang / (Math.PI / 4));
        const dirs = { 0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['left', 'down'], 4: ['left'], '-4': ['left'], '-3': ['left', 'up'], '-2': ['up'], '-1': ['right', 'up'] };
        for (const a of dirs[oct] || []) I._touch[a] = true;
      }
      const k = Math.min(len, max) / (len || 1);
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
    function clearDir() { I._touch.left = I._touch.right = I._touch.up = I._touch.down = false; knob.style.transform = ''; dpadId = null; }
    dpad.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; dpadId = t.identifier; setDir(t); AF.Audio.unlock(); I.lastDevice = 'touch'; }, { passive: false });
    dpad.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === dpadId) setDir(t); }, { passive: false });
    const endD = e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === dpadId) clearDir(); };
    dpad.addEventListener('touchend', endD, { passive: false }); dpad.addEventListener('touchcancel', endD, { passive: false });
    root.querySelectorAll('.tbtn').forEach(el => {
      const act = el.dataset.a;
      const set = v => {
        el.classList.toggle('on', v);
        I._touch[act] = v;
        if (act === 'jump') I._touch.confirm = v;
        if (act === 'special') I._touch.back = v;
        if (v) { I._latch[act] = true; if (act === 'jump') I._latch.confirm = true; if (act === 'special') I._latch.back = true; }
      };
      el.addEventListener('touchstart', e => { e.preventDefault(); set(true); AF.Audio.unlock(); I.lastDevice = 'touch'; }, { passive: false });
      el.addEventListener('touchend', e => { e.preventDefault(); set(false); }, { passive: false });
      el.addEventListener('touchcancel', e => { e.preventDefault(); set(false); }, { passive: false });
      el.addEventListener('mousedown', e => { e.preventDefault(); set(true); });
      el.addEventListener('mouseup', e => { e.preventDefault(); set(false); });
      el.addEventListener('mouseleave', () => set(false));
    });
    // tapping the game screen acts as confirm in menus
    const scr = document.getElementById('screen');
    scr.addEventListener('touchstart', e => { AF.Audio.unlock(); I.lastDevice = 'touch'; AF.updateTouchVisibility(); I._tapConfirm = 2; }, { passive: true });
    window.addEventListener('touchstart', () => { if (I.lastDevice !== 'touch') { I.lastDevice = 'touch'; AF.updateTouchVisibility(); } }, { passive: true });
  };
  I.isTouchDevice = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  AF.updateTouchVisibility = function () {
    const el = document.getElementById('touch');
    if (!el) return;
    const mode = AF.opts ? AF.opts.touch : 'auto';
    const on = mode === 'on' || (mode === 'auto' && (I.lastDevice === 'touch' || (I.isTouchDevice() && matchMedia('(pointer:coarse)').matches)));
    el.classList.toggle('off', !on);
    AF.touchOn = on;
    if (AF.resize) AF.resize();
  };
})();
