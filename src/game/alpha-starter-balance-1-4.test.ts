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
assert.equal(BALANCE_1_4_CANDIDATES.length, 8, "Balance 1.4 Round 2 must screen exactly eight candidates");
assert.deepEqual(validateBalance14CandidateSet(), [], "Balance 1.4 Round 2 candidate set must be structurally valid");

const canonicalStorm = [...getDeck("tempestade_rush").cards];
const canonicalTide = [...getDeck("tide_control").cards];
const canonicalEmber = [...getDeck("ember_aggro").cards];
const ids = new Set<string>();

for (const candidate of BALANCE_1_4_CANDIDATES) {
  assert.equal(ids.has(candidate.id), false, `duplicate Balance 1.4 candidate id: ${candidate.id}`);
  ids.add(candidate.id);

  const recipe = recipeForBalance14Candidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain a 40-card starter`);

  const canonical = candidate.deckId === "tempestade_rush" ? canonicalStorm : canonicalTide;
  const expectedChanges = candidate.family === "storm" ? 1 : 2;
  const changed = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === canonical[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(changed.length, expectedChanges, `${candidate.id} must change exactly ${expectedChanges} textual recipe slot(s)`);

  const overrides = overridesForBalance14Candidates([candidate]);
  assert.deepEqual(Object.keys(overrides), [candidate.deckId], `${candidate.id} must override only its candidate deck`);
  assert.deepEqual(overrides[candidate.deckId].cards, recipe.cards, `${candidate.id} override must reproduce its candidate recipe`);

  assert.deepEqual(getDeck("tempestade_rush").cards, canonicalStorm, `${candidate.id} must never mutate canonical Tempestade`);
  assert.deepEqual(getDeck("tide_control").cards, canonicalTide, `${candidate.id} must never mutate canonical Tidecall`);
  assert.deepEqual(getDeck("ember_aggro").cards, canonicalEmber, `${candidate.id} Round 2 must never mutate canonical Emberhold`);
}

const firstStorm = BALANCE_1_4_CANDIDATES.find((candidate) => candidate.family === "storm");
const firstTide = BALANCE_1_4_CANDIDATES.find((candidate) => candidate.family === "tide");
assert.ok(firstStorm, "Balance 1.4 Round 2 must expose at least one Tempestade candidate");
assert.ok(firstTide, "Balance 1.4 Round 2 must expose at least one Tide candidate");

const combined = overridesForBalance14Candidates([firstStorm, firstTide]);
assert.deepEqual(
  new Set(Object.keys(combined)),
  new Set(["tempestade_rush", "tide_control"]),
  "cross-family finalist override must affect only Tempestade and Tidecall",
);
assert.deepEqual(getDeck("tempestade_rush").cards, canonicalStorm, "combined override must not mutate canonical Tempestade");
assert.deepEqual(getDeck("tide_control").cards, canonicalTide, "combined override must not mutate canonical Tidecall");
assert.deepEqual(getDeck("ember_aggro").cards, canonicalEmber, "combined override must preserve canonical Emberhold");

console.log(
  "ALPHA STARTER BALANCE 1.4 ROUND 2 CANDIDATES: PASS — 4 Tempestade one-slot + 4 Tide two-slot overrides · canonical Ember untouched",
);
