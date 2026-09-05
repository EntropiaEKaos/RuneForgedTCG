import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const adminItem = read("src/app/api/admin/site/[resource]/[slug]/route.ts");
const publish = read("src/app/api/admin/site/[resource]/[slug]/publish/route.ts");
const archive = read("src/app/api/admin/site/[resource]/[slug]/archive/route.ts");
const rollback = read("src/app/api/admin/site/[resource]/[slug]/rollback/[version]/route.ts");
const publicList = read("src/app/api/public/site/[resource]/route.ts");
const publicItem = read("src/app/api/public/site/[resource]/[slug]/route.ts");
const publicContinuity = read("src/lib/site-content-public.ts");
const policy = read("src/lib/site-content.ts");
const migration = read("drizzle/0042_site_portal_cms.sql");
const bootstrap = read("scripts/database-bootstrap.ts");
const upgrade = read("scripts/database-upgrade-2.31.ts");
const schemaIndex = read("src/db/schema.ts");
const postgresCert = read("scripts/site-cms-postgres-certification.ts");
const ciWorkflow = read(".github/workflows/ci.yml");

for (const source of [adminItem, publish, archive, rollback]) {
  assert.match(source, /isAdminAuthorized/);
  assert.match(source, /parseExpectedSiteVersion/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /for\("update"\)/);
  assert.match(source, /siteContentVersions/);
  assert.match(source, /adminAuditLogs/);
  assert.match(source, /Version conflict/);
}

assert.match(adminItem, /SITE_CONTENT_PAYLOAD_MAX_BYTES/);
assert.match(adminItem, /SITE_CONTENT_SEO_MAX_BYTES/);
assert.match(adminItem, /validateSiteDocument/);
assert.match(adminItem, /expectedVersion !== currentVersion/);
assert.match(publish, /status:\s*"published"/);
assert.match(archive, /status:\s*"archived"/);
assert.match(rollback, /status:\s*"draft"/);
assert.match(rollback, /Version not found/);

for (const source of [publicList, publicItem]) {
  assert.match(source, /site-content-public/);
  assert.doesNotMatch(source, /adminAuditLogs|siteContentVersions|isAdminAuthorized/);
}

assert.match(publicContinuity, /current\.status === "archived"/);
assert.match(publicContinuity, /current\.status === "published"/);
assert.match(publicContinuity, /eq\(siteContentVersions\.status, "published"\)/);
assert.match(publicContinuity, /orderBy\(desc\(siteContentVersions\.version\)\)/);
assert.match(publicContinuity, /latestPublished/);
assert.doesNotMatch(publicContinuity, /siteContentVersions\.actor|siteContentVersions\.changeNote/);

assert.match(policy, /SITE_CONTENT_RESOURCES/);
assert.match(policy, /canEditSiteContent/);
assert.match(policy, /canPublishSiteContent/);
assert.match(policy, /SITE_CONTENT_PAYLOAD_MAX_BYTES/);
assert.match(policy, /siteContentLockKey/);

assert.match(migration, /CREATE TABLE IF NOT EXISTS site_content/i);
assert.match(migration, /CREATE TABLE IF NOT EXISTS site_content_versions/i);
assert.match(migration, /site_content_status_check/);
assert.match(migration, /site_content_versions_status_check/);
assert.match(migration, /ON DELETE CASCADE/i);
assert.match(migration, /site_content_resource_locale_status_idx/);
assert.match(migration, /site_content_versions_content_created_idx/);

assert.match(bootstrap, /0042_site_portal_cms\.sql/);
assert.match(upgrade, /const siteCmsMigration = "drizzle\/0042_site_portal_cms\.sql"/);
assert.ok((upgrade.match(/siteCmsMigration/g) || []).length >= 4, "canonical upgrade must apply CMS to current, repair and historical paths");
assert.match(schemaIndex, /schema\/site-content/);
assert.match(postgresCert, /PORTAL CMS POSTGRES CERTIFICATION: PASS/);
assert.match(postgresCert, /pg_try_advisory_xact_lock/);
assert.match(postgresCert, /23505/);
assert.match(postgresCert, /23514/);
assert.match(ciWorkflow, /Portal CMS PostgreSQL certification/);
assert.match(ciWorkflow, /npm run db:upgrade/);
assert.match(ciWorkflow, /site-cms-postgres-certification\.ts/);

console.log("PORTAL CMS API SOURCE CONTRACT: PASS — RBAC + continuous published snapshots + bounded JSON + optimistic version + DB locks + version/audit history");
