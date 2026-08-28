ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "host_deck_snapshot" jsonb;
ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "guest_deck_snapshot" jsonb;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "match_mode" text NOT NULL DEFAULT 'casual';
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "opponent_player_id" integer;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "perspective" text NOT NULL DEFAULT 'player';
CREATE INDEX IF NOT EXISTS "replays_match_mode_idx" ON "replays" ("match_mode", "created_at");
CREATE INDEX IF NOT EXISTS "matches_opponent_idx" ON "matches" ("opponent_player_id");
