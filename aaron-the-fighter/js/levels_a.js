'use strict';
// ============================================================
//  Levels: World 1 (Emerald Forest) & World 2 (Crystal Aquarium)
//  Coordinates are in tiles. Ground-level objects use y = groundRow-1.
// ============================================================
(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;

  // ---------------- 1-1 FOREST ENTRANCE ----------------
  L['1-1'] = () => {
    const b = new LB({ w: 230, h: 22, world: 1, act: 1 });
    const G = 15;
    b.start(2, G - 1);
    // --- start meadow
    b.ground(0, 34, G);
    b.deco('tree', 1, G - 1, { h: 7 }).deco('bush', 7, G - 1).deco('flower', 10, G - 1).deco('flower', 11, G - 1, { v: 1 }).deco('grass', 13, G - 1);
    b.deco('sign', 5, G - 1, { txt: 'MOVE ~' });
    b.coins(8, G - 2, 4);
    b.deco('sign', 15, G - 1, { txt: 'ATTACK!' });
    b.e('beetle', 21, G - 1);
    b.o('orb', 24, G - 3);
    b.deco('sign', 25, G - 1, { txt: 'SPECIAL' });
    b.ground(27, 34, G - 2); // step up
    b.arc(27, G - 4, 5, 2);
    b.deco('tree', 30, G - 3, { h: 6 });
    // pit + arc
    b.arc(35, G - 4, 4, 2);
    b.ground(39, 51, G);
    b.e('beetle', 45, G - 1);
    b.deco('bush', 41, G - 1);
    // mushroom up to high branch (medal 1)
    b.o('mushroom', 49, G - 1);
    b.plat(44, 9, 7, T.PLAT);
    b.coins(45, 8, 5);
    b.plat(38, 6, 4, T.PLAT);
    b.o('mushroom', 46, 8);
    b.medal(39, 5);
    b.deco('tree', 47, G - 1, { h: 9 });
    // --- sinking leaf crossing over a pit
    b.deco('sign', 51, G - 1, { txt: 'LEAVES!' });
    b.o('plat', 53, 13, { kind: 'leaf', w: 2, style: 'leaf', max: 70 });
    b.o('plat', 57, 12, { kind: 'leaf', w: 2, style: 'leaf', max: 70 });
    b.o('plat', 61, 13, { kind: 'leaf', w: 2, style: 'leafY', max: 70 });
    b.o('plat', 65, 11, { kind: 'leaf', w: 2, style: 'leaf', max: 70 });
    b.o('plat', 69, 12, { kind: 'leaf', w: 2, style: 'leafY', max: 70 });
    b.coins(57, 10, 2).coins(65, 9, 2);
    b.ground(73, 100, G);
    b.o('check', 75, G - 1);
    // --- ruins: breakable wall, crawl tunnel
    b.deco('ruinarch', 79, G - 1).deco('pillar', 83, G - 1, { h: 4 });
    b.r(86, G - 5, 1, 5, T.BREAK);
    b.coins(88, G - 1, 3);
    b.r(88, 12, 5, 1, T.ALT);
    b.o('oneup', 90, 11);
    b.e('thorn', 92, G - 1);
    b.deco('sign', 94, G - 1, { txt: 'CRAWL v' });
    b.r(97, 9, 7, 5, T.ALT); // block leaves a 1-tile tunnel at row 14
    b.coins(98, G - 1, 5);
    b.o('heart', 104, G - 2);
    // --- floating leaves over a wide pit
    b.ground(101, 106, G);
    b.o('plat', 108, 13, { kind: 'sine', w: 2, style: 'leaf', ax: 1.5, per: 200 });
    b.o('plat', 113, 12, { kind: 'sine', w: 2, style: 'leafY', ax: 1.5, per: 200, phase: 100 });
    b.o('plat', 118, 13, { kind: 'sine', w: 2, style: 'leaf', ax: 1.5, per: 200 });
    b.e('wasp', 113, 8);
    b.coins(108, 10, 2).coins(118, 10, 2);
    b.ground(122, 136, G);
    // --- big tree with falling acorns
    b.deco('tree', 128, G - 1, { h: 10 });
    b.o('dropper', 125, 5, { kind: 'acorn', w: 6, per: 70 });
    b.coins(124, G - 1, 7);
    b.e('beetle', 133, G - 1);
    // --- vine swing over gap (lower cave path if you fall)
    b.ground(137, 147, 20);
    b.o('rope', 141, 5, { len: 6, amp: .75 });
    b.coins(138, 19, 8);
    b.e('thorn', 142, 19);
    b.o('orb', 144, 18);
    b.ground(148, 152, G);
    b.ladder(147, G, 5, true);
    // --- cliff with waterfall secret cave (medal 2)
    b.ground(153, 178, 11);
    b.ladder(152, 11, 4, true);
    b.r(153, 13, 6, 2, T.SECRET);
    b.medal(157, 14);
    b.o('waterfall', 151, 11, { w: 2, h: 4 });
    b.coins(160, 9, 3);
    b.o('check', 160, 10);
    b.e('beetle', 166, 10);
    b.e('wasp', 170, 6);
    b.deco('tree', 174, 10, { h: 6 });
    b.steps(179, 11, 0, 1);
    b.ground(179, 230, G);
    b.ground(179, 181, 13);
    // --- tall tree climb (medal 3 in canopy)
    b.deco('tree', 186, G - 1, { h: 12 });
    b.ladder(188, 4, 11, true);
    b.plat(189, 4, 6, T.PLAT);
    b.coins(190, 3, 4);
    b.medal(195, 3);
    b.plat(196, 4, 2, T.PLAT);
    b.e('beetle', 198, G - 1);
    b.e('thorn', 205, G - 1);
    b.o('heart', 202, G - 2);
    b.e('wasp', 210, 9);
    b.coins(208, G - 1, 6);
    b.deco('bush', 214, G - 1).deco('flower', 217, G - 1);
    b.o('goal', 221, G - 1);
    b.ground(228, 229, 0);
    b.talkStart = [
      { who: 'aaron', text: "What a gorgeous day for exploring the Emerald Forest!", mood: 'grin' },
      { who: 'aaron', text: "...Wait. Why do those beetles look like they're made of metal?", mood: 'n' }
    ];
    return b.done();
  };
})();

(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;
  // ---------------- 1-2 TREETOP TROUBLE ----------------
  L['1-2'] = () => {
    const b = new LB({ w: 250, h: 30, world: 1, act: 2, bgAct: 2 });
    b.start(3, 19);
    b.isl(0, 20, 14, 10);
    b.deco('bush', 4, 19).deco('flower', 8, 19).deco('sign', 11, 19, { txt: 'SWAY ~' });
    b.coins(6, 18, 4);
    // swaying branches
    b.o('plat', 16, 19, { kind: 'sine', w: 3, style: 'log', ay: 1.5, per: 170 });
    b.o('plat', 22, 17, { kind: 'sine', w: 3, style: 'log', ay: 1.5, per: 170, phase: 85 });
    b.coins(17, 16, 2).coins(23, 14, 2);
    b.isl(28, 16, 8, 3);
    b.e('beetle', 32, 15);
    b.e('wasp', 34, 10);
    // long falling-leaf chain
    const leaves = [[38, 15], [42, 14], [46, 15], [50, 13], [54, 14], [58, 12], [62, 13]];
    leaves.forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'leaf', w: 2, style: i & 1 ? 'leafY' : 'leaf', max: 60, sink: .6 }));
    b.coins(42, 12, 1).coins(50, 11, 1).coins(58, 10, 1);
    b.isl(66, 12, 9, 3);
    b.o('check', 68, 11);
    b.o('heart', 72, 10);
    // double vine swing
    b.o('rope', 80, 3, { len: 6, amp: .8 });
    b.o('rope', 89, 3, { len: 6, amp: .8, phase: 1.6 });
    b.isl(96, 12, 9, 3);
    b.e('thorn', 101, 11);
    // hidden canopy passage (medal 1): bounce up into the leaves
    b.o('mushroom', 97, 11);
    b.isl(94, 3, 12, 3, T.SECRET);
    b.clear(96, 4, 8, 1); b.r(96, 4, 8, 1, T.SECRET);
    b.medal(102, 4);
    b.coins(96, 4, 5);
    // moving branch across a gap
    b.o('plat', 106, 12, { kind: 'path', w: 3, style: 'log', path: [[9, 0]], speed: .9, wait: 30 });
    b.isl(119, 11, 6, 3);
    b.e('wasp', 122, 6);
    // grab a moving handle bar to cross
    b.deco('sign', 123, 10, { txt: 'HANG ON!' });
    b.o('bar', 126, 7, { w: 2, path: [[11, 0]], speed: .8, wait: 40 });
    b.coins(128, 9, 8);
    b.isl(140, 10, 7, 3);
    b.o('check', 142, 9);
    // split route: upper (sway up) and lower (leaves)
    b.o('plat', 148, 8, { kind: 'sine', w: 2, style: 'log', ay: 1.5, per: 150 });
    b.o('plat', 152, 5, { kind: 'sine', w: 2, style: 'log', ay: 1.5, per: 150, phase: 75 });
    b.isl(156, 4, 10, 2);
    b.coins(157, 3, 8);
    b.medal(165, 2);
    b.o('plat', 168, 5, { kind: 'sine', w: 2, style: 'log', ax: 1.5, per: 160 });
    b.isl(173, 6, 5, 2);
    b.o('oneup', 175, 5);
    // lower route
    [[149, 14], [153, 13], [157, 14], [161, 13], [165, 14], [169, 13], [173, 14]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'leaf', w: 2, style: i & 1 ? 'leaf' : 'leafY', max: 60 }));
    b.e('wasp', 160, 9);
    b.isl(177, 12, 12, 3);
    b.e('beetle', 182, 11).e('thorn', 186, 11);
    b.o('mushroom', 187, 11);
    b.isl(190, 5, 4, 2);
    b.coins(190, 4, 4);
    // final swing chain
    b.o('rope', 194, 3, { len: 7, amp: .85 });
    b.o('rope', 204, 3, { len: 7, amp: .85, phase: 2 });
    // medal 3: hidden pocket under an island (drop down through a fake floor)
    b.isl(211, 12, 6, 6);
    b.r(212, 12, 2, 2, T.SECRET); b.r(212, 14, 4, 2, T.SECRET);
    b.medal(215, 15); b.o('mushroom', 212, 15, { behind: 1 });
    b.o('plat', 219, 12, { kind: 'sine', w: 3, style: 'log', ay: 1.5, per: 170 });
    b.isl(224, 11, 26, 19);
    b.e('beetle', 230, 10).e('wasp', 234, 6);
    b.deco('bush', 236, 10);
    b.o('goal', 241, 10);
    b.talkStart = [{ who: 'aaron', text: 'Up in the treetops... and the robot bugs followed me here, too!', mood: 'n' }];
    return b.done();
  };

  // ---------------- 1-3 GUARDIAN OF THE WOODS ----------------
  L['1-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 1, act: 3, bgAct: 3, music: 'forest' });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 30, G);
    b.deco('tree', 4, G - 1, { h: 8 }).deco('ruinarch', 12, G - 1);
    b.e('beetle', 14, G - 1).e('wasp', 20, 9);
    b.coins(8, G - 2, 5);
    // medal 1 atop the ruin arch
    b.r(17, 10, 4, 1, T.ALT); b.o('mushroom', 15, G - 1); b.medal(19, 9);
    b.o('plat', 32, 13, { kind: 'leaf', w: 2, style: 'leaf', max: 60 });
    b.o('plat', 36, 12, { kind: 'leaf', w: 2, style: 'leafY', max: 60 });
    b.ground(40, 64, G);
    b.e('thorn', 46, G - 1);
    b.o('dropper', 48, 4, { kind: 'acorn', w: 5, per: 80 });
    // medal 2: breakable stump wall hiding a nook
    b.r(54, 11, 3, 4, T.ALT); b.r(54, 12, 2, 3, T.BREAK); b.clear(56, 12, 1, 3); b.medal(55, 13);
    b.coins(58, G - 1, 4);
    b.o('rope', 68, 5, { len: 6, amp: .75 });
    b.ground(65, 74, 20);
    b.ladder(75, G, 5, true);
    // medal 3 below the swing in the gully
    b.medal(70, 19);
    b.o('heart', 79, G - 2); b.o('orb', 81, G - 2);
    b.ground(75, 86, G);
    b.arena(88, G, 'treant', { ceil: false });
    b.deco('tree', 86, G - 1, { h: 10 });
    b.talkStart = [{ who: 'aaron', text: 'The heart of the forest... I can hear gears grinding up ahead.', mood: 'n' }];
    return b.done();
  };
})();

(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;
  // ---------------- 2-1 THE GREAT AQUARIUM ----------------
  L['2-1'] = () => {
    const b = new LB({ w: 220, h: 24, world: 2, act: 1 });
    const G = 12;
    b.start(2, G - 1);
    // entrance hall
    b.ground(0, 14, G);
    b.o('capsule', 7, G - 1, { ab: 'swim' });
    b.deco('window', 3, G - 1).deco('sign', 11, G - 1, { txt: 'SWIM v' });
    // medal 1: high ledge over the hall, reached from the moving platform later (walk back left)
    b.isl(0, 6, 4, 1, T.ALT); b.medal(1, 5);
    // pool A
    b.ground(15, 40, 22); b.r(15, G + 1, 1, 9, T.SOLID);
    b.liquid(15, G + 1, 26, 10, 'water');
    b.e('robofish', 22, 16).e('robofish', 32, 19);
    b.coins(18, 16, 4).coins(28, 19, 4);
    b.deco('coral', 20, 21).deco('seaweed', 25, 21).deco('coral', 34, 21, { v: 1 }).deco('seaweed', 37, 21);
    b.o('bubblevent', 27, 21);
    b.o('orb', 38, 15);
    // medal 2: behind a fake coral wall at the bottom of pool A
    b.r(16, 19, 3, 3, T.SECRET); b.ground(15, 15, 19); b.medal(17, 21);
    b.ground(41, 58, G);
    b.o('plat', 43, 9, { kind: 'path', w: 3, style: 'metal', path: [[-37, 0]], speed: 1, wait: 40 });
    b.e('crab', 48, G - 1);
    b.o('check', 52, G - 1);
    b.deco('pipe', 46, G - 1, { h: 3 }).deco('window', 55, G - 1);
    // shaft down into the glass tunnel
    b.clear(58, G, 2, 6); b.liquid(58, G + 1, 2, 6, 'water');
    b.r(56, G + 6, 40, 1, T.GLASS); b.r(60, G, 36, 1, T.GLASS); b.r(56, G + 1, 2, 5, T.SOLID);
    b.liquid(60, G + 1, 36, 5, 'water');
    b.r(60, G + 7, 36, 5, T.SOLID);
    b.e('jelly', 66, G + 3).e('jelly', 76, G + 2).e('jelly', 86, G + 4);
    b.coins(63, G + 3, 6).coins(80, G + 4, 6);
    b.o('bubblevent', 72, G + 5); b.o('bubblevent', 90, G + 5);
    b.e('robofish', 82, G + 2);
    // exit shaft up
    b.clear(96, G, 2, 6); b.liquid(96, G - 3, 2, 9, 'water'); b.r(98, G - 3, 1, 10, T.SOLID); b.r(94, G - 4, 2, 4, T.SOLID);
    b.ground(96, 98, G + 6);
    // big tank with floating barrels
    b.ground(99, 102, G - 3);
    b.ground(103, 140, 22);
    b.liquid(103, 9, 38, 13, 'water');
    b.o('barrel', 106, 8).o('barrel', 116, 8).o('barrel', 126, 8);
    b.o('plat', 109, 5, { kind: 'sine', w: 3, style: 'metal', ax: 2, per: 220 });
    b.e('jelly', 112, 14).e('jelly', 124, 16).e('robofish', 118, 19).e('crab', 130, 21);
    b.coins(108, 18, 5).coins(120, 12, 5);
    b.o('bubblevent', 114, 21); b.o('bubblevent', 134, 21);
    // medal 3: enclosed air pocket at the top of a pillar inside the tank
    b.r(132, 9, 5, 1, T.SOLID); b.r(132, 10, 1, 5, T.SOLID); b.r(136, 10, 1, 5, T.SOLID); b.r(133, 15, 3, 1, T.SOLID);
    b.clear(133, 10, 3, 5); b.r(134, 15, 1, 1, T.EMPTY);
    b.medal(134, 10);
    b.ground(141, 160, G);
    b.o('check', 143, G - 1);
    b.e('crab', 150, G - 1);
    b.o('plat', 160, 10, { kind: 'path', w: 3, style: 'metal', path: [[0, -4], [8, -4], [8, 0]], speed: 1, wait: 20 });
    b.coins(162, 5, 6);
    // final pool with a helpful current
    b.ground(161, 200, 22);
    b.liquid(161, G + 1, 40, 9, 'water');
    b.o('zone', 163, G + 2, { w: 34, h: 7, fx: .05, kind: 'current' });
    b.e('robofish', 172, 16).e('jelly', 182, 15).e('robofish', 190, 19);
    b.o('bubblevent', 178, 21);
    b.coins(166, 17, 10);
    b.ground(201, 220, G);
    b.e('crab', 206, G - 1);
    b.o('goal', 212, G - 1);
    b.talkStart = [{ who: 'achmed', text: "Welcome to MY aquarium, boy! My Mecha-Shark is hungry. Hehehe!", mood: 'laugh' }, { who: 'aaron', text: "Guess I'm going swimming. Good thing I brought... nothing. Great.", mood: 'n' }];
    return b.done();
  };

  // ---------------- 2-2 FLOODED LABORATORY (puzzles) ----------------
  L['2-2'] = () => {
    const b = new LB({ w: 230, h: 26, world: 2, act: 2 });
    const G = 14;
    b.start(2, G - 1);
    b.ground(0, 18, G);
    b.deco('computer', 5, G - 1).deco('sign', 9, G - 1, { txt: 'PUZZLES' });
    // PUZZLE 1: button opens door (stand on it / push crate onto it)
    b.o('crate', 12, G - 1);
    b.o('switch', 16, G - 1, { kind: 'button', ch: 'd1', momentary: true });
    b.r(19, 0, 1, G - 3, T.SOLID);
    b.o('door', 19, G - 3, { ch: 'd1', h: 3 });
    b.ground(19, 40, G);
    b.e('crab', 26, G - 1);
    b.coins(22, G - 1, 4);
    // PUZZLE 2: raise the water level to float up to a high exit
    b.clear(35, G, 6, 10);
    b.ground(35, 35, 16); b.ground(36, 36, 18); b.ground(37, 37, 20); b.ground(38, 41, 24);
    b.r(41, 4, 1, 18, T.SOLID); b.r(36, 4, 5, 8, T.SOLID);
    b.ground(42, 66, 24);
    b.liquid(42, 20, 25, 4, 'water');
    b.o('waterctl', 0, 0, { ch: 'w1', idx: 0, to: 6, speed: .45 });
    b.o('switch', 44, 23, { kind: 'lever', ch: 'w1', toggle: true });
    b.o('barrel', 50, 19).o('barrel', 58, 19);
    b.deco('sign', 39, 23, { txt: 'LEVER ~' });
    b.e('jelly', 54, 21).e('robofish', 60, 22);
    b.ground(67, 90, 6);
    b.r(64, 6, 3, 1, T.ALT);
    b.coins(68, 5, 6);
    b.o('check', 70, 5);
    // medal 1 inside a flooded side room (needs the raised water)
    b.r(62, 1, 5, 1, T.ALT); b.medal(63, 2); b.r(62, 3, 1, 3, T.ALT);
    b.e('secbot', 78, 5, { dir: -1 });
    // PUZZLE 3: currents redirected by levers
    b.ground(91, 140, 24); b.r(90, 7, 1, 14, T.SOLID);
    b.liquid(91, 7, 50, 17, 'water');
    b.r(92, 10, 3, 1, T.ALT);
    b.o('zone', 91, 8, { w: 50, h: 15, fx: -.09, kind: 'current', ch: 'c1', inv: 1 });
    b.o('zone', 91, 8, { w: 50, h: 15, fx: .06, kind: 'current', ch: 'c1' });
    b.o('switch', 93, 9, { kind: 'lever', ch: 'c1', toggle: true });
    b.deco('sign', 92, 6, { txt: 'CURRENT' });
    b.r(100, 8, 1, 10, T.SOLID); b.r(110, 13, 1, 11, T.SOLID); b.r(120, 8, 1, 10, T.SOLID); b.r(130, 13, 1, 11, T.SOLID);
    b.e('jelly', 105, 19).e('jelly', 115, 10).e('jelly', 125, 19).e('robofish', 135, 12);
    b.o('bubblevent', 104, 23).o('bubblevent', 124, 23).o('bubblevent', 137, 23);
    b.coins(103, 20, 4).coins(113, 10, 4).coins(123, 20, 4);
    // artifact hidden in a secret alcove at the bottom of the current maze
    b.r(131, 21, 6, 2, T.SECRET); b.o('artifact', 135, 21);
    b.ground(141, 160, 8); b.r(141, 7, 1, 1, T.EMPTY);
    b.o('check', 144, 7);
    // PUZZLE 4: floating crate stepping + timed lever door
    b.ground(161, 200, 24);
    b.liquid(161, 12, 40, 12, 'water');
    for (let x = 164; x <= 194; x += 5) b.o('barrel', x, 11);
    b.o('switch', 160, 7, { kind: 'timed', ch: 'd2', dur: 600 });
    b.r(200, 0, 2, 9, T.SOLID); b.o('door', 200, 9, { ch: 'd2', h: 3 });
    b.ground(200, 230, 12);
    b.e('robofish', 176, 18).e('crab', 186, 23);
    b.coins(165, 9, 3).coins(181, 9, 3);
    // medal 2: under the barrels at the bottom
    b.medal(190, 23);
    // medal 3: above the timed door via plat
    b.o('plat', 191, 8, { kind: 'sine', w: 2, style: 'metal', ay: 1, per: 160 });
    b.isl(195, 5, 4, 1, T.ALT); b.medal(197, 4);
    b.e('secbot', 210, 11);
    b.o('heart', 206, 10);
    b.o('goal', 222, 11);
    b.talkStart = [{ who: 'achmed', text: "My flooded lab is full of puzzles. A simple-minded boy like you will NEVER solve them!", mood: 'laugh' }, { who: 'aaron', text: 'Challenge accepted.', mood: 'grin' }];
    return b.done();
  };

  // ---------------- 2-3 TERROR OF THE DEEP ----------------
  L['2-3'] = () => {
    const b = new LB({ w: 120, h: 24, world: 2, act: 3, bgAct: 3, music: 'aqua' });
    const G = 13;
    b.start(2, G - 1);
    b.ground(0, 12, G);
    b.ground(13, 60, 23);
    b.liquid(13, G + 1, 48, 9, 'water');
    b.e('robofish', 20, 17).e('jelly', 30, 16).e('robofish', 40, 20).e('jelly', 50, 17);
    b.o('bubblevent', 25, 22).o('bubblevent', 45, 22);
    b.coins(18, 18, 6).coins(36, 20, 6);
    b.medal(56, 22);
    b.r(36, 14, 1, 5, T.SOLID); b.medal(37, 21);
    b.ground(61, 82, G);
    b.medal(64, 5); b.isl(62, 6, 4, 1, T.ALT); b.o('plat', 68, 10, { kind: 'sine', w: 2, style: 'metal', ay: 1.5, per: 140 });
    b.o('heart', 74, G - 2); b.o('orb', 76, G - 2);
    // flooded arena
    const ax = 86, F = 20;
    b.ground(83, 85, G);
    b.r(85, 0, 1, G - 3, T.SOLID);
    b.arena(ax, F, 'shark', { ceil: true });
    b.clear(ax - 4, G, 4, F - G); b.ground(ax - 4, ax - 1, F);
    b.r(ax - 5, G, 1, F - G, T.SOLID);
    b.liquid(ax - 4, F - 7, 19, 7, 'water');
    b.objs = b.objs.filter(o => o.type !== 'check'); b.o('check', 80, G - 1);
    b.talkStart = [{ who: 'achmed', text: 'Mecha-Shark MK1 awaits you in the deep tank. Try not to get eaten!', mood: 'laugh' }];
    return b.done();
  };
})();
