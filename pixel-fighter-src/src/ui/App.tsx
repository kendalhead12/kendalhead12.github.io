import React, { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import type { CharacterDef, StageDef } from '../engine/types';
import { TitleScreen } from './screens/Title';
import { SelectScreen } from './screens/Select';
import { VsScreen } from './screens/Vs';
import { FightScreen } from './screens/Fight';
import { VictoryScreen } from './screens/Victory';
import { SettingsScreen } from './screens/Settings';
import { CharacterEditor } from './editor/CharacterEditor';
import { StageEditor } from './editor/StageEditor';
import { installKeyboard } from '../engine/controls';
import { audio } from '../engine/audio';

export type Mode = 'arcade' | 'versus' | 'training' | 'watch' | 'test';
export interface MatchSpec {
  mode: Mode;
  p1: CharacterDef; p2: CharacterDef; stage: StageDef;
  p1Human: boolean; p2Human: boolean; aiLevel: number;
  arcade?: { ladder: string[]; index: number; continues: number; stageIds: string[] };
}
export interface MatchResult {
  spec: MatchSpec; winner: number; wins: [number, number]; maxCombo: [number, number]; damage: [number, number];
  hpLeft: [number, number]; seconds: number; perfect: boolean;
}

export type Screen =
  | { s: 'title' }
  | { s: 'select'; mode: Mode }
  | { s: 'vs'; spec: MatchSpec }
  | { s: 'fight'; spec: MatchSpec }
  | { s: 'victory'; result: MatchResult }
  | { s: 'editor'; id: string | null }
  | { s: 'stages'; id?: string | null }
  | { s: 'settings' };

export interface Nav { go(s: Screen): void; screen: Screen }
export const NavCtx = React.createContext<Nav>(null as any);
export const useNav = () => React.useContext(NavCtx);

export interface EditorSession { draft: CharacterDef; dirty: boolean; tab: string; sel?: Record<string, any> }

function Inner() {
  const store = useStore();
  const [screen, setScreen] = useState<Screen>({ s: 'title' });
  const [editor, setEditor] = useState<EditorSession | null>(null);
  useEffect(() => { installKeyboard(); }, []);
  useEffect(() => {
    const unlock = () => audio.ensure();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
  }, []);
  const go = (s: Screen) => { setScreen(s); window.scrollTo(0, 0); };
  if (!store.ready) return <div className="screen center title-bg"><div className="logo">PIXEL FIGHTER<small>ENGINE</small></div><p className="pix blink" style={{ fontSize: 10 }}>LOADING…</p></div>;
  let el: React.ReactNode = null;
  switch (screen.s) {
    case 'title': el = <TitleScreen />; break;
    case 'select': el = <SelectScreen mode={screen.mode} />; break;
    case 'vs': el = <VsScreen spec={screen.spec} />; break;
    case 'fight': el = <FightScreen key={Math.random()} spec={screen.spec} onTestExit={() => go({ s: 'editor', id: editor?.draft.id ?? null })} />; break;
    case 'victory': el = <VictoryScreen result={screen.result} />; break;
    case 'settings': el = <SettingsScreen />; break;
    case 'stages': el = <StageEditor initialId={screen.id ?? null} />; break;
    case 'editor': el = <CharacterEditor id={screen.id} session={editor} setSession={setEditor} />; break;
  }
  return <NavCtx.Provider value={{ go, screen }}>{el}</NavCtx.Provider>;
}

export default function App() {
  return <StoreProvider><Inner /></StoreProvider>;
}
