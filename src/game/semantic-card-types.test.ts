import assert from "node:assert/strict";
import { CARDS } from "./cards";
import {
  applyStackedActionWithAi,
  canCastReaction,
  canPlayCard,
  canReactWithCard,
  castSpell,
  createCustomGame,
  playUnit,
} from "./engine";
import { applyGameAction } from "./reducer";
import { validateAuthorableCardWithSemanticTypes } from "./semantic-card-type-authoring";
import { semanticCardTypeLabel } from "./semantic-card-types";
import type { CardDef, DeckInput, GameState } from "./types";

const structure: CardDef = {
  defId: "test_structure_gate",
  name: "Gate of Embers",
  region: "Emberhold",
  type: "Artifact",
  archetypeKey: "structure",
  archetypeName: "Estrutura",
  cost: 2,
  maxHealth: 5,
  description: "A fortified structure.",
  rarity: "Rare",
  emoji: "🏰",
  collectible: false,
};

const ritual: CardDef = {
  defId: "test_ritual_memory",
  name: "Ritual of Memory",
  region: "Tidecall",
  type: "Spell",
  archetypeKey: "ritual",
  archetypeName: "Ritual",
  cost: 2,
  spell: { kind: "draw", amount: 1, target: "none" },
  description: "A deliberate main-phase rite.",
  rarity: "Rare",
  emoji: "🜂",
  collectible: false,
};

const trap: CardDef = {
  defId: "test_trap_nullsigil",
  name: "Nullsigil Trap",
  region: "Voidborn",
  type: "Spell",
  archetypeKey: "trap",
  archetypeName: "Armadilha",
  cost: 1,
  speed: "Burst",
  spell: { kind: "negateSpell", amount: 0, target: "spellOnStack" },
  description: "A reaction-only counter trap.",
  rarity: "Rare",
  emoji: "🪤",
  collectible: false,
};

const legacyArtifact: CardDef = {
  defId: "test_legacy_artifact",
  name: "Legacy Dynamo",
  region: "Ironwood",
  type: "Artifact",
  cost: 2,
  maxHealth: 3,
  description: "Legacy permanent semantics probe.",
  rarity: "Common",
  emoji: "⚙️",
  collectible: false,
};

const injected = [structure, ritual, trap, legacyArtifact];
for (const card of injected) CARDS[card.defId] = card;

const deck: DeckInput = {
  id: "semantic-type-probe",
  name: "Semantic Type Probe",
  cards: Array(20).fill("ember_whelp"),
};

function state(): GameState {
  const s = createCustomGame("Semantic Tester", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    playerStartingHand: 0,
    aiStartingHand: 0,
    playerStartingMana: 5,
    aiStartingMana: 5,
    seed: 787878,
  });
  s.phase = "main";
  s.activePlayer = "player";
  s.players.player.hand = [];
  s.players.ai.hand = [];
  s.players.player.spellMana = 0;
  s.players.ai.spellMana = 0;
  return s;
}

try {
  // Authoring contracts are fail-closed and normalize the player-facing names.
  const structureAuth = validateAuthorableCardWithSemanticTypes(structure);
  if (!structureAuth.ok) throw new Error(structureAuth.error);
  assert.equal(structureAuth.card.type, "Artifact");
  assert.equal(structureAuth.card.archetypeName, "Estrutura");
  assert.equal(structureAuth.card.maxHealth, 5);
  assert.equal(semanticCardTypeLabel(structureAuth.card), "Estrutura");

  const structureDefaultHp = validateAuthorableCardWithSemanticTypes({ ...structure, defId: "test_structure_default_hp", maxHealth: undefined });
  assert.equal(structureDefaultHp.ok, true);
  if (structureDefaultHp.ok) assert.equal(structureDefaultHp.card.maxHealth, 3);

  const wrongStructureBase = validateAuthorableCardWithSemanticTypes({
    ...structure,
    defId: "test_structure_wrong_base",
    type: "Spell",
    spell: { kind: "draw", amount: 1, target: "none" },
  });
  assert.equal(wrongStructureBase.ok, false);

  const spellStructure = validateAuthorableCardWithSemanticTypes({
    ...structure,
    defId: "test_structure_spell_payload",
    spell: { kind: "draw", amount: 1, target: "none" },
  });
  assert.equal(spellStructure.ok, false);

  const ritualAuth = validateAuthorableCardWithSemanticTypes(ritual);
  assert.equal(ritualAuth.ok, true);
  const fastRitual = validateAuthorableCardWithSemanticTypes({ ...ritual, defId: "test_fast_ritual", speed: "Fast" });
  assert.equal(fastRitual.ok, false);

  const trapAuth = validateAuthorableCardWithSemanticTypes(trap);
  assert.equal(trapAuth.ok, true);
  const slowTrap = validateAuthorableCardWithSemanticTypes({ ...trap, defId: "test_slow_trap", speed: undefined });
  assert.equal(slowTrap.ok, false);
  const wrongTrapBase = validateAuthorableCardWithSemanticTypes({ ...trap, defId: "test_wrong_trap_base", type: "Artifact", maxHealth: 3 });
  assert.equal(wrongTrapBase.ok, false);

  // Structure: regular mana, permanent slot, no spellsCast progression.
  const structureState = state();
  structureState.players.player.mana = 2;
  structureState.players.player.spellMana = 3;
  structureState.players.player.hand = [{ instanceId: "structure-hand", defId: structure.defId }];
  assert.equal(canPlayCard(structureState, "player", "structure-hand"), true);
  const structurePlayed = playUnit(structureState, "player", "structure-hand");
  assert.equal(structurePlayed.players.player.mana, 0);
  assert.equal(structurePlayed.players.player.spellMana, 3);
  assert.equal(structurePlayed.players.player.stats.spellsCast, 0);
  assert.equal(structurePlayed.players.player.permanents.some((perm) => perm.defId === structure.defId), true);

  // Legacy Artifact behavior must remain unchanged: it may spend spell mana and counts as a spell cast.
  const legacyState = state();
  legacyState.players.player.mana = 0;
  legacyState.players.player.spellMana = 2;
  legacyState.players.player.hand = [{ instanceId: "legacy-artifact-hand", defId: legacyArtifact.defId }];
  assert.equal(canPlayCard(legacyState, "player", "legacy-artifact-hand"), true);
  const legacyPlayed = playUnit(legacyState, "player", "legacy-artifact-hand");
  assert.equal(legacyPlayed.players.player.mana, 0);
  assert.equal(legacyPlayed.players.player.spellMana, 0);
  assert.equal(legacyPlayed.players.player.stats.spellsCast, 1);

  // Ritual: proactive Spell semantics are preserved, but reaction timing is forbidden.
  const ritualState = state();
  ritualState.players.player.mana = 0;
  ritualState.players.player.spellMana = 2;
  ritualState.players.player.hand = [{ instanceId: "ritual-hand", defId: ritual.defId }];
  assert.equal(canPlayCard(ritualState, "player", "ritual-hand"), true);
  assert.equal(canCastReaction(ritualState, "player", "ritual-hand", "unit"), false);
  const ritualCast = castSpell(ritualState, "player", "ritual-hand");
  assert.equal(ritualCast.players.player.spellMana, 0);
  assert.equal(ritualCast.players.player.stats.spellsCast, 1);
  assert.equal(ritualCast.players.player.hand.some((card) => card.instanceId === "ritual-hand"), false);

  // Trap: never proactive, including direct authoritative reducer opcodes.
  const trapState = state();
  trapState.players.player.mana = 0;
  trapState.players.player.spellMana = 3;
  trapState.players.player.hand = [{ instanceId: "trap-hand", defId: trap.defId }];
  trapState.players.ai.hand = [{ instanceId: "pending-unit", defId: "ember_whelp" }];
  assert.equal(canPlayCard(trapState, "player", "trap-hand"), false);
  assert.equal(applyGameAction(trapState, { type: "play", player: "player", instanceId: "trap-hand" }, false).next, trapState);
  assert.equal(applyGameAction(trapState, { type: "cast", player: "player", instanceId: "trap-hand" }, false).next, trapState);
  assert.equal(canReactWithCard(trapState, "player", "trap-hand", { kind: "unit", player: "ai", instanceId: "pending-unit", defId: "ember_whelp" }), true);

  const trapped = applyStackedActionWithAi(
    trapState,
    { kind: "unit", player: "ai", instanceId: "pending-unit", defId: "ember_whelp" },
    "react",
    { kind: "spell", player: "player", instanceId: "trap-hand", defId: trap.defId },
    () => null,
  ).next;
  assert.equal(trapped.players.player.hand.some((card) => card.instanceId === "trap-hand"), false);
  assert.equal(trapped.players.player.stats.spellsCast, 1);
  assert.equal(trapped.players.ai.hand.some((card) => card.instanceId === "pending-unit"), false);
  assert.equal(trapped.players.ai.bench.some((unit) => unit.defId === "ember_whelp"), false);

  // Structure preserves regular-mana semantics even when it travels through the stack.
  const stackStructure = state();
  stackStructure.activePlayer = "ai";
  stackStructure.players.ai.mana = 2;
  stackStructure.players.ai.spellMana = 3;
  stackStructure.players.ai.hand = [{ instanceId: "stack-structure", defId: structure.defId }];
  stackStructure.players.player.mana = 0;
  stackStructure.players.player.spellMana = 1;
  stackStructure.players.player.hand = [{ instanceId: "stack-trap", defId: trap.defId }];
  const negatedStructure = applyStackedActionWithAi(
    stackStructure,
    { kind: "unit", player: "ai", instanceId: "stack-structure", defId: structure.defId },
    "react",
    { kind: "spell", player: "player", instanceId: "stack-trap", defId: trap.defId },
    () => null,
  ).next;
  assert.equal(negatedStructure.players.ai.mana, 0);
  assert.equal(negatedStructure.players.ai.spellMana, 3);
  assert.equal(negatedStructure.players.ai.stats.spellsCast, 0);
  assert.equal(negatedStructure.players.ai.permanents.some((perm) => perm.defId === structure.defId), false);

  const resolvingStructure = state();
  resolvingStructure.activePlayer = "ai";
  resolvingStructure.players.ai.mana = 2;
  resolvingStructure.players.ai.spellMana = 3;
  resolvingStructure.players.ai.hand = [{ instanceId: "resolve-structure", defId: structure.defId }];
  const resolvedStructure = applyStackedActionWithAi(
    resolvingStructure,
    { kind: "unit", player: "ai", instanceId: "resolve-structure", defId: structure.defId },
    "skip",
    null,
    () => null,
  ).next;
  assert.equal(resolvedStructure.players.ai.mana, 0);
  assert.equal(resolvedStructure.players.ai.spellMana, 3);
  assert.equal(resolvedStructure.players.ai.stats.spellsCast, 0);
  assert.equal(resolvedStructure.players.ai.permanents.some((perm) => perm.defId === structure.defId), true);

  console.log("SEMANTIC CARD TYPES PASS: Structure regular-mana permanent · Ritual main-only · Trap reaction-only · legacy semantics preserved");
} finally {
  for (const card of injected) delete CARDS[card.defId];
}
