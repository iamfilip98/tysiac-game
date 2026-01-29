import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function getRankDisplay(rank: string): string {
  return rank;
}
