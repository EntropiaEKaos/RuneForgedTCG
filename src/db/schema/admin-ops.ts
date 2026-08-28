import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Automated, deterministic CardDef regression cases owned by Content Studio. */
export const adminCardLabRuns = pgTable("admin_card_lab_runs", {
  id: serial("id").primaryKey(), cardId: integer("card_id"), defId: text("def_id").notNull(), iterations: integer("iterations").notNull().default(12),
  passed: integer("passed").notNull().default(0), failed: integer("failed").notNull().default(0), report: jsonb("report").notNull().default({}),
  engineVersion: text("engine_version").notNull(), rulesetVersion: text("ruleset_version").notNull(), contentVersion: text("content_version").notNull(), createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminCardTests = pgTable("admin_card_tests", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  name: text("name").notNull(),
  scenario: jsonb("scenario").notNull().default({}),
  expected: jsonb("expected").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const adminCardTestRuns = pgTable("admin_card_test_runs", {
  id: serial("id").primaryKey(),
  testId: integer("test_id"),
  cardId: integer("card_id").notNull(),
  passed: boolean("passed").notNull().default(false),
  actual: jsonb("actual").notNull().default({}),
  errors: jsonb("errors").notNull().default([]),
  engineVersion: text("engine_version").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Multi-stage content approval workflow for production publishing. */
export const adminApprovalRequests = pgTable("admin_approval_requests", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id").notNull(),
  stage: text("stage").notNull().default("content"), // content, qa, liveops
  contentHash: text("content_hash").notNull().default(""),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  requestedBy: text("requested_by").notNull().default("admin"),
  decidedBy: text("decided_by"),
  note: text("note").notNull().default(""),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
});

/** Persisted aggregate runs from the Studio Balance Lab. */

/** Balance Lab batch experiments and persisted matchup matrix rows. */
export const adminBalanceExperiments = pgTable("admin_balance_experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull().default("matrix"),
  gamesPerMatchup: integer("games_per_matchup").notNull(),
  seed: integer("seed").notNull(),
  deckIds: jsonb("deck_ids").notNull().default([]),
  totalGames: integer("total_games").notNull().default(0),
  completedGames: integer("completed_games").notNull().default(0),
  status: text("status").notNull().default("completed"),
  engineVersion: text("engine_version").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const adminBalanceMatchups = pgTable("admin_balance_matchups", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  deckA: text("deck_a").notNull(),
  deckB: text("deck_b").notNull(),
  requestedGames: integer("requested_games").notNull(),
  completedGames: integer("completed_games").notNull().default(0),
  winsA: integer("wins_a").notNull().default(0),
  winsB: integer("wins_b").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  avgRounds: integer("avg_rounds").notNull().default(0),
  winRateA: integer("win_rate_a").notNull().default(0),
  winRateB: integer("win_rate_b").notNull().default(0),
  seed: integer("seed").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSimulationRuns = pgTable("admin_simulation_runs", {
  id: serial("id").primaryKey(),
  mode: text("mode").notNull().default("ai-vs-ai"),
  deckA: text("deck_a").notNull(),
  deckB: text("deck_b").notNull(),
  requestedGames: integer("requested_games").notNull(),
  completedGames: integer("completed_games").notNull().default(0),
  winsA: integer("wins_a").notNull().default(0),
  winsB: integer("wins_b").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  avgRounds: integer("avg_rounds").notNull().default(0),
  seed: integer("seed").notNull(),
  engineVersion: text("engine_version").notNull(),
  rulesetVersion: text("ruleset_version").notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Versioned control-plane definitions for systems that used to be code-only.
 *
 * The payload remains JSON because each domain has a different contract (deck,
 * mode, AI profile, theme, engine phase...). Runtime readers still validate the
 * domain contract before an enabled/published row is allowed to override a
 * built-in definition.
 */
export const adminGameDefinitions = pgTable("admin_game_definitions", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("draft"),
  dangerLevel: text("danger_level").notNull().default("safe"),
  schemaVersion: integer("schema_version").notNull().default(1),
  revision: integer("revision").notNull().default(1),
  payload: jsonb("payload").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqueDomainKey: unique().on(t.domain, t.key),
  validRevision: check("admin_game_definitions_revision_positive", sql`${t.revision} > 0`),
}));

export type AdminGameDefinition = typeof adminGameDefinitions.$inferSelect;
