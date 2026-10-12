import { describe, it, expect } from 'vitest';
import { COACH_MESSAGES, say } from '../src/coach/messages';

describe('coach messages', () => {
  it('fills named params', () => {
    expect(say('bid.worth', { next: 110, worth: 140 })).toBe('Bid 110 — this hand looks worth about 140');
  });
  it('throws on a missing param instead of printing a placeholder', () => {
    expect(() => say('bid.worth', { next: 110 })).toThrow(/missing \{worth\}/);
  });
  it('every template is one sentence with only {name} placeholders', () => {
    for (const text of Object.values(COACH_MESSAGES)) {
      expect(text.replace(/\{\w+\}/g, '')).not.toMatch(/[{}]/);
      expect(text.trim()).toBe(text);
    }
  });
});
