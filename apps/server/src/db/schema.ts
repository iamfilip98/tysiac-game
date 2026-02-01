import { pgTable, text, timestamp, boolean, integer, jsonb, primaryKey } from 'drizzle-orm/pg-core';

// Players table - stores registered/guest players
export const players = pgTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
});

// Rooms table - game lobbies
export const rooms = pgTable('rooms', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(), // 6-char join code
  name: text('name').notNull(),
  hostId: text('host_id').references(() => players.id).notNull(),
  isPrivate: boolean('is_private').default(false).notNull(),
  gameId: text('game_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Room players - players currently in a room
export const roomPlayers = pgTable('room_players', {
  roomId: text('room_id').references(() => rooms.id, { onDelete: 'cascade' }).notNull(),
  playerId: text('player_id').references(() => players.id).notNull(),
  isReady: boolean('is_ready').default(false).notNull(),
  isHost: boolean('is_host').default(false).notNull(),
  isAI: boolean('is_ai').default(false).notNull(),
  seatIndex: integer('seat_index').notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roomId, table.playerId] }),
}));

// Games table - active/completed games
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  roomId: text('room_id').references(() => rooms.id).notNull(),
  state: jsonb('state').notNull(), // Full game state as JSON
  phase: text('phase').notNull(),
  winnerId: text('winner_id').references(() => players.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
});

// Game scores - final scores per player per game
export const gameScores = pgTable('game_scores', {
  gameId: text('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  playerId: text('player_id').references(() => players.id).notNull(),
  finalScore: integer('final_score').notNull(),
  roundScores: jsonb('round_scores').notNull(), // Array of round scores
  isWinner: boolean('is_winner').default(false).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.gameId, table.playerId] }),
}));

// Rounds table - individual round data for history
export const rounds = pgTable('rounds', {
  id: text('id').primaryKey(),
  gameId: text('game_id').references(() => games.id, { onDelete: 'cascade' }).notNull(),
  roundNumber: integer('round_number').notNull(),
  dealerId: text('dealer_id').references(() => players.id).notNull(),
  bidWinnerId: text('bid_winner_id').references(() => players.id).notNull(),
  finalBid: integer('final_bid').notNull(),
  trumpSuit: text('trump_suit'),
  roundData: jsonb('round_data').notNull(), // Full round result
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sessions table - stores player sessions for reconnection
export const sessions = pgTable('sessions', {
  token: text('token').primaryKey(),
  playerId: text('player_id').unique().notNull(),
  roomId: text('room_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActivity: timestamp('last_activity').defaultNow().notNull(),
});

// Debug logs table - tracks all game actions for last 10 games (internal debugging only)
export const debugLogs = pgTable('debug_logs', {
  id: text('id').primaryKey(),
  gameId: text('game_id').references(() => games.id, { onDelete: 'cascade' }),
  roomId: text('room_id'),
  sessionId: text('session_id'), // Groups logs for a game session even before gameId exists
  playerId: text('player_id'),
  socketId: text('socket_id'),
  eventType: text('event_type').notNull(), // e.g., 'room:create', 'game:bid', 'game:playCard'
  eventData: jsonb('event_data'), // Full event payload
  gameState: jsonb('game_state'), // Snapshot of relevant game state at time of action
  result: text('result'), // 'success', 'error', 'rejected'
  errorMessage: text('error_message'),
  metadata: jsonb('metadata'), // Additional context (e.g., validActions, playerHand)
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// Type exports for Drizzle
export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type RoomPlayer = typeof roomPlayers.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GameScore = typeof gameScores.$inferSelect;
export type Round = typeof rounds.$inferSelect;
export type DebugLog = typeof debugLogs.$inferSelect;
export type NewDebugLog = typeof debugLogs.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
