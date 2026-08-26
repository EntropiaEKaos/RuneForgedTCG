-- RuneForge 2.91 MVP release hardening.
-- Normalizes fresh-2.90 and historically-migrated databases to one contract.

-- 0031 accidentally created this index with a predicate broad enough to make
-- repeated pack purchases/craft/disenchant operations collide. Recreate the
-- original reward-only idempotency contract for EVERY database provenance.
DROP INDEX IF EXISTS economy_reward_idempotency_idx;
CREATE UNIQUE INDEX economy_reward_idempotency_idx
ON economy_transactions(player_id, currency, reason, reference_type, reference_id)
WHERE reference_type IS NOT NULL
  AND reference_id IS NOT NULL
  AND reason IN ('match_reward', 'mode_reward');

-- Guest account recovery: only the digest is stored. Codes are shown once and
-- can be used to recreate a signed HttpOnly player session on another browser.
ALTER TABLE players ADD COLUMN IF NOT EXISTS recovery_key_hash text;
ALTER TABLE pvp_rooms ADD COLUMN IF NOT EXISTS ranked_config_snapshot jsonb;
ALTER TABLE ranked_seasons ADD COLUMN IF NOT EXISTS control_key text;
CREATE UNIQUE INDEX IF NOT EXISTS players_recovery_key_hash_unique
  ON players(recovery_key_hash)
  WHERE recovery_key_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ranked_seasons_control_key_unique
  ON ranked_seasons(control_key)
  WHERE control_key IS NOT NULL;

INSERT INTO runeforge_schema_meta(version) VALUES ('2.91') ON CONFLICT(version) DO NOTHING;
