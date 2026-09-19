ALTER TABLE "custom_decks"
ADD COLUMN IF NOT EXISTS "appearance_assets" jsonb NOT NULL DEFAULT '{}'::jsonb;
