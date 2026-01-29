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

  // Bidding state tracking
  private currentBidder: string = '';
  private passedPlayers: string[] = [];

  constructor(game: GameState, io: Server, roomId: string) {
    this.game = game;
    this.io = io;
    this.roomId = roomId;
    this.ai = new AIPlayer();
  }

  startGame(): void {
    this.startNewRound();
  }

  private startNewRound(): void {
    const roundNumber = this.game.currentRound ? this.game.currentRound.roundNumber + 1 : 1;

    // Dealer rotates each round
    const dealerIndex = (roundNumber - 1) % 3;
    const dealer = this.game.players[dealerIndex];

    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());

    // Deal cards: 7 to each player, 3 to talon
    const hands: Card[][] = [[], [], []];
    for (let i = 0; i < 21; i++) {
      hands[i % 3].push(deck[i]);
    }
    const talon = deck.slice(21, 24);

    // Create player round states
    const playerStates: Record<string, any> = {};
    this.game.players.forEach((p, index) => {
      playerStates[p.id] = {
        playerId: p.id,
        hand: hands[index],
        tricksWon: [],
        pointsFromTricks: 0,
        declaredMarriages: [],
        marriagePoints: 0,
      };
    });

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
    };

    this.game.phase = 'dealing';
    this.broadcastState();

    // Start bidding after a short delay (for dealing animation)
    setTimeout(() => this.startBidding(), 500);
  }

  private startBidding(): void {
    const round = this.game.currentRound!;
    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);

    // Left of dealer has auto-100
    const leftOfDealer = this.game.players[(dealerIndex + 1) % 3].id;
    round.bidWinner = leftOfDealer;
    round.finalBid = 100;

    // Next bidder starts at 110
    this.currentBidder = this.game.players[(dealerIndex + 2) % 3].id;
    this.passedPlayers = [];

    this.game.phase = 'bidding';
    this.broadcastState();
    this.promptCurrentPlayer();
  }

  handleBid(playerId: string, amount: number): void {
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
    if (this.game.phase !== 'bidding') return;
    if (playerId !== this.currentBidder) return;

    const round = this.game.currentRound!;
    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);
    const leftOfDealer = this.game.players[(dealerIndex + 1) % 3].id;

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
    const round = this.game.currentRound!;

    // Check if bidding is complete (2 players passed)
    if (this.passedPlayers.length >= 2) {
      this.endBidding();
      return;
    }

    // Find next bidder
    const dealerIndex = this.game.players.findIndex(p => p.id === round.dealer);
    const biddingOrder = [
      this.game.players[(dealerIndex + 1) % 3].id,
      this.game.players[(dealerIndex + 2) % 3].id,
      round.dealer,
    ];

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

    for (let i = 1; i <= 3; i++) {
      const candidate = biddingOrder[(currentIndex + i) % 3];
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
    this.game.phase = 'talonReveal';
    const round = this.game.currentRound!;
    round.talonRevealed = true;

    this.broadcastState();

    // Add talon to bid winner's hand
    const bidWinnerId = round.bidWinner!;
    round.players[bidWinnerId].hand.push(...round.talon);
    round.cardsToDistribute = [...round.talon];

    setTimeout(() => {
      this.game.phase = 'talonDistribution';
      this.broadcastState();
      this.promptCurrentPlayer();
    }, 1000);
  }

  handleDistributeTalon(playerId: string, distribution: { playerId: string; card: Card }[]): void {
    if (this.game.phase !== 'talonDistribution') return;

    const round = this.game.currentRound!;
    if (playerId !== round.bidWinner) return;

    // Validate distribution
    if (distribution.length !== 2) {
      this.sendError(playerId, 'Must give exactly 2 cards');
      return;
    }

    const otherPlayers = this.game.players.filter(p => p.id !== playerId).map(p => p.id);
    const targetPlayers = distribution.map(d => d.playerId);

    // Each other player must receive exactly 1 card
    if (!otherPlayers.every(p => targetPlayers.filter(t => t === p).length === 1)) {
      this.sendError(playerId, 'Each opponent must receive exactly 1 card');
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

    // Player still needs to play a card (should play Queen)
    this.promptCurrentPlayer();
  }

  handlePlayCard(playerId: string, card: Card): void {
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
    const round = this.game.currentRound!;
    const trick = round.currentTrick!;

    const winnerId = getTrickWinner(trick, round.trumpSuit);
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

    // Check if round is complete (7 tricks)
    if (round.completedTricks >= 7) {
      setTimeout(() => this.endRound(), 1500);
    } else {
      // Start next trick
      round.currentTrick = {
        cards: [],
        leadSuit: null,
        currentPlayer: winnerId,
        trickNumber: round.completedTricks + 1,
      };

      setTimeout(() => {
        this.broadcastState();
        this.promptCurrentPlayer();
      }, 1000);
    }
  }

  private endRound(): void {
    this.game.phase = 'roundScoring';

    const scoreResult = calculateRoundScores(this.game);
    applyScores(this.game, scoreResult);

    const roundResult = createRoundResult(this.game, scoreResult);

    this.io.to(this.roomId).emit('game:roundEnd', roundResult);
    this.broadcastState();

    // Check for winner
    if (this.game.winner) {
      setTimeout(() => this.endGame(), 2000);
    } else {
      setTimeout(() => this.startNewRound(), 3000);
    }
  }

  private endGame(): void {
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
  }

  private broadcastState(): void {
    // Send personalized state to each player
    for (const player of this.game.players) {
      if (player.isAI) continue;

      const clientState = getClientGameState(this.game, player.id);
      const socketId = this.getSocketId(player.id);

      if (socketId) {
        this.io.to(socketId).emit('game:stateUpdate', clientState);
      }
    }
  }

  private promptCurrentPlayer(): void {
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
      setTimeout(() => this.handleAITurn(currentPlayerId, actions), 800);
    } else {
      const socketId = this.getSocketId(currentPlayerId);
      if (socketId) {
        this.io.to(socketId).emit('game:yourTurn', { validActions: actions });
      }
    }
  }

  private handleAITurn(playerId: string, actions: ValidAction[]): void {
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
  }

  private getSocketId(playerId: string): string | null {
    // In a real implementation, this would look up the socket ID
    // For now, we rely on the socket handlers mapping
    return playerId.startsWith('player-') ? playerId.replace('player-', '') : null;
  }

  private sendError(playerId: string, message: string): void {
    const socketId = this.getSocketId(playerId);
    if (socketId) {
      this.io.to(socketId).emit('game:error', { code: 'INVALID_ACTION', message });
    }
  }
}
