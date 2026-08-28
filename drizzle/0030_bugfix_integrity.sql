-- Runeforge 2.88: idempotent community download accounting and schema provenance.
CREATE TABLE IF NOT EXISTS shared_deck_downloads (
  id serial PRIMARY KEY,
  player_id integer NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deck_id integer NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT shared_deck_downloads_player_id_deck_id_unique UNIQUE(player_id, deck_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_deck_downloads_deck ON shared_deck_downloads(deck_id);

INSERT INTO runeforge_schema_meta(version)
VALUES ('2.88')
ON CONFLICT (version) DO NOTHING;
