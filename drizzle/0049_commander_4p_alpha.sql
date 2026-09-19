CREATE TABLE IF NOT EXISTS "commander_rooms" (
  "id" serial PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "host_player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "state" text NOT NULL DEFAULT 'waiting',
  "active_seat" integer NOT NULL DEFAULT 0,
  "round" integer NOT NULL DEFAULT 1,
  "version" integer NOT NULL DEFAULT 0,
  "rules_snapshot" jsonb NOT NULL,
  "game_state" jsonb,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commander_rooms_state_valid" CHECK ("state" IN ('waiting','playing','finished')),
  CONSTRAINT "commander_rooms_active_seat_valid" CHECK ("active_seat" BETWEEN 0 AND 3),
  CONSTRAINT "commander_rooms_round_positive" CHECK ("round" >= 1)
);
CREATE INDEX IF NOT EXISTS "commander_rooms_state_idx" ON "commander_rooms" ("state","created_at");

CREATE TABLE IF NOT EXISTS "commander_seats" (
  "id" serial PRIMARY KEY,
  "room_id" integer NOT NULL REFERENCES "commander_rooms"("id") ON DELETE CASCADE,
  "seat" integer NOT NULL,
  "player_id" integer NOT NULL REFERENCES "players"("id") ON DELETE CASCADE,
  "player_name" text NOT NULL,
  "deck_cards" jsonb NOT NULL,
  "general_def_id" text NOT NULL,
  "ready" boolean NOT NULL DEFAULT false,
  "joined_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "commander_seats_room_seat_unique" UNIQUE ("room_id","seat"),
  CONSTRAINT "commander_seats_room_player_unique" UNIQUE ("room_id","player_id"),
  CONSTRAINT "commander_seats_seat_valid" CHECK ("seat" BETWEEN 0 AND 3)
);

INSERT INTO "runeforge_schema_meta" ("version") VALUES ('2.97-commander-4p-alpha') ON CONFLICT ("version") DO NOTHING;
