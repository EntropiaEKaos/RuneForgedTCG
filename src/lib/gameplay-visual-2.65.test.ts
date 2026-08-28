import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aiChooseAction } from "@/game/ai";
import { AI_DIFFICULTIES, aiPersonaForDeck } from "@/game/ai-personality";
import { allCards } from "@/game/cards";
import { DECKS, validateDeck } from "@/game/decks";
import { createGame } from "@/game/engine";
import type { AiDifficulty } from "@/game/types";
import { evaluateMatchMastery } from "@/game/client/match-mastery";

const newCardIds = [
  "ember_ashguard", "ember_flare_line",
  "tide_cloudpiercer", "tide_memory_tide",
  "wood_canopy_bastion", "wood_seed_of_return",
  "void_gloom_warden", "void_soul_tax",
  "forest_dawn_alpha", "forest_pack_shelter",
  "storm_static_adept", "storm_tempered_winds",
];
const catalog = new Set(allCards().map((card) => card.defId));
for (const id of newCardIds) assert.ok(catalog.has(id), `${id} must be present in the collectible catalog`);

for (const deck of DECKS) {
  assert.equal(deck.cards.length, 40, `${deck.id} must keep the ranked 40-card contract`);
  assert.deepEqual(validateDeck(deck.cards).errors, [], `${deck.id} must be valid`);
}

for (const difficulty of Object.keys(AI_DIFFICULTIES) as AiDifficulty[]) {
  const first = createGame("Tester", DECKS[0], DECKS[1], true, 265_001, difficulty);
  const repeated = createGame("Tester", DECKS[0], DECKS[1], true, 265_001, difficulty);
  assert.equal(first.aiDifficulty, difficulty);
  assert.deepEqual(aiChooseAction(repeated), aiChooseAction(first), `${difficulty} decisions must be deterministic`);
}
assert.equal(aiPersonaForDeck("tide_control").title, "Oráculo");
assert.equal(aiPersonaForDeck("void_shadow").title, "Predador");

const masteryState = createGame("Tester", DECKS[0], DECKS[1], true, 265_002, "tactician");
masteryState.winner = "player";
masteryState.round = 8;
masteryState.players.player.nexusHealth = 18;
masteryState.players.player.stats = { nexusDamageDealt: 20, spellsCast: 6, alliesSummoned: 8 };
const mastery = evaluateMatchMastery(masteryState);
assert.equal(mastery.grade, "S");
assert.equal(mastery.score, 100);
assert.ok(mastery.highlights.length <= 3);

const gameClient = ["GameClient.tsx","BattleView.tsx","MulliganView.tsx","hooks/useGamePresentation.ts","hooks/useMatchLauncher.ts","hooks/useMatchLifecycle.ts"].map((f) => readFileSync(`src/app/play/${f}`, "utf8")).join("\n");
const cardView = readFileSync("src/components/CardView.tsx", "utf8");
const css = ["globals.css","styles/tcg-visual.css","styles/site-polish.css","styles/studio.css","styles/arena-regions.css","styles/gameplay-extensions.css","styles/runeforge-brand.css"].map((f) => readFileSync(`src/app/${f}`, "utf8")).join("\n");
const tokenRoute = readFileSync("src/app/api/matches/token/route.ts", "utf8");
const migration = readFileSync("drizzle/0027_gameplay_visual_2_65.sql", "utf8");

for (const surface of ["BoardStatusStrip", "CombatFeedback", "matchReward", "pvpLatency", "AI_DIFFICULTIES"]) {
  assert.ok(gameClient.includes(surface), `${surface} must be integrated into the match client`);
}
assert.ok(gameClient.includes('event.key === "Enter"') && gameClient.includes('event.code === "Space"'));
assert.ok(cardView.includes("data-card-role") && cardView.includes("strategicRole"));
assert.ok(css.includes("combat-hit-stop") && css.includes("board-status-strip") && css.includes("match-mastery"));
assert.ok(tokenRoute.includes("aiDifficulty") && tokenRoute.includes("aiPersonaForDeck"));
for (const table of ["match_tokens", "matches", "replays"]) {
  assert.ok(migration.includes(`ALTER TABLE "${table}"`), `${table} needs authoritative difficulty provenance`);
}

console.log("GAMEPLAY/VISUAL COMPLETE 2.65: PASS");
