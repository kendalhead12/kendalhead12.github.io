'use strict';
// ============================================================
//  Dialogue boxes: portraits, typewriter, voices, choices
// ============================================================
(function () {
  // speaker id -> how they look/sound
  const SPK = {
    narr: { voice: 'narr', bullet: true },
    sun: { portrait: 'sun', voice: 'sun', voiceFor: e => (e === 'evil' || e === 'grin' || e === 'sly') ? 'sunevil' : 'sun' },
    exqueen: { portrait: 'exqueen', voice: 'exqueen' },
    calia: { portrait: 'calia', voice: 'calia' },
    sk: { portrait: 'sk', voice: 'sk' },
    fgd: { portrait: 'fgd', voice: 'fgd' },
    catty: { portrait: 'catty', voice: 'catty' },
    creator: { voice: 'creator', color: '#b8b8c8', creator: true },
    woolly: { voice: 'monster', bullet: true }, bearwell: { voice: 'old', bullet: true }, pip: { voice: 'kid', bullet: true },
    antler: { voice: 'old', bullet: true }, guard: { voice: 'monster', bullet: true }, monster: { voice: 'monster', bullet: true },
    sign: { voice: 'narr', bullet: true },
  };
  U.Speakers = SPK;
  const D = U.Dlg = { active: false, pages: [], idx: 0, typer: null, sel: 0, openFrame: -1, pos: 'bottom', cmd: null, hide: false };

  // Build pages from (speaker, ...lines). '@expr ' prefix switches portrait expression.
  function pagesFrom(speaker, lines) {
    let expr = null; const out = [];
    for (let ln of lines) {
      if (ln == null) continue;
      if (typeof ln === 'object') { out.push(ln); continue; }
      const m = /^@(\w+)\s*/.exec(ln);
      if (m) { expr = m[1]; ln = ln.slice(m[0].length); }
      if (ln.length) out.push({ speaker, expr, text: ln });
    }
    return out;
  }
  D.say = function (speaker, ...lines) {
    const pages = pagesFrom(speaker, lines.flat());
    return { start() { D.open(pages, this); }, update() { return this.done; } };
  };
  // one call, several speakers: D.talk(['sk','@happy Hi!'], ['fgd','hey'])
  D.talk = function (...parts) {
    const pages = [];
    parts.forEach(([sp, ...ls]) => pagesFrom(sp, ls.flat()).forEach(p => pages.push(p)));
    return { start() { D.open(pages, this); }, update() { return this.done; } };
  };
  D.ask = function (speaker, text, options, expr) {
    const pages = pagesFrom(speaker, [(expr ? '@' + expr + ' ' : '') + text]);
    pages[pages.length - 1].choices = options;
    return { start() { D.open(pages, this); }, update() { return this.done; } };
  };
  D.open = function (pages, cmd) {
    if (!pages.length) { if (cmd) { cmd.done = true; cmd.value = -1; } return; }
    D.pages = pages; D.idx = 0; D.cmd = cmd; D.active = true; D.openFrame = U.frame; D.hide = false;
    const P = U.World && U.World.player;
    D.pos = (U.scene === U.World && P && !U.World.camLock && P.y - U.World.cam.y > 150) ? 'top' : 'bottom';
    D.startPage();
  };
  D.close = function (value) {
    D.active = false; D.typer = null;
    if (D.cmd) { D.cmd.value = value; D.cmd.done = true; D.cmd = null; }
    U.Input.eat();
  };
  D.cur = () => D.pages[D.idx];
  D.startPage = function () {
    const pg = D.cur(), spk = SPK[pg.speaker] || SPK.narr;
    const hasPortrait = !!spk.portrait && pg.portrait !== false;
    const voice = spk.voiceFor ? spk.voiceFor(pg.expr) : spk.voice;
    D.typer = new U.Typer(pg.text, { voice, maxChars: hasPortrait ? 36 : 46, bullet: !!spk.bullet, color: spk.color || '#fff', speed: pg.speed });
    if (spk.creator) D.typer.lines.forEach(l => l.forEach(t => t.creator = true));
    D.sel = 0;
  };
  D.update = function () {
    if (!D.active) return;
    const I = U.Input, t = D.typer;
    t.update();
    if (U.frame === D.openFrame) return;
    const pg = D.cur();
    if (pg.choices && t.done) {
      const n = pg.choices.length;
      if (n <= 2) { if (I.pressed.left || I.pressed.up) { D.sel = 0; U.Audio.sfx('move'); } if (I.pressed.right || I.pressed.down) { D.sel = n - 1; U.Audio.sfx('move'); } }
      else {
        if (I.tap('up')) { D.sel = (D.sel + n - 1) % n; U.Audio.sfx('move'); }
        if (I.tap('down')) { D.sel = (D.sel + 1) % n; U.Audio.sfx('move'); }
        if (I.pressed.left && D.sel >= 2) { D.sel -= 2; U.Audio.sfx('move'); }
        if (I.pressed.right && D.sel + 2 < n) { D.sel += 2; U.Audio.sfx('move'); }
      }
      if (I.pressed.confirm) { U.Audio.sfx('select'); D.close(D.sel); }
      return;
    }
    if (I.pressed.cancel && !t.done) { t.skip(); return; }
    if (I.pressed.confirm) {
      if (!t.done) { t.skip(); return; }
      if (D.idx < D.pages.length - 1) { D.idx++; D.startPage(); }
      else D.close(-1);
    }
  };
  D.draw = function (ctx) {
    if (!D.active || D.hide) return;
    const pg = D.cur(), spk = SPK[pg.speaker] || SPK.narr;
    const bx = 8, bw = 304, bh = 72, by = D.pos === 'top' ? 6 : U.H - bh - 6;
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#000'; ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
    let tx = bx + 12;
    if (spk.portrait && pg.portrait !== false) {
      const talking = !D.typer.done && (U.frame >> 3) % 2 === 0;
      let por;
      if (spk.portrait === 'sun') por = U.Chars.portrait('sun', pg.expr || 'happy', talking);
      else por = U.Chars.portrait(spk.portrait, pg.expr, talking);
      if (por) {
        const shake = (pg.expr === 'scared' || pg.shake) ? U.randi(-1, 1) : 0;
        ctx.drawImage(por, bx + 8 + shake, by + 8, Math.min(60, por.width), Math.min(56, por.height));
      }
      tx = bx + 76;
    }
    D.typer.draw(ctx, tx, by + 12);
    if (pg.choices && D.typer.done) {
      const n = pg.choices.length;
      const soul = U.Chars.soul();
      ctx.save();
      for (let i = 0; i < n; i++) {
        let cx, cy;
        if (n <= 2) { cx = tx + 14 + i * 110; cy = by + bh - 20; }
        else { cx = tx + 14 + Math.floor(i / 2) * 110; cy = by + bh - 30 + (i % 2) * 13; }
        U.Font.draw(ctx, pg.choices[i], cx, cy, i === D.sel ? '#ffe23a' : '#fff');
        if (i === D.sel) ctx.drawImage(soul, cx - 12, cy - 1);
      }
      ctx.restore();
    }
  };
})();
