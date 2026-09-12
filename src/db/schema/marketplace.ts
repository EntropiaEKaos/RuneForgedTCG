import { boolean, check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";

/**
 * A single collectible copy owned by one player. Gameplay still consumes the
 * aggregate player_cards table; this table gives the market a stable identity
 * for frames, finishes and future collectible variants without changing card
 * rules or deck legality.
 */
export const cardAssets = pgTable("card_assets", {
  id: serial("id").primaryKey(),
  ownerPlayerId: integer("owner_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  defId: text("def_id").notNull(),
  variantId: text("variant_id").notNull().default("standard"),
  frameId: text("frame_id").notNull().default("default"),
  finish: text("finish").notNull().default("normal"),
  tradable: boolean("tradable").notNull().default(true),
  source: text("source").notNull().default("legacy"),
  acquiredAt: timestamp("acquired_at").notNull().defaultNow(),
}, (t) => ({
  ownerDefIdx: index("card_assets_owner_def_idx").on(t.ownerPlayerId, t.defId),
  collectibleIdx: index("card_assets_collectible_idx").on(t.defId, t.variantId, t.frameId, t.finish),
  variantBounds: check("card_assets_variant_bounds", sql`char_length(${t.variantId}) BETWEEN 1 AND 80 AND char_length(${t.frameId}) BETWEEN 1 AND 80 AND char_length(${t.finish}) BETWEEN 1 AND 40`),
}));

export const marketplaceSettings = pgTable("marketplace_settings", {
  id: integer("id").primaryKey().default(1),
  enabled: boolean("enabled").notNull().default(true),
  feeBps: integer("fee_bps").notNull().default(500),
  minPriceGold: integer("min_price_gold").notNull().default(1),
  maxPriceGold: integer("max_price_gold").notNull().default(1_000_000),
  maxActiveListings: integer("max_active_listings").notNull().default(20),
  listingDurationHours: integer("listing_duration_hours").notNull().default(72),
  tradeDurationHours: integer("trade_duration_hours").notNull().default(72),
  maxTradeCardsPerSide: integer("max_trade_cards_per_side").notNull().default(5),
  minPlayerLevel: integer("min_player_level").notNull().default(1),
  minAccountAgeHours: integer("min_account_age_hours").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
}, (t) => ({
  singleton: check("marketplace_settings_singleton", sql`${t.id} = 1`),
  feeBounds: check("marketplace_settings_fee_bounds", sql`${t.feeBps} BETWEEN 0 AND 5000`),
  priceBounds: check("marketplace_settings_price_bounds", sql`${t.minPriceGold} >= 1 AND ${t.maxPriceGold} >= ${t.minPriceGold}`),
  listingBounds: check("marketplace_settings_listing_bounds", sql`${t.maxActiveListings} BETWEEN 1 AND 200 AND ${t.listingDurationHours} BETWEEN 1 AND 720`),
  tradeBounds: check("marketplace_settings_trade_bounds", sql`${t.tradeDurationHours} BETWEEN 1 AND 720 AND ${t.maxTradeCardsPerSide} BETWEEN 1 AND 20`),
  accessBounds: check("marketplace_settings_access_bounds", sql`${t.minPlayerLevel} >= 1 AND ${t.minAccountAgeHours} >= 0`),
}));

export const marketListings = pgTable("market_listings", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => cardAssets.id, { onDelete: "restrict" }),
  sellerPlayerId: integer("seller_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  buyerPlayerId: integer("buyer_player_id").references(() => players.id, { onDelete: "set null" }),
  priceGold: integer("price_gold").notNull(),
  feeGold: integer("fee_gold").notNull().default(0),
  status: text("status").notNull().default("active"),
  listedAt: timestamp("listed_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  activeAsset: uniqueIndex("market_listings_active_asset_uidx").on(t.assetId).where(sql`${t.status} = 'active'`),
  activePriceIdx: index("market_listings_active_price_idx").on(t.status, t.priceGold, t.expiresAt),
  sellerIdx: index("market_listings_seller_idx").on(t.sellerPlayerId, t.status),
  statusValid: check("market_listings_status_valid", sql`${t.status} IN ('active','sold','cancelled','expired')`),
  pricePositive: check("market_listings_price_positive", sql`${t.priceGold} >= 1 AND ${t.feeGold} >= 0 AND ${t.feeGold} <= ${t.priceGold}`),
}));

/**
 * One row means the asset is escrow-locked. The PK guarantees a collectible
 * copy can participate in at most one live market operation across listings
 * and direct trades.
 */
export const cardAssetLocks = pgTable("card_asset_locks", {
  assetId: integer("asset_id").primaryKey().references(() => cardAssets.id, { onDelete: "cascade" }),
  ownerPlayerId: integer("owner_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  referenceId: integer("reference_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index("card_asset_locks_owner_idx").on(t.ownerPlayerId, t.kind),
  referenceIdx: index("card_asset_locks_reference_idx").on(t.kind, t.referenceId),
  kindValid: check("card_asset_locks_kind_valid", sql`${t.kind} IN ('listing','trade')`),
}));

export type TradeRequestedAsset = {
  defId: string;
  variantId?: string;
  frameId?: string;
  finish?: string;
};

export const tradeOffers = pgTable("trade_offers", {
  id: serial("id").primaryKey(),
  proposerPlayerId: integer("proposer_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  recipientPlayerId: integer("recipient_player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  requestedAssets: jsonb("requested_assets").$type<TradeRequestedAsset[]>().notNull().default([]),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  proposerIdx: index("trade_offers_proposer_idx").on(t.proposerPlayerId, t.status),
  recipientIdx: index("trade_offers_recipient_idx").on(t.recipientPlayerId, t.status),
  statusValid: check("trade_offers_status_valid", sql`${t.status} IN ('active','accepted','declined','cancelled','expired')`),
  differentPlayers: check("trade_offers_different_players", sql`${t.proposerPlayerId} <> ${t.recipientPlayerId}`),
}));

export type CardAsset = typeof cardAssets.$inferSelect;
export type MarketListing = typeof marketListings.$inferSelect;
export type TradeOffer = typeof tradeOffers.$inferSelect;
