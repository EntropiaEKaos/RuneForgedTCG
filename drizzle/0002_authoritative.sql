ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "seed" integer;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "player_first" boolean;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "ai_deck_id" text;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "ai_deck_name" text;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "action_log" jsonb;
ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "seed" integer;
ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "player_first" boolean;
ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "ai_deck_id" text;
ALTER TABLE "match_tokens" ADD COLUMN IF NOT EXISTS "ai_deck_name" text;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "action_log" jsonb;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "engine_version" text NOT NULL DEFAULT '1';

ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "deck_id" text;
ALTER TABLE "replays" ADD COLUMN IF NOT EXISTS "ai_deck_id" text;

ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "seed" integer;
ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "player_first" boolean;
ALTER TABLE "pvp_rooms" ADD COLUMN IF NOT EXISTS "action_log" jsonb;

CREATE TABLE IF NOT EXISTS "economy_transactions" ("id" serial PRIMARY KEY, "player_id" integer NOT NULL, "currency" text NOT NULL, "amount" integer NOT NULL, "reason" text NOT NULL, "reference_type" text, "reference_id" text, "balance_after" integer NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL);
CREATE INDEX IF NOT EXISTS economy_transactions_player_created_idx ON economy_transactions (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS "mode_rewards" ("id" serial PRIMARY KEY, "player_id" integer NOT NULL, "mode_type" text NOT NULL, "mode_id" text NOT NULL, "claimed_at" timestamp DEFAULT now() NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS mode_rewards_player_mode_uidx ON mode_rewards (player_id, mode_type, mode_id);
