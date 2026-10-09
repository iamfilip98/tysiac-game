import { describe, it, expect } from 'vitest';
import { parseCards } from '../src/cards';
import { detectWykladana, wykladanaTrump } from '../src/wykladana';

describe('detectWykladana', () => {
  it('doc example: A♦ 10♦ K♦ Q♦ A♠ 10♠ K♠ 9♠ (trump ♦) is wykładana', () => {
    expect(detectWykladana(parseCards('AD 10D KD QD AS 10S KS 9S'))).toBe(true);
  });
  it('six trumps from the top plus A♠ 10♠ is wykładana', () => {
    expect(detectWykladana(parseCards('AH 10H KH QH JH 9H AS 10S'))).toBe(true);
  });
  it('no marriage but every suit is top-consecutive is wykładana (no trump)', () => {
    expect(detectWykladana(parseCards('AH 10H AS 10S AD 10D AC 10C'))).toBe(true);
  });
  it('a gap card that cannot be cleared fails', () => {
    // ♠: A then 9 — only 1 top card but 4 opponent spades
    expect(detectWykladana(parseCards('AH 10H KH QH AS 9S AD AC'))).toBe(false);
  });
  it('trump that cannot be exhausted fails', () => {
    // ♥ trump K Q 9: zero top-consecutive cards vs 3 opponent trumps
    expect(detectWykladana(parseCards('KH QH 9H AS 10S KS AD 10D'))).toBe(false);
  });
  it('requires exactly 8 cards', () => {
    expect(detectWykladana(parseCards('AH 10H KH QH JH 9H AS'))).toBe(false);
    expect(detectWykladana(parseCards('AD 10D KD QD AS 10S KS 9S 9C'))).toBe(false);
  });
  it('wykladanaTrump is the first marriage in ♥♦♣♠ order', () => {
    expect(wykladanaTrump(parseCards('KD QD KH QH'))).toBe('hearts');
    expect(wykladanaTrump(parseCards('KS QS KC QC'))).toBe('clubs');
    expect(wykladanaTrump(parseCards('AH 10H'))).toBeNull();
  });
});
