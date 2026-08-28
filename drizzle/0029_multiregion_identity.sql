-- Runeforge 2.87: triple-region community deck identity.
ALTER TABLE shared_decks
  ADD COLUMN IF NOT EXISTS region3 text;

INSERT INTO runeforge_schema_meta(version)
VALUES ('2.87')
ON CONFLICT (version) DO NOTHING;
