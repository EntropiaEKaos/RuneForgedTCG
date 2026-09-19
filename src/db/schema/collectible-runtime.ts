import { check, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { customDecks } from "./gameplay";
import { players } from "./players";
import { cardAssets } from "./marketplace";

/**
 * Presentation preference scoped to one saved deck. Gameplay legality and
 * snapshots continue to consume custom_decks.cards (defIds only).
 */
export const deckCardPrintingPreferences = pgTable("deck_card_printing_preferences", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => customDecks.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  defId: text("def_id").notNull(),
  assetId: integer("asset_id").notNull().references(() => cardAssets.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  deckDef: uniqueIndex("deck_card_printing_preferences_deck_def_uidx").on(t.deckId, t.defId),
  playerDeck: index("deck_card_printing_preferences_player_deck_idx").on(t.playerId, t.deckId),
  assetIdx: index("deck_card_printing_preferences_asset_idx").on(t.assetId),
  defBounds: check("deck_card_printing_preferences_def_bounds", sql`char_length(${t.defId}) BETWEEN 1 AND 120`),
}));

/**
 * Idempotency/audit record for event or promotion collectible upgrades.
 * The asset reference is nullable so historical provenance survives a later
 * legitimate asset deletion while ownership continues to live in card_assets.
 */
export const collectibleCampaignClaims = pgTable("collectible_campaign_claims", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  campaignType: text("campaign_type").notNull(),
  campaignKey: text("campaign_key").notNull(),
  defId: text("def_id").notNull(),
  variantId: text("variant_id").notNull(),
  assetId: integer("asset_id").references(() => cardAssets.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
}, (t) => ({
  claimIdentity: uniqueIndex("collectible_campaign_claims_identity_uidx").on(t.playerId, t.campaignType, t.campaignKey, t.defId, t.variantId),
  playerIdx: index("collectible_campaign_claims_player_idx").on(t.playerId, t.claimedAt),
  campaignIdx: index("collectible_campaign_claims_campaign_idx").on(t.campaignType, t.campaignKey),
  campaignTypeValid: check("collectible_campaign_claims_type_valid", sql`${t.campaignType} IN ('event','promotion')`),
  keyBounds: check("collectible_campaign_claims_key_bounds", sql`char_length(${t.campaignKey}) BETWEEN 1 AND 120 AND char_length(${t.defId}) BETWEEN 1 AND 120 AND char_length(${t.variantId}) BETWEEN 1 AND 80`),
}));

export type DeckCardPrintingPreference = typeof deckCardPrintingPreferences.$inferSelect;
export type CollectibleCampaignClaim = typeof collectibleCampaignClaims.$inferSelect;
