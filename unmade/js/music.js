'use strict';
// ============================================================
//  Original soundtrack (tracker data). One token = a 16th note.
// ============================================================
(function () {
  const A = U.Audio;
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const nm = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7] };
  function chord(name, oct) {
    const m = /^([A-G])(#|b)?(.*)$/.exec(name);
    const root = A.midi(m[1] + (m[2] || '') + oct);
    const iv = QUAL[m[3]] || QUAL[''];
    return iv.map(i => root + i);
  }
  // pattern: array per step: number = chord tone index (3 => root+12, 4 => third+12), 'c' = upper chord, '.' rest, '-' hold
  function fromProg(prog, steps, pattern, oct) {
    const out = [];
    prog.trim().split(/\s+/).forEach(ch => {
      const tones = chord(ch, oct);
      const ext = tones.concat(tones.map(t => t + 12));
      for (let i = 0; i < steps; i++) {
        const p = pattern[i % pattern.length];
        if (p === '.' || p === '-') out.push(p);
        else if (p === 'c') out.push(tones.slice(1).map(t => nm(t + 12)).join('+'));
        else out.push(nm(ext[p]));
      }
    });
    return out.join(' ');
  }
  U.Music = { chord, fromProg };

  // ---------- Title: "Unmade" ----------
  const titleProg = 'Am F C G Am F E Am';
  A.define('title', {
    bpm: 72, ch: [
      { inst: 'tri', vol: .2, env: 'bell', echo: true, notes:
        'E5*2 A5*2 C6*2 B5*2 A5*4 E5*4  F5*2 A5*2 C6*2 B5*2 A5*4 F5*4  G5*2 E5*2 C5*2 E5*2 G5*4 C6*4  B5*4 A5*2 G5*2 D5*8 ' +
        'E5*2 A5*2 C6*2 B5*2 A5*4 E5*4  F5*2 A5*2 C6*2 D6*2 C6*4 A5*4  G#5*4 B5*4 E6*4 D6*2 B5*2  A5*16' },
      { inst: 'sq12', vol: .045, env: 'pluck', notes: fromProg(titleProg, 16, [0, '.', 1, '.', 2, '.', 1, '.'], 4) },
      { inst: 'tri', vol: .2, notes: fromProg(titleProg, 16, [0, '-', '-', '-', '-', '-', '-', '-', 2, '-', '-', '-', '-', '-', '-', '-'], 2) },
    ] });

  // ---------- The Dark ----------
  A.define('dark', {
    bpm: 50, ch: [
      { inst: 'sine', vol: .14, env: 'pad', notes: 'D3+A3*32 A#2+F3*32 D3+A3*32 C3+G3*32' },
      { inst: 'sine', vol: .07, env: 'bell', echo: true, notes: 'D6*8 .*24 A5*8 .*24 F5*4 E5*4 .*24 .*32' },
    ] });

  // ---------- Sun: "Sunny Side" ----------
  A.define('sun', {
    bpm: 128, dvol: .16, drums: 'k . h . s . h . k . h . s . h h', ch: [
      { inst: 'sq25', vol: .1, env: 'pluck', notes:
        'C5 . E5 . G5 . E5 . C6*2 B5*2 G5*4  A5 . F5 . A5 . C6 . D6*2 C6*2 A5*4  B5 . G5 . D5 . G5 . B5*2 A5*2 G5*4  C6 . G5 . E5 . F#5 . G5*8' },
      { inst: 'tri', vol: .22, env: 'pluck', notes: fromProg('C F G C', 16, [0, '.', 0, '.', 2, '.', 2, '.'], 2) },
      { inst: 'sine', vol: .05, env: 'bell', notes: 'C7 .*15 .*16 G6 .*15 .*16' },
    ] });
  // ---------- Sun revealed ----------
  A.define('sundark', {
    bpm: 92, dvol: .2, drums: 'k . . . s . . k k . . . s . h .', ch: [
      { inst: 'saw', vol: .06, det: 8, notes: 'C5*2 D#5*2 G5*4 D#5*2 C5*2 B4*4  G#4*2 C5*2 D#5*4 D5*2 C5*2 G4*4  F4*2 G#4*2 C5*4 B4*4 G#4*4  G4*4 B4*4 D5*4 F5*2 G#5*2' },
      { inst: 'saw', vol: .07, notes: fromProg('Cm G#  Fm G', 16, [0, '.', 0, 0, '.', 0, 0, '.'], 2) },
      { inst: 'sine', vol: .08, env: 'pad', notes: 'C3+G3*16 G#2+D#3*16 F2+C3*16 G2+D3*16' },
    ] });

  // ---------- Ex-Queen: "Lanternlight" (waltz) ----------
  const exProg = 'F C Dm A# F C A# C Dm A# F C A# C F F';
  A.define('exqueen', {
    bpm: 92, ch: [
      { inst: 'tri', vol: .2, echo: true, notes:
        'C5*4 F5*4 A5*4 G5*8 E5*4 F5*4 A5*4 D6*4 C6*8 A#5*4 A5*4 G5*4 F5*4 E5*4 G5*4 C6*4 D6*4 C6*4 A#5*4 G5*12 ' +
        'A5*4 F5*4 D5*4 F5*8 D5*4 C5*4 F5*4 A5*4 G5*8 C5*4 D5*4 F5*4 A#5*4 A5*4 G5*4 E5*4 F5*12 .*12' },
      { inst: 'sq12', vol: .045, env: 'pluck', notes: fromProg(exProg, 12, [0, '-', '-', '-', 'c', '-', '.', '.', 'c', '-', '.', '.'], 3) },
    ] });

  // ---------- Dark Hallways ----------
  const hallProg = 'Dm A# C A Dm A# Gm A';
  A.define('hall', {
    bpm: 96, dvol: .12, drums: 'k . . . h . . . k . k . h . . .', ch: [
      { inst: 'tri', vol: .18, echo: true, notes:
        'D5*2 .*2 F5*2 A5*2 G5*4 F5*2 E5*2  D5*2 F5*2 A#5*4 A5*4 F5*4  E5*2 G5*2 C6*4 A#5*2 A5*2 G5*4  A5*8 C#5*4 E5*4 ' +
        'F5*2 E5*2 D5*4 A5*4 D6*4  C6*2 A#5*2 A5*4 F5*4 D5*4  A#5*4 A5*4 G5*4 F5*2 E5*2  E5*8 C#5*8' },
      { inst: 'sq12', vol: .04, env: 'pluck', notes: fromProg(hallProg, 16, [0, '.', 2, '.', 1, '.', 2, '.'], 4) },
      { inst: 'tri', vol: .18, env: 'pluck', notes: fromProg(hallProg, 16, [0, '.', 0, '.', 0, '.', 2, '.'], 2) },
    ] });

  // ---------- Battle: "Scuffle" ----------
  const batProg = 'Em C D B Em C Am B';
  A.define('battle', {
    bpm: 152, dvol: .2, drums: 'k . h . s . h k k . h . s . h h', ch: [
      { inst: 'sq25', vol: .1, notes:
        'E5*2 G5*2 B5*2 A5*2 G5*2 F#5*2 E5*4  G5*2 A5*2 B5*2 C6*2 B5*4 G5*4  F#5*2 A5*2 D6*2 C6*2 B5*2 A5*2 F#5*4  D#5*4 F#5*4 B5*8 ' +
        'B5*2 E6*2 D6*2 B5*2 G5*2 B5*2 E5*4  C6*2 B5*2 A5*2 G5*2 E5*4 G5*4  A5*2 C6*2 E6*2 D6*2 C6*2 B5*2 A5*4  B5*4 A5*2 G5*2 F#5*4 D#5*4' },
      { inst: 'tri', vol: .24, env: 'pluck', notes: fromProg(batProg, 16, [0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 3, 0, 2, 2, 3, 2], 2) },
      { inst: 'sq12', vol: .035, env: 'pluck', notes: fromProg(batProg, 16, [0, 1, 2, 3], 4) },
    ] });

  // ---------- Ex-Queen battle: "Hearthfire Trial" ----------
  const eqbProg = 'Fm C# D# C Fm C# A#m C';
  A.define('exqbattle', {
    bpm: 120, dvol: .2, drums: 'k . . h s . . h k . k h s . h .', ch: [
      { inst: 'sq50', vol: .08, notes:
        'F5*4 G#5*4 C6*4 A#5*2 G#5*2  G#5*4 F5*4 C#5*8  D#5*2 G5*2 A#5*4 G#5*2 G5*2 D#5*4  E5*8 G5*4 A#5*4 ' +
        'C6*4 A#5*2 G#5*2 G5*4 F5*4  G#5*4 C#6*4 C6*4 G#5*4  A#5*4 C#6*4 F6*4 D#6*2 C#6*2  C6*8 E5*8' },
      { inst: 'sq12', vol: .04, env: 'pluck', notes: fromProg(eqbProg, 16, [0, 1, 2, 3], 4) },
      { inst: 'tri', vol: .24, env: 'pluck', notes: fromProg(eqbProg, 16, [0, '.', 3, '.', 2, '.', 3, '.'], 2) },
    ] });

  // ---------- Frostwood ----------
  const frProg = 'G Em C D G Em Am D';
  A.define('frost', {
    bpm: 116, dvol: .13, drums: 'k . h . . . h . k . h . . . h .', ch: [
      { inst: 'sq25', vol: .1, env: 'pluck', notes:
        'G5 . B5 . D6 . B5 . G5 . A5 . B5*4  E5 . G5 . B5 . G5 . E6*4 D6*4  C6 . B5 . A5 . G5 . E5*4 G5*4  F#5*4 A5*4 D6*4 C6*2 A5*2 ' +
        'B5 . D6 . G6 . D6 . B5 . A5 . G5*4  G5 . E5 . B4 . E5 . G5*4 B5*4  C6 . B5 . A5 . E5 . A5*4 C6*4  B5*4 A5*4 F#5*4 D5*4' },
      { inst: 'sine', vol: .06, env: 'bell', echo: true, notes: 'G6 .*15 .*16 E6 .*15 .*16 D6 .*15 .*16 B5 .*15 .*16' },
      { inst: 'tri', vol: .22, env: 'pluck', notes: fromProg(frProg, 16, [0, '.', '.', 0, 2, '.', '.', '.', 0, '.', '.', 0, 2, '.', 3, '.'], 2) },
    ] });

  // ---------- Snowbell (town) ----------
  const twProg = 'C Am F G C Am Dm G';
  A.define('town', {
    bpm: 92, dvol: .1, drums: 'k . . . h . . . s . . . h . . .', ch: [
      { inst: 'tri', vol: .2, echo: true, notes:
        'E5*4 G5*4 C6*6 B5*2  A5*4 G5*4 E5*8  F5*4 A5*4 C6*4 A5*4  G5*8 D5*8 ' +
        'E5*4 G5*4 C6*4 E6*4  D6*4 C6*4 A5*8  F5*4 A5*4 D6*4 C6*4  B5*8 G5*8' },
      { inst: 'sq12', vol: .04, env: 'pluck', notes: fromProg(twProg, 16, [0, '.', 1, '.', 2, '.', 1, '.'], 4) },
      { inst: 'tri', vol: .18, notes: fromProg(twProg, 16, [0, '-', '-', '-', '-', '-', '-', '-', 2, '-', '-', '-', '-', '-', '-', '-'], 2) },
    ] });

  // ---------- FunnyGuyDev: "lowkey" ----------
  A.define('fgd', {
    bpm: 84, swing: .16, dvol: .12, drums: 'k . h . s . h h k . h . s . h .', ch: [
      { inst: 'tri', vol: .24, env: 'pluck', notes: 'E2*4 G2*4 B2*4 D3*4  E3*4 D3*4 B2*4 G2*4  A2*4 C3*4 E3*4 G3*4  B2*4 D#3*4 F#3*4 A3*4' },
      { inst: 'sq12', vol: .07, env: 'pluck', notes: '.*4 B4*2 D5*2 .*2 E5*6  .*8 D5*2 B4*2 G4*4  .*4 C5*2 E5*2 .*2 G5*4 E5*2  F#5*6 D#5*2 B4*8' },
      { inst: 'sine', vol: .06, env: 'pad', notes: 'G3+B3+D4*32 G3+C4+E4*16 A3+D#4+F#4*16' },
    ] });

  // ---------- Superkendal: "KENDAL-TASTIC!" ----------
  const skProg = 'A# F Gm D# A# F D# F';
  A.define('sk', {
    bpm: 150, dvol: .18, drums: 'k . s . k . s . k . s . k s s s', ch: [
      { inst: 'sq50', vol: .08, notes:
        'A#4*2 D5*2 F5*4 A#5*4 A5*2 G5*2  A5*4 F5*4 C5*4 F5*4  G5*2 A5*2 A#5*4 D6*4 C6*2 A#5*2  C6*8 G5*8 ' +
        'D6*2 C6*2 A#5*4 F5*4 D5*4  C5*2 D5*2 F5*4 A5*4 C6*4  A#5*4 G5*4 D#6*4 D6*2 C6*2  A#5*4 A5*4 A#5*8' },
      { inst: 'sq12', vol: .035, env: 'pluck', notes: fromProg(skProg, 16, [0, 2, 1, 2], 4) },
      { inst: 'tri', vol: .24, env: 'pluck', notes: fromProg(skProg, 16, [0, '.', 2, '.'], 2) },
    ] });
  // ---------- Superkendal battle: "Royal Guard Hopeful" ----------
  const skbProg = 'Gm D# F D Gm D# Cm D';
  A.define('skbattle', {
    bpm: 168, dvol: .2, drums: 'k . h k s . h . k k h . s . h s', ch: [
      { inst: 'sq25', vol: .1, notes:
        'G5*2 A#5*2 D6*2 A#5*2 G5*2 A5*2 A#5*4  G5*2 A#5*2 D#6*4 D6*4 A#5*4  A5*2 C6*2 F6*4 D#6*2 D6*2 C6*4  D6*4 F#5*4 A5*8 ' +
        'A#5*2 A5*2 G5*4 D6*4 G6*4  F6*2 D#6*2 D6*4 A#5*4 G5*4  C6*2 D#6*2 G6*4 F6*2 D#6*2 D6*4  D6*8 F#6*8' },
      { inst: 'tri', vol: .24, env: 'pluck', notes: fromProg(skbProg, 16, [0, 3], 2) },
      { inst: 'sq12', vol: .035, env: 'pluck', notes: fromProg(skbProg, 16, [0, 1, 2, 1], 4) },
    ] });

  // ---------- Catty: "Ten Coins Says" ----------
  A.define('catty', {
    bpm: 140, swing: .1, dvol: .18, drums: 'k . h . s . h . k . h k s . h .', ch: [
      { inst: 'sq50', vol: .08, notes:
        'A4 . C5 . E5 . A5 . G#5 . A5 . E5*4  F5 . E5 . D5 . F5 . A5*4 D5*4  G#5 . B5 . D6 . B5 . G#5*4 E5*4  A5*2 .*2 E5*2 .*2 A4*8 ' +
        'C6 . B5 . A5 . E5 . C5*4 E5*4  D5 . F5 . A5 . D6 . C6*4 A5*4  C6 . A5 . F5 . A5 . C6*4 F6*4  E6*4 D6*4 B5*4 G#5*4' },
      { inst: 'tri', vol: .22, env: 'pluck', notes: fromProg('Am Dm E7 Am Am Dm F E7', 16, [0, '.', '.', '.', 2, '.', '.', '.'], 2) },
      { inst: 'sq12', vol: .04, env: 'pluck', notes: fromProg('Am Dm E7 Am Am Dm F E7', 16, ['.', '.', 'c', '.', '.', '.', 'c', '.'], 3) },
    ] });

  // ---------- Empty (genocide ambience) ----------
  A.define('empty', {
    bpm: 40, ch: [
      { inst: 'sine', vol: .12, env: 'pad', notes: 'D2+G#2*64' },
      { inst: 'sine', vol: .06, env: 'bell', echo: true, notes: 'D5*16 .*16 .*16 G#4*16 .*32 .*32' },
    ] });

  // ---------- Workshop (prologue) ----------
  A.define('workshop', {
    bpm: 100, dvol: .1, drums: 'h . . . h . . . h . . . h . . .', ch: [
      { inst: 'sine', vol: .1, env: 'pad', notes: 'C2+G2*64 C#2+G#2*64' },
      { inst: 'sq12', vol: .04, env: 'pluck', echo: true, notes: 'C6 .*7 .*8 G5 .*7 .*8 .*16 D#6 .*7 .*8' },
    ] });

  // ---------- Game over ----------
  A.define('gameover', {
    bpm: 66, ch: [
      { inst: 'tri', vol: .2, echo: true, notes: 'E5*8 D5*4 C5*4 B4*8 A4*8 C5*8 B4*4 A4*4 G#4*16' },
      { inst: 'tri', vol: .14, env: 'pad', notes: 'A2*16 F2*16 A2*16 E2*16' },
    ] });

  // ---------- Chapter end: "Until Then" ----------
  const endProg = 'F Dm A# C F C A# F';
  A.define('end', {
    bpm: 80, ch: [
      { inst: 'tri', vol: .2, echo: true, notes: 'C5*4 F5*4 A5*4 G5*4  F5*4 E5*4 D5*8  A#4*4 D5*4 F5*4 E5*4  C5*16  A4*4 C5*4 F5*4 A5*4  G5*4 F5*4 E5*8  D5*4 F5*4 A#5*4 A5*4  F5*16' },
      { inst: 'sq12', vol: .04, env: 'pluck', notes: fromProg(endProg, 16, [0, '.', 1, '.', 2, '.', 3, '.'], 4) },
      { inst: 'tri', vol: .16, notes: fromProg(endProg, 16, [0, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'], 2) },
    ] });
})();
