import assert from "node:assert/strict";
import { aiChooseAction, applyAiAction } from "./ai";
import { validateAuthorableCard } from "./card-authoring";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { castSpell, createCustomGame } from "./engine";
import { addCardsToHand, makeUnit } from "./engine/state";
import { graveyardEntries, graveyardHasUniqueIds, putInGraveyard } from "./graveyard";
import type { CardDef, DeckInput, GameState } from "./types";

const target: CardDef = {
  defId: "test_abyss_colossus",
  name: "Abyss Colossus",
  region: "Voidborn",
  type: "Unit",
  cost: 9,
  power: 8,
  health: 8,
  rarity: "Epic",
  emoji: "☠",
  description: "Certified graveyard target.",
  trigger: { when: "onSummon", effect: { kind: "healNexus", amount: 2, target: "none" } },
};
const small: CardDef = {
  defId: "test_grave_scout",
  name: "Grave Scout",
  region: "Tidecall",
  type: "Unit",
  cost: 1,
  power: 1,
  health: 1,
  rarity: "Common",
  emoji: "🌊",
  description: "Small test Unit.",
};
const reanimate: CardDef = {
  defId: "test_reanimate",
  name: "Second Pulse",
  region: "Voidborn",
  type: "Spell",
  cost: 2,
  rarity: "Rare",
  emoji: "🜂",
  description: "Reanimate a Unit.",
  spell: { kind: "reanimateUnit", amount: 0, target: "allyGraveyardUnit" },
};
const recover: CardDef = {
  defId: "test_grave_recover",
  name: "Memory Thread",
  region: "Tidecall",
  type: "Spell",
  cost: 1,
  rarity: "Common",
  emoji: "🜁",
  description: "Return a card from the graveyard.",
  spell: { kind: "returnGraveyardToHand", amount: 0, target: "allyGraveyardCard" },
};
const banish: CardDef = {
  defId: "test_grave_banish",
  name: "Seal of Nothing",
  region: "Voidborn",
  type: "Spell",
  cost: 1,
  rarity: "Common",
  emoji: "◌",
  description: "Banish an enemy graveyard card.",
  spell: { kind: "banishGraveyardCard", amount: 0, target: "enemyGraveyardCard" },
};

const cards = [target, small, reanimate, recover, banish];
registerCustomCards(cards);

const deck: DeckInput = {
  id: "graveyard-effects-test",
  name: "Graveyard Effects Test",
  cards: Array.from({ length: 40 }, (_, index) => cards[index % cards.length]!.defId),
};

function game(playerGoesFirst = true): GameState {
  return createCustomGame("Graveyard Effects", deck, deck, {
    skipMulligan: true,
    playerGoesFirst,
    playerStartingMana: 10,
    aiStartingMana: 10,
    playerStartingHand: 0,
    aiStartingHand: 0,
    seed: 81021,
  });
}

// Authoring: certified primitives are first-class, but only in the supported
// main-phase Spell surface for Graveyard Effects 1.0.
for (const card of [reanimate, recover, banish]) {
  const result = validateAuthorableCard(card);
  assert.equal(result.ok, true, `${card.defId} must be authorable`);
}
assert.equal(validateAuthorableCard({ ...reanimate, spell: { kind: "reanimateUnit", amount: 0, target: "enemyGraveyardCard" } }).ok, false, "reanimate cannot target enemy graveyard cards");
assert.equal(validateAuthorableCard({ ...reanimate, speed: "Burst" }).ok, false, "graveyard-targeted spells are main-phase only in 1.0");
assert.equal(validateAuthorableCard({ ...small, trigger: { when: "onSummon", effect: { kind: "reanimateUnit", amount: 0, target: "allyGraveyardUnit" } } }).ok, false, "graveyard-targeted triggers fail closed in 1.0");

// Reanimation consumes exactly one graveyard object, creates a fresh Unit,
// preserves summon sickness, fires normal onSummon and increments summon stats.
{
  let state = game();
  state.players.player.nexusHealth = 17;
  const grave = putInGraveyard(state, "player", target.defId, "discard", "physical-colossus");
  assert.ok(grave);
  state = addCardsToHand(state, "player", [reanimate.defId]);
  const spell = state.players.player.hand.find((card) => card.defId === reanimate.defId)!;
  const summonedBefore = state.players.player.stats.alliesSummoned;
  const spellsBefore = state.players.player.stats.spellsCast;
  const next = castSpell(state, "player", spell.instanceId, grave!.instanceId);
  const revived = next.players.player.bench.find((unit) => unit.defId === target.defId);
  assert.ok(revived, "target Unit must enter the bench");
  assert.notEqual(revived!.instanceId, grave!.instanceId, "reanimation creates a fresh battlefield instance");
  assert.equal(revived!.summonedThisTurn, true, "reanimated Unit has normal summon sickness");
  assert.equal(next.players.player.stats.alliesSummoned, summonedBefore + 1, "reanimation counts as an ally summoned");
  assert.equal(next.players.player.stats.spellsCast, spellsBefore + 1, "only the recursion Spell counts as a spell cast");
  assert.equal(next.players.player.nexusHealth, 19, "normal onSummon semantics fire on reanimation");
  assert.ok(!graveyardEntries(next, "player").some((entry) => entry.instanceId === grave!.instanceId), "exact graveyard entry is consumed");
  assert.equal(graveyardHasUniqueIds(next), true);
}

// Stale target ids are fail-closed before cost/payment and cannot duplicate.
{
  let state = game();
  state = addCardsToHand(state, "player", [reanimate.defId]);
  const spell = state.players.player.hand[0]!;
  const mana = state.players.player.mana;
  const next = castSpell(state, "player", spell.instanceId, "gy_missing");
  assert.strictEqual(next, state, "stale graveyard target returns the original authoritative state");
  assert.equal(next.players.player.mana, mana);
  assert.ok(next.players.player.hand.some((card) => card.instanceId === spell.instanceId));
}

// A full bench rejects reanimation before consuming the graveyard or spell.
{
  let state = game();
  const grave = putInGraveyard(state, "player", target.defId, "discard")!;
  while (state.players.player.bench.length < state.rules.benchCap) {
    state.players.player.bench.push(makeUnit(state, small.defId, "player"));
  }
  state = addCardsToHand(state, "player", [reanimate.defId]);
  const spell = state.players.player.hand.find((card) => card.defId === reanimate.defId)!;
  const next = castSpell(state, "player", spell.instanceId, grave.instanceId);
  assert.strictEqual(next, state);
  assert.ok(graveyardEntries(next, "player").some((entry) => entry.instanceId === grave.instanceId));
  assert.ok(next.players.player.hand.some((card) => card.instanceId === spell.instanceId));
}

// Return-to-hand consumes the exact zone object and issues a fresh hand id.
{
  let state = game();
  const grave = putInGraveyard(state, "player", small.defId, "mill")!;
  state = addCardsToHand(state, "player", [recover.defId]);
  const spell = state.players.player.hand.find((card) => card.defId === recover.defId)!;
  const next = castSpell(state, "player", spell.instanceId, grave.instanceId);
  const returned = next.players.player.hand.find((card) => card.defId === small.defId);
  assert.ok(returned);
  assert.notEqual(returned!.instanceId, grave.instanceId);
  assert.ok(!graveyardEntries(next, "player").some((entry) => entry.instanceId === grave.instanceId));
}

// Hand-cap rejection is fail-closed before paying/consuming.
{
  let state = game();
  const grave = putInGraveyard(state, "player", small.defId, "mill")!;
  state = addCardsToHand(state, "player", [recover.defId]);
  while (state.players.player.hand.length < state.rules.handCap) {
    state = addCardsToHand(state, "player", [small.defId]);
  }
  const spell = state.players.player.hand.find((card) => card.defId === recover.defId)!;
  const next = castSpell(state, "player", spell.instanceId, grave.instanceId);
  assert.strictEqual(next, state);
  assert.ok(graveyardEntries(next, "player").some((entry) => entry.instanceId === grave.instanceId));
}

// Graveyard hate can remove the opponent's exact entry without touching ours.
{
  let state = game();
  const mine = putInGraveyard(state, "player", small.defId, "discard")!;
  const theirs = putInGraveyard(state, "ai", target.defId, "discard")!;
  state = addCardsToHand(state, "player", [banish.defId]);
  const spell = state.players.player.hand.find((card) => card.defId === banish.defId)!;
  const next = castSpell(state, "player", spell.instanceId, theirs.instanceId);
  assert.ok(graveyardEntries(next, "player").some((entry) => entry.instanceId === mine.instanceId));
  assert.ok(!graveyardEntries(next, "ai").some((entry) => entry.instanceId === theirs.instanceId));
}

// AI treats the graveyard as a resource and deterministically selects the
// highest-value legal reanimation target.
{
  let state = game(false);
  state.activePlayer = "ai";
  const low = putInGraveyard(state, "ai", small.defId, "discard")!;
  const high = putInGraveyard(state, "ai", target.defId, "discard")!;
  state = addCardsToHand(state, "ai", [reanimate.defId]);
  const action = aiChooseAction(state, "ai");
  assert.ok(action && action.kind === "spell", "AI must choose the legal recursion Spell");
  assert.equal(action?.targetInstanceId, high.instanceId, "AI chooses the highest-value reanimation target deterministically");
  const next = applyAiAction(state, action!, "ai");
  assert.ok(next.players.ai.bench.some((unit) => unit.defId === target.defId));
  assert.ok(graveyardEntries(next, "ai").some((entry) => entry.instanceId === low.instanceId));
}

clearRegisteredCustomCards();
console.log("GRAVEYARD EFFECTS 1.0 BEHAVIOR: PASS (authoring + atomic targeting + return + reanimate + banish + capacity + stale ids + deterministic AI)");
