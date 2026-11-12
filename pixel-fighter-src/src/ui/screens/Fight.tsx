import React, { useEffect, useRef, useState } from 'react';
import { MatchResult, MatchSpec, useNav } from '../App';
import { useStore } from '../store';
import { Game, ControllerSpec } from '../../engine/game';
import type { SimConfig, TrainingOptions } from '../../engine/sim';
import { VIEW_H, VIEW_W } from '../../engine/sim';
import { touchState } from '../../engine/controls';
import { emptyInput } from '../../engine/input';
import type { AttackDef, CharacterDef } from '../../engine/types';
import { Modal } from '../widgets';

export function inputText(a: AttackDef['input'] | null | undefined): string {
  if (!a) return '';
  const motion: Record<string, string> = { none: '', qcf: '↓↘→ + ', qcb: '↓↙← + ', dp: '→↓↘ + ', hcb: '→↘↓↙← + ', dqcf: '↓↘→↓↘→ + ' };
  const dir: Record<string, string> = { any: '', neutral: '', forward: '→ + ', back: '← + ', down: '↓ + ', up: '↑ + ', downforward: '↘ + ' };
  const btn: Record<string, string> = { L: 'Light', M: 'Medium', H: 'Heavy', S: 'Special', G: 'Grab', A: 'Any attack', SH: 'Special+Heavy' };
  return (a.motion !== 'none' ? motion[a.motion] : dir[a.dir]) + btn[a.button];
}

export function MoveList({ def }: { def: CharacterDef }) {
  const order = ['super', 'special', 'throw', 'heavy', 'medium', 'light'];
  const atks = [...def.attacks].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return <table className="movelist"><tbody>
    {atks.map(a => <tr key={a.id}>
      <td>{a.name}{a.stance === 'air' ? ' (air)' : ''}</td>
      <td>{inputText(a.input)}{a.input2 ? <span className="dim"> or {inputText(a.input2)}</span> : null}</td>
      <td className="dim">{a.type}{a.energyCost ? ` · ${a.energyCost} meter` : ''}</td>
    </tr>)}
    <tr><td>Dash / Run</td><td>Dash button, or tap →→ (hold to run)</td><td className="dim">movement</td></tr>
    <tr><td>Block</td><td>Hold ← (↙ for lows)</td><td className="dim">defense</td></tr>
  </tbody></table>;
}

function TouchControls() {
  const stick = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [btns, setBtns] = useState<Record<string, boolean>>({});
  useEffect(() => () => { Object.assign(touchState, emptyInput()); }, []);
  const onStick = (e: React.PointerEvent) => {
    const el = stick.current; if (!el) return;
    if (e.type === 'pointerdown') el.setPointerCapture(e.pointerId);
    if (e.type === 'pointerup' || e.type === 'pointercancel') {
      setKnob({ x: 0, y: 0 }); touchState.left = touchState.right = touchState.up = touchState.down = false; return;
    }
    if (e.type === 'pointermove' && !el.hasPointerCapture(e.pointerId)) return;
    const r = el.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 20, d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    setKnob({ x: dx, y: dy });
    const dead = max * 0.35;
    touchState.left = dx < -dead; touchState.right = dx > dead; touchState.up = dy < -dead * 1.2; touchState.down = dy > dead;
  };
  const press = (k: keyof typeof touchState, on: boolean) => { (touchState as any)[k] = on; setBtns(b => ({ ...b, [k]: on })); };
  const B = (k: 'L' | 'M' | 'H' | 'S' | 'G' | 'D', label: string) =>
    <div className={`tbtn ${k}${btns[k] ? ' on' : ''}`} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); press(k, true); }} onPointerUp={() => press(k, false)} onPointerCancel={() => press(k, false)}>{label}</div>;
  return <div className="touch">
    <div className="stick" ref={stick} onPointerDown={onStick} onPointerMove={onStick} onPointerUp={onStick} onPointerCancel={onStick}>
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
    <div className="tbtns">{B('S', 'SP')}{B('G', 'GR')}{B('D', 'DA')}{B('L', 'L')}{B('M', 'M')}{B('H', 'H')}</div>
  </div>;
}

export function FightScreen({ spec, onTestExit }: { spec: MatchSpec; onTestExit: () => void }) {
  const nav = useNav();
  const store = useStore();
  const settings = store.settings;
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game | null>(null);
  const [paused, setPaused] = useState(false);
  const [moves, setMoves] = useState(false);
  const [hitboxes, setHitboxes] = useState(spec.mode === 'test');
  const isTraining = spec.mode === 'training' || spec.mode === 'test';
  const [train, setTrain] = useState<TrainingOptions>({ dummy: 'stand', infiniteHealth: true, infiniteMeter: true });
  const [speed, setSpeed] = useState(1);
  const touchOn = settings.touchControls === 'on' || (settings.touchControls === 'auto' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));

  useEffect(() => {
    const c = canvas.current!;
    const cfg: SimConfig = {
      chars: [spec.p1, spec.p2], stage: spec.stage,
      roundsToWin: isTraining ? 99 : settings.rounds, roundTime: isTraining ? 0 : settings.roundTime,
      training: isTraining ? { ...train } : null, damageScaling: settings.damageScaling, cinematics: settings.cinematics,
      seed: Math.floor(Math.random() * 1e9), hitstopScale: settings.hitstop,
    };
    const ctrl = (human: boolean, player: 1 | 2): ControllerSpec => human ? { kind: 'human', player, gamepad: spec.p2Human ? player - 1 : 'any', touch: player === 1 } : { kind: 'ai', level: spec.aiLevel };
    const controllers: [ControllerSpec, ControllerSpec] = [
      ctrl(spec.p1Human, 1),
      isTraining ? { kind: 'dummy', mode: train.dummy, level: spec.aiLevel } : ctrl(spec.p2Human, 2),
    ];
    const g = new Game(c, {
      config: cfg, controllers, settings, training: isTraining, showHitboxes: hitboxes,
      onPauseToggle: p => setPaused(p),
      onEvent: (e, sim) => {
        if (e.type === 'matchOver') {
          setTimeout(() => {
            const [a, b] = sim.f;
            const result: MatchResult = {
              spec, winner: e.winner, wins: [a.wins, b.wins], maxCombo: [a.maxCombo, b.maxCombo], damage: [a.totalDamage, b.totalDamage],
              hpLeft: [Math.max(0, a.hp), Math.max(0, b.hp)], seconds: Math.round(sim.tick / 60),
              perfect: e.winner >= 0 && sim.f[e.winner].hp >= sim.f[e.winner].def.stats.maxHealth,
            };
            nav.go({ s: 'victory', result });
          }, 300);
        }
      },
    });
    game.current = g;
    g.start();
    return () => g.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (game.current) game.current.showHitboxes = hitboxes; }, [hitboxes]);
  useEffect(() => { if (game.current) game.current.speed = speed; }, [speed]);
  useEffect(() => {
    const g = game.current; if (!g || !g.sim.cfg.training) return;
    Object.assign(g.sim.cfg.training, train);
    g.setDummyMode(train.dummy);
  }, [train]);

  const resume = () => game.current?.setPaused(false);
  const restart = () => nav.go({ s: 'fight', spec });
  const resetPositions = () => {
    const s = game.current?.sim; if (!s) return;
    s.resetRound(false); s.setPhase('fight');
    for (const f of s.f) { f.meter = train.infiniteMeter ? 300 : f.meter; s.setState(f, 'idle'); }
  };
  const playVictory = () => {
    const s = game.current?.sim; if (!s) return;
    s.setState(s.f[0], 'victory');
    const lines = s.f[0].def.dialogue.victory.filter(Boolean);
    if (lines.length) s.bubbles.push({ owner: 0, text: lines[Math.floor(Math.random() * lines.length)], until: s.tick + 150 });
  };

  return <div className="fight-screen">
    <canvas ref={canvas} className="game" width={VIEW_W} height={VIEW_H} />
    <div className="fight-top">
      <button className="tiny" onClick={() => game.current?.setPaused(!paused)}>{paused ? '▶' : 'II'}</button>
      {spec.mode === 'test' && <button className="tiny gold" onClick={onTestExit}>◀ EDITOR</button>}
    </div>
    {isTraining && !paused && <div className="training-bar">
      <span className="pix" style={{ fontSize: 8, color: 'var(--yellow)' }}>{spec.mode === 'test' ? 'TEST' : 'TRAINING'}</span>
      <select value={train.dummy} onChange={e => setTrain(t => ({ ...t, dummy: e.target.value as TrainingOptions['dummy'] }))} title="What the dummy does">
        <option value="stand">Dummy: Stand</option><option value="crouch">Dummy: Crouch</option><option value="jump">Dummy: Jump</option>
        <option value="block">Dummy: Block all</option><option value="cpu">Dummy: CPU</option>
      </select>
      <label className="small"><input type="checkbox" checked={train.infiniteHealth} onChange={e => setTrain(t => ({ ...t, infiniteHealth: e.target.checked }))} />∞ HP</label>
      <label className="small"><input type="checkbox" checked={train.infiniteMeter} onChange={e => setTrain(t => ({ ...t, infiniteMeter: e.target.checked }))} />∞ Meter</label>
      <label className="small"><input type="checkbox" checked={hitboxes} onChange={e => setHitboxes(e.target.checked)} />Hitboxes</label>
      <select value={speed} onChange={e => setSpeed(+e.target.value)} title="Game speed"><option value={1}>Speed 100%</option><option value={0.5}>Speed 50%</option><option value={0.25}>Speed 25%</option></select>
      <button className="tiny" onClick={resetPositions}>RESET</button>
      <button className="tiny" onClick={playVictory}>VICTORY POSE</button>
      <button className="tiny" onClick={() => { game.current?.setPaused(true); setMoves(true); }}>MOVES</button>
    </div>}
    {touchOn && !paused && spec.p1Human && <TouchControls />}
    {paused && !moves && <div className="overlay">
      <div className="panel col" style={{ minWidth: 280 }}>
        <h2 style={{ textAlign: 'center' }}>PAUSED</h2>
        <button className="go" onClick={resume}>RESUME</button>
        <button onClick={() => setMoves(true)}>MOVE LIST</button>
        <button onClick={() => setHitboxes(h => !h)}>HITBOXES: {hitboxes ? 'ON' : 'OFF'}</button>
        <button onClick={restart}>RESTART</button>
        {spec.mode === 'test' && <button className="gold" onClick={onTestExit}>BACK TO EDITOR</button>}
        {spec.mode !== 'test' && <button onClick={() => nav.go({ s: 'select', mode: spec.mode })}>CHARACTER SELECT</button>}
        <button className="danger" onClick={() => nav.go({ s: 'title' })}>MAIN MENU</button>
      </div>
    </div>}
    {moves && <Modal title="Move list" onClose={() => { setMoves(false); }} wide>
      <h3>{spec.p1.name}</h3><MoveList def={spec.p1} />
      {spec.p2Human && <><h3>{spec.p2.name}</h3><MoveList def={spec.p2} /></>}
      <p className="dim small">Directions are relative to the way you face. Specials can be done with the Special button + direction, or with motion inputs.</p>
    </Modal>}
  </div>;
}
