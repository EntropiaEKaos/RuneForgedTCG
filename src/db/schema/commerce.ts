import { pgTable, serial, text, integer, boolean, timestamp, jsonb, unique, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { players } from "./players";
import { sql } from "drizzle-orm";

/** Encrypted server-side configuration for real-money payment gateways. */
export const paymentGatewaySettings = pgTable("payment_gateway_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  environment: text("environment").notNull().default("sandbox"),
  publicKey: text("public_key").notNull().default(""),
  accessTokenEncrypted: text("access_token_encrypted"),
  webhookSecretEncrypted: text("webhook_secret_encrypted"),
  statementDescriptor: text("statement_descriptor").notNull().default("RUNEFORGE"),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  revisionPositive: check("payment_gateway_settings_revision_positive", sql`${t.revision} > 0`),
  environmentValid: check("payment_gateway_settings_environment_check", sql`${t.environment} in ('sandbox','production')`),
}));

/** Local order is the source of truth; the provider only confirms payment state. */
export const paymentOrders = pgTable("payment_orders", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  provider: text("provider").notNull().default("mercadopago"),
  providerEnvironment: text("provider_environment").notNull().default("sandbox"),
  externalReference: text("external_reference").notNull().unique(),
  productKey: text("product_key").notNull(),
  productName: text("product_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("BRL"),
  status: text("status").notNull().default("created"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  providerPreferenceId: text("provider_preference_id"),
  providerPaymentId: text("provider_payment_id"),
  grants: jsonb("grants").notNull().default({}),
  providerPayload: jsonb("provider_payload").notNull().default({}),
  approvedAt: timestamp("approved_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  amountPositive: check("payment_orders_amount_positive", sql`${t.amountCents} > 0`),
  environmentValid: check("payment_orders_environment_check", sql`${t.providerEnvironment} in ('sandbox','production')`),
  playerCreatedIdx: index("payment_orders_player_created_idx").on(t.playerId, t.createdAt),
  statusIdx: index("payment_orders_status_idx").on(t.status, t.createdAt),
  providerPaymentUnique: uniqueIndex("payment_orders_provider_payment_unique").on(t.provider, t.providerPaymentId).where(sql`${t.providerPaymentId} is not null`),
}));

/** One milestone reward per player/collection/progress threshold. */
export const collectionRewardClaims = pgTable("collection_reward_claims", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  collectionKey: text("collection_key").notNull(),
  milestone: integer("milestone").notNull(),
  grants: jsonb("grants").notNull().default({}),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.playerId, t.collectionKey, t.milestone),
  milestoneBounds: check("collection_reward_claims_milestone_bounds", sql`${t.milestone} > 0 AND ${t.milestone} <= 100`),
  playerIdx: index("collection_reward_claims_player_idx").on(t.playerId, t.collectionKey),
}));

/** Short-lived unpublished card snapshot used by the Studio game sandbox. */
export const adminSandboxSessions = pgTable("admin_sandbox_sessions", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  actorId: text("actor_id").notNull(),
  card: jsonb("card").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({ expiresIdx: index("admin_sandbox_sessions_expires_idx").on(t.expiresAt) }));

/** Privacy-conscious first-party product telemetry; no payment credentials live here. */
export const telemetryEvents = pgTable("telemetry_events", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  sessionId: text("session_id"),
  eventName: text("event_name").notNull(),
  properties: jsonb("properties").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  nameCreatedIdx: index("telemetry_events_name_created_idx").on(t.eventName, t.createdAt),
  playerCreatedIdx: index("telemetry_events_player_created_idx").on(t.playerId, t.createdAt).where(sql`${t.playerId} is not null`),
}));

export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type PaymentGatewaySetting = typeof paymentGatewaySettings.$inferSelect;
