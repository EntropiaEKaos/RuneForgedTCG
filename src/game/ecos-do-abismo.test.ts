import assert from "node:assert/strict";
import { validateAuthorableCardWithActivatedAbilities } from "./activated-ability-authoring";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import { aiChooseReaction, applyAiAction } from "./ai";
import { archetypeForDeck, mulliganPlan } from "./archetypes";
import { validateAuthorableCard } from "./card-authoring";
import { ECOS_DO_ABISMO_CARDS } from "./cards/ecos-do-abismo";
import { getDeck, validateDeck } from "./decks";
import { activateAbility, applyStackedActionWithAi, castSpell, createCustomGame, makeUnit } from "./engine";
import { graveyardEntries, putInGraveyard } from "./graveyard";
import { RANKED_PRECONS } from "./ranked-decks";
import type { DeckInput, GameState } from "./types";

const STARTER_IDS = [
  "ember_aggro",
  "tide_control",
  "wood_midrange",
  "void_shadow",
  "florestia_tribal",
  "tempestade_rush",
] as const;

const IDS = {
  smuggler: "rfalpha_reanimator_memory_smuggler",
  sepulcher: "rfalpha_reanimator_drowned_sepulcher",
  thread: "rfalpha_reanimator_dead_memory_thread",
  pulse: "rfalpha_reanimator_second_pulse",
  vigil: "rfalpha_reanimator_last_vigil",
  seal: "rfalpha_reanimator_seal_nothing",
  mirror: "rfalpha_reanimator_drowned_mirror_lady",
  devourer: "rfalpha_reanimator_dead_tide_devourer",
  colossus: "rfalpha_reanimator_hollow_rift_colossus",
} as const;

const preset = getDeck("ecos_do_abismo");
const deck: DeckInput = { id: preset.id, name: preset.name, cards: [...preset.cards] };

function game(playerGoesFirst = true): GameState {
  return createCustomGame("Ecos do Abismo", deck, deck, {
    skipMulligan: true,
    playerGoesFirst,
    playerStartingMana: 10,
    aiStartingMana: 10,
    playerStartingHand: 0,
    aiStartingHand: 0,
    seed: 903122,
  });
}

// Content registration and deck legality.
assert.equal(Object.keys(ECOS_DO_ABISMO_CARDS).length, 9, "Ecos 1.0 ships exactly nine original cards");
assert.equal(preset.cards.length, 40, "advanced preset must contain exactly 40 cards");
assert.deepEqual(preset.regions, ["Tidecall", "Voidborn"]);
const validation = validateDeck(preset.cards);
assert.equal(validation.ok, true, `Ecos preset must be legal: ${validation.errors.join("; ")}`);
assert.deepEqual(new Set(validation.regions), new Set(["Tidecall", "Voidborn"]));
assert.equal(preset.cards.filter((defId) => defId === IDS.pulse).length, 2, "certified recipe keeps exactly two baseline reanimation spells");
assert.equal(preset.cards.filter((defId) => defId === IDS.thread).length, 1, "certified recipe keeps one graveyard-to-hand recursion spell");
assert.equal(preset.cards.filter((defId) => defId === "tide_freeze").length, 2, "certified recipe keeps exactly two Riptides");
assert.equal(preset.cards.filter((defId) => defId === "void_nightmare").length, 1, "certified recipe promotes Living Nightmare as the no-Lifesteal midgame slot");
assert.equal(preset.cards.includes("void_reaper"), false, "certified recipe must not use Soul Reaper after balance isolation");
assert.deepEqual(ECOS_DO_ABISMO_CARDS[IDS.colossus]?.keywords ?? [], [], "certified Hollow Rift Colossus is fully blockable");

// No Alpha starter or Ranked recipe is changed by the new archetype.
for (const starterId of STARTER_IDS) {
  const starter = getDeck(starterId);
  assert.equal(starter.cards.length, 40, `${starterId} remains a 40-card certified starter`);
  assert.equal(starter.cards.some((defId) => defId.startsWith("rfalpha_reanimator_")), false, `${starterId} must not absorb Reanimator content`);
}
assert.equal(
  RANKED_PRECONS.some((ranked) => ranked.id.includes("ecos") || ranked.cards.some((defId) => defId.startsWith("rfalpha_reanimator_"))),
  false,
  "Ecos do Abismo remains outside Ranked until balance certification",
);

// Studio authoring: generic graveyard spells and selected-discard outlets remain data-driven.
for (const defId of [IDS.thread, IDS.pulse, IDS.vigil, IDS.seal, IDS.mirror, IDS.devourer, IDS.colossus]) {
  const result = validateAuthorableCard(ECOS_DO_ABISMO_CARDS[defId]!);
  assert.equal(result.ok, true, `${defId} must be authorable through certified Card Studio vocabulary`);
}
for (const defId of [IDS.smuggler, IDS.sepulcher]) {
  const result = validateAuthorableCardWithActivatedAbilities(ECOS_DO_ABISMO_CARDS[defId]! as typeof ECOS_DO_ABISMO_CARDS[string] & Record<string, unknown>);
  assert.equal(result.ok, true, `${defId} selected-discard outlet must be authorable`);
}

// Archetype profile, doctrine resolution and mulligan preserve setup pieces while shipping fatties back.
const profile = archetypeForDeck("ecos_do_abismo");
assert.equal(profile?.name, "Ecos do Abismo");
assert.ok(profile?.signatures.includes(IDS.pulse));
const mulligan = mulliganPlan([IDS.smuggler, IDS.pulse, IDS.colossus, IDS.vigil], "ecos_do_abismo");
assert.deepEqual(mulligan.keep, [IDS.smuggler, IDS.pulse]);
assert.deepEqual(mulligan.replace, [IDS.colossus, IDS.vigil]);

// Core human loop: explicitly discard a premium target, then reanimate that exact graveyard entry.
{
  let state = game();
  const source = makeUnit(state, IDS.smuggler, "player");
  source.summonedThisTurn = false;
  state.players.player.bench.push(source);
  state.players.player.hand = [
    { instanceId: "ecos-fatty", defId: IDS.colossus },
    { instanceId: "ecos-pulse", defId: IDS.pulse },
  ];

  state = activateAbility(state, "player", source.instanceId, 0, undefined, undefined, ["ecos-fatty"]);
  const grave = graveyardEntries(state, "player").find((entry) => entry.defId === IDS.colossus);
  assert.ok(grave, "selected discard outlet must put the chosen premium target into the authoritative graveyard");
  assert.equal(grave?.reason, "discard");
  assert.ok(state.players.player.hand.some((card) => card.instanceId === "ecos-pulse"), "reanimation spell remains in hand after setup");

  const nexusBefore = state.players.ai.nexusHealth;
  const spellsBefore = state.players.player.stats.spellsCast;
  state = castSpell(state, "player", "ecos-pulse", grave!.instanceId);
  const revived = state.players.player.bench.find((unit) => unit.defId === IDS.colossus);
  assert.ok(revived, "Rito do Segundo Pulso reanimates the chosen Colossus");
  assert.equal(revived?.summonedThisTurn, true, "reanimated threat obeys normal summon sickness");
  assert.equal(state.players.ai.nexusHealth, nexusBefore - 2, "normal onSummon semantics fire after reanimation");
  assert.equal(state.players.player.stats.spellsCast, spellsBefore + 1, "the recursion spell counts once; the Unit is not cast");
  assert.equal(graveyardEntries(state, "player").some((entry) => entry.instanceId === grave!.instanceId), false, "reanimation consumes the exact graveyard object");
}

// Reanimator-aware AI: with recursion ready, a premium Unit becomes setup value instead of discard penalty.
{
  const state = game(false);
  state.activePlayer = "ai";
  state.phase = "main";
  const source = makeUnit(state, IDS.smuggler, "ai");
  source.summonedThisTurn = false;
  state.players.ai.bench.push(source);
  state.players.ai.hand = [
    { instanceId: "ai-pulse", defId: IDS.pulse },
    { instanceId: "ai-colossus", defId: IDS.colossus },
    { instanceId: "ai-cheap", defId: "tide_heal" },
  ];

  const action = aiChooseActivatedAbilityAction(state, "ai");
  assert.equal(action?.instanceId, source.instanceId, "AI recognizes the discard outlet as useful setup");
  assert.deepEqual(action?.costDiscardInstanceIds, ["ai-colossus"], "AI deliberately pitches the highest-cost premium Unit when reanimation is ready");

  const next = action ? applyAiAction(state, action, "ai") : state;
  assert.ok(graveyardEntries(next, "ai").some((entry) => entry.defId === IDS.colossus), "AI setup creates a real reanimation target");
  assert.ok(next.players.ai.hand.some((card) => card.instanceId === "ai-pulse"), "AI protects the recursion spell instead of discarding it");
}

// Counterplay AI: a legal Counterspell recognizes reanimation as a high-impact stack threat.
{
  const state = game();
  state.activePlayer = "player";
  state.phase = "main";
  state.players.player.hand = [{ instanceId: "pending-pulse", defId: IDS.pulse }];
  state.players.ai.hand = [{ instanceId: "ai-deny", defId: "tide_deny" }];
  state.players.ai.mana = 10;
  state.players.ai.spellMana = 3;
  const target = putInGraveyard(state, "player", IDS.colossus, "discard", "counterplay-fatty");
  assert.ok(target);

  const pending = {
    kind: "spell" as const,
    player: "player" as const,
    instanceId: "pending-pulse",
    defId: IDS.pulse,
    targetInstanceId: target!.instanceId,
  };
  const response = aiChooseReaction(state, pending, "ai");
  assert.equal(response?.defId, "tide_deny", "Tide AI should spend a legal Counterspell on a reanimation spell");

  const resolved = applyStackedActionWithAi(
    state,
    pending,
    "skip",
    null,
    (current, action) => aiChooseReaction(current, action, "ai"),
  ).next;
  assert.equal(resolved.players.player.bench.some((unit) => unit.defId === IDS.colossus), false, "countered reanimation must not create the premium Unit");
  assert.equal(graveyardEntries(resolved, "player").some((entry) => entry.instanceId === target!.instanceId), true, "countered reanimation leaves its target in the graveyard");
  assert.equal(graveyardEntries(resolved, "player").some((entry) => entry.defId === IDS.pulse && entry.reason === "counter"), true, "the negated recursion spell is committed to the graveyard");

  const noMana = game();
  noMana.activePlayer = "player";
  noMana.phase = "main";
  noMana.players.player.hand = [{ instanceId: "pending-pulse-empty", defId: IDS.pulse }];
  noMana.players.ai.hand = [{ instanceId: "ai-deny-empty", defId: "tide_deny" }];
  noMana.players.ai.mana = 0;
  noMana.players.ai.spellMana = 0;
  const noManaTarget = putInGraveyard(noMana, "player", IDS.colossus, "discard", "counterplay-empty-fatty");
  assert.ok(noManaTarget);
  assert.equal(
    aiChooseReaction(noMana, {
      kind: "spell",
      player: "player",
      instanceId: "pending-pulse-empty",
      defId: IDS.pulse,
      targetInstanceId: noManaTarget!.instanceId,
    }, "ai"),
    null,
    "AI must not invent an unaffordable Counterspell",
  );
}

console.log("ECOS DO ABISMO 1.0: PASS — 9 cards + legal 40-card preset + starter/Ranked isolation + Studio + discard/reanimate loop + reanimator-aware AI + stack counterplay");
