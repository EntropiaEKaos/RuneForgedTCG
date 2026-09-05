import assert from "node:assert/strict";
import {
  SITE_CONTENT_RESOURCES,
  canEditSiteContent,
  canPublishSiteContent,
  canReadSiteContent,
  isPlainRecord,
  isSiteContentResource,
  normalizeSiteSlug,
  parseSiteLocale,
  sanitizeSiteChangeNote,
} from "./site-content";

for (const resource of SITE_CONTENT_RESOURCES) assert.equal(isSiteContentResource(resource), true);
assert.equal(isSiteContentResource("unknown"), false);

assert.equal(canEditSiteContent("admin", "seo"), true);
assert.equal(canPublishSiteContent("admin", "seo"), true);
assert.equal(canReadSiteContent("admin", "seo"), true);
assert.equal(canEditSiteContent("publisher", "roadmap"), true);
assert.equal(canPublishSiteContent("publisher", "roadmap"), true);

assert.equal(canEditSiteContent("designer", "home"), true);
assert.equal(canEditSiteContent("designer", "seo"), false);
assert.equal(canPublishSiteContent("designer", "home"), false);
assert.equal(canReadSiteContent("designer", "home"), true);
assert.equal(canReadSiteContent("designer", "seo"), false);

assert.equal(canEditSiteContent("qa", "cards"), true);
assert.equal(canEditSiteContent("qa", "home"), false);
assert.equal(canPublishSiteContent("qa", "cards"), false);

assert.equal(canEditSiteContent("liveops", "roadmap"), true);
assert.equal(canPublishSiteContent("liveops", "news"), true);
assert.equal(canPublishSiteContent("liveops", "roadmap"), false);

assert.equal(normalizeSiteSlug("  História / Início  "), "historia/inicio");
assert.equal(normalizeSiteSlug("///News///Patch   Notes///"), "news/patch-notes");
assert.equal(normalizeSiteSlug("___"), "");

assert.equal(parseSiteLocale(undefined), "pt-BR");
assert.equal(parseSiteLocale("pt-BR"), "pt-BR");
assert.equal(parseSiteLocale("en-US"), "en-US");
assert.equal(parseSiteLocale("pt-br"), null);
assert.equal(parseSiteLocale("invalid"), null);

assert.equal(isPlainRecord({}), true);
assert.equal(isPlainRecord([]), false);
assert.equal(isPlainRecord(null), false);
assert.equal(sanitizeSiteChangeNote("  release note  "), "release note");
assert.equal(sanitizeSiteChangeNote(null, "fallback"), "fallback");

console.log(`SITE CONTENT POLICY: PASS — ${SITE_CONTENT_RESOURCES.length} resources + RBAC + slug/locale validation`);
