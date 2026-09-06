import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/public/game/alpha/readiness/route.ts", "utf8");
const helper = fs.readFileSync("src/lib/public-alpha-readiness.ts", "utf8");

assert.match(route, /db\.execute\(sql\`select 1\`\)/);
assert.match(route, /runtimeStatus/);
assert.match(route, /APP_RELEASE/);
assert.match(route, /ENGINE_VERSION/);
assert.match(route, /RULESET_VERSION/);
assert.match(route, /CONTENT_VERSION/);
assert.match(route, /buildPublicAlphaReadiness/);
assert.match(route, /status:\s*503/);
assert.match(route, /Retry-After/);
assert.match(route, /Cache-Control/);
assert.match(route, /no-store/);
assert.doesNotMatch(route, /isAdminAuthorized|adminAuditLogs|ADMIN_|process\.env\.ADMIN/);

assert.match(helper, /rankedPublicLaunchRequirement:\s*false/);
assert.match(helper, /realMoneyPaymentsLaunchRequirement:\s*false/);
assert.match(helper, /largeScaleLiveOpsLaunchRequirement:\s*false/);
assert.match(helper, /"casual-pvp"/);
assert.match(helper, /"rewards-progression"/);
assert.match(helper, /"mulligan"/);
assert.doesNotMatch(helper, /\bannouncement\b|\badvanced\b|\bmatchmaking\b|\beconomy\b/);

console.log("PUBLIC ALPHA READINESS SOURCE CONTRACT: PASS — runtime status only · launch boundaries explicit · no admin/config internals");
