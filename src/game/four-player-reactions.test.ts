import assert from "node:assert/strict";
import { CARDS, collectibleCards } from "./cards";
import { canFourPlayerCounterStackItem, canFourPlayerReactWithCard } from "./four-player-reactions";
import type { FourPlayerStackItem } from "./four-player-stack";

const burn = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Spell"
  && card.spell?.kind === "damageNexus"
  && !(card.customKeywords ?? []).includes("uncounterable"),
);
assert.ok(burn, "fixture requires a counterable spell");

const counter = collectibleCards().find((card) =>
  card.collectible !== false
  && card.type === "Spell"
  && card.speed === "Burst"
  && card.spell?.kind === "negateSpell",
);
assert.ok(counter, "fixture requires a Burst negateSpell");

const pendingSpell: FourPlayerStackItem = {
  id: "pending-spell",
  controller: "p1",
  kind: "spell_cast",
  payload: { defId: burn.defId, cardType: "Spell" },
};
assert.equal(canFourPlayerReactWithCard(counter, pendingSpell), true);
assert.equal(canFourPlayerCounterStackItem(counter, pendingSpell), true);

const unitOnlyCounter = {
  ...counter,
  customKeywords: [
    ...(counter.customKeywords ?? []).filter((key) => !key.startsWith("counter_")),
    "counter_unit",
  ],
};
assert.equal(canFourPlayerCounterStackItem(unitOnlyCounter, pendingSpell), false, "counter filters must be authoritative");

const canonical = CARDS[burn.defId];
assert.ok(canonical, "fixture burn must be present in canonical card registry");
const originalRules = [...(canonical.customKeywords ?? [])];
try {
  canonical.customKeywords = [...originalRules, "uncounterable"];
  assert.equal(canFourPlayerCounterStackItem(counter, pendingSpell), false, "uncounterable must close the 4P counter window");
} finally {
  canonical.customKeywords = originalRules;
}

console.log("FOUR PLAYER REACTION RULES: PASS — speed, counter filters and uncounterable semantics");
