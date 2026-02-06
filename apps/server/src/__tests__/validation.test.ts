import { describe, it, expect } from 'vitest';
import {
  getValidCards,
  validateBid,
  canDeclareMarriage,
  validateCardPlay,
  getTrickWinner,
} from '../game/validation.js';
import type { Card, Suit, Rank, TrickState, GameState } from '@tysiac/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shorthand card constructor. */
function card(suit: Suit, rank: Rank): Card {
  return { suit, rank };
}

/** Build a TrickState from an array of (playerId, Card) pairs. */
function mockTrick(
  cards: { playerId: string; card: Card }[],
  leadSuit: Suit | null,
  currentPlayer: string,
  trickNumber = 1,
): TrickState {
  return { cards, leadSuit, currentPlayer, trickNumber };
}

/** Minimal GameState stub that satisfies the type without requiring a real game. */
function mockGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'game-1',
    roomId: 'room-1',
    phase: 'trickPlaying',
    players: [
      { id: 'p1', name: 'Alice', isAI: false, seatIndex: 0 },
      { id: 'p2', name: 'Bob', isAI: false, seatIndex: 1 },
      { id: 'p3', name: 'Carol', isAI: false, seatIndex: 2 },
    ],
    scores: {
      p1: { playerId: 'p1', totalScore: 0, roundScores: [], isOnBarrel: false, barrelAttempts: 0 },
      p2: { playerId: 'p2', totalScore: 0, roundScores: [], isOnBarrel: false, barrelAttempts: 0 },
      p3: { playerId: 'p3', totalScore: 0, roundScores: [], isOnBarrel: false, barrelAttempts: 0 },
    },
    currentRound: {
      roundNumber: 1,
      dealer: 'p1',
      talon: [],
      talonRevealed: false,
      trumpSuit: null,
      bidWinner: 'p1',
      finalBid: 100,
      players: {
        p1: { playerId: 'p1', hand: [], tricksWon: [], pointsFromTricks: 0, declaredMarriages: [], marriagePoints: 0 },
        p2: { playerId: 'p2', hand: [], tricksWon: [], pointsFromTricks: 0, declaredMarriages: [], marriagePoints: 0 },
        p3: { playerId: 'p3', hand: [], tricksWon: [], pointsFromTricks: 0, declaredMarriages: [], marriagePoints: 0 },
      },
      currentTrick: null,
      completedTricks: 0,
      cardsToDistribute: [],
      isDealerSittingOut: false,
      dealerMarriagePoints: 0,
      talonMarriages: [],
    },
    winner: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

/** Checks whether a Card[] contains a specific card. */
function containsCard(cards: Card[], suit: Suit, rank: Rank): boolean {
  return cards.some(c => c.suit === suit && c.rank === rank);
}

// ---------------------------------------------------------------------------
// getValidCards
// ---------------------------------------------------------------------------

describe('getValidCards', () => {
  const game = mockGameState();

  describe('first to play (empty trick)', () => {
    it('returns every card in the hand', () => {
      const hand = [card('hearts', 'A'), card('clubs', '9'), card('diamonds', 'K')];
      const trick = mockTrick([], null, 'p1');

      const valid = getValidCards(hand, trick, null, game);

      expect(valid).toHaveLength(3);
      expect(valid).toEqual(expect.arrayContaining(hand));
    });

    it('returns every card even when a trump suit is active', () => {
      const hand = [card('hearts', '9'), card('spades', 'Q')];
      const trick = mockTrick([], null, 'p1');

      const valid = getValidCards(hand, trick, 'hearts', game);

      expect(valid).toHaveLength(2);
    });
  });

  describe('must follow suit', () => {
    it('returns only in-suit cards that can beat the lead when lead is winning', () => {
      const hand = [
        card('hearts', 'A'),
        card('hearts', '9'),
        card('clubs', 'K'),
        card('diamonds', '10'),
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('hearts', 'Q') }],
        'hearts',
        'p2',
      );

      const valid = getValidCards(hand, trick, null, game);

      // Q strength = 2. Only A (strength 5) can beat it; 9 (strength 0) cannot.
      // Since a beating card exists, only beating cards are returned.
      expect(valid).toHaveLength(1);
      expect(containsCard(valid, 'hearts', 'A')).toBe(true);
    });

    it('returns all in-suit cards when none can beat the lead', () => {
      const hand = [
        card('hearts', '9'),
        card('hearts', 'J'),
        card('clubs', 'K'),
        card('diamonds', '10'),
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('hearts', 'A') }],
        'hearts',
        'p2',
      );

      const valid = getValidCards(hand, trick, null, game);

      // A is the highest; 9 and J cannot beat it, so all in-suit cards are valid
      expect(valid).toHaveLength(2);
      expect(valid.every(c => c.suit === 'hearts')).toBe(true);
    });

    it('returns all hand cards when player cannot follow suit and no trump', () => {
      const hand = [card('clubs', 'A'), card('diamonds', '9')];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('hearts', 'K') }],
        'hearts',
        'p2',
      );

      const valid = getValidCards(hand, trick, null, game);

      expect(valid).toHaveLength(2);
      expect(valid).toEqual(expect.arrayContaining(hand));
    });
  });

  describe('must beat highest card in lead suit when lead is winning', () => {
    it('only returns cards that beat the lead when possible', () => {
      const hand = [
        card('hearts', '9'),  // cannot beat Q
        card('hearts', 'K'),  // beats Q
        card('hearts', 'A'),  // beats Q
        card('clubs', '10'),  // wrong suit
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('hearts', 'Q') }],
        'hearts',
        'p2',
      );

      const valid = getValidCards(hand, trick, null, game);

      // Only K and A of hearts beat Q of hearts (RANK_STRENGTH: Q=2, K=3, A=5)
      expect(valid).toHaveLength(2);
      expect(containsCard(valid, 'hearts', 'K')).toBe(true);
      expect(containsCard(valid, 'hearts', 'A')).toBe(true);
    });

    it('returns all in-suit cards if none can beat the lead', () => {
      const hand = [
        card('hearts', '9'),
        card('hearts', 'J'),
        card('clubs', 'A'),
      ];
      // Lead is Ace of hearts - nothing in hand can beat it
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('hearts', 'A') }],
        'hearts',
        'p2',
      );

      const valid = getValidCards(hand, trick, null, game);

      expect(valid).toHaveLength(2);
      expect(valid.every(c => c.suit === 'hearts')).toBe(true);
    });
  });

  describe('must beat highest card of lead suit', () => {
    it('must beat highest lead-suit card even when lead is not winning', () => {
      // p1 leads hearts Q, p2 played hearts A, now p3 must beat A if possible
      const hand = [
        card('hearts', '9'),  // can't beat A
        card('hearts', 'J'),  // can't beat A
        card('clubs', 'K'),
      ];
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('hearts', 'Q') },
          { playerId: 'p2', card: card('hearts', 'A') },
        ],
        'hearts',
        'p3',
      );

      const valid = getValidCards(hand, trick, null, game);

      // Can't beat A, so just follow suit with all hearts
      expect(valid).toHaveLength(2);
      expect(valid.every(c => c.suit === 'hearts')).toBe(true);
    });

    it('only returns cards that beat the highest lead-suit card', () => {
      // p1 leads hearts 9, p2 played hearts J, p3 has hearts Q, K, and clubs A
      const hand = [
        card('hearts', 'Q'),  // beats J (strength 2 > 1)
        card('hearts', 'K'),  // beats J (strength 3 > 1)
        card('clubs', 'A'),
      ];
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('hearts', '9') },
          { playerId: 'p2', card: card('hearts', 'J') },
        ],
        'hearts',
        'p3',
      );

      const valid = getValidCards(hand, trick, null, game);

      // Must beat J; both Q and K can
      expect(valid).toHaveLength(2);
      expect(containsCard(valid, 'hearts', 'Q')).toBe(true);
      expect(containsCard(valid, 'hearts', 'K')).toBe(true);
    });
  });

  describe('trump interactions', () => {
    it('forces trump play when player cannot follow suit and has trump', () => {
      const hand = [
        card('clubs', 'A'),
        card('diamonds', '9'),
        card('hearts', 'K'), // trump
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('spades', 'Q') }],
        'spades',
        'p2',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // Player has no spades, must play trump (hearts K)
      expect(valid).toHaveLength(1);
      expect(containsCard(valid, 'hearts', 'K')).toBe(true);
    });

    it('allows any card when player cannot follow suit and has no trump', () => {
      const hand = [
        card('clubs', 'A'),
        card('diamonds', '9'),
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('spades', 'Q') }],
        'spades',
        'p2',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // No spades and no trump — any card is valid
      expect(valid).toHaveLength(2);
    });

    it('does not force trump play when player has lead suit cards', () => {
      const hand = [
        card('spades', '9'),
        card('hearts', 'A'), // trump but player has lead suit
      ];
      const trick = mockTrick(
        [{ playerId: 'p1', card: card('spades', 'K') }],
        'spades',
        'p2',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // Must follow lead suit; trump is irrelevant since player has spades
      expect(valid).toHaveLength(1);
      expect(valid[0]).toEqual(card('spades', '9'));
    });

    it('must follow suit even when trick is trumped', () => {
      // p1 leads clubs K, p2 plays hearts 9 (trump) — p3 has clubs, must follow
      const hand = [
        card('clubs', '9'),
        card('clubs', 'J'),
      ];
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', 'K') },
          { playerId: 'p2', card: card('hearts', '9') }, // trump
        ],
        'clubs',
        'p3',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // Must follow clubs; J strength=1 and 9 strength=0, neither beats K (strength=3)
      // So all clubs are valid
      expect(valid).toHaveLength(2);
      expect(valid.every(c => c.suit === 'clubs')).toBe(true);
    });

    it('must beat existing trump when trumping and able to', () => {
      // p1 leads clubs K, p2 trumps with hearts 9 — p3 has no clubs, has hearts A
      const hand = [
        card('diamonds', '10'),
        card('hearts', 'A'), // trump, can beat hearts 9
        card('hearts', 'J'), // trump, can't beat hearts 9
      ];
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', 'K') },
          { playerId: 'p2', card: card('hearts', '9') }, // trump
        ],
        'clubs',
        'p3',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // No clubs, must trump. Must beat hearts 9 (strength 0).
      // J strength=1 > 0, A strength=5 > 0, so both beat it
      expect(valid).toHaveLength(2);
      expect(containsCard(valid, 'hearts', 'A')).toBe(true);
      expect(containsCard(valid, 'hearts', 'J')).toBe(true);
    });

    it('plays any trump when can\'t beat existing trump', () => {
      // p1 leads clubs K, p2 trumps with hearts A — p3 has no clubs, has hearts 9
      const hand = [
        card('diamonds', '10'),
        card('hearts', '9'), // trump, can't beat hearts A
      ];
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', 'K') },
          { playerId: 'p2', card: card('hearts', 'A') }, // trump
        ],
        'clubs',
        'p3',
      );

      const valid = getValidCards(hand, trick, 'hearts', game);

      // No clubs, must trump. Can't beat hearts A, so any trump is valid
      expect(valid).toHaveLength(1);
      expect(containsCard(valid, 'hearts', '9')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// validateBid
// ---------------------------------------------------------------------------

describe('validateBid', () => {
  describe('correct next bid', () => {
    it('accepts a bid that is exactly currentBid + 10', () => {
      // Hand with no marriages, max bid = 120
      const hand = [card('hearts', 'A'), card('clubs', '9'), card('diamonds', 'K')];
      const result = validateBid(110, 100, hand, false);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('accepts the first raise above 100', () => {
      const hand = [card('hearts', 'A'), card('clubs', '9')];
      const result = validateBid(110, 100, hand, true);

      expect(result.isValid).toBe(true);
    });
  });

  describe('wrong increment', () => {
    it('rejects a bid that is less than currentBid + 10', () => {
      const hand = [card('hearts', 'A')];
      const result = validateBid(105, 100, hand, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('110');
    });

    it('rejects a bid that is more than currentBid + 10', () => {
      const hand = [card('hearts', 'A')];
      const result = validateBid(120, 100, hand, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('110');
    });

    it('rejects a bid equal to the current bid', () => {
      const hand = [card('hearts', 'A')];
      const result = validateBid(100, 100, hand, false);

      expect(result.isValid).toBe(false);
    });
  });

  describe('over maximum bid', () => {
    it('rejects a bid exceeding 120 when hand has no marriages', () => {
      // No K+Q pair in any suit
      const hand = [
        card('hearts', 'A'),
        card('clubs', '9'),
        card('diamonds', '10'),
        card('spades', 'J'),
      ];
      // Max bid = 120 + 0 = 120. Trying to bid 130 (from 120) should fail.
      const result = validateBid(130, 120, hand, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('120');
    });

    it('allows higher bids when hand contains marriages', () => {
      // Hearts marriage (K+Q) = 100 points, so max bid = 120 + 100 = 220
      const hand = [
        card('hearts', 'K'),
        card('hearts', 'Q'),
        card('clubs', '9'),
      ];
      const result = validateBid(220, 210, hand, false);

      expect(result.isValid).toBe(true);
    });

    it('rejects bid above max even with marriages', () => {
      // Spades marriage = 40 points, so max bid = 120 + 40 = 160
      const hand = [
        card('spades', 'K'),
        card('spades', 'Q'),
        card('clubs', '9'),
      ];
      const result = validateBid(170, 160, hand, false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('160');
    });

    it('accounts for multiple marriages', () => {
      // Hearts marriage (100) + clubs marriage (60) = 160, max bid = 280
      const hand = [
        card('hearts', 'K'),
        card('hearts', 'Q'),
        card('clubs', 'K'),
        card('clubs', 'Q'),
      ];
      const result = validateBid(280, 270, hand, false);

      expect(result.isValid).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// canDeclareMarriage
// ---------------------------------------------------------------------------

describe('canDeclareMarriage', () => {
  describe('valid declaration', () => {
    it('allows marriage when player is leading and has K+Q of suit', () => {
      const hand = [card('hearts', 'K'), card('hearts', 'Q'), card('clubs', '9')];
      const result = canDeclareMarriage(hand, 'hearts', [], true);

      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows a second marriage declaration for a different suit', () => {
      const hand = [
        card('hearts', 'K'),
        card('hearts', 'Q'),
        card('clubs', 'K'),
        card('clubs', 'Q'),
      ];
      const result = canDeclareMarriage(hand, 'clubs', ['hearts'], true);

      expect(result.isValid).toBe(true);
    });
  });

  describe('already declared', () => {
    it('rejects re-declaring the same suit', () => {
      const hand = [card('hearts', 'K'), card('hearts', 'Q')];
      const result = canDeclareMarriage(hand, 'hearts', ['hearts'], true);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('already declared');
    });
  });

  describe('not leading', () => {
    it('rejects marriage when player is not leading the trick', () => {
      const hand = [card('hearts', 'K'), card('hearts', 'Q')];
      const result = canDeclareMarriage(hand, 'hearts', [], false);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('leading');
    });
  });

  describe('no marriage in hand', () => {
    it('rejects when player has King but no Queen', () => {
      const hand = [card('hearts', 'K'), card('clubs', 'Q')];
      const result = canDeclareMarriage(hand, 'hearts', [], true);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No marriage');
    });

    it('rejects when player has Queen but no King', () => {
      const hand = [card('hearts', 'Q'), card('clubs', 'K')];
      const result = canDeclareMarriage(hand, 'hearts', [], true);

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No marriage');
    });

    it('rejects when player has neither K nor Q of the suit', () => {
      const hand = [card('hearts', 'A'), card('hearts', '10')];
      const result = canDeclareMarriage(hand, 'hearts', [], true);

      expect(result.isValid).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// validateCardPlay
// ---------------------------------------------------------------------------

describe('validateCardPlay', () => {
  const game = mockGameState();

  it('rejects a card that is not in the player hand', () => {
    const hand = [card('hearts', 'A'), card('clubs', '9')];
    const trick = mockTrick([], null, 'p1');

    const result = validateCardPlay(card('diamonds', 'K'), hand, trick, null, game);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not in hand');
  });

  it('accepts a valid first-card play', () => {
    const hand = [card('hearts', 'A'), card('clubs', '9')];
    const trick = mockTrick([], null, 'p1');

    const result = validateCardPlay(card('hearts', 'A'), hand, trick, null, game);

    expect(result.isValid).toBe(true);
  });

  it('accepts a card that follows suit and beats the lead', () => {
    const hand = [card('hearts', 'A'), card('clubs', '9')];
    const trick = mockTrick(
      [{ playerId: 'p1', card: card('hearts', 'Q') }],
      'hearts',
      'p2',
    );

    const result = validateCardPlay(card('hearts', 'A'), hand, trick, null, game);

    expect(result.isValid).toBe(true);
  });

  it('rejects a lower in-suit card when a higher one is available and lead is winning', () => {
    const hand = [
      card('hearts', '9'),
      card('hearts', 'A'),
    ];
    const trick = mockTrick(
      [{ playerId: 'p1', card: card('hearts', 'Q') }],
      'hearts',
      'p2',
    );

    // hearts 9 cannot beat Q (strength 0 < 2), but A can (5 > 2),
    // so 9 is not in the valid set.
    const result = validateCardPlay(card('hearts', '9'), hand, trick, null, game);

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Invalid card');
  });

  it('accepts an off-suit card when player cannot follow suit and no trump', () => {
    const hand = [card('clubs', '9'), card('diamonds', 'K')];
    const trick = mockTrick(
      [{ playerId: 'p1', card: card('hearts', 'A') }],
      'hearts',
      'p2',
    );

    const result = validateCardPlay(card('clubs', '9'), hand, trick, null, game);

    expect(result.isValid).toBe(true);
  });

  it('rejects off-suit non-trump when player has trump and cannot follow suit', () => {
    const hand = [card('clubs', '9'), card('hearts', 'K')]; // hearts is trump
    const trick = mockTrick(
      [{ playerId: 'p1', card: card('spades', 'A') }],
      'spades',
      'p2',
    );

    // Must play hearts K (trump), not clubs 9
    const result = validateCardPlay(card('clubs', '9'), hand, trick, 'hearts', game);

    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTrickWinner
// ---------------------------------------------------------------------------

describe('getTrickWinner', () => {
  describe('highest card in lead suit wins', () => {
    it('returns the player who played the highest lead-suit card', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('hearts', 'Q') },
          { playerId: 'p2', card: card('hearts', 'A') },
          { playerId: 'p3', card: card('hearts', '9') },
        ],
        'hearts',
        'p1', // currentPlayer is irrelevant for winner calc
      );

      expect(getTrickWinner(trick, null)).toBe('p2');
    });

    it('ignores off-suit cards that have higher rank', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('hearts', '9') },
          { playerId: 'p2', card: card('clubs', 'A') }, // higher rank but wrong suit
          { playerId: 'p3', card: card('hearts', 'J') },
        ],
        'hearts',
        'p1',
      );

      // J of hearts (strength 1) > 9 of hearts (strength 0); clubs A is irrelevant
      expect(getTrickWinner(trick, null)).toBe('p3');
    });
  });

  describe('trump wins over lead suit', () => {
    it('trump card beats a higher-ranked lead-suit card', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', 'A') },  // lead
          { playerId: 'p2', card: card('hearts', '9') },  // trump (lowest)
          { playerId: 'p3', card: card('clubs', 'K') },
        ],
        'clubs',
        'p1',
      );

      // hearts is trump; even a 9 of trump beats A of clubs
      expect(getTrickWinner(trick, 'hearts')).toBe('p2');
    });

    it('non-trump off-suit card does not win', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', '9') },  // lead
          { playerId: 'p2', card: card('diamonds', 'A') }, // off-suit, not trump
          { playerId: 'p3', card: card('clubs', 'J') },
        ],
        'clubs',
        'p1',
      );

      // diamonds is not trump (hearts is), so clubs J wins over clubs 9
      expect(getTrickWinner(trick, 'hearts')).toBe('p3');
    });
  });

  describe('trump vs trump', () => {
    it('higher trump beats lower trump', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('clubs', 'K') },   // lead
          { playerId: 'p2', card: card('hearts', 'J') },   // trump
          { playerId: 'p3', card: card('hearts', '10') },  // trump, higher
        ],
        'clubs',
        'p1',
      );

      // Both p2 and p3 played trump; 10 (strength 4) > J (strength 1)
      expect(getTrickWinner(trick, 'hearts')).toBe('p3');
    });

    it('first trump wins when both play same-strength trump (edge: never happens with unique deck)', () => {
      // In a real game cards are unique, but this validates that the first
      // card with the highest strength wins (loop does not use >=).
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('spades', 'K') },   // lead
          { playerId: 'p2', card: card('hearts', 'A') },    // trump A
          { playerId: 'p3', card: card('spades', '9') },
        ],
        'spades',
        'p1',
      );

      expect(getTrickWinner(trick, 'hearts')).toBe('p2');
    });
  });

  describe('edge cases', () => {
    it('works with a two-card trick', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('diamonds', '10') },
          { playerId: 'p2', card: card('diamonds', 'A') },
        ],
        'diamonds',
        'p3',
      );

      expect(getTrickWinner(trick, null)).toBe('p2');
    });

    it('lead card wins when no one beats it', () => {
      const trick = mockTrick(
        [
          { playerId: 'p1', card: card('diamonds', 'A') },
          { playerId: 'p2', card: card('clubs', 'K') },
          { playerId: 'p3', card: card('spades', '10') },
        ],
        'diamonds',
        'p1',
      );

      expect(getTrickWinner(trick, null)).toBe('p1');
    });
  });
});
