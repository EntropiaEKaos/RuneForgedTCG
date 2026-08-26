-- Deep audit 2.9: database-level idempotency and season invariants.
-- A PvP room intentionally uses the same match_token for both player rows,
-- so uniqueness must include player_id rather than token alone.
CREATE UNIQUE INDEX IF NOT EXISTS "matches_match_token_player_unique"
  ON "matches" ("match_token", "player_id")
  WHERE "match_token" IS NOT NULL AND "player_id" IS NOT NULL;

-- Ranked settlement must never have two simultaneously active seasons.
CREATE UNIQUE INDEX IF NOT EXISTS "ranked_seasons_one_active"
  ON "ranked_seasons" ("active")
  WHERE "active" = true;
