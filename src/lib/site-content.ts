import type { AdminRole } from "./admin-auth";

export const SITE_CONTENT_RESOURCES = [
  "home", "navigation", "pages", "cards", "collections", "regions", "keywords",
  "rules", "lore", "news", "media", "seo", "alpha", "events", "promotions", "roadmap",
] as const;

export type SiteContentResource = typeof SITE_CONTENT_RESOURCES[number];

const resources = new Set<string>(SITE_CONTENT_RESOURCES);

export function isSiteContentResource(value: string): value is SiteContentResource {
  return resources.has(value);
}

export function canEditSiteContent(role: AdminRole, resource: SiteContentResource) {
  if (role === "admin") return true;
  if (role === "publisher") return true;
  if (role === "qa") return ["cards", "keywords", "rules"].includes(resource);
  if (role === "liveops") return ["news", "alpha", "events", "promotions", "roadmap"].includes(resource);
  return ["home", "navigation", "pages", "cards", "collections", "regions", "keywords", "rules", "lore", "media"].includes(resource);
}

export function canPublishSiteContent(role: AdminRole, resource: SiteContentResource) {
  if (role === "admin" || role === "publisher") return true;
  return role === "liveops" && ["news", "alpha", "events", "promotions"].includes(resource);
}

export function normalizeSiteSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/-+/g, "-").replace(/^[-/]+|[-/]+$/g, "").slice(0, 160);
}

export function normalizeLocale(value: unknown) {
  const locale = typeof value === "string" ? value.trim() : "pt-BR";
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : "pt-BR";
}
