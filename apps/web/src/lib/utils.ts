import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getSuitName } from '@tysiac/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  if (score >= 0) return `+${score}`;
  return score.toString();
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

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
