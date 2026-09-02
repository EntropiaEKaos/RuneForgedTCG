import assert from "node:assert/strict";
import { CARDS } from "./cards";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import { castSpell, createCustomGame } from "./engine";
import { REGION_ORDER } from "./region-identity";
import {
  applyCertifiedSemanticCardType,
  validateAuthorableCardWithSemanticTypes,
} from "./semantic-card-type-authoring";
import {
  ritualHasManaInteraction,
  semanticCardTypeLabel,
} from "./semantic-card-types";
import type { CardDef, DeckInput } from "./types";

const cards = Object.values(SEMANTIC_ALPHA_CARDS);
assert.equal(cards.length, 18, "Alpha semantic wave must contain exactly 18 cards");

for (const region of REGION_ORDER) {
  const regional = cards.filter((card) => card.region === region);
  assert.equal(regional.length, 3, `${region} must receive exactly three semantic Alpha cards`);
  for (const key of ["structure", "ritual", "trap"] as const) {
    assert.equal(
      regional.filter((card) => card.archetypeKey === key).length,
      1,
      `${region} must receive exactly one ${key}`,
    );
  }
}

for (const card of cards) {
  assert.equal(CARDS[card.defId], card, `${card.defId} must be registered in the canonical base catalog`);
  const validated = validateAuthorableCardWithSemanticTypes(card);
  assert.equal(validated.ok, true, `${card.defId} must pass canonical authoring validation`);
  assert.ok(["Estrutura", "Ritual", "Armadilha"].includes(semanticCardTypeLabel(card)));
}

const rituals = cards.filter((card) => card.archetypeKey === "ritual");
assert.equal(rituals.length, 6);
for (const ritual of rituals) {
  assert.equal(ritual.type, "Spell");
  assert.equal(ritual.speed, undefined, `${ritual.defId} must remain main-phase only`);
  assert.equal(ritualHasManaInteraction(ritual), true, `${ritual.defId} must manipulate mana`);
  assert.match(ritual.description, /Ritual de Mana/);
}

const studioPreset = applyCertifiedSemanticCardType(
  {
    defId: "ritual_studio_preset_probe",
    name: "Ritual Studio Preset Probe",
    region: "Tidecall",
    cost: 2,
    description: "probe",
    rarity: "Common",
    emoji: "🜂",
  },
  "ritual",
);
assert.equal(studioPreset.spell?.kind, "manaRefund", "Card Studio Ritual preset must start with a mana effect");

const invalidCollectibleRitual: CardDef = {
  defId: "invalid_collectible_ritual_without_mana",
  name: "Invalid Ritual",
  region: "Tidecall",
  type: "Spell",
  archetypeKey: "ritual",
  archetypeName: "Ritual",
  cost: 2,
  spell: { kind: "draw", amount: 1, target: "none" },
  description: "Must fail because it does not manipulate mana.",
  rarity: "Common",
  emoji: "🜂",
};
const invalid = validateAuthorableCardWithSemanticTypes(invalidCollectibleRitual);
assert.equal(invalid.ok, false, "Collectible Ritual without mana interaction must fail closed");
if (!invalid.ok) assert.match(invalid.error, /manipulate mana/i);

// Execution probe: Emberhold Ritual spends 3 regular mana, refunds 1 and applies
// its regional payoff. This proves mana interaction is authoritative gameplay,
// not presentation-only metadata.
const deck: DeckInput = {
  id: "semantic-alpha-ritual-probe",
  name: "Semantic Alpha Ritual Probe",
  cards: Array(20).fill("ember_whelp"),
};
const state = createCustomGame("Ritual Tester", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: true,
  playerStartingHand: 0,
  aiStartingHand: 0,
  playerStartingMana: 5,
  aiStartingMana: 5,
  seed: 919191,
});
state.phase = "main";
state.activePlayer = "player";
state.players.player.mana = 5;
state.players.player.spellMana = 0;
state.players.player.hand = [{
  instanceId: "ritual-hand",
  defId: "rfalpha_ember_ritual_red_rite",
}];
const afterRitual = castSpell(state, "player", "ritual-hand");
assert.equal(afterRitual.players.player.mana, 3, "Ritual must refund 1 mana after paying its 3-mana cost");
assert.equal(afterRitual.players.ai.nexusHealth, 18, "Emberhold Ritual must preserve its regional damage payoff");

console.log(
  "SEMANTIC ALPHA WAVE PASS: 18 cards · six regions × Structure/Ritual/Trap · Rituals are mana-driven · Studio preset and execution certified",
);
