// Canvas renderer: stage, fighters, projectiles, particles, HUD, cinematics.
import { Sim, Fighter, Projectile, VIEW_W, VIEW_H, METER_MAX, findEffect, SimEvent } from './sim';
import type { CharacterDef, FrameRef, StageDef, Settings } from './types';
import { getImage, getTinted } from './assets';
import { Particles, pixelCircle } from './particles';
import { clamp, rgba, shade } from './util';

export const FONT = '"Press Start 2P", monospace';
const HC = 80; // zoom anchor height

interface Ghost { x: number; y: number; ref: FrameRef | null; facing: number; t: number; color: string; anim: string }

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', outline = '#000', font = FONT, outlineW = 0) {
  g.font = `${size}px ${font}`;
  g.textAlign = align; g.textBaseline = 'top';
  const o = outlineW || Math.max(1, Math.round(size / 8));
  g.fillStyle = outline;
  for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [o, -o], [-o, o]]) g.fillText(s, Math.round(x + dx), Math.round(y + dy));
  g.fillStyle = color;
  g.fillText(s, Math.round(x), Math.round(y));
}

export function wrapText(g: CanvasRenderingContext2D, s: string, maxW: number, size: number, font = FONT): string[] {
  g.font = `${size}px ${font}`;
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Draw one sprite frame of a character with origin at (sx, sy). */
export function drawCharFrame(g: CanvasRenderingContext2D, def: CharacterDef, ref: FrameRef | null, sx: number, sy: number, facing: number, zoom: number, opts: { tint?: string; alpha?: number; outline?: string } = {}) {
  if (!ref) return false;
  const sheet = def.sheets.find(s => s.id === ref.sheet);
  const fr = sheet?.frames[ref.index];
  if (!sheet || !fr) return false;
  const img = getImage(sheet.image);
  if (!img) return true; // loading
  const sc = def.scale * zoom;
  let flip = facing < 0;
  if (def.facesLeft) flip = !flip;
  if (fr.flipX) flip = !flip;
  g.save();
  g.translate(Math.round(sx), Math.round(sy));
  if (flip) g.scale(-1, 1);
  const dx = (-fr.ox + (fr.dx || 0)) * sc, dy = (-fr.oy + (fr.dy || 0)) * sc;
  g.globalAlpha *= opts.alpha ?? 1;
  if (opts.outline) {
    const t = getTinted(img, fr.x, fr.y, fr.w, fr.h, opts.outline);
    const o = Math.max(1, Math.round(zoom * 1.5));
    for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) g.drawImage(t, dx + ox, dy + oy, fr.w * sc, fr.h * sc);
  }
  if (opts.tint) g.drawImage(getTinted(img, fr.x, fr.y, fr.w, fr.h, opts.tint), dx, dy, fr.w * sc, fr.h * sc);
  else g.drawImage(img, fr.x, fr.y, fr.w, fr.h, dx, dy, fr.w * sc, fr.h * sc);
  g.restore();
  return true;
}

/** Placeholder figure for characters without sprite art. */
export function drawPlaceholder(g: CanvasRenderingContext2D, def: CharacterDef, anim: string, sx: number, sy: number, facing: number, zoom: number, tint?: string, alpha = 1) {
  const h = def.stats.height * zoom, w = def.stats.width * zoom;
  const crouch = /crouch|land|jumpSquat|getup/.test(anim), down = /knockdown|ko/.test(anim), atk = anim.startsWith('atk') || anim === 'attack';
  const base = g.globalAlpha;
  g.globalAlpha = base * alpha;
  const c = tint || def.color, d = tint || shade(def.color, -0.35);
  if (down) { g.fillStyle = d; g.fillRect(sx - h / 2, sy - w * 0.6, h, w * 0.6); g.globalAlpha = base; return; }
  const hh = crouch ? h * 0.66 : h;
  g.save();
  g.fillStyle = '#000'; g.fillRect(sx - w / 2 - 1, sy - hh - 1, w + 2, hh + 2);
  g.fillStyle = d; g.fillRect(sx - w / 2, sy - hh * 0.45, w, hh * 0.45);
  g.fillStyle = c; g.fillRect(sx - w / 2, sy - hh * 0.8, w, hh * 0.4);
  g.fillStyle = tint || '#f0c08a'; g.fillRect(sx - w * 0.35, sy - hh, w * 0.7, hh * 0.22);
  g.fillStyle = '#000'; g.fillRect(sx + facing * w * 0.15 - 1, sy - hh * 0.92, 2 * zoom, 2 * zoom);
  if (atk) { g.fillStyle = c; g.fillRect(facing > 0 ? sx + w / 2 : sx - w / 2 - w * 0.9, sy - hh * 0.7, w * 0.9, hh * 0.1); }
  g.restore();
  g.globalAlpha = base;
}

export class Renderer {
  g: CanvasRenderingContext2D;
  particles = new Particles();
  weather: { x: number; y: number; vx: number; vy: number; s: number; ph: number }[] = [];
  ghosts: [Ghost[], Ghost[]] = [[], []];
  shake = 0; shakeX = 0; shakeY = 0;
  flash: { color: string; t: number; dur: number } | null = null;
  hpShown = [1, 1]; hpRed = [1, 1]; redHold = [0, 0];
  meterShown = [0, 0];
  frame = 0;
  roundText: { text: string; t: number; color: string; big?: boolean } | null = null;
  settings: Settings;
  stormFlash = 0;
  koText = 0;
  constructor(public canvas: HTMLCanvasElement, settings: Settings) {
    this.g = canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.settings = settings;
    this.particles.intensity = settings.particles;
  }

  // ------------------------------------------------------------------------
  handle(sim: Sim, e: SimEvent) {
    const s = this.settings;
    switch (e.type) {
      case 'fx': {
        const def = findEffect(sim.f[e.owner]?.def ?? null, e.effect);
        if (def) { this.particles.spawn(def, e.x, e.y, e.facing, e.scale ?? 1); if (def.shake) this.addShake(def.shake); }
        break;
      }
      case 'shake': this.addShake(e.amount); break;
      case 'flash': this.flash = { color: e.color, t: 0, dur: e.dur }; break;
      case 'dust': {
        const fx = sim.f[e.owner].def.effects;
        if (e.kind === 'jump' && fx.jumpDust.enabled) this.particles.puff(e.x, e.y, fx.jumpDust.color, fx.jumpDust.size, Math.round(5 * fx.jumpDust.intensity * s.particles), fx.jumpDust.style, 1.2, 0.4);
        if (e.kind === 'land' && fx.landDust.enabled) this.particles.puff(e.x, e.y, fx.landDust.color, fx.landDust.size, Math.round(6 * fx.landDust.intensity * s.particles), fx.landDust.style, 1.8, 0.3);
        if (e.kind === 'hardLand' && fx.landDust.enabled) {
          const n = fx.landDust.hardLanding ? 2.2 : 1;
          this.particles.puff(e.x, e.y, fx.landDust.color, fx.landDust.size * (fx.landDust.hardLanding ? 1.5 : 1), Math.round(8 * n * fx.landDust.intensity * s.particles), fx.landDust.style, 3, 0.8);
          if (fx.landDust.hardLanding) this.particles.spawn({ id: 'x', name: '', kind: 'shockwave', color: fx.landDust.color, color2: '#ffffff', count: 1, size: 18, speed: 0, life: 14, gravity: 0, spread: 0, direction: 0, shake: 0, glow: false }, e.x, e.y + 2, 1);
        }
        if (e.kind === 'dash') this.particles.puff(e.x - e.facing * 10, e.y, fx.jumpDust.color, fx.jumpDust.size * 0.8, Math.round(2 * s.particles), 'dust', 0.8, 0.3);
        if (e.kind === 'run' && fx.runStreaks.enabled) {
          this.particles.puff(e.x - e.facing * 8, 0, fx.landDust.color, 2, 1, 'dust', 0.6, 0.2);
          this.particles.spawn({ id: 'x', name: '', kind: 'streak', color: fx.runStreaks.color, color2: fx.runStreaks.color, count: 2, size: 1, speed: 5, life: 8, gravity: 0, spread: 10, direction: 180, shake: 0, glow: false }, e.x, 40 + Math.random() * 60, e.facing);
        }
        break;
      }
      case 'roundStart': this.roundText = { text: `ROUND ${e.round}`, t: 0, color: '#ffffff' }; break;
      case 'ko': this.koText = 1; this.roundText = { text: e.timeOver ? 'TIME OVER' : e.loser < 0 ? 'DOUBLE K.O.' : 'K.O.', t: 0, color: '#ff3030', big: true }; break;
      case 'roundOver': {
        const w = e.winner;
        this.roundText = { text: w < 0 ? 'DRAW' : `${sim.f[w].def.name.toUpperCase()} WINS`, t: 0, color: '#fff36b' };
        break;
      }
      case 'hit': if (e.heavy) this.addShake(1.5); break;
    }
  }
  addShake(a: number) { this.shake = Math.max(this.shake, a * this.settings.shake); }

  // ------------------------------------------------------------------------
  zoomX(sim: Sim, x: number, z = sim.cam.zoom) { return (x - sim.cam.x) * z + VIEW_W / 2 + this.shakeX; }
  zoomY(sim: Sim, y: number, z = sim.cam.zoom) { return (sim.stage.floorY - HC) - (y - HC - sim.cam.y) * z + this.shakeY; }

  draw(sim: Sim, opts: { showHitboxes?: boolean; hud?: boolean; training?: any; paused?: boolean } = {}) {
    const g = this.g;
    this.frame++;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    if (this.shake > 0.2) {
      this.shakeX = Math.round((Math.random() - 0.5) * this.shake * 2);
      this.shakeY = Math.round((Math.random() - 0.5) * this.shake * 1.5);
      this.shake *= 0.86;
    } else { this.shake = 0; this.shakeX = this.shakeY = 0; }
    const frozen = sim.hitstop > 0 || (sim.freeze > 0);
    if (!frozen || this.frame % 3 === 0) this.particles.update();

    this.drawStage(sim, false);
    // background overlay from cinematic
    if (sim.bgOverlay) this.drawBgOverlay(sim);
    this.drawWeather(sim, true);
    // reflections
    if (sim.stage.reflection) {
      g.save();
      g.globalAlpha = 0.18;
      const fy = this.zoomY(sim, 0);
      g.beginPath(); g.rect(0, fy, VIEW_W, VIEW_H - fy); g.clip();
      g.translate(0, fy * 2); g.scale(1, -1);
      for (const f of this.order(sim)) this.drawFighter(sim, f, true);
      g.restore();
    }
    // shadows
    for (const f of sim.f) {
      const sx = this.zoomX(sim, f.x), sy = this.zoomY(sim, 0);
      const w = f.def.stats.width * sim.cam.zoom * clamp(1 - f.y / 400, 0.4, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(Math.round(sx - w * 0.7), Math.round(sy - 2), Math.round(w * 1.4), 4);
      g.fillRect(Math.round(sx - w * 0.5), Math.round(sy - 3), Math.round(w), 6);
    }
    // ghosts / afterimages
    for (const f of sim.f) this.recordGhost(sim, f);
    for (const f of sim.f) this.drawGhosts(sim, f);
    // aura
    for (const f of this.order(sim)) this.drawFighter(sim, f, false);
    for (const p of sim.projectiles) this.drawProjectile(sim, p);
    this.particles.draw(g, x => this.zoomX(sim, x), y => this.zoomY(sim, y), sim.cam.zoom);
    this.drawStage(sim, true);
    this.drawWeather(sim, false);
    if (opts.showHitboxes || sim.showHitboxes) this.drawBoxes(sim);
    this.drawBubbles(sim);
    // alert darkening + cinematic
    if (sim.alert) this.drawAlert(sim);
    if (this.flash) {
      const k = 1 - this.flash.t / this.flash.dur;
      g.fillStyle = rgba(this.flash.color, k * 0.8);
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      this.flash.t++; if (this.flash.t >= this.flash.dur) this.flash = null;
    }
    if (opts.hud !== false) this.drawHUD(sim, opts.training);
    if (this.settings.scanlines) {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < VIEW_H; y += 2) g.fillRect(0, y, VIEW_W, 1);
    }
    if (opts.paused) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 0, VIEW_W, VIEW_H); }
  }

  order(sim: Sim): Fighter[] {
    const [a, b] = sim.f;
    // attacker drawn in front
    const front = (f: Fighter) => (f.state === 'attack' || f.state === 'cine' ? 2 : 0) + (f.state === 'grabbed' || f.state === 'locked' ? -1 : 0);
    return front(a) > front(b) ? [b, a] : [a, b];
  }

  // ------------------------------------------------------------------------
  drawStage(sim: Sim, foreground: boolean) {
    const g = this.g, st = sim.stage;
    const time = this.frame / 60;
    if (!foreground) {
      const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
      grd.addColorStop(0, st.skyTop); grd.addColorStop(1, st.skyBottom);
      g.fillStyle = grd; g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    for (const L of st.layers) {
      if (!!L.foreground !== foreground || !L.image) continue;
      const img = getImage(L.image);
      if (!img) continue;
      const frames = Math.max(1, L.frames);
      const fw = img.naturalWidth / frames, fh = img.naturalHeight;
      const fi = frames > 1 ? Math.floor(time * L.fps) % frames : 0;
      const z = 1 + (sim.cam.zoom - 1) * clamp(L.parallax, 0, 1);
      const w = fw * L.scale * z, h = fh * L.scale * z;
      const camLeft = sim.cam.x - VIEW_W / 2;
      const scroll = (time * L.scrollSpeed) % Math.max(1, fw * L.scale);
      const wx = L.x + camLeft * (1 - L.parallax) + scroll;
      const sx = this.zoomX(sim, wx, z);
      const sy = this.zoomY(sim, st.floorY - L.y, z);
      g.globalAlpha = L.opacity;
      if (L.repeatX) {
        let x0 = sx % w; if (x0 > 0) x0 -= w;
        for (let x = x0; x < VIEW_W; x += w) g.drawImage(img, fi * fw, 0, fw, fh, Math.round(x), Math.round(sy), Math.ceil(w) + 1, Math.ceil(h));
      } else g.drawImage(img, fi * fw, 0, fw, fh, Math.round(sx), Math.round(sy), Math.ceil(w), Math.ceil(h));
      g.globalAlpha = 1;
    }
    if (!foreground) {
      // floor fill beneath the floor line
      const fy = this.zoomY(sim, 0);
      const hasFloor = st.layers.some(l => !l.foreground && l.image && Math.abs(l.y - st.floorY) < 4);
      if (!hasFloor) { g.fillStyle = st.floorColor; g.fillRect(0, Math.round(fy), VIEW_W, VIEW_H); g.fillStyle = shade(st.floorColor, 0.2); g.fillRect(0, Math.round(fy), VIEW_W, 2); }
      else {
        // extend below the floor image
        const bottom = this.zoomY(sim, -30 * 2);
        g.fillStyle = st.floorColor; if (bottom < VIEW_H) g.fillRect(0, Math.round(bottom), VIEW_W, VIEW_H);
      }
    }
  }

  drawBgOverlay(sim: Sim) {
    const g = this.g, o = sim.bgOverlay!;
    const left = o.until - sim.tick;
    const a = clamp(left / 10, 0, 1);
    g.fillStyle = rgba('#000000', o.darken * a); g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 0.75 * a;
    if (o.style === 'solid') { g.fillStyle = o.color; g.fillRect(0, 0, VIEW_W, VIEW_H); }
    else if (o.style === 'streaks') {
      g.fillStyle = shade(o.color, -0.5); g.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 40; i++) {
        const y = (i * 37 + (i % 3) * 11) % VIEW_H;
        const len = 80 + (i * 53) % 200;
        const x = ((this.frame * (12 + (i % 5) * 4) + i * 97) % (VIEW_W + len * 2)) - len;
        g.fillStyle = i % 3 ? o.color : shade(o.color, 0.4);
        g.fillRect(x, y, len, 1 + (i % 3));
      }
    } else {
      const grd = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 10, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.7);
      grd.addColorStop(0, shade(o.color, 0.4)); grd.addColorStop(1, shade(o.color, -0.6));
      g.fillStyle = grd; g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.strokeStyle = rgba('#ffffff', 0.25);
      for (let i = 0; i < 24; i++) {
        const a2 = (i / 24) * Math.PI * 2 + this.frame * 0.01;
        g.beginPath(); g.moveTo(VIEW_W / 2, VIEW_H / 2); g.lineTo(VIEW_W / 2 + Math.cos(a2) * 700, VIEW_H / 2 + Math.sin(a2) * 700); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  drawWeather(sim: Sim, behind: boolean) {
    const st = sim.stage, g = this.g;
    const kinds = [st.weather, st.ambient];
    for (const kind of kinds) {
      if (!kind || kind === 'none') continue;
      const isAmbient = kind === st.ambient && kind !== st.weather;
      if (behind !== isAmbient) continue;
      const key = '_w_' + kind;
      let list = (this as any)[key] as typeof this.weather;
      const dens = isAmbient ? 0.5 : st.weatherDensity;
      const n = Math.round((kind === 'rain' || kind === 'storm' ? 120 : kind === 'fireflies' ? 25 : 60) * dens * this.settings.particles);
      if (!list || list.length !== n) {
        list = []; for (let i = 0; i < n; i++) list.push({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, vx: 0, vy: 0, s: Math.random(), ph: Math.random() * 6.28 });
        (this as any)[key] = list;
      }
      const camDX = ((this as any)._lastCam ?? sim.cam.x) - sim.cam.x;
      for (const p of list) {
        p.ph += 0.05;
        switch (kind) {
          case 'rain': case 'storm': p.x += -2 + camDX; p.y += 9 + p.s * 4; g.fillStyle = 'rgba(180,200,255,0.55)'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 6 + p.s * 4); break;
          case 'snow': p.x += Math.sin(p.ph) * 0.5 + camDX * 0.6; p.y += 0.6 + p.s; g.fillStyle = '#ffffff'; g.fillRect(Math.round(p.x), Math.round(p.y), p.s > 0.6 ? 2 : 1, p.s > 0.6 ? 2 : 1); break;
          case 'leaves': case 'sakura': p.x += Math.sin(p.ph) * 1.2 - 0.6 + camDX * 0.8; p.y += 0.7 + p.s * 0.6; g.fillStyle = kind === 'sakura' ? (p.s > 0.5 ? '#ffb6d9' : '#ff8ac0') : (p.s > 0.5 ? '#d8a030' : '#a05a20'); g.fillRect(Math.round(p.x), Math.round(p.y), 3, Math.sin(p.ph) > 0 ? 2 : 1); break;
          case 'embers': p.x += Math.sin(p.ph) * 0.6 + camDX * 0.7; p.y -= 0.6 + p.s; g.fillStyle = p.s > 0.5 ? '#ffb030' : '#ff5a10'; g.globalAlpha = 0.5 + 0.5 * Math.sin(p.ph * 2); g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); g.globalAlpha = 1; break;
          case 'ash': p.x += Math.sin(p.ph) * 0.4 + camDX * 0.7; p.y += 0.4 + p.s * 0.4; g.fillStyle = '#9a9a9a'; g.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); break;
          case 'fireflies': p.x += Math.sin(p.ph * 0.7) * 0.6 + camDX * 0.5; p.y += Math.cos(p.ph * 0.5) * 0.4; g.fillStyle = '#d8ff6a'; g.globalAlpha = Math.max(0, Math.sin(p.ph)); g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); g.globalAlpha = 1; break;
          case 'dust': p.x += 0.2 + camDX * 0.5; p.y += Math.sin(p.ph) * 0.2; g.fillStyle = 'rgba(255,240,200,0.35)'; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); break;
          case 'bubbles': p.y -= 0.5 + p.s * 0.5; p.x += Math.sin(p.ph) * 0.4 + camDX * 0.5; g.strokeStyle = 'rgba(200,240,255,0.5)'; g.strokeRect(Math.round(p.x), Math.round(p.y), 3, 3); break;
          case 'sparkles': p.y -= 0.2; p.x += camDX * 0.5; g.fillStyle = '#fff6c0'; g.globalAlpha = Math.max(0, Math.sin(p.ph * 1.5)); g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); g.globalAlpha = 1; break;
        }
        if (p.y > VIEW_H + 8) { p.y = -8; p.x = Math.random() * VIEW_W; }
        if (p.y < -10) { p.y = VIEW_H + 4; p.x = Math.random() * VIEW_W; }
        if (p.x < -10) p.x += VIEW_W + 20; if (p.x > VIEW_W + 10) p.x -= VIEW_W + 20;
      }
      if (kind === 'storm') {
        if (Math.random() < 0.004) this.stormFlash = 8;
        if (this.stormFlash > 0) { g.fillStyle = `rgba(220,230,255,${this.stormFlash / 16})`; g.fillRect(0, 0, VIEW_W, VIEW_H); this.stormFlash--; }
      }
    }
    if (!behind) (this as any)._lastCam = sim.cam.x;
  }

  // ------------------------------------------------------------------------
  recordGhost(sim: Sim, f: Fighter) {
    const gd = f.def.effects.ghostDash;
    const list = this.ghosts[f.idx];
    const on = f.afterimage && (gd.enabled || f.atk?.afterimage || f.state === 'cine');
    if (on && sim.tick % Math.max(1, gd.spacing) === 0 && (list.length === 0 || list[list.length - 1].t !== sim.tick)) {
      list.push({ x: f.x, y: f.y, ref: sim.frameOf(f).ref, facing: f.facing, t: sim.tick, color: gd.color, anim: f.anim });
      while (list.length > Math.max(1, gd.count)) list.shift();
    }
    const fade = Math.max(4, gd.fade);
    while (list.length && sim.tick - list[0].t > fade) list.shift();
  }
  drawGhosts(sim: Sim, f: Fighter) {
    const gd = f.def.effects.ghostDash;
    for (const gh of this.ghosts[f.idx]) {
      const age = sim.tick - gh.t;
      const a = gd.alpha * (1 - age / Math.max(4, gd.fade));
      if (a <= 0) continue;
      const sx = this.zoomX(sim, gh.x), sy = this.zoomY(sim, gh.y);
      this.g.globalCompositeOperation = 'lighter';
      if (!drawCharFrame(this.g, f.def, gh.ref, sx, sy, gh.facing, sim.cam.zoom, { tint: gh.color, alpha: a }))
        drawPlaceholder(this.g, f.def, gh.anim, sx, sy, gh.facing, sim.cam.zoom, gh.color, a);
      this.g.globalCompositeOperation = 'source-over';
    }
  }

  drawFighter(sim: Sim, f: Fighter, reflection: boolean) {
    const g = this.g;
    const { ref } = sim.frameOf(f);
    const sx = this.zoomX(sim, f.x), sy = this.zoomY(sim, f.y);
    const z = sim.cam.zoom;
    let outline = f.glow || '';
    const aura = f.def.effects.aura;
    if (!outline && aura.enabled && (!aura.whenMeterFull || f.meter >= 100) && !reflection && (this.frame >> 3) % 2 === 0 && sim.phase === 'fight') outline = rgba(aura.color, 0.55);
    if (f.glow && !reflection) outline = (this.frame >> 1) % 2 ? f.glow : rgba(f.glow, 0.6);
    const flashing = f.hitFlash > 0 && !reflection && (this.frame & 2) === 0;
    const invulnBlink = f.state === 'getup' && (this.frame >> 2) % 2 === 0;
    const alpha = invulnBlink ? 0.6 : 1;
    if (!drawCharFrame(g, f.def, ref, sx, sy, f.facing, z, { outline: outline || undefined, tint: flashing ? '#ffffff' : undefined, alpha }))
      drawPlaceholder(g, f.def, f.state === 'attack' ? 'attack' : f.anim, sx, sy, f.facing, z, flashing ? '#ffffff' : undefined, alpha);
  }

  drawProjectile(sim: Sim, p: Projectile) {
    const g = this.g, d = p.def;
    const owner = sim.f[p.owner].def;
    const sx = this.zoomX(sim, p.x), sy = this.zoomY(sim, p.y);
    const z = sim.cam.zoom;
    const frames = p.state === 'spawn' ? d.spawnAnim : p.state === 'impact' ? d.impactAnim : d.travelAnim;
    g.globalAlpha = d.opacity * (p.state === 'impact' && !d.impactAnim.length ? Math.max(0, 1 - p.stateT / 10) : 1);
    if (frames.length) {
      const fi = p.state === 'travel' ? Math.floor(p.stateT * d.fps / 60) % frames.length : Math.min(frames.length - 1, Math.floor(p.stateT * d.fps / 60));
      const ref = frames[fi];
      const sheet = owner.sheets.find(s => s.id === ref.sheet);
      const fr = sheet?.frames[ref.index];
      const img = sheet && getImage(sheet.image);
      if (fr && img) {
        g.save(); g.translate(Math.round(sx), Math.round(sy));
        const ang = d.motion === 'beam' ? 0 : Math.atan2(-p.vy, Math.abs(p.vx) || 1);
        if (p.facing < 0) g.scale(-1, 1);
        if (d.motion !== 'stationary' && d.motion !== 'beam') g.rotate(p.facing < 0 ? ang : ang);
        const sc = d.scale * z;
        if (d.motion === 'beam') {
          for (let x = 0; x < p.beamLen; x += fr.w * sc * 0.7) g.drawImage(img, fr.x, fr.y, fr.w, fr.h, x * z - fr.ox * sc, -fr.oy * sc, fr.w * sc, fr.h * sc);
        } else g.drawImage(img, fr.x, fr.y, fr.w, fr.h, -fr.ox * sc, -fr.oy * sc, fr.w * sc, fr.h * sc);
        g.restore();
      }
      g.globalAlpha = 1;
      return;
    }
    if (p.state === 'impact') {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = rgba(d.color2, Math.max(0, 1 - p.stateT / 10));
      pixelCircle(g, sx, sy, d.size * d.scale * z * (0.6 + p.stateT / 10));
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      return;
    }
    const s = d.size * d.scale * z;
    const pulse = 1 + Math.sin(p.t * 0.6) * 0.12;
    g.globalCompositeOperation = 'lighter';
    switch (d.shape) {
      case 'orb': case 'star':
        g.fillStyle = rgba(d.color2, 0.45); pixelCircle(g, sx, sy, s * 0.8 * pulse);
        g.fillStyle = d.color2; pixelCircle(g, sx, sy, s * 0.55 * pulse);
        g.fillStyle = d.color; pixelCircle(g, sx, sy, s * 0.35);
        if (d.shape === 'star') { g.fillStyle = '#ffffff'; g.fillRect(sx - s, sy - 1, s * 2, 2); g.fillRect(sx - 1, sy - s, 2, s * 2); }
        break;
      case 'ring':
        g.strokeStyle = d.color2; g.lineWidth = Math.max(2, s * 0.15);
        g.beginPath(); g.arc(sx, sy, s * 0.5 * pulse, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = d.color; g.lineWidth = 1;
        g.beginPath(); g.arc(sx, sy, s * 0.35 * pulse, p.t * 0.2, p.t * 0.2 + 4); g.stroke();
        break;
      case 'blade': {
        g.save(); g.translate(sx, sy); g.rotate(Math.atan2(-p.vy, p.vx));
        g.fillStyle = d.color2; g.fillRect(-s * 0.9, -1, s * 0.5, 2);
        g.fillStyle = d.color; g.fillRect(-s * 0.4, -1, s * 0.9, 3); g.fillRect(s * 0.5, -2, 3, 5);
        g.restore();
        break;
      }
      case 'bolt': {
        g.strokeStyle = d.color2; g.lineWidth = Math.max(2, s * 0.25);
        const len = s * 2.5;
        const a = Math.atan2(-p.vy, p.vx);
        g.beginPath(); g.moveTo(sx, sy);
        for (let i = 1; i <= 6; i++) g.lineTo(sx - Math.cos(a) * len * i / 6 + Math.sin(p.t + i * 3) * 5, sy - Math.sin(a) * len * i / 6 + Math.cos(p.t * 1.3 + i) * 5);
        g.stroke();
        g.strokeStyle = d.color; g.lineWidth = Math.max(1, s * 0.1); g.stroke();
        break;
      }
      case 'beam': case 'wave': {
        if (d.motion === 'beam' || d.shape === 'beam') {
          const len = (d.motion === 'beam' ? p.beamLen : s * 3) * z * p.facing;
          const h = s * (0.8 + Math.sin(p.t * 0.8) * 0.15);
          const x0 = Math.min(sx, sx + len), w = Math.abs(len);
          g.fillStyle = rgba(d.color2, 0.5); g.fillRect(x0, sy - h * 0.6, w, h * 1.2);
          g.fillStyle = d.color2; g.fillRect(x0, sy - h * 0.4, w, h * 0.8);
          g.fillStyle = d.color; g.fillRect(x0, sy - h * 0.18, w, h * 0.36);
          g.fillStyle = '#ffffff'; pixelCircle(g, sx, sy, h * 0.7);
          for (let i = 0; i < 6; i++) { g.fillStyle = d.color; g.fillRect(x0 + ((p.t * 14 + i * 60) % Math.max(1, w)), sy - h * 0.5 + (i % 3) * h * 0.4, 12, 1); }
        } else {
          // ground wave
          const h = s * 1.6;
          for (let i = 0; i < 4; i++) {
            g.fillStyle = i % 2 ? d.color : d.color2;
            g.fillRect(sx - p.facing * i * 6 - 4, sy - h * (1 - i * 0.2) * pulse, 8, h * (1 - i * 0.2) * pulse);
          }
        }
        break;
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }

  drawBoxes(sim: Sim) {
    const g = this.g;
    const box = (b: { x: number; y: number; w: number; h: number }, col: string) => {
      const x0 = this.zoomX(sim, b.x), x1 = this.zoomX(sim, b.x + b.w), y0 = this.zoomY(sim, b.y + b.h), y1 = this.zoomY(sim, b.y);
      g.fillStyle = rgba(col, 0.25); g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = col; g.lineWidth = 1; g.strokeRect(Math.round(x0) + 0.5, Math.round(y0) + 0.5, Math.round(x1 - x0), Math.round(y1 - y0));
    };
    for (const f of sim.f) {
      const h = sim.hurtbox(f); if (h) box(h, f.invuln > 0 ? '#ffffff' : '#3a8aff');
      for (const b of sim.attackBoxes(f)) box(b, '#ff3030');
      if (f.state === 'attack' && f.atk?.type === 'throw') {
        const r = f.atk.throwRange ?? 46;
        box(sim.worldBox(f, { x: f.def.stats.width / 2 - 10, y: 10, w: r, h: 60 }), '#30ff60');
      }
      // origin marker
      g.fillStyle = '#ffff00'; g.fillRect(this.zoomX(sim, f.x) - 2, this.zoomY(sim, f.y) - 1, 5, 2);
    }
    for (const p of sim.projectiles) if (p.state === 'travel') box(sim.projBox(p), '#ff8a30');
  }

  drawBubbles(sim: Sim) {
    const g = this.g;
    for (const b of sim.bubbles) {
      const f = sim.f[b.owner];
      const sx = this.zoomX(sim, f.x), sy = this.zoomY(sim, f.y + f.def.stats.height + 16);
      const lines = wrapText(g, b.text, 150, 8);
      const w = Math.max(...lines.map(l => g.measureText(l).width)) + 12, h = lines.length * 11 + 8;
      const x = clamp(sx - w / 2, 4, VIEW_W - w - 4), y = clamp(sy - h, 56, VIEW_H - h - 40);
      g.fillStyle = '#000'; g.fillRect(x - 2, y - 2, w + 4, h + 4);
      g.fillStyle = '#fffef0'; g.fillRect(x, y, w, h);
      g.fillStyle = '#000'; g.fillRect(clamp(sx - 3, x + 4, x + w - 10), y + h, 6, 4);
      g.fillStyle = '#fffef0'; g.fillRect(clamp(sx - 2, x + 5, x + w - 9), y + h, 4, 2);
      lines.forEach((l, i) => { g.font = `8px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = '#1a1a2a'; g.fillText(l, Math.round(x + 6), Math.round(y + 5 + i * 11)); });
    }
  }

  // ------------------------------------------------------------------------
  drawAlert(sim: Sim) {
    const g = this.g, al = sim.alert!;
    const A = al.atk.cinematic!.alert;
    const f = sim.f[al.owner];
    const p = al.t / Math.max(1, al.dur);
    const ease = (x: number) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
    const inK = ease(p / 0.15), outK = 1 - ease((p - 0.85) / 0.15);
    const k = Math.min(inK, outK);
    const portrait = A.portrait === 'none' ? '' : A.portrait === 'custom' && A.customPortrait ? A.customPortrait : f.def.portrait;
    const img = portrait ? getImage(portrait) : null;
    const name = A.text || al.atk.name;
    g.fillStyle = rgba('#000000', A.darken * k); g.fillRect(0, 0, VIEW_W, VIEW_H);
    const mirror = al.owner === 1;
    if (A.style === 'band' || A.style === 'fullscreen') {
      const full = A.style === 'fullscreen';
      const bandH = (full ? VIEW_H : 120) * k;
      const cy = full ? VIEW_H / 2 : 150;
      const y0 = cy - bandH / 2;
      g.fillStyle = A.bgColor; g.fillRect(0, y0, VIEW_W, bandH);
      // animated streaks
      g.save(); g.beginPath(); g.rect(0, y0, VIEW_W, bandH); g.clip();
      const dir = mirror ? -1 : 1;
      for (let i = 0; i < (full ? 70 : 34); i++) {
        const yy = y0 + ((i * 29 + (i % 4) * 7) % Math.max(1, bandH));
        const len = 60 + (i * 41) % 220;
        const speed = 14 + (i % 6) * 5;
        let x = ((al.t * speed + i * 113) % (VIEW_W + len * 2)) - len;
        if (dir < 0) x = VIEW_W - x - len;
        g.fillStyle = i % 4 === 0 ? '#ffffff' : i % 2 ? A.streakColor : shade(A.bgColor, 0.35);
        g.globalAlpha = i % 4 === 0 ? 0.6 : 0.9;
        g.fillRect(Math.round(x), Math.round(yy), len, 1 + (i % 3));
      }
      g.globalAlpha = 1;
      if (full) { // radial burst
        g.globalAlpha = 0.25;
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2 + al.t * 0.02;
          g.fillStyle = A.streakColor;
          g.beginPath(); g.moveTo(VIEW_W / 2, cy); g.lineTo(VIEW_W / 2 + Math.cos(a) * 600, cy + Math.sin(a) * 600); g.lineTo(VIEW_W / 2 + Math.cos(a + 0.08) * 600, cy + Math.sin(a + 0.08) * 600); g.fill();
        }
        g.globalAlpha = 1;
      }
      // portrait
      if (img) {
        const ph = full ? 220 : 150;
        const pw = ph * (img.naturalWidth / img.naturalHeight);
        const slide = ease(p / 0.18);
        const drift = al.t * 0.25;
        let px = -pw + slide * (pw + 30) + drift;
        if (mirror) px = VIEW_W - px - pw;
        const py = cy - ph / 2 + (full ? 0 : 6);
        g.save();
        if (mirror) { g.translate(px + pw, py); g.scale(-1, 1); g.drawImage(img, 0, 0, pw, ph); }
        else g.drawImage(img, px, py, pw, ph);
        g.restore();
      }
      g.restore();
      // edges
      g.fillStyle = A.streakColor; g.fillRect(0, y0 - 2, VIEW_W, 2); g.fillRect(0, y0 + bandH, VIEW_W, 2);
      g.fillStyle = '#ffffff'; g.fillRect(0, y0 - 3, VIEW_W, 1); g.fillRect(0, y0 + bandH + 2, VIEW_W, 1);
      // text
      const tp = ease((p - 0.3) / 0.2);
      if (tp > 0) {
        const size = name.length > 14 ? 18 : 24;
        let tx = mirror ? 20 - (1 - tp) * 300 : VIEW_W - 20 + (1 - tp) * 300;
        const align: CanvasTextAlign = mirror ? 'left' : 'right';
        if (A.subtitle) text(g, A.subtitle, tx, cy + 6 - 34 + (full ? -40 : 0), 8, '#ffffff', align, '#000', FONT);
        // italic slant via transform
        g.save();
        g.translate(tx, cy - 14 + (full ? -20 : 0)); g.transform(1, 0, -0.18, 1, 0, 0);
        text(g, name, 0, 0, size, A.textColor, align, '#000', `"${A.font}", ${FONT}`, 3);
        g.restore();
      }
    } else {
      // corner style
      const w = 260 * k, h = 70;
      const x = mirror ? VIEW_W - w - 10 : 10, y = VIEW_H - h - 50;
      g.fillStyle = A.bgColor; g.fillRect(x, y, w, h);
      g.fillStyle = A.streakColor; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2);
      if (img && k > 0.5) g.drawImage(img, mirror ? x + w - 66 : x + 4, y + 4, 62, 62);
      if (k > 0.8) text(g, name, mirror ? x + w - 74 : x + 74, y + 26, 12, A.textColor, mirror ? 'right' : 'left', '#000', `"${A.font}", ${FONT}`);
    }
  }

  // ------------------------------------------------------------------------
  drawHUD(sim: Sim, training?: any) {
    const g = this.g;
    const train = !!sim.cfg.training;
    for (let i = 0; i < 2; i++) {
      const f = sim.f[i];
      const max = f.def.stats.maxHealth;
      const hp = clamp(f.hp / max, 0, 1);
      this.hpShown[i] += (hp - this.hpShown[i]) * 0.35;
      const comboOn = sim.f[1 - i].state !== 'idle' && f.comboHits > 0;
      if (comboOn || sim.hitstop > 0) this.redHold[i] = 30;
      if (this.redHold[i] > 0) this.redHold[i]--; else this.hpRed[i] += (this.hpShown[i] - this.hpRed[i]) * 0.06;
      if (this.hpRed[i] < this.hpShown[i]) this.hpRed[i] = this.hpShown[i];
      this.meterShown[i] += (f.meter - this.meterShown[i]) * 0.3;
    }
    const barW = 230, barH = 12, top = 12;
    for (let i = 0; i < 2; i++) {
      const f = sim.f[i];
      const left = i === 0;
      const px = left ? 6 : VIEW_W - 6 - 40;
      // portrait box
      g.fillStyle = '#000'; g.fillRect(px - 2, 4, 44, 44);
      g.fillStyle = shade(f.def.color, -0.4); g.fillRect(px, 6, 40, 40);
      const img = f.def.portrait ? getImage(f.def.portrait) : null;
      if (img) { g.save(); if (!left) { g.translate(px + 40, 6); g.scale(-1, 1); g.drawImage(img, 0, 0, 40, 40); } else g.drawImage(img, px, 6, 40, 40); g.restore(); }
      else text(g, f.def.name.slice(0, 1).toUpperCase(), px + 20, 16, 16, '#fff', 'center');
      g.strokeStyle = '#fff36b'; g.lineWidth = 1; g.strokeRect(px - 1.5, 4.5, 43, 43);
      // bar frame
      const bx = left ? 50 : VIEW_W - 50 - barW;
      g.fillStyle = '#000'; g.fillRect(bx - 2, top - 2, barW + 4, barH + 4);
      g.fillStyle = '#3a0a0a'; g.fillRect(bx, top, barW, barH);
      const red = this.hpRed[i] * barW, yel = this.hpShown[i] * barW;
      const low = this.hpShown[i] < 0.25;
      g.fillStyle = '#e02020';
      if (left) g.fillRect(bx, top, red, barH); else g.fillRect(bx + barW - red, top, red, barH);
      const yc = low && (this.frame >> 3) % 2 ? '#ff8a20' : '#ffd21a';
      g.fillStyle = yc;
      if (left) g.fillRect(bx, top, yel, barH); else g.fillRect(bx + barW - yel, top, yel, barH);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      if (left) g.fillRect(bx, top + 1, yel, 3); else g.fillRect(bx + barW - yel, top + 1, yel, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      if (left) g.fillRect(bx, top + barH - 3, yel, 3); else g.fillRect(bx + barW - yel, top + barH - 3, yel, 3);
      // name
      text(g, f.def.name.toUpperCase(), left ? bx : bx + barW, top + barH + 5, 8, '#ffffff', left ? 'left' : 'right');
      // wins
      if (!train) for (let w = 0; w < sim.cfg.roundsToWin; w++) {
        const wx = left ? bx + barW - 10 - w * 12 : bx + 2 + w * 12;
        g.fillStyle = '#000'; g.fillRect(wx - 1, top + barH + 4, 10, 10);
        g.fillStyle = w < f.wins ? '#fff36b' : '#333'; g.fillRect(wx, top + barH + 5, 8, 8);
        if (w < f.wins) { g.fillStyle = '#ff8a20'; g.fillRect(wx + 2, top + barH + 7, 4, 4); }
      }
      // meter
      const mw = 150, mh = 7, my = VIEW_H - 18;
      const mx = left ? 34 : VIEW_W - 34 - mw;
      const stocks = Math.floor(this.meterShown[i] / 100);
      const part = (this.meterShown[i] % 100) / 100;
      g.fillStyle = '#000'; g.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
      g.fillStyle = '#101830'; g.fillRect(mx, my, mw, mh);
      const full = f.meter >= METER_MAX;
      g.fillStyle = full ? ((this.frame >> 2) % 2 ? '#7ff7ff' : '#ffffff') : stocks > 0 ? '#3a9aff' : '#2a5aaa';
      const fillW = (full ? 1 : part) * mw;
      if (left) g.fillRect(mx, my, fillW, mh); else g.fillRect(mx + mw - fillW, my, fillW, mh);
      g.fillStyle = 'rgba(255,255,255,0.4)'; if (left) g.fillRect(mx, my, fillW, 2); else g.fillRect(mx + mw - fillW, my, fillW, 2);
      text(g, String(stocks), left ? 12 : VIEW_W - 12, my - 6, 16, stocks > 0 ? '#7ff7ff' : '#556', 'center');
      // combo counter
      const c = sim.combo[i];
      if (c.t > 0 && c.hits >= 2) {
        const a = clamp(c.t / 20, 0, 1);
        g.globalAlpha = a;
        const cx = left ? 14 : VIEW_W - 14;
        const pop = c.t > 84 ? 1.25 : 1;
        g.save(); g.translate(cx, 92); g.scale(pop, pop); g.transform(1, 0, -0.15, 1, 0, 0);
        text(g, `${c.hits}`, 0, 0, 24, '#ffd21a', left ? 'left' : 'right', '#a01010', FONT, 3);
        g.restore();
        g.font = `24px ${FONT}`;
        const nw = g.measureText(String(c.hits)).width * pop + 8;
        text(g, 'HITS', left ? cx + nw : cx - nw, 102, 12, '#ffffff', left ? 'left' : 'right', '#a01010');
        text(g, `${c.dmg} DMG`, cx, 122, 8, '#ffb0b0', left ? 'left' : 'right');
        g.globalAlpha = 1;
      }
    }
    // timer
    g.fillStyle = '#000'; g.fillRect(VIEW_W / 2 - 22, 4, 44, 32);
    g.fillStyle = '#1a1030'; g.fillRect(VIEW_W / 2 - 20, 6, 40, 28);
    const tstr = train || sim.cfg.roundTime <= 0 ? '∞' : String(Math.ceil(sim.timer / 60)).padStart(2, '0');
    if (tstr === '∞') text(g, 'TR', VIEW_W / 2, 13, 14, '#7ff7ff', 'center');
    else text(g, tstr, VIEW_W / 2, 11, 18, sim.timer < 600 && (this.frame >> 4) % 2 ? '#ff5050' : '#ffffff', 'center');

    // round text
    if (sim.phase === 'ready' && !train) {
      if (sim.phaseT < 48) this.bigText(`ROUND ${sim.round}`, sim.phaseT / 48, '#ffffff');
      else this.bigText('FIGHT!', (sim.phaseT - 48) / 32, '#ff4040', true);
    } else if (this.roundText && (sim.phase === 'ko' || sim.phase === 'roundEnd' || sim.phase === 'matchEnd')) {
      this.roundText.t++;
      const rt = this.roundText;
      if (sim.phase === 'ko' || rt.t < 140) this.bigText(rt.text, Math.min(1, rt.t / 60), rt.color, rt.big);
    } else if (sim.phase === 'intro') {
      text(g, 'PRESS ANY ATTACK TO SKIP', VIEW_W / 2, VIEW_H - 46, 8, '#ffffffaa', 'center');
    }
    if (sim.phase === 'roundEnd' && this.roundText && this.roundText.t > 140) this.roundText = null;
    if (training) this.drawTrainingInfo(sim, training);
  }

  bigText(s: string, p: number, color: string, punch = false) {
    const g = this.g;
    const scale = punch ? 1 + Math.max(0, 0.6 - p) * 1.4 : 1;
    const alpha = clamp(p * 4, 0, 1);
    g.save();
    g.globalAlpha = alpha;
    g.translate(VIEW_W / 2, VIEW_H / 2 - 30);
    g.scale(scale, scale);
    g.transform(1, 0, -0.12, 1, 0, 0);
    const size = s.length > 12 ? 20 : 32;
    text(g, s, 0, -size / 2, size, color, 'center', '#000', FONT, 4);
    g.restore();
    g.globalAlpha = 1;
  }

  drawTrainingInfo(sim: Sim, info: { lastDamage: number; lastCombo: number; maxCombo: number; frameData?: string; inputs?: string[] }) {
    const g = this.g;
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(VIEW_W - 170, 56, 164, info.frameData ? 54 : 42);
    text(g, `DAMAGE  ${info.lastDamage}`, VIEW_W - 164, 60, 8, '#fff');
    text(g, `COMBO   ${info.lastCombo}`, VIEW_W - 164, 72, 8, '#fff');
    text(g, `MAX     ${info.maxCombo}`, VIEW_W - 164, 84, 8, '#fff36b');
    if (info.frameData) text(g, info.frameData, VIEW_W - 164, 96, 8, '#7ff7ff');
    if (info.inputs?.length) {
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(4, 56, 70, info.inputs.length * 10 + 6);
      info.inputs.forEach((s, i) => text(g, s, 8, 60 + i * 10, 8, i === 0 ? '#fff36b' : '#ccc'));
    }
  }
}

/** Render a static preview of a stage (used in stage select / editor). */
export function previewSim(stage: StageDef) { return stage; }
