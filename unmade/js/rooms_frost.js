'use strict';
// ============================================================
//  FROSTWOOD — snow forest and the town of Snowbell
// ============================================================
(function () {
  const W = U.World, D = U.Dlg, S = U.State;
  const say = (who, ...l) => D.say(who, ...l);
  const talk = (...parts) => D.talk(...parts);
  const flag = (k, v) => S.flag(k, v);
  const P = () => W.player;
  const TS = 16, tx = n => n * TS + 8, ty = n => n * TS + 14;
  const geno = () => S.genocideTrack();
  const reset = () => S.meta.resets > 0;

  // ---------- extra props ----------
  U.Props.def('cavedoor', { noOutline: true, flat: true, draw() {
    const p = new U.Pix(16, 30);
    p.rect(1, 6, 14, 24, '#0a0c14'); p.rect(3, 3, 10, 3, '#0a0c14'); p.rect(5, 1, 6, 2, '#0a0c14');
    p.hl(0, 15, 29, '#3a4660');
    return p.c;
  } });
  U.Props.def('bigtree', { solid: [10, 6], draw() {
    const c = U.Props.defs.pine.draw();
    const p = new U.Pix(c.width, c.height); p.g.drawImage(c, 0, 0);
    p.tri(14, 3, 17, -3, 20, 3, '#ffe23a'); p.px(17, -1 + 1, '#ffffff');
    return p.c;
  }, anim(ctx, x, y, t) {
    const cols = ['#ff5a5a', '#ffe23a', '#5ab8ff', '#7aff8a'];
    for (let i = 0; i < 12; i++) { const k = (i + (t >> 4)) % 4; ctx.fillStyle = cols[k]; const yy = y - 44 + i * 3.2, xx = x + Math.sin(i * 1.9) * (4 + i * 1.1); ctx.fillRect(Math.round(xx), Math.round(yy), 1, 1); }
  }, light: { r: 50, oy: -24, col: 'warm' } });

  // snowman that can wear YOU as its head
  function snowman(id, x, y) {
    return { id, kind: 'prop', prop: 'snowman', tx: x, ty: y, state: 'headless', talk: function* (W, S, e) {
      if (e.state === 'headless') yield say('narr', 'A snowman with no head.', 'Someone must have really needed a snowball.');
      else yield say('narr', 'A perfectly normal snowman.');
    }, after(ctx, e, sx, sy) {
      if (e.state !== 'you') return;
      const spr = U.Chars.you('down', 0);
      ctx.drawImage(spr, sx - Math.floor(spr.width / 2), sy - 30 - (e.wob ? 1 : 0), spr.width, 13);
    } };
  }

  // =====================================================================
  //  1. FROSTWOOD GATE — meet the brothers
  // =====================================================================
  U.defRoom('frost_gate', {
    name: 'Frostwood', area: 'frost', tileset: 'frost', snow: true, music: S => S.flag('brothersMet') || S.genocideTrack() ? 'frost' : 'fgd',
    map: [
      '########################################',
      '########################################',
      '#######.......T.............t...........',
      '#######..t........................T....#',
      '###:###.........................,......#',
      '#..:............T......................#',
      '#..:::::::::::::::::::::::::::::::::::::',
      '#..:::::::::::::::::::::::::::::::::::::',
      '#..........,..............t............#',
      '#....T.................................#',
      '#.........T..........T........,......T.#',
      '#......................................#',
      '########################################',
      '########################################',
    ],
    exits: [{ x: 3, y: 4, to: 'hall_after', at: [22, 4], dir: 'left', sfx: 'door' }, { x: 39, y: 6, h: 2, to: 'frost_path', at: [1, 6], dir: 'right' }],
    load() { flag('leftHall', true); },
    ents() {
      const l = [
        { kind: 'prop', prop: 'cavedoor', tx: 3, ty: 4, flatOy: 2 },
        snowman('snowman', 23, 5),
        { kind: 'prop', prop: 'bench', tx: 12, ty: 5 },
        { kind: 'save', tx: 6, ty: 9, label: 'Frostwood - Gate', text: () => geno() ? null : ['(The snow is so quiet you can hear yourself being REAL.)', 'HP fully restored.'] },
        { kind: 'sign', prop: 'woodsign', tx: 30, ty: 5, text: () => geno() ? ['"WELCOME TO FROSTWOOD"', 'Someone has added, in shaky letters: "stay inside."'] : ['"WELCOME TO FROSTWOOD"', '"Snowbell: this way. Puzzles: also this way. Sorry."'] },
      ];
      if (!flag('brothersMet') && !geno()) {
        l.push({ id: 'fgd', kind: 'npc', char: 'fgd', tx: 14, ty: 5, dir: 'down' });
        l.push({ kind: 'trigger', tx: 9, ty: 5, th: 4, once: 'brothersMet', run: brothersScene });
      }
      if (!flag('brothersMet') && geno()) l.push({ kind: 'trigger', tx: 12, ty: 5, th: 4, once: 'brothersMet', run: brothersGeno });
      return l;
    },
  });
  function* brothersScene() {
    const f = W.find('fgd'), p = P(), sm = W.find('snowman');
    p.dir = 'right';
    yield say('narr', 'Faint music is leaking out of somebody\'s headphones.');
    f.dir = 'left';
    yield say('fgd', '@shut ...', '@normal oh. hey.', "you're the new kid everyone's not talking about.", "@grin relax. i'm on break.", "@shut been on break since tuesday.");
    if (reset()) yield say('fgd', '@serious ...', '@serious huh.', '@normal nah. nevermind.');
    yield say('sk', '@excited BROTHERRRR!');
    f.dir = 'right';
    yield W.emote(f, '!', 24);
    f.dir = 'left';
    yield say('fgd', '@surprised uh oh.', '@serious quick. do me a favor.', '@wink go stand behind that snowman. trust me.');
    // the player has a few seconds to hide
    const spot = { x: sm.x, y: sm.y + 12 };
    W.extraLights = null;
    let hid = false;
    const until = W.t + 60 * 9;
    const hideThread = { update() { if (!U.Dlg.active && U.dist(p.x, p.y, spot.x, spot.y) < 12) { hid = true; return true; } return W.t > until; } };
    W.freeMove = true; // let the player move while we wait
    yield hideThread;
    W.freeMove = false;
    if (hid) {
      yield W.walk(p, sm.x, sm.y + 6, 1); p.dir = 'down';
      yield W.hop(p, 14, 16);
      p.pose = 'hidden'; sm.state = 'you'; U.Audio.sfx('snow');
    }
    // Superkendal arrives
    U.Audio.music('sk');
    const sk = W.npc('sk', 'sk', 41, 6, 'left');
    yield W.walk(sk, tx(17), ty(6), 2.2);
    sk.dir = 'up'; f.dir = 'down';
    yield talk(['sk', '@excited BROTHER! There you are!', '@determined Have you recalibrated the puzzles yet?!'],
      ['fgd', '@shut yeah. i calibrated them.', '@smirk emotionally.'],
      ['sk', '@confused WHAT DOES THAT MEAN?!'],
      ['fgd', "@grin means they're ready to be solved."],
      ['sk', '@proud KENDAL-TASTIC! Today could be the day!', '@excited Princess Calia says if I keep my eyes open, I will be ready for ANYTHING!']);
    if (hid) {
      sk.dir = 'right';
      yield 30; sm.wob = true; yield 6; sm.wob = false;
      yield talk(['sk', '@thinking ...', '@thinking Brother.', '@confused Was that snowman always so... expressive?'],
        ['fgd', "@normal snowmen are very expressive. it's like, their whole thing."],
        ['sk', '@thinking ...', '@proud TRUE! Snow-science checks out!']);
      S.run.rel.fgd++;
    } else {
      sk.dir = 'right';
      yield W.emote(sk, '!', 30);
      yield talk(['sk', '@shocked ...', '@shocked BROTHER. Is that... a HUMAN?!'],
        ['fgd', "@normal nah. that's a rock."],
        ['sk', '@shocked IT HAS LEGS!'],
        ['fgd', '@shut a rock with legs. rare. protected species.'],
        ['sk', '@thinking ...', '@excited I MUST TELL PRINCESS CALIA!', '@thinking Wait. No. First...', '@determined PUZZLES! Prepare yourself, Rock-With-Legs!']);
      flag('rockWithLegs', true);
    }
    yield say('sk', "@excited I must go prepare! The puzzles won't solve THEMSELVES!", '@thinking ...Well. They will, if somebody solves them!', '@proud KENDAL-TASTIC!');
    yield W.walk(sk, tx(42), ty(6), 2.6);
    W.remove(sk);
    U.Audio.music('fgd');
    if (hid) {
      yield 20;
      yield W.hop(p, 14, 16);
      p.pose = null; sm.state = 'headless'; p.y = sm.y + 14; p.dir = 'down'; U.Audio.sfx('snow');
      f.dir = 'right';
      yield say('fgd', '@grin nice disguise. very cool of you.', '@wink get it? cool.');
    } else yield say('fgd', "@grin ...well. that's one way to meet him.");
    yield say('fgd', '@normal so. that was my little brother.', '@normal he wants to join the royal guard more than anything.', '@serious catching a visitor from the other side would be a big deal for him.', "@normal do me a favor? play along with his puzzles. he's harmless.", "@shut he's ten.", "@normal i'll be around.");
    U.Audio.sfx('teleport');
    for (let i = 0; i < 10; i++) { f.alpha = 1 - i / 10; yield 1; }
    W.remove(f);
    flag('brothersMet', true);
    W.playMusic();
  }
  function* brothersGeno() {
    U.Audio.stopMusic(.5);
    const sk = W.npc('sk', 'sk', 41, 6, 'left');
    yield W.walk(sk, tx(20), ty(6), 1.6);
    yield say('sk', '@worried ...O-oh! Hello!', '@worried Are you... the visitor? From the other side?', "@sad Brother said not to talk to anyone today. He said you might be... sad.", '@determined But I think EVERYONE deserves a chance!', "@happy I'll see you at my puzzles! They're very fun! I promise!");
    yield W.walk(sk, tx(42), ty(6), 2.2);
    W.remove(sk);
    W.playMusic();
  }

  // =====================================================================
  //  2. THE SENTRY STATION
  // =====================================================================
  const JOKES = [
    ['@normal why did the sun go to school?', '@grin to get brighter.'],
    ['@normal what do you call a snowman with a six-pack?', '@grin an abdominal snowman.'],
    ['@normal i tried to make a joke about the source wall.', "@shut couldn't get through it."],
    ['@normal what do snowmen eat for breakfast?', '@grin frosted flakes.', "@normal my brother doesn't get that one. he thinks snowmen don't eat."],
    ["@normal i'd tell you a joke about the time machine...", "@wink but you didn't like it."],
  ];
  U.defRoom('frost_path', {
    name: 'Frostwood - Sentry Post', area: 'frost', tileset: 'frost', snow: true, music: 'frost', enc: true,
    map: [
      '########################################',
      '########################################',
      '#..T......t........T.......T.......t...#',
      '#......................................#',
      '#...........T.............,............#',
      '#......................................#',
      '::::::::::::::::::::::::::::::::::::::::',
      '::::::::::::::::::::::::::::::::::::::::',
      '#.......................,..............#',
      '#....T.............T...............T...#',
      '#.........t............................#',
      '#......................................#',
      '########################################',
      '########################################',
    ],
    exits: [{ x: 0, y: 6, h: 2, to: 'frost_gate', at: [38, 6], dir: 'left' }, { x: 39, y: 6, h: 2, to: 'frost_ice', at: [1, 7], dir: 'right' }],
    ents() {
      const l = [{ kind: 'prop', prop: 'station', tx: 24, ty: 5, talk: function* () { yield say('narr', geno() ? 'A sentry station made of cardboard.\nA note is taped to it: "out. - fgd"' : 'A sentry station made of cardboard and optimism.'); } }];
      if (!geno()) l.push({ id: 'fgd', kind: 'npc', char: 'fgd', tx: 26, ty: 5, dir: 'left', talk: fgdStation });
      if (!geno()) l.push({ id: 'pip', kind: 'npc', char: 'pip', tx: 10, ty: 8, dir: 'up', talk: function* () { yield say('pip', S.run.kills > 3 ? 'Mom says not to talk to strangers today.' : 'Are you a snowball?\nYou look like a snowball.', S.run.kills > 3 ? '...Are you a stranger?' : 'I like snowballs.'); } });
      l.push({ kind: 'sign', prop: 'woodsign', tx: 33, ty: 5, text: ['"PUZZLE AHEAD!"', '"(DO NOT WORRY. IT IS VERY FAIR.)"', '"- SUPERKENDAL"'] });
      if (!flag('gotCone1')) l.push({ kind: 'item', item: 'snowcone', tx: 36, ty: 10, flag: 'gotCone1', draw: U.sparkle, text: ['Someone dropped a snow cone in the snow.', 'It is... still a snow cone.'] });
      return l;
    },
  });
  function* fgdStation(W, S, f) {
    f.dir = 'down';
    const c = yield D.ask('fgd', "@normal hey. welcome to my sentry station. i'm the sentry.", ['Joke', 'Brother', 'The sun', 'Bye']);
    if (c === 0) { const i = (flag('joke') || 0) % JOKES.length; flag('joke', i + 1); S.run.rel.fgd++; yield say('fgd', ...JOKES[i]); }
    else if (c === 1) yield say('fgd', "@normal superkendal? he's the best.", "@shut don't tell him i said that. he'll make a banner.", "@normal he's been dreaming about the royal guard since he could walk.", '@serious the princess is good to him. better than she has to be.');
    else if (c === 2) yield say('fgd', '@serious ...a talking sun, huh.', "@serious yeah. i've seen it around.", '@serious it always seems to know what happens next.', '@normal weird, right?', "@shut i'd keep my distance, kid.");
    else yield say('fgd', '@normal later.');
  }

  // =====================================================================
  //  3. THE SLIPPERY SLOPE OF SUPREME SLIDING (ice puzzle)
  // =====================================================================
  const ICE_MAP = [
    '##########################',
    '##########################',
    '##########################',
    '####iiiiiiiiiiiiiiiiii####',
    '####iiiiiiiriiiiiiiiii####',
    '####iiiiiiiiiiiii.iiii####',
    '####iiiiiiiiiiiiiiiiii####',
    '....iiiiiiiiriiiiiiiii....',
    '####iiiiiiiiiiiiiiiiir####',
    '####iiiiiriiiiiiiiiiii####',
    '####iiiiiiiiiiiiiiiiii####',
    '####iiiiiiiiiiiiiiiiii####',
    '##########################',
    '##########################',
  ];
  U.defRoom('frost_ice', {
    name: 'Frostwood - Ice Puzzle', area: 'frost', tileset: 'frost', snow: true, music: 'frost', enc: false,
    map: ICE_MAP,
    exits: [{ x: 0, y: 7, to: 'frost_path', at: [38, 6], dir: 'left' }, { x: 25, y: 7, to: 'frost_clear', at: [1, 6], dir: 'right' }],
    ents() {
      const solved = flag('iceSolved');
      return [
        { id: 'switch', kind: 'prop', prop: 'iceswitch', tx: 17, ty: 5, flat: true, state: solved ? 'on' : 'off' },
        { id: 'gate', kind: 'prop', prop: 'pinesmall', tx: 23, ty: 7, state: solved ? 'gone' : undefined, visible: !solved, solid: solved ? false : [16, 10] },
        { kind: 'sign', prop: 'woodsign', tx: 2, ty: 6, text: ['"THE SLIPPERY SLOPE OF SUPREME SLIDING"', '"Ice is slippery! You cannot stop until you hit something!"', '"Step on the switch to clear the path!"', '"(If you get stuck, press X to hop back to the start.)"'] },
      ];
    },
    update(W) {
      const p = P();
      if (!flag('iceSolved')) {
        const sw = W.find('switch');
        if (sw && Math.abs(p.x - sw.x) < 8 && Math.abs(p.y - sw.y) < 9) { flag('iceSolved', true); U.Script.run(iceSolved()); }
      }
      // emergency hop back to the start
      if (!W.locked() && U.Input.pressed.cancel && W.tileKey(p.x, p.y - 3) === 'ice' && !p.slide) U.Script.run(iceReset());
    },
    enter: function* () {
      if (flag('iceIntro')) return;
      flag('iceIntro', true);
      const sk = W.npc('sk', 'sk', 2, 8, 'right');
      U.Audio.music('sk');
      if (geno()) yield say('sk', "@worried H-hi! Here's my puzzle!", '@worried Slide across the ice and step on the switch!', '@sad ...Will you try it? Please?');
      else yield say('sk', '@excited AH-HA! You have arrived!', '@proud BEHOLD! THE SLIPPERY SLOPE OF SUPREME SLIDING!', '@determined The ice is VERY slippery. Once you start sliding, you cannot stop until you hit something!', '@excited Step on the SWITCH on that little island to clear the path!', '@proud Good luck! You will need it! KENDAL-TASTIC!');
      yield W.walk(sk, tx(2), ty(15), 2);
      W.remove(sk);
      W.playMusic();
    },
  });
  function* iceSolved() {
    U.Audio.sfx('solve');
    W.find('switch').state = 'on';
    yield 20;
    const g = W.find('gate'); g.visible = false; g.solid = false; U.Audio.sfx('snow');
    W.parts.burst(g.x, g.y - 12, 16, { col: '#ffffff', smin: .5, smax: 1.6, lmin: 16, lmax: 30 });
    S.run.rel.sk++;
    const sk = W.npc('sk', 'sk', 26, 7, 'left');
    yield W.walk(sk, tx(23), ty(7), 2);
    if (geno()) yield say('sk', '@excited You did it!', '@teary See? You CAN do good things!');
    else yield say('sk', '@shocked INCREDIBLE!', '@proud You solved it in only... several attempts!', '@determined But my NEXT challenge will be IMPOSSIBLE!', '@thinking ...ly fun! Impossibly fun!', '@excited KENDAL-TASTIC!');
    yield W.walk(sk, tx(27), ty(7), 2.4);
    W.remove(sk);
  }
  function* iceReset() {
    U.Audio.sfx('teleport');
    yield U.FX.fadeTo(1, 10);
    P().x = tx(2); P().y = ty(7); P().slide = null; P().dir = 'right';
    yield U.FX.fadeTo(0, 10);
  }

  // =====================================================================
  //  4. CATTY'S CLEARING
  // =====================================================================
  U.defRoom('frost_clear', {
    name: "Catty's Clearing", area: 'frost', tileset: 'frost', snow: true, music: 'frost', enc: true,
    map: [
      '################################',
      '################################',
      '#..T...T....t...f.....T.....T..#',
      '#...............f..............#',
      '#..t............f.........t....#',
      '#...............f..............#',
      '::::::::::::::::::::::::::::::::',
      '::::::::::::::::::::::::::::::::',
      '#...............f..............#',
      '#....T..........f.......T......#',
      '#...........t...f..............#',
      '#...............f.......,......#',
      '################################',
      '################################',
    ],
    exits: [{ x: 0, y: 6, h: 2, to: 'frost_ice', at: [24, 7], dir: 'left' }, { x: 31, y: 6, h: 2, to: 'frost_town', at: [1, 13], dir: 'right' }],
    ents() {
      const l = [{ kind: 'save', tx: 4, ty: 9, label: "Frostwood - Catty's Clearing", text: () => geno() ? null : ['(Somebody has been betting on this save point. You feel REAL anyway.)', 'HP fully restored.'] }];
      if (!flag('cattyClear')) {
        l.push({ id: 'catty', kind: 'npc', char: 'catty', tx: 16, ty: 6, oy: 8, dir: 'left', solid: [14, 30] });
        l.push({ kind: 'trigger', tx: 11, ty: 5, th: 4, once: 'cattyClear', run: cattyScene });
      }
      l.push({ kind: 'sign', prop: 'woodsign', tx: 20, ty: 5, text: ['"CATTY\'S CLEARING. NO REFUNDS."'] });
      return l;
    },
  });
  function* cattyScene() {
    const c = W.find('catty'), p = P();
    c.dir = 'left'; p.dir = 'right';
    U.Audio.music('catty');
    if (S.fearActive()) yield say('catty', '@scared H-hold it, pancake...?', "@scared N-nobody crosses my clearing without a b-bet...", '@scared ...Ten coins says you... you...');
    else yield say('catty', '@smug Hold it, pancake!', '@smug Nobody crosses MY clearing without a bet.', '@laugh Ten coins says you can\'t dodge my snowbombs.');
    const r = yield U.Battle.start({ enemies: ['catty'], area: 'frost' });
    const out = r && r.outcome;
    if (out === 'kill') { W.remove(c); yield 30; return; }
    if (out === 'flee') {
      yield say('catty', '@laugh HA! You RAN! I WIN!', '@shocked ...Wait. You still got past me.', '@angry How did you still get past me?!');
    } else {
      yield say('catty', '@angry ...', '@angry Fine. You can pass.', "@smug But I'm NOT paying you.", '@smirk ...Here. Take this. Don\'t tell anyone I\'m nice.');
      if (S.give('fishbiscuit')) { U.Audio.sfx('item'); yield say('narr', 'You got a {y}Fish Biscuit{w}. It is slightly bitten.'); }
    }
    U.Audio.sfx('swoosh');
    yield W.walk(c, tx(16), ty(15), 2.4);
    W.remove(c);
    W.playMusic();
  }

  // =====================================================================
  //  5. SNOWBELL (town)
  // =====================================================================
  U.defRoom('frost_town', {
    name: 'Snowbell', area: 'frost', tileset: 'frost', snow: 50, music: S => S.genocideTrack() ? 'empty' : 'town', enc: false,
    map: [
      '##############################################',
      '##############################################',
      '#.....T......................T..............T#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#............................................#',
      '#...........................,................#',
      '#............................................#',
      '::::::::::::::::::::::::::::::::::::::::::::::',
      '::::::::::::::::::::::::::::::::::::::::::::::',
      '#............................................#',
      '#............................................#',
      '#..........t............................t....#',
      '#....T...............................T.......#',
      '#............................................#',
      '##############################################',
      '##############################################',
    ],
    exits: [{ x: 0, y: 13, h: 2, to: 'frost_clear', at: [30, 6], dir: 'left' }, { x: 45, y: 13, h: 2, to: 'frost_bridge', at: [1, 5], dir: 'right' }],
    ents() {
      const G = geno();
      const l = [
        { kind: 'prop', prop: 'house_sk', tx: 9, ty: 9 },
        { kind: 'door', tx: 9, ty: 10, ibox: [-12, -16, 24, 20], talk: skHouseDoor },
        { kind: 'prop', prop: 'shop', tx: 22, ty: 8 },
        { kind: 'prop', prop: 'inn', tx: 36, ty: 9 },
        { kind: 'door', tx: 36, ty: 10, ibox: [-12, -16, 24, 20], talk: innDoor },
        { kind: 'prop', prop: 'bigtree', tx: 23, ty: 17 },
        { kind: 'prop', prop: 'mailbox', tx: 4, ty: 11, state: 'red', talk: function* () { yield say('narr', "A red mailbox. It's overflowing with puzzle magazines.", 'One of them is addressed to "SUPERKENDAL, FUTURE ROYAL GUARD (SOON)".'); } },
        { kind: 'prop', prop: 'mailbox', tx: 14, ty: 11, talk: function* () { yield say('narr', 'A blue mailbox. There is a cobweb inside.', 'And one letter, stamped FINAL NOTICE.'); } },
        { kind: 'prop', prop: 'lamp', tx: 18, ty: 12 }, { kind: 'prop', prop: 'lamp', tx: 30, ty: 12 }, { kind: 'prop', prop: 'lamp', tx: 42, ty: 12 }, { kind: 'prop', prop: 'lamp', tx: 6, ty: 16 },
        { kind: 'prop', prop: 'rack', tx: 28, ty: 7 },
        { kind: 'prop', prop: 'bench', tx: 31, ty: 16 },
        { kind: 'sign', prop: 'woodsign', tx: 2, ty: 12, text: () => G ? ['"SNOWBELL"', '"Population: c-"', 'The rest has been scratched out.'] : ['"SNOWBELL"', '"Population: cosy."'] },
        { kind: 'save', tx: 20, ty: 16, label: 'Snowbell', text: () => G ? null : ['(The smell of cocoa and pancakes drifts through town. You feel REAL.)', 'HP fully restored.'] },
        { kind: 'prop', prop: 'snowpile', tx: 40, ty: 6 },
      ];
      if (!G) {
        l.push({ id: 'woolly', kind: 'npc', char: 'woolly', tx: 22, ty: 7, oy: -1, dir: 'down', solid: false, zSort: -20, noShadow: true, ibox: [-34, -6, 68, 46], talk: woollyShop });
        l.push({ id: 'bear', kind: 'npc', char: 'bearwell', tx: 33, ty: 11, dir: 'down', talk: function* () { yield say('bearwell', S.run.kills > 3 ? 'Oh! You startled me, dear.' : 'Welcome to Snowbell, dear!', 'The inn is right behind me. 10G a night, and the beds are warm.'); } });
        l.push({ id: 'pip2', kind: 'npc', char: 'pip', tx: 16, ty: 16, dir: 'down', talk: function* () { yield say('pip', ...(S.run.kills > 3 ? ['Mom told me to go home.', "I'm going. I'm going."] : ['Superkendal made a puzzle out of my snowman once.', 'I still haven\'t solved it.'])); } });
        l.push({ id: 'antler', kind: 'npc', char: 'antler', tx: 28, ty: 16, dir: 'left', talk: function* () { yield say('antler', ...(S.run.kills > 3 ? ['Hmph. The forest is too quiet today.', 'Watch yourself, round one.'] : ['In my day, the Source Wall was only a rumour.', 'Now my grandkids have never seen a real sky.', '...Hmph. Mind the ice, young one.'])); } });
        l.push({ id: 'guard', kind: 'npc', char: 'guard', tx: 42, ty: 15, dir: 'left', talk: function* () { yield say('guard', ...(S.run.kills > 3 ? ['Something is out there.', "Princess Calia's orders: stay alert. Stay inside."] : ['HALT!', '...Oh. You are too small to be a threat. Carry on.', 'The bridge is just ahead. Mind the gap.'])); } });
      } else {
        l.push({ kind: 'prop', prop: 'box', tx: 22, ty: 7, solid: false, visible: false, ibox: [-34, -6, 68, 46], talk: function* () {
          if (flag('tookShopMoney')) { yield say('narr', 'The shop is empty.'); return; }
          flag('tookShopMoney', true); S.run.gold += 40; U.Audio.sfx('cash');
          yield say('narr', 'The shop is empty.', 'There are 40G on the counter, as if someone left in a hurry.', 'You took the 40G.');
        } });
      }
      return l;
    },
    enter: function* () {
      if (flag('caliaScene') || geno()) return;
      flag('caliaScene', true);
      yield* caliaScene();
    },
  });
  function* caliaScene() {
    const p = P();
    yield 20;
    const f = W.npc('fgd2', 'fgd', 2, 14, 'right', { alpha: 0 });
    U.Audio.sfx('teleport');
    for (let i = 0; i <= 8; i++) { f.alpha = i / 8; yield 1; }
    yield say('fgd', '@normal psst.', "@serious see that? that's princess calia. head of the royal guard.", '@normal maybe let her not see you yet. stand still.');
    U.Audio.music('fgd');
    yield W.pan(tx(12), ty(8), .06);
    const c = W.npc('calia', 'calia', 47, 13, 'left');
    yield W.walk(c, tx(9), ty(13), 1.3);
    yield W.walk(c, tx(9), ty(11), 1.3);
    c.dir = 'up';
    yield say('narr', '*knock knock*');
    yield 20;
    const sk = W.npc('skdoor', 'sk', 9, 10, 'down');
    U.Audio.sfx('door');
    yield talk(['sk', '@excited PRINCESS CALIA! You came!'],
      ['calia', "@soft Of course I came. Ready for today's Royal Guard training, Superkendal?"],
      ['sk', '@determined YES! Which advanced combat technique are we learning today?!'],
      ['calia', '@normal ...', '@soft Pancakes.'],
      ['sk', '@shocked THE PANCAKE TECHNIQUE!', '@excited I KNEW IT! KENDAL-TASTIC!']);
    if (S.run.kills > 0) {
      yield talk(['calia', "@normal Superkendal. Stay inside today, okay?"], ['sk', '@worried Why? Is there a COLD going around?'], ['calia', '@sad ...', '@sad Yeah. Something like that.']);
    }
    yield say('sk', '@excited I will get the FLOUR!');
    W.remove(sk); U.Audio.sfx('door');
    yield 40;
    c.dir = 'down';
    yield say('calia', '@sad ...', '@sad He even laughs like you did, Kilo.');
    c.dir = 'up';
    yield 20;
    W.remove(c); U.Audio.sfx('door');
    yield W.unpan();
    f.dir = 'right';
    yield say('fgd', '@normal ...', "@normal she's teaching him to cook. he thinks it's combat training.", "@wink please don't tell him.");
    yield say('fgd', '@serious ...', '@serious she had a little brother, once.', "@normal not my story to tell, though.");
    S.run.rel.calia++;
    U.Audio.sfx('teleport');
    for (let i = 8; i >= 0; i--) { f.alpha = i / 8; yield 1; }
    W.remove(f);
    W.playMusic();
  }
  function* skHouseDoor() {
    if (geno()) { yield say('narr', 'The door is unlocked.', 'Inside, the lights are off. A single plate sits on the table, covered with a napkin.', 'A note on top says "FOR THE VISITOR!!"', 'You leave it alone.'); return; }
    if (flag('caliaScene') && !flag('skFought')) { yield say('narr', 'You hear pans clanging inside.', 'Something smells like burnt batter.', 'Someone is shouting "THE PANCAKE IS RESISTING!"'); return; }
    yield say('narr', 'The door is locked. A sign on it says:', '"GONE PUZZLING! - SK"', 'Below, in much smaller letters:\n"gone napping. - fgd"');
  }
  function* innDoor() {
    if (geno()) { yield say('narr', 'The inn is empty.', 'The fire is still going.'); return; }
    const r = S.run;
    const a = yield D.ask('bearwell', 'Staying the night, dear? It\'s 10G.', ['Stay', 'No thanks']);
    if (a !== 0) return;
    if (r.gold < 10) yield say('bearwell', "Oh, you don't have enough...", 'Just this once, dear. Don\'t tell anyone.');
    else r.gold -= 10;
    yield U.FX.fadeTo(1, 40); U.Audio.stopMusic(1); yield 100; S.fullHeal(); U.Audio.sfx('heal'); yield U.FX.fadeTo(0, 40); W.playMusic();
    yield say('narr', 'You slept like a pancake.\nHP fully restored.');
  }
  function* woollyShop() {
    yield U.Menus.shop({
      greet: 'Baa-lo! Welcome to Woolly\'s! Everything is hand-knitted. Even the snacks.',
      buyMsg: 'Take your time, little one.', sellMsg: "I'll buy anything that isn't damp.", sellNone: "You don't have anything to sell, dear.",
      thanks: 'Thank you kindly!', poor: "You can't afford that.", full: "You can't carry any more.", sold: 'Pleasure doing business!', noBuy: "I... don't want that.",
      items: [{ id: 'snowcone', price: 8 }, { id: 'cocoa', price: 15 }, { id: 'scarf', price: 30 }, { id: 'snowboots', price: 35 }],
      talk: [
        ['About you', "I'm Woolly! I knit, I sell, I shear myself twice a year. It's a living."],
        ['About Snowbell', 'Snowbell is the coziest town under the Wall. Mostly because it has to be.'],
        ['The Princess', 'Princess Calia visits every week to "train" Superkendal. My cocoa sales double.'],
        ['Catty', 'That cat owes me forty coins. He bet me I couldn\'t knit a sweater in a day. I did. He never paid.'],
      ],
      drawBg(ctx) {
        ctx.fillStyle = '#2a3a5a'; ctx.fillRect(0, 0, 320, 136);
        const shop = U.Props.sprite('shop'); ctx.drawImage(shop, 160 - shop.width, 6, shop.width * 2, shop.height * 2);
        const w = U.Chars.ow('woolly', 'down', 0); ctx.drawImage(w, 160 - w.width * 1.5, 24 + Math.sin(U.frame * .05) * 2, w.width * 3, w.height * 3);
        ctx.fillStyle = '#8a5a36'; ctx.fillRect(98, 66, 124, 40);
      },
    });
  }

  // =====================================================================
  //  6. THE BRIDGE — Superkendal's final test
  // =====================================================================
  U.defRoom('frost_bridge', {
    name: 'Frostwood - The Bridge', area: 'frost', tileset: 'frost', snow: true, music: S => S.flag('skFought') ? 'frost' : null, enc: false,
    map: [
      '######################################',
      '######################################',
      '#..T....xxxxxxxxxxxxxxxxxxxxx....T....',
      '#.......xxxxxxxxxxxxxxxxxxxxx.........',
      '#.......xxxxxxxxxxxxxxxxxxxxx.........',
      '........bbbbbbbbbbbbbbbbbbbbb.........',
      '........bbbbbbbbbbbbbbbbbbbbb.........',
      '#.......xxxxxxxxxxxxxxxxxxxxx.........',
      '#..t....xxxxxxxxxxxxxxxxxxxxx....T....',
      '#.......xxxxxxxxxxxxxxxxxxxxx.........',
      '######################################',
      '######################################',
    ],
    exits: [{ x: 0, y: 5, h: 2, to: 'frost_town', at: [44, 13], dir: 'left' }, { x: 37, y: 2, h: 8, run: endChapter }],
    ents() {
      const l = [{ kind: 'prop', prop: 'lamp', tx: 6, ty: 4 }, { kind: 'sign', prop: 'woodsign', tx: 33, ty: 4, text: ['"THE ROAD AHEAD IS STILL BEING BUILT."', '"Please come back later."', '(Chapter 2 is under construction.)'] }];
      if (!flag('skFought')) l.push({ kind: 'trigger', tx: 10, ty: 4, th: 4, once: 'skBridge', run: skBridge });
      return l;
    },
  });
  function* skBridge() {
    const p = P();
    p.dir = 'right';
    const G = geno();
    const sk = W.npc('sk', 'sk', 40, 5, 'left');
    U.Audio.music(G ? 'empty' : 'sk', G ? { rate: .7 } : null);
    yield W.walk(sk, tx(22), ty(5) + 8, 2.4);
    if (G) yield say('sk', '@worried ...Hi.', "@worried My brother didn't come home today.", '@sad He said he had to go somewhere. He said not to wait up.', '@worried ...You look really sad, you know.', "@determined But that's okay! I still think you can be good!", "@excited I'll prove it! I, Superkendal, will be your FRIEND!");
    else yield say('sk', '@determined HALT, VISITOR!', '@proud You have passed all of my puzzles! ...Mostly. Kind of.', "@excited So now it's time for the FINAL TEST!", '@determined If I capture you, Princess Calia will HAVE to let me join the Royal Guard!', '@proud Prepare yourself! KENDAL-TASTIC!');
    const r = yield U.Battle.start({ enemies: ['sk'], area: 'frost', noFear: true });
    flag('skFought', true);
    const out = S.run.bosses.sk;
    if (out === 'spared') {
      U.Audio.music('sk');
      sk.dir = 'left';
      yield say('sk', "@excited FRIENDS! We're FRIENDS now!", '@happy I have to go tell my brother!', '@thinking And Princess Calia! She will be SO-', '@worried ...Hm. Maybe not Princess Calia. Not yet.', '@happy Come visit my house sometime! I will cook you something!', '@proud Probably pancakes!');
      yield W.walk(sk, tx(-2), ty(5) + 8, 2.6);
      W.remove(sk);
      U.Audio.music('fgd');
      const f = W.npc('fgd', 'fgd', 30, 6, 'left', { alpha: 0 });
      U.Audio.sfx('teleport'); for (let i = 0; i <= 8; i++) { f.alpha = i / 8; yield 1; }
      yield say('fgd', '@normal hey.', "@grin thanks for being nice to my brother. he's gonna talk about this for weeks.");
      if (S.run.bosses.exqueen === 'killed') yield say('fgd', '@serious ...', '@serious the hallways went awful quiet earlier, though.', '@normal ...anyway.');
      if (reset()) yield say('fgd', "@serious funny. i feel like i've thanked you before.", '@normal ...must be the cold.');
      yield say('fgd', "@normal word of advice: the princess is real nice once you get past the sword.", '@shut the sword is most of her, though.', "@normal see you around. or, y'know.", "@wink i'll see you.");
      U.Audio.sfx('teleport'); for (let i = 8; i >= 0; i--) { f.alpha = i / 8; yield 1; }
      W.remove(f);
    } else {
      // Superkendal is gone
      W.remove(sk);
      U.Audio.stopMusic(1);
      yield 90;
      if (G) {
        const f = W.npc('fgd', 'fgd', 30, 6, 'left', { alpha: 0 });
        U.Audio.sfx('teleport'); for (let i = 0; i <= 8; i++) { f.alpha = i / 8; yield 1; }
        yield say('fgd', "@dark so you're doing it. all of it.", "@dark you know what's funny? i remember you.", "@dark not this you. a different one. one who smiled at my brother's puzzles.", "@dark guess that one's not coming back.", "@serious i'll be waiting further in. near the palace.", "@dark don't keep me waiting.", '@sad ...actually. take your time.', '@sad please.');
        U.Audio.sfx('teleport'); for (let i = 8; i >= 0; i--) { f.alpha = i / 8; yield 1; }
        W.remove(f);
      } else {
        const f = W.npc('fgd', 'fgd', 2, 6, 'right', { alpha: 0 });
        for (let i = 0; i <= 20; i++) { f.alpha = i / 20; yield 1; }
        yield W.walk(f, tx(8), ty(6), .6);
        p.dir = 'left';
        yield say('fgd', '@serious ...', '@serious hey.', '@dark ...you seen my brother anywhere?');
        yield 60;
        yield say('fgd', '@dark ...', "@dark yeah. that's what i thought.");
        f.dir = 'left';
        yield W.walk(f, tx(-2), ty(6), .5);
        W.remove(f);
      }
    }
    W.playMusic();
  }
  function* endChapter() {
    const p = P();
    p.x -= 6;
    if (!flag('skFought')) { yield say('narr', 'The path is blocked by a VERY determined snowdrift.'); return; }
    yield say('narr', 'The road ahead disappears into the snow.', 'Somewhere past it: Crystal Caverns. The Royal Capital. The palace.', 'The Source Wall.');
    const a = yield D.ask('narr', 'End Chapter 1 here?', ['Yes', 'Not yet']);
    if (a !== 0) return;
    U.Audio.stopMusic(1.5);
    yield U.FX.fadeTo(1, 60);
    U.ChapterEnd.start();
  }
})();
