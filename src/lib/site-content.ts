import type { AdminRole } from "./admin-auth";

export const SITE_CONTENT_RESOURCES = [
  "home", "navigation", "pages", "cards", "collections", "regions", "keywords",
  "rules", "lore", "news", "media", "seo", "alpha", "events", "promotions", "roadmap",
] as const;

export const SITE_CONTENT_STATUSES = ["draft", "review", "published", "archived"] as const;

export type SiteContentResource = typeof SITE_CONTENT_RESOURCES[number];
export type SiteContentStatus = typeof SITE_CONTENT_STATUSES[number];
export type SitePublicSource = "current" | "history" | null;

const resources = new Set<string>(SITE_CONTENT_RESOURCES);

export function isSiteContentResource(value: string): value is SiteContentResource {
  return resources.has(value);
}

export function canEditSiteContent(role: AdminRole, resource: SiteContentResource) {
  if (role === "admin" || role === "publisher") return true;
  if (role === "qa") return ["cards", "keywords", "rules"].includes(resource);
  if (role === "liveops") return ["news", "alpha", "events", "promotions", "roadmap"].includes(resource);
  return ["home", "navigation", "pages", "cards", "collections", "regions", "keywords", "rules", "lore", "media"].includes(resource);
}

export function canPublishSiteContent(role: AdminRole, resource: SiteContentResource) {
  if (role === "admin" || role === "publisher") return true;
  return role === "liveops" && ["news", "alpha", "events", "promotions"].includes(resource);
}

export function canReadSiteContent(role: AdminRole, resource: SiteContentResource) {
  return canEditSiteContent(role, resource) || canPublishSiteContent(role, resource);
}

function normalizeSlugSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function normalizeSiteSlug(value: string) {
  return value
    .trim()
    .split("/")
    .map(normalizeSlugSegment)
    .filter(Boolean)
    .join("/")
    .slice(0, 160);
}

export function parseSiteLocale(value: unknown): string | null {
  if (value == null || value === "") return "pt-BR";
  if (typeof value !== "string") return null;
  const locale = value.trim();
  return /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) ? locale : null;
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const SITE_CONTENT_PAYLOAD_MAX_BYTES = 256 * 1024;
export const SITE_CONTENT_SEO_MAX_BYTES = 64 * 1024;

export function validateSiteDocument(value: unknown, maxBytes: number, label: string) {
  if (!isPlainRecord(value)) return `${label} must be an object`;
  const bytes = Buffer.byteLength(JSON.stringify(value), "utf8");
  return bytes <= maxBytes ? null : `${label} exceeds ${maxBytes} bytes`;
}

export function sanitizeSiteChangeNote(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

export function parseExpectedSiteVersion(value: unknown): number | null {
  const version = typeof value === "number" ? value : Number(value);
  return Number.isInteger(version) && version >= 0 ? version : null;
}

export function siteContentLockKey(resource: SiteContentResource, slug: string, locale: string) {
  return `runeforge:site:${resource}:${locale}:${slug}`;
}


export function resolveSitePublicSource(
  currentStatus: string,
  latestLifecycleStatus: string | null | undefined,
): SitePublicSource {
  if (currentStatus === "archived") return null;
  if (currentStatus === "published") return "current";
  return latestLifecycleStatus === "published" ? "history" : null;
}
