import { Server } from 'socket.io';
import type { GameState, Card, Suit, ClientGameState, ValidAction, RoundResult } from '@tysiac/shared';
import { createDeck, shuffleDeck, getTotalMarriageValue, hasMarriage, MARRIAGE_VALUES } from '@tysiac/shared';
import { getValidCards, getTrickWinner, validateBid, validateCardPlay, canDeclareMarriage } from './validation.js';
import { calculateRoundScores, applyScores, createRoundResult } from './scoring.js';
import { getClientGameState, getValidActions, getNextPlayer, isAIPlayer } from './stateManager.js';
import { AIPlayer } from '../ai/index.js';

export class GameEngine {
  private game: GameState;
  private io: Server;
  private roomId: string;
  private ai: AIPlayer;
  private onCleanup?: () => void;
  private socketLookup: (playerId: string) => string | null;

  // Bidding state tracking
  private currentBidder: string = '';
  private passedPlayers: string[] = [];

  // Talon confirmation tracking
  private talonConfirmations: Set<string> = new Set();

  // Track all timers for cleanup
  private activeTimers: Set<NodeJS.Timeout> = new Set();
  private isCleanedUp: boolean = false;
  private isFirstRound: boolean = true;

  constructor(
    game: GameState,
    io: Server,
    roomId: string,
    onCleanup?: () => void,
    socketLookup?: (playerId: string) => string | null,
    isRecreated: boolean = false
  ) {
    this.game = game;
    this.io = io;
    this.roomId = roomId;
    this.ai = new AIPlayer();
    this.onCleanup = onCleanup;
    this.socketLookup = socketLookup || ((playerId) =>
      playerId.startsWith('player-') ? playerId.replace('player-', '') : null
    );

    if (isRecreated) {
      // Engine is being recreated from existing game state (e.g., after server restart)
      this.isFirstRound = false;
      // Restore bidding state from game if in bidding phase
      this.restoreStateFromGame();
      console.log('[GameEngine] Recreated engine from existing game state');
    } else {
      this.isFirstRound = true;
      console.log('[GameEngine] Created new engine, isFirstRound:', this.isFirstRound);
    }
  }

  /**
   * Restore engine internal state from game state (used when recreating engine)
   */
  private restoreStateFromGame(): void {
    const round = this.game.currentRound;
    if (!round) return;

    // For bidding phase, we need to determine current bidder
    if (this.game.phase === 'bidding') {
      // If there's a bid winner, the next bidder would be someone else
      // This is an approximation - in practice, bidding state is complex
      // For simplicity, if we're in bidding, let the current highest bidder continue
      if (round.bidWinner) {
        this.currentBidder = round.bidWinner;
      }
    }

    // For trick playing, the current player is stored in the trick
    if (this.game.phase === 'trickPlaying' && round.currentTrick) {
      // Nothing special needed - currentTrick.currentPlayer is already in game state
    }
  }

  /**
   * Notify a specific player if it's their turn (used after reconnection)
   * Returns the valid actions if it was the player's turn, null otherwise
   */
  public notifyPlayerIfTheirTurn(playerId: string): ValidAction[] | null {
    console.log('[notifyPlayerIfTheirTurn] Called with playerId:', playerId);
    console.log('[notifyPlayerIfTheirTurn] isCleanedUp:', this.isCleanedUp);

    if (this.isCleanedUp) return null;

    const round = this.game.currentRound;
    console.log('[notifyPlayerIfTheirTurn] round exists:', !!round);
    if (!round) return null;

    let currentPlayerId: string;

    console.log('[notifyPlayerIfTheirTurn] game.phase:', this.game.phase);

    if (this.game.phase === 'bidding') {
      currentPlayerId = this.currentBidder;
      console.log('[notifyPlayerIfTheirTurn] bidding - currentBidder:', currentPlayerId);
    } else if (this.game.phase === 'talonDistribution') {
      currentPlayerId = round.bidWinner!;
      console.log('[notifyPlayerIfTheirTurn] talonDistribution - bidWinner:', currentPlayerId);
    } else if (this.game.phase === 'trickPlaying') {
      currentPlayerId = round.currentTrick?.currentPlayer || '';
      console.log('[notifyPlayerIfTheirTurn] trickPlaying - currentTrick?.currentPlayer:', round.currentTrick?.currentPlayer);
    } else {
      console.log('[notifyPlayerIfTheirTurn] Unknown phase, returning null');
      return null;
    }

    // Only proceed if it's this player's turn
    console.log('[notifyPlayerIfTheirTurn] Comparing currentPlayerId:', currentPlayerId, 'vs playerId:', playerId);
    if (currentPlayerId !== playerId) {
      console.log('[notifyPlayerIfTheirTurn] NOT their turn, returning null');
      return null;
    }

    // Don't notify AI players through socket
    if (isAIPlayer(this.game, playerId)) {
      console.log('[notifyPlayerIfTheirTurn] Is AI player, returning null');
      return null;
    }

    const actions = getValidActions(this.game, currentPlayerId, {
      currentBidder: this.currentBidder,
      currentBid: round.finalBid,
      passedPlayers: this.passedPlayers,
    });
    console.log('[notifyPlayerIfTheirTurn] getValidActions returned:', actions.length, 'actions');

    // Emit game:yourTurn to this player
    const socketId = this.getSocketId(playerId);
    console.log('[notifyPlayerIfTheirTurn] socketId for player:', socketId);
    if (socketId && actions.length > 0) {
      console.log('[notifyPlayerIfTheirTurn] EMITTING game:yourTurn with', actions.length, 'actions');
      this.io.to(socketId).emit('game:yourTurn', { validActions: actions });
    } else {
      console.log('[notifyPlayerIfTheirTurn] NOT emitting - socketId:', !!socketId, 'actions:', actions.length);
    }

    return actions;
  }

  // Safe setTimeout that tracks timers for cleanup
  private safeSetTimeout(callback: () => void, delay: number): NodeJS.Timeout | null {
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

    console.log(`GameEngine cleaned up for room ${this.roomId}`);
  }

  startGame(): void {
    if (this.isCleanedUp) return;
    this.startNewRound();
  }

  private startNewRound(): void {
    if (this.isCleanedUp) return;

    const roundNumber = this.game.currentRound ? this.game.currentRound.roundNumber + 1 : 1;
    const playerCount = this.game.players.length;
    const is4Player = playerCount === 4;

    // Dealer rotates each round
    const dealerIndex = (roundNumber - 1) % playerCount;
    const dealer = this.game.players[dealerIndex];

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());

    // In 4-player mode, dealer sits out - only deal to 3 active players
    const activePlayers = is4Player
      ? this.game.players.filter(p => p.id !== dealer.id)
      : this.game.players;

    // Deal cards: 7 to each active player, 3 to talon
    const hands: Card[][] = [[], [], []];
    for (let i = 0; i < 21; i++) {
      hands[i % 3].push(deck[i]);
    }
    const talon = deck.slice(21, 24);

    // Detect talon marriages for dealer scoring (4-player mode)
    const talonMarriages: Suit[] = [];
    let dealerMarriagePoints = 0;
    if (is4Player) {
      const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
      for (const suit of suits) {
        const hasQueen = talon.some(c => c.suit === suit && c.rank === 'Q');
        const hasKing = talon.some(c => c.suit === suit && c.rank === 'K');
        if (hasQueen && hasKing) {
          talonMarriages.push(suit);
          dealerMarriagePoints += MARRIAGE_VALUES[suit];
        }
      }
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
      talon,
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
    };

    this.game.phase = 'dealing';
    this.broadcastState();

    // Start bidding after a short delay (for dealing animation)
    this.safeSetTimeout(() => this.startBidding(), 500);
  }

  private startBidding(): void {
    if (this.isCleanedUp) return;

    const round = this.game.currentRound!;
    const playerCount = this.game.players.length;
    const is4Player = playerCount === 4;

    // Get active players (exclude dealer in 4-player mode)
    const activePlayers = is4Player
      ? this.game.players.filter(p => p.id !== round.dealer)
      : this.game.players;

    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);

    // Find first active player after dealer (left of dealer)
    let leftOfDealerIndex = (dealerIndex + 1) % playerCount;
    while (is4Player && this.game.players[leftOfDealerIndex].id === round.dealer) {
      leftOfDealerIndex = (leftOfDealerIndex + 1) % playerCount;
    }
    const leftOfDealer = this.game.players[leftOfDealerIndex].id;

    // Left of dealer has auto-100
    round.bidWinner = leftOfDealer;
    round.finalBid = 100;

    // Find second active player after dealer (next bidder starts at 110)
    let nextBidderIndex = (leftOfDealerIndex + 1) % playerCount;
    while (is4Player && this.game.players[nextBidderIndex].id === round.dealer) {
      nextBidderIndex = (nextBidderIndex + 1) % playerCount;
    }
    this.currentBidder = this.game.players[nextBidderIndex].id;
    this.passedPlayers = [];

    this.game.phase = 'bidding';
    this.broadcastState();
    this.promptCurrentPlayer();
  }

  handleBid(playerId: string, amount: number): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'bidding') return;
    if (playerId !== this.currentBidder) return;

    const round = this.game.currentRound!;
    const hand = round.players[playerId].hand;

    const isFirstBid = round.finalBid === 100;
    const validation = validateBid(amount, round.finalBid, hand, isFirstBid);

    if (!validation.isValid) {
      this.sendError(playerId, validation.reason!);
      return;
    }

    // Update bid
    round.finalBid = amount;
    round.bidWinner = playerId;

    this.broadcastState();
    this.advanceBidding();
  }

  handlePass(playerId: string): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'bidding') return;
    if (playerId !== this.currentBidder) return;

    const round = this.game.currentRound!;
    const playerCount = this.game.players.length;
    const is4Player = round.isDealerSittingOut;
    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);

    // Find left of dealer (skip dealer in 4-player mode)
    let leftOfDealerIndex = (dealerIndex + 1) % playerCount;
    while (is4Player && this.game.players[leftOfDealerIndex].id === round.dealer) {
      leftOfDealerIndex = (leftOfDealerIndex + 1) % playerCount;
    }
    const leftOfDealer = this.game.players[leftOfDealerIndex].id;

    // Left of dealer can't pass if others have all passed
    if (playerId === leftOfDealer && this.passedPlayers.length === 2) {
      this.sendError(playerId, 'You must bid - others have passed');
      return;
    }

    this.passedPlayers.push(playerId);
    this.broadcastState();
    this.advanceBidding();
  }

  private advanceBidding(): void {
    if (this.isCleanedUp) return;

    const round = this.game.currentRound!;
    const is4Player = round.isDealerSittingOut;

    // Check if bidding is complete (2 players passed)
    if (this.passedPlayers.length >= 2) {
      this.endBidding();
      return;
    }

    // Get active players (exclude dealer in 4-player mode)
    const activePlayers = is4Player
      ? this.game.players.filter(p => p.id !== round.dealer)
      : this.game.players;

    // Build bidding order from active players starting left of dealer
    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);
    const biddingOrder: string[] = [];
    for (let i = 1; i <= this.game.players.length; i++) {
      const player = this.game.players[(dealerIndex + i) % this.game.players.length];
      if (!is4Player || player.id !== round.dealer) {
        biddingOrder.push(player.id);
      }
    }

    // Get active bidders (excluding passed players and current highest bidder)
    const activeBidders = biddingOrder.filter(
      p => !this.passedPlayers.includes(p) && p !== round.bidWinner
    );

    if (activeBidders.length === 0) {
      this.endBidding();
      return;
    }

    // Next bidder is first active bidder after current
    const currentIndex = biddingOrder.indexOf(this.currentBidder);
    let nextBidder: string | null = null;

    for (let i = 1; i <= biddingOrder.length; i++) {
      const candidate = biddingOrder[(currentIndex + i) % biddingOrder.length];
      if (activeBidders.includes(candidate)) {
        nextBidder = candidate;
        break;
      }
    }

    if (nextBidder) {
      this.currentBidder = nextBidder;
      this.promptCurrentPlayer();
    } else {
      this.endBidding();
    }
  }

  private endBidding(): void {
    if (this.isCleanedUp) return;

    this.game.phase = 'talonReveal';
    const round = this.game.currentRound!;
    round.talonRevealed = true;

    // Reset talon confirmations
    this.talonConfirmations.clear();

    this.broadcastState();

    // Auto-confirm for AI players and sitting-out dealer
    for (const player of this.game.players) {
      if (player.isAI || (round.isDealerSittingOut && player.id === round.dealer)) {
        this.talonConfirmations.add(player.id);
      }
    }

    // Check if all human players already confirmed (all AI)
    this.checkTalonConfirmations();
  }

  handleConfirmTalon(playerId: string): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'talonReveal') return;

    // Add player confirmation
    this.talonConfirmations.add(playerId);
    this.checkTalonConfirmations();
  }

  private checkTalonConfirmations(): void {
    if (this.isCleanedUp) return;

    // Check if all players have confirmed
    const allConfirmed = this.game.players.every(p => this.talonConfirmations.has(p.id));

    if (allConfirmed) {
      // Add talon to bid winner's hand and proceed to distribution
      const round = this.game.currentRound!;
      const bidWinnerId = round.bidWinner!;
      round.players[bidWinnerId].hand.push(...round.talon);
      round.cardsToDistribute = [...round.talon];

      this.safeSetTimeout(() => {
        if (this.isCleanedUp) return;
        this.game.phase = 'talonDistribution';
        this.broadcastState();
        this.promptCurrentPlayer();
      }, 500);
    }
  }

  handleDistributeTalon(playerId: string, distribution: { playerId: string; card: Card }[]): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'talonDistribution') return;

    const round = this.game.currentRound!;
    if (playerId !== round.bidWinner) return;

    // Validate distribution
    if (distribution.length !== 2) {
      this.sendError(playerId, 'Must give exactly 2 cards');
      return;
    }

    // Get other active players (exclude bidder and sitting-out dealer)
    const otherPlayers = this.game.players
      .filter(p => p.id !== playerId && !(round.isDealerSittingOut && p.id === round.dealer))
      .map(p => p.id);
    const targetPlayers = distribution.map(d => d.playerId);

    // Each other player must receive exactly 1 card
    if (!otherPlayers.every(p => targetPlayers.filter(t => t === p).length === 1)) {
      this.sendError(playerId, 'Each opponent must receive exactly 1 card');
      return;
    }

    // Check for duplicate cards in distribution
    const distributedCards = distribution.map(d => `${d.card.suit}-${d.card.rank}`);
    if (new Set(distributedCards).size !== distributedCards.length) {
      this.sendError(playerId, 'Cannot give the same card twice');
      return;
    }

    const bidderHand = round.players[playerId].hand;

    // Verify cards are in hand
    for (const { card } of distribution) {
      const inHand = bidderHand.some(c => c.suit === card.suit && c.rank === card.rank);
      if (!inHand) {
        this.sendError(playerId, 'Card not in hand');
        return;
      }
    }

    // Distribute cards
    for (const { playerId: targetId, card } of distribution) {
      // Remove from bidder's hand
      const index = bidderHand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
      bidderHand.splice(index, 1);

      // Add to target's hand
      round.players[targetId].hand.push(card);
    }

    round.cardsToDistribute = [];
    this.startTrickPlaying();
  }

  private startTrickPlaying(): void {
    if (this.isCleanedUp) return;

    const round = this.game.currentRound!;

    round.currentTrick = {
      cards: [],
      leadSuit: null,
      currentPlayer: round.bidWinner!,
      trickNumber: 1,
    };

    this.game.phase = 'trickPlaying';
    this.broadcastState();
    this.promptCurrentPlayer();
  }

  handleDeclareMarriage(playerId: string, suit: Suit): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'trickPlaying') return;

    const round = this.game.currentRound!;
    const trick = round.currentTrick;

    if (!trick || trick.currentPlayer !== playerId) return;
    if (trick.cards.length !== 0) return; // Must be leading

    const playerState = round.players[playerId];
    const validation = canDeclareMarriage(
      playerState.hand,
      suit,
      playerState.declaredMarriages,
      true
    );

    if (!validation.isValid) {
      this.sendError(playerId, validation.reason!);
      return;
    }

    // Declare marriage
    playerState.declaredMarriages.push(suit);
    playerState.marriagePoints += MARRIAGE_VALUES[suit];

    // Set trump
    round.trumpSuit = suit;

    this.broadcastState();

    // Auto-play the Queen of the marriage suit
    const queen: Card = { suit, rank: 'Q' };
    this.handlePlayCard(playerId, queen);
  }

  handlePlayCard(playerId: string, card: Card): void {
    if (this.isCleanedUp) return;
    if (this.game.phase !== 'trickPlaying') return;

    const round = this.game.currentRound!;
    const trick = round.currentTrick;

    if (!trick || trick.currentPlayer !== playerId) return;

    const playerState = round.players[playerId];
    const validation = validateCardPlay(card, playerState.hand, trick, round.trumpSuit, this.game);

    if (!validation.isValid) {
      this.sendError(playerId, validation.reason!);
      return;
    }

    // Auto-declare marriage when playing Q while leading
    if (card.rank === 'Q' && trick.cards.length === 0) {
      const suit = card.suit;
      const declared = playerState.declaredMarriages;

      // Check if player has undeclared marriage in this suit
      if (hasMarriage(playerState.hand, suit) && !declared.includes(suit)) {
        // Declare the marriage
        playerState.declaredMarriages.push(suit);
        playerState.marriagePoints += MARRIAGE_VALUES[suit];
        round.trumpSuit = suit;
      }
    }

    // Play card
    trick.cards.push({ playerId, card });
    if (trick.cards.length === 1) {
      trick.leadSuit = card.suit;
    }

    // Remove from hand
    const index = playerState.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    playerState.hand.splice(index, 1);

    this.io.to(this.roomId).emit('game:cardPlayed', { playerId, card });
    this.broadcastState();

    // Check if trick is complete
    if (trick.cards.length === 3) {
      this.completeTrick();
    } else {
      // Next player
      trick.currentPlayer = getNextPlayer(this.game, playerId);
      this.promptCurrentPlayer();
    }
  }

  private completeTrick(): void {
    if (this.isCleanedUp) return;

    const round = this.game.currentRound!;
    const trick = round.currentTrick!;

    const winnerId = getTrickWinner(trick, round.trumpSuit);

    // Safety check for winner
    if (!winnerId) {
      console.error('Failed to determine trick winner');
      return;
    }

    const trickCards = trick.cards.map(c => c.card);

    // Calculate points
    const points = trickCards.reduce((sum, c) => {
      const cardPoints: Record<string, number> = { '9': 0, 'J': 2, 'Q': 3, 'K': 4, '10': 10, 'A': 11 };
      return sum + cardPoints[c.rank];
    }, 0);

    // Award to winner
    round.players[winnerId].tricksWon.push(trickCards);
    round.players[winnerId].pointsFromTricks += points;

    this.io.to(this.roomId).emit('game:trickWon', { winnerId, cards: trickCards, points });

    round.completedTricks++;

    // Check if round is complete (8 tricks)
    if (round.completedTricks >= 8) {
      this.safeSetTimeout(() => this.endRound(), 1500);
    } else {
      // Start next trick
      round.currentTrick = {
        cards: [],
        leadSuit: null,
        currentPlayer: winnerId,
        trickNumber: round.completedTricks + 1,
      };

      this.safeSetTimeout(() => {
        if (this.isCleanedUp) return;
        this.broadcastState();
        this.promptCurrentPlayer();
      }, 1000);
    }
  }

  private endRound(): void {
    if (this.isCleanedUp) return;

    this.game.phase = 'roundScoring';

    const scoreResult = calculateRoundScores(this.game);
    applyScores(this.game, scoreResult);

    const roundResult = createRoundResult(this.game, scoreResult);

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

    this.io.to(this.roomId).emit('game:ended', {
      winnerId: this.game.winner!,
      finalScores,
    });

    this.broadcastState();

    // Trigger cleanup callback
    if (this.onCleanup) {
      this.safeSetTimeout(() => {
        if (this.onCleanup) {
          this.onCleanup();
        }
      }, 5000);
    }
  }

  private broadcastState(): void {
    if (this.isCleanedUp) return;

    console.log(`[GameEngine] broadcastState called, isFirstRound: ${this.isFirstRound}`);
    const eventName = this.isFirstRound ? 'game:started' : 'game:stateUpdate';
    if (this.isFirstRound) {
      this.isFirstRound = false;
    }

    console.log(`[GameEngine] Broadcasting ${eventName} to players`);

    // Send personalized state to each player
    for (const player of this.game.players) {
      if (player.isAI) continue;

      const clientState = getClientGameState(this.game, player.id);
      const socketId = this.getSocketId(player.id);

      console.log(`[GameEngine] Sending ${eventName} to player ${player.id}, socketId: ${socketId}`);

      if (socketId) {
        this.io.to(socketId).emit(eventName, clientState);
      }
    }
  }

  private promptCurrentPlayer(): void {
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

  private handleAITurn(playerId: string, actions: ValidAction[]): void {
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
        const distribution = this.ai.decideDistribution(
          hand,
          this.game.players.filter(p => p.id !== playerId).map(p => p.id)
        );
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
            round.finalBid
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

  private handleAIFallback(playerId: string, actions: ValidAction[]): void {
    if (this.isCleanedUp) return;

    try {
      if (this.game.phase === 'bidding') {
        this.handlePass(playerId);
      } else if (this.game.phase === 'talonDistribution') {
        const round = this.game.currentRound!;
        const hand = round.players[playerId].hand;
        const others = this.game.players.filter(p => p.id !== playerId);
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

  private getSocketId(playerId: string): string | null {
    return this.socketLookup(playerId);
  }

  private sendError(playerId: string, message: string): void {
    const socketId = this.getSocketId(playerId);
    if (socketId) {
      this.io.to(socketId).emit('game:error', { code: 'INVALID_ACTION', message });
    }
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
   * Replace a human player with AI (when they leave mid-game)
   */
  replacePlayerWithAI(playerId: string): void {
    if (this.isCleanedUp) return;

    // Find the player and mark as AI
    const player = this.game.players.find(p => p.id === playerId);
    if (!player) return;

    player.isAI = true;
    console.log(`[GameEngine] Replaced player ${playerId} (${player.name}) with AI`);

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

    // Broadcast updated state to remaining players
    this.broadcastState();
  }
}
