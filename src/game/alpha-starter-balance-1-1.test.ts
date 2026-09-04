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

const wood = ALPHA_RECIPE_CANDIDATES.filter((candidate) => candidate.family === "wood");
const tide = ALPHA_RECIPE_CANDIDATES.filter((candidate) => candidate.family === "tide");
assert.equal(wood.length, 6, "screening must contain six Wood candidates");
assert.equal(tide.length, 6, "screening must contain six Tide candidates");

const baseWood = [...getDeck("wood_midrange").cards];
const baseTide = [...getDeck("tide_control").cards];

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

assert.deepEqual(getDeck("wood_midrange").cards, baseWood, "candidate construction must not mutate canonical Wood recipe");
assert.deepEqual(getDeck("tide_control").cards, baseTide, "candidate construction must not mutate canonical Tide recipe");

const combined = recipeOverridesForCandidates([
  wood.find((candidate) => candidate.id === "wood_split_champion_canopy")!,
  tide.find((candidate) => candidate.id === "tide_both_dispel_draw_mirror")!,
]);
assert.equal(validateDeck(combined.wood_midrange!.cards).ok, true);
assert.equal(validateDeck(combined.tide_control!.cards).ok, true);
assert.deepEqual(getDeck("wood_midrange").cards, baseWood, "combined overrides must remain read-only");
assert.deepEqual(getDeck("tide_control").cards, baseTide, "combined overrides must remain read-only");

console.log(
  "ALPHA STARTER BALANCE 1.1 CANDIDATES: PASS — 6 Wood + 6 Tide · slot-local replacements · 40-card legality · semantic teaching cards preserved",
);
