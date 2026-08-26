-- Runeforge hardening migration.
-- Review existing orphan rows before VALIDATE CONSTRAINT on an existing database.

ALTER TABLE ranked_matches ADD COLUMN IF NOT EXISTS match_id integer;
CREATE UNIQUE INDEX IF NOT EXISTS ranked_matches_player_match_uidx
  ON ranked_matches (player_id, match_id)
  WHERE match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS matches_player_created_idx
  ON matches (player_name, created_at DESC);
CREATE INDEX IF NOT EXISTS match_tokens_expires_idx
  ON match_tokens (expires_at);
CREATE INDEX IF NOT EXISTS matchmaking_mode_mmr_created_idx
  ON matchmaking_queue (mode, mmr, created_at DESC);
CREATE INDEX IF NOT EXISTS pvp_rooms_state_created_idx
  ON pvp_rooms (state, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages (room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS ranked_matches_player_created_idx
  ON ranked_matches (player_id, created_at DESC);

-- Safe relational constraints for newly consistent installations.
-- These are intentionally not NOT VALID/VALIDATE statements so a legacy database
-- can be audited before enabling them.
-- Suggested constraints after orphan cleanup:
-- ALTER TABLE player_cards ADD CONSTRAINT player_cards_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE shared_decks ADD CONSTRAINT shared_decks_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE player_achievements ADD CONSTRAINT player_achievements_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE player_dailies ADD CONSTRAINT player_dailies_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE friendships ADD CONSTRAINT friendships_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE friendships ADD CONSTRAINT friendships_friend_fk FOREIGN KEY (friend_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE matchmaking_queue ADD CONSTRAINT matchmaking_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE player_packs ADD CONSTRAINT player_packs_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
-- ALTER TABLE pack_openings ADD CONSTRAINT pack_openings_player_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
