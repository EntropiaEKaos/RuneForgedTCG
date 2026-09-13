CREATE TABLE IF NOT EXISTS "card_cosmetic_variants" (
  "id" serial PRIMARY KEY NOT NULL,
  "def_id" text NOT NULL,
  "variant_id" text NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "frame_id" text DEFAULT 'default' NOT NULL,
  "finish" text DEFAULT 'normal' NOT NULL,
  "art_url" text,
  "animation_url" text,
  "art_crop" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "edition" text,
  "serial_limit" integer,
  "acquisition" text DEFAULT 'pack' NOT NULL,
  "pack_eligible" boolean DEFAULT false NOT NULL,
  "drop_weight" integer DEFAULT 0 NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "card_cosmetic_variants_kind_valid" CHECK ("kind" IN ('premium_frame','full_art','foil','animated','serialized')),
  CONSTRAINT "card_cosmetic_variants_acquisition_valid" CHECK ("acquisition" IN ('pack','event','promotion','market','grant')),
  CONSTRAINT "card_cosmetic_variants_status_valid" CHECK ("status" IN ('draft','published','archived')),
  CONSTRAINT "card_cosmetic_variants_identity_bounds" CHECK (char_length("variant_id") BETWEEN 1 AND 80 AND char_length("frame_id") BETWEEN 1 AND 80 AND char_length("finish") BETWEEN 1 AND 40 AND char_length("name") BETWEEN 1 AND 120),
  CONSTRAINT "card_cosmetic_variants_drop_weight_valid" CHECK ("drop_weight" BETWEEN 0 AND 1000000),
  CONSTRAINT "card_cosmetic_variants_serial_limit_valid" CHECK ("serial_limit" IS NULL OR "serial_limit" > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "card_cosmetic_variants_identity_uidx" ON "card_cosmetic_variants" USING btree ("def_id","variant_id");
CREATE INDEX IF NOT EXISTS "card_cosmetic_variants_published_idx" ON "card_cosmetic_variants" USING btree ("def_id","status","enabled");
CREATE INDEX IF NOT EXISTS "card_cosmetic_variants_pack_idx" ON "card_cosmetic_variants" USING btree ("pack_eligible","status","enabled","drop_weight");

ALTER TABLE "card_assets" ADD COLUMN IF NOT EXISTS "serial_number" integer;
DO $$ BEGIN
  ALTER TABLE "card_assets" ADD CONSTRAINT "card_assets_serial_number_valid" CHECK ("serial_number" IS NULL OR "serial_number" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "card_assets_serial_uidx" ON "card_assets" USING btree ("def_id","variant_id","serial_number") WHERE "serial_number" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "player_card_cosmetic_preferences" (
  "id" serial PRIMARY KEY NOT NULL,
  "player_id" integer NOT NULL,
  "def_id" text NOT NULL,
  "asset_id" integer NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
DO $$ BEGIN
  ALTER TABLE "player_card_cosmetic_preferences" ADD CONSTRAINT "player_card_cosmetic_preferences_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "player_card_cosmetic_preferences" ADD CONSTRAINT "player_card_cosmetic_preferences_asset_id_card_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "card_assets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "player_card_cosmetic_preferences_player_def_uidx" ON "player_card_cosmetic_preferences" USING btree ("player_id","def_id");
CREATE INDEX IF NOT EXISTS "player_card_cosmetic_preferences_asset_idx" ON "player_card_cosmetic_preferences" USING btree ("asset_id");
