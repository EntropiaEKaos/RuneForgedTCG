-- Runeforge 2.27-2.29: operational integrity and idempotent PvP actions.

CREATE TABLE IF NOT EXISTS pvp_action_receipts (
  id serial PRIMARY KEY,
  room_id integer NOT NULL,
  player_id integer NOT NULL,
  action_id text NOT NULL,
  resulting_version integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT pvp_action_receipts_room_player_action_unique UNIQUE (room_id, player_id, action_id),
  CONSTRAINT pvp_action_receipts_action_id_length CHECK (char_length(action_id) BETWEEN 8 AND 80),
  CONSTRAINT fk_pvp_action_receipts_room FOREIGN KEY (room_id) REFERENCES pvp_rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_pvp_action_receipts_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

DO $$ BEGIN
  ALTER TABLE pvp_action_receipts ADD CONSTRAINT fk_pvp_action_receipts_room FOREIGN KEY (room_id) REFERENCES pvp_rooms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE pvp_action_receipts ADD CONSTRAINT fk_pvp_action_receipts_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS pvp_action_receipts_created_idx ON pvp_action_receipts(created_at);
CREATE INDEX IF NOT EXISTS pvp_rooms_active_expiry_idx ON pvp_rooms(state, expires_at) WHERE state IN ('waiting', 'playing');
CREATE INDEX IF NOT EXISTS matchmaking_queue_search_idx ON matchmaking_queue(mode, mmr, created_at DESC);
CREATE INDEX IF NOT EXISTS match_tokens_active_idx ON match_tokens(player_id, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS mode_attempts_active_idx ON mode_attempts(player_id, expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS admin_sessions_active_idx ON admin_sessions(actor_id, expires_at) WHERE revoked_at IS NULL;

DO $$ BEGIN
  ALTER TABLE pvp_rooms ADD CONSTRAINT pvp_rooms_state_valid CHECK (state IN ('waiting', 'playing', 'finished', 'expired')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE pvp_rooms ADD CONSTRAINT pvp_rooms_mode_valid CHECK (mode IN ('casual', 'ranked')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE matches ADD CONSTRAINT matches_mode_valid CHECK (match_mode IN ('casual', 'ranked', 'puzzle', 'boss', 'brawl', 'draft')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE economy_transactions ADD CONSTRAINT economy_currency_valid CHECK (currency IN ('gold', 'dust', 'xp')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
