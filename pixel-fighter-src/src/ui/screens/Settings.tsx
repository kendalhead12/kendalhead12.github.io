import React, { useEffect, useState } from 'react';
import { useNav } from '../App';
import { useStore } from '../store';
import type { KeyBindings, Settings } from '../../engine/types';
import { DEFAULT_P1, DEFAULT_P2 } from '../../engine/defaults';
import { keyLabel } from '../../engine/controls';
import { Check, Field, FileButton, Modal } from '../widgets';
import { estimateUsage } from '../../data/storage';
import { audio } from '../../engine/audio';

const ACTIONS: { k: keyof KeyBindings; label: string }[] = [
  { k: 'up', label: 'Up / Jump' }, { k: 'down', label: 'Down / Crouch' }, { k: 'left', label: 'Left' }, { k: 'right', label: 'Right' },
  { k: 'L', label: 'Light attack' }, { k: 'M', label: 'Medium attack' }, { k: 'H', label: 'Heavy attack' },
  { k: 'S', label: 'Special' }, { k: 'G', label: 'Grab / Throw' }, { k: 'D', label: 'Dash' }, { k: 'pause', label: 'Pause' },
];

function KeyTable({ keys, onChange, title }: { keys: KeyBindings; onChange: (k: KeyBindings) => void; title: string }) {
  const [wait, setWait] = useState<{ k: keyof KeyBindings; slot: number } | null>(null);
  useEffect(() => {
    if (!wait) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault(); e.stopPropagation();
      const list = [...keys[wait.k]];
      list[wait.slot] = e.code;
      onChange({ ...keys, [wait.k]: list.filter(Boolean) });
      setWait(null);
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [wait, keys, onChange]);
  return <div className="panel inner">
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    <table className="movelist"><tbody>
      {ACTIONS.map(a => <tr key={a.k}>
        <td>{a.label}</td>
        {[0, 1].map(slot => <td key={slot}>
          <button className={'tiny' + (wait?.k === a.k && wait.slot === slot ? ' active' : '')} onClick={() => setWait({ k: a.k, slot })} title="Click, then press a key">
            {wait?.k === a.k && wait.slot === slot ? 'PRESS KEY…' : keyLabel(keys[a.k][slot] || '')}
          </button>
          {keys[a.k][slot] && <button className="tiny ghost" title="Clear" onClick={() => onChange({ ...keys, [a.k]: keys[a.k].filter((_, i) => i !== slot) })}>✕</button>}
        </td>)}
      </tr>)}
    </tbody></table>
  </div>;
}

export function SettingsScreen() {
  const nav = useNav();
  const store = useStore();
  const s = store.settings;
  const up = (p: Partial<Settings>) => store.updateSettings(p);
  const [usage, setUsage] = useState('');
  const [pads, setPads] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { estimateUsage().then(setUsage); }, [store.characters, store.stages]);
  useEffect(() => {
    const t = setInterval(() => setPads((navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(Boolean).map(p => `#${p!.index}: ${p!.id.slice(0, 40)}`)), 800);
    return () => clearInterval(t);
  }, []);
  const conflicts = (() => {
    const seen = new Map<string, string>(); const out: string[] = [];
    for (const [p, keys] of [['P1', s.p1Keys], ['P2', s.p2Keys]] as const) for (const a of ACTIONS) for (const c of keys[a.k]) {
      const key = c; const who = `${p} ${a.label}`;
      if (seen.has(key) && !(a.k === 'pause')) out.push(`${keyLabel(c)} is used by ${seen.get(key)} and ${who}`); else seen.set(key, who);
    }
    return out;
  })();
  return <div className="screen" style={{ padding: 12 }}>
    <div className="row"><button onClick={() => nav.go({ s: 'title' })}>◀ MENU</button><h1 style={{ margin: 0, fontSize: 18 }}>OPTIONS & CONTROLS</h1></div>
    <div className="grid2" style={{ marginTop: 12 }}>
      <KeyTable title="PLAYER 1 KEYS" keys={s.p1Keys} onChange={k => up({ p1Keys: k })} />
      <KeyTable title="PLAYER 2 KEYS" keys={s.p2Keys} onChange={k => up({ p2Keys: k })} />
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>GAMEPADS & TOUCH</h3>
        <p className="small">Standard layout: <b>A</b> Light · <b>X</b> Medium · <b>Y</b> Heavy · <b>B</b> Special · <b>LB</b> Grab · <b>RB</b> Dash · <b>LT</b> Super (Special+Heavy) · <b>Start</b> Pause. D-pad or left stick to move.</p>
        <p className="small dim">Connected: {pads.length ? pads.join(', ') : 'none detected (press a button on your pad)'}</p>
        <Field label="Touch controls" help="Virtual joystick + buttons for phones and tablets.">
          <select value={s.touchControls} onChange={e => up({ touchControls: e.target.value as Settings['touchControls'] })}>
            <option value="auto">Auto (touch devices)</option><option value="on">Always on</option><option value="off">Off</option>
          </select>
        </Field>
        <div className="row"><button className="tiny" onClick={() => up({ p1Keys: JSON.parse(JSON.stringify(DEFAULT_P1)), p2Keys: JSON.parse(JSON.stringify(DEFAULT_P2)) })}>RESET KEYS</button></div>
        {conflicts.length > 0 && <div className="notice">{conflicts.slice(0, 4).map(c => <div key={c}>{c}</div>)}</div>}
      </div>
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>AUDIO</h3>
        {(['master', 'music', 'sfx', 'voice'] as const).map(k => <Field key={k} label={k === 'sfx' ? 'Sound effects' : k === 'voice' ? 'Voices' : k[0].toUpperCase() + k.slice(1)}>
          <input type="range" min={0} max={1} step={0.05} value={s.volume[k]} onChange={e => up({ volume: { ...s.volume, [k]: +e.target.value } })} onMouseUp={() => audio.play(k === 'voice' ? 'confirm' : 'hit')} />
          <span className="small">{Math.round(s.volume[k] * 100)}%</span>
        </Field>)}
        <Field label="Speak dialogue" help="Use the browser's text-to-speech for lines that have no recorded voice clip."><Check value={s.tts} onChange={v => up({ tts: v })} /></Field>
      </div>
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>GAMEPLAY</h3>
        <Field label="Round time"><select value={s.roundTime} onChange={e => up({ roundTime: +e.target.value })}><option value={30}>30</option><option value={60}>60</option><option value={99}>99</option><option value={0}>∞</option></select></Field>
        <Field label="Rounds to win"><select value={s.rounds} onChange={e => up({ rounds: +e.target.value })}><option value={1}>1</option><option value={2}>2 (best of 3)</option><option value={3}>3 (best of 5)</option></select></Field>
        <Field label="CPU difficulty"><input type="range" min={1} max={8} value={s.aiLevel} onChange={e => up({ aiLevel: +e.target.value })} /><span className="pix" style={{ fontSize: 10 }}>{s.aiLevel}</span></Field>
        <Field label="Damage scaling" tip="Each extra hit in a combo deals 10% less damage (minimum 30%)."><Check value={s.damageScaling} onChange={v => up({ damageScaling: v })} /></Field>
        <Field label="Cinematic alerts" help="Which moves show their special-attack alert.">
          <select value={s.cinematics} onChange={e => up({ cinematics: e.target.value as Settings['cinematics'] })}><option value="all">Every move that has one</option><option value="supers">Only ultimates (supers)</option><option value="off">Off</option></select>
        </Field>
      </div>
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>VISUAL EFFECTS</h3>
        <Field label="Screen shake"><input type="range" min={0} max={2} step={0.1} value={s.shake} onChange={e => up({ shake: +e.target.value })} /><span className="small">{s.shake.toFixed(1)}×</span></Field>
        <Field label="Hit-stop"><input type="range" min={0} max={2} step={0.1} value={s.hitstop} onChange={e => up({ hitstop: +e.target.value })} /><span className="small">{s.hitstop.toFixed(1)}×</span></Field>
        <Field label="Particles"><input type="range" min={0} max={2} step={0.1} value={s.particles} onChange={e => up({ particles: +e.target.value })} /><span className="small">{s.particles.toFixed(1)}×</span></Field>
        <Field label="CRT scanlines"><Check value={s.scanlines} onChange={v => up({ scanlines: v })} /></Field>
      </div>
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>DATA</h3>
        <p className="small">Everything is saved in this browser (IndexedDB). {usage}</p>
        <div className="row">
          <button onClick={() => store.exportAll()}>EXPORT EVERYTHING</button>
          <FileButton accept=".json,application/json" multiple onFiles={async fs => {
            try { const r = await store.importFiles(fs); store.toast(`Imported ${r.characters.length} character(s), ${r.stages.length} stage(s)`); } catch (e: any) { store.toast(e.message, true); }
          }}>IMPORT FILES</FileButton>
          <button className="danger" onClick={() => setConfirmReset(true)}>RESTORE BUILT-INS</button>
        </div>
      </div>
    </div>
    {confirmReset && <Modal title="Restore built-in content?" onClose={() => setConfirmReset(false)}>
      <p>Re-creates the original example fighters and stages. Any edits you made directly to them are replaced. Your own characters are not touched.</p>
      <div className="row"><button className="danger" onClick={async () => { await store.restoreDefaults(); setConfirmReset(false); store.toast('Built-ins restored'); }}>RESTORE</button><button onClick={() => setConfirmReset(false)}>CANCEL</button></div>
    </Modal>}
  </div>;
}
