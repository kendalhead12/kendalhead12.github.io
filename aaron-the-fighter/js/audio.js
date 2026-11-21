'use strict';
// ============================================================
//  Chiptune audio engine: original music + synthesized SFX
// ============================================================
(function () {
  const A = AF.Audio = { ctx: null, ready: false, cur: null, curName: '', duck: 1 };
  let ctx, master, musicGain, sfxGain, echoIn, noiseBuf, waves = {};
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
    if (!m) return null;
    return NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  }
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  A.unlock = function () {
    if (A.ready) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    comp.connect(master);
    musicGain = ctx.createGain(); musicGain.connect(comp);
    sfxGain = ctx.createGain(); sfxGain.connect(comp);
    // echo bus for music
    echoIn = ctx.createGain(); echoIn.gain.value = 0;
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.27;
    const fb = ctx.createGain(); fb.gain.value = 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    echoIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicGain);
    // noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // pulse waves
    for (const duty of [0.125, 0.25, 0.5]) {
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 0.9; // sine terms give pulse
      for (let k = 1; k < n; k++) { re[k] = 0; }
      // proper pulse: a_k = 2/(k pi) sin(k pi d) cos, b_k = 2/(kpi) (1-cos(2 k pi d))/2
      for (let k = 1; k < n; k++) { re[k] = (2 / (k * Math.PI)) * Math.sin(2 * k * Math.PI * duty) * .5; im[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * k * Math.PI * duty)) * .5; }
      waves['p' + Math.round(duty * 100)] = ctx.createPeriodicWave(re, im);
    }
    A.ready = true;
    A.applyVolumes();
    setInterval(schedule, 25);
    if (A.pending) { const p = A.pending; A.pending = null; A.music(p); }
  };
  A.applyVolumes = function () {
    if (!A.ready) return;
    musicGain.gain.setTargetAtTime(AF.opts.music * 0.55 * A.duck, ctx.currentTime, 0.05);
    sfxGain.gain.setTargetAtTime(AF.opts.sfx * 0.7, ctx.currentTime, 0.02);
  };
  A.setDuck = function (v) { A.duck = v; A.applyVolumes(); };

  function osc(type, f, t) {
    const o = ctx.createOscillator();
    if (type === 'p12') o.setPeriodicWave(waves.p13); else if (type === 'p25') o.setPeriodicWave(waves.p25); else if (type === 'p50') o.setPeriodicWave(waves.p50);
    else o.type = type === 'tri' ? 'triangle' : type;
    o.frequency.setValueAtTime(f, t);
    return o;
  }
  // ---------------- music voices ----------------
  function voice(inst, m, t, dur, vol, out, echo) {
    const g = ctx.createGain();
    const o = osc(inst, freq(m), t);
    const atk = 0.006, rel = inst === 'tri' ? 0.03 : 0.05;
    const sus = inst === 'tri' ? 0.9 : 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.setTargetAtTime(vol * sus, t + atk, 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.01, rel / 3);
    o.connect(g); g.connect(out);
    if (echo) g.connect(echoIn);
    o.start(t); o.stop(t + dur + rel * 2 + 0.05);
  }
  function drum(kind, t, vol, out) {
    if (kind === 'k' || kind === 't') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      const f0 = kind === 'k' ? 160 : 220, f1 = kind === 'k' ? 38 : 90;
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.12);
      g.gain.setValueAtTime(vol * (kind === 'k' ? 1.2 : .8), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.2);
      return;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    let dur = 0.05, fv = 8000, ft = 'highpass', v = vol * .5;
    if (kind === 's') { ft = 'bandpass'; fv = 1700; dur = 0.16; v = vol * 1.1; }
    if (kind === 'o') { dur = 0.22; v = vol * .45; }
    if (kind === 'c') { dur = 0.9; fv = 4000; v = vol * .6; }
    f.type = ft; f.frequency.value = fv;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * .5); s.stop(t + dur + .02);
    if (kind === 's') { const o = ctx.createOscillator(), g2 = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + .08); g2.gain.setValueAtTime(vol * .7, t); g2.gain.exponentialRampToValueAtTime(.001, t + .1); o.connect(g2); g2.connect(out); o.start(t); o.stop(t + .12); }
  }

  // ---------------- song compiler ----------------
  function parseChord(s) {
    const m = /^([A-G])(#|b)?(.*)$/.exec(s);
    const root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    const Q = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6], sus: [0, 5, 7], aug: [0, 4, 8] };
    return { root, iv: Q[m[3]] || Q[''] };
  }
  function chordSeq(str) { // 'G:16 Em:16' -> per-step chord array
    const out = [];
    for (const tok of str.trim().split(/\s+/)) { const [c, d] = tok.split(':'); const ch = parseChord(c); for (let i = 0; i < +d; i++) out.push(ch); }
    return out;
  }
  function mel(str, len) { // 'E5:2 r:2' -> events
    const ev = new Array(len).fill(null); let p = 0;
    for (const tok of str.trim().split(/\s+/)) {
      const [n, d] = tok.split(':'); const dd = +d;
      if (n !== 'r' && p < len) ev[p] = { m: midi(n), len: dd };
      p += dd;
    }
    return ev;
  }
  function patt(chords, pat, oct, mode) { // bass/arp from chord progression
    const len = chords.length, ev = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
      const c = pat[i % pat.length];
      if (c === '.' || c === '-') continue;
      let l = 1; while (i + l < len && pat[(i + l) % pat.length] === '-') l++;
      const ch = chords[i]; let semi;
      if (mode === 'bass') {
        const map = { R: 0, '3': ch.iv[1], '5': ch.iv[2], '8': 12, '7': ch.iv[3] !== undefined ? ch.iv[3] : 10 };
        semi = map[c]; if (semi === undefined) continue;
      } else {
        const k = +c; if (isNaN(k)) continue;
        semi = ch.iv[k % ch.iv.length] + 12 * Math.floor(k / ch.iv.length);
      }
      ev[i] = { m: (oct + 1) * 12 + ch.root + semi, len: l };
    }
    return ev;
  }
  function drums(pat, len, fill) {
    const ev = new Array(len).fill(null);
    for (let i = 0; i < len; i++) {
      let c = pat[i % pat.length];
      if (fill && i >= len - fill.length) c = fill[i - (len - fill.length)];
      if (c !== '.' && c !== '-') ev[i] = { d: c };
    }
    return ev;
  }
  function song(o) {
    const chords = chordSeq(o.chords), len = chords.length;
    const chs = [];
    if (o.mel) chs.push({ ev: mel(o.mel, len), inst: o.lead || 'p25', vol: o.leadVol || .17, echo: o.echo });
    if (o.mel2) chs.push({ ev: mel(o.mel2, len), inst: o.lead2 || 'p12', vol: o.lead2Vol || .08, echo: o.echo });
    if (o.bass) chs.push({ ev: patt(chords, o.bass, o.bassOct || 2, 'bass'), inst: 'tri', vol: o.bassVol || .3 });
    if (o.arp) chs.push({ ev: patt(chords, o.arp, o.arpOct || 4, 'arp'), inst: o.arpInst || 'p12', vol: o.arpVol || .055, echo: o.echo });
    if (o.drums) chs.push({ ev: drums(o.drums, len, o.fill), drum: true, vol: o.drumVol || .35 });
    return { bpm: o.bpm, len, chs, loop: o.loop !== false, echo: !!o.echo };
  }

  const SONGS = {};
  SONGS.title = song({
    bpm: 132, chords: 'C:16 G:16 Am:16 F:16 C:16 G:16 F:8 G:8 C:16', lead: 'p50', leadVol: .14,
    mel: 'G4:2 C5:2 E5:2 G5:6 E5:2 G5:2 D5:4 G5:4 B5:6 A5:2 A5:2 G5:2 E5:2 C5:2 E5:4 A5:4 F5:6 E5:2 C5:4 A4:4 C6:4 G5:2 E5:2 G5:4 C6:4 B5:2 A5:2 G5:2 D5:2 G5:4 B5:4 A5:4 C6:4 B5:4 D6:4 C6:12 r:4',
    bass: 'R.R.5.R.R.R.5.8.', arp: '0.1.2.1.0.1.2.1.', drums: 'k.h.s.h.k.hks.h.', fill: 'sssskkss'
  });
  SONGS.map = song({
    bpm: 112, chords: 'F:16 C:16 Dm:16 Bb:16 F:16 C:16 Bb:8 C:8 F:16', lead: 'p25',
    mel: 'C5:2 F5:2 A5:4 G5:2 F5:2 C5:4 E5:2 G5:2 C6:4 Bb5:2 A5:2 G5:4 A5:2 F5:2 D5:4 F5:2 A5:2 D6:4 D6:4 C6:2 Bb5:2 F5:8 A5:2 C6:2 F6:4 E6:2 C6:2 A5:4 G5:2 E5:2 C5:4 E5:2 G5:2 C6:4 Bb5:4 D6:4 C6:4 E5:4 F5:12 r:4',
    bass: 'R...5...R...5.R.', arp: '0.2.1.2.0.2.1.2.', drums: 'k...s...k.k.s...'
  });
  SONGS.forest = song({
    bpm: 144, chords: 'G:16 Em:16 C:16 D:16 G:16 Em:16 C:8 D:8 G:16',
    mel: 'D5:2 G5:2 B5:2 A5:2 G5:2 D5:2 E5:2 G5:2 E5:2 G5:2 B5:4 A5:2 G5:2 E5:4 C5:2 E5:2 G5:2 E5:2 A5:4 G5:2 E5:2 D5:4 F#5:2 A5:2 D6:6 r:2 B5:2 A5:2 G5:2 A5:2 B5:4 D6:4 E6:2 D6:2 B5:2 G5:2 E5:4 G5:4 C6:2 B5:2 A5:2 G5:2 F#5:2 G5:2 A5:4 G5:8 r:4 D5:2 F#5:2',
    bass: 'R.5.R.5.R.5.R.5.', arp: '0.1.2.1.0.1.2.1.', drums: 'k.h.s.h.k.hks.h.', fill: 'k.s.s.ss'
  });
  SONGS.aqua = song({
    bpm: 92, chords: 'Dm7:16 Em7:16 Fmaj7:16 Em7:16 Dm7:16 G:16 Bbmaj7:16 A:16', lead: 'tri', leadVol: .32, echo: true,
    mel: 'A4:4 D5:4 E5:4 F5:4 G5:6 E5:2 D5:4 B4:4 C5:4 F5:4 A5:6 G5:2 E5:12 r:4 A5:4 G5:4 F5:4 E5:4 D5:6 B4:2 D5:4 G5:4 F5:4 D5:4 Bb4:4 D5:4 C#5:8 E5:4 A4:4',
    bass: 'R-------5-------', bassOct: 2, arp: '0.1.2.3.2.1.0.1.', arpVol: .045, drums: 'k...h...k.h.h...', drumVol: .18
  });
  SONGS.ice = song({
    bpm: 100, chords: 'Em:16 Cmaj7:16 Am7:16 B7:16 Em:16 Cmaj7:16 Am:8 D:8 B:16', lead: 'p12', leadVol: .13, echo: true,
    mel: 'B5:2 r:2 G5:2 r:2 E5:2 r:2 F#5:2 G5:2 E5:4 r:2 B4:2 C5:4 E5:4 A5:2 r:2 G5:2 r:2 E5:2 r:2 C5:2 D5:2 D#5:8 F#5:4 B5:4 B5:2 r:2 E6:2 r:2 D6:2 B5:2 G5:4 E5:4 G5:4 B5:6 r:2 C6:4 B5:2 A5:2 F#5:4 D5:4 D#5:12 r:4',
    bass: 'R.......5.......', arp: '0.2.1.2.0.2.1.2.', arpInst: 'tri', arpVol: .09, drums: 'k.....h.s.....h.', drumVol: .2
  });
  SONGS.lava = song({
    bpm: 168, chords: 'Am:16 F:16 G:16 E:16 Am:16 F:16 G:16 E:16', lead: 'p50', leadVol: .13,
    mel: 'A5:2 A5:2 C6:2 A5:2 E6:4 D6:2 C6:2 C6:2 A5:2 F5:2 A5:2 C6:4 A5:4 B5:2 G5:2 D6:2 B5:2 G6:4 F6:2 D6:2 E6:6 D6:2 C6:2 B5:2 G#5:4 A5:2 E5:2 A5:2 B5:2 C6:2 B5:2 C6:2 E6:2 F6:4 E6:2 C6:2 A5:4 F5:4 G5:2 B5:2 D6:2 G6:2 F6:2 D6:2 B5:2 G5:2 G#5:4 B5:4 E6:8',
    bass: 'R.R.R.R.R.R.8.5.', arp: '0.1.2.0.1.2.0.1.', arpOct: 5, arpVol: .04, drums: 'k.h.s.h.k.k.s.hh', fill: 'ssssssss'
  });
  SONGS.city = song({
    bpm: 150, chords: 'Fm:16 Fm:16 Db:16 Eb:16 Fm:16 Fm:16 Bbm:8 C:8 C:16',
    mel: 'F5:3 F5:3 G#5:2 r:2 F5:2 D#5:2 C5:2 F5:3 F5:3 G#5:2 r:2 A#5:2 G#5:2 G5:2 F5:2 r:2 C#6:4 C6:2 G#5:2 F5:4 D#5:2 r:2 G5:4 A#5:2 G5:2 D#5:4 C6:3 C6:3 A#5:2 r:2 G#5:2 G5:2 F5:2 G#5:3 G5:3 F5:2 r:2 C5:2 D#5:2 F5:2 C#6:4 A#5:4 C6:4 E5:4 F5:4 G5:4 C6:8',
    bass: 'R.R.R8R.R.R.R8R.', arp: '0.0.1.0.2.0.1.0.', drums: 'k.hhs.h.kkhhs.hs'
  });
  SONGS.desert = song({
    bpm: 116, chords: 'D:16 Eb:16 D:16 Cm:16 D:16 Eb:16 Gm:8 Cm:8 D:16',
    mel: 'D5:2 Eb5:2 F#5:4 G5:2 F#5:2 Eb5:4 D5:2 Eb5:2 G5:2 Bb5:2 A5:4 G5:4 F#5:4 A5:2 G5:2 F#5:2 Eb5:2 D5:4 C5:2 Eb5:2 G5:4 F#5:2 Eb5:2 C5:4 A5:2 Bb5:2 A5:2 G5:2 F#5:4 D5:4 G5:2 Eb5:2 Bb4:2 Eb5:2 G5:4 Bb5:4 Bb5:4 A5:2 G5:2 Eb5:4 C5:4 D5:12 r:4',
    bass: 'R..R..5.R..R.5..', arp: '0---------------', arpInst: 'p25', arpVol: .035, arpOct: 3, drums: 'k..t..s.k.t.s.tt'
  });
  SONGS.sky = song({
    bpm: 128, chords: 'D:16 A:16 Bm:16 G:16 D:16 A:16 G:8 A:8 D:16', lead: 'p50', leadVol: .13,
    mel: 'A4:4 D5:4 F#5:4 A5:4 G5:2 F#5:2 E5:4 C#5:4 A4:4 B4:4 D5:2 F#5:2 B5:6 A5:2 G5:4 F#5:2 E5:2 D5:8 F#5:4 A5:4 D6:6 C#6:2 B5:2 A5:2 E5:4 C#6:6 A5:2 B5:4 G5:4 A5:4 C#6:4 D6:12 r:4',
    bass: 'R...R...5...R.5.', arp: '0.1.2.3.2.1.2.1.', drums: 'k.h.s.h.k.k.s.h.', fill: 'kkssccss'
  });
  SONGS.lab = song({
    bpm: 132, chords: 'Cm:16 Ab:16 Fm:16 G:16 Cm:16 Ab:16 Fm:8 G:8 G:16', lead: 'p12', leadVol: .14, echo: true,
    mel: 'C5:2 r:2 Eb5:2 r:2 G5:2 F5:2 Eb5:2 D5:2 Eb5:4 C5:4 Ab4:4 C5:4 F5:2 r:2 Ab5:2 r:2 C6:2 Bb5:2 Ab5:2 G5:2 B4:4 D5:4 G5:8 C6:2 B5:2 C6:2 G5:2 Eb5:2 F5:2 G5:4 Ab5:2 G5:2 Ab5:2 Eb5:2 C5:2 D5:2 Eb5:4 F5:4 Ab5:4 G5:4 B5:4 C6:2 B5:2 G5:2 D5:2 B4:8',
    bass: 'R.R.R.R.R.R.R.R.', arp: '0120120120120120', arpVol: .035, drums: 'k...s..kk...s...'
  });
  SONGS.boss = song({
    bpm: 160, chords: 'Em:16 C:16 D:16 B:16 Em:16 C:16 Am:8 B:8 B:16', lead: 'p50', leadVol: .13,
    mel: 'E5:2 E5:2 G5:2 E5:2 B5:4 A5:2 G5:2 E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 D#5:4 F#5:4 B5:8 E6:2 D6:2 B5:2 G5:2 E6:2 D6:2 B5:2 G5:2 C6:2 B5:2 G5:2 E5:2 C6:4 E6:4 A5:4 C6:4 D#6:4 F#6:4 B5:4 A5:4 F#5:4 D#5:4',
    bass: 'R.R.R.R.8.R.R.5.', arp: '0.1.2.1.0.1.2.1.', arpOct: 4, drums: 'k.h.s.hkk.h.s.hs', fill: 'ssssssss'
  });
  SONGS.final = song({
    bpm: 172, chords: 'Dm:16 Bb:16 C:16 A:16 Dm:16 Bb:16 Gm:8 A:8 A:16', lead: 'p50', leadVol: .13,
    mel: 'D5:2 F5:2 A5:2 D6:2 C6:2 A5:2 F5:2 A5:2 Bb5:4 A5:2 F5:2 D5:4 F5:4 G5:2 E5:2 C5:2 E5:2 G5:2 C6:2 E6:4 C#6:4 A5:4 E5:4 C#5:4 D6:3 D6:3 F6:2 E6:2 D6:2 C6:2 A5:2 Bb5:3 Bb5:3 D6:2 C6:2 Bb5:2 A5:2 F5:2 G5:4 Bb5:4 A5:4 C#6:4 E6:4 D6:4 C#6:4 A5:4',
    mel2: 'D4:16 Bb3:16 C4:16 A3:16 D4:16 Bb3:16 G3:8 A3:8 A3:16', lead2: 'p25', lead2Vol: .05,
    bass: 'R.R.R.R.R.R.8.8.', arp: '0.1.2.0.1.2.0.1.', arpOct: 5, arpVol: .035, drums: 'k.hks.hkk.hks.ss', fill: 'ssssssss'
  });
  SONGS.ending = song({
    bpm: 96, chords: 'C:16 Am:16 F:16 G:16 C:16 Em:16 F:8 G:8 C:16', lead: 'p25', echo: true,
    mel: 'E5:6 D5:2 C5:4 G4:4 A4:4 C5:4 E5:6 D5:2 C5:4 A4:4 F5:6 E5:2 D5:12 r:4 G5:6 F5:2 E5:4 C5:4 B4:4 E5:4 G5:6 F5:2 E5:4 F5:4 D5:4 G5:4 C5:12 r:4',
    bass: 'R.......5...R...', arp: '0.1.2.1.0.1.2.1.', arpInst: 'tri', arpVol: .08, drums: 'k.......s.......', drumVol: .2
  });
  SONGS.clear = song({ bpm: 150, loop: false, chords: 'C:8 F:8 G:8 C:16', lead: 'p50', mel: 'C5:2 E5:2 G5:2 C6:2 A5:2 F5:2 A5:2 C6:2 B5:2 G5:2 D6:2 B5:2 C6:12 r:4', bass: 'R.5.R.5.', arp: '0123', arpVol: .04, drums: 'k.s.k.s.k.s.k.s.k...c.......' });
  SONGS.gameover = song({ bpm: 90, loop: false, chords: 'Am:8 F:8 E:16', lead: 'p25', mel: 'E5:4 C5:4 A4:4 F4:4 G#4:8 E4:8', bass: 'R-------R-------R---------------' });
  SONGS.cutscene = song({
    bpm: 84, chords: 'Am:16 F:16 Dm:16 E:16', lead: 'tri', leadVol: .25, echo: true,
    mel: 'E5:8 C5:4 A4:4 F5:8 C5:8 D5:6 E5:2 F5:4 A5:4 G#5:12 r:4', bass: 'R-------5-------', arp: '0.1.2.1.', arpVol: .04
  });
  SONGS.shop = song({
    bpm: 120, chords: 'C:8 Am:8 Dm:8 G:8 C:8 Am:8 F:8 G:8', lead: 'p25', leadVol: .12,
    mel: 'E5:2 G5:2 C6:2 G5:2 A5:2 C6:2 E5:2 C5:2 D5:2 F5:2 A5:2 F5:2 G5:2 B5:2 D6:4 C6:2 G5:2 E5:2 G5:2 A5:2 E5:2 C5:2 E5:2 F5:2 A5:2 C6:2 A5:2 G5:4 B5:4',
    bass: 'R.5.R.5.', arp: '0.1.2.1.', drums: 'k.h.s.h.'
  });
  A.SONGS = SONGS;

  // ---------------- scheduler ----------------
  let pos = 0, nextT = 0, playing = null;
  function schedule() {
    if (!playing || !A.ready) return;
    const sp = 60 / playing.bpm / 4;
    while (nextT < ctx.currentTime + 0.12) {
      if (pos >= playing.len) {
        if (!playing.loop) { playing = null; return; }
        pos = 0;
      }
      for (const ch of playing.chs) {
        const e = ch.ev[pos]; if (!e) continue;
        if (ch.drum) drum(e.d, nextT, ch.vol, musicGain);
        else voice(ch.inst, e.m, nextT, e.len * sp, ch.vol, musicGain, ch.echo && playing.echo);
      }
      pos++; nextT += sp;
    }
  }
  A.music = function (name) {
    if (!A.ready) { A.pending = name; A.curName = name; return; }
    if (name === A.curName && playing) return;
    A.curName = name;
    playing = SONGS[name] || null; pos = 0; nextT = ctx.currentTime + 0.06;
    echoIn.gain.setValueAtTime(playing && playing.echo ? 0.5 : 0, ctx.currentTime);
  };
  A.stopMusic = function () { playing = null; A.curName = ''; A.pending = null; };
  A.isPlaying = () => !!playing;

  // ---------------- SFX ----------------
  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const os = osc(o.type || 'p50', o.f0, t), g = ctx.createGain();
    const dur = o.dur || .1;
    if (o.f1) { if (o.lin) os.frequency.linearRampToValueAtTime(o.f1, t + dur); else os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur); }
    if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 30; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + .05); }
    const v = o.vol || .3;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    os.connect(g); g.connect(sfxGain); os.start(t); os.stop(t + dur + .02);
  }
  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.f0 || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.dur || .2));
    f.Q.value = o.q || 1;
    const v = o.vol || .3, dur = o.dur || .2;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + dur + .02);
  }
  const last = {};
  const SFX = {
    jump: () => tone({ type: 'p25', f0: 260, f1: 620, dur: .12, vol: .18 }),
    djump: () => { tone({ type: 'p12', f0: 400, f1: 950, dur: .14, vol: .17 }); noise({ ft: 'highpass', f0: 3000, dur: .1, vol: .08 }); },
    land: () => noise({ f0: 500, dur: .06, vol: .15 }),
    step: () => noise({ f0: 900, dur: .03, vol: .05 }),
    punch: () => { noise({ ft: 'bandpass', f0: 1200, f1: 400, dur: .07, vol: .2 }); },
    whoosh: () => noise({ ft: 'bandpass', f0: 600, f1: 2500, dur: .12, vol: .12, q: 2 }),
    hit: () => { tone({ type: 'p50', f0: 220, f1: 60, dur: .12, vol: .22 }); noise({ f0: 3000, f1: 300, dur: .1, vol: .25 }); },
    bighit: () => { tone({ type: 'p50', f0: 160, f1: 40, dur: .25, vol: .3 }); noise({ f0: 4000, f1: 200, dur: .25, vol: .35 }); },
    clink: () => { tone({ type: 'p12', f0: 1800, f1: 1400, dur: .08, vol: .15 }); noise({ ft: 'highpass', f0: 5000, dur: .05, vol: .1 }); },
    coin: () => { tone({ type: 'p25', f0: 988, dur: .06, vol: .13 }); tone({ type: 'p25', f0: 1319, dur: .22, vol: .13, delay: .06 }); },
    heart: () => { tone({ type: 'p25', f0: 660, dur: .08, vol: .15 }); tone({ type: 'p25', f0: 880, dur: .08, vol: .15, delay: .08 }); tone({ type: 'p25', f0: 1320, dur: .16, vol: .15, delay: .16 }); },
    orb: () => { tone({ type: 'sine', f0: 600, f1: 1600, dur: .2, vol: .2 }); tone({ type: 'p12', f0: 1200, f1: 2400, dur: .15, vol: .06, delay: .05 }); },
    oneup: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'p25', f0: f, dur: .09, vol: .14, delay: i * .08 })); },
    medal: () => { [784, 988, 1175, 1568, 1976].forEach((f, i) => tone({ type: 'p12', f0: f, dur: .2, vol: .14, delay: i * .06 })); },
    artifact: () => { [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone({ type: 'p25', f0: f, dur: .25, vol: .12, delay: i * .07 })); },
    hurt: () => { tone({ type: 'p50', f0: 520, f1: 140, dur: .3, vol: .22, vib: 30, vibAmt: 60 }); },
    die: () => { [660, 520, 440, 330, 260, 196].forEach((f, i) => tone({ type: 'p50', f0: f, f1: f * .9, dur: .14, vol: .18, delay: i * .1 })); },
    door: () => { tone({ type: 'sawtooth', f0: 80, f1: 160, dur: .5, vol: .12 }); noise({ f0: 400, dur: .5, vol: .12 }); },
    spring: () => tone({ type: 'sine', f0: 180, f1: 980, dur: .25, vol: .25, vib: 25, vibAmt: 40 }),
    splash: () => noise({ ft: 'bandpass', f0: 3000, f1: 400, dur: .35, vol: .25 }),
    bubble: () => tone({ type: 'sine', f0: 500 + Math.random() * 300, f1: 1400, dur: .06, vol: .1 }),
    explode: () => { noise({ f0: 1800, f1: 80, dur: .6, vol: .4 }); tone({ type: 'sine', f0: 120, f1: 30, dur: .5, vol: .35 }); },
    bigexplode: () => { noise({ f0: 2500, f1: 60, dur: 1.4, vol: .5 }); tone({ type: 'sine', f0: 90, f1: 25, dur: 1.2, vol: .45 }); },
    break: () => { noise({ f0: 2600, f1: 300, dur: .25, vol: .35 }); tone({ type: 'p50', f0: 140, f1: 60, dur: .15, vol: .15 }); },
    slam: () => { tone({ type: 'sine', f0: 140, f1: 30, dur: .35, vol: .45 }); noise({ f0: 1200, f1: 100, dur: .35, vol: .35 }); },
    dash: () => noise({ ft: 'bandpass', f0: 400, f1: 3000, dur: .18, vol: .2, q: 3 }),
    roll: () => noise({ ft: 'bandpass', f0: 300, f1: 900, dur: .15, vol: .15, q: 2 }),
    shoot: () => { tone({ type: 'sawtooth', f0: 900, f1: 200, dur: .2, vol: .14 }); tone({ type: 'p12', f0: 1800, f1: 400, dur: .15, vol: .08 }); },
    charge: () => tone({ type: 'p25', f0: 200, f1: 800, dur: .5, vol: .1, lin: true }),
    charged: () => { tone({ type: 'p12', f0: 1200, dur: .05, vol: .1 }); tone({ type: 'p12', f0: 1600, dur: .08, vol: .1, delay: .05 }); },
    laser: () => tone({ type: 'p12', f0: 1500, f1: 900, dur: .15, vol: .1 }),
    zap: () => { noise({ ft: 'highpass', f0: 2000, dur: .2, vol: .2 }); tone({ type: 'sawtooth', f0: 60, f1: 120, dur: .2, vol: .12, vib: 40, vibAmt: 50 }); },
    thunder: () => { noise({ f0: 1500, f1: 60, dur: 1.2, vol: .45 }); },
    fire: () => noise({ ft: 'bandpass', f0: 600, f1: 1400, dur: .3, vol: .2, q: .7 }),
    steam: () => noise({ ft: 'highpass', f0: 2500, dur: .4, vol: .12 }),
    enemyshot: () => tone({ type: 'p25', f0: 700, f1: 300, dur: .1, vol: .1 }),
    warn: () => { tone({ type: 'p50', f0: 880, dur: .08, vol: .1 }); tone({ type: 'p50', f0: 660, dur: .08, vol: .1, delay: .1 }); },
    roar: () => { tone({ type: 'sawtooth', f0: 110, f1: 70, dur: .9, vol: .25, vib: 12, vibAmt: 20 }); noise({ f0: 700, dur: .9, vol: .15 }); },
    checkpoint: () => { tone({ type: 'p25', f0: 784, dur: .1, vol: .15 }); tone({ type: 'p25', f0: 1175, dur: .3, vol: .15, delay: .1 }); },
    select: () => tone({ type: 'p25', f0: 660, dur: .04, vol: .1 }),
    confirm: () => { tone({ type: 'p25', f0: 660, dur: .05, vol: .12 }); tone({ type: 'p25', f0: 990, dur: .1, vol: .12, delay: .05 }); },
    cancel: () => tone({ type: 'p25', f0: 440, f1: 300, dur: .08, vol: .1 }),
    pause: () => { tone({ type: 'p25', f0: 1047, dur: .06, vol: .12 }); tone({ type: 'p25', f0: 784, dur: .06, vol: .12, delay: .07 }); tone({ type: 'p25', f0: 1047, dur: .1, vol: .12, delay: .14 }); },
    text: () => tone({ type: 'p50', f0: 520 + Math.random() * 60, dur: .025, vol: .05 }),
    achtext: () => tone({ type: 'sawtooth', f0: 180 + Math.random() * 40, dur: .03, vol: .05 }),
    radio: () => { noise({ ft: 'bandpass', f0: 2000, dur: .25, vol: .12, q: 4 }); tone({ type: 'p12', f0: 1400, dur: .05, vol: .06, delay: .25 }); },
    ability: () => { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'p50', f0: f, dur: .18, vol: .13, delay: i * .09 })); },
    crumble: () => noise({ f0: 900, f1: 200, dur: .3, vol: .15 }),
    switch: () => { tone({ type: 'p25', f0: 300, dur: .05, vol: .15 }); tone({ type: 'p25', f0: 600, dur: .08, vol: .15, delay: .06 }); },
    alarm: () => tone({ type: 'p50', f0: 600, f1: 900, dur: .3, vol: .1, lin: true }),
    teleport: () => tone({ type: 'p12', f0: 300, f1: 2400, dur: .35, vol: .12, vib: 20, vibAmt: 200 }),
    wind: () => noise({ ft: 'bandpass', f0: 500, f1: 900, dur: .8, vol: .06, q: 2 }),
    boing: () => tone({ type: 'sine', f0: 300, f1: 700, dur: .15, vol: .2 }),
    tally: () => tone({ type: 'p12', f0: 1500, dur: .02, vol: .05 }),
    bossdie: () => { SFX.bigexplode(); [600, 500, 400, 300, 200].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f / 2, dur: .3, vol: .12, delay: .2 + i * .2 })); }
  };
  A.sfx = function (name) {
    if (!A.ready || !SFX[name]) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < 0.035) return;
    last[name] = now;
    try { SFX[name](); } catch (e) { }
  };
})();
