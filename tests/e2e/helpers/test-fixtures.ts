import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { GameClient, delay } from './game-client';

/** Extended test fixtures for Tysiac game E2E tests */
export const test = base.extend<{
  host: GameClient;
  player2: GameClient;
  player3: GameClient;
  hostPage: Page;
  player2Page: Page;
  player3Page: Page;
}>({
  host: async ({}, use) => {
    const client = new GameClient('Host');
    await client.connect();
    await use(client);
    client.disconnect();
  },

  player2: async ({}, use) => {
    const client = new GameClient('Player2');
    await client.connect();
    await use(client);
    client.disconnect();
  },

  player3: async ({}, use) => {
    const client = new GameClient('Player3');
    await client.connect();
    await use(client);
    client.disconnect();
  },

  hostPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  player2Page: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },

  player3Page: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

/**
 * Creates a room, joins all 3 players, readies up, and starts the game.
 * Returns when the game reaches the 'bidding' phase.
 */
export async function createAndStartGame(
  host: GameClient,
  player2: GameClient,
  player3: GameClient,
) {
  // Host creates room
  await host.createRoom('E2E Test Room');
  const code = host.roomCode;
  expect(code).toHaveLength(6);

  // Others join
  await player2.joinRoom(code);
  await player3.joinRoom(code);
  await delay(300);

  // All ready up
  host.ready();
  player2.ready();
  player3.ready();
  await delay(500);

  // Host starts
  host.startGame();

  // Wait for all players to get into bidding phase
  await Promise.all([
    host.waitForPhase('bidding'),
    player2.waitForPhase('bidding'),
    player3.waitForPhase('bidding'),
  ]);
}

/**
 * Run through the bidding phase with all players passing.
 * The forced bidder (left of dealer) ends up with bid of 100.
 */
export async function passAllBidding(
  host: GameClient,
  player2: GameClient,
  player3: GameClient,
): Promise<GameClient> {
  const players = [host, player2, player3];

  // Wait for first bidder's turn, then work through bidding
  // The first bidder auto-gets 100, second and third can pass
  for (let round = 0; round < 6; round++) {
    for (const player of players) {
      if (player.validActions.length > 0) {
        if (player.canPass()) {
          player.pass();
          player.clearActions();
          await delay(300);
        }
      }
    }

    // Check if bidding is over
    const allInBidding = players.some(p => p.phase === 'bidding');
    if (!allInBidding) break;

    // Wait a bit for server to process
    await delay(500);
  }

  // Find the bid winner (whoever has the bidWinner id in game state)
  await delay(500);
  const bidWinnerId = players[0].gameState?.round?.bidWinner;
  const bidWinner = players.find(p => p.playerId === bidWinnerId);
  return bidWinner || players[0];
}

/**
 * Handle the talon phase: all players confirm talon,
 * bid winner distributes cards, handles play-or-pass if needed.
 */
export async function handleTalonPhase(
  host: GameClient,
  player2: GameClient,
  player3: GameClient,
): Promise<void> {
  const players = [host, player2, player3];

  // Wait for talonReveal phase
  const anyInTalon = players.some(p =>
    p.phase === 'talonReveal' || p.phase === 'playOrPassDecision' || p.phase === 'talonDistribution'
  );
  if (!anyInTalon) {
    await Promise.race(players.map(p =>
      p.waitForPhase('talonReveal', 10_000).catch(() => {})
    ));
  }
  await delay(300);

  // All confirm talon
  for (const player of players) {
    player.confirmTalon();
  }
  await delay(500);

  // Check for playOrPass decision
  for (const player of players) {
    if (player.hasPlayOrPassDecision()) {
      player.playOrPass('play');
      player.clearActions();
      await delay(500);
      break;
    }
  }

  // Wait for talon distribution or trick playing
  await delay(500);

  // Find bidder and distribute talon
  const bidWinnerId = players[0].gameState?.round?.bidWinner;
  const bidWinner = players.find(p => p.playerId === bidWinnerId);
  if (bidWinner && bidWinner.gameState?.cardsToDistribute && bidWinner.gameState.cardsToDistribute.length > 0) {
    // Wait for distribution action
    await delay(300);
    const otherPlayers = players.filter(p => p.playerId !== bidWinnerId);
    const cardsToGive = bidWinner.gameState.cardsToDistribute;
    const distribution = cardsToGive.map((card, i) => ({
      playerId: otherPlayers[i % otherPlayers.length].playerId,
      card,
    }));
    bidWinner.distributeTalon(distribution);
    bidWinner.clearActions();
  }

  // Wait for trick playing to start
  await Promise.race(players.map(p =>
    p.waitForPhase('trickPlaying', 15_000).catch(() => {})
  ));
  await delay(300);
}

/**
 * Play a full trick-playing phase. Each player plays a valid card when it's their turn.
 * Plays all 8 tricks.
 */
export async function playAllTricks(
  host: GameClient,
  player2: GameClient,
  player3: GameClient,
): Promise<void> {
  const players = [host, player2, player3];

  // Play 8 tricks, 3 cards each = 24 card plays
  for (let trick = 0; trick < 8; trick++) {
    for (let card = 0; card < 3; card++) {
      // Find who has valid actions
      let currentPlayer: GameClient | undefined;

      // Wait for someone to get a turn
      for (let attempt = 0; attempt < 20; attempt++) {
        currentPlayer = players.find(p => {
          const playable = p.getPlayableCards();
          return playable.length > 0;
        });
        if (currentPlayer) break;

        // Also check marriage declaration
        currentPlayer = players.find(p => p.getMarriageSuits().length > 0);
        if (currentPlayer) {
          // Declare marriage first
          const suits = currentPlayer.getMarriageSuits();
          currentPlayer.declareMarriage(suits[0]);
          currentPlayer.clearActions();
          await delay(300);
          // After marriage, should get playCard action
          currentPlayer = undefined;
          continue;
        }

        await delay(300);
      }

      if (!currentPlayer) {
        // Try waiting for turn events
        const turnPromises = players.map(p =>
          p.waitForTurn(5_000).catch(() => null)
        );
        const results = await Promise.race(turnPromises.map((p, i) =>
          p.then(r => r ? { player: players[i], actions: r } : null)
        ));
        if (results) {
          currentPlayer = results.player;
        }
      }

      if (!currentPlayer) {
        // Game might have ended or moved to scoring
        const anyInTricks = players.some(p => p.phase === 'trickPlaying');
        if (!anyInTricks) return;
        await delay(500);
        continue;
      }

      // Handle marriage if available
      const marriageSuits = currentPlayer.getMarriageSuits();
      if (marriageSuits.length > 0) {
        currentPlayer.declareMarriage(marriageSuits[0]);
        await delay(300);
      }

      // Play first valid card
      const playable = currentPlayer.getPlayableCards();
      if (playable.length > 0) {
        currentPlayer.playCard(playable[0]);
        currentPlayer.clearActions();
        await delay(400);
      }
    }

    // Wait a bit between tricks for server to process
    await delay(500);

    // Check if game moved past trick playing
    const anyInTricks = players.some(p => p.phase === 'trickPlaying');
    if (!anyInTricks) return;
  }
}

/**
 * Play through a complete round: bidding -> talon -> tricks -> scoring
 */
export async function playFullRound(
  host: GameClient,
  player2: GameClient,
  player3: GameClient,
): Promise<RoundResult | null> {
  const players = [host, player2, player3];

  // Bidding: everyone passes (forced bid at 100)
  await passAllBidding(host, player2, player3);

  // Handle talon reveal, distribution, play-or-pass
  await handleTalonPhase(host, player2, player3);

  // Play tricks if we're in trickPlaying phase
  if (players.some(p => p.phase === 'trickPlaying')) {
    await playAllTricks(host, player2, player3);
  }

  // Wait for round end
  await delay(1000);

  // Return round result from whoever has it
  for (const player of players) {
    if (player.lastRoundResult) {
      return player.lastRoundResult;
    }
  }
  return null;
}
