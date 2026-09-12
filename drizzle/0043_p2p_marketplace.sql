-- RuneForge P2P Marketplace 1.0
-- Idempotent late migration for per-copy collectible ownership, listings,
-- escrow locks and direct card-for-card offers.

CREATE TABLE IF NOT EXISTS "card_assets" (
  "id" serial PRIMARY KEY,
  "owner_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "def_id" text NOT NULL,
  "variant_id" text NOT NULL DEFAULT 'standard',
  "frame_id" text NOT NULL DEFAULT 'default',
  "finish" text NOT NULL DEFAULT 'normal',
  "tradable" boolean NOT NULL DEFAULT true,
  "source" text NOT NULL DEFAULT 'legacy',
  "acquired_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "card_assets_variant_bounds" CHECK (
    char_length("variant_id") BETWEEN 1 AND 80
    AND char_length("frame_id") BETWEEN 1 AND 80
    AND char_length("finish") BETWEEN 1 AND 40
  )
);
CREATE INDEX IF NOT EXISTS "card_assets_owner_def_idx" ON "card_assets" ("owner_player_id", "def_id");
CREATE INDEX IF NOT EXISTS "card_assets_collectible_idx" ON "card_assets" ("def_id", "variant_id", "frame_id", "finish");

CREATE TABLE IF NOT EXISTS "marketplace_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "enabled" boolean NOT NULL DEFAULT true,
  "fee_bps" integer NOT NULL DEFAULT 500,
  "min_price_gold" integer NOT NULL DEFAULT 1,
  "max_price_gold" integer NOT NULL DEFAULT 1000000,
  "max_active_listings" integer NOT NULL DEFAULT 20,
  "listing_duration_hours" integer NOT NULL DEFAULT 72,
  "trade_duration_hours" integer NOT NULL DEFAULT 72,
  "max_trade_cards_per_side" integer NOT NULL DEFAULT 5,
  "min_player_level" integer NOT NULL DEFAULT 2,
  "min_account_age_hours" integer NOT NULL DEFAULT 24,
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "updated_by" text,
  CONSTRAINT "marketplace_settings_singleton" CHECK ("id" = 1),
  CONSTRAINT "marketplace_settings_fee_bounds" CHECK ("fee_bps" BETWEEN 0 AND 5000),
  CONSTRAINT "marketplace_settings_price_bounds" CHECK ("min_price_gold" >= 1 AND "max_price_gold" >= "min_price_gold"),
  CONSTRAINT "marketplace_settings_listing_bounds" CHECK ("max_active_listings" BETWEEN 1 AND 200 AND "listing_duration_hours" BETWEEN 1 AND 720),
  CONSTRAINT "marketplace_settings_trade_bounds" CHECK ("trade_duration_hours" BETWEEN 1 AND 720 AND "max_trade_cards_per_side" BETWEEN 1 AND 20),
  CONSTRAINT "marketplace_settings_access_bounds" CHECK ("min_player_level" >= 1 AND "min_account_age_hours" >= 0)
);
INSERT INTO "marketplace_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "market_listings" (
  "id" serial PRIMARY KEY,
  "asset_id" integer NOT NULL REFERENCES "card_assets"("id") ON DELETE RESTRICT,
  "seller_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "buyer_player_id" integer REFERENCES "players"("id") ON DELETE SET NULL,
  "price_gold" integer NOT NULL,
  "fee_gold" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'active',
  "listed_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "market_listings_status_valid" CHECK ("status" IN ('active','sold','cancelled','expired')),
  CONSTRAINT "market_listings_price_positive" CHECK ("price_gold" >= 1 AND "fee_gold" >= 0 AND "fee_gold" <= "price_gold")
);
CREATE UNIQUE INDEX IF NOT EXISTS "market_listings_active_asset_uidx" ON "market_listings" ("asset_id") WHERE "status" = 'active';
CREATE INDEX IF NOT EXISTS "market_listings_active_price_idx" ON "market_listings" ("status", "price_gold", "expires_at");
CREATE INDEX IF NOT EXISTS "market_listings_seller_idx" ON "market_listings" ("seller_player_id", "status");

CREATE TABLE IF NOT EXISTS "card_asset_locks" (
  "asset_id" integer PRIMARY KEY REFERENCES "card_assets"("id") ON DELETE CASCADE,
  "owner_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "reference_id" integer NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "card_asset_locks_kind_valid" CHECK ("kind" IN ('listing','trade'))
);
CREATE INDEX IF NOT EXISTS "card_asset_locks_owner_idx" ON "card_asset_locks" ("owner_player_id", "kind");
CREATE INDEX IF NOT EXISTS "card_asset_locks_reference_idx" ON "card_asset_locks" ("kind", "reference_id");

CREATE TABLE IF NOT EXISTS "trade_offers" (
  "id" serial PRIMARY KEY,
  "proposer_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "recipient_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "offered_assets" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "requested_assets" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "note" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp NOT NULL DEFAULT now(),
  "expires_at" timestamp NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "trade_offers_status_valid" CHECK ("status" IN ('active','accepted','declined','cancelled','expired')),
  CONSTRAINT "trade_offers_different_players" CHECK ("proposer_player_id" <> "recipient_player_id")
);
CREATE INDEX IF NOT EXISTS "trade_offers_proposer_idx" ON "trade_offers" ("proposer_player_id", "status");
CREATE INDEX IF NOT EXISTS "trade_offers_recipient_idx" ON "trade_offers" ("recipient_player_id", "status");

-- Materialize one collectible asset for every legacy aggregate copy. The
-- count-difference expression keeps this safe to replay after partial upgrades.
INSERT INTO "card_assets" ("owner_player_id", "def_id", "finish", "source")
SELECT pc."player_id", pc."def_id", CASE WHEN pc."shiny" THEN 'shiny' ELSE 'normal' END, 'legacy'
FROM "player_cards" pc
CROSS JOIN LATERAL generate_series(
  1,
  GREATEST(
    pc."count" - (
      SELECT count(*)::integer
      FROM "card_assets" ca
      WHERE ca."owner_player_id" = pc."player_id" AND ca."def_id" = pc."def_id"
    ),
    0
  )
) AS missing(copy_no);

INSERT INTO "runeforge_schema_meta" ("version") VALUES ('2.97-market-1.0') ON CONFLICT ("version") DO NOTHING;