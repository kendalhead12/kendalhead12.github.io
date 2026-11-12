import React, { useEffect, useMemo, useState } from 'react';
import { useNav } from '../App';
import { useStore } from '../store';
import { AnimPreview, Modal } from '../widgets';
import { audio } from '../../engine/audio';
import { isKeyDown } from '../../engine/controls';

export function useMenuKeys(count: number, onSelect: (i: number) => void, onBack?: () => void) {
  const [sel, setSel] = useState(0);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { setSel(s => (s + 1) % count); audio.play('select'); e.preventDefault(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { setSel(s => (s - 1 + count) % count); audio.play('select'); e.preventDefault(); }
      else if (e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'Space') { e.preventDefault(); setSel(s => { onSelect(s); return s; }); }
      else if ((e.code === 'Escape' || e.code === 'Backspace') && onBack) onBack();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [count, onSelect, onBack]);
  return [sel, setSel] as const;
}

const GUIDE = [
  'Open CHARACTER CREATOR and press "New Character".',
  'Name your fighter and set Max Health on the Basics tab.',
  'On Sprites, upload a PNG sprite sheet and slice it (Auto-detect or Grid). No art? Use the Pixel Body Builder.',
  'On Animations, pick frames for Idle, Walk, Jump… (type "1-4" or click frames).',
  'On Attacks, press "Create New Attack" to make a punch: pick frames, mark the active frame, draw the hitbox.',
  'Make a special: set type to Special or Super and design its cinematic on the Specials tab.',
  'Add a portrait on Basics (or auto-generate one).',
  'Press SAVE, then TEST to fight a dummy instantly, or pick your fighter on the select screen.',
];

export function TitleScreen() {
  const nav = useNav();
  const store = useStore();
  const [guide, setGuide] = useState(false);
  const items = useMemo(() => [
    { label: 'ARCADE', hint: 'Fight a ladder of CPU opponents', act: () => nav.go({ s: 'select', mode: 'arcade' }) },
    { label: 'VERSUS', hint: 'Player vs Player or vs CPU', act: () => nav.go({ s: 'select', mode: 'versus' }) },
    { label: 'TRAINING', hint: 'Practice against a dummy', act: () => nav.go({ s: 'select', mode: 'training' }) },
    { label: 'WATCH', hint: 'CPU vs CPU', act: () => nav.go({ s: 'select', mode: 'watch' }) },
    { label: 'CHARACTER CREATOR', hint: 'Build your own fighters', act: () => nav.go({ s: 'editor', id: null }) },
    { label: 'STAGE CREATOR', hint: 'Backgrounds, parallax, weather', act: () => nav.go({ s: 'stages' }) },
    { label: 'OPTIONS & CONTROLS', hint: 'Keys, audio, gameplay', act: () => nav.go({ s: 'settings' }) },
  ], [nav]);
  const onSelect = React.useCallback((i: number) => { audio.play('confirm'); items[i].act(); }, [items]);
  const [sel, setSel] = useMenuKeys(items.length, onSelect);
  const showcase = useMemo(() => {
    const l = store.characters.filter(c => c.sheets.length);
    if (l.length < 2) return [];
    const a = Math.floor(Math.random() * l.length);
    let b = Math.floor(Math.random() * (l.length - 1)); if (b >= a) b++;
    return [l[a], l[b]];
  }, [store.characters]);
  void isKeyDown;
  return <div className="screen title-bg center" style={{ padding: 16, gap: 10 }}>
    <div className="logo">PIXEL FIGHTER<small>ENGINE · MAKE YOUR OWN FIGHTERS</small></div>
    <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'center', gap: 20 }}>
      {showcase[0] && <div className="hide-sm"><AnimPreview def={showcase[0]} anim="victory" width={150} height={180} bg="transparent" /></div>}
      <div className="menu">
        {items.map((it, i) => <button key={it.label} className={sel === i ? 'sel' : ''} onMouseEnter={() => setSel(i)} onClick={() => onSelect(i)}>
          {sel === i ? '▶ ' : '  '}{it.label}
        </button>)}
        <p className="dim small" style={{ textAlign: 'center', minHeight: 20 }}>{items[sel].hint}</p>
      </div>
      {showcase[1] && <div className="hide-sm" style={{ transform: 'scaleX(-1)' }}><AnimPreview def={showcase[1]} anim="idle" width={150} height={180} bg="transparent" /></div>}
    </div>
    {store.loadError && <div className="notice bad" style={{ maxWidth: 600 }}>{store.loadError}</div>}
    <div className="row">
      <button className="gold" onClick={() => setGuide(true)}>★ BEGINNER GUIDE</button>
      <span className="dim small">{store.characters.length} fighters · {store.stages.length} stages</span>
    </div>
    <p className="dim small" style={{ textAlign: 'center' }}>P1: WASD move · J/K/L light/medium/heavy · U special · I grab · O dash · Enter pause<br />Gamepad & touch supported — rebind in Options.</p>
    {guide && <Modal title="Make a fighter in 9 steps" onClose={() => setGuide(false)}>
      <ol style={{ paddingLeft: 22, margin: 0 }}>{GUIDE.map((g, i) => <li key={i} style={{ marginBottom: 6 }}>{g}</li>)}</ol>
      <div className="row" style={{ marginTop: 10 }}><button className="go" onClick={() => nav.go({ s: 'editor', id: null })}>Open Character Creator</button></div>
    </Modal>}
  </div>;
}
