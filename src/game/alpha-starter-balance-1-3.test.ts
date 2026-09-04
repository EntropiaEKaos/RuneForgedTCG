import assert from "node:assert/strict";
import { getDeck } from "./decks";
import {
  ALPHA_STARTER_BALANCE_1_3_VERSION,
  BALANCE_1_3_CANDIDATES,
  overridesForBalance13Candidate,
  recipeForBalance13Candidate,
  validateBalance13CandidateSet,
} from "./alpha-starter-balance-1-3";

assert.equal(ALPHA_STARTER_BALANCE_1_3_VERSION, "1.3");
assert.equal(BALANCE_1_3_CANDIDATES.length, 8, "Balance 1.3 Round 1 must screen exactly eight candidates");
assert.deepEqual(validateBalance13CandidateSet(), [], "Balance 1.3 candidate set must be structurally valid");

const canonicalFlorestia = [...getDeck("florestia_tribal").cards];
const canonicalEmber = [...getDeck("ember_aggro").cards];
const ids = new Set<string>();

for (const candidate of BALANCE_1_3_CANDIDATES) {
  assert.equal(ids.has(candidate.id), false, `duplicate Balance 1.3 candidate id: ${candidate.id}`);
  ids.add(candidate.id);

  assert.equal(candidate.deckId, "florestia_tribal", `${candidate.id} must remain Florestia-only`);
  assert.equal(candidate.replacements.length, 2, `${candidate.id} must change exactly two recipe slots`);

  const recipe = recipeForBalance13Candidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain a 40-card starter`);

  const changed = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === canonicalFlorestia[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(changed.length, 2, `${candidate.id} must change exactly two textual recipe positions`);

  const overrides = overridesForBalance13Candidate(candidate);
  assert.deepEqual(Object.keys(overrides), ["florestia_tribal"], `${candidate.id} must override only Florestia`);
  assert.deepEqual(overrides.florestia_tribal.cards, recipe.cards, `${candidate.id} override must reproduce its candidate recipe`);

  assert.deepEqual(
    getDeck("ember_aggro").cards,
    canonicalEmber,
    `${candidate.id} exploration must never mutate canonical Emberhold`,
  );
  assert.deepEqual(
    getDeck("florestia_tribal").cards,
    canonicalFlorestia,
    `${candidate.id} exploration must never mutate canonical Florestia`,
  );
}

console.log(
  "ALPHA STARTER BALANCE 1.3 CANDIDATES: PASS — 8 Florestia-only two-slot overrides · canonical recipes untouched",
);
