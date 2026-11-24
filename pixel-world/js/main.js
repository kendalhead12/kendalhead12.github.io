// Pixel World — boot & main loop (simulation updates are decoupled from rendering).
(function () {
'use strict';
const PW = globalThis.PW; const S = PW.S, R = PW.R, UI = PW.UI, Tools = PW.Tools, Save = PW.Save;
let last = performance.now() / 1000, acc = 0;

function frame(t) {
  const now = t / 1000; const dt = Math.min(0.1, Math.max(0, now - last)); last = now;
  const speed = UI.state.speed;
  try {
    if (UI.state.tl) UI.tlUpdate(dt);
    else if (speed > 0 && S.st) {
      const dy = dt * S.YPS * speed; acc += dy; S.realtime(dy);
      const t0 = performance.now(); let n = 0;
      while (acc >= 1 && n < 6 && performance.now() - t0 < 28) { S.tick(); acc -= 1; n++; }
      if (acc > 2) acc = 2;
    }
    R.simSpeed = UI.state.tl ? 0 : speed;
    R.draw(dt, now);
    UI.frame(now);
  } catch (err) {
    console.error(err);
    if (!frame.warned) { frame.warned = true; UI.toast('Something went wrong: ' + err.message, { kind: 'warn' }); }
  }
  requestAnimationFrame(frame);
}

function boot() {
  R.init(document.getElementById('view'), document.getElementById('minimap'));
  Tools.init(document.getElementById('view'));
  UI.init();
  // a living demo world behind the welcome screen
  UI.newWorld({ name: 'Terra Nova', mode: 'random', W: 288, H: 192, seed: Math.floor(Math.random() * 1e9), land: 0.42, islands: 0.4, tribes: 8 });
  UI.setSpeed(5);
  const showWelcome = (auto) => UI.openNew({ auto });
  Save.list().then(items => showWelcome(items.find(m => m.auto) || null)).catch(() => showWelcome(null));
  window.addEventListener('beforeunload', () => { if (UI.cfg.autosave && S.st && S.st.year > 0) UI.saveTo('auto_' + UI.state.id, UI.state.name, true); });
  requestAnimationFrame(frame);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
