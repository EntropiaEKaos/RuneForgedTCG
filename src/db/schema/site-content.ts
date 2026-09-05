import { check, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const siteContent = pgTable("site_content", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  slug: text("slug").notNull(),
  locale: text("locale").notNull().default("pt-BR"),
  status: text("status").notNull().default("draft"),
  payload: jsonb("payload").notNull().default({}),
  seo: jsonb("seo").notNull().default({}),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").notNull().default("system"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  resourceSlugLocale: uniqueIndex("site_content_resource_slug_locale_uq").on(table.resource, table.slug, table.locale),
  resourceLocaleStatus: index("site_content_resource_locale_status_idx").on(table.resource, table.locale, table.status),
  statusValid: check("site_content_status_check", sql`${table.status} in ('draft','review','published','archived')`),
  versionPositive: check("site_content_version_positive", sql`${table.version} > 0`),
}));

export const siteContentVersions = pgTable("site_content_versions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull().references(() => siteContent.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  status: text("status").notNull(),
  snapshot: jsonb("snapshot").notNull().default({}),
  actor: text("actor").notNull(),
  changeNote: text("change_note").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  contentVersion: uniqueIndex("site_content_versions_content_version_uq").on(table.contentId, table.version),
  contentCreated: index("site_content_versions_content_created_idx").on(table.contentId, table.createdAt),
  statusValid: check("site_content_versions_status_check", sql`${table.status} in ('draft','review','published','archived')`),
  versionPositive: check("site_content_versions_version_positive", sql`${table.version} > 0`),
}));
