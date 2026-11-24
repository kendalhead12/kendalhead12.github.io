// Pixel World — procedural pixel-art sprites (8px per tile detail scale).
(function () {
'use strict';
const PW = globalThis.PW; const U = PW.U;
const SP = PW.SP = {};

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function pat(rows, pal) {
  const h = rows.length, w = rows[0].length; const c = cv(w, h); const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x]; const col = pal[ch]; if (!col) continue; g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  return c;
}
function draw(w, h, fn) { const c = cv(w, h); const g = c.getContext('2d'); fn((col, x, y, ww, hh) => { g.fillStyle = col; g.fillRect(x, y, ww || 1, hh || 1); }, g); return c; }

const OAK = ['..aaaa..', '.abbbba.', 'abccbbba', 'abcbbbba', 'abbbbbda', 'adbbbdda', '.adddda.', '...tt...', '...tt...'];
const PINE = ['...a...', '..aba..', '..abd..', '.abcba.', '.abbda.', 'abcbbda', '..abd..', '.abbbd.', 'abcbbdd', '...t...'];
const JUNGLE = ['.aa..aa.', 'abbaabba', 'abcbbcba', 'abbbbbba', 'abbdbbda', '.abdbda.', '..adda..', '...tt...', '..vtt...', '...tt...'];
const ACACIA = ['.aaaaaa.', 'abbcbbba', '.adddda.', '..t..t..', '...tt...', '...t....', '...t....'];
const PALM = ['aa...aa', '.abcba.', 'a.aba.a', '...t...', '...t...', '..t....', '..t....'];
const WILLOW = ['..aaaa..', '.abbbba.', 'abbcbbba', 'ab.bb.ba', 'a..tt..a', 'a..tt..a', '...tt...'];
const CACTUS = ['..a..', '..b..', 'b.b..', 'bbb.b', '..bbb', '..b..', '..b..'];
const MOUNT = ['...ab...', '..abbc..', '..abbbc.', '.abbbbc.', '.abbbbcc', 'abbbbbcc', 'abbbbbbc', 'abbbbbbc'];
const MOUNT_S = ['...ss...', '..sssc..', '..asbsc.', '.abbbsc.', '.abbbbcc', 'abbbbbcc', 'abbbbbbc', 'abbbbbbc'];

SP.init = () => {
  if (SP.ready) return;
  // ---- vegetation ----
  SP.tree = {
    oak: [pat(OAK, { a: '#2c5a26', b: '#3f8a34', c: '#6cb84f', d: '#2f6a2a', t: '#5a3a1e' }), pat(OAK, { a: '#2a5224', b: '#4a8e36', c: '#7cc25a', d: '#356c2c', t: '#5e3e20' }), pat(OAK, { a: '#3a5a22', b: '#5e8e30', c: '#8cba4e', d: '#4a7026', t: '#5a3a1e' })],
    pine: [pat(PINE, { a: '#173a2a', b: '#24563a', c: '#3a7a50', d: '#1a4630', t: '#4a2e18' }), pat(PINE, { a: '#183c2c', b: '#2a5e40', c: '#447e56', d: '#1d4a34', t: '#4a2e18' })],
    snowpine: [pat(PINE, { a: '#1a3a34', b: '#2a5048', c: '#f2f6fa', d: '#dfe8ee', t: '#4a2e18' }), pat(PINE, { a: '#1c3c36', b: '#305a50', c: '#ffffff', d: '#26463e', t: '#4a2e18' })],
    jungle: [pat(JUNGLE, { a: '#14501e', b: '#1f7a2a', c: '#3eaa3a', d: '#176224', t: '#5a3a1e', v: '#2e8a30' }), pat(PALM, { a: '#1a6a22', b: '#2a8a30', c: '#5cbc48', t: '#7a5a30' })],
    acacia: [pat(ACACIA, { a: '#4a5a1e', b: '#6a7a2a', c: '#94a43e', d: '#556622', t: '#5a3e22' })],
    willow: [pat(WILLOW, { a: '#36502a', b: '#4d6a36', c: '#6e8a48', t: '#4a3420' })],
  };
  SP.deco = {
    cactus: pat(CACTUS, { a: '#e870a0', b: '#4a8a3a' }),
    flower: [pat(['.f.', 'fyf', '.g.'], { f: '#f4f0f8', y: '#f4d040', g: '#3a7a2a' }), pat(['.f.', 'fyf', '.g.'], { f: '#e85a6a', y: '#f8e080', g: '#3a7a2a' }), pat(['.f.', 'fyf', '.g.'], { f: '#8a6ae8', y: '#f8e080', g: '#3a7a2a' })],
    bush: pat(['.bb.', 'bcbb', 'bbbd'], { b: '#3a7a2e', c: '#5a9a44', d: '#2a5a22' }),
    rock: pat(['.rr.', 'rRrr', 'rrrd'], { r: '#8a8680', R: '#b0aca4', d: '#605c58' }),
    reed: pat(['a.a.', 'a.aa', '.aa.', '..a.'], { a: '#5a7a3a' }),
    puddle: pat(['.ww.', 'wWww', '.ww.'], { w: '#4a7a7a', W: '#7ab0b0' }),
    tuft: pat(['b.b', '.b.'], { b: '#7a8a5a' }),
    dune: pat(['..dd..', '.dDDd.', 'dDDDDd'], { d: '#d8b878', D: '#e8cc90' }),
  };
  SP.mount = [pat(MOUNT, { a: '#4a4440', b: '#8a8078', c: '#625a54' }), pat(MOUNT_S, { a: '#4a4440', b: '#8a8078', c: '#625a54', s: '#f4f8fc' }), pat(MOUNT, { a: '#504a44', b: '#968a80', c: '#6a625a' })];
  SP.hill = pat(['..aa....', '.abba...', 'abbbca..', '.....ab.', '....abbc'], { a: '#6a6660', b: '#a09c94', c: '#7a766e' });

  // ---- houses by era (3 roof variants each) ----
  const roofs = [
    [['#8a6a2a', '#c9a24a'], ['#7a5a26', '#b8923e'], ['#94742e', '#d4ac56']],
    [['#7a2e22', '#b04a32'], ['#6a4a2a', '#9a6a3a'], ['#7a3a2a', '#c0603a']],
    [['#3a3238', '#5a4a52'], ['#4a2a22', '#7a3a2a'], ['#2a3a4a', '#4a5a6a']],
    [['#3a3a44', '#54545e'], ['#5a2a22', '#8a3a2a'], ['#2a4a3a', '#3a6a4a']],
    [['#3a3a40', '#4e4e56'], ['#4a3028', '#6a463a'], ['#30343c', '#464c58']],
    [['#5a6068', '#8a9098'], ['#3a4a5a', '#6a7a8a'], ['#6a5a4a', '#9a8a78']],
  ];
  SP.house = [];
  SP.house[0] = roofs[0].map(([a, b]) => pat(['...aa...', '..abba..', '.abbbba.', 'aabbbbaa', '.cccccc.', '.ccddcc.', '.ccddcc.'], { a, b, c: '#8b5a34', d: '#3a2414' }));
  SP.house[1] = roofs[1].map(([a, b]) => pat(['........', '.aaaaaa.', 'abbbbbba', 'cccccccc', 'cecccecc', 'cccddccc', 'cccddccc'], { a, b, c: '#9a948a', e: '#3a4a5a', d: '#4a3020' }));
  SP.house[2] = roofs[2].map(([a, b]) => pat(['...aa...', '..abba..', '.abbbba.', 'abbbbbba', 'cwcwwcwc', 'cwdwcewc', 'cwdwcwwc'], { a, b, w: '#e8e0cc', c: '#5a3a22', d: '#3a2414', e: '#6a8aa0' }));
  SP.house[3] = roofs[3].map(([a, b]) => pat(['......k.', '.aaaaak.', 'abbbbbba', 'rrrrrrrr', 'rwrrrwrr', 'rrrdrrrr', 'rrrdrrrr'], { a, b, k: '#5a3a30', r: '#a0442e', w: '#cfe4f0', d: '#3a2414' }));
  SP.house[4] = roofs[4].map(([a, b], v) => pat(['.k....k.', 'aaaaaaaa', 'bbbbbbbb', 'rwrrwrrw', 'rrrrrrrr', 'rwrrwrrw', 'rrrddrrr', 'rrrddrrr'], { a, b, k: '#3a3030', r: ['#8a3a2a', '#7a4a3a', '#6a5a52'][v], w: '#e8d890', d: '#2a2020' }));
  SP.house[5] = roofs[5].map(([a, b]) => pat(['aaaaaaaa', 'wwwwwwww', 'wggwwggw', 'wggwwggw', 'wwwwwwww', 'wgwddwgw', 'wwwddwww'], { a, b, w: '#eceae4', g: '#5aa0d0', d: '#3a4048' }));
  // ---- dense urban towers by era ----
  SP.tower = [];
  SP.tower[0] = SP.house[0]; SP.tower[1] = SP.house[1];
  SP.tower[2] = roofs[2].map(([a, b]) => pat(['...aa...', '..abba..', '.abbbba.', 'abbbbbba', 'cwcwwcwc', 'cwewcewc', 'cccccccc', 'cwcwwcwc', 'cwdwcewc', 'cwdwcwwc'], { a, b, w: '#e8e0cc', c: '#5a3a22', d: '#3a2414', e: '#6a8aa0' }));
  SP.tower[3] = roofs[3].map(([a, b]) => pat(['.k....k.', '.aaaaaa.', 'abbbbbba', 'rrrrrrrr', 'rwrwrwrr', 'rrrrrrrr', 'rwrwrwrr', 'rrrrrrrr', 'rwrdrwrr', 'rrrdrrrr'], { a, b, k: '#5a3a30', r: '#a8503a', w: '#cfe4f0', d: '#3a2414' }));
  SP.tower[4] = [0, 1, 2].map(v => draw(8, 13, (p) => {
    const body = ['#7a3a2a', '#6a5a50', '#5a4a44'][v]; p('#3a3030', 1, 0, 1, 2); p('#3a3030', 6, 0, 1, 2); p('#2a2a2e', 0, 2, 8, 1); p(body, 0, 3, 8, 10);
    for (let y = 4; y < 12; y += 2) for (let x = 1; x < 7; x += 2) p(U.hf(x, y, v) < 0.6 ? '#e8d890' : '#4a4a50', x, y, 1, 1);
    p('#2a2020', 3, 11, 2, 2);
  }));
  SP.tower[5] = [0, 1, 2, 3].map(v => {
    const hgt = [16, 20, 24, 14][v];
    return draw(8, hgt, (p) => {
      const glass = ['#4a7aa0', '#3a5a7a', '#5a8a9a', '#6a7a8a'][v], frame = ['#2a3a4a', '#223040', '#2a4048', '#3a4048'][v];
      p(frame, 0, 2, 8, hgt - 2); p(glass, 1, 3, 6, hgt - 4);
      for (let y = 4; y < hgt - 1; y += 2) for (let x = 1; x < 7; x++) if (U.hf(x, y, v + 9) < 0.35) p('#f0e8a0', x, y, 1, 1);
      p('#9ab8d0', 1, 3, 1, hgt - 4);
      if (v < 2) { p(frame, 3, 0, 2, 2); p('#d04040', 3, 0, 1, 1); }
    });
  });
  // ---- centres (town hall / castle / palace...) ----
  SP.center = [];
  SP.center[0] = draw(8, 9, (p) => { // longhouse with totem
    p('#5a3a1e', 0, 0, 1, 9); p('#c84a30', 0, 0, 1, 2); p('#e8c040', 0, 3, 1, 1);
    p('#8a6a2a', 3, 1, 2, 1); p('#8a6a2a', 2, 2, 4, 1); p('#c9a24a', 3, 2, 2, 1); p('#8a6a2a', 1, 3, 7, 1); p('#c9a24a', 2, 3, 5, 1); p('#c9a24a', 1, 4, 7, 1);
    p('#8b5a34', 2, 5, 6, 4); p('#3a2414', 4, 6, 2, 3);
  });
  SP.center[1] = draw(8, 9, (p) => { // stone hall with columns
    p('#8a8478', 3, 0, 2, 1); p('#a8a296', 2, 1, 4, 1); p('#a8a296', 1, 2, 6, 1); p('#c4beb0', 0, 3, 8, 1);
    for (let x = 0; x < 8; x += 2) p('#e0dace', x, 4, 1, 4); p('#7a7468', 1, 4, 1, 4); p('#7a7468', 3, 4, 1, 4); p('#3a3028', 3, 5, 2, 3); p('#7a7468', 5, 4, 1, 4); p('#7a7468', 7, 4, 1, 4);
    p('#9a948a', 0, 8, 8, 1);
  });
  SP.center[2] = draw(8, 12, (p) => { // castle
    p('#5a3a1e', 4, 0, 1, 4); p('#c8302a', 5, 0, 2, 2);
    p('#8a8478', 0, 3, 2, 9); p('#8a8478', 6, 3, 2, 9); p('#6a6458', 0, 2, 1, 1); p('#6a6458', 7, 2, 1, 1); p('#6a6458', 1, 2, 1, 1); p('#6a6458', 6, 2, 1, 1);
    p('#a09a8e', 2, 4, 4, 8); p('#7a7468', 2, 3, 1, 1); p('#7a7468', 5, 3, 1, 1);
    p('#3a2a20', 3, 9, 2, 3); p('#2a3040', 3, 6, 1, 1); p('#2a3040', 0, 6, 1, 1); p('#2a3040', 7, 6, 1, 1); p('#5a5448', 0, 11, 8, 1);
  });
  SP.center[3] = draw(8, 11, (p) => { // palace with dome
    p('#d4a830', 3, 0, 2, 1); p('#4a8a8a', 2, 1, 4, 1); p('#5aa0a0', 1, 2, 6, 2); p('#3a7070', 1, 3, 1, 1);
    p('#e8dcc0', 0, 4, 8, 7); for (let x = 0; x < 8; x += 2) p('#cfe4f0', x + 1, 6, 1, 2); p('#c8b890', 0, 4, 8, 1); p('#4a3020', 3, 8, 2, 3);
  });
  SP.center[4] = draw(8, 14, (p) => { // town hall with clock tower
    p('#3a3a44', 3, 0, 2, 1); p('#7a4a3a', 2, 1, 4, 6); p('#f0f0e0', 3, 2, 2, 2); p('#2a2a2a', 3, 2, 1, 1);
    p('#3a3a44', 0, 6, 8, 1); p('#9a5a40', 0, 7, 8, 7); for (let x = 1; x < 8; x += 2) p('#e8d890', x, 8, 1, 2); for (let x = 1; x < 8; x += 2) p('#e8d890', x, 11, 1, 1); p('#2a2020', 3, 12, 2, 2);
  });
  SP.center[5] = draw(8, 26, (p) => { // tallest skyscraper
    p('#8a9aa8', 3, 0, 1, 4); p('#ff4040', 3, 0, 1, 1); p('#2a3440', 1, 4, 6, 22); p('#5a8ab0', 2, 5, 4, 20); p('#2a3440', 0, 10, 8, 16); p('#5a8ab0', 1, 11, 6, 14);
    for (let y = 6; y < 25; y += 2) for (let x = 1; x < 7; x++) if (U.hf(x, y, 77) < 0.4) p('#f4ecb0', x, y, 1, 1);
    p('#a8c8e0', 2, 5, 1, 20);
  });
  // ---- temples ----
  SP.temple = [];
  SP.temple[0] = draw(8, 7, (p) => { p('#7a7a7a', 1, 3, 1, 4); p('#7a7a7a', 6, 3, 1, 4); p('#9a9a9a', 0, 2, 8, 1); p('#7a7a7a', 3, 4, 2, 3); p('#e8a030', 3, 3, 2, 1); });
  SP.temple[1] = draw(8, 9, (p) => { p('#d8d0bc', 3, 0, 2, 1); p('#e8e0cc', 1, 1, 6, 2); p('#fff8e8', 0, 3, 8, 1); for (let x = 0; x < 8; x += 2) p('#f0e8d4', x, 4, 1, 4); p('#c8a040', 3, 5, 2, 3); p('#bab2a0', 0, 8, 8, 1); });
  SP.temple[2] = draw(8, 13, (p) => { p('#d4a830', 3, 0, 1, 2); p('#5a5a64', 2, 2, 3, 4); p('#7a7a84', 3, 2, 1, 4); p('#a8a096', 1, 6, 6, 7); p('#6a5a80', 2, 7, 1, 2); p('#6a5a80', 5, 7, 1, 2); p('#d070a0', 3, 7, 2, 2); p('#3a2a20', 3, 10, 2, 3); p('#4a4a54', 0, 6, 1, 7); p('#4a4a54', 7, 6, 1, 7); });
  SP.temple[3] = SP.temple[2]; SP.temple[4] = SP.temple[2]; SP.temple[5] = SP.temple[2];
  // ---- markets ----
  SP.market = [];
  const stall = (cols) => draw(8, 6, (p) => { for (let k = 0; k < 2; k++) { const x = k * 4; p(cols[k], x, 0, 4, 2); p('#ffffff', x + 1, 0, 1, 2); p('#5a3a1e', x, 2, 1, 4); p('#5a3a1e', x + 3, 2, 1, 4); p('#c8a050', x, 4, 4, 1); p(['#e05030', '#70b040', '#e0c040'][k], x + 1, 3, 2, 1); } });
  SP.market[2] = stall(['#c83a3a', '#3a6ac8']); SP.market[3] = stall(['#3a9a5a', '#c89a3a']);
  SP.market[4] = draw(8, 8, (p) => { p('#3a3a44', 0, 0, 8, 1); p('#c8b890', 0, 1, 8, 7); p('#a03030', 0, 2, 8, 1); p('#cfe4f0', 1, 4, 2, 2); p('#cfe4f0', 5, 4, 2, 2); p('#4a3020', 3, 5, 2, 3); });
  SP.market[5] = draw(8, 8, (p) => { p('#2a3440', 0, 0, 8, 8); p('#7ab0d8', 1, 1, 6, 4); p('#f0a030', 0, 5, 8, 1); p('#2a2a2a', 3, 6, 2, 2); });
  SP.market[0] = SP.market[2]; SP.market[1] = SP.market[2];
  // ---- factories ----
  SP.factory = [];
  SP.factory[4] = draw(8, 12, (p) => { p('#4a3a34', 6, 0, 2, 7); p('#6a5a54', 6, 0, 2, 1); p('#7a3a2a', 0, 5, 8, 7); p('#5a2a20', 0, 4, 2, 1); p('#5a2a20', 2, 4, 2, 1); p('#3a3a3a', 0, 5, 1, 1); p('#3a3a3a', 2, 5, 1, 1); p('#3a3a3a', 4, 5, 1, 1); for (let x = 1; x < 6; x += 2) p('#e8c860', x, 7, 1, 2); p('#2a2020', 3, 10, 2, 2); });
  SP.factory[5] = draw(8, 10, (p) => { p('#8a9098', 6, 0, 2, 5); p('#c84040', 6, 1, 2, 1); p('#a8b0b8', 0, 3, 8, 7); p('#5a8ab0', 1, 5, 5, 2); p('#4a5058', 0, 3, 8, 1); p('#3a4048', 3, 8, 2, 2); });
  for (let e = 0; e < 4; e++) SP.factory[e] = SP.factory[4];
  // ---- ports ----
  SP.port = [];
  const dock = (wood, boat) => draw(8, 8, (p) => { p(wood, 0, 3, 8, 2); p('#4a3018', 1, 5, 1, 2); p('#4a3018', 6, 5, 1, 2); p(boat, 2, 0, 4, 2); p('#e8e0cc', 3, -1 + 1, 1, 1); p('#3a2010', 2, 2, 4, 1); });
  SP.port[0] = dock('#8a6a40', '#7a5a30'); SP.port[1] = dock('#8a6a40', '#a05a30'); SP.port[2] = dock('#7a5a38', '#8a3a2a'); SP.port[3] = draw(8, 9, (p) => { p('#7a5a38', 0, 4, 8, 2); p('#4a3018', 1, 6, 1, 3); p('#4a3018', 6, 6, 1, 3); p('#5a3a20', 2, 2, 5, 2); p('#e8e0cc', 4, 0, 1, 2); p('#f0ece0', 3, 0, 1, 1); });
  SP.port[4] = draw(8, 12, (p) => { p('#6a6a70', 0, 8, 8, 2); p('#c8a030', 1, 0, 1, 8); p('#c8a030', 1, 0, 6, 1); p('#3a3a3a', 6, 1, 1, 3); p('#7a3a2a', 3, 5, 4, 2); p('#4a4a50', 0, 10, 8, 2); });
  SP.port[5] = draw(8, 12, (p) => { p('#9aa0a8', 0, 8, 8, 2); p('#e06030', 1, 0, 1, 8); p('#e06030', 1, 0, 6, 1); p('#3a3a3a', 6, 1, 1, 3); p('#3a7ac8', 2, 5, 2, 3); p('#c83a3a', 4, 5, 2, 3); p('#6a7078', 0, 10, 8, 2); });
  SP.ruin = draw(8, 5, (p) => { p('#7a766e', 0, 3, 2, 2); p('#8a867e', 1, 1, 1, 2); p('#6a665e', 4, 2, 3, 3); p('#8a867e', 5, 0, 1, 2); p('#5a564e', 3, 4, 1, 1); });
  SP.tent = [pat(['..a..', '.aba.', 'abbba', 'abdba'], { a: '#7a5a3a', b: '#c8a878', d: '#3a2414' }), pat(['..a..', '.aba.', 'abbba', 'abdba'], { a: '#6a4a3a', b: '#b89070', d: '#3a2414' })];
  SP.fire = [pat(['.f.', 'fyf', 'lll'], { f: '#e85a20', y: '#f8d040', l: '#5a3a1e' }), pat(['f..', '.yf', 'lll'], { f: '#f07a30', y: '#f8e060', l: '#5a3a1e' })];
  SP.boat = [pat(['...s....', '..ss....', '..ss.s..', 'hhhhhhhh', '.hhhhhh.'], { s: '#f0ece0', h: '#7a4a2a' }), pat(['....k...', '..wwkww.', 'hhhhhhhh', '.hhhhhh.'], { k: '#3a3a3a', w: '#e8e8e8', h: '#3a4a6a' })];
  // ---- clouds ----
  SP.clouds = [];
  for (let k = 0; k < 8; k++) {
    const w = 40 + (k * 13) % 40, h = 16 + (k * 7) % 12;
    SP.clouds.push(draw(w, h, (p) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2), dy = (y - h * 0.6) / (h / 2);
        const n = U.noise(x / 6 + k * 10, y / 6, 333) * 0.6;
        const v = 1 - (dx * dx + dy * dy * 1.6) + n - 0.3;
        if (v > 0.2) p(v > 0.55 && y < h * 0.55 ? '#ffffff' : '#e6ecf4', x, y, 1, 1);
      }
    }));
  }
  SP.ready = true;
};
})();
