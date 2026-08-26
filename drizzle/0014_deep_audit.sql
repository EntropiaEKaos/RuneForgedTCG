ALTER TABLE "mode_attempts" ADD COLUMN IF NOT EXISTS "player_deck_id" text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "mode_attempts_player_deck_lookup" ON "mode_attempts" ("player_id", "mode_type", "mode_id", "player_deck_id", "used_at");
