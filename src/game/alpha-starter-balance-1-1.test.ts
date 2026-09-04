import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";
import {
  ALPHA_RECIPE_CANDIDATES,
  ALPHA_STARTER_BALANCE_RECIPE_VERSION,
  recipeForCandidate,
  recipeOverridesForCandidates,
  validateRecipeCandidateSet,
} from "./alpha-starter-balance-1-1";

assert.equal(ALPHA_STARTER_BALANCE_RECIPE_VERSION, "1.1");
assert.deepEqual(validateRecipeCandidateSet(), [], "every recipe-screen candidate must be legal");

const florestia = ALPHA_RECIPE_CANDIDATES.filter((candidate) => candidate.family === "florestia");
const ember = ALPHA_RECIPE_CANDIDATES.filter((candidate) => candidate.family === "ember");
assert.equal(florestia.length, 6, "screening must contain six Florestia candidates");
assert.equal(ember.length, 6, "screening must contain six Ember candidates");

const baseFlorestia = [...getDeck("florestia_tribal").cards];
const baseEmber = [...getDeck("ember_aggro").cards];

for (const candidate of ALPHA_RECIPE_CANDIDATES) {
  const recipe = recipeForCandidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain exactly 40 cards`);
  assert.equal(validateDeck(recipe.cards).ok, true, `${candidate.id} must remain legal`);
  assert.equal(
    recipe.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${candidate.id} must preserve exactly Structure + Ritual + Trap teaching slots`,
  );

  const base = getDeck(candidate.deckId).cards;
  const changedIndexes = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === base[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(
    changedIndexes.length,
    candidate.replacements.length,
    `${candidate.id} must change only its declared recipe slots`,
  );
}

assert.deepEqual(getDeck("florestia_tribal").cards, baseFlorestia, "candidate construction must not mutate canonical Florestia recipe");
assert.deepEqual(getDeck("ember_aggro").cards, baseEmber, "candidate construction must not mutate canonical Ember recipe");

const combined = recipeOverridesForCandidates([
  florestia[0]!,
  ember[0]!,
]);
assert.equal(validateDeck(combined.florestia_tribal!.cards).ok, true);
assert.equal(validateDeck(combined.ember_aggro!.cards).ok, true);
assert.deepEqual(getDeck("florestia_tribal").cards, baseFlorestia, "combined overrides must remain read-only");
assert.deepEqual(getDeck("ember_aggro").cards, baseEmber, "combined overrides must remain read-only");

console.log(
  "ALPHA STARTER BALANCE 1.1 CANDIDATES: PASS — 6 Florestia + 6 Ember · slot-local replacements · 40-card legality · semantic teaching cards preserved",
);
