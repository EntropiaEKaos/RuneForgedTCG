import assert from "node:assert/strict";
import fs from "node:fs";

const auth = fs.readFileSync("src/lib/admin-auth.ts", "utf8");
const login = fs.readFileSync("src/app/api/admin/login/route.ts", "utf8");
const migration = fs.readFileSync("drizzle/0016_admin_server_sessions.sql", "utf8");

assert.match(auth, /adminSessions/);
assert.match(auth, /crypto\.randomBytes\(32\)/);
assert.match(auth, /hashToken\(token\)/);
assert.match(auth, /isNull\(adminSessions\.revokedAt\)/);
assert.match(auth, /gt\(adminSessions\.expiresAt/);
assert.match(auth, /from\(adminUsers\)/);
assert.match(auth, /eq\(adminUsers\.enabled,\s*true\)/);
assert.match(auth, /revokeAdminSession/);
assert.doesNotMatch(auth, /createAdminSession\(\): string/);
assert.match(login, /await createAdminSession\(\{\s*id:\s*user\.id,\s*username:\s*user\.username,\s*role:\s*user\.role\s*\}\)/);
assert.match(login, /await revokeAdminSession\(req\)/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "admin_sessions"/);
assert.match(migration, /"token_hash" text NOT NULL UNIQUE/);
assert.match(migration, /"revoked_at" timestamp/);

console.log("security audit 2.13: PASS");
