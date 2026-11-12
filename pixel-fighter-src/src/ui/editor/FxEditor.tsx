import React, { useEffect, useRef, useState } from 'react';
import type { CharacterDef, EffectDef, FrameRef, ParticleKind, ProjectileDef } from '../../engine/types';
import type { Update } from './CharacterEditor';
import { BUILTIN_EFFECTS, newAttack, newEffect, newProjectile } from '../../engine/defaults';
import { Particles } from '../../engine/particles';
import { deepClone, uid } from '../../engine/util';
import { emptyInput } from '../../engine/input';
import { Check, Color, Field, FrameThumb, Modal, Num } from '../widgets';
import { EffectSelect, FramePicker, SimPreview, SoundSelect, PreviewScript } from './common';

// ============================================================================
export function ProjectilesTab({ d, update }: { d: CharacterDef; update: Update }) {
  const [sel, setSel] = useState(d.projectiles[0]?.id || '');
  const p = d.projectiles.find(x => x.id === sel) || d.projectiles[0];
  const add = () => { const n = newProjectile('Projectile ' + (d.projectiles.length + 1)); update(x => { x.projectiles = [...x.projectiles, n]; }); setSel(n.id); };
  return <div className="split">
    <div className="col">
      <button className="go big" onClick={add}>+ CREATE PROJECTILE</button>
      <div className="list">{d.projectiles.map(x => <div key={x.id} className={'item' + (p?.id === x.id ? ' sel' : '')} onClick={() => setSel(x.id)}>
        <span className="chip" style={{ background: x.color2 }} /><span className="grow">{x.name}</span><span className="small dim">{x.motion}</span></div>)}</div>
      <p className="small dim">Fireballs, beams, kunai, lightning… Upload a separate sprite sheet on the Sprites tab for custom projectile art, or use a built-in shape.</p>
    </div>
    <div>{p ? <ProjectileEditor key={p.id} d={d} p={p} update={update} /> : <div className="panel center" style={{ minHeight: 200 }}><p className="pix" style={{ fontSize: 10 }}>NO PROJECTILES YET</p></div>}</div>
  </div>;
}

function ProjectileEditor({ d, p, update }: { d: CharacterDef; p: ProjectileDef; update: Update }) {
  const set = (q: Partial<ProjectileDef>) => update(x => { x.projectiles = x.projectiles.map(y => y.id === p.id ? { ...y, ...q } : y); });
  const [animTab, setAnimTab] = useState<'spawnAnim' | 'travelAnim' | 'impactAnim'>('travelAnim');
  const [confirm, setConfirm] = useState(false);
  const users = d.attacks.filter(a => a.projectile === p.id || a.cinematic?.timeline.some(e => e.projectile === p.id));
  const script: PreviewScript = (sim, t) => {
    if (t % 110 === 15) { sim.projectiles = []; sim.spawnProjectile(sim.f[0], p.id, 50, 70); }
  };
  const frames = p[animTab];
  return <div className="col">
    <div className="panel">
      <div className="row">
        <input value={p.name} onChange={e => set({ name: e.target.value })} style={{ width: 240, fontSize: 22 }} />
        <span className="spacer" />
        <button className="tiny" onClick={() => { const c = { ...deepClone(p), id: uid('prj'), name: p.name + ' Copy' }; update(x => { x.projectiles = [...x.projectiles, c]; }); }}>DUPLICATE</button>
        <button className="tiny danger" onClick={() => setConfirm(true)}>DELETE</button>
      </div>
      <p className="small dim">{users.length ? `Fired by: ${users.map(u => u.name).join(', ')}` : 'Not used by any attack yet.'}
        {!users.length && <button className="tiny go" style={{ marginLeft: 8 }} onClick={() => {
          const a = { ...newAttack('special', p.name), input: { button: 'S' as const, dir: 'neutral' as const, motion: 'none' as const }, projectile: p.id, spawnAt: 12, hitbox: { x: 0, y: 0, w: 0, h: 0 }, sound: 'special' };
          const idle = d.animations.idle?.frames[0]; if (idle) a.frames = [{ ref: idle, boxes: [] }];
          update(x => { x.attacks = [...x.attacks, a]; });
        }}>+ MAKE AN ATTACK THAT FIRES IT</button>}</p>
    </div>
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>BEHAVIOUR</h3>
        <Field label="Damage"><Num value={p.damage} min={0} max={500} onChange={v => set({ damage: v })} /></Field>
        <Field label="Speed"><Num value={p.speed} min={0} max={30} step={0.5} onChange={v => set({ speed: v })} /></Field>
        <Field label="Direction" tip="Degrees. 0 = straight forward, 45 = up-forward, -90 = straight down."><Num value={p.angle} min={-180} max={180} step={5} onChange={v => set({ angle: v })} /></Field>
        <Field label="Movement"><select value={p.motion} onChange={e => set({ motion: e.target.value as any })}>
          <option value="straight">Travels straight</option><option value="curve">Curves</option><option value="homing">Follows opponent</option><option value="stationary">Stays stationary</option>
          <option value="arc">Arcs with gravity</option><option value="wave">Sine wave</option><option value="beam">Beam (attached to caster)</option>
        </select></Field>
        {['curve', 'homing', 'wave'].includes(p.motion) && <Field label={p.motion === 'homing' ? 'Turn rate' : p.motion === 'wave' ? 'Amplitude' : 'Curvature'}><Num value={p.curve} min={-3} max={3} step={0.01} onChange={v => set({ curve: v })} /></Field>}
        {p.motion === 'arc' && <Field label="Gravity"><Num value={p.gravity} min={0} max={1} step={0.01} onChange={v => set({ gravity: v })} /></Field>}
        <Field label="Lifetime" tip="Ticks before it fades (60 = 1s)."><Num value={p.lifetime} min={5} max={600} onChange={v => set({ lifetime: v })} /></Field>
        <Field label="Size" tip="Collision size in world pixels."><Num value={p.size} min={2} max={200} onChange={v => set({ size: v })} /></Field>
        <Field label="Sprite scale"><Num value={p.scale} min={0.25} max={8} step={0.25} onChange={v => set({ scale: v })} /></Field>
        <Field label="Knockback"><Num value={p.knockback} min={0} max={20} step={0.5} onChange={v => set({ knockback: v })} /></Field>
        <Field label="Hits" tip="How many times it can hit."><Num value={p.hits} min={1} max={30} onChange={v => set({ hits: v })} slider={false} /></Field>
        <Field label="Hit-stun"><Num value={p.hitstun} min={0} max={90} onChange={v => set({ hitstun: v })} slider={false} /></Field>
        <Field label="Collision" tip="What happens when it hits a fighter or another projectile."><select value={p.collision} onChange={e => set({ collision: e.target.value as any })}>
          <option value="destroy">Vanishes on hit</option><option value="pierce">Passes through</option><option value="clash">Cancels other projectiles</option><option value="absorb">Absorbs other projectiles</option>
        </select></Field>
        <Field label="Strength" tip="When projectiles collide, the stronger one survives."><Num value={p.strength} min={0} max={10} onChange={v => set({ strength: v })} slider={false} /></Field>
        <div className="row"><Check value={p.knockdown} onChange={v => set({ knockdown: v })} label="Knockdown" /><Check value={p.blockable} onChange={v => set({ blockable: v })} label="Blockable" /></div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>LOOK & SOUND</h3>
        <Field label="Shape" tip="Used when no sprite frames are chosen."><select value={p.shape} onChange={e => set({ shape: e.target.value as any })}>{['orb', 'blade', 'bolt', 'ring', 'beam', 'star', 'wave'].map(s => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Core / glow color"><Color value={p.color} onChange={v => set({ color: v })} /><Color value={p.color2} onChange={v => set({ color2: v })} /></Field>
        <Field label="Transparency"><Num value={p.opacity} min={0.1} max={1} step={0.05} onChange={v => set({ opacity: v })} /></Field>
        <Field label="Particle trail"><EffectSelect def={d} value={p.trail} onChange={v => set({ trail: v })} /></Field>
        {p.trail && <Field label="Trail every N ticks"><Num value={p.trailRate} min={1} max={30} onChange={v => set({ trailRate: v })} slider={false} /></Field>}
        <Field label="Impact effect"><EffectSelect def={d} value={p.impactEffect} onChange={v => set({ impactEffect: v })} /></Field>
        <Field label="Launch sound"><SoundSelect def={d} value={p.sound} onChange={v => set({ sound: v || undefined })} /></Field>
        <Field label="Impact sound"><SoundSelect def={d} value={p.impactSound} onChange={v => set({ impactSound: v || undefined })} /></Field>
        <h4>SPRITE ANIMATIONS</h4>
        <div className="row">
          {(['spawnAnim', 'travelAnim', 'impactAnim'] as const).map(k => <button key={k} className={'tiny' + (animTab === k ? ' active' : '')} onClick={() => setAnimTab(k)}>{k === 'spawnAnim' ? 'SPAWN' : k === 'travelAnim' ? 'TRAVEL' : 'DISAPPEAR'} ({p[k].length})</button>)}
          <Field label="FPS"><Num value={p.fps} min={1} max={60} onChange={v => set({ fps: v })} slider={false} width={60} /></Field>
        </div>
        <div className="frames-strip">
          {frames.map((f, i) => <div key={i} className="fthumb" onClick={() => set({ [animTab]: frames.filter((_, j) => j !== i) } as any)} title="Click to remove">
            <FrameThumb sheet={d.sheets.find(s => s.id === f.sheet)} index={f.index} size={60} /><span className="n">{i + 1}</span></div>)}
          {!frames.length && <span className="small dim">No frames — the {p.shape} shape is drawn instead.</span>}
        </div>
        <FramePicker def={d} size={44} highlight={frames} onPick={r => set({ [animTab]: [...frames, r] } as any)} onPickMany={rs => set({ [animTab]: [...frames, ...rs] } as any)} />
      </div>
    </div>
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>PREVIEW</h3>
      <SimPreview def={d} script={script} distance={260} />
    </div>
    {confirm && <Modal title="Delete projectile?" onClose={() => setConfirm(false)}>
      <p>{users.length ? `Used by ${users.map(u => u.name).join(', ')}.` : ''} Delete "{p.name}"?</p>
      <div className="row"><button className="danger" onClick={() => { update(x => { x.projectiles = x.projectiles.filter(y => y.id !== p.id); }); setConfirm(false); }}>DELETE</button><button onClick={() => setConfirm(false)}>CANCEL</button></div>
    </Modal>}
  </div>;
}

// ============================================================================
export function ParticlePreview({ effect, width = 280, height = 170, every = 40 }: { effect: EffectDef; width?: number; height?: number; every?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ps = new Particles();
    let raf = 0, t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = ref.current; if (!c) return;
      const g = c.getContext('2d')!;
      g.fillStyle = '#0a0a1c'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(0, c.height - 30, c.width, 1);
      if (t++ % every === 0) ps.spawn(effect, 0, 60, 1);
      ps.update();
      ps.draw(g, x => c.width / 2 + x, y => c.height - 30 - y, 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [effect, every]);
  return <canvas ref={ref} width={width} height={height} style={{ boxShadow: '0 0 0 2px #000', maxWidth: '100%' }} />;
}

const KINDS: ParticleKind[] = ['spark', 'smoke', 'dust', 'energy', 'fire', 'lightning', 'flash', 'shockwave', 'streak', 'ring', 'pixel', 'star'];

export function EffectsTab({ d, update }: { d: CharacterDef; update: Update }) {
  const fx = d.effects;
  const setFx = (fn: (e: CharacterDef['effects']) => void) => update(x => { const e = deepClone(x.effects); fn(e); x.effects = e; });
  const [sel, setSel] = useState(d.effectPresets[0]?.id || '');
  const preset = d.effectPresets.find(e => e.id === sel);
  const setPreset = (p: Partial<EffectDef>) => update(x => { x.effectPresets = x.effectPresets.map(e => e.id === sel ? { ...e, ...p } : e); });
  const dashScript: PreviewScript = (sim, t) => {
    const k = t % 80; const f = emptyInput();
    const fwd = sim.f[0].facing > 0 ? 'right' : 'left', back = fwd === 'right' ? 'left' : 'right';
    if (k === 5) { f.D = true; } if (k === 45) { f.D = true; f[back] = true; }
    if (k >= 45 && k < 47) f[back] = true;
    return f;
  };
  const jumpScript: PreviewScript = (_sim, t) => { const f = emptyInput(); if (t % 80 < 3) f.up = true; return f; };
  return <div className="col">
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))' }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>GHOST DASH TRAIL</h3>
        <p className="small dim">Transparent copies of the character follow dashes, air dashes and moves with "Afterimages" on.</p>
        <Field label="Enabled"><Check value={fx.ghostDash.enabled} onChange={v => setFx(e => { e.ghostDash.enabled = v; })} /></Field>
        <Field label="Afterimages"><Num value={fx.ghostDash.count} min={1} max={16} onChange={v => setFx(e => { e.ghostDash.count = v; })} /></Field>
        <Field label="Color"><Color value={fx.ghostDash.color} onChange={v => setFx(e => { e.ghostDash.color = v; })} /></Field>
        <Field label="Transparency"><Num value={fx.ghostDash.alpha} min={0.05} max={1} step={0.05} onChange={v => setFx(e => { e.ghostDash.alpha = v; })} /></Field>
        <Field label="Spacing" tip="Ticks between copies."><Num value={fx.ghostDash.spacing} min={1} max={10} onChange={v => setFx(e => { e.ghostDash.spacing = v; })} /></Field>
        <Field label="Fade time" tip="Ticks for a copy to fade out."><Num value={fx.ghostDash.fade} min={4} max={60} onChange={v => setFx(e => { e.ghostDash.fade = v; })} /></Field>
        <SimPreview def={d} script={dashScript} hitboxes={false} distance={260} />
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>JUMP & LANDING PARTICLES</h3>
        <p className="small dim">Automatic — no animation needed. Hard landings (falling from higher than a normal jump, or being knocked down) make bigger clouds.</p>
        {(['jumpDust', 'landDust'] as const).map(k => <div key={k}>
          <h4>{k === 'jumpDust' ? 'ON JUMP' : 'ON LANDING'}</h4>
          <Field label="Enabled"><Check value={fx[k].enabled} onChange={v => setFx(e => { e[k].enabled = v; })} /></Field>
          <Field label="Color"><Color value={fx[k].color} onChange={v => setFx(e => { e[k].color = v; })} /></Field>
          <Field label="Size"><Num value={fx[k].size} min={1} max={12} step={0.5} onChange={v => setFx(e => { e[k].size = v; })} /></Field>
          <Field label="Intensity"><Num value={fx[k].intensity} min={0.2} max={4} step={0.1} onChange={v => setFx(e => { e[k].intensity = v; })} /></Field>
          <Field label="Style"><select value={fx[k].style} onChange={ev => setFx(e => { e[k].style = ev.target.value as any; })}><option value="dust">Dust</option><option value="puff">Air puff</option><option value="ring">Ring</option><option value="sparkle">Sparkles</option></select></Field>
        </div>)}
        <Field label="Bigger hard landings"><Check value={fx.landDust.hardLanding} onChange={v => setFx(e => { e.landDust.hardLanding = v; })} /></Field>
        <SimPreview def={d} script={jumpScript} hitboxes={false} distance={300} />
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>OTHER CHARACTER EFFECTS</h3>
        <Field label="Run streaks"><Check value={fx.runStreaks.enabled} onChange={v => setFx(e => { e.runStreaks.enabled = v; })} /><Color value={fx.runStreaks.color} onChange={v => setFx(e => { e.runStreaks.color = v; })} /></Field>
        <Field label="Default hit spark"><EffectSelect def={d} value={fx.hitSpark} allowNone={false} onChange={v => setFx(e => { e.hitSpark = v; })} /></Field>
        <Field label="Block spark"><EffectSelect def={d} value={fx.blockSpark} allowNone={false} onChange={v => setFx(e => { e.blockSpark = v; })} /></Field>
        <Field label="Glowing aura" tip="Pulsing outline, e.g. when meter is full."><Check value={fx.aura.enabled} onChange={v => setFx(e => { e.aura.enabled = v; })} /><Color value={fx.aura.color} onChange={v => setFx(e => { e.aura.color = v; })} /></Field>
        <Field label="Aura only with 1+ bar"><Check value={fx.aura.whenMeterFull} onChange={v => setFx(e => { e.aura.whenMeterFull = v; })} /></Field>
        <Field label="Super flash color"><Color value={fx.superFlash} onChange={v => setFx(e => { e.superFlash = v; })} /></Field>
        <p className="small dim">Screen shake, impact flashes, motion streaks, shockwaves and afterimages for individual moves are set per attack (Attacks tab) and per cinematic event (Specials tab).</p>
      </div>
    </div>
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>PARTICLE EFFECT LIBRARY</h3>
      <p className="small dim">Create custom effects for this character, then attach them to attacks (start / active / hit), projectile trails & impacts, or timeline events.</p>
      <div className="split">
        <div className="col">
          <button className="go" onClick={() => { const e = newEffect(); update(x => { x.effectPresets = [...x.effectPresets, e]; }); setSel(e.id); }}>+ NEW EFFECT</button>
          <select value="" onChange={ev => { const b = BUILTIN_EFFECTS.find(z => z.id === ev.target.value); if (!b) return; const e = { ...deepClone(b), id: uid('fx'), name: b.name + ' (custom)' }; update(x => { x.effectPresets = [...x.effectPresets, e]; }); setSel(e.id); }}>
            <option value="">Copy a built-in…</option>{BUILTIN_EFFECTS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <div className="list">{d.effectPresets.map(e => <div key={e.id} className={'item' + (sel === e.id ? ' sel' : '')} onClick={() => setSel(e.id)}><span className="chip" style={{ background: e.color }} /><span className="grow">{e.name}</span><span className="small dim">{e.kind}</span></div>)}</div>
          <h4>BUILT-IN PREVIEWS</h4>
          <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))' }}>
            {BUILTIN_EFFECTS.slice(0, 8).map(b => <div key={b.id} title={b.name}><ParticlePreview effect={b} width={120} height={80} every={50} /><div className="small dim">{b.name}</div></div>)}
          </div>
        </div>
        {preset ? <div className="grid2">
          <div>
            <Field label="Name"><input value={preset.name} onChange={e => setPreset({ name: e.target.value })} /></Field>
            <Field label="Type"><select value={preset.kind} onChange={e => setPreset({ kind: e.target.value as ParticleKind })}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></Field>
            <Field label="Colors (start → end)"><Color value={preset.color} onChange={v => setPreset({ color: v })} /><Color value={preset.color2} onChange={v => setPreset({ color2: v })} /></Field>
            <Field label="Count"><Num value={preset.count} min={1} max={120} onChange={v => setPreset({ count: v })} /></Field>
            <Field label="Size"><Num value={preset.size} min={1} max={80} onChange={v => setPreset({ size: v })} /></Field>
            <Field label="Speed"><Num value={preset.speed} min={0} max={30} step={0.1} onChange={v => setPreset({ speed: v })} /></Field>
            <Field label="Lifetime"><Num value={preset.life} min={2} max={120} onChange={v => setPreset({ life: v })} /></Field>
            <Field label="Gravity" tip="Negative floats upward."><Num value={preset.gravity} min={-0.5} max={0.5} step={0.01} onChange={v => setPreset({ gravity: v })} /></Field>
            <Field label="Direction°"><Num value={preset.direction} min={-180} max={180} step={5} onChange={v => setPreset({ direction: v })} /></Field>
            <Field label="Spread°"><Num value={preset.spread} min={0} max={360} step={5} onChange={v => setPreset({ spread: v })} /></Field>
            <Field label="Screen shake"><Num value={preset.shake} min={0} max={20} onChange={v => setPreset({ shake: v })} /></Field>
            <Field label="Glow (additive)"><Check value={preset.glow} onChange={v => setPreset({ glow: v })} /></Field>
            <button className="tiny danger" onClick={() => { update(x => { x.effectPresets = x.effectPresets.filter(e => e.id !== sel); }); setSel(''); }}>DELETE EFFECT</button>
          </div>
          <div><ParticlePreview effect={preset} width={320} height={220} /></div>
        </div> : <p className="dim">Select or create an effect.</p>}
      </div>
    </div>
  </div>;
}

export type { FrameRef };
