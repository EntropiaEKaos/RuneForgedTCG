-- Audit 2.15: ownership and authorization hardening.
-- Player sessions must not outlive their player record.
ALTER TABLE player_sessions
  ADD CONSTRAINT fk_player_sessions_player
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS player_sessions_active_player_idx
  ON player_sessions(player_id, expires_at)
  WHERE revoked_at IS NULL;
