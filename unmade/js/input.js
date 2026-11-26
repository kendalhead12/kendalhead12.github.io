'use strict';
// ============================================================
//  Input: keyboard, touch, gamepad -> abstract actions
// ============================================================
(function () {
  const ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'pause'];
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyZ: 'confirm', Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm',
    KeyX: 'cancel', ShiftLeft: 'cancel', ShiftRight: 'cancel', Backspace: 'cancel',
    KeyC: 'menu', ControlLeft: 'menu', ControlRight: 'menu',
    Escape: 'pause', KeyP: 'pause',
  };
  const I = U.Input = { down: {}, pressed: {}, released: {}, typed: [], anyPressed: false, touchSeen: false, rep: {} };
  const raw = {}, touch = {}, pad = {}, latch = {}, prev = {};
  ACTIONS.forEach(a => { I.down[a] = I.pressed[a] = I.released[a] = false; raw[a] = touch[a] = pad[a] = latch[a] = prev[a] = false; I.rep[a] = 0; });
  const keys = new Set();
  function recompute() { ACTIONS.forEach(a => raw[a] = false); keys.forEach(k => { const a = KEYMAP[k]; if (a) raw[a] = true; }); }

  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    if (a || e.code === 'Tab') e.preventDefault();
    if (U.Audio) U.Audio.unlock();
    // name entry: letters type, Enter finishes, Backspace deletes (no action mapping)
    if (I.textMode && !e.ctrlKey && !e.metaKey && (e.code.startsWith('Key') || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Backspace')) {
      if (e.code === 'Backspace') I.typed.push('\b');
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat) I.typed.push('\n'); }
      else if (e.key && e.key.length === 1) I.typed.push(e.key);
      return;
    }
    if (e.repeat) return;
    keys.add(e.code); recompute();
    if (a) latch[a] = true;
    if (e.code === 'KeyF' && e.altKey === false && U.params.has('debug')) { /* reserved */ }
  });
  window.addEventListener('keyup', e => { keys.delete(e.code); recompute(); });
  window.addEventListener('blur', () => { keys.clear(); recompute(); ACTIONS.forEach(a => touch[a] = false); });

  I.update = function () {
    ACTIONS.forEach(a => pad[a] = false);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -.45 || b(14)) pad.left = true;
      if (ax > .45 || b(15)) pad.right = true;
      if (ay < -.45 || b(12)) pad.up = true;
      if (ay > .45 || b(13)) pad.down = true;
      if (b(0)) pad.confirm = true;
      if (b(1)) pad.cancel = true;
      if (b(2) || b(3)) pad.menu = true;
      if (b(9)) pad.pause = true;
    }
    I.anyPressed = false;
    ACTIONS.forEach(a => {
      const d = !!(raw[a] || touch[a] || pad[a] || latch[a]);
      latch[a] = false;
      I.pressed[a] = d && !prev[a];
      I.released[a] = !d && prev[a];
      I.down[a] = d || raw[a] || touch[a] || pad[a];
      prev[a] = I.down[a];
      if (I.pressed[a]) I.anyPressed = true;
      I.rep[a] = I.down[a] ? I.rep[a] + 1 : 0;
    });
  };
  // pressed with auto-repeat (menus)
  I.tap = a => I.pressed[a] || (I.rep[a] > 18 && I.rep[a] % 5 === 0);
  I.eat = function () { ACTIONS.forEach(a => { I.pressed[a] = false; }); I.anyPressed = false; };
  I.axis = function () {
    let x = 0, y = 0;
    if (I.down.left) x -= 1; if (I.down.right) x += 1;
    if (I.down.up) y -= 1; if (I.down.down) y += 1;
    return { x, y };
  };

  // ---------------- touch controls ----------------
  I.setupTouch = function () {
    const root = document.getElementById('touch');
    const dp = document.getElementById('dpad');
    const knob = document.getElementById('knob');
    let dpId = null;
    function setDir(cx, cy) {
      const r = dp.getBoundingClientRect();
      const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy), dead = r.width * 0.14;
      touch.left = touch.right = touch.up = touch.down = false;
      if (m > dead) {
        const ang = Math.atan2(dy, dx);
        const oct = Math.round(ang / (Math.PI / 4));
        const o = (oct + 8) % 8; // 0=right,1=down-right,2=down,...
        if (o === 0 || o === 1 || o === 7) touch.right = true;
        if (o === 3 || o === 4 || o === 5) touch.left = true;
        if (o === 1 || o === 2 || o === 3) touch.down = true;
        if (o === 5 || o === 6 || o === 7) touch.up = true;
      }
      const k = Math.min(m, r.width * .32) / (m || 1);
      knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    }
    function clearDir() { touch.left = touch.right = touch.up = touch.down = false; knob.style.transform = ''; }
    dp.addEventListener('pointerdown', e => { e.preventDefault(); dpId = e.pointerId; try { dp.setPointerCapture(e.pointerId); } catch (_) { /* */ } setDir(e.clientX, e.clientY); if (U.Audio) U.Audio.unlock(); });
    dp.addEventListener('pointermove', e => { if (e.pointerId === dpId) { e.preventDefault(); setDir(e.clientX, e.clientY); } });
    const endDp = e => { if (e.pointerId === dpId) { dpId = null; clearDir(); } };
    dp.addEventListener('pointerup', endDp); dp.addEventListener('pointercancel', endDp); dp.addEventListener('lostpointercapture', endDp);
    document.querySelectorAll('.tb').forEach(el => {
      const a = el.dataset.a;
      const on = e => { e.preventDefault(); touch[a] = true; latch[a] = true; el.classList.add('on'); if (U.Audio) U.Audio.unlock(); try { el.setPointerCapture(e.pointerId); } catch (_) { /* */ } };
      const off = e => { touch[a] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    });
    window.addEventListener('touchstart', () => { if (!I.touchSeen) { I.touchSeen = true; I.refreshTouch(); } }, { passive: true });
    root.addEventListener('contextmenu', e => e.preventDefault());
  };
  I.touchVisible = function () {
    const m = U.opts.touch;
    if (m === 'on') return true;
    if (m === 'off') return false;
    return I.touchSeen || ('ontouchstart' in window && navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
  };
  I.refreshTouch = function () {
    const on = I.touchVisible();
    document.getElementById('touch').classList.toggle('hidden', !on);
    document.body.classList.toggle('touching', on);
    if (U.resize) U.resize();
  };
})();
