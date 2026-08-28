CREATE TABLE IF NOT EXISTS "pvp_spectator_snapshots" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" integer NOT NULL,
  "room_version" integer NOT NULL,
  "game_state" jsonb NOT NULL,
  "captured_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "pvp_spectator_snapshots_room_version_unique" UNIQUE("room_id", "room_version")
);

DO $$ BEGIN
 ALTER TABLE "pvp_spectator_snapshots" ADD CONSTRAINT "pvp_spectator_snapshots_room_id_pvp_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."pvp_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "pvp_spectator_snapshots_delayed_idx" ON "pvp_spectator_snapshots" USING btree ("room_id", "captured_at" DESC);

CREATE INDEX IF NOT EXISTS "matchmaking_queue_heartbeat_idx" ON "matchmaking_queue" USING btree ("mode", "created_at" DESC, "mmr");

CREATE INDEX IF NOT EXISTS "admin_sessions_expiry_idx" ON "admin_sessions" USING btree ("expires_at") WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "player_sessions_expiry_idx" ON "player_sessions" USING btree ("expires_at") WHERE "revoked_at" IS NULL;

CREATE TABLE IF NOT EXISTS "api_rate_limits" (
  "key" text NOT NULL,
  "window_start" timestamp NOT NULL,
  "count" integer DEFAULT 1 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "api_rate_limits_key_window_unique" UNIQUE("key", "window_start"),
  CONSTRAINT "api_rate_limits_count_positive" CHECK ("count" > 0)
);

CREATE INDEX IF NOT EXISTS "api_rate_limits_expiry_idx" ON "api_rate_limits" USING btree ("window_start");
