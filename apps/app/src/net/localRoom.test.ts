import { describe, expect, it } from 'vitest';
import { botAction, type PlayerView } from '@tysiac/engine';
import { PROTOCOL_VERSION, type ClientMessage, type RoomInfo, type ServerMessage } from './protocol';
import { LocalRoom } from './localRoom';
import { FakeClock } from '../test/fakes';
import { AWAY_BOT_AFTER_MS, normalizeCode } from './connection';

interface TestClient {
  id: string;
  msgs: ServerMessage[];
  closed: boolean;
  send(m: ClientMessage): void;
  close(): void;
  last<T extends ServerMessage['t']>(t: T): Extract<ServerMessage, { t: T }> | undefined;
  view(): PlayerView | null;
  room(): RoomInfo | null;
}

function client(room: LocalRoom, id: string, opts: { secret?: string; name?: string; coach?: boolean; skipHello?: boolean } = {}): TestClient {
  const msgs: ServerMessage[] = [];
  const c = { id, msgs, closed: false } as TestClient;
  const sock = room.open(m => msgs.push(m), () => {
    c.closed = true;
  });
  c.send = m => sock.send(m);
  c.close = () => sock.close();
  c.last = t => [...msgs].reverse().find(m => m.t === t) as never;
  c.view = () => c.last('state')?.view ?? null;
  c.room = () => {
    const m = [...msgs].reverse().find(x => x.t === 'room' || x.t === 'welcome');
    return m && (m.t === 'room' || m.t === 'welcome') ? m.room : null;
  };
  if (!opts.skipHello) {
    sock.send({
      t: 'hello', v: PROTOCOL_VERSION, playerId: id, secret: opts.secret ?? `s-${id}`,
      name: opts.name ?? id.toUpperCase(), avatar: '🦊', coach: opts.coach ?? false,
    });
  }
  return c;
}

function setup(maxPlayers: 3 | 4 = 3) {
  const clock = new FakeClock();
  const room = new LocalRoom({ code: 'ABCDEF', maxPlayers, host: { playerId: 'h', name: 'Host', avatar: '🦊' }, seed: 'seed-1', clock });
  return { clock, room };
}

const lobby = (c: TestClient, op: Extract<ClientMessage, { t: 'lobby' }>['op']) => c.send({ t: 'lobby', op });

/** Humans act with the bot heuristic when it's their turn; otherwise time passes so bots move. */
function drive(clock: FakeClock, clients: TestClient[], until: () => boolean, maxSteps = 30_000) {
  for (let i = 0; i < maxSteps && !until(); i++) {
    const c = clients.find(x => {
      const v = x.view();
      return !x.closed && v && v.turn === x.id && !v.paused && v.legal.some(a => a.type !== 'pause' && a.type !== 'resume');
    });
    if (c) c.send({ t: 'act', id: `a${i}`, action: botAction(c.view()!, () => 0.5) });
    else clock.advance(1000);
  }
  if (!until()) throw new Error('drive: condition not reached');
}

describe('LocalRoom lobby', () => {
  it('welcomes the host into seat 0 and broadcasts the room', () => {
    const { room } = setup();
    const h = client(room, 'h');
    const w = h.last('welcome')!;
    expect(w.you).toBe('h');
    expect(w.room.seats[0]).toMatchObject({ id: 'h', name: 'H', connected: true, isBot: false });
    expect(w.room.seats.slice(1)).toEqual([null, null]);
    expect(room.exists()).toEqual({ exists: true, status: 'lobby', maxPlayers: 3, seatsTaken: 1 });
  });

  it('seats joiners in order and rejects a full room', () => {
    const { room } = setup();
    client(room, 'h');
    const a = client(room, 'a');
    client(room, 'b');
    expect(a.room()!.seats.map(s => s?.id)).toEqual(['h', 'a', 'b']);
    const late = client(room, 'late');
    expect(late.last('error')).toMatchObject({ code: 'roomFull' });
    expect(late.closed).toBe(true);
  });

  it('rejects a wrong secret for a known player', () => {
    const { room } = setup();
    client(room, 'h');
    const thief = client(room, 'h', { secret: 'nope' });
    expect(thief.last('error')).toMatchObject({ code: 'badSecret' });
    expect(thief.closed).toBe(true);
  });

  it('requires hello first', () => {
    const { room } = setup();
    const c = client(room, 'x', { skipHello: true });
    c.send({ t: 'ping' });
    expect(c.last('error')).toMatchObject({ code: 'badMessage' });
    expect(c.closed).toBe(true);
  });

  it('only the host manages bots, first dealer and start; anyone swaps seats', () => {
    const { room } = setup();
    const h = client(room, 'h');
    const a = client(room, 'a');
    lobby(a, { op: 'addBot' });
    expect(a.last('error')).toMatchObject({ code: 'notHost' });
    lobby(h, { op: 'addBot' });
    expect(h.room()!.seats[2]).toMatchObject({ name: 'Bot Basia', avatar: '🤖', isBot: true, connected: true });
    lobby(a, { op: 'swapSeats', a: 0, b: 2 });
    expect(h.room()!.seats.map(s => s?.name)).toEqual(['Bot Basia', 'A', 'H']);
    lobby(a, { op: 'setFirstDealer', seat: 1 });
    expect(a.last('error')).toMatchObject({ code: 'notHost' });
    lobby(h, { op: 'setFirstDealer', seat: 1 });
    expect(h.room()!.firstDealer).toBe(1);
    const botId = h.room()!.seats[0]!.id;
    lobby(h, { op: 'removeBot', playerId: botId });
    expect(h.room()!.seats[0]).toBeNull();
    lobby(h, { op: 'start' });
    expect(h.last('error')).toMatchObject({ code: 'badMessage' });
    expect(h.room()!.status).toBe('lobby');
  });

  it('leave frees a lobby seat', () => {
    const { room } = setup();
    const h = client(room, 'h');
    const a = client(room, 'a');
    a.send({ t: 'leave' });
    expect(h.room()!.seats[1]).toBeNull();
  });

  it('answers ping with pong', () => {
    const { room } = setup();
    const h = client(room, 'h');
    h.send({ t: 'ping' });
    expect(h.msgs.at(-1)).toEqual({ t: 'pong' });
  });
});

describe('LocalRoom game', () => {
  function started() {
    const s = setup();
    const h = client(s.room, 'h', { coach: true });
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    return { ...s, h };
  }

  it('start deals and sends each human a personal view', () => {
    const { h } = started();
    expect(h.room()!.status).toBe('playing');
    const st = h.last('state')!;
    expect(st.events).toEqual([]);
    expect(st.view.me).toBe('h');
    expect(st.view.round!.hand).toHaveLength(7);
    expect(st.view.seats.map(s => s.name)).toEqual(['H', 'Bot Basia', 'Bot Zenek']);
    expect(h.room()!.seats[0]!.coach).toBe(true);
  });

  it('plays a whole game with bots and finishes the room', () => {
    const { clock, h } = started();
    drive(clock, [h], () => h.room()!.status === 'finished');
    expect(h.msgs.some(m => m.t === 'reject')).toBe(false);
    const seqs = h.msgs.flatMap(m => (m.t === 'state' ? [m.seq] : []));
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    expect(h.view()!.phase).toBe('gameEnd');
    expect(h.view()!.winner).not.toBeNull();
  }, 60_000);

  it('acks accepted actions and rejects illegal ones with the rule message', () => {
    const { clock, h } = started();
    drive(clock, [], () => h.view()!.turn === 'h');
    h.send({ t: 'act', id: 'r1', action: { type: 'resume' } });
    expect(h.last('reject')).toMatchObject({ id: 'r1', code: 'illegalAction' });
    const legal = h.view()!.legal.find(a => a.type !== 'pause')!;
    h.send({ t: 'act', id: 'ok1', action: legal });
    expect(h.msgs.at(-1)).toEqual({ t: 'ack', id: 'ok1' });
  });

  it('pause stops bots until anyone resumes', () => {
    const { clock, h } = started();
    drive(clock, [h], () => h.view()!.turn !== 'h' && h.view()!.phase === 'tricks');
    h.send({ t: 'act', id: 'p', action: { type: 'pause' } });
    const seq = h.view()!.seq;
    clock.advance(20_000);
    expect(h.view()!.seq).toBe(seq);
    h.send({ t: 'act', id: 'r', action: { type: 'resume' } });
    clock.advance(5_000);
    expect(h.view()!.seq).toBeGreaterThan(seq + 1);
  });

  it('rematch is host-only and rotates the first dealer', () => {
    const { clock, room } = setup();
    const h = client(room, 'h', { coach: true });
    const a = client(room, 'a');
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    drive(clock, [h, a], () => h.room()!.status === 'finished');
    a.send({ t: 'rematch' });
    expect(a.last('error')).toMatchObject({ code: 'notHost' });
    expect(h.room()!.status).toBe('finished');
    h.send({ t: 'rematch' });
    expect(h.room()!.status).toBe('playing');
    expect(h.room()!.firstDealer).toBe(1);
    expect(h.last('state')!.view.rounds).toEqual([]);
  }, 60_000);

  it('rejects strangers once the game is running', () => {
    const { room } = started();
    const x = client(room, 'x');
    expect(x.last('error')).toMatchObject({ code: 'gameInProgress' });
  });
});

describe('LocalRoom privacy', () => {
  it('shows each human only their own hand and their own events', () => {
    const { clock, room } = setup();
    const h = client(room, 'h');
    const a = client(room, 'a');
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    let handouts = 0;
    drive(clock, [h, a], () => {
      const vh = h.view()!, va = a.view()!;
      expect(vh.me).toBe('h');
      expect(va.me).toBe('a');
      if (vh.seq === va.seq && vh.round && va.round) {
        const mine = new Set(vh.round.hand.map(c => JSON.stringify(c)));
        for (const c of va.round.hand) expect(mine.has(JSON.stringify(c))).toBe(false);
      }
      return h.room()!.status === 'finished';
    });
    for (const c of [h, a]) {
      for (const m of c.msgs) {
        if (m.t !== 'state') continue;
        for (const e of m.events) {
          if (e.type === 'dealt') expect(e.hand).toEqual(m.view.round!.hand);
          if (e.type === 'handedOut') {
            handouts++;
            if (e.p !== c.id) expect(Object.keys(e.cards).every(k => k === c.id)).toBe(true);
          }
          if (e.type === 'wykladana' && e.p !== c.id) expect(e.hand.length).toBeGreaterThan(0);
        }
      }
    }
    expect(handouts).toBeGreaterThan(0);
  }, 60_000);
});

describe('LocalRoom bot scheduling', () => {
  function started(scale?: number) {
    const clock = new FakeClock();
    const room = new LocalRoom({ code: 'ABCDEF', maxPlayers: 3, host: { playerId: 'h', name: 'Host', avatar: '🦊' }, seed: 'seed-2', clock, botDelayScale: scale });
    const h = client(room, 'h');
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    return { clock, room, h };
  }

  it('never schedules a bot move while paused or after the game ends', () => {
    const { clock, h } = started();
    drive(clock, [h], () => h.view()!.turn !== 'h' && h.view()!.phase === 'tricks');
    expect(clock.pending).toBe(1);
    h.send({ t: 'act', id: 'p', action: { type: 'pause' } });
    expect(clock.pending).toBe(0);
    h.send({ t: 'act', id: 'r', action: { type: 'resume' } });
    expect(clock.pending).toBe(1);
    drive(clock, [h], () => h.room()!.status === 'finished');
    expect(clock.pending).toBe(0);
  }, 60_000);

  it('uses 600-899 ms plus 1100 after a trick and 1500 after a round end', () => {
    const { clock, h } = started();
    const seen = { plain: 0, trick: 0, round: 0 };
    for (let i = 0; i < 30_000 && h.room()!.status !== 'finished'; i++) {
      const v = h.view()!;
      if (v.turn === 'h' && !v.paused && v.legal.some(a => a.type !== 'pause' && a.type !== 'resume')) {
        h.send({ t: 'act', id: `a${i}`, action: botAction(v, () => 0.5) });
        continue;
      }
      const d = clock.nextDelay();
      if (d === null) throw new Error('no timer');
      const events = h.last('state')!.events;
      const roundEnd = events.some(e => e.type === 'roundScored' || e.type === 'threw');
      const trick = events.some(e => e.type === 'trickWon');
      const extra = (trick ? 1100 : 0) + (roundEnd ? 1500 : 0);
      expect(d).toBeGreaterThanOrEqual(600 + extra);
      expect(d).toBeLessThan(900 + extra);
      seen[roundEnd ? 'round' : trick ? 'trick' : 'plain']++;
      clock.advance(d);
    }
    expect(seen.plain).toBeGreaterThan(0);
    expect(seen.trick).toBeGreaterThan(0);
    expect(seen.round).toBeGreaterThan(0);
  }, 60_000);

  it('botDelayScale 0 schedules every bot move at zero delay', () => {
    const { clock, h } = started(0);
    for (let i = 0; i < 30_000 && h.room()!.status !== 'finished'; i++) {
      const v = h.view()!;
      if (v.turn === 'h' && !v.paused && v.legal.some(a => a.type !== 'pause' && a.type !== 'resume')) {
        h.send({ t: 'act', id: `a${i}`, action: botAction(v, () => 0.5) });
      } else {
        expect(clock.nextDelay()).toBe(0);
        clock.advance(0);
      }
    }
    expect(h.room()!.status).toBe('finished');
  }, 60_000);
});

describe('LocalRoom dispose', () => {
  it('rests the bots when the last human closes and revives them on hello', () => {
    const { clock, room } = setup();
    const h = client(room, 'h');
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    drive(clock, [h], () => h.view()!.turn !== 'h');
    expect(clock.pending).toBe(1);
    h.close();
    expect(clock.pending).toBe(0);
    clock.advance(60_000);
    expect(clock.pending).toBe(0);
    const h2 = client(room, 'h');
    expect(h2.view()).not.toBeNull();
    expect(clock.pending).toBe(1);
    const seq = h2.view()!.seq;
    clock.advance(5_000);
    expect(h2.view()!.seq).toBeGreaterThan(seq);
  });

  it('leave closes the socket and disposes when nobody is left', () => {
    const { clock, room } = setup();
    const h = client(room, 'h');
    h.send({ t: 'leave' });
    expect(h.closed).toBe(true);
    room.dispose();
    expect(clock.pending).toBe(0);
  });
});

describe('LocalRoom away handling', () => {
  it('marks a dropped player away, allows botFor after 30 s, and returns control on reconnect', () => {
    const { clock, room } = setup();
    const h = client(room, 'h');
    let a = client(room, 'a');
    lobby(h, { op: 'addBot' });
    lobby(h, { op: 'start' });
    a.close();
    const seatA = () => h.room()!.seats.find(s => s?.id === 'a')!;
    expect(seatA()).toMatchObject({ connected: false, awaySince: clock.now() });
    h.send({ t: 'botFor', playerId: 'a' });
    expect(h.last('error')).toMatchObject({ code: 'badMessage' });
    clock.advance(AWAY_BOT_AFTER_MS);
    h.send({ t: 'botFor', playerId: 'a' });
    expect(seatA().botFor).toBe(true);
    drive(clock, [h], () => h.view()!.phase === 'tricks' && h.view()!.round!.trick.cards.some(t => t.p === 'a'));
    a = client(room, 'a');
    expect(seatA()).toMatchObject({ connected: true, awaySince: null, botFor: false });
    expect(a.last('state')!.events).toEqual([]);
  });
});

describe('normalizeCode', () => {
  it('accepts 6 characters from the room alphabet, any case', () => {
    expect(normalizeCode(' k7qx2m ')).toBe('K7QX2M');
    expect(normalizeCode('K7QX2')).toBeNull();
    expect(normalizeCode('K7QX2O')).toBeNull();
  });
});
