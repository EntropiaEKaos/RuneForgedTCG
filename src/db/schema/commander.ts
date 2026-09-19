import { boolean, check, index, integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";

export const commanderRooms = pgTable("commander_rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostPlayerId: integer("host_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("waiting"),
  activeSeat: integer("active_seat").notNull().default(0),
  round: integer("round").notNull().default(1),
  version: integer("version").notNull().default(0),
  rulesSnapshot: jsonb("rules_snapshot").notNull(),
  gameState: jsonb("game_state"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  stateIdx: index("commander_rooms_state_idx").on(t.state, t.createdAt),
  stateValid: check("commander_rooms_state_valid", sql`${t.state} IN ('waiting','playing','finished')`),
  activeSeatValid: check("commander_rooms_active_seat_valid", sql`${t.activeSeat} BETWEEN 0 AND 3`),
  roundPositive: check("commander_rooms_round_positive", sql`${t.round} >= 1`),
}));

export const commanderSeats = pgTable("commander_seats", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => commanderRooms.id, { onDelete: "cascade" }),
  seat: integer("seat").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  deckCards: jsonb("deck_cards").$type<string[]>().notNull(),
  generalDefId: text("general_def_id").notNull(),
  ready: boolean("ready").notNull().default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => ({
  uniqueSeat: unique().on(t.roomId, t.seat),
  uniquePlayer: unique().on(t.roomId, t.playerId),
  seatValid: check("commander_seats_seat_valid", sql`${t.seat} BETWEEN 0 AND 3`),
}));
