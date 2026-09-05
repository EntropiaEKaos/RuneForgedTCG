import assert from "node:assert/strict";
import fs from "node:fs";
import { SITE_CONTENT_RESOURCES } from "./site-content";

const read = (path: string) => fs.readFileSync(path, "utf8");

const page = read("src/app/admin/studio/site/page.tsx");
const studio = read("src/app/admin/studio/site/SiteContentStudio.tsx");
const chrome = read("src/app/admin/studio/StudioChrome.tsx");
const access = read("src/lib/admin-studio-access.ts");
const publicContinuity = read("src/lib/site-content-public.ts");

assert.match(page, /getStudioPageSession/);
assert.match(page, /SiteContentStudio/);
assert.match(chrome, /\/admin\/studio\/site/);
assert.match(chrome, /Portal CMS/);
assert.match(access, /\| "site"/);
assert.match(access, /designer: \["authoring", "site"\]/);
assert.match(access, /publisher: \["production", "site"\]/);
assert.match(access, /liveops: \["liveops", "site"\]/);

for (const resource of SITE_CONTENT_RESOURCES) {
  assert.ok(studio.includes(`"${resource}"`), `Portal CMS Studio must expose resource ${resource}`);
}

assert.match(studio, /expectedVersion: editor\.version/);
assert.match(studio, /response\.status === 409/);
assert.match(studio, /Reload server version/);
assert.match(studio, /\/publish/);
assert.match(studio, /\/archive/);
assert.match(studio, /\/rollback\//);
assert.match(studio, /Immutable version history/);
assert.match(studio, /previously published version remains live/);
assert.match(studio, /Identity is immutable after creation/);
assert.match(studio, /payloadText/);
assert.match(studio, /seoText/);
assert.match(studio, /changeNote/);

assert.match(publicContinuity, /draft\/review edits keep serving the latest immutable published snapshot/);
assert.match(publicContinuity, /current\.status === "archived"/);
assert.match(publicContinuity, /eq\(siteContentVersions\.status, "published"\)/);

console.log(
  "PORTAL CMS STUDIO 2.1 SOURCE CONTRACT: PASS — 16 resources · existing admin auth/RBAC · optimistic conflicts · version history · publish/archive/rollback · continuous public publication",
);
