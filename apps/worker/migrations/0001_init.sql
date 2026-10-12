-- History of finished games (spec §8). Written once per game by the Room DO; read by /api/history.
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  last_seen INTEGER NOT NULL
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  player_count INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  winner_id TEXT NOT NULL,
  rounds_json TEXT NOT NULL
);

CREATE TABLE game_players (
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  seat INTEGER NOT NULL,
  is_bot INTEGER NOT NULL,
  final_score INTEGER NOT NULL,
  won INTEGER NOT NULL,
  PRIMARY KEY (game_id, player_id)
);

CREATE INDEX idx_game_players_player ON game_players (player_id);
CREATE INDEX idx_games_finished ON games (finished_at);
