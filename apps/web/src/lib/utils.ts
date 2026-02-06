import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MAX_NAME_LENGTH = 7;

export function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return name.slice(0, MAX_NAME_LENGTH) + '…';
}

export function formatScore(score: number): string {
  if (score >= 0) return `+${score}`;
  return score.toString();
}

export function getSuitSymbol(suit: string): string {
  const symbols: Record<string, string> = {
    clubs: '♣',
    diamonds: '♦',
    hearts: '♥',
    spades: '♠',
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

export function getRankDisplay(rank: string): string {
  return rank;
}

export function getCardDescription(card: { suit: string; rank: string }): string {
  const rankNames: Record<string, string> = {
    '9': 'Nine',
    '10': 'Ten',
    'J': 'Jack',
    'Q': 'Queen',
    'K': 'King',
    'A': 'Ace',
  };
  return `${rankNames[card.rank] || card.rank} of ${getSuitName(card.suit)}`;
}
