import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createGame, endTurn } from "@/game/engine";
import { DECKS } from "@/game/decks";
import {
  DEFAULT_RUNTIME_ENGINE_RULES,
  configureRuntimeEngineRules,
  getRuntimeEngineRules,
} from "@/game/runtime-config";
import { DEFAULT_CONFIG, mergeGameConfig, validateGameConfig } from "@/game/settings";

const root = process.cwd();
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}
function text(rel: string) { return fs.readFileSync(path.join(root, rel), "utf8"); }
function lines(rel: string) { return text(rel).split(/\r?\n/).length; }

check("match captures immutable runtime rules", () => {
  configureRuntimeEngineRules({ ...DEFAULT_RUNTIME_ENGINE_RULES, maxMana: 10 });
  let state = createGame("Certification", DECKS[0], DECKS[1], true, 290);
  assert.equal(state.rules.maxMana, 10);
  configureRuntimeEngineRules({ maxMana: 1 });
  state = endTurn(state, "player");
  state = endTurn(state, "ai");
  assert.equal(state.round, 2);
  assert.equal(state.players.player.maxMana, 2, "existing match must keep its captured maxMana=10 rules");
  assert.equal(state.rules.maxMana, 10);
  configureRuntimeEngineRules(DEFAULT_RUNTIME_ENGINE_RULES);
});

check("explicit rules are defensively cloned", () => {
  const rules = getRuntimeEngineRules();
  const before = [...rules.actionAllowlist];
  const state = createGame("Clone", DECKS[0], DECKS[1], true, 291, "tactician", rules);
  rules.actionAllowlist.length = 0;
  assert.deepEqual(state.rules.actionAllowlist, before);
});

check("settings deep merge preserves sibling live-ops values", () => {
  const base = structuredClone(DEFAULT_CONFIG);
  base.maxMana = 9;
  base.advanced.ai.aggressionScale = 1.7;
  base.advanced.economy.dustValues.Common = 77;
  const next = mergeGameConfig(base, { announcement: "2.90", advanced: { economy: { dustValues: { Rare: 99 } } } });
  assert.equal(next.maxMana, 9);
  assert.equal(next.announcement, "2.90");
  assert.equal(next.advanced.ai.aggressionScale, 1.7);
  assert.equal(next.advanced.economy.dustValues.Common, 77);
  assert.equal(next.advanced.economy.dustValues.Rare, 99);
});

check("settings reject cross-field contradictions", () => {
  const bad = structuredClone(DEFAULT_CONFIG);
  bad.deckMin = 40; bad.deckMax = 20;
  bad.startHand = 11; bad.handCap = 10;
  bad.maxSpellMana = 11; bad.maxMana = 10;
  bad.advanced.matchmaking.baseRange = 700; bad.advanced.matchmaking.maxRange = 600;
  const errors = validateGameConfig(bad);
  assert(errors.some((error) => error.includes("deckMin")));
  assert(errors.some((error) => error.includes("startHand")));
  assert(errors.some((error) => error.includes("maxSpellMana")));
  assert(errors.some((error) => error.includes("baseRange")));
});

check("settings persistence uses transaction, row lock and revision CAS", () => {
  const source = text("src/game/settings.ts");
  assert.match(source, /select value, revision from game_settings where key = \$1 for update/i);
  assert.match(source, /expectedRevision !== undefined && expectedRevision !== currentRevision/);
  assert.match(source, /update game_settings set value = \$1::jsonb, revision = \$2/i);
  assert.match(source, /mergeGameConfig\(base, partial\)/);
});

check("authoritative token returns the same rule snapshots it persists", () => {
  const source = text("src/app/api/matches/token/route.ts");
  assert.match(source, /engineRules, aiRules/);
  assert.match(source, /engineRules,\s*aiRules,\s*authoritative:/s);
});

check("settlement requires immutable token provenance", () => {
  const source = text("src/app/api/matches/route.ts");
  assert.match(source, /!row\.engineRules \|\| !row\.aiRules/);
  assert.match(source, /rules: row\.engineRules/);
  assert.match(source, /aiRules: row\.aiRules/);
});

check("draft sessions persist immutable rules", () => {
  const source = text("src/app/api/draft/route.ts");
  assert.match(source, /rulesSnapshot: freshRules/);
  assert.match(source, /validateDeck\(nextDeck, rules\)/);
});

check("replay verification uses canonical decks and stored match rules", () => {
  const source = text("src/app/api/replays/[id]/verify/route.ts");
  assert.match(source, /canonicalDeckSnapshot/);
  assert.match(source, /row\.engineRules/);
  assert.match(source, /row\.aiRules/);
  assert.match(source, /matchOptionsSnapshot/);
});

check("2.90 migration restores historical integrity guarantees", () => {
  const migration = text("drizzle/0031_certification_2_90.sql");
  for (const invariant of [
    "economy_reward_idempotency_idx",
    "admin_content_versions_unique_version",
    "admin_content_releases_one_active",
    "admin_card_archetypes_base_type_check",
    "rules_snapshot",
  ]) assert(migration.includes(invariant), `missing ${invariant}`);
});

check("bootstrap and upgrade both include certification migration", () => {
  assert(text("scripts/database-bootstrap.ts").includes("0031_certification_2_90.sql"));
  assert(text("scripts/database-upgrade-2.31.ts").includes("0031_certification_2_90.sql"));
  assert.match(text("scripts/database-migrate.ts"), /runeforge_schema_meta/);
  assert.match(text("scripts/database-upgrade-2.31.ts"), /unsupported schema provenance/);
});

check("production verifier checks catalog invariants", () => {
  const source = text("scripts/production-verify.ts");
  assert.match(source, /pg_indexes|pg_constraint/);
  assert(source.includes("economy_reward_idempotency_idx"));
  assert(source.includes("admin_content_versions_unique_version"));
  assert(source.includes("admin_content_releases_one_active"));
});

check("CI does not request npm cache before a lockfile can exist", () => {
  const workflow = text(".github/workflows/ci.yml");
  const setup = workflow.slice(workflow.indexOf("actions/setup-node@v4"), workflow.indexOf("- name: Install dependencies"));
  assert(!/cache:\s*npm/.test(setup));
  assert(workflow.includes("npm run ci:install"));
});

check("former god modules are now facades/orchestrators", () => {
  const limits: Record<string, number> = {
    "src/game/cards.ts": 120,
    "src/game/engine.ts": 80,
    "src/app/play/GameClient.tsx": 700,
    "src/app/admin/studio/cards/CardAuthoringStudio.tsx": 700,
    "src/app/admin/studio/production/ProductionStudio.tsx": 300,
    "src/app/admin/studio/RuleBuilder.tsx": 450,
    "src/app/admin/studio/SuperAdminStudio.tsx": 300,
    "src/db/schema.ts": 80,
    "src/app/globals.css": 260,
  };
  for (const [file, max] of Object.entries(limits)) assert(lines(file) <= max, `${file} has ${lines(file)} lines (limit ${max})`);
});

check("modularized domains exist", () => {
  const required = [
    "src/game/engine/actions.ts", "src/game/engine/effects.ts", "src/game/engine/state.ts",
    "src/game/cards/base/emberhold.ts", "src/app/play/hooks/useMatchLauncher.ts", "src/app/play/hooks/useMatchLifecycle.ts",
    "src/app/play/BattleView.tsx", "src/app/play/MulliganView.tsx", "src/db/schema/gameplay.ts",
    "src/app/styles/studio.css", "src/app/admin/studio/RuleBuilderCanvas.tsx", "src/app/admin/studio/SuperAdminPanels.tsx",
  ];
  for (const file of required) assert(fs.existsSync(path.join(root, file)), `missing ${file}`);
});

console.log(`CERTIFICATION 2.90: ${passed}/${passed} checks passed`);
