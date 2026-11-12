import React, { useEffect, useMemo, useState } from 'react';
import { EditorSession, useNav } from '../App';
import { useStore } from '../store';
import type { CharacterDef } from '../../engine/types';
import { newCharacter, normalizeCharacter } from '../../engine/defaults';
import { deepClone, readFileAsDataURL } from '../../engine/util';
import { Check, Color, Field, FileButton, LinesEditor, Modal, Num, Portrait } from '../widgets';
import { SpritesTab, AnimationsTab } from './SpriteEditor';
import { AttacksTab } from './AttackEditor';
import { ProjectilesTab, EffectsTab } from './FxEditor';
import { SpecialsTab } from './TimelineEditor';
import { audio, SOUND_SLOTS, VOICE_SLOTS } from '../../engine/audio';
import { BodySpec, generatePortrait } from '../../data/procgen';
import { buildDummy, buildFromBody } from '../../data/builtins';
import { animFrame } from '../../engine/sim';
import { getImage, loadImage, makeCanvas } from '../../engine/assets';
import { setPreviewKeys } from './common';

export type Update = (fn: (d: CharacterDef) => void) => void;

const TABS = [
  { id: 'basics', label: '1 BASICS' }, { id: 'sprites', label: '2 SPRITES' }, { id: 'anims', label: '3 ANIMATIONS' },
  { id: 'attacks', label: '4 ATTACKS' }, { id: 'projectiles', label: '5 PROJECTILES' }, { id: 'effects', label: '6 EFFECTS' },
  { id: 'specials', label: '7 SPECIALS' }, { id: 'dialogue', label: '8 DIALOGUE' }, { id: 'audio', label: '9 AUDIO' },
];

export function CharacterEditor({ id, session, setSession }: { id: string | null; session: EditorSession | null; setSession: React.Dispatch<React.SetStateAction<EditorSession | null>> }) {
  const nav = useNav();
  const store = useStore();
  const [picker, setPicker] = useState(!id && !session);
  const [leaveAsk, setLeaveAsk] = useState<null | (() => void)>(null);
  useEffect(() => { setPreviewKeys(store.settings.p1Keys); }, [store.settings.p1Keys]);

  // open the requested character (keep an in-progress session for the same id)
  useEffect(() => {
    if (session && (id === null || session.draft.id === id)) return;
    if (id) {
      const c = store.characters.find(x => x.id === id);
      if (c) { setSession({ draft: deepClone(c), dirty: false, tab: 'basics' }); setPicker(false); }
    }
  }, [id]);

  if (picker || !session) return <CharacterPicker onOpen={c => { setSession({ draft: deepClone(c), dirty: false, tab: 'basics' }); setPicker(false); }}
    onNew={() => { const c = newCharacter('New Fighter'); setSession({ draft: c, dirty: true, tab: 'basics' }); setPicker(false); }} />;

  const d = session.draft;
  const update: Update = fn => setSession(s => {
    if (!s) return s;
    const n = { ...s.draft };
    fn(n);
    return { ...s, draft: n, dirty: true };
  });
  const setTab = (tab: string) => setSession(s => s && ({ ...s, tab }));
  const saved = store.characters.some(c => c.id === d.id);
  const save = async () => {
    if (!d.name.trim()) { store.toast('Give your character a name first.', true); setTab('basics'); return false; }
    const clash = store.characters.find(c => c.id !== d.id && c.name.trim().toLowerCase() === d.name.trim().toLowerCase());
    if (clash) store.toast(`Note: another fighter is also called "${clash.name}" — dialogue matching uses names.`, true);
    try {
      await store.saveCharacter(normalizeCharacter(deepClone(d)));
      setSession(s => s && ({ ...s, dirty: false }));
      store.toast(`Saved "${d.name}" — it's selectable now!`);
      audio.play('confirm');
      return true;
    } catch { return false; }
  };
  const test = () => {
    const opp = store.characters.find(c => c.id !== d.id) || buildDummy();
    const dummy = buildDummy();
    nav.go({ s: 'fight', spec: { mode: 'test', p1: normalizeCharacter(deepClone(d)), p2: dummy || opp, stage: store.stages[0], p1Human: true, p2Human: false, aiLevel: store.settings.aiLevel } });
  };
  const leave = (to: () => void) => { if (session.dirty) setLeaveAsk(() => to); else { setSession(null); to(); } };

  const issues = checklist(d);
  return <div className="editor">
    <div className="ed-top">
      <button onClick={() => leave(() => nav.go({ s: 'title' }))}>◀ MENU</button>
      <button onClick={() => leave(() => { setPicker(true); })}>☰ ALL FIGHTERS</button>
      <span className="title">{d.name || 'Unnamed'}{session.dirty ? ' *' : ''}</span>
      <span className="spacer" />
      <button className="blue" onClick={test} title="Fight a training dummy with this character right now (unsaved changes included)">▶ TEST CHARACTER</button>
      <button className="go" onClick={save}>💾 SAVE</button>
      <button onClick={() => store.exportCharacter(normalizeCharacter(deepClone(d)))}>EXPORT</button>
      {saved && <button onClick={async () => { if (session.dirty) await save(); const c = await store.duplicateCharacter(d.id); if (c) { setSession({ draft: deepClone(c), dirty: false, tab: session.tab }); store.toast(`Now editing "${c.name}"`); } }}>DUPLICATE</button>}
    </div>
    <div className="tabs">{TABS.map(t => <button key={t.id} className={'tab' + (session.tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    <div className="ed-body">
      {session.tab === 'basics' && <BasicsTab d={d} update={update} issues={issues} setTab={setTab} />}
      {session.tab === 'sprites' && <SpritesTab d={d} update={update} />}
      {session.tab === 'anims' && <AnimationsTab d={d} update={update} />}
      {session.tab === 'attacks' && <AttacksTab d={d} update={update} session={session} setSession={setSession} />}
      {session.tab === 'projectiles' && <ProjectilesTab d={d} update={update} />}
      {session.tab === 'effects' && <EffectsTab d={d} update={update} />}
      {session.tab === 'specials' && <SpecialsTab d={d} update={update} session={session} setSession={setSession} />}
      {session.tab === 'dialogue' && <DialogueTab d={d} update={update} />}
      {session.tab === 'audio' && <AudioTab d={d} update={update} />}
    </div>
    {leaveAsk && <Modal title="Unsaved changes" onClose={() => setLeaveAsk(null)}>
      <p>You have unsaved changes to <b>{d.name}</b>.</p>
      <div className="row">
        <button className="go" onClick={async () => { if (await save()) { const f = leaveAsk; setLeaveAsk(null); setSession(null); f(); } }}>SAVE & LEAVE</button>
        <button className="danger" onClick={() => { const f = leaveAsk; setLeaveAsk(null); setSession(null); f(); }}>DISCARD</button>
        <button onClick={() => setLeaveAsk(null)}>KEEP EDITING</button>
      </div>
    </Modal>}
  </div>;
}

function checklist(d: CharacterDef) {
  const has = (a: string) => !!d.animations[a]?.frames.length;
  return [
    { ok: !!d.name.trim(), text: 'Name your character', tab: 'basics' },
    { ok: d.sheets.length > 0, text: 'Upload a sprite sheet (or use the Pixel Body Builder)', tab: 'sprites' },
    { ok: d.sheets.some(s => s.frames.length > 0), text: 'Slice the sheet into frames', tab: 'sprites' },
    { ok: has('idle'), text: 'Pick Idle animation frames', tab: 'anims' },
    { ok: has('walk'), text: 'Pick Walk animation frames', tab: 'anims' },
    { ok: has('jumpUp') || has('jumpDown'), text: 'Pick Jump frames (optional — falls back to Idle)', tab: 'anims', optional: true },
    { ok: d.attacks.some(a => ['light', 'medium', 'heavy'].includes(a.type)), text: 'Create a basic attack (e.g. a punch)', tab: 'attacks' },
    { ok: d.attacks.some(a => a.type === 'special' || a.type === 'super'), text: 'Create a special or super attack', tab: 'attacks', optional: true },
    { ok: !!d.portrait, text: 'Add a portrait (optional — auto-cropped from Idle)', tab: 'basics', optional: true },
    { ok: d.dialogue.victory.some(Boolean), text: 'Write a victory line', tab: 'dialogue', optional: true },
  ];
}

// ---------------------------------------------------------------------------
function CharacterPicker({ onOpen, onNew }: { onOpen: (c: CharacterDef) => void; onNew: () => void }) {
  const nav = useNav();
  const store = useStore();
  return <div className="screen" style={{ padding: 12 }}>
    <div className="row"><button onClick={() => nav.go({ s: 'title' })}>◀ MENU</button><h1 style={{ margin: 0, fontSize: 18 }}>CHARACTER CREATOR</h1><span className="spacer" />
      <FileButton accept=".json,application/json" multiple onFiles={async fs => { try { const r = await store.importFiles(fs); store.toast(`Imported ${r.characters.length} character(s)`); } catch (e: any) { store.toast(e.message, true); } }}>IMPORT</FileButton>
      <button className="go big" onClick={onNew}>+ NEW CHARACTER</button></div>
    <p className="dim">Pick a fighter to edit, or start a new one. Everything saves to this browser; use Export to share a character as a single file.</p>
    <div className="roster-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', marginTop: 10 }}>
      {store.characters.map(c => <div key={c.id} className="panel col" style={{ padding: 8, cursor: 'pointer' }} onClick={() => onOpen(c)}>
        <Portrait def={c} size={134} className="big-portrait" />
        <div className="pix" style={{ fontSize: 9 }}>{c.name}</div>
        <div className="small dim">{c.attacks.length} moves{c.id.startsWith('builtin_') ? ' · built-in' : ''}</div>
      </div>)}
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
function BasicsTab({ d, update, issues, setTab }: { d: CharacterDef; update: Update; issues: ReturnType<typeof checklist>; setTab: (t: string) => void }) {
  const [builder, setBuilder] = useState(false);
  const st = d.stats;
  const S = (k: keyof CharacterDef['stats']) => (v: number) => update(x => { x.stats = { ...x.stats, [k]: v }; });
  const autoPortrait = async () => {
    const r = animFrame(d, 'idle', 0);
    const sheet = r && d.sheets.find(s => s.id === r.sheet);
    const fr = sheet?.frames[r!.index];
    if (!sheet || !fr) return;
    const img = getImage(sheet.image) || await loadImage(sheet.image);
    const [c, g] = makeCanvas(96, 96);
    g.fillStyle = d.color; g.fillRect(0, 0, 96, 96);
    const crop = Math.min(fr.h, Math.max(fr.w, fr.h * 0.5));
    const s = 96 / Math.max(fr.w * 0.9, crop * 0.9);
    g.save(); g.translate(48, 0); if (d.facesLeft !== !!fr.flipX) g.scale(-1, 1);
    g.drawImage(img, fr.x, fr.y, fr.w, crop, -fr.w * s / 2, 4, fr.w * s, crop * s); g.restore();
    g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 93, 93);
    update(x => { x.portrait = c.toDataURL('image/png'); });
  };
  return <div className="split" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr' }}>
    <div className="col">
      <div className="panel col">
        <h3 style={{ marginTop: 0 }}>PORTRAIT</h3>
        <Portrait def={d} size={240} className="big-portrait" />
        <div className="row">
          <FileButton accept="image/*" onFiles={async f => { const u = await readFileAsDataURL(f[0]); update(x => { x.portrait = u; }); }}>UPLOAD</FileButton>
          <button onClick={autoPortrait} disabled={!d.sheets.length}>FROM IDLE FRAME</button>
          {d.portrait && <button className="danger tiny" onClick={() => update(x => { x.portrait = ''; })}>CLEAR</button>}
        </div>
        <p className="small dim">Shown on select screen, beside health bars, during super alerts and on the victory screen. Square PNGs look best.</p>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>READY TO FIGHT?</h3>
        <div className="check-list">
          {issues.map(i => <div key={i.text} className={'guide-step' + (i.ok ? ' done' : '')} style={{ cursor: 'pointer' }} onClick={() => setTab(i.tab)}>
            <span className="dot" /><span className={i.ok ? '' : i.optional ? 'dim' : 'warn'}>{i.text}</span>
          </div>)}
        </div>
        <p className="small dim">Missing animations fall back to Idle, so a character is playable as soon as it has an Idle animation and one attack.</p>
      </div>
    </div>
    <div className="col">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>IDENTITY</h3>
        <Field label="Name" help="Used for opponent-specific dialogue, so keep names unique."><input value={d.name} maxLength={28} onChange={e => update(x => { x.name = e.target.value; })} style={{ width: 280 }} /></Field>
        <Field label="Description"><textarea value={d.description} onChange={e => update(x => { x.description = e.target.value; })} rows={2} /></Field>
        <Field label="Author"><input value={d.author || ''} onChange={e => update(x => { x.author = e.target.value; })} /></Field>
        <Field label="Theme color" tip="Used for UI accents, placeholder art and the auto-portrait background."><Color value={d.color} onChange={v => update(x => { x.color = v; })} /></Field>
        <div className="notice info">No art yet? <button className="gold tiny" onClick={() => setBuilder(true)}>★ PIXEL BODY BUILDER</button> generates a complete animated sprite sheet, standard animations and a starter moveset from a few choices. You can then customise everything.</div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>STATS</h3>
        <Field label="Max health" tip="Typical: 900–1250."><Num value={st.maxHealth} min={100} max={3000} step={10} onChange={S('maxHealth')} /></Field>
        <Field label="Walk speed" tip="World pixels per frame. Typical 1.8–3."><Num value={st.walkSpeed} min={0.5} max={6} step={0.1} onChange={S('walkSpeed')} /></Field>
        <Field label="Run speed" tip="Double-tap forward and hold to run."><Num value={st.runSpeed} min={1} max={12} step={0.1} onChange={S('runSpeed')} /></Field>
        <Field label="Dash speed"><Num value={st.dashSpeed} min={1} max={16} step={0.5} onChange={S('dashSpeed')} /></Field>
        <Field label="Jump height" tip="Peak height in world pixels. Characters are ~125 tall."><Num value={st.jumpHeight} min={30} max={300} step={5} onChange={S('jumpHeight')} /></Field>
        <Field label="Air jumps" tip="1 = double jump."><Num value={st.airJumps} min={0} max={3} step={1} onChange={S('airJumps')} /></Field>
        <Field label="Attack power" tip="Damage multiplier. 1 = normal."><Num value={st.attackPower} min={0.3} max={3} step={0.05} onChange={S('attackPower')} /></Field>
        <Field label="Defense" tip="Incoming damage is divided by this. 1 = normal."><Num value={st.defense} min={0.3} max={3} step={0.05} onChange={S('defense')} /></Field>
        <Field label="Body width" tip="Hurtbox & push box width in world pixels."><Num value={st.width} min={10} max={150} step={1} onChange={S('width')} /></Field>
        <Field label="Body height" tip="Hurtbox height in world pixels (crouching uses 66%)."><Num value={st.height} min={30} max={300} step={1} onChange={S('height')} /></Field>
        <Field label="Sprite scale" tip="Source pixels → world pixels. Use whole numbers (1, 2, 3) for crisp pixels."><Num value={d.scale} min={0.25} max={6} step={0.25} onChange={v => update(x => { x.scale = v; })} /></Field>
        <Field label="Art faces left" help="Tick if your sprite sheet shows the character facing left."><Check value={d.facesLeft} onChange={v => update(x => { x.facesLeft = v; })} /></Field>
        <button className="tiny" onClick={() => {
          const r = animFrame(d, 'idle', 0); const sh = r && d.sheets.find(s => s.id === r.sheet); const fr = sh?.frames[r!.index];
          if (fr) update(x => { x.stats = { ...x.stats, height: Math.round(fr.oy * x.scale * 0.92), width: Math.round(Math.min(fr.w, fr.h * 0.4) * x.scale * 0.6) }; });
        }} disabled={!d.animations.idle?.frames.length}>AUTO-FIT BODY FROM IDLE FRAME</button>
      </div>
    </div>
    {builder && <BodyBuilder d={d} update={update} onClose={() => setBuilder(false)} />}
  </div>;
}

// ---------------------------------------------------------------------------
function BodyBuilder({ d, update, onClose }: { d: CharacterDef; update: Update; onClose: () => void }) {
  const [b, setB] = useState<BodySpec>({ skin: '#f0c08a', hair: '#3a2a1a', top: d.color || '#d03030', pants: '#2a2a40', belt: '#111111', gloves: '#ffffff', boots: '#3a2a2a', accent: '#ffd21a', outline: '#100a14', eye: '#203060', build: 1, tall: 1, hairStyle: 'spiky' });
  const [energy, setEnergy] = useState('#5ef0ff');
  const [replace, setReplace] = useState(true);
  const preview = useMemo(() => generatePortrait(b, d.color), [b, d.color]);
  const set = (k: keyof BodySpec) => (v: any) => setB(x => ({ ...x, [k]: v }));
  const apply = () => {
    const r = buildFromBody(b, d.name || 'Fighter', d.color, energy);
    update(x => {
      const sheetId = 'body';
      x.sheets = [...x.sheets.filter(s => s.id !== sheetId), r.sheet];
      x.scale = 2; x.facesLeft = false;
      x.animations = { ...x.animations, ...r.animations };
      if (replace) { x.attacks = r.attacks; x.projectiles = r.projectiles; }
      else { x.attacks = [...x.attacks, ...r.attacks]; x.projectiles = [...x.projectiles, ...r.projectiles.filter(p => !x.projectiles.some(q => q.id === p.id))]; }
      if (!x.portrait) x.portrait = r.portrait;
      x.stats = { ...x.stats, width: Math.round(36 * b.build), height: Math.round(124 * b.tall) };
    });
    onClose();
  };
  const C = (k: keyof BodySpec, label: string) => <Field label={label}><Color value={(b[k] as string) || '#000000'} onChange={set(k)} /></Field>;
  return <Modal title="Pixel Body Builder" onClose={onClose} wide>
    <div className="split" style={{ gridTemplateColumns: '200px 1fr' }}>
      <div className="col"><img className="px big-portrait" src={preview} alt="" /><p className="small dim">The full animated sheet (≈100 poses) is generated when you apply.</p></div>
      <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
        <div>
          {C('skin', 'Skin')}{C('hair', 'Hair')}{C('eye', 'Eyes')}
          <Field label="Hair style"><select value={b.hairStyle} onChange={e => set('hairStyle')(e.target.value)}>{['spiky', 'short', 'long', 'ponytail', 'mohawk', 'hood', 'bald'].map(h => <option key={h}>{h}</option>)}</select></Field>
          <Field label="Build"><Num value={b.build} min={0.8} max={1.5} step={0.05} onChange={set('build')} /></Field>
          <Field label="Height"><Num value={b.tall} min={0.85} max={1.15} step={0.01} onChange={set('tall')} /></Field>
        </div>
        <div>
          {C('top', 'Top')}{C('pants', 'Pants')}{C('belt', 'Belt')}{C('gloves', 'Gloves')}{C('boots', 'Boots')}
          <Field label="Sleeveless"><Check value={!!b.sleeveless} onChange={set('sleeveless')} /></Field>
        </div>
        <div>
          <Field label="Headband"><Check value={!!b.headband} onChange={v => set('headband')(v ? '#d02828' : undefined)} />{b.headband && <Color value={b.headband} onChange={set('headband')} />}</Field>
          <Field label="Mask"><Check value={!!b.mask} onChange={v => set('mask')(v ? '#222244' : undefined)} />{b.mask && <Color value={b.mask} onChange={set('mask')} />}</Field>
          <Field label="Scarf"><Check value={!!b.scarf} onChange={v => set('scarf')(v ? '#c02a6a' : undefined)} />{b.scarf && <Color value={b.scarf} onChange={set('scarf')} />}</Field>
          <Field label="Shoulder pads"><Check value={!!b.pads} onChange={v => set('pads')(v ? '#9a9aa0' : undefined)} />{b.pads && <Color value={b.pads} onChange={set('pads')} />}</Field>
          <Field label="Beard"><Check value={!!b.beard} onChange={v => set('beard')(v ? b.hair : undefined)} /></Field>
          <Field label="Energy color" tip="Projectile and super effects."><Color value={energy} onChange={setEnergy} /></Field>
        </div>
      </div>
    </div>
    <div className="row" style={{ marginTop: 10 }}>
      <label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />Replace existing attacks with the starter moveset</label>
      <span className="spacer" />
      <button onClick={onClose}>CANCEL</button>
      <button className="go" onClick={apply}>GENERATE FIGHTER</button>
    </div>
  </Modal>;
}

// ---------------------------------------------------------------------------
function OppList({ d, update, others, field, title, help }: { d: CharacterDef; update: Update; others: string[]; field: 'vsVictory' | 'preFight'; title: string; help: string }) {
  const list = d.dialogue[field];
  const [pick, setPick] = useState('');
  return <div className="panel">
    <h3 style={{ marginTop: 0 }}>{title}</h3>
    <p className="small dim">{help}</p>
    {list.map((e, i) => <div key={i} className="panel inner" style={{ marginBottom: 8 }}>
      <div className="row">
        <span className="dim">Against</span>
        <select value={others.includes(e.opponent) ? e.opponent : '__custom'} onChange={ev => { const v = ev.target.value; if (v !== '__custom') update(x => { x.dialogue = { ...x.dialogue, [field]: x.dialogue[field].map((y, j) => j === i ? { ...y, opponent: v } : y) }; }); }}>
          {others.map(n => <option key={n} value={n}>{n}</option>)}
          <option value="__custom">Other name…</option>
        </select>
        {!others.includes(e.opponent) && <input value={e.opponent} placeholder="Opponent name" onChange={ev => update(x => { x.dialogue = { ...x.dialogue, [field]: x.dialogue[field].map((y, j) => j === i ? { ...y, opponent: ev.target.value } : y) }; })} />}
        <span className="spacer" />
        <button className="tiny danger" onClick={() => update(x => { x.dialogue = { ...x.dialogue, [field]: x.dialogue[field].filter((_, j) => j !== i) }; })}>REMOVE</button>
      </div>
      <LinesEditor lines={e.lines} placeholder={`Line said to ${e.opponent || 'them'}`} onChange={l => update(x => { x.dialogue = { ...x.dialogue, [field]: x.dialogue[field].map((y, j) => j === i ? { ...y, lines: l } : y) }; })} />
    </div>)}
    <div className="row">
      <select value={pick} onChange={e => setPick(e.target.value)}><option value="">Choose opponent…</option>{others.filter(n => !list.some(e => e.opponent === n)).map(n => <option key={n}>{n}</option>)}<option value="__custom">Other name…</option></select>
      <button className="go tiny" disabled={!pick} onClick={() => { update(x => { x.dialogue = { ...x.dialogue, [field]: [...x.dialogue[field], { opponent: pick === '__custom' ? '' : pick, lines: [''] }] }; }); setPick(''); }}>+ ADD OPPONENT</button>
    </div>
  </div>;
}

function DialogueTab({ d, update }: { d: CharacterDef; update: Update }) {
  const store = useStore();
  const others = store.characters.filter(c => c.id !== d.id).map(c => c.name);
  const L = (field: 'intro' | 'victory' | 'taunt') => (l: string[]) => update(x => { x.dialogue = { ...x.dialogue, [field]: l }; });
  return <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))' }}>
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>GENERAL VICTORY LINES</h3>
      <p className="small dim">One is picked at random when no opponent-specific line exists.</p>
      <LinesEditor lines={d.dialogue.victory} placeholder="I told you I was stronger!" onChange={L('victory')} />
    </div>
    <OppList d={d} update={update} others={others} field="vsVictory" title="OPPONENT-SPECIFIC VICTORY LINES" help="Said after beating a specific fighter. Add several lines per opponent for variety." />
    <OppList d={d} update={update} others={others} field="preFight" title="PRE-FIGHT DIALOGUE" help="Shown on the VS screen and in a speech bubble before round 1 against a specific opponent." />
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>INTRO LINES</h3>
      <p className="small dim">Used before a fight when there is no specific pre-fight line.</p>
      <LinesEditor lines={d.dialogue.intro} placeholder="Let's do this!" onChange={L('intro')} />
      <h3>TAUNTS</h3>
      <LinesEditor lines={d.dialogue.taunt} placeholder="Come on!" onChange={L('taunt')} />
    </div>
  </div>;
}

// ---------------------------------------------------------------------------
function AudioTab({ d, update }: { d: CharacterDef; update: Update }) {
  const Row = ({ k, label, kind }: { k: string; label: string; kind: 'sounds' | 'voices' }) => {
    const v = d[kind][k];
    return <tr>
      <td>{label}</td>
      <td>{v ? <span className="badge green">CUSTOM</span> : <span className="badge">{kind === 'sounds' ? 'DEFAULT' : 'NONE'}</span>}</td>
      <td className="row" style={{ gap: 2 }}>
        <button className="tiny icon" title="Play" onClick={() => kind === 'voices' ? (v && audio.play(v, d, 'voice')) : audio.play(k, d)} disabled={kind === 'voices' && !v}>▶</button>
        <FileButton className="tiny" accept="audio/*" onFiles={async f => { const u = await readFileAsDataURL(f[0]); update(x => { x[kind] = { ...x[kind], [k]: u }; }); }}>UPLOAD</FileButton>
        {v && <button className="tiny danger" onClick={() => update(x => { const n = { ...x[kind] }; delete n[k]; x[kind] = n; })}>CLEAR</button>}
      </td>
    </tr>;
  };
  return <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(420px,1fr))' }}>
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>SOUND EFFECTS</h3>
      <p className="small dim">Upload WAV/MP3/OGG clips. Attacks can pick any of these slots as their sound (Attacks tab). Defaults are retro synth sounds.</p>
      <table className="movelist"><tbody>{SOUND_SLOTS.map(s => <Row key={s.key} k={s.key} label={s.label} kind="sounds" />)}</tbody></table>
    </div>
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>VOICE CLIPS</h3>
      <p className="small dim">Optional. Special-attack name shouts are set per attack (Attacks tab → Voice clip). With "Speak dialogue" enabled in Options, lines without clips use text-to-speech.</p>
      <table className="movelist"><tbody>{VOICE_SLOTS.map(s => <Row key={s.key} k={s.key} label={s.label} kind="voices" />)}</tbody></table>
    </div>
  </div>;
}
