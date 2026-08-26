-- RuneForge 2.94 — payment/rotation hardening + runtime card-art pipeline.
ALTER TABLE card_catalog_meta ADD COLUMN IF NOT EXISTS art_url text;
ALTER TABLE card_catalog_meta ADD COLUMN IF NOT EXISTS art_crop jsonb NOT NULL DEFAULT '{}'::jsonb;
INSERT INTO runeforge_schema_meta(version) VALUES ('2.94') ON CONFLICT(version) DO NOTHING;
