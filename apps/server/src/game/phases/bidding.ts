import type { GameEngine } from '../engine.js';
import { validateBid } from '../validation.js';
import { getValidActions, getNextPlayer, isAIPlayer } from '../stateManager.js';
import { logDebug } from '../../services/debugService.js';

export function startBidding(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;
  const playerCount = engine.game.players.length;
  const is4Player = playerCount === 4;

  // Get active players (exclude dealer in 4-player mode)
  const activePlayers = is4Player
    ? engine.game.players.filter(p => p.id !== round.dealer)
    : engine.game.players;

  const dealerIndex = engine.game.players.findIndex(p => p.id === round.dealer);

  // Find first active player after dealer (left of dealer)
  let leftOfDealerIndex = (dealerIndex + 1) % playerCount;
  while (is4Player && engine.game.players[leftOfDealerIndex].id === round.dealer) {
    leftOfDealerIndex = (leftOfDealerIndex + 1) % playerCount;
  }
  const leftOfDealer = engine.game.players[leftOfDealerIndex].id;

  // Left of dealer has auto-100
  round.bidWinner = leftOfDealer;
  round.finalBid = 100;

  // Find second active player after dealer (next bidder starts at 110)
  let nextBidderIndex = (leftOfDealerIndex + 1) % playerCount;
  while (is4Player && engine.game.players[nextBidderIndex].id === round.dealer) {
    nextBidderIndex = (nextBidderIndex + 1) % playerCount;
  }
  engine.currentBidder = engine.game.players[nextBidderIndex].id;
  engine.passedPlayers = [];

  engine.game.phase = 'bidding';
  engine.broadcastState();
  engine.promptCurrentPlayer();
}

export function handleBid(engine: GameEngine, playerId: string, amount: number): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'bidding') return;
  if (playerId !== engine.currentBidder) return;

  const round = engine.game.currentRound!;
  const hand = round.players[playerId].hand;

  const isFirstBid = round.finalBid === 100;
  const validation = validateBid(amount, round.finalBid, hand, isFirstBid);

  if (!validation.isValid) {
    engine.sendError(playerId, validation.reason!);
    return;
  }

  // Update bid
  round.finalBid = amount;
  round.bidWinner = playerId;

  engine.broadcastState();
  advanceBidding(engine);
}

export function handlePass(engine: GameEngine, playerId: string): void {
  if (engine.isCleanedUp) return;
  if (engine.game.phase !== 'bidding') return;
  if (playerId !== engine.currentBidder) return;

  const round = engine.game.currentRound!;
  const playerCount = engine.game.players.length;
  const is4Player = round.isDealerSittingOut;
  const dealerIndex = engine.game.players.findIndex(p => p.id === round.dealer);

  // Find left of dealer (skip dealer in 4-player mode)
  let leftOfDealerIndex = (dealerIndex + 1) % playerCount;
  while (is4Player && engine.game.players[leftOfDealerIndex].id === round.dealer) {
    leftOfDealerIndex = (leftOfDealerIndex + 1) % playerCount;
  }
  const leftOfDealer = engine.game.players[leftOfDealerIndex].id;

  // Left of dealer can't pass if others have all passed
  if (playerId === leftOfDealer && engine.passedPlayers.length === 2) {
    engine.sendError(playerId, 'You must bid - others have passed');
    return;
  }

  engine.passedPlayers.push(playerId);
  engine.broadcastState();
  advanceBidding(engine);
}

export function advanceBidding(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  const round = engine.game.currentRound!;
  const is4Player = round.isDealerSittingOut;

  // Check if bidding is complete (2 players passed)
  if (engine.passedPlayers.length >= 2) {
    endBidding(engine);
    return;
  }

  // Get active players (exclude dealer in 4-player mode)
  const activePlayers = is4Player
    ? engine.game.players.filter(p => p.id !== round.dealer)
    : engine.game.players;

  // Build bidding order from active players starting left of dealer
  const dealerIndex = engine.game.players.findIndex(p => p.id === round.dealer);
  const biddingOrder: string[] = [];
  for (let i = 1; i <= engine.game.players.length; i++) {
    const player = engine.game.players[(dealerIndex + i) % engine.game.players.length];
    // Only exclude dealer in 4-player mode (where dealer sits out)
    if (!is4Player || player.id !== round.dealer) {
      biddingOrder.push(player.id);
    }
  }

  // Get active bidders (excluding passed players and current highest bidder)
  const activeBidders = biddingOrder.filter(
    p => !engine.passedPlayers.includes(p) && p !== round.bidWinner
  );

  if (activeBidders.length === 0) {
    endBidding(engine);
    return;
  }

  // Next bidder is first active bidder after current
  const currentIndex = biddingOrder.indexOf(engine.currentBidder);
  let nextBidder: string | null = null;

  for (let i = 1; i <= biddingOrder.length; i++) {
    const candidate = biddingOrder[(currentIndex + i) % biddingOrder.length];
    if (activeBidders.includes(candidate)) {
      nextBidder = candidate;
      break;
    }
  }

  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    eventType: 'bidding:advance',
    eventData: {
      currentBidder: engine.currentBidder,
      bidWinner: round.bidWinner,
      finalBid: round.finalBid,
      passedPlayers: engine.passedPlayers,
      biddingOrder,
      activeBidders,
      nextBidder,
      currentIndex,
    },
    result: 'success',
  });

  if (nextBidder) {
    engine.currentBidder = nextBidder;
    engine.promptCurrentPlayer();
  } else {
    endBidding(engine);
  }
}

export function endBidding(engine: GameEngine): void {
  if (engine.isCleanedUp) return;

  engine.game.phase = 'talonReveal';
  const round = engine.game.currentRound!;
  round.talonRevealed = true;

  // Reset talon confirmations
  engine.talonConfirmations.clear();

  engine.broadcastState();

  // Auto-confirm for players who don't need to confirm:
  // - AI players (they auto-confirm)
  // - Sitting-out dealer in 4-player mode
  // - Non-bid-winners when bid is exactly 100 (they can't see the talon)
  const bidWasAt100 = round.finalBid === 100;
  const autoConfirmDetails: { playerId: string; reason: string }[] = [];

  for (const player of engine.game.players) {
    const isAI = player.isAI;
    const isSittingOutDealer = round.isDealerSittingOut && player.id === round.dealer;
    const cantSeeTalon = bidWasAt100 && player.id !== round.bidWinner;

    if (isAI || isSittingOutDealer || cantSeeTalon) {
      engine.talonConfirmations.add(player.id);
      const reason = isAI ? 'isAI' : isSittingOutDealer ? 'sittingOutDealer' : 'cantSeeTalon';
      autoConfirmDetails.push({ playerId: player.id, reason });
    }
  }

  logDebug({
    gameId: engine.game.id,
    roomId: engine.roomId,
    eventType: 'talon:autoConfirmSummary',
    eventData: {
      bidWasAt100,
      bidWinner: round.bidWinner,
      dealer: round.dealer,
      isDealerSittingOut: round.isDealerSittingOut,
      allPlayers: engine.game.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI })),
      autoConfirmed: autoConfirmDetails,
      confirmationSet: Array.from(engine.talonConfirmations),
    },
    result: 'success',
  });

  // Check if all confirmations are in
  engine.checkTalonConfirmations();
}
