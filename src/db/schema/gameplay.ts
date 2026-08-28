import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";


export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  playerId: integer("player_id"),
  opponentPlayerId: integer("opponent_player_id"),
  deckId: text("deck_id").notNull(),
  deckName: text("deck_name").notNull(),
  won: boolean("won").notNull(),
  rounds: integer("rounds").notNull(),
  nexusRemaining: integer("nexus_remaining").notNull(),
  /**
   * Token gerado no início da partida (/api/matches/token).
   * O cliente deve devolvê-lo ao encerrar; sem ele não grava resultado.
   * Não é secret perfeito (cliente-side), mas bloqueia scripts sem token.
   */
  matchToken: text("match_token"),
  matchMode: text("match_mode").notNull().default("casual"),
  /** Impede que /api/player/update distribua recompensas mais de uma vez. */
  rewardsClaimed: boolean("rewards_claimed").notNull().default(false),
  seed: integer("seed"),
  playerFirst: boolean("player_first"),
  aiDeckId: text("ai_deck_id"),
  aiDeckName: text("ai_deck_name"),
  aiDifficulty: text("ai_difficulty").notNull().default("tactician"),
  actionLog: jsonb("action_log"),
  eventLog: jsonb("event_log"),
  actionHash: text("action_hash"),
  stateHash: text("state_hash"),
  integrityHash: text("integrity_hash"),
  deckSnapshot: jsonb("deck_snapshot"),
  contentHash: text("content_hash").notNull().default(""),
  engineRules: jsonb("engine_rules"),
  aiRules: jsonb("ai_rules"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueTokenPerPlayer: uniqueIndex("matches_match_token_player_unique").on(t.matchToken, t.playerId).where(sql`${t.matchToken} IS NOT NULL AND ${t.playerId} IS NOT NULL`),
}));

/**
 * Tabela de tokens de partida — o servidor emite um token ao início
 * de cada partida e só aceita resultado que apresente o mesmo token.
 * Tokens expiram em 4 horas.
 */
export const matchTokens = pgTable("match_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  mode: text("mode").notNull().default("casual"),
  playerName: text("player_name").notNull(),
  playerId: integer("player_id"),
  deckId: text("deck_id").notNull(),
  deckName: text("deck_name").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  seed: integer("seed"),
  playerFirst: boolean("player_first"),
  aiDeckId: text("ai_deck_id"),
  aiDeckName: text("ai_deck_name"),
  aiDifficulty: text("ai_difficulty").notNull().default("tactician"),
  deckSnapshot: jsonb("deck_snapshot"),
  opponentSnapshot: jsonb("opponent_snapshot"),
  engineRules: jsonb("engine_rules"),
  aiRules: jsonb("ai_rules"),
});

/** Server-authoritative attempt tokens for Puzzle/Boss/Brawl modes. */
export const modeAttempts = pgTable("mode_attempts", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  playerId: integer("player_id").notNull(),
  playerName: text("player_name").notNull(),
  modeType: text("mode_type").notNull(),
  modeId: text("mode_id").notNull(),
  playerDeckId: text("player_deck_id").notNull().default(""),
  seed: integer("seed").notNull(),
  playerFirst: boolean("player_first").notNull(),
  playerDeckSnapshot: jsonb("player_deck_snapshot").notNull(),
  opponentDeckSnapshot: jsonb("opponent_deck_snapshot").notNull(),
  engineRules: jsonb("engine_rules"),
  aiRules: jsonb("ai_rules"),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customDecks = pgTable("custom_decks", {
  id: serial("id").primaryKey(),
  ownerName: text("owner_name").notNull(),
  /** Stable identity; ownerName remains as a display-name snapshot for compatibility. */
  ownerPlayerId: integer("owner_player_id"),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎴"),
  formatId: text("format_id").notNull().default("eternal"),
  cards: text("cards").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const replays = pgTable("replays", {
  id: serial("id").primaryKey(),
  playerName: text("player_name").notNull(),
  playerId: integer("player_id"),
  deckName: text("deck_name").notNull(),
  deckId: text("deck_id"),
  aiDeckName: text("ai_deck_name").notNull(),
  aiDeckId: text("ai_deck_id"),
  aiDifficulty: text("ai_difficulty").notNull().default("tactician"),
  won: boolean("won").notNull(),
  rounds: integer("rounds").notNull(),
  playerFirst: boolean("player_first").notNull(),
  seed: integer("seed").notNull(),
  log: text("log").notNull(),
  actionLog: jsonb("action_log"),
  eventLog: jsonb("event_log"),
  actionHash: text("action_hash"),
  stateHash: text("state_hash"),
  integrityHash: text("integrity_hash"),
  deckSnapshot: jsonb("deck_snapshot"),
  engineRules: jsonb("engine_rules"),
  aiRules: jsonb("ai_rules"),
  canonicalDeckSnapshot: jsonb("canonical_deck_snapshot"),
  matchOptionsSnapshot: jsonb("match_options_snapshot"),
  engineVersion: text("engine_version").notNull().default("1"),
  rulesetVersion: text("ruleset_version").notNull().default("2026.08"),
  matchMode: text("match_mode").notNull().default("casual"),
  opponentPlayerId: integer("opponent_player_id"),
  perspective: text("perspective").notNull().default("player"),
  contentVersion: text("content_version").notNull().default("2026.08.24"),
  contentHash: text("content_hash").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const customCards = pgTable("custom_cards", {
  id: serial("id").primaryKey(),
  defId: text("def_id").notNull().unique(),
  name: text("name").notNull(),
  region: text("region").notNull(),
  type: text("type").notNull(),
  cost: integer("cost").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gameSettings = pgTable("game_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  revision: integer("revision").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type MatchToken = typeof matchTokens.$inferSelect;
export type NewMatchToken = typeof matchTokens.$inferInsert;
export type CustomDeck = typeof customDecks.$inferSelect;
export type NewCustomDeck = typeof customDecks.$inferInsert;
export type Replay = typeof replays.$inferSelect;
export type NewReplay = typeof replays.$inferInsert;
export type CustomCard = typeof customCards.$inferSelect;
export type NewCustomCard = typeof customCards.$inferInsert;
export type GameSetting = typeof gameSettings.$inferSelect;
