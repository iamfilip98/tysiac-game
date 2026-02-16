import { WykladanaModal } from './WykladanaModal';
import { RoundResultModal } from './RoundResultModal';
import { GameEndModal } from './GameEndModal';
import { LeaveGameModal } from './LeaveGameModal';
import { PassedAt100Announcement } from './PassedAt100Announcement';
import { ThrewAnnouncement } from './ThrewAnnouncement';
import { PauseOverlay } from './PauseOverlay';
import type { RoundResult, GameStatistics, Card as CardType } from '@tysiac/shared';

interface GameOverlaysProps {
  // Wykladana
  showWykladana: boolean;
  wykladanaData: { playerName: string; bid: number; marriagePoints?: number; cards: CardType[] } | null;
  onConfirmWykladana: () => void;
  // Round result
  showRoundResult: boolean;
  lastRoundResult: RoundResult | null;
  players: { id: string; name: string }[];
  onCloseRoundResult: () => void;
  // Game end
  showGameEnd: boolean;
  winner: string | null;
  scores: Record<string, number>;
  currentPlayerId: string;
  gameStatistics: GameStatistics | null;
  onPlayAgain: () => void;
  onLeaveRoom: () => void;
  // Leave modal
  showLeaveModal: boolean;
  onConfirmLeave: () => void;
  onCancelLeave: () => void;
  // Announcements
  passedAt100Notification: { playerName: string } | null;
  onClearPassedAt100: () => void;
  threwNotification: { playerName: string; bidAmount: number; scoreChanges: Record<string, number> } | null;
  onClearThrew: () => void;
  // Pause
  pauseData: { pausedByName: string; pausedAt: number; expiresAt: number } | null;
  onResume: () => void;
}

export function GameOverlays({
  showWykladana,
  wykladanaData,
  onConfirmWykladana,
  showRoundResult,
  lastRoundResult,
  players,
  onCloseRoundResult,
  showGameEnd,
  winner,
  scores,
  currentPlayerId,
  gameStatistics,
  onPlayAgain,
  onLeaveRoom,
  showLeaveModal,
  onConfirmLeave,
  onCancelLeave,
  passedAt100Notification,
  onClearPassedAt100,
  threwNotification,
  onClearThrew,
  pauseData,
  onResume,
}: GameOverlaysProps) {
  return (
    <>
      {/* WYKLADANA celebration */}
      {showWykladana && wykladanaData && (
        <WykladanaModal
          playerName={wykladanaData.playerName}
          bid={wykladanaData.bid}
          marriagePoints={wykladanaData.marriagePoints}
          cards={wykladanaData.cards}
          onComplete={onConfirmWykladana}
        />
      )}

      {/* Round result modal */}
      {showRoundResult && lastRoundResult && (
        <RoundResultModal
          result={lastRoundResult}
          players={players}
          onClose={onCloseRoundResult}
        />
      )}

      {/* Game end modal */}
      {showGameEnd && winner && (
        <GameEndModal
          winnerId={winner}
          players={players}
          scores={scores}
          currentPlayerId={currentPlayerId}
          statistics={gameStatistics}
          onPlayAgain={onPlayAgain}
          onLeave={onLeaveRoom}
        />
      )}

      {/* Leave game confirmation modal */}
      {showLeaveModal && (
        <LeaveGameModal
          onConfirm={onConfirmLeave}
          onCancel={onCancelLeave}
        />
      )}

      {/* Passed at 100 announcement */}
      <PassedAt100Announcement
        playerName={passedAt100Notification?.playerName || null}
        onComplete={onClearPassedAt100}
      />

      {/* Threw announcement (for bids > 100) */}
      <ThrewAnnouncement
        data={threwNotification}
        players={players}
        onComplete={onClearThrew}
      />

      {/* Pause overlay */}
      {pauseData && (
        <PauseOverlay
          pausedByName={pauseData.pausedByName}
          pausedAt={pauseData.pausedAt}
          onResume={onResume}
        />
      )}
    </>
  );
}
