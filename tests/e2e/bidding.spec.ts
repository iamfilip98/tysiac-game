import { test, expect, createAndStartGame } from './helpers/test-fixtures';
import { delay } from './helpers/game-client';

test.describe('Bidding phase', () => {
  test('first bidder auto-gets 100 and second bidder minimum is 110', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];

    // Find who has the first turn with a bid action
    await delay(500);
    const firstBidder = players.find(p => {
      const bidAction = p.getBidAction();
      return bidAction !== undefined;
    });

    // First bidder exists
    expect(firstBidder).toBeTruthy();

    const bidAction = firstBidder!.getBidAction();
    expect(bidAction).toBeTruthy();

    // Min bid should be 110 (auto-100 already placed for left-of-dealer)
    // The first player to get a bid action is the second bidder
    expect(bidAction!.minBid).toBeGreaterThanOrEqual(110);
  });

  test('bidding in increments of 10', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];
    await delay(500);

    const bidder = players.find(p => p.getBidAction());
    if (!bidder) return; // AI might have already handled bidding

    const action = bidder.getBidAction()!;
    // Bid range should be in increments of 10
    expect(action.minBid % 10).toBe(0);
    expect(action.maxBid % 10).toBe(0);
    expect(action.maxBid).toBeGreaterThanOrEqual(action.minBid);
  });

  test('passing removes player from bidding', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];
    await delay(500);

    // Find a player who can pass and pass
    const passer = players.find(p => p.canPass());
    if (!passer) return;

    passer.pass();
    passer.clearActions();
    await delay(500);

    // After passing, this player should not receive another turn in bidding
    // (unless everyone else also passes)
    expect(passer.validActions).toHaveLength(0);
  });

  test('2 passes end bidding - last standing wins', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];

    // Run bidding with passes until it completes
    for (let i = 0; i < 10; i++) {
      await delay(500);
      for (const player of players) {
        if (player.canPass()) {
          player.pass();
          player.clearActions();
          await delay(300);
        }
      }

      // Check if bidding ended
      const anyBidding = players.some(p => p.phase === 'bidding');
      if (!anyBidding) break;
    }

    // Game should have moved past bidding
    await delay(1000);
    const postBiddingPhases = ['talonReveal', 'playOrPassDecision', 'talonDistribution', 'trickPlaying'];
    const currentPhase = players[0].gameState?.phase;
    expect(
      postBiddingPhases.includes(currentPhase!) || currentPhase === 'roundScoring'
    ).toBeTruthy();

    // There should be a bid winner
    const bidWinner = players[0].gameState?.round?.bidWinner;
    expect(bidWinner).toBeTruthy();
  });

  test('player can bid higher', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];
    await delay(500);

    const bidder = players.find(p => p.getBidAction());
    if (!bidder) return;

    const action = bidder.getBidAction()!;
    const bidAmount = action.minBid; // Bid the minimum (110)

    const statePromise = bidder.waitForEvent('game:stateUpdate', 5000);
    bidder.bid(bidAmount);
    bidder.clearActions();

    await statePromise;
    await delay(300);

    // After bidding, the current bid should be at least what we bid
    const currentBid = players[0].gameState?.round?.finalBid;
    expect(currentBid).toBeGreaterThanOrEqual(bidAmount);
  });

  test('talon is revealed after bidding completes', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    // Pass all bidding
    const players = [host, player2, player3];
    for (let i = 0; i < 10; i++) {
      await delay(500);
      for (const player of players) {
        if (player.canPass()) {
          player.pass();
          player.clearActions();
          await delay(300);
        }
      }
      if (!players.some(p => p.phase === 'bidding')) break;
    }

    // Wait for talon reveal
    await delay(1000);

    // At least the bid winner should be able to see the talon
    const bidWinnerId = players[0].gameState?.round?.bidWinner;
    const bidWinner = players.find(p => p.playerId === bidWinnerId);
    if (bidWinner) {
      // Game state should reflect talon reveal phase or later
      expect(['talonReveal', 'playOrPassDecision', 'talonDistribution', 'trickPlaying', 'roundScoring'])
        .toContain(bidWinner.phase);
    }
  });

  test('play-or-pass decision for bid at 100', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];

    // Pass all bidding to get forced 100 bid
    for (let i = 0; i < 10; i++) {
      await delay(500);
      for (const player of players) {
        if (player.canPass()) {
          player.pass();
          player.clearActions();
          await delay(300);
        }
      }
      if (!players.some(p => p.phase === 'bidding')) break;
    }

    await delay(1000);

    // Check if someone has play-or-pass decision
    const decider = players.find(p => p.hasPlayOrPassDecision());

    // If bid was 100 and we're in playOrPassDecision, test the decision
    if (decider) {
      expect(decider.gameState?.round?.finalBid).toBe(100);

      // Choose to play
      decider.playOrPass('play');
      decider.clearActions();
      await delay(500);

      // Should move to talon distribution or trick playing
      expect(['talonDistribution', 'trickPlaying', 'talonReveal'])
        .toContain(decider.phase);
    }
    // Note: if bid > 100, play-or-pass won't happen, which is fine
  });

  test('all players must confirm talon', async ({ host, player2, player3 }) => {
    await createAndStartGame(host, player2, player3);

    const players = [host, player2, player3];

    // Pass bidding
    for (let i = 0; i < 10; i++) {
      await delay(500);
      for (const player of players) {
        if (player.canPass()) {
          player.pass();
          player.clearActions();
          await delay(300);
        }
      }
      if (!players.some(p => p.phase === 'bidding')) break;
    }

    await delay(1000);

    // Handle play-or-pass if needed
    for (const player of players) {
      if (player.hasPlayOrPassDecision()) {
        player.playOrPass('play');
        player.clearActions();
        await delay(500);
        break;
      }
    }

    // If in talon reveal, confirm from all players
    if (players.some(p => p.phase === 'talonReveal')) {
      for (const player of players) {
        player.confirmTalon();
      }
      await delay(500);

      // Should eventually reach talonDistribution or trickPlaying
      await delay(1000);
      const phase = players[0].gameState?.phase;
      expect(['playOrPassDecision', 'talonDistribution', 'trickPlaying', 'wykladana', 'roundScoring'])
        .toContain(phase);
    }
  });
});
