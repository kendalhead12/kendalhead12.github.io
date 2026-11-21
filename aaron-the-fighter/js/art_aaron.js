'use strict';
// ============================================================
//  Aaron sprite generator (paper-doll rig -> pixel frames)
// ============================================================
(function () {
  const PAL = {
    shirt: ['#8c1428', '#d02430', '#f04838', '#ff8a6a'],
    pants: ['#1a2470', '#2c4cc0', '#4a78e8', '#80a8ff'],
    boot: ['#4a240c', '#7a4018', '#a8642c', '#d08a48'],
    glove: ['#201a30', '#3a3450', '#5c5678'],
    skin: ['#c07048', '#e8a070', '#f8c898', '#fff0d8'],
    hair: ['#3c1a0a', '#6a3414', '#94501e', '#c47a34'],
    belt: '#3a200c', buckle: '#f8d040', eye: '#1a1438', ol: '#140a18'
  };
  AF.AARON_PAL = PAL;
  const FW = 36, FH = 40, AX = 18, AY = 38; // frame size & anchor (feet)

  function rot90(p, times) { // rotate Pix clockwise 90deg * times
    let src = p;
    for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
      const q = new AF.Pix(src.h, src.w);
      for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) q.d[x * q.w + (q.w - 1 - y)] = src.d[y * src.w + x];
      src = q;
    }
    return src;
  }
  AF.rot90 = rot90;

  const rad = a => a * Math.PI / 180;
  function seg(p, x0, y0, ang, len) { return [x0 + Math.sin(rad(ang)) * len, y0 + Math.cos(rad(ang)) * len]; }

  function drawLeg(p, hx, hy, a1, a2, back, kickFoot) {
    const c = back ? [PAL.pants[0], PAL.pants[1]] : [PAL.pants[1], PAL.pants[2]];
    const [kx, ky] = seg(p, hx, hy, a1, 5);
    const [fx, fy] = seg(p, kx, ky, a1 + a2, 5);
    p.thick(hx, hy, kx, ky, 2.1, c[0]);
    p.thick(kx, ky, fx, fy, 1.9, c[0]);
    p.thick(hx + .6, hy - .3, kx + .6, ky - .3, 1.1, c[1]);
    p.thick(kx + .6, ky, fx + .5, fy - 1, 1, c[1]);
    // boot
    const bc = back ? [PAL.boot[0], PAL.boot[1], PAL.boot[1]] : [PAL.boot[1], PAL.boot[2], PAL.boot[3]];
    const fxr = Math.round(fx), fyr = Math.round(fy);
    if (kickFoot) { // foot pointing along shin direction
      const [tx, ty] = seg(p, fx, fy, a1 + a2, 3);
      p.thick(fx, fy, tx, ty, 2.2, bc[0]); p.thick(fx, fy - .5, tx, ty - .5, 1.2, bc[1]);
    } else {
      p.rect(fxr - 2, fyr - 1, 6, 3, bc[0]);
      p.rect(fxr - 2, fyr - 1, 5, 1, bc[1]);
      p.set(fxr - 1, fyr - 1, bc[2]);
      p.rect(fxr - 2, fyr + 2, 6, 1, back ? '#2a1406' : '#3a1c08'); // sole
      p.set(fxr + 3, fyr + 1, bc[0]);
    }
    return [fx, fy];
  }
  function drawArm(p, sx, sy, a1, a2, back, fistBig) {
    const sh = back ? [PAL.shirt[0], PAL.shirt[1]] : [PAL.shirt[1], PAL.shirt[2]];
    const sk = back ? [PAL.skin[0], PAL.skin[1]] : [PAL.skin[1], PAL.skin[2]];
    const [ex, ey] = seg(p, sx, sy, a1, 4.2);
    const [hx, hy] = seg(p, ex, ey, a1 + a2, 4);
    p.thick(sx, sy, ex, ey, 1.8, sh[0]);
    p.thick(sx - .3, sy - .3, (sx + ex) / 2, (sy + ey) / 2 - .3, .9, sh[1]);
    p.thick(ex, ey, hx, hy, 1.3, sk[0]);
    p.thick(ex, ey - .3, hx, hy - .3, .6, sk[1]);
    // glove (fingerless): dark glove with skin knuckle strip
    const gx = Math.round(hx), gy = Math.round(hy);
    const g = back ? [PAL.glove[0], PAL.glove[1]] : [PAL.glove[1], PAL.glove[2]];
    const r = fistBig ? 2.6 : 2;
    p.ell(hx, hy, r, r, g[0]);
    p.set(gx - 1, gy - 1, g[1]);
    const dx = Math.sin(rad(a1 + a2)), dy = Math.cos(rad(a1 + a2));
    p.set(Math.round(hx + dx * 1.5), Math.round(hy + dy * 1.5), sk[1]);
    return [hx, hy];
  }
  function drawTorso(p, hx, hy, lean, crouch) {
    const sx = hx + lean, sy = hy - 8 + (crouch || 0);
    // shirt body
    const pts = [[hx - 4, hy + 1], [hx + 4.5, hy + 1], [sx + 4.5, sy + 2], [sx + 3, sy], [sx - 3, sy], [sx - 4.5, sy + 2]];
    p.poly(pts, PAL.shirt[1]);
    // shading: back strip darker, front highlight
    p.poly([[hx - 4, hy + 1], [hx - 2, hy + 1], [sx - 2.5, sy + 1], [sx - 4.5, sy + 2]], PAL.shirt[0]);
    p.poly([[hx + 1.5, hy], [hx + 3.5, hy], [sx + 3.5, sy + 2], [sx + 1.5, sy + 1.5]], PAL.shirt[2]);
    p.set(Math.round(sx + 2), Math.round(sy + 2), PAL.shirt[3]);
    p.set(Math.round(sx + 3), Math.round(sy + 2), PAL.shirt[3]);
    // collar
    p.set(Math.round(sx + 1), Math.round(sy), PAL.skin[1]); p.set(Math.round(sx + 2), Math.round(sy), PAL.skin[1]);
    p.set(Math.round(sx + 1), Math.round(sy + 1), PAL.skin[0]);
    // belt
    p.rect(Math.round(hx - 4), Math.round(hy - 1), 9, 2, PAL.belt);
    p.rect(Math.round(hx + 1), Math.round(hy - 1), 2, 2, PAL.buckle);
    return [sx, sy];
  }
  function drawHead(p, cx, cy, eye, mouth, look) {
    // cx, cy = center of face
    cx = Math.round(cx); cy = Math.round(cy);
    const H = PAL.hair, S = PAL.skin;
    // back hair mass
    p.ell(cx - 1.5, cy - 1.5, 6.2, 5.6, H[1]);
    // spikes (back/top)
    p.poly([[cx - 6, cy - 2], [cx - 10, cy - 5], [cx - 5, cy - 5]], H[1]);
    p.poly([[cx - 5, cy - 4], [cx - 8, cy - 9], [cx - 2, cy - 6]], H[1]);
    p.poly([[cx - 2, cy - 6], [cx - 1, cy - 11], [cx + 2, cy - 6]], H[1]);
    p.poly([[cx + 1, cy - 6], [cx + 5, cy - 10], [cx + 5, cy - 5]], H[1]);
    p.poly([[cx - 6, cy + 1], [cx - 9, cy + 1], [cx - 6, cy - 2]], H[0]);
    // face
    p.ell(cx + 1.8, cy + 1, 4.6, 4.6, S[2]);
    p.rect(cx + 4, cy + 2, 2, 2, S[2]);
    // jaw shading
    p.set(cx - 1, cy + 4, S[1]); p.set(cx, cy + 5, S[1]); p.set(cx + 1, cy + 5, S[1]); p.set(cx - 2, cy + 3, S[1]);
    p.set(cx + 2, cy + 5, S[1]);
    // ear
    p.rect(cx - 2, cy, 2, 3, S[1]); p.set(cx - 1, cy + 1, S[0]);
    // hair on top + bangs over forehead
    p.ell(cx + .5, cy - 3.5, 5.6, 3.4, H[1]);
    p.poly([[cx + 1, cy - 4], [cx + 7.5, cy - 2], [cx + 5, cy - 1], [cx + 4, cy + .5], [cx + 2.5, cy - 1], [cx + 1, cy]], H[1]);
    p.poly([[cx + 4, cy - 2], [cx + 7, cy - 1], [cx + 6.5, cy + 1], [cx + 5, cy - .5]], H[1]);
    // sideburn
    p.rect(cx - 3, cy - 1, 2, 3, H[1]); p.set(cx - 3, cy + 2, H[0]);
    // hair shading / highlights
    for (let i = -6; i <= 4; i++) p.set(cx + i, cy - 6 + Math.round(Math.abs(i + 1) * .25), H[2]);
    p.set(cx - 1, cy - 7, H[3]); p.set(cx, cy - 7, H[3]); p.set(cx + 1, cy - 6, H[3]); p.set(cx - 4, cy - 6, H[3]);
    p.set(cx + 3, cy - 4, H[2]); p.set(cx + 4, cy - 3, H[2]);
    p.rect(cx - 6, cy, 2, 2, H[0]); p.set(cx - 7, cy - 1, H[0]);
    // eye
    const ex = cx + 3 + (look || 0), ey = cy;
    if (eye === 'closed') { p.rect(ex - 1, ey + 2, 3, 1, PAL.eye); }
    else if (eye === 'hurt') { p.set(ex - 1, ey, PAL.eye); p.set(ex, ey + 1, PAL.eye); p.set(ex + 1, ey + 2, PAL.eye); p.set(ex + 1, ey, PAL.eye); p.set(ex - 1, ey + 2, PAL.eye); }
    else {
      p.rect(ex - 1, ey, 3, 3, '#ffffff');
      p.rect(ex, ey, 2, 3, PAL.eye);
      p.set(ex + 1, ey, '#ffffff');
      if (eye === 'angry') { p.rect(ex - 1, ey - 1, 3, 1, H[0]); p.set(ex - 1, ey, H[0]); }
      else p.rect(ex - 1, ey - 1, 3, 1, H[1]); // eyebrow
    }
    // nose & mouth
    p.set(cx + 6, cy + 2, S[1]);
    if (mouth === 'open') { p.rect(cx + 4, cy + 4, 2, 1, '#7a1820'); p.set(cx + 4, cy + 5, '#c84848'); }
    else if (mouth === 'grin') { p.rect(cx + 3, cy + 4, 3, 1, '#7a1820'); p.set(cx + 5, cy + 3, '#7a1820'); }
    else if (mouth === 'frown') { p.rect(cx + 4, cy + 4, 2, 1, '#7a1820'); p.set(cx + 3, cy + 5, '#7a1820'); }
    else p.rect(cx + 4, cy + 4, 2, 1, '#9a3030');
  }

  // pose: {by, bx, lean, fa:[a1,a2], ba:[a1,a2], fl:[a1,a2], bl:[a1,a2], eye, mouth, hb (head bob), kick, big}
  function build(pose) {
    const p = new AF.Pix(FW, FH);
    const hx = AX + (pose.bx || 0), hy = AY - 14 + (pose.by || 0);
    const lean = pose.lean || 0;
    const sx = hx + lean, sy = hy - 8 + (pose.crouch || 0);
    // back arm, back leg
    drawArm(p, sx - 1.5, sy + 2, pose.ba[0], pose.ba[1], true, pose.bigB);
    drawLeg(p, hx - 1.5, hy + 1, pose.bl[0], pose.bl[1], true, pose.kickB);
    drawLeg(p, hx + 1.5, hy + 1, pose.fl[0], pose.fl[1], false, pose.kick);
    drawTorso(p, hx, hy, lean, pose.crouch || 0);
    drawHead(p, sx + 1 + (pose.hx || 0), sy - 5 + (pose.hb || 0), pose.eye || 'open', pose.mouth || 'n', pose.look);
    drawArm(p, sx + 1.5, sy + 2, pose.fa[0], pose.fa[1], false, pose.big);
    return p;
  }
  function finish(p, rotate) {
    if (rotate) p = rot90(p, rotate);
    p.outline(PAL.ol);
    return p;
  }

  const P = {};
  // idle (fighting-stance-ish, relaxed)
  P.idle0 = { fa: [35, 70], ba: [-10, 60], fl: [12, -8], bl: [-12, 6] };
  P.idle1 = { by: 1, hb: 0, fa: [33, 75], ba: [-12, 62], fl: [14, -14], bl: [-13, 0] };
  P.blink = Object.assign({}, P.idle0, { eye: 'closed' });
  // walk 6
  const W = [[28, -10, -26, 18, 20, -40], [14, -4, -18, 30, 10, -45], [-6, -2, 0, 10, 0, -20], [-26, 18, 28, -10, -40, 20], [-18, 30, 14, -4, -45, 10], [0, 10, -6, -2, -20, 0]];
  W.forEach((w, i) => { P['walk' + i] = { by: (i % 3 === 1) ? -1 : 0, fl: [w[0], w[1]], bl: [w[2], w[3]], fa: [w[5] + 10, 50], ba: [w[4] - 5, 40] }; });
  // run 6 (lean forward, big stride, arms pumping)
  const R = [[55, -30, -40, -10], [30, -70, -20, -20], [-10, -60, 20, -40], [-40, -10, 55, -30], [-20, -20, 30, -70], [20, -40, -10, -60]];
  R.forEach((r, i) => { const s = i < 3 ? 1 : -1; P['run' + i] = { lean: 2, bx: 0, by: (i % 3 === 1) ? -1 : 0, fl: [r[0], r[1]], bl: [r[2], r[3]], fa: [s > 0 ? -40 : 70, s > 0 ? 80 : 90], ba: [s > 0 ? 70 : -40, s > 0 ? 90 : 80], eye: 'open' }; });
  P.jump = { by: -1, fl: [50, -70], bl: [-10, -30], fa: [150, 20], ba: [-50, 60], mouth: 'open' };
  P.apex = { fl: [40, -60], bl: [-5, -50], fa: [110, 40], ba: [-80, 40] };
  P.fall = { fl: [15, -25], bl: [-20, -10], fa: [130, -20], ba: [-120, 20], mouth: 'open' };
  P.land = { by: 3, crouch: 1, fl: [60, -100], bl: [-10, -60], fa: [40, 40], ba: [-30, 40] };
  P.crouch = { by: 6, crouch: 2, lean: 1, fl: [90, -150], bl: [50, -150], fa: [50, 70], ba: [20, 60] };
  P.crawl0 = { by: 12, crouch: 5, lean: 6, fl: [100, -170], bl: [60, -150], fa: [30, 20], ba: [-10, 40] };
  P.crawl1 = { by: 12, crouch: 5, lean: 6, fl: [70, -150], bl: [100, -170], fa: [-5, 40], ba: [35, 15] };
  P.climb0 = { fl: [30, -60], bl: [-5, 0], fa: [170, -10], ba: [150, 10], look: -1 };
  P.climb1 = { fl: [-5, 0], bl: [30, -60], fa: [150, 10], ba: [170, -10], look: -1, by: -1 };
  P.punch1 = { lean: 1, fl: [25, -10], bl: [-25, 10], fa: [90, 0], ba: [20, 100], eye: 'angry', mouth: 'open', big: 1 };
  P.punch1b = { lean: 0, fl: [22, -10], bl: [-22, 10], fa: [70, 50], ba: [10, 100], eye: 'angry' };
  P.punch2 = { lean: 2, bx: 1, fl: [28, -12], bl: [-28, 14], fa: [10, 80], ba: [95, 0], eye: 'angry', mouth: 'open', bigB: 1 };
  P.punch3 = { lean: 3, bx: 2, by: -1, fl: [35, -20], bl: [-35, 10], fa: [125, -10], ba: [-30, 70], eye: 'angry', mouth: 'grin', big: 1 };
  P.windup = { lean: -1, by: 1, fl: [20, -20], bl: [-20, 0], fa: [-50, 110], ba: [40, 60], eye: 'angry' };
  P.kick = { lean: -2, fl: [80, -5], bl: [-10, -60], fa: [130, 10], ba: [-80, 40], eye: 'angry', mouth: 'open', kick: 1 };
  P.slam = { by: 2, crouch: 1, fl: [60, -110], bl: [20, -100], fa: [10, 10], ba: [-5, 15], eye: 'angry', mouth: 'open', big: 1, bigB: 1 };
  P.slamland = { by: 7, crouch: 2, lean: 2, fl: [80, -130], bl: [-30, -40], fa: [40, -20], ba: [-20, 20], eye: 'angry', mouth: 'grin', big: 1 };
  P.charge = { by: 3, crouch: 1, lean: -2, fl: [40, -60], bl: [-30, 0], fa: [-70, 120], ba: [60, 70], eye: 'angry', mouth: 'grin', big: 1 };
  P.cpunch = { lean: 4, bx: 3, by: 1, fl: [55, -30], bl: [-50, 20], fa: [92, 0], ba: [-60, 60], eye: 'angry', mouth: 'open', big: 1 };
  P.special = { lean: 2, fl: [30, -20], bl: [-30, 10], fa: [85, 5], ba: [80, 10], eye: 'angry', mouth: 'open', big: 1, bigB: 1 };
  P.hurt = { lean: -3, by: 1, fl: [-10, -30], bl: [20, -40], fa: [-120, 30], ba: [140, -20], eye: 'hurt', mouth: 'open' };
  P.push0 = { lean: 4, bx: -1, by: 1, fl: [-10, 0], bl: [-40, 20], fa: [85, 20], ba: [75, 30] };
  P.push1 = { lean: 4, bx: -1, by: 1, fl: [-30, 10], bl: [-5, -20], fa: [80, 25], ba: [85, 20] };
  P.hang = { fl: [10, -20], bl: [-10, -5], fa: [175, 0], ba: [170, 0], look: 0, by: 0 };
  P.hang1 = { fl: [-5, -30], bl: [15, 0], fa: [175, 0], ba: [170, 0], by: 0 };
  P.dash = { lean: 5, bx: 2, by: 3, crouch: 1, fl: [70, -60], bl: [-70, -20], fa: [-80, 60], ba: [-100, 40], eye: 'angry' };
  P.airdash = { lean: 4, bx: 1, fl: [40, -40], bl: [-60, -30], fa: [80, 10], ba: [-100, 30], eye: 'angry', mouth: 'grin', big: 1 };
  P.victory = { fl: [15, -10], bl: [-15, 5], fa: [170, 10], ba: [-20, 90], eye: 'open', mouth: 'grin', big: 1 };
  P.victory1 = { by: -2, fl: [30, -50], bl: [-10, -30], fa: [180, 0], ba: [-30, 100], eye: 'closed', mouth: 'grin', big: 1 };
  P.dead = { lean: -4, fl: [30, -30], bl: [-30, -20], fa: [160, -40], ba: [-150, 40], eye: 'hurt', mouth: 'open' };
  P.lookup = { fa: [30, 70], ba: [-10, 60], fl: [12, -8], bl: [-12, 6], hb: 0, look: 0 };
  P.talk = { fa: [20, 120], ba: [-10, 60], fl: [12, -8], bl: [-12, 6], mouth: 'open' };
  P.shrug = { fa: [60, 90], ba: [-60, 100], fl: [12, -8], bl: [-12, 6], mouth: 'grin' };
  // swim: pose vertical then rotate (head points right)
  const SW = [[10, 0, -10, 0, 175, 0, 160, 0], [-15, -20, 20, -10, 150, 20, 175, -10], [20, -10, -20, -20, 165, -20, 140, 40]];
  // roll: tucked ball
  P.ball = { by: 9, crouch: 4, lean: 5, fl: [120, -170], bl: [100, -170], fa: [80, 100], ba: [60, 110], eye: 'closed', mouth: 'n' };

  AF.SPR = AF.SPR || {};
  AF.buildAaron = function (alt) {
    const saveShirt = PAL.shirt, savePants = PAL.pants;
    if (alt) { PAL.shirt = ['#105a28', '#20a040', '#40d060', '#a0ffb0']; PAL.pants = ['#1a1a22', '#33333f', '#50505e', '#80808e']; }
    const out = {};
    for (const k in P) out[k] = finish(build(P[k])).spr(AX + 1, AY + 1);
    SW.forEach((s, i) => {
      const p = build({ fl: [s[0], s[1]], bl: [s[2], s[3]], fa: [s[4], s[5]], ba: [s[6], s[7]], by: 0, eye: 'open' });
      const r = finish(p, 1); // rotate clockwise: head points right
      out['swim' + i] = r.spr(r.w / 2 + 2, r.h / 2 + 8);
    });
    // roll frames: ball rotated 4 ways, centered
    const ball = build(P.ball);
    for (let i = 0; i < 4; i++) {
      // crop region around ball center
      const q = new AF.Pix(22, 22);
      for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) q.d[y * 22 + x] = ball.get(AX - 10 + x + 2, AY - 21 + y);
      const r = finish(rot90(q, i));
      out['roll' + i] = r.spr(11, 21);
    }
    // charged glow variant (brighter shirt) for charged punch flash
    out.icon = AF.aaronFace();
    PAL.shirt = saveShirt; PAL.pants = savePants;
    AF.SPR.aaron = out;
    // alternate costume (unlocked with all artifacts): recolor shirt -> green, pants -> black
    return out;
  };
  // face icon for HUD lives (like the reference's bottom-left portrait)
  AF.aaronFace = function () {
    const p = new AF.Pix(18, 18);
    drawHead(p, 8, 9, 'open', 'grin', 0);
    // shoulders
    p.rect(3, 15, 12, 3, PAL.shirt[1]); p.rect(3, 15, 3, 3, PAL.shirt[0]); p.rect(10, 15, 3, 2, PAL.shirt[2]);
    p.outline(PAL.ol);
    return p.spr(0, 0);
  };
  // dialogue portrait 32x32
  AF.aaronPortrait = function (mood) {
    const p = new AF.Pix(40, 40);
    // scale-2 head drawn by sampling a 20x20 head
    const h = new AF.Pix(20, 20);
    drawHead(h, 9, 10, mood === 'angry' ? 'angry' : mood === 'hurt' ? 'hurt' : 'open', mood === 'grin' ? 'grin' : mood === 'talk' ? 'open' : 'n', 0);
    h.rect(3, 17, 14, 3, PAL.shirt[1]); h.rect(3, 17, 3, 3, PAL.shirt[0]); h.rect(11, 17, 3, 2, PAL.shirt[2]);
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) { const v = h.d[y * 20 + x]; if (v) { p.d[(y * 2) * 40 + x * 2] = v; p.d[(y * 2) * 40 + x * 2 + 1] = v; p.d[(y * 2 + 1) * 40 + x * 2] = v; p.d[(y * 2 + 1) * 40 + x * 2 + 1] = v; } }
    p.outline(PAL.ol);
    return p.canvas();
  };
  AF.AARON_FRAME = { FW, FH, AX, AY };
})();
