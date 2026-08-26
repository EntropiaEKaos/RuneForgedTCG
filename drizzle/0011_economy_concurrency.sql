-- Harden daily uniqueness and persist draft sessions.
-- Remove legacy duplicate quest rows before adding the unique constraint.
DELETE FROM player_dailies a
USING player_dailies b
WHERE a.player_id = b.player_id
  AND a.quest_id = b.quest_id
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS "player_dailies_player_quest_unique"
  ON "player_dailies" ("player_id", "quest_id");

CREATE TABLE IF NOT EXISTS "draft_sessions" (
  "id" serial PRIMARY KEY,
  "player_id" integer NOT NULL UNIQUE,
  "player_name" text NOT NULL,
  "deck" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "current_pool" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "step" integer NOT NULL DEFAULT 0,
  "regions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "created_at" timestamp NOT NULL DEFAULT now()
);
