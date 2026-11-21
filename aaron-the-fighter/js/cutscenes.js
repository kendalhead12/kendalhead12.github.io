'use strict';
// ============================================================
//  Cutscenes: intro, post-boss transmissions, final, ending
// ============================================================
(function () {
  const I = AF.Input;
  const A = (text, mood) => ({ who: 'aaron', text, mood });
  const D = (text, mood, radio) => ({ who: 'achmed', text, mood, radio });
  const S = text => ({ who: 'sys', text });

  // ---------------- art ----------------
  let achBody = null;
  function achmedBody() {
    if (achBody) return achBody;
    const p = new AF.Pix(28, 44);
    p.rect(8, 34, 5, 10, '#303040'); p.rect(15, 34, 5, 10, '#303040'); p.rect(6, 42, 8, 2, '#101018'); p.rect(14, 42, 8, 2, '#101018');
    p.poly([[5, 16], [23, 16], [25, 38], [3, 38]], '#e8e8f0'); p.poly([[5, 16], [10, 16], [8, 38], [3, 38]], '#b8b8c8');
    p.rect(11, 16, 6, 18, '#6020a0'); p.rect(13, 18, 2, 2, '#ffd040');
    p.rect(2, 18, 4, 14, '#e8e8f0'); p.rect(22, 18, 4, 14, '#e8e8f0'); p.circ(4, 33, 2, '#e8b088'); p.circ(24, 33, 2, '#e8b088');
    p.ell(14, 9, 7, 8, '#e8b088'); p.ell(13, 6, 5, 4, '#f8c8a0');
    p.ell(6, 9, 2.5, 4, '#f0f0ff'); p.ell(22, 9, 2.5, 4, '#f0f0ff');
    p.rect(8, 4, 12, 3, '#403050'); p.set(10, 5, '#60e0ff'); p.set(17, 5, '#60e0ff');
    p.set(11, 9, '#ff2020'); p.set(16, 9, '#ff2020');
    p.rect(9, 12, 10, 2, '#f0f0ff'); p.rect(12, 14, 4, 1, '#601020');
    p.outline('#140a18');
    achBody = p.spr(14, 44);
    return achBody;
  }
  let critters = null;
  function getCritters() {
    if (critters) return critters;
    critters = [];
    const mk = (fn) => { const p = new AF.Pix(14, 14); fn(p); p.outline('#140a18'); critters.push(p.spr(7, 14)); };
    mk(p => { p.ell(7, 9, 5, 4, '#f0e8e0'); p.ell(10, 6, 3, 3, '#f0e8e0'); p.rect(9, 0, 1, 4, '#f0e8e0'); p.rect(11, 0, 1, 4, '#f0e8e0'); p.set(11, 6, '#101018'); });
    mk(p => { p.ell(7, 8, 5, 4, '#f0c030'); p.ell(10, 6, 3, 3, '#f0c030'); p.set(13, 6, '#ff8020'); p.set(11, 5, '#101018'); p.ell(5, 8, 3, 2, '#d0a020'); });
    mk(p => { p.ell(7, 9, 6, 4, '#60b0f0'); p.poly([[1, 9], [0, 6], [0, 12]], '#60b0f0'); p.set(11, 8, '#101018'); });
    mk(p => { p.ell(7, 9, 5, 5, '#a06030'); p.ell(7, 5, 4, 3, '#a06030'); p.set(5, 4, '#101018'); p.set(9, 4, '#101018'); p.rect(6, 7, 3, 1, '#ff8080'); });
    return critters;
  }

  // shot drawers
  function drawWorldScene(ctx, w, act, t, opts) {
    opts = opts || {};
    const bg = AF.getBG(w, act || 1);
    AF.drawBG(ctx, bg, (opts.scroll || 0) * t, 0, t, 0);
    const ts = AF.tileset(w);
    for (let x = -((opts.scroll || 0) * t % 16); x < AF.W; x += 16) { ctx.drawImage(ts.atlas, 13 * 16, 0, 16, 16, Math.round(x), 128, 16, 16); ctx.drawImage(ts.atlas, 15 * 16, 0, 16, 16, Math.round(x), 144, 16, 16); }
  }
  function drawMonitor(ctx, t, mood, glitch) {
    ctx.fillStyle = '#0a0a18'; ctx.fillRect(0, 0, AF.W, AF.H);
    for (let i = 0; i < 30; i++) { ctx.fillStyle = (i + (t >> 4)) % 7 === 0 ? '#30f0c0' : '#1a2a3a'; ctx.fillRect((i * 37) % AF.W, (i * 23) % 70, 3, 2); }
    ctx.fillStyle = '#000'; ctx.fillRect(58, 8, 124, 100); ctx.fillStyle = '#3a3a58'; ctx.fillRect(60, 10, 120, 96); ctx.fillStyle = '#100818'; ctx.fillRect(66, 16, 108, 84);
    if (!glitch || (t % 37) > 4) {
      const por = AF.portrait('achmed', mood || 'talk');
      ctx.drawImage(por, 0, 0, 40, 40, 90, 22, 60, 60);
    }
    ctx.globalAlpha = .2; ctx.fillStyle = '#c080ff'; for (let y = 16; y < 100; y += 3) ctx.fillRect(66, y + ((t >> 1) % 3), 108, 1); ctx.globalAlpha = 1;
    AF.text(ctx, 'INCOMING TRANSMISSION', AF.W / 2, 90, (t & 16) ? '#ff4080' : '#c02060', { a: 'c' });
  }

  // ---------------- Cutscene scene ----------------
  class Cutscene {
    constructor(shots, next) {
      this.shots = shots; this.next = next; this.i = -1; this.t = 0; this.done = false; this.dlg = null; this.q = [];
      this.advance();
    }
    advance() {
      this.i++; this.t = 0;
      if (this.i >= this.shots.length) { this.finish(); return; }
      const s = this.shots[this.i];
      if (s.music) AF.Audio.music(s.music);
      if (s.sfx) AF.Audio.sfx(s.sfx);
      this.q = (s.lines || []).slice(); this.dlg = null;
      if (this.q.length && !s.delay) this.nextLine();
    }
    finish() { if (this.done) return; this.done = true; AF.go(this.next(), 'fade'); }
    nextLine() {
      const l = this.q.shift();
      if (!l) { this.dlg = null; return false; }
      this.dlg = { line: l, chars: 0, t: 0 };
      if (l.who === 'achmed') AF.Audio.sfx('radio');
      return true;
    }
    update() {
      if (this.done) return;
      this.t++;
      const s = this.shots[this.i];
      if (I.pressed.pause) { this.finish(); return; }
      if (s.delay && this.t === s.delay && this.q.length) this.nextLine();
      if (s.sfxAt) for (const k in s.sfxAt) if (this.t === +k) AF.Audio.sfx(s.sfxAt[k]);
      if (this.dlg) {
        const d = this.dlg; d.t++;
        if (d.chars < d.line.text.length) { d.chars++; if (d.t % 3 === 0) AF.Audio.sfx(d.line.who === 'achmed' ? 'achtext' : 'text'); }
        if (I.pressed.confirm || I.pressed.jump || I.pressed.attack) { if (d.chars < d.line.text.length) d.chars = d.line.text.length; else if (!this.nextLine()) this.advance(); }
      } else if (!s.delay || this.t > s.delay) {
        if ((s.dur && this.t >= s.dur) || ((I.pressed.confirm || I.pressed.jump || I.pressed.attack) && this.t > 20 && !s.noskip)) this.advance();
      }
    }
    draw(ctx) {
      const s = this.shots[Math.min(this.i, this.shots.length - 1)];
      if (!s) return;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H);
      s.draw(ctx, this.t);
      if (s.fadeIn && this.t < s.fadeIn) { ctx.globalAlpha = 1 - this.t / s.fadeIn; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (s.fadeOut && s.dur && this.t > s.dur - s.fadeOut) { ctx.globalAlpha = Math.min(1, (this.t - (s.dur - s.fadeOut)) / s.fadeOut); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, AF.W, AF.H); ctx.globalAlpha = 1; }
      if (this.dlg) AF.drawDialog(ctx, this.dlg);
      if (s.caption) { const lines = AF.wrap(s.caption, 220); lines.forEach((l, i) => AF.text(ctx, l, AF.W / 2, 10 + i * 10, '#ffffff', { a: 'c' })); }
      AF.text(ctx, 'ENTER: SKIP', AF.W - 3, 2, '#606080', { a: 'r', o: null });
    }
  }
  AF.Cutscene = Cutscene;

  const aar = (ctx, pose, x, y, dir) => AF.drawSpr(ctx, AF.SPR.aaron[pose] || AF.SPR.aaron.idle0, x, y, dir || 1);

  AF.CUTS = {
    intro: () => [
      { music: 'cutscene', fadeIn: 30, draw: (c, t) => { drawWorldScene(c, 1, 1, t, { scroll: .3 }); for (let i = 0; i < 3; i++) AF.drawSpr(c, getCritters()[i], 60 + i * 50 + Math.sin(t * .05 + i) * 10, 128 - Math.abs(Math.sin(t * .1 + i)) * 6, 1); }, lines: [S('Once upon a time, the eight lands of this planet lived in peace...'), S('Lush forests. Sparkling seas. Snowy peaks and blazing volcanoes.')] },
      { draw: (c, t) => { drawWorldScene(c, 5, 1, t, { scroll: .5 }); for (let i = 0; i < 4; i++) AF.drawSpr(c, AF.SPR.en.secbot[(t >> 3) & 1], 40 + i * 48 + ((t * .5) % 48), 128, 1); }, lines: [S('But lately, strange machines have begun to appear everywhere.'), S('Critters turned into robots. Oceans humming with engines. Nobody knows why...')] },
      { draw: (c, t) => { drawWorldScene(c, 1, 1, t); aar(c, t < 60 ? 'idle0' : (t >> 5) & 1 ? 'talk' : 'idle0', 80, 128, 1); AF.drawSpr(c, AF.SPR.en.beetle[(t >> 3) & 1], 170 - Math.min(40, t * .3), 128, -1); }, lines: [A('Robot beetles? In MY favorite forest?', 'n'), A("Something weird is going on. Time to investigate!", 'grin'), S('And so, AARON THE FIGHTER sets off on his greatest adventure!')] }
    ],
    afterBoss: {
      1: () => [
        { music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'talk'), lines: [D('Bzzt... Is this thing on? AHEM.', 'talk'), D('So! You are the meddling boy who wrecked my Mechanical Treant!', 'angry'), D('Allow me to introduce myself: I am the brilliant DR. ACHMED!', 'laugh'), D('Every machine you see is part of my grand plan to conquer this planet!', 'laugh'), A("A bald guy with goggles is behind all this? Figures.", 'grin'), D("It's a FOREHEAD of GENIUS! Stay out of my way, boy!", 'mad')] }
      ],
      2: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'angry'), lines: [D('My Mecha-Shark! Do you know how much that cost?!', 'angry'), A('Less than a new hairstyle, I bet.', 'grin'), D('GRRR! The frozen peaks will be your tomb!', 'mad')] }],
      3: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'mad'), lines: [D('You melted my Cryo-Golem?! It was supposed to be UNMELTABLE!', 'mad'), A('Maybe add a little more ice next time.', 'grin'), D('Ha! Try surviving the heat of Magma Mountain!', 'laugh')] }],
      4: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'angry'), lines: [D('Magmabot was my hottest invention!', 'angry'), A("Looks like it cooled off.", 'grin'), D('Clockwork City is MY fortress. My Crusher-9000 will flatten you!', 'laugh')] }],
      5: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'mad'), lines: [D('My city! My beautiful mechanical city!', 'mad'), A('Your robots keep falling apart. Ever heard of quality control?', 'grin'), D('The ancient desert holds secrets you cannot imagine!', 'angry')] }],
      6: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'angry'), lines: [D('Scorpion-X... defeated by a boy with FINGERLESS GLOVES?!', 'angry'), A("Hey, they're stylish AND practical.", 'grin'), D("Very well. Come up to the sky islands... if you can fly!", 'laugh')] }],
      7: () => [{ music: 'cutscene', draw: (c, t) => drawMonitor(c, t, 'mad', true), lines: [D('Thunderwing too?! This is IMPOSSIBLE!', 'mad'), D('Fine! Come to my laboratory. I have been saving something SPECIAL for you.', 'laugh'), A("Finally. Let's end this, Achmed!", 'angry')] }],
      8: null
    },
    prefinal: () => [
      { music: 'cutscene', fadeIn: 20, draw: (c, t) => { drawWorldScene(c, 8, 3, t); aar(c, 'idle0', 60, 128, 1); AF.drawSpr(c, achmedBody(), 180, 128 + Math.sin(t * .1), -1); }, lines: [D('You have destroyed years of my research, Aaron! Do you have any idea what you\'ve done?!', 'angry', false), A('Yeah. Saved everyone a whole lot of trouble.', 'grin'), D('Then allow me to demonstrate my greatest invention!', 'laugh', false)] },
      { dur: 80, sfx: 'alarm', draw: (c, t) => { drawWorldScene(c, 8, 3, t); aar(c, 'idle0', 60, 128, 1); if (t < 40) AF.drawSpr(c, achmedBody(), 180, 128 - t, -1); c.globalAlpha = Math.min(1, t / 60); c.fillStyle = (t & 4) ? '#ffffff' : '#c040ff'; c.fillRect(0, 0, AF.W, AF.H); c.globalAlpha = 1; }, caption: 'ACHMED ACTIVATES HIS ULTIMATE MACHINE!' }
    ],
    ending: () => {
      const shots = [];
      shots.push({ music: 'final', dur: 150, sfxAt: { 1: 'bigexplode', 60: 'explode', 110: 'explode' }, draw: (c, t) => { const sx = AF.rr(-2, 2), sy = AF.rr(-2, 2); c.save(); c.translate(Math.round(sx), Math.round(sy)); drawWorldScene(c, 8, 3, t, { scroll: 2 }); for (let i = 0; i < 6; i++) { const x = (i * 47 + t * 3) % 260 - 10, y = (t * 2 + i * 29) % 140; AF.drawSpr(c, AF.SPR.debris, x, y, 1); } aar(c, 'run' + (Math.floor(t / 4) % 6), 40 + t * .8, 128, 1); c.restore(); }, caption: 'THE LABORATORY IS COLLAPSING!' });
      shots.push({ dur: 90, fadeOut: 30, sfxAt: { 40: 'bigexplode' }, draw: (c, t) => { drawWorldScene(c, 1, 3, t); aar(c, t < 40 ? 'jump' : 'land', 70 + Math.min(40, t), 128 - (t < 40 ? Math.sin(t / 40 * Math.PI) * 30 : 0), 1); if (t > 40) { c.globalAlpha = Math.max(0, 1 - (t - 40) / 30); c.fillStyle = '#ffffff'; c.fillRect(0, 0, AF.W, AF.H); c.globalAlpha = 1; } }, caption: 'Aaron escapes just in time!' });
      for (let w = 1; w <= 8; w++) {
        shots.push({ music: w === 1 ? 'ending' : undefined, dur: 120, fadeIn: 15, fadeOut: 15, draw: (c, t) => {
          drawWorldScene(c, w, w === 7 ? 1 : 1, t, { scroll: .6 });
          const cr = getCritters();
          for (let i = 0; i < 5; i++) AF.drawSpr(c, cr[(i + w) % cr.length], 30 + i * 44, 128 - Math.abs(Math.sin(t * .12 + i * 1.3)) * 14, i & 1 ? 1 : -1);
          AF.text(c, AF.WORLDS[w].name, AF.W / 2, 20, '#ffffff', { a: 'c' });
          AF.text(c, 'RESTORED!', AF.W / 2, 32, '#ffe060', { a: 'c' });
        } });
      }
      shots.push({ fadeIn: 40, music: 'ending', draw: (c, t) => {
        const p = new AF.Pix(1, 1); // sunset scene
        const bg = AF.getBG(1, 3); c.drawImage(bg.sky, 0, 0);
        c.fillStyle = '#ffb040'; c.beginPath(); c.arc(170, 96, 20, 0, 7); c.fill(); c.fillStyle = '#fff0a0'; c.beginPath(); c.arc(170, 96, 14, 0, 7); c.fill();
        c.fillStyle = '#3a2848'; c.beginPath(); c.moveTo(0, 160); c.lineTo(0, 120); c.quadraticCurveTo(70, 96, 140, 124); c.quadraticCurveTo(200, 136, 240, 126); c.lineTo(240, 160); c.fill();
        c.fillStyle = '#20182a'; c.beginPath(); c.moveTo(0, 160); c.lineTo(0, 134); c.quadraticCurveTo(60, 104, 120, 130); c.lineTo(120, 160); c.fill();
        AF.drawSpr(c, AF.SPR.aaron.idle0, 62, 113, 1);
      }, delay: 60, lines: [A('Well, that was one heck of an adventure.', 'grin')] });
      shots.push({ dur: 220, noskip: true, sfxAt: { 30: 'zap', 90: 'alarm', 150: 'alarm' }, draw: (c, t) => {
        c.fillStyle = '#05050a'; c.fillRect(0, 0, AF.W, AF.H);
        const on = t > 20 && ((t % 29) > 3 || t > 80);
        c.fillStyle = '#202030'; c.fillRect(60, 30, 120, 90); c.fillStyle = '#000'; c.fillRect(66, 36, 108, 72);
        c.fillStyle = '#404060'; c.fillRect(66, 60, 30, 2); c.fillRect(140, 40, 2, 40);
        if (on) {
          c.fillStyle = '#300010'; c.fillRect(66, 36, 108, 72);
          AF.text(c, 'PROJECT OMEGA:', AF.W / 2, 62, '#ff3060', { a: 'c' });
          if (t > 80) AF.text(c, 'BACKUP ACTIVATED.', AF.W / 2, 74, (t & 8) ? '#ff3060' : '#ff90a0', { a: 'c' });
          c.globalAlpha = .25; c.fillStyle = '#ff80a0'; for (let y = 36; y < 108; y += 3) c.fillRect(66, y + (t % 3), 108, 1); c.globalAlpha = 1;
        }
        if (t > 170) { c.globalAlpha = Math.min(1, (t - 170) / 40); c.fillStyle = '#000'; c.fillRect(0, 0, AF.W, AF.H); c.globalAlpha = 1; }
      } });
      return shots;
    }
  };
})();
