import assert from "node:assert/strict";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import type { CardDef } from "./types";

function artifact(overrides: Record<string, unknown> = {}): CardDef & Record<string, unknown> {
  return {
    defId: "modal_authoring_probe",
    name: "Modal Authoring Probe",
    region: "Tidecall",
    type: "Artifact",
    cost: 2,
    rarity: "Rare",
    emoji: "◇",
    description: "Choose one certified Studio-authored mode.",
    maxHealth: 4,
    activatedAbilities: [
      {
        description: "Prismatic Choice",
        cost: { mana: 1 },
        maxUsesPerRound: 2,
        modes: [
          { id: "spark", description: "Deal 2 to the enemy Nexus.", effect: { kind: "damageNexus", amount: 2, target: "none" } },
          { id: "study", description: "Draw one card.", effect: { kind: "draw", amount: 1, target: "none" } },
        ],
      },
    ],
    ...overrides,
  } as CardDef & Record<string, unknown>;
}

function expectRejected(card: CardDef & Record<string, unknown>, pattern: RegExp, label: string) {
  const result = validateAuthorableCardWithActivatedAbilities(card);
  assert.equal(result.ok, false, label);
  if (!result.ok) assert.match(result.error, pattern, `${label}: ${result.error}`);
}

{
  const result = validateAuthorableCardWithActivatedAbilities(artifact());
  assert.equal(result.ok, true, "a bounded modal activated ability must be authorable");
  assert.ok(result.ok);
  const ability = result.card.activatedAbilities?.[0];
  assert.ok(ability, "sanitized card keeps the activated ability");
  assert.equal(ability.effect, undefined, "modal authoring never invents a base effect");
  assert.deepEqual(ability.cost, { mana: 1 }, "base cost survives sanitization");
  assert.equal(ability.maxUsesPerRound, 2, "usage limit remains shared at the base ability level");
  assert.deepEqual(ability.modes, [
    { id: "spark", description: "Deal 2 to the enemy Nexus.", effect: { kind: "damageNexus", amount: 2, target: "none" } },
    { id: "study", description: "Draw one card.", effect: { kind: "draw", amount: 1, target: "none" } },
  ], "mode ids, descriptions and effects survive server sanitization exactly");

  const serialized = JSON.parse(JSON.stringify(result.card)) as CardDef & Record<string, unknown>;
  const roundTrip = validateAuthorableCardWithActivatedAbilities(serialized);
  assert.equal(roundTrip.ok, true, "serialized modal CardDef must validate again after persistence-style round-trip");
  assert.ok(roundTrip.ok);
  assert.deepEqual(roundTrip.card.activatedAbilities, result.card.activatedAbilities, "modal authoring round-trip is semantically stable");
}

{
  const nonModal = artifact({
    activatedAbilities: [{
      description: "Legacy-compatible direct effect",
      cost: { mana: 1 },
      effect: { kind: "draw", amount: 1, target: "none" },
    }],
  });
  const result = validateAuthorableCardWithActivatedAbilities(nonModal);
  assert.equal(result.ok, true, "non-modal authoring remains backward compatible");
  assert.ok(result.ok);
  assert.equal(result.card.activatedAbilities?.[0].modes, undefined);
  assert.deepEqual(result.card.activatedAbilities?.[0].effect, { kind: "draw", amount: 1, target: "none" });
}

expectRejected(artifact({
  activatedAbilities: [{
    description: "Ambiguous",
    effect: { kind: "draw", amount: 1, target: "none" },
    modes: [{ id: "one", description: "One", effect: { kind: "draw", amount: 1, target: "none" } }],
  }],
}), /both effect and modes/i, "modal abilities reject ambiguous base effect + modes definitions");

expectRejected(artifact({ activatedAbilities: [{ description: "Empty", cost: { mana: 1 }, modes: [] }] }), /at least one mode/i, "modal abilities require a choice");
expectRejected(artifact({ activatedAbilities: [{ description: "Not array", cost: { mana: 1 }, modes: {} }] }), /modes must be an array/i, "modes must be an array");
expectRejected(artifact({
  activatedAbilities: [{
    description: "Too many",
    cost: { mana: 1 },
    modes: Array.from({ length: 5 }, (_, index) => ({ id: `mode-${index + 1}`, description: `Mode ${index + 1}`, effect: { kind: "draw", amount: 1, target: "none" } })),
  }],
}), /at most 4 modes/i, "Studio modal contract remains bounded");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Duplicate",
    cost: { mana: 1 },
    modes: [
      { id: "same", description: "First", effect: { kind: "draw", amount: 1, target: "none" } },
      { id: "same", description: "Second", effect: { kind: "damageNexus", amount: 1, target: "none" } },
    ],
  }],
}), /duplicate mode id/i, "duplicate replay/wire identifiers fail closed");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Unsafe id",
    cost: { mana: 1 },
    modes: [{ id: "bad id with spaces", description: "Bad", effect: { kind: "draw", amount: 1, target: "none" } }],
  }],
}), /stable id/i, "mode ids are restricted to replay-safe identifiers");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Mode cost override",
    cost: { mana: 1 },
    modes: [{ id: "one", description: "One", cost: { mana: 2 }, effect: { kind: "draw", amount: 1, target: "none" } }],
  }],
}), /cannot override cost, condition or usage limits/i, "modes cannot introduce per-mode costs before that runtime contract exists");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Mode condition override",
    cost: { mana: 1 },
    modes: [{ id: "one", description: "One", condition: { kind: "always" }, effect: { kind: "draw", amount: 1, target: "none" } }],
  }],
}), /cannot override cost, condition or usage limits/i, "modes cannot silently accept uncertified per-mode conditions");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Mode usage override",
    cost: { mana: 1 },
    modes: [{ id: "one", description: "One", maxUsesPerRound: 2, effect: { kind: "draw", amount: 1, target: "none" } }],
  }],
}), /cannot override cost, condition or usage limits/i, "modes cannot introduce per-mode usage budgets");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Stack targeting",
    cost: { mana: 1 },
    modes: [{ id: "counter", description: "Counter", effect: { kind: "denySpell", amount: 0, target: "spellOnStack" } }],
  }],
}), /spell stack|reaction protocol/i, "modal authoring cannot bypass the reaction/stack boundary");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Sacrifice self conflict",
    cost: { sacrificeSelf: true },
    modes: [{ id: "self", description: "Buff self", effect: { kind: "buffSelf", amount: 0, target: "self", buffPower: 1, buffHealth: 1 } }],
  }],
}), /sacrificed source cannot also be.*self target/i, "shared sacrifice cost is checked against every mode");

expectRejected(artifact({
  activatedAbilities: [{
    description: "Unsafe unlimited modal",
    maxUsesPerRound: null,
    modes: [{ id: "loop", description: "Loop", effect: { kind: "damageNexus", amount: 1, target: "none" } }],
  }],
}), /unlimited.*consuming cost/i, "modal authoring preserves infinite-loop protection");

console.log("MODAL ACTIVATED ABILITY AUTHORING: PASS — sanitizer, stable IDs, shared budgets and persistence-style round-trip certified");
