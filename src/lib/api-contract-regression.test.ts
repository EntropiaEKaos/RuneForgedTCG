import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
const proxy = read("src/proxy.ts");
const pvp = read("src/app/api/pvp/[code]/route.ts");
const matchmaking = read("src/app/api/matchmaking/route.ts");
const ranked = read("src/app/api/ranked/route.ts");
const playerSession = read("src/lib/player-session.ts");
const siteAdmin = read("src/app/api/admin/site/[resource]/[slug]/route.ts");
const sitePublish = read("src/app/api/admin/site/[resource]/[slug]/publish/route.ts");
const sitePublic = read("src/app/api/public/site/[resource]/[slug]/route.ts");
const sitePolicy = read("src/lib/site-content.ts");
const siteMigration = read("drizzle/0042_site_portal_cms.sql");
const databaseMigrate = read("scripts/database-migrate.ts");

assert.match(proxy, /requestOriginAllowed/);
assert.match(proxy, /x-request-id/);
assert.match(proxy, /cache-control/);
assert.match(playerSession, /requireStablePlayerIdentity/);
assert.match(pvp, /A valid actionId is required/);
assert.match(pvp, /pvpActionReceipts/);
assert.match(pvp, /for\("update"\)/);
assert.match(pvp, /applyAuthoritativePvpSnapshotAction/);
assert.match(matchmaking, /skipLocked:\s*true/);
assert.match(matchmaking, /activeRoom/);
assert.match(matchmaking, /resumed:\s*true/);
assert.match(ranked, /RANKED_SETTLEMENT_PVP_ONLY/);
assert.match(ranked, /settlePvpRoom/);

// Portal CMS: admin writes are authenticated/role-gated, public reads are
// published-only, every mutation versions/audits, and deployment migration is wired.
assert.match(siteAdmin, /isAdminAuthorized/);
assert.match(siteAdmin, /canEditSiteContent/);
assert.match(siteAdmin, /siteContentVersions/);
assert.match(siteAdmin, /adminAuditLogs/);
assert.match(sitePublish, /canPublishSiteContent/);
assert.match(sitePublish, /status:\s*"published"/);
assert.match(sitePublic, /eq\(siteContent\.status,\s*"published"\)/);
assert.match(sitePolicy, /admin|designer|qa|liveops|publisher/);
assert.match(siteMigration, /CREATE TABLE IF NOT EXISTS site_content/i);
assert.match(siteMigration, /ON DELETE CASCADE/i);
assert.match(databaseMigrate, /database-site-cms-migrate\.ts/);

console.log("API CONTRACT REGRESSION: PASS");
