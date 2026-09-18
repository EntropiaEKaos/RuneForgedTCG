import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const control = read("src/lib/control-plane.ts");
const liveOps = read("src/lib/pack-live-ops.ts");
const validation = read("src/lib/live-ops-rules.ts");
const packRoute = read("src/app/api/packs/route.ts");
const store = read("src/app/store/StoreClient.tsx");

assert.match(control, /applyActivePackLiveOps/);
assert.match(control, /export async function getRuntimePacks/);
assert.match(control, /runtimeDomain<PackDef>\("packs"/);
assert.match(control, /return applyActivePackLiveOps\(packs\)/);

assert.match(liveOps, /discountPercent.*0, 75/s);
assert.match(liveOps, /bonusCards.*0, 2/s);
assert.match(liveOps, /Math\.max\(max, source\.rule\.discountPercent \?\? 0\)/);
assert.match(liveOps, /Math\.max\(max, source\.rule\.bonusCards \?\? 0\)/);
assert.match(liveOps, /higherRarity/);
assert.match(liveOps, /eq\(adminEvents\.status, "published"\)/);
assert.match(liveOps, /eq\(adminPromotions\.status, "published"\)/);
assert.match(liveOps, /inWindow\(adminEvents\.startsAt, adminEvents\.endsAt\)/);
assert.match(liveOps, /inWindow\(adminPromotions\.startsAt, adminPromotions\.endsAt\)/);
assert.doesNotMatch(liveOps, /dropRates\s*:/, "Pack Live Ops must not rewrite card rarity probabilities");
assert.doesNotMatch(liveOps, /collectionKey\s*:/, "Pack Live Ops must not rewrite collection identity");

assert.match(validation, /validatePackLiveOpsConfig\(resource, row\)/, "Studio publication validation must reject unsafe pack modifiers");

// Visual 5.7 stays byte-frozen: both read and mutation paths already consume the
// runtime pack source, so Live Ops does not need a parallel economy endpoint.
assert.ok((packRoute.match(/await getRuntimePacks\(\)/g) || []).length >= 2);
assert.match(packRoute, /players\.gold} - \$\{packDef\.price\}/);
assert.match(packRoute, /i < packDef\.cardsCount/);
assert.match(packRoute, /packDef\.guaranteedRarity/);
assert.match(store, /packs\.player\.gold < pack\.price/);
assert.match(store, /\{pack\.cardsCount\} cartas/);
assert.match(store, /COMPRAR · \{pack\.price\}/);

console.log("PACK ECONOMY + EVENTS SOURCE CONTRACT: shared runtime pack authority PASS");
