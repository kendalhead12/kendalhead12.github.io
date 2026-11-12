import React, { useEffect, useMemo } from 'react';
import { MatchSpec, useNav } from '../App';
import { Portrait } from '../widgets';
import { audio } from '../../engine/audio';

function preLine(self: MatchSpec['p1'], other: MatchSpec['p1']) {
  const pf = self.dialogue.preFight.find(p => p.opponent.toLowerCase() === other.name.toLowerCase() && p.lines.filter(Boolean).length);
  const pool = pf ? pf.lines.filter(Boolean) : self.dialogue.intro.filter(Boolean);
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
}

export function VsScreen({ spec }: { spec: MatchSpec }) {
  const nav = useNav();
  const lines = useMemo(() => [preLine(spec.p1, spec.p2), preLine(spec.p2, spec.p1)], [spec]);
  useEffect(() => {
    audio.play('super');
    const t = setTimeout(() => nav.go({ s: 'fight', spec }), 3200);
    const skip = (e: KeyboardEvent | PointerEvent) => { if ('key' in e && e.key === 'Tab') return; clearTimeout(t); nav.go({ s: 'fight', spec }); };
    const a = setTimeout(() => { window.addEventListener('keydown', skip); window.addEventListener('pointerdown', skip); }, 500);
    return () => { clearTimeout(t); clearTimeout(a); window.removeEventListener('keydown', skip); window.removeEventListener('pointerdown', skip); };
  }, [spec, nav]);
  const stageNo = spec.arcade ? `STAGE ${spec.arcade.index + 1} / ${spec.arcade.ladder.length}` : spec.mode === 'watch' ? 'CPU BATTLE' : 'NEXT MATCH';
  return <div className="vs-screen">
    <div className="vs-side">
      <Portrait def={spec.p1} size={300} />
      <div className="pix" style={{ fontSize: 18, color: 'var(--red)', textShadow: '3px 3px 0 #000' }}>{spec.p1.name}</div>
      {lines[0] && <div className="quote">“{lines[0]}”</div>}
    </div>
    <div className="col center">
      <div className="pix dim" style={{ fontSize: 10 }}>{stageNo}</div>
      <div className="vs-mid">VS</div>
      <div className="pix" style={{ fontSize: 9, color: 'var(--cyan)' }}>{spec.stage.name}</div>
    </div>
    <div className="vs-side r">
      <div style={{ transform: 'scaleX(-1)' }}><Portrait def={spec.p2} size={300} /></div>
      <div className="pix" style={{ fontSize: 18, color: 'var(--cyan)', textShadow: '3px 3px 0 #000' }}>{spec.p2.name}</div>
      {lines[1] && <div className="quote">“{lines[1]}”</div>}
    </div>
  </div>;
}
