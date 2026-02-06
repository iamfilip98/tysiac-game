import { z } from 'zod';

// Card validation
export const CardSchema = z.object({
  suit: z.enum(['hearts', 'diamonds', 'clubs', 'spades']),
  rank: z.enum(['9', '10', 'J', 'Q', 'K', 'A']),
});

export const SuitSchema = z.enum(['hearts', 'diamonds', 'clubs', 'spades']);

// Player name: alphanumeric, Polish characters, spaces, hyphens, underscores
const playerNameSchema = z.string()
  .min(1)
  .max(20)
  .trim()
  .regex(
    /^[a-zA-Z0-9\s\-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+$/,
    'Name can only contain letters, numbers, spaces, hyphens, and underscores'
  );

// Room events
export const CreateRoomSchema = z.object({
  playerName: playerNameSchema,
  roomName: z.string().min(1).max(30).trim().regex(
    /^[a-zA-Z0-9\s\-_ąćęłńóśźżĄĆĘŁŃÓŚŹŻ!?.]+$/,
    'Room name contains invalid characters'
  ),
  isPrivate: z.boolean(),
  maxPlayers: z.union([z.literal(3), z.literal(4)]).optional().default(3),
});

export const JoinRoomSchema = z.object({
  playerName: playerNameSchema,
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

export const EmoteSchema = z.object({
  emoteType: z.enum([
    'nice-bid', 'oops', 'good-game', 'hurry-up', 'wow', 'sorry',
    '👍', '😂', '😮', '😢', '🔥', '💀', '🎉', '😤',
  ]),
});

// Type exports
export type Card = z.infer<typeof CardSchema>;
export type Suit = z.infer<typeof SuitSchema>;
export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type JoinRoomInput = z.infer<typeof JoinRoomSchema>;
export type TalonDistribution = z.infer<typeof TalonDistributionSchema>;
