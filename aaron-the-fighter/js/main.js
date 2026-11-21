'use strict';
// ============================================================
//  Boot, main loop, scene transitions, scaling
// ============================================================
(function () {
  const cv = document.getElementById('screen');
  const ctx = cv.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  AF.ctx = ctx;
  let scene = null, trans = null;

  AF.go = function (next, type) {
    if (trans && trans.phase === 'out') { trans.next = next; return; }
    trans = { type: type || 'fade', t: 0, phase: 'out', next, dur: type === 'iris' ? 26 : 16 };
  };
  AF.setScene = function (s) { scene = s; AF.scene = s; };
  function drawTrans() {
    if (!trans) return;
    const k = trans.phase === 'out' ? trans.t / trans.dur : 1 - trans.t / trans.dur;
    if (trans.type === 'iris') {
      const r = (1 - AF.clamp(k, 0, 1)) * 160;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.rect(0, 0, AF.W, AF.H); ctx.arc(AF.W / 2, AF.H / 2, Math.max(0, r), 0, Math.PI * 2, true); ctx.fill('evenodd');
      if (r < 40 && r > 2) { ctx.strokeStyle = '#ffe060'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(AF.W / 2, AF.H / 2, r, 0, 7); ctx.stroke(); }
    } else {
      // dithered GBA-style fade
      ctx.globalAlpha = AF.clamp(k, 0, 1); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1;
    }
  }
  function stepTrans() {
    if (!trans) return;
    trans.t++;
    if (trans.phase === 'out' && trans.t >= trans.dur) {
      trans.phase = 'in'; trans.t = 0;
      try { AF.setScene(typeof trans.next === 'function' ? trans.next() : trans.next); } catch (e) { reportErr(e); }
      AF.Input.clear();
    } else if (trans.phase === 'in' && trans.t >= trans.dur) trans = null;
  }

  // ---------------- scaling ----------------
  AF.resize = function () {
    const vw = window.innerWidth, vh = window.innerHeight;
    const wrap = document.getElementById('wrap');
    const portrait = vh > vw;
    let availH = vh, availW = vw;
    if (AF.touchOn && portrait) { availH = vh - 230; wrap.style.alignItems = 'flex-start'; wrap.style.paddingTop = '12px'; }
    else { wrap.style.alignItems = 'center'; wrap.style.paddingTop = '0'; }
    let s = Math.min(availW / AF.W, Math.max(1, availH) / AF.H);
    if (AF.opts && AF.opts.pixel) s = Math.max(1, Math.floor(s));
    s = Math.max(.5, s);
    cv.style.width = Math.round(AF.W * s) + 'px';
    cv.style.height = Math.round(AF.H * s) + 'px';
  };
  window.addEventListener('resize', AF.resize);
  window.addEventListener('orientationchange', () => setTimeout(AF.resize, 200));

  AF.buildSkins = function () { AF.SPR.aaron = AF.buildAaron(!!(AF.save && AF.save.altSkin)); };

  // ---------------- errors ----------------
  let lastErr = null;
  function reportErr(e) { lastErr = (e && e.message) || String(e); console.error(e); AF.errors = (AF.errors || []); AF.errors.push(lastErr + '\n' + (e && e.stack)); }

  // ---------------- loop ----------------
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    let n = 0;
    while (acc >= STEP && n < 4) {
      acc -= STEP; n++;
      AF.Input.update();
      try { if (!trans || trans.phase === 'in' || trans.t < 2) { if (scene) scene.update(); } } catch (e) { reportErr(e); }
      stepTrans();
      AF.tick++;
    }
    if (acc > STEP * 4) acc = 0;
    try { if (scene) scene.draw(ctx); } catch (e) { reportErr(e); }
    drawTrans();
    if (AF.opts.crt) { ctx.globalAlpha = .12; ctx.fillStyle = '#000'; for (let y = 1; y < AF.H; y += 2) ctx.fillRect(0, y, AF.W, 1); ctx.globalAlpha = 1; }
    if (lastErr && AF.debug) { ctx.fillStyle = '#800'; ctx.fillRect(0, 0, AF.W, 10); AF.text(ctx, lastErr.slice(0, 50), 2, 1, '#fff'); }
    requestAnimationFrame(frame);
  }

  // ---------------- boot ----------------
  function boot() {
    AF.loadSave();
    AF.initBigDigits();
    AF.buildMiscArt();
    AF.buildEnemyArt();
    AF.buildSkins();
    AF.Input.setupTouch();
    AF.updateTouchVisibility();
    AF.resize();
    const q = new URLSearchParams(location.search);
    AF.debug = q.has('debug');
    if (q.has('level')) {
      const [w, a] = q.get('level').split('-').map(Number);
      AF.save.started = true;
      if (q.has('all')) { AF.save.unlocked = 8; for (const k in AF.save.abilities) AF.save.abilities[k] = true; }
      AF.setScene(new AF.Play(w, a));
    } else AF.setScene(new AF.TitleScene());
    requestAnimationFrame(frame);
  }
  // test hook
  AF.debugStart = function (w, a, all) {
    if (all) { AF.save.unlocked = 8; for (const k in AF.save.abilities) AF.save.abilities[k] = true; }
    AF.save.started = true;
    AF.setScene(new AF.Play(w, a));
  };
  boot();
})();
