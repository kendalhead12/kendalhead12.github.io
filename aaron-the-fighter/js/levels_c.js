'use strict';
// ============================================================
//  Levels: World 5 (Clockwork City) & World 6 (Sunscorch Desert)
// ============================================================
(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;

  // ---------------- 5-1 INDUSTRIAL DISTRICT ----------------
  L['5-1'] = () => {
    const b = new LB({ w: 250, h: 26, world: 5, act: 1 });
    const G = 17;
    b.start(2, G - 1);
    b.ground(0, 18, G);
    b.o('capsule', 7, G - 1, { ab: 'charge' });
    b.deco('pipe', 3, G - 1, { h: 4 }).deco('crates', 12, G - 1);
    // metal wall: charged punch!
    b.deco('sign', 14, G - 1, { txt: 'HOLD J' });
    b.r(18, 0, 1, G - 3, T.SOLID); b.r(18, G - 3, 1, 3, T.METAL);
    // conveyor factory floor
    b.ground(19, 50, G);
    b.r(22, G, 12, 1, T.CONVR); b.r(36, G, 12, 1, T.CONVL);
    b.e('secbot', 30, G - 1).e('gearcrawler', 44, G - 1);
    b.coins(23, G - 2, 10);
    b.o('hazard', 34, 4, { kind: 'laser', per: 150, on: 70, warn: 40 });
    b.r(28, 3, 14, 1, T.ALT);
    // steam vents up to the rooftops
    b.ground(51, 60, G);
    b.o('zone', 53, G - 9, { w: 2, h: 9, fy: -.55, maxUp: -4.2, kind: 'steam', per: 180, on: 110 });
    b.deco('sign', 55, G - 1, { txt: 'STEAM ^' });
    b.isl(58, 7, 10, 1, T.ALT);
    b.coins(56, 5, 3);
    // rooftops
    b.isl(68, 9, 14, 17, T.SOLID);
    b.e('drone', 74, 5);
    b.o('check', 70, 8);
    b.deco('pipe', 79, 8, { h: 2 });
    b.isl(86, 11, 10, 15, T.SOLID); b.isl(100, 8, 10, 18, T.SOLID);
    b.e('secbot', 104, 7);
    // medal 1: inside a metal-sealed vault on the rooftop
    b.r(106, 5, 4, 3, T.ALT); b.r(106, 6, 1, 2, T.METAL); b.clear(107, 6, 2, 2); b.medal(108, 7);
    // gear platforms rotating around a hub
    b.deco('gearD', 116, 12, { h: 4 });
    b.o('plat', 116, 9, { kind: 'circle', w: 2, style: 'metal', r: 3.2, per: 330, ang: 0 });
    b.o('plat', 116, 9, { kind: 'circle', w: 2, style: 'metal', r: 3.2, per: 330, ang: 2.09 });
    b.o('plat', 116, 9, { kind: 'circle', w: 2, style: 'metal', r: 3.2, per: 330, ang: 4.19 });
    b.isl(124, 9, 12, 17, T.SOLID);
    b.e('gearcrawler', 130, 8);
    b.o('hazard', 128, 3, { kind: 'laser', per: 120, on: 50, warn: 40, off: 60 });
    b.r(126, 2, 8, 1, T.ALT);
    // factory interior with conveyors and lasers
    b.ground(136, 190, G);
    b.r(136, 0, 54, 6, T.ALT); b.r(136, 6, 54, G - 6, T.BGALT);
    b.r(140, G, 10, 1, T.CONVL); b.r(152, G, 10, 1, T.CONVR); b.r(164, G, 12, 1, T.CONVL);
    b.o('hazard', 146, 6, { kind: 'laser', per: 140, on: 60 }); b.o('hazard', 158, 6, { kind: 'laser', per: 140, on: 60, off: 70 }); b.o('hazard', 170, 6, { kind: 'laser', per: 140, on: 60 });
    b.e('secbot', 150, G - 1).e('drone', 165, 10).e('secbot', 178, G - 1);
    b.coins(141, G - 1, 8).coins(165, G - 1, 8);
    b.o('check', 137, G - 1);
    // medal 2: behind metal blocks in the factory wall
    b.r(184, 11, 1, 4, T.METAL); b.r(185, 11, 3, 4, T.BGALT); b.r(185, 10, 4, 1, T.ALT); b.medal(186, 14); b.r(188, 11, 1, 4, T.ALT);
    b.isl(181, 15, 4, 1, T.PLAT);
    // final stretch over the rooftops with steam
    b.ground(191, 200, G);
    b.o('zone', 197, G - 10, { w: 2, h: 10, fy: -.55, maxUp: -4.2, kind: 'steam', per: 150, on: 100 });
    b.isl(201, 8, 12, 18, T.SOLID);
    b.e('drone', 206, 4).e('gearcrawler', 210, 7);
    b.o('plat', 214, 8, { kind: 'path', w: 3, style: 'metal', path: [[10, 0]], speed: 1.1, wait: 30 });
    b.isl(228, 10, 22, 16, T.SOLID);
    // medal 3: chimney top
    b.isl(232, 4, 2, 6, T.ALT); b.medal(232, 3);
    b.e('secbot', 236, 9);
    b.o('goal', 243, 9);
    b.talkStart = [{ who: 'achmed', text: "Welcome to Clockwork City, MY city! Every gear and bolt answers to me!", mood: 'laugh' }, { who: 'aaron', text: 'Then I guess I have a lot of bolts to unscrew.', mood: 'grin' }];
    return b.done();
  };

  // ---------------- 5-2 THE CLOCKWORK TOWER (vertical) ----------------
  L['5-2'] = () => {
    const H = 130, W = 30;
    const b = new LB({ w: W, h: H, world: 5, act: 2, vertical: true });
    b.r(0, 0, W, H, T.BGALT);
    b.r(0, 0, 2, H, T.SOLID); b.r(W - 2, 0, 2, H, T.SOLID);
    b.r(0, H - 3, W, 3, T.SOLID);
    b.start(5, H - 4);
    b.deco('sign', 8, H - 4, { txt: 'CLIMB! ^' });
    let y = H - 3;
    // stage 1: alternating ledges + conveyor
    b.isl(2, y - 4, 8, 1, T.ALT); b.isl(14, y - 7, 8, 1, T.CONVR); b.isl(22, y - 10, 6, 1, T.ALT);
    b.e('gearcrawler', 5, y - 5);
    b.coins(15, y - 8, 6);
    // elevator up
    b.o('plat', 21, y - 10, { kind: 'elevator', w: 3, style: 'elevator', path: [[0, -12]], speed: .9, wait: 60 });
    y -= 22; // ~105
    b.isl(10, y, 10, 1, T.ALT); b.isl(2, y - 3, 6, 1, T.ALT);
    b.o('check', 12, y - 1);
    b.o('hazard', 2, y - 6, { kind: 'laser', dir: 'h', per: 160, on: 70, warn: 45 });
    // stage 2: rotating gear platforms
    b.deco('gearD', 15, y - 8, { h: 5 });
    for (let i = 0; i < 4; i++) b.o('plat', 14, y - 10, { kind: 'circle', w: 2, style: 'metal', r: 4, per: 360, ang: i * Math.PI / 2 });
    b.isl(2, y - 13, 6, 1, T.ALT); b.isl(22, y - 13, 6, 1, T.ALT);
    b.e('drone', 24, y - 16);
    // medal 1 on a tiny ledge left of the gears
    b.isl(2, y - 6, 3, 1, T.ALT); b.medal(3, y - 7);
    y -= 17; // ~88
    // stage 3: magnetic platforms pull you upward
    b.isl(2, y, 26, 1, T.ALT); b.clear(12, y, 6, 1);
    b.o('zone', 12, y - 14, { w: 6, h: 14, fy: -.38, maxUp: -2.6, kind: 'magnet', per: 200, on: 130 });
    b.deco('sign', 6, y - 1, { txt: 'MAGNET' });
    b.isl(4, y - 7, 5, 1, T.ALT); b.isl(21, y - 7, 5, 1, T.ALT);
    b.e('secbot', 24, y - 8);
    b.isl(9, y - 15, 12, 1, T.ALT); b.clear(13, y - 15, 4, 1);
    b.coins(13, y - 6, 4);
    y -= 15; // ~73
    b.o('check', 10, y - 1);
    // stage 4: timed switch makes a crystal staircase appear - climb before it vanishes!
    b.o('switch', 10, y - 1, { kind: 'timed', ch: 'tw1', dur: 540 });
    b.deco('sign', 18, y - 1, { txt: 'HURRY!' });
    [[17, y - 4], [12, y - 7], [6, y - 10], [11, y - 13], [17, y - 16]].forEach(q => b.o('plat', q[0], q[1], { kind: 'toggle', ch: 'tw1', w: 2, style: 'crystal' }));
    b.e('drone', 22, y - 10);
    // artifact: secret alcove in the tower wall
    b.isl(2, y - 10, 2, 1, T.ALT); b.r(0, y - 12, 2, 2, T.SECRET); b.o('artifact', 1, y - 11);
    y -= 19; // ~54
    b.isl(9, y, 19, 1, T.ALT); b.r(15, y, 4, 1, T.PLAT);
    b.o('check', 12, y - 1);
    // stage 5: laser gauntlet with steam lifts
    b.o('zone', 3, y - 12, { w: 3, h: 12, fy: -.55, maxUp: -4, kind: 'steam', per: 160, on: 100 });
    b.isl(2, y, 4, 1, T.ALT);
    b.isl(2, y - 13, 10, 1, T.PLAT);
    b.o('hazard', 13, y - 12, { kind: 'laser', dir: 'v', per: 120, on: 50 });
    b.isl(14, y - 13, 14, 1, T.ALT);
    b.o('hazard', 22, y - 13 - 4, { kind: 'laser', dir: 'v', per: 120, on: 50, off: 60 });
    b.e('gearcrawler', 18, y - 14);
    // medal 2 above the gauntlet
    b.isl(25, y - 18, 3, 1, T.ALT); b.medal(26, y - 19);
    y -= 13; // ~41
    // stage 6: elevator & gears to the clock face
    b.o('plat', 4, y - 2, { kind: 'path', w: 3, style: 'elevator', path: [[0, -14]], speed: .8, wait: 50, chains: true });
    b.o('plat', 22, y - 16, { kind: 'path', w: 3, style: 'elevator', path: [[0, -12]], speed: .8, wait: 50, chains: true });
    b.isl(9, y - 16, 12, 1, T.ALT);
    b.e('secbot', 14, y - 17).e('drone', 10, y - 22);
    b.coins(10, y - 17, 3);
    y -= 28; // ~13
    b.isl(2, y, 26, 1, T.ALT); b.clear(4, y, 3, 1);
    b.clear(22, y, 3, 1);
    b.o('check', 12, y - 1);
    // medal 3: on the clock's hand at the very top
    b.isl(6, 3, 3, 1, T.ALT); b.medal(7, 2); b.isl(16, 9, 3, 1, T.ALT);
    b.o('plat', 11, 6, { kind: 'sine', w: 2, style: 'metal', ax: 2, per: 180 });
    b.o('goal', 25, y - 1);
    b.talkStart = [{ who: 'achmed', text: 'The Clockwork Tower! You will never reach the top. My lasers are VERY punctual!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 5-3 IRON ENFORCER ----------------
  L['5-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 5, act: 3, bgAct: 3 });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 30, G);
    b.r(8, G, 10, 1, T.CONVR);
    b.e('secbot', 20, G - 1).e('drone', 26, 8);
    b.r(14, 10, 3, 1, T.ALT); b.medal(15, 9);
    b.ground(31, 45, G - 3);
    b.r(36, G - 6, 1, 3, T.METAL); b.r(37, G - 6, 3, 3, T.BGALT); b.r(36, G - 7, 5, 1, T.ALT); b.r(40, G - 6, 1, 3, T.ALT); b.medal(38, G - 4);
    b.ground(46, 86, G);
    b.o('hazard', 52, 4, { kind: 'laser', per: 120, on: 50 }); b.r(48, 3, 10, 1, T.ALT);
    b.e('gearcrawler', 60, G - 1);
    b.o('plat', 64, 11, { kind: 'circle', w: 2, style: 'metal', r: 2.5, per: 240 }); b.isl(70, 6, 3, 1, T.ALT); b.medal(71, 5);
    b.o('heart', 78, G - 2); b.o('orb', 80, G - 2);
    b.arena(88, G, 'crusher', { ceil: true });
    b.talkStart = [{ who: 'achmed', text: 'Crusher-9000 is armored with my finest alloy. Your little fists are useless!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 6-1 DESERT CROSSING ----------------
  L['6-1'] = () => {
    const b = new LB({ w: 260, h: 24, world: 6, act: 1 });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 20, G);
    b.o('capsule', 7, G - 1, { ab: 'dash' });
    b.deco('palm', 3, G - 1).deco('cactus', 12, G - 1);
    b.deco('sign', 15, G - 1, { txt: 'DASH!' });
    b.r(19, 0, 2, G, T.SANDW); b.r(19, 0, 2, G - 5, T.SOLID);
    // quicksand field
    b.ground(21, 50, G);
    b.r(25, G, 6, 2, T.QSAND); b.r(36, G, 8, 2, T.QSAND);
    b.deco('sign', 23, G - 1, { txt: 'Q-SAND!' });
    b.e('scorpbot', 33, G - 1).e('scarab', 40, 8);
    b.coins(25, G - 3, 6).coins(36, G - 3, 8);
    // moving dunes
    b.ground(51, 54, G);
    [[56, 14], [61, 13], [66, 14], [71, 12]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'sine', w: 3, h: 2, style: 'sand', ay: 1, per: 220, phase: i * 55 }));
    b.ground(76, 100, G);
    b.o('check', 78, G - 1);
    b.e('sandworm', 88, G - 1);
    // ancient bridge with crumbling sandstone
    b.ground(101, 103, G);
    for (let i = 0; i < 6; i++) b.o('plat', 104 + i * 3, G - 1, { kind: 'crumble', w: 3, style: 'sand', delay: 25, respawn: 180 });
    b.e('scarab', 112, 7);
    b.ground(122, 150, G);
    // rolling boulders down the slope
    b.steps(122, G - 1, 6, 1); b.ground(128, 150, G - 6);
    b.o('rollers', 148, G - 8, { dir: -1, per: 150, range: 26 });
    b.e('scorpbot', 140, G - 7);
    // medal 1: hidden underground passage (secret sand)
    b.r(132, G - 6, 3, 2, T.SECRET); b.clear(132, G - 4, 3, 4); b.r(132, G - 4, 3, 4, T.BGALT); b.medal(133, G - 1); b.r(131, G - 4, 1, 4, T.SOLID); b.r(135, G - 4, 1, 4, T.SOLID);
    b.o('spring', 134, G - 1, { behind: 1 });
    b.ground(151, 165, G - 6);
    b.o('check', 153, G - 7);
    // sandstorm crossing (low visibility + wind)
    b.ground(166, 215, G);
    b.o('zone', 166, 0, { w: 50, h: G, fx: -.04, kind: 'sand', maxX: 2.2 });
    b.r(172, G, 6, 2, T.QSAND); b.r(190, G, 5, 2, T.QSAND);
    b.e('sandworm', 182, G - 1).e('scarab', 200, 8).e('scorpbot', 208, G - 1);
    b.isl(184, 9, 4, 1, T.ALT); b.coins(184, 8, 4);
    // medal 2: buried behind sandstone in the storm
    b.r(198, G - 4, 1, 4, T.SANDW); b.r(199, G - 4, 3, 4, T.BGALT); b.r(198, G - 5, 5, 1, T.ALT); b.r(202, G - 4, 1, 4, T.SOLID); b.medal(200, G - 1);
    // abandoned settlement
    b.ground(216, 260, G);
    b.deco('pot', 220, G - 1).deco('statue', 226, G - 1).deco('pot', 232, G - 1);
    b.isl(222, 10, 6, 5, T.ALT); b.isl(234, 8, 6, 7, T.ALT);
    b.e('scorpbot', 230, G - 1);
    // medal 3: rooftop of the old house
    b.medal(236, 7);
    b.o('goal', 250, G - 1);
    b.talkStart = [{ who: 'achmed', text: 'The Sunscorch Desert! Hot sand, quicksand, and my mechanical scarabs. Enjoy!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 6-2 TEMPLE OF THE SUN ----------------
  L['6-2'] = () => {
    const b = new LB({ w: 240, h: 28, world: 6, act: 2, vignette: .35 });
    b.r(0, 0, 240, 28, T.BGALT);
    b.r(0, 0, 240, 3, T.ALT); b.r(0, 25, 240, 3, T.ALT);
    const G = 20;
    b.start(2, G - 1);
    b.ground(0, 30, G, T.ALT);
    b.deco('torch', 4, G - 3).deco('statue', 9, G - 1).deco('torch', 14, G - 3);
    b.deco('sign', 18, G - 1, { txt: 'MIRRORS' });
    // PUZZLE 1: guide the sunbeam to the receptor to open the gate
    b.o('sun', 20, 10, { dir: [1, 0] });
    b.r(19, 11, 3, 1, T.ALT);
    b.o('mirror', 26, 10, { o: 0 });   // punch it so it becomes '\' and sends the beam down
    b.isl(23, 13, 3, 1, T.ALT);
    b.o('mirror', 26, 19, { recv: true, ch: 'g1' });
    b.r(31, 3, 1, G - 6, T.ALT); b.o('door', 31, G - 3, { ch: 'g1', h: 3 });
    b.ground(31, 60, G, T.ALT);
    b.e('scorpbot', 40, G - 1).e('scarab', 48, 12);
    b.coins(34, G - 1, 6);
    // PUZZLE 2: push stone blocks onto two pressure plates
    b.o('crate', 44, G - 1, { kind: 'stone' }); b.o('crate', 52, G - 1, { kind: 'stone' });
    b.o('switch', 47, G - 1, { kind: 'button', ch: 'p1', momentary: true }); b.o('switch', 56, G - 1, { kind: 'button', ch: 'p2', momentary: true });
    b.t(48, G - 1, T.ALT); b.t(57, G - 1, T.ALT);
    b.r(61, 3, 1, G - 6, T.ALT); b.o('door', 61, G - 3, { ch: 'p1', h: 3 }); b.r(64, 3, 1, G - 6, T.ALT); b.o('door', 64, G - 3, { ch: 'p2', h: 3 });
    b.ground(61, 90, G, T.ALT);
    b.o('check', 66, G - 1);
    // medal 1: hidden trapdoor in the corridor floor
    b.r(71, G, 2, 1, T.SECRET); b.r(70, G + 1, 6, 3, T.BGALT); b.medal(74, G + 3); b.ladder(70, G + 1, 3);
    b.isl(78, 14, 4, 1, T.PLAT); b.e('scarab', 84, 12);
    // spike pit with levers and moving slabs
    b.ground(91, 130, 24, T.ALT); b.r(91, 23, 40, 1, T.SPIKE);
    b.o('switch', 88, G - 1, { kind: 'lever', ch: 'sl1' });
    for (let i = 0; i < 6; i++) b.o('plat', 92 + i * 6, G - 2 - (i & 1) * 2, { kind: 'toggle', w: 3, style: 'sand', ch: 'sl1' });
    b.deco('sign', 85, G - 1, { txt: 'LEVER ~' });
    b.e('scarab', 110, 10);
    b.ground(131, 150, G, T.ALT);
    b.o('check', 133, G - 1);
    // PUZZLE 3: two-mirror beam route (rotate both!)
    b.o('sun', 136, 6, { dir: [0, 1] });
    b.o('mirror', 136, 12, { o: 0 });
    b.o('mirror', 144, 12, { o: 1 });
    b.o('mirror', 144, 6, { recv: true, ch: 'g3' });
    b.r(135, 13, 11, 1, T.ALT); b.isl(139, 17, 3, 1, T.ALT);
    b.r(150, 3, 1, G - 6, T.ALT); b.o('door', 150, G - 3, { ch: 'g3', h: 3 });
    b.deco('sign', 140, G - 1, { txt: 'ROTATE' });
    // artifact: behind a sandstone wall high in the hall (dash on a ledge)
    b.isl(146, 9, 3, 1, T.ALT);
    b.ground(151, 200, G, T.ALT);
    b.e('scorpbot', 160, G - 1).e('sandworm', 172, G - 1).e('scarab', 180, 12);
    b.r(155, 14, 10, 1, T.ALT); b.r(163, 10, 1, 4, T.SANDW); b.r(164, 10, 4, 4, T.BGALT); b.r(163, 9, 6, 1, T.ALT); b.r(168, 10, 1, 4, T.ALT); b.o('artifact', 166, 13);
    // medal 2: under the floor via a breakable tile
    b.r(186, G, 2, 1, T.BREAK); b.clear(186, G + 1, 4, 3); b.r(186, G + 1, 4, 3, T.BGALT); b.medal(188, G + 3); b.ladder(186, G + 1, 3);
    b.o('rollers', 198, G - 2, { dir: -1, per: 170, range: 22 });
    b.ground(201, 240, G, T.ALT);
    // medal 3: altar above the exit (double jump + air from statue)
    b.isl(212, 13, 4, 1, T.ALT); b.medal(213, 12); b.deco('statue', 208, G - 1);
    b.r(205, 16, 3, 1, T.ALT);
    b.o('goal', 230, G - 1);
    b.talkStart = [{ who: 'aaron', text: 'An ancient temple. Mirrors, sunlight... it must be a puzzle.', mood: 'n' }, { who: 'achmed', text: 'Those puzzles took me three weeks! You will never figure them out!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 6-3 THE SAND GUARDIAN ----------------
  L['6-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 6, act: 3, bgAct: 3 });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 30, G);
    b.r(10, G, 6, 2, T.QSAND);
    b.e('scorpbot', 22, G - 1);
    b.isl(12, 10, 3, 1, T.ALT); b.medal(13, 9);
    b.ground(31, 60, G);
    b.r(40, G - 4, 1, 4, T.SANDW); b.r(41, G - 4, 3, 4, T.BGALT); b.r(40, G - 5, 5, 1, T.ALT); b.r(44, G - 4, 1, 4, T.ALT); b.medal(42, G - 1);
    b.e('sandworm', 52, G - 1).e('scarab', 56, 8);
    b.ground(61, 86, G);
    for (let i = 0; i < 3; i++) b.o('plat', 64 + i * 4, G - 3 - i * 2, { kind: 'crumble', w: 2, style: 'sand' });
    b.medal(73, G - 10);
    b.o('heart', 78, G - 2); b.o('orb', 80, G - 2);
    b.arena(88, G, 'scorpion', { ceil: false });
    b.talkStart = [{ who: 'achmed', text: 'Scorpion-X guards the desert. Its stinger packs a REAL punch!', mood: 'laugh' }];
    return b.done();
  };
})();
