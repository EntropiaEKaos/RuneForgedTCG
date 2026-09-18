-- FORGED Collectibles Runtime + isolated Four Player General foundations.
-- This migration is intentionally additive and must not alter certified 1v1 PvP tables.

CREATE TABLE IF NOT EXISTS "deck_card_printing_preferences" (
  "id" serial PRIMARY KEY,
  "deck_id" integer NOT NULL REFERENCES "custom_decks"("id") ON DELETE CASCADE,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "def_id" text NOT NULL,
  "asset_id" integer NOT NULL REFERENCES "card_assets"("id") ON DELETE CASCADE,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "deck_card_printing_preferences_def_bounds" CHECK (char_length("def_id") BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX IF NOT EXISTS "deck_card_printing_preferences_deck_def_uidx" ON "deck_card_printing_preferences" ("deck_id","def_id");
CREATE INDEX IF NOT EXISTS "deck_card_printing_preferences_player_deck_idx" ON "deck_card_printing_preferences" ("player_id","deck_id");
CREATE INDEX IF NOT EXISTS "deck_card_printing_preferences_asset_idx" ON "deck_card_printing_preferences" ("asset_id");

CREATE TABLE IF NOT EXISTS "collectible_campaign_claims" (
  "id" serial PRIMARY KEY,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "campaign_type" text NOT NULL,
  "campaign_key" text NOT NULL,
  "def_id" text NOT NULL,
  "variant_id" text NOT NULL,
  "asset_id" integer REFERENCES "card_assets"("id") ON DELETE SET NULL,
  "claimed_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "collectible_campaign_claims_type_valid" CHECK ("campaign_type" IN ('event','promotion')),
  CONSTRAINT "collectible_campaign_claims_key_bounds" CHECK (char_length("campaign_key") BETWEEN 1 AND 120 AND char_length("def_id") BETWEEN 1 AND 120 AND char_length("variant_id") BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX IF NOT EXISTS "collectible_campaign_claims_identity_uidx" ON "collectible_campaign_claims" ("player_id","campaign_type","campaign_key","def_id","variant_id");
CREATE INDEX IF NOT EXISTS "collectible_campaign_claims_player_idx" ON "collectible_campaign_claims" ("player_id","claimed_at");
CREATE INDEX IF NOT EXISTS "collectible_campaign_claims_campaign_idx" ON "collectible_campaign_claims" ("campaign_type","campaign_key");

CREATE TABLE IF NOT EXISTS "four_player_decks" (
  "id" serial PRIMARY KEY,
  "owner_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "emoji" text NOT NULL DEFAULT '⚔️',
  "cards" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "general_def_id" text NOT NULL,
  "ruleset_version" text NOT NULL DEFAULT '4p-general-v0',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "four_player_decks_name_bounds" CHECK (char_length("name") BETWEEN 1 AND 40 AND char_length("general_def_id") BETWEEN 1 AND 120)
);
CREATE INDEX IF NOT EXISTS "four_player_decks_owner_idx" ON "four_player_decks" ("owner_player_id","updated_at");

CREATE TABLE IF NOT EXISTS "four_player_rooms" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "host_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "state" text NOT NULL DEFAULT 'waiting',
  "active_seat" integer NOT NULL DEFAULT 0,
  "priority_seat" integer NOT NULL DEFAULT 0,
  "turn_number" integer NOT NULL DEFAULT 1,
  "rules_snapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "public_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "version" integer NOT NULL DEFAULT 0,
  "winner_player_id" integer REFERENCES "players"("id") ON DELETE SET NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "four_player_rooms_state_valid" CHECK ("state" IN ('waiting','ready','playing','finished','cancelled')),
  CONSTRAINT "four_player_rooms_active_seat_valid" CHECK ("active_seat" BETWEEN 0 AND 3 AND "priority_seat" BETWEEN 0 AND 3),
  CONSTRAINT "four_player_rooms_turn_valid" CHECK ("turn_number" >= 1 AND "version" >= 0)
);
CREATE INDEX IF NOT EXISTS "four_player_rooms_state_created_idx" ON "four_player_rooms" ("state","created_at");
CREATE INDEX IF NOT EXISTS "four_player_rooms_expires_idx" ON "four_player_rooms" ("expires_at");

CREATE TABLE IF NOT EXISTS "four_player_seats" (
  "id" serial PRIMARY KEY,
  "room_id" integer NOT NULL REFERENCES "four_player_rooms"("id") ON DELETE CASCADE,
  "seat" integer NOT NULL,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "player_name" text NOT NULL,
  "deck_id" integer NOT NULL REFERENCES "four_player_decks"("id") ON DELETE RESTRICT,
  "deck_snapshot" jsonb NOT NULL,
  "general_def_id" text NOT NULL,
  "ready" integer NOT NULL DEFAULT 0,
  "eliminated" integer NOT NULL DEFAULT 0,
  "nexus_health" integer NOT NULL,
  "general_cast_count" integer NOT NULL DEFAULT 0,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "four_player_seats_seat_valid" CHECK ("seat" BETWEEN 0 AND 3),
  CONSTRAINT "four_player_seats_flags_valid" CHECK ("ready" IN (0,1) AND "eliminated" IN (0,1)),
  CONSTRAINT "four_player_seats_counters_valid" CHECK ("nexus_health" >= 0 AND "general_cast_count" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "four_player_seats_room_seat_uidx" ON "four_player_seats" ("room_id","seat");
CREATE UNIQUE INDEX IF NOT EXISTS "four_player_seats_room_player_uidx" ON "four_player_seats" ("room_id","player_id");
CREATE INDEX IF NOT EXISTS "four_player_seats_player_idx" ON "four_player_seats" ("player_id","joined_at");

CREATE TABLE IF NOT EXISTS "four_player_action_receipts" (
  "id" serial PRIMARY KEY,
  "room_id" integer NOT NULL REFERENCES "four_player_rooms"("id") ON DELETE CASCADE,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "action_id" text NOT NULL,
  "resulting_version" integer NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "four_player_action_receipts_action_bounds" CHECK (char_length("action_id") BETWEEN 8 AND 80 AND "resulting_version" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "four_player_action_receipts_identity_uidx" ON "four_player_action_receipts" ("room_id","player_id","action_id");
