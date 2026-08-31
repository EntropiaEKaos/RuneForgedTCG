import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Persisted draft session. Drafts must survive restarts and multiple app instances. */
export const draftSessions = pgTable("draft_sessions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().unique(),
  playerName: text("player_name").notNull(),
  deck: jsonb("deck").notNull().default([]),
  currentPool: jsonb("current_pool").notNull().default([]),
  step: integer("step").notNull().default(0),
  regions: jsonb("regions").notNull().default([]),
  rulesSnapshot: jsonb("rules_snapshot"),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Ranked season tracking. */
export const rankedSeasons = pgTable("ranked_seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  controlKey: text("control_key"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => ({
  oneActiveSeason: uniqueIndex("ranked_seasons_one_active").on(t.active).where(sql`${t.active} = true`),
  controlKeyUnique: uniqueIndex("ranked_seasons_control_key_unique").on(t.controlKey).where(sql`${t.controlKey} IS NOT NULL`),
}));

/** PvP rooms for real-time multiplayer. */
export const pvpRooms = pgTable("pvp_rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostName: text("host_name").notNull(),
  hostPlayerId: integer("host_player_id"),
  hostDeck: text("host_deck").notNull(),
  guestName: text("guest_name"),
  guestPlayerId: integer("guest_player_id"),
  guestDeck: text("guest_deck"),
  state: text("state").notNull().default("waiting"), // waiting, playing, finished
  mode: text("mode").notNull().default("casual"),
  settledAt: timestamp("settled_at"),
  gameState: jsonb("game_state"),
  /** Persisted network priority window. GameState stays pre-action until this resolves. */
  reactionState: jsonb("reaction_state"),
  winner: text("winner"),
  /**
   * Lock otimista (compare-and-set): cada atualização de gameState deve
   * enviar a versão lida. O servidor só aplica se a versão não mudou;
   * caso contrário retorna conflito (409) com a versão mais recente.
   */
  version: integer("version").notNull().default(0),
  seed: integer("seed"),
  playerFirst: boolean("player_first"),
  actionLog: jsonb("action_log"),
  eventLog: jsonb("event_log"),
  actionHash: text("action_hash"),
  integrityHash: text("integrity_hash"),
  hostDeckSnapshot: jsonb("host_deck_snapshot"),
  guestDeckSnapshot: jsonb("guest_deck_snapshot"),
  contentSnapshot: jsonb("content_snapshot"),
  contentHash: text("content_hash"),
  rankedConfigSnapshot: jsonb("ranked_config_snapshot"),
  rankedSeasonId: integer("ranked_season_id").references(() => rankedSeasons.id, { onDelete: "restrict" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Idempotency receipts for retried authoritative PvP actions. */
export const pvpActionReceipts = pgTable("pvp_action_receipts", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  playerId: integer("player_id").notNull(),
  actionId: text("action_id").notNull(),
  resultingVersion: integer("resulting_version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueAction: unique().on(t.roomId, t.playerId, t.actionId),
  validActionId: check("pvp_action_receipts_action_id_length", sql`char_length(${t.actionId}) BETWEEN 8 AND 80`),
}));

/** Immutable state history used to serve a real delayed spectator feed. */
export const pvpSpectatorSnapshots = pgTable("pvp_spectator_snapshots", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  roomVersion: integer("room_version").notNull(),
  gameState: jsonb("game_state").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
}, (t) => ({
  uniqueRoomVersion: unique().on(t.roomId, t.roomVersion),
}));

/** Shared rate-limit counters that work across replicas and restarts. */
export const apiRateLimits = pgTable("api_rate_limits", {
  key: text("key").notNull(),
  windowStart: timestamp("window_start").notNull(),
  count: integer("count").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqueKeyWindow: unique().on(t.key, t.windowStart),
  positiveCount: check("api_rate_limits_count_positive", sql`${t.count} > 0`),
}));

/** Friends system. */
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  friendId: integer("friend_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, blocked
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.friendId),
}));

export const rankedMatches = pgTable("ranked_matches", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  matchId: integer("match_id"),
  opponentName: text("opponent_name").notNull(),
  won: boolean("won").notNull(),
  mmrChange: integer("mmr_change").notNull(),
  mmrBefore: integer("mmr_before").notNull(),
  mmrAfter: integer("mmr_after").notNull(),
  seasonId: integer("season_id").references(() => rankedSeasons.id, { onDelete: "restrict" }),
  rulesVersion: text("rules_version"),
  deckPoolVersion: text("deck_pool_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueMatchApplication: unique().on(t.playerId, t.matchId),
}));

/** Real ranked matchmaking queue. Only players in this table are eligible human opponents. */
export const matchmakingQueue = pgTable("matchmaking_queue", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  deckId: text("deck_id").notNull(),
  mmr: integer("mmr").notNull(),
  mode: text("mode").notNull().default("ranked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.mode),
  mmrNonNegative: check("matchmaking_mmr_non_negative", sql`${t.mmr} >= 0`),
}));

/** Card packs / loot boxes owned by players. */
export const playerPacks = pgTable("player_packs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  packType: text("pack_type").notNull(), // basic, epic, legendary
  count: integer("count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.packType),
  countPositive: check("player_packs_count_positive", sql`${t.count} >= 1`),
}));

/** Pack opening history. */
export const packOpenings = pgTable("pack_openings", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  packType: text("pack_type").notNull(), // basic, epic, legendary
  count: integer("count").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.packType),
  countPositive: check("player_packs_count_positive", sql`${t.count} >= 1`),
}));

/** Pack opening history. */
export const packOpenings = pgTable("pack_openings", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  packType: text("pack_type").notNull(), // basic, epic, legendary
  cardsReceived: text("cards_received").notNull(), // JSON of card defIds
  dustBonus: integer("dust_bonus").notNull().default(0),
  packSeed: integer("pack_seed"),
  contentVersion: text("content_version").notNull().default("2026.08.24"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Chat messages in PvP rooms. */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomCode: text("room_code").notNull(),
  playerName: text("player_name").notNull(),
  playerId: integer("player_id"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});


export type PvpRoom = typeof pvpRooms.$inferSelect;
export type PvpActionReceipt = typeof pvpActionReceipts.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type RankedMatch = typeof rankedMatches.$inferSelect;
export type MatchmakingQueueEntry = typeof matchmakingQueue.$inferSelect;
export type PlayerPack = typeof playerPacks.$inferSelect;
export type PackOpening = typeof packOpenings.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
