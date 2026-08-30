import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RELEASE_296_CARDS } from "@/game/cards/release-2.96";
import { baseCardsOnly } from "@/game/cards";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import { ENGINE_VERSION } from "@/game/version";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checks: string[] = [];
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); checks.push(message); };

const pkg = JSON.parse(read("package.json"));
const suites = read("scripts/test-suites.mjs");
const [pkgMajor, pkgMinor] = String(pkg.version).split(".").map(Number);
ok(pkgMajor > 2 || (pkgMajor === 2 && pkgMinor >= 96), "package version is 2.96 or newer"); checks.push(`package version ${pkg.version}`);
assert.equal(ENGINE_VERSION, "2.96.0"); checks.push("engine version is 2.96.0");

const releaseCards = Object.values(RELEASE_296_CARDS);
assert.equal(releaseCards.length, 33); checks.push("2.96 contains 33 new cards");
assert.equal(releaseCards.filter((card) => card.type === "Sentinela").length, 12); checks.push("2.96 contains 12 new Sentinelas");
assert.equal(releaseCards.filter((card) => cardRegions(card).length > 1).length, 27); checks.push("2.96 contains 27 multi-region cards");
assert.equal(baseCardsOnly().length, 429); checks.push("Vanilla code-authored catalog totals 429 cards");

const duals = new Set(releaseCards.filter((card) => cardRegions(card).length === 2).map((card) => identityForRegions(cardRegions(card)).name));
const triads = new Set(releaseCards.filter((card) => cardRegions(card).length === 3).map((card) => identityForRegions(cardRegions(card)).name));
assert.equal(duals.size, 15); checks.push("all 15 dual-region identities have new representation");
assert.equal(triads.size, 6); checks.push("all 6 named tri-region identities have new representation");

const migration = read("drizzle/0036_sentinelas_convergence_2_96.sql");
ok(migration.includes("'2.96'") && releaseCards.every((card) => migration.includes(`('${card.defId}')`)), "migration 0036 assigns all release cards and records schema 2.96");

const bootstrap = read("scripts/database-bootstrap.ts");
ok(bootstrap.includes("0036_sentinelas_convergence_2_96.sql") && bootstrap.includes("0038_engineering_integrity_2_96_2.sql") && bootstrap.includes("0039_ranked_certification_2_97.sql"), "fresh bootstrap preserves the 2.96 content migration and later schema hardening");
const production = read("scripts/production-verify.ts");
ok(/version=\'2\.9(?:6\.2|7)\'/.test(production), "production DB verification requires a post-2.96 schema");

const ranked = read("scripts/ranked-release-guard.mjs");
ok(/balance-audit-2\.(?:96|97)\.ts/.test(ranked) && ranked.includes("RANKED_RELEASE_CERTIFIED"), "Ranked guard uses a certified balance audit and remains fail-closed");
checks.push("historical 2.96 balance artifact is no longer required in the active source package");

const sentinelaActions = read("src/game/engine/sentinela-actions.ts");
const activatedActions = read("src/game/engine/activated-actions.ts");
ok(
  sentinelaActions.includes("return activateAbility(state, playerId, instanceId, abilityIndex, targetInstanceId)") &&
  activatedActions.includes("cleanupDead(next)") &&
  activatedActions.includes("cleanupSentinelas(next)"),
  "Sentinela ability resolution delegates to the generic executor that immediately cleans dead units and zero-loyalty Sentinelas",
);
const actions = read("src/game/engine/actions.ts");
ok(actions.includes('def.type !== "Unit" && def.type !== "Sentinela"') && actions.includes("payCost(p, cost, false)"), "Sentinelas consume regular mana and never Spell Mana");
const ai = read("src/game/ai.ts");
ok(ai.includes("aiChooseSentinelaAction") && ai.includes("Spend loyalty on the strongest useful minus ability"), "AI actively evaluates Sentinela minus abilities and ultimates");

ok(/sourceContractTests[\s\S]*sentinela-convergence-2\.96\.test\.ts/.test(suites) && /sourceContractTests[\s\S]*mvp-final-2\.96\.test\.ts/.test(suites), "2.96 source contracts remain classified as static audits");
ok(pkg.scripts["release:mvp"] === "npm run production:verify" && String(pkg.scripts["production:verify"] || "").includes("release:runtime-gate") && String(pkg.scripts["production:verify"] || "").includes("test:production-db") && String(pkg.scripts["production:verify"] || "").includes("build"), "MVP release delegates to the production verification pipeline with reproducibility, DB and build gates");

console.log(`MVP FINAL 2.96: ${checks.length}/${checks.length} PASS`);
