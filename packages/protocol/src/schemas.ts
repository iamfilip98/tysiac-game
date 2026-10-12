import { z } from 'zod';
import type { ClientMessage, PROTOCOL_VERSION } from './index';

/** Largest accepted client message, in UTF-8 bytes (spec §6). */
export const MAX_MESSAGE_BYTES = 4096;

/** Must equal PROTOCOL_VERSION — the annotation makes tsc fail if they ever diverge. */
const VERSION: typeof PROTOCOL_VERSION = 2;

export const PlayerIdSchema = z.string().min(1).max(64);
const NameSchema = z.string().trim().min(1).max(24);
const AvatarSchema = z.string().min(1).max(16);
const SecretSchema = z.string().min(8).max(128);
const RequestIdSchema = z.string().min(1).max(64);
const SeatIndexSchema = z.int().min(0).max(3);

export const CardSchema = z.strictObject({
  suit: z.enum(['clubs', 'diamonds', 'hearts', 'spades']),
  rank: z.enum(['9', '10', 'J', 'Q', 'K', 'A']),
});

export const ActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('bid'), amount: z.int().min(100).max(400) }),
  z.strictObject({ type: z.literal('pass') }),
  z.strictObject({ type: z.literal('play') }),
  z.strictObject({ type: z.literal('throw') }),
  z.strictObject({
    type: z.literal('handout'),
    to: z.record(PlayerIdSchema, CardSchema).refine((to) => Object.keys(to).length <= 3, 'Too many recipients'),
  }),
  z.strictObject({ type: z.literal('card'), card: CardSchema }),
  z.strictObject({ type: z.literal('ackTalon') }),
  z.strictObject({ type: z.literal('pause') }),
  z.strictObject({ type: z.literal('resume') }),
]);

export const LobbyOpSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('addBot') }),
  z.strictObject({ op: z.literal('removeBot'), playerId: PlayerIdSchema }),
  z.strictObject({ op: z.literal('swapSeats'), a: SeatIndexSchema, b: SeatIndexSchema }),
  z.strictObject({ op: z.literal('setFirstDealer'), seat: SeatIndexSchema }),
  z.strictObject({ op: z.literal('start') }),
]);

export const ClientMessageSchema = z.discriminatedUnion('t', [
  z.strictObject({
    t: z.literal('hello'),
    v: z.literal(VERSION),
    playerId: PlayerIdSchema,
    secret: SecretSchema,
    name: NameSchema,
    avatar: AvatarSchema,
    coach: z.boolean(),
  }),
  z.strictObject({ t: z.literal('act'), id: RequestIdSchema, action: ActionSchema }),
  z.strictObject({ t: z.literal('lobby'), op: LobbyOpSchema }),
  z.strictObject({ t: z.literal('botFor'), playerId: PlayerIdSchema }),
  z.strictObject({ t: z.literal('setCoach'), coach: z.boolean() }),
  z.strictObject({ t: z.literal('rematch') }),
  z.strictObject({ t: z.literal('leave') }),
  z.strictObject({ t: z.literal('ping') }),
]);

export const CreateRoomRequestSchema = z.strictObject({
  maxPlayers: z.union([z.literal(3), z.literal(4)]),
  playerId: PlayerIdSchema,
  name: NameSchema,
  avatar: AvatarSchema,
});

export type ParseResult =
  | { ok: true; msg: ClientMessage }
  | { ok: false; code: 'badMessage' | 'versionMismatch'; message: string };

/** UTF-8 byte length without TextEncoder (keeps this package free of DOM/Node lib types). */
function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

const bad = (message: string): ParseResult => ({ ok: false, code: 'badMessage', message });

/** Validates one raw WebSocket text frame. Never throws. */
export function parseClientMessage(raw: string): ParseResult {
  if (typeof raw !== 'string') return bad('Messages must be text');
  // UTF-16 length ≤ UTF-8 length, so the cheap check first.
  if (raw.length > MAX_MESSAGE_BYTES || utf8Length(raw) > MAX_MESSAGE_BYTES) return bad('Message too large');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return bad('Message is not valid JSON');
  }
  if (typeof json === 'object' && json !== null && (json as { t?: unknown }).t === 'hello' && (json as { v?: unknown }).v !== VERSION) {
    return { ok: false, code: 'versionMismatch', message: `This server speaks protocol v${VERSION}` };
  }
  const result = ClientMessageSchema.safeParse(json);
  if (!result.success) return bad(z.prettifyError(result.error).slice(0, 300));
  return { ok: true, msg: result.data satisfies ClientMessage };
}
