import assert from "node:assert/strict";
import { ABILITY_FEATURE_SUPPORT } from "./ability-system";
import { sanitizeCardEffect, validateAuthorableCard } from "./card-authoring";
import {
  EFFECT_CHAIN_AUTHORING_CONTRACT,
  EFFECT_CHAIN_MAX_EFFECTS,
  EFFECT_CHAIN_MAX_SUPPORTED_DEPTH,
  effectCanAddFollowUp,
  effectChainDepthSupported,
} from "./effect-chain-contract";
import { applyCardEffectForSandbox, createCustomGame } from "./engine";
import type { CardDef, CardEffect, DeckInput } from "./types";

assert.equal(ABILITY_FEATURE_SUPPORT.chained, "supported");
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.support, ABILITY_FEATURE_SUPPORT.chained);
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.execution, "sequential");
assert.equal(EFFECT_CHAIN_MAX_SUPPORTED_DEPTH, 12);
assert.equal(EFFECT_CHAIN_MAX_EFFECTS, 13);
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.maxDepth, EFFECT_CHAIN_MAX_SUPPORTED_DEPTH);
assert.equal(EFFECT_CHAIN_AUTHORING_CONTRACT.maxEffects, EFFECT_CHAIN_MAX_EFFECTS);

assert.equal(effectChainDepthSupported(0), true);
assert.equal(effectChainDepthSupported(EFFECT_CHAIN_MAX_SUPPORTED_DEPTH), true);
assert.equal(effectChainDepthSupported(EFFECT_CHAIN_MAX_SUPPORTED_DEPTH + 1), false);
assert.equal(effectChainDepthSupported(-1), false);
assert.equal(effectChainDepthSupported(1.5), false);
assert.equal(effectCanAddFollowUp(EFFECT_CHAIN_MAX_SUPPORTED_DEPTH - 1), true);
assert.equal(effectCanAddFollowUp(EFFECT_CHAIN_MAX_SUPPORTED_DEPTH), false);

function damageChain(effectCount: number): CardEffect {
  assert.ok(effectCount >= 1);
  let effect: CardEffect = { kind: "damageNexus", amount: 1, target: "none" };
  for (let index = 1; index < effectCount; index += 1) {
    effect = { kind: "damageNexus", amount: 1, target: "none", also: effect };
  }
  return effect;
}

const maxChain = damageChain(EFFECT_CHAIN_MAX_EFFECTS);
const sanitizedMaxChain = sanitizeCardEffect(maxChain);
assert.ok(sanitizedMaxChain, "the exact canonical effect-chain boundary must remain authorable");
assert.equal(
  sanitizeCardEffect(damageChain(EFFECT_CHAIN_MAX_EFFECTS + 1)),
  null,
  "authoring must fail closed when a follow-up exceeds the canonical boundary",
);

const spell: CardDef = {
  defId: "effect_chain_probe",
  name: "Effect Chain Probe",
  region: "Emberhold",
  type: "Spell",
  cost: 1,
  description: "Certifies the canonical sequential follow-up contract.",
  rarity: "Common",
  emoji: "⛓️",
  spell: maxChain,
};
assert.equal(validateAuthorableCard(spell).ok, true, "a max-depth chain is valid through the complete CardDef authoring path");
assert.equal(
  validateAuthorableCard({ ...spell, spell: damageChain(EFFECT_CHAIN_MAX_EFFECTS + 1) }).ok,
  false,
  "the complete CardDef authoring path rejects an over-depth chain",
);

const deck: DeckInput = { id: "effect-chain", name: "Effect Chain", cards: Array(20).fill("ember_whelp") };
const state = createCustomGame("Effect Chain", deck, deck, {
  skipMulligan: true,
  playerGoesFirst: true,
});
const startingNexus = state.players.ai.nexusHealth;
const resolved = applyCardEffectForSandbox(state, "player", sanitizedMaxChain);
assert.equal(
  resolved.players.ai.nexusHealth,
  startingNexus - EFFECT_CHAIN_MAX_EFFECTS,
  "the authoritative effect loop executes every authored follow-up exactly once and in sequence",
);
assert.equal(state.players.ai.nexusHealth, startingNexus, "sandbox resolution must not mutate its input state");

console.log(`EFFECT CHAIN CONTRACT: PASS — ${EFFECT_CHAIN_MAX_EFFECTS} sequential effects authorable/executable; effect ${EFFECT_CHAIN_MAX_EFFECTS + 1} rejected`);
