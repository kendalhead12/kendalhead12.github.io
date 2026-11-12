// IndexedDB persistence + import/export packages.
import type { CharacterDef, Settings, StageDef } from '../engine/types';
import { defaultSettings, normalizeCharacter, normalizeStage } from '../engine/defaults';
import { FORMAT_VERSION } from '../engine/types';
import { deepClone, uid } from '../engine/util';

const DB_NAME = 'pixel-fighter-engine';
const DB_VER = 1;
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of ['characters', 'stages', 'kv']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const req = fn(s);
    t.oncomplete = () => res(req ? (req as IDBRequest<T>).result : (undefined as T));
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transaction aborted (storage may be full)'));
  });
}

export const storage = {
  async all<T>(store: 'characters' | 'stages'): Promise<T[]> {
    return (await tx<T[]>(store, 'readonly', s => s.getAll())) || [];
  },
  put(store: 'characters' | 'stages', id: string, value: unknown) { return tx(store, 'readwrite', s => s.put(value, id)); },
  del(store: 'characters' | 'stages', id: string) { return tx(store, 'readwrite', s => s.delete(id)); },
  async get<T>(key: string): Promise<T | undefined> { return tx<T>('kv', 'readonly', s => s.get(key)); },
  set(key: string, value: unknown) { return tx('kv', 'readwrite', s => s.put(value, key)); },
};

export async function loadSettings(): Promise<Settings> {
  const s = await storage.get<Settings>('settings').catch(() => undefined);
  const d = defaultSettings();
  if (!s) return d;
  return { ...d, ...s, volume: { ...d.volume, ...(s.volume || {}) }, p1Keys: { ...d.p1Keys, ...(s.p1Keys || {}) }, p2Keys: { ...d.p2Keys, ...(s.p2Keys || {}) } };
}
export const saveSettings = (s: Settings) => storage.set('settings', s);

// ---------------------------------------------------------------------------
// Packages: a single JSON file with all images and sounds embedded as data URLs.
export interface CharacterPackage { kind: 'pixel-fighter-character'; formatVersion: number; exportedAt: string; character: CharacterDef }
export interface StagePackage { kind: 'pixel-fighter-stage'; formatVersion: number; exportedAt: string; stage: StageDef }
export interface RosterPackage { kind: 'pixel-fighter-roster'; formatVersion: number; exportedAt: string; characters: CharacterDef[]; stages: StageDef[] }

export const packCharacter = (c: CharacterDef): CharacterPackage => ({ kind: 'pixel-fighter-character', formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), character: c });
export const packStage = (s: StageDef): StagePackage => ({ kind: 'pixel-fighter-stage', formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), stage: s });
export const packRoster = (characters: CharacterDef[], stages: StageDef[]): RosterPackage => ({ kind: 'pixel-fighter-roster', formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), characters, stages });

export function parsePackage(text: string): { characters: CharacterDef[]; stages: StageDef[] } {
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Character files end in .json and come from the Export button.'); }
  const out = { characters: [] as CharacterDef[], stages: [] as StageDef[] };
  if (data?.kind === 'pixel-fighter-character' && data.character) out.characters.push(normalizeCharacter(data.character));
  else if (data?.kind === 'pixel-fighter-stage' && data.stage) out.stages.push(normalizeStage(data.stage));
  else if (data?.kind === 'pixel-fighter-roster') {
    for (const c of data.characters || []) out.characters.push(normalizeCharacter(c));
    for (const s of data.stages || []) out.stages.push(normalizeStage(s));
  } else if (data && Array.isArray(data.attacks) && data.name) out.characters.push(normalizeCharacter(data));
  else throw new Error('Unrecognised file. Expected a Pixel Fighter character, stage or roster export.');
  return out;
}

/** Give an imported/duplicated item a fresh id (and unique name) so it never overwrites another. */
export function freshCopy<T extends { id: string; name: string }>(item: T, existingNames: string[], suffix = ''): T {
  const c = deepClone(item);
  c.id = uid(c.id.startsWith('stg') || (c as any).layers ? 'stg' : 'chr');
  let name = c.name + suffix;
  let n = 2;
  while (existingNames.includes(name)) name = `${c.name}${suffix || ''} ${n++}`;
  c.name = name;
  return c;
}

export async function estimateUsage(): Promise<string> {
  try {
    const e = await navigator.storage?.estimate?.();
    if (!e || !e.usage) return '';
    return `${(e.usage / 1048576).toFixed(1)} MB used${e.quota ? ` of ${(e.quota / 1048576).toFixed(0)} MB` : ''}`;
  } catch { return ''; }
}
export async function requestPersistence() { try { await navigator.storage?.persist?.(); } catch { /* ignore */ } }
