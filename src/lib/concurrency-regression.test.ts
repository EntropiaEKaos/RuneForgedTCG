import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.join(process.cwd(), "src");
const matchmaking = fs.readFileSync(`${root}/app/api/matchmaking/route.ts`, "utf8");
const packs = fs.readFileSync(`${root}/lib/packs.ts`, "utf8");
const packRoute = fs.readFileSync(`${root}/app/api/packs/route.ts`, "utf8");

assert.match(matchmaking, /select\(\)\.from\(players\).*for\("update"\)/s, "matchmaking must lock the caller player before queue matching");
assert.match(matchmaking, /delete\(matchmakingQueue\).*playerId.*mode/s, "AI fallback must remove the player's queue entry");
assert.match(packRoute, /randomInt\(1, 0x7fffffff\)/, "server pack seed must use cryptographic randomness");
assert.match(packs, /createPackRandom/, "pack rolls must be reproducible from the stored cryptographic seed");
assert.doesNotMatch(packs, /Math\.random\(\)/, "pack rarity must not use Math.random");
assert.doesNotMatch(packRoute, /Math\.random\(\)/, "pack route must not use Math.random");

console.log("concurrency regression checks: OK");

const matchesRoute = fs.readFileSync(path.join(root, "app/api/matches/route.ts"), "utf8");
const modesRoute = fs.readFileSync(path.join(root, "app/api/modes/route.ts"), "utf8");
const pvpRoute = fs.readFileSync(path.join(root, "app/api/pvp/[code]/route.ts"), "utf8");
assert.match(matchesRoute, /Payload too large/);
assert.match(modesRoute, /Payload too large/);
assert.match(pvpRoute, /Payload too large/);
assert.match(matchesRoute, /\.for\("update"\)/, "match token must be locked before replay to avoid duplicate expensive concurrent replays");

console.log("concurrency regression (payload/lock) checks: OK");
