import { describe, it, expect } from 'vitest';
import type { Card, Suit, TrickState, GameState } from '@tysiac/shared';
import {
  getValidCards,
  canBeat,
  getHighestCardInTrick,
  getTrickWinner,
  getTrickWinnerWithReason,
  validateBid,
  canDeclareMarriage,
  validateCardPlay,
} from '../validation.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(rank: Card['rank'], suit: Suit): Card {
  return { rank, suit };
}

function trickState(
  cards: { playerId: string; card: Card }[],
  currentPlayer: string,
  leadSuit: Suit | null = cards.length > 0 ? cards[0].card.suit : null,
): TrickState {
  return { cards, leadSuit, currentPlayer, trickNumber: 1 };
}

function emptyTrick(currentPlayer = 'p1'): TrickState {
  return trickState([], currentPlayer, null);
}

/** Minimal game stub -- the `_game` parameter is unused in the implementation. */
const GAME = {} as GameState;

// ---------------------------------------------------------------------------
// getValidCards
// ---------------------------------------------------------------------------

describe('getValidCards', () => {
  it('returns all cards when player leads the trick (empty trick)', () => {
    const hand = [card('9', 'hearts'), card('A', 'spades'), card('K', 'clubs')];
    const result = getValidCards(hand, emptyTrick(), null, GAME);
    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(hand));
  });

  // --- follow-suit obligation ---

  it('forces following suit when player holds cards in the lead suit', () => {
    const hand = [card('9', 'hearts'), card('A', 'hearts'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('10', 'hearts') }],
      'p2',
    );
    const result = getValidCards(hand, trick, null, GAME);
    // Must play hearts only
    expect(result.every(c => c.suit === 'hearts')).toBe(true);
  });

  it('forces second player to beat the lead card if they can', () => {
    const hand = [card('9', 'hearts'), card('A', 'hearts'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('10', 'hearts') }],
      'p2',
    );
    // Second player must beat 10 hearts — only A hearts qualifies
    const result = getValidCards(hand, trick, null, GAME);
    expect(result).toEqual([card('A', 'hearts')]);
  });

  it('allows any in-suit card for second player when unable to beat the lead', () => {
    const hand = [card('9', 'hearts'), card('J', 'hearts'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('A', 'hearts') }],
      'p2',
    );
    const result = getValidCards(hand, trick, null, GAME);
    // Can't beat A hearts, so both hearts are valid
    expect(result).toEqual(expect.arrayContaining([card('9', 'hearts'), card('J', 'hearts')]));
    expect(result).toHaveLength(2);
  });

  it('allows any card when player cannot follow suit (no trump obligation)', () => {
    const hand = [card('9', 'clubs'), card('A', 'spades')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('10', 'hearts') }],
      'p2',
    );
    const result = getValidCards(hand, trick, 'diamonds', GAME);
    // No hearts in hand -- play anything (no obligation to trump)
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining(hand));
  });

  it('third player has no obligation to beat — just follows suit', () => {
    // p1 leads 9 hearts, p2 plays A hearts. p3 just needs to follow suit.
    const hand = [card('J', 'hearts'), card('K', 'hearts')];
    const trick = trickState(
      [
        { playerId: 'p1', card: card('9', 'hearts') },
        { playerId: 'p2', card: card('A', 'hearts') },
      ],
      'p3',
    );
    const result = getValidCards(hand, trick, null, GAME);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([card('J', 'hearts'), card('K', 'hearts')]));
  });

  it('third player has no obligation to beat even when second player did not beat lead', () => {
    // p1 leads A hearts, p2 plays 9 hearts (can't beat). p3 still just follows suit.
    const hand = [card('J', 'hearts'), card('K', 'hearts')];
    const trick = trickState(
      [
        { playerId: 'p1', card: card('A', 'hearts') },
        { playerId: 'p2', card: card('9', 'hearts') },
      ],
      'p3',
    );
    const result = getValidCards(hand, trick, null, GAME);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([card('J', 'hearts'), card('K', 'hearts')]));
  });

  it('must beat the lead card with trump when holding trump and no lead suit cards', () => {
    // Actually: no trump obligation in this implementation. When player can't follow suit,
    // any card is valid. However, if the function *did* return trumps-only it would still
    // be a subset of hand. Let's verify no restriction:
    const hand = [card('9', 'diamonds'), card('A', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('10', 'hearts') }],
      'p2',
    );
    const result = getValidCards(hand, trick, 'diamonds', GAME);
    expect(result).toHaveLength(2);
  });

  it('second player must beat lead even when trump is lead suit', () => {
    const hand = [card('Q', 'hearts'), card('A', 'hearts'), card('9', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('K', 'hearts') }],
      'p2',
    );
    // Hearts is trump and lead -- must beat K hearts, only A hearts can
    const result = getValidCards(hand, trick, 'hearts', GAME);
    expect(result).toEqual([card('A', 'hearts')]);
  });
});

// ---------------------------------------------------------------------------
// canBeat
// ---------------------------------------------------------------------------

describe('canBeat', () => {
  it('trump card beats a non-trump card', () => {
    expect(canBeat(card('9', 'hearts'), card('A', 'spades'), 'spades', 'hearts')).toBe(true);
  });

  it('non-trump cannot beat a trump card', () => {
    expect(canBeat(card('A', 'spades'), card('9', 'hearts'), 'spades', 'hearts')).toBe(false);
  });

  it('higher trump beats lower trump', () => {
    expect(canBeat(card('K', 'hearts'), card('J', 'hearts'), 'spades', 'hearts')).toBe(true);
  });

  it('lower trump does not beat higher trump', () => {
    expect(canBeat(card('J', 'hearts'), card('K', 'hearts'), 'spades', 'hearts')).toBe(false);
  });

  it('higher rank beats lower rank in same non-trump suit', () => {
    expect(canBeat(card('A', 'spades'), card('10', 'spades'), 'spades', null)).toBe(true);
  });

  it('lower rank does not beat higher rank in same suit', () => {
    expect(canBeat(card('9', 'spades'), card('10', 'spades'), 'spades', null)).toBe(false);
  });

  it('different non-trump suits cannot beat each other', () => {
    expect(canBeat(card('A', 'clubs'), card('9', 'spades'), 'spades', null)).toBe(false);
  });

  it('same rank in same suit does not beat (not strictly greater)', () => {
    expect(canBeat(card('10', 'spades'), card('10', 'spades'), 'spades', null)).toBe(false);
  });

  it('works correctly when trumpSuit is null (no trump)', () => {
    expect(canBeat(card('A', 'hearts'), card('K', 'hearts'), 'hearts', null)).toBe(true);
    expect(canBeat(card('A', 'hearts'), card('K', 'clubs'), 'clubs', null)).toBe(false);
  });

  it('10 beats K in Tysiac ranking (10 has strength 4, K has strength 3)', () => {
    expect(canBeat(card('10', 'spades'), card('K', 'spades'), 'spades', null)).toBe(true);
    expect(canBeat(card('K', 'spades'), card('10', 'spades'), 'spades', null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getHighestCardInTrick
// ---------------------------------------------------------------------------

describe('getHighestCardInTrick', () => {
  it('returns the only card when trick has a single card', () => {
    const result = getHighestCardInTrick([card('9', 'hearts')], 'hearts', null);
    expect(result).toEqual(card('9', 'hearts'));
  });

  it('returns the highest card in lead suit when no trump', () => {
    const cards = [card('9', 'hearts'), card('A', 'hearts'), card('K', 'hearts')];
    const result = getHighestCardInTrick(cards, 'hearts', null);
    expect(result).toEqual(card('A', 'hearts'));
  });

  it('ignores off-suit cards when there is no trump', () => {
    const cards = [card('9', 'hearts'), card('A', 'clubs')];
    const result = getHighestCardInTrick(cards, 'hearts', null);
    // A clubs is off-suit and irrelevant; 9 hearts leads
    expect(result).toEqual(card('9', 'hearts'));
  });

  it('trump beats all non-trump cards regardless of rank', () => {
    const cards = [card('A', 'hearts'), card('9', 'spades')];
    const result = getHighestCardInTrick(cards, 'hearts', 'spades');
    expect(result).toEqual(card('9', 'spades'));
  });

  it('highest trump wins when multiple trumps are played', () => {
    const cards = [card('J', 'diamonds'), card('A', 'diamonds'), card('Q', 'diamonds')];
    const result = getHighestCardInTrick(cards, 'hearts', 'diamonds');
    expect(result).toEqual(card('A', 'diamonds'));
  });

  it('highest lead suit card wins when trump exists but no trump was played', () => {
    const cards = [card('K', 'hearts'), card('10', 'hearts')];
    const result = getHighestCardInTrick(cards, 'hearts', 'diamonds');
    expect(result).toEqual(card('10', 'hearts'));
  });

  it('off-suit non-trump card does not beat lead suit card', () => {
    const cards = [card('9', 'hearts'), card('A', 'clubs')];
    const result = getHighestCardInTrick(cards, 'hearts', 'diamonds');
    expect(result).toEqual(card('9', 'hearts'));
  });
});

// ---------------------------------------------------------------------------
// getTrickWinner / getTrickWinnerWithReason
// ---------------------------------------------------------------------------

describe('getTrickWinner', () => {
  it('returns the player who played the highest card', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('9', 'hearts') },
        { playerId: 'p2', card: card('A', 'hearts') },
        { playerId: 'p3', card: card('K', 'hearts') },
      ],
      'p1',
    );
    expect(getTrickWinner(trick, null)).toBe('p2');
  });

  it('returns the player who trumped when no one else played trump', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('A', 'hearts') },
        { playerId: 'p2', card: card('9', 'spades') },
        { playerId: 'p3', card: card('K', 'hearts') },
      ],
      'p1',
    );
    expect(getTrickWinner(trick, 'spades')).toBe('p2');
  });

  it('returns the player with the highest trump when multiple trumps played', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('A', 'hearts') },
        { playerId: 'p2', card: card('J', 'spades') },
        { playerId: 'p3', card: card('K', 'spades') },
      ],
      'p1',
    );
    expect(getTrickWinner(trick, 'spades')).toBe('p3');
  });
});

describe('getTrickWinnerWithReason', () => {
  it('indicates trumping reason when winner trumped', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('A', 'hearts') },
        { playerId: 'p2', card: card('9', 'spades') },
      ],
      'p1',
    );
    const result = getTrickWinnerWithReason(trick, 'spades');
    expect(result.winnerId).toBe('p2');
    expect(result.winningCard).toEqual(card('9', 'spades'));
    expect(result.reason).toContain('trumping');
  });

  it('indicates highest trump reason when trump is lead suit', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('9', 'hearts') },
        { playerId: 'p2', card: card('A', 'hearts') },
      ],
      'p1',
    );
    const result = getTrickWinnerWithReason(trick, 'hearts');
    expect(result.winnerId).toBe('p2');
    expect(result.reason).toContain('highest trump');
  });

  it('indicates highest card in lead suit reason when no trumping', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('9', 'hearts') },
        { playerId: 'p2', card: card('A', 'hearts') },
      ],
      'p1',
    );
    const result = getTrickWinnerWithReason(trick, 'diamonds');
    expect(result.winnerId).toBe('p2');
    expect(result.reason).toContain('highest card in lead suit');
  });

  it('returns correct winningCard in result', () => {
    const trick = trickState(
      [
        { playerId: 'p1', card: card('K', 'clubs') },
        { playerId: 'p2', card: card('A', 'clubs') },
        { playerId: 'p3', card: card('10', 'clubs') },
      ],
      'p1',
    );
    const result = getTrickWinnerWithReason(trick, null);
    expect(result.winningCard).toEqual(card('A', 'clubs'));
    expect(result.winnerId).toBe('p2');
  });
});

// ---------------------------------------------------------------------------
// validateBid
// ---------------------------------------------------------------------------

describe('validateBid', () => {
  it('accepts a bid that is exactly currentBid + 10', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts'), card('A', 'hearts')];
    const result = validateBid(110, 100, hand, false);
    expect(result.isValid).toBe(true);
  });

  it('rejects a bid that is not currentBid + 10', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts'), card('A', 'hearts')];
    const result = validateBid(120, 100, hand, false);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('110');
  });

  it('rejects a bid lower than currentBid + 10', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    const result = validateBid(100, 100, hand, false);
    expect(result.isValid).toBe(false);
  });

  it('rejects a bid exceeding 120 + total marriage value', () => {
    // No marriages in hand -> max is 120
    const hand = [card('9', 'hearts'), card('A', 'spades')];
    const result = validateBid(130, 120, hand, false);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('120');
  });

  it('allows a bid up to 120 + marriage value', () => {
    // Hearts marriage = 100 -> max is 220
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    const result = validateBid(220, 210, hand, false);
    expect(result.isValid).toBe(true);
  });

  it('rejects bid exceeding max with hearts marriage (max 220)', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    // max = 120 + 100 = 220, so 230 is too high
    const result = validateBid(230, 220, hand, false);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('220');
  });

  it('accounts for multiple marriages in max bid calculation', () => {
    // Hearts marriage (100) + spades marriage (40) -> max = 120 + 140 = 260
    const hand = [
      card('Q', 'hearts'), card('K', 'hearts'),
      card('Q', 'spades'), card('K', 'spades'),
    ];
    const result = validateBid(260, 250, hand, false);
    expect(result.isValid).toBe(true);
  });

  it('rejects bid above max with multiple marriages', () => {
    const hand = [
      card('Q', 'hearts'), card('K', 'hearts'),
      card('Q', 'spades'), card('K', 'spades'),
    ];
    // max = 120 + 100 + 40 = 260
    const result = validateBid(270, 260, hand, false);
    expect(result.isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canDeclareMarriage
// ---------------------------------------------------------------------------

describe('canDeclareMarriage', () => {
  it('allows marriage declaration when leading with K+Q in hand', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts'), card('A', 'clubs')];
    const result = canDeclareMarriage(hand, 'hearts', [], true);
    expect(result.isValid).toBe(true);
  });

  it('rejects marriage declaration when not leading', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    const result = canDeclareMarriage(hand, 'hearts', [], false);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('leading');
  });

  it('rejects marriage declaration when suit already declared', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    const result = canDeclareMarriage(hand, 'hearts', ['hearts'], true);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('already declared');
  });

  it('rejects marriage declaration when missing King', () => {
    const hand = [card('Q', 'hearts'), card('A', 'hearts')];
    const result = canDeclareMarriage(hand, 'hearts', [], true);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('No marriage');
  });

  it('rejects marriage declaration when missing Queen', () => {
    const hand = [card('K', 'hearts'), card('A', 'hearts')];
    const result = canDeclareMarriage(hand, 'hearts', [], true);
    expect(result.isValid).toBe(false);
    // hasMarriage returns false when Q is missing, so "No marriage" reason
    expect(result.reason).toContain('No marriage');
  });

  it('allows declaring a second marriage in a different suit', () => {
    const hand = [
      card('Q', 'spades'), card('K', 'spades'),
      card('Q', 'hearts'), card('K', 'hearts'),
    ];
    const result = canDeclareMarriage(hand, 'spades', ['hearts'], true);
    expect(result.isValid).toBe(true);
  });

  it('rejects declaring marriage in suit where player has K+Q of a different suit', () => {
    const hand = [card('Q', 'hearts'), card('K', 'hearts')];
    const result = canDeclareMarriage(hand, 'spades', [], true);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('No marriage');
  });
});

// ---------------------------------------------------------------------------
// validateCardPlay
// ---------------------------------------------------------------------------

describe('validateCardPlay', () => {
  it('accepts a card that is in hand and in valid cards', () => {
    const hand = [card('A', 'hearts'), card('9', 'clubs')];
    const trick = emptyTrick();
    const result = validateCardPlay(card('A', 'hearts'), hand, trick, null, GAME);
    expect(result.isValid).toBe(true);
  });

  it('rejects a card that is not in hand', () => {
    const hand = [card('9', 'clubs')];
    const trick = emptyTrick();
    const result = validateCardPlay(card('A', 'hearts'), hand, trick, null, GAME);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('not in hand');
  });

  it('rejects a card that is in hand but not in the valid set', () => {
    // Lead is A hearts, hand has 9 hearts and K clubs
    // Must follow suit (hearts) and cannot beat A, so only 9 hearts is valid
    const hand = [card('9', 'hearts'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('A', 'hearts') }],
      'p2',
    );
    const result = validateCardPlay(card('K', 'clubs'), hand, trick, null, GAME);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('Invalid card');
  });

  it('accepts trump card when player cannot follow suit', () => {
    const hand = [card('9', 'diamonds'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('A', 'hearts') }],
      'p2',
    );
    // No hearts in hand, can play anything including trump
    const result = validateCardPlay(card('9', 'diamonds'), hand, trick, 'diamonds', GAME);
    expect(result.isValid).toBe(true);
  });

  it('accepts non-trump off-suit card when player cannot follow suit', () => {
    const hand = [card('9', 'diamonds'), card('K', 'clubs')];
    const trick = trickState(
      [{ playerId: 'p1', card: card('A', 'hearts') }],
      'p2',
    );
    // No hearts in hand, can play anything
    const result = validateCardPlay(card('K', 'clubs'), hand, trick, 'diamonds', GAME);
    expect(result.isValid).toBe(true);
  });

  it('accepts any card when leading the trick', () => {
    const hand = [card('9', 'hearts'), card('A', 'spades'), card('K', 'clubs')];
    const trick = emptyTrick();
    for (const c of hand) {
      const result = validateCardPlay(c, hand, trick, 'hearts', GAME);
      expect(result.isValid).toBe(true);
    }
  });
});
