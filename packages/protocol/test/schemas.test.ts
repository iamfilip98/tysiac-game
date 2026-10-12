import { describe, it, expect } from 'vitest';
import { CreateRoomRequestSchema, MAX_MESSAGE_BYTES, PROTOCOL_VERSION, parseClientMessage } from '../src/index';
import type { ClientMessage, ParseResult } from '../src/index';

const hello: ClientMessage = {
  t: 'hello', v: 2, playerId: 'p-1', secret: '0123456789abcdef', name: 'Ala', avatar: '🦊', coach: true,
};

function accepted(msg: unknown): ClientMessage {
  const r = parseClientMessage(JSON.stringify(msg));
  if (!r.ok) throw new Error(`rejected: ${r.message}`);
  return r.msg;
}

function rejected(raw: string): Extract<ParseResult, { ok: false }> {
  const r = parseClientMessage(raw);
  if (r.ok) throw new Error(`accepted: ${raw.slice(0, 80)}`);
  return r;
}

describe('parseClientMessage', () => {
  it('accepts every client message in the contract unchanged', () => {
    const messages: ClientMessage[] = [
      hello,
      { t: 'act', id: 'a1', action: { type: 'bid', amount: 110 } },
      { t: 'act', id: 'a2', action: { type: 'pass' } },
      { t: 'act', id: 'a3', action: { type: 'play' } },
      { t: 'act', id: 'a4', action: { type: 'throw' } },
      { t: 'act', id: 'a5', action: { type: 'pause' } },
      { t: 'act', id: 'a6', action: { type: 'resume' } },
      { t: 'act', id: 'a7', action: { type: 'card', card: { suit: 'hearts', rank: 'Q' } } },
      {
        t: 'act', id: 'a8',
        action: { type: 'handout', to: { b: { suit: 'clubs', rank: '9' }, c: { suit: 'spades', rank: '10' } } },
      },
      { t: 'lobby', op: { op: 'addBot' } },
      { t: 'lobby', op: { op: 'removeBot', playerId: 'bot-1' } },
      { t: 'lobby', op: { op: 'swapSeats', a: 0, b: 2 } },
      { t: 'lobby', op: { op: 'setFirstDealer', seat: 3 } },
      { t: 'lobby', op: { op: 'start' } },
      { t: 'botFor', playerId: 'p-2' },
      { t: 'setCoach', coach: false },
      { t: 'rematch' },
      { t: 'leave' },
      { t: 'ping' },
    ];
    for (const m of messages) expect(accepted(m)).toEqual(m);
  });

  it('trims names', () => {
    expect(accepted({ ...hello, name: '  Ala  ' })).toMatchObject({ name: 'Ala' });
  });

  it('rejects unknown fields at every level', () => {
    expect(rejected(JSON.stringify({ ...hello, admin: true })).code).toBe('badMessage');
    expect(rejected(JSON.stringify({ t: 'act', id: 'x', action: { type: 'pass', extra: 1 } })).code).toBe('badMessage');
    expect(
      rejected(JSON.stringify({ t: 'act', id: 'x', action: { type: 'card', card: { suit: 'hearts', rank: 'Q', joker: true } } })).code,
    ).toBe('badMessage');
    expect(rejected(JSON.stringify({ t: 'lobby', op: { op: 'start', now: true } })).code).toBe('badMessage');
    expect(rejected(JSON.stringify({ t: 'ping', x: 1 })).code).toBe('badMessage');
  });

  it('rejects unknown types and malformed values', () => {
    const raws = [
      '',
      'null',
      '[]',
      '42',
      'not json',
      '{"t":"shout"}',
      JSON.stringify({ t: 'act', id: 'x', action: { type: 'bid', amount: '110' } }),
      JSON.stringify({ t: 'act', id: 'x', action: { type: 'bid', amount: 110.5 } }),
      JSON.stringify({ t: 'act', id: 'x', action: { type: 'card', card: { suit: 'hearts', rank: '7' } } }),
      JSON.stringify({ t: 'act', id: 'x', action: { type: 'dance' } }),
      JSON.stringify({ t: 'act', id: '', action: { type: 'pass' } }),
      JSON.stringify({
        t: 'act', id: 'x',
        action: {
          type: 'handout',
          to: { a: { suit: 'clubs', rank: '9' }, b: { suit: 'clubs', rank: '9' }, c: { suit: 'clubs', rank: '9' }, d: { suit: 'clubs', rank: '9' } },
        },
      }),
      JSON.stringify({ ...hello, name: '   ' }),
      JSON.stringify({ ...hello, name: 'x'.repeat(25) }),
      JSON.stringify({ ...hello, secret: 'short' }),
      JSON.stringify({ ...hello, playerId: 'p'.repeat(65) }),
      JSON.stringify({ ...hello, coach: 'yes' }),
      JSON.stringify({ t: 'lobby', op: { op: 'swapSeats', a: 4, b: 0 } }),
      JSON.stringify({ t: 'lobby', op: { op: 'setFirstDealer', seat: -1 } }),
      JSON.stringify({ t: 'lobby', op: 'start' }),
    ];
    for (const raw of raws) expect(rejected(raw).code).toBe('badMessage');
  });

  it('rejects messages over 4 KB, counting UTF-8 bytes', () => {
    expect(MAX_MESSAGE_BYTES).toBe(4096);
    expect(rejected('x'.repeat(4097)).message).toMatch(/too large/i);
    // 2,100 × "ą" is 2,100 UTF-16 units but 4,200 UTF-8 bytes
    const wide = `{"t":"ping","pad":"${'ą'.repeat(2100)}"}`;
    expect(wide.length).toBeLessThan(4096);
    expect(rejected(wide).message).toMatch(/too large/i);
  });

  it('accepts ackTalon', () => {
    const r = parseClientMessage(JSON.stringify({ t: 'act', id: 'x1', action: { type: 'ackTalon' } }));
    expect(r.ok).toBe(true);
  });

  it('rejects ackTalon with extra fields', () => {
    expect(parseClientMessage(JSON.stringify({ t: 'act', id: 'x1', action: { type: 'ackTalon', who: 'b' } })).ok).toBe(false);
  });

  it('reports a protocol version mismatch separately', () => {
    expect(PROTOCOL_VERSION).toBe(2);
    expect(rejected(JSON.stringify({ ...hello, v: 1 })).code).toBe('versionMismatch');
    const noVersion: Record<string, unknown> = { ...hello };
    delete noVersion.v;
    expect(rejected(JSON.stringify(noVersion)).code).toBe('versionMismatch');
  });
});

describe('CreateRoomRequestSchema', () => {
  const body = { maxPlayers: 3, playerId: 'p-1', name: 'Ala', avatar: '🦊' };
  it('accepts a valid body', () => {
    expect(CreateRoomRequestSchema.parse(body)).toEqual(body);
    expect(CreateRoomRequestSchema.parse({ ...body, maxPlayers: 4 }).maxPlayers).toBe(4);
  });
  it('rejects bad bodies', () => {
    for (const bad of [{ ...body, maxPlayers: 5 }, { ...body, name: '' }, { ...body, extra: 1 }, { maxPlayers: 3 }]) {
      expect(CreateRoomRequestSchema.safeParse(bad).success).toBe(false);
    }
  });
});
