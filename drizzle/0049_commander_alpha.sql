CREATE TABLE IF NOT EXISTS "commander_rooms" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "host_player_id" integer NOT NULL,
  "state" text NOT NULL DEFAULT 'waiting',
  "rules_snapshot" jsonb NOT NULL,
  "current_seat" integer NOT NULL DEFAULT 1,
  "round" integer NOT NULL DEFAULT 1,
  "version" integer NOT NULL DEFAULT 0,
  "winner_player_id" integer,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commander_rooms_state_valid" CHECK ("state" IN ('waiting','playing','finished','cancelled')),
  CONSTRAINT "commander_rooms_current_seat_valid" CHECK ("current_seat" BETWEEN 1 AND 4),
  CONSTRAINT "commander_rooms_round_valid" CHECK ("round" >= 1),
  CONSTRAINT "commander_rooms_version_valid" CHECK ("version" >= 0)
);

CREATE TABLE IF NOT EXISTS "commander_room_players" (
  "id" serial PRIMARY KEY,
  "room_id" integer NOT NULL REFERENCES "commander_rooms"("id") ON DELETE CASCADE,
  "player_id" integer NOT NULL,
  "player_name" text NOT NULL,
  "seat" integer NOT NULL,
  "deck_snapshot" jsonb NOT NULL,
  "general_def_id" text NOT NULL,
  "nexus" integer NOT NULL DEFAULT 30,
  "eliminated" boolean NOT NULL DEFAULT false,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commander_room_players_room_player_unique" UNIQUE ("room_id","player_id"),
  CONSTRAINT "commander_room_players_room_seat_unique" UNIQUE ("room_id","seat"),
  CONSTRAINT "commander_room_players_seat_valid" CHECK ("seat" BETWEEN 1 AND 4),
  CONSTRAINT "commander_room_players_nexus_valid" CHECK ("nexus" >= 0)
);

CREATE TABLE IF NOT EXISTS "commander_room_events" (
  "id" serial PRIMARY KEY,
  "room_id" integer NOT NULL REFERENCES "commander_rooms"("id") ON DELETE CASCADE,
  "actor_player_id" integer,
  "event_type" text NOT NULL,
  "room_version" integer NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commander_room_events_version_valid" CHECK ("room_version" >= 0),
  CONSTRAINT "commander_room_events_type_valid" CHECK ("event_type" IN ('created','joined','started','turn_passed','forfeited','finished','cancelled')),
  CONSTRAINT "commander_room_events_unique" UNIQUE ("room_id","room_version","event_type","actor_player_id")
);
CREATE INDEX IF NOT EXISTS "commander_room_players_player_idx" ON "commander_room_players" ("player_id","room_id");
CREATE INDEX IF NOT EXISTS "commander_room_events_room_idx" ON "commander_room_events" ("room_id","created_at");

INSERT INTO "runeforge_schema_meta" ("version") VALUES ('2.97-commander-alpha') ON CONFLICT ("version") DO NOTHING;
