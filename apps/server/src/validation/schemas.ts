import { z } from 'zod';

// Card validation
export const CardSchema = z.object({
  suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
  rank: z.enum(['9', '10', 'J', 'Q', 'K', 'A']),
});

export const SuitSchema = z.enum(['hearts', 'diamonds', 'clubs', 'spades']);

// Room events
export const CreateRoomSchema = z.object({
  playerName: z.string().min(1).max(20).trim(),
  roomName: z.string().min(1).max(30).trim(),
  isPrivate: z.boolean(),
  maxPlayers: z.union([z.literal(3), z.literal(4)]).optional().default(3),
});

export const JoinRoomSchema = z.object({
  playerName: z.string().min(1).max(20).trim(),
  roomCode: z.string().length(6).toUpperCase(),
});

// Game events
export const BidAmountSchema = z.number().int().min(100).max(360).multipleOf(10);

export const TalonDistributionSchema = z.array(
  z.object({
    playerId: z.string().min(1),
    card: CardSchema,
  })
).length(2);

export const ReconnectSchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  sessionToken: z.string().min(1),
});

// Type exports
export type Card = z.infer<typeof CardSchema>;
export type Suit = z.infer<typeof SuitSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type TalonDistribution = z.infer<typeof TalonDistributionSchema>;
