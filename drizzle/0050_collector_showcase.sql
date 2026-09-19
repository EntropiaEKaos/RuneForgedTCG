CREATE TABLE IF NOT EXISTS "player_collection_showcases" (
  "player_id" integer PRIMARY KEY REFERENCES "players"("id") ON DELETE CASCADE,
  "asset_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "visibility" text NOT NULL DEFAULT 'friends',
  "tagline" text NOT NULL DEFAULT '',
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "player_collection_showcases_visibility_valid" CHECK ("visibility" IN ('public','friends','private')),
  CONSTRAINT "player_collection_showcases_tagline_bounds" CHECK (char_length("tagline") <= 120)
);
INSERT INTO "runeforge_schema_meta" ("version") VALUES ('2.97-collector-showcase') ON CONFLICT ("version") DO NOTHING;
