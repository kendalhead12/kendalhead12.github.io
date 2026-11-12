import React, { useEffect, useRef, useState } from 'react';
import { useNav } from '../App';
import { useStore } from '../store';
import type { StageDef, StageLayer, Weather } from '../../engine/types';
import { newLayer, newStage, normalizeStage, defaultSettings } from '../../engine/defaults';
import { deepClone, readFileAsDataURL } from '../../engine/util';
import { Check, Color, Field, FileButton, Modal, Num } from '../widgets';
import { StageThumb } from '../StageThumb';
import { Sim, VIEW_H, VIEW_W } from '../../engine/sim';
import { Renderer } from '../../engine/render';
import { emptyInput } from '../../engine/input';
import { loadImage, preloadAll } from '../../engine/assets';
import { audio } from '../../engine/audio';
import { buildDummy } from '../../data/builtins';

function StagePreview({ stage, pan, auto, fighters }: { stage: StageDef; pan: number; auto: boolean; fighters: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const store = useStore();
  const panRef = useRef(pan); panRef.current = pan;
  const autoRef = useRef(auto); autoRef.current = auto;
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const a = store.characters[0] || buildDummy(), b = store.characters[1] || buildDummy();
    const sim = new Sim({ chars: [a, b], stage, roundsToWin: 99, roundTime: 0, training: { dummy: 'stand', infiniteHealth: true, infiniteMeter: false }, damageScaling: true, cinematics: 'off', skipIntro: true });
    const s = defaultSettings(); s.scanlines = false;
    const r = new Renderer(c, s);
    preloadAll([...stage.layers.map(l => l.image), ...a.sheets.map(x => x.image), ...b.sheets.map(x => x.image)]);
    let raf = 0, t = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t++;
      sim.step([emptyInput(), emptyInput()]);
      sim.drain();
      const half = VIEW_W / 2;
      const lo = half + stage.camLeft, hi = stage.width - half - stage.camRight;
      const k = autoRef.current ? (Math.sin(t / 200) + 1) / 2 : panRef.current;
      sim.cam.x = hi > lo ? lo + (hi - lo) * k : stage.width / 2;
      const mid = sim.cam.x;
      sim.f[0].x = mid - 90; sim.f[1].x = mid + 90;
      r.draw(sim, { hud: false });
      if (!fighters) { /* fighters hidden: redraw stage only */ r.frame++; r.drawStage(sim, false); r.drawWeather(sim, true); r.drawWeather(sim, false); r.drawStage(sim, true); }
      const g = r.g; g.fillStyle = 'rgba(255,79,94,.8)'; g.fillRect(0, r.zoomY(sim, 0), VIEW_W, 1);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [stage, fighters]);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className="preview-canvas" style={{ maxWidth: 800 }} />;
}

export function StageEditor({ initialId }: { initialId: string | null }) {
  const nav = useNav();
  const store = useStore();
  const [draft, setDraft] = useState<StageDef | null>(() => {
    const s = store.stages.find(x => x.id === initialId) || store.stages[0];
    return s ? deepClone(s) : null;
  });
  const [dirty, setDirty] = useState(false);
  const [pan, setPan] = useState(0.5);
  const [auto, setAuto] = useState(false);
  const [fighters, setFighters] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [selLayer, setSelLayer] = useState<string | null>(null);
  const up = (fn: (s: StageDef) => void) => setDraft(d => { if (!d) return d; const n = { ...d, layers: [...d.layers] }; fn(n); setDirty(true); return n; });
  const setLayer = (id: string, p: Partial<StageLayer>) => up(s => { s.layers = s.layers.map(l => l.id === id ? { ...l, ...p } : l); });
  const open = (s: StageDef) => { setDraft(deepClone(s)); setDirty(false); setSelLayer(null); };
  const save = async () => { if (!draft) return; await store.saveStage(normalizeStage(deepClone(draft))); setDirty(false); store.toast(`Saved stage "${draft.name}"`); };
  useEffect(() => () => audio.stopMusic(), []);

  return <div className="screen" style={{ padding: 12 }}>
    <div className="row">
      <button onClick={() => nav.go({ s: 'title' })}>◀ MENU</button>
      <h1 style={{ margin: 0, fontSize: 18 }}>STAGE CREATOR</h1>
      <span className="spacer" />
      <FileButton accept=".json,application/json" multiple onFiles={async fs => { try { const r = await store.importFiles(fs); store.toast(`Imported ${r.stages.length} stage(s)`); if (r.stages[0]) open(r.stages[0]); } catch (e: any) { store.toast(e.message, true); } }}>IMPORT</FileButton>
      <button className="go" onClick={() => { const s = newStage('My Stage ' + (store.stages.length + 1)); setDraft(s); setDirty(true); }}>+ NEW STAGE</button>
    </div>
    <div className="split" style={{ marginTop: 10 }}>
      <div className="list">
        {store.stages.map(s => <div key={s.id} className={'item' + (draft?.id === s.id ? ' sel' : '')} onClick={() => open(s)} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div style={{ aspectRatio: '16/9' }}><StageThumb stage={s} /></div><div>{s.name}</div></div>)}
        {draft && !store.stages.some(s => s.id === draft.id) && <div className="item sel">{draft.name} (unsaved)</div>}
      </div>
      {draft ? <div className="col">
        <div className="panel">
          <div className="row">
            <input value={draft.name} onChange={e => up(s => { s.name = e.target.value; })} style={{ fontSize: 22, width: 260 }} />
            {dirty && <span className="warn small">unsaved</span>}
            <span className="spacer" />
            <button className="go" onClick={save}>💾 SAVE</button>
            <button className="blue" onClick={async () => {
              await save();
              const p1 = store.characters[0] || buildDummy();
              nav.go({ s: 'fight', spec: { mode: 'training', p1, p2: buildDummy(), stage: draft, p1Human: true, p2Human: false, aiLevel: store.settings.aiLevel } });
            }}>▶ TEST FIGHT</button>
            <button onClick={() => store.exportStage(draft)}>EXPORT</button>
            {store.stages.some(s => s.id === draft.id) && <button onClick={async () => { const c = await store.duplicateStage(draft.id); if (c) open(c); }}>DUPLICATE</button>}
            <button className="danger" onClick={() => setConfirmDel(true)}>DELETE</button>
          </div>
        </div>
        <div className="panel">
          <StagePreview stage={draft} pan={pan} auto={auto} fighters={fighters} />
          <div className="row">
            <span className="small dim">Camera pan</span><input type="range" min={0} max={1} step={0.01} value={pan} onChange={e => { setPan(+e.target.value); setAuto(false); }} />
            <Check value={auto} onChange={setAuto} label="Auto pan" /><Check value={fighters} onChange={setFighters} label="Show fighters" />
            <span className="small dim">The red line is the floor.</span>
          </div>
        </div>
        <div className="grid2">
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>LAYOUT</h3>
            <Field label="Stage width" tip="World pixels. The screen shows 640."><Num value={draft.width} min={640} max={4000} step={10} onChange={v => up(s => { s.width = v; })} /></Field>
            <Field label="Floor height" tip="Pixels from the top of the 360-pixel screen to the ground."><Num value={draft.floorY} min={150} max={350} onChange={v => up(s => { s.floorY = v; })} /></Field>
            <Field label="Camera limit left/right" tip="Stop the camera this far from the stage edges."><Num value={draft.camLeft} min={0} max={1000} onChange={v => up(s => { s.camLeft = v; })} slider={false} width={70} /><Num value={draft.camRight} min={0} max={1000} onChange={v => up(s => { s.camRight = v; })} slider={false} width={70} /></Field>
            <Field label="Sky top / bottom"><Color value={draft.skyTop} onChange={v => up(s => { s.skyTop = v; })} /><Color value={draft.skyBottom} onChange={v => up(s => { s.skyBottom = v; })} /></Field>
            <Field label="Floor color"><Color value={draft.floorColor} onChange={v => up(s => { s.floorColor = v; })} /></Field>
            <Field label="Shiny floor reflection"><Check value={draft.reflection} onChange={v => up(s => { s.reflection = v; })} /></Field>
          </div>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>ATMOSPHERE & MUSIC</h3>
            <Field label="Weather"><select value={draft.weather} onChange={e => up(s => { s.weather = e.target.value as Weather; })}>
              {['none', 'rain', 'storm', 'snow', 'leaves', 'sakura', 'embers', 'ash', 'fireflies'].map(w => <option key={w}>{w}</option>)}</select></Field>
            <Field label="Weather density"><Num value={draft.weatherDensity} min={0.1} max={3} step={0.1} onChange={v => up(s => { s.weatherDensity = v; })} /></Field>
            <Field label="Background particles"><select value={draft.ambient} onChange={e => up(s => { s.ambient = e.target.value as any; })}>{['none', 'dust', 'fireflies', 'bubbles', 'sparkles'].map(w => <option key={w}>{w}</option>)}</select></Field>
            <Field label="Music">
              {draft.music ? <span className="badge green">UPLOADED</span> : <span className="badge">BUILT-IN TUNE #{draft.musicTheme}</span>}
              <FileButton className="tiny" accept="audio/*" onFiles={async f => { const u = await readFileAsDataURL(f[0]); up(s => { s.music = u; }); }}>UPLOAD</FileButton>
              {draft.music && <button className="tiny danger" onClick={() => up(s => { s.music = ''; })}>CLEAR</button>}
            </Field>
            {!draft.music && <Field label="Built-in tune"><Num value={draft.musicTheme} min={0} max={11} onChange={v => up(s => { s.musicTheme = v; })} slider={false} /></Field>}
            <div className="row"><button className="tiny" onClick={() => audio.playMusic(draft.music, draft.musicTheme)}>▶ PLAY MUSIC</button><button className="tiny" onClick={() => audio.stopMusic()}>■ STOP</button></div>
          </div>
        </div>
        <div className="panel">
          <div className="row"><h3 style={{ margin: 0 }}>LAYERS (back → front)</h3><span className="spacer" />
            <FileButton className="go" accept="image/*" multiple onFiles={async fs => {
              for (const f of fs) {
                const u = await readFileAsDataURL(f); const img = await loadImage(u);
                const L = { ...newLayer(f.name.replace(/\.[^.]+$/, '')), image: u };
                // sensible defaults: scale wide images to fit the stage, place at the top
                L.scale = img.naturalWidth >= draft.width ? 1 : Math.max(1, Math.round(VIEW_H / img.naturalHeight));
                L.parallax = draft.layers.length === 0 ? 0.2 : 0.6; L.y = 0;
                up(s => { s.layers = [...s.layers, L]; }); setSelLayer(L.id);
              }
            }}>+ UPLOAD BACKGROUND IMAGE</FileButton></div>
          <p className="small dim">Parallax 0 = fixed to the screen (sky), 1 = moves with the fighters (floor). Animated layers are horizontal strips of equal-width frames.</p>
          {draft.layers.map((l, i) => <div key={l.id} className="panel inner" style={{ marginTop: 6, boxShadow: selLayer === l.id ? '0 0 0 2px var(--yellow)' : undefined }} onClick={() => setSelLayer(l.id)}>
            <div className="row">
              <div style={{ width: 100, height: 40, background: `url(${l.image}) center/contain no-repeat`, imageRendering: 'pixelated', boxShadow: '0 0 0 1px #000' }} />
              <input value={l.name} onChange={e => setLayer(l.id, { name: e.target.value })} style={{ width: 160 }} />
              <span className="spacer" />
              <button className="tiny" disabled={i === 0} onClick={() => up(s => { const n = [...s.layers];[n[i - 1], n[i]] = [n[i], n[i - 1]]; s.layers = n; })}>▲</button>
              <button className="tiny" disabled={i === draft.layers.length - 1} onClick={() => up(s => { const n = [...s.layers];[n[i + 1], n[i]] = [n[i], n[i + 1]]; s.layers = n; })}>▼</button>
              <FileButton className="tiny" accept="image/*" onFiles={async f => setLayer(l.id, { image: await readFileAsDataURL(f[0]) })}>REPLACE</FileButton>
              <button className="tiny danger" onClick={() => up(s => { s.layers = s.layers.filter(x => x.id !== l.id); })}>✕</button>
            </div>
            {selLayer === l.id && <div className="grid2" style={{ marginTop: 6 }}>
              <div>
                <Field label="Parallax"><Num value={l.parallax} min={0} max={1.5} step={0.05} onChange={v => setLayer(l.id, { parallax: v })} /></Field>
                <Field label="X / Y position"><Num value={l.x} min={-4000} max={4000} onChange={v => setLayer(l.id, { x: v })} slider={false} width={70} /><Num value={l.y} min={-500} max={500} onChange={v => setLayer(l.id, { y: v })} slider={false} width={70} /></Field>
                <Field label="Scale" tip="Whole numbers keep pixels crisp."><Num value={l.scale} min={0.25} max={8} step={0.25} onChange={v => setLayer(l.id, { scale: v })} /></Field>
                <Field label="Opacity"><Num value={l.opacity} min={0} max={1} step={0.05} onChange={v => setLayer(l.id, { opacity: v })} /></Field>
              </div>
              <div>
                <Field label="Repeat horizontally"><Check value={l.repeatX} onChange={v => setLayer(l.id, { repeatX: v })} /></Field>
                <Field label="Auto-scroll" tip="Pixels per second (clouds, traffic…)."><Num value={l.scrollSpeed} min={-200} max={200} onChange={v => setLayer(l.id, { scrollSpeed: v })} slider={false} /></Field>
                <Field label="Animation frames"><Num value={l.frames} min={1} max={64} onChange={v => setLayer(l.id, { frames: v })} slider={false} /></Field>
                {l.frames > 1 && <Field label="Animation FPS"><Num value={l.fps} min={1} max={60} onChange={v => setLayer(l.id, { fps: v })} slider={false} /></Field>}
                <Field label="In front of fighters"><Check value={l.foreground} onChange={v => setLayer(l.id, { foreground: v })} /></Field>
              </div>
            </div>}
          </div>)}
          {!draft.layers.length && <p className="dim">No layers — the sky gradient and floor color are used. Upload pixel-art backgrounds to build parallax depth.</p>}
        </div>
      </div> : <div className="panel">No stages. Press New Stage.</div>}
    </div>
    {confirmDel && draft && <Modal title="Delete stage?" onClose={() => setConfirmDel(false)}>
      <p>Delete "{draft.name}"?</p>
      <div className="row"><button className="danger" onClick={async () => { await store.deleteStage(draft.id); setConfirmDel(false); setDraft(store.stages.find(s => s.id !== draft.id) ? deepClone(store.stages.find(s => s.id !== draft.id)!) : null); }}>DELETE</button><button onClick={() => setConfirmDel(false)}>CANCEL</button></div>
    </Modal>}
  </div>;
}
