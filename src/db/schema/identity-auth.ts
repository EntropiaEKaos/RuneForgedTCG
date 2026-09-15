import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";

export const authProviderSettings = pgTable("auth_provider_settings", {
  provider: text("provider").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  clientId: text("client_id").notNull().default(""),
  secretEncrypted: text("secret_encrypted"),
  metadata: jsonb("metadata").notNull().default({}),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  providerCheck: check("auth_provider_settings_provider_check", sql`${t.provider} IN ('google','discord','email')`),
  revisionPositive: check("auth_provider_settings_revision_positive", sql`${t.revision} > 0`),
}));

export const playerIdentities = pgTable("player_identities", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  providerSubject: text("provider_subject").notNull(),
  email: text("email"),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at").defaultNow().notNull(),
}, (t) => ({
  providerSubjectUnique: unique("player_identities_provider_subject_unique").on(t.provider, t.providerSubject),
  playerLookup: index("player_identities_player_idx").on(t.playerId),
  providerCheck: check("player_identities_provider_check", sql`${t.provider} IN ('google','discord','email')`),
}));

export const authLoginTokens = pgTable("auth_login_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  provider: text("provider").notNull().default("email"),
  subject: text("subject").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  subjectLookup: index("auth_login_tokens_subject_idx").on(t.provider, t.subject),
  expiryLookup: index("auth_login_tokens_expiry_idx").on(t.expiresAt),
  providerCheck: check("auth_login_tokens_provider_check", sql`${t.provider} IN ('email')`),
}));

export type AuthProviderSetting = typeof authProviderSettings.$inferSelect;
export type PlayerIdentity = typeof playerIdentities.$inferSelect;
