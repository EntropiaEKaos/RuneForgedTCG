import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { ARCHETYPES, archetypeMomentum, mulliganPlan } from "@/game/archetypes";
import { analyzeDeck } from "@/game/deck-insights";
import { DECKS } from "@/game/decks";
import { createCustomGame } from "@/game/engine";
import { ENCOUNTERS } from "@/lib/game-modes";

assert.equal(Object.keys(ARCHETYPES).length, DECKS.length);
for (const deck of DECKS) {
  const doctrine = ARCHETYPES[deck.id];
  assert.ok(doctrine, `${deck.id} needs an explicit archetype doctrine`);
  assert.equal(doctrine.plan.length, 3);
  assert.ok(doctrine.victory && doctrine.weakness && doctrine.signatures.length === 3);
  const insight = analyzeDeck(deck.cards);
  assert.ok(insight.score >= 80, `${deck.id} should remain structurally healthy`);
  assert.ok(insight.roleCounts.early > 0 && insight.roleCounts.interaction > 0);
  const opening = deck.cards.slice(0, 5);
  const advice = mulliganPlan(opening, deck.id);
  assert.equal(advice.keep.length + advice.replace.length, opening.length);
  assert.deepEqual(advice, mulliganPlan(opening, deck.id), "mulligan coaching must be deterministic");
}

assert.equal(ENCOUNTERS.length, 3);
assert.equal(new Set(ENCOUNTERS.map((encounter) => encounter.id)).size, ENCOUNTERS.length);
for (const encounter of ENCOUNTERS) {
  const opponent = DECKS.find((deck) => deck.id === encounter.opponentDeckId);
  assert.ok(opponent, `${encounter.id} needs a canonical opponent deck`);
  assert.ok(encounter.objective && encounter.mutator.label && encounter.reward.xp > 0);
  const state = createCustomGame("Tester", DECKS[0], opponent!, {
    playerNexus: encounter.playerNexus, aiNexus: encounter.aiNexus,
    playerStartingMana: encounter.playerMana, aiStartingMana: encounter.aiMana,
    playerStartingHand: encounter.playerHand, aiStartingHand: encounter.aiHand,
    aiBench: encounter.aiBench, playerGoesFirst: true, skipMulligan: true,
    aiDifficulty: "overlord", seed: 274_000 + encounter.difficulty,
  });
  assert.equal(state.aiDifficulty, "overlord");
  assert.equal(state.players.ai.nexusHealth, encounter.aiNexus);
  assert.equal(state.players.ai.bench.length, encounter.aiBench?.length ?? 0);
  const momentum = archetypeMomentum(state, state.players.player.deckId);
  assert.ok(momentum.value >= 0 && momentum.value <= 100);
}

for (const region of ["emberhold", "tidecall", "ironwood", "voidborn", "florestia", "tempestade"]) {
  const svg = readFileSync(`public/art/regions/${region}.svg`, "utf8");
  assert.ok(svg.includes('viewBox="0 0 1600 900"'));
  assert.ok(!/<script|(?:href|src)=["']https?:/i.test(svg), `${region} art must be self-contained`);
}

const game = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const modes = readFileSync("src/app/api/modes/route.ts", "utf8");
const attempt = readFileSync("src/app/api/modes/attempt/route.ts", "utf8");
const forge = readFileSync("src/app/forge/ForgeClient.tsx", "utf8");
const replay = readFileSync("src/app/replay/[id]/ReplayViewer.tsx", "utf8");
const spectator = readFileSync("src/app/spectate/[code]/SpectatorClient.tsx", "utf8");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css","styles/runeforge-brand.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const home = readFileSync("src/app/page.tsx", "utf8");
const hero = statSync("public/art/brand/runeforge-nexus-hero.webp");

for (const integration of ["ArchetypeTracker", "EncounterBanner", "CombatChoreography", "useFrameHealth", "mulliganPlan"]) assert.ok(game.includes(integration));
assert.ok(modes.includes('modeType === "expedition"') || modes.includes('modeType') && modes.includes('expedition'));
assert.ok(/modeType\s*===\s*["']expedition["']/.test(attempt) && attempt.includes("ENCOUNTERS"));
assert.ok(forge.includes("DeckInsightPanel") && forge.includes("analyzeDeck"));
assert.ok(replay.includes("ReplayFilter") && replay.includes("keyMoments"));
assert.ok(spectator.includes("latency") && spectator.includes("paused"));
for (const selector of [".arena-backdrop", ".archetype-doctrine", ".encounter-banner", ".combat-choreography", ".forge-insight", ".replay-director"]) assert.ok(css.includes(selector));
for (const selector of [".rf-hero", ".rf-command-grid", ".rf-champion-grid", ".deck-choice-grid"]) assert.ok(css.includes(selector));
assert.ok(home.includes("/art/brand/runeforge-nexus-hero.webp") && !home.includes("/images/champs/"), "home must use the shipped hero instead of missing champion art");
assert.ok(hero.size > 50_000 && hero.size < 500_000, "hero art must be present and web-optimized");

console.log("GAMEPLAY & ART COMPLETE 2.74: PASS");
