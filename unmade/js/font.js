'use strict';
// ============================================================
//  Bitmap font (5x7 + descenders), text drawing, typewriter
// ============================================================
(function () {
  const G = {
    'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.',
    'C': '.###.|#...#|#....|#....|#....|#...#|.###.', 'D': '####.|#...#|#...#|#...#|#...#|#...#|####.',
    'E': '#####|#....|#....|####.|#....|#....|#####', 'F': '#####|#....|#....|####.|#....|#....|#....',
    'G': '.###.|#...#|#....|#.###|#...#|#...#|.####', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.', 'J': '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
    'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', 'L': '#....|#....|#....|#....|#....|#....|#####',
    'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.', 'P': '####.|#...#|#...#|####.|#....|#....|#....',
    'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', 'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.', 'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    'W': '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', 'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
    'a': '.....|.....|.###.|....#|.####|#...#|.####', 'b': '#....|#....|####.|#...#|#...#|#...#|####.',
    'c': '.....|.....|.###.|#....|#....|#...#|.###.', 'd': '....#|....#|.####|#...#|#...#|#...#|.####',
    'e': '.....|.....|.###.|#...#|#####|#....|.###.', 'f': '..##.|.#..#|.#...|###..|.#...|.#...|.#...',
    'g': '.....|.....|.####|#...#|#...#|.####|....#|#...#|.###.', 'h': '#....|#....|#.##.|##..#|#...#|#...#|#...#',
    'i': '..#..|.....|.##..|..#..|..#..|..#..|.###.', 'j': '...#.|.....|..##.|...#.|...#.|...#.|...#.|#..#.|.##..',
    'k': '#....|#....|#..#.|#.#..|##...|#.#..|#..#.', 'l': '.##..|..#..|..#..|..#..|..#..|..#..|.###.',
    'm': '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', 'n': '.....|.....|#.##.|##..#|#...#|#...#|#...#',
    'o': '.....|.....|.###.|#...#|#...#|#...#|.###.', 'p': '.....|.....|####.|#...#|#...#|####.|#....|#....|#....',
    'q': '.....|.....|.####|#...#|#...#|.####|....#|....#|....#', 'r': '.....|.....|#.##.|##..#|#....|#....|#....',
    's': '.....|.....|.###.|#....|.###.|....#|####.', 't': '.#...|.#...|###..|.#...|.#...|.#..#|..##.',
    'u': '.....|.....|#...#|#...#|#...#|#..##|.##.#', 'v': '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
    'w': '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', 'x': '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    'y': '.....|.....|#...#|#...#|#...#|.####|....#|#...#|.###.', 'z': '.....|.....|#####|...#.|..#..|.#...|#####',
    '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
    '2': '.###.|#...#|....#|...#.|..#..|.#...|#####', '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
    '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
    '6': '..##.|.#...|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
    '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.', '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
    ' ': '.....', '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
    '.': '.....|.....|.....|.....|.....|.....|..#..', ',': '.....|.....|.....|.....|.....|..#..|..#..|.#...',
    "'": '..#..|..#..|.#...', '"': '.#.#.|.#.#.', ':': '.....|.....|..#..|.....|.....|..#..|.....',
    ';': '.....|.....|..#..|.....|.....|..#..|..#..|.#...', '-': '.....|.....|.....|.###.', '+': '.....|..#..|..#..|#####|..#..|..#..',
    '=': '.....|.....|#####|.....|#####', '/': '....#|....#|...#.|..#..|.#...|#....|#....',
    '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.', ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
    '*': '.....|..#..|#.#.#|.###.|#.#.#|..#..', '%': '##..#|##..#|...#.|..#..|.#...|#..##|#..##',
    '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
    '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.', '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
    '[': '.###.|.#...|.#...|.#...|.#...|.#...|.###.', ']': '.###.|...#.|...#.|...#.|...#.|...#.|.###.',
    '_': '.....|.....|.....|.....|.....|.....|#####', '~': '.....|.....|.#...|#.#.#|...#.',
    '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.', '$': '..#..|.####|#.#..|.###.|..#.#|####.|..#..',
    '^': '..#..|.#.#.|#...#', '•': '.....|.....|..#..|.###.|..#..', '—': '.....|.....|.....|#####',
    '♪': '..##.|..#.#|..#..|..#..|###..|###..', '♥': '.....|##.##|#####|#####|.###.|..#..',
    '…': '.....|.....|.....|.....|.....|.....|#.#.#', 'é': '...#.|..#..|.###.|#...#|#####|#....|.###.',
    '·': '.....|.....|.....|..#..',
  };
  const F = U.Font = { ADV: 6, LINE: 12, glyphs: {} };
  for (const k in G) {
    const rows = G[k].split('|');
    const px = [];
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === '#') px.push(x, y); });
    F.glyphs[k] = px;
  }
  // Creator glyphs: a strange, deterministic alphabet
  F.creatorGlyph = function (ch) {
    const key = '§' + ch;
    if (F.glyphs[key]) return F.glyphs[key];
    const r = U.rng(ch.charCodeAt(0) * 7919 + 13);
    const on = new Set();
    const strokes = 2 + Math.floor(r() * 2);
    for (let s = 0; s < strokes; s++) {
      if (r() < .5) { const x = Math.floor(r() * 5), y0 = Math.floor(r() * 3), y1 = 4 + Math.floor(r() * 3); for (let y = y0; y <= y1; y++) on.add(x + ',' + y); }
      else { const y = Math.floor(r() * 7), x0 = Math.floor(r() * 2), x1 = 3 + Math.floor(r() * 2); for (let x = x0; x <= x1; x++) on.add(x + ',' + y); }
    }
    if (r() < .6) on.add('2,' + Math.floor(r() * 7));
    const px = []; on.forEach(s => { const [x, y] = s.split(',').map(Number); px.push(x, y); });
    F.glyphs[key] = px;
    return px;
  };

  F.glyph = function (ctx, ch, x, y, scale) {
    const px = F.glyphs[ch] || F.glyphs['?'];
    const s = scale || 1;
    for (let i = 0; i < px.length; i += 2) ctx.fillRect(x + px[i] * s, y + px[i + 1] * s, s, s);
  };
  F.raw = function (ctx, ch, x, y, s, px) { for (let i = 0; i < px.length; i += 2) ctx.fillRect(x + px[i] * s, y + px[i + 1] * s, s, s); };

  // Simple draw (no tags). align: 'left' | 'center' | 'right'
  F.draw = function (ctx, text, x, y, color, opts) {
    opts = opts || {};
    const s = opts.scale || 1;
    text = String(text);
    let w = text.length * F.ADV * s - s;
    if (opts.align === 'center') x -= Math.floor(w / 2);
    else if (opts.align === 'right') x -= w;
    if (opts.shadow) { ctx.fillStyle = opts.shadow; for (let i = 0; i < text.length; i++) F.glyph(ctx, text[i], x + i * F.ADV * s + s, y + s, s); }
    ctx.fillStyle = color || '#fff';
    for (let i = 0; i < text.length; i++) {
      let ox = 0, oy = 0;
      if (opts.shake) { ox = Math.round(U.rand(-opts.shake, opts.shake)); oy = Math.round(U.rand(-opts.shake, opts.shake)); }
      if (opts.wave) oy += Math.round(Math.sin(U.frame * .15 + i * .6) * opts.wave);
      if (opts.creator && U.hash(i, Math.floor(U.frame / 6)) < opts.creator) { F.raw(ctx, text[i], x + i * F.ADV * s + ox, y + oy, s, F.creatorGlyph(text[i])); continue; }
      F.glyph(ctx, text[i], x + i * F.ADV * s + ox, y + oy, s);
    }
    return w;
  };
  F.width = (text, s) => String(text).length * F.ADV * (s || 1) - (s || 1);

  // ---------------- rich text ----------------
  // Tags: {y}{r}{b}{g}{o}{p}{x}{w} colours, {s} toggle shake, {v} toggle wave,
  // {c} toggle creator-glyph corruption, {,} short pause, {.} long pause, {q} toggle silent blips
  const COL = { y: '#ffe23a', r: '#ff3838', b: '#4fd8ff', g: '#5cff6a', o: '#ff9a2a', p: '#ff7ce0', x: '#8a8a8a', w: null };
  F.COL = COL;
  F.tokenize = function (text, baseColor) {
    const out = [];
    let color = baseColor, shake = false, wave = false, creator = false, quiet = false, pause = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '{') {
        const j = text.indexOf('}', i);
        if (j > i) {
          const tag = text.slice(i + 1, j);
          i = j;
          if (tag in COL) color = COL[tag] || baseColor;
          else if (tag === 's') shake = !shake;
          else if (tag === 'v') wave = !wave;
          else if (tag === 'c') creator = !creator;
          else if (tag === 'q') quiet = !quiet;
          else if (tag === ',') pause += 10;
          else if (tag === '.') pause += 26;
          continue;
        }
      }
      out.push({ ch, color, shake, wave, creator, quiet, pause });
      pause = 0;
    }
    return out;
  };
  // word wrap tokens into lines (array of token arrays). '\n' forces break.
  F.wrapTokens = function (toks, maxChars, indent) {
    const lines = []; let line = [];
    let i = 0;
    const ind = indent || 0;
    function push() { lines.push(line); line = []; for (let k = 0; k < ind; k++) line.push({ ch: ' ', color: null, pad: true }); }
    while (i < toks.length) {
      const t = toks[i];
      if (t.ch === '\n') { lines.push(line); line = []; i++; if (t.para) { /* bullet paragraphs handled by caller */ } continue; }
      // gather word
      let j = i; while (j < toks.length && toks[j].ch !== ' ' && toks[j].ch !== '\n') j++;
      const wlen = j - i;
      if (line.length + wlen > maxChars && line.length > ind) {
        // trim trailing space
        while (line.length && line[line.length - 1].ch === ' ' && !line[line.length - 1].pad) line.pop();
        push();
      }
      for (let k = i; k < j; k++) { if (line.length >= maxChars) push(); line.push(toks[k]); }
      i = j;
      if (i < toks.length && toks[i].ch === ' ') { if (line.length && !line.every(t => t.pad)) line.push(toks[i]); i++; }
    }
    lines.push(line);
    return lines;
  };

  // ---------------- typewriter ----------------
  // opts: voice, maxChars, bullet (narration bullets + hanging indent), color, lineH, speed override
  class Typer {
    constructor(text, opts) {
      this.o = opts || {};
      const base = this.o.color || '#fff';
      let src = String(text == null ? '' : text);
      if (U.State && U.State.run) src = src.replace(/\$NAME/g, U.State.run.name);
      let toks = [];
      if (this.o.bullet) {
        const paras = src.split('\n');
        paras.forEach((p, pi) => {
          const pt = F.tokenize(p, base);
          const lines = F.wrapTokens([{ ch: '•', color: base }, { ch: ' ', color: base }].concat(pt), this.o.maxChars || 40, 2);
          lines.forEach((ln, li) => { toks = toks.concat(ln); toks.push({ ch: '\n' }); });
        });
        this.lines = F.wrapTokens(toks, 999, 0);
        if (this.lines.length && this.lines[this.lines.length - 1].length === 0) this.lines.pop();
      } else {
        this.lines = F.wrapTokens(F.tokenize(src, base), this.o.maxChars || 40, 0);
      }
      this.total = this.lines.reduce((a, l) => a + l.length, 0);
      this.shown = 0; this.delay = 0; this.blipN = 0; this.done = this.total === 0;
      this.lineH = this.o.lineH || 14;
      this.acc = 0;
    }
    get speed() {
      if (this.o.speed != null) return this.o.speed;
      return [0.5, 1, 2, 999][U.opts.textSpeed == null ? 1 : U.opts.textSpeed];
    }
    tokAt(n) { let k = n; for (const l of this.lines) { if (k < l.length) return l[k]; k -= l.length; } return null; }
    update() {
      if (this.done) return;
      if (this.delay > 0) { this.delay--; return; }
      this.acc += this.speed;
      while (this.acc >= 1 && !this.done) {
        this.acc -= 1;
        const t = this.tokAt(this.shown);
        this.shown++;
        if (this.shown >= this.total) this.done = true;
        if (!t) continue;
        if (t.pause && this.speed < 50) { this.delay = t.pause; this.acc = 0; }
        if (t.ch !== ' ' && !t.pad && !t.quiet && this.o.voice !== 'none') {
          if (this.blipN++ % 2 === 0 && U.Audio) U.Audio.blip(this.o.voice || 'narr');
        }
        if ('.!?,'.includes(t.ch) && this.speed < 50) { const nx = this.tokAt(this.shown); if (nx && nx.ch === ' ') { this.delay = Math.max(this.delay, t.ch === ',' ? 3 : 6); this.acc = 0; break; } }
        if (this.delay) break;
      }
    }
    skip() { this.shown = this.total; this.done = true; }
    draw(ctx, x, y, opts) {
      let n = this.shown;
      const s = (opts && opts.scale) || 1;
      for (let li = 0; li < this.lines.length && n > 0; li++) {
        const l = this.lines[li];
        for (let ci = 0; ci < l.length && n > 0; ci++, n--) {
          const t = l[ci];
          if (t.ch === ' ' || t.ch === '\n') continue;
          let ox = 0, oy = 0;
          if (t.shake && U.frame % 2 === 0) { ox = U.randi(-1, 1); oy = U.randi(-1, 1); }
          else if (t.shake) { ox = Math.round(U.hash(li * 50 + ci, U.frame >> 1) * 2 - 1); }
          if (t.wave) oy += Math.round(Math.sin(U.frame * .16 + ci * .7) * 1.5);
          ctx.fillStyle = t.color || (opts && opts.color) || '#fff';
          const gx = x + ci * F.ADV * s + ox, gy = y + li * this.lineH + oy;
          if (t.creator && U.hash(li * 77 + ci, U.frame >> 2) < .7) F.raw(ctx, t.ch, gx, gy, s, F.creatorGlyph(t.ch));
          else F.glyph(ctx, t.ch, gx, gy, s);
        }
      }
    }
  }
  U.Typer = Typer;
})();
