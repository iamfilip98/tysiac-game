// Display utilities shared across web and mobile

export function getSuitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    clubs: '\u2663',
    diamonds: '\u2666',
    hearts: '\u2665',
    spades: '\u2660',
  };
  return symbols[suit] || suit;
}

export function getSuitColor(suit: string): 'red' | 'black' {
  return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
}

export function getSuitName(suit: string): string {
  const names: Record<string, string> = {
    clubs: 'clubs',
    diamonds: 'diamonds',
    hearts: 'hearts',
    spades: 'spades',
  };
  return names[suit] || suit;
}

export const MAX_NAME_LENGTH = 8;

export function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH - 3) + '...';
}
