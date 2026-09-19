CREATE TABLE IF NOT EXISTS "trade_offer_events" (
  "id" serial PRIMARY KEY,
  "trade_id" integer NOT NULL REFERENCES "trade_offers"("id") ON DELETE CASCADE,
  "actor_player_id" integer REFERENCES "players"("id") ON DELETE SET NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "trade_offer_events_type_valid" CHECK ("event_type" IN ('created','accepted','declined','cancelled','expired'))
);
CREATE INDEX IF NOT EXISTS "trade_offer_events_trade_idx" ON "trade_offer_events" ("trade_id","created_at");
CREATE INDEX IF NOT EXISTS "trade_offer_events_actor_idx" ON "trade_offer_events" ("actor_player_id","created_at");

INSERT INTO "trade_offer_events" ("trade_id","actor_player_id","event_type","payload","created_at")
SELECT t."id",
       CASE WHEN t."status"='cancelled' THEN t."proposer_player_id"
            WHEN t."status" IN ('accepted','declined') THEN t."recipient_player_id"
            ELSE NULL END,
       CASE WHEN t."status"='active' THEN 'created' ELSE t."status" END,
       jsonb_build_object('backfilled', true, 'offeredAssets', t."offered_assets", 'requestedAssets', t."requested_assets"),
       COALESCE(t."completed_at", t."created_at")
FROM "trade_offers" t
WHERE NOT EXISTS (SELECT 1 FROM "trade_offer_events" e WHERE e."trade_id"=t."id");

INSERT INTO "runeforge_schema_meta" ("version") VALUES ('2.97-trading-2.1') ON CONFLICT ("version") DO NOTHING;
