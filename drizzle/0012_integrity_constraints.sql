-- Integrity hardening: make core economy/ranking invariants database-enforced.
-- NOT VALID lets existing legacy rows remain while all new/updated rows are protected.
ALTER TABLE "players"
  ADD CONSTRAINT "players_economy_non_negative" CHECK (xp >= 0 AND gold >= 0 AND dust >= 0) NOT VALID;
ALTER TABLE "players"
  ADD CONSTRAINT "players_ranked_non_negative" CHECK (mmr >= 0 AND peak_mmr >= 0 AND ranked_wins >= 0 AND ranked_losses >= 0 AND ranked_games_in_placement >= 0) NOT VALID;
ALTER TABLE "player_cards"
  ADD CONSTRAINT "player_cards_count_bounds" CHECK (count >= 1 AND count <= 3) NOT VALID;
ALTER TABLE "player_packs"
  ADD CONSTRAINT "player_packs_count_positive" CHECK (count >= 1) NOT VALID;
ALTER TABLE "matchmaking_queue"
  ADD CONSTRAINT "matchmaking_mmr_non_negative" CHECK (mmr >= 0) NOT VALID;

-- Reward settlement ledger entries are idempotent by player + currency + logical reward reference.
-- Purchases and login rewards intentionally do not participate because they can repeat.
CREATE UNIQUE INDEX IF NOT EXISTS "economy_reward_idempotency_idx"
  ON "economy_transactions" ("player_id", "currency", "reason", "reference_type", "reference_id")
  WHERE "reference_type" IS NOT NULL
    AND "reference_id" IS NOT NULL
    AND "reason" IN ('match_reward', 'mode_reward');
