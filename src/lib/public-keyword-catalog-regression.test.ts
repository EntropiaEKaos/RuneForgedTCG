import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync("src/app/api/public/game/keywords/route.ts", "utf8");
const helper = fs.readFileSync("src/lib/public-keyword-catalog.ts", "utf8");
const cardsRoute = fs.readFileSync("src/app/api/public/game/cards/route.ts", "utf8");

assert.match(route, /adminKeywords\.enabled/);
assert.match(route, /eq\(adminKeywords\.enabled, true\)/);
assert.match(route, /collectibleCards/);
assert.match(route, /getCardCollection/);
assert.match(route, /toPublicCardDto/);
assert.match(route, /buildPublicKeywordCatalog/);
assert.match(route, /Cache-Control/);
assert.match(route, /Public keyword catalog unavailable/);
assert.match(route, /status:\s*500/);
assert.match(route, /no-store/);
assert.match(route, /Response\.json\(\{ ok: true, total: items\.length, items \}/);
assert.doesNotMatch(route, /isAdminAuthorized|adminAuditLogs/);
assert.doesNotMatch(route, /Response\.json\([^\n]*customRows/);

assert.match(helper, /CANONICAL_KEYWORDS/);
assert.match(helper, /KEYWORD_INFO/);
assert.match(helper, /sanitizeKeywordBehavior/);
assert.match(helper, /source: "canonical"/);
assert.match(helper, /source: "custom"/);
assert.match(helper, /cardCount/);
assert.match(helper, /timing/);
assert.doesNotMatch(helper, /PublicKeywordDto[\s\S]{0,700}\bbehavior\??:/);
assert.doesNotMatch(helper, /PublicKeywordDto[\s\S]{0,700}\beffect\??:/);
assert.doesNotMatch(helper, /PublicKeywordDto[\s\S]{0,700}\bcondition\??:/);

assert.match(cardsRoute, /keyword: params\.get\("keyword"\)/);

console.log("PUBLIC KEYWORD CODEX SOURCE CONTRACT: PASS — canonical + published custom · exact card filter · no internal behavior projection");
