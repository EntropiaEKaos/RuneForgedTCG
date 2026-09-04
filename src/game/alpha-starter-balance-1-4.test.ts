import assert from "node:assert/strict";
import { getDeck } from "./decks";
import {
  ALPHA_STARTER_BALANCE_1_4_VERSION,
  BALANCE_1_4_CANDIDATES,
  overridesForBalance14Candidate,
  recipeForBalance14Candidate,
  validateBalance14CandidateSet,
} from "./alpha-starter-balance-1-4";

assert.equal(ALPHA_STARTER_BALANCE_1_4_VERSION, "1.4");
assert.equal(BALANCE_1_4_CANDIDATES.length, 4, "Balance 1.4 Round 3 must test exactly four Tide candidates");
assert.deepEqual(validateBalance14CandidateSet(), [], "Balance 1.4 Round 3 candidate set must be structurally valid");

const canonicalTide = [...getDeck("tide_control").cards];
const canonicalEmber = [...getDeck("ember_aggro").cards];
const canonicalStorm = [...getDeck("tempestade_rush").cards];
const canonicalWood = [...getDeck("wood_midrange").cards];
const canonicalFlorestia = [...getDeck("florestia_tribal").cards];
const ids = new Set<string>();

for (const candidate of BALANCE_1_4_CANDIDATES) {
  assert.equal(ids.has(candidate.id), false, `duplicate Balance 1.4 candidate id: ${candidate.id}`);
  ids.add(candidate.id);
  assert.equal(candidate.deckId, "tide_control", `${candidate.id} must remain Tide-only`);

  const recipe = recipeForBalance14Candidate(candidate);
  assert.equal(recipe.cards.length, 40, `${candidate.id} must remain a 40-card starter`);

  const changed = recipe.cards.reduce<number[]>(
    (indexes, defId, index) => (defId === canonicalTide[index] ? indexes : [...indexes, index]),
    [],
  );
  assert.equal(
    changed.length,
    candidate.replacements.length,
    `${candidate.id} must change exactly ${candidate.replacements.length} textual recipe slot(s)`,
  );

  const overrides = overridesForBalance14Candidate(candidate);
  assert.deepEqual(Object.keys(overrides), ["tide_control"], `${candidate.id} must override only Tidecall`);
  assert.deepEqual(overrides.tide_control.cards, recipe.cards, `${candidate.id} override must reproduce its candidate recipe`);

  assert.deepEqual(getDeck("tide_control").cards, canonicalTide, `${candidate.id} must never mutate canonical Tidecall`);
  assert.deepEqual(getDeck("ember_aggro").cards, canonicalEmber, `${candidate.id} must preserve canonical Emberhold`);
  assert.deepEqual(getDeck("tempestade_rush").cards, canonicalStorm, `${candidate.id} must preserve canonical Tempestade`);
  assert.deepEqual(getDeck("wood_midrange").cards, canonicalWood, `${candidate.id} must preserve canonical Ironwood`);
  assert.deepEqual(getDeck("florestia_tribal").cards, canonicalFlorestia, `${candidate.id} must preserve canonical Florestia`);
}

console.log(
  "ALPHA STARTER BALANCE 1.4 ROUND 3 CANDIDATES: PASS — 4 Tide-only overrides · 1-2 textual slots · all non-Tide starters frozen",
);
