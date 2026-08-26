ALTER TABLE draft_sessions ADD COLUMN IF NOT EXISTS expires_at timestamp;
UPDATE draft_sessions SET expires_at = COALESCE(expires_at, updated_at + interval '24 hours');
ALTER TABLE draft_sessions ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS draft_sessions_expires_idx ON draft_sessions(expires_at);

ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS expires_at timestamp;
UPDATE pvp_rooms SET expires_at = COALESCE(expires_at,
  CASE WHEN state = 'playing' THEN updated_at + interval '6 hours'
       WHEN state = 'finished' THEN updated_at + interval '24 hours'
       ELSE updated_at + interval '30 minutes' END);
ALTER TABLE pvp_rooms ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS pvp_rooms_expires_idx ON pvp_rooms(expires_at);

ALTER TABLE pack_openings ADD COLUMN IF NOT EXISTS pack_seed integer;
ALTER TABLE pack_openings ADD COLUMN IF NOT EXISTS content_version text NOT NULL DEFAULT '2026.08.24';
CREATE INDEX IF NOT EXISTS pack_openings_player_seed_idx ON pack_openings(player_id, pack_seed);

ALTER TABLE replays ADD COLUMN IF NOT EXISTS content_version text NOT NULL DEFAULT '2026.08.24';
CREATE INDEX IF NOT EXISTS replays_versions_idx ON replays(engine_version, ruleset_version, content_version);
