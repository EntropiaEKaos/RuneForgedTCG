import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const authoritative = readFileSync(join(root, "src/game/authoritative.ts"), "utf8");
const invariants = readFileSync(join(root, "src/game/invariants.ts"), "utf8");
const migration = readFileSync(join(root, "drizzle/0015_deep_concurrency_integrity.sql"), "utf8");
const schema = ["schema.ts","schema/gameplay.ts","schema/players.ts","schema/multiplayer.ts","schema/admin-content.ts","schema/admin-ops.ts"].map((f) => readFileSync(join(root, "src/db", f), "utf8")).join("\n");

if (!authoritative.includes('if (action.type === "resolve") return false;')) {
  throw new Error("Authoritative validator must reject unsolicited resolve actions.");
}
if (!invariants.includes("p.sentinelas.map") || !invariants.includes("x.equipment.map")) {
  throw new Error("State invariants must cover sentinela/equipment instance IDs.");
}
if (!migration.includes("matches_match_token_player_unique") || !migration.includes("ranked_seasons_one_active")) {
  throw new Error("Deep concurrency migration must enforce match idempotency and one active season.");
}
if (!schema.includes("matches_match_token_player_unique") || !schema.includes("ranked_seasons_one_active")) {
  throw new Error("Drizzle schema must reflect the database-level invariants.");
}
console.log("✅ Deep concurrency regression passed");
