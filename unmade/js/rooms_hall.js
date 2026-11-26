'use strict';
// ============================================================
//  Prologue (the Creator's workshop) + THE DARK HALLWAYS
// ============================================================
(function () {
  const W = U.World, D = U.Dlg, S = U.State;
  const say = (who, ...l) => D.say(who, ...l);
  const flag = (k, v) => S.flag(k, v);
  const P = () => W.player;
  const TS = 16;
  const tx = n => n * TS + 8, ty = n => n * TS + 14;

  // a lamp that is only lit once a flag is set
  const lamp = (x, y, litFlag, extra) => Object.assign({ kind: 'prop', prop: 'lampstand', tx: x, ty: y, noAnim: false,
    light: (e) => (!litFlag || flag(litFlag)) ? { r: 52, oy: -22, col: 'blue' } : null,
    init(e) { e.noAnim = !!(litFlag && !flag(litFlag)); } }, extra || {});
  const symbol = (x, y, key) => ({ kind: 'prop', prop: 'symbol', tx: x, ty: y, oy: -2, solid: false, zSort: -40, ibox: [-10, -16, 20, 24],
    talk: function* () {
      const m = S.meta; const first = !m.symbols[key]; m.symbols[key] = true; S.saveMeta();
      yield say('narr', 'A strange mark is carved into the wall.\nA circle, above two lines.', first ? 'It looks a lot like you.' : 'It still looks a lot like you.');
      const n = Object.keys(m.symbols).length;
      if (n >= 3) yield say('creator', '{c}' + ['YOU FOUND MY SIGNATURE.', 'I SIGN EVERYTHING I MAKE.', 'EVERYTHING.'][Math.min(2, n - 3)]);
    } });

  // =====================================================================
  //  PROLOGUE — THE CREATOR'S WORKSHOP
  // =====================================================================
  U.defRoom('ws_lab', {
    name: 'The Workshop', tileset: 'ws', music: 'workshop', dark: .5, plight: 40,
    map: [
      '####################',
      '####################',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#.......,,,,.......#',
      '#.......,,,,.......#',
      '#..................#',
      '#..................#',
      '#cc................#',
      '#..................#',
      '####################',
    ],
    ents() {
      const inst = (S.meta.resets || 0) + 1;
      const list = [
        { id: 'machine', kind: 'prop', prop: 'machine', x: 160, y: 126, light: { r: 46, oy: -30, col: 'blue' }, talk: machineTalk },
        { kind: 'prop', prop: 'wsboard', tx: 5, ty: 1, solid: false, ibox: [-24, -30, 48, 40], talk: function* () {
          yield say('narr', 'Blueprints are pinned to the wall.', 'PORTAL ENGINE - REVISION 7.\nDESTINATION: THE SEALED PLACE.', 'Most of it is crossed out.', 'Scribbled in the margin, in very small letters:\n{x}"needs a passenger?"');
          S.meta.seen.blueprint1 = true;
        } },
        { kind: 'prop', prop: 'wsdesk', tx: 15, ty: 3, talk: function* () {
          yield say('narr', 'A computer hums on the desk. The screen reads:', '{b}SUBJECT: $NAME\nSTATUS: CURIOUS\nINSTANCE: ' + inst, '...How does it know your name?');
          yield say('narr', 'Two sticky notes are stuck to the monitor.', 'One says: DO NOT ACTIVATE.', 'The other one is smaller.\n{x}"leave the hatch open tonight."');
          yield say('narr', 'Next to the keyboard, a mug of coffee.\nIt is still warm.');
        } },
        { kind: 'prop', prop: 'wschair', tx: 15, ty: 4 },
        { kind: 'prop', prop: 'wsshelf', tx: 2, ty: 2, talk: function* () { yield say('narr', 'Shelves of spare parts. Gears, springs, wire.', 'A small box is labelled {r}HANDS{w}.\nIt is empty.'); } },
        { kind: 'prop', prop: 'wsdoor', tx: 17, ty: 1, solid: false, ibox: [-10, -20, 20, 30], talk: function* () { yield say('narr', 'The door is locked.', '...From the outside.'); } },
        { kind: 'prop', prop: 'crate', tx: 17, ty: 9 }, { kind: 'prop', prop: 'crate', tx: 18, ty: 10 },
        { kind: 'item', item: 'lint', tx: 12, ty: 9, flag: 'gotLint', text: ['Something fuzzy is stuck under the machine.'], draw: sparkle },
      ].filter(Boolean);
      if (flag('gotLint')) list.pop();
      if (S.meta.resets > 0) list.push({ kind: 'prop', id: 'watcher', tx: 17, ty: 1, solid: false, zSort: -30, life: 70, init(e) { e.t0 = W.t; }, draw(ctx, e, x, y) {
        const k = W.t - e.t0; if (k > e.life) return;
        ctx.globalAlpha = Math.max(0, 1 - k / e.life) * .9; ctx.fillStyle = '#000';
        ctx.fillRect(x - 5, y - 30, 10, 26); ctx.fillRect(x - 3, y - 36, 6, 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 34, 1, 1); ctx.fillRect(x + 1, y - 34, 1, 1); ctx.globalAlpha = 1;
      } });
      return list;
    },
    enter: function* () {
      if (flag('wsIntro')) return;
      flag('wsIntro', true);
      yield 30;
      yield say('narr', '...', S.meta.resets > 0 ? 'You are back in the workshop.\nIt feels like you have been here before.' : 'The workshop is quiet. Whoever was working here is gone.');
    },
  });
  function sparkle(ctx, e, x, y) { if ((W.t >> 3) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 6, 1, 3); ctx.fillRect(x - 1, y - 5, 3, 1); } else { ctx.fillStyle = '#aaa'; ctx.fillRect(x, y - 5, 1, 1); } }
  U.sparkle = sparkle;
  function* machineTalk(W, S, e) {
    yield say('narr', 'The machine hums. Its hatch is open.', 'Inside, there is only light.');
    const n = (flag('machineNo') || 0);
    const a = yield D.ask('narr', 'Hop inside?', ['Yes', 'No']);
    if (a !== 0) { flag('machineNo', n + 1); yield say('narr', n === 0 ? "You decide not to.\n...But you're curious." : n === 1 ? "You decide not to.\n...You're still curious." : 'You are very, very curious.'); return; }
    // in you go
    const p = P();
    yield W.walk(p, 160, 134, 1);
    p.dir = 'up';
    yield 10;
    yield W.hop(p, 14, 18);
    p.pose = 'hidden';
    U.Audio.sfx('door');
    yield 30;
    e.state = 'on'; U.Audio.stopMusic(.5); U.Audio.sfx('hum');
    yield 50; U.Audio.sfx('power'); U.FX.shake(2, 60);
    yield 40; U.FX.glitch(40, .7); U.Audio.sfx('glitch');
    yield 30; U.Audio.sfx('boom'); U.FX.flashScreen('#ffffff', 40); U.FX.shake(6, 30);
    yield U.FX.fadeTo(1, 30, '#ffffff');
    yield 30;
    U.FX.fadeCol = '#000'; U.FX.fade = 1;
    yield 60;
    W.load('hall_dark', [3, 4], 'right');
    P().pose = 'lying';
    yield 50;
    yield U.FX.fadeTo(0, 90);
    yield* U.Rooms.hall_dark.enter(W, S);
  }

  // =====================================================================
  //  GENOCIDE: when the halls fall silent, HANDS take shape
  // =====================================================================
  U.Hooks.afterEmpty = function* (W, area) {
    if (area === 'hall' && S.genocideTrack() && !flag('gotHands')) yield* handsEvent();
    W.playMusic();
  };
  function* handsEvent() {
    flag('gotHands', true);
    U.Audio.stopMusic(0);
    yield 40;
    yield say('narr', '{x}...');
    yield say('narr', 'Something is happening at your sides.');
    U.Audio.sfx('power'); U.FX.shake(2, 50); U.FX.glitch(20, .4);
    yield 60;
    const r = S.run;
    if (r.weapon !== 'barefeet' && r.weapon !== 'hands') { if (!S.give(r.weapon)) { /* it is simply gone */ } }
    r.weapon = 'hands';
    U.Audio.sfx('hands');
    W.parts.burst(P().x, P().y - 14, 20, { col: '#ff8080', smin: .4, smax: 1.4, lmin: 20, lmax: 40 });
    yield 30;
    yield say('narr', 'Two {r}HANDS{w} take shape out of nothing.', 'They float beside you. Waiting.', 'They feel like they were always yours.', '(You equipped the {r}HANDS{w}.)');
  }

  // =====================================================================
  //  1. THE DARK — Sun's welcome, the Ex-Queen's rescue
  // =====================================================================
  U.defRoom('hall_dark', {
    name: 'The Dark', area: 'hall', tileset: 'hall', dust: true,
    music: S => S.flag('rescued') ? 'hall' : null,
    dark: S => S.flag('rescued') ? .55 : .985, plight: 26,
    map: [
      '########################################',
      '########################################',
      '#......................................#',
      '#.......................................',
      '#..............,........................',
      '#.......................................',
      '#......................................#',
      '########################################',
      '########################################',
    ],
    exits: [{ x: 39, y: 3, h: 3, to: 'hall_lantern', at: [1, 10], dir: 'right' }],
    ents() {
      const l = [lamp(6, 2, 'rescued'), lamp(14, 2, 'rescued'), lamp(22, 2, 'rescued'), lamp(30, 2, 'rescued'), lamp(37, 2, 'rescued'), symbol(26, 1, 'dark')];
      if (!flag('rescued')) l.push({ id: 'sun', kind: 'npc', char: 'sun', tx: 17, ty: 4, alpha: 0, visible: false, light: e => e.visible ? { r: 60, oy: -16, col: 'sun' } : null, solid: [10, 4] });
      return l;
    },
    enter: function* () {
      if (flag('woke')) return;
      flag('woke', true);
      const p = P();
      p.pose = 'lying';
      yield 40;
      yield say('narr', '...');
      yield 20;
      p.pose = null; p.dir = 'down'; U.Audio.sfx('step');
      yield W.hop(p, 6, 12);
      yield 20;
      p.dir = 'left'; yield 24; p.dir = 'right'; yield 24;
      yield say('narr', 'It is completely dark.');
    },
    update(W, S) {
      if (flag('rescued') || U.Script.busy) return;
      if (!flag('sunSeen') && P().x > tx(8)) { flag('sunSeen', true); U.Script.run(sunMeet()); return; }
      const sun = W.find('sun');
      if (flag('sunTalked') && sun && U.dist(P().x, P().y, sun.x, sun.y) < 28) { flag('sunTalked', false); U.Script.run(sunBattle()); }
    },
  });
  function* sunMeet() {
    const sun = W.find('sun'), p = P();
    sun.visible = true; U.Audio.sfx('sparkle');
    for (let i = 0; i <= 20; i++) { sun.alpha = i / 20; yield 1; }
    U.Audio.music('sun');
    const again = S.meta.resets > 0 && S.meta.seen.sunIntro;
    if (!again) {
      yield say('sun', '@happy Oh! Hey! Hi! Over here!', "Wow, you're new! Nobody new EVER falls in here!", "@wink I'm SUN!", '@happy ...Sun! The sun! Get it? Because I am one!', "@laugh You look kinda lost. And kinda round. Ha ha! We've got that in common!", "@happy Don't worry. I'll show you how things work down here.", 'Somebody has to, right?', 'First things first: walk over to me!');
    } else {
      yield say('sun', '@happy Oh! Hey! Hi! Over h-', '@blank ...', '@sly Oh. You.', '@grin Come here. Let\'s get this over with.');
    }
    flag('sunTalked', true);
  }
  function* sunBattle() {
    const sun = W.find('sun'), p = P();
    const again = S.meta.resets > 0 && S.meta.seen.sunIntro;
    if (!again) yield say('sun', '@wink Great! You\'re a natural!', "@happy Okay, next lesson. Don't be nervous!");
    const r = yield U.Battle.start({ enemies: ['sun_tut'], area: null, noFear: true });
    // rescued
    W.remove(sun);
    flag('rescued', true);
    U.Audio.music('exqueen');
    const q = W.npc('exqueen', 'exqueen', -2, 4, 'right', { light: { r: 40, oy: -14, col: 'blue' } });
    yield W.walk(q, p.x - 30, p.y, 1.2);
    q.dir = 'right'; p.dir = 'left';
    yield say('exqueen', '@worried Are you alright, little one?', '@kind Do not be afraid. I will not hurt you.', '@stern That creature is gone. It will not bother you while I am near.');
    yield say('exqueen', '@kind I am...', '@sad ...Hm. Once, I was the Queen of all monsterkind.', '@kind Now I am only the keeper of these old halls. Most folk call me the Ex-Queen. You may as well.', '@surprised You fell from somewhere very far away. Didn\'t you?', '@kind You must be frightened. Come. My home is not far from here.', '@happy I will light the way.');
    // she lights the lanterns as she walks
    W.ents.filter(e => e.prop === 'lampstand').forEach(e => { e.noAnim = true; });
    const lamps = W.ents.filter(e => e.prop === 'lampstand').sort((a, b) => a.x - b.x);
    q.dir = 'right';
    for (const L of lamps) {
      yield W.walk(q, L.x, ty(4), 1.3);
      L.noAnim = false; U.Audio.sfx('chime');
      W.parts.burst(L.x, L.y - 24, 8, { col: '#9ad8ff', smin: .3, smax: 1, lmin: 14, lmax: 24 });
      yield 8;
    }
    yield W.walk(q, tx(38), ty(4), 1.3);
    q.dir = 'left';
    yield say('exqueen', '@kind This way, little one.');
    yield W.walk(q, tx(41), ty(4), 1.3);
    W.remove(q);
  }

  // =====================================================================
  //  2. LANTERN HALL — the flicker puzzle
  // =====================================================================
  const SEQ = [2, 0, 1];
  U.defRoom('hall_lantern', {
    name: 'Lantern Hall', area: 'hall', tileset: 'hall', dust: true, music: 'hall', dark: .45,
    map: [
      '####################',
      '#########dd#########',
      '#########dd#########',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '#..................#',
      '...................#',
      '...................#',
      '...................#',
      '####################',
      '####################',
    ],
    exits: [{ x: 0, y: 9, h: 3, to: 'hall_dark', at: [38, 4], dir: 'left' }, { x: 9, y: 1, w: 2, to: 'hall_moss', at: [10, 11], dir: 'up' }],
    ents() {
      const solved = flag('lanternSolved');
      const l = [];
      [4, 10, 16].forEach((x, i) => {
        l.push({ id: 'lamp' + i, kind: 'prop', prop: 'lampstand', tx: x, ty: 4, ox: i === 1 ? -8 : 0, i,
          light: e => (solved || flag('lanternSolved') || e.lit) ? { r: 44, oy: -22, col: 'blue' } : { r: 14, oy: -22 }, init(e) { e.noAnim = !solved; } });
        l.push({ id: 'plate' + i, kind: 'prop', prop: 'plate', tx: x, ty: 7, ox: i === 1 ? -8 : 0, state: solved ? 'on' : 'off', i, flat: true });
      });
      l.push({ id: 'gateL', kind: 'prop', prop: 'gate', tx: 9, ty: 2, state: solved ? 'open' : 'closed', solid: solved ? false : [16, 10], zSort: 1 });
      l.push({ id: 'gateR', kind: 'prop', prop: 'gate', tx: 10, ty: 2, state: solved ? 'open' : 'closed', solid: solved ? false : [16, 10], zSort: 1 });
      l.push({ kind: 'save', tx: 3, ty: 6, label: 'Lantern Hall', text: ['(The soft lantern light makes you feel a little more REAL.)', 'HP fully restored.'] });
      l.push({ kind: 'sign', prop: 'sign', tx: 17, ty: 10, text: ['"Watch the lights. Walk the order."', '"- written by a very bored royal architect"'] });
      if (!flag('lanternSolved')) l.push({ id: 'exqueen', kind: 'npc', char: 'exqueen', tx: 12, ty: 3, dir: 'down', light: { r: 34, oy: -14, col: 'blue' },
        talk: function* () { yield say('exqueen', flag('lanternHint') ? '@kind Watch the lanterns closely. Then walk the plates in the same order.' : '@kind Take your time, little one.'); flag('lanternHint', true); } });
      return l;
    },
    load(W) { W.puz = { step: 0, t: 0, on: [] }; },
    enter: function* () {
      if (flag('lanternTalk') || flag('lanternSolved')) return;
      flag('lanternTalk', true);
      yield 10;
      yield say('exqueen', '@kind These halls are full of old puzzles.', '@kind The royal family built them long ago, to keep the children from wandering off.', '@happy Some children wandered anyway.', '@kind Watch the lanterns. When they flicker, step on the plates in the same order.', '@kind Go on. I will wait by the door.');
    },
    update(W, S) {
      if (flag('lanternSolved')) return;
      const z = W.puz; z.t++;
      // flicker the sequence
      const cyc = z.t % 200;
      W.ents.filter(e => e.id && e.id.startsWith('lamp')).forEach(e => {
        const k = SEQ.indexOf(e.i);
        const on = cyc >= 20 + k * 34 && cyc < 20 + k * 34 + 22;
        e.lit = on || z.on.includes(e.i); e.noAnim = !e.lit;
        if (on && cyc === 20 + k * 34) U.Audio.sfx('chime');
      });
      if (U.Script.busy) return;
      const p = P();
      for (const pl of W.ents.filter(e => e.id && e.id.startsWith('plate'))) {
        const over = Math.abs(p.x - pl.x) < 8 && Math.abs(p.y - 4 - (pl.y - 6)) < 8;
        if (over && !pl.pressed) {
          pl.pressed = true;
          if (z.on.includes(pl.i)) continue;
          if (SEQ[z.on.length] === pl.i) { z.on.push(pl.i); pl.state = 'on'; U.Audio.sfx('switch'); if (z.on.length === 3) U.Script.run(lanternSolved()); }
          else { U.Audio.sfx('wrong'); z.on = []; W.ents.filter(e => e.id && e.id.startsWith('plate')).forEach(e => e.state = 'off'); }
        } else if (!over) pl.pressed = false;
      }
    },
  });
  function* lanternSolved() {
    flag('lanternSolved', true);
    U.Audio.sfx('solve');
    W.ents.filter(e => e.id && e.id.startsWith('lamp')).forEach(e => { e.noAnim = false; e.lit = true; });
    yield 20;
    ['gateL', 'gateR'].forEach(id => { const g = W.find(id); g.state = 'open'; g.solid = false; });
    U.Audio.sfx('door');
    S.run.rel.exqueen++;
    const q = W.find('exqueen');
    if (q) {
      q.dir = 'down';
      yield say('exqueen', '@happy Wonderful! You are a clever one.', '@kind Come along now.');
      yield W.walk(q, tx(9) + 8, ty(3), 1.2);
      yield W.walk(q, tx(9) + 8, ty(0), 1.2);
      W.remove(q);
    }
  }

  // =====================================================================
  //  3. MOSSY CORRIDOR — the first real monster
  // =====================================================================
  U.defRoom('hall_moss', {
    name: 'Mossy Corridor', area: 'hall', tileset: 'hall', dust: true, music: 'hall', dark: .4, enc: true,
    map: [
      '########################',
      '##################dd####',
      '##################dd####',
      '#.....m...........m....#',
      '#..mmm............#....#',
      '#...m.............#....#',
      '#.................#....#',
      '#wwwwwww..........#....#',
      '#wwwwwww..........#....#',
      '#..........mm..........#',
      '#.....................m#',
      '#..mm..............mmm.#',
      '##########..############',
      '##########..############',
    ],
    exits: [{ x: 10, y: 13, w: 2, to: 'hall_lantern', at: [9, 3], dir: 'down' }, { x: 18, y: 1, w: 2, to: 'hall_rocks', at: [1, 7], dir: 'right' }],
    ents() {
      const l = [
        { kind: 'sign', prop: 'sign', tx: 8, ty: 10, text: ['"LANTERNS LIGHT THE WAY HOME."', '"Please do not eat the moss. - the Ex-Queen"'] },
        { id: 'bowl', kind: 'prop', prop: 'candybowl', tx: 3, ty: 4, talk: candyBowl },
        lamp(14, 3), lamp(21, 9),
      ];
      if (!flag('gotGlowcap1')) l.push({ kind: 'item', item: 'glowcap', prop: 'glowcap', tx: 22, ty: 4, flag: 'gotGlowcap1', text: ['A glowing mushroom is growing in the corner.'] });
      if (!flag('mossTut')) l.push({ id: 'exqueen', kind: 'npc', char: 'exqueen', tx: 11, ty: 8, dir: 'down', light: { r: 34, oy: -14, col: 'blue' } });
      return l;
    },
    enter: function* () {
      if (flag('mossTut')) return;
      const q = W.find('exqueen'), p = P();
      yield 10;
      yield say('exqueen', '@kind Monsters live in these halls.', '@kind If one approaches you, do not be frightened. Try talking to it.', '@happy ACT, the young ones call it. Most of us only want to be understood.');
      yield 10;
      // a Wickling wanders up
      yield say('exqueen', '@surprised Oh! Speak of the lantern...', '@kind A Wickling. They are very shy. Go on, try talking to it.');
      U.Audio.sfx('alert'); W.alertT = 26; yield 26;
      const r = yield U.Battle.start({ enemies: ['wickling'], area: 'hall' });
      q.dir = 'down';
      if (r && r.outcome === 'kill') { S.run.rel.exqueen -= 2; yield say('exqueen', '@surprised ...Oh.', '@sad ...', '@worried I suppose... sometimes it cannot be helped.', '@sad Please. Try to talk to them first.'); }
      else if (r && r.outcome === 'flee') yield say('exqueen', '@happy Running away works too. There is no shame in it.');
      else { S.run.rel.exqueen++; yield say('exqueen', '@happy Wonderful! You see? It only wanted someone to stand up for it.'); }
      yield say('exqueen', '@kind Now, I must go ahead and prepare a few things.', '@kind My home is at the end of this path. Follow the lanterns, and you cannot get lost.', '@stern ...And please. Do not talk to any strange suns.');
      flag('mossTut', true);
      yield W.walk(q, tx(18) + 8, ty(9), 1.4);
      yield W.walk(q, tx(18) + 8, ty(0), 1.4);
      W.remove(q);
    },
  });
  function* candyBowl() {
    const n = flag('candyTaken') || 0;
    if (n >= 3) { yield say('narr', 'The bowl is empty.', S.genocideTrack() ? '...' : 'You feel a little bit guilty.'); return; }
    yield say('narr', n === 0 ? 'A bowl of glowing candies. A little card says:\n"Take one, little ones. - E.Q."' : n === 1 ? 'There are still candies in the bowl.' : 'There is one candy left.');
    const a = yield D.ask('narr', 'Take a candy?', ['Yes', 'No']);
    if (a !== 0) return;
    if (!S.give('candy')) { yield say('narr', 'You are carrying too much.'); return; }
    flag('candyTaken', n + 1); U.Audio.sfx('item');
    yield say('narr', ['You take a Lantern Candy.', 'You take another one. Nobody is watching.', 'You take the last one. Somebody, somewhere, sighs.'][n]);
  }

  // =====================================================================
  //  4. RUBBLE ROOM — push the rocks onto the plates
  // =====================================================================
  const ROCK_START = [{ id: 'rockA', x: 6, y: 6 }, { id: 'rockB', x: 8, y: 3 }];
  const PLATES = [{ x: 6, y: 10 }, { x: 10, y: 3 }];
  U.defRoom('hall_rocks', {
    name: 'Rubble Room', area: 'hall', tileset: 'hall', dust: true, music: 'hall', dark: .45, enc: true,
    map: [
      '########################',
      '########################',
      '#.............#........#',
      '#.............#........#',
      '#.............#........#',
      '#.............#........#',
      '#.............#........#',
      '...............,........',
      '........................',
      '#.............#........#',
      '#.............#........#',
      '#.r...........#..r.....#',
      '#.............#........#',
      '#.............#........#',
      '########################',
      '########################',
    ],
    exits: [{ x: 0, y: 7, h: 2, to: 'hall_moss', at: [18, 3], dir: 'down' }, { x: 23, y: 7, h: 2, to: 'hall_bridge', at: [1, 6], dir: 'right' }],
    ents() {
      const solved = flag('rocksSolved');
      const l = [];
      const pos = flag('rockPos') || ROCK_START.map(r => [r.x, r.y]);
      PLATES.forEach((pl, i) => l.push({ id: 'rp' + i, kind: 'prop', prop: 'plate', tx: pl.x, ty: pl.y, flat: true, state: solved ? 'on' : 'off' }));
      ROCK_START.forEach((r, i) => l.push(rock(r.id, pos[i][0], pos[i][1])));
      [7, 8].forEach(y => l.push({ id: 'spike' + y, kind: 'prop', prop: 'spikes', tx: 14, ty: y, oy: 2, flat: true, state: solved ? 'down' : 'up', solid: [16, 16], blocks: e => e.state === 'up' }));
      l.push({ id: 'reset', kind: 'prop', prop: 'plate', tx: 2, ty: 13, flat: true, state: 'off', draw(ctx, e, x, y) { const s = U.Props.sprite('plate', 'off'); ctx.drawImage(s, x - 7, y - 12); U.Font.draw(ctx, '*', x - 2, y - 9, '#ffe23a'); } });
      l.push({ kind: 'sign', prop: 'sign', tx: 3, ty: 2, text: ['"Rocks on plates. Plates lower spikes."', '"Stuck? Step on the star to reset the rocks."'] });
      l.push({ kind: 'prop', prop: 'pillar', tx: 19, ty: 5 }, { kind: 'prop', prop: 'pillar', tx: 19, ty: 10 });
      if (!flag('gotToecaps')) l.push({ id: 'box', kind: 'prop', prop: 'box', tx: 21, ty: 3, talk: function* (W, S, e) {
        if (!S.give('toecaps')) { yield say('narr', 'There is something in the box, but you are carrying too much.'); return; }
        flag('gotToecaps', true); e.state = 'open'; U.Audio.sfx('item');
        yield say('narr', 'There is a pair of little tin caps in the box.', 'They fit perfectly on the ends of your legs.', 'You got the {y}Tin Toecaps{w}.\n(Equip them from the ITEM menu.)');
      } });
      else l.push({ kind: 'prop', prop: 'box', tx: 21, ty: 3, state: 'open', talk: function* () { yield say('narr', 'An empty box.'); } });
      if (!flag('gotBlueprint2')) l.push({ kind: 'prop', prop: 'paper', tx: 20, ty: 11, flat: true, ibox: [-12, -14, 24, 20], talk: function* (W, S, e) {
        flag('gotBlueprint2', true); S.meta.seen.blueprint2 = true; S.saveMeta(); W.remove(e);
        yield say('narr', 'A scrap of paper is wedged behind the pillar.', 'It is a blueprint. A ring-shaped machine with a hatch.', '...It is the machine you hopped into.', 'How did this get here?', 'On the back, in very small letters:\n{x}"second attempt. this time it will work."');
      } });
      return l;
    },
    update(W) {
      if (flag('rocksSolved')) return;
      const p = P(), r = W.find('reset');
      if (r && Math.abs(p.x - r.x) < 7 && Math.abs(p.y - r.y) < 8) {
        if (!r.pressed) { r.pressed = true; U.Audio.sfx('switch'); ROCK_START.forEach(rs => { const e = W.find(rs.id); e.x = tx(rs.x); e.y = ty(rs.y); }); flag('rockPos', null); checkRocks(); }
      } else if (r) r.pressed = false;
    },
  });
  function rock(id, x, y) {
    return { id, kind: 'prop', prop: 'rock', tx: x, ty: y, solid: [14, 12], pushT: 0, lastPush: -9,
      update(e) { if (e.slide) { const s = e.slide; e.x += s.dx * 2; e.y += s.dy * 2; s.n -= 2; if (s.n <= 0) { e.slide = null; checkRocks(); } } },
      push(e, dx, dy, W) {
        if (e.slide || flag('rocksSolved')) return;
        if (PLATES.some(pl => Math.abs(e.x - tx(pl.x)) < 4 && Math.abs(e.y - ty(pl.y)) < 4)) return; // locked on its plate
        if (W.t - e.lastPush > 2) e.pushT = 0;
        e.lastPush = W.t; e.pushT++;
        if (e.pushT < 14) return;
        e.pushT = 0;
        const nx = e.x + dx * TS, ny = e.y + dy * TS;
        const blocked = W.blocked(nx - 7, ny - 12, 14, 12, e);
        const pb = W.pBox(P().x, P().y);
        if (blocked) return;
        e.slide = { dx, dy, n: TS }; U.Audio.sfx('push');
      } };
  }
  function checkRocks() {
    const rocks = ROCK_START.map(r => W.find(r.id));
    flag('rockPos', rocks.map(r => [Math.round((r.x - 8) / TS), Math.round((r.y - 14) / TS)]));
    let all = true;
    PLATES.forEach((pl, i) => {
      const on = rocks.some(r => Math.abs(r.x - tx(pl.x)) < 4 && Math.abs(r.y - ty(pl.y)) < 4);
      W.find('rp' + i).state = on ? 'on' : 'off';
      if (!on) all = false;
    });
    if (all && !flag('rocksSolved')) {
      flag('rocksSolved', true); U.Audio.sfx('solve');
      [7, 8].forEach(y => { W.find('spike' + y).state = 'down'; });
    }
  }

  // =====================================================================
  //  5. THE LONG BRIDGE
  // =====================================================================
  U.defRoom('hall_bridge', {
    name: 'The Long Bridge', area: 'hall', tileset: 'hall', dust: true, music: 'hall', dark: .62, enc: true, plight: 40,
    map: [
      '##################################',
      '##################################',
      '#...#xxxxxxxxxx...xxxxxxxxxxx#...#',
      '#...#xxxxxxxxxxxBxxxxxxxxxxxx#...#',
      '#....xxxxxxxxxxxBxxxxxxxxxxxx....#',
      '#....xxxxxxxxxxxBxxxxxxxxxxxx....#',
      '.....bbbbbbbbbbbbbbbbbbbbbbbb.....',
      '#....xxxxxxxxxxxxxxxxxxxxxxxx....#',
      '#....xxxxxxxxxxxxxxxxxxxxxxxx....#',
      '#...#xxxxxxxxxxxxxxxxxxxxxxxx#...#',
      '##################################',
      '##################################',
    ],
    exits: [{ x: 0, y: 6, to: 'hall_rocks', at: [22, 7], dir: 'left' }, { x: 33, y: 6, to: 'hall_yard', at: [1, 10], dir: 'right' }],
    ents() {
      return [lamp(2, 4), lamp(31, 4), symbol(16, 1, 'bridge'),
        { kind: 'save', tx: 31, ty: 8, label: 'The Long Bridge', text: ['(Far below, something glitters. You feel REAL.)', 'HP fully restored.'] },
        { kind: 'sign', prop: 'sign', tx: 2, ty: 8, text: ['"Do not look down."', '"...Okay, you can look a little."'] }];
    },
  });

  // =====================================================================
  //  6. THE EX-QUEEN'S YARD
  // =====================================================================
  U.defRoom('hall_yard', {
    name: 'Lanternhouse', area: 'hall', tileset: 'hall', dust: true, music: 'hall', dark: .42,
    map: [
      '##########################',
      '##########################',
      '#..........m.............#',
      '#...m..........mm........#',
      '#........................#',
      '#..mm....................#',
      '#........................#',
      '#........................#',
      '#..................m.....#',
      '#........................#',
      '..........,..............#',
      '.........................#',
      '#....m...........mm......#',
      '#........................#',
      '##########################',
      '##########################',
    ],
    exits: [{ x: 0, y: 10, h: 2, to: 'hall_bridge', at: [32, 6], dir: 'left' }, { x: 13, y: 8, to: 'home_main', at: [3, 9], dir: 'up', sfx: 'door' }],
    enter: function* () { if (S.genocideTrack() && S.exhausted('hall') && !flag('gotHands')) { yield* handsEvent(); W.playMusic(); } },
    ents() {
      return [
        { kind: 'prop', prop: 'house', tx: 13, ty: 7 },
        { kind: 'prop', prop: 'lumtree', tx: 5, ty: 8 },
        lamp(9, 9), lamp(17, 9),
        { kind: 'sign', prop: 'sign', tx: 20, ty: 11, text: S.genocideTrack() ? ['"Welcome home."', 'The words have been scratched out.'] : ['"Welcome home."'] },
      ];
    },
  });

  // =====================================================================
  //  7. HOME — the Ex-Queen's house
  // =====================================================================
  U.defRoom('home_main', {
    name: 'Lanternhouse', area: 'hall', tileset: 'home', music: S => S.genocideTrack() && S.exhausted('hall') ? 'empty' : 'exqueen',
    map: [
      '##########################',
      '###W####W#######d####d####',
      '###W####W#######d####d####',
      '#........................#',
      '#........................#',
      '#...====.................#',
      '#...====.................#',
      '#...====.................#',
      '#........................#',
      '#........................#',
      '###.######################',
      '###.######################',
    ],
    exits: [
      { x: 3, y: 11, to: 'hall_yard', at: [13, 9], dir: 'down', sfx: 'door' },
      { x: 16, y: 1, to: 'home_kid', at: [6, 7], dir: 'up', sfx: 'door' },
      { x: 21, y: 1, to: 'home_her', at: [6, 7], dir: 'up', sfx: 'door' },
      { x: 22, y: 9, w: 3, run: goDownstairs },
    ],
    ents() {
      const l = [
        { kind: 'prop', prop: 'fireplace', tx: 6, ty: 2, ox: -8, talk: function* () { yield say('narr', 'A warm fire crackles in the hearth.', S.genocideTrack() ? 'It does not feel warm.' : 'It is very cosy.'); } },
        { kind: 'prop', prop: 'bookshelf', tx: 11, ty: 2, talk: bookshelf },
        { kind: 'prop', prop: 'plant', tx: 1, ty: 3 },
        { kind: 'prop', prop: 'table', tx: 5, ty: 7, ox: 8, state: 'pie', talk: function* () { yield say('narr', 'A moonberry tart sits on the table. Someone has cut a slice out of it.', flag('gotTart') ? 'It smells wonderful.' : '...It smells wonderful.'); } },
        { kind: 'prop', prop: 'mirror', tx: 19, ty: 2, solid: false, ibox: [-10, -20, 20, 30], talk: function* () { yield say('narr', S.run.weapon === 'hands' ? "It's you.\n...With HANDS." : "It's you. Round as ever."); } },
        { kind: 'prop', prop: 'stairs', tx: 23, ty: 9, ox: 0, flat: true, flatOy: 8 },
        { kind: 'prop', prop: 'armchair', tx: 9, ty: 5 },
      ];
      if (!flag('exqLeft')) l.push({ id: 'exqueen', kind: 'npc', char: 'exqueen', tx: 9, ty: 6, dir: 'down', talk: talkExQueen });
      return l;
    },
    enter: function* () {
      if (flag('homeArrived')) return;
      flag('homeArrived', true);
      const q = W.find('exqueen');
      yield 10;
      if (S.genocideTrack() && S.exhausted('hall')) {
        q.dir = 'down';
        yield say('exqueen', '@worried ...', '@worried The halls went quiet.', '@stern I heard them go quiet, one by one.', '@surprised And those... those hands-', '@stern ...Wait here.');
        flag('exqLeft', true);
        yield W.walk(q, tx(23), ty(6), 1.6);
        yield W.walk(q, tx(23), ty(10), 1.6);
        W.remove(q);
        return;
      }
      yield say('exqueen', '@happy There you are! You found your way.', '@kind You must be exhausted, little one.', '@happy I baked something for you. A moonberry tart. Here.');
      if (S.give('moontart')) { U.Audio.sfx('item'); flag('gotTart', true); yield say('narr', 'You got the {y}Moon Tart{w}.'); }
      yield say('exqueen', '@kind I have prepared a room for you, too. The first door down the hall.', '@sad ...It used to belong to someone very dear to me.', '@kind Rest as long as you like. I will be right here.');
    },
  });
  function* bookshelf() {
    const books = [
      ['"A Short History of the Seal"', '"...and so the humans sang the Source Wall into being, and the sky was taken from us."'],
      ['"Lantern Care for Beginners"', '"Chapter 1: Lanterns do not like being called candles."'],
      ['"101 Puns About Snow"', 'Someone has written "these are all terrible - F.G.D." on the cover.'],
      ['"Royal Family Tree"', 'A page has been torn out.'],
    ];
    const i = (flag('book') || 0) % books.length; flag('book', i + 1);
    yield say('narr', 'You pull a book from the shelf.', ...books[i]);
  }
  function* talkExQueen(W, S, q) {
    q.dir = 'down';
    const c = yield D.ask('exqueen', '@kind What is it, little one?', ['About her', 'About the sun', 'Leaving', 'Never mind'], 'kind');
    if (c === 0) {
      S.run.rel.exqueen++;
      yield say('exqueen', '@kind Me? There is not much to tell.', '@sad I lived in the palace once, with the King and our children.', '@sad After we lost our son... I could not stay.', '@kind My daughter, Calia, stayed with her father. She leads the Royal Guard now, if you can believe it.', '@happy She writes to me sometimes. She sounds so grown-up.', '@sad ...She sounds so tired.');
    } else if (c === 1) {
      yield say('exqueen', '@worried That little sun? I do not know where it came from.', '@worried It began wandering these halls a few years ago.', '@sad There is something sad about it, somehow. I cannot explain it.', '@stern ...No. It hurt you. That is all I need to know.');
    } else if (c === 2) {
      if (!flag('askedLeave')) {
        flag('askedLeave', true);
        yield say('exqueen', '@surprised ...Leaving?', '@worried ...', '@kind Let us talk about that later. Would you like some more tart?');
      } else {
        yield say('exqueen', '@sad ...', '@stern Wait here.');
        flag('exqLeft', true);
        yield W.walk(q, tx(23), ty(6), 1.4);
        yield W.walk(q, tx(23), ty(10), 1.4);
        W.remove(q);
      }
    } else yield say('exqueen', '@happy Alright.');
  }
  function* goDownstairs(W, S) {
    if (!flag('exqLeft')) {
      const q = W.find('exqueen');
      yield say('exqueen', '@surprised Wait! Where are you going?', '@worried ...', '@stern Very well. Wait here.');
      flag('exqLeft', true);
      if (q) { yield W.walk(q, tx(23), ty(6), 1.6); yield W.walk(q, tx(23), ty(10), 1.6); W.remove(q); }
      P().y -= 10;
      return;
    }
    yield W.goCmd('hall_deep', [1, 4], 'right', { sfx: 'step' });
  }
  U.defRoom('home_kid', {
    name: 'Bedroom', area: 'hall', tileset: 'home', music: 'exqueen',
    map: ['############', '############', '#..........#', '#..........#', '#..........#', '#....==....#', '#....==....#', '#..........#', '######.#####', '######.#####'],
    exits: [{ x: 6, y: 9, to: 'home_main', at: [16, 3], dir: 'down', sfx: 'door' }],
    ents() {
      const l = [
        { kind: 'prop', prop: 'bed', tx: 2, ty: 5, talk: function* () {
          const a = yield D.ask('narr', 'A small bed. Take a nap?', ['Yes', 'No']);
          if (a !== 0) return;
          yield U.FX.fadeTo(1, 40); U.Audio.stopMusic(1); yield 90; S.fullHeal(); U.Audio.sfx('heal');
          if (!flag('napped') && !S.genocideTrack()) { flag('napped', true); }
          yield U.FX.fadeTo(0, 40); W.playMusic();
          yield say('narr', 'You feel rested.\nHP fully restored.');
        } },
        { kind: 'prop', prop: 'drawing', tx: 6, ty: 1, solid: false, ibox: [-10, -20, 20, 30], talk: function* () { yield say('narr', 'A crayon drawing is taped to the wall.', 'A green hill, a blue sky, and a big, smiling sun in the corner.', 'At the bottom, in wobbly letters:\n"SOMEDAY I\'LL SEE IT - K"'); } },
        { kind: 'prop', prop: 'dresser', tx: 9, ty: 2, talk: function* () { yield say('narr', 'A drawer full of small clothes.', 'Too big for you. Too small for a grown-up.'); } },
      ];
      l.push({ kind: 'prop', prop: 'toybox', tx: 9, ty: 6, talk: function* () {
        if (flag('gotCharm')) { yield say('narr', 'A box of old toys. A wooden sword, a top, a little plush sun.'); return; }
        if (!S.give('charm')) { yield say('narr', 'Something glints under the toys, but you are carrying too much.'); return; }
        flag('gotCharm', true); U.Audio.sfx('item');
        yield say('narr', 'A box of old toys. A wooden sword, a top, a little plush sun.', 'Under the toys, you find a small lantern charm.', 'You got the {y}Old Charm{w}.\nA "K" is scratched into the back.');
      } });
      return l;
    },
  });
  U.defRoom('home_her', {
    name: "Ex-Queen's Room", area: 'hall', tileset: 'home', music: 'exqueen',
    map: ['############', '#####W######', '#####W######', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '######.#####', '######.#####'],
    exits: [{ x: 6, y: 9, to: 'home_main', at: [21, 3], dir: 'down', sfx: 'door' }],
    ents: () => [
      { kind: 'prop', prop: 'desk', tx: 2, ty: 3, talk: diary },
      { kind: 'prop', prop: 'bookshelf', tx: 9, ty: 3 },
      { kind: 'prop', prop: 'plant', tx: 10, ty: 6 },
      { kind: 'prop', prop: 'bed', tx: 2, ty: 7, ox: 0, talk: function* () { yield say('narr', "The Ex-Queen's bed. It is made very neatly."); } },
    ],
  });
  function* diary() {
    yield say('narr', 'A diary lies open on the desk.');
    const pages = [
      '"Calia wrote again. She signs her letters Princess Calia, Captain of the Royal Guard. I laughed for an hour. Then I cried for one."',
      '"Four years today. I made his favourite pie. I could not eat it."',
      '"The little sun came through the east hall again. I chased it away. I do not know why I wanted to cry afterwards."',
      '"Note to self: buy more lantern oil. And snails."',
    ];
    for (const pg of pages) { yield say('narr', pg); }
  }

  // =====================================================================
  //  8. BENEATH THE HOUSE — the long walk
  // =====================================================================
  U.defRoom('hall_deep', {
    name: 'Beneath the House', area: 'hall', tileset: 'hall', dust: true, music: null, dark: .7, plight: 34,
    map: [
      '##########################################',
      '##########################################',
      '#.........................................',
      '#.........................................',
      '#.........................................',
      '##########################################',
      '##########################################',
    ],
    exits: [{ x: 0, y: 2, h: 3, to: 'home_main', at: [22, 8], dir: 'up', sfx: 'step' }, { x: 41, y: 2, h: 3, to: 'hall_gate', at: [7, 11], dir: 'up' }],
    ents() {
      const l = [lamp(6, 2), lamp(16, 2), lamp(26, 2), lamp(36, 2)];
      const geno = S.genocideTrack() && S.exhausted('hall');
      if (!flag('deepDone') && !geno) l.push({ id: 'exqueen', kind: 'npc', char: 'exqueen', tx: 6, ty: 3, dir: 'right', light: { r: 34, oy: -14, col: 'blue' } });
      if (!flag('deepDone') && !geno) {
        l.push({ kind: 'trigger', tx: 4, ty: 2, th: 3, once: 'deep1', run: function* () { const q = W.find('exqueen'); q.dir = 'left'; yield say('exqueen', '@stern You wish to know how to leave these halls.', '@stern There is only one way out. A door, at the end of this corridor.', '@sad I am going to close it. For good.'); q.dir = 'right'; yield W.walk(q, tx(18), ty(3), 1); } });
        l.push({ kind: 'trigger', tx: 15, ty: 2, th: 3, once: 'deep2', run: function* () { const q = W.find('exqueen'); q.dir = 'left'; yield say('exqueen', '@stern Beyond that door lies the rest of the kingdom.', '@sad The King... my former husband... believes that anyone who comes from the other side holds the key to our freedom.', '@sad Six have fallen here before you.', '@stern Six never left.'); q.dir = 'right'; yield W.walk(q, tx(30), ty(3), 1); } });
        l.push({ kind: 'trigger', tx: 27, ty: 2, th: 3, once: 'deep3', run: function* () { const q = W.find('exqueen'); q.dir = 'left'; yield say('exqueen', '@sad I will not let that happen to you.', '@stern Go back upstairs. Please.'); q.dir = 'right'; yield W.walk(q, tx(43), ty(3), 1.2); W.remove(q); flag('deepDone', true); } });
      }
      return l;
    },
  });
  U.defRoom('hall_gate', {
    name: 'The Great Door', area: 'hall', tileset: 'hall', dust: true, music: null, dark: .5,
    map: [
      '################',
      '#######dd#######',
      '#######dd#######',
      '#..............#',
      '#..............#',
      '#..=========...#',
      '#..=========...#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#..............#',
      '#######..#######',
      '#######..#######',
    ],
    exits: [{ x: 7, y: 13, w: 2, to: 'hall_deep', at: [40, 3], dir: 'left' }, { x: 7, y: 1, w: 2, to: 'hall_after', at: [1, 4], dir: 'right', when: S => S.flag('exqDone') }],
    ents() {
      const l = [lamp(3, 3), lamp(12, 3)];
      if (!flag('exqDone')) l.push({ id: 'exqueen', kind: 'npc', char: 'exqueen', tx: 7, ty: 3, ox: 8, dir: 'down', light: { r: 40, oy: -14, col: 'blue' }, solid: [24, 8] });
      return l;
    },
    enter: function* () {
      if (flag('exqDone')) return;
      const q = W.find('exqueen');
      yield 10;
      const geno = S.genocideTrack() && S.exhausted('hall');
      if (geno) yield say('exqueen', '@stern ...', '@stern Whatever you are... you are not leaving these halls.');
      else yield say('exqueen', '@sad ...You came anyway.', '@sad You are just like every child who ever lived in that room.', '@stern Very well.', '@stern Prove to me that you are strong enough to survive out there.');
      const r = yield U.Battle.start({ enemies: ['exqueen'], area: 'hall', noFear: true });
      flag('exqDone', true);
      if (S.run.bosses.exqueen === 'spared') {
        U.Audio.music('exqueen');
        q.dir = 'down';
        yield say('exqueen', '@tearful ...', '@kind Come here, little one.');
        yield W.walk(q, P().x, P().y - 12, 1);
        yield say('narr', 'The Ex-Queen hugs you.\nYou have no arms, so you lean into it as hard as you can.');
        yield say('exqueen', '@kind If you truly wish to leave, I will not stop you.', '@sad But please... be careful out there.', '@kind And if you ever meet a very serious young lady with a very large sword...', '@happy ...tell her she still owes her mother a letter.', '@kind Go on, now. Before I change my mind.');
        yield W.walk(q, tx(7) + 8, ty(12), 1.1);
        yield W.walk(q, tx(7) + 8, ty(14), 1.1);
        W.remove(q);
      } else {
        W.remove(q);
        U.Audio.stopMusic(1);
        yield 60;
      }
      W.playMusic();
    },
  });
  U.defRoom('hall_after', {
    name: 'The Last Hall', area: 'hall', tileset: 'hall', dust: true, music: null, dark: .7, plight: 30,
    map: [
      '########################',
      '########################',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '########################',
      '########################',
    ],
    exits: [{ x: 0, y: 4, to: 'hall_gate', at: [7, 3], dir: 'down' }, { x: 23, y: 2, h: 4, to: 'frost_gate', at: [3, 8], dir: 'right', sfx: 'door' }],
    ents() {
      const l = [lamp(20, 2)];
      if (!flag('sunAfter')) l.push({ kind: 'trigger', tx: 9, ty: 2, th: 4, once: 'sunAfter', run: sunAfter });
      return l;
    },
  });
  function* sunAfter() {
    const p = P();
    const sun = W.npc('sun2', 'sun', 14, 4, 'down', { alpha: 0, light: { r: 50, oy: -16, col: 'sun' }, solid: false });
    U.Audio.sfx('sparkle');
    for (let i = 0; i <= 20; i++) { sun.alpha = i / 20; yield 1; }
    const b = S.run.bosses.exqueen;
    const geno = S.genocideTrack();
    if (geno) { sun.expr = 'evil'; yield say('sun', '@evil Hee hee hee.', '@sly Look at you.', '@grin Those are new, aren\'t they? The hands.', "@evil I KNEW you'd figure it out.", '@evil Don\'t stop now.'); }
    else if (b === 'killed') { sun.expr = 'grin'; yield say('sun', '@grin Wow.', '@sly You actually did it.', "@grin I've wanted to see something like that for a long, long time.", '@evil ...Hee hee. You and I are going to get along GREAT.'); }
    else { yield say('sun', '@happy Well, well! You let her go!', '@sly Clever. Really clever.', '@grin But you think being nice will get you through this world?', '@evil We\'ll see how long that lasts.', '@happy See ya around, friend!'); }
    U.Audio.sfx('teleport');
    for (let i = 20; i >= 0; i--) { sun.alpha = i / 20; sun.z += 1; yield 1; }
    W.remove(sun);
  }
})();
