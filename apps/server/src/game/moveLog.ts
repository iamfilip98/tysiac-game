import type { Card, Suit, TrickState } from '@tysiac/shared';
import { getValidCards } from './validation.js';
import type { GameState } from '@tysiac/shared';

export interface MoveLogEntry {
  roundNumber: number;
  trickNumber: number;
  playerId: string;
  hand: Card[];              // full hand BEFORE playing
  trickState: {              // trick state BEFORE this card was added
    leadSuit: Suit | null;
    cards: { playerId: string; card: Card }[];
    currentPlayer: string;
  };
  trumpSuit: Suit | null;
  validCardsSent: Card[];    // validCards sent to client via game:yourTurn
  validCardsAtPlay: Card[];  // validCards recomputed at play time
  playedCard: Card;
  timestamp: number;
}

export interface MoveValidationIssue {
  roundNumber: number;
  trickNumber: number;
  playerId: string;
  type: 'card_not_in_valid' | 'valid_cards_mismatch' | 'replay_mismatch';
  description: string;
  expected: Card[];
  actual: Card[];
  playedCard: Card;
  hand: Card[];
  trickState: MoveLogEntry['trickState'];
  trumpSuit: Suit | null;
}

export interface MoveValidationResult {
  gameId: string;
  totalMoves: number;
  issues: MoveValidationIssue[];
  validated: boolean;
  validatedAt: number;
}

/**
 * In-memory move log for a single game.
 * Attached to each GameEngine instance.
 */
export class MoveLog {
  private entries: MoveLogEntry[] = [];
  private validCardsSentBuffer: Map<string, Card[]> = new Map(); // playerId -> last validCards sent

  /**
   * Record the validCards that were sent to a player via game:yourTurn.
   * Called from promptCurrentPlayer.
   */
  recordValidCardsSent(playerId: string, validCards: Card[]): void {
    this.validCardsSentBuffer.set(playerId, [...validCards]);
  }

  /**
   * Log a card play with full context.
   * Called from handlePlayCard BEFORE the card is removed from hand.
   */
  logMove(params: {
    roundNumber: number;
    trickNumber: number;
    playerId: string;
    hand: Card[];
    trick: TrickState;
    trumpSuit: Suit | null;
    validCardsAtPlay: Card[];
    playedCard: Card;
  }): void {
    const validCardsSent = this.validCardsSentBuffer.get(params.playerId) ?? [];

    this.entries.push({
      roundNumber: params.roundNumber,
      trickNumber: params.trickNumber,
      playerId: params.playerId,
      hand: params.hand.map(c => ({ ...c })),
      trickState: {
        leadSuit: params.trick.leadSuit,
        cards: params.trick.cards.map(c => ({ playerId: c.playerId, card: { ...c.card } })),
        currentPlayer: params.trick.currentPlayer,
      },
      trumpSuit: params.trumpSuit,
      validCardsSent: validCardsSent.map(c => ({ ...c })),
      validCardsAtPlay: params.validCardsAtPlay.map(c => ({ ...c })),
      playedCard: { ...params.playedCard },
      timestamp: Date.now(),
    });

    // Clear the buffer for this player after recording
    this.validCardsSentBuffer.delete(params.playerId);
  }

  /**
   * Replay all moves through getValidCards and detect discrepancies.
   * Returns validation issues found.
   */
  validate(gameId: string, game: GameState): MoveValidationResult {
    const issues: MoveValidationIssue[] = [];

    for (const entry of this.entries) {
      // Reconstruct a minimal trick state for getValidCards
      const trickForValidation: TrickState = {
        cards: entry.trickState.cards,
        leadSuit: entry.trickState.leadSuit,
        currentPlayer: entry.trickState.currentPlayer,
        trickNumber: entry.trickNumber,
      };

      // Replay: what SHOULD the valid cards be?
      const replayedValidCards = getValidCards(
        entry.hand,
        trickForValidation,
        entry.trumpSuit,
        game // game state for context (unused in current validation but required by signature)
      );

      // Check 1: Was the played card in the replayed valid cards?
      const playedIsValid = replayedValidCards.some(
        c => c.suit === entry.playedCard.suit && c.rank === entry.playedCard.rank
      );

      if (!playedIsValid) {
        issues.push({
          roundNumber: entry.roundNumber,
          trickNumber: entry.trickNumber,
          playerId: entry.playerId,
          type: 'card_not_in_valid',
          description: `Card ${entry.playedCard.rank}${entry.playedCard.suit} was played but is not in replayed valid cards`,
          expected: replayedValidCards,
          actual: [entry.playedCard],
          playedCard: entry.playedCard,
          hand: entry.hand,
          trickState: entry.trickState,
          trumpSuit: entry.trumpSuit,
        });
      }

      // Check 2: Did validCardsSent match validCardsAtPlay?
      if (entry.validCardsSent.length > 0) {
        const sentSet = new Set(entry.validCardsSent.map(c => `${c.rank}${c.suit}`));
        const atPlaySet = new Set(entry.validCardsAtPlay.map(c => `${c.rank}${c.suit}`));

        const sentNotInPlay = entry.validCardsSent.filter(c => !atPlaySet.has(`${c.rank}${c.suit}`));
        const playNotInSent = entry.validCardsAtPlay.filter(c => !sentSet.has(`${c.rank}${c.suit}`));

        if (sentNotInPlay.length > 0 || playNotInSent.length > 0) {
          issues.push({
            roundNumber: entry.roundNumber,
            trickNumber: entry.trickNumber,
            playerId: entry.playerId,
            type: 'valid_cards_mismatch',
            description: `Valid cards sent to client differ from valid cards at play time. Sent-only: [${sentNotInPlay.map(c => `${c.rank}${c.suit}`).join(',')}] Play-only: [${playNotInSent.map(c => `${c.rank}${c.suit}`).join(',')}]`,
            expected: entry.validCardsSent,
            actual: entry.validCardsAtPlay,
            playedCard: entry.playedCard,
            hand: entry.hand,
            trickState: entry.trickState,
            trumpSuit: entry.trumpSuit,
          });
        }
      }

      // Check 3: Does the replay match what was computed at play time?
      const replaySet = new Set(replayedValidCards.map(c => `${c.rank}${c.suit}`));
      const atPlaySet = new Set(entry.validCardsAtPlay.map(c => `${c.rank}${c.suit}`));

      const replayNotInPlay = replayedValidCards.filter(c => !atPlaySet.has(`${c.rank}${c.suit}`));
      const playNotInReplay = entry.validCardsAtPlay.filter(c => !replaySet.has(`${c.rank}${c.suit}`));

      if (replayNotInPlay.length > 0 || playNotInReplay.length > 0) {
        issues.push({
          roundNumber: entry.roundNumber,
          trickNumber: entry.trickNumber,
          playerId: entry.playerId,
          type: 'replay_mismatch',
          description: `Replay valid cards differ from play-time valid cards. Replay-only: [${replayNotInPlay.map(c => `${c.rank}${c.suit}`).join(',')}] PlayTime-only: [${playNotInReplay.map(c => `${c.rank}${c.suit}`).join(',')}]`,
          expected: replayedValidCards,
          actual: entry.validCardsAtPlay,
          playedCard: entry.playedCard,
          hand: entry.hand,
          trickState: entry.trickState,
          trumpSuit: entry.trumpSuit,
        });
      }
    }

    return {
      gameId,
      totalMoves: this.entries.length,
      issues,
      validated: true,
      validatedAt: Date.now(),
    };
  }

  getEntries(): MoveLogEntry[] {
    return this.entries;
  }

  getEntriesByRound(roundNumber: number): MoveLogEntry[] {
    return this.entries.filter(e => e.roundNumber === roundNumber);
  }

  clear(): void {
    this.entries = [];
    this.validCardsSentBuffer.clear();
  }
}

/**
 * Global store for completed game validation results.
 * Keeps results for the last N games.
 */
const MAX_STORED_RESULTS = 20;
const validationResults: MoveValidationResult[] = [];

export function storeValidationResult(result: MoveValidationResult): void {
  validationResults.push(result);
  if (validationResults.length > MAX_STORED_RESULTS) {
    validationResults.shift();
  }

  if (result.issues.length > 0) {
    console.warn(
      `[MoveLog] VALIDATION ISSUES in game ${result.gameId}: ${result.issues.length} issue(s) found out of ${result.totalMoves} moves`
    );
    for (const issue of result.issues) {
      console.warn(
        `  [${issue.type}] R${issue.roundNumber} T${issue.trickNumber} ${issue.playerId}: ${issue.description}`
      );
    }
  }
}

export function getValidationResults(): MoveValidationResult[] {
  return validationResults;
}

export function getValidationResultByGameId(gameId: string): MoveValidationResult | undefined {
  return validationResults.find(r => r.gameId === gameId);
}

export function getValidationIssues(): MoveValidationResult[] {
  return validationResults.filter(r => r.issues.length > 0);
}
