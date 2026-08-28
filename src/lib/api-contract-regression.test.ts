import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");
const proxy = read("src/proxy.ts");
const pvp = read("src/app/api/pvp/[code]/route.ts");
const matchmaking = read("src/app/api/matchmaking/route.ts");
const ranked = read("src/app/api/ranked/route.ts");
const playerSession = read("src/lib/player-session.ts");

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

console.log("API CONTRACT REGRESSION: PASS");
