import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import type { CardDef } from "./types";

function base(type: CardDef["type"] = "Unit"): Partial<CardDef> & Record<string, unknown> {
  return {
    defId: `reaction_authoring_${type.toLowerCase()}`,
    name: "Reaction Authoring Probe",
    region: "Tidecall",
    type,
    cost: 2,
    description: "Probe",
    rarity: "Common",
    emoji: "⚡",
    ...(type === "Unit" ? { power: 2, health: 2 } : {}),
    ...(type === "Enchantment" || type === "Artifact" ? { maxHealth: 3 } : {}),
    ...(type === "Sentinela" ? {
      sentinela: {
        startingLoyalty: 3,
        abilities: [{ cost: 1, description: "Legacy", effect: { kind: "draw", amount: 1, target: "none" } }],
      },
    } : {}),
  };
}

const valid = validateAuthorableCardWithActivatedAbilities({
  ...base(),
  reactionActivatedAbilities: [{
    description: "Deny from the field",
    respondsTo: ["spell"],
    cost: { spellMana: 1, discardFromHand: 1 },
    maxUsesPerRound: 1,
    effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
  }],
});
if (!valid.ok) throw new Error(`Valid reaction ability was rejected: ${valid.error}`);
const authored = valid.card.reactionActivatedAbilities?.[0];
if (!authored || authored.respondsTo.join(",") !== "spell") throw new Error("respondsTo was not persisted canonically");
if (authored.cost?.spellMana !== 1 || authored.cost?.discardFromHand !== 1) throw new Error("shared reaction costs did not round-trip");
if (authored.effect?.target !== "spellOnStack") throw new Error("reaction stack target did not round-trip");

const modal = validateAuthorableCardWithActivatedAbilities({
  ...base(),
  reactionActivatedAbilities: [{
    description: "Choose a response",
    respondsTo: ["unit", "spell"],
    cost: { mana: 1 },
    modes: [
      { id: "shield", description: "Protect", effect: { kind: "grantBarrier", amount: 0, target: "allyUnit" } },
      { id: "deny", description: "Deny", effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" } },
    ],
  }],
});
if (!modal.ok || modal.card.reactionActivatedAbilities?.[0]?.modes?.length !== 2) {
  throw new Error(`Valid modal reaction ability failed authoring: ${modal.ok ? "missing modes" : modal.error}`);
}

for (const [name, reactionActivatedAbilities] of [
  ["empty respondsTo", [{ description: "Bad", respondsTo: [], effect: { kind: "draw", amount: 1, target: "none" } }]],
  ["duplicate respondsTo", [{ description: "Bad", respondsTo: ["spell", "spell"], effect: { kind: "draw", amount: 1, target: "none" } }]],
  ["unknown respondsTo", [{ description: "Bad", respondsTo: ["combat"], effect: { kind: "draw", amount: 1, target: "none" } }]],
  ["mixed classic stack timing", [{ description: "Bad", respondsTo: ["spell", "unit"], effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" } }]],
] as const) {
  const result = validateAuthorableCardWithActivatedAbilities({ ...base(), reactionActivatedAbilities: reactionActivatedAbilities as unknown as CardDef["reactionActivatedAbilities"] });
  if (result.ok) throw new Error(`${name} must fail closed`);
}

const ordinaryStack = validateAuthorableCardWithActivatedAbilities({
  ...base(),
  activatedAbilities: [{ description: "Illegal main counter", effect: { kind: "negateSpell", amount: 0, target: "spellOnStack" } }],
});
if (ordinaryStack.ok) throw new Error("Main-phase activated ability must not author spellOnStack");

for (const type of ["Enchantment", "Artifact", "Sentinela"] as const) {
  const result = validateAuthorableCardWithActivatedAbilities({
    ...base(type),
    reactionActivatedAbilities: [{
      description: "Illegal self",
      respondsTo: ["unit"],
      effect: { kind: "buffSelf", amount: 0, buffPower: 1, buffHealth: 0, target: "self" },
    }],
  });
  if (result.ok) throw new Error(`${type} self-target reaction ability must fail closed`);
}

for (const type of ["Spell", "Equipment"] as const) {
  const source = base(type);
  if (type === "Spell") source.spell = { kind: "draw", amount: 1, target: "none" };
  if (type === "Equipment") source.equipment = { buffPower: 1, buffHealth: 0, keywords: [] };
  const result = validateAuthorableCardWithActivatedAbilities({
    ...source,
    reactionActivatedAbilities: [{ description: "Illegal source", respondsTo: ["spell"], effect: { kind: "draw", amount: 1, target: "none" } }],
  });
  if (result.ok) throw new Error(`${type} must not author battlefield reaction abilities`);
}

console.log("REACTION ACTIVATED ABILITY AUTHORING: PASS — strict timing, modal, stack-target and source contracts certified");