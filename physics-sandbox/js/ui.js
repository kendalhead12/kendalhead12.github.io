// DOM user interface: menus, spawn menu, settings, panels and HUD.
import * as THREE from 'three';
import { G } from './state.js';
import { settings, setSetting, resetSettings, FACTIONS, FACTION_NAMES, relations, setRelation, resetRelations } from './config.js';
import { CATALOG, CATEGORIES, activateItem, thumbnail, undo, clearCreatures, clearProps, clearSpawners, freezeAll, listSaves, saveGame, loadGame, deleteSave } from './spawn.js';
import { CREATURES } from './creatures/defs.js';
import { MAPS } from './maps.js';
import { weaponState as W, WEAPON_BY_ID } from './weapons.js';
import { spawnerConfig } from './interact.js';
import { lock, unlock } from './input.js';
import { play, initAudio } from './audio.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export class UI {
  constructor(game) {
    this.game = game;
    this.open = new Set();
    this.cat = 'Humans';
    G.ui = this;
    this.buildMainMenu();
    this.buildMapMenu();
    this.buildSpawnMenu();
    this.buildSettings();
    this.buildPanels();
    this.bindPause();
    this.toastBox = $('#toasts');
  }

  // ---------- generic ----------
  show(id) { $(id).classList.remove('hidden'); this.open.add(id); unlock(); }
  hide(id) { $(id).classList.add('hidden'); this.open.delete(id); }
  anyOpen() { return [...this.open].some(id => !$(id).classList.contains('hidden')); }
  closeAll(relock = true) {
    for (const id of [...this.open]) this.hide(id);
    if (relock && G.playing) lock();
  }
  toast(msg, secs = 2.2) {
    const t = el('div', 'toast', msg);
    this.toastBox.appendChild(t);
    while (this.toastBox.children.length > 4) this.toastBox.firstChild.remove();
    setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 400); }, secs * 1000);
  }
  clickSound() { play('ui', null, 0.6); }

  // ---------- main menu ----------
  buildMainMenu() {
    $('#btnPlay').onclick = () => { initAudio(); this.clickSound(); this.hide('#mainMenu'); this.show('#mapMenu'); };
    $('#btnMainSettings').onclick = () => { initAudio(); this.openSettings(); };
    $('#btnMainLoad').onclick = () => { initAudio(); this.openSaves(true); };
    $('#btnMainHelp').onclick = () => { this.show('#helpPanel'); };
    $('#btnHelpClose').onclick = () => { this.hide('#helpPanel'); if (G.playing && !this.anyOpen()) lock(); };
    this.open.add('#mainMenu');
  }
  buildMapMenu() {
    const grid = $('#mapGrid');
    for (const m of MAPS) {
      const card = el('button', 'mapCard');
      const img = el('div', 'mapImg ' + m.id);
      card.append(img, el('div', 'mapName', m.name), el('div', 'mapDesc', m.desc));
      card.onclick = () => { this.clickSound(); this.hide('#mapMenu'); this.hide('#pauseMenu'); this.game.startMap(m.id); };
      grid.appendChild(card);
    }
    $('#btnMapBack').onclick = () => { this.hide('#mapMenu'); if (G.playing) this.show('#pauseMenu'); else this.show('#mainMenu'); };
  }

  // ---------- spawn menu ----------
  buildSpawnMenu() {
    const side = $('#spawnCats');
    for (const c of CATEGORIES) {
      const b = el('button', 'catBtn', c);
      b.dataset.cat = c;
      b.onclick = () => { this.clickSound(); this.cat = c; $('#spawnSearch').value = ''; this.renderSpawnGrid(); };
      side.appendChild(b);
    }
    $('#spawnSearch').oninput = () => this.renderSpawnGrid();
    $('#actUndo').onclick = () => undo();
    $('#actClearNpc').onclick = () => { clearCreatures(); this.toast('All creatures removed'); };
    $('#actClearDead').onclick = () => { clearCreatures(true); this.toast('All bodies removed'); };
    $('#actClearProps').onclick = () => { clearProps(); this.toast('All props and vehicles removed'); };
    $('#actFreeze').onclick = () => freezeAll();
    $('#actReset').onclick = () => { this.closeAll(); this.game.startMap(G.mapId); };
    $('#actSave').onclick = () => this.openSaves(false);
    $('#actSettings').onclick = () => this.openSettings();
    $('#actClose').onclick = () => this.closeAll();
  }
  toggleSpawnMenu() {
    if (!$('#spawnMenu').classList.contains('hidden')) { this.closeAll(); return; }
    if (this.anyOpen()) return;
    this.show('#spawnMenu');
    $('#spawnSearch').value = '';
    this.renderSpawnGrid();
  }
  renderSpawnGrid() {
    const q = $('#spawnSearch').value.trim().toLowerCase();
    for (const b of document.querySelectorAll('.catBtn')) b.classList.toggle('active', !q && b.dataset.cat === this.cat);
    const grid = $('#spawnGrid');
    grid.innerHTML = '';
    const items = CATALOG.filter(it => q ? (it.name + ' ' + it.desc + ' ' + it.category).toLowerCase().includes(q) : it.category === this.cat);
    $('#spawnTitle').textContent = q ? `Search: "${q}" (${items.length})` : this.cat;
    const pending = [];
    for (const it of items) {
      const card = el('button', 'itemCard');
      const img = el('img', 'thumb'); img.alt = '';
      const owned = it.type === 'weapon' && W.owned.includes(it.id);
      card.append(img, el('div', 'itemName', it.name + (owned ? ' <span class="owned">owned</span>' : '')), el('div', 'itemDesc', it.desc));
      if (G.spawnSelection && G.spawnSelection.id === it.id && G.spawnSelection.type === it.type) card.classList.add('selected');
      card.onclick = () => { this.clickSound(); const r = activateItem(it); if (r === 'close') this.closeAll(); };
      grid.appendChild(card);
      pending.push([img, it]);
    }
    // render thumbnails progressively
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < pending.length && performance.now() - t0 < 12) { const [img, it] = pending[i++]; img.src = thumbnail(it); }
      if (i < pending.length) requestAnimationFrame(step);
    };
    step();
  }

  // ---------- settings ----------
  buildSettings() {
    const S = [
      ['Sandbox', [
        ['npcRetaliation', 'NPC Retaliation', 'toggle', 'Humans fight back when you hit them'],
        ['npcFear', 'NPC Fear', 'toggle', 'Humans get scared, scream, flee and hide'],
        ['npcIntelligence', 'NPC Intelligence', ['low', 'medium', 'high'], 'Think rate, sight range, pathfinding, hiding and warnings'],
        ['npcInvincible', 'NPC Invincibility', 'toggle'],
        ['playerInvincible', 'Player Invincibility', 'toggle'],
        ['infiniteAmmo', 'Infinite Ammo', 'toggle'],
        ['friendlyFire', 'Friendly Fire', 'toggle', 'Allow damage between friendly factions'],
        ['ragdolls', 'Ragdoll Physics', 'toggle', 'Off: creatures fall over with a simple animation'],
        ['gravity', 'Gravity', [0, 30, 0.1], 'm/s² (Earth = 9.81)'],
        ['gameSpeed', 'Game Speed', [0, 3, 0.05], 'Time scale of the simulation'],
        ['populationLimit', 'NPC Population Limit', [1, 200, 1]],
        ['voices', 'Voice Lines (speech)', 'toggle', 'Speech synthesis for NPC dialogue'],
      ]],
      ['Effects', [
        ['blood', 'Blood Effects', 'toggle', 'Off: hits show white impact sparks instead'],
        ['damageFx', 'Damage Effects', ['low', 'medium', 'high']],
        ['fxIntensity', 'Visual Effects Intensity', [0, 2, 0.05]],
      ]],
      ['Graphics', [
        ['shadows', 'Shadows', ['off', 'low', 'high']],
        ['resScale', 'Resolution Scale', [0.4, 1, 0.05]],
        ['drawDistance', 'Draw Distance', [150, 1500, 10]],
        ['fov', 'Field of View', [60, 110, 1]],
        ['grass', 'Grass (Forest, applies on map load)', 'toggle'],
      ]],
      ['Controls & Audio', [
        ['sensitivity', 'Mouse Sensitivity', [0.1, 3, 0.05]],
        ['invertY', 'Invert Mouse Y', 'toggle'],
        ['volume', 'Volume', [0, 1, 0.01]],
      ]],
    ];
    const tabs = $('#settingsTabs'), body = $('#settingsBody');
    this.settingInputs = {};
    S.forEach(([tab, rows], ti) => {
      const tb = el('button', 'tabBtn' + (ti === 0 ? ' active' : ''), tab);
      const page = el('div', 'tabPage' + (ti === 0 ? '' : ' hidden'));
      tb.onclick = () => { document.querySelectorAll('.tabBtn').forEach(b => b.classList.remove('active')); tb.classList.add('active'); document.querySelectorAll('.tabPage').forEach(p => p.classList.add('hidden')); page.classList.remove('hidden'); };
      tabs.appendChild(tb);
      for (const [key, label, kind, hint] of rows) {
        const row = el('div', 'setRow');
        const lab = el('div', 'setLabel', `${label}${hint ? `<small>${hint}</small>` : ''}`);
        let ctrl;
        if (kind === 'toggle') {
          ctrl = el('button', 'toggle');
          const upd = () => { ctrl.textContent = settings[key] ? 'ON' : 'OFF'; ctrl.classList.toggle('on', !!settings[key]); };
          ctrl.onclick = () => { setSetting(key, !settings[key]); upd(); this.clickSound(); };
          upd(); this.settingInputs[key] = upd;
        } else if (Array.isArray(kind) && typeof kind[0] === 'string') {
          ctrl = el('div', 'seg');
          const upd = () => ctrl.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === settings[key]));
          for (const v of kind) { const b = el('button', '', v[0].toUpperCase() + v.slice(1)); b.dataset.v = v; b.onclick = () => { setSetting(key, v); upd(); this.clickSound(); }; ctrl.appendChild(b); }
          upd(); this.settingInputs[key] = upd;
        } else {
          ctrl = el('div', 'slider');
          const inp = el('input'); inp.type = 'range'; inp.min = kind[0]; inp.max = kind[1]; inp.step = kind[2];
          const val = el('span', 'val');
          const upd = () => { inp.value = settings[key]; val.textContent = (+settings[key]).toFixed(kind[2] < 1 ? (kind[2] < 0.1 ? 2 : 1) : 0); };
          inp.oninput = () => { setSetting(key, +inp.value); upd(); };
          ctrl.append(inp, val); upd(); this.settingInputs[key] = upd;
        }
        row.append(lab, ctrl); page.appendChild(row);
      }
      body.appendChild(page);
    });
    $('#btnSettingsReset').onclick = () => { resetSettings(); for (const k in this.settingInputs) this.settingInputs[k](); };
    $('#btnSettingsClose').onclick = () => { this.hide('#settingsPanel'); if (this.returnTo) { this.show(this.returnTo); this.returnTo = null; } else if (G.playing) this.closeAll(); };
  }
  openSettings() {
    this.returnTo = ['#pauseMenu', '#mainMenu', '#spawnMenu'].find(id => !$(id).classList.contains('hidden')) || null;
    if (this.returnTo) this.hide(this.returnTo);
    for (const k in this.settingInputs) this.settingInputs[k]();
    this.show('#settingsPanel');
  }

  // ---------- pause ----------
  bindPause() {
    $('#btnResume').onclick = () => this.closeAll();
    $('#btnPauseSpawn').onclick = () => { this.hide('#pauseMenu'); this.toggleSpawnMenu(); };
    $('#btnPauseSettings').onclick = () => this.openSettings();
    $('#btnPauseSave').onclick = () => this.openSaves(false);
    $('#btnPauseMap').onclick = () => { this.hide('#pauseMenu'); this.show('#mapMenu'); };
    $('#btnPauseHelp').onclick = () => this.show('#helpPanel');
    $('#btnPauseMain').onclick = () => { this.closeAll(false); this.game.toMainMenu(); };
  }
  onLockChange(locked) {
    if (!locked && G.playing && !this.anyOpen()) this.show('#pauseMenu');
  }

  // ---------- panels ----------
  buildPanels() {
    // factions
    const tbl = $('#factionTable');
    const head = el('tr'); head.appendChild(el('th', '', 'How → feels about ↓'));
    for (const f of FACTIONS) head.appendChild(el('th', '', FACTION_NAMES[f]));
    tbl.appendChild(head);
    this.factionCells = [];
    for (const a of FACTIONS) {
      const tr = el('tr'); tr.appendChild(el('th', '', FACTION_NAMES[a]));
      for (const b of FACTIONS) {
        const td = el('td');
        if (a === 'player') { td.innerHTML = '<span class="muted">you</span>'; tr.appendChild(td); continue; }
        const btn = el('button', 'rel');
        const upd = () => { const v = relations[a][b]; btn.textContent = v; btn.className = 'rel ' + v; };
        btn.onclick = () => { const order = ['friendly', 'neutral', 'hostile']; setRelation(a, b, order[(order.indexOf(relations[a][b]) + 1) % 3]); upd(); this.clickSound(); };
        upd(); this.factionCells.push(upd);
        td.appendChild(btn); tr.appendChild(td);
      }
      tbl.appendChild(tr);
    }
    $('#btnFactionReset').onclick = () => { resetRelations(); this.factionCells.forEach(f => f()); };
    $('#btnFactionClose').onclick = () => this.closeAll();
    // time
    const ts = $('#timeSlider'), tv = $('#timeVal');
    const updT = () => { ts.value = settings.gameSpeed; tv.textContent = G.simPaused ? 'PAUSED' : `${(+settings.gameSpeed).toFixed(2)}×`; this.updateTimeIndicator(); };
    ts.oninput = () => { setSetting('gameSpeed', +ts.value); updT(); };
    document.querySelectorAll('[data-speed]').forEach(b => b.onclick = () => { G.simPaused = false; setSetting('gameSpeed', +b.dataset.speed); updT(); this.clickSound(); });
    $('#btnTimePause').onclick = () => { G.simPaused = !G.simPaused; updT(); this.clickSound(); };
    $('#btnTimeClose').onclick = () => this.closeAll();
    this.updTime = updT;
    // spawner
    const sel = $('#spawnerCreature');
    for (const c of CREATURES) { const o = el('option', '', c.name); o.value = c.id; sel.appendChild(o); }
    sel.value = spawnerConfig.creature;
    sel.onchange = () => spawnerConfig.creature = sel.value;
    const si = $('#spawnerInterval'), siv = $('#spawnerIntervalVal'), sm = $('#spawnerMax'), smv = $('#spawnerMaxVal');
    si.oninput = () => { spawnerConfig.interval = +si.value; siv.textContent = si.value + 's'; };
    sm.oninput = () => { spawnerConfig.max = +sm.value; smv.textContent = sm.value; };
    $('#btnSpawnerClose').onclick = () => this.closeAll();
    // health editor
    $('#btnHealthClose').onclick = () => this.closeAll();
    // saves
    $('#btnSaveNew').onclick = () => { const n = $('#saveName').value.trim() || `Save ${new Date().toLocaleString()}`; if (saveGame(n)) this.renderSaves(); };
    $('#btnSavesClose').onclick = () => { this.hide('#savePanel'); if (this.saveReturn) { this.show(this.saveReturn); this.saveReturn = null; } else this.closeAll(); };
  }
  openPanel(name) {
    this.closeAll(false);
    if (name === 'factions') { this.factionCells.forEach(f => f()); this.show('#factionPanel'); }
    if (name === 'time') { this.updTime(); this.show('#timePanel'); }
    if (name === 'spawner') { this.show('#spawnerPanel'); }
  }
  openHealthEditor(c) {
    this.closeAll(false);
    const p = $('#healthBody');
    p.innerHTML = '';
    p.appendChild(el('div', 'hName', `${c.name} <small>${c.alive ? (c.ragdoll ? 'knocked down' : c.state || '') : 'dead'}</small>`));
    const mk = (label, val, max, on) => {
      const row = el('div', 'setRow'); const inp = el('input'); inp.type = 'range'; inp.min = 1; inp.max = max; inp.step = 1; inp.value = val;
      const v = el('span', 'val', Math.round(val)); inp.oninput = () => { v.textContent = inp.value; on(+inp.value); };
      const s = el('div', 'slider'); s.append(inp, v); row.append(el('div', 'setLabel', label), s); p.appendChild(row); return inp;
    };
    const hInp = mk('Health', Math.max(1, c.health), Math.max(c.maxHealth, 2000), (v) => { c.health = v; });
    mk('Max Health', c.maxHealth, 5000, (v) => { c.maxHealth = v; hInp.max = Math.max(v, 2000); if (c.health > v) c.health = v; });
    const row = el('div', 'btnRow');
    const heal = el('button', 'btn', 'Full Heal'); heal.onclick = () => { if (c.alive) { c.health = c.maxHealth; hInp.value = c.health; } };
    const inv = el('button', 'btn', c.invincible ? 'Invincible: ON' : 'Invincible: OFF'); inv.onclick = () => { c.invincible = !c.invincible; inv.textContent = c.invincible ? 'Invincible: ON' : 'Invincible: OFF'; };
    const kill = el('button', 'btn danger', 'Kill'); kill.onclick = () => { if (c.alive) c.die({ attacker: G.player }); this.closeAll(); };
    row.append(heal, inv, kill); p.appendChild(row);
    this.show('#healthPanel');
  }
  openSaves(fromMain) {
    this.saveReturn = ['#pauseMenu', '#mainMenu', '#spawnMenu'].find(id => !$(id).classList.contains('hidden')) || null;
    if (this.saveReturn) this.hide(this.saveReturn);
    $('#saveNewRow').classList.toggle('hidden', !!fromMain || !G.playing);
    this.renderSaves();
    this.show('#savePanel');
  }
  renderSaves() {
    const list = $('#saveList'); list.innerHTML = '';
    const saves = listSaves();
    const names = Object.keys(saves).sort((a, b) => saves[b].time - saves[a].time);
    if (!names.length) list.appendChild(el('div', 'muted', 'No saves yet. Spawn some things, then save them here.'));
    for (const n of names) {
      const s = saves[n];
      const row = el('div', 'saveRow');
      const mapName = (MAPS.find(m => m.id === s.map) || {}).name || s.map;
      row.appendChild(el('div', 'saveInfo', `<b>${escapeHtml(n)}</b><small>${mapName} · ${s.creatures.length} creatures · ${s.props.length} props · ${new Date(s.time).toLocaleString()}</small>`));
      const ld = el('button', 'btn', 'Load'); ld.onclick = () => { this.closeAll(false); this.saveReturn = null; loadGame(n, (id, o) => this.game.startMap(id, o)); };
      const del = el('button', 'btn danger', 'Delete'); del.onclick = () => { deleteSave(n); this.renderSaves(); };
      row.append(ld, del); list.appendChild(row);
    }
  }

  // ---------- HUD ----------
  updateHud() {
    const pl = G.player; if (!pl) return;
    $('#hpFill').style.width = Math.max(0, pl.health / pl.maxHealth * 100) + '%';
    $('#hpNum').textContent = Math.max(0, Math.ceil(pl.health));
    $('#hpBox').classList.toggle('god', settings.playerInvincible);
    const def = W.def || WEAPON_BY_ID[W.current];
    $('#wName').textContent = def ? def.name : '';
    const a = W.ammo[W.current];
    $('#ammo').innerHTML = a ? `<b>${a.clip}</b><span>/ ${settings.infiniteAmmo ? '∞' : a.reserve}</span>` : '';
    const inv = $('#invBar');
    const owned = W.owned.map(id => WEAPON_BY_ID[id]).sort((a, b) => a.slot - b.slot);
    inv.innerHTML = owned.map(w => `<div class="slot${w.id === W.current ? ' on' : ''}"><b>${w.slot}</b><span>${w.name}</span></div>`).join('');
    $('#toolName').textContent = W.current === 'toolgun' && G.tool ? `Tool: ${G.tool.name}` : '';
    $('#spawnSel').innerHTML = G.spawnSelection ? `Placing: <b>${G.spawnSelection.name}</b> · LMB place · RMB stop` : '';
  }
  updateTimeIndicator() {
    const t = $('#timeInd');
    if (G.simPaused) t.textContent = '⏸ PAUSED (P)';
    else if (settings.gameSpeed !== 1) t.textContent = `⏱ ${(+settings.gameSpeed).toFixed(2)}×`;
    else t.textContent = '';
  }
  frame(dt) {
    const pl = G.player; if (!pl) return;
    $('#vignette').style.opacity = Math.min(0.85, pl.damageFlash);
    $('#scope').classList.toggle('hidden', !G.scoped);
    $('#crosshair').classList.toggle('hidden', !!G.scoped || !!pl.inVehicle || !!pl.freeCam);
    this._statT = (this._statT || 0) - dt;
    if (this._statT <= 0) {
      this._statT = 0.5;
      const alive = G.creatures.filter(c => c.alive).length;
      $('#stats').textContent = `${Math.round(this.fps || 0)} FPS · ${alive}/${settings.populationLimit} NPCs · ${G.creatures.length - alive} bodies · ${G.props.length} props`;
      let hint = '';
      if (G.interact.hold && G.interact.hold.mode === 'pickup') hint = 'LMB throw · E / G drop';
      else if (G.interact.hold && G.interact.hold.mode === 'physgun') hint = 'Scroll: distance · Hold R: rotate · RMB: freeze';
      else if (G.interact.hold) hint = 'LMB launch · RMB drop';
      else if (pl.possessing) hint = `Possessing ${pl.possessing.name} · F to leave`;
      else if (pl.inVehicle) hint = `${Math.round(pl.inVehicle.speed() * 3.6)} km/h · F exit · Space brake`;
      else if (pl.noclip) hint = 'Noclip · V to land';
      $('#holdHint').textContent = hint;
      this.updateTimeIndicator();
    }
  }
  showDeath(by) { $('#deathScreen').classList.remove('hidden'); $('#deathBy').textContent = by ? `Killed by ${by}` : 'You died'; }
  hideDeath() { $('#deathScreen').classList.add('hidden'); }
  onCreatureDied() {}
  setLoading(on, text) { $('#loading').classList.toggle('hidden', !on); if (text) $('#loadingText').textContent = text; }
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export { THREE };
