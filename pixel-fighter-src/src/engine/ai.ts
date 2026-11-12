// AI opponents: produce the same InputFrames a human would, so they obey every game rule.
import type { AttackDef, DirReq } from './types';
import { emptyInput, InputFrame } from './input';
import { Sim, Fighter } from './sim';
import { Rng } from './util';

type Step = { f: Partial<InputFrame>; n: number };

export class AIController {
  plan: Step[] = [];
  wait = 0;
  rng: Rng;
  hold: Partial<InputFrame> | null = null; holdN = 0;
  constructor(public level: number, seed = 99) { this.rng = new Rng(seed); }

  get reaction() { return Math.max(3, 24 - this.level * 2.6); }
  get blockChance() { return Math.min(0.92, 0.12 + this.level * 0.1); }

  poll(sim: Sim, idx: number): InputFrame {
    const out = emptyInput();
    if (sim.phase !== 'fight') { this.plan = []; return out; }
    const f = sim.f[idx], o = sim.f[1 - idx];
    if (this.plan.length) {
      const s = this.plan[0];
      Object.assign(out, s.f);
      if (--s.n <= 0) this.plan.shift();
      return out;
    }
    if (this.hold && this.holdN > 0) { this.holdN--; Object.assign(out, this.hold); if (this.holdN <= 0) this.hold = null; }
    if (this.wait > 0) { this.wait--; return out; }
    this.think(sim, f, o);
    return out;
  }

  dirFrame(f: Fighter, d: DirReq | 'none'): Partial<InputFrame> {
    const fwd = f.facing > 0 ? 'right' : 'left', back = f.facing > 0 ? 'left' : 'right';
    switch (d) {
      case 'forward': return { [fwd]: true };
      case 'back': return { [back]: true };
      case 'down': return { down: true };
      case 'downforward': return { down: true, [fwd]: true };
      case 'up': return { up: true };
      default: return {};
    }
  }

  /** Queue the inputs needed to perform an attack. */
  doAttack(f: Fighter, a: AttackDef) {
    const inp = a.input.motion !== 'none' && a.input2 && a.input2.motion === 'none' ? a.input2 : a.input;
    const btn = (b: string): Partial<InputFrame> => b === 'SH' ? { S: true, H: true } : b === 'A' ? { M: true } : { [b]: true };
    if (inp.motion !== 'none') {
      const fwd = f.facing > 0 ? 'right' : 'left', back = f.facing > 0 ? 'left' : 'right';
      const seqs: Record<string, Partial<InputFrame>[]> = {
        qcf: [{ down: true }, { down: true, [fwd]: true }, { [fwd]: true }],
        qcb: [{ down: true }, { down: true, [back]: true }, { [back]: true }],
        dp: [{ [fwd]: true }, { down: true }, { down: true, [fwd]: true }],
        hcb: [{ [fwd]: true }, { down: true, [fwd]: true }, { down: true }, { down: true, [back]: true }, { [back]: true }],
        dqcf: [{ down: true }, { down: true, [fwd]: true }, { [fwd]: true }, { down: true }, { down: true, [fwd]: true }, { [fwd]: true }],
      };
      for (const s of seqs[inp.motion] || []) this.plan.push({ f: s, n: 2 });
      const last = seqs[inp.motion]?.slice(-1)[0] || {};
      this.plan.push({ f: { ...last, ...btn(inp.button) }, n: 2 });
    } else {
      const d = this.dirFrame(f, inp.dir === 'neutral' || inp.dir === 'any' ? 'none' : inp.dir);
      if (inp.dir !== 'neutral' && inp.dir !== 'any') this.plan.push({ f: d, n: 2 });
      this.plan.push({ f: { ...d, ...btn(inp.button) }, n: 2 });
    }
    this.plan.push({ f: {}, n: 1 });
  }

  reach(a: AttackDef) {
    if (a.projectile) return 600;
    if (a.type === 'throw') return (a.throwRange ?? 46) + 20;
    if (a.cinematic?.useTimeline) {
      const d = a.cinematic.timeline.find(e => e.track === 'damage');
      const mv = a.cinematic.timeline.filter(e => e.track === 'character' && e.vx).reduce((s, e) => s + (e.vx || 0) * (e.dur || 10), 0);
      return (d?.box ? d.box.x + d.box.w : 60) + mv * 0.8 + (a.cinematic.timeline.some(e => e.teleport && e.teleport !== 'none') ? 400 : 0);
    }
    let r = 0;
    for (const fr of a.frames) for (const b of fr.boxes) r = Math.max(r, b.x + b.w);
    r = Math.max(r, a.hitbox.x + a.hitbox.w);
    return r + Math.abs(a.moveX) * (a.startup + a.active) * 0.8;
  }

  think(sim: Sim, f: Fighter, o: Fighter) {
    const r = this.rng;
    const L = this.level;
    const dist = Math.abs(o.x - f.x) - (f.def.stats.width + o.def.stats.width) / 2;
    const ground = f.grounded;
    const canAct = ['idle', 'walk', 'walkBack', 'crouch', 'run', 'land', 'air'].includes(f.state);
    this.wait = Math.round(this.reaction * (0.5 + r.next() * 0.6));
    if (!canAct) { this.wait = 2; return; }
    const usable = f.def.attacks.filter(a => a.energyCost <= f.meter && (f.cooldowns[a.id] ?? 0) <= sim.tick && (a.stance === 'both' || (a.stance === 'air') === !ground));
    const pick = (fn: (a: AttackDef) => boolean) => { const l = usable.filter(fn); return l.length ? r.pick(l) : null; };

    // --- defense
    const incomingProj = sim.projectiles.find(p => p.owner === o.idx && p.state === 'travel' && Math.abs(p.x - f.x) < 170 && Math.sign(f.x - p.x) === Math.sign(p.vx || p.facing));
    const oAttacking = (o.state === 'attack' && o.atk && o.atkT < o.atk.startup + o.atk.active && dist < 120) || (o.state === 'cine' && dist < 160);
    if (ground && (incomingProj || oAttacking) && r.chance(this.blockChance)) {
      const low = o.atk?.hitLevel === 'low' || (o.state === 'attack' && o.atk?.input.dir === 'down');
      const jumpOver = incomingProj && L >= 4 && r.chance(0.3);
      if (jumpOver) { this.plan.push({ f: { up: true, ...this.dirFrame(f, 'forward') }, n: 4 }); this.wait = 18; this.plan.push({ f: {}, n: 14 }); const ak = pick(a => a.stance === 'air' && a.type === 'heavy'); if (ak) { this.plan.push({ f: {}, n: 8 }); this.doAttack(f, ak); } return; }
      this.hold = { ...this.dirFrame(f, 'back'), down: low && L >= 3 ? true : r.chance(0.3) && o.atk?.hitLevel !== 'overhead' };
      this.holdN = 12 + r.int(10);
      this.wait = this.holdN;
      return;
    }
    // --- anti-air
    if (ground && !o.grounded && o.state === 'air' && dist < 150 && Math.sign(o.vx) === Math.sign(f.x - o.x) && r.chance(0.25 + L * 0.08)) {
      const aa = pick(a => a.type === 'special' && a.launcher && a.input.dir === 'up') || pick(a => a.launcher && a.stance !== 'air');
      if (aa) { this.doAttack(f, aa); return; }
    }
    // --- super when it will reach
    const sup = pick(a => a.type === 'super');
    if (sup && ground && dist < this.reach(sup) * 0.9 && r.chance(0.2 + L * 0.04) && o.state !== 'knockdown' && o.state !== 'getup') { this.doAttack(f, sup); return; }

    if (!ground) {
      const air = pick(a => a.stance !== 'ground' && a.type !== 'throw');
      if (air && dist < 110 && f.vy < 3 && r.chance(0.7)) this.doAttack(f, air);
      this.wait = 3;
      return;
    }
    // --- close range
    if (dist < 70) {
      const thr = pick(a => a.type === 'throw');
      if (thr && dist < (thr.throwRange ?? 46) - 14 && ['idle', 'walk', 'crouch', 'walkBack', 'blockstun'].includes(o.state) && r.chance(0.18 + L * 0.03)) { this.doAttack(f, thr); return; }
      const normals = usable.filter(a => ['light', 'medium', 'heavy'].includes(a.type) && a.stance !== 'air' && this.reach(a) >= dist + 6);
      if (normals.length) {
        // chain combo
        const order = ['light', 'medium', 'heavy'];
        const start = r.pick(normals);
        this.doAttack(f, start);
        if (L >= 3 && r.chance(0.3 + L * 0.08)) {
          let rank = order.indexOf(start.type);
          for (let k = rank + 1; k < 3; k++) {
            const nxt = normals.find(a => a.type === order[k] && a.input.dir === start.input.dir) || normals.find(a => a.type === order[k]);
            if (nxt) { this.plan.push({ f: {}, n: Math.max(2, start.startup + 1) }); this.doAttack(f, nxt); }
          }
          const fin = pick(a => a.type === 'special' && !a.projectile && this.reach(a) > 40 && a.energyCost <= f.meter);
          if (fin && L >= 5 && r.chance(0.6)) { this.plan.push({ f: {}, n: 8 }); this.doAttack(f, fin); }
        }
        return;
      }
      if (r.chance(0.3)) { this.plan.push({ f: this.dirFrame(f, 'back'), n: 10 + r.int(10) }); return; }
    }
    // --- mid / long range
    const proj = pick(a => !!a.projectile && a.type === 'special' && a.stance !== 'air');
    if (proj && dist > 140 && r.chance(0.25 + L * 0.03)) { this.doAttack(f, proj); return; }
    const rushIn = pick(a => a.type === 'special' && a.moveX > 3 && this.reach(a) > dist && !a.projectile);
    if (rushIn && dist < 200 && r.chance(0.12 + L * 0.02)) { this.doAttack(f, rushIn); return; }
    const roll = r.next();
    if (roll < 0.18 && dist < 260) {
      // jump in with an air attack
      this.plan.push({ f: { up: true, ...this.dirFrame(f, 'forward') }, n: 3 });
      this.plan.push({ f: this.dirFrame(f, 'forward'), n: 10 + r.int(6) });
      const air = pick(a => a.stance === 'air' && !a.projectile) || null;
      if (air) this.doAttack(f, air);
      return;
    }
    if (roll < 0.3 && dist > 160) { // run or dash in
      this.plan.push({ f: { D: true, ...this.dirFrame(f, 'forward') }, n: 2 }); this.plan.push({ f: this.dirFrame(f, 'forward'), n: 12 });
      return;
    }
    if (roll < 0.38) { this.plan.push({ f: {}, n: 6 + r.int(12) }); return; }
    if (roll < 0.45 && dist < 140) { this.plan.push({ f: this.dirFrame(f, 'back'), n: 10 + r.int(14) }); return; }
    this.plan.push({ f: this.dirFrame(f, 'forward'), n: 8 + r.int(16) });
  }
}

export class DummyController {
  constructor(public mode: 'stand' | 'crouch' | 'jump' | 'block' | 'cpu', public ai: AIController) { }
  poll(sim: Sim, idx: number): InputFrame {
    const out = emptyInput();
    const f = sim.f[idx], o = sim.f[1 - idx];
    switch (this.mode) {
      case 'stand': break;
      case 'crouch': out.down = true; break;
      case 'jump': out.up = true; break;
      case 'block': {
        const away = o.x < f.x ? 'right' : 'left';
        out[away] = true;
        if (o.state === 'attack' && o.atk?.hitLevel === 'low') out.down = true;
        break;
      }
      case 'cpu': return this.ai.poll(sim, idx);
    }
    return out;
  }
}
