import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const playerSessions = pgTable("player_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  playerId: integer("player_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  recoveryKeyHash: text("recovery_key_hash"),
  recoveryKeyExpiresAt: timestamp("recovery_key_expires_at"),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  gold: integer("gold").notNull().default(100),
  dust: integer("dust").notNull().default(0),
  // Ranked
  mmr: integer("mmr").notNull().default(1000),
  peakMmr: integer("peak_mmr").notNull().default(1000),
  rankedWins: integer("ranked_wins").notNull().default(0),
  rankedLosses: integer("ranked_losses").notNull().default(0),
  rankedGamesInPlacement: integer("ranked_games_in_placement").notNull().default(10),
  // Login streak
  loginStreak: integer("login_streak").notNull().default(0),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastDaily: timestamp("last_daily"),
  // Cosmetics
  avatar: text("avatar").default("🎮"),
  cardBack: text("card_back").default("default"),
  title: text("title").default("Rookie"),
  bio: text("bio").default(""),
  banner: text("banner").default("default"),
  status: text("status").notNull().default("active"),
  badges: jsonb("badges").notNull().default([]),
  moderatorNote: text("moderator_note"),
}, (t) => ({
  nonNegativeEconomy: check("players_economy_non_negative", sql`${t.xp} >= 0 AND ${t.gold} >= 0 AND ${t.dust} >= 0`),
  nonNegativeRanked: check("players_ranked_non_negative", sql`${t.mmr} >= 0 AND ${t.peakMmr} >= 0 AND ${t.rankedWins} >= 0 AND ${t.rankedLosses} >= 0 AND ${t.rankedGamesInPlacement} >= 0`),
}));

export const economyTransactions = pgTable("economy_transactions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  currency: text("currency").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const economyActionReceipts = pgTable("economy_action_receipts", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  operationId: text("operation_id").notNull(),
  action: text("action").notNull(),
  response: jsonb("response").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.operationId),
  operationIdBounds: check("economy_action_receipts_operation_id_length", sql`char_length(${t.operationId}) BETWEEN 16 AND 100`),
}));

export const playerCards = pgTable("player_cards", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  defId: text("def_id").notNull(),
  count: integer("count").notNull().default(1),
  shiny: boolean("shiny").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.defId),
  countBounds: check("player_cards_count_bounds", sql`${t.count} >= 1`),
}));

export const sharedDecks = pgTable("shared_decks", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  region1: text("region1").notNull(),
  region2: text("region2"),
  region3: text("region3"),
  cards: text("cards").notNull(),
  archetype: text("archetype").default("Custom"),
  formatId: text("format_id").notNull().default("eternal"),
  upvotes: integer("upvotes").notNull().default(0),
  downloads: integer("downloads").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sharedDeckVotes = pgTable("shared_deck_votes", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  deckId: integer("deck_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uniq: unique().on(t.playerId, t.deckId) }));

export const sharedDeckDownloads = pgTable("shared_deck_downloads", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  deckId: integer("deck_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ uniq: unique().on(t.playerId, t.deckId) }));

export const modeRewards = pgTable("mode_rewards", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  modeType: text("mode_type").notNull(),
  modeId: text("mode_id").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
}, (t) => ({ uniq: unique().on(t.playerId, t.modeType, t.modeId) }));

export const playerAchievements = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  achievementId: text("achievement_id").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.achievementId),
}));

export const playerDailies = pgTable("player_dailies", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull(),
  questId: text("quest_id").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  claimedAt: timestamp("claimed_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.questId),
}));


export type Player = typeof players.$inferSelect;
export type NewPlayer = typeof players.$inferInsert;
export type PlayerCard = typeof playerCards.$inferSelect;
export type NewPlayerCard = typeof playerCards.$inferInsert;
export type SharedDeck = typeof sharedDecks.$inferSelect;
export type NewSharedDeck = typeof sharedDecks.$inferInsert;
export type PlayerAchievement = typeof playerAchievements.$inferSelect;
export type PlayerDaily = typeof playerDailies.$inferSelect;
