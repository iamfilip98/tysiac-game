/** Room code alphabet: no 0/O, 1/I/L (spec §6). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);
/** 8 × 31: bytes at or above this would bias `byte % 31`. */
const UNBIASED_LIMIT = 248;

const cryptoBytes = (n: number): Uint8Array => crypto.getRandomValues(new Uint8Array(n));

export function generateRoomCode(random: (n: number) => Uint8Array = cryptoBytes): string {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of random(CODE_LENGTH * 2)) {
      if (byte < UNBIASED_LIMIT && code.length < CODE_LENGTH) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
    }
  }
  return code;
}

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}
