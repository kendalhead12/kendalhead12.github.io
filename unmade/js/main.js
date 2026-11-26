'use strict';
// ============================================================
//  Boot, main loop, scaling, game flow
// ============================================================
(function () {
  const ctx = U.ctx;
  // ---------------- game flow ----------------
  const G = U.Game = {};
  G.newGame = function (name) {
    U.State.loadMeta();
    U.State.newRun(name);
    U.Prologue.start();
  };
  G.resetGame = function () {
    U.State.reset();
    U.Prologue.start();
  };
  G.enterWorkshop = function () {
    U.scene = U.World;
    U.World.load('ws_lab', [4, 10], 'up');
    U.Script.run(U.Rooms.ws_lab.enter(U.World, U.State));
  };
  G.continueGame = function () {
    if (!U.State.load()) { U.Title.start(); return; }
    const r = U.State.run;
    U.Script.stop(); U.Menus.stack.length = 0;
    U.scene = U.World;
    U.FX.fade = 1;
    U.World.load(r.room, r.x ? { x: r.x, y: r.y } : null, r.dir || 'down');
    U.Script.run((function* () { yield U.FX.fadeTo(0, 24); })());
  };
  G.retry = function () {
    if (U.State.hasSave()) { G.continueGame(); return; }
    const name = U.State.run ? U.State.run.name : 'BLANK';
    U.State.newRun(name);
    G.enterWorkshop();
  };

  // ---------------- scaling ----------------
  U.resize = function () {
    const vw = window.innerWidth, vh = window.innerHeight;
    const touch = document.body.classList.contains('touching');
    const portrait = vh > vw;
    let aw = vw, ah = vh;
    if (touch && portrait) ah = vh - Math.min(260, vh * .38);
    let s = Math.min(aw / U.W, ah / U.H);
    if (s > 2) s = Math.floor(s * 4) / 4;
    s = Math.max(.5, s);
    U.canvas.style.width = Math.round(U.W * s) + 'px';
    U.canvas.style.height = Math.round(U.H * s) + 'px';
    document.getElementById('game').classList.toggle('top', touch && portrait);
  };
  window.addEventListener('resize', U.resize);
  window.addEventListener('orientationchange', () => setTimeout(U.resize, 250));

  // ---------------- loop ----------------
  function tick() {
    U.frame++;
    U.Input.update();
    if (U.Menus.active) U.Menus.update();
    if (U.scene && U.scene.update) U.scene.update();
    U.Script.update();
    U.Dlg.update();
    U.FX.update();
    if (U.State.run && (U.scene === U.World || U.scene === U.Battle)) U.State.run.time += 1 / 60;
  }
  function render() {
    if (U.scene && U.scene.draw) U.scene.draw(ctx);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, U.W, U.H); }
    U.Dlg.draw(ctx);
    U.Menus.draw(ctx);
    U.FX.drawPost(ctx);
    if (U.debug) {
      if (U.errors.length) { ctx.fillStyle = '#800'; ctx.fillRect(0, 0, U.W, 10); U.Font.draw(ctx, U.errors[U.errors.length - 1].split('\n')[0].slice(0, 52), 2, 1, '#fff'); }
      if (U.scene === U.World && U.World.player) U.Font.draw(ctx, U.World.id + ' ' + Math.floor(U.World.player.x / 16) + ',' + Math.floor(U.World.player.y / 16), 2, 230, '#0f0');
    }
  }
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(120, now - last); last = now;
    let n = 0;
    while (acc >= STEP && n < 5) { acc -= STEP; n++; try { tick(); } catch (e) { U.reportErr(e); } }
    if (acc > STEP * 5) acc = 0;
    try { render(); } catch (e) { U.reportErr(e); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('error', e => U.errors.push(String(e.message)));

  // ---------------- boot ----------------
  function boot() {
    U.loadOpts();
    U.State.loadMeta();
    U.Input.setupTouch();
    U.Input.refreshTouch();
    U.resize();
    const q = U.params;
    if (q.has('room')) {
      // debug: jump straight into a room with a test run
      U.Title.unlocked = true;
      U.State.newRun(q.get('name') || 'TEST');
      (q.get('flags') || '').split(',').filter(Boolean).forEach(f => U.State.flag(f, true));
      if (q.has('geno')) { const r = U.State.run; r.kills = 30; r.areas.hall.kills = 12; r.areas.hall.visited = true; r.bosses.exqueen = 'killed'; r.weapon = 'hands'; r.lv = 6; r.hp = U.State.maxhp(); U.State.flag('leftHall', true); }
      U.scene = U.World;
      const at = q.get('at') ? q.get('at').split(',').map(Number) : null;
      U.World.load(q.get('room'), at, 'down');
      if (U.Rooms[q.get('room')].enter && !q.has('noenter')) U.Script.run(U.Rooms[q.get('room')].enter(U.World, U.State));
    } else if (q.has('battle')) {
      U.Title.unlocked = true;
      U.State.newRun('TEST');
      U.scene = U.World; U.World.load('frost_path', [10, 6]);
      U.Script.run((function* () { yield U.Battle.start({ enemies: q.get('battle').split(','), area: 'frost' }); })());
    } else U.Title.start();
    requestAnimationFrame(frame);
  }
  U.boot = boot;
  boot();
})();
