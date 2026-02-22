import { describe, it, expect } from 'vitest';
import { calculateEloChanges } from '../statsService.js';

function makeInput(
  id: string,
  rating: number,
  finalScore: number,
  opts: { gamesPlayed?: number; isWinner?: boolean; bidsWon?: number; bidsFailed?: number; marriages?: number } = {}
) {
  return {
    playerId: id,
    rating,
    gamesPlayed: opts.gamesPlayed ?? 50,
    finalScore,
    isWinner: opts.isWinner ?? false,
    bidsWon: opts.bidsWon ?? 3,
    bidsFailed: opts.bidsFailed ?? 1,
    marriages: opts.marriages ?? 1,
  };
}

describe('calculateEloChanges', () => {
  it('three equal-rated players: winner gains, loser loses, middle ~0', () => {
    const inputs = [
      makeInput('a', 1000, 900, { isWinner: true }),
      makeInput('b', 1000, 600),
      makeInput('c', 1000, 300),
    ];
    const changes = calculateEloChanges(inputs);

    expect(changes.get('a')!).toBeGreaterThan(0);
    expect(changes.get('c')!).toBeLessThan(0);
    // Middle player should be close to 0
    expect(Math.abs(changes.get('b')!)).toBeLessThanOrEqual(5);
  });

  it('underdog beating two higher-rated players gets a big boost', () => {
    const inputs = [
      makeInput('underdog', 800, 1100, { isWinner: true }),
      makeInput('fav1', 1200, 700),
      makeInput('fav2', 1200, 500),
    ];
    const changes = calculateEloChanges(inputs);

    // Underdog should gain significantly more than a same-rated winner
    expect(changes.get('underdog')!).toBeGreaterThan(25);
  });

  it('high-rated player losing to two low-rated suffers a big loss', () => {
    const inputs = [
      makeInput('strong', 1500, 300),
      makeInput('weak1', 800, 900, { isWinner: true }),
      makeInput('weak2', 800, 600),
    ];
    const changes = calculateEloChanges(inputs);

    expect(changes.get('strong')!).toBeLessThan(-15);
  });

  it('K-factor is higher for new players (< 30 games)', () => {
    const newPlayer = [
      makeInput('new', 1000, 900, { gamesPlayed: 5, isWinner: true }),
      makeInput('b', 1000, 600, { gamesPlayed: 50 }),
      makeInput('c', 1000, 300, { gamesPlayed: 50 }),
    ];
    const veteran = [
      makeInput('vet', 1000, 900, { gamesPlayed: 200, isWinner: true }),
      makeInput('b', 1000, 600, { gamesPlayed: 50 }),
      makeInput('c', 1000, 300, { gamesPlayed: 50 }),
    ];

    const newChanges = calculateEloChanges(newPlayer);
    const vetChanges = calculateEloChanges(veteran);

    // New player (K=40) should gain more than veteran (K=16)
    expect(newChanges.get('new')!).toBeGreaterThan(vetChanges.get('vet')!);
  });

  it('performance multiplier amplifies wins for dominant performance', () => {
    // Player with big margin, perfect bids, and marriages
    const dominant = [
      makeInput('dom', 1000, 1200, { isWinner: true, bidsWon: 5, bidsFailed: 0, marriages: 4 }),
      makeInput('b', 1000, 500),
      makeInput('c', 1000, 300),
    ];
    // Player with same rating/placement but minimal performance
    const minimal = [
      makeInput('min', 1000, 610, { isWinner: true, bidsWon: 1, bidsFailed: 3, marriages: 0 }),
      makeInput('b', 1000, 600),
      makeInput('c', 1000, 300),
    ];

    const domChanges = calculateEloChanges(dominant);
    const minChanges = calculateEloChanges(minimal);

    expect(domChanges.get('dom')!).toBeGreaterThan(minChanges.get('min')!);
  });

  it('performance multiplier cushions losses for good play in a loss', () => {
    // Loser with good bid rate and marriages (multiplier > 1 → loss is divided)
    const goodLoser = [
      makeInput('winner', 1000, 900, { isWinner: true }),
      makeInput('good', 1000, 600, { bidsWon: 4, bidsFailed: 0, marriages: 3 }),
      makeInput('bad', 1000, 300, { bidsWon: 0, bidsFailed: 4, marriages: 0 }),
    ];

    const changes = calculateEloChanges(goodLoser);

    // Both are middle/last but good loser should lose less (or gain slightly)
    // bad loser should lose more
    expect(changes.get('good')!).toBeGreaterThan(changes.get('bad')!);
  });

  it('all three tied results in near-zero changes for equal ratings', () => {
    const inputs = [
      makeInput('a', 1000, 500),
      makeInput('b', 1000, 500),
      makeInput('c', 1000, 500),
    ];
    const changes = calculateEloChanges(inputs);

    expect(changes.get('a')!).toBe(0);
    expect(changes.get('b')!).toBe(0);
    expect(changes.get('c')!).toBe(0);
  });

  it('AI phantom rating of 1000 is used in pairwise calculation', () => {
    const inputs = [
      makeInput('user_1', 1200, 900, { isWinner: true }),
      makeInput('ai-bot1', 1000, 600),
      makeInput('ai-bot2', 1000, 300),
    ];
    const changes = calculateEloChanges(inputs);

    // Higher-rated player beating lower-rated AIs should gain modestly
    expect(changes.get('user_1')!).toBeGreaterThan(0);
    expect(changes.get('user_1')!).toBeLessThan(15);
  });

  it('changes sum to approximately zero for equal K-factors', () => {
    const inputs = [
      makeInput('a', 1000, 900, { gamesPlayed: 50, isWinner: true, bidsWon: 3, bidsFailed: 1, marriages: 0 }),
      makeInput('b', 1000, 600, { gamesPlayed: 50, bidsWon: 3, bidsFailed: 1, marriages: 0 }),
      makeInput('c', 1000, 300, { gamesPlayed: 50, bidsWon: 3, bidsFailed: 1, marriages: 0 }),
    ];
    const changes = calculateEloChanges(inputs);
    const sum = (changes.get('a') ?? 0) + (changes.get('b') ?? 0) + (changes.get('c') ?? 0);
    // With performance multiplier the sum won't be exactly 0, but should be reasonable
    expect(Math.abs(sum)).toBeLessThan(15);
  });
});
