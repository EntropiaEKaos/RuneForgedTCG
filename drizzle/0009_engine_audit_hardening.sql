ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "match_mode" text NOT NULL DEFAULT 'casual';
ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'casual';
CREATE INDEX IF NOT EXISTS "matches_player_mode_idx" ON "matches" ("player_id", "match_mode");
CREATE INDEX IF NOT EXISTS "match_tokens_player_mode_idx" ON "match_tokens" ("player_id", "mode");

ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'casual';
ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "settled_at" timestamp;
CREATE INDEX IF NOT EXISTS "pvp_rooms_mode_state_idx" ON "pvp_rooms" ("mode", "state");

ALTER TABLE "admin_approval_requests" ADD COLUMN IF NOT EXISTS "content_hash" text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS "admin_approval_resource_stage_hash_idx" ON "admin_approval_requests" ("resource", "resource_id", "stage", "content_hash", "status");
