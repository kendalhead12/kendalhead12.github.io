// Visual-only particle system (not part of the deterministic simulation).
import type { EffectDef, ParticleKind } from './types';
import { hexToRgb, rgba } from './util';

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number;
  c1: string; c2: string; kind: ParticleKind | 'dust2' | 'petal' | 'drop'; grav: number; glow: boolean;
  rot: number; vr: number; seed: number; screen?: boolean; drag: number; grow: number;
}

export class Particles {
  list: Particle[] = [];
  intensity = 1;

  spawn(def: EffectDef, x: number, y: number, facing: number, scale = 1) {
    const n = Math.max(1, Math.round(def.count * this.intensity * (def.kind === 'flash' || def.kind === 'shockwave' || def.kind === 'ring' ? 1 / Math.max(0.5, this.intensity) : 1)));
    for (let i = 0; i < n; i++) {
      const baseDeg = facing >= 0 ? def.direction : 180 - def.direction;
      const ang = ((baseDeg + (Math.random() - 0.5) * def.spread) * Math.PI) / 180;
      const sp = def.speed * (0.45 + Math.random() * 0.75) * scale;
      const life = Math.max(2, def.life * (0.7 + Math.random() * 0.5));
      this.list.push({
        x: x + (Math.random() - 0.5) * (def.kind === 'smoke' || def.kind === 'dust' ? 10 : 2) * scale, y: y + (Math.random() - 0.5) * 4 * scale,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life, max: life, size: def.size * scale * (0.7 + Math.random() * 0.6),
        c1: def.color, c2: def.color2, kind: def.kind, grav: def.gravity, glow: def.glow, rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.3, seed: Math.random() * 1000, drag: def.kind === 'smoke' || def.kind === 'dust' ? 0.93 : 0.97, grow: 0,
      });
    }
  }

  puff(x: number, y: number, color: string, size: number, count: number, style: string, spreadX = 1.6, up = 0.6) {
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;
      const life = 18 + Math.random() * 14;
      this.list.push({
        x: x + (Math.random() - 0.5) * 10, y: y + 2, vx: dir * (0.4 + Math.random()) * spreadX, vy: Math.random() * up + 0.1,
        life, max: life, size: size * (0.8 + Math.random() * 0.8), c1: color, c2: color,
        kind: style === 'sparkle' ? 'star' : style === 'ring' ? 'ring' : 'dust2', grav: -0.01, glow: style === 'sparkle',
        rot: 0, vr: 0, seed: Math.random() * 1000, drag: 0.9, grow: style === 'puff' ? 0.12 : 0.05,
      });
      if (style === 'ring') break;
    }
  }

  update() {
    for (const p of this.list) {
      p.life--;
      p.vy -= p.grav; p.vx *= p.drag; p.vy *= p.kind === 'fire' ? 0.98 : p.drag > 0.95 ? 1 : p.drag;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.size += p.grow;
    }
    this.list = this.list.filter(p => p.life > 0);
    if (this.list.length > 2500) this.list.splice(0, this.list.length - 2500);
  }

  /** Draw with a world->screen mapping. */
  draw(g: CanvasRenderingContext2D, toX: (x: number) => number, toY: (y: number) => number, zoom: number) {
    for (const p of this.list) {
      const t = 1 - p.life / p.max; // 0 -> 1
      const sx = toX(p.x), sy = toY(p.y);
      const s = Math.max(1, p.size * zoom);
      const col = mix(p.c1, p.c2, t);
      g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
      switch (p.kind) {
        case 'spark': {
          const len = Math.max(2, Math.hypot(p.vx, p.vy) * 2.2) * zoom;
          const a = Math.atan2(-p.vy, p.vx);
          g.strokeStyle = rgba(col, 1 - t * 0.6); g.lineWidth = Math.max(1, Math.round(s * 0.8));
          g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - Math.cos(a) * len, sy - Math.sin(a) * len); g.stroke();
          break;
        }
        case 'smoke': case 'dust': case 'dust2': {
          g.fillStyle = rgba(col, (1 - t) * (p.kind === 'smoke' ? 0.55 : 0.7));
          const r = s * (1 + t * 1.2);
          pixelCircle(g, sx, sy, r);
          break;
        }
        case 'energy': case 'pixel': {
          g.fillStyle = rgba(col, 1 - t * 0.8);
          const r = Math.round(s * (p.kind === 'energy' ? 1 - t * 0.5 : 1));
          g.fillRect(Math.round(sx - r / 2), Math.round(sy - r / 2), r, r);
          break;
        }
        case 'fire': {
          g.fillStyle = rgba(col, 1 - t);
          const r = Math.max(1, Math.round(s * (1 - t * 0.7)));
          g.fillRect(Math.round(sx - r / 2), Math.round(sy - r / 2), r, r);
          break;
        }
        case 'lightning': {
          if (Math.random() < 0.25 && t > 0.3) break;
          g.strokeStyle = rgba(col, 1 - t * 0.5); g.lineWidth = Math.max(1, Math.round(s * 0.6));
          const len = (24 + (p.seed % 50)) * zoom * Math.max(0.6, p.size / 2);
          const a = p.seed;
          let x = sx, y = sy;
          g.beginPath(); g.moveTo(x, y);
          const segs = 5;
          for (let i = 1; i <= segs; i++) {
            const d = (len / segs) * i;
            x = sx + Math.cos(a) * d + (Math.sin(p.seed + i * 7 + p.life) * 6) * zoom;
            y = sy + Math.sin(a) * d + (Math.cos(p.seed * 2 + i * 5 + p.life) * 6) * zoom;
            g.lineTo(x, y);
          }
          g.stroke();
          p.vx = 0; p.vy = 0;
          break;
        }
        case 'flash': {
          g.fillStyle = rgba(col, (1 - t) * 0.9);
          pixelCircle(g, sx, sy, s * (0.6 + t * 0.8));
          g.fillStyle = rgba('#ffffff', (1 - t));
          pixelCircle(g, sx, sy, s * 0.4 * (1 - t));
          p.vx = p.vy = 0;
          break;
        }
        case 'shockwave': case 'ring': {
          g.strokeStyle = rgba(col, 1 - t); g.lineWidth = Math.max(1, Math.round((p.kind === 'shockwave' ? 4 : 2) * (1 - t) * zoom + 1));
          const r = s * (0.3 + t * 1.6);
          g.beginPath();
          if (p.kind === 'shockwave') g.ellipse(sx, sy, r * 1.4, r * 0.55, 0, 0, Math.PI * 2);
          else g.arc(sx, sy, r, 0, Math.PI * 2);
          g.stroke();
          p.vx = p.vy = 0;
          break;
        }
        case 'streak': {
          g.fillStyle = rgba(col, 1 - t);
          const len = Math.max(4, Math.abs(p.vx) * 4) * zoom;
          g.fillRect(Math.round(sx - (p.vx > 0 ? len : 0)), Math.round(sy), Math.round(len), Math.max(1, Math.round(s)));
          break;
        }
        case 'star': {
          g.fillStyle = rgba(col, 1 - t);
          const r = Math.max(1, Math.round(s));
          g.fillRect(Math.round(sx - r), Math.round(sy), r * 2 + 1, 1);
          g.fillRect(Math.round(sx), Math.round(sy - r), 1, r * 2 + 1);
          g.fillRect(Math.round(sx), Math.round(sy), 1, 1);
          break;
        }
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
}

export function pixelCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  r = Math.max(1, r);
  if (r < 2.5) { g.fillRect(Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2)); return; }
  const step = Math.max(1, Math.round(r / 6));
  for (let y = -r; y <= r; y += step) {
    const w = Math.sqrt(Math.max(0, r * r - y * y));
    g.fillRect(Math.round(cx - w), Math.round(cy + y), Math.round(w * 2), step);
  }
}

const mixCache = new Map<string, string>();
export function mix(a: string, b: string, t: number): string {
  const q = Math.round(t * 8) / 8;
  const k = a + b + q;
  let r = mixCache.get(k);
  if (r) return r;
  const A = hexToRgb(a), B = hexToRgb(b);
  r = '#' + A.map((v, i) => Math.round(v + (B[i] - v) * q).toString(16).padStart(2, '0')).join('');
  if (mixCache.size > 5000) mixCache.clear();
  mixCache.set(k, r);
  return r;
}
