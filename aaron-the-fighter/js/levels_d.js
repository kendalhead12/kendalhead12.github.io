'use strict';
// ============================================================
//  Levels: World 7 (Skybound Islands), World 8 (Achmed's Lab), Final
// ============================================================
(function () {
  const T = AF.T, L = AF.LEVELS, LB = AF.LB;

  // ---------------- 7-1 ABOVE THE CLOUDS ----------------
  L['7-1'] = () => {
    const b = new LB({ w: 270, h: 26, world: 7, act: 1 });
    const G = 15;
    b.start(3, G - 1);
    b.isl(0, G, 16, 4);
    b.o('capsule', 8, G - 1, { ab: 'airdash' });
    b.deco('windmill', 3, G - 1).deco('flower', 12, G - 1);
    b.deco('sign', 14, G - 1, { txt: 'AIR DASH' });
    // long gap: needs air dash
    b.isl(23, G, 8, 3);
    b.coins(17, G - 3, 5);
    // cloud platforms that vanish
    [[33, 13], [38, 12], [43, 13], [48, 11], [53, 12]].forEach(q => b.o('plat', q[0], q[1], { kind: 'cloud', w: 3, style: 'cloud', delay: 45, respawn: 130 }));
    b.e('flybot', 44, 7);
    b.isl(58, 12, 10, 3);
    b.o('check', 60, 11);
    // wind currents push you across a wide chasm
    b.o('zone', 68, 2, { w: 22, h: 14, fx: .07, kind: 'wind', maxX: 3.6 });
    b.deco('sign', 65, 11, { txt: 'WIND ~' });
    b.isl(76, 9, 3, 1, T.ALT); b.coins(76, 8, 3);
    b.isl(91, 12, 9, 3);
    b.e('wisp', 95, 8);
    // air vents launch you upward
    b.o('zone', 101, 3, { w: 2, h: 12, fy: -.6, maxUp: -4.6, kind: 'updraft' });
    b.isl(100, 15, 4, 1, T.ALT);
    b.isl(104, 4, 12, 2);
    b.coins(105, 3, 10);
    b.e('flybot', 110, 1);
    // medal 1: floating crown island far above
    b.isl(119, 1, 3, 1, T.ALT); b.medal(120, 0);
    // flying ship ride
    b.isl(116, 10, 6, 3);
    b.o('plat', 123, 9, { kind: 'ship', w: 6, h: 1, style: 'ship', path: [[26, 0], [26, -3], [40, -3]], speed: 1.1, wait: 60 });
    b.e('flybot', 140, 3).e('ldrone', 150, 5, { span: 3 });
    b.coins(128, 7, 4).coins(146, 4, 4);
    b.isl(166, 7, 10, 3);
    b.o('check', 168, 6);
    // floating bobbing platforms + lightning-free sky dance
    [[178, 9], [183, 7], [188, 9], [193, 6], [198, 8]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: 'sine', w: 2, style: 'skywood', ay: 1, per: 140, phase: i * 30 }));
    b.e('wisp', 190, 3).e('flybot', 200, 4);
    // medal 2: underside alcove below the floaters (drop + air dash back)
    b.isl(186, 17, 4, 1, T.ALT); b.medal(187, 16);
    b.isl(203, 10, 8, 3);
    // updraft tower to the high road
    b.o('zone', 211, 6, { w: 3, h: 9, fy: -.55, maxUp: -4.2, kind: 'updraft' });
    b.isl(211, 15, 3, 1, T.ALT);
    b.isl(215, 5, 14, 2);
    b.e('ldrone', 222, 4, { span: 3 });
    b.o('plat', 230, 7, { kind: 'cloud', w: 3, style: 'cloud' });
    b.o('plat', 236, 8, { kind: 'cloud', w: 3, style: 'cloud' });
    b.isl(241, 9, 29, 6);
    // medal 3: over the goal island on a high cloud
    b.isl(248, 2, 3, 1, T.ALT); b.medal(249, 1); b.o('plat', 244, 5, { kind: 'sine', w: 2, style: 'cloud', ax: 1.5, per: 160 });
    b.e('flybot', 255, 5);
    b.o('goal', 262, 8);
    b.talkStart = [{ who: 'achmed', text: "The Skybound Islands! One wrong step and it's a LONG way down. Hehehe!", mood: 'laugh' }, { who: 'aaron', text: "Good thing I've got a new trick up my sleeve.", mood: 'grin' }];
    return b.done();
  };

  // ---------------- 7-2 STORM FORTRESS ----------------
  L['7-2'] = () => {
    const b = new LB({ w: 250, h: 26, world: 7, act: 2 });
    const G = 16;
    b.start(3, G - 1);
    b.isl(0, G, 14, 10);
    b.deco('banner', 6, G - 1).deco('column', 11, G - 1, { h: 3 });
    // lightning field
    b.isl(14, G, 30, 10, T.ALT);
    b.r(14, 3, 30, 2, T.ALT);
    for (let i = 0; i < 4; i++) b.o('hazard', 18 + i * 6, 5, { kind: 'lightning', w: 2, h: G - 5, per: 150, on: 20, warn: 50, off: i * 37 });
    b.deco('sign', 15, G - 1, { txt: 'LIGHTNING' });
    b.e('wisp', 30, 10);
    b.coins(16, G - 2, 24);
    // rotating platforms over the void
    b.deco('gearD', 52, 10, { h: 3 });
    for (let i = 0; i < 3; i++) b.o('plat', 52, 9, { kind: 'circle', w: 2, style: 'skywood', r: 3.5, per: 300, ang: i * 2.094 });
    b.isl(59, 12, 8, 14, T.ALT);
    b.o('check', 61, 11);
    b.e('ldrone', 64, 5, { span: 2 });
    // wind puzzle: lever flips the wind direction to carry you over
    b.o('switch', 65, 11, { kind: 'lever', ch: 'wd', toggle: true });
    b.o('zone', 67, 2, { w: 24, h: 14, fx: -.07, kind: 'wind', ch: 'wd', inv: 1, maxX: 3.4 });
    b.o('zone', 67, 2, { w: 24, h: 14, fx: .07, kind: 'wind', ch: 'wd', maxX: 3.4 });
    b.deco('sign', 63, 11, { txt: 'LEVER' });
    b.isl(77, 10, 2, 1, T.ALT);
    b.isl(91, 12, 10, 14, T.ALT);
    b.e('flybot', 95, 6);
    // GRAVITY CHAMBER: flip and walk on the ceiling over a spike pit
    b.r(101, 2, 40, 2, T.ALT); b.r(101, 22, 40, 4, T.ALT); b.r(101, 21, 40, 1, T.SPIKE);
    b.o('gravsw', 103, 10, {});
    b.deco('sign', 100, 11, { txt: 'GRAVITY' });
    b.r(108, 4, 2, 1, T.SPIKED); b.r(118, 4, 2, 1, T.SPIKED); b.r(128, 4, 2, 1, T.SPIKED);
    b.coins(112, 4, 4).coins(122, 4, 4);
    b.e('wisp', 115, 10);
    b.o('gravsw', 137, 8, { set: 1 });
    b.isl(136, 12, 5, 1, T.ALT);
    b.isl(141, 12, 12, 14, T.ALT);
    b.o('check', 144, 11);
    // artifact: inside the storm cloud above the chamber exit (flip again!)
    b.o('gravsw', 140, 10, { set: -1 });
    b.r(141, 0, 6, 1, T.ALT); b.o('artifact', 144, 1);
    // rotating + lightning finale
    for (let i = 0; i < 2; i++) b.o('plat', 160, 10, { kind: 'circle', w: 2, style: 'skywood', r: 3, per: 240, ang: i * Math.PI, cw: false });
    b.o('hazard', 160, 0, { kind: 'lightning', w: 2, h: 8, per: 130, on: 20, warn: 50 });
    b.isl(167, 12, 8, 14, T.ALT);
    b.e('ldrone', 171, 4, { span: 2 });
    // medal 1: high above the rotating platforms
    b.isl(158, 2, 4, 1, T.ALT); b.medal(159, 1);
    for (let i = 0; i < 4; i++) b.o('plat', 178 + i * 6, 11 - (i & 1) * 2, { kind: 'cloud', w: 3, style: 'cloud', delay: 40 });
    b.e('wisp', 186, 5);
    // medal 2: lightning-guarded ledge
    b.isl(186, 5, 3, 1, T.ALT); b.medal(187, 4); b.o('hazard', 186, 0, { kind: 'lightning', w: 3, h: 5, per: 120, on: 30, warn: 40 });
    b.isl(202, 12, 48, 14, T.ALT);
    b.r(202, 3, 48, 2, T.ALT);
    b.e('flybot', 210, 7).e('ldrone', 220, 7, { span: 3 });
    for (let i = 0; i < 3; i++) b.o('hazard', 214 + i * 8, 5, { kind: 'lightning', w: 2, h: 7, per: 140, on: 20, warn: 50, off: i * 45 });
    // medal 3: fortress tower top (via gravity flip near the end)
    b.o('gravsw', 234, 9, { set: -1 }); b.medal(238, 5); b.o('gravsw', 239, 6, { set: 1 });
    b.o('goal', 244, 11);
    b.talkStart = [{ who: 'achmed', text: 'My Storm Fortress! Lightning, wind, and GRAVITY bend to my will!', mood: 'laugh' }, { who: 'aaron', text: 'Gravity bends to you? Is that why your hair fell out?', mood: 'grin' }];
    return b.done();
  };

  // ---------------- 7-3 THE SKY SENTINEL ----------------
  L['7-3'] = () => {
    const b = new LB({ w: 120, h: 22, world: 7, act: 3, bgAct: 3 });
    const G = 15;
    b.start(3, G - 1);
    b.isl(0, G, 14, 7);
    b.o('plat', 15, 13, { kind: 'cloud', w: 3, style: 'cloud' }); b.o('plat', 20, 12, { kind: 'cloud', w: 3, style: 'cloud' });
    b.isl(25, G - 2, 10, 9);
    b.e('flybot', 30, 6);
    b.isl(28, 6, 3, 1, T.ALT); b.medal(29, 5);
    b.o('zone', 36, 4, { w: 2, h: 10, fy: -.55, maxUp: -4.2, kind: 'updraft' }); b.isl(36, 14, 2, 1, T.ALT);
    b.isl(39, 5, 8, 2);
    b.medal(43, 4);
    b.isl(49, 12, 10, 10);
    b.e('wisp', 54, 6);
    [[60, 11], [65, 10], [70, 11]].forEach(q => b.o('plat', q[0], q[1], { kind: 'sine', w: 2, style: 'skywood', ay: 1, per: 150 }));
    b.medal(66, 6);
    b.isl(74, G, 14, 7);
    b.o('heart', 78, G - 2); b.o('orb', 80, G - 2);
    b.arena(88, G, 'thunderwing', { ceil: false });
    b.isl(91, G - 4, 3, 1, T.PLAT); b.isl(98, G - 6, 3, 1, T.PLAT); b.isl(105, G - 4, 3, 1, T.PLAT);
    b.talkStart = [{ who: 'achmed', text: 'Thunderwing rules these skies. Prepare to be... ELECTRIFIED!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 8-1 BREAKING IN ----------------
  L['8-1'] = () => {
    const b = new LB({ w: 260, h: 24, world: 8, act: 1 });
    b.r(0, 0, 260, 24, T.BGWALL);
    b.r(0, 0, 260, 3, T.ALT);
    const G = 18;
    b.start(3, G - 1);
    b.ground(0, 30, G);
    b.deco('sign', 8, G - 1, { txt: 'SECURITY' }).deco('monitor', 12, G - 1).deco('tube', 18, G - 1);
    // laser grid with a security lever that disables it
    for (let i = 0; i < 4; i++) b.o('hazard', 22 + i * 3, 3, { kind: 'laser', dir: 'v', per: 100, on: 55, off: i * 25, ch: 'sec1' });
    b.o('hazard', 20, 10, { kind: 'laser', dir: 'h', per: 140, on: 60, ch: 'sec1' }); b.t(19, 10, T.ALT);
    b.e('lturret', 28, 3, { ceil: true });
    b.ground(31, 60, G);
    b.e('guard', 40, G - 1);
    // security terminal lever (behind the guard) shuts down grid #2
    b.o('switch', 48, G - 1, { kind: 'lever', ch: 'sec2' });
    b.deco('computer', 50, G - 1);
    for (let i = 0; i < 5; i++) b.o('hazard', 54 + i * 2, 3, { kind: 'laser', dir: 'v', per: 80, on: 70, off: i * 10, ch: 'sec2' });
    b.o('check', 52, G - 1);
    // electric floor + conveyors
    b.ground(61, 100, G);
    b.r(64, G, 12, 1, T.EFLOOR); b.o('hazard', 64, G, { kind: 'efloor', w: 12, per: 150, on: 70 });
    b.r(78, G, 10, 1, T.CONVL); b.r(88, G, 10, 1, T.EFLOOR); b.o('hazard', 88, G, { kind: 'efloor', w: 10, per: 120, on: 50, off: 60 });
    b.isl(68, 13, 4, 1, T.PLAT); b.isl(91, 13, 4, 1, T.PLAT);
    b.e('drone', 80, 8).e('exbot', 96, G - 1);
    b.coins(65, 12, 4).coins(90, 12, 4);
    // medal 1: on the security monitor shelf
    b.isl(82, 8, 3, 1, T.ALT); b.medal(83, 7);
    // teleporter maze
    b.ground(101, 150, G);
    b.r(110, 3, 2, G - 3, T.ALT); b.r(124, 3, 2, G - 3, T.ALT); b.r(138, 3, 2, G - 3, T.ALT);
    b.o('tele', 107, G - 1, { id: 'a', to: 'b' }); b.o('tele', 114, G - 1, { id: 'b', to: 'a' });
    b.o('tele', 121, G - 1, { id: 'c', to: 'd' }); b.o('tele', 128, G - 1, { id: 'd', to: 'c' });
    b.o('tele', 135, G - 1, { id: 'e', to: 'f' }); b.o('tele', 142, G - 1, { id: 'f', to: 'e' });
    b.deco('sign', 104, G - 1, { txt: 'UP: WARP' });
    b.e('guard', 118, G - 1).e('lturret', 131, G - 1).e('exbot', 146, G - 1);
    // medal 2: secret teleporter room
    b.isl(112, 10, 12, 1, T.PLAT); b.isl(119, 14, 3, 1, T.PLAT); b.o('tele', 117, 9, { id: 'g', to: 'h' }); b.o('tele', 145, 8, { id: 'h', to: 'g' }); b.isl(143, 9, 6, 1, T.ALT); b.medal(147, 8);
    b.o('check', 150, G - 1);
    // timed security doors
    b.ground(151, 220, G);
    b.o('switch', 154, G - 1, { kind: 'timed', ch: 'td', dur: 480 });
    b.r(170, 3, 1, G - 6, T.ALT); b.o('door', 170, G - 3, { ch: 'td', h: 3 });
    b.r(190, 3, 1, G - 6, T.ALT); b.o('door', 190, G - 3, { ch: 'td', h: 3 });
    b.r(160, G, 8, 1, T.CONVR); b.r(176, G, 10, 1, T.CONVR);
    b.e('drone', 180, 9).e('drone', 196, 9);
    b.deco('sign', 157, G - 1, { txt: 'FAST!' });
    // medal 3: above the second door
    b.isl(186, 9, 4, 1, T.PLAT); b.medal(188, 7); b.isl(180, 13, 3, 1, T.PLAT);
    b.e('guard', 205, G - 1).e('lturret', 214, 3, { ceil: true });
    b.ground(221, 260, G);
    b.o('goal', 250, G - 1);
    b.talkStart = [{ who: 'achmed', text: 'INTRUDER ALERT! INTRUDER ALERT! ...Oh, it is just you. Release the elite guards!', mood: 'angry' }];
    return b.done();
  };

  // ---------------- 8-2 THE FINAL EXPERIMENT ----------------
  L['8-2'] = () => {
    const b = new LB({ w: 280, h: 28, world: 8, act: 2 });
    b.r(0, 0, 280, 28, T.BGWALL);
    b.r(0, 0, 280, 3, T.ALT); b.r(0, 25, 280, 3, T.ALT);
    const G = 20;
    b.start(3, G - 1);
    b.ground(0, 16, G);
    b.deco('tube', 6, G - 1, { v: 1 }).deco('computer', 11, G - 1);
    b.o('trigger', 12, 0, { talk: [{ who: 'achmed', text: 'Behold! I have recreated every environment you passed through... INSIDE my lab!', mood: 'laugh' }, { who: 'aaron', text: 'You built a theme park of my adventure? I am flattered.', mood: 'grin' }] });
    // ICE CHAMBER
    b.ground(17, 60, G, T.ICE);
    b.r(17, 3, 44, 1, T.ICE);
    b.o('dropper', 22, 4, { kind: 'icicle', range: 2, respawn: 150 }); b.o('dropper', 30, 4, { kind: 'icicle', range: 2, respawn: 150 }); b.o('dropper', 38, 4, { kind: 'icicle', range: 2, respawn: 150 });
    b.clear(42, G, 4, 5); b.r(42, 24, 4, 1, T.SPIKE);
    [[47, 17], [51, 15]].forEach(q => b.o('plat', q[0], q[1], { kind: 'crumble', w: 2, style: 'ice' }));
    b.e('slime', 26, G - 1).e('icebat', 34, 4);
    b.o('iceblock', 54, G - 1);
    b.isl(57, 12, 4, 1, T.ICE); b.medal(58, 11);
    b.o('check', 62, G - 1);
    b.ground(61, 66, G);
    // LAVA CHAMBER
    b.ground(67, 110, 24); b.liquid(67, 21, 44, 3, 'lava');
    [[68, 18], [73, 18], [78, 18], [83, 18], [88, 18], [93, 18], [98, 18], [103, 18]].forEach((q, i) => b.o('plat', q[0], q[1], { kind: i % 2 ? 'rise' : 'sinklava', w: 3, style: 'basalt', per: 220, off: i * 40, dist: 3, sink: .45, max: 60 }));
    b.o('hazard', 80, 3, { kind: 'geyser', per: 160, on: 50, hgt: 6 });
    b.o('dropper', 85, 3, { kind: 'rock', w: 15, per: 85 });
    b.e('firesprite', 90, 10);
    b.coins(70, 15, 3).coins(90, 15, 3);
    b.ground(111, 120, G);
    b.o('check', 113, G - 1);
    // WATER CHAMBER
    b.ground(121, 165, 25); b.liquid(121, 10, 45, 15, 'water');
    b.r(130, 10, 1, 10, T.ALT); b.r(140, 15, 1, 10, T.ALT); b.r(150, 10, 1, 10, T.ALT);
    b.e('robofish', 135, 16).e('jelly', 145, 12).e('robofish', 155, 20);
    b.o('bubblevent', 125, 24).o('bubblevent', 145, 24).o('bubblevent', 160, 24);
    b.coins(132, 21, 6).coins(152, 14, 6);
    // medal 2: deep water vault
    b.r(156, 21, 6, 1, T.ALT); b.r(156, 22, 1, 3, T.ALT); b.medal(159, 23);
    b.ground(166, 180, G);
    b.o('check', 168, G - 1);
    // MECHANICAL PLATFORMS + conveyors over the abyss
    b.r(181, 24, 50, 1, T.SPIKE);
    b.o('plat', 182, 18, { kind: 'path', w: 3, style: 'tech', path: [[8, 0], [8, -5], [16, -5]], speed: 1.1, wait: 20 });
    b.isl(202, 13, 5, 1, T.CONVR);
    b.o('plat', 208, 13, { kind: 'circle', w: 2, style: 'tech', r: 3, per: 260 });
    b.o('plat', 208, 13, { kind: 'circle', w: 2, style: 'tech', r: 3, per: 260, ang: Math.PI });
    b.e('drone', 200, 8).e('lturret', 215, 3, { ceil: true });
    b.isl(214, 16, 4, 1, T.ALT);
    // GRAVITY CHAMBER
    b.isl(218, 16, 6, 9, T.ALT);
    b.o('gravsw', 222, 14, { set: -1 });
    b.r(224, 3, 30, 1, T.ALT); b.r(224, 25, 30, 1, T.SPIKE);
    b.r(230, 4, 2, 1, T.SPIKED); b.r(240, 4, 2, 1, T.SPIKED);
    b.e('lturret', 235, 23);
    b.o('gravsw', 251, 6, { set: 1 });
    b.isl(250, 9, 4, 1, T.ALT);
    // artifact: on the gravity ceiling side room
    b.r(244, 1, 4, 2, T.BGWALL); b.clear(245, 3, 2, 1); b.o('artifact', 246, 1);
    b.ground(254, 280, 12);
    // medal 3: control room catwalk
    b.isl(262, 6, 4, 1, T.PLAT); b.medal(264, 5);
    b.e('guard', 260, 11);
    b.deco('computer', 268, 11).deco('monitor', 272, 11);
    b.o('goal', 275, 11);
    b.talkStart = [{ who: 'aaron', text: "This is it. The deepest part of Achmed's lab.", mood: 'angry' }];
    return b.done();
  };

  // ---------------- 8-3 THE LAST DEFENSE ----------------
  L['8-3'] = () => {
    const b = new LB({ w: 110, h: 22, world: 8, act: 3 });
    b.r(0, 0, 110, 22, T.BGWALL);
    const G = 15;
    b.start(3, G - 1);
    b.ground(0, 30, G);
    b.r(0, 0, 110, 3, T.ALT);
    b.e('guard', 18, G - 1);
    b.isl(10, 9, 3, 1, T.PLAT); b.medal(11, 8);
    b.ground(31, 60, G);
    b.r(36, G, 10, 1, T.EFLOOR); b.o('hazard', 36, G, { kind: 'efloor', w: 10, per: 140, on: 60 });
    b.isl(38, 11, 6, 1, T.PLAT); b.medal(41, 10);
    b.e('exbot', 52, G - 1);
    b.ground(61, 86, G);
    b.o('tele', 64, G - 1, { id: 'x', to: 'y' }); b.isl(70, 6, 6, 1, T.ALT); b.o('tele', 72, 5, { id: 'y', to: 'x' }); b.medal(74, 5);
    b.o('heart', 78, G - 2); b.o('orb', 80, G - 2);
    b.arena(88, G, 'omega', { ceil: false });
    b.talkStart = [{ who: 'achmed', text: 'Omega Guardian: armed with the power of every robot you destroyed. Goodbye, Aaron!', mood: 'laugh' }];
    return b.done();
  };

  // ---------------- 8-4 FINAL BATTLE: DR. ACHMED ----------------
  L['8-4'] = () => {
    const b = new LB({ w: 34, h: 16, world: 8, act: 4, bgAct: 3, music: 'final', ambient: false });
    const G = 13;
    b.r(0, 0, 34, 16, T.BGWALL);
    b.start(4, G - 1);
    b.r(0, G, 34, 3, T.ALT); b.r(0, 0, 2, G, T.ALT); b.r(32, 0, 2, G, T.ALT);
    b.o('trigger', 6, 0, { boss: 1 });
    b.o('achmed', 2, G - 1, { ax: 2, ay: G - 10, aw: 30, ah: 11, floor: G, music: 'final' });
    b.isl(2, 8, 3, 1, T.PLAT); b.isl(28, 8, 3, 1, T.PLAT); b.isl(14, 5, 5, 1, T.PLAT);
    return b;
  };
})();
