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
  const winnerName = result.gameWinner
    ? players.find((p) => p.id === result.gameWinner)?.name || 'Unknown'
    : null;

  return (
    <Modal isOpen={true} onClose={onClose} className="max-w-lg">
      <ModalHeader onClose={onClose}>
        {result.gameWinner ? 'Final Round' : `Round ${result.roundNumber} Complete`}
      </ModalHeader>

      <ModalBody>
        {/* Game winner banner */}
        {winnerName && (
          <div className="p-4 rounded-lg mb-4 bg-gradient-to-r from-gold-500/20 via-gold-500/30 to-gold-500/20 border border-gold-500/40 text-center">
            <div className="text-gold-400 text-xs font-medium uppercase tracking-wider mb-1">Game Over</div>
            <div className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gold-300 via-gold-400 to-amber-500">
              {winnerName} wins the game!
            </div>
          </div>
        )}

        {/* Bid result */}
        <div
          className={cn(
            'p-4 rounded-lg mb-4',
            result.bidderMadeBid
              ? 'bg-gold-500/20 border border-gold-500/30'
              : 'bg-card-red/20 border border-card-red/30'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white/60">Bid Winner</div>
              <div className="text-lg font-bold text-white truncate max-w-[8rem] sm:max-w-[12rem]" title={bidderName}>{bidderName}</div>
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
              <span className="text-gold-400 font-medium">Made the bid!</span>
            ) : (
              <span className="text-card-red font-medium">Failed to make bid</span>
            )}
          </div>
        </div>

        {/* Player results */}
        <div className="space-y-2">
          {result.playerResults.map((pr) => {
            const player = players.find((p) => p.id === pr.playerId);
            const isBidder = pr.playerId === result.bidWinner;
            const isGameWinner = pr.playerId === result.gameWinner;

            return (
              <motion.div
                key={pr.playerId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'p-3 rounded-lg',
                  isGameWinner ? 'bg-gold-500/15 border border-gold-500/25' : isBidder ? 'bg-gold-500/10' : 'bg-table-800/50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-white truncate max-w-[8rem] sm:max-w-[12rem]" title={player?.name}>
                    {player?.name || 'Unknown'}
                    {isBidder && (
                      <span className="ml-2 text-xs text-gold-400">(Bidder)</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      'font-bold',
                      pr.scoreChange >= 0 ? 'text-gold-400' : 'text-card-red'
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

                {/* Barrel warnings — hide "still on barrel" when game is over */}
                {pr.wasOnBarrel && (pr.fellOffBarrel || !result.gameWinner) && (
                  <div className="mt-1 text-xs text-amber-400 flex items-center gap-1">
                    <svg className="w-3 h-3 inline-block shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 3 Q3 8 4 13 L12 13 Q13 8 12 3 Z" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.7" />
                      <path d="M3.8 4.5 Q8 4 12.2 4.5" fill="none" stroke="#d4af37" strokeWidth="0.8" />
                      <path d="M3.5 8 Q8 7.3 12.5 8" fill="none" stroke="#d4af37" strokeWidth="0.8" />
                      <path d="M3.8 11.5 Q8 12 12.2 11.5" fill="none" stroke="#d4af37" strokeWidth="0.8" />
                      <ellipse cx="8" cy="3" rx="4" ry="1.3" fill="#1a1a1a" stroke="#d4af37" strokeWidth="0.7" />
                      <ellipse cx="7.5" cy="2.8" rx="2" ry="0.5" fill="rgba(255,255,255,0.08)" />
                      <line x1="6" y1="4.5" x2="5.8" y2="11.5" stroke="rgba(212,175,55,0.2)" strokeWidth="0.4" />
                      <line x1="10" y1="4.5" x2="10.2" y2="11.5" stroke="rgba(212,175,55,0.2)" strokeWidth="0.4" />
                    </svg>
                    {pr.fellOffBarrel
                      ? 'Fell off the barrel!'
                      : 'Still on the barrel'}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </ModalBody>

      <ModalFooter className="justify-center">
        <Button variant="primary" onClick={onClose} glow>
          {result.gameWinner ? 'View Final Standings' : 'Continue to Next Round'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
