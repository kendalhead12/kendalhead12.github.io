import React, { useEffect, useRef, useState } from 'react';
import type { AttackDef, AttackType, Box, CharacterDef, FrameRef } from '../../engine/types';
import type { Update } from './CharacterEditor';
import type { EditorSession } from '../App';
import { defaultAlert, newAttack } from '../../engine/defaults';
import { animFrame, Sim } from '../../engine/sim';
import { drawCharFrame } from '../../engine/render';
import { getImage, imageToData, loadImage } from '../../engine/assets';
import { deepClone, readFileAsDataURL, uid } from '../../engine/util';
import { Check, Field, FileButton, FrameThumb, Modal, Num } from '../widgets';
import { attackLoop, EffectSelect, FramePicker, ProjectileSelect, SimPreview, SoundSelect, frameLabel } from './common';
import { inputText } from '../screens/Fight';

const TEMPLATES: { id: string; label: string; desc: string; make: (d: CharacterDef) => AttackDef }[] = [
  { id: 'punch', label: 'Quick Punch', desc: 'Fast light attack (Light button).', make: () => ({ ...newAttack('light', 'Punch'), sound: 'punch' }) },
  { id: 'kick', label: 'Kick', desc: 'Medium attack with more reach (Medium button).', make: () => ({ ...newAttack('medium', 'Kick'), sound: 'kick' }) },
  { id: 'heavy', label: 'Heavy Strike', desc: 'Slow, strong, cancels into specials (Heavy button).', make: () => ({ ...newAttack('heavy', 'Heavy Strike'), sound: 'punch' }) },
  { id: 'low', label: 'Low Sweep', desc: 'Down + Medium. Must be blocked low, knocks down.', make: () => ({ ...newAttack('medium', 'Low Sweep'), input: { button: 'M', dir: 'down', motion: 'none' }, hitLevel: 'low', knockdown: true, hitbox: { x: 10, y: 0, w: 50, h: 20 }, sound: 'kick' }) },
  { id: 'launcher', label: 'Launcher', desc: 'Down + Heavy. Pops the opponent into the air for juggles.', make: () => ({ ...newAttack('heavy', 'Launcher'), input: { button: 'H', dir: 'down', motion: 'none' }, launcher: true, knockup: 10, hitbox: { x: 6, y: 50, w: 34, h: 70 } }) },
  { id: 'air', label: 'Air Attack', desc: 'Used while jumping. Hits overhead.', make: () => ({ ...newAttack('medium', 'Air Kick'), stance: 'air', hitLevel: 'overhead', hitbox: { x: 6, y: 10, w: 44, h: 30 }, sound: 'kick' }) },
  { id: 'projectile', label: 'Projectile Special', desc: 'Special button: throws a projectile.', make: d => ({ ...newAttack('special', 'Fireball'), input: { button: 'S', dir: 'neutral', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'qcf' }, projectile: d.projectiles[0]?.id, spawnAt: 12, hitbox: { x: 0, y: 0, w: 0, h: 0 }, sound: 'special' }) },
  { id: 'rush', label: 'Rushing Special', desc: 'Forward + Special: dashes forward hitting several times.', make: () => ({ ...newAttack('special', 'Rush Attack'), input: { button: 'S', dir: 'forward', motion: 'none' }, moveX: 7, hits: 3, active: 18, afterimage: true, knockdown: true, sound: 'dash' }) },
  { id: 'uppercut', label: 'Rising Uppercut', desc: 'Up + Special: invincible anti-air that launches.', make: () => ({ ...newAttack('special', 'Rising Uppercut'), input: { button: 'S', dir: 'up', motion: 'none' }, input2: { button: 'A', dir: 'any', motion: 'dp' }, moveY: 10, invincible: 8, launcher: true, knockup: 11, knockdown: true, startup: 3, active: 9, recovery: 28, hitbox: { x: 4, y: 40, w: 40, h: 80 } }) },
  { id: 'super', label: 'Super (cinematic)', desc: 'Special + Heavy together, costs 1 bar, with a dramatic alert & timeline.', make: () => { const a = newAttack('super', 'Ultimate'); a.input = { button: 'SH', dir: 'any', motion: 'none' }; a.cinematic = { alert: defaultAlert('ULTIMATE'), timeline: [], length: 120, useTimeline: false }; a.invincible = 20; return a; } },
  { id: 'throw', label: 'Throw', desc: 'Grab button up close. Beats blocking.', make: () => ({ ...newAttack('throw', 'Throw'), sound: 'throw' }) },
];

export function AttacksTab({ d, update, session, setSession }: { d: CharacterDef; update: Update; session: EditorSession; setSession: React.Dispatch<React.SetStateAction<EditorSession | null>> }) {
  const selId = session.sel?.attack as string | undefined;
  const setSel = (id: string) => setSession(s => s && ({ ...s, sel: { ...(s.sel || {}), attack: id } }));
  const [creating, setCreating] = useState(false);
  const atk = d.attacks.find(a => a.id === selId) || d.attacks[0];
  const order: AttackType[] = ['light', 'medium', 'heavy', 'throw', 'special', 'super'];
  const sorted = [...d.attacks].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  const create = (t: typeof TEMPLATES[number]) => {
    const a = t.make(d);
    // prefill frames from the idle animation so it's never invisible
    const idle = d.animations.idle?.frames[0];
    if (idle && !a.frames.length) { a.frames = [{ ref: idle, boxes: [] }]; a.activeFrom = 0; a.activeTo = 0; }
    update(x => { x.attacks = [...x.attacks, a]; });
    setSel(a.id); setCreating(false);
  };
  return <div className="split">
    <div className="col">
      <button className="go big" onClick={() => setCreating(true)}>+ CREATE NEW ATTACK</button>
      <div className="list">
        {sorted.map(a => <div key={a.id} className={'item' + (atk?.id === a.id ? ' sel' : '')} onClick={() => setSel(a.id)}>
          <span className={'badge ' + (a.type === 'super' ? 'gold' : a.type === 'special' ? 'red' : a.type === 'throw' ? 'green' : 'blue')}>{a.type.slice(0, 3).toUpperCase()}</span>
          <div className="grow"><div>{a.name}{a.stance === 'air' ? ' ✈' : ''}</div><div className="small dim">{inputText(a.input)}</div></div>
        </div>)}
      </div>
      {!d.attacks.length && <p className="dim small">No attacks yet. Each character has its own moves — press Create New Attack.</p>}
    </div>
    <div>{atk ? <AttackEditor key={atk.id} d={d} atk={atk} update={update} onDelete={() => { update(x => { x.attacks = x.attacks.filter(a => a.id !== atk.id); }); }} onDuplicate={() => { const c = { ...deepClone(atk), id: uid('atk'), name: atk.name + ' Copy' }; update(x => { x.attacks = [...x.attacks, c]; }); setSel(c.id); }} />
      : <div className="panel center" style={{ minHeight: 240 }}><p className="pix" style={{ fontSize: 10 }}>CREATE YOUR FIRST ATTACK</p></div>}</div>
    {creating && <Modal title="Create New Attack" onClose={() => setCreating(false)} wide>
      <p className="dim">Pick a starting point — every value can be changed afterwards.</p>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
        {TEMPLATES.map(t => <button key={t.id} style={{ flexDirection: 'column', alignItems: 'flex-start', whiteSpace: 'normal', textAlign: 'left', padding: 12 }} onClick={() => create(t)}>
          <span style={{ fontSize: 11, color: 'var(--yellow)' }}>{t.label}</span>
          <span style={{ fontFamily: 'var(--body)', fontSize: 17 }}>{t.desc}</span>
        </button>)}
      </div>
    </Modal>}
  </div>;
}

// ---------------------------------------------------------------------------
function AttackEditor({ d, atk, update, onDelete, onDuplicate }: { d: CharacterDef; atk: AttackDef; update: Update; onDelete: () => void; onDuplicate: () => void }) {
  const set = (p: Partial<AttackDef>) => update(x => { x.attacks = x.attacks.map(a => a.id === atk.id ? { ...a, ...p } : a); });
  const [selFrame, setSelFrame] = useState(Math.min(atk.activeFrom, Math.max(0, atk.frames.length - 1)));
  const [showPicker, setShowPicker] = useState(false);
  const [block, setBlock] = useState(false);
  const [restart, setRestart] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const total = atk.startup + atk.active + atk.recovery;
  const N = atk.frames.length;
  const copyAnim = (name: string) => {
    const a = d.animations[name]; if (!a) return;
    const frames = a.frames.map(f => ({ ref: { sheet: f.sheet, index: f.index }, boxes: [] as Box[] }));
    const mid = Math.max(0, Math.floor(frames.length / 2));
    set({ frames, activeFrom: mid, activeTo: mid });
    setSelFrame(mid);
  };
  const projOnly = atk.hitbox.w === 0 && !atk.frames.some(f => f.boxes.length);
  return <div className="col">
    <div className="panel">
      <div className="row">
        <input value={atk.name} onChange={e => set({ name: e.target.value })} style={{ width: 240, fontSize: 22 }} />
        <span className="spacer" />
        <button className="tiny" onClick={onDuplicate}>DUPLICATE</button>
        <button className="tiny danger" onClick={() => setConfirm(true)}>DELETE</button>
      </div>
      <div className="grid2" style={{ marginTop: 6 }}>
        <div>
          <Field label="Attack type" tip="Light → Medium → Heavy chain together; Specials use the Special button; Supers cost meter."><select value={atk.type} onChange={e => {
            const t = e.target.value as AttackType;
            set({ type: t, ...(t === 'super' && !atk.cinematic ? { cinematic: { alert: defaultAlert(atk.name.toUpperCase()), timeline: [], length: 120, useTimeline: false }, energyCost: Math.max(atk.energyCost, 100) } : {}) });
          }}>
            {['light', 'medium', 'heavy', 'special', 'super', 'throw'].map(t => <option key={t}>{t}</option>)}
          </select></Field>
          <Field label="Used" tip="Where the move can be performed."><select value={atk.stance} onChange={e => set({ stance: e.target.value as any })}><option value="ground">On the ground</option><option value="air">In the air</option><option value="both">Ground or air</option></select></Field>
          <InputEditor label="Input" value={atk.input} onChange={v => set({ input: v })} />
          <Field label="Alt. input" tip="Optional second way to do it, e.g. a ↓↘→ motion."><Check value={!!atk.input2} onChange={v => set({ input2: v ? { button: 'A', dir: 'any', motion: 'qcf' } : null })} /></Field>
          {atk.input2 && <InputEditor label="" value={atk.input2} onChange={v => set({ input2: v })} />}
        </div>
        <div>
          <Field label="Damage" tip="Before attack-power/defense multipliers. Health is usually ~1000."><Num value={atk.damage} min={0} max={600} onChange={v => set({ damage: v })} /></Field>
          <Field label="Knockback" tip="How far the opponent is pushed."><Num value={atk.knockback} min={0} max={20} step={0.5} onChange={v => set({ knockback: v })} /></Field>
          <Field label="Range" tip="Width of the default hitbox in world pixels."><Num value={atk.hitbox.w} min={0} max={400} onChange={v => set({ hitbox: { ...atk.hitbox, w: v } })} /></Field>
          <Field label="Energy cost" tip="Meter needed (100 = one bar, max 300)."><Num value={atk.energyCost} min={0} max={300} step={5} onChange={v => set({ energyCost: v })} /></Field>
          <Field label="Cooldown" tip="Ticks (60 = 1 second) before it can be used again."><Num value={atk.cooldown} min={0} max={600} onChange={v => set({ cooldown: v })} /></Field>
          <div className="row">
            <Check value={atk.blockable} onChange={v => set({ blockable: v })} label="Can be blocked" />
            <Check value={atk.stance !== 'ground'} onChange={v => set({ stance: v ? 'both' : 'ground' })} label="Usable in air" />
            <Check value={atk.launcher} onChange={v => set({ launcher: v })} label="Launches upward" />
            <Check value={atk.knockdown} onChange={v => set({ knockdown: v })} label="Knockdown" />
          </div>
        </div>
      </div>
    </div>

    <div className="panel">
      <h3 style={{ marginTop: 0 }}>ANIMATION & TIMELINE</h3>
      <div className="row">
        <span className="dim small">Copy frames from animation:</span>
        <select value="" onChange={e => e.target.value && copyAnim(e.target.value)}>
          <option value="">choose…</option>
          {Object.keys(d.animations).filter(k => d.animations[k].frames.length).map(k => <option key={k}>{k}</option>)}
        </select>
        <button className="tiny go" onClick={() => setShowPicker(p => !p)}>{showPicker ? 'HIDE FRAMES' : '+ ADD FRAMES'}</button>
      </div>
      {showPicker && <div style={{ margin: '6px 0' }}><FramePicker def={d} highlight={atk.frames.map(f => f.ref!).filter(Boolean)} onPick={r => set({ frames: [...atk.frames, { ref: r, boxes: [] }] })} onPickMany={rs => set({ frames: [...atk.frames, ...rs.map(r => ({ ref: r, boxes: [] }))] })} /></div>}
      <div className="frames-strip" style={{ maxHeight: 'none', marginTop: 6 }}>
        {atk.frames.map((f, i) => {
          const phase = i < atk.activeFrom ? 'startup' : i <= atk.activeTo ? 'active' : 'recovery';
          const col = phase === 'active' ? 'var(--red)' : phase === 'startup' ? 'var(--yellow)' : '#5a7aff';
          return <div key={i} className="col" style={{ gap: 2, alignItems: 'center' }}>
            <div className={'fthumb' + (selFrame === i ? ' sel' : '')} style={{ boxShadow: `0 0 0 2px #000, 0 3px 0 0 ${col}${selFrame === i ? ', 0 0 0 3px var(--yellow)' : ''}` }} onClick={() => setSelFrame(i)}>
              {f.ref ? <FrameThumb sheet={d.sheets.find(s => s.id === f.ref!.sheet)} index={f.ref.index} size={60} /> : null}
              <span className="n">{i + 1}{f.boxes.length ? ' ▣' : ''}</span>
            </div>
            <span className="small" style={{ color: col }}>{phase}</span>
            <div className="row" style={{ gap: 0 }}>
              <button className="tiny icon" disabled={i === 0} onClick={() => { const n = [...atk.frames];[n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ frames: n }); }}>◀</button>
              <button className="tiny icon danger" onClick={() => { const n = atk.frames.filter((_, j) => j !== i); set({ frames: n, activeFrom: Math.min(atk.activeFrom, Math.max(0, n.length - 1)), activeTo: Math.min(atk.activeTo, Math.max(0, n.length - 1)) }); }}>✕</button>
              <button className="tiny icon" disabled={i === N - 1} onClick={() => { const n = [...atk.frames];[n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ frames: n }); }}>▶</button>
            </div>
          </div>;
        })}
        {!N && <span className="dim">No frames — the character will show its Idle pose. Add frames to animate this attack.</span>}
      </div>
      {N > 0 && <div className="row" style={{ marginTop: 6 }}>
        <span className="small">Frame {selFrame + 1}:</span>
        <button className="tiny" onClick={() => set({ activeFrom: selFrame, activeTo: Math.max(selFrame, atk.activeTo) })}>HITBOX STARTS HERE</button>
        <button className="tiny" onClick={() => set({ activeTo: selFrame, activeFrom: Math.min(selFrame, atk.activeFrom) })}>HITBOX ENDS HERE</button>
        <span className="small dim">Active frames: {atk.activeFrom + 1}–{atk.activeTo + 1}</span>
      </div>}
      <h4>TIMING — drag the edges (1 tick = 1/60 s)</h4>
      <PhaseBar atk={atk} set={set} />
      <div className="row" style={{ marginTop: 6 }}>
        <Field label="Startup"><Num value={atk.startup} min={1} max={120} onChange={v => set({ startup: v })} slider={false} width={64} /></Field>
        <Field label="Active"><Num value={atk.active} min={1} max={240} onChange={v => set({ active: v })} slider={false} width={64} /></Field>
        <Field label="Recovery"><Num value={atk.recovery} min={0} max={240} onChange={v => set({ recovery: v })} slider={false} width={64} /></Field>
      </div>
      <p className="small dim">Total {total} ticks ({(total / 60).toFixed(2)}s). Startup frames play while winding up, active frames are when the hitbox exists, recovery is the vulnerable cool-down.</p>
    </div>

    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>HITBOXES · FRAME {N ? selFrame + 1 : '—'}</h3>
        {atk.type === 'throw' ? <p className="small">Throws grab anyone within <b>Throw range</b> in front of you during the active frames (green box in Test mode).</p> :
          <HitboxEditor d={d} atk={atk} frameIdx={selFrame} set={set} />}
        {projOnly && atk.type !== 'throw' && <p className="small dim">This attack has no melee hitbox (range 0) — it only spawns a projectile.</p>}
      </div>
      <div className="panel">
        <div className="row"><h3 style={{ margin: 0 }}>PREVIEW VS DUMMY</h3><span className="spacer" />
          <Check value={block} onChange={setBlock} label="Dummy blocks" /><button className="tiny" onClick={() => setRestart(r => r + 1)}>↻</button></div>
        <SimPreview def={d} script={attackLoop(atk.id, 90)} hitboxes dummy={block ? 'block' : 'stand'} restartKey={`${restart}`} distance={atk.projectile ? 220 : 100} />
        <p className="small dim">Red = hitbox, blue = hurtbox, white = invincible.</p>
      </div>
    </div>

    <div className="panel">
      <h3 style={{ marginTop: 0 }}>ADVANCED</h3>
      <div className="grid2">
        <div>
          <Field label="Hit level" tip="Lows must be crouch-blocked, overheads stand-blocked."><select value={atk.hitLevel} onChange={e => set({ hitLevel: e.target.value as any })}><option value="mid">Mid</option><option value="low">Low</option><option value="overhead">Overhead</option></select></Field>
          <Field label="Hits" tip="Multi-hit: number of hits during the active window."><Num value={atk.hits} min={1} max={20} onChange={v => set({ hits: v })} slider={false} /></Field>
          <Field label="Hit-stun"><Num value={atk.hitstun} min={0} max={120} onChange={v => set({ hitstun: v })} slider={false} /></Field>
          <Field label="Block-stun"><Num value={atk.blockstun} min={0} max={120} onChange={v => set({ blockstun: v })} slider={false} /></Field>
          <Field label="Hit-stop" tip="Freeze frames on impact (impact feel)."><Num value={atk.hitstop} min={0} max={30} onChange={v => set({ hitstop: v })} slider={false} /></Field>
          <Field label="Launch height" tip="Vertical knockback for launchers / air hits."><Num value={atk.knockup} min={0} max={20} step={0.5} onChange={v => set({ knockup: v })} slider={false} /></Field>
          <Field label="Chip damage" tip="Fraction of damage dealt through blocks."><Num value={atk.chip} min={0} max={1} step={0.05} onChange={v => set({ chip: v })} slider={false} /></Field>
          <Field label="Energy gain"><Num value={atk.energyGain} min={0} max={100} onChange={v => set({ energyGain: v })} slider={false} /></Field>
        </div>
        <div>
          <Field label="Cancel into" tip="After this hits (or is blocked), what can interrupt its recovery."><select value={atk.cancel} onChange={e => set({ cancel: e.target.value as any })}>
            <option value="chain">Stronger normals, specials, supers</option><option value="special">Specials & supers</option><option value="super">Supers only</option><option value="none">Nothing</option>
          </select></Field>
          <Field label="Priority" tip="Wins hitbox clashes against lower priority."><Num value={atk.priority} min={0} max={10} onChange={v => set({ priority: v })} slider={false} /></Field>
          <Field label="Move forward" tip="Forward speed during startup+active."><Num value={atk.moveX} min={-12} max={20} step={0.5} onChange={v => set({ moveX: v })} slider={false} /></Field>
          <Field label="Jump up" tip="Upward speed at the end of startup (rising attacks)."><Num value={atk.moveY} min={0} max={20} step={0.5} onChange={v => set({ moveY: v })} slider={false} /></Field>
          <Field label="Invincible ticks" tip="Can't be hit for this many ticks from the start."><Num value={atk.invincible} min={0} max={120} onChange={v => set({ invincible: v })} slider={false} /></Field>
          {atk.type === 'throw' && <>
            <Field label="Throw range"><Num value={atk.throwRange ?? 46} min={10} max={200} onChange={v => set({ throwRange: v })} slider={false} /></Field>
            <Field label="Throw direction"><select value={atk.throwDir} onChange={e => set({ throwDir: e.target.value as any })}><option value="forward">Forward</option><option value="back">Backward</option></select></Field>
          </>}
        </div>
        <div>
          <Field label="Projectile" tip="Create projectiles on the Projectiles tab."><ProjectileSelect def={d} value={atk.projectile} onChange={v => set({ projectile: v || undefined })} /></Field>
          {atk.projectile && <>
            <Field label="Spawn at tick"><Num value={atk.spawnAt} min={0} max={total} onChange={v => set({ spawnAt: v })} slider={false} /></Field>
            <Field label="Spawn offset x/y"><Num value={atk.spawnOffset.x} onChange={v => set({ spawnOffset: { ...atk.spawnOffset, x: v } })} slider={false} width={64} /><Num value={atk.spawnOffset.y} onChange={v => set({ spawnOffset: { ...atk.spawnOffset, y: v } })} slider={false} width={64} /></Field>
          </>}
          <Field label="Start effect"><EffectSelect def={d} value={atk.startEffect} onChange={v => set({ startEffect: v || undefined })} /></Field>
          <Field label="Active effect" tip="Emitted repeatedly while the hitbox is active."><EffectSelect def={d} value={atk.activeEffect} onChange={v => set({ activeEffect: v || undefined })} /></Field>
          <Field label="Hit effect"><EffectSelect def={d} value={atk.hitEffect} onChange={v => set({ hitEffect: v || undefined })} /></Field>
          <Field label="Screen shake"><Num value={atk.shake} min={0} max={20} onChange={v => set({ shake: v })} slider={false} /></Field>
          <Field label="Afterimages"><Check value={atk.afterimage} onChange={v => set({ afterimage: v })} /></Field>
          <Field label="Glowing outline"><Check value={!!atk.glow} onChange={v => set({ glow: v ? '#ffd21a' : undefined })} />{atk.glow && <input type="color" value={atk.glow} onChange={e => set({ glow: e.target.value })} />}</Field>
        </div>
        <div>
          <Field label="Swing sound"><SoundSelect def={d} value={atk.sound} onChange={v => set({ sound: v || undefined })} /></Field>
          <Field label="Hit sound"><SoundSelect def={d} value={atk.hitSound} onChange={v => set({ hitSound: v || undefined })} /></Field>
          <Field label="Voice clip" tip="E.g. shouting the move name.">
            <FileButton className="tiny" accept="audio/*" onFiles={async f => set({ voice: await readFileAsDataURL(f[0]) })}>{atk.voice ? 'REPLACE' : 'UPLOAD'}</FileButton>
            {atk.voice && <button className="tiny danger" onClick={() => set({ voice: undefined })}>CLEAR</button>}
          </Field>
          {(atk.type === 'special' || atk.type === 'super') && <p className="small dim">Cinematic alerts and timelines for this move are edited on the <b>Specials</b> tab.</p>}
        </div>
      </div>
    </div>
    {confirm && <Modal title="Delete attack?" onClose={() => setConfirm(false)}>
      <p>Delete "{atk.name}"?</p>
      <div className="row"><button className="danger" onClick={() => { setConfirm(false); onDelete(); }}>DELETE</button><button onClick={() => setConfirm(false)}>CANCEL</button></div>
    </Modal>}
  </div>;
}

function InputEditor({ label, value, onChange }: { label: string; value: AttackDef['input']; onChange: (v: AttackDef['input']) => void }) {
  return <Field label={label} tip="Button + direction (relative to facing), or a motion input.">
    <select value={value.button} onChange={e => onChange({ ...value, button: e.target.value as any })}>
      <option value="L">Light</option><option value="M">Medium</option><option value="H">Heavy</option><option value="S">Special</option><option value="G">Grab</option><option value="A">Any attack</option><option value="SH">Special+Heavy</option>
    </select>
    <select value={value.motion !== 'none' ? 'm:' + value.motion : value.dir} onChange={e => {
      const v = e.target.value;
      if (v.startsWith('m:')) onChange({ ...value, motion: v.slice(2) as any, dir: 'any' }); else onChange({ ...value, motion: 'none', dir: v as any });
    }}>
      <option value="any">any direction</option><option value="neutral">no direction</option><option value="forward">→ forward</option><option value="back">← back</option>
      <option value="down">↓ down</option><option value="downforward">↘ down-forward</option><option value="up">↑ up</option>
      <option value="m:qcf">↓↘→ quarter-circle forward</option><option value="m:qcb">↓↙← quarter-circle back</option><option value="m:dp">→↓↘ dragon punch</option>
      <option value="m:hcb">→↘↓↙← half-circle back</option><option value="m:dqcf">↓↘→↓↘→ double QCF</option>
    </select>
  </Field>;
}

function PhaseBar({ atk, set }: { atk: AttackDef; set: (p: Partial<AttackDef>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const total = atk.startup + atk.active + atk.recovery;
  const span = Math.max(total, 40);
  const drag = (key: 'startup' | 'active' | 'recovery', min: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    const w = ref.current!.clientWidth;
    const pxPerTick = w / span;
    const x0 = e.clientX, v0 = atk[key];
    const move = (ev: PointerEvent) => set({ [key]: Math.max(min, Math.round(v0 + (ev.clientX - x0) / pxPerTick)) } as any);
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const seg = (k: 'startup' | 'active' | 'recovery', color: string, min: number) =>
    <div style={{ width: `${(atk[k] / span) * 100}%`, background: color }}>{k} {atk[k]}<span className="handle" onPointerDown={drag(k, min)} /></div>;
  return <div className="phase-bar" ref={ref}>
    {seg('startup', 'var(--yellow)', 1)}{seg('active', 'var(--red)', 1)}{seg('recovery', '#5a7aff', 0)}
    <div style={{ flex: 1, background: '#0a0a1c' }} />
  </div>;
}

// ---------------------------------------------------------------------------
/** Draw hitboxes on top of a frame. Coordinates are world pixels from the feet, x forward. */
function HitboxEditor({ d, atk, frameIdx, set }: { d: CharacterDef; atk: AttackDef; frameIdx: number; set: (p: Partial<AttackDef>) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [selBox, setSelBox] = useState(-1);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [, force] = useState(0);
  const fr = atk.frames[frameIdx];
  const isActive = frameIdx >= atk.activeFrom && frameIdx <= atk.activeTo;
  const boxes = fr?.boxes || [];
  const W = 360, H = 300;
  const k = Math.min(2, (H - 50) / Math.max(60, d.stats.height * 1.3));
  const cx = W * 0.35, oy = H - 30;
  const toWorld = (px: number, py: number) => ({ x: (px - cx) / k, y: (oy - py) / k });
  const setBoxes = (b: Box[]) => set({ frames: atk.frames.map((f, i) => i === frameIdx ? { ...f, boxes: b } : f) });

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0a0a1c'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, oy, W, 1);
    for (let x = cx % (20 * k); x < W; x += 20 * k) { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, 0, 1, H); }
    const ref2: FrameRef | null = fr?.ref || animFrame(d, 'idle', 0);
    if (ref2) {
      const sheet = d.sheets.find(s => s.id === ref2.sheet);
      if (sheet && !getImage(sheet.image)) loadImage(sheet.image).then(() => force(x => x + 1));
      drawCharFrame(g, d, ref2, cx, oy, 1, k);
    }
    const rect = (b: Box, col: string, fill: number, lw = 1) => {
      const x = cx + b.x * k, y = oy - (b.y + b.h) * k;
      g.fillStyle = col.replace('1)', `${fill})`); g.fillRect(x, y, b.w * k, b.h * k);
      g.strokeStyle = col; g.lineWidth = lw; g.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(b.w * k), Math.round(b.h * k));
    };
    rect({ x: -d.stats.width / 2, y: 0, w: d.stats.width, h: d.stats.height }, 'rgba(58,138,255,1)', 0.12);
    if (isActive && !boxes.length && atk.hitbox.w > 0) rect(atk.hitbox, 'rgba(255,140,60,1)', 0.15);
    boxes.forEach((b, i) => rect(b, 'rgba(255,48,48,1)', 0.25, i === selBox ? 3 : 1));
    if (drag) { const a = toWorld(drag.x0, drag.y0), b = toWorld(drag.x1, drag.y1); rect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }, 'rgba(94,255,138,1)', 0.2, 2); }
    g.fillStyle = '#ffff00'; g.fillRect(cx - 3, oy - 1, 7, 2);
    g.font = '8px "Press Start 2P"'; g.fillStyle = isActive ? '#ff6060' : '#8a8ab0'; g.textBaseline = 'top';
    g.fillText(isActive ? 'ACTIVE FRAME' : 'NOT ACTIVE (boxes ignored)', 6, 6);
  });

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; };
  const onDown = (e: React.PointerEvent) => {
    if (!fr) return;
    const p = pos(e); const w = toWorld(p.x, p.y);
    const hitI = boxes.findIndex(b => w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h);
    if (hitI >= 0) { setSelBox(hitI); return; }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: React.PointerEvent) => { if (drag) { const p = pos(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } };
  const onUp = () => {
    if (!drag) return;
    const a = toWorld(drag.x0, drag.y0), b = toWorld(drag.x1, drag.y1);
    const box = { x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)), w: Math.round(Math.abs(b.x - a.x)), h: Math.round(Math.abs(b.y - a.y)) };
    if (box.w > 3 && box.h > 3) { setBoxes([...boxes, box]); setSelBox(boxes.length); if (!isActive) set({ activeFrom: Math.min(atk.activeFrom, frameIdx), activeTo: Math.max(atk.activeTo, frameIdx) }); }
    setDrag(null);
  };

  const autoBox = async () => {
    if (!fr?.ref) return;
    const sheet = d.sheets.find(s => s.id === fr.ref!.sheet); const f = sheet?.frames[fr.ref.index];
    if (!sheet || !f) return;
    const img = await loadImage(sheet.image); const data = imageToData(img);
    const mirrored = d.facesLeft !== !!f.flipX;
    const bounds = (rect: typeof f) => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (data.data[(y * data.width + x) * 4 + 3] < 20) continue;
        let wx = (x - rect.x - rect.ox + (rect.dx || 0)) * d.scale; if (mirrored) wx = -wx;
        const wy = (rect.y + rect.oy - y - (rect.dy || 0)) * d.scale;
        if (wx < minX) minX = wx; if (wx > maxX) maxX = wx; if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      }
      return { minX, maxX, minY, maxY };
    };
    const idleRef = animFrame(d, 'idle', 0);
    const idleSheet = idleRef && d.sheets.find(s => s.id === idleRef.sheet);
    const idleFr = idleSheet?.frames[idleRef!.index];
    const front = idleFr && idleSheet === sheet ? bounds(idleFr).maxX : d.stats.width / 2;
    // collect the part of the attack frame that sticks out past the idle silhouette
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      if (data.data[(y * data.width + x) * 4 + 3] < 20) continue;
      let wx = (x - f.x - f.ox + (f.dx || 0)) * d.scale; if (mirrored) wx = -wx;
      if (wx < front - 6) continue;
      const wy = (f.y + f.oy - y - (f.dy || 0)) * d.scale;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx; if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
    }
    if (maxX < minX) { const b = bounds(f); minX = b.maxX - 30; maxX = b.maxX + 4; minY = (b.minY + b.maxY) / 2 - 10; maxY = minY + 20; }
    const box = { x: Math.round(minX - 4), y: Math.round(minY - 4), w: Math.round(maxX - minX + 8), h: Math.round(maxY - minY + 8) };
    setBoxes([...boxes, box]); setSelBox(boxes.length);
    if (!isActive) set({ activeFrom: Math.min(atk.activeFrom, frameIdx), activeTo: Math.max(atk.activeTo, frameIdx) });
  };

  if (!fr) return <div><p className="small">No frames: the default hitbox below is used during the active window.</p><DefaultBox atk={atk} set={set} /></div>;
  const b = boxes[selBox];
  return <div className="col">
    <canvas ref={ref} width={W} height={H} style={{ width: '100%', maxWidth: W, cursor: 'crosshair', boxShadow: '0 0 0 2px #000' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} />
    <p className="small dim" style={{ margin: 0 }}>Drag on the frame to draw a red hitbox. Click a box to select it. Orange = default hitbox (used when an active frame has none).</p>
    <div className="row">
      <button className="tiny go" onClick={autoBox} disabled={!fr.ref}>AUTO HITBOX</button>
      <button className="tiny" disabled={!boxes.length} onClick={() => set({ frames: atk.frames.map((f, i) => i >= atk.activeFrom && i <= atk.activeTo ? { ...f, boxes: deepClone(boxes) } : f) })}>COPY TO ALL ACTIVE</button>
      <button className="tiny" disabled={!boxes.length} onClick={() => set({ hitbox: { ...boxes[0] } })}>SET AS DEFAULT</button>
      <button className="tiny danger" disabled={!boxes.length} onClick={() => { setBoxes([]); setSelBox(-1); }}>CLEAR FRAME</button>
    </div>
    {b && <div className="row">
      <span className="small">Box {selBox + 1}:</span>
      {(['x', 'y', 'w', 'h'] as const).map(kk => <label key={kk} className="small">{kk}<input type="number" value={b[kk]} style={{ width: 60 }} onChange={e => setBoxes(boxes.map((q, i) => i === selBox ? { ...q, [kk]: +e.target.value } : q))} /></label>)}
      <button className="tiny danger" onClick={() => { setBoxes(boxes.filter((_, i) => i !== selBox)); setSelBox(-1); }}>DELETE</button>
    </div>}
    <DefaultBox atk={atk} set={set} />
  </div>;
}

function DefaultBox({ atk, set }: { atk: AttackDef; set: (p: Partial<AttackDef>) => void }) {
  return <div className="row">
    <span className="small dim">Default hitbox</span>
    {(['x', 'y', 'w', 'h'] as const).map(kk => <label key={kk} className="small">{kk}<input type="number" value={atk.hitbox[kk]} style={{ width: 58 }} onChange={e => set({ hitbox: { ...atk.hitbox, [kk]: +e.target.value } })} /></label>)}
  </div>;
}

export { Sim };
