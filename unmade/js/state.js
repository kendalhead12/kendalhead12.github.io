'use strict';
// ============================================================
//  Game state: run (this timeline), meta (survives resets),
//  items, stats, routes, save / load (localStorage)
// ============================================================
(function () {
  U.Items = {
    glowcap: { name: 'Glowcap', type: 'food', heal: 8, sell: 2, desc: 'A mushroom that glows faintly.', eat: 'It tastes like a nightlight.' },
    candy: { name: 'Lantern Candy', type: 'food', heal: 10, sell: 2, desc: 'A hard candy that glows blue.', eat: 'It tastes like the colour blue.' },
    moontart: { name: 'Moon Tart', type: 'food', heal: 40, sell: 10, desc: 'A moonberry tart. Still warm.', eat: 'It tastes like being looked after.' },
    snowcone: { name: 'Snow Cone', type: 'food', heal: 12, price: 8, sell: 3, desc: 'Shaved snow with berry syrup.', eat: 'Brain freeze!' },
    cocoa: { name: 'Hot Cocoa', type: 'food', heal: 20, price: 15, sell: 5, desc: 'Warm all the way down.', eat: 'You feel cosy.' },
    fishbiscuit: { name: 'Fish Biscuit', type: 'food', heal: 15, sell: 4, desc: "Catty's snack. Slightly bitten.", eat: 'Crunchy. Fishy. Smug.' },
    pancake: { name: 'Practice Pancake', type: 'food', heal: 25, sell: 1, desc: 'Burnt on one side, raw on the other. Made with love.', eat: 'It tastes like trying your best.' },
    lint: { name: 'Pocket Lint', type: 'food', heal: 0, sell: 0, desc: "You don't have pockets. Where did this come from?", eat: 'You eat the lint. Why.' },
    barefeet: { name: 'Bare Feet', type: 'weapon', at: 0, desc: "Your own two legs. They've never let you down." },
    toecaps: { name: 'Tin Toecaps', type: 'weapon', at: 3, sell: 8, desc: 'Little tin caps for your feet. Clink, clink.' },
    snowboots: { name: 'Snow Boots', type: 'weapon', at: 5, price: 35, sell: 12, desc: 'Heavy boots. Good for kicking snow. And other things.' },
    hands: { name: 'HANDS', type: 'weapon', at: 15, sell: 0, desc: 'They were never supposed to be yours.' },
    nothing: { name: 'Nothing', type: 'armor', df: 0, desc: 'You are wearing nothing. You always were.' },
    charm: { name: 'Old Charm', type: 'armor', df: 2, sell: 6, desc: 'A little lantern charm. A "K" is scratched into the back.' },
    scarf: { name: 'Wool Scarf', type: 'armor', df: 4, price: 30, sell: 10, desc: 'Knitted by Woolly. Itchy, but warm.' },
  };
  // Areas: encounter population (kills needed to empty an area) — tables are filled in by enemy modules
  U.Areas = {
    hall: { name: 'Dark Hallways', pop: 12, table: [], music: 'hall' },
    frost: { name: 'Frostwood', pop: 14, table: [], music: 'frost' },
  };
  const LV_EXP = [0, 10, 30, 70, 120, 200, 300, 500, 800, 1200, 1700, 2500, 3500, 5000, 7000, 10000, 15000, 25000, 50000, 99999];

  const S = U.State = { run: null, meta: null };
  S.ROUTES = { pacifist: 'PACIFIST', neutral: 'NEUTRAL', nomercy: 'NO MERCY', genocide: 'GENOCIDE' };

  S.defaultMeta = () => ({
    v: 1, resets: 0, runs: 0, lastName: null, lastRoute: null,
    completed: { pacifist: 0, neutral: 0, nomercy: 0, genocide: 0 },
    genocideRuns: 0, symbols: {}, seen: {}, lastEndRoute: null, chapterEnds: 0,
  });
  S.loadMeta = function () { S.meta = Object.assign(S.defaultMeta(), U.store.get('meta') || {}); return S.meta; };
  S.saveMeta = function () { U.store.set('meta', S.meta); };

  S.newRun = function (name) {
    const areas = {};
    for (const k in U.Areas) areas[k] = { kills: 0, spares: 0, flees: 0, visited: false, emptied: false };
    S.run = {
      v: 1, name: name || 'BLANK', lv: 1, exp: 0, hp: 20, gold: 0,
      items: [], weapon: 'barefeet', armor: 'nothing',
      room: 'ws_lab', x: 0, y: 0, dir: 'down',
      flags: {}, areas, bosses: {}, rel: { exqueen: 0, sk: 0, fgd: 0, calia: 0, catty: 0, sun: 0 },
      kills: 0, spares: 0, flees: 0, time: 0, chapter: 1, instance: (S.meta ? S.meta.runs + 1 : 1),
    };
    return S.run;
  };

  // ---------------- stats ----------------
  S.maxhp = () => Math.min(99, 16 + 4 * S.run.lv);
  S.baseAT = () => 2 * (S.run.lv - 1);
  S.baseDF = () => Math.floor((S.run.lv - 1) / 4);
  S.weaponAT = () => (U.Items[S.run.weapon] || {}).at || 0;
  S.armorDF = () => (U.Items[S.run.armor] || {}).df || 0;
  S.attack = () => 10 + S.baseAT() + S.weaponAT();
  S.defense = () => S.baseDF() + S.armorDF();
  S.nextExp = () => { const n = LV_EXP[S.run.lv]; return n == null ? 0 : Math.max(0, n - S.run.exp); };
  S.addExp = function (n) {
    const r = S.run; let up = 0;
    r.exp += n;
    while (LV_EXP[r.lv] != null && r.exp >= LV_EXP[r.lv] && r.lv < 20) { r.lv++; up++; r.hp += 4; }
    if (r.hp > S.maxhp()) r.hp = S.maxhp();
    return up;
  };
  S.heal = function (n) { const r = S.run; const before = r.hp; r.hp = Math.min(S.maxhp(), r.hp + n); return r.hp - before; };
  S.fullHeal = () => { S.run.hp = Math.max(S.run.hp, S.maxhp()); };

  // ---------------- inventory ----------------
  S.MAX_ITEMS = 8;
  S.give = function (id) { if (S.run.items.length >= S.MAX_ITEMS) return false; S.run.items.push(id); return true; };
  S.has = id => S.run.items.includes(id) || S.run.weapon === id || S.run.armor === id;
  S.removeAt = i => S.run.items.splice(i, 1)[0];
  // use item at index; returns lines of text
  S.useItem = function (i) {
    const id = S.run.items[i], it = U.Items[id];
    if (!it) return ['Nothing happens.'];
    if (it.type === 'food') {
      S.removeAt(i);
      if (U.Audio) U.Audio.sfx(it.heal ? 'heal' : 'eat');
      const got = S.heal(it.heal);
      const full = S.run.hp >= S.maxhp();
      const tail = it.heal ? (full ? 'Your HP was maxed out.' : 'You recovered ' + got + ' HP!') : '';
      return ['You ate the ' + it.name + '. ' + it.eat + (tail ? '\n' + tail : '')];
    }
    if (it.type === 'weapon') { S.run.items[i] = S.run.weapon; S.run.weapon = id; if (U.Audio) U.Audio.sfx('item'); return ['You equipped the ' + it.name + '.']; }
    if (it.type === 'armor') { S.run.items[i] = S.run.armor; S.run.armor = id; if (U.Audio) U.Audio.sfx('item'); return ['You put on the ' + it.name + '.']; }
    return ['Nothing happens.'];
  };

  // ---------------- flags & areas ----------------
  S.flag = function (k, v) { if (v === undefined) return S.run.flags[k]; S.run.flags[k] = v; return v; };
  S.area = id => S.run.areas[id];
  S.remaining = id => { const a = S.run.areas[id], d = U.Areas[id]; return a && d ? Math.max(0, d.pop - a.kills) : 0; };
  S.exhausted = id => S.remaining(id) <= 0;
  S.recordKill = function (enemyId, areaId, boss) {
    const r = S.run; r.kills++;
    if (areaId && r.areas[areaId] && !boss) r.areas[areaId].kills++;
  };
  S.recordSpare = function (enemyId, areaId) { const r = S.run; r.spares++; if (areaId && r.areas[areaId]) r.areas[areaId].spares++; };
  S.recordFlee = function (areaId) { S.run.flees++; if (areaId && S.run.areas[areaId]) S.run.areas[areaId].flees++; };

  // On a genocide track: never spared anyone, killed every boss so far, emptied every area left behind
  S.genocideTrack = function () {
    const r = S.run;
    if (r.spares > 0 || r.kills === 0) return false;
    for (const b in r.bosses) if (r.bosses[b] === 'spared') return false;
    if (r.flags.leftHall && !S.exhausted('hall')) return false;
    if (r.flags.leftFrost && !S.exhausted('frost')) return false;
    return true;
  };
  S.route = function () {
    const r = S.run;
    if (r.kills === 0) return 'pacifist';
    let bossSpared = false;
    for (const b in r.bosses) if (r.bosses[b] === 'spared') bossSpared = true;
    if (r.spares === 0 && !bossSpared) {
      let all = true;
      for (const k in r.areas) if (r.areas[k].visited && !S.exhausted(k)) all = false;
      return all ? 'genocide' : 'nomercy';
    }
    return 'neutral';
  };
  // Second-genocide fear mechanic (purely atmospheric — monsters do not remember)
  S.fearActive = () => !!(S.meta && S.meta.genocideRuns > 0 && S.run && S.run.spares === 0 && S.run.kills >= 10);

  // ---------------- save / load ----------------
  S.hasSave = () => !!U.store.get('save');
  S.save = function (room, x, y, label) {
    const r = S.run;
    r.room = room; r.x = x; r.y = y; r.saveLabel = label || r.saveLabel || '';
    r.savedAt = Date.now();
    U.store.set('save', r);
    S.saveMeta();
  };
  S.load = function () {
    const r = U.store.get('save');
    if (!r) return false;
    S.newRun(r.name);
    const base = S.run;
    S.run = Object.assign(base, r);
    for (const k in U.Areas) if (!S.run.areas[k]) S.run.areas[k] = { kills: 0, spares: 0, flees: 0, visited: false, emptied: false };
    return true;
  };
  S.saveInfo = () => U.store.get('save');
  // RESET: restart the story, keep meta progression (Sun and FunnyGuyDev will notice)
  S.reset = function () {
    const old = U.store.get('save');
    S.meta.resets++;
    if (old) S.meta.lastName = old.name;
    U.store.del('save');
    S.saveMeta();
    S.newRun(S.meta.lastName || 'BLANK');
  };
  // Clear every UNMADE key (save + meta); settings are kept
  S.eraseAll = function () {
    U.store.clearAll();
    U.saveOpts();
    S.meta = S.defaultMeta();
    S.run = null;
  };
  // record chapter completion in meta
  S.completeChapter = function (ch) {
    const route = S.route();
    S.meta.runs++;
    S.meta.chapterEnds++;
    S.meta.completed[route] = (S.meta.completed[route] || 0) + 1;
    S.meta.lastRoute = route;
    S.meta.lastName = S.run.name;
    // NOTE: once later chapters exist, move this to the true Genocide ending.
    if (route === 'genocide') S.meta.genocideRuns++;
    S.run.flags['chapter' + ch + 'Done'] = true;
    S.saveMeta();
    return route;
  };
})();
