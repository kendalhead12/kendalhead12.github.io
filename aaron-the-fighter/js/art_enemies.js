'use strict';
// ============================================================
//  Enemy sprites (procedural pixel art, outlined)
// ============================================================
(function () {
  const OL = '#140a18';
  const P = (w, h) => new AF.Pix(w, h);
  const fin = (p, ax, ay, ol) => { p.outline(ol || OL); return p.spr(ax === undefined ? p.w >> 1 : ax, ay === undefined ? p.h : ay); };
  const E = {};
  const eye = (p, x, y, c) => { p.rect(x, y, 2, 2, c || '#ff3040'); p.set(x, y, '#ffffff'); };

  E.beetle = () => { // robotic beetle 20x14
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(22, 16);
      // legs
      for (let k = 0; k < 3; k++) { const lx = 5 + k * 5, off = ((i + k) & 1) ? 1 : -1; p.line(lx, 11, lx + off, 15, '#303040'); }
      p.shadeEll(10, 8, 9, 6, ['#1a5a30', '#2e9a48', '#58d068', '#c0ffc0']);
      p.rect(10, 3, 1, 10, '#1a4a28');
      p.shadeEll(18, 9, 3.5, 3.5, ['#404050', '#6a6a80', '#a0a0b8']);
      eye(p, 19, 8, i === 2 ? '#ffffff' : '#ff3030');
      p.line(20, 6, 22, 3, '#6a6a80');
      out.push(fin(p, 11, 16));
    }
    return out;
  };
  E.thorn = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(24, 16);
      p.shadeEll(12, 10, 10, 5.5, ['#3a2060', '#6a3a90', '#9a60c0', '#d0a0f0']);
      for (let k = 0; k < 5; k++) { const x = 4 + k * 4; p.poly([[x - 2, 7], [x, 0 + ((k + i) & 1)], [x + 2, 7]], '#58c040'); p.set(x, 2 + ((k + i) & 1), '#c0ff80'); }
      for (let k = 0; k < 4; k++) p.rect(5 + k * 4 + (i ? 1 : 0), 14, 2, 2, '#2a1a40');
      eye(p, 19, 9, '#ffe020'); eye(p, 16, 9, '#ffe020');
      out.push(fin(p, 12, 16));
    }
    return out;
  };
  E.wasp = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(22, 18);
      p.ell(8, 7 - i * 2, 6, 3, i ? '#e0f8ff' : '#c0e8f8'); p.ell(13, 6 - i * 2, 4, 2.5, '#e0f8ff');
      p.shadeEll(7, 11, 6, 4, ['#806000', '#e0b020', '#ffe060']);
      p.rect(4, 8, 1, 7, '#202020'); p.rect(7, 8, 1, 7, '#202020');
      p.poly([[1, 11], [-1, 14], [3, 12]], '#404040');
      p.shadeEll(15, 11, 4, 3.5, ['#404050', '#6a6a80', '#a0a0b8']); eye(p, 16, 10, '#ff3030');
      p.line(18, 9, 21, 6, '#404050');
      out.push(fin(p, 11, 13));
    }
    return out;
  };
  E.robofish = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(24, 14);
      p.shadeEll(11, 7, 9, 5.5, ['#3a3a60', '#6a6aa0', '#a0a0d8', '#ffffff']);
      p.poly([[2, 7], [-1 + i, 1], [-1 + i, 13]], '#f06020');
      p.poly([[10, 2], [14, -1], [16, 3]], '#f06020');
      p.rect(14, 9, 6, 1, '#202030'); p.set(19, 8, '#ffffff'); p.set(17, 10, '#ffffff');
      eye(p, 15, 4, '#40ff80');
      out.push(fin(p, 12, 7));
    }
    return out;
  };
  E.jelly = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(20, 24);
      const sq = i === 1 ? 1 : 0;
      p.ell(10, 7 + sq, 8 + sq, 6 - sq, i === 2 ? '#ffffa0' : '#e060c0'); p.ell(9, 6 + sq, 6, 4 - sq, i === 2 ? '#ffffff' : '#ffa0e8'); p.rect(3, 9, 15, 3, i === 2 ? '#ffff60' : '#b03090');
      for (let k = 0; k < 4; k++) { const x = 4 + k * 4; for (let y = 12; y < 22 - sq * 2; y++) p.set(x + Math.round(Math.sin(y * .5 + k + i) * 1), y, i === 2 ? '#ffff60' : '#c050b0'); }
      p.set(7, 7, '#2a0a20'); p.set(12, 7, '#2a0a20');
      out.push(fin(p, 10, 12, i === 2 ? '#806000' : OL));
    }
    return out;
  };
  E.crab = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(28, 18);
      for (let k = 0; k < 3; k++) { p.line(8 + k * 3, 12, 5 + k * 3 - (i & 1), 17, '#a02818'); p.line(17 + k * 3, 12, 20 + k * 3 + (i & 1), 17, '#a02818'); }
      p.shadeEll(14, 10, 9, 5, ['#701818', '#c83828', '#f07050', '#ffc0a0']);
      p.rect(6, 9, 16, 2, '#808898'); p.rect(6, 9, 16, 1, '#c0c8d8');
      const up = i === 2 ? 5 : 0;
      p.shadeEll(24, 8 - up, 4, 3.5, ['#701818', '#c83828', '#f07050']); p.rect(25, 6 - up, 3, 1, '#2a0a0a');
      p.shadeEll(4, 8 - up, 4, 3.5, ['#701818', '#c83828', '#f07050']); p.rect(1, 6 - up, 3, 1, '#2a0a0a');
      p.rect(11, 3, 1, 4, '#701818'); p.rect(16, 3, 1, 4, '#701818'); eye(p, 10, 2, '#000000'); eye(p, 16, 2, '#000000');
      out.push(fin(p, 14, 18));
    }
    return out;
  };
  E.snowdrone = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(24, 18);
      p.rect(2, 1, 20, 2, '#606878'); p.rect(i ? 2 : 10, 0, 10, 1, '#c0c8d8');
      p.rect(11, 2, 2, 3, '#606878');
      p.shadeEll(12, 10, 8, 6, ['#5a70a8', '#90a8e0', '#d0e0ff', '#ffffff']);
      p.rect(6, 9, 12, 3, '#203060'); eye(p, 9, 10, '#40e0ff'); eye(p, 13, 10, '#40e0ff');
      p.rect(9, 15, 6, 2, '#606878');
      out.push(fin(p, 12, 9));
    }
    return out;
  };
  E.icebat = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(24, 16);
      if (i === 2) { p.shadeEll(12, 8, 4, 6, ['#304080', '#5070c0', '#90b0f0']); p.ell(12, 9, 6, 5, '#304080'); eye(p, 10, 9, '#ff60ff'); eye(p, 13, 9, '#ff60ff'); out.push(fin(p, 12, 0)); continue; }
      const up = i ? -4 : 3;
      p.poly([[12, 7], [1, 7 + up], [4, 11 + up / 2], [8, 9]], '#6080d0'); p.poly([[12, 7], [23, 7 + up], [20, 11 + up / 2], [16, 9]], '#6080d0');
      p.shadeEll(12, 8, 4, 4.5, ['#304080', '#5070c0', '#90b0f0', '#ffffff']);
      p.set(10, 4, '#304080'); p.set(14, 4, '#304080'); eye(p, 10, 7, '#ff60ff'); eye(p, 13, 7, '#ff60ff');
      p.set(11, 11, '#ffffff'); p.set(13, 11, '#ffffff');
      out.push(fin(p, 12, 8));
    }
    return out;
  };
  E.slime = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(20, 16);
      const sh = [[8, 5.5, 10], [9.5, 4, 12], [7, 7, 8]][i];
      p.shadeEll(10, sh[2], sh[0], sh[1], ['#3070c0', '#60b0f0', '#a0e0ff', '#ffffff']);
      p.rect(10 - sh[0] + 1, 15, sh[0] * 2 - 2, 1, '#3070c0');
      p.rect(6, sh[2] - 1, 2, 3, '#102050'); p.rect(12, sh[2] - 1, 2, 3, '#102050'); p.set(6, sh[2] - 1, '#ffffff'); p.set(12, sh[2] - 1, '#ffffff');
      p.set(5, sh[2] - sh[1] + 2, '#ffffff');
      out.push(fin(p, 10, 16));
    }
    return out;
  };
  E.sprite = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(18, 22);
      p.poly([[9, 0 + i], [15, 10], [13, 18], [5, 18], [3, 10]], '#ff4010'); p.poly([[9, 4 + i], [13, 11], [11, 17], [7, 17], [5, 11]], '#ffa020');
      p.shadeEll(9, 13, 4, 4, ['#ffa020', '#ffe060', '#ffffff']);
      p.rect(7, 12, 1, 2, '#401000'); p.rect(10, 12, 1, 2, '#401000');
      if (i === 2) { p.rect(7, 15, 4, 1, '#401000'); }
      out.push(fin(p, 9, 11, '#601000'));
    }
    return out;
  };
  E.mcrawler = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(26, 16);
      p.shadeEll(13, 9, 11, 6, ['#1c0c10', '#3a1c20', '#5c2c2c', '#7c4038']);
      for (let k = 0; k < 4; k++) { const x = 6 + k * 4; p.rect(x, 5 + (k & 1), 2, 6, '#ff6a18'); p.set(x, 6 + (k & 1), '#ffc040'); }
      for (let k = 0; k < 4; k++) p.rect(5 + k * 5 + (i ? 1 : 0), 14, 2, 2, '#1c0c10');
      eye(p, 21, 8, '#ffe020');
      out.push(fin(p, 13, 16));
    }
    return out;
  };
  E.turret = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(22, 20);
      p.rect(3, 12, 16, 8, '#4a3a3a'); p.rect(3, 12, 16, 2, '#7a5a5a'); p.rect(5, 16, 12, 2, '#2a1818');
      p.shadeEll(11, 10, 6, 5, ['#4a2020', '#8a3030', '#c05040', '#ff9070']);
      p.rect(14, 8, 8, 4, '#3a3a48'); p.rect(14, 8, 8, 1, '#8a8a98'); p.rect(20, 8, 2, 4, i ? '#ffc040' : '#2a1818');
      eye(p, 9, 8, '#ffe020');
      out.push(fin(p, 11, 20));
    }
    return out;
  };
  E.secbot = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(22, 28);
      const lg = i === 1 ? 1 : 0;
      p.rect(6, 18, 4, 9 - lg, '#404858'); p.rect(12, 18, 4, 9 + lg - 1, '#404858'); p.rect(5, 26 - lg, 6, 2, '#202830'); p.rect(11, 26, 6, 2, '#202830');
      p.rect(3, 8, 16, 12, '#c0c8d8'); p.rect(3, 8, 16, 2, '#ffffff'); p.rect(3, 17, 16, 3, '#808898'); p.rect(8, 12, 6, 4, '#f0c020');
      p.rect(5, 1, 12, 8, '#8890a8'); p.rect(5, 1, 12, 1, '#c0c8d8'); p.rect(7, 3, 9, 3, '#101828'); p.rect(i === 2 ? 12 : 10, 4, 3, 1, '#ff3030');
      p.rect(17, 11, 5, 3, '#404858'); if (i === 2) p.rect(21, 11, 1, 3, '#ffe040');
      p.rect(0, 10, 3, 7, '#404858');
      out.push(fin(p, 11, 28));
    }
    return out;
  };
  E.drone = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(22, 16);
      p.rect(0, 2, 8, 1, i ? '#c0c8d8' : '#606878'); p.rect(14, 2, 8, 1, i ? '#606878' : '#c0c8d8');
      p.rect(3, 3, 2, 3, '#404858'); p.rect(17, 3, 2, 3, '#404858');
      p.shadeEll(11, 9, 8, 5, ['#303848', '#606878', '#a0a8b8', '#ffffff']);
      p.ell(11, 10, 3, 3, '#101020'); p.ell(11, 10, 1.5, 1.5, '#ff2040'); p.set(10, 9, '#ffffff');
      out.push(fin(p, 11, 9));
    }
    return out;
  };
  E.gear = () => {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const p = P(20, 20);
      const a0 = i * Math.PI / 16;
      const pts = []; for (let k = 0; k < 16; k++) { const a = a0 + k / 16 * 6.283, r = k & 1 ? 7 : 9.5; pts.push([10 + Math.cos(a) * r, 10 + Math.sin(a) * r]); }
      p.poly(pts, '#a08050'); p.circ(10, 10, 6, '#c8a060'); p.circ(10, 10, 3, '#5a4020');
      eye(p, 7, 8, '#ff3030'); eye(p, 11, 8, '#ff3030');
      out.push(fin(p, 10, 20));
    }
    return out;
  };
  E.worm = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(18, 18);
      p.shadeEll(9, 9, 8, 8, ['#6a3a18', '#a8642c', '#d09048', '#f0c070']);
      for (let k = 0; k < 8; k++) { const a = k * .785; p.poly([[9 + Math.cos(a) * 3, 9 + Math.sin(a) * 3], [9 + Math.cos(a + .3) * 8, 9 + Math.sin(a + .3) * 8], [9 + Math.cos(a - .3) * 8, 9 + Math.sin(a - .3) * 8]], i ? '#ffffff' : '#f0e0c0'); }
      p.circ(9, 9, 3, '#401818');
      out.push(fin(p, 9, 9));
    }
    const seg = P(14, 14); seg.shadeEll(7, 7, 6, 6, ['#6a3a18', '#a8642c', '#d09048', '#f0c070']); seg.rect(1, 6, 12, 1, '#6a3a18'); out.push(fin(seg, 7, 7));
    return out;
  };
  E.scarab = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(22, 16);
      p.ell(7, 5 - i * 2, 6, 2.5, '#c0e0ff'); p.ell(14, 5 - i * 2, 6, 2.5, '#c0e0ff');
      p.shadeEll(11, 9, 8, 5.5, ['#1a3a80', '#2a60c0', '#40a0f0', '#c0f0ff']);
      p.rect(11, 5, 1, 9, '#f0c020'); p.rect(4, 9, 15, 1, '#f0c020');
      p.shadeEll(18, 10, 3, 3, ['#605020', '#c0a040', '#ffe080']); eye(p, 19, 9, '#ff3030');
      out.push(fin(p, 11, 9));
    }
    return out;
  };
  E.scorp = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(28, 22);
      for (let k = 0; k < 3; k++) p.line(9 + k * 4, 17, 8 + k * 4 + ((i + k) & 1 ? 2 : -2), 21, '#5a3a18');
      p.shadeEll(14, 15, 9, 4, ['#6a4018', '#b07030', '#e0a050', '#ffe0a0']);
      const tl = i === 2 ? 2 : 0;
      p.thick(6, 14, 3, 8, 1.6, '#b07030'); p.thick(3, 8, 6 + tl, 2, 1.6, '#b07030'); p.thick(6 + tl, 2, 11 + tl * 2, 2 + tl, 1.6, '#b07030');
      p.circ(12 + tl * 2, 3 + tl, 2.2, '#ff4040');
      p.shadeEll(24, 13, 3, 3, ['#6a4018', '#b07030', '#e0a050']); p.rect(25, 11, 3, 1, '#3a2008');
      eye(p, 20, 12, '#40ff60');
      out.push(fin(p, 14, 22));
    }
    return out;
  };
  E.flybot = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(24, 20);
      p.poly([[4, 8], [0, 3 + i * 3], [9, 7]], '#c0c8e0'); p.poly([[20, 8], [24, 3 + i * 3], [15, 7]], '#c0c8e0');
      p.shadeEll(12, 9, 7, 6, ['#304070', '#5070b0', '#90b0e8', '#ffffff']);
      p.rect(8, 7, 8, 3, '#101830'); eye(p, 11, 8, '#ffe040');
      p.rect(10, 15, 4, 3, '#404858'); p.ell(12, 18 + i, 2, 1.5, '#80e0ff');
      out.push(fin(p, 12, 9));
    }
    return out;
  };
  E.wisp = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(20, 22);
      p.poly([[10, 21], [4 + i, 12], [16 - i, 12]], '#6050c0');
      p.shadeEll(10, 9, 7, 7, ['#4030a0', '#7060e0', '#b0a0ff', '#ffffff']);
      p.rect(7, 8, 2, 3, '#ffffff'); p.rect(11, 8, 2, 3, '#ffffff');
      if (i === 2) { p.line(2, 2, 6, 6, '#fff060'); p.line(18, 2, 14, 6, '#fff060'); }
      out.push(fin(p, 10, 11, '#1a1050'));
    }
    return out;
  };
  E.ldrone = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(26, 18);
      p.shadeEll(13, 7, 11, 5, ['#3a3a48', '#6a6a80', '#a0a0b8', '#ffffff']);
      p.rect(4, 6, 18, 2, '#fff060'); p.rect(11, 11, 4, 4, '#404858'); p.rect(12, 15, 2, 3, i ? '#ffffff' : '#fff060');
      eye(p, 8, 4, '#80f0ff'); eye(p, 16, 4, '#80f0ff');
      out.push(fin(p, 13, 9));
    }
    return out;
  };
  E.guard = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(28, 32);
      const lg = i === 1 ? 2 : 0;
      p.rect(9, 20, 4, 11 - lg, '#302a48'); p.rect(15, 20, 4, 11, '#302a48'); p.rect(8, 30 - lg, 6, 2, '#1a1428'); p.rect(14, 30, 6, 2, '#1a1428');
      p.rect(7, 9, 14, 12, '#5a4a8a'); p.rect(7, 9, 14, 2, '#8a7ac0'); p.rect(11, 13, 6, 4, '#ff3070');
      p.rect(9, 1, 10, 9, '#3a3060'); p.rect(9, 1, 10, 1, '#6a5aa0'); p.rect(11, 4, 8, 2, '#ff3070');
      // shield on front
      p.rect(20, 7 + (i === 2 ? -2 : 0), 6, 18, '#8090b0'); p.rect(20, 7 + (i === 2 ? -2 : 0), 2, 18, '#c0d0f0'); p.rect(22, 14 + (i === 2 ? -2 : 0), 2, 4, '#30f0c0');
      if (i === 2) { p.rect(0, 12, 8, 3, '#c0c0d0'); p.rect(0, 12, 8, 1, '#ffffff'); }
      out.push(fin(p, 14, 32));
    }
    return out;
  };
  E.lturret = () => {
    const out = [];
    for (let i = 0; i < 2; i++) {
      const p = P(20, 20);
      p.rect(2, 13, 16, 7, '#2a2840'); p.rect(2, 13, 16, 2, '#4a4670');
      p.shadeEll(10, 10, 7, 6, ['#2a2840', '#4a4670', '#7a76a8', '#c0c0ff']);
      p.ell(10, 10, 3, 3, '#100818'); p.ell(10, 10, 1.6, 1.6, i ? '#ffffff' : '#ff2060');
      out.push(fin(p, 10, 20));
    }
    return out;
  };
  E.exbot = () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const p = P(26, 26);
      const sq = i === 1 ? 3 : 0;
      p.rect(5, 20 - sq, 5, 6 + sq, '#404858'); p.rect(16, 20 - sq, 5, 6 + sq, '#404858');
      p.shadeEll(13, 13 + sq / 2, 10, 8 - sq / 2, ['#2a5a3a', '#40a060', '#80e0a0', '#e0fff0']);
      p.rect(7, 8 + sq, 12, 6, '#102018'); p.ell(13, 11 + sq, 4, 2, '#80ffb0'); eye(p, 12, 10 + sq, '#ff2060');
      p.rect(22, 12, 4, 3, '#606878'); if (i === 2) p.rect(25, 12, 1, 3, '#ffe040');
      p.rect(12, 1 + sq, 2, 5, '#606878'); p.circ(13, 1 + sq, 1.5, '#ff4060');
      out.push(fin(p, 13, 26));
    }
    return out;
  };

  AF.buildEnemyArt = function () {
    AF.SPR.en = {};
    for (const k in E) AF.SPR.en[k] = E[k]();
  };
})();
