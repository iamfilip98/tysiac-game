'use client';

import { motion } from 'framer-motion';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { RoundResult } from '@tysiac/shared';

interface RoundResultModalProps {
  result: RoundResult;
  players: { id: string; name: string }[];
  onClose: () => void;
}

export function RoundResultModal({
  result,
  players,
  onClose,
}: RoundResultModalProps) {
  const bidderName =
    players.find((p) => p.id === result.bidWinner)?.name || 'Unknown';

  return (
    <Modal isOpen={true} onClose={onClose} className="max-w-lg">
      <ModalHeader onClose={onClose}>
        Round {result.roundNumber} Complete
      </ModalHeader>

      <ModalBody>
        {/* Bid result */}
        <div
          className={cn(
            'p-4 rounded-lg mb-4',
            result.bidderMadeBid
              ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-red-500/20 border border-red-500/30'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Bid Winner</div>
              <div className="text-lg font-bold text-white">{bidderName}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white/60">Bid</div>
              <div className="text-lg font-bold text-gold-400">
                {result.bid}
              </div>
            </div>
          </div>
          <div className="mt-2 text-center">
            {result.bidderMadeBid ? (
              <span className="text-green-400 font-medium">✓ Made the bid!</span>
            ) : (
              <span className="text-red-400 font-medium">✗ Failed to make bid</span>
            )}
          </div>
        </div>

        {/* Player results */}
        <div className="space-y-2">
          {result.playerResults.map((pr) => {
            const player = players.find((p) => p.id === pr.playerId);
            const isBidder = pr.playerId === result.bidWinner;

            return (
              <motion.div
                key={pr.playerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'p-3 rounded-lg',
                  isBidder ? 'bg-gold-500/10' : 'bg-table-800/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white">
                    {player?.name || 'Unknown'}
                    {isBidder && (
                      <span className="ml-2 text-xs text-gold-400">(Bidder)</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'font-bold',
                      pr.scoreChange >= 0 ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {pr.scoreChange >= 0 ? '+' : ''}
                    {pr.scoreChange}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm text-white/60">
                  <div className="flex gap-3">
                    <span>Tricks: {pr.trickPoints}</span>
                    {pr.marriagePoints > 0 && (
                      <span>Marriages: +{pr.marriagePoints}</span>
                    )}
                  </div>
                  <span>Total: {pr.newTotalScore}</span>
                </div>

                {/* Barrel warnings */}
                {pr.wasOnBarrel && (
                  <div className="mt-1 text-xs text-amber-400">
                    {pr.fellOffBarrel
                      ? '🛢️ Fell off the barrel! Score reset to 800'
                      : '🛢️ Still on the barrel'}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </ModalBody>

      <ModalFooter className="justify-center">
        <Button variant="primary" onClick={onClose} glow>
          Continue to Next Round
        </Button>
      </ModalFooter>
    </Modal>
  );
}

// Game end modal
interface GameEndModalProps {
  winnerId: string;
  players: { id: string; name: string }[];
  scores: Record<string, number>;
  currentPlayerId: string;
  onPlayAgain: () => void;
  onLeave: () => void;
}

export function GameEndModal({
  winnerId,
  players,
  scores,
  currentPlayerId,
  onPlayAgain,
  onLeave,
}: GameEndModalProps) {
  const winner = players.find((p) => p.id === winnerId);
  const isWinner = winnerId === currentPlayerId;

  const sortedPlayers = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );

  return (
    <Modal isOpen={true} className="max-w-md">
      <div className="text-center">
        {/* Victory/defeat header */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 10 }}
          className="mb-6"
        >
          {isWinner ? (
            <>
              <div className="text-6xl mb-2">🏆</div>
              <h2 className="text-3xl font-bold text-gold-400">You Win!</h2>
            </>
          ) : (
            <>
              <div className="text-6xl mb-2">🎯</div>
              <h2 className="text-2xl font-bold text-white">
                {winner?.name} Wins!
              </h2>
            </>
          )}
        </motion.div>

        {/* Final standings */}
        <div className="space-y-2 mb-6">
          {sortedPlayers.map((player, index) => {
            const score = scores[player.id] || 0;
            const isMe = player.id === currentPlayerId;

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg',
                  index === 0
                    ? 'bg-gold-500/20 border border-gold-500/30'
                    : 'bg-table-800/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </span>
                  <span
                    className={cn(
                      'font-medium',
                      isMe ? 'text-gold-400' : 'text-white'
                    )}
                  >
                    {player.name}
                    {isMe && ' (You)'}
                  </span>
                </div>
                <span
                  className={cn(
                    'font-bold text-lg',
                    index === 0 ? 'text-gold-400' : 'text-white'
                  )}
                >
                  {score}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onLeave} className="flex-1">
            Leave Room
          </Button>
          <Button variant="primary" onClick={onPlayAgain} className="flex-1" glow>
            Play Again
          </Button>
        </div>
      </div>
    </Modal>
  );
}
