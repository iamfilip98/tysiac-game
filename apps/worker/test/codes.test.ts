import { describe, it, expect } from 'vitest';
import { CODE_ALPHABET, CODE_LENGTH, generateRoomCode, normalizeRoomCode } from '../src/codes';

describe('room codes', () => {
  it('uses the 31-symbol alphabet without 0 O 1 I L', () => {
    expect(CODE_ALPHABET).toBe('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    expect(CODE_ALPHABET).toHaveLength(31);
    expect(CODE_LENGTH).toBe(6);
  });

  it('generates 6-character codes that are practically unique', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(295);
  });

  it('skips bytes >= 248 to avoid modulo bias', () => {
    const source = [255, 248, 0, 1, 2, 30, 31, 247, 9, 9, 9, 9];
    expect(generateRoomCode((n) => Uint8Array.from(source.slice(0, n)))).toBe('ABC9A9');
  });

  it('normalises user input', () => {
    expect(normalizeRoomCode(' abc9xy ')).toBe('ABC9XY');
    expect(normalizeRoomCode('ABCDE0')).toBeNull();
    expect(normalizeRoomCode('ABCDEI')).toBeNull();
    expect(normalizeRoomCode('ABCDEFG')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });
});
