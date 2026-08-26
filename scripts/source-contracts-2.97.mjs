import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// STATIC release/source contracts only. These checks intentionally inspect
// repository text and are never reported as behavioral or database evidence.
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const checks = [];
const has = (rel, fragment, label) => {
  assert.ok(read(rel).includes(fragment), `${label}: missing ${fragment}`);
  checks.push(label);
};
const lacks = (rel, fragment, label) => {
  assert.ok(!read(rel).includes(fragment), `${label}: forbidden ${fragment}`);
  checks.push(label);
};

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.version, "2.97.0");
checks.push("package version 2.97.0");
assert.equal(pkg.scripts["test:ranked-2.97"], "tsx src/lib/ranked-launch-2.97.test.ts");
checks.push("Ranked behavioral target registered");
assert.ok(String(pkg.scripts["audit:balance"] || "").includes("balance-audit-2.97.ts"));
assert.ok(String(pkg.scripts["ranked:verify"] || "").includes("balance-audit-2.97.ts"));
checks.push("Ranked balance gate points to 2.97 simulation");

has("src/game/ranked-decks.ts", 'RANKED_DECK_POOL_VERSION = "season-zero-r1"', "immutable deck-pool version is explicit");
has("src/game/ranked-decks.ts", "createRankedRoomCertification", "Ranked room captures deck certification fingerprints");
has("src/lib/pvp-settlement.ts", "verifyRankedRoomCertification", "settlement verifies the room snapshot rather than current pool membership");
has("src/lib/pvp-settlement.ts", "calculateAppliedMmrResult", "settlement persists applied MMR delta");
has("src/app/api/matchmaking/route.ts", "findOpenRankedSeason", "queue requires an open season");
has("src/app/api/matchmaking/route.ts", "rematchCooldownSeconds", "Ranked matchmaking has rematch cooldown filtering");
has("src/app/api/matchmaking/route.ts", "resolveRankedPrecon", "Ranked matchmaking resolves only certified precons");
has("src/app/api/ranked/route.ts", "RANKED_SETTLEMENT_PVP_ONLY", "secondary Ranked HTTP settlement path remains disabled");
has("drizzle/0039_ranked_certification_2_97.sql", "fk_pvp_rooms_ranked_season", "ranked room season FK exists");
has("drizzle/0039_ranked_certification_2_97.sql", "AND NOT EXISTS (SELECT 1 FROM ranked_seasons WHERE control_key = 'preseason')", "preseason seed never reactivates an operator-disabled season");
has("drizzle/0039_ranked_certification_2_97.sql", "WHERE control_key IS NOT NULL DO NOTHING", "preseason seed is create-only on control-key conflict");
has("scripts/database-upgrade-2.31.ts", "fk_ranked_matches_season", "2.97 repair path verifies Ranked season FK integrity");
has("drizzle/0039_ranked_certification_2_97.sql", "rules_version", "ranked match rules provenance is migrated");
has("drizzle/0039_ranked_certification_2_97.sql", "deck_pool_version", "ranked match deck-pool provenance is migrated");
has("scripts/production-verify.ts", "version='2.97'", "production DB verifier requires schema 2.97");
has("scripts/ranked-release-guard.mjs", "balance-audit-2.97.ts", "release guard runs the 2.97 balance gate when certification is enabled");

has("src/app/api/matchmaking/route.ts", "withRegisteredCardSnapshot(contentSnapshot.cardDefs", "matched games are constructed against their immutable content snapshot");
has("src/app/api/matchmaking/route.ts", "contentSnapshot, contentHash: contentSnapshot.contentHash", "matchmaking persists immutable content provenance");
has("src/app/api/pvp/[code]/route.ts", "applyAuthoritativePvpSnapshotAction", "live PvP actions execute through snapshot-authoritative transition helper");
has("src/app/api/pvp/[code]/route.ts", "pvp-action:${identity.playerId}", "live PvP actions have a per-player DB-lock abuse limiter");
has("src/app/api/pvp/route.ts", "hostDeck: participant ? room.hostDeck : null", "public casual room discovery hides host deck identity");
has("src/app/api/pvp/route.ts", "guestDeck: participant ? room.guestDeck : null", "public casual room discovery hides guest deck identity");
lacks("src/app/api/pvp/[code]/route.ts", "...room,", "participant room response does not spread future private DB columns");
has("scripts/production-verify.ts", "active PvP rooms carry immutable content snapshot", "runtime DB verification rejects active rooms without content provenance");
lacks("src/game/format-definitions.ts", 'id: "vanilla", name: "Vanilla", description: "Somente a coleção inaugural Vanilla.", collectionKeys: ["vanilla"], active: true, rankedEligible: true', "generic Vanilla format is not Ranked-eligible");

console.log(`SOURCE CONTRACT AUDIT 2.97: PASS (${checks.length} static contracts; NOT behavioral certification)`);
