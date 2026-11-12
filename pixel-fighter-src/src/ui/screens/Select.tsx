import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mode, useNav, MatchSpec } from '../App';
import { useStore } from '../store';
import type { CharacterDef, StageDef } from '../../engine/types';
import { AnimPreview, FileButton, Modal, Portrait, StatBar } from '../widgets';
import { audio } from '../../engine/audio';
import { StageThumb } from '../StageThumb';

const MODE_NAME: Record<Mode, string> = { arcade: 'ARCADE', versus: 'VERSUS', training: 'TRAINING', watch: 'WATCH MODE', test: 'TEST' };

export function SelectScreen({ mode }: { mode: Mode }) {
  const nav = useNav();
  const store = useStore();
  const chars = store.characters;
  const [cursor, setCursor] = useState<[number, number]>([0, Math.min(1, chars.length - 1)]);
  const [chosen, setChosen] = useState<[string | null, string | null]>([null, null]);
  const [human, setHuman] = useState<[boolean, boolean]>([mode !== 'watch', mode === 'versus']);
  const [stageIdx, setStageIdx] = useState(-1); // -1 random
  const [stagePicked, setStagePicked] = useState(false);
  const [confirmDel, setConfirmDel] = useState<CharacterDef | null>(null);
  const [focusChar, setFocusChar] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const RANDOM = chars.length; // index of the random slot

  const picking: 0 | 1 | 2 = chosen[0] === null ? 0 : chosen[1] === null ? 1 : 2;
  const p2Label = mode === 'training' ? 'DUMMY' : mode === 'arcade' ? 'CPU' : human[1] ? 'P2' : 'CPU';

  const charAt = (i: number): CharacterDef | null => (i >= 0 && i < chars.length ? chars[i] : null);
  const resolve = (i: number) => (i === RANDOM ? chars[Math.floor(Math.random() * chars.length)] : chars[i]);

  const choose = useCallback((p: 0 | 1, i: number) => {
    if (!chars.length) return;
    const c = resolve(i);
    if (!c) return;
    audio.play('confirm');
    if (c.voices.select) audio.play(c.voices.select, c, 'voice');
    else if (c.sounds.select) audio.play('select', c);
    setChosen(ch => { const n = [...ch] as [string | null, string | null]; n[p] = c.id; return n; });
    if (mode === 'arcade' && p === 0) setChosen([c.id, '__arcade']);
  }, [chars, mode]);

  const back = useCallback(() => {
    audio.play('back');
    if (stagePicked) { setStagePicked(false); return; }
    if (chosen[1] !== null) { setChosen([chosen[0], null]); if (mode === 'arcade') setChosen([null, null]); return; }
    if (chosen[0] !== null) { setChosen([null, null]); return; }
    nav.go({ s: 'title' });
  }, [chosen, stagePicked, mode, nav]);

  const start = useCallback(() => {
    const p1 = chars.find(c => c.id === chosen[0]);
    if (!p1 || !store.stages.length) return;
    let stage: StageDef = stageIdx < 0 ? store.stages[Math.floor(Math.random() * store.stages.length)] : store.stages[stageIdx];
    let p2: CharacterDef | undefined;
    let arcade: MatchSpec['arcade'];
    if (mode === 'arcade') {
      const others = chars.filter(c => c.id !== p1.id);
      const pool = others.length ? others : chars;
      const ladder = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(6, pool.length));
      // final boss: a mirror match if the roster is tiny
      if (ladder.length < 3) ladder.push(p1);
      p2 = ladder[0];
      const stageIds = ladder.map(() => store.stages[Math.floor(Math.random() * store.stages.length)].id);
      if (stageIdx >= 0) stageIds[0] = stage.id; else stage = store.stages.find(s => s.id === stageIds[0])!;
      arcade = { ladder: ladder.map(c => c.id), index: 0, continues: 3, stageIds };
    } else p2 = chars.find(c => c.id === chosen[1]);
    if (!p2) return;
    audio.play('fight');
    const spec: MatchSpec = {
      mode, p1, p2, stage, aiLevel: store.settings.aiLevel, arcade,
      p1Human: mode !== 'watch' && human[0], p2Human: mode === 'versus' && human[1],
    };
    if (mode === 'training') nav.go({ s: 'fight', spec }); else nav.go({ s: 'vs', spec });
  }, [chars, chosen, stageIdx, store, mode, human, nav]);

  // keyboard control of both cursors
  useEffect(() => {
    const cols = () => {
      const g = gridRef.current; if (!g) return 6;
      const first = g.firstElementChild as HTMLElement | null;
      return first ? Math.max(1, Math.round(g.clientWidth / (first.offsetWidth + 6))) : 6;
    };
    const total = chars.length + 1;
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (confirmDel) return;
      const s = store.settings;
      const pl = (p: 0 | 1) => p === 0 ? s.p1Keys : s.p2Keys;
      const parallel = mode === 'versus' && human[1];
      for (const p of [0, 1] as const) {
        const b = pl(p);
        if (p === 1 && !parallel) continue;
        const target: 0 | 1 = parallel ? p : (picking === 1 ? 1 : 0);
        if (picking === 2) {
          if (p !== 0) continue;
          const n = store.stages.length + 1;
          if (b.left.includes(e.code)) { setStageIdx(i => ((i + 1 - 1 + n) % n) - 1); audio.play('select'); }
          if (b.right.includes(e.code)) { setStageIdx(i => ((i + 1 + 1) % n) - 1); audio.play('select'); }
          if (b.L.includes(e.code) || e.code === 'Enter') { e.preventDefault(); start(); }
          if (b.M.includes(e.code) || e.code === 'Escape') back();
          continue;
        }
        if (chosen[target] !== null) { if (b.M.includes(e.code) || e.code === 'Escape') back(); continue; }
        const move = (d: number) => { setCursor(c => { const n = [...c] as [number, number]; n[target] = (n[target] + d + total) % total; return n; }); audio.play('select'); e.preventDefault(); };
        if (b.left.includes(e.code)) move(-1);
        else if (b.right.includes(e.code)) move(1);
        else if (b.up.includes(e.code)) move(-cols());
        else if (b.down.includes(e.code)) move(cols());
        else if (b.L.includes(e.code) || (p === 0 && e.code === 'Enter')) { e.preventDefault(); choose(target, cursor[target]); }
        else if (b.M.includes(e.code) || (p === 0 && e.code === 'Escape')) back();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [chars, cursor, chosen, picking, human, mode, store, choose, back, start, confirmDel]);

  const hovered = (p: 0 | 1) => {
    const id = chosen[p];
    if (id && id !== '__arcade') return chars.find(c => c.id === id) || null;
    return charAt(cursor[p]);
  };
  const focus = chars.find(c => c.id === focusChar) || hovered(picking === 1 ? 1 : 0);

  const onSlotClick = (i: number) => {
    if (picking === 2) return;
    const p: 0 | 1 = picking === 0 ? 0 : 1;
    setCursor(c => { const n = [...c] as [number, number]; n[p] = i; return n; });
    choose(p, i);
  };

  const detail = (p: 0 | 1) => {
    const c = hovered(p);
    const color = p === 0 ? 'var(--red)' : 'var(--cyan)';
    const label = p === 0 ? (human[0] ? 'P1' : 'CPU') : p2Label;
    if (mode === 'arcade' && p === 1) return <div className="panel center" style={{ minHeight: 200 }}><div className="pix" style={{ fontSize: 40, color: 'var(--yellow)' }}>?</div><p className="dim">Opponents are chosen by the arcade ladder.</p></div>;
    return <div className="panel col" style={{ boxShadow: `0 0 0 2px #000, inset 0 0 0 2px ${color}` }}>
      <div className="row"><span className="badge" style={{ background: color, color: '#000' }}>{label}</span>
        {chosen[p] && chosen[p] !== '__arcade' && <span className="badge gold">READY</span>}
        {mode === 'versus' && <button className="tiny" onClick={() => setHuman(h => { const n = [...h] as [boolean, boolean]; n[p] = !n[p]; return n; })}>{human[p] ? 'Human' : 'CPU'} ⇄</button>}
      </div>
      {c ? <>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Portrait def={c} size={120} />
          <div style={{ transform: p === 1 ? 'scaleX(-1)' : undefined }}><AnimPreview def={c} anim={chosen[p] ? 'victory' : 'idle'} width={120} height={140} bg="#0a0a1c" /></div>
        </div>
        <div className="pname" style={{ color }}>{c.name}</div>
        <div className="small dim" style={{ minHeight: 40 }}>{c.description || 'No description yet.'}</div>
        <StatBar label="Health" value={c.stats.maxHealth} max={1500} />
        <StatBar label="Speed" value={c.stats.walkSpeed} max={4} />
        <StatBar label="Jump" value={c.stats.jumpHeight} max={180} />
        <StatBar label="Power" value={c.stats.attackPower} max={1.6} />
        <StatBar label="Defense" value={c.stats.defense} max={1.6} />
        <div className="small dim">{c.attacks.length} moves · {c.attacks.filter(a => a.type === 'special').length} specials · {c.attacks.filter(a => a.type === 'super').length} supers</div>
      </> : <div className="center" style={{ minHeight: 160 }}><div className="pix" style={{ fontSize: 40, color: 'var(--yellow)' }}>?</div><p className="dim">Random fighter</p></div>}
    </div>;
  };

  return <div className="screen" style={{ background: 'linear-gradient(180deg,#1a0a2a,#0b0b16)' }}>
    <div className="row" style={{ padding: '10px 12px 0' }}>
      <button onClick={() => nav.go({ s: 'title' })}>◀ MENU</button>
      <h1 style={{ margin: 0, fontSize: 18 }}>{MODE_NAME[mode]} · SELECT YOUR FIGHTER</h1>
      <span className="spacer" />
      <span className="dim small">CPU level</span>
      <input type="range" min={1} max={8} value={store.settings.aiLevel} onChange={e => store.updateSettings({ aiLevel: +e.target.value })} />
      <span className="pix" style={{ fontSize: 10 }}>{store.settings.aiLevel}</span>
      {mode !== 'training' && <><span className="dim small">Rounds</span>
        <select value={store.settings.rounds} onChange={e => store.updateSettings({ rounds: +e.target.value })}>
          <option value={1}>1 (single)</option><option value={2}>Best of 3</option><option value={3}>Best of 5</option>
        </select></>}
    </div>
    <div className="select-wrap">
      <div className="select-side">{detail(0)}</div>
      <div className="col">
        <div className="panel">
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="pix" style={{ fontSize: 10, color: picking === 0 ? 'var(--red)' : picking === 1 ? 'var(--cyan)' : 'var(--yellow)' }}>
              {picking === 0 ? (human[0] ? 'P1: CHOOSE' : 'CHOOSE CPU 1') : picking === 1 ? `CHOOSE ${p2Label}` : 'CHOOSE STAGE'}
            </span>
            <span className="spacer" />
            <span className="dim small">{chars.length} fighters</span>
          </div>
          <div className="roster-grid" ref={gridRef}>
            {chars.map((c, i) => {
              const p1 = (picking === 0 ? cursor[0] === i : chosen[0] === c.id);
              const p2 = mode !== 'arcade' && (picking === 1 ? cursor[1] === i : chosen[1] === c.id);
              return <div key={c.id} className={'slot' + (p1 ? ' p1' : '') + (p2 ? ' p2' : '')} onClick={() => onSlotClick(i)} onMouseEnter={() => setFocusChar(c.id)} onMouseLeave={() => setFocusChar(null)} title={c.name}>
                <Portrait def={c} size={80} />
                <div className="nm">{c.name}</div>
                {p1 && <span className="tag t1">1P</span>}
                {p2 && <span className="tag t2">{p2Label === 'P2' ? '2P' : 'CPU'}</span>}
              </div>;
            })}
            <div className={'slot random' + ((picking === 0 && cursor[0] === RANDOM) ? ' p1' : '') + ((picking === 1 && cursor[1] === RANDOM) ? ' p2' : '')} onClick={() => onSlotClick(RANDOM)} title="Random">?</div>
            <div className="slot add" onClick={() => nav.go({ s: 'editor', id: null })} title="Create a new character">+</div>
          </div>
          {focus && <div className="row" style={{ marginTop: 10 }}>
            <span className="dim small">{focus.name}:</span>
            <button className="tiny blue" onClick={() => nav.go({ s: 'editor', id: focus.id })}>EDIT</button>
            <button className="tiny" onClick={async () => { const c = await store.duplicateCharacter(focus.id); if (c) store.toast(`Duplicated as "${c.name}"`); }}>DUPLICATE</button>
            <button className="tiny" onClick={() => store.exportCharacter(focus)}>EXPORT</button>
            <button className="tiny danger" onClick={() => setConfirmDel(focus)}>DELETE</button>
          </div>}
          <div className="row" style={{ marginTop: 6 }}>
            <button className="tiny go" onClick={() => nav.go({ s: 'editor', id: null })}>+ NEW</button>
            <FileButton className="tiny" accept=".json,application/json" multiple onFiles={async fs => {
              try { const r = await store.importFiles(fs); store.toast(`Imported ${r.characters.length} character(s), ${r.stages.length} stage(s)`); }
              catch (e: any) { store.toast(e.message || String(e), true); }
            }}>IMPORT</FileButton>
            <button className="tiny" onClick={() => store.exportAll()}>EXPORT ALL</button>
          </div>
        </div>
        {picking === 2 && <div className="panel">
          <h2>STAGE</h2>
          <div className="row" style={{ gap: 6 }}>
            <div className={'slot random' + (stageIdx === -1 ? ' p1' : '')} style={{ width: 110, aspectRatio: '16/9' }} onClick={() => setStageIdx(-1)}>?</div>
            {store.stages.map((s, i) => <div key={s.id} className={'slot' + (stageIdx === i ? ' p1' : '')} style={{ width: 110, aspectRatio: '16/9' }} onClick={() => setStageIdx(i)} onDoubleClick={start} title={s.name}>
              <StageThumb stage={s} /><div className="nm">{s.name}</div>
            </div>)}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={back}>◀ BACK</button>
            <span className="spacer" />
            <button className="primary big" onClick={start}>FIGHT! ▶</button>
          </div>
        </div>}
        {picking < 2 && <p className="dim small" style={{ textAlign: 'center' }}>Click a fighter, or use WASD + J (P1){mode === 'versus' && human[1] ? ' and Arrows + Num1 (P2)' : ''}. Esc / K to go back.</p>}
        {store.stages.length === 0 && <div className="notice bad">No stages exist. Create one in the Stage Creator first.</div>}
      </div>
      <div className="select-side">{detail(1)}</div>
    </div>
    {confirmDel && <Modal title="Delete fighter?" onClose={() => setConfirmDel(null)}>
      <p>Permanently delete <b>{confirmDel.name}</b> from this browser? Export it first if you want a backup.</p>
      <div className="row"><button className="danger" onClick={async () => { await store.deleteCharacter(confirmDel.id); setChosen([null, null]); setCursor([0, 0]); setConfirmDel(null); store.toast('Deleted'); }}>DELETE</button>
        <button onClick={() => { store.exportCharacter(confirmDel); }}>EXPORT FIRST</button><button onClick={() => setConfirmDel(null)}>CANCEL</button></div>
    </Modal>}
  </div>;
}
