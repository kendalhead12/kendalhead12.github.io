import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterDef, Settings, StageDef } from '../engine/types';
import { defaultSettings, normalizeCharacter, normalizeStage } from '../engine/defaults';
import { storage, loadSettings, saveSettings, packCharacter, packStage, packRoster, parsePackage, freshCopy, requestPersistence } from '../data/storage';
import { buildBuiltinRoster } from '../data/builtins';
import { buildBuiltinStages } from '../data/stages';
import { downloadText, readFileAsText, safeFileName } from '../engine/util';
import { audio } from '../engine/audio';

const SEED_VERSION = 1;

interface StoreValue {
  ready: boolean;
  loadError: string;
  characters: CharacterDef[];
  stages: StageDef[];
  settings: Settings;
  saveCharacter(c: CharacterDef): Promise<void>;
  deleteCharacter(id: string): Promise<void>;
  duplicateCharacter(id: string): Promise<CharacterDef | null>;
  exportCharacter(c: CharacterDef): void;
  saveStage(s: StageDef): Promise<void>;
  deleteStage(id: string): Promise<void>;
  duplicateStage(id: string): Promise<StageDef | null>;
  exportStage(s: StageDef): void;
  exportAll(): void;
  importFiles(files: FileList | File[]): Promise<{ characters: CharacterDef[]; stages: StageDef[] }>;
  updateSettings(p: Partial<Settings>): void;
  restoreDefaults(): Promise<void>;
  toast(msg: string, bad?: boolean): void;
}

const Ctx = createContext<StoreValue>(null as any);
export const useStore = () => useContext(Ctx);

const sortChars = (l: CharacterDef[]) => [...l].sort((a, b) => {
  const ba = a.id.startsWith('builtin_') ? 0 : 1, bb = b.id.startsWith('builtin_') ? 0 : 1;
  return ba - bb || (a as any).createdAt - (b as any).createdAt || a.name.localeCompare(b.name);
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [characters, setCharacters] = useState<CharacterDef[]>([]);
  const [stages, setStages] = useState<StageDef[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings());
  const [toastMsg, setToast] = useState<{ msg: string; bad: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const st = await loadSettings();
        setSettings(st);
        audio.setVolume(st.volume);
        let chars = (await storage.all<CharacterDef>('characters')).map(normalizeCharacter);
        let stgs = (await storage.all<StageDef>('stages')).map(normalizeStage);
        const seeded = await storage.get<number>('seeded');
        if (!seeded || seeded < SEED_VERSION) {
          const now = Date.now();
          const roster = buildBuiltinRoster().map((c, i) => ({ ...c, createdAt: now + i }));
          for (const c of roster) if (!chars.some(x => x.id === c.id)) { await storage.put('characters', c.id, c); chars.push(c); }
          for (const s of buildBuiltinStages()) if (!stgs.some(x => x.id === s.id)) { await storage.put('stages', s.id, s); stgs.push(s); }
          await storage.set('seeded', SEED_VERSION);
          requestPersistence();
        }
        setCharacters(sortChars(chars));
        setStages(stgs);
      } catch (e: any) {
        // IndexedDB unavailable (private mode etc.) — run with in-memory built-ins
        setLoadError('Saving is unavailable in this browser session (' + (e?.message || 'IndexedDB blocked') + '). Use Export to keep your characters.');
        setCharacters(buildBuiltinRoster());
        setStages(buildBuiltinStages());
      }
      setReady(true);
    })();
  }, []);

  const persist = async (store: 'characters' | 'stages', id: string, v: unknown) => {
    try { await storage.put(store, id, v); }
    catch (e: any) { toast('Could not save to browser storage: ' + (e?.message || e) + '. Try exporting instead.', true); throw e; }
  };

  const value = useMemo<StoreValue>(() => ({
    ready, loadError, characters, stages, settings, toast,
    async saveCharacter(c) {
      const v = { ...c, updatedAt: Date.now(), createdAt: (c as any).createdAt ?? Date.now() };
      await persist('characters', v.id, v);
      setCharacters(l => sortChars(l.some(x => x.id === v.id) ? l.map(x => x.id === v.id ? v : x) : [...l, v]));
    },
    async deleteCharacter(id) {
      await storage.del('characters', id).catch(() => { });
      setCharacters(l => l.filter(x => x.id !== id));
    },
    async duplicateCharacter(id) {
      const src = characters.find(c => c.id === id);
      if (!src) return null;
      const copy = { ...freshCopy(src, characters.map(c => c.name), ' Copy'), createdAt: Date.now() };
      await persist('characters', copy.id, copy);
      setCharacters(l => sortChars([...l, copy]));
      return copy;
    },
    exportCharacter(c) { downloadText(`${safeFileName(c.name)}.pfchar.json`, JSON.stringify(packCharacter(c))); },
    async saveStage(s) {
      const v = { ...s, updatedAt: Date.now() };
      await persist('stages', v.id, v);
      setStages(l => l.some(x => x.id === v.id) ? l.map(x => x.id === v.id ? v : x) : [...l, v]);
    },
    async deleteStage(id) { await storage.del('stages', id).catch(() => { }); setStages(l => l.filter(x => x.id !== id)); },
    async duplicateStage(id) {
      const src = stages.find(s => s.id === id);
      if (!src) return null;
      const copy = freshCopy(src, stages.map(s => s.name), ' Copy');
      await persist('stages', copy.id, copy);
      setStages(l => [...l, copy]);
      return copy;
    },
    exportStage(s) { downloadText(`${safeFileName(s.name)}.pfstage.json`, JSON.stringify(packStage(s))); },
    exportAll() { downloadText(`pixel-fighter-roster.json`, JSON.stringify(packRoster(characters, stages))); },
    async importFiles(files) {
      const added = { characters: [] as CharacterDef[], stages: [] as StageDef[] };
      const names = characters.map(c => c.name), snames = stages.map(s => s.name);
      for (const file of Array.from(files)) {
        const text = await readFileAsText(file);
        const pkg = parsePackage(text);
        for (const c of pkg.characters) {
          const exists = characters.some(x => x.id === c.id) || added.characters.some(x => x.id === c.id);
          const v = exists ? freshCopy(c, [...names, ...added.characters.map(x => x.name)]) : c;
          (v as any).createdAt = Date.now() + added.characters.length;
          await persist('characters', v.id, v);
          added.characters.push(v);
        }
        for (const s of pkg.stages) {
          const exists = stages.some(x => x.id === s.id);
          const v = exists ? freshCopy(s, snames) : s;
          await persist('stages', v.id, v);
          added.stages.push(v);
        }
      }
      setCharacters(l => sortChars([...l, ...added.characters]));
      setStages(l => [...l, ...added.stages]);
      return added;
    },
    updateSettings(p) {
      setSettings(s => {
        const n = { ...s, ...p };
        saveSettings(n).catch(() => { });
        audio.setVolume(n.volume);
        audio.tts = n.tts;
        return n;
      });
    },
    async restoreDefaults() {
      const roster = buildBuiltinRoster();
      for (const c of roster) await persist('characters', c.id, c);
      for (const s of buildBuiltinStages()) await persist('stages', s.id, s);
      setCharacters(l => sortChars([...l.filter(x => !x.id.startsWith('builtin_')), ...roster]));
      setStages(l => [...buildBuiltinStages(), ...l.filter(x => !x.id.startsWith('builtin_'))]);
    },
  }), [ready, loadError, characters, stages, settings, toast]);

  return <Ctx.Provider value={value}>
    {children}
    {toastMsg && <div className={'toast' + (toastMsg.bad ? ' bad' : '')} onClick={() => setToast(null)}>{toastMsg.msg}</div>}
  </Ctx.Provider>;
}
