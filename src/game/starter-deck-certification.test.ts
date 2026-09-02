import assert from "node:assert/strict";
import { getCard } from "./cards";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import { getDeck, validateDeck } from "./decks";

const STARTER_SPECS = {
  ember_aggro: [
    "rfalpha_ember_structure_forge_bastion",
    "rfalpha_ember_ritual_red_rite",
    "rfalpha_ember_trap_ash_snare",
  ],
  tide_control: [
    "rfalpha_tide_structure_silent_beacon",
    "rfalpha_tide_ritual_memory_tide",
    "rfalpha_tide_trap_countercurrent",
  ],
  wood_midrange: [
    "rfalpha_wood_structure_root_circle",
    "rfalpha_wood_ritual_ancient_roots",
    "rfalpha_wood_trap_emergency_bark",
  ],
  void_shadow: [
    "rfalpha_void_structure_hollow_obelisk",
    "rfalpha_void_ritual_emptiness",
    "rfalpha_void_trap_early_eclipse",
  ],
  florestia_tribal: [
    "rfalpha_forest_structure_ancestral_den",
    "rfalpha_forest_ritual_green_moon",
    "rfalpha_forest_trap_pack_ambush",
  ],
  tempestade_rush: [
    "rfalpha_storm_structure_first_thunder",
    "rfalpha_storm_ritual_eye_of_storm",
    "rfalpha_storm_trap_crosswind",
  ],
} as const;

const starterSemanticIds = new Set<string>();

for (const [deckId, semanticIds] of Object.entries(STARTER_SPECS)) {
  const deck = getDeck(deckId);
  assert.equal(deck.cards.length, 40, `${deckId} must remain a 40-card Alpha starter`);

  const validation = validateDeck(deck.cards);
  assert.equal(
    validation.ok,
    true,
    `${deckId} must remain legal after semantic integration: ${validation.errors.join(" | ")}`,
  );

  const semanticCards = semanticIds.map((defId) => getCard(defId));
  assert.deepEqual(
    semanticCards.map((card) => card.archetypeKey).sort(),
    ["ritual", "structure", "trap"],
    `${deckId} must teach exactly the three certified semantic card families`,
  );

  for (const card of semanticCards) {
    const copies = deck.cards.filter((defId) => defId === card.defId).length;
    assert.equal(copies, 1, `${deckId} must contain exactly one copy of ${card.defId}`);
    assert.ok(
      card.doctrineAffinities?.includes(deckId),
      `${card.defId} must be assigned to a starter matching its doctrine affinity`,
    );
    starterSemanticIds.add(card.defId);
  }
}

assert.deepEqual(
  [...starterSemanticIds].sort(),
  Object.keys(SEMANTIC_ALPHA_CARDS).sort(),
  "the six Alpha starters must expose all 18 semantic Alpha cards",
);

for (const deckId of ["convergence_dual", "convergence_triad"] as const) {
  const deck = getDeck(deckId);
  const semanticWaveCards = deck.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS);
  assert.deepEqual(
    semanticWaveCards,
    [],
    `${deckId} is an advanced Convergence preset and must remain outside this starter teaching pass`,
  );
}

console.log(
  "ALPHA STARTER DECK CERTIFICATION: PASS — 6 starters · 40 cards each · 18/18 semantic cards integrated · Structure/Ritual/Trap taught once per starter · Convergence presets preserved",
);
