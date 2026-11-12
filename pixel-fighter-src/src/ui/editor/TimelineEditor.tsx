import React, { useEffect, useRef, useState } from 'react';
import type { AttackDef, CharacterDef, CinematicAlert, TimelineEvent, TimelineTrack } from '../../engine/types';
import { TIMELINE_TRACKS } from '../../engine/types';
import type { Update } from './CharacterEditor';
import type { EditorSession } from '../App';
import { defaultAlert, newAttack, newTimelineEvent } from '../../engine/defaults';
import { deepClone, readFileAsDataURL, uid } from '../../engine/util';
import { Check, Color, Field, FileButton, Num, Portrait } from '../widgets';
import { AnimSelect, attackLoop, EffectSelect, ProjectileSelect, SimPreview, SoundSelect } from './common';
import type { Sim } from '../../engine/sim';
import { inputText } from '../screens/Fight';

const TRACK_COLOR: Record<TimelineTrack | 'alert', string> = {
  alert: '#ff5ec4', character: '#ffd21a', opponent: '#ff8a3a', camera: '#5ef0ff', effects: '#b46aff', projectiles: '#5eff8a', sound: '#9ab0ff', dialogue: '#ffffff', damage: '#ff4f5e',
};
const TRACK_HELP: Record<TimelineTrack, string> = {
  character: 'Change animation, move, teleport, afterimages',
  opponent: 'Opponent reaction (only while held by an opener hit)',
  camera: 'Zoom, focus and shake',
  effects: 'Particles, flashes, background changes, slow-motion',
  projectiles: 'Spawn one of your projectiles',
  sound: 'Play a sound effect',
  dialogue: 'Speech bubble (and text-to-speech if enabled)',
  damage: 'Hit checks. An OPENER must connect or the move stops',
};

function evLabel(d: CharacterDef, e: TimelineEvent): string {
  switch (e.track) {
    case 'character': return [e.anim, e.teleport && e.teleport !== 'none' ? 'teleport' : '', e.vx ? `→${e.vx}` : '', e.afterimage ? 'ghost' : ''].filter(Boolean).join(' ');
    case 'opponent': return e.oppState || '';
    case 'camera': return `zoom ${e.zoom}× ${e.focus || ''}`;
    case 'effects': return [e.effect?.replace('fx:', ''), e.bg ? 'bg' : '', e.flash ? 'flash' : '', e.slowmo ? `slow ${e.slowmo}` : ''].filter(Boolean).join(' ');
    case 'projectiles': return d.projectiles.find(p => p.id === e.projectile)?.name || '(choose)';
    case 'sound': return e.sound?.startsWith('data:') ? 'clip' : e.sound || '';
    case 'dialogue': return `"${e.text || ''}"`;
    case 'damage': return `${e.damage}${e.opener ? ' OPENER' : ''}${e.final ? ' FINAL' : ''}`;
  }
}

function addTemplate(a: AttackDef, kind: string, d: CharacterDef): TimelineEvent[] {
  const s = (a.cinematic!.alert.enabled ? a.cinematic!.alert.at + a.cinematic!.alert.duration : 0) + 4;
  const E = (t: number, track: TimelineTrack, o: Partial<TimelineEvent>): TimelineEvent => ({ ...newTimelineEvent(track, s + t), ...o });
  const anim = (want: string[]) => want.find(n => d.animations[n]?.frames.length) || 'idle';
  switch (kind) {
    case 'rush': return [
      E(0, 'character', { anim: anim(['dash', 'run', 'walk']), vx: 9, vy: 0, dur: 12, afterimage: true }),
      E(0, 'camera', { zoom: 1.3, focus: 'center', dur: 80 }),
      E(12, 'damage', { damage: 40, box: { x: 0, y: 20, w: 70, h: 110 }, opener: true, kbx: 0, kby: 0 }),
      E(12, 'character', { anim: anim(['victory', 'idle']), vx: 0, dur: 20 }),
      E(14, 'opponent', { oppState: 'hit', dur: 16 }),
      E(30, 'damage', { damage: 50, box: { x: 0, y: 20, w: 80, h: 120 } }),
      E(30, 'opponent', { oppState: 'float', dur: 20 }),
      E(40, 'effects', { bg: '#ff6a00', bgStyle: 'streaks', dur: 40, darken: 0.4 }),
      E(54, 'damage', { damage: 90, box: { x: 0, y: 0, w: 140, h: 160 }, kbx: 7, kby: 9, final: true, launch: true, hitEffect: 'fx:shockwave' }),
      E(54, 'effects', { effect: 'fx:explosion', ox: 80, oy: 60, flash: '#ffffff', shake: 10 }),
    ];
    case 'barrage': return [0, 10, 20, 30, 40].map(t => E(t, 'projectiles', { projectile: d.projectiles[0]?.id || '', ox: 50, oy: 60 + (t % 20) })).concat([E(0, 'camera', { zoom: 1.15, focus: 'self', dur: 60 })]);
    case 'slam': return [
      E(0, 'character', { anim: anim(['dash', 'walk']), vx: 7, dur: 14 }),
      E(8, 'damage', { damage: 40, box: { x: 0, y: 0, w: 60, h: 130 }, opener: true }),
      E(10, 'opponent', { oppState: 'pull', dur: 10 }),
      E(22, 'opponent', { oppState: 'float', dur: 20 }),
      E(44, 'damage', { damage: 120, box: { x: -40, y: 0, w: 180, h: 160 }, kbx: 5, kby: 10, final: true, launch: true }),
      E(44, 'effects', { effect: 'fx:shockwave', ox: 40, oy: 0, shake: 10 }),
    ];
    case 'teleport': return [
      E(0, 'effects', { effect: 'fx:smoke', ox: 0, oy: 40 }),
      E(4, 'character', { teleport: 'behindOpponent', afterimage: true, dur: 14 }),
      E(8, 'damage', { damage: 40, box: { x: 0, y: 0, w: 80, h: 140 }, opener: true }),
      E(20, 'character', { teleport: 'frontOfOpponent', afterimage: true, dur: 14 }),
      E(22, 'effects', { slowmo: 0.5, dur: 30, bg: '#1a0030', bgStyle: 'streaks', darken: 0.5 }),
      E(24, 'damage', { damage: 40, box: { x: -30, y: 0, w: 100, h: 140 } }),
      E(40, 'character', { teleport: 'behindOpponent', afterimage: true, dur: 14 }),
      E(44, 'damage', { damage: 80, box: { x: -30, y: 0, w: 120, h: 160 }, kbx: 6, kby: 8, final: true, launch: true }),
    ];
  }
  return [];
}

export function SpecialsTab({ d, update, session, setSession }: { d: CharacterDef; update: Update; session: EditorSession; setSession: React.Dispatch<React.SetStateAction<EditorSession | null>> }) {
  const specials = d.attacks.filter(a => a.type === 'special' || a.type === 'super');
  const selId = session.sel?.special as string | undefined;
  const atk = specials.find(a => a.id === selId) || specials.find(a => a.type === 'super') || specials[0];
  const setSel = (id: string) => setSession(s => s && ({ ...s, sel: { ...(s.sel || {}), special: id } }));
  const createSuper = () => {
    const a = newAttack('super', 'New Super');
    a.input = { button: 'SH', dir: 'any', motion: 'none' };
    a.cinematic = { alert: { ...defaultAlert('NEW SUPER'), at: 0 }, timeline: [], length: 150, useTimeline: true };
    a.invincible = 60;
    const idle = d.animations.idle?.frames[0]; if (idle) a.frames = [{ ref: idle, boxes: [] }];
    a.hitbox = { x: 0, y: 0, w: 0, h: 0 };
    a.cinematic.timeline = addTemplate(a, 'rush', d);
    update(x => { x.attacks = [...x.attacks, a]; });
    setSel(a.id);
  };
  return <div className="split">
    <div className="col">
      <button className="go big" onClick={createSuper}>+ NEW CINEMATIC SUPER</button>
      <div className="list">{specials.map(a => <div key={a.id} className={'item' + (atk?.id === a.id ? ' sel' : '')} onClick={() => setSel(a.id)}>
        <span className={'badge ' + (a.type === 'super' ? 'gold' : 'red')}>{a.type === 'super' ? 'SUP' : 'SPC'}</span>
        <div className="grow"><div>{a.name}</div><div className="small dim">{a.cinematic?.useTimeline ? 'timeline' : a.cinematic?.alert.enabled ? 'alert' : 'plain'} · {inputText(a.input)}</div></div>
      </div>)}</div>
      {!specials.length && <p className="small dim">Create a Special or Super attack (Attacks tab), or press the button above.</p>}
    </div>
    <div>{atk ? <SpecialEditor key={atk.id} d={d} atk={atk} update={update} /> : <div className="panel center" style={{ minHeight: 200 }}><p className="pix" style={{ fontSize: 10 }}>NO SPECIAL MOVES YET</p></div>}</div>
  </div>;
}

function SpecialEditor({ d, atk, update }: { d: CharacterDef; atk: AttackDef; update: Update }) {
  const cin = atk.cinematic || { alert: { ...defaultAlert(atk.name.toUpperCase()), enabled: false }, timeline: [], length: 120, useTimeline: false };
  const setCin = (p: Partial<NonNullable<AttackDef['cinematic']>>) => update(x => { x.attacks = x.attacks.map(a => a.id === atk.id ? { ...a, cinematic: { ...cin, ...p } } : a); });
  const setAlert = (p: Partial<CinematicAlert>) => setCin({ alert: { ...cin.alert, ...p } });
  const setAtk = (p: Partial<AttackDef>) => update(x => { x.attacks = x.attacks.map(a => a.id === atk.id ? { ...a, ...p } : a); });
  const [selEv, setSelEv] = useState<string | null>(null);
  const [restart, setRestart] = useState(0);
  const [blockDummy, setBlockDummy] = useState(false);
  const [dist, setDist] = useState(110);
  const simRef = useRef<Sim | null>(null);
  const al = cin.alert;
  const hasOpener = cin.timeline.some(e => e.track === 'damage' && e.opener);
  const firstDamage = [...cin.timeline].filter(e => e.track === 'damage').sort((a, b) => a.t - b.t)[0];
  return <div className="col">
    <div className="panel">
      <div className="row">
        <h2 style={{ margin: 0 }}>{atk.name}</h2>
        <span className="badge">{atk.type}</span>
        <span className="dim small">{inputText(atk.input)} · costs {atk.energyCost}</span>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <Check value={!!atk.cinematic && cin.useTimeline} onChange={v => setCin({ useTimeline: v, length: cin.length || 120 })} label="Use cinematic timeline" />
        <Check value={!!atk.cinematic && al.enabled} onChange={v => setAlert({ enabled: v })} label="Show special-attack alert" />
      </div>
      <p className="small dim">{cin.useTimeline ? 'The move is driven by the timeline below (the Attacks-tab frames show only until the first character event).' : 'The move plays its normal frames from the Attacks tab. The alert (if on) shows first.'}</p>
    </div>

    {al.enabled && <div className="panel">
      <h3 style={{ marginTop: 0 }}>SPECIAL ATTACK ALERT</h3>
      <div className="grid2">
        <div>
          <Field label="Attack name text"><input value={al.text} onChange={e => setAlert({ text: e.target.value })} /></Field>
          <Field label="Subtitle"><input value={al.subtitle} onChange={e => setAlert({ subtitle: e.target.value })} /></Field>
          <Field label="Style"><select value={al.style} onChange={e => setAlert({ style: e.target.value as any })}><option value="band">Cinematic band</option><option value="fullscreen">Full screen</option><option value="corner">Corner panel</option></select></Field>
          <Field label="Text font"><select value={al.font} onChange={e => setAlert({ font: e.target.value })}>
            <option value="Press Start 2P">Pixel (Press Start)</option><option value="VT323">Terminal (VT323)</option><option value="Impact">Impact</option><option value="Georgia">Serif</option><option value="Courier New">Courier</option>
          </select></Field>
          <Field label="Colors" tip="Background · streaks · text"><Color value={al.bgColor} onChange={v => setAlert({ bgColor: v })} /><Color value={al.streakColor} onChange={v => setAlert({ streakColor: v })} /><Color value={al.textColor} onChange={v => setAlert({ textColor: v })} /></Field>
          <Field label="Portrait"><select value={al.portrait} onChange={e => setAlert({ portrait: e.target.value as any })}><option value="character">Character portrait</option><option value="custom">Custom image</option><option value="none">None</option></select>
            {al.portrait === 'custom' && <FileButton className="tiny" accept="image/*" onFiles={async f => setAlert({ customPortrait: await readFileAsDataURL(f[0]) })}>UPLOAD</FileButton>}</Field>
          <div className="row">{al.portrait === 'custom' && al.customPortrait ? <img className="px" src={al.customPortrait} width={64} height={64} alt="" /> : al.portrait === 'character' ? <Portrait def={d} size={64} /> : null}</div>
        </div>
        <div>
          {cin.useTimeline && <Field label="Appears at tick"><Num value={al.at} min={0} max={cin.length} onChange={v => setAlert({ at: v })} slider={false} /></Field>}
          <Field label="Duration" tip="Ticks (60 = 1 second)."><Num value={al.duration} min={10} max={240} onChange={v => setAlert({ duration: v })} /></Field>
          <Field label="Freeze gameplay" tip="Opponent and projectiles stop while the alert plays."><Check value={al.freeze} onChange={v => setAlert({ freeze: v })} /></Field>
          <Field label="Darken screen"><Num value={al.darken} min={0} max={1} step={0.05} onChange={v => setAlert({ darken: v })} /></Field>
          <Field label="Camera zoom"><Num value={al.zoom} min={1} max={2} step={0.05} onChange={v => setAlert({ zoom: v })} /></Field>
          <Field label="Flash / shake"><Check value={al.flash} onChange={v => setAlert({ flash: v })} /><Num value={al.shake} min={0} max={12} onChange={v => setAlert({ shake: v })} slider={false} width={60} /></Field>
          <Field label="Sound"><SoundSelect def={d} value={al.sound || 'super'} onChange={v => setAlert({ sound: v })} /></Field>
          <p className="small dim">Whether alerts show for every special or only supers is also a player option (Options → Cinematic alerts).</p>
        </div>
      </div>
    </div>}

    {cin.useTimeline && <div className="panel">
      <div className="row">
        <h3 style={{ margin: 0 }}>TIMELINE</h3>
        <span className="spacer" />
        <span className="small dim">Insert template:</span>
        <select value="" onChange={e => { if (e.target.value) setCin({ timeline: [...cin.timeline, ...addTemplate(atk, e.target.value, d)] }); }}>
          <option value="">choose…</option><option value="rush">Rush combo</option><option value="barrage">Projectile barrage</option><option value="slam">Grab & slam</option><option value="teleport">Teleport strikes</option>
        </select>
        <button className="tiny danger" onClick={() => setCin({ timeline: [] })}>CLEAR</button>
        <Field label="Length (ticks)"><Num value={cin.length} min={10} max={900} onChange={v => setCin({ length: v })} slider={false} width={70} /></Field>
      </div>
      {hasOpener ? <div className="notice info">The first <b>OPENER</b> damage event must connect. If it misses (or is blocked), the rest of the move is cancelled — the opponent is never pulled into a combo that didn't land.</div>
        : firstDamage ? <div className="notice">No damage event is marked as OPENER, so every hit is checked normally and the opponent is never held. Mark the first hit as an opener for a guaranteed cinematic combo.</div> : null}
      <Timeline d={d} cin={cin} setCin={setCin} selEv={selEv} setSelEv={setSelEv} simRef={simRef} />
      <EventInspector d={d} cin={cin} setCin={setCin} id={selEv} setSel={setSelEv} />
    </div>}

    <div className="panel">
      <div className="row"><h3 style={{ margin: 0 }}>PREVIEW VS DUMMY</h3><span className="spacer" />
        <span className="small dim">Distance</span><input type="range" min={60} max={400} value={dist} onChange={e => setDist(+e.target.value)} />
        <Check value={blockDummy} onChange={setBlockDummy} label="Dummy blocks" />
        <button className="tiny" onClick={() => setRestart(r => r + 1)}>↻ REPLAY</button></div>
      <SimPreview def={d} script={attackLoop(atk.id, 60)} hitboxes={false} dummy={blockDummy ? 'block' : 'stand'} distance={dist} restartKey={restart} onSim={s => { simRef.current = s; }} />
      <p className="small dim">Move the dummy further away or make it block to check the miss behaviour.</p>
    </div>
    <div className="panel">
      <Field label="Energy cost"><Num value={atk.energyCost} min={0} max={300} step={5} onChange={v => setAtk({ energyCost: v })} /></Field>
      <Field label="Invincible ticks" tip="Supers are usually invincible through their startup."><Num value={atk.invincible} min={0} max={300} onChange={v => setAtk({ invincible: v })} /></Field>
    </div>
  </div>;
}

function Timeline({ d, cin, setCin, selEv, setSelEv, simRef }: { d: CharacterDef; cin: NonNullable<AttackDef['cinematic']>; setCin: (p: Partial<NonNullable<AttackDef['cinematic']>>) => void; selEv: string | null; setSelEv: (id: string | null) => void; simRef: React.MutableRefObject<Sim | null> }) {
  const [ppt, setPpt] = useState(4); // pixels per tick
  const [head, setHead] = useState(-1);
  const LABEL = 110;
  const width = LABEL + (cin.length + 30) * ppt;
  useEffect(() => {
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); const f = simRef.current?.f[0]; setHead(f?.cine ? f.cine.t : -1); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [simRef]);
  const startDrag = (e: React.PointerEvent, ev: TimelineEvent | 'alert', mode: 'move' | 'resize') => {
    e.stopPropagation(); e.preventDefault();
    if (ev !== 'alert') setSelEv(ev.id);
    const x0 = e.clientX;
    const orig = ev === 'alert' ? { t: cin.alert.at, dur: cin.alert.duration } : { t: ev.t, dur: ev.dur ?? 20 };
    const move = (m: PointerEvent) => {
      const dt = Math.round((m.clientX - x0) / ppt);
      if (ev === 'alert') {
        if (mode === 'move') setCin({ alert: { ...cin.alert, at: Math.max(0, orig.t + dt) } });
        else setCin({ alert: { ...cin.alert, duration: Math.max(10, orig.dur + dt) } });
      } else {
        setCin({ timeline: cin.timeline.map(x => x.id === ev.id ? (mode === 'move' ? { ...x, t: Math.max(0, Math.min(cin.length, orig.t + dt)) } : { ...x, dur: Math.max(1, orig.dur + dt) }) : x) });
      }
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };
  const addAt = (track: TimelineTrack, e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = Math.max(0, Math.round((e.clientX - r.left - LABEL) / ppt));
    const ev = newTimelineEvent(track, Math.min(t, cin.length));
    if (track === 'projectiles') ev.projectile = d.projectiles[0]?.id || '';
    setCin({ timeline: [...cin.timeline, ev] });
    setSelEv(ev.id);
  };
  const hasDur = (tr: TimelineTrack) => tr !== 'sound' && tr !== 'projectiles' && tr !== 'damage';
  const rulerMarks: number[] = [];
  for (let t = 0; t <= cin.length + 20; t += 6) rulerMarks.push(t);
  return <div>
    <div className="row" style={{ margin: '6px 0' }}>
      <span className="small dim">Zoom</span><input type="range" min={1.5} max={10} step={0.5} value={ppt} onChange={e => setPpt(+e.target.value)} />
      <span className="small dim">Drag blocks to retime · drag the right edge to change duration · double-click a row to add an event.</span>
    </div>
    <div className="timeline">
      <div style={{ width, position: 'relative' }}>
        <div className="tl-ruler">
          <div className="tl-label" style={{ position: 'absolute', height: 18 }}>TIME</div>
          {rulerMarks.map(t => <span key={t} style={{ left: LABEL + t * ppt, color: t % 60 === 0 ? 'var(--yellow)' : undefined }}>{t % 30 === 0 ? `${(t / 60).toFixed(1)}s` : t % 12 === 0 ? '·' : ''}</span>)}
          <span style={{ left: LABEL + cin.length * ppt, color: 'var(--red)' }}>END</span>
        </div>
        {cin.alert.enabled && <div className="tl-row">
          <div className="tl-label" style={{ color: TRACK_COLOR.alert }}>ALERT</div>
          <div className="tl-ev" style={{ left: LABEL + cin.alert.at * ppt, width: cin.alert.duration * ppt, background: TRACK_COLOR.alert }} onPointerDown={e => startDrag(e, 'alert', 'move')}>
            {cin.alert.text} {cin.alert.freeze ? '(freeze)' : ''}
            <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(0,0,0,.3)' }} onPointerDown={e => startDrag(e, 'alert', 'resize')} />
          </div>
        </div>}
        {TIMELINE_TRACKS.map(tr => <div key={tr} className="tl-row" onDoubleClick={e => addAt(tr, e)}>
          <div className="tl-label" title={TRACK_HELP[tr]} style={{ color: TRACK_COLOR[tr] }}>
            {tr.toUpperCase()}
            <button className="tiny icon" style={{ marginLeft: 'auto', padding: '2px 4px', fontSize: 7 }} title={`Add ${tr} event`} onClick={e => { e.stopPropagation(); const ev = newTimelineEvent(tr, Math.max(0, head >= 0 ? head : 0)); if (tr === 'projectiles') ev.projectile = d.projectiles[0]?.id || ''; setCin({ timeline: [...cin.timeline, ev] }); setSelEv(ev.id); }}>+</button>
          </div>
          {cin.timeline.filter(e => e.track === tr).map(e => {
            const w = hasDur(tr) ? Math.max(10, (e.dur ?? 20) * ppt) : Math.max(28, 30);
            return <div key={e.id} className={'tl-ev' + (selEv === e.id ? ' sel' : '')} title={`t=${e.t} (${(e.t / 60).toFixed(2)}s) ${evLabel(d, e)}`}
              style={{ left: LABEL + e.t * ppt, width: w, background: TRACK_COLOR[tr], opacity: e.t > cin.length ? 0.4 : 1, outline: e.opener ? '2px dashed #fff' : undefined }}
              onPointerDown={ev => startDrag(ev, e, 'move')} onDoubleClick={ev => ev.stopPropagation()}>
              {evLabel(d, e)}
              {hasDur(tr) && <span style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, cursor: 'ew-resize', background: 'rgba(0,0,0,.3)' }} onPointerDown={ev => startDrag(ev, e, 'resize')} />}
            </div>;
          })}
        </div>)}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL + cin.length * ppt, width: 2, background: 'rgba(255,79,94,.6)' }} />
        {head >= 0 && <div className="tl-playhead" style={{ left: LABEL + head * ppt }} />}
      </div>
    </div>
  </div>;
}

function EventInspector({ d, cin, setCin, id, setSel }: { d: CharacterDef; cin: NonNullable<AttackDef['cinematic']>; setCin: (p: Partial<NonNullable<AttackDef['cinematic']>>) => void; id: string | null; setSel: (id: string | null) => void }) {
  const e = cin.timeline.find(x => x.id === id);
  if (!e) return <p className="small dim" style={{ marginTop: 8 }}>Select an event to edit it.</p>;
  const set = (p: Partial<TimelineEvent>) => setCin({ timeline: cin.timeline.map(x => x.id === e.id ? { ...x, ...p } : x) });
  const N = (k: keyof TimelineEvent, label: string, min = -500, max = 500, step = 1, tip?: string) =>
    <Field label={label} tip={tip}><Num value={(e[k] as number) ?? 0} min={min} max={max} step={step} onChange={v => set({ [k]: v } as any)} slider={false} /></Field>;
  return <div className="panel inner" style={{ marginTop: 8 }}>
    <div className="row">
      <span className="badge" style={{ background: TRACK_COLOR[e.track], color: '#000' }}>{e.track.toUpperCase()}</span>
      <Field label="At tick"><Num value={e.t} min={0} max={cin.length} onChange={v => set({ t: v })} slider={false} /><span className="small dim">{(e.t / 60).toFixed(2)}s</span></Field>
      <span className="spacer" />
      <button className="tiny" onClick={() => { const c = { ...deepClone(e), id: uid('ev'), t: e.t + 10 }; setCin({ timeline: [...cin.timeline, c] }); setSel(c.id); }}>DUPLICATE</button>
      <button className="tiny danger" onClick={() => { setCin({ timeline: cin.timeline.filter(x => x.id !== e.id) }); setSel(null); }}>DELETE</button>
    </div>
    <div className="grid2">
      {e.track === 'character' && <>
        <div>
          <Field label="Animation"><AnimSelect def={d} value={e.anim} onChange={v => set({ anim: v || undefined })} allowNone /></Field>
          {N('vx', 'Move forward', -20, 20, 0.5, 'Speed while this event lasts.')}{N('vy', 'Move up', -20, 20, 0.5)}{N('dur', 'Duration', 1, 600)}
        </div>
        <div>
          <Field label="Teleport"><select value={e.teleport || 'none'} onChange={ev => set({ teleport: ev.target.value as any })}><option value="none">No</option><option value="behindOpponent">Behind opponent</option><option value="frontOfOpponent">In front of opponent</option></select></Field>
          <Field label="Afterimages"><Check value={!!e.afterimage} onChange={v => set({ afterimage: v })} /></Field>
        </div>
      </>}
      {e.track === 'opponent' && <div>
        <Field label="Reaction" tip="Only applies while the opponent is held by a connected opener."><select value={e.oppState} onChange={ev => set({ oppState: ev.target.value as any })}>
          <option value="hit">Stagger</option><option value="airHit">Pop into the air</option><option value="float">Float (suspended)</option><option value="knockdown">Slammed to the ground</option><option value="pull">Pulled in front of you</option>
        </select></Field>
        {N('dur', 'Duration', 1, 600)}
      </div>}
      {e.track === 'camera' && <div>
        {N('zoom', 'Zoom', 1, 2.5, 0.05)}
        <Field label="Focus"><select value={e.focus || 'center'} onChange={ev => set({ focus: ev.target.value as any })}><option value="center">Between fighters</option><option value="self">This character</option><option value="opponent">Opponent</option></select></Field>
        {N('dur', 'Duration', 1, 600)}{N('shake', 'Shake', 0, 20)}
      </div>}
      {e.track === 'effects' && <>
        <div>
          <Field label="Particle effect"><EffectSelect def={d} value={e.effect} onChange={v => set({ effect: v || undefined })} /></Field>
          {N('ox', 'Offset forward', -300, 300)}{N('oy', 'Offset up', -100, 300)}{N('shake', 'Screen shake', 0, 20)}
          <Field label="Screen flash"><Check value={!!e.flash} onChange={v => set({ flash: v ? '#ffffff' : undefined })} />{e.flash && <Color value={e.flash} onChange={v => set({ flash: v })} />}</Field>
        </div>
        <div>
          <Field label="Background change"><Check value={!!e.bg} onChange={v => set({ bg: v ? '#ff6a00' : undefined, bgStyle: e.bgStyle || 'streaks', dur: e.dur || 40 })} />{e.bg && <Color value={e.bg} onChange={v => set({ bg: v })} />}</Field>
          {e.bg && <><Field label="Background style"><select value={e.bgStyle || 'streaks'} onChange={ev => set({ bgStyle: ev.target.value as any })}><option value="streaks">Speed streaks</option><option value="radial">Radial burst</option><option value="solid">Solid color</option></select></Field>
            {N('darken', 'Darken', 0, 1, 0.05)}</>}
          <Field label="Slow motion"><Check value={!!e.slowmo} onChange={v => set({ slowmo: v ? 0.5 : undefined })} />{!!e.slowmo && <Num value={e.slowmo} min={0.1} max={0.95} step={0.05} onChange={v => set({ slowmo: v })} slider={false} />}</Field>
          {(e.bg || e.slowmo) && N('dur', 'Duration', 1, 600)}
        </div>
      </>}
      {e.track === 'projectiles' && <div>
        <Field label="Projectile"><ProjectileSelect def={d} value={e.projectile} onChange={v => set({ projectile: v })} /></Field>
        {N('ox', 'Offset forward', -300, 300)}{N('oy', 'Offset up', -100, 400)}
        {!d.projectiles.length && <p className="small warn">Create a projectile on the Projectiles tab first.</p>}
      </div>}
      {e.track === 'sound' && <div><Field label="Sound"><SoundSelect def={d} value={e.sound} onChange={v => set({ sound: v })} /></Field></div>}
      {e.track === 'dialogue' && <div>
        <Field label="Text"><input value={e.text || ''} onChange={ev => set({ text: ev.target.value })} style={{ width: 260 }} /></Field>
        <Field label="Speaker"><select value={e.speaker || 'self'} onChange={ev => set({ speaker: ev.target.value as any })}><option value="self">This character</option><option value="opponent">Opponent</option></select></Field>
        {N('dur', 'Duration', 10, 600)}
      </div>}
      {e.track === 'damage' && <>
        <div>
          {N('damage', 'Damage', 0, 1000)}
          <Field label="Opener" tip="Must connect, otherwise the move stops. When it connects the opponent is held for the rest of the cinematic."><Check value={!!e.opener} onChange={v => set({ opener: v })} /></Field>
          <Field label="Final hit" tip="Releases the opponent with knockback."><Check value={!!e.final} onChange={v => set({ final: v })} /></Field>
          <Field label="Launch"><Check value={!!e.launch} onChange={v => set({ launch: v })} /></Field>
          {N('kbx', 'Knockback', -20, 20, 0.5)}{N('kby', 'Knock-up', 0, 20, 0.5)}
          <Field label="Hit effect"><EffectSelect def={d} value={e.hitEffect} onChange={v => set({ hitEffect: v || undefined })} /></Field>
        </div>
        <div>
          <p className="small dim" style={{ marginTop: 0 }}>Hit area (world px from the feet, x forward):</p>
          {(['x', 'y', 'w', 'h'] as const).map(k => <Field key={k} label={`Box ${k}`}><Num value={e.box?.[k] ?? 0} min={-300} max={600} onChange={v => set({ box: { ...(e.box || { x: 0, y: 0, w: 60, h: 100 }), [k]: v } })} slider={false} /></Field>)}
        </div>
      </>}
    </div>
  </div>;
}
