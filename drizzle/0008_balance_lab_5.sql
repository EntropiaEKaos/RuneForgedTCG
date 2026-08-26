CREATE TABLE IF NOT EXISTS "admin_balance_experiments" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "mode" text DEFAULT 'matrix' NOT NULL,
  "games_per_matchup" integer NOT NULL,
  "seed" integer NOT NULL,
  "deck_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "total_games" integer DEFAULT 0 NOT NULL,
  "completed_games" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "engine_version" text NOT NULL,
  "ruleset_version" text NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
);
CREATE INDEX IF NOT EXISTS "balance_experiment_created_idx" ON "admin_balance_experiments" ("created_at");
CREATE INDEX IF NOT EXISTS "balance_experiment_status_idx" ON "admin_balance_experiments" ("status");

CREATE TABLE IF NOT EXISTS "admin_balance_matchups" (
  "id" serial PRIMARY KEY NOT NULL,
  "experiment_id" integer NOT NULL,
  "deck_a" text NOT NULL,
  "deck_b" text NOT NULL,
  "requested_games" integer NOT NULL,
  "completed_games" integer DEFAULT 0 NOT NULL,
  "wins_a" integer DEFAULT 0 NOT NULL,
  "wins_b" integer DEFAULT 0 NOT NULL,
  "draws" integer DEFAULT 0 NOT NULL,
  "avg_rounds" integer DEFAULT 0 NOT NULL,
  "win_rate_a" integer DEFAULT 0 NOT NULL,
  "win_rate_b" integer DEFAULT 0 NOT NULL,
  "seed" integer NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "balance_matchup_experiment_idx" ON "admin_balance_matchups" ("experiment_id");
CREATE INDEX IF NOT EXISTS "balance_matchup_decks_idx" ON "admin_balance_matchups" ("deck_a", "deck_b");
