import { Server } from 'socket.io';
import type { GameState, Card, Suit, ClientGameState, ValidAction, RoundResult } from '@tysiac/shared';
import { createDeck, shuffleDeck, getTotalMarriageValue, hasMarriage, MARRIAGE_VALUES, CARD_POINTS, SUITS } from '@tysiac/shared';
import { getValidCards, getTrickWinner, getTrickWinnerWithReason, validateBid, validateCardPlay, canDeclareMarriage } from './validation.js';
import { calculateRoundScores, applyScores, createRoundResult } from './scoring.js';
import { getClientGameState, getValidActions, getNextPlayer, isAIPlayer } from './stateManager.js';
import { AIPlayer } from '../ai/index.js';
import { detectWykladana } from './wykladana.js';
import { logDebug } from '../services/debugService.js';
import { calculateGameStatistics, createInitialPlayerStats, type PlayerGameStats, type RoundHistory } from './statistics.js';
import { updateStatsAfterGame } from '../services/statsService.js';
import * as bidding from './phases/bidding.js';
import * as talon from './phases/talon.js';
import * as trickPlaying from './phases/trickPlaying.js';

export class GameEngine {
  public game: GameState;
  public io: Server;
  public roomId: string;
  public ai: AIPlayer;
  public onCleanup?: () => void;
  private socketLookup: (playerId: string) => string | null;
  private onPersist?: (game: GameState) => void;

  // Bidding state tracking
  public currentBidder: string = '';
  public passedPlayers: string[] = [];

  // Talon confirmation tracking
  public talonConfirmations: Set<string> = new Set();

  // Wykladana confirmation tracking
  public wykladanaConfirmations: Set<string> = new Set();

  // Safeguard timer for playOrPass decision
  public playOrPassTimer: NodeJS.Timeout | null = null;

  // Track all timers for cleanup
  public activeTimers: Set<NodeJS.Timeout> = new Set();
  public isCleanedUp: boolean = false;
  public isFirstRound: boolean = true;

  // Prevent talon from being added to hand twice
  public talonAddedToHand: boolean = false;

  // Broadcast coalescing — only send the last state in a synchronous flow
  private broadcastPending: boolean = false;

  // Room privacy — public games have timeouts
  public isPrivateRoom: boolean = true;

  // Statistics tracking
  public playerStats: Map<string, PlayerGameStats> = new Map();
  public roundHistory: RoundHistory[] = [];

  constructor(
    game: GameState,
    io: Server,
    roomId: string,
    onCleanup?: () => void,
    socketLookup?: (playerId: string) => string | null,
    isRecreated: boolean = false,
    onPersist?: (game: GameState) => void,
    isPrivate: boolean = true
  ) {
    this.game = game;
    this.io = io;
    this.roomId = roomId;
    this.isPrivateRoom = isPrivate;
    this.ai = new AIPlayer();
    this.onCleanup = onCleanup;
    this.onPersist = onPersist;
    this.socketLookup = socketLookup || ((playerId) =>
      playerId.startsWith('player-') ? playerId.replace('player-', '') : null
    );

    // Initialize player stats for statistics tracking
    for (const player of game.players) {
      this.playerStats.set(player.id, createInitialPlayerStats());
    }

    if (isRecreated) {
      // Engine is being recreated from existing game state (e.g., after server restart)
      this.isFirstRound = false;
      // Restore bidding state from game if in bidding phase
      this.restoreStateFromGame();
      logDebug({
        gameId: game.id,
        roomId,
        eventType: 'engine:recreated',
        eventData: { phase: game.phase },
        result: 'success',
      });
    } else {
      this.isFirstRound = true;
      logDebug({
        gameId: game.id,
        roomId,
        eventType: 'engine:created',
        eventData: { isFirstRound: true },
        result: 'success',
      });
    }
  }

  /**
   * Restore engine internal state from game state (used when recreating engine)
   */
  private restoreStateFromGame(): void {
    const round = this.game.currentRound;
    if (!round) return;

    // Restore bidding state from persisted fields
    if (round.currentBidder) this.currentBidder = round.currentBidder;
    if (round.passedPlayers) this.passedPlayers = [...round.passedPlayers];
    if (round.talonAddedToHand) this.talonAddedToHand = true;
  }

  /**
   * Notify a specific player if it's their turn (used after reconnection)
   * Returns the valid actions if it was the player's turn, null otherwise
   */
  public notifyPlayerIfTheirTurn(playerId: string): ValidAction[] | null {
    if (this.isCleanedUp) return null;

    const round = this.game.currentRound;
    if (!round) return null;

    // Confirmation-based phases: talonReveal and wykladana
    // These don't have a single "current player" — all non-confirmed players need a nudge
    if (this.game.phase === 'talonReveal') {
      if (isAIPlayer(this.game, playerId)) return null;
      if (this.talonConfirmations.has(playerId)) return null;
      // Client renders confirm button from game state; return empty actions
      return [];
    }

    if (this.game.phase === 'wykladana') {
      if (isAIPlayer(this.game, playerId)) return null;
      if (this.wykladanaConfirmations.has(playerId)) return null;
      // Client renders confirm button from game state; return empty actions
      return [];
    }

    let currentPlayerId: string;

    if (this.game.phase === 'bidding') {
      currentPlayerId = this.currentBidder;
    } else if (this.game.phase === 'playOrPassDecision') {
      currentPlayerId = round.bidWinner!;
    } else if (this.game.phase === 'talonDistribution') {
      currentPlayerId = round.bidWinner!;
    } else if (this.game.phase === 'trickPlaying') {
      currentPlayerId = round.currentTrick?.currentPlayer || '';
    } else {
      return null;
    }

    // Only proceed if it's this player's turn
    if (currentPlayerId !== playerId) {
      return null;
    }

    // Don't notify AI players through socket
    if (isAIPlayer(this.game, playerId)) {
      return null;
    }

    let actions: ValidAction[];

    if (this.game.phase === 'playOrPassDecision') {
      actions = [{ type: 'playOrPass' }];
    } else {
      actions = getValidActions(this.game, currentPlayerId, {
        currentBidder: this.currentBidder,
        currentBid: round.finalBid,
        passedPlayers: this.passedPlayers,
      });
    }

    // Emit game:yourTurn to this player
    const socketId = this.getSocketId(playerId);
    const emitted = !!(socketId && actions.length > 0);

    if (emitted) {
      this.io.to(socketId!).emit('game:yourTurn', { validActions: actions });
    }

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      playerId,
      socketId: socketId || undefined,
      eventType: 'notify:playerTurn',
      eventData: {
        phase: this.game.phase,
        currentPlayerId,
        isTheirTurn: true,
        actionsCount: actions.length,
        emitted,
      },
      result: emitted ? 'success' : 'rejected',
    });

    return actions;
  }

  // Safe setTimeout that tracks timers for cleanup
  public safeSetTimeout(callback: () => void, delay: number): NodeJS.Timeout | null {
    if (this.isCleanedUp) return null;

    const timer = setTimeout(() => {
      this.activeTimers.delete(timer);
      if (!this.isCleanedUp) {
        try {
          callback();
        } catch (error) {
          console.error('Error in timer callback:', error);
        }
      }
    }, delay);

    this.activeTimers.add(timer);
    return timer;
  }

  // Cleanup method to prevent memory leaks
  cleanup(): void {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

    // Clear all active timers
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      eventType: 'engine:cleanup',
      result: 'success',
    });
  }

  startGame(): void {
    if (this.isCleanedUp) return;
    this.startNewRound();
  }

  public startNewRound(): void {
    if (this.isCleanedUp) return;

    const roundNumber = this.game.currentRound ? this.game.currentRound.roundNumber + 1 : 1;
    const playerCount = this.game.players.length;
    const is4Player = playerCount === 4;

    // Dealer rotates each round
    const dealerIndex = (roundNumber - 1) % playerCount;
    const dealer = this.game.players[dealerIndex];

    // In 4-player mode, dealer sits out - only deal to 3 active players
    const activePlayers = is4Player
      ? this.game.players.filter(p => p.id !== dealer.id)
      : this.game.players;

    // Helper: check if a hand is valid (18+ points OR has a marriage)
    const isHandValid = (hand: Card[]): boolean => {
      const handValue = hand.reduce((sum, card) => sum + CARD_POINTS[card.rank], 0);
      if (handValue >= 18) return true;
      // Check for any marriage (King + Queen of same suit)
      for (const suit of SUITS) {
        if (hasMarriage(hand, suit)) return true;
      }
      return false;
    };

    // Deal cards until all hands are valid (18+ points OR has marriage)
    let hands: Card[][] = [[], [], []];
    let talonCards: Card[] = [];
    let validDeal = false;

    while (!validDeal) {
      const deck = shuffleDeck(createDeck());
      hands = [[], [], []];
      for (let i = 0; i < 21; i++) {
        hands[i % 3].push(deck[i]);
      }
      talonCards = deck.slice(21, 24);

      // Check all hands are valid
      validDeal = hands.every(hand => isHandValid(hand));
    }

    // Detect talon marriages and aces for dealer scoring (4-player mode)
    const talonMarriages: Suit[] = [];
    let dealerMarriagePoints = 0;
    let talonAces = 0;
    if (is4Player) {
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      for (const suit of suits) {
        const hasQueen = talonCards.some(c => c.suit === suit && c.rank === 'Q');
        const hasKing = talonCards.some(c => c.suit === suit && c.rank === 'K');
        if (hasQueen && hasKing) {
          talonMarriages.push(suit);
          dealerMarriagePoints += MARRIAGE_VALUES[suit];
        }
      }
      // Count aces in talon - each ace gives dealer 50 points
      talonAces = talonCards.filter(c => c.rank === 'A').length;
      dealerMarriagePoints += talonAces * 50;
    }

    // Create player round states
    const playerStates: Record<string, any> = {};
    activePlayers.forEach((p, index) => {
      playerStates[p.id] = {
        playerId: p.id,
        hand: hands[index],
        tricksWon: [],
        pointsFromTricks: 0,
        declaredMarriages: [],
        marriagePoints: 0,
      };
    });

    // In 4-player mode, create an empty state for the dealer (spectator)
    if (is4Player) {
      playerStates[dealer.id] = {
        playerId: dealer.id,
        hand: [],
        tricksWon: [],
        pointsFromTricks: 0,
        declaredMarriages: [],
        marriagePoints: 0,
      };
    }

    this.game.currentRound = {
      roundNumber,
      dealer: dealer.id,
      talon: talonCards,
      talonRevealed: false,
      trumpSuit: null,
      bidWinner: null,
      finalBid: 0,
      players: playerStates,
      currentTrick: null,
      completedTricks: 0,
      cardsToDistribute: [],
      isDealerSittingOut: is4Player,
      dealerMarriagePoints,
      talonMarriages,
      talonAces: is4Player ? talonAces : undefined,
    };

    this.talonAddedToHand = false;
    this.game.phase = 'dealing';
    this.broadcastState();

    // Start bidding after a short delay (for dealing animation)
    this.safeSetTimeout(() => this.startBidding(), 500);
  }

  // --- Bidding phase (delegated to phases/bidding.ts) ---

  private startBidding(): void { bidding.startBidding(this); }
  handleBid(playerId: string, amount: number): void { bidding.handleBid(this, playerId, amount); }
  handlePass(playerId: string): void { bidding.handlePass(this, playerId); }

  // --- Talon phase (delegated to phases/talon.ts) ---

  public clearPlayOrPassTimer(): void {
    if (this.playOrPassTimer) {
      clearTimeout(this.playOrPassTimer);
      this.activeTimers.delete(this.playOrPassTimer);
      this.playOrPassTimer = null;
    }
  }

  handleConfirmTalon(playerId: string): void { talon.handleConfirmTalon(this, playerId); }
  public checkTalonConfirmations(): void { talon.checkTalonConfirmations(this); }
  handleConfirmWykladana(playerId: string): void { talon.handleConfirmWykladana(this, playerId); }
  public checkWykladanaConfirmations(): void { talon.checkWykladanaConfirmations(this); }
  private promptPlayOrPassDecision(): void { talon.promptPlayOrPassDecision(this); }
  handlePlayOrPass(playerId: string, decision: 'play' | 'pass'): void { talon.handlePlayOrPass(this, playerId, decision); }
  handleDistributeTalon(playerId: string, distribution: { playerId: string; card: Card }[]): void { talon.handleDistributeTalon(this, playerId, distribution); }

  // --- Trick playing phase (delegated to phases/trickPlaying.ts) ---

  public startTrickPlaying(): void { trickPlaying.startTrickPlaying(this); }
  handleDeclareMarriage(playerId: string, suit: Suit): void { trickPlaying.handleDeclareMarriage(this, playerId, suit); }
  handlePlayCard(playerId: string, card: Card): void { trickPlaying.handlePlayCard(this, playerId, card); }

  // --- Round lifecycle (kept in engine) ---

  public endRound(): void {
    if (this.isCleanedUp) return;

    this.game.phase = 'roundScoring';

    const round = this.game.currentRound!;
    const scoreResult = calculateRoundScores(this.game);
    applyScores(this.game, scoreResult);

    const roundResult = createRoundResult(this.game, scoreResult);

    // Track statistics for this round
    const roundHistoryEntry: RoundHistory = {
      roundNumber: round.roundNumber,
      bidWinner: round.bidWinner!,
      bid: round.finalBid,
      bidderMadeBid: scoreResult.bidderMadeBid,
      playerScores: {},
    };

    for (const playerResult of scoreResult.playerScores) {
      const stats = this.playerStats.get(playerResult.playerId);
      if (stats) {
        // Track bid success/failure for the bidder
        if (playerResult.playerId === round.bidWinner) {
          stats.bidCount++;
          stats.totalBidAmount += round.finalBid; // Track the final winning bid amount
          stats.highestSingleBid = Math.max(stats.highestSingleBid, round.finalBid);
          if (scoreResult.bidderMadeBid) {
            stats.successfulBidCount++;
            // Track low bid wins (bidding exactly 100 and making it)
            if (round.finalBid === 100) {
              stats.lowBidWins++;
            }
          } else {
            stats.failedBidCount++;
          }
        }

        // Track tricks won
        const playerState = round.players[playerResult.playerId];
        if (playerState) {
          const tricksThisRound = playerState.tricksWon.length;
          stats.totalTricksWon += tricksThisRound;

          // Track clean sweep (won all 8 tricks = 120 trick points)
          if (tricksThisRound === 8 && !stats.hadCleanSweep) {
            stats.hadCleanSweep = true;
            stats.cleanSweepRound = round.roundNumber;
          }
        }

        // Track barrel status
        if (playerResult.wasOnBarrel) {
          stats.roundsOnBarrel++;
        }

        // Track min/max scores
        stats.minScore = Math.min(stats.minScore, playerResult.newTotalScore);
        stats.maxScore = Math.max(stats.maxScore, playerResult.newTotalScore);

        // Track Grunwald (exactly 410 points)
        if (playerResult.newTotalScore === 410 && !stats.reachedGrunwald) {
          stats.reachedGrunwald = true;
          stats.grunwaldRound = round.roundNumber;
        }

        // Track highest round points (for bidder only, since they're the ones achieving big rounds)
        // Use scoreChange (rounded to nearest 10) rather than raw totalRoundPoints
        if (playerResult.playerId === round.bidWinner && scoreResult.bidderMadeBid) {
          stats.highestRoundPoints = Math.max(stats.highestRoundPoints, playerResult.scoreChange);
        }
      }

      roundHistoryEntry.playerScores[playerResult.playerId] = {
        trickPoints: playerResult.trickPoints,
        marriagePoints: playerResult.marriagePoints,
        totalRoundPoints: playerResult.totalRoundPoints,
        scoreChange: playerResult.scoreChange,
        newTotalScore: playerResult.newTotalScore,
        wasOnBarrel: playerResult.wasOnBarrel,
      };
    }

    this.roundHistory.push(roundHistoryEntry);

    // Attach game winner to round result so client can show correct button text
    if (this.game.winner) {
      roundResult.gameWinner = this.game.winner;
    }

    this.io.to(this.roomId).emit('game:roundEnd', roundResult);
    this.broadcastState();

    // Check for winner
    if (this.game.winner) {
      this.safeSetTimeout(() => this.endGame(), 2000);
    } else {
      this.safeSetTimeout(() => this.startNewRound(), 3000);
    }
  }

  private endGame(): void {
    if (this.isCleanedUp) return;

    this.game.phase = 'gameEnd';

    const finalScores: Record<string, number> = {};
    for (const [playerId, score] of Object.entries(this.game.scores)) {
      finalScores[playerId] = score.totalScore;
    }

    // Calculate game statistics
    const statistics = calculateGameStatistics(this.game, this.roundHistory, this.playerStats);

    this.io.to(this.roomId).emit('game:ended', {
      winnerId: this.game.winner!,
      finalScores,
      statistics,
    });

    this.broadcastState();

    // Update cumulative stats for registered players (fire-and-forget)
    const gameResults = this.game.players.map(p => {
      const ps = this.playerStats.get(p.id);
      return {
        playerId: p.id,
        finalScore: finalScores[p.id] || 0,
        isWinner: p.id === this.game.winner,
        bidsWon: ps?.successfulBidCount || 0,
        bidsFailed: ps?.failedBidCount || 0,
        marriages: ps?.marriageCount || 0,
      };
    });
    const roundScores: Record<string, number[]> = {};
    for (const [playerId, score] of Object.entries(this.game.scores)) {
      roundScores[playerId] = score.roundScores;
    }
    updateStatsAfterGame(this.game.id, this.roomId, gameResults, roundScores).catch((err) => {
      console.error('[Engine] Failed to update stats after game:', err);
    });

    // Trigger cleanup callback immediately so room is ready for "Play Again"
    if (this.onCleanup) {
      this.onCleanup();
    }
  }

  /**
   * Sync engine-internal state to game object for persistence.
   * Called before every broadcast and during shutdown flush.
   */
  syncStateForPersist(): void {
    if (!this.game.currentRound) return;
    this.game.currentRound.currentBidder = this.currentBidder;
    this.game.currentRound.passedPlayers = [...this.passedPlayers];
    this.game.currentRound.talonAddedToHand = this.talonAddedToHand;
  }

  public broadcastState(): void {
    if (this.isCleanedUp) return;

    // Coalesce multiple broadcastState() calls in the same synchronous flow.
    // Only the last state snapshot is sent, reducing redundant broadcasts
    // (e.g., marriage declaration + card play in the same tick).
    if (!this.broadcastPending) {
      this.broadcastPending = true;
      queueMicrotask(() => {
        this.broadcastPending = false;
        this.doBroadcast();
      });
    }
  }

  public doBroadcast(): void {
    if (this.isCleanedUp) return;

    // Sync engine state to game object before broadcast/persist
    this.syncStateForPersist();

    const eventName = this.isFirstRound ? 'game:started' : 'game:stateUpdate';
    if (this.isFirstRound) {
      this.isFirstRound = false;
    }

    const playerSocketStatus: Record<string, boolean> = {};

    // Send personalized state to each player
    for (const player of this.game.players) {
      if (player.isAI) continue;

      const clientState = getClientGameState(this.game, player.id);
      const socketId = this.getSocketId(player.id);
      playerSocketStatus[player.id] = !!socketId;

      if (socketId) {
        this.io.to(socketId).emit(eventName, clientState);
      }
    }

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      eventType: 'broadcast:state',
      eventData: {
        eventName,
        phase: this.game.phase,
        playerSocketStatus,
      },
      gameState: this.game,
      result: 'success',
    });

    // Fire-and-forget DB persistence
    this.onPersist?.(this.game);
  }

  public promptCurrentPlayer(): void {
    if (this.isCleanedUp) return;

    const round = this.game.currentRound;
    if (!round) return;

    let currentPlayerId: string;

    if (this.game.phase === 'bidding') {
      currentPlayerId = this.currentBidder;
    } else if (this.game.phase === 'talonDistribution') {
      currentPlayerId = round.bidWinner!;
    } else if (this.game.phase === 'trickPlaying') {
      currentPlayerId = round.currentTrick?.currentPlayer || '';
    } else {
      return;
    }

    const actions = getValidActions(this.game, currentPlayerId, {
      currentBidder: this.currentBidder,
      currentBid: round.finalBid,
      passedPlayers: this.passedPlayers,
    });

    // Check if AI player
    if (isAIPlayer(this.game, currentPlayerId)) {
      this.safeSetTimeout(() => this.handleAITurn(currentPlayerId, actions), 800);
    } else {
      const socketId = this.getSocketId(currentPlayerId);
      if (socketId) {
        this.io.to(socketId).emit('game:yourTurn', { validActions: actions });
      }
    }
  }

  public handleAITurn(playerId: string, actions: ValidAction[]): void {
    if (this.isCleanedUp) return;

    try {
      const round = this.game.currentRound!;
      const hand = round.players[playerId].hand;

      if (this.game.phase === 'bidding') {
        const decision = this.ai.decideBid(hand, round.finalBid, this.passedPlayers.length);

        if (decision.shouldBid && decision.amount) {
          this.handleBid(playerId, decision.amount);
        } else {
          this.handlePass(playerId);
        }
      } else if (this.game.phase === 'talonDistribution') {
        // Get active players only (exclude bidder and sitting-out dealer)
        const otherPlayerIds = this.game.players
          .filter(p => p.id !== playerId && !(round.isDealerSittingOut && p.id === round.dealer))
          .map(p => p.id);
        const distribution = this.ai.decideDistribution(hand, otherPlayerIds, this.game.scores);
        this.handleDistributeTalon(playerId, distribution);
      } else if (this.game.phase === 'trickPlaying') {
        const trick = round.currentTrick!;
        const playAction = actions.find(a => a.type === 'playCard');

        if (playAction && playAction.type === 'playCard') {
          // Check for marriage declaration first
          const marriageAction = actions.find(a => a.type === 'declareMarriage');
          if (marriageAction && marriageAction.type === 'declareMarriage' && trick.cards.length === 0) {
            const marriage = this.ai.decideMarriage(hand, round.players[playerId].declaredMarriages);
            if (marriage) {
              this.handleDeclareMarriage(playerId, marriage);
              return;
            }
          }

          const card = this.ai.decideCard(
            playAction.validCards,
            trick,
            round.trumpSuit,
            round.bidWinner === playerId,
            round.finalBid,
            round.bidWinner || playerId,
            round.players,
            playerId
          );
          this.handlePlayCard(playerId, card);
        }
      }
    } catch (error) {
      console.error('Error in AI turn:', error);
      // Fallback: try to make any valid move
      this.handleAIFallback(playerId, actions);
    }
  }

  public handleAIFallback(playerId: string, actions: ValidAction[]): void {
    if (this.isCleanedUp) return;

    try {
      if (this.game.phase === 'bidding') {
        this.handlePass(playerId);
      } else if (this.game.phase === 'talonDistribution') {
        const round = this.game.currentRound!;
        const hand = round.players[playerId].hand;
        // Get active players only (exclude bidder and sitting-out dealer)
        const others = this.game.players.filter(
          p => p.id !== playerId && !(round.isDealerSittingOut && p.id === round.dealer)
        );
        if (hand.length >= 2 && others.length >= 2) {
          this.handleDistributeTalon(playerId, [
            { playerId: others[0].id, card: hand[0] },
            { playerId: others[1].id, card: hand[1] },
          ]);
        }
      } else if (this.game.phase === 'trickPlaying') {
        const playAction = actions.find(a => a.type === 'playCard');
        if (playAction && playAction.type === 'playCard' && playAction.validCards.length > 0) {
          this.handlePlayCard(playerId, playAction.validCards[0]);
        }
      }
    } catch (error) {
      console.error('AI fallback also failed:', error);
    }
  }

  public getSocketId(playerId: string): string | null {
    return this.socketLookup(playerId);
  }

  public sendError(playerId: string, message: string): void {
    const socketId = this.getSocketId(playerId);
    if (socketId) {
      this.io.to(socketId).emit('game:error', { code: 'INVALID_ACTION', message });
    }
  }

  /**
   * Get current bidding state (used for reconnection)
   */
  getBiddingState(): { currentBidder: string; currentBid: number; passedPlayers: string[] } {
    return {
      currentBidder: this.currentBidder,
      currentBid: this.game.currentRound?.finalBid || 0,
      passedPlayers: [...this.passedPlayers],
    };
  }

  /**
   * Get valid actions for a player (used for reconnection)
   */
  getValidActionsForPlayer(playerId: string): ValidAction[] {
    const round = this.game.currentRound;
    if (!round) return [];

    return getValidActions(this.game, playerId, {
      currentBidder: this.currentBidder,
      currentBid: round.finalBid,
      passedPlayers: this.passedPlayers,
    });
  }

  /**
   * Called when a player disconnects - re-check any pending confirmations
   */
  handlePlayerDisconnect(playerId: string): void {
    if (this.isCleanedUp) return;

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      playerId,
      eventType: 'player:disconnect',
      eventData: { phase: this.game.phase },
      result: 'success',
    });

    // If we're in talon reveal phase, re-check confirmations
    // This will auto-confirm the disconnected player since they no longer have a socket
    if (this.game.phase === 'talonReveal') {
      this.checkTalonConfirmations();
    }

    // Same for wykladana phase
    if (this.game.phase === 'wykladana') {
      this.checkWykladanaConfirmations();
    }
  }

  /**
   * Replace a human player with AI (when they leave mid-game)
   */
  replacePlayerWithAI(playerId: string): void {
    if (this.isCleanedUp) return;

    // Find the player and mark as AI
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return;

    player.isAI = true;
    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      playerId,
      eventType: 'player:replacedWithAI',
      eventData: { playerName: player.name, phase: this.game.phase },
      result: 'success',
    });

    // Check if it's currently this player's turn and trigger AI
    const round = this.game.currentRound;
    if (!round) return;

    let isThisPlayerTurn = false;

    if (this.game.phase === 'bidding' && this.currentBidder === playerId) {
      isThisPlayerTurn = true;
    } else if (this.game.phase === 'talonDistribution' && round.bidWinner === playerId) {
      isThisPlayerTurn = true;
    } else if (this.game.phase === 'trickPlaying' && round.currentTrick?.currentPlayer === playerId) {
      isThisPlayerTurn = true;
    }

    if (isThisPlayerTurn) {
      // Get valid actions and trigger AI turn
      const actions = getValidActions(this.game, playerId, {
        currentBidder: this.currentBidder,
        currentBid: round.finalBid,
        passedPlayers: this.passedPlayers,
      });

      // Delay AI turn slightly so game state can update
      this.safeSetTimeout(() => this.handleAITurn(playerId, actions), 500);
    }

    // Handle talonReveal phase - auto-confirm for AI player
    if (this.game.phase === 'talonReveal' && !this.talonConfirmations.has(playerId)) {
      logDebug({
        gameId: this.game.id,
        roomId: this.roomId,
        playerId,
        eventType: 'talon:autoconfirm:aiReplacement',
        result: 'success',
      });
      this.talonConfirmations.add(playerId);
      this.checkTalonConfirmations();
    }

    // Handle playOrPassDecision phase - AI evaluates whether to play or pass
    if (this.game.phase === 'playOrPassDecision' && round.bidWinner === playerId) {
      const aiHand = round.players[playerId].hand;
      const isOnBarrel = this.game.scores[playerId]?.isOnBarrel || false;
      const aiDecision = this.ai.decidePlayOrPass(aiHand, round.finalBid, isOnBarrel);
      logDebug({
        gameId: this.game.id,
        roomId: this.roomId,
        playerId,
        eventType: 'playOrPass:aiAutoPlay',
        eventData: { decision: aiDecision, finalBid: round.finalBid, isOnBarrel },
        result: 'success',
      });
      this.safeSetTimeout(() => {
        this.handlePlayOrPass(playerId, aiDecision);
      }, 500);
    }

    // Broadcast updated state to remaining players
    this.broadcastState();
  }

  /**
   * Reclaim a seat from AI back to the returning human player
   */
  reclaimFromAI(playerId: string): void {
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return;

    player.isAI = false;

    // If it's currently the AI's turn, re-prompt as human
    const currentPlayerId = this.getCurrentPlayerId();
    if (currentPlayerId === playerId) {
      this.promptCurrentPlayer();
    }

    this.broadcastState();
  }

  private getCurrentPlayerId(): string | null {
    const phase = this.game.phase;
    const round = this.game.currentRound;
    if (!round) return null;

    switch (phase) {
      case 'bidding':
        return this.currentBidder;
      case 'talonReveal':
      case 'playOrPassDecision':
      case 'talonDistribution':
        return round.bidWinner || null;
      case 'trickPlaying':
        return round.currentTrick?.currentPlayer || null;
      default:
        return null;
    }
  }

  /**
   * Pause the game - any player can pause
   */
  pauseGame(playerId: string): boolean {
    if (this.isCleanedUp) return false;
    if (this.game.isPaused) return false;
    if (this.game.phase === 'gameEnd') return false;

    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return false;

    // Set pause state
    this.game.isPaused = true;
    this.game.pausedAt = Date.now();
    this.game.pausedBy = playerId;

    // Clear all active timers
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    this.clearPlayOrPassTimer();

    // Calculate expiry (1 hour)
    const expiresAt = this.game.pausedAt + 60 * 60 * 1000;

    // Emit paused event
    this.io.to(this.roomId).emit('game:paused', {
      pausedBy: playerId,
      pausedByName: player.name,
      pausedAt: this.game.pausedAt,
      expiresAt,
    });

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      playerId,
      eventType: 'game:paused',
      eventData: { phase: this.game.phase, expiresAt },
      result: 'success',
    });

    this.broadcastState();
    return true;
  }

  /**
   * Resume the game - any player can resume
   */
  resumeGame(playerId: string): boolean {
    if (this.isCleanedUp) return false;
    if (!this.game.isPaused) return false;

    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if pause has expired (1 hour)
    const pausedAt = this.game.pausedAt || 0;
    const elapsed = Date.now() - pausedAt;
    const oneHour = 60 * 60 * 1000;

    if (elapsed > oneHour) {
      // Pause expired - end the game
      this.io.to(this.roomId).emit('game:pauseExpired');
      this.game.isPaused = false;
      this.game.pausedAt = undefined;
      this.game.pausedBy = undefined;
      // End the game without a winner
      this.game.phase = 'gameEnd';
      this.broadcastState();
      if (this.onCleanup) {
        this.onCleanup();
      }
      return false;
    }

    // Clear pause state
    this.game.isPaused = false;
    this.game.pausedAt = undefined;
    this.game.pausedBy = undefined;

    // Emit resumed event
    this.io.to(this.roomId).emit('game:resumed', {
      resumedBy: playerId,
      resumedByName: player.name,
    });

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      playerId,
      eventType: 'game:resumed',
      eventData: { phase: this.game.phase },
      result: 'success',
    });

    this.broadcastState();

    // Re-prompt/restore based on current phase
    if (['bidding', 'talonDistribution', 'trickPlaying'].includes(this.game.phase)) {
      this.promptCurrentPlayer();
    } else if (this.game.phase === 'talonReveal') {
      // Re-check talon confirmations (some may have been missed during pause)
      this.checkTalonConfirmations();
    } else if (this.game.phase === 'playOrPassDecision') {
      // Re-prompt the bid winner for their play/pass decision
      this.promptPlayOrPassDecision();
    } else if (this.game.phase === 'wykladana') {
      // Re-check wykladana confirmations
      this.checkWykladanaConfirmations();
    } else if (this.game.phase === 'roundScoring') {
      // Re-broadcast state so clients can see scoring
      this.broadcastState();
    }

    return true;
  }

  /**
   * Check if game is paused
   */
  isPaused(): boolean {
    return this.game.isPaused === true;
  }

  /**
   * Resume game logic after restoring from database (called after players reconnect).
   * Handles phase-specific resumption: re-prompts players, triggers AI, restarts timers.
   */
  resumeAfterRestore(): void {
    if (this.isCleanedUp) return;
    if (this.game.isPaused) return;

    const phase = this.game.phase;

    logDebug({
      gameId: this.game.id,
      roomId: this.roomId,
      eventType: 'engine:resumeAfterRestore',
      eventData: { phase },
      result: 'success',
    });

    switch (phase) {
      case 'dealing':
        // Skip animation, go straight to bidding
        this.startBidding();
        break;

      case 'bidding':
        // Bidding state already restored in restoreStateFromGame
        this.promptCurrentPlayer();
        break;

      case 'talonReveal':
        // Reset confirmations and re-check
        this.talonConfirmations.clear();
        for (const player of this.game.players) {
          if (player.isAI) {
            this.talonConfirmations.add(player.id);
          }
        }
        this.checkTalonConfirmations();
        break;

      case 'playOrPassDecision':
        this.promptPlayOrPassDecision();
        break;

      case 'talonDistribution':
        this.promptCurrentPlayer();
        break;

      case 'wykladana':
        // Reset confirmations and re-check
        this.wykladanaConfirmations.clear();
        for (const player of this.game.players) {
          if (player.isAI) {
            this.wykladanaConfirmations.add(player.id);
          }
        }
        this.checkWykladanaConfirmations();
        break;

      case 'trickPlaying':
        this.promptCurrentPlayer();
        break;

      case 'roundScoring':
        // Scoring already applied, start new round after brief delay
        this.safeSetTimeout(() => this.startNewRound(), 3000);
        break;

      case 'gameEnd':
      case 'idle':
        // No action needed
        break;
    }
  }
}
