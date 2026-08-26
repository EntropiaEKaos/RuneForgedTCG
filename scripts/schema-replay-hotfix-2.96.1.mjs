import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const text = (p) => fs.readFileSync(path.join(root, p), "utf8");
const gameplay = text("src/db/schema/gameplay.ts");
for (const mapping of [
  /engineRules:\s*jsonb\("engine_rules"\)/,
  /aiRules:\s*jsonb\("ai_rules"\)/,
  /canonicalDeckSnapshot:\s*jsonb\("canonical_deck_snapshot"\)/,
  /matchOptionsSnapshot:\s*jsonb\("match_options_snapshot"\)/,
]) assert.match(gameplay, mapping);
const m31 = text("drizzle/0031_certification_2_90.sql");
assert.match(m31, /ALTER TABLE matches ADD COLUMN IF NOT EXISTS engine_rules jsonb/i);
assert.match(m31, /ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_rules jsonb/i);
assert.match(m31, /admin_sessions_actor_idx\s+ON\s+admin_sessions\(actor_id\)/i);
assert.doesNotMatch(m31, /admin_sessions_actor_idx\s+ON\s+admin_sessions\(actor\)/i);
const hotfix = text("drizzle/0037_schema_replay_hotfix_2_96_1.sql");
assert.match(hotfix, /ALTER TABLE matches ADD COLUMN IF NOT EXISTS engine_rules jsonb/i);
assert.match(hotfix, /ALTER TABLE matches ADD COLUMN IF NOT EXISTS ai_rules jsonb/i);
assert.match(hotfix, /ALTER TABLE replays ADD COLUMN IF NOT EXISTS engine_rules jsonb/i);
assert.match(hotfix, /CREATE INDEX admin_sessions_actor_idx ON admin_sessions\(actor_id\)/i);
assert(text("scripts/database-bootstrap.ts").includes("0037_schema_replay_hotfix_2_96_1.sql"));
assert(text("scripts/database-upgrade-2.31.ts").includes("0037_schema_replay_hotfix_2_96_1.sql"));
console.log("LEGACY SCHEMA SOURCE CONTRACT 2.96.1: PASS (14 static contracts; NOT runtime proof)");
