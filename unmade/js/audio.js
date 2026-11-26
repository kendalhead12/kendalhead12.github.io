'use strict';
// ============================================================
//  Audio: chiptune sequencer, synthesized SFX, dialogue voices
// ============================================================
(function () {
  const A = U.Audio = { ready: false, cur: null, curName: null, songs: {}, pending: null };
  let ctx, master, musicBus, sfxBus, echoIn, noiseBuf, waves = {};
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  A.midi = function (n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return null;
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  };
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  A.unlock = function () {
    if (A.ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    echoIn = ctx.createGain(); echoIn.gain.value = 1;
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    for (const duty of [0.125, 0.25]) {
      const n = 40, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) { re[k] = (2 / (k * Math.PI)) * Math.sin(2 * k * Math.PI * duty) * .5; im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * k * Math.PI * duty)) * .5; }
      waves[duty === .125 ? 'sq12' : 'sq25'] = ctx.createPeriodicWave(re, im);
    }
    A.ready = true;
    A.applyVolumes();
    setInterval(schedule, 25);
    if (A.pending) { const p = A.pending; A.pending = null; A.music(p.name, p.opts); }
  };
  A.applyVolumes = function () {
    if (!A.ready) return;
    musicBus.gain.setTargetAtTime(U.opts.music * 0.5, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(U.opts.sfx * 0.6, ctx.currentTime, 0.02);
  };

  function mkOsc(inst, f, t) {
    const o = ctx.createOscillator();
    if (inst === 'sq12' || inst === 'sq25') o.setPeriodicWave(waves[inst]);
    else if (inst === 'sq50' || inst === 'sq') o.type = 'square';
    else if (inst === 'tri') o.type = 'triangle';
    else if (inst === 'saw') o.type = 'sawtooth';
    else o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  // ---------------- music ----------------
  // Song: { bpm, ch:[{inst, vol, notes, oct, echo, env:'pluck'|'pad'|'sus', vib, det}], drums:'k . h s', dvol }
  // Notes tokens (one per 16th): C4 / Eb5 / A3+C4+E4 (chord), '-' hold, '.' rest, 'X*4' = X followed by 3 holds, '.*4' = 4 rests
  function expand(str) {
    const out = [];
    str.trim().split(/\s+/).forEach(tok => {
      if (!tok) return;
      const m = /^(.+)\*(\d+)$/.exec(tok);
      if (m) {
        const n = +m[2];
        if (m[1] === '.') for (let i = 0; i < n; i++) out.push('.');
        else { out.push(m[1]); for (let i = 1; i < n; i++) out.push('-'); }
      } else out.push(tok);
    });
    return out;
  }
  function compile(song) {
    if (song._c) return song;
    song._c = true;
    song.ch.forEach(ch => {
      const toks = expand(ch.notes);
      ch.steps = toks.map((t, i) => {
        if (t === '-' || t === '.') return null;
        let len = 1; while (toks[(i + len) % toks.length] === '-' && len < toks.length) len++;
        const ms = t.split('+').map(A.midi).filter(x => x != null);
        return { ms, len };
      });
    });
    if (song.drums) song.dsteps = expand(song.drums);
    return song;
  }
  A.define = function (name, song) { A.songs[name] = song; };

  function playNote(ch, m, t, dur, out, rate, semis) {
    const f = freq(m + (ch.oct || 0) * 12 + semis);
    const o = mkOsc(ch.inst, f, t);
    const g = ctx.createGain();
    const v = (ch.vol || .2);
    const env = ch.env || 'sus';
    g.gain.setValueAtTime(0.0001, t);
    if (env === 'pad') {
      g.gain.linearRampToValueAtTime(v, t + Math.min(.25, dur * .4));
      g.gain.setTargetAtTime(0.0001, t + dur * .85, .12);
    } else if (env === 'pluck') {
      g.gain.linearRampToValueAtTime(v, t + .005);
      g.gain.setTargetAtTime(v * .15, t + .01, Math.min(.12, dur * .3));
      g.gain.setTargetAtTime(0.0001, t + dur * .9, .03);
    } else if (env === 'bell') {
      g.gain.linearRampToValueAtTime(v, t + .004);
      g.gain.setTargetAtTime(0.0001, t + .01, .35);
    } else {
      g.gain.linearRampToValueAtTime(v, t + .006);
      g.gain.setTargetAtTime(v * .7, t + .01, .08);
      g.gain.setTargetAtTime(0.0001, t + dur - .015, .025);
    }
    if (ch.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = f * ch.vib; l.connect(lg); lg.connect(o.frequency); l.start(t + .12); l.stop(t + dur + .6); }
    if (ch.det) o.detune.setValueAtTime(ch.det, t);
    o.connect(g); g.connect(out);
    if (ch.echo) g.connect(echoIn);
    o.start(t); o.stop(t + dur + (env === 'bell' ? 1.5 : env === 'pad' ? .6 : .15));
  }
  function playDrum(k, t, vol, out) {
    if (k === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .12);
      g.gain.setValueAtTime(vol * 1.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .16);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + .2);
    } else {
      const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = k === 'h' ? 'highpass' : 'bandpass';
      f.frequency.value = k === 'h' ? 7000 : k === 't' ? 900 : 1800;
      const d = k === 'h' ? .04 : k === 'o' ? .18 : .12;
      g.gain.setValueAtTime(vol * (k === 'h' ? .35 : .8), t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * .5); s.stop(t + d + .02);
    }
  }
  function schedule() {
    const c = A.cur;
    if (!c || !A.ready) return;
    const song = c.song;
    const stepDur = 60 / (song.bpm * c.rate) / 4;
    const ahead = ctx.currentTime + 0.15;
    while (c.next < ahead) {
      const t = c.next, i = c.step;
      for (const ch of song.ch) {
        const st = ch.steps[i % ch.steps.length];
        if (st) for (const m of st.ms) playNote(ch, m, t, st.len * stepDur, c.gain, c.rate, c.semis);
      }
      if (song.dsteps) { const k = song.dsteps[i % song.dsteps.length]; if (k && k !== '.' && k !== '-') playDrum(k, t, song.dvol || .25, c.gain); }
      let sw = stepDur;
      if (song.swing) sw = stepDur * (i % 2 === 0 ? 1 + song.swing : 1 - song.swing);
      c.next += sw; c.step++;
    }
  }
  // opts: { rate, semis, fade }
  A.music = function (name, opts) {
    opts = opts || {};
    const key = name + '|' + (opts.rate || 1) + '|' + (opts.semis || 0);
    if (!A.ready) { A.pending = { name, opts }; A.curName = name; return; }
    if (A.cur && A.cur.key === key) return;
    A.stopMusic(opts.fade != null ? opts.fade : .25);
    A.curName = name;
    if (!name || !A.songs[name]) return;
    const song = compile(A.songs[name]);
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(musicBus);
    g.gain.setTargetAtTime(1, ctx.currentTime + .02, .05);
    A.cur = { key, name, song, gain: g, step: 0, next: ctx.currentTime + .06, rate: opts.rate || 1, semis: opts.semis || 0 };
  };
  A.stopMusic = function (fade) {
    if (!A.ready) { A.pending = null; A.curName = null; return; }
    if (A.cur) {
      const g = A.cur.gain; const f = fade == null ? .3 : fade;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, Math.max(.01, f / 4));
      setTimeout(() => { try { g.disconnect(); } catch (e) { /* */ } }, f * 1000 + 600);
    }
    A.cur = null; A.curName = null;
  };
  A.musicDuck = function (v, t) { if (A.ready && A.cur) A.cur.gain.gain.setTargetAtTime(v, ctx.currentTime, t || .1); };

  // ---------------- SFX ----------------
  function tone(type, f0, f1, dur, vol, t0, out) {
    const t = ctx.currentTime + (t0 || 0);
    const o = mkOsc(type, f0, t), g = ctx.createGain();
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(out || sfxBus); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol, filt, fq, t0, fq1) {
    const t = ctx.currentTime + (t0 || 0);
    const s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = filt || 'lowpass'; f.frequency.setValueAtTime(fq || 2000, t);
    if (fq1) f.frequency.exponentialRampToValueAtTime(fq1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * .4); s.stop(t + dur + .02);
  }
  const SFX = {
    move: () => tone('sq25', 880, 880, .04, .12),
    select: () => { tone('sq25', 660, 660, .05, .14); tone('sq25', 990, 990, .07, .12, .045); },
    back: () => tone('sq25', 440, 330, .07, .12),
    hurt: () => { tone('sq50', 300, 80, .18, .25); noise(.15, .25, 'lowpass', 1500); },
    hit: () => { noise(.18, .5, 'lowpass', 3000, 0, 300); tone('sine', 160, 50, .2, .5); },
    crit: () => { noise(.25, .6, 'lowpass', 5000, 0, 200); tone('sine', 200, 40, .3, .6); tone('sq25', 1200, 600, .15, .15); },
    miss: () => tone('tri', 500, 300, .15, .15),
    hands: () => { noise(.35, .5, 'bandpass', 300, 0, 2000); tone('saw', 70, 40, .4, .3); },
    clap: () => { noise(.3, .8, 'lowpass', 6000, 0, 200); tone('sine', 90, 30, .4, .7); },
    dust: () => { noise(.8, .25, 'highpass', 1500, 0, 6000); tone('sine', 600, 200, .6, .08); },
    spare: () => { for (let i = 0; i < 4; i++) tone('tri', 600 + i * 220, 600 + i * 220, .1, .12, i * .05); noise(.3, .12, 'highpass', 4000); },
    heal: () => { [523, 659, 784, 1046].forEach((f, i) => tone('sq25', f, f, .09, .12, i * .06)); },
    save: () => { [784, 988, 1175, 1568].forEach((f, i) => tone('tri', f, f, .2, .16, i * .07)); },
    alert: () => { tone('sq50', 1200, 1200, .06, .2); tone('sq50', 1600, 1600, .12, .2, .07); },
    battle: () => { tone('sq25', 220, 880, .25, .2); noise(.3, .2, 'highpass', 2000); },
    door: () => { noise(.2, .25, 'lowpass', 600); tone('tri', 200, 150, .15, .15); },
    solve: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone('sq25', f, f, .12, .13, i * .08)); },
    wrong: () => { tone('sq50', 200, 200, .12, .15); tone('sq50', 150, 150, .2, .15, .12); },
    slide: () => noise(.25, .12, 'highpass', 3000, 0, 8000),
    push: () => { noise(.15, .3, 'lowpass', 400); },
    switch: () => { tone('sq25', 500, 500, .04, .15); tone('sq25', 750, 750, .06, .15, .04); },
    glitch: () => { for (let i = 0; i < 6; i++) tone('sq50', U.rand(80, 1600), U.rand(80, 1600), .04, .12, i * .035); noise(.25, .2, 'bandpass', 1200); },
    shatter: () => { noise(.5, .5, 'highpass', 2500, 0, 800); for (let i = 0; i < 5; i++) tone('tri', U.rand(1500, 3000), 400, .2, .1, i * .03); },
    crack: () => { noise(.12, .6, 'highpass', 1800); tone('sq50', 300, 120, .1, .2); },
    magic: () => { tone('sine', 300, 1400, .35, .25); noise(.4, .2, 'bandpass', 1000, 0, 4000); },
    fire: () => noise(.4, .25, 'bandpass', 600, 0, 2000),
    sparkle: () => { [1568, 2093, 2637].forEach((f, i) => tone('sine', f, f, .12, .08, i * .05)); },
    item: () => { [659, 784, 1046].forEach((f, i) => tone('sq25', f, f, .1, .14, i * .07)); },
    levelup: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone('sq25', f, f, .1, .14, i * .07)); },
    bell: () => { tone('sine', 1320, 1320, 1.2, .15); tone('sine', 2640, 2640, .8, .05); },
    thud: () => { tone('sine', 110, 40, .25, .5); noise(.12, .3, 'lowpass', 500); },
    swoosh: () => noise(.25, .25, 'bandpass', 800, 0, 4000),
    teleport: () => { tone('sine', 1800, 200, .18, .15); noise(.1, .12, 'highpass', 5000); },
    snow: () => noise(.2, .18, 'lowpass', 2500, 0, 600),
    meow: () => { tone('saw', 700, 1100, .1, .08); tone('saw', 1100, 600, .2, .08, .1); },
    step: () => noise(.04, .05, 'lowpass', 900),
    laugh: () => { for (let i = 0; i < 5; i++) tone('sine', 1100 - i * 40, 950 - i * 40, .07, .12, i * .09); },
    wind: () => noise(1.6, .06, 'bandpass', 400, 0, 1200),
    hum: () => { tone('saw', 55, 60, 1.6, .12); tone('sine', 110, 120, 1.6, .1); },
    boom: () => { tone('sine', 80, 25, 1.2, .7); noise(1, .5, 'lowpass', 800, 0, 80); },
    chime: () => { [880, 1108, 1318].forEach((f, i) => tone('sine', f, f, .6, .1, i * .12)); },
    eat: () => { noise(.06, .2, 'lowpass', 1500); noise(.06, .2, 'lowpass', 1500, .1); },
    cash: () => { tone('sq25', 1400, 1400, .05, .12); tone('sq25', 2000, 2000, .12, .12, .05); },
    power: () => { tone('saw', 60, 600, 1.2, .2); noise(1.2, .2, 'bandpass', 200, 0, 3000); },
    beam: () => tone('sine', 1500, 2200, .1, .07),
    bounce: () => tone('sq25', 300, 600, .06, .1),
    bomb: () => { noise(.25, .35, 'lowpass', 2500, 0, 300); tone('sine', 220, 60, .15, .3); },
  };
  A.sfx = function (name) {
    if (!A.ready || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* ignore */ }
  };

  // ---------------- voices ----------------
  const VOICES = {
    narr: { w: 'sq12', f: 260, v: .07, d: .03, r: 0 },
    sun: { w: 'sine', f: 980, v: .14, d: .045, r: 120 },
    sunevil: { w: 'saw', f: 160, v: .07, d: .06, r: 40 },
    exqueen: { w: 'tri', f: 360, v: .2, d: .06, r: 25 },
    sk: { w: 'sq50', f: 560, v: .07, d: .045, r: 90 },
    fgd: { w: 'tri', f: 175, v: .24, d: .06, r: 12 },
    catty: { w: 'saw', f: 460, v: .06, d: .04, r: 70 },
    calia: { w: 'sq25', f: 300, v: .09, d: .05, r: 20 },
    king: { w: 'tri', f: 120, v: .26, d: .08, r: 10 },
    sci: { w: 'sq12', f: 620, v: .07, d: .035, r: 150 },
    monster: { w: 'sq25', f: 420, v: .06, d: .04, r: 60 },
    kid: { w: 'sq25', f: 720, v: .06, d: .04, r: 80 },
    old: { w: 'tri', f: 220, v: .18, d: .07, r: 15 },
    creator: { w: 'noise' },
  };
  let lastBlip = 0;
  A.blip = function (voice) {
    if (!A.ready) return;
    const now = ctx.currentTime;
    if (now - lastBlip < .03) return;
    lastBlip = now;
    const v = VOICES[voice] || VOICES.narr;
    if (v.w === 'noise') { noise(.05, .1, 'bandpass', U.rand(300, 3000)); return; }
    const f = v.f + U.rand(-v.r, v.r);
    tone(v.w, f, f, v.d, v.v);
  };
})();
