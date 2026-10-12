import type { PlayerId, Seat } from '@tysiac/engine';
import type { ErrorCode, RoomInfo } from '@tysiac/protocol';
import { safeEqual } from '../identity';
import { canTakeOver } from '../scheduler';
import type { InitRoomRequest, PublicSeatMeta, RoomMeta, SeatMeta } from './types';

export const BOT_NAMES = ['Bot Basia', 'Bot Zenek', 'Bot Halina'] as const;
export const BOT_AVATARS = ['🤖', '🦾', '👾'] as const;

export type Failure = { ok: false; code: ErrorCode; message: string };
export type LobbyResult = { ok: true; meta: RoomMeta } | Failure;
export type ClaimResult = { ok: true; meta: RoomMeta; tookBack: boolean } | Failure;

export interface SeatClaim {
  id: PlayerId;
  name: string;
  avatar: string;
  coach: boolean;
  secretHash: string;
}

const fail = (code: ErrorCode, message: string): Failure => ({ ok: false, code, message });
const done = (meta: RoomMeta): LobbyResult => ({ ok: true, meta });
const copy = (meta: RoomMeta): RoomMeta => structuredClone(meta);

function humanSeat(id: PlayerId, name: string, avatar: string, secretHash: string | null, coach: boolean): SeatMeta {
  return { id, name, avatar, isBot: false, secretHash, awaySince: null, botFor: false, coach };
}

const inLobby = (meta: RoomMeta): Failure | null =>
  meta.status === 'lobby' ? null : fail('gameInProgress', 'The game has already started');
const hostOnly = (meta: RoomMeta, by: PlayerId, what: string): Failure | null =>
  by === meta.hostId ? null : fail('notHost', `Only the host can ${what}`);
const seated = (meta: RoomMeta, by: PlayerId): Failure | null =>
  seatOf(meta, by) ? null : fail('notInRoom', 'You are not seated in this room');
const validSeat = (meta: RoomMeta, i: number): boolean => Number.isInteger(i) && i >= 0 && i < meta.maxPlayers;

export function createMeta(req: InitRoomRequest): RoomMeta {
  const seats: (SeatMeta | null)[] = Array.from({ length: req.maxPlayers }, () => null);
  seats[0] = humanSeat(req.hostId, req.name, req.avatar, null, false);
  return {
    code: req.code, maxPlayers: req.maxPlayers, hostId: req.hostId, status: 'lobby', createdAt: req.now,
    seats, firstDealer: 0, gameId: null, startedAt: null,
  };
}

export function seatOf(meta: RoomMeta, id: PlayerId): SeatMeta | null {
  return meta.seats.find((s) => s?.id === id) ?? null;
}

export function isBotControlled(meta: RoomMeta, id: PlayerId): boolean {
  const seat = seatOf(meta, id);
  return seat !== null && (seat.isBot || seat.botFor);
}

/** hello: reclaim your seat (secret must match; first hello on the host seat sets it) or take a free one. */
export function claimSeat(meta: RoomMeta, claim: SeatClaim): ClaimResult {
  const next = copy(meta);
  const seat = seatOf(next, claim.id);
  if (seat) {
    if (seat.isBot) return fail('badSecret', 'That seat belongs to a bot');
    if (seat.secretHash !== null && !safeEqual(seat.secretHash, claim.secretHash)) {
      return fail('badSecret', 'This player is already signed in on another device');
    }
    seat.secretHash = claim.secretHash;
    if (next.status === 'lobby') {
      seat.name = claim.name;
      seat.avatar = claim.avatar;
    }
    seat.coach = claim.coach;
    const tookBack = seat.botFor;
    seat.awaySince = null;
    seat.botFor = false;
    return { ok: true, meta: next, tookBack };
  }
  if (next.status !== 'lobby') return fail('gameInProgress', 'This game has already started');
  const free = next.seats.indexOf(null);
  if (free < 0) return fail('roomFull', 'This room is full');
  next.seats[free] = humanSeat(claim.id, claim.name, claim.avatar, claim.secretHash, claim.coach);
  return { ok: true, meta: next, tookBack: false };
}

export function addBot(meta: RoomMeta, by: PlayerId, botId: PlayerId): LobbyResult {
  const err = inLobby(meta) ?? hostOnly(meta, by, 'add bots');
  if (err) return err;
  const next = copy(meta);
  const free = next.seats.indexOf(null);
  if (free < 0) return fail('roomFull', 'There is no empty seat');
  const used = new Set(next.seats.map((s) => s?.name));
  const i = Math.max(0, BOT_NAMES.findIndex((name) => !used.has(name)));
  next.seats[free] = {
    id: botId, name: BOT_NAMES[i], avatar: BOT_AVATARS[i], isBot: true,
    secretHash: null, awaySince: null, botFor: false, coach: false,
  };
  return done(next);
}

export function removeBot(meta: RoomMeta, by: PlayerId, playerId: PlayerId): LobbyResult {
  const err = inLobby(meta) ?? hostOnly(meta, by, 'remove bots');
  if (err) return err;
  const next = copy(meta);
  const i = next.seats.findIndex((s) => s?.id === playerId && s.isBot);
  if (i < 0) return fail('badMessage', 'No such bot');
  next.seats[i] = null;
  return done(next);
}

export function swapSeats(meta: RoomMeta, by: PlayerId, a: number, b: number): LobbyResult {
  const err = inLobby(meta) ?? seated(meta, by);
  if (err) return err;
  if (!validSeat(meta, a) || !validSeat(meta, b) || a === b) return fail('badMessage', 'Invalid seats');
  const next = copy(meta);
  [next.seats[a], next.seats[b]] = [next.seats[b], next.seats[a]];
  return done(next);
}

export function setFirstDealer(meta: RoomMeta, by: PlayerId, seat: number): LobbyResult {
  const err = inLobby(meta) ?? hostOnly(meta, by, 'choose the first dealer');
  if (err) return err;
  if (!validSeat(meta, seat)) return fail('badMessage', 'Invalid seat');
  return done({ ...copy(meta), firstDealer: seat });
}

export function setCoach(meta: RoomMeta, by: PlayerId, coach: boolean): LobbyResult {
  const err = seated(meta, by);
  if (err) return err;
  const next = copy(meta);
  seatOf(next, by)!.coach = coach;
  return done(next);
}

export function leaveSeat(meta: RoomMeta, by: PlayerId): LobbyResult {
  const err = inLobby(meta) ?? seated(meta, by);
  if (err) return err;
  const next = copy(meta);
  next.seats = next.seats.map((s) => (s?.id === by ? null : s));
  if (next.hostId === by) {
    const heir = next.seats.find((s) => s !== null && !s.isBot);
    if (heir) next.hostId = heir.id;
  }
  return done(next);
}

function beginGame(meta: RoomMeta, gameId: string, now: number, connected: ReadonlySet<PlayerId>): RoomMeta {
  const next = copy(meta);
  next.status = 'playing';
  next.gameId = gameId;
  next.startedAt = now;
  for (const seat of next.seats) {
    if (seat && !seat.isBot && !connected.has(seat.id)) seat.awaySince = seat.awaySince ?? now;
  }
  return next;
}

export function start(meta: RoomMeta, by: PlayerId, gameId: string, now: number, connected: ReadonlySet<PlayerId>): LobbyResult {
  const err = inLobby(meta) ?? hostOnly(meta, by, 'start the game');
  if (err) return err;
  if (meta.seats.some((s) => s === null)) return fail('badMessage', 'Fill every seat before starting');
  return done(beginGame(meta, gameId, now, connected));
}

export function rematch(meta: RoomMeta, by: PlayerId, gameId: string, now: number, connected: ReadonlySet<PlayerId>): LobbyResult {
  if (meta.status !== 'finished') return fail('badMessage', 'The game is not finished yet');
  const err = hostOnly(meta, by, 'start a rematch');
  if (err) return err;
  const next = beginGame(meta, gameId, now, connected);
  next.firstDealer = (meta.firstDealer + 1) % meta.maxPlayers;
  return done(next);
}

/** Last socket of a human closed. Only meaningful during a game; returns `meta` itself when unchanged. */
export function markAway(meta: RoomMeta, id: PlayerId, now: number): RoomMeta {
  const seat = seatOf(meta, id);
  if (meta.status !== 'playing' || !seat || seat.isBot || seat.awaySince !== null) return meta;
  const next = copy(meta);
  seatOf(next, id)!.awaySince = now;
  return next;
}

export function setBotFor(meta: RoomMeta, by: PlayerId, target: PlayerId, now: number): LobbyResult {
  if (meta.status !== 'playing') return fail('badMessage', 'No game in progress');
  const err = seated(meta, by);
  if (err) return err;
  const seat = seatOf(meta, target);
  if (!seat || seat.isBot) return fail('badMessage', 'No such player');
  if (seat.botFor) return done(meta);
  if (!canTakeOver(seat.awaySince, now)) {
    return fail('badMessage', 'A bot can take over 30 s after a player disconnects');
  }
  const next = copy(meta);
  seatOf(next, target)!.botFor = true;
  return done(next);
}

/** Engine seats in clockwise order. Throws if a seat is empty (callers check `start` first). */
export function engineSeats(meta: RoomMeta): Seat[] {
  const seats = meta.seats.map((s, i) => {
    if (!s) throw new Error(`Seat ${i} is empty`);
    return { id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot };
  });
  return withBotFlags(seats, meta);
}

/** Mirrors SeatMeta.botFor into engine seats as `botFor: 'bot'` (contract); removes it elsewhere. */
export function withBotFlags(seats: readonly Seat[], meta: RoomMeta): Seat[] {
  return seats.map((s) => {
    const seat: Seat = { id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot };
    if (seatOf(meta, s.id)?.botFor) seat.botFor = 'bot';
    return seat;
  });
}

export function publicSeat(s: SeatMeta): PublicSeatMeta {
  return { id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot, awaySince: s.awaySince, botFor: s.botFor, coach: s.coach };
}

export function toRoomInfo(meta: RoomMeta, connected: ReadonlySet<PlayerId>): RoomInfo {
  return {
    code: meta.code,
    status: meta.status,
    maxPlayers: meta.maxPlayers,
    hostId: meta.hostId,
    firstDealer: meta.firstDealer,
    seats: meta.seats.map((s) =>
      s && {
        id: s.id, name: s.name, avatar: s.avatar, isBot: s.isBot,
        connected: s.isBot || connected.has(s.id),
        awaySince: s.awaySince, botFor: s.botFor, coach: s.coach,
      }),
  };
}
