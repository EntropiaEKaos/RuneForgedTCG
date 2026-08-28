CREATE TABLE IF NOT EXISTS "admin_game_definitions" (
  "id" serial PRIMARY KEY NOT NULL,
  "domain" text NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "danger_level" text DEFAULT 'safe' NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "admin_game_definitions_domain_key_unique" UNIQUE("domain", "key"),
  CONSTRAINT "admin_game_definitions_revision_positive" CHECK ("revision" > 0),
  CONSTRAINT "admin_game_definitions_status_valid" CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT "admin_game_definitions_danger_valid" CHECK ("danger_level" IN ('safe','elevated','critical'))
);
CREATE INDEX IF NOT EXISTS "admin_game_definitions_domain_status_idx"
  ON "admin_game_definitions" ("domain", "status", "enabled");

ALTER TABLE "player_cards" DROP CONSTRAINT IF EXISTS "player_cards_count_bounds";
ALTER TABLE "player_cards" ADD CONSTRAINT "player_cards_count_bounds" CHECK ("count" >= 1);
