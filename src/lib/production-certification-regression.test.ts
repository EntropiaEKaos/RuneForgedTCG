import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
const migration = read("drizzle/0025_production_certification.sql");
const verify = read("scripts/production-verify.ts");
const bootstrap = read("scripts/database-bootstrap.ts");
const schema = ["src/db/schema.ts","src/db/schema/gameplay.ts","src/db/schema/players.ts","src/db/schema/multiplayer.ts","src/db/schema/admin-content.ts","src/db/schema/admin-ops.ts"].map(read).join("\n");

assert.match(migration, /pvp_action_receipts/);
assert.match(migration, /ON DELETE CASCADE/);
assert.match(migration, /pvp_rooms_active_expiry_idx/);
assert.match(schema, /pvpActionReceipts/);
assert.match(verify, /reference_type,reference_id/);
assert.doesNotMatch(verify, /\breference\b,count/);
assert.match(verify, /100 serialized DB mutations/);
assert.match(verify, /transaction rollback/);
assert.match(bootstrap, /public schema is not empty/);
assert.ok(fs.statSync("database/baseline-2.31.sql").size > 10_000);

console.log("PRODUCTION CERTIFICATION REGRESSION: PASS");
