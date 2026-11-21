// Boot, map loading, main loop and input bindings.
import * as THREE from 'three';
import { G } from './state.js';
import { settings, setSetting } from './config.js';
import { initPhysics, createWorld, stepPhysics, raycast } from './physics.js';
import { initRenderer, render, updateEnvironment } from './render.js';
import { initEffects, updateEffects, clearDecals } from './effects.js';
import { initAudio, updateListener, stopSpeech } from './audio.js';
import { initInput, on, keys, mouse, lock, isLocked } from './input.js';
import { Player } from './player.js';
import { buildMap } from './maps.js';
import { initWeapons, updateWeapons, weaponInput, cycleWeapon, selectSlot, startReload, weaponState as W, clearProjectiles, giveWeapon, equip } from './weapons.js';
import { holdStep, updateInteract, updateSpawners } from './interact.js';
import { initImpactDamage } from './combat.js';
import { spawnItem, spawnCreatureById, undo, CATALOG } from './spawn.js';
import { UI } from './ui.js';

G.THREE = THREE;
let ui, player, marker;
let last = performance.now();
let fpsAcc = 0, fpsN = 0;

const game = {
  async startMap(id, opts = {}) {
    ui.setLoading(true, `Building ${id}…`);
    await new Promise(r => setTimeout(r, 30));
    unloadWorld();
    createWorld();
    G.mapId = id;
    G.map = buildMap(id);
    player.ctrl = null;
    player.spawn(G.map.spawnPoint.pos, G.map.spawnPoint.yaw);
    if (!opts.skipInitial && G.map.spawnInitial) G.map.spawnInitial();
    G.undoStack.length = 0;
    G.time = 0;
    G.playing = true;
    G.simPaused = false;
    ui.setLoading(false);
    ui.closeAll(false);
    ui.hideDeath();
    ui.updateHud();
    document.body.classList.add('playing');
    lock();
    ui.toast('Press Q for the spawn menu · ESC to pause · H for help', 4);
  },
  toMainMenu() {
    G.playing = false;
    document.body.classList.remove('playing');
    ui.show('#mainMenu');
  },
};

function unloadWorld() {
  if (G.interact) G.interact.hold = null;
  if (player.inVehicle) { player.inVehicle.driver = null; player.inVehicle = null; }
  if (player.possessing) { player.possessing.controlled = false; player.possessing = null; }
  player.freeCam = null;
  for (const c of [...G.creatures]) c.remove();
  for (const p of [...G.props]) p.remove();
  for (const v of [...G.vehicles]) v.remove();
  for (const s of [...G.spawners]) s.remove();
  G.welds.length = 0; G.noises.length = 0;
  G.spawnSelection = null;
  clearDecals(); clearProjectiles(); stopSpeech();
  if (G.map && G.map.group) {
    G.scene.remove(G.map.group);
    G.map.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  if (player.body) player.body = null;
  if (player.ctrl && G.world) { try { G.world.removeCharacterController(player.ctrl); } catch (e) {} player.ctrl = null; }
}

async function boot() {
  const container = document.getElementById('game');
  initRenderer(container);
  await initPhysics();
  createWorld();
  initEffects();
  initImpactDamage();
  player = new Player(); G.player = player;
  initWeapons();
  ui = new UI(game);
  initInput(G.renderer.domElement);
  bindInput();
  marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthTest: false }));
  marker.renderOrder = 5; marker.visible = false; G.scene.add(marker);
  // Menu background: build the superflat behind the main menu
  G.map = buildMap('superflat');
  G.camera.position.set(0, 3, 12);
  document.getElementById('bootStatus').textContent = '';
  document.body.classList.add('ready');
  requestAnimationFrame(loop);
  window.SB = { G, game, spawn: (id, x, z, opts) => spawnCreatureById(id, new THREE.Vector3(x, G.map.groundAt(x, z) + 0.05, z), opts || {}), CATALOG, spawnItem, settings, setSetting, player: () => player, W, weaponInput, giveWeapon, equip, ui: () => ui };
}

function bindInput() {
  on('move', (dx, dy) => {
    if (!G.playing) return;
    if (keys.KeyR && G.interact.hold && G.interact.rotateHeld(dx, dy)) return;
    player.look(dx, dy);
  });
  on('mousedown', (e) => {
    initAudio();
    if (!G.playing) return;
    if (!isLocked()) { if (!ui.anyOpen()) lock(); return; }
    if (e.button === 0) {
      if (G.spawnSelection && !G.interact.hold && !player.inVehicle && !player.possessing) { placeSelection(); return; }
      weaponInput('fire', true);
    } else if (e.button === 2) {
      if (G.spawnSelection) { G.spawnSelection = null; ui.updateHud(); ui.toast('Stopped placing'); return; }
      weaponInput('alt', true);
    }
  });
  on('mouseup', (e) => { if (e.button === 0) weaponInput('fire', false); if (e.button === 2) weaponInput('alt', false); });
  on('wheel', (e) => { if (!G.playing) return; if (G.interact.wheel(e.deltaY)) return; cycleWeapon(e.deltaY > 0 ? 1 : -1); });
  on('lockchange', (locked) => ui.onLockChange(locked));
  on('keydown', (e, first) => {
    if (!G.playing) return;
    if (e.code === 'KeyQ' && first) { ui.toggleSpawnMenu(); return; }
    if (e.code === 'Escape') { if (ui.anyOpen()) ui.closeAll(); return; }
    if (e.code === 'KeyH' && first) { if (ui.anyOpen()) return; ui.show('#helpPanel'); return; }
    if (ui.anyOpen() || !isLocked()) return;
    if (!first) return;
    switch (e.code) {
      case 'KeyE': G.interact.pickup(); break;
      case 'KeyG': G.interact.drop(); break;
      case 'KeyF': G.interact.use(); break;
      case 'KeyR': if (W.current === 'physgun') { if (!G.interact.hold) G.interact.unfreezeAimed(); } else startReload(); break;
      case 'KeyV': player.toggleNoclip(); break;
      case 'KeyC': player.toggleFreeCam(); break;
      case 'KeyZ': undo(); break;
      case 'KeyP': G.simPaused = !G.simPaused; ui.toast(G.simPaused ? 'Simulation paused' : 'Simulation resumed'); break;
      case 'KeyT': setSetting('gameSpeed', settings.gameSpeed === 1 ? 0.25 : 1); G.simPaused = false; ui.toast(settings.gameSpeed === 1 ? 'Normal speed' : 'Slow motion'); break;
      case 'Tab': ui.openPanel('time'); break;
      default:
        if (/^Digit[1-7]$/.test(e.code)) selectSlot(+e.code.slice(5));
    }
  });
}

function aimHit(range = 400) {
  const origin = G.camera.getWorldPosition(new THREE.Vector3());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(G.camera.getWorldQuaternion(new THREE.Quaternion()));
  return raycast(origin, dir, range, { excludeBody: player.body, filter: (c, o) => !(o && o.type === 'player') });
}

function placeSelection() {
  const hit = aimHit();
  if (!hit) { ui.toast('Aim at the ground or an object'); return; }
  const yaw = G.spawnSelection.type === 'vehicle' ? player.yaw + Math.PI / 2 : player.yaw;
  spawnItem(G.spawnSelection, hit.point, hit.normal, yaw);
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.realTime += dt;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { ui.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (G.playing) {
    const menuPause = ui.anyOpen() && document.querySelector('#spawnMenu').classList.contains('hidden');
    const simDt = G.simPaused || menuPause ? 0 : dt * settings.gameSpeed;
    const steps = stepPhysics(simDt, (fdt) => {
      holdStep(fdt);
      for (const v of G.vehicles) v.update(fdt);
    });
    G.time += simDt;
    if (simDt > 0) {
      G.map.update(simDt);
      for (let i = G.creatures.length - 1; i >= 0; i--) { const c = G.creatures[i]; if (c) c.update(simDt); }
      for (let i = G.props.length - 1; i >= 0; i--) { const p = G.props[i]; if (p) p.update(simDt); }
      updateSpawners(simDt, spawnCreatureById);
      G.noises = G.noises.filter(n => G.time - n.time < 3);
    }
    if (!menuPause) player.update(dt, steps > 0);
    updateWeapons(dt);
    updateInteract(dt);
    updateEffects(simDt > 0 ? simDt : 0);
    // spawn placement marker
    if (G.spawnSelection && isLocked()) {
      const h = aimHit();
      marker.visible = !!h;
      if (h) { marker.position.copy(h.point).addScaledVector(h.normal, 0.03); marker.lookAt(h.point.clone().add(h.normal)); }
    } else marker.visible = false;
    ui.frame(dt);
  } else {
    // slow orbit behind the main menu
    const t = G.realTime * 0.05;
    G.camera.position.set(Math.sin(t) * 14, 4, Math.cos(t) * 14);
    G.camera.lookAt(0, 1, 0);
    G.showViewmodel = false;
  }
  updateEnvironment();
  updateListener(G.camera);
  render();
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('bootStatus');
  if (s) s.textContent = 'Failed to start: ' + e.message + '. This game needs WebGL and a modern browser.';
});
