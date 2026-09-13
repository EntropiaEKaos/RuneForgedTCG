import { boolean, check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { players } from "./players";
import { cardAssets } from "./marketplace";

export type CardCosmeticKind = "premium_frame" | "full_art" | "foil" | "animated" | "serialized";
export type CardCosmeticAcquisition = "pack" | "event" | "promotion" | "market" | "grant";

export const cardCosmeticVariants = pgTable("card_cosmetic_variants", {
  id: serial("id").primaryKey(),
  defId: text("def_id").notNull(),
  variantId: text("variant_id").notNull(),
  name: text("name").notNull(),
  kind: text("kind").$type<CardCosmeticKind>().notNull(),
  frameId: text("frame_id").notNull().default("default"),
  finish: text("finish").notNull().default("normal"),
  artUrl: text("art_url"),
  animationUrl: text("animation_url"),
  artCrop: jsonb("art_crop").$type<{ x?: number; y?: number; scale?: number }>().notNull().default({}),
  edition: text("edition"),
  serialLimit: integer("serial_limit"),
  acquisition: text("acquisition").$type<CardCosmeticAcquisition>().notNull().default("pack"),
  packEligible: boolean("pack_eligible").notNull().default(false),
  dropWeight: integer("drop_weight").notNull().default(0),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("draft"),
  enabled: boolean("enabled").notNull().default(false),
  createdBy: text("created_by"),
  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  identity: uniqueIndex("card_cosmetic_variants_identity_uidx").on(t.defId, t.variantId),
  publishedByCard: index("card_cosmetic_variants_published_idx").on(t.defId, t.status, t.enabled),
  packPool: index("card_cosmetic_variants_pack_idx").on(t.packEligible, t.status, t.enabled, t.dropWeight),
  kindValid: check("card_cosmetic_variants_kind_valid", sql`${t.kind} IN ('premium_frame','full_art','foil','animated','serialized')`),
  acquisitionValid: check("card_cosmetic_variants_acquisition_valid", sql`${t.acquisition} IN ('pack','event','promotion','market','grant')`),
  statusValid: check("card_cosmetic_variants_status_valid", sql`${t.status} IN ('draft','published','archived')`),
  identityBounds: check("card_cosmetic_variants_identity_bounds", sql`char_length(${t.variantId}) BETWEEN 1 AND 80 AND char_length(${t.frameId}) BETWEEN 1 AND 80 AND char_length(${t.finish}) BETWEEN 1 AND 40 AND char_length(${t.name}) BETWEEN 1 AND 120`),
  dropWeightValid: check("card_cosmetic_variants_drop_weight_valid", sql`${t.dropWeight} BETWEEN 0 AND 1000000`),
  serialLimitValid: check("card_cosmetic_variants_serial_limit_valid", sql`${t.serialLimit} IS NULL OR ${t.serialLimit} > 0`),
}));

/** Exact owned copy selected for rendering a given gameplay defId. */
export const playerCardCosmeticPreferences = pgTable("player_card_cosmetic_preferences", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id, { onDelete: "cascade" }),
  defId: text("def_id").notNull(),
  assetId: integer("asset_id").notNull().references(() => cardAssets.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  playerDef: uniqueIndex("player_card_cosmetic_preferences_player_def_uidx").on(t.playerId, t.defId),
  assetIdx: index("player_card_cosmetic_preferences_asset_idx").on(t.assetId),
}));

export type CardCosmeticVariantRow = typeof cardCosmeticVariants.$inferSelect;
export type PlayerCardCosmeticPreference = typeof playerCardCosmeticPreferences.$inferSelect;
