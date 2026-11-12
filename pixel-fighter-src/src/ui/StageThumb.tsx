import React, { useEffect, useRef } from 'react';
import type { StageDef } from '../engine/types';
import { Renderer } from '../engine/render';
import { defaultSettings } from '../engine/defaults';
import { loadImage } from '../engine/assets';
import { VIEW_H, VIEW_W } from '../engine/sim';

/** Minimal fake sim so the renderer can draw just a stage. */
export function fakeStageSim(stage: StageDef, camX?: number, zoom = 1) {
  return { stage, cam: { x: camX ?? stage.width / 2, zoom, y: 0 }, tick: 0, f: [], projectiles: [] } as any;
}

export function StageThumb({ stage, animate = false, camX, weather = false, className, style }: { stage: StageDef; animate?: boolean; camX?: number; weather?: boolean; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const s = defaultSettings(); s.scanlines = false;
    const r = new Renderer(c, s);
    let raf = 0, alive = true;
    const draw = () => {
      if (!alive) return;
      const sim = fakeStageSim(stage, camX);
      r.frame++;
      r.drawStage(sim, false);
      if (weather) { r.drawWeather(sim, true); r.drawWeather(sim, false); }
      r.drawStage(sim, true);
      if (animate) raf = requestAnimationFrame(draw);
    };
    Promise.all(stage.layers.map(l => l.image ? loadImage(l.image).catch(() => null) : null)).then(draw);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [stage, animate, camX, weather]);
  return <canvas ref={ref} width={VIEW_W} height={VIEW_H} className={className} style={{ width: '100%', height: '100%', display: 'block', ...style }} />;
}
