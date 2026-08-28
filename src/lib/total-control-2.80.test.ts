import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { builtInControlDefinitions, CONTROL_DOMAINS, validateControlDefinition } from "./control-plane";
import { configureRuntimeEngineRules } from "@/game/runtime-config";
import { createGame } from "@/game/engine";
import { DECKS } from "@/game/decks";
import { applyGameAction } from "@/game/reducer";

const required = ["official-decks","doctrines","puzzles","bosses","brawls","expeditions","packs","login-rewards","rank-tiers","ranked-seasons","ai-profiles","engine-zones","engine-phases","engine-actions","matchmaking-policies","economy-products","asset-library","visual-themes","audio-cues","localizations","moderation-rules"];
for (const domain of required) assert.ok((CONTROL_DOMAINS as readonly string[]).includes(domain), `${domain} must be manageable`);

const defaults = builtInControlDefinitions();
assert.ok(defaults.length >= 60, "built-in control plane should cover the complete shipped game catalog");
for (const item of defaults) {
  const report = validateControlDefinition(item);
  assert.equal(report.passed, true, `${item.domain}/${item.key}: ${report.errors.join(" | ")}`);
}

configureRuntimeEngineRules({ nexusStart: 27, startHand: 3, maxMana: 12, runtimeOverridesEnabled: true, actionAllowlist: ["mulligan", "skipMulligan"], phaseSequence: ["main", "blocking", "gameover"] });
const state = createGame("Control QA", DECKS[0], DECKS[1], true, 280_001);
assert.equal(state.players.player.nexusHealth, 27);
assert.equal(state.players.player.hand.length, 3);
const blocked = applyGameAction(state, { type: "pass", player: "player" });
assert.deepEqual(blocked.next, state, "disabled runtime actions must not mutate authoritative state");
configureRuntimeEngineRules({ nexusStart: 20, startHand: 4, maxMana: 10, maxSpellMana: 3, handCap: 10, benchCap: 6, permanentsCap: 4, runtimeOverridesEnabled: false, maxRounds: 200, fatigueEnabled: false, fatigueStart: 1, fatigueStep: 1, actionAllowlist: ["play","cast","attack","block","pass","react","resolve","sentinela","mulligan","skipMulligan"], phaseSequence: ["main","blocking","gameover"] });

const root = path.resolve(process.cwd());
const controlApi = fs.readFileSync(path.join(root, "src/app/api/admin/control/[id]/route.ts"), "utf8");
const runtimeApi = fs.readFileSync(path.join(root, "src/app/api/admin/runtime/route.ts"), "utf8");
const assetApi = fs.readFileSync(path.join(root, "src/app/api/admin/assets/upload/route.ts"), "utf8");
assert.match(controlApi, /expectedRevision/);
assert.match(controlApi, /PUBLICAR \$\{current\.domain\}\/\$\{current\.key\}/);
assert.match(runtimeApi, /reason\.length < 8/);
assert.match(assetApi, /12_000_000/);
assert.match(assetApi, /sha256/);

console.log(`TOTAL CONTROL 2.80: PASS (${CONTROL_DOMAINS.length} domains, ${defaults.length} built-ins)`);
