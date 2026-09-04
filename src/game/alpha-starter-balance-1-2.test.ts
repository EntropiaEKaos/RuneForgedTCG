import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import {
  ALPHA_STARTER_BALANCE_1_2_VERSION,
  BALANCE_1_2_CANDIDATES,
  overridesForCandidates,
  recipeForCandidate,
  validateCandidateSet,
} from "./alpha-starter-balance-1-2";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

assert.equal(ALPHA_STARTER_BALANCE_1_2_VERSION, "1.2");
assert.equal(BALANCE_1_2_CANDIDATES.length, 8, "Round 4 must contain four Ember + four Florestia packages");
assert.deepEqual(validateCandidateSet(), [], "all Balance 1.2 candidates must be legal");

const ember = BALANCE_1_2_CANDIDATES.filter((candidate) => candidate.family === "ember");
const florestia = BALANCE_1_2_CANDIDATES.filter((candidate) => candidate.family === "florestia");
assert.equal(ember.length, 4);
assert.equal(florestia.length, 4);

const baseEmber = [...getDeck("ember_aggro").cards];
const baseFlorestia = [...getDeck("florestia_tribal").cards];

for (const candidate of BALANCE_1_2_CANDIDATES) {
  const recipe = recipeForCandidate(candidate);
  const base = getDeck(candidate.deckId).cards;
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain exactly 40 cards`);
  assert.equal(validateDeck(recipe.cards).ok, true, `${candidate.id} must remain legal`);
  assert.equal(
    recipe.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${candidate.id} must preserve Structure + Ritual + Trap teaching cards`,
  );

  const changed = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === base[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(
    changed.length,
    candidate.replacements.length,
    `${candidate.id} must change exactly ${candidate.replacements.length} recipe slots`,
  );
}

const combined = overridesForCandidates([ember[0]!, florestia[0]!]);
assert.equal(validateDeck(combined.ember_aggro!.cards).ok, true);
assert.equal(validateDeck(combined.florestia_tribal!.cards).ok, true);

assert.deepEqual(getDeck("ember_aggro").cards, baseEmber, "screening must not mutate canonical Ember recipe");
assert.deepEqual(getDeck("florestia_tribal").cards, baseFlorestia, "screening must not mutate canonical Florestia recipe");

console.log(
  "ALPHA STARTER BALANCE 1.2 CANDIDATES: PASS — 4 Ember + 4 Florestia · two-slot matchup packages · legal 40-card recipes · semantic teaching slots preserved",
);
