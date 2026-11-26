'use strict';
// ============================================================
//  Monster battle sprites (drawn in colour, shown in B&W)
// ============================================================
(function () {
  const Pix = U.Pix, Art = U.Art;
  const M = U.Monsters = { defs: {} };
  M.def = (id, fn) => { M.defs[id] = fn; };
  M.raw = (id, frame, mood) => Art.cached('mraw|' + id + '|' + frame + '|' + mood, () => M.defs[id](frame, mood || 'normal'));
  M.bw = (id, frame, mood) => Art.cached('mbw|' + id + '|' + frame + '|' + mood, () => Art.bw(M.raw(id, frame, mood)));
  M.color = (id, frame, mood) => Art.cached('mcol|' + id + '|' + frame + '|' + mood, () => Art.outline(M.raw(id, frame, mood)));
  const K = '#1c1410';

  function eyes(p, x1, x2, y, mood, k) {
    k = k || K;
    if (mood === 'happy') { [x1, x2].forEach(x => { p.px(x - 1, y + 1, k); p.hl(x, x + 1, y, k); p.px(x + 2, y + 1, k); }); }
    else if (mood === 'hurt') { [x1, x2].forEach(x => { p.px(x - 1, y - 1, k); p.px(x + 1, y + 1, k); p.px(x, y, k); p.px(x + 1, y - 1, k); p.px(x - 1, y + 1, k); }); }
    else if (mood === 'scared') { [x1, x2].forEach(x => { p.rect(x - 1, y - 1, 3, 4, '#ffffff'); p.px(x, y + 1, k); }); }
    else if (mood === 'angry') { p.rect(x1, y, 2, 2, k); p.rect(x2, y, 2, 2, k); p.line(x1 - 1, y - 2, x1 + 2, y - 1, k); p.line(x2 - 1, y - 1, x2 + 2, y - 2, k); }
    else { p.rect(x1, y, 2, 2, k); p.rect(x2, y, 2, 2, k); }
  }
  function mouthM(p, cx, y, mood, k) {
    k = k || K;
    if (mood === 'happy') { p.px(cx - 2, y, k); p.hl(cx - 1, cx + 1, y + 1, k); p.px(cx + 2, y, k); }
    else if (mood === 'scared') { p.rect(cx - 1, y, 3, 2, k); }
    else if (mood === 'hurt' || mood === 'sad') { p.hl(cx - 1, cx + 1, y, k); p.px(cx - 2, y + 1, k); p.px(cx + 2, y + 1, k); }
    else if (mood === 'angry') { p.hl(cx - 2, cx + 2, y, k); }
    else { p.px(cx - 1, y, k); p.px(cx, y + 1, k); p.px(cx + 1, y, k); }
  }

  // ---------- Wickling: a shy little candle ----------
  M.def('wickling', (f, mood) => {
    const p = new Pix(24, 34);
    const wax = '#f3e7c9', waxD = '#d6c69e', waxL = '#fff8e6';
    p.rect(6, 30, 4, 3, waxD); p.rect(14, 30, 4, 3, waxD);
    p.rect(5, 13, 14, 18, wax); p.rect(16, 13, 3, 18, waxD); p.hl(5, 18, 13, waxL);
    p.rect(6, 12, 3, 4, waxL); p.rect(7, 16, 2, 3, waxL); p.rect(12, 12, 2, 6, waxL); p.rect(15, 12, 3, 3, waxL); p.px(16, 15, waxL);
    eyes(p, 8, 14, 19, mood); mouthM(p, 12, 24, mood === 'normal' ? 'sad' : mood);
    p.rect(11, 9, 2, 4, '#3a2a1a');
    const small = mood === 'scared' || mood === 'hurt';
    const sway = [0, 1, 0, -1][f % 4];
    const fh = small ? 3 : 5;
    p.ellipse(12, 9 - fh + 2, small ? 2 : 4, fh, '#ff9a2a');
    p.tri(12 - 3, 5, 12 + sway, small ? 3 : 0, 12 + 3, 5, '#ff9a2a');
    p.ellipse(12, 9 - fh + 3, small ? 1 : 2, fh - 2, '#ffe23a');
    p.px(12, 7, '#ffffff'); p.px(12, 8, '#ffffff');
    return p.c;
  });

  // ---------- Mothmote: a dusty moth drawn to your light ----------
  M.def('mothmote', (f, mood) => {
    const p = new Pix(36, 30);
    const wing = '#a89880', wingD = '#7a6a56', spot = '#4a3a2a', spotL = '#e8d8b0', fur = '#d8cfc0', furL = '#f2ead8';
    const ry = f % 2 ? 6 : 9, wy = f % 2 ? 13 : 12;
    for (const s of [-1, 1]) {
      const cx = 18 + s * 9;
      p.ellipse(cx, wy, 8, ry, wing); p.ellipse(cx + s * 2, wy + 3, 5, Math.max(2, ry - 4), wingD);
      p.circle(cx + s * 1, wy - 1, 2, spot); p.px(cx + s * 1, wy - 1, spotL);
    }
    p.ellipse(18, 17, 5, 9, fur); p.noise(13, 9, 11, 18, furL, .25, 4);
    for (let y = 18; y < 25; y += 3) p.hl(15, 21, y, '#b8a890');
    p.line(16, 8, 13, 2, wingD); p.line(20, 8, 23, 2, wingD); p.rect(12, 1, 2, 2, wingD); p.rect(23, 1, 2, 2, wingD);
    p.ellipse(18, 10, 4, 3, fur);
    eyes(p, 15, 20, 9, mood, '#0e0a08');
    if (mood === 'normal' || mood === 'angry') { p.px(15, 9, '#ffffff'); p.px(20, 9, '#ffffff'); }
    p.vl(15, 26, 28, wingD); p.vl(21, 26, 28, wingD);
    return p.c;
  });

  // ---------- Drizzle: a gloomy little raincloud ----------
  M.def('drizzle', (f, mood) => {
    const p = new Pix(38, 38);
    const c = '#8a96b4', cL = '#aab6d2', cD = '#6a7694', rain = '#5fb0ff';
    const drops = mood === 'happy' ? 2 : 6;
    for (let k = 0; k < drops; k++) { const x = 7 + k * 5, y = 25 + ((f * 3 + k * 5) % 10); p.vl(x, y, y + 2, rain); }
    [[10, 15, 7], [18, 11, 9], [27, 15, 7], [18, 18, 8], [12, 19, 5], [25, 19, 5]].forEach(([x, y, r]) => p.circle(x, y, r, c));
    [[16, 7, 5], [9, 12, 3], [26, 11, 3]].forEach(([x, y, r]) => p.circle(x, y, r, cL));
    p.hl(7, 30, 24, cD); p.hl(9, 28, 25, cD);
    if (mood === 'happy') { p.circle(30, 6, 4, '#ffe23a'); }
    eyes(p, 13, 22, 15, mood === 'normal' ? 'normal' : mood);
    if (mood === 'normal') { p.line(12, 12, 15, 13, K); p.line(22, 13, 25, 12, K); }
    mouthM(p, 18, 20, mood === 'normal' ? 'sad' : mood);
    return p.c;
  });

  // ---------- Shiverbit: an ice cube in a scarf ----------
  M.def('shiverbit', (f, mood) => {
    const p = new Pix(32, 34);
    const ice = '#b8ecff', iceL = '#e4f9ff', iceD = '#86c8e8', scarf = '#d83a3a', scarfL = '#f06a6a';
    p.rect(8, 29, 4, 4, iceD); p.rect(20, 29, 4, 4, iceD);
    p.rect(5, 8, 21, 21, ice); p.rect(7, 5, 21, 4, iceL); p.px(6, 6, iceL); p.px(5, 7, iceL);
    p.rect(26, 7, 3, 21, iceD); p.px(28, 6, iceD);
    p.line(8, 11, 12, 9, '#ffffff'); p.line(8, 14, 14, 10, iceL);
    p.rect(4, 20, 23, 4, scarf); for (let x = 6; x < 26; x += 4) p.vl(x, 20, 23, scarfL);
    p.rect(19, 23, 4, 9, scarf); p.vl(20, 23, 31, scarfL); p.hl(19, 22, 31, '#a82a2a');
    eyes(p, 11, 18, 13, mood);
    if (mood === 'happy') { p.px(10, 17, K); p.hl(11, 19, 18, K); p.px(20, 17, K); }
    else { p.rect(11, 16, 9, 3, '#ffffff'); p.hl(11, 19, 16, K); p.hl(11, 19, 18, K); p.vl(11, 16, 18, K); p.vl(19, 16, 18, K); for (let x = 13; x < 19; x += 2) p.px(x + (f % 2), 17, K); }
    return p.c;
  });

  // ---------- Pinebark: a pine-tree Royal Guard reservist ----------
  M.def('pinebark', (f, mood) => {
    const p = new Pix(34, 44);
    const g = '#2f6b3a', gL = '#3c8048', gD = '#22522c', s = '#f4f8ff', bark = '#6b4a2a';
    p.rect(11, 37, 4, 7 - (f % 2), bark); p.rect(19, 37, 4, 6 + (f % 2), bark);
    p.tri(2, 38, 17, 14, 32, 38, g); p.tri(6, 37, 17, 16, 17, 37, gL); p.hl(2, 32, 38, gD);
    p.tri(5, 26, 17, 6, 29, 26, g); p.tri(8, 25, 17, 8, 17, 25, gL); p.hl(5, 29, 26, gD);
    p.tri(9, 14, 17, 1, 25, 14, g); p.hl(9, 25, 14, gD);
    for (let x = 4; x < 32; x += 4) p.px(x, 38, s); for (let x = 7; x < 29; x += 4) p.px(x, 26, s);
    p.tri(14, 6, 17, 1, 20, 6, s);
    // little helmet
    p.rect(14, 0, 7, 3, '#b8bcc8'); p.hl(14, 20, 2, '#8a8e9a'); p.rect(16, -1 + 1, 3, 1, '#d84a4a');
    // branch arm + shield
    p.line(28, 30, 33, 26, bark); p.rect(0, 27, 7, 9, '#8a5a36'); p.rect(1, 28, 5, 7, '#a8784a'); p.rect(3, 29, 1, 5, '#d8ac44'); p.hl(2, 4, 31, '#d8ac44');
    eyes(p, 13, 20, 28, mood);
    if (mood === 'normal') { p.line(12, 26, 15, 27, K); p.line(20, 27, 23, 26, K); }
    mouthM(p, 17, 33, mood === 'normal' ? 'angry' : mood);
    return p.c;
  });

  // ---------- Generic "nothing" placeholder ----------
  M.def('nothing', () => new Pix(2, 2).c);
})();
