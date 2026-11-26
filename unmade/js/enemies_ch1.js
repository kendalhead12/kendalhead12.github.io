'use strict';
// ============================================================
//  Chapter 1 regular enemies
//  Each enemy: stats, ACTs, spare conditions, dialogue, attacks,
//  and "fear" variants for the second-Genocide mechanic.
// ============================================================
(function () {
  const BA = U.BulletArt;
  const pat = o => Object.assign({ box: { w: 96, h: 76 }, dur: 220 }, o);
  const every = (t, n, off) => (t + (off || 0)) % n === 0;
  const rx = (B, m) => U.rand(B.box.x + (m || 8), B.box.x + B.box.w - (m || 8));
  const ry = (B, m) => U.rand(B.box.y + (m || 8), B.box.y + B.box.h - (m || 8));
  U.Pat = { pat, every, rx, ry };

  // =================================================================
  //  WICKLING — a shy little candle
  // =================================================================
  U.Enemy('wickling', {
    name: 'Wickling', hp: 16, atk: 3, df: 0, exp: 3, gold: 3, art: 'wickling', voice: 'monster',
    intro: 'Wickling flickers nervously into view.',
    check: 'A shy little candle. Terrified of drafts.',
    acts: ['Check', 'Shield', 'Blow'],
    act(B, e, a) {
      if (a === 'Shield') { e.st.shield = (e.st.shield || 0) + 1; e.mood = 'happy'; return ['You stand between Wickling and the draft.\nIts flame stops trembling.']; }
      if (a === 'Blow') {
        e.st.blown = (e.st.blown || 0) + 1; e.mood = 'scared'; e.atk = Math.max(1, e.atk - 1);
        if (e.st.blown >= 2) { e.gone = true; U.Audio.sfx('swoosh'); return ['You blow on Wickling again.', "Wickling's flame went out! It scurried away to relight itself."]; }
        return ['You blow on Wickling.\nIts flame shrinks in terror!', "Wickling's ATTACK dropped."];
      }
    },
    spareable: (B, e) => (e.st.shield || 0) >= 1,
    talk(B, e) {
      if (e.st.shield) return [U.choose(['Th-thank you...', 'Warm...', "It's not drafty here."])];
      if (e.st.blown) return [U.choose(['N-no more blowing!', "I'm g-going out!"])];
      return [U.choose(['...', "P-please don't blow.", '*flicker*', "It's d-drafty..."])];
    },
    flavor: ['Wickling flickers nervously.', 'Wickling drips a little.', 'Smells like vanilla.', 'Wickling is hiding behind its own smoke.'],
    spareFlavor: 'Wickling is glowing contentedly.',
    lowFlavor: 'Wickling is burning low.',
    attack(B, e) {
      if (U.choose([0, 1]) === 0) return pat({
        dur: 210, update(B, p, t) {
          const rate = B.fear ? 16 : 11;
          if (every(t, rate)) {
            const x = rx(B, 10);
            B.bullets.add({ x, y: B.box.y - 4, vy: B.fear ? .9 : 1.3, ay: .03, r: 2.5, spr: BA.drop(), dmg: e.atk,
              update(b, B) { if (b.y > B.box.y + B.box.h - 8 && !b.split) { b.split = true; b.dead = true; for (const s of [-1, 0, 1]) B.bullets.add({ x: b.x, y: b.y, vx: s * 1.1, vy: -1.4 - Math.abs(s) * .2, ay: .08, r: 1.5, dmg: e.atk, life: 50 }); } } });
          }
        },
      });
      return pat({
        dur: 200, update(B, p, t) {
          if (every(t, B.fear ? 9 : 6)) {
            const a = t * .19, cx = B.box.x + B.box.w / 2, cy = B.box.y + 6;
            B.bullets.add({ x: cx, y: cy, vx: Math.cos(a) * 1.2, vy: Math.abs(Math.sin(a)) * 1.1 + .5, r: 2, col: '#fff', dmg: e.atk, draw(ctx, b) { ctx.fillStyle = (b.t >> 2) % 2 ? '#fff' : '#bbb'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3); } });
          }
        },
      });
    },
    fear: {
      intro: 'Wickling is already flickering out.',
      talk: ['P-please...', "I-I'll go out on my own...", "...don't.", 'Not the hands. Not the hands.'],
      flavor: ["Wickling's flame has gone very small.", 'Wickling is trying not to look at you.', 'The air is very still.'],
      check: "It's shaking. Its flame is barely there.",
    },
  });

  // =================================================================
  //  MOTHMOTE — drawn to your light
  // =================================================================
  U.Enemy('mothmote', {
    name: 'Mothmote', hp: 20, atk: 4, df: 0, exp: 4, gold: 3, art: 'mothmote', frames: 2, frameRate: 6, voice: 'monster',
    intro: 'Mothmote flutters straight at you!',
    check: 'Drawn to light. Has never found one bright enough.',
    acts: ['Check', 'Stay Still', 'Flap'],
    act(B, e, a) {
      if (a === 'Stay Still') { e.st.still = true; e.mood = 'happy'; return ['You stand perfectly still.', 'Mothmote lands gently on your head.\nIt seems very content.']; }
      if (a === 'Flap') { e.st.flap = (e.st.flap || 0) + 1; return ['You flap your little legs at Mothmote.', 'Mothmote is deeply confused.\nIs this a new kind of lamp?']; }
    },
    spareable: (B, e) => !!e.st.still,
    talk(B, e) {
      if (e.st.still) return ['Cozy.'];
      if (e.st.flap) return [U.choose(['Flappy lamp...?', 'What ARE you?'])];
      return [U.choose(['Bright...', 'So... bright...', '*flutter*', 'Is that... a lamp?'])];
    },
    flavor: ['Mothmote circles your head.', 'Mothmote is leaving dust everywhere.', "Mothmote thinks you're a lightbulb."],
    spareFlavor: 'Mothmote is perfectly content to sit on you.',
    attack(B, e) {
      if (Math.random() < .5) return pat({
        dur: 220, update(B, p, t) {
          if (every(t, B.fear ? 26 : 16)) {
            const side = Math.random() < .5 ? -1 : 1, y0 = ry(B, 12);
            const x0 = side < 0 ? B.box.x - 6 : B.box.x + B.box.w + 6;
            B.bullets.add({ x: x0, y: y0, vx: -side * (B.fear ? .9 : 1.4), r: 3, dmg: e.atk, ph: Math.random() * 6, manual: false,
              update(b) { b.vy = Math.cos(b.t * .12 + b.ph) * 1.2; }, draw(ctx, b) { const s = BA.moth((b.t >> 3) % 2); ctx.drawImage(s, Math.round(b.x - 4), Math.round(b.y - 3)); } });
          }
        },
      });
      return pat({
        dur: 220, box: { w: 90, h: 76 }, update(B, p, t) {
          if (every(t, B.fear ? 12 : 7)) {
            const x = rx(B, 6);
            B.bullets.add({ x, y: B.box.y - 2, vy: .9, r: 1.5, dmg: e.atk, ph: Math.random() * 6, update(b) { b.vx = Math.sin(b.t * .1 + b.ph) * 1.1; }, draw(ctx, b) { ctx.fillStyle = '#d8d8d8'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); } });
          }
        },
      });
    },
    fear: {
      talk: ['Too bright... too bright...', 'Not you. Not you.', '...', "You're not a light."],
      flavor: ['Mothmote is flying away from you, not towards you.', 'Mothmote has never wanted the dark so badly.'],
      check: 'Drawn to light. Repelled by whatever you are.',
    },
  });

  // =================================================================
  //  DRIZZLE — a gloomy little raincloud
  // =================================================================
  U.Enemy('drizzle', {
    name: 'Drizzle', hp: 24, atk: 4, df: 1, exp: 5, gold: 4, art: 'drizzle', frameRate: 6, voice: 'monster',
    intro: 'Drizzle rolls in. It looks like rain.',
    check: 'A small raincloud having a bad century.',
    acts: ['Check', 'Cheer', 'Hug'],
    act(B, e, a) {
      if (a === 'Cheer') { e.st.cheer = (e.st.cheer || 0) + 1; if (e.st.cheer >= 2 || e.st.hug) e.mood = 'happy'; return ["You do a little hop-dance.\nDrizzle's rain lightens."]; }
      if (a === 'Hug') { e.st.hug = true; if (e.st.cheer) e.mood = 'happy'; return ['You try to hug Drizzle. You have no arms.', 'You lean against it awkwardly. It is damp.\n...It appreciates the effort.']; }
    },
    spareable: (B, e) => (e.st.cheer || 0) >= 2 || ((e.st.cheer || 0) >= 1 && e.st.hug),
    talk(B, e) {
      if (e.mood === 'happy') return [U.choose(['Oh!', 'A sunbreak!', 'Is this... a nice day?'])];
      if (e.st.hug) return ['...you leaned on me.'];
      return [U.choose(['...', 'Nobody likes rain.', 'Sorry. Sorry.', '*drip*'])];
    },
    flavor: ['Drizzle drizzles.', 'Drizzle is raining on its own parade.', 'Smells like petrichor.'],
    spareFlavor: 'Drizzle has a tiny rainbow now.',
    attack(B, e) {
      if (Math.random() < .55) return pat({
        dur: 220, update(B, p, t) {
          if (every(t, B.fear ? 6 : 4)) B.bullets.add({ x: rx(B, -10), y: B.box.y - 4, vx: -.45, vy: 2.1, r: 1.5, dmg: e.atk, shape: 'rect', w: 1, h: 4, rot: .2, draw(ctx, b) { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x), Math.round(b.y) - 2, 1, 4); } });
        },
      });
      return pat({
        dur: 230, box: { w: 110, h: 76 }, update(B, p, t) {
          if (t % 55 === 10) {
            const n = B.fear ? 1 : 2;
            for (let k = 0; k < n; k++) {
              const x = rx(B, 10);
              B.bullets.add({ x, y: B.box.y + B.box.h / 2, shape: 'rect', w: 8, h: B.box.h, warn: 34, dmg: e.atk + 1, life: 52, col: '#fff',
                warnDraw(ctx, b) { ctx.strokeStyle = '#fff'; ctx.strokeRect(Math.round(b.x - 4), B.box.y, 8, B.box.h); },
                draw(ctx, b) { if (b.t === b.warn) U.Audio.sfx('crack'); ctx.fillStyle = (b.t >> 1) % 2 ? '#fff' : '#ddd'; ctx.fillRect(Math.round(b.x - 4), B.box.y, 8, B.box.h); } });
            }
          }
        },
      });
    },
    fear: { talk: ["It's going to rain forever.", 'Please. Please.', '...'], flavor: ['Drizzle is pouring.', 'Drizzle has never been this grey.'], check: 'A small raincloud. It wants to be anywhere else.' },
  });

  // =================================================================
  //  CATTY — arrogant, competitive, bets on everything
  // =================================================================
  const CATTY_HIT = ['Seriously? You got hit by THAT?', 'Ha! Pay up, pancake.', "You're pretty confident for someone shaped like a pancake.", 'Wow. Wow. Embarrassing.'];
  const CATTY_DODGE = ["STOP DODGING! I'M TRYING TO WIN AN ARGUMENT!", "Okay, that one didn't count.", 'Lucky. Pure luck.', 'Best two out of three.'];
  U.Enemy('catty', {
    name: 'Catty', hp: 40, atk: 3, df: 1, exp: 10, gold: 8, char: 'catty', voice: 'catty', music: 'catty', bubbleChars: 18,
    sprite(B, e) {
      let ex = e.expr || 'smug';
      if (B.fear) ex = 'scared';
      if (e.shake > 2) ex = 'hurt';
      return U.Chars.bigBW('catty', ex);
    },
    init(B, e) { e.st.first = !U.State.flag('cattyFought'); U.State.flag('cattyFought', true); },
    intro(B, e) { return e.st.first ? 'Catty blocks the path with his paws on his hips.' : U.choose(['Catty is back. He wants a rematch.', 'Catty: "Double or nothing!"']); },
    check: 'Bets on everything. Has never once paid up.',
    acts: ['Check', 'Compliment', 'Challenge', 'Insult'],
    act(B, e, a) {
      const s = e.st;
      if (a === 'Compliment') {
        s.comp = (s.comp || 0) + 1; e.expr = 'laugh';
        if (s.comp >= 2) { s.flattered = true; return ["You compliment Catty's whiskers.", 'He pretends not to care.\nHe cares a lot.']; }
        return ['You hop excitedly at Catty\'s snowbombs.\nHe puffs up like a muffin.'];
      }
      if (a === 'Challenge') { s.bet = true; e.expr = 'smug'; return ['You challenge Catty to a dodge-off.', 'If you take no hits next turn, you win the bet.']; }
      if (a === 'Insult') { s.insult = (s.insult || 0) + 1; s.comp = 0; s.flattered = false; e.expr = 'angry'; e.atk += 1; return ["You can't talk, but you make a very rude face.", 'Catty is OUTRAGED.\nCatty\'s ATTACK went up.']; }
    },
    spareable: (B, e) => !!(e.st.won || e.st.flattered),
    talk(B, e) {
      const s = e.st;
      if (s.won && !s.wonSaid) { s.wonSaid = true; e.expr = 'shocked'; return ['...', '@angry Fine. FINE. You win the bet.', "@smug I'm not paying, though."]; }
      if (s.won || s.flattered) return [U.choose(["...You're okay, I guess.", "Don't tell anyone I said that.", 'Hmph.'])];
      if (s.insult && !s.insultSaid) { s.insultSaid = true; return ['@angry Oh, NOW it\'s personal.']; }
      if (s.bet) return [B.turn === 0 ? '@smug Ten coins says you can\'t dodge this.' : '@smug Double or nothing. Ready?'];
      if (B.turn === 0) return ["@smug Ten coins says you can't dodge this."];
      if (s.lastHits === 0) { e.expr = 'angry'; return [U.choose(CATTY_DODGE)]; }
      e.expr = 'laugh'; return [U.choose(CATTY_HIT)];
    },
    flavor: ['Catty is counting imaginary coins.', 'Catty smirks.', 'Catty flicks his tail.', 'Smells like fish and confidence.'],
    spareFlavor: "Catty looks like he'd rather not admit he lost.",
    lowFlavor: 'Catty is trying very hard to look fine.',
    attack(B, e) {
      const s = e.st;
      const hard = (s.bet ? 1 : 0) + (s.insult ? 1 : 0);
      return pat({
        dur: 240, box: { w: 120, h: 80 },
        update(B, p, t) {
          const rate = B.fear ? 50 : (38 - hard * 6);
          if (every(t, rate, -6) && t < 205) {
            const tx = rx(B, 14), ty = U.rand(B.box.y + 20, B.box.y + B.box.h - 14);
            const fizzle = B.fear && Math.random() < .4;
            const n = 6 + hard;
            B.bullets.add({ x: tx, y: B.box.y - 8, ty, vy: B.fear ? 1.4 : 2.2, r: 4, spr: BA.bomb(), dmg: e.atk, clip: false, rot: 0, vr: .1,
              warnDraw: null,
              update(b, B) {
                if (b.y >= b.ty) {
                  b.dead = true;
                  if (fizzle) { B.parts.burst(b.x, b.y, 4, { col: '#888', smin: .3, smax: .8, lmin: 10, lmax: 18 }); return; }
                  U.Audio.sfx('bomb');
                  B.bullets.ring(b.x, b.y, n, 1.05 + hard * .15, { r: 2.5, spr: BA.snowflake('#fff'), dmg: e.atk, vr: .1 }, Math.random());
                }
              },
              after: null,
            });
            // landing marker
            B.bullets.add({ x: tx, y: ty, hit: false, life: Math.ceil((ty - B.box.y + 8) / (B.fear ? 1.4 : 2.2)), draw(ctx, b) { if ((b.t >> 2) % 2) { ctx.fillStyle = '#777'; ctx.fillRect(Math.round(b.x) - 2, Math.round(b.y), 5, 1); ctx.fillRect(Math.round(b.x), Math.round(b.y) - 2, 1, 5); } } });
          }
        },
        finish(B, p) {
          s.lastHits = B.hitsThisTurn;
          if (s.bet) { if (B.hitsThisTurn === 0) s.won = true; else { s.bet = false; } }
        },
      });
    },
    deathLines: ["@hurt Heh... that one... didn't...", '@hurt ...count...'],
    onKilled() { U.State.flag('cattyDead', true); },
    onSpared() { U.State.run.rel.catty++; },
    fear: {
      intro: 'Catty is already shaking.',
      talk: ['T-ten coins says you... you...', "I-I'm not scared! YOU'RE scared!", 'Can we... call off the bet?', "Th-this one doesn't count... right?"],
      flavor: ['Catty keeps glancing at the exit.', "Catty's tail is tucked between his legs.", 'Catty is too nervous to make a bet.'],
      check: "Bets on everything. Right now he wouldn't bet on himself.",
    },
  });

  // =================================================================
  //  SHIVERBIT — an ice cube in a scarf
  // =================================================================
  U.Enemy('shiverbit', {
    name: 'Shiverbit', hp: 28, atk: 5, df: 1, exp: 6, gold: 5, art: 'shiverbit', voice: 'monster',
    intro: 'Shiverbit shivers into your path.',
    check: "Always cold. Its {b}blue frost{w} only hurts if you're moving.",
    acts: ['Check', 'Warm Up', 'Huddle'],
    act(B, e, a) {
      if (a === 'Warm Up') { e.st.warm = (e.st.warm || 0) + 1; if (e.st.warm >= 2) e.mood = 'happy'; return ['You hop in place really fast, generating heat.', 'Shiverbit scoots a little closer.']; }
      if (a === 'Huddle') { if (e.st.warm) { e.st.warm = 2; e.mood = 'happy'; return ['You huddle next to Shiverbit.', "You aren't very warm. It's the thought that counts."]; } return ['You try to huddle, but Shiverbit is too cold to notice.']; }
    },
    spareable: (B, e) => (e.st.warm || 0) >= 2,
    talk(B, e) { if (e.mood === 'happy') return [U.choose(['N-nice...', "Th-that's the s-stuff."])]; return [U.choose(['C-c-cold...', 'Br-br-br...', 'Is it s-summer yet?', 'S-scarf isn\'t h-helping.'])]; },
    flavor: ['Shiverbit chatters its teeth.', 'Shiverbit is cold. Shiverbit is always cold.', 'You can see your breath. You do not breathe.'],
    spareFlavor: 'Shiverbit has stopped shivering. Mostly.',
    idle(B, e) { return { x: (B.t >> 1) % 2 ? 1 : 0, y: 0 }; },
    attack(B, e) {
      if (Math.random() < .5) return pat({
        dur: 210, update(B, p, t) {
          if (every(t, B.fear ? 14 : 9)) B.bullets.add({ x: rx(B, 6), y: B.box.y - 6, vy: 2.4, r: 2.5, spr: BA.shard(), dmg: e.atk });
        },
      });
      return pat({
        dur: 260, box: { w: 120, h: 70 }, update(B, p, t) {
          if (t === 20 || t === 110 || (t === 190 && !B.fear)) {
            const side = (t / 90 | 0) % 2 ? 1 : -1;
            const x = side < 0 ? B.box.x - 4 : B.box.x + B.box.w + 4;
            B.bullets.add({ x, y: B.box.y + B.box.h / 2, vx: -side * 1.3, shape: 'rect', w: 6, h: B.box.h, type: 'still', dmg: e.atk + 1, draw(ctx, b) { ctx.fillStyle = '#4fd8ff'; ctx.fillRect(Math.round(b.x - 3), B.box.y, 6, B.box.h); ctx.fillStyle = '#c8f4ff'; for (let y = B.box.y + 2; y < B.box.y + B.box.h; y += 6) ctx.fillRect(Math.round(b.x - 1), y, 2, 2); } });
          }
          if (every(t, 24, 8)) B.bullets.add({ x: rx(B, 6), y: B.box.y - 4, vy: 1.2, r: 2, spr: BA.snowflake('#fff'), vr: .1, dmg: e.atk });
        },
      });
    },
    fear: { talk: ["I-I'm not sh-shivering because of the c-cold anymore.", 'P-please...', "D-don't c-come closer."], flavor: ['Shiverbit is melting from nervous sweat.', 'Shiverbit is perfectly, terribly still.'], check: 'Always cold. Right now it would rather be anything but here.' },
  });

  // =================================================================
  //  PINEBARK — a Royal Guard reservist
  // =================================================================
  U.Enemy('pinebark', {
    name: 'Pinebark', hp: 34, atk: 5, df: 2, exp: 7, gold: 6, art: 'pinebark', frames: 2, frameRate: 14, voice: 'monster',
    intro: 'Pinebark plants itself in your way!',
    check: 'A Royal Guard reservist. Takes it VERY seriously.',
    acts: ['Check', 'Salute', 'Decorate', 'Stand Tall'],
    act(B, e, a) {
      if (a === 'Salute') { e.st.salute = true; e.mood = 'happy'; return ['You salute. (You raise one leg. It counts.)', 'Pinebark salutes back, very seriously.\nIt recognises a fellow soldier.']; }
      if (a === 'Decorate') { e.st.dec = (e.st.dec || 0) + 1; return ['You hang a snowflake on Pinebark.', 'It looks very festive. It is trying not to smile.']; }
      if (a === 'Stand Tall') return ['You stand very tall.', 'You are still very short.\nPinebark respects the effort.'];
    },
    spareable: (B, e) => !!e.st.salute || (e.st.dec || 0) >= 2,
    talk(B, e) {
      if (e.st.salute) return [U.choose(['At ease, soldier!', 'For the Princess!'])];
      if ((e.st.dec || 0) >= 1) return ['...I look NICE.'];
      return [U.choose(['HALT!', 'State your business!', 'For the Princess!', 'At ease! ...No wait. NOT at ease!'])];
    },
    flavor: ['Pinebark stands at attention.', 'Pinebark is guarding a very important patch of snow.', 'Smells like pine needles.'],
    spareFlavor: 'Pinebark is standing at ease.',
    attack(B, e) {
      if (Math.random() < .5) return pat({
        dur: 230, box: { w: 110, h: 76 }, update(B, p, t) {
          if (every(t, B.fear ? 40 : 26)) {
            const side = Math.random() < .5 ? -1 : 1;
            B.bullets.add({ x: side < 0 ? B.box.x + 6 : B.box.x + B.box.w - 6, y: B.box.y + 10, vx: -side * U.rand(.9, 1.5), vy: -1, ay: .09, r: 3, spr: BA.cone(), dmg: e.atk, bounces: 0,
              update(b, B) { const fl = B.box.y + B.box.h - 7; if (b.y > fl && b.vy > 0) { b.y = fl; b.vy *= -.82; b.bounces++; U.Audio.sfx('bounce'); if (b.bounces > 3) b.dead = true; } } });
          }
        },
      });
      return pat({
        dur: 220, box: { w: 100, h: 76 }, update(B, p, t) {
          if (every(t, B.fear ? 50 : 34, -4)) {
            const side = Math.random() < .5 ? -1 : 1;
            const gap = U.randi(0, 3);
            for (let k = 0; k < 5; k++) {
              if (k === gap || k === gap + 1) continue;
              const y = B.box.y + 10 + k * 14;
              B.bullets.add({ x: side < 0 ? B.box.x - 8 : B.box.x + B.box.w + 8, y, vx: -side * 2.2, shape: 'rect', w: 10, h: 3, dmg: e.atk, warn: 10, spr: BA.needle(), rot: side < 0 ? 0 : Math.PI });
            }
          }
        },
      });
    },
    fear: { talk: ['F-for the Princess...?', 'I... I need backup...', "I'm just a reservist..."], flavor: ['Pinebark is shedding needles.', 'Pinebark has forgotten every drill it ever learned.'], check: 'A Royal Guard reservist. It never trained for this.' },
  });

  // ---------------- encounter tables ----------------
  U.Areas.hall.table = [
    { g: ['wickling'] }, { g: ['mothmote'] }, { g: ['drizzle'] },
    { g: ['wickling', 'mothmote'], w: .6 }, { g: ['drizzle', 'wickling'], w: .5 },
  ];
  U.Areas.frost.table = [
    { g: ['catty'], w: .8, when: S => S.flag('cattyFought') && !S.flag('cattyDead') },
    { g: ['shiverbit'] }, { g: ['pinebark'] },
    { g: ['shiverbit', 'shiverbit'], w: .5 }, { g: ['pinebark', 'shiverbit'], w: .5 },
  ];
})();
