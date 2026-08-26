-- Runeforge Competitive Core: stable player identity, match snapshots and integrity.
CREATE TABLE IF NOT EXISTS player_sessions (
  id serial PRIMARY KEY,
  session_id text NOT NULL UNIQUE,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_player_sessions_player ON player_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_active ON player_sessions(session_id, revoked_at, expires_at);

ALTER TABLE custom_decks ADD COLUMN IF NOT EXISTS owner_player_id integer;
ALTER TABLE match_tokens ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE match_tokens ADD COLUMN IF NOT EXISTS deck_snapshot jsonb;
ALTER TABLE match_tokens ADD COLUMN IF NOT EXISTS opponent_snapshot jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS opponent_player_id integer;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS event_log jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS action_hash text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS state_hash text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS integrity_hash text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS deck_snapshot jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS player_id integer;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS event_log jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS ruleset_version text NOT NULL DEFAULT '2026.08';
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS host_player_id integer;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS guest_player_id integer;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS event_log jsonb;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS action_hash text;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS integrity_hash text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS player_id integer;

UPDATE custom_decks d SET owner_player_id = p.id FROM players p WHERE d.owner_player_id IS NULL AND p.name = d.owner_name;
UPDATE match_tokens t SET player_id = p.id FROM players p WHERE t.player_id IS NULL AND p.name = t.player_name;
UPDATE matches m SET player_id = p.id FROM players p WHERE m.player_id IS NULL AND p.name = m.player_name;
UPDATE replays r SET player_id = p.id FROM players p WHERE r.player_id IS NULL AND p.name = r.player_name;
UPDATE pvp_rooms r SET host_player_id = p.id FROM players p WHERE r.host_player_id IS NULL AND p.name = r.host_name;
UPDATE pvp_rooms r SET guest_player_id = p.id FROM players p WHERE r.guest_player_id IS NULL AND p.name = r.guest_name;
UPDATE chat_messages c SET player_id = p.id FROM players p WHERE c.player_id IS NULL AND p.name = c.player_name;

CREATE INDEX IF NOT EXISTS idx_custom_decks_owner_player ON custom_decks(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_created ON matches(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replays_player_created ON replays(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_tokens_player ON match_tokens(player_id);
CREATE INDEX IF NOT EXISTS idx_pvp_host_player ON pvp_rooms(host_player_id);
CREATE INDEX IF NOT EXISTS idx_pvp_guest_player ON pvp_rooms(guest_player_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_created ON chat_messages(room_code, created_at DESC);

ALTER TABLE custom_decks ADD CONSTRAINT fk_custom_decks_owner_player FOREIGN KEY (owner_player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE match_tokens ADD CONSTRAINT fk_match_tokens_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE matches ADD CONSTRAINT fk_matches_opponent_player FOREIGN KEY (opponent_player_id) REFERENCES players(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE matches ADD CONSTRAINT fk_matches_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE replays ADD CONSTRAINT fk_replays_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE pvp_rooms ADD CONSTRAINT fk_pvp_host_player FOREIGN KEY (host_player_id) REFERENCES players(id) ON DELETE CASCADE;
ALTER TABLE pvp_rooms ADD CONSTRAINT fk_pvp_guest_player FOREIGN KEY (guest_player_id) REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS shared_deck_votes (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deck_id integer NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(player_id, deck_id)
);
CREATE INDEX IF NOT EXISTS idx_shared_deck_votes_deck ON shared_deck_votes(deck_id);

-- Referential integrity for player-owned data. NOT VALID preserves legacy rows while enforcing all new writes.
ALTER TABLE economy_transactions ADD CONSTRAINT fk_economy_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE player_cards ADD CONSTRAINT fk_player_cards_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE shared_decks ADD CONSTRAINT fk_shared_decks_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE mode_rewards ADD CONSTRAINT fk_mode_rewards_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE player_achievements ADD CONSTRAINT fk_achievements_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE player_dailies ADD CONSTRAINT fk_dailies_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE friendships ADD CONSTRAINT fk_friendships_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE friendships ADD CONSTRAINT fk_friendships_friend FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE ranked_matches ADD CONSTRAINT fk_ranked_matches_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE matchmaking_queue ADD CONSTRAINT fk_matchmaking_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE player_packs ADD CONSTRAINT fk_player_packs_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE pack_openings ADD CONSTRAINT fk_pack_openings_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE NOT VALID;
