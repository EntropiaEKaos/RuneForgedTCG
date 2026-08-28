CREATE TABLE "admin_approval_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer NOT NULL,
	"stage" text DEFAULT 'content' NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text DEFAULT 'admin' NOT NULL,
	"decided_by" text,
	"note" text DEFAULT '' NOT NULL,
	"decision_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);

CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer,
	"actor" text DEFAULT 'admin' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_balance_experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"mode" text DEFAULT 'matrix' NOT NULL,
	"games_per_matchup" integer NOT NULL,
	"seed" integer NOT NULL,
	"deck_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_games" integer DEFAULT 0 NOT NULL,
	"completed_games" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"engine_version" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

CREATE TABLE "admin_balance_matchups" (
	"id" serial PRIMARY KEY NOT NULL,
	"experiment_id" integer NOT NULL,
	"deck_a" text NOT NULL,
	"deck_b" text NOT NULL,
	"requested_games" integer NOT NULL,
	"completed_games" integer DEFAULT 0 NOT NULL,
	"wins_a" integer DEFAULT 0 NOT NULL,
	"wins_b" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"avg_rounds" integer DEFAULT 0 NOT NULL,
	"win_rate_a" integer DEFAULT 0 NOT NULL,
	"win_rate_b" integer DEFAULT 0 NOT NULL,
	"seed" integer NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_card_archetypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"base_type" text NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_card_archetypes_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_card_lab_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer,
	"def_id" text NOT NULL,
	"iterations" integer DEFAULT 12 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"content_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_card_test_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" integer,
	"card_id" integer NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"actual" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engine_version" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_card_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"name" text NOT NULL,
	"scenario" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text,
	"color" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_classes_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"code" text NOT NULL,
	"symbol" text,
	"banner" text,
	"release_date" timestamp,
	"rotation_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_collections_key_unique" UNIQUE("key"),
	CONSTRAINT "admin_collections_code_unique" UNIQUE("code")
);

CREATE TABLE "admin_content_dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer NOT NULL,
	"content_version" text DEFAULT '' NOT NULL,
	"graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_content_releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"manifest" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_content_releases_content_hash_unique" UNIQUE("content_hash")
);

CREATE TABLE "admin_content_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"change_note" text DEFAULT '' NOT NULL,
	"author" text DEFAULT 'admin' NOT NULL,
	"engine_version" text,
	"ruleset_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_effects" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_effects_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'event' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_events_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_type" text NOT NULL,
	"source_key" text NOT NULL,
	"target_type" text NOT NULL,
	"target_key" text NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effect" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text,
	"engine_keyword" text,
	"behavior" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_keywords_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'store' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"offers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_promotions_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_qa_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource" text NOT NULL,
	"resource_id" integer,
	"passed" boolean DEFAULT false NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_races" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text,
	"region" text,
	"color" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_races_key_unique" UNIQUE("key")
);

CREATE TABLE "admin_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"actor_id" text NOT NULL,
	"role_at_login" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "admin_sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "admin_simulation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'ai-vs-ai' NOT NULL,
	"deck_a" text NOT NULL,
	"deck_b" text NOT NULL,
	"requested_games" integer NOT NULL,
	"completed_games" integer DEFAULT 0 NOT NULL,
	"wins_a" integer DEFAULT 0 NOT NULL,
	"wins_b" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"avg_rounds" integer DEFAULT 0 NOT NULL,
	"seed" integer NOT NULL,
	"engine_version" text NOT NULL,
	"ruleset_version" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "admin_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_salt" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'designer' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"mfa_secret" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_username_unique" UNIQUE("username")
);

CREATE TABLE "card_catalog_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"def_id" text NOT NULL,
	"collection_id" integer,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"class_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"race_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"release_state" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "card_catalog_meta_def_id_unique" UNIQUE("def_id")
);

CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_code" text NOT NULL,
	"player_name" text NOT NULL,
	"player_id" integer,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "custom_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"def_id" text NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"type" text NOT NULL,
	"cost" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_cards_def_id_unique" UNIQUE("def_id")
);

CREATE TABLE "custom_decks" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_name" text NOT NULL,
	"owner_player_id" integer,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎴' NOT NULL,
	"cards" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "draft_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"deck" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_pool" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "draft_sessions_player_id_unique" UNIQUE("player_id")
);

CREATE TABLE "economy_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"currency" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"balance_after" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"friend_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "friendships_player_id_friend_id_unique" UNIQUE("player_id","friend_id")
);

CREATE TABLE "game_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_settings_key_unique" UNIQUE("key")
);

CREATE TABLE "match_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"mode" text DEFAULT 'casual' NOT NULL,
	"player_name" text NOT NULL,
	"player_id" integer,
	"deck_id" text NOT NULL,
	"deck_name" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"seed" integer,
	"player_first" boolean,
	"ai_deck_id" text,
	"ai_deck_name" text,
	"deck_snapshot" jsonb,
	"opponent_snapshot" jsonb,
	CONSTRAINT "match_tokens_token_unique" UNIQUE("token")
);

CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_name" text NOT NULL,
	"player_id" integer,
	"opponent_player_id" integer,
	"deck_id" text NOT NULL,
	"deck_name" text NOT NULL,
	"won" boolean NOT NULL,
	"rounds" integer NOT NULL,
	"nexus_remaining" integer NOT NULL,
	"match_token" text,
	"match_mode" text DEFAULT 'casual' NOT NULL,
	"rewards_claimed" boolean DEFAULT false NOT NULL,
	"seed" integer,
	"player_first" boolean,
	"ai_deck_id" text,
	"ai_deck_name" text,
	"action_log" jsonb,
	"event_log" jsonb,
	"action_hash" text,
	"state_hash" text,
	"integrity_hash" text,
	"deck_snapshot" jsonb,
	"content_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "matchmaking_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"deck_id" text NOT NULL,
	"mmr" integer NOT NULL,
	"mode" text DEFAULT 'ranked' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "matchmaking_queue_player_id_mode_unique" UNIQUE("player_id","mode"),
	CONSTRAINT "matchmaking_mmr_non_negative" CHECK ("matchmaking_queue"."mmr" >= 0)
);

CREATE TABLE "mode_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"player_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"mode_type" text NOT NULL,
	"mode_id" text NOT NULL,
	"player_deck_id" text DEFAULT '' NOT NULL,
	"seed" integer NOT NULL,
	"player_first" boolean NOT NULL,
	"player_deck_snapshot" jsonb NOT NULL,
	"opponent_deck_snapshot" jsonb NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mode_attempts_token_unique" UNIQUE("token")
);

CREATE TABLE "mode_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"mode_type" text NOT NULL,
	"mode_id" text NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mode_rewards_player_id_mode_type_mode_id_unique" UNIQUE("player_id","mode_type","mode_id")
);

CREATE TABLE "pack_openings" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"pack_type" text NOT NULL,
	"cards_received" text NOT NULL,
	"dust_bonus" integer DEFAULT 0 NOT NULL,
	"pack_seed" integer,
	"content_version" text DEFAULT '2026.08.24' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "player_achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"achievement_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_achievements_player_id_achievement_id_unique" UNIQUE("player_id","achievement_id")
);

CREATE TABLE "player_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"def_id" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"shiny" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_cards_player_id_def_id_unique" UNIQUE("player_id","def_id"),
	CONSTRAINT "player_cards_count_bounds" CHECK ("player_cards"."count" >= 1 AND "player_cards"."count" <= 3)
);

CREATE TABLE "player_dailies" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"quest_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"claimed_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_dailies_player_id_quest_id_unique" UNIQUE("player_id","quest_id")
);

CREATE TABLE "player_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"pack_type" text NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_packs_player_id_pack_type_unique" UNIQUE("player_id","pack_type"),
	CONSTRAINT "player_packs_count_positive" CHECK ("player_packs"."count" >= 1)
);

CREATE TABLE "player_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"player_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "player_sessions_session_id_unique" UNIQUE("session_id")
);

CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"gold" integer DEFAULT 100 NOT NULL,
	"dust" integer DEFAULT 0 NOT NULL,
	"mmr" integer DEFAULT 1000 NOT NULL,
	"peak_mmr" integer DEFAULT 1000 NOT NULL,
	"ranked_wins" integer DEFAULT 0 NOT NULL,
	"ranked_losses" integer DEFAULT 0 NOT NULL,
	"ranked_games_in_placement" integer DEFAULT 10 NOT NULL,
	"login_streak" integer DEFAULT 0 NOT NULL,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_daily" timestamp,
	"avatar" text DEFAULT '🎮',
	"card_back" text DEFAULT 'default',
	"title" text DEFAULT 'Rookie',
	"bio" text DEFAULT '',
	"banner" text DEFAULT 'default',
	"status" text DEFAULT 'active' NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"moderator_note" text,
	CONSTRAINT "players_name_unique" UNIQUE("name"),
	CONSTRAINT "players_economy_non_negative" CHECK ("players"."xp" >= 0 AND "players"."gold" >= 0 AND "players"."dust" >= 0),
	CONSTRAINT "players_ranked_non_negative" CHECK ("players"."mmr" >= 0 AND "players"."peak_mmr" >= 0 AND "players"."ranked_wins" >= 0 AND "players"."ranked_losses" >= 0 AND "players"."ranked_games_in_placement" >= 0)
);

CREATE TABLE "pvp_action_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"action_id" text NOT NULL,
	"resulting_version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvp_action_receipts_room_id_player_id_action_id_unique" UNIQUE("room_id","player_id","action_id"),
	CONSTRAINT "pvp_action_receipts_action_id_length" CHECK (char_length("pvp_action_receipts"."action_id") BETWEEN 8 AND 80)
);

CREATE TABLE "pvp_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"host_name" text NOT NULL,
	"host_player_id" integer,
	"host_deck" text NOT NULL,
	"guest_name" text,
	"guest_player_id" integer,
	"guest_deck" text,
	"state" text DEFAULT 'waiting' NOT NULL,
	"mode" text DEFAULT 'casual' NOT NULL,
	"settled_at" timestamp,
	"game_state" jsonb,
	"winner" text,
	"version" integer DEFAULT 0 NOT NULL,
	"seed" integer,
	"player_first" boolean,
	"action_log" jsonb,
	"event_log" jsonb,
	"action_hash" text,
	"integrity_hash" text,
	"host_deck_snapshot" jsonb,
	"guest_deck_snapshot" jsonb,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pvp_rooms_code_unique" UNIQUE("code")
);

CREATE TABLE "ranked_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"match_id" integer,
	"opponent_name" text NOT NULL,
	"won" boolean NOT NULL,
	"mmr_change" integer NOT NULL,
	"mmr_before" integer NOT NULL,
	"mmr_after" integer NOT NULL,
	"season_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ranked_matches_player_id_match_id_unique" UNIQUE("player_id","match_id")
);

CREATE TABLE "ranked_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);

CREATE TABLE "replays" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_name" text NOT NULL,
	"player_id" integer,
	"deck_name" text NOT NULL,
	"deck_id" text,
	"ai_deck_name" text NOT NULL,
	"ai_deck_id" text,
	"won" boolean NOT NULL,
	"rounds" integer NOT NULL,
	"player_first" boolean NOT NULL,
	"seed" integer NOT NULL,
	"log" text NOT NULL,
	"action_log" jsonb,
	"event_log" jsonb,
	"action_hash" text,
	"state_hash" text,
	"integrity_hash" text,
	"deck_snapshot" jsonb,
	"engine_version" text DEFAULT '1' NOT NULL,
	"ruleset_version" text DEFAULT '2026.08' NOT NULL,
	"match_mode" text DEFAULT 'casual' NOT NULL,
	"opponent_player_id" integer,
	"perspective" text DEFAULT 'player' NOT NULL,
	"content_version" text DEFAULT '2026.08.24' NOT NULL,
	"content_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "shared_deck_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"deck_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_deck_votes_player_id_deck_id_unique" UNIQUE("player_id","deck_id")
);

CREATE TABLE "shared_decks" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"region1" text NOT NULL,
	"region2" text,
	"cards" text NOT NULL,
	"archetype" text DEFAULT 'Custom',
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "matches_match_token_player_unique" ON "matches" USING btree ("match_token","player_id") WHERE "matches"."match_token" IS NOT NULL AND "matches"."player_id" IS NOT NULL;
CREATE UNIQUE INDEX "ranked_seasons_one_active" ON "ranked_seasons" USING btree ("active") WHERE "ranked_seasons"."active" = true;
