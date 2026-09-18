import { check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";

/**
 * Four-player decks are intentionally separate from custom_decks because the
 * 80+1 General ruleset must never loosen or reinterpret certified 1v1 limits.
 */
export const fourPlayerDecks = pgTable("four_player_decks", {
  id: serial("id").primaryKey(),
  ownerPlayerId: integer("owner_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("⚔️"),
  cards: jsonb("cards").$type<string[]>().notNull().default([]),
  generalDefId: text("general_def_id").notNull(),
  rulesetVersion: text("ruleset_version").notNull().default("4p-general-v0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index("four_player_decks_owner_idx").on(t.ownerPlayerId, t.updatedAt),
  nameBounds: check("four_player_decks_name_bounds", sql`char_length(${t.name}) BETWEEN 1 AND 40 AND char_length(${t.generalDefId}) BETWEEN 1 AND 120`),
}));

/**
 * Dedicated FFA room. It deliberately does not reuse pvp_rooms/GameState,
 * protecting the certified two-side PvP orchestrator from four-seat semantics.
 */
export const fourPlayerRooms = pgTable("four_player_rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostPlayerId: integer("host_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("waiting"),
  activeSeat: integer("active_seat").notNull().default(0),
  prioritySeat: integer("priority_seat").notNull().default(0),
  turnNumber: integer("turn_number").notNull().default(1),
  rulesSnapshot: jsonb("rules_snapshot").notNull().default({}),
  publicState: jsonb("public_state").notNull().default({}),
  version: integer("version").notNull().default(0),
  winnerPlayerId: integer("winner_player_id").references(() => players.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  stateIdx: index("four_player_rooms_state_created_idx").on(t.state, t.createdAt),
  expiryIdx: index("four_player_rooms_expires_idx").on(t.expiresAt),
  stateValid: check("four_player_rooms_state_valid", sql`${t.state} IN ('waiting','ready','playing','finished','cancelled')`),
  activeSeatValid: check("four_player_rooms_active_seat_valid", sql`${t.activeSeat} BETWEEN 0 AND 3 AND ${t.prioritySeat} BETWEEN 0 AND 3`),
  turnValid: check("four_player_rooms_turn_valid", sql`${t.turnNumber} >= 1 AND ${t.version} >= 0`),
}));

export const fourPlayerSeats = pgTable("four_player_seats", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => fourPlayerRooms.id, { onDelete: "cascade" }),
  seat: integer("seat").notNull(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  playerName: text("player_name").notNull(),
  deckId: integer("deck_id").notNull().references(() => fourPlayerDecks.id, { onDelete: "restrict" }),
  deckSnapshot: jsonb("deck_snapshot").notNull(),
  generalDefId: text("general_def_id").notNull(),
  ready: integer("ready").notNull().default(0),
  eliminated: integer("eliminated").notNull().default(0),
  nexusHealth: integer("nexus_health").notNull(),
  generalCastCount: integer("general_cast_count").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
}, (t) => ({
  roomSeat: uniqueIndex("four_player_seats_room_seat_uidx").on(t.roomId, t.seat),
  roomPlayer: uniqueIndex("four_player_seats_room_player_uidx").on(t.roomId, t.playerId),
  playerIdx: index("four_player_seats_player_idx").on(t.playerId, t.joinedAt),
  seatValid: check("four_player_seats_seat_valid", sql`${t.seat} BETWEEN 0 AND 3`),
  booleansValid: check("four_player_seats_flags_valid", sql`${t.ready} IN (0,1) AND ${t.eliminated} IN (0,1)`),
  countersValid: check("four_player_seats_counters_valid", sql`${t.nexusHealth} >= 0 AND ${t.generalCastCount} >= 0`),
}));

/** Idempotency receipt for authoritative 4P actions. */
export const fourPlayerActionReceipts = pgTable("four_player_action_receipts", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => fourPlayerRooms.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  actionId: text("action_id").notNull(),
  resultingVersion: integer("resulting_version").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  actionIdentity: uniqueIndex("four_player_action_receipts_identity_uidx").on(t.roomId, t.playerId, t.actionId),
  actionBounds: check("four_player_action_receipts_action_bounds", sql`char_length(${t.actionId}) BETWEEN 8 AND 80 AND ${t.resultingVersion} >= 0`),
}));

export type FourPlayerDeck = typeof fourPlayerDecks.$inferSelect;
export type FourPlayerRoom = typeof fourPlayerRooms.$inferSelect;
export type FourPlayerSeatRow = typeof fourPlayerSeats.$inferSelect;
