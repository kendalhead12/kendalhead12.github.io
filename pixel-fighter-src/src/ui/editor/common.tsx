import React, { useEffect, useRef, useState } from 'react';
import type { CharacterDef, FrameRef, StageDef } from '../../engine/types';
import { Sim, VIEW_H, VIEW_W } from '../../engine/sim';
import { Renderer } from '../../engine/render';
import { defaultSettings, BUILTIN_EFFECTS, newStage } from '../../engine/defaults';
import { emptyInput, InputFrame } from '../../engine/input';
import { audio, SOUND_SLOTS, SYNTH_NAMES } from '../../engine/audio';
import { buildDummy } from '../../data/builtins';
import { FileButton, FrameThumb } from '../widgets';
import { parseFrameList, readFileAsDataURL } from '../../engine/util';
import { preloadAll } from '../../engine/assets';

// ---------------------------------------------------------------------------
let previewStage: StageDef | null = null;
export function getPreviewStage(): StageDef {
  if (previewStage) return previewStage;
  const s = newStage('Preview Room');
  s.id = 'preview'; s.width = 900; s.floorY = 300; s.skyTop = '#101030'; s.skyBottom = '#2a2a58'; s.floorColor = '#1a1a38';
  previewStage = s;
  return s;
}

export type PreviewScript = (sim: Sim, t: number) => InputFrame | void;

export function SimPreview({ def, opponent, script, hitboxes = true, restartKey, distance = 120, dummy = 'stand', height, onSim, interactive = false, label }:
  { def: CharacterDef; opponent?: CharacterDef; script?: PreviewScript; hitboxes?: boolean; restartKey?: unknown; distance?: number; dummy?: 'stand' | 'block'; height?: number; onSim?: (s: Sim) => void; interactive?: boolean; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scriptRef = useRef(script); scriptRef.current = script;
  const onSimRef = useRef(onSim); onSimRef.current = onSim;
  const [focused, setFocused] = useState(false);
  const focusRef = useRef(false); focusRef.current = focused;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const opp = opponent || buildDummy();
    const settings = defaultSettings(); settings.scanlines = false;
    const sim = new Sim({
      chars: [def, opp], stage: getPreviewStage(), roundsToWin: 99, roundTime: 0,
      training: { dummy, infiniteHealth: true, infiniteMeter: true }, damageScaling: true, cinematics: 'all', skipIntro: true,
    });
    sim.phase = 'fight';
    (sim as any)._dist = distance;
    const mid = sim.stage.width / 2;
    sim.f[0].x = mid - distance / 2; sim.f[1].x = mid + distance / 2;
    sim.cam.x = mid;
    const r = new Renderer(c, settings);
    preloadAll([...def.sheets.map(s => s.image), ...opp.sheets.map(s => s.image), def.portrait]);
    onSimRef.current?.(sim);
    let raf = 0, last = performance.now(), acc = 0, t = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      acc += Math.min(0.1, (now - last) / 1000); last = now;
      while (acc >= 1 / 60) {
        acc -= 1 / 60;
        let inp = scriptRef.current?.(sim, t++) || emptyInput();
        if (interactive && focusRef.current) {
          const { readKeyboard } = controlsMod;
          const k = readKeyboard(settingsForKeys());
          inp = { ...k };
        }
        const dummyInp = emptyInput();
        if (dummy === 'block') { const away = sim.f[0].x < sim.f[1].x ? 'right' : 'left'; dummyInp[away] = true; }
        sim.step([inp, dummyInp]);
        for (const e of sim.drain()) {
          r.handle(sim, e);
          if (e.type === 'sound') audio.play(e.key, e.owner >= 0 ? sim.f[e.owner].def : null);
        }
        sim.phase = 'fight';
      }
      r.draw(sim, { showHitboxes: hitboxes, hud: true });
      if (label) { const g = r.g; g.font = '8px "Press Start 2P"'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(label, 8, VIEW_H - 40); }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, opponent, restartKey, hitboxes, distance, dummy]);
  return <div style={{ position: 'relative' }}>
    <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="preview-canvas" tabIndex={interactive ? 0 : -1}
      style={height ? { maxWidth: height * 16 / 9 } : undefined}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
    {interactive && <div className="small dim">{focused ? 'Playing with your P1 keys — click outside to stop.' : 'Click the preview to control it with your P1 keys.'}</div>}
  </div>;
}

// lazy module refs (avoid circular imports at load)
import * as controlsMod from '../../engine/controls';
let keySettings = defaultSettings().p1Keys;
export function setPreviewKeys(k: typeof keySettings) { keySettings = k; }
const settingsForKeys = () => keySettings;

/** Repeatedly perform one of the character's attacks in a preview. */
export function attackLoop(atkId: string, every = 100): PreviewScript {
  return (sim, t) => {
    const f = sim.f[0], o = sim.f[1];
    const a = f.def.attacks.find(x => x.id === atkId);
    if (!a) return;
    const total = a.cinematic?.useTimeline ? a.cinematic.length + 40 : a.startup + a.active + a.recovery + 40;
    const period = Math.max(every, total + (a.cinematic?.alert.enabled ? a.cinematic.alert.duration : 0));
    const k = t % period;
    if (k === 0) {
      const mid = sim.stage.width / 2;
      f.x = mid - ((sim as any)._dist ?? 120) / 2; o.x = mid + ((sim as any)._dist ?? 120) / 2; f.facing = 1; o.facing = -1;
      for (const x of sim.f) { sim.setState(x, 'idle'); x.vx = x.vy = 0; x.y = 0; x.atk = null; x.cine = null; x.hp = x.def.stats.maxHealth; x.comboHits = 0; x.invuln = 0; }
      sim.projectiles = []; sim.bgOverlay = null; sim.alert = null; sim.freeze = 0; sim.cam.override = 0; sim.cam.targetZoom = 1;
    }
    if (k === 12) {
      if (a.stance === 'air') { f.y = 70; f.vy = 4; f.airActions = 0; sim.setState(f, 'air'); }
      sim.startAttack(f, a);
    }
  };
}

// ---------------------------------------------------------------------------
export function FramePicker({ def, onPick, onPickMany, highlight, size = 56 }: { def: CharacterDef; onPick: (r: FrameRef) => void; onPickMany?: (r: FrameRef[]) => void; highlight?: FrameRef[]; size?: number }) {
  const [sheetId, setSheetId] = useState(def.sheets[0]?.id || '');
  const [txt, setTxt] = useState('');
  const sheet = def.sheets.find(s => s.id === sheetId) || def.sheets[0];
  if (!def.sheets.length) return <div className="notice">No sprite sheets yet. Upload one on the <b>Sprites</b> tab (or use the Pixel Body Builder on Basics).</div>;
  return <div className="col" style={{ gap: 4 }}>
    <div className="row">
      {def.sheets.length > 1 && <select value={sheet.id} onChange={e => setSheetId(e.target.value)}>{def.sheets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
      {onPickMany && <>
        <input placeholder="e.g. 1-4, 7" value={txt} onChange={e => setTxt(e.target.value)} style={{ width: 130 }}
          onKeyDown={e => { if (e.key === 'Enter') { onPickMany(parseFrameList(txt, sheet.frames.length).map(index => ({ sheet: sheet.id, index }))); setTxt(''); } }} />
        <button className="tiny" onClick={() => { onPickMany(parseFrameList(txt, sheet.frames.length).map(index => ({ sheet: sheet.id, index }))); setTxt(''); }}>ADD FRAMES</button>
      </>}
      <span className="dim small">Click a frame to add it.</span>
    </div>
    <div className="frames-strip">
      {sheet.frames.map((_, i) => {
        const used = highlight?.some(h => h.sheet === sheet.id && h.index === i);
        return <div key={i} className={'fthumb' + (used ? ' used' : '')} style={{ width: size, height: size }} onClick={() => onPick({ sheet: sheet.id, index: i })} title={`Frame ${i + 1}`}>
          <FrameThumb sheet={sheet} index={i} size={size} /><span className="n">{i + 1}</span>
        </div>;
      })}
      {!sheet.frames.length && <span className="dim">This sheet has no frames yet — slice it on the Sprites tab.</span>}
    </div>
  </div>;
}

export function frameLabel(def: CharacterDef, r: FrameRef | null) {
  if (!r) return '—';
  const si = def.sheets.findIndex(s => s.id === r.sheet);
  return def.sheets.length > 1 ? `${si + 1}:${r.index + 1}` : `${r.index + 1}`;
}

export function EffectSelect({ def, value, onChange, allowNone = true }: { def: CharacterDef; value: string | undefined; onChange: (v: string) => void; allowNone?: boolean }) {
  return <select value={value || ''} onChange={e => onChange(e.target.value)}>
    {allowNone && <option value="">(none)</option>}
    <optgroup label="Built-in">{BUILTIN_EFFECTS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
    {def.effectPresets.length > 0 && <optgroup label="This character">{def.effectPresets.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
  </select>;
}

export function SoundSelect({ def, value, onChange }: { def: CharacterDef; value: string | undefined; onChange: (v: string) => void }) {
  const isData = value?.startsWith('data:');
  return <span className="row" style={{ gap: 4 }}>
    <select value={isData ? '__custom' : value || ''} onChange={e => { if (e.target.value !== '__custom') onChange(e.target.value); }}>
      <option value="">(silent)</option>
      <optgroup label="Character sound slots">{SOUND_SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}{def.sounds[s.key] ? ' ★' : ''}</option>)}</optgroup>
      <optgroup label="Built-in synth">{SYNTH_NAMES.map(n => <option key={n} value={n}>{n}</option>)}</optgroup>
      {isData && <option value="__custom">Uploaded clip</option>}
    </select>
    <button className="tiny icon" title="Play" onClick={() => value && audio.play(value, def)}>▶</button>
    <FileButton className="tiny" accept="audio/*" onFiles={async f => onChange(await readFileAsDataURL(f[0]))}>UPLOAD</FileButton>
  </span>;
}

export function ProjectileSelect({ def, value, onChange }: { def: CharacterDef; value: string | undefined; onChange: (v: string) => void }) {
  return <select value={value || ''} onChange={e => onChange(e.target.value)}>
    <option value="">(none)</option>
    {def.projectiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>;
}

export function AnimSelect({ def, value, onChange, allowNone }: { def: CharacterDef; value: string | undefined; onChange: (v: string) => void; allowNone?: boolean }) {
  const names = Object.keys(def.animations).filter(k => def.animations[k].frames.length);
  return <select value={value || ''} onChange={e => onChange(e.target.value)}>
    {allowNone && <option value="">(keep current)</option>}
    {names.map(n => <option key={n} value={n}>{n}</option>)}
    {value && !names.includes(value) && <option value={value}>{value} (missing)</option>}
  </select>;
}
