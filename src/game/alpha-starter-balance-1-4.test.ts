import assert from "node:assert/strict";
import { getDeck } from "./decks";
import {
  ALPHA_STARTER_BALANCE_1_4_VERSION,
  BALANCE_1_4_CANDIDATES,
  overridesForBalance14Candidates,
  recipeForBalance14Candidate,
  validateBalance14CandidateSet,
} from "./alpha-starter-balance-1-4";

assert.equal(ALPHA_STARTER_BALANCE_1_4_VERSION, "1.4");
assert.equal(BALANCE_1_4_CANDIDATES.length, 8, "Balance 1.4 Round 1 must screen exactly eight candidates");
assert.deepEqual(validateBalance14CandidateSet(), [], "Balance 1.4 candidate set must be structurally valid");

const canonicalEmber = [...getDeck("ember_aggro").cards];
const canonicalTide = [...getDeck("tide_control").cards];
const ids = new Set<string>();

for (const candidate of BALANCE_1_4_CANDIDATES) {
  assert.equal(ids.has(candidate.id), false, `duplicate Balance 1.4 candidate id: ${candidate.id}`);
  ids.add(candidate.id);

  const recipe = recipeForBalance14Candidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain a 40-card starter`);

  const canonical = candidate.deckId === "ember_aggro" ? canonicalEmber : canonicalTide;
  const changed = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === canonical[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(changed.length, 1, `${candidate.id} must change exactly one textual recipe position`);

  const overrides = overridesForBalance14Candidates([candidate]);
  assert.deepEqual(Object.keys(overrides), [candidate.deckId], `${candidate.id} must override only its candidate deck`);
  assert.deepEqual(overrides[candidate.deckId].cards, recipe.cards, `${candidate.id} override must reproduce its candidate recipe`);

  assert.deepEqual(
    getDeck("ember_aggro").cards,
    canonicalEmber,
    `${candidate.id} exploration must never mutate canonical Emberhold`,
  );
  assert.deepEqual(
    getDeck("tide_control").cards,
    canonicalTide,
    `${candidate.id} exploration must never mutate canonical Tidecall`,
  );
}

const firstEmber = BALANCE_1_4_CANDIDATES.find((candidate) => candidate.family === "ember");
const firstTide = BALANCE_1_4_CANDIDATES.find((candidate) => candidate.family === "tide");
assert.ok(firstEmber, "Balance 1.4 must expose at least one Ember candidate");
assert.ok(firstTide, "Balance 1.4 must expose at least one Tide candidate");

const combined = overridesForBalance14Candidates([firstEmber, firstTide]);
assert.deepEqual(
  new Set(Object.keys(combined)),
  new Set(["ember_aggro", "tide_control"]),
  "cross-family finalist override must affect only Emberhold and Tidecall",
);
assert.deepEqual(getDeck("ember_aggro").cards, canonicalEmber, "combined override must not mutate canonical Emberhold");
assert.deepEqual(getDeck("tide_control").cards, canonicalTide, "combined override must not mutate canonical Tidecall");

console.log(
  "ALPHA STARTER BALANCE 1.4 CANDIDATES: PASS — 4 Ember + 4 Tide one-slot overrides · cross-family composition · canonical recipes untouched",
);
