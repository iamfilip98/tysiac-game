import { describe, it, expect } from 'vitest';
import type { ErrorCode } from '@tysiac/protocol';
import {
  BOT_NAMES, addBot, claimSeat, createMeta, engineSeats, isBotControlled, leaveSeat, markAway, publicSeat,
  rematch, removeBot, seatOf, setBotFor, setCoach, setFirstDealer, start, swapSeats, toRoomInfo, withBotFlags,
  type ClaimResult, type LobbyResult, type SeatClaim,
} from '../src/room/lobby';
import type { RoomMeta } from '../src/room/types';

const HOST = 'host';
const NONE: ReadonlySet<string> = new Set();

const base = (maxPlayers: 3 | 4 = 3): RoomMeta =>
  createMeta({ code: 'ABCDEF', maxPlayers, hostId: HOST, name: 'Host', avatar: '🙂', now: 1000 });

const claim = (id: string, extra: Partial<SeatClaim> = {}): SeatClaim => ({
  id, name: id.toUpperCase(), avatar: '🙂', coach: false, secretHash: `hash-${id}`, ...extra,
});

function ok(r: LobbyResult | ClaimResult): RoomMeta {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.meta;
}

function failure(r: LobbyResult | ClaimResult): ErrorCode {
  if (r.ok) throw new Error('expected a failure');
  return r.code;
}

/** Host + b + c seated (3 players). */
function full(): RoomMeta {
  let m = ok(claimSeat(base(), claim(HOST)));
  m = ok(claimSeat(m, claim('b')));
  return ok(claimSeat(m, claim('c')));
}

const playing = (connected: string[] = [HOST, 'b', 'c']): RoomMeta =>
  ok(start(full(), HOST, 'game-1', 5000, new Set(connected)));

describe('createMeta + claimSeat', () => {
  it('reserves seat 0 for the host with no secret yet', () => {
    const m = base();
    expect(m).toMatchObject({ code: 'ABCDEF', status: 'lobby', hostId: HOST, firstDealer: 0, gameId: null, startedAt: null });
    expect(m.seats).toHaveLength(3);
    expect(m.seats[0]).toMatchObject({ id: HOST, name: 'Host', secretHash: null, isBot: false, awaySince: null, botFor: false });
    expect(m.seats.slice(1)).toEqual([null, null]);
  });

  it("the host's first hello sets the secret; later hellos must match it", () => {
    const m = ok(claimSeat(base(), claim(HOST, { coach: true })));
    expect(seatOf(m, HOST)).toMatchObject({ secretHash: `hash-${HOST}`, name: 'HOST', coach: true });
    expect(failure(claimSeat(m, claim(HOST, { secretHash: 'other' })))).toBe('badSecret');
    expect(claimSeat(m, claim(HOST)).ok).toBe(true);
  });

  it('newcomers take the next free seat; a full lobby says roomFull', () => {
    const m = full();
    expect(m.seats.map((s) => s?.id)).toEqual([HOST, 'b', 'c']);
    expect(failure(claimSeat(m, claim('d')))).toBe('roomFull');
  });

  it('nobody can claim a bot seat', () => {
    const m = ok(addBot(ok(claimSeat(base(), claim(HOST))), HOST, 'bot-1'));
    expect(failure(claimSeat(m, claim('bot-1')))).toBe('badSecret');
  });

  it('names update in the lobby but not during a game; newcomers cannot join a started game', () => {
    const lobby = ok(claimSeat(full(), claim('b', { name: 'Bartek' })));
    expect(seatOf(lobby, 'b')?.name).toBe('Bartek');
    const game = ok(claimSeat(playing(), claim('b', { name: 'Renamed', coach: true })));
    expect(seatOf(game, 'b')).toMatchObject({ name: 'B', coach: true });
    expect(failure(claimSeat(playing(), claim('d')))).toBe('gameInProgress');
  });

  it('does not mutate its input', () => {
    const m = base();
    const before = structuredClone(m);
    claimSeat(m, claim('b'));
    expect(m).toEqual(before);
  });
});

describe('bots and seats', () => {
  it('host adds bots named Basia, Zenek, Halina into free seats', () => {
    let m = ok(claimSeat(base(4), claim(HOST)));
    m = ok(addBot(m, HOST, 'bot-1'));
    m = ok(addBot(m, HOST, 'bot-2'));
    m = ok(addBot(m, HOST, 'bot-3'));
    expect(m.seats.map((s) => s?.name)).toEqual(['HOST', ...BOT_NAMES]);
    expect(m.seats.slice(1).every((s) => s?.isBot && s.secretHash === null)).toBe(true);
    expect(failure(addBot(m, HOST, 'bot-4'))).toBe('roomFull');
  });

  it('reuses a freed bot name', () => {
    let m = ok(claimSeat(base(4), claim(HOST)));
    m = ok(addBot(m, HOST, 'bot-1'));
    m = ok(addBot(m, HOST, 'bot-2'));
    m = ok(removeBot(m, HOST, 'bot-1'));
    m = ok(addBot(m, HOST, 'bot-3'));
    expect(seatOf(m, 'bot-3')?.name).toBe('Bot Basia');
  });

  it('only the host adds or removes bots, picks the dealer and starts', () => {
    const m = ok(claimSeat(ok(claimSeat(base(), claim(HOST))), claim('b')));
    expect(failure(addBot(m, 'b', 'bot-1'))).toBe('notHost');
    expect(failure(setFirstDealer(m, 'b', 1))).toBe('notHost');
    expect(failure(start(full(), 'b', 'g', 1, NONE))).toBe('notHost');
    const withBot = ok(addBot(m, HOST, 'bot-1'));
    expect(failure(removeBot(withBot, 'b', 'bot-1'))).toBe('notHost');
    expect(failure(removeBot(withBot, HOST, 'b'))).toBe('badMessage');
    expect(ok(removeBot(withBot, HOST, 'bot-1')).seats[2]).toBeNull();
  });

  it('anyone seated may swap seats (including with an empty seat)', () => {
    const m = ok(claimSeat(ok(claimSeat(base(), claim(HOST))), claim('b')));
    const swapped = ok(swapSeats(m, 'b', 0, 2));
    expect(swapped.seats.map((s) => s?.id ?? null)).toEqual([null, 'b', HOST]);
    expect(failure(swapSeats(m, 'stranger', 0, 1))).toBe('notInRoom');
    expect(failure(swapSeats(m, 'b', 0, 3))).toBe('badMessage');
    expect(failure(swapSeats(m, 'b', 1, 1))).toBe('badMessage');
  });

  it('setFirstDealer validates the seat', () => {
    expect(ok(setFirstDealer(full(), HOST, 2)).firstDealer).toBe(2);
    expect(failure(setFirstDealer(full(), HOST, 3))).toBe('badMessage');
  });

  it('lobby edits are refused once the game started', () => {
    const g = playing();
    expect(failure(addBot(g, HOST, 'bot-9'))).toBe('gameInProgress');
    expect(failure(swapSeats(g, HOST, 0, 1))).toBe('gameInProgress');
    expect(failure(setFirstDealer(g, HOST, 1))).toBe('gameInProgress');
    expect(failure(leaveSeat(g, 'b'))).toBe('gameInProgress');
  });

  it('setCoach needs a seat', () => {
    expect(seatOf(ok(setCoach(full(), 'c', true)), 'c')?.coach).toBe(true);
    expect(failure(setCoach(full(), 'stranger', true))).toBe('notInRoom');
  });
});

describe('leaving', () => {
  it('frees the seat and passes host to the first remaining human', () => {
    let m = ok(claimSeat(base(), claim(HOST)));
    m = ok(addBot(m, HOST, 'bot-1'));
    m = ok(claimSeat(m, claim('c')));
    const left = ok(leaveSeat(m, HOST));
    expect(left.seats[0]).toBeNull();
    expect(left.hostId).toBe('c');
  });
});

describe('start, away, botFor, rematch', () => {
  it('start needs every seat filled and marks disconnected humans away', () => {
    const half = ok(claimSeat(ok(claimSeat(base(), claim(HOST))), claim('b')));
    expect(failure(start(half, HOST, 'g', 1, NONE))).toBe('badMessage');
    const g = ok(start(full(), HOST, 'game-1', 5000, new Set([HOST, 'b'])));
    expect(g).toMatchObject({ status: 'playing', gameId: 'game-1', startedAt: 5000 });
    expect(seatOf(g, 'c')?.awaySince).toBe(5000);
    expect(seatOf(g, 'b')?.awaySince).toBeNull();
  });

  it('markAway only during a game, only for humans, keeps the first timestamp', () => {
    const lobby = full();
    expect(markAway(lobby, 'b', 7000)).toBe(lobby);
    const g = playing();
    const away = markAway(g, 'b', 7000);
    expect(seatOf(away, 'b')?.awaySince).toBe(7000);
    expect(markAway(away, 'b', 9000)).toBe(away);
  });

  it('botFor is allowed 30 s after a disconnect and is undone by reclaiming the seat', () => {
    const away = markAway(playing(), 'b', 10_000);
    expect(failure(setBotFor(away, HOST, 'b', 39_999))).toBe('badMessage');
    expect(failure(setBotFor(away, 'stranger', 'b', 40_000))).toBe('notInRoom');
    expect(failure(setBotFor(away, HOST, 'nobody', 40_000))).toBe('badMessage');
    expect(failure(setBotFor(playing(), HOST, 'c', 99_000))).toBe('badMessage');
    const taken = ok(setBotFor(away, HOST, 'b', 40_000));
    expect(seatOf(taken, 'b')?.botFor).toBe(true);
    expect(isBotControlled(taken, 'b')).toBe(true);
    const back = claimSeat(taken, claim('b'));
    expect(back).toMatchObject({ ok: true, tookBack: true });
    expect(seatOf(ok(back), 'b')).toMatchObject({ botFor: false, awaySince: null });
    expect(isBotControlled(ok(back), 'b')).toBe(false);
  });

  it('rematch: host only, after the game, rotates the first dealer', () => {
    const finished: RoomMeta = { ...playing(), status: 'finished', firstDealer: 2 };
    expect(failure(rematch(playing(), HOST, 'g2', 1, NONE))).toBe('badMessage');
    expect(failure(rematch(finished, 'b', 'g2', 1, NONE))).toBe('notHost');
    const again = ok(rematch(finished, HOST, 'g2', 8000, new Set([HOST, 'b', 'c'])));
    expect(again).toMatchObject({ status: 'playing', gameId: 'g2', startedAt: 8000, firstDealer: 0 });
  });
});

describe('projections', () => {
  it('engineSeats and withBotFlags carry botFor only for bot-for seats', () => {
    const away = markAway(playing(), 'b', 0);
    const taken = ok(setBotFor(away, HOST, 'b', 60_000));
    const seats = engineSeats(taken);
    expect(seats.map((s) => s.id)).toEqual([HOST, 'b', 'c']);
    expect(seats[1]).toEqual({ id: 'b', name: 'B', avatar: '🙂', isBot: false, botFor: 'bot' });
    expect('botFor' in seats[0]).toBe(false);
    const cleared = withBotFlags(seats, playing());
    expect(cleared.some((s) => 'botFor' in s)).toBe(false);
    expect(() => engineSeats(base())).toThrow();
  });

  it('toRoomInfo shows connection state and never secrets', () => {
    let m = ok(claimSeat(base(), claim(HOST, { coach: true })));
    m = ok(addBot(m, HOST, 'bot-1'));
    const info = toRoomInfo(m, new Set([HOST]));
    expect(info).toEqual({
      code: 'ABCDEF', status: 'lobby', maxPlayers: 3, hostId: HOST, firstDealer: 0,
      seats: [
        { id: HOST, name: 'HOST', avatar: '🙂', isBot: false, connected: true, awaySince: null, botFor: false, coach: true },
        { id: 'bot-1', name: 'Bot Basia', avatar: '🤖', isBot: true, connected: true, awaySince: null, botFor: false, coach: false },
        null,
      ],
    });
    expect(JSON.stringify(info)).not.toContain('hash-');
    expect(publicSeat(m.seats[0]!)).not.toHaveProperty('secretHash');
  });
});
