import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(), username: text("username").notNull().unique(), passwordSalt: text("password_salt").notNull(), passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("designer"), enabled: boolean("enabled").notNull().default(true), mfaSecret: text("mfa_secret"),
  createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminSessions = pgTable("admin_sessions", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  actorId: text("actor_id").notNull(),
  roleAtLogin: text("role_at_login").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const adminKeywords = pgTable("admin_keywords", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  engineKeyword: text("engine_keyword"),
  behavior: jsonb("behavior").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminEffects = pgTable("admin_effects", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull(),
  schema: jsonb("schema").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminCardArchetypes = pgTable("admin_card_archetypes", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  baseType: text("base_type").notNull(),
  definition: jsonb("definition").notNull().default({}),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminRaces = pgTable("admin_races", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  region: text("region"),
  color: text("color"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminClasses = pgTable("admin_classes", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  color: text("color"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminInteractions = pgTable("admin_interactions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull(),
  sourceKey: text("source_key").notNull(),
  targetType: text("target_type").notNull(),
  targetKey: text("target_key").notNull(),
  condition: jsonb("condition").notNull().default({}),
  effect: jsonb("effect").notNull().default({}),
  priority: integer("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminCollections = pgTable("admin_collections", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  code: text("code").notNull().unique(),
  symbol: text("symbol"),
  banner: text("banner"),
  releaseDate: timestamp("release_date"),
  rotationDate: timestamp("rotation_date"),
  status: text("status").notNull().default("draft"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export const cardCatalogMeta = pgTable("card_catalog_meta", {
  id: serial("id").primaryKey(),
  defId: text("def_id").notNull().unique(),
  collectionId: integer("collection_id"),
  tags: jsonb("tags").notNull().default([]),
  classKeys: jsonb("class_keys").notNull().default([]),
  raceKeys: jsonb("race_keys").notNull().default([]),
  releaseState: text("release_state").notNull().default("draft"),
  artUrl: text("art_url"),
  artCrop: jsonb("art_crop").notNull().default({}),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adminEvents = pgTable("admin_events", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("event"),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  rules: jsonb("rules").notNull().default({}),
  rewards: jsonb("rewards").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});


export const adminContentVersions = pgTable("admin_content_versions", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id").notNull(),
  version: integer("version").notNull(),
  status: text("status").notNull().default("draft"),
  snapshot: jsonb("snapshot").notNull().default({}),
  changeNote: text("change_note").notNull().default(""),
  author: text("author").notNull().default("admin"),
  engineVersion: text("engine_version"),
  rulesetVersion: text("ruleset_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminContentReleases = pgTable("admin_content_releases", {
  id: serial("id").primaryKey(), version: integer("version").notNull(), contentHash: text("content_hash").notNull().unique(),
  manifest: jsonb("manifest").notNull().default({}), actor: text("actor").notNull(), active: boolean("active").notNull().default(false), createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminContentDependencies = pgTable("admin_content_dependencies", {
  id: serial("id").primaryKey(), resource: text("resource").notNull(), resourceId: integer("resource_id").notNull(),
  contentVersion: text("content_version").notNull().default(""), graph: jsonb("graph").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id"),
  actor: text("actor").notNull().default("admin"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminQaRuns = pgTable("admin_qa_runs", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id"),
  passed: boolean("passed").notNull().default(false),
  checks: jsonb("checks").notNull().default([]),
  errors: jsonb("errors").notNull().default([]),
  warnings: jsonb("warnings").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminPromotions = pgTable("admin_promotions", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("store"),
  status: text("status").notNull().default("draft"),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  conditions: jsonb("conditions").notNull().default({}),
  offers: jsonb("offers").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
