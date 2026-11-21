'use strict';
// ============================================================
//  Levels: World 3 (Frostbite Mountain) & World 4 (Magma Mountain)
// ============================================================
(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;

  // ---------------- 3-1 FROZEN SUMMIT ----------------
  L['3-1'] = () => {
    const b = new LB({ w: 250, h: 24, world: 3, act: 1, snowSteps: true });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 18, G);
    b.o('capsule', 8, G - 1, { ab: 'double' });
    b.deco('pine', 3, G - 1, { h: 5 }).deco('snowman', 13, G - 1);
    b.isl(14, 8, 4, 1, T.ICE); b.coins(14, 7, 4); b.deco('sign', 16, G - 1, { txt: 'JUMP x2' });
    // slippery ice field with icicles
    b.ground(19, 44, G, T.ICE);
    b.deco('sign', 20, G - 1, { txt: 'SLIPPERY' });
    b.o('dropper', 24, 4, { kind: 'icicle', range: 2, respawn: 200 }); b.o('dropper', 30, 4, { kind: 'icicle', range: 2, respawn: 200 }); b.o('dropper', 36, 4, { kind: 'icicle', range: 2, respawn: 200 });
    b.r(22, 3, 18, 1, T.ICE);
    b.e('slime', 28, G - 1).e('slime', 40, G - 1);
    b.coins(25, G - 2, 12);
    b.clear(32, G, 3, 9);
    // cracking ice bridge over a chasm
    b.ground(45, 47, G);
    [[49, 13], [53, 12], [57, 13], [61, 11], [65, 12]].forEach(q => b.o('plat', q[0], q[1], { kind: 'crumble', w: 2, style: 'ice', delay: 26, respawn: 150 }));
    b.e('icebat', 57, 5);
    b.ground(69, 84, G);
    b.o('check', 71, G - 1);
    // medal 1: push the ice block to the wall, then double-jump up to a high nook
    b.ground(72, 84, G, T.ICE);
    b.o('iceblock', 74, G - 1);
    b.isl(78, 7, 3, 1, T.ICE); b.medal(79, 6);
    // snowstorm plateau (wind pushes back)
    b.ground(85, 125, G - 3);
    b.o('zone', 86, 0, { w: 40, h: G - 3, fx: -.045, kind: 'storm', maxX: 2.2 });
    b.deco('sign', 87, G - 4, { txt: 'STORM!' });
    b.e('snowdrone', 95, G - 6).e('slime', 104, G - 4).e('snowdrone', 115, G - 6);
    b.isl(96, 7, 3, 1, T.ICE); b.isl(106, 5, 3, 1, T.ICE); b.isl(116, 7, 3, 1, T.ICE);
    b.coins(96, 6, 3).coins(106, 4, 3).coins(116, 6, 3);
    b.deco('pine', 100, G - 4, { h: 4 }).deco('pine', 122, G - 4, { h: 5 });
    // frozen lake
    b.ground(126, 170, G, T.ICE);
    b.liquid(126, G + 1, 45, 8, 'water');
    b.clear(126, G + 1, 45, 7);
    b.r(126, 23, 45, 1, T.SOLID);
    b.e('slime', 134, G - 1).e('slime', 146, G - 1).e('icebat', 152, 6);
    b.coins(130, G - 3, 8).coins(150, G - 3, 8);
    // medal 2: under the frozen lake through a crack hole
    b.clear(160, G, 2, 1); b.medal(165, 21); b.o('bubblevent', 163, 22);
    b.o('check', 172, G - 1);
    b.ground(171, 250, G);
    // avalanche escape!
    b.o('trigger', 178, 0, { sig: 'chase', msg: 'AVALANCHE! RUN!' });
    b.o('chaser', 150, 0, { speed: 1.7, end: 236 });
    b.clear(186, G, 3, 9); b.clear(196, G, 4, 9); b.r(203, G - 2, 4, 2, T.SOLID); b.clear(210, G, 4, 9); b.r(218, G - 3, 3, 3, T.ICE);
    b.coins(186, G - 3, 3).coins(196, G - 3, 4).coins(210, G - 3, 4);
    b.e('slime', 207, G - 3);
    // medal 3: on a high ledge mid-escape
    b.isl(222, 7, 3, 1, T.ICE); b.medal(223, 6);
    b.deco('pine', 229, G - 1, { h: 4 });
    b.o('goal', 240, G - 1);
    b.talkStart = [{ who: 'achmed', text: 'Frostbite Mountain! Where my snow drones will turn you into a boy-sicle!', mood: 'laugh' }, { who: 'aaron', text: 'Brrr. Should have packed a jacket.', mood: 'n' }];
    return b.done();
  };

  // ---------------- 3-2 BENEATH THE ICE (caves) ----------------
  L['3-2'] = () => {
    const b = new LB({ w: 240, h: 30, world: 3, act: 2, vignette: .55, snowSteps: true });
    // fill cave with background wall, carve out
    b.r(0, 0, 240, 30, T.BGWALL);
    b.r(0, 0, 240, 3, T.SOLID); b.r(0, 26, 240, 4, T.SOLID);
    const G = 20;
    b.start(2, G - 1);
    b.ground(0, 22, G);
    b.deco('crystalD', 5, G - 1).deco('crystalD', 15, G - 1, { v: 1 });
    b.deco('sign', 10, G - 1, { txt: 'CRYSTALS' });
    // crystal switch -> crystal bridge appears for a while
    b.o('switch', 19, G - 1, { kind: 'crystal', ch: 'cr1', dur: 360 });
    b.clear(23, G, 14, 6);
    for (let i = 0; i < 4; i++) b.o('plat', 24 + i * 3, G, { kind: 'toggle', ch: 'cr1', w: 2, style: 'crystal' });
    b.ground(37, 60, G);
    b.e('slime', 44, G - 1).e('icebat', 50, 4);
    b.coins(40, G - 1, 6);
    // frozen waterfall + secret tunnel (medal 1)
    b.o('waterfall', 54, 3, { w: 2, h: G - 3 });
    b.r(56, 3, 8, 14, T.SOLID); b.r(56, 14, 8, 3, T.SECRET); b.medal(62, 16);
    b.r(56, 17, 8, 3, T.SOLID);
    // ice block puzzle: slide the block across to make a step
    b.ground(61, 90, G, T.ICE);
    b.o('iceblock', 66, G - 1);
    b.r(80, 15, 10, 5, T.SOLID);
    b.deco('sign', 63, G - 1, { txt: 'PUSH ~' });
    b.e('slime', 72, G - 1);
    b.isl(78, 6, 4, 1, T.ICE); b.coins(78, 5, 4);
    b.o('check', 84, 14);
    // vertical crystal climb
    b.r(90, 3, 2, 10, T.SOLID); b.r(90, 15, 2, 5, T.SOLID);
    b.ground(92, 120, 24);
    b.isl(94, 20, 3, 1, T.ICE); b.isl(100, 17, 3, 1, T.ICE);
    b.o('switch', 101, 16, { kind: 'crystal', ch: 'cr2', dur: 420 });
    for (let i = 0; i < 3; i++) b.o('plat', 104 + i * 3, 14 - i * 2, { kind: 'toggle', ch: 'cr2', w: 2, style: 'crystal' });
    b.isl(113, 8, 8, 1, T.ICE);
    b.e('icebat', 108, 4);
    b.coins(94, 19, 3).coins(113, 7, 8);
    b.e('slime', 110, 23).e('slime', 100, 23);
    b.o('heart', 96, 23);
    // ancient chamber with mural clue + artifact behind breakable ice wall
    b.ground(121, 160, 9);
    b.r(121, 9, 40, 17, T.SOLID);
    b.deco('sign', 126, 8, { txt: 'ANCIENT MURAL' });
    b.o('trigger', 127, 0, { talk: [{ who: 'aaron', text: "A mural... machines draining the energy of eight crystals. 'PROJECT OMEGA'?", mood: 'n' }, { who: 'aaron', text: "So Achmed needs energy from all eight lands. Not on my watch!", mood: 'angry' }] });
    b.e('snowdrone', 145, 5);
    b.o('check', 148, 8);
    // artifact room tucked in the upper corner behind breakable ice
    b.isl(151, 6, 3, 1, T.ICE);
    b.r(155, 3, 1, 3, T.BREAK); b.r(156, 3, 4, 3, T.BGALT); b.r(155, 6, 6, 1, T.SOLID); b.r(160, 3, 1, 3, T.SOLID);
    b.o('artifact', 158, 5);
    // drop down shaft with icicles
    b.clear(161, 9, 3, 17); b.ground(161, 240, 24);
    b.r(164, 3, 3, 17, T.SOLID);
    b.ladder(160, 9, 15);
    b.o('dropper', 170, 3, { kind: 'icicle', range: 2, respawn: 160 }); b.o('dropper', 178, 3, { kind: 'icicle', range: 2, respawn: 160 }); b.o('dropper', 186, 3, { kind: 'icicle', range: 2, respawn: 160 });
    b.e('slime', 174, 23).e('icebat', 190, 5).e('slime', 196, 23);
    b.coins(168, 23, 10);
    // crystal-lit bridge over spikes
    b.r(200, 24, 18, 1, T.SPIKE); b.r(200, 25, 18, 1, T.SOLID);
    b.o('switch', 198, 23, { kind: 'crystal', ch: 'cr3', dur: 300 });
    for (let i = 0; i < 5; i++) b.o('plat', 201 + i * 3, 22 - (i % 2), { kind: 'toggle', ch: 'cr3', w: 2, style: 'crystal' });
    b.o('plat', 203, 18, { kind: 'sine', w: 2, style: 'ice', ax: 2, per: 200 });
    // medal 2: above the spike bridge
    b.isl(208, 13, 3, 1, T.ICE); b.medal(209, 12);
    // medal 3: hidden pocket in the ceiling at the end
    b.r(224, 3, 6, 3, T.SECRET); b.medal(228, 4);
    b.isl(230, 19, 2, 1, T.ICE); b.isl(226, 15, 2, 1, T.ICE); b.isl(230, 11, 2, 1, T.ICE); b.isl(226, 7, 3, 1, T.ICE);
    b.e('snowdrone', 220, 18);
    b.o('goal', 233, 23);
    b.talkStart = [{ who: 'aaron', text: 'Whoa... the caves under the mountain are glowing.', mood: 'n' }, { who: 'achmed', text: "Don't touch my crystals! ...I mean, there are no crystals. Go away!", mood: 'angry' }];
    return b.done();
  };

  // ---------------- 3-3 THE FROZEN BEAST ----------------
  L['3-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 3, act: 3, bgAct: 3, storm: true, snowSteps: true });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 24, G);
    b.e('slime', 12, G - 1).e('snowdrone', 18, 8);
    b.isl(8, 10, 3, 1, T.ICE); b.medal(9, 9);
    b.ground(25, 50, G, T.ICE);
    b.o('dropper', 30, 3, { kind: 'icicle', range: 2, respawn: 160 }); b.o('dropper', 38, 3, { kind: 'icicle', range: 2, respawn: 160 });
    b.clear(42, G, 3, 9);
    b.e('icebat', 34, 4).e('slime', 47, G - 1);
    b.ground(51, 72, G);
    b.r(56, G - 2, 2, 2, T.SOLID); b.medal(66, 8); b.isl(64, 9, 4, 1, T.ICE); b.o('plat', 60, 11, { kind: 'crumble', w: 2, style: 'ice' });
    b.medal(70, G - 1);
    b.o('heart', 74, G - 2); b.o('orb', 76, G - 2);
    b.ground(72, 86, G);
    b.arena(88, G, 'golem', { ceil: true, ceilTile: T.ICE });
    b.talkStart = [{ who: 'aaron', text: "This blizzard's getting worse... and something big is stomping around up ahead.", mood: 'n' }];
    return b.done();
  };

  // ---------------- 4-1 VOLCANIC ENTRANCE ----------------
  L['4-1'] = () => {
    const b = new LB({ w: 250, h: 24, world: 4, act: 1 });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 20, G);
    b.o('capsule', 8, G - 1, { ab: 'slam' });
    b.deco('bones', 4, G - 1).deco('sign', 13, G - 1, { txt: 'SLAM v' });
    // slam through cracked floor to a secret (medal 1)
    b.r(16, G, 3, 1, T.CRACK); b.clear(16, G + 1, 3, 3); b.medal(17, G + 3); b.r(16, G + 4, 3, 1, T.SOLID);
    // lava river with moving platforms
    b.ground(21, 60, 22); b.liquid(21, 19, 40, 3, 'lava');
    b.o('plat', 22, 14, { kind: 'path', w: 3, style: 'basalt', path: [[8, 0]], speed: .9, wait: 20 });
    b.isl(34, 13, 3, 3, T.SOLID);
    b.o('plat', 38, 13, { kind: 'path', w: 3, style: 'basalt', path: [[0, -4], [8, -4]], speed: .9, wait: 20 });
    b.o('dropper', 30, 2, { kind: 'rock', w: 20, per: 75 });
    b.e('firesprite', 42, 7);
    b.isl(50, 9, 4, 2); b.coins(50, 8, 4);
    b.o('plat', 55, 12, { kind: 'sine', w: 2, style: 'basalt', ay: 1.5, per: 150 });
    b.ground(61, 80, G);
    b.o('check', 63, G - 1);
    b.e('mcrawler', 70, G - 1);
    b.o('hazard', 75, G - 1, { kind: 'geyser', per: 160, on: 60, hgt: 6 });
    b.coins(66, G - 2, 4);
    // rising platforms out of lava
    b.ground(81, 120, 22); b.liquid(81, 18, 40, 4, 'lava');
    [[83, 16], [88, 16], [93, 16], [98, 16], [103, 16], [108, 16], [113, 16]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'rise', w: 3, style: 'basalt', per: 240, off: i * 60, dist: 3 }));
    b.e('firesprite', 100, 6);
    b.coins(86, 11, 3).coins(96, 11, 3).coins(106, 11, 3);
    // medal 2: above the lava on a high rock
    b.isl(99, 8, 3, 1); b.medal(100, 7);
    b.ground(121, 150, G);
    b.e('turret', 130, G - 1, { dir: -1 });
    b.o('hazard', 138, G - 1, { kind: 'geyser', per: 140, on: 50, hgt: 6, off: 40 }); b.o('hazard', 142, G - 1, { kind: 'geyser', per: 140, on: 50, hgt: 6, off: 100 });
    b.o('dropper', 124, 2, { kind: 'rock', w: 25, per: 90 });
    b.e('mcrawler', 146, G - 1);
    b.o('check', 150, G - 1);
    // sinking platforms over lava
    b.ground(151, 185, 22); b.liquid(151, 18, 35, 4, 'lava');
    [[153, 14], [158, 13], [163, 14], [168, 12], [173, 13], [178, 14]].forEach(q => b.o('plat', q[0], q[1], { kind: 'sinklava', w: 2, style: 'basalt', sink: .5, max: 70 }));
    b.e('firesprite', 166, 6);
    b.ground(184, 250, G);
    b.e('turret', 195, G - 1, { dir: -1 }).e('mcrawler', 205, G - 1);
    b.o('hazard', 212, G - 1, { kind: 'geyser', per: 120, on: 45, hgt: 7 });
    // medal 3: slam through cracked rock into a cave
    b.r(220, G, 4, 1, T.CRACK); b.clear(220, G + 1, 4, 3); b.medal(222, G + 3); b.r(219, G + 1, 1, 3, T.SOLID); b.r(224, G + 1, 1, 3, T.SOLID);
    b.ladder(223, G + 1, 3);
    b.o('goal', 240, G - 1);
    b.talkStart = [{ who: 'achmed', text: "Magma Mountain! Lava, fire, and my lovely heat-powered robots. Toasty!", mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 4-2 THE MOLTEN CORE ----------------
  L['4-2'] = () => {
    const b = new LB({ w: 230, h: 60, world: 4, act: 2 });
    b.r(0, 0, 230, 60, T.BGWALL);
    const G = 50;
    b.r(0, 0, 230, 34, T.SOLID); b.r(0, 56, 230, 4, T.SOLID);
    b.start(3, G - 1);
    b.ground(0, 24, G);
    b.clear(0, 34, 24, G - 34); b.r(0, 34, 24, G - 34, T.BGWALL);
    b.deco('scaffold', 6, G - 1, { h: 4 }).deco('lamp', 12, G - 1);
    // collapsing basalt bridge
    b.ground(25, 56, 56); b.liquid(25, 53, 32, 3, 'lava');
    b.clear(24, 34, 70, G - 34 + 2); b.r(24, 34, 70, 18, T.BGWALL);
    for (let i = 0; i < 8; i++) b.o('plat', 25 + i * 4, G, { kind: 'crumble', w: 3, style: 'basalt', delay: 22, respawn: 200 });
    b.e('firesprite', 38, 42);
    b.coins(26, G - 2, 30, 1);
    b.ground(57, 70, G);
    b.o('check', 59, G - 1);
    // mine cart ride over the lava lake
    b.ground(71, 140, 56); b.liquid(71, 53, 70, 3, 'lava');
    b.clear(94, 34, 50, 18); b.r(94, 34, 50, 18, T.BGWALL);
    b.o('plat', 66, 48, { kind: 'cart', w: 2, thick: 6, path: [[6, 0], [24, 0], [30, -4], [46, -4], [52, 0], [72, 0]], speed: 2.4 });
    b.deco('sign', 64, G - 1, { txt: 'CART ~' });
    b.o('hazard', 88, 52, { kind: 'geyser', per: 100, on: 30, hgt: 4 });
    b.o('dropper', 96, 34, { kind: 'rock', w: 20, per: 70 });
    b.coins(78, 46, 4).coins(100, 42, 6).coins(124, 46, 4);
    // medal 1 high above the cart route
    b.isl(108, 39, 3, 1); b.medal(109, 38);
    b.ground(140, 160, G);
    b.e('mcrawler', 146, G - 1).e('turret', 156, G - 1, { dir: -1 });
    b.clear(140, 34, 22, 16); b.r(140, 34, 22, 16, T.BGWALL);
    // artifact in a slam-only chamber
    b.r(150, G, 3, 1, T.CRACK); b.clear(150, G + 1, 3, 4); b.r(149, G + 1, 1, 4, T.SOLID); b.r(153, G + 1, 1, 4, T.SOLID); b.o('artifact', 151, G + 4); b.ladder(152, G + 1, 4);
    b.o('check', 158, G - 1);
    // TIMED ESCAPE: rising lava up the shaft
    b.clear(162, 4, 26, G - 4 + 2); b.r(162, 4, 26, G - 2, T.BGWALL);
    b.ground(162, 187, 56); b.r(161, 4, 1, 52, T.SOLID); b.r(188, 8, 1, 48, T.SOLID);
    b.liquid(162, 55, 26, 1, 'lava');
    b.o('riser', 0, 0, { idx: 2, speed: .38, ch: 'rise', stop: 9 });
    b.o('trigger', 163, 0, { sig: 'rise', msg: 'THE LAVA IS RISING! CLIMB!' });
    b.clear(160, G - 2, 2, 2);
    const steps = [[164, 52], [170, 49], [176, 46], [182, 43], [176, 40], [170, 37], [164, 34], [170, 31], [176, 28], [182, 25], [176, 22], [170, 19], [164, 16], [170, 13], [176, 10]];
    steps.forEach((q, i) => b.isl(q[0], q[1], 3, 1, i % 3 === 2 ? T.ALT : T.SOLID));
    b.o('plat', 178, 33, { kind: 'path', w: 2, style: 'basalt', path: [[6, 0]], speed: .8 });
    b.e('firesprite', 180, 30).e('firesprite', 168, 18);
    b.coins(165, 33, 2).coins(177, 27, 2).coins(171, 18, 2);
    // medal 2: side alcove mid-climb
    b.clear(186, 24, 2, 2); b.r(186, 24, 2, 2, T.BGWALL); b.medal(187, 24); b.r(186, 26, 2, 1, T.SOLID);
    b.isl(182, 7, 6, 1); b.clear(188, 4, 3, 4); b.r(188, 4, 3, 4, T.BGWALL);
    b.ground(189, 230, 8); b.clear(189, 4, 41, 4); b.r(189, 4, 41, 4, T.BGWALL);
    // medal 3: above the exit
    b.medal(201, 5);
    b.o('goal', 220, 7);
    b.talkStart = [{ who: 'aaron', text: "It's like an oven in here. An oven full of robots.", mood: 'n' }];
    return b.done();
  };

  // ---------------- 4-3 INFERNO ENGINE ----------------
  L['4-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 4, act: 3, bgAct: 2 });
    const G = 15;
    b.start(2, G - 1);
    b.ground(0, 20, G);
    b.e('mcrawler', 12, G - 1);
    b.isl(14, 9, 3, 1); b.medal(15, 8);
    b.ground(21, 50, 22); b.liquid(21, 19, 30, 3, 'lava');
    [[22, 14], [27, 13], [32, 14], [37, 13], [42, 14]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'rise', w: 3, style: 'basalt', per: 220, off: i * 55, dist: 2 }));
    b.medal(34, 9);
    b.e('firesprite', 36, 7);
    b.ground(48, 86, G);
    b.o('hazard', 56, G - 1, { kind: 'geyser', per: 120, on: 40, hgt: 6 });
    b.e('turret', 64, G - 1, { dir: -1 });
    b.r(70, G, 3, 1, T.CRACK); b.clear(70, G + 1, 3, 2); b.medal(71, G + 2); b.r(70, G + 3, 3, 1, T.SOLID); b.ladder(72, G + 1, 2);
    b.o('heart', 78, G - 2); b.o('orb', 80, G - 2);
    b.arena(88, G, 'magmabot', { ceil: true });
    b.talkStart = [{ who: 'achmed', text: "Behold the Inferno Engine! And its guardian, MAGMABOT!", mood: 'laugh' }];
    return b.done();
  };
})();
