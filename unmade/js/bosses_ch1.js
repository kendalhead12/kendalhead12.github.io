'use strict';
// ============================================================
//  Chapter 1 bosses & scripted battles:
//  Sun's "tutorial", the Ex-Queen, Superkendal
// ============================================================
(function () {
  const BA = U.BulletArt, P = U.Pat;
  const St = () => U.State, R = () => U.State.run;

  // =================================================================
  //  SUN — the friendly guide (who is not friendly)
  // =================================================================
  U.Enemy('sun_tut', {
    name: 'Sun', hp: 999, atk: 19, df: 99, boss: true, voice: 'sun', music: 'sun', expr: 'happy', bubbleChars: 19,
    voiceFor: e => (e === 'evil' || e === 'grin' || e === 'sly') ? 'sunevil' : 'sun',
    baseY: 108,
    sprite(B, e) { return U.Chars.sunBW(e.expr || 'happy', Math.floor(B.t / (e.st.fly ? 2 : 8)) % 6); },
    idle(B, e) { return { x: 0, y: Math.round(Math.sin(B.t * .06) * 3) }; },
    update(B, e) { if (e.st.fly) { e.ox += 7; e.oy -= 3.2; if (e.ox > 260) e.gone = true; } },
    flow: sunFlow,
  });
  U.Enemy('exqueen_cameo', {
    name: 'Ex-Queen', hp: 999, boss: true, voice: 'exqueen', expr: 'stern', bubbleChars: 19,
    sprite(B, e) { return U.Chars.bigBW('exqueen', e.expr || 'kind'); },
    update(B, e) { if (e.st.slide != null) { e.ox = U.approach(e.ox, 0, 6); } },
  });

  function pebbles(n) {
    return P.pat({ box: { w: 96, h: 76 }, dur: 70 + n * 34, update(B, p, t) {
      if (t % 34 === 20) { const x = U.rand(B.box.x + 10, B.box.x + B.box.w - 10); B.bullets.aimAt(x, B.box.y - 10, 1.25, B.soul.x, B.soul.y, { r: 2.2, spr: BA.pebble(), dmg: 1, clip: false }); }
    } });
  }
  function beams(wave) {
    const n = [6, 8, 12][wave], spd = [.7, 1.05, 1.5][wave];
    return P.pat({ box: { w: 120, h: 84 }, dur: 260, update(B, p, t) {
      if (t === 10) {
        for (let i = 0; i < n; i++) {
          const a = Math.PI * (.12 + .76 * i / (n - 1));
          const cx = B.box.x + B.box.w / 2, cy = B.box.y - 10;
          B.bullets.add({ x: cx - Math.cos(a) * 60, y: cy + Math.sin(a) * 16 - 4, r: 3, spr: BA.beam(), type: 'fake', clip: false, hit: true, ignoreInv: true, manual: true, home: false, i,
            update(b, B) {
              if (b.t < 40) { b.y += Math.sin(b.t * .2 + b.i) * .3; return; }
              if (!b.home) { b.home = true; const a = Math.atan2(B.soul.y - b.y, B.soul.x - b.x); b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd; U.Audio.sfx('beam'); }
              const a = Math.atan2(B.soul.y - b.y, B.soul.x - b.x); b.vx += Math.cos(a) * .012 * (wave + 1); b.vy += Math.sin(a) * .012 * (wave + 1);
              b.x += b.vx; b.y += b.vy;
            },
            custom(b, B) {
              if (B.flags.beamHit) return;
              B.flags.beamHit = true;
              B.bullets.list.forEach(x => { x.dead = true; });
              R().hp = 1; U.Audio.sfx('hurt'); U.Audio.sfx('fire'); U.FX.shake(4, 16); U.FX.flashScreen('#ff2020', 10);
              B.soul.inv = 40; p.done = true;
            } });
        }
      }
    } });
  }
  function fireRing() {
    return P.pat({ box: { w: 120, h: 90 }, dur: 999, init(B, p) {
      p.cx = B.soul.x; p.cy = B.soul.y; p.rad = 78;
      p.list = [];
      for (let i = 0; i < 26; i++) p.list.push(B.bullets.add({ x: 0, y: 0, r: 3, spr: BA.flame('#ffffff'), dmg: 19, clip: false, manual: true, i, keep: true, margin: 300 }));
      U.Audio.sfx('fire');
    }, update(B, p, t) {
      p.rad = Math.max(13, p.rad - (t < 40 ? .2 : .5));
      p.list.forEach(b => { const a = b.i / 26 * Math.PI * 2 + t * .015; b.x = p.cx + Math.cos(a) * p.rad + U.rand(-.4, .4); b.y = p.cy + Math.sin(a) * p.rad * .9; b.spr = BA.flame((t >> 2) % 2 ? '#ffffff' : '#ffd0a0'); });
      if (t === 60 || t === 100) U.Audio.sfx('laugh');
      if (p.rad <= 16 && !p.rescue) { p.rescue = t; }
      if (p.rescue && t - p.rescue > 10) p.done = true;
    } });
  }
  function* sunFlow(B) {
    const sun = B.enemies[0];
    const meta = St().meta;
    const again = meta.resets > 0 && meta.seen.sunIntro;
    const lastGeno = meta.lastRoute === 'genocide';
    meta.seen.sunIntro = true; St().saveMeta();
    B.canFlee = false; B.noDeath = true; B.flavor = '';
    yield 12;
    const reveal = ["@grin Here's a free lesson, newbie.", "Down here, it's not about friends.", "It's not about being nice.", "Everybody's just trying to survive.", 'And the ones who survive...', '@evil ...are the ones who burn everybody else FIRST.', "@evil So why would I EVER let something like you walk away?"];
    if (!again) {
      yield B.bubble(sun, '@happy This is a BATTLE!', "Everybody down here has 'em. Totally normal!", 'See that little red circle?', "That's your SOUL. It's everything you are, in one teeny dot.", '@wink Pretty small, huh? Ha ha!', "@happy Let's practice! Dodge these pebbles!");
      yield B.dodgeCmd([pebbles(3)]);
      yield B.bubble(sun, B.hitsThisTurn ? "@happy Ouch! Don't worry, you'll get it." : '@wink Wow! A natural!', 'Those buttons down there? FIGHT, ACT, ITEM, MERCY.', "You'll figure 'em out. Not important right now!", '@annoyed Now... you look a little weak. LV 1? Yikes.', "@happy Lucky for you, I'm here to help!", 'These are {y}HEALTH BEAMS{w}!', 'Catch them and your HP goes WAY up!', 'Go on! Grab as many as you can!');
      let caught = false;
      for (let w = 0; w < 3; w++) {
        B.flags.beamHit = false;
        yield B.dodgeCmd([beams(w)]);
        if (B.flags.beamHit) { caught = true; break; }
        if (w === 0) yield B.bubble(sun, '@annoyed Heyyy, you missed them!', '@happy Move INTO the beams, silly! One more time!');
        if (w === 1) yield B.bubble(sun, '@annoyed ...Okay. Listen, buddy.', "I'm trying to HELP you.", '@grin Run. Into. The. Beams.');
      }
      St().run.flags.beamCaught = caught;
      if (caught) yield B.bubble(sun, '@evil ...', '@laugh Ha ha ha ha ha!', '@grin You actually FELL for that?', ...reveal);
      else yield B.bubble(sun, '@blank ...', "@sly You're smarter than you look.", ...reveal);
    } else {
      if (lastGeno) yield B.bubble(sun, "@evil Oh. It's YOU.", '@grin Hee hee. I liked how things went last time.', 'Did you come back to do it all again?', "@sly Let's skip the part where I pretend to be nice.");
      else yield B.bubble(sun, '@happy This is a BAT-', '@blank ...', '@blank Wait.', "@sly It's you. Again.", '@grin Did you really think starting over would make me forget?', '@evil I remember EVERYTHING.', "@sly Let's skip the tutorial. You know how this goes.");
      B.flags.beamHit = false;
      yield B.dodgeCmd([beams(2)]);
      St().run.flags.beamCaught = B.flags.beamHit;
      if (B.flags.beamHit) yield B.bubble(sun, '@laugh Ha! Every time.');
    }
    U.Audio.music('sundark');
    sun.expr = 'evil';
    yield B.bubble(sun, '@evil Burn.');
    yield B.dodgeCmd([fireRing()]);
    // ---- the rescue ----
    B.mode = 'dodge-prep';
    B.soul.visible = true;
    U.Audio.sfx('magic'); U.FX.flashScreen('#9ad8ff', 22);
    B.bullets.list.forEach(b => B.parts.burst(b.x, b.y, 3, { col: '#9ad8ff', smin: .3, smax: 1.2, lmin: 14, lmax: 26 }));
    B.bullets.clear();
    yield 20;
    const orb = { kind: 'custom', t: 0, dur: 40, draw(ctx, f) { const k = Math.min(1, f.t / 24); const x = U.lerp(-20, sun.x, k), y = U.lerp(150, sun.y - 40, k); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#9ad8ff'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); for (let i = 1; i < 5; i++) { ctx.globalAlpha = .5 - i * .1; ctx.beginPath(); ctx.arc(x - i * 8, y + i * 4, 6 - i, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; } };
    B.fx.push(orb); U.Audio.sfx('swoosh');
    yield 24;
    U.Audio.sfx('crit'); U.FX.shake(5, 14); sun.expr = 'hurt'; sun.shake = 8;
    B.parts.burst(sun.x, sun.y - 40, 20, { col: '#fff', smin: 1, smax: 3, lmin: 14, lmax: 28 });
    yield B.bubbles_([{ e: sun, lines: ['@hurt OW-! HEY-!'] }], { auto: 14 });
    sun.st.fly = true; U.Audio.stopMusic(.4);
    yield 40;
    // the Ex-Queen arrives
    const q = B.addEnemy('exqueen_cameo', 160);
    q.ox = -200; q.st.slide = 0; q.expr = 'stern';
    yield 36;
    U.Audio.music('exqueen');
    yield B.bubble(q, '@stern What a cruel little creature.', '@stern Tormenting a lost child who cannot even fight back.', '@angry Do not come back to my halls.');
    q.expr = 'worried';
    yield 20;
    yield B.bubble(q, '@worried Oh, you poor thing.', '@kind Are you hurt? Hold still. Let me see...');
    U.Audio.sfx('heal'); St().fullHeal();
    for (let i = 0; i < 4; i++) { B.parts.burst(B.soul.x, B.soul.y, 8, { col: '#5cff6a', smin: .4, smax: 1.4, lmin: 16, lmax: 30, drag: .95 }); yield 6; }
    yield 20;
    B.end('scripted');
  }

  // =================================================================
  //  THE EX-QUEEN
  // =================================================================
  const FLAME = () => BA.flame('#ffffff'), FLAME_G = () => BA.flame('#5cff6a');
  // her magic is healing magic: when you're badly hurt, it turns kind on its own
  function kind(b, B) {
    if (b.type === 'norm' && R().hp <= 6 && U.dist(b.x, b.y, B.soul.x, B.soul.y) < 24) { b.type = 'heal'; b.heal = 1; b.spr = FLAME_G(); }
  }
  function exqPatterns(B, q) {
    const soft = q.st.spares >= 3;
    const dmg = q.atk;
    return [
      P.pat({ box: { w: 112, h: 80 }, dur: 250, init(B, p) { p.gap = 2; }, update(B, p, t) {
        if (t % 24 === 4 && t < 220) {
          if (soft) p.gap = U.clamp(Math.round((B.soul.x - B.box.x - 9) / 16), 0, 5); else p.gap = U.clamp(p.gap + U.randi(-1, 1), 0, 5);
          for (let k = 0; k < 7; k++) { if (k === p.gap || k === p.gap + 1) continue; B.bullets.add({ x: B.box.x + 9 + k * 16, y: B.box.y - 6, vy: 1.5, r: 3, spr: FLAME(), dmg, update: kind }); }
        }
      } }),
      P.pat({ box: { w: 104, h: 96 }, dur: 260, update(B, p, t) {
        if (t % 5 === 0 && t < 230) {
          const cx = B.box.x + B.box.w / 2, cy = B.box.y + B.box.h / 2, a = t * .37;
          B.bullets.add({ x: cx + Math.cos(a) * 66, y: cy + Math.sin(a) * 66, r: 3, spr: FLAME(), dmg, manual: true, ang: a, rad: 66, keep: true, margin: 100,
            update(b, B) { kind(b, B); b.rad -= soft ? .7 : .85; b.ang += .012; b.x = cx + Math.cos(b.ang) * b.rad; b.y = cy + Math.sin(b.ang) * b.rad; if (b.rad < 4) b.dead = true; } });
        }
      } }),
      P.pat({ box: { w: 124, h: 76 }, dur: 240, update(B, p, t) {
        if (t % 40 === 6 && t < 210) {
          const gap = soft ? U.clamp(Math.round((B.soul.y - B.box.y - 8) / 15), 0, 4) : U.randi(0, 4);
          for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
            if (k === gap) continue;
            B.bullets.add({ x: side < 0 ? B.box.x - 4 : B.box.x + B.box.w + 4, y: B.box.y + 8 + k * 15, vx: -side * 1.15, r: 3, spr: FLAME(), dmg, update: kind });
          }
        }
      } }),
      P.pat({ box: { w: 110, h: 82 }, dur: 220, update(B, p, t) {
        if (t % 9 === 0 && t < 200) {
          const side = (t / 9) % 2 ? -1 : 1;
          B.bullets.add({ x: side < 0 ? B.box.x + 4 : B.box.x + B.box.w - 4, y: B.box.y + 2, vx: -side * U.rand(.4, 1.4), vy: -.4, ay: .05, r: 3, spr: FLAME(), dmg, update: kind });
        }
      } }),
    ];
  }
  const EXQ_SPARE = [
    ['@stern What are you doing?', 'Fight back, or run!'],
    ['@stern Attack me, or leave!'],
    ['@worried ...Please. Do not look at me like that.'],
    ['@sad Out there, they will not be as gentle as I am.'],
    ['@sad I could not protect my son.', '@sad How could I possibly protect you?'],
    ['@tearful ...', '@tearful You are so stubborn.', '@kind Just like...', '@kind ...', '@kind Alright. Alright, little one.'],
  ];
  U.Enemy('exqueen', {
    name: 'Ex-Queen', hp: 140, atk: 5, df: 2, exp: 80, gold: 20, boss: true, voice: 'exqueen', music: 'exqbattle', expr: 'stern', bubbleChars: 19,
    sprite(B, e) { return U.Chars.bigBW('exqueen', e.shake > 2 ? 'hurt' : (e.expr || 'stern')); },
    init(B, e) { e.st.spares = 0; e.st.geno = St().genocideTrack() && St().exhausted('hall'); },
    intro(B, e) { return e.st.geno ? 'The Ex-Queen blocks the way.\nShe is staring at your HANDS.' : 'The Ex-Queen blocks the way!'; },
    check(B, e) { return e.st.geno ? "She doesn't understand what you are." : 'She is testing you.\nShe does not want to hurt you.'; },
    acts: ['Check', 'Talk', 'Promise', 'Hop'],
    act(B, e, a) {
      if (a === 'Talk') { const n = e.acted.Talk; return [n === 1 ? 'You try to say something. You have no voice.\nShe notices you trying.' : n === 2 ? 'You try to tell her you will be okay.\nShe closes her eyes for a moment.' : 'You keep trying. She keeps listening.']; }
      if (a === 'Promise') { e.st.promise = true; return ['You nod very seriously, promising to be careful.', 'She hesitates.']; }
      if (a === 'Hop') return ['You hop in place.', 'For a moment, she almost smiles.'];
    },
    onSpare: function* (B, e) {
      if (e.st.geno) { yield B.bubble(e, '@stern ...You do not get to ask for mercy.'); return; }
      e.st.spares++;
      const need = e.st.promise ? 5 : 6;
      const idx = Math.min(EXQ_SPARE.length - 1, e.st.spares >= need ? 5 : e.st.spares - 1);
      if (e.st.spares >= need) {
        yield B.bubble(e, ...EXQ_SPARE[5]);
        St().run.bosses.exqueen = 'spared';
        St().run.rel.exqueen += 5;
        yield B.spareCmd(e);
        B.flags.exqSpared = true;
        return;
      }
      e.expr = 'worried';
      yield B.bubble(e, ...EXQ_SPARE[idx]);
    },
    onHit(B, e, dmg) {
      if (e.st.geno && dmg > 0) return 9999;
      if (e.st.spares >= 3 && dmg > 0) return Math.round(dmg * 2.5); // her guard is down
      return dmg;
    },
    talk(B, e) {
      if (e.st.geno) return null;
      if (e.hp < e.maxhp * .35) return [U.choose(['@hurt ...', '@hurt Why...?'])];
      if (B.turn === 0) return ['@stern Show me that you can survive out there.'];
      if (B.turn === 1) return ['@stern ...'];
      return null;
    },
    flavor(B, e) {
      if (e.st.spares >= 3) return U.choose(['The Ex-Queen is looking at you through her fingers.', 'Her flames keep missing.']);
      return U.choose(['The Ex-Queen stands between you and the door.', 'The Ex-Queen holds her flames very carefully.', 'The lanterns flicker.']);
    },
    attack(B, e) { const ps = exqPatterns(B, e); return ps[B.turn % ps.length]; },
    deathLines(B, e) {
      St().run.bosses.exqueen = 'killed';
      if (e.st.geno) return ['@surprised ...!', '@hurt You...', '@hurt What... ARE you...?'];
      if (e.st.spares >= 3) return ['@hurt Ah...', '@hurt So that is... what you were waiting for...', '@sad I let my guard down. Just like before...', '@sad ...Calia... I am sorry...'];
      return ['@hurt Ah...', '@hurt You are... stronger than I thought...', '@sad Please... be careful of the little sun...', '@sad ...Calia... I am sorry...'];
    },
  });

  // =================================================================
  //  SUPERKENDAL — future Royal Guard (he is ten)
  // =================================================================
  const STAR = () => BA.star();
  function skPatterns(B, s, turn) {
    const dmg = s.atk;
    const pats = {
      stars: P.pat({ box: { w: 112, h: 80 }, dur: 230, update(B, p, t) {
        if (t % 13 === 0 && t < 210) B.bullets.add({ x: U.rand(B.box.x + 8, B.box.x + B.box.w - 8), y: B.box.y - 6, vx: U.rand(-.6, .6), vy: 1.3, r: 3.5, spr: STAR(), vr: .08, dmg, bounced: false,
          update(b, B) { if (!b.bounced && b.y > B.box.y + B.box.h - 9) { b.bounced = true; b.vy = -1.6; b.ay = .06; U.Audio.sfx('bounce'); } } });
      } }),
      eight: P.pat({ box: { w: 136, h: 84 }, dur: 260, update(B, p, t) {
        if (t % 80 === 10) {
          const side = (t / 80 | 0) % 2 ? -1 : 1;
          const cy = U.rand(B.box.y + 26, B.box.y + B.box.h - 26);
          const x0 = side > 0 ? B.box.x - 24 : B.box.x + B.box.w + 24;
          const add = (ox, oy) => B.bullets.add({ x: x0 + ox, y: cy + oy, vx: side * 1.5, r: 2.5, dmg, keep: true, margin: 80, life: 220 });
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(Math.cos(a) * 11, -13 + Math.sin(a) * 10); }
          for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; add(Math.cos(a) * 13, 11 + Math.sin(a) * 12); }
        }
      } }),
      socks: P.pat({ box: { w: 136, h: 76 }, dur: 230, update(B, p, t) {
        if (t % 48 === 6 && t < 200) {
          const side = Math.random() < .5 ? -1 : 1, y = U.rand(B.box.y + 10, B.box.y + B.box.h - 12);
          B.bullets.add({ x: side > 0 ? B.box.x - 14 : B.box.x + B.box.w + 14, y, vx: side * 3.6, shape: 'rect', w: 16, h: 8, dmg, warn: 26, keep: true, margin: 40, life: 90,
            warnDraw(ctx, b) { ctx.fillStyle = '#fff'; const ax = side > 0 ? B.box.x + 6 : B.box.x + B.box.w - 12; U.Font.draw(ctx, side > 0 ? '>' : '<', ax, Math.round(b.y - 3), '#fff'); },
            draw(ctx, b) { if (b.t === b.warn) U.Audio.sfx('meow'); const s = BA.cat((b.t >> 2) % 2); ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); if (side < 0) ctx.scale(-1, 1); ctx.drawImage(s, -10, -6); ctx.restore(); } });
        }
      } }),
      pancakes: P.pat({ box: { w: 112, h: 84 }, dur: 240, update(B, p, t) {
        if (t % 20 === 0 && t < 210) B.bullets.add({ x: U.rand(B.box.x + 10, B.box.x + B.box.w - 10), y: B.box.y + B.box.h + 4, vx: U.rand(-.4, .4), vy: -3.3, ay: .075, vr: .15, r: 3, shape: 'rect', w: 12, h: 4, spr: BA.pancake(), dmg, warn: 0 });
      } }),
      flags: P.pat({ box: { w: 104, h: 80 }, dur: 230, update(B, p, t) {
        if (t % 32 === 4 && t < 200) { const gap = U.randi(0, 4); for (let k = 0; k < 6; k++) { if (k === gap || k === gap + 1) continue; B.bullets.add({ x: B.box.x + 9 + k * 17, y: B.box.y - 8, vy: 1.25, r: 3.5, spr: BA.flag(), dmg }); } }
      } }),
      ultimate: P.pat({ box: { w: 112, h: 92 }, dur: 300, init(B, p) {
        p.stack = B.bullets.add({ x: B.box.x + B.box.w / 2, y: B.box.y - 30, vy: .32, hit: false, clip: false, keep: true, life: 999, manual: true,
          draw(ctx, b) { for (let i = 0; i < 7; i++) { ctx.fillStyle = i % 2 ? '#c8c8c8' : '#fff'; ctx.beginPath(); ctx.ellipse(Math.round(b.x), Math.round(b.y - i * 5), 22 - i, 5, 0, 0, 7); ctx.fill(); } ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(b.x) - 4, Math.round(b.y) - 42, 8, 6); },
          update(b) { if (b.t < 130) b.y += b.vy; } });
      }, update(B, p, t) {
        if (t === 150) {
          p.stack.dead = true; U.Audio.sfx('bomb'); U.FX.shake(3, 10); U.FX.flashScreen('#ffffff', 6);
          for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; B.bullets.add({ x: p.stack.x, y: p.stack.y - 10, vx: Math.cos(a) * 1.1, vy: Math.sin(a) * 1.1 - .4, ay: .02, r: 3, type: 'heal', heal: 2, spr: BA.drop(), col: '#5cff6a', draw(ctx, b) { ctx.fillStyle = '#5cff6a'; ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), 3, 0, 7); ctx.fill(); } }); }
          for (let i = 0; i < 10; i++) { const a = U.rand(0, Math.PI * 2); B.bullets.add({ x: p.stack.x, y: p.stack.y - 10, vx: Math.cos(a) * .7, vy: Math.sin(a) * .7, r: 1.5, dmg: 1 }); }
        }
      } }),
    };
    const order = ['stars', 'eight', 'socks', 'pancakes', 'flags', 'combo', 'ultimate'];
    const k = order[Math.min(turn, order.length - 1)];
    if (s.st.ultDone && turn >= 6) return U.choose([pats.stars, pats.flags]);
    if (k === 'combo') return [pats.stars, pats.socks];
    return pats[k];
  }
  const SK_TALK = [
    ['@determined HALT, VISITOR!', 'By order of... um... ME!', '@proud I, SUPERKENDAL, future Royal Guard, will CAPTURE you!', '@excited KENDAL-TASTIC!'],
    ['@excited Behold! My jersey number in ATTACK FORM!'],
    ['@happy SOCKS! ATTACK!', '@worried ...Gently!'],
    ['@proud Princess Calia says breakfast is the most important meal!', '@determined So it must be the most important ATTACK!'],
    ['@determined Royal Guard drill number four!'],
    ['@thinking Hmm. You are VERY good at not getting captured.'],
    ['@excited NOW! MY ULTIMATE TECHNIQUE!', '@determined THE KENDAL-TASTIC BREAKFAST BLAST!'],
  ];
  U.Enemy('sk', {
    name: 'Superkendal', hp: 150, atk: 3, df: 2, exp: 100, gold: 30, boss: true, voice: 'sk', music: 'skbattle', expr: 'determined', bubbleChars: 19,
    sprite(B, e) { return U.Chars.bigBW('sk', e.shake > 2 ? 'shocked' : (e.expr || 'happy')); },
    init(B, e) { e.st.geno = St().genocideTrack(); if (e.st.geno) e.expr = 'worried'; },
    intro(B, e) { return e.st.geno ? 'Superkendal is not attacking.\nHe just looks at you.' : 'Superkendal strikes a heroic pose!'; },
    check(B, e) { return e.st.geno ? 'He still believes in you.' : 'Wants to join the Royal Guard. Is ten.'; },
    acts: (B, e) => e.st.tasted ? ['Check', 'Salute', 'Compliment', 'Ask: Calia'] : ['Check', 'Salute', 'Compliment', 'Ask: Calia', 'Taste Test'],
    act: function* (B, e, a) {
      const s = e.st; s.friendly = (s.friendly || 0) + (a === 'Check' ? 0 : 1);
      if (a === 'Salute') { yield B.say('You salute with one leg. It counts.'); e.expr = 'excited'; yield B.bubble(e, '@excited A SALUTE!', 'You understand the CODE!'); }
      if (a === 'Compliment') { yield B.say('You admire his jersey.'); e.expr = 'proud'; yield B.bubble(e, "@proud IT'S NUMBER EIGHT!", 'The most heroic number!', '@thinking It looks like a snowman. Or infinity, standing up!'); }
      if (a === 'Ask: Calia') { yield B.say('You tilt your whole body towards the distant palace, questioningly.'); e.expr = 'excited'; yield B.bubble(e, "@excited PRINCESS CALIA?! She's the BRAVEST!", "She's teaching me secret Royal Guard techniques!", '@thinking ...They all involve flour.'); }
      if (a === 'Taste Test') { s.tasted = true; yield B.say('Superkendal tosses you a pancake mid-battle.\nYou catch it. In your mouth.'); St().heal(10); U.Audio.sfx('heal'); yield B.say('You recovered 10 HP!'); yield B.bubble(e, "@excited IT'S PRACTICE! IS IT GOOD?!", "@worried DON'T ANSWER!"); }
    },
    spareable: (B, e) => !!e.st.ultDone || (B.turn >= 3 && (e.st.friendly || 0) >= 2),
    onSpare: function* (B, e) {
      if (e.st.geno) return;
      e.expr = 'shocked';
      yield B.bubble(e, B.turn < 3 ? "@shocked MERCY?! I haven't even shown you my ULTIMATE TECHNIQUE!" : "@thinking You keep doing that... I'm not sure the Royal Guard handbook covers this.");
    },
    onSpared(B, e) { St().run.bosses.sk = 'spared'; St().run.rel.sk += 5; },
    talk(B, e) {
      if (e.st.geno) return [['@worried ...', "@worried I know you can be better. I BELIEVE it!", '@teary Want to be friends? We can start over! Right now!'], ['@teary ...'], ['@worried Please?']][Math.min(2, B.turn)];
      if (e.st.ultDone) return [U.choose(['@happy ...Friends?', '@teary Will you be my friend?!'])];
      return SK_TALK[Math.min(B.turn, SK_TALK.length - 1)];
    },
    flavor(B, e) {
      if (e.st.geno) return 'Superkendal is holding out his hand. He is waiting.';
      if (e.st.ultDone) return 'Superkendal is out of attacks. And breath.';
      return U.choose(['Superkendal is posing heroically.', 'Socks the cat is judging you from his shoulder.', 'Smells like pancakes.', 'Superkendal is doing a victory dance. Prematurely.']);
    },
    attack(B, e) { if (e.st.geno) return null; return skPatterns(B, e, B.turn); },
    deathLines(B, e) {
      St().run.bosses.sk = 'killed';
      if (e.st.geno) return ['@shocked ...', '@teary Oh.', "@teary That's... okay.", "@teary I still believe you can be good. I believe it so much...", '@teary Tell my brother... I made breakfast...'];
      return ['@shocked Oh.', "@sad That's okay! I'm... I'm just gonna take a little nap, I think.", '@teary Hey... tell my brother I made breakfast.', "@teary It's in the..."];
    },
    flow: skFlow,
  });
  function* skFlow(B) {
    const s = B.enemies[0];
    B.canFlee = false;
    B.flavor = s.def.intro(B, s);
    B.onDeath = (B) => { if (s.st.geno) return false; B.flags.skPanic = true; St().fullHeal(); B.soul.inv = 90; return true; };
    while (!B.over) {
      const a = yield B.menuCmd();
      yield* B.doAction(a);
      if (B.over) return;
      if (B.checkWin()) {
        if (s.spared && !s.st.geno) {
          yield 10;
          yield B.say('Superkendal is too busy being your friend to battle.');
        }
        yield* B.winFlow(); return;
      }
      // enemy turn
      const lines = s.def.talk(B, s);
      if (lines) yield B.bubble(s, ...lines);
      const p = s.def.attack(B, s);
      if (p) {
        if (!Array.isArray(p)) p.update = wrapPanic(p.update);
        yield B.dodgeCmd(Array.isArray(p) ? p.map(x => Object.assign(x, { update: wrapPanic(x.update) })) : [p]);
      }
      if (B.flags.skPanic) {
        B.flags.skPanic = false;
        s.expr = 'shocked';
        yield B.bubble(s, '@shocked OH NO NO NO!', '@worried YOU WERE SUPPOSED TO DODGE!', '@worried HERE! EAT THIS!');
        U.Audio.sfx('heal');
        yield B.say('Superkendal shoves a Practice Pancake into your face.\nYour HP was maxed out.');
        s.st.healedYou = (s.st.healedYou || 0) + 1;
        yield B.bubble(s, '@sad Sorry! Sorry. Okay. Gentler now.');
        s.atk = Math.max(1, s.atk - 1);
      }
      if (B.turn === 6 && !s.st.ultDone && !s.st.geno) {
        s.st.ultDone = true; s.expr = 'thinking';
        yield B.bubble(s, '@thinking That was... my ULTIMATE technique.', "@shocked And you're still standing.", '@sad ...', "@sad I don't think I could ever hurt you. Even for the Royal Guard.", '@excited WILL YOU BE MY FRIEND INSTEAD?!');
        s.expr = 'happy';
      }
      B.turn++;
      B.flavor = s.def.flavor(B, s);
    }
    function wrapPanic(fn) { return function (B, p, t) { if (B.flags.skPanic) { p.done = true; return; } if (fn) fn(B, p, t); }; }
  }
})();
