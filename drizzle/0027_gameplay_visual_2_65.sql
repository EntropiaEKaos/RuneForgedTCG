ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "ai_difficulty" text DEFAULT 'tactician' NOT NULL;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "ai_difficulty" text DEFAULT 'tactician' NOT NULL;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "ai_difficulty" text DEFAULT 'tactician' NOT NULL;

ALTER TABLE "match_tokens" DROP CONSTRAINT IF EXISTS "match_tokens_ai_difficulty_check";
ALTER TABLE "match_tokens" ADD CONSTRAINT "match_tokens_ai_difficulty_check" CHECK ("ai_difficulty" IN ('apprentice','tactician','overlord'));
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_ai_difficulty_check";
ALTER TABLE "matches" ADD CONSTRAINT "matches_ai_difficulty_check" CHECK ("ai_difficulty" IN ('apprentice','tactician','overlord'));
ALTER TABLE "replays" DROP CONSTRAINT IF EXISTS "replays_ai_difficulty_check";
ALTER TABLE "replays" ADD CONSTRAINT "replays_ai_difficulty_check" CHECK ("ai_difficulty" IN ('apprentice','tactician','overlord'));

CREATE INDEX IF NOT EXISTS "matches_ai_difficulty_created_idx" ON "matches" USING btree ("ai_difficulty", "created_at" DESC);
