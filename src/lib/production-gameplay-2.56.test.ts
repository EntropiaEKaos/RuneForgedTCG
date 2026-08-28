import assert from "node:assert/strict";
import { DECKS } from "@/game/decks";
import { allCards } from "@/game/cards";
import { permanentAsUnit } from "@/game/client/card-adapters";
import { presentGameEvent } from "@/game/event-presentation";
import type { PermanentInstance } from "@/game/types";
import { runBalanceSimulation } from "./balance-simulator";

for (const deck of DECKS) {
  assert.equal(deck.cards.length, 40, `${deck.id} must contain exactly 40 cards`);
}

for (const id of [
  "forest_moon_snare", "forest_predator_pounce", "forest_spirit_guide",
  "forest_thorn_trap", "forest_pack_tactician", "forest_primal_recall",
  "storm_chain_bolt", "storm_eye", "storm_sky_sentinel", "storm_thunder_angel",
  "wood_root_prison", "wood_bark_rupture",
]) assert.ok(allCards().some((card) => card.defId === id), `${id} must be present in the catalog`);

const first = runBalanceSimulation(DECKS[0].id, DECKS[1].id, 4, 256_056);
const repeated = runBalanceSimulation(DECKS[0].id, DECKS[1].id, 4, 256_056);
assert.deepEqual(repeated, first, "balance simulation must be deterministic for a fixed seed");
assert.equal(first.completedGames, 4);
assert.equal(first.firstPlayerWins + first.secondPlayerWins + first.draws, 4);
assert.ok(first.winRateA95.low >= 0 && first.winRateA95.high <= 100);

const permanent: PermanentInstance = {
  instanceId: "permanent-1", defId: "wood_root_prison", owner: "player",
  power: 1, health: 2, maxHealth: 2, permanentType: "Artifact",
};
assert.deepEqual(permanentAsUnit(permanent).equipment, []);
assert.match(presentGameEvent({ type: "NEXUS_DAMAGED", player: "ai", amount: 3 }).label, /3/);

console.log("PRODUCTION GAMEPLAY 2.56: PASS");
