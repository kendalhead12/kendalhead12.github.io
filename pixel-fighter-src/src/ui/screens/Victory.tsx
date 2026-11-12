import React, { useEffect, useMemo } from 'react';
import { MatchResult, MatchSpec, useNav } from '../App';
import { useStore } from '../store';
import { AnimPreview, Portrait } from '../widgets';
import { audio } from '../../engine/audio';
import type { CharacterDef } from '../../engine/types';

/** Opponent-specific line if one exists, otherwise a random general line. */
export function pickVictoryLine(winner: CharacterDef, loser: CharacterDef): string {
  const specific = winner.dialogue.vsVictory.find(v => v.opponent.trim().toLowerCase() === loser.name.trim().toLowerCase());
  const pool = specific?.lines.filter(l => l.trim()) || [];
  const general = winner.dialogue.victory.filter(l => l.trim());
  const list = pool.length ? pool : general;
  return list.length ? list[Math.floor(Math.random() * list.length)] : 'Victory!';
}

export function VictoryScreen({ result }: { result: MatchResult }) {
  const nav = useNav();
  const store = useStore();
  const { spec } = result;
  const w = result.winner;
  const winner = w === 1 ? spec.p2 : spec.p1, loser = w === 1 ? spec.p1 : spec.p2;
  const line = useMemo(() => w < 0 ? 'Nobody wins this time…' : pickVictoryLine(winner, loser), [result]);
  const arcade = spec.arcade;
  const playerWon = w === 0;
  const champion = arcade && playerWon && arcade.index >= arcade.ladder.length - 1;

  useEffect(() => {
    if (w < 0) return;
    audio.play('victory', winner);
    const t = setTimeout(() => audio.voiceLine(winner, 'victory', line), 400);
    return () => clearTimeout(t);
  }, [result]);

  const next = (s: MatchSpec) => nav.go({ s: 'vs', spec: s });
  const rematch = () => next({ ...spec });
  const nextArcade = () => {
    if (!arcade) return;
    const i = arcade.index + 1;
    const p2 = store.characters.find(c => c.id === arcade.ladder[i]) || spec.p2;
    const stage = store.stages.find(s => s.id === arcade.stageIds[i]) || spec.stage;
    next({ ...spec, p2, stage, arcade: { ...arcade, index: i }, aiLevel: Math.min(8, spec.aiLevel + (i % 2)) });
  };
  const cont = () => arcade && next({ ...spec, arcade: { ...arcade, continues: arcade.continues - 1 } });

  return <div className="victory">
    <div className="col center">
      {w >= 0 ? <>
        <Portrait def={winner} size={360} className="big-portrait" />
        <div style={{ marginTop: -40 }}><AnimPreview def={winner} anim="victory" width={220} height={220} bg="transparent" /></div>
      </> : <div className="pix" style={{ fontSize: 40 }}>DRAW</div>}
    </div>
    <div className="col">
      {champion && <div className="pix" style={{ fontSize: 20, color: 'var(--cyan)', textShadow: '3px 3px 0 #000' }}>★ ARCADE CHAMPION ★</div>}
      <div className="who">{w >= 0 ? `${winner.name} WINS!` : 'DRAW GAME'}</div>
      <div className="line">“{line}”</div>
      <div className="panel inner">
        <h3 style={{ marginTop: 0 }}>MATCH RESULTS</h3>
        <table className="movelist"><tbody>
          <tr><td>Rounds</td><td>{spec.p1.name} {result.wins[0]} – {result.wins[1]} {spec.p2.name}</td></tr>
          <tr><td>Time</td><td>{result.seconds}s</td></tr>
          <tr><td>Max combo</td><td>{result.maxCombo[0]} / {result.maxCombo[1]}</td></tr>
          <tr><td>Damage dealt</td><td>{result.damage[0]} / {result.damage[1]}</td></tr>
          {result.perfect && <tr><td>Bonus</td><td className="ok">PERFECT!</td></tr>}
          {arcade && <tr><td>Arcade</td><td>Stage {arcade.index + 1} of {arcade.ladder.length} · continues {arcade.continues}</td></tr>}
        </tbody></table>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        {arcade ? (playerWon ? (champion ? <button className="gold big" onClick={() => nav.go({ s: 'select', mode: 'arcade' })}>NEW RUN</button>
          : <button className="primary big" onClick={nextArcade}>NEXT OPPONENT ▶</button>)
          : arcade.continues > 0 ? <button className="primary big" onClick={cont}>CONTINUE ({arcade.continues})</button> : <span className="pix err" style={{ fontSize: 12 }}>GAME OVER</span>)
          : <button className="primary big" onClick={rematch}>REMATCH</button>}
        <button className="big" onClick={() => nav.go({ s: 'select', mode: spec.mode })}>CHARACTER SELECT</button>
        <button onClick={() => nav.go({ s: 'title' })}>MAIN MENU</button>
      </div>
    </div>
  </div>;
}
