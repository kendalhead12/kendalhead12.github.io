import React, { useEffect, useRef, useState } from 'react';
import type { CharacterDef, FrameRef, SpriteSheet } from '../engine/types';
import { getImage, loadImage } from '../engine/assets';
import { animFrame } from '../engine/sim';
import { drawCharFrame, drawPlaceholder } from '../engine/render';

export function Field({ label, tip, help, children }: { label: string; tip?: string; help?: string; children: React.ReactNode }) {
  return <div className="field">
    <span title={tip} className={tip ? 'tip' : ''}>{label}</span>
    <div className="row" style={{ gap: 6 }}>{children}</div>
    {help && <div className="help">{help}</div>}
  </div>;
}

export function Num({ value, onChange, min, max, step = 1, slider = true, width }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; slider?: boolean; width?: number }) {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { if (parseFloat(txt) !== value) setTxt(String(value)); }, [value]);
  const commit = (s: string) => {
    let v = parseFloat(s);
    if (Number.isNaN(v)) return;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    onChange(v);
  };
  return <>
    {slider && min !== undefined && max !== undefined && <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />}
    <input type="number" value={txt} step={step} min={min} max={max} style={width ? { width } : undefined}
      onChange={e => { setTxt(e.target.value); commit(e.target.value); }} onBlur={() => setTxt(String(value))} />
  </>;
}

export function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <span className="color-row"><input type="color" value={value.slice(0, 7)} onChange={e => onChange(e.target.value)} /><span className="dim small">{value}</span></span>;
}

export function Check({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <label><input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />{label}</label>;
}

export function FileButton({ accept, onFiles, children, multiple, className }: { accept: string; onFiles: (f: File[]) => void; children: React.ReactNode; multiple?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return <>
    <button className={className} onClick={() => ref.current?.click()}>{children}</button>
    <input ref={ref} type="file" accept={accept} multiple={multiple} style={{ display: 'none' }}
      onChange={e => { const fl = Array.from(e.target.files || []); e.target.value = ''; if (fl.length) onFiles(fl); }} />
  </>;
}

/** Draws a single sprite frame into a thumbnail canvas. */
export function FrameThumb({ sheet, index, size = 60, flip }: { sheet: SpriteSheet | undefined; index: number; size?: number; flip?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const c = ref.current; if (!c || !sheet) return;
    const fr = sheet.frames[index];
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    if (!fr) return;
    const img = getImage(sheet.image);
    if (!img) { loadImage(sheet.image).then(() => force(x => x + 1)).catch(() => { }); return; }
    const s = Math.min(c.width / fr.w, c.height / fr.h);
    const w = fr.w * s, h = fr.h * s;
    g.save();
    g.translate(c.width / 2, c.height / 2);
    if (flip ?? fr.flipX) g.scale(-1, 1);
    g.drawImage(img, fr.x, fr.y, fr.w, fr.h, -w / 2, -h / 2, w, h);
    g.restore();
  });
  return <canvas ref={ref} width={size} height={size} />;
}

/** Plays a character animation (or explicit frame list) in a small canvas. */
export function AnimPreview({ def, anim, frames, fps = 10, loop = true, width = 160, height = 160, bg = '#0a0a1c', scale = 1, playing = true }:
  { def: CharacterDef; anim?: string; frames?: FrameRef[]; fps?: number; loop?: boolean; width?: number; height?: number; bg?: string; scale?: number; playing?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0, t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current; if (!c) return;
      const g = c.getContext('2d')!;
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, c.width, c.height);
      if (bg !== 'transparent') { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, c.height - 14, c.width, 1); }
      let ref2: FrameRef | null = null;
      if (frames) {
        if (frames.length) {
          const per = Math.max(1, Math.round(60 / Math.max(1, fps)));
          const total = frames.reduce((s, f) => s + (f.ticks || per), 0);
          let tt = loop ? t % total : Math.min(t, total - 1);
          for (const f of frames) { const d = f.ticks || per; if (tt < d) { ref2 = f; break; } tt -= d; }
        }
      } else ref2 = animFrame(def, anim || 'idle', t);
      if (playing) t++;
      const z = Math.min((c.height - 24) / Math.max(40, def.stats.height * 1.15), 3) * scale;
      if (!drawCharFrame(g, def, ref2, c.width / 2, c.height - 14, 1, z))
        drawPlaceholder(g, def, anim || 'idle', c.width / 2, c.height - 14, 1, z);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [def, anim, frames, fps, loop, bg, scale, playing]);
  return <canvas ref={ref} width={width} height={height} style={bg === 'transparent' ? undefined : { background: bg, boxShadow: '0 0 0 2px #000' }} />;
}

export function Portrait({ def, size = 64, className }: { def: CharacterDef; size?: number; className?: string }) {
  if (def.portrait) return <img className={'px ' + (className || '')} src={def.portrait} width={size} height={size} alt={def.name} style={{ imageRendering: 'pixelated', objectFit: 'cover' }} />;
  return <AutoPortrait def={def} size={size} className={className} />;
}
/** Portrait fallback: the idle frame cropped to the upper body. */
export function AutoPortrait({ def, size, className }: { def: CharacterDef; size: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = def.color; g.fillRect(0, 0, c.width, c.height);
    const r = animFrame(def, 'idle', 0);
    const sheet = r && def.sheets.find(s => s.id === r.sheet);
    const fr = sheet?.frames[r!.index];
    if (sheet && fr) {
      const img = getImage(sheet.image);
      if (!img) { loadImage(sheet.image).then(() => force(x => x + 1)).catch(() => { }); return; }
      const cropH = Math.min(fr.h, fr.w * 0.9);
      const s = c.width / Math.max(cropH, 1);
      g.save(); g.translate(c.width / 2, 0);
      if (def.facesLeft !== !!fr.flipX) g.scale(-1, 1);
      g.drawImage(img, fr.x, fr.y, fr.w, cropH, -fr.w * s / 2, 0, fr.w * s, cropH * s);
      g.restore();
    } else {
      g.fillStyle = '#000'; g.font = `${c.width / 2}px "Press Start 2P"`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(def.name.slice(0, 1).toUpperCase() || '?', c.width / 2, c.height / 2 + 2);
    }
  });
  return <canvas ref={ref} className={className} width={64} height={64} style={{ width: size, height: size }} />;
}

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return <div className="overlay" style={{ position: 'fixed' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="panel" style={{ maxWidth: wide ? 'min(1000px, 96vw)' : undefined, width: wide ? '96vw' : undefined }}>
      <div className="row"><h2 style={{ margin: 0 }}>{title}</h2><span className="spacer" /><button className="tiny" onClick={onClose}>✕</button></div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  </div>;
}

export function LinesEditor({ lines, onChange, placeholder }: { lines: string[]; onChange: (l: string[]) => void; placeholder?: string }) {
  return <div className="lines-list">
    {lines.map((l, i) => <div className="ln" key={i}>
      <input value={l} placeholder={placeholder} onChange={e => onChange(lines.map((x, j) => j === i ? e.target.value : x))} />
      <button className="tiny danger" onClick={() => onChange(lines.filter((_, j) => j !== i))} title="Remove line">✕</button>
    </div>)}
    <div><button className="tiny go" onClick={() => onChange([...lines, ''])}>+ Add line</button></div>
  </div>;
}

export function StatBar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div className="statbar"><span>{label}</span><div className="bar"><i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div><span>{Math.round(value * 100) / 100}</span></div>;
}
