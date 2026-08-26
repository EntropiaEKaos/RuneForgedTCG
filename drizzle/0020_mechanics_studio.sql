CREATE TABLE IF NOT EXISTS admin_card_archetypes (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  base_type TEXT NOT NULL,
  definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_card_archetypes_base_type_check CHECK (base_type IN ('Unit','Spell','Enchantment','Artifact','Equipment','Sentinela'))
);
CREATE INDEX IF NOT EXISTS admin_card_archetypes_enabled_idx ON admin_card_archetypes(enabled);
