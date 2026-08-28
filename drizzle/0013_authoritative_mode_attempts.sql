CREATE TABLE IF NOT EXISTS "mode_attempts" (
  "id" serial PRIMARY KEY,
  "token" text NOT NULL UNIQUE,
  "player_id" integer NOT NULL,
  "player_name" text NOT NULL,
  "mode_type" text NOT NULL,
  "mode_id" text NOT NULL,
  "seed" integer NOT NULL,
  "player_first" boolean NOT NULL,
  "player_deck_snapshot" jsonb NOT NULL,
  "opponent_deck_snapshot" jsonb NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "mode_attempts_player_lookup" ON "mode_attempts" ("player_id", "mode_type", "mode_id", "used_at");
CREATE INDEX IF NOT EXISTS "mode_attempts_expiry" ON "mode_attempts" ("expires_at");
