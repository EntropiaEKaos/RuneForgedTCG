-- RuneForge 2.90 certification: immutable match rules, optimistic settings,
-- and canonical integrity constraints shared by fresh and upgraded databases.
ALTER TABLE game_settings ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE match_tokens ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE match_tokens ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE mode_attempts ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE mode_attempts ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS engine_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS ai_rules jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS canonical_deck_snapshot jsonb;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS match_options_snapshot jsonb;
ALTER TABLE draft_sessions ADD COLUMN IF NOT EXISTS rules_snapshot jsonb;

-- Historical integrity guarantees that must also exist on fresh baselines.
CREATE UNIQUE INDEX IF NOT EXISTS economy_reward_idempotency_idx
  ON economy_transactions (player_id, currency, reason, reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_content_versions_unique_version
  ON admin_content_versions(resource, resource_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS admin_content_releases_one_active
  ON admin_content_releases(active) WHERE active = true;

CREATE INDEX IF NOT EXISTS draft_sessions_expires_idx ON draft_sessions(expires_at);
CREATE INDEX IF NOT EXISTS pvp_rooms_expires_idx ON pvp_rooms(expires_at);
CREATE INDEX IF NOT EXISTS replays_versions_idx ON replays(engine_version, ruleset_version, content_version);
CREATE INDEX IF NOT EXISTS mode_attempts_expiry ON mode_attempts(expires_at, used_at);
CREATE INDEX IF NOT EXISTS mode_attempts_player_lookup ON mode_attempts(player_id, mode_type, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS admin_sessions_actor_idx ON admin_sessions(actor_id);
CREATE INDEX IF NOT EXISTS admin_content_dependencies_resource_idx ON admin_content_dependencies(resource, resource_id);
CREATE INDEX IF NOT EXISTS admin_card_lab_runs_def_id_idx ON admin_card_lab_runs(def_id, created_at DESC);

DO $$ BEGIN
  IF to_regclass('public.admin_collections') IS NOT NULL AND to_regclass('public.card_catalog_meta') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'card_catalog_meta_collection_fk') THEN
    ALTER TABLE card_catalog_meta ADD CONSTRAINT card_catalog_meta_collection_fk
      FOREIGN KEY (collection_id) REFERENCES admin_collections(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.custom_cards') IS NOT NULL AND to_regclass('public.admin_card_tests') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_card_tests_card_fk') THEN
    ALTER TABLE admin_card_tests ADD CONSTRAINT admin_card_tests_card_fk
      FOREIGN KEY (card_id) REFERENCES custom_cards(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.admin_card_tests') IS NOT NULL AND to_regclass('public.admin_card_test_runs') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_card_test_runs_test_fk') THEN
    ALTER TABLE admin_card_test_runs ADD CONSTRAINT admin_card_test_runs_test_fk
      FOREIGN KEY (test_id) REFERENCES admin_card_tests(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.custom_cards') IS NOT NULL AND to_regclass('public.admin_card_test_runs') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_card_test_runs_card_fk') THEN
    ALTER TABLE admin_card_test_runs ADD CONSTRAINT admin_card_test_runs_card_fk
      FOREIGN KEY (card_id) REFERENCES custom_cards(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

INSERT INTO runeforge_schema_meta(version) VALUES ('2.90') ON CONFLICT(version) DO NOTHING;


-- Canonical historical index parity: a fresh 2.90 database gets the same
-- secondary indexes as a database upgraded through every historical migration.
-- from 0001_hardening.sql: ranked_matches_player_match_uidx
CREATE UNIQUE INDEX IF NOT EXISTS ranked_matches_player_match_uidx
  ON ranked_matches (player_id, match_id)
  WHERE match_id IS NOT NULL;
-- from 0001_hardening.sql: matches_player_created_idx
CREATE INDEX IF NOT EXISTS matches_player_created_idx
  ON matches (player_name, created_at DESC);
-- from 0001_hardening.sql: match_tokens_expires_idx
CREATE INDEX IF NOT EXISTS match_tokens_expires_idx
  ON match_tokens (expires_at);
-- from 0001_hardening.sql: matchmaking_mode_mmr_created_idx
CREATE INDEX IF NOT EXISTS matchmaking_mode_mmr_created_idx
  ON matchmaking_queue (mode, mmr, created_at DESC);
-- from 0001_hardening.sql: pvp_rooms_state_created_idx
CREATE INDEX IF NOT EXISTS pvp_rooms_state_created_idx
  ON pvp_rooms (state, created_at DESC);
-- from 0001_hardening.sql: chat_messages_room_created_idx
CREATE INDEX IF NOT EXISTS chat_messages_room_created_idx
  ON chat_messages (room_code, created_at DESC);
-- from 0001_hardening.sql: ranked_matches_player_created_idx
CREATE INDEX IF NOT EXISTS ranked_matches_player_created_idx
  ON ranked_matches (player_id, created_at DESC);
-- from 0002_authoritative.sql: economy_transactions_player_created_idx
CREATE INDEX IF NOT EXISTS economy_transactions_player_created_idx ON economy_transactions (player_id, created_at DESC);
-- from 0002_authoritative.sql: mode_rewards_player_mode_uidx
CREATE UNIQUE INDEX IF NOT EXISTS mode_rewards_player_mode_uidx ON mode_rewards (player_id, mode_type, mode_id);
-- from 0003_competitive_core.sql: idx_player_sessions_player
CREATE INDEX IF NOT EXISTS idx_player_sessions_player ON player_sessions(player_id);
-- from 0003_competitive_core.sql: idx_player_sessions_active
CREATE INDEX IF NOT EXISTS idx_player_sessions_active ON player_sessions(session_id, revoked_at, expires_at);
-- from 0003_competitive_core.sql: idx_custom_decks_owner_player
CREATE INDEX IF NOT EXISTS idx_custom_decks_owner_player ON custom_decks(owner_player_id);
-- from 0003_competitive_core.sql: idx_matches_player_created
CREATE INDEX IF NOT EXISTS idx_matches_player_created ON matches(player_id, created_at DESC);
-- from 0003_competitive_core.sql: idx_replays_player_created
CREATE INDEX IF NOT EXISTS idx_replays_player_created ON replays(player_id, created_at DESC);
-- from 0003_competitive_core.sql: idx_match_tokens_player
CREATE INDEX IF NOT EXISTS idx_match_tokens_player ON match_tokens(player_id);
-- from 0003_competitive_core.sql: idx_pvp_host_player
CREATE INDEX IF NOT EXISTS idx_pvp_host_player ON pvp_rooms(host_player_id);
-- from 0003_competitive_core.sql: idx_pvp_guest_player
CREATE INDEX IF NOT EXISTS idx_pvp_guest_player ON pvp_rooms(guest_player_id);
-- from 0003_competitive_core.sql: idx_chat_room_created
CREATE INDEX IF NOT EXISTS idx_chat_room_created ON chat_messages(room_code, created_at DESC);
-- from 0003_competitive_core.sql: idx_shared_deck_votes_deck
CREATE INDEX IF NOT EXISTS idx_shared_deck_votes_deck ON shared_deck_votes(deck_id);
-- from 0004_admin_studio.sql: card_catalog_meta_collection_idx
CREATE INDEX IF NOT EXISTS card_catalog_meta_collection_idx ON card_catalog_meta(collection_id);
-- from 0004_admin_studio.sql: admin_events_status_idx
CREATE INDEX IF NOT EXISTS admin_events_status_idx ON admin_events(status);
-- from 0004_admin_studio.sql: admin_promotions_status_idx
CREATE INDEX IF NOT EXISTS admin_promotions_status_idx ON admin_promotions(status);
-- from 0005_content_pipeline.sql: admin_content_versions_lookup_idx
CREATE INDEX IF NOT EXISTS admin_content_versions_lookup_idx ON admin_content_versions(resource, resource_id, version DESC);
-- from 0005_content_pipeline.sql: admin_audit_logs_created_idx
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_idx ON admin_audit_logs(created_at DESC);
-- from 0005_content_pipeline.sql: admin_audit_logs_resource_idx
CREATE INDEX IF NOT EXISTS admin_audit_logs_resource_idx ON admin_audit_logs(resource, resource_id);
-- from 0005_content_pipeline.sql: admin_qa_runs_resource_idx
CREATE INDEX IF NOT EXISTS admin_qa_runs_resource_idx ON admin_qa_runs(resource, resource_id, created_at DESC);
-- from 0006_content_studio_3.sql: admin_card_tests_card_idx
CREATE INDEX IF NOT EXISTS admin_card_tests_card_idx ON admin_card_tests(card_id);
-- from 0006_content_studio_3.sql: admin_card_test_runs_card_idx
CREATE INDEX IF NOT EXISTS admin_card_test_runs_card_idx ON admin_card_test_runs(card_id);
-- from 0006_content_studio_3.sql: admin_card_test_runs_created_idx
CREATE INDEX IF NOT EXISTS admin_card_test_runs_created_idx ON admin_card_test_runs(created_at);
-- from 0007_content_studio_4.sql: approval_resource_idx
CREATE INDEX IF NOT EXISTS "approval_resource_idx" ON "admin_approval_requests" ("resource", "resource_id");
-- from 0007_content_studio_4.sql: approval_status_idx
CREATE INDEX IF NOT EXISTS "approval_status_idx" ON "admin_approval_requests" ("status", "stage");
-- from 0008_balance_lab_5.sql: balance_experiment_created_idx
CREATE INDEX IF NOT EXISTS "balance_experiment_created_idx" ON "admin_balance_experiments" ("created_at");
-- from 0008_balance_lab_5.sql: balance_experiment_status_idx
CREATE INDEX IF NOT EXISTS "balance_experiment_status_idx" ON "admin_balance_experiments" ("status");
-- from 0008_balance_lab_5.sql: balance_matchup_experiment_idx
CREATE INDEX IF NOT EXISTS "balance_matchup_experiment_idx" ON "admin_balance_matchups" ("experiment_id");
-- from 0008_balance_lab_5.sql: balance_matchup_decks_idx
CREATE INDEX IF NOT EXISTS "balance_matchup_decks_idx" ON "admin_balance_matchups" ("deck_a", "deck_b");
-- from 0009_engine_audit_hardening.sql: matches_player_mode_idx
CREATE INDEX IF NOT EXISTS "matches_player_mode_idx" ON "matches" ("player_id", "match_mode");
-- from 0009_engine_audit_hardening.sql: match_tokens_player_mode_idx
CREATE INDEX IF NOT EXISTS "match_tokens_player_mode_idx" ON "match_tokens" ("player_id", "mode");
-- from 0009_engine_audit_hardening.sql: pvp_rooms_mode_state_idx
CREATE INDEX IF NOT EXISTS "pvp_rooms_mode_state_idx" ON "pvp_rooms" ("mode", "state");
-- from 0009_engine_audit_hardening.sql: admin_approval_resource_stage_hash_idx
CREATE INDEX IF NOT EXISTS "admin_approval_resource_stage_hash_idx" ON "admin_approval_requests" ("resource", "resource_id", "stage", "content_hash", "status");
-- from 0010_pvp_ranked_settlement.sql: replays_match_mode_idx
CREATE INDEX IF NOT EXISTS "replays_match_mode_idx" ON "replays" ("match_mode", "created_at");
-- from 0010_pvp_ranked_settlement.sql: matches_opponent_idx
CREATE INDEX IF NOT EXISTS "matches_opponent_idx" ON "matches" ("opponent_player_id");
-- from 0011_economy_concurrency.sql: player_dailies_player_quest_unique
CREATE UNIQUE INDEX IF NOT EXISTS "player_dailies_player_quest_unique"
  ON "player_dailies" ("player_id", "quest_id");
-- from 0014_deep_audit.sql: mode_attempts_player_deck_lookup
CREATE INDEX IF NOT EXISTS "mode_attempts_player_deck_lookup" ON "mode_attempts" ("player_id", "mode_type", "mode_id", "player_deck_id", "used_at");
-- from 0019_engine_hardening_2_17.sql: pack_openings_player_seed_idx
CREATE INDEX IF NOT EXISTS pack_openings_player_seed_idx ON pack_openings(player_id, pack_seed);
-- from 0020_mechanics_studio.sql: admin_card_archetypes_enabled_idx
CREATE INDEX IF NOT EXISTS admin_card_archetypes_enabled_idx ON admin_card_archetypes(enabled);
-- from 0024_admin_users_mfa.sql: admin_users_enabled_idx
CREATE INDEX IF NOT EXISTS admin_users_enabled_idx ON admin_users(enabled, role);

DO $$ BEGIN
  IF to_regclass('public.admin_card_archetypes') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_card_archetypes_base_type_check') THEN
    ALTER TABLE admin_card_archetypes ADD CONSTRAINT admin_card_archetypes_base_type_check
      CHECK (base_type IN ('Unit','Spell','Enchantment','Artifact','Equipment','Sentinela')) NOT VALID;
  END IF;
END $$;
