-- RuneForge 2.97 Ranked Certification
-- Snapshot the season that accepted a ranked room so settlement remains
-- authoritative even if the season closes while an in-flight match finishes.

ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS ranked_season_id integer;
ALTER TABLE ranked_matches ADD COLUMN IF NOT EXISTS rules_version text;
ALTER TABLE ranked_matches ADD COLUMN IF NOT EXISTS deck_pool_version text;

CREATE INDEX IF NOT EXISTS pvp_rooms_ranked_season_idx
  ON pvp_rooms(ranked_season_id)
  WHERE ranked_season_id IS NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pvp_rooms_ranked_season') THEN
    ALTER TABLE pvp_rooms
      ADD CONSTRAINT fk_pvp_rooms_ranked_season
      FOREIGN KEY (ranked_season_id) REFERENCES ranked_seasons(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE pvp_rooms VALIDATE CONSTRAINT fk_pvp_rooms_ranked_season;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ranked_matches_season') THEN
    ALTER TABLE ranked_matches
      ADD CONSTRAINT fk_ranked_matches_season
      FOREIGN KEY (season_id) REFERENCES ranked_seasons(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

ALTER TABLE ranked_matches VALIDATE CONSTRAINT fk_ranked_matches_season;

-- Fresh databases previously had ranked_seasons metadata but no actual row,
-- leaving a certified queue permanently unavailable until an admin happened
-- to touch the control plane. Seed the release preseason only when no season is
-- currently active; existing operator configuration always wins.
INSERT INTO ranked_seasons(control_key, name, start_at, end_at, active)
SELECT 'preseason', 'Pré-temporada', TIMESTAMP '2026-08-01 00:00:00', TIMESTAMP '2027-01-01 00:00:00', true
WHERE NOT EXISTS (SELECT 1 FROM ranked_seasons WHERE active = true)
  AND NOT EXISTS (SELECT 1 FROM ranked_seasons WHERE control_key = 'preseason')
ON CONFLICT (control_key) WHERE control_key IS NOT NULL DO NOTHING;

INSERT INTO runeforge_schema_meta(version) VALUES ('2.97') ON CONFLICT(version) DO NOTHING;
