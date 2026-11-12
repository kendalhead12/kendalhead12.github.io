import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationDef, CharacterDef, FrameRect, SpriteSheet } from '../../engine/types';
import { ANIM_HELP, STANDARD_ANIMS } from '../../engine/types';
import type { Update } from './CharacterEditor';
import { getImage, imageToData, loadImage, makeCanvas, opaqueBounds } from '../../engine/assets';
import { formatFrameList, parseFrameList, readFileAsDataURL, uid } from '../../engine/util';
import { AnimPreview, Check, Field, FileButton, FrameThumb, Modal, Num } from '../widgets';
import { FramePicker } from './common';
import { resolveAnim } from '../../engine/sim';
import { useStore } from '../store';
import { suggestedScale } from './CharacterEditor';

// ============================================================================
// Image analysis helpers
async function sheetData(sheet: SpriteSheet) {
  const img = await loadImage(sheet.image);
  return { img, data: imageToData(img) };
}

export interface GridOpts { mode: 'count' | 'size'; cols: number; rows: number; cw: number; ch: number; offX: number; offY: number; spX: number; spY: number; skipEmpty: boolean; trim: boolean; origin: 'bottom' | 'center' | 'topleft' }

function sliceGrid(data: ImageData, o: GridOpts): FrameRect[] {
  const W = data.width, H = data.height;
  const cw = o.mode === 'count' ? Math.floor((W - o.offX - o.spX * (o.cols - 1)) / Math.max(1, o.cols)) : o.cw;
  const ch = o.mode === 'count' ? Math.floor((H - o.offY - o.spY * (o.rows - 1)) / Math.max(1, o.rows)) : o.ch;
  if (cw < 1 || ch < 1) return [];
  const out: FrameRect[] = [];
  for (let y = o.offY; y + ch <= H; y += ch + o.spY) for (let x = o.offX; x + cw <= W; x += cw + o.spX) {
    const b = opaqueBounds(data, x, y, cw, ch);
    if (o.skipEmpty && !b) continue;
    const ax = o.origin === 'topleft' ? x : x + cw / 2, ay = o.origin === 'bottom' ? y + ch : o.origin === 'center' ? y + ch / 2 : y;
    const r = o.trim && b ? b : { x, y, w: cw, h: ch };
    out.push({ ...r, ox: Math.round(ax - r.x), oy: Math.round(ay - r.y) });
  }
  return out;
}

/** Connected-component sprite detection — handles sheets with differently sized frames. */
function autoDetect(data: ImageData, gap: number, minSize: number): FrameRect[] {
  const W = data.width, H = data.height, d = data.data;
  const seen = new Uint8Array(W * H);
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (seen[i] || d[i * 4 + 3] <= 8) continue;
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % W, y = (p / W) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= W * H || seen[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
        if (d[q * 4 + 3] > 8) { seen[q] = 1; stack.push(q); }
      }
    }
    boxes.push({ x0, y0, x1, y1 });
  }
  // merge boxes closer than `gap`
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 - gap <= b.x1 && b.x0 - gap <= a.x1 && a.y0 - gap <= b.y1 && b.y0 - gap <= a.y1) {
        boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
        boxes.splice(j, 1); merged = true; break;
      }
    }
  }
  const rects = boxes.map(b => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 })).filter(r => r.w * r.h >= minSize);
  // reading order: rows by vertical overlap, then left→right
  rects.sort((a, b) => a.y - b.y);
  const rows: typeof rects[] = [];
  for (const r of rects) {
    const row = rows.find(rw => rw.some(o => r.y < o.y + o.h * 0.7 && o.y < r.y + r.h * 0.7));
    if (row) row.push(r); else rows.push([r]);
  }
  return rows.flatMap(rw => rw.sort((a, b) => a.x - b.x)).map(r => ({ ...r, ox: Math.round(r.w / 2), oy: r.h }));
}

function cornerColor(data: ImageData): [number, number, number] | null {
  const W = data.width, H = data.height, d = data.data;
  const pts = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
  const counts = new Map<string, number>();
  for (const [x, y] of pts) {
    const i = (y * W + x) * 4;
    if (d[i + 3] < 250) return null;
    const k = `${d[i]},${d[i + 1]},${d[i + 2]}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best[0].split(',').map(Number) as [number, number, number];
}

function keyOut(img: HTMLImageElement, rgb: [number, number, number], tol: number): string {
  const [c, g] = makeCanvas(img.naturalWidth, img.naturalHeight);
  g.drawImage(img, 0, 0);
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]);
    if (dist <= tol) d[i + 3] = 0;
  }
  g.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

// ============================================================================
export function SpritesTab({ d, update }: { d: CharacterDef; update: Update }) {
  const store = useStore();
  const [sel, setSel] = useState(d.sheets[0]?.id || '');
  const sheet = d.sheets.find(s => s.id === sel) || d.sheets[0];
  const [err, setErr] = useState('');
  const upload = async (files: File[]) => {
    setErr('');
    for (const f of files) {
      if (!/image\/(png|gif|webp|jpeg|bmp)/.test(f.type)) { setErr(`"${f.name}" is not an image. Please upload PNG sprite sheets (transparent backgrounds work best).`); continue; }
      const url = await readFileAsDataURL(f);
      try {
        const img = await loadImage(url);
        if (img.naturalWidth > 8192 || img.naturalHeight > 8192) { setErr('That image is larger than 8192px — please split it into smaller sheets.'); continue; }
        const s: SpriteSheet = { id: uid('sheet'), name: f.name.replace(/\.[^.]+$/, ''), image: url, width: img.naturalWidth, height: img.naturalHeight, frames: [] };
        update(x => { x.sheets = [...x.sheets, s]; });
        setSel(s.id);
      } catch { setErr(`Could not read "${f.name}".`); }
    }
  };
  const usedBy = (id: string) => Object.entries(d.animations).filter(([, a]) => a.frames.some(f => f.sheet === id)).length + d.attacks.filter(a => a.frames.some(f => f.ref?.sheet === id)).length;
  return <div className="split">
    <div className="col">
      <div className="panel col">
        <h3 style={{ marginTop: 0 }}>SPRITE SHEETS</h3>
        <FileButton className="go" accept="image/png,image/gif,image/webp,image/jpeg" multiple onFiles={upload}>+ UPLOAD PNG</FileButton>
        {err && <div className="notice bad">{err}</div>}
        <div className="list">
          {d.sheets.map(s => <div key={s.id} className={'item' + (sheet?.id === s.id ? ' sel' : '')} onClick={() => setSel(s.id)}>
            <div className="fthumb" style={{ width: 40, height: 40 }}><FrameThumb sheet={{ ...s, frames: [{ x: 0, y: 0, w: s.width, h: s.height, ox: 0, oy: 0 }] }} index={0} size={40} /></div>
            <div className="grow"><div>{s.name}</div><div className="small dim">{s.width}×{s.height} · {s.frames.length} frames</div></div>
          </div>)}
        </div>
        {!d.sheets.length && <p className="small dim">Upload a character sheet, plus separate sheets for projectiles or effects if you like. All of a character's sheets can be used anywhere.</p>}
      </div>
      <div className="panel">
        <Field label="Sprite scale" tip="How big source pixels appear in the game. Whole numbers keep pixels crisp."><Num value={d.scale} min={0.25} max={6} step={0.25} onChange={v => update(x => { x.scale = v; })} slider={false} /></Field>
        <Field label="Art faces left"><Check value={d.facesLeft} onChange={v => update(x => { x.facesLeft = v; })} /></Field>
      </div>
    </div>
    <div>
      {sheet ? <SheetEditor key={sheet.id} d={d} sheet={sheet} update={update} usedBy={usedBy(sheet.id)} onDelete={() => { update(x => { x.sheets = x.sheets.filter(s => s.id !== sheet.id); }); setSel(''); store.toast('Sheet removed'); }} />
        : <div className="panel center" style={{ minHeight: 300 }}><p className="pix" style={{ fontSize: 10 }}>UPLOAD A SPRITE SHEET TO START</p><p className="dim">PNG with a transparent background works best. Solid backgrounds can be removed here too.</p></div>}
    </div>
  </div>;
}

type Tool = 'select' | 'draw' | 'origin' | 'pick';

function SheetEditor({ d, sheet, update, usedBy, onDelete }: { d: CharacterDef; sheet: SpriteSheet; update: Update; usedBy: number; onDelete: () => void }) {
  const store = useStore();
  const [zoom, setZoom] = useState(() => Math.max(1, Math.min(4, Math.floor(900 / Math.max(1, sheet.width)))));
  const [tool, setTool] = useState<Tool>('select');
  const [sel, setSel] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number; move?: boolean; orig?: FrameRect } | null>(null);
  const [grid, setGrid] = useState<GridOpts>({ mode: 'size', cols: 8, rows: 4, cw: Math.min(96, sheet.width), ch: Math.min(96, sheet.height), offX: 0, offY: 0, spX: 0, spY: 0, skipEmpty: true, trim: false, origin: 'bottom' });
  const [gap, setGap] = useState(4);
  const [minSize, setMinSize] = useState(40);
  const [bg, setBg] = useState<[number, number, number] | null>(null);
  const [tol, setTol] = useState(24);
  const [confirmDel, setConfirmDel] = useState(false);
  const [, force] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const setSheet = (fn: (s: SpriteSheet) => SpriteSheet) => update(x => { x.sheets = x.sheets.map(s => s.id === sheet.id ? fn({ ...s }) : s); });
  const setFrames = (frames: FrameRect[]) => setSheet(s => ({ ...s, frames }));
  const fr = sheet.frames[sel];
  const setFr = (p: Partial<FrameRect>) => setFrames(sheet.frames.map((f, i) => i === sel ? { ...f, ...p } : f));

  useEffect(() => { sheetData(sheet).then(({ data }) => setBg(cornerColor(data))).catch(() => { }); }, [sheet.image]);

  // draw sheet + frame boxes
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const img = getImage(sheet.image);
    if (!img) { loadImage(sheet.image).then(() => force(x => x + 1)); return; }
    c.width = sheet.width * zoom; c.height = sheet.height * zoom;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    g.font = '8px "Press Start 2P"'; g.textBaseline = 'top';
    sheet.frames.forEach((f, i) => {
      const s = i === sel;
      g.strokeStyle = s ? '#ffd21a' : 'rgba(94,240,255,.8)'; g.lineWidth = s ? 2 : 1;
      g.strokeRect(f.x * zoom + 0.5, f.y * zoom + 0.5, f.w * zoom - 1, f.h * zoom - 1);
      g.fillStyle = s ? '#ffd21a' : 'rgba(0,0,0,.7)'; g.fillRect(f.x * zoom, f.y * zoom, 10 + String(i + 1).length * 8, 11);
      g.fillStyle = s ? '#000' : '#5ef0ff'; g.fillText(String(i + 1), f.x * zoom + 2, f.y * zoom + 2);
      const ox = (f.x + f.ox) * zoom, oy = (f.y + f.oy) * zoom;
      g.fillStyle = '#ff3a5a'; g.fillRect(ox - 4, oy, 9, 1); g.fillRect(ox, oy - 4, 1, 9);
      if (f.flipX) { g.fillStyle = '#b46aff'; g.fillText('⇋', f.x * zoom + f.w * zoom - 10, f.y * zoom + 2); }
    });
    if (drag && !drag.move) {
      g.strokeStyle = '#5eff8a'; g.lineWidth = 2;
      g.strokeRect(Math.min(drag.x0, drag.x1) * zoom, Math.min(drag.y0, drag.y1) * zoom, Math.abs(drag.x1 - drag.x0) * zoom, Math.abs(drag.y1 - drag.y0) * zoom);
    }
  });

  const pos = (e: React.PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / zoom), y: Math.floor((e.clientY - r.top) / zoom) };
  };
  const hit = (x: number, y: number) => {
    for (let i = sheet.frames.length - 1; i >= 0; i--) { const f = sheet.frames[i]; if (x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h) return i; }
    return -1;
  };
  const onDown = async (e: React.PointerEvent) => {
    const p = pos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (tool === 'pick') {
      const { data } = await sheetData(sheet);
      const i = (p.y * data.width + p.x) * 4;
      setBg([data.data[i], data.data[i + 1], data.data[i + 2]]); setTool('select'); return;
    }
    if (tool === 'origin') {
      const i = hit(p.x, p.y) >= 0 ? hit(p.x, p.y) : sel;
      const f = sheet.frames[i]; if (!f) return;
      setSel(i);
      setFrames(sheet.frames.map((q, j) => j === i ? { ...q, ox: p.x - q.x, oy: p.y - q.y } : q));
      return;
    }
    const h = hit(p.x, p.y);
    if (tool === 'select' && h >= 0) { setSel(h); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, move: true, orig: { ...sheet.frames[h] } }); return; }
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pos(e);
    if (drag.move && drag.orig && e.shiftKey) {
      setFr({ x: drag.orig.x + p.x - drag.x0, y: drag.orig.y + p.y - drag.y0 });
    }
    setDrag({ ...drag, x1: p.x, y1: p.y });
  };
  const onUp = () => {
    if (!drag) return;
    if (!drag.move) {
      const x = Math.max(0, Math.min(drag.x0, drag.x1)), y = Math.max(0, Math.min(drag.y0, drag.y1));
      const w = Math.min(sheet.width - x, Math.abs(drag.x1 - drag.x0) + 1), h = Math.min(sheet.height - y, Math.abs(drag.y1 - drag.y0) + 1);
      if (w > 2 && h > 2) { setFrames([...sheet.frames, { x, y, w, h, ox: Math.round(w / 2), oy: h }]); setSel(sheet.frames.length); }
    }
    setDrag(null);
  };

  const applyGrid = async (append: boolean) => {
    const { data } = await sheetData(sheet);
    const f = sliceGrid(data, grid);
    setFrames(append ? [...sheet.frames, ...f] : f); setSel(append ? sheet.frames.length : 0);
    if (!append) autoSize(f);
  };
  const autoSize = (frames: FrameRect[]) => {
    // first slice of a brand-new character: pick a scale that matches the built-in fighters
    if (d.scale !== 1 || Object.values(d.animations).some(a => a.frames.length) || !frames.length) return;
    const hs = frames.map(f => f.oy).sort((a, b) => a - b);
    const med = hs[Math.floor(hs.length / 2)];
    const sc = Math.max(1, Math.min(6, Math.round(125 / Math.max(8, med))));
    const ws = frames.map(f => f.w).sort((a, b) => a - b);
    update(x => { x.scale = sc; x.stats = { ...x.stats, height: Math.round(med * sc * 0.95), width: Math.round(Math.min(ws[Math.floor(ws.length / 2)] * 0.6, med * 0.35) * sc) }; });
    store.toast(`Sprite scale set to ${sc}× and body size fitted — change it on Basics if needed.`);
  };
  const detect = async () => { const { data } = await sheetData(sheet); const f = autoDetect(data, gap, minSize); setFrames(f); setSel(0); autoSize(f); };
  const trimAll = async (only?: number) => {
    const { data } = await sheetData(sheet);
    setFrames(sheet.frames.map((f, i) => {
      if (only !== undefined && i !== only) return f;
      const b = opaqueBounds(data, f.x, f.y, f.w, f.h);
      if (!b) return f;
      return { ...f, ...b, ox: f.ox - (b.x - f.x), oy: f.oy - (b.y - f.y) };
    }));
  };
  const alignAll = (mode: 'bottom' | 'center') => setFrames(sheet.frames.map(f => ({ ...f, ox: Math.round(f.w / 2), oy: mode === 'bottom' ? f.h : Math.round(f.h / 2) })));
  const removeBg = async () => {
    if (!bg) return;
    const img = await loadImage(sheet.image);
    const url = keyOut(img, bg, tol);
    setSheet(s => ({ ...s, image: url }));
    setBg(null);
  };
  const G = (k: keyof GridOpts) => (v: any) => setGrid(g => ({ ...g, [k]: v }));
  const prev = sheet.frames[sel - 1];

  return <div className="col">
    <div className="panel">
      <div className="row">
        <input value={sheet.name} onChange={e => setSheet(s => ({ ...s, name: e.target.value }))} style={{ width: 200 }} />
        <span className="dim small">{sheet.width}×{sheet.height}px · {sheet.frames.length} frames{usedBy ? ` · used by ${usedBy} animation(s)/attack(s)` : ''}</span>
        <span className="spacer" />
        <FileButton className="tiny" accept="image/*" onFiles={async f => { const u = await readFileAsDataURL(f[0]); const img = await loadImage(u); setSheet(s => ({ ...s, image: u, width: img.naturalWidth, height: img.naturalHeight })); }}>REPLACE IMAGE</FileButton>
        <button className="tiny danger" onClick={() => setConfirmDel(true)}>DELETE SHEET</button>
      </div>
    </div>
    <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>① AUTO-DETECT SPRITES</h3>
        <p className="small dim">Finds every separate sprite on a transparent sheet — works with differently sized frames.</p>
        <Field label="Merge gap (px)" tip="Pieces closer than this are joined into one frame (e.g. a detached hand)."><Num value={gap} min={0} max={40} onChange={setGap} slider={false} /></Field>
        <Field label="Ignore smaller than"><Num value={minSize} min={1} max={5000} onChange={setMinSize} slider={false} /><span className="small dim">px²</span></Field>
        <button className="go" onClick={detect} disabled={!!bg}>AUTO-DETECT</button>
        {bg && <p className="small warn">Remove the solid background first (③) so sprites can be separated.</p>}
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>② GRID SLICE</h3>
        <Field label="Slice by"><select value={grid.mode} onChange={e => G('mode')(e.target.value)}><option value="size">Cell size</option><option value="count">Columns × rows</option></select></Field>
        {grid.mode === 'size' ? <Field label="Cell W × H"><Num value={grid.cw} min={2} max={2048} onChange={G('cw')} slider={false} width={70} /><Num value={grid.ch} min={2} max={2048} onChange={G('ch')} slider={false} width={70} /></Field>
          : <Field label="Columns × rows"><Num value={grid.cols} min={1} max={128} onChange={G('cols')} slider={false} width={70} /><Num value={grid.rows} min={1} max={128} onChange={G('rows')} slider={false} width={70} /></Field>}
        <Field label="Offset X / Y"><Num value={grid.offX} min={0} max={2048} onChange={G('offX')} slider={false} width={70} /><Num value={grid.offY} min={0} max={2048} onChange={G('offY')} slider={false} width={70} /></Field>
        <Field label="Spacing X / Y"><Num value={grid.spX} min={0} max={256} onChange={G('spX')} slider={false} width={70} /><Num value={grid.spY} min={0} max={256} onChange={G('spY')} slider={false} width={70} /></Field>
        <Field label="Origin (feet)"><select value={grid.origin} onChange={e => G('origin')(e.target.value)}><option value="bottom">Bottom center</option><option value="center">Center</option><option value="topleft">Top left</option></select></Field>
        <div className="row"><Check value={grid.skipEmpty} onChange={G('skipEmpty')} label="Skip empty cells" /><Check value={grid.trim} onChange={G('trim')} label="Trim margins" /></div>
        <div className="row"><button className="go" onClick={() => applyGrid(false)}>SLICE</button><button onClick={() => applyGrid(true)}>APPEND</button></div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>③ BACKGROUND & CLEANUP</h3>
        {bg ? <>
          <p className="small">Solid background detected: <span className="chip" style={{ background: `rgb(${bg.join(',')})` }} /> rgb({bg.join(', ')})</p>
          <Field label="Tolerance"><Num value={tol} min={0} max={200} onChange={setTol} /></Field>
          <button className="go" onClick={removeBg}>MAKE TRANSPARENT</button>
        </> : <p className="small ok">Background is transparent ✓</p>}
        <div className="row"><button className="tiny" onClick={() => setTool('pick')}>PICK BG COLOR</button></div>
        <h4>ALL FRAMES</h4>
        <div className="row">
          <button className="tiny" onClick={() => trimAll()}>TRIM EMPTY MARGINS</button>
          <button className="tiny" onClick={() => alignAll('bottom')}>ORIGINS → FEET</button>
          <button className="tiny" onClick={() => alignAll('center')}>ORIGINS → CENTER</button>
          <button className="tiny danger" onClick={() => { setFrames([]); setSel(0); }}>CLEAR FRAMES</button>
        </div>
      </div>
    </div>
    <div className="panel">
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="pix" style={{ fontSize: 9 }}>TOOL:</span>
        {(['select', 'draw', 'origin'] as Tool[]).map(t => <button key={t} className={'tiny' + (tool === t ? ' active' : '')} onClick={() => setTool(t)}>{t === 'select' ? 'SELECT/MOVE' : t === 'draw' ? 'DRAW FRAME' : 'SET ORIGIN'}</button>)}
        {tool === 'pick' && <span className="badge gold">CLICK THE BACKGROUND COLOR</span>}
        <span className="spacer" />
        <span className="dim small">Zoom</span>
        <input type="range" min={1} max={8} value={zoom} onChange={e => setZoom(+e.target.value)} /><span className="small">{zoom}×</span>
      </div>
      <p className="small dim" style={{ marginTop: 0 }}>
        {tool === 'select' && 'Click a frame to select it. Shift+drag moves it. Drag on empty space to draw a new frame.'}
        {tool === 'draw' && 'Drag a rectangle around a sprite to add a frame manually.'}
        {tool === 'origin' && 'Click where the character\'s feet touch the ground. The red cross is the origin used for alignment.'}
      </p>
      <div className="sheet-view">
        <canvas ref={cv} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: tool === 'origin' ? 'cell' : tool === 'pick' ? 'copy' : 'crosshair' }} />
      </div>
    </div>
    {fr && <div className="panel">
      <h3 style={{ marginTop: 0 }}>FRAME {sel + 1} OF {sheet.frames.length}</h3>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <OnionSkin sheet={sheet} cur={fr} prev={prev} />
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="tiny" onClick={() => setSel(Math.max(0, sel - 1))}>◀</button>
            <button className="tiny" onClick={() => setSel(Math.min(sheet.frames.length - 1, sel + 1))}>▶</button>
          </div>
        </div>
        <div className="grow">
          <Field label="Rect x, y"><Num value={fr.x} onChange={v => setFr({ x: v })} slider={false} width={70} /><Num value={fr.y} onChange={v => setFr({ y: v })} slider={false} width={70} /></Field>
          <Field label="Size w × h"><Num value={fr.w} min={1} onChange={v => setFr({ w: v })} slider={false} width={70} /><Num value={fr.h} min={1} onChange={v => setFr({ h: v })} slider={false} width={70} /></Field>
          <Field label="Origin x, y" tip="Anchor point (feet) inside the frame."><Num value={fr.ox} onChange={v => setFr({ ox: v })} slider={false} width={70} /><Num value={fr.oy} onChange={v => setFr({ oy: v })} slider={false} width={70} /></Field>
          <Field label="Nudge" tip="Extra draw offset to line this frame up with the previous one (onion skin)."><button className="tiny" onClick={() => setFr({ dx: (fr.dx || 0) - 1 })}>←</button><button className="tiny" onClick={() => setFr({ dx: (fr.dx || 0) + 1 })}>→</button><button className="tiny" onClick={() => setFr({ dy: (fr.dy || 0) - 1 })}>↑</button><button className="tiny" onClick={() => setFr({ dy: (fr.dy || 0) + 1 })}>↓</button><span className="small dim">{fr.dx || 0}, {fr.dy || 0}</span></Field>
          <Field label="Flip horizontally"><Check value={!!fr.flipX} onChange={v => setFr({ flipX: v })} /></Field>
          <div className="row">
            <button className="tiny" onClick={() => trimAll(sel)}>TRIM</button>
            <button className="tiny" onClick={() => setFr({ ox: Math.round(fr.w / 2), oy: fr.h })}>ORIGIN → FEET</button>
            <button className="tiny" onClick={() => { const n = [...sheet.frames]; n.splice(sel + 1, 0, { ...fr }); setFrames(n); setSel(sel + 1); }}>DUPLICATE</button>
            <button className="tiny" onClick={() => { const n = [...sheet.frames]; n.splice(sel + 1, 0, { ...fr, flipX: !fr.flipX }); setFrames(n); setSel(sel + 1); }}>DUPLICATE FLIPPED</button>
            <button className="tiny" disabled={sel === 0} onClick={() => { const n = [...sheet.frames];[n[sel - 1], n[sel]] = [n[sel], n[sel - 1]]; setFrames(n); setSel(sel - 1); }}>MOVE EARLIER</button>
            <button className="tiny" disabled={sel >= sheet.frames.length - 1} onClick={() => { const n = [...sheet.frames];[n[sel + 1], n[sel]] = [n[sel], n[sel + 1]]; setFrames(n); setSel(sel + 1); }}>MOVE LATER</button>
            <button className="tiny danger" onClick={() => { setFrames(sheet.frames.filter((_, i) => i !== sel)); setSel(Math.max(0, sel - 1)); }}>DELETE FRAME</button>
          </div>
          <p className="small warn">Reordering or deleting frames changes frame numbers used by animations.</p>
        </div>
      </div>
    </div>}
    {confirmDel && <Modal title="Delete sheet?" onClose={() => setConfirmDel(false)}>
      <p>Delete "{sheet.name}"? {usedBy ? `${usedBy} animation(s)/attack(s) use it and will lose those frames.` : ''}</p>
      <div className="row"><button className="danger" onClick={() => { setConfirmDel(false); onDelete(); }}>DELETE</button><button onClick={() => setConfirmDel(false)}>CANCEL</button></div>
    </Modal>}
  </div>;
}

/** Previous frame ghosted behind the current one, aligned on the origin. */
function OnionSkin({ sheet, cur, prev }: { sheet: SpriteSheet; cur: FrameRect; prev?: FrameRect }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const img = getImage(sheet.image); if (!img) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    const maxDim = Math.max(cur.w, cur.h, prev?.w ?? 0, prev?.h ?? 0);
    const s = Math.max(1, Math.floor(180 / maxDim));
    const ox = c.width / 2, oy = c.height - 20;
    const draw = (f: FrameRect, a: number) => {
      g.globalAlpha = a;
      g.save(); g.translate(ox, oy); if (f.flipX) g.scale(-1, 1);
      g.drawImage(img, f.x, f.y, f.w, f.h, (-f.ox + (f.dx || 0)) * s, (-f.oy + (f.dy || 0)) * s, f.w * s, f.h * s);
      g.restore();
    };
    if (prev) draw(prev, 0.3);
    draw(cur, 1);
    g.globalAlpha = 1;
    g.fillStyle = '#ff3a5a'; g.fillRect(ox - 8, oy, 17, 1); g.fillRect(ox, oy - 8, 1, 17);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, oy, c.width, 1);
  });
  return <canvas ref={ref} width={200} height={220} style={{ background: 'repeating-conic-gradient(#20203a 0% 25%, #16162a 0% 50%) 50% / 12px 12px', boxShadow: '0 0 0 2px #000' }} title="Onion skin: previous frame shown faintly" />;
}

// ============================================================================
export function AnimationsTab({ d, update }: { d: CharacterDef; update: Update }) {
  const [sel, setSel] = useState<string>('idle');
  const [newName, setNewName] = useState('');
  const custom = Object.keys(d.animations).filter(k => !(STANDARD_ANIMS as readonly string[]).includes(k));
  const a: AnimationDef = d.animations[sel] || { frames: [], fps: 8, loop: sel === 'idle' || sel === 'walk' || sel === 'run' };
  const setA = (p: Partial<AnimationDef>) => update(x => { x.animations = { ...x.animations, [sel]: { ...a, ...p } }; });
  const res = resolveAnim(d, sel);
  const sheetOf = (id: string) => d.sheets.find(s => s.id === id);
  const sameSheet = a.frames.length > 0 && a.frames.every(f => f.sheet === a.frames[0].sheet);
  const [txt, setTxt] = useState('');
  useEffect(() => { setTxt(sameSheet ? formatFrameList(a.frames.map(f => f.index)) : ''); }, [sel, d.animations[sel]]);
  const status = (k: string) => d.animations[k]?.frames.length ? <span className="ok">✓ {d.animations[k].frames.length}</span> : <span className="dim">→ {resolveAnim(d, k)?.name || 'placeholder'}</span>;
  const usedByAttacks = useMemo(() => d.attacks.filter(at => at.cinematic?.timeline.some(e => e.anim === sel)).map(at => at.name), [d.attacks, sel]);

  return <div className="split">
    <div className="col">
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>STANDARD</h3>
        <div className="list">{STANDARD_ANIMS.map(k => <div key={k} className={'item' + (sel === k ? ' sel' : '')} onClick={() => setSel(k)} title={ANIM_HELP[k]}><span className="grow">{k}</span><span className="small">{status(k)}</span></div>)}</div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>CUSTOM</h3>
        <p className="small dim">Extra animations for cinematic timelines (e.g. "super_pose").</p>
        <div className="list">{custom.map(k => <div key={k} className={'item' + (sel === k ? ' sel' : '')} onClick={() => setSel(k)}><span className="grow">{k}</span><span className="small">{status(k)}</span></div>)}</div>
        <div className="row" style={{ marginTop: 6 }}>
          <input value={newName} placeholder="new_animation" onChange={e => setNewName(e.target.value.replace(/[^a-z0-9_]/gi, '_'))} style={{ width: 140 }} />
          <button className="tiny go" disabled={!newName || !!d.animations[newName]} onClick={() => { update(x => { x.animations = { ...x.animations, [newName]: { frames: [], fps: 10, loop: false } }; }); setSel(newName); setNewName(''); }}>+ ADD</button>
        </div>
      </div>
    </div>
    <div className="col">
      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>{sel}</h2>
          <span className="dim">{ANIM_HELP[sel] || 'Custom animation'}</span>
          <span className="spacer" />
          {!(STANDARD_ANIMS as readonly string[]).includes(sel) && <button className="tiny danger" onClick={() => { update(x => { const n = { ...x.animations }; delete n[sel]; x.animations = n; }); setSel('idle'); }}>DELETE</button>}
          {a.frames.length > 0 && <button className="tiny danger" onClick={() => setA({ frames: [] })}>CLEAR FRAMES</button>}
        </div>
        {!a.frames.length && res && res.name !== sel && <div className="notice info">No frames yet — the game will use <b>{res.name}</b> instead (fallback).</div>}
        {!a.frames.length && !res && <div className="notice">No Idle animation yet — the fighter will appear as a placeholder figure.</div>}
        {usedByAttacks.length > 0 && <p className="small dim">Used by: {usedByAttacks.join(', ')}</p>}
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, marginTop: 8 }}>
          <AnimPreview def={d} frames={a.frames.length ? a.frames : undefined} anim={sel} fps={a.fps} loop={a.loop} width={220} height={240} />
          <div className="grow">
            <Field label="Frames" tip="Type frame numbers from the selected sheet, e.g. 1-4 or 1,2,3,4."><input value={txt} placeholder="e.g. 1-4" onChange={e => setTxt(e.target.value)} style={{ width: 160 }} />
              <button className="tiny go" onClick={() => {
                const sh = sameSheet ? a.frames[0].sheet : d.sheets[0]?.id;
                const s = sh && sheetOf(sh); if (!s) return;
                setA({ frames: parseFrameList(txt, s.frames.length).map(index => ({ sheet: s.id, index })) });
              }}>APPLY</button></Field>
            <Field label="FPS" tip="Frames per second (60 = one frame per game tick)."><Num value={a.fps} min={1} max={60} onChange={v => setA({ fps: v })} /></Field>
            <Field label="Loop"><Check value={a.loop} onChange={v => setA({ loop: v })} /></Field>
            {a.loop && <Field label="Loop from frame" tip="Frames before this play once (e.g. a wind-up), then the rest loops."><Num value={(a.loopStart ?? 0) + 1} min={1} max={Math.max(1, a.frames.length)} onChange={v => setA({ loopStart: v - 1 })} slider={false} /></Field>}
          </div>
        </div>
        <h4>TIMELINE (click ✕ to remove · per-frame hold in ticks overrides FPS)</h4>
        <div className="frames-strip" style={{ maxHeight: 'none' }}>
          {a.frames.map((f, i) => <div key={i} className="col" style={{ gap: 2, alignItems: 'center' }}>
            <div className="fthumb"><FrameThumb sheet={sheetOf(f.sheet)} index={f.index} size={60} /><span className="n">{i + 1}·#{f.index + 1}</span></div>
            <input type="number" min={0} max={240} value={f.ticks || 0} title="Hold ticks (0 = use FPS)" style={{ width: 56, fontSize: 16 }} onChange={e => setA({ frames: a.frames.map((x, j) => j === i ? { ...x, ticks: Math.max(0, +e.target.value) || undefined } : x) })} />
            <div className="row" style={{ gap: 0 }}>
              <button className="tiny icon" disabled={i === 0} onClick={() => { const n = [...a.frames];[n[i - 1], n[i]] = [n[i], n[i - 1]]; setA({ frames: n }); }}>◀</button>
              <button className="tiny icon danger" onClick={() => setA({ frames: a.frames.filter((_, j) => j !== i) })}>✕</button>
              <button className="tiny icon" disabled={i === a.frames.length - 1} onClick={() => { const n = [...a.frames];[n[i + 1], n[i]] = [n[i], n[i + 1]]; setA({ frames: n }); }}>▶</button>
            </div>
          </div>)}
          {!a.frames.length && <span className="dim">Click frames below to add them in order.</span>}
        </div>
      </div>
      <div className="panel">
        <h3 style={{ marginTop: 0 }}>ADD FRAMES</h3>
        <FramePicker def={d} highlight={a.frames} onPick={r => setA({ frames: [...a.frames, r] })} onPickMany={rs => setA({ frames: [...a.frames, ...rs] })} />
      </div>
    </div>
  </div>;
}
