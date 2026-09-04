import assert from "node:assert/strict";
import { getDeck, validateDeck } from "./decks";
import {
  ALPHA_STARTER_BALANCE_1_2_VERSION,
  WOOD_1_2_CANDIDATES,
  recipeForWoodCandidate,
  validateWoodCandidateSet,
} from "./alpha-starter-balance-1-2";
import { SEMANTIC_ALPHA_CARDS } from "./cards/semantic-alpha";

assert.equal(ALPHA_STARTER_BALANCE_1_2_VERSION, "1.2");
assert.equal(WOOD_1_2_CANDIDATES.length, 8, "Wood 1.2 screening must contain eight one-slot candidates");
assert.deepEqual(validateWoodCandidateSet(), [], "all Wood 1.2 candidates must be legal");

const base = [...getDeck("wood_midrange").cards];

for (const candidate of WOOD_1_2_CANDIDATES) {
  const recipe = recipeForWoodCandidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain exactly 40 cards`);
  assert.equal(validateDeck(recipe.cards).ok, true, `${candidate.id} must remain legal`);
  assert.equal(
    recipe.cards.filter((defId) => defId in SEMANTIC_ALPHA_CARDS).length,
    3,
    `${candidate.id} must preserve Structure + Ritual + Trap teaching cards`,
  );
  const changedIndexes = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === base[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(changedIndexes.length, 1, `${candidate.id} must change exactly one recipe slot`);
}

assert.deepEqual(getDeck("wood_midrange").cards, base, "screening must never mutate the canonical Wood recipe");

console.log(
  "ALPHA STARTER BALANCE 1.2 CANDIDATES: PASS — 8 one-slot Wood variants · 40-card legality · semantic teaching slots preserved",
);
