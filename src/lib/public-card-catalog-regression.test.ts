import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/public/game/cards/route.ts", "utf8");
const helper = fs.readFileSync("src/lib/public-card-catalog.ts", "utf8");
const detail = fs.readFileSync("src/app/api/public/game/cards/[defId]/route.ts", "utf8");

assert.match(route, /ensureCustomCardsLoaded/);
assert.match(route, /collectibleCards/);
assert.match(route, /getCardCollection/);
assert.match(route, /toPublicCardDto/);
assert.match(route, /queryPublicCardCatalog/);
assert.match(route, /Cache-Control/);
assert.doesNotMatch(route, /isAdminAuthorized|adminAuditLogs|customCards\.data/);
assert.match(detail, /toPublicCardDto/);
assert.match(detail, /collectible !== false/);
assert.match(detail, /Public card not found/);
assert.doesNotMatch(detail, /isAdminAuthorized|adminAuditLogs|customCards\.data/);

for (const safeField of ["defId", "name", "regions", "structuralType", "description", "rarity", "collection"]) {
  assert.ok(helper.includes(safeField), `public DTO must expose ${safeField}`);
}
for (const forbiddenField of ["spell:", "trigger:", "mechanics:", "sentinela:", "equipment:", "aura:"]) {
  assert.ok(!helper.includes(forbiddenField), `public DTO must not project internal field ${forbiddenField}`);
}
assert.match(helper, /if \(!collection\) return null/);
assert.match(helper, /Math\.min\(100/);

console.log("PUBLIC CARD CATALOG SOURCE CONTRACT: PASS — public-only DTO · fail-closed collection · bounded pagination");
