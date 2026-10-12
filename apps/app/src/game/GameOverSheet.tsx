import type { PlayerView } from '@tysiac/engine';
import { Sheet } from '../ui/Sheet';
import { gameStats } from './stats';

export interface GameOverSheetProps {
  view: PlayerView;
  isHost: boolean;
  onRematch(): void;
  onHome(): void;
}

export function GameOverSheet({ view, isHost, onRematch, onHome }: GameOverSheetProps) {
  const stats = gameStats(view);
  const winner = view.seats.find(s => s.id === view.winner);
  const headline = view.winner === view.me ? 'You win!' : `${winner?.name ?? 'Someone'} wins!`;
  return (
    <Sheet
      title="Game over"
      footer={
        <>
          <button type="button" className="btn btn--sec" onClick={onHome}>
            Home
          </button>
          {isHost && (
            <button type="button" className="btn btn--pri" onClick={onRematch}>
              Rematch
            </button>
          )}
        </>
      }
    >
      <p className="result__headline display">🏆 {headline}</p>
      <table className="stats">
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Made</th>
            <th>Failed</th>
            <th>Marr.</th>
            <th>Best</th>
          </tr>
        </thead>
        <tbody>
          {stats.map(s => (
            <tr key={s.id}>
              <td>
                {s.avatar} {s.name}
              </td>
              <td>{s.total}</td>
              <td>{s.bidsMade}</td>
              <td>{s.bidsFailed}</td>
              <td>{s.marriagePoints}</td>
              <td>{s.bestRound}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!isHost && <p className="coachnote">Waiting for the host to start a rematch…</p>}
    </Sheet>
  );
}
