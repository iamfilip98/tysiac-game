'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody } from '@/components/ui/Modal';
import { TutorialSlideshow } from './TutorialSlideshow';
import { cn } from '@/lib/utils';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMyTurn?: boolean;
}

type Tab = 'guide' | 'rules';

export function RulesModal({ isOpen, onClose, isMyTurn }: RulesModalProps) {
  const [tab, setTab] = useState<Tab>('guide');

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="Game Rules" className="max-w-lg">
      <ModalHeader onClose={onClose}>
        Tysiąc - Game Rules
      </ModalHeader>

      {isMyTurn && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-gold-500/20 border border-gold-500/30 text-center">
          <span className="text-gold-400 text-sm font-medium">It&apos;s your turn to play!</span>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-white/5 rounded-lg p-1">
        <button
          onClick={() => setTab('guide')}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'guide'
              ? 'bg-gold-500/20 text-gold-400'
              : 'text-white/50 hover:text-white/70'
          )}
        >
          Visual Guide
        </button>
        <button
          onClick={() => setTab('rules')}
          className={cn(
            'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            tab === 'rules'
              ? 'bg-gold-500/20 text-gold-400'
              : 'text-white/50 hover:text-white/70'
          )}
        >
          Rules
        </button>
      </div>

      {tab === 'guide' ? <TutorialSlideshow /> : <RulesContent />}
    </Modal>
  );
}

export function RulesContent() {
  return (
    <ModalBody className="space-y-4 text-sm">
      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Overview</h4>
        <p className="text-white/70">
          Tysiąc (meaning &ldquo;Thousand&rdquo; in Polish) is a classic trick-taking card game for 3 or 4 players.
          The goal is to be the first player to reach 1000 points.
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">The Deck</h4>
        <p className="text-white/70">
          24 cards are used: 9, 10, Jack, Queen, King, and Ace in each of the four suits
          (Hearts, Diamonds, Clubs, Spades).
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Card Values (in tricks)</h4>
        <ul className="text-white/70 space-y-1">
          <li>• Ace: 11 points</li>
          <li>• Ten: 10 points</li>
          <li>• King: 4 points</li>
          <li>• Queen: 3 points</li>
          <li>• Jack: 2 points</li>
          <li>• Nine: 0 points</li>
        </ul>
        <p className="text-white/50 text-xs mt-1">Total: 120 points per round. Every hand must have at least 18 points or a marriage, otherwise the deck is re-dealt.</p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Dealing & Bidding</h4>
        <p className="text-white/70 mb-2">
          Each player receives 7 cards, and 3 cards go to the talon (hidden pile).
          Players bid for the right to pick up the talon. Minimum bid is 100, and bids
          increase by 10. Maximum bid is 120 plus the value of any marriages in your hand.
          For example, if you hold a Hearts marriage (K+Q), your max bid is 220.
        </p>
        <p className="text-white/70">
          The highest bidder picks up the 3 talon cards, then gives 1 card to each opponent
          (keeping 8 cards to play with).
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Play or Pass</h4>
        <p className="text-white/70">
          After winning the bid, you can choose to <span className="text-white">play</span> or <span className="text-white">pass</span>.
          At a bid of 100, passing has no penalty. At a higher bid, passing costs you the bid amount
          and the 120 trick points are split among the other players.
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Marriages (Meldunek)</h4>
        <p className="text-white/70 mb-2">
          A marriage is a King and Queen of the same suit. Declaring a marriage sets that suit as trump
          and awards bonus points:
        </p>
        <ul className="text-white/70 space-y-1">
          <li>• Hearts: 100 points</li>
          <li>• Diamonds: 80 points</li>
          <li>• Clubs: 60 points</li>
          <li>• Spades: 40 points</li>
        </ul>
        <p className="text-white/50 text-xs mt-1">You can only declare a marriage when leading a trick. Marriage points only count if you win at least one trick.</p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Playing Tricks</h4>
        <ul className="text-white/70 space-y-1">
          <li>• You must follow suit if possible</li>
          <li>• If the leading card is still winning, you must beat it if you can</li>
          <li>• If you can&apos;t follow suit, you may play any card</li>
          <li>• The highest card of the led suit wins (unless trumped)</li>
        </ul>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Scoring</h4>
        <p className="text-white/70">
          The bid winner must score at least their bid amount (tricks + marriages).
          If successful, they score what they earned (rounded to the nearest 10). If not, they lose
          their bid amount. Other players score what they won, also rounded to 10.
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">The Barrel</h4>
        <p className="text-white/70 mb-2">
          When you reach 800+ points, you&apos;re &ldquo;on the barrel.&rdquo; You must reach exactly
          1000 to win. If you bid and fail to make it, you lose the bid amount and may fall below 800.
        </p>
        <ul className="text-white/70 space-y-1">
          <li>• Non-bidders on the barrel score 0 for that round</li>
        </ul>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Special Rules</h4>
        <ul className="text-white/70 space-y-1">
          <li>• <span className="text-gold-400">Wykładana:</span> If the bidder&apos;s cards guarantee winning all remaining tricks, the round ends instantly</li>
        </ul>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">4-Player Mode</h4>
        <p className="text-white/70">
          In a 4-player game, the dealer sits out each round and spectates. The dealer scores
          any marriages found in the talon, plus 50 points per ace in the talon.
        </p>
      </section>

      <section>
        <h4 className="text-gold-400 font-semibold mb-2">Winning</h4>
        <p className="text-white/70">
          The first player to reach 1000 points wins the game!
        </p>
      </section>
    </ModalBody>
  );
}
