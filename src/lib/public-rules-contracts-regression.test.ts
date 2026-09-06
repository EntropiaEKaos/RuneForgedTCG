import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/public/game/rules/contracts/route.ts", "utf8");
const helper = fs.readFileSync("src/lib/public-rules-contracts.ts", "utf8");

assert.match(route, /ensureCustomCardsLoaded/);
assert.match(route, /collectibleCards/);
assert.match(route, /getCardCollection/);
assert.match(route, /toPublicCardDto/);
assert.match(route, /buildPublicRulesContracts/);
assert.match(route, /Cache-Control/);
assert.match(route, /Public rules contracts unavailable/);
assert.match(route, /status:\s*500/);
assert.match(route, /no-store/);
assert.doesNotMatch(route, /isAdminAuthorized|adminAuditLogs|customCards\.data/);

assert.match(helper, /CARD_TYPES/);
assert.match(helper, /CERTIFIED_SEMANTIC_CARD_TYPES/);
assert.match(helper, /countsAsSpellCast/);
assert.match(helper, /cardCount/);
assert.match(helper, /main-only/);
assert.match(helper, /reaction-only/);
assert.doesNotMatch(helper, /CardEffect|CARD_EFFECT_CONTRACTS|sanitizeCardEffect|mechanicFromKeyword/);

const dtoBlock = helper.match(/export type PublicCardRuleContract = \{([\s\S]*?)\n\};/)?.[1] ?? "";
assert.ok(dtoBlock);
for (const forbiddenProperty of ["spell", "effect", "behavior", "mechanics", "condition", "schema"]) {
  const propertyPattern = new RegExp(`\\b${forbiddenProperty}\\??\\s*:`);
  assert.doesNotMatch(dtoBlock, propertyPattern, `public rules DTO must not expose ${forbiddenProperty} property`);
}
assert.match(dtoBlock, /countsAsSpellCast:\s*boolean/);

console.log("PUBLIC RULES CONTRACT SOURCE CONTRACT: PASS — engine card types + certified semantics · no executable grammar exposure");
