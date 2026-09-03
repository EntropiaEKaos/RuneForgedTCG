import assert from "node:assert/strict";
import { validateAuthorableCard } from "./card-authoring";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import { aiChooseAction } from "./ai";
import { clearRegisteredCustomCards, registerCustomCards } from "./custom-registry";
import { applyEffect, createCustomGame, makeUnit } from "./engine";
import { graveyardEntries } from "./graveyard";
import type { CardDef, DeckInput, GameState } from "./types";

const deck: DeckInput = {
  id: "self-mill-cert",
  name: "Self Mill Certification",
  cards: Array(20).fill("ember_whelp"),
};

const selfMillSpell: CardDef = {
  defId: "sm_self_mill",
  name: "Drown the Memory",
  region: "Tidecall",
  type: "Spell",
  cost: 1,
  rarity: "Common",
  description: "Mill two cards from your own deck.",
  emoji: "🌊",
  spell: { kind: "selfMill", amount: 2, target: "none" },
};

const reanimateSpell: CardDef = {
  defId: "sm_reanimate",
  name: "Return the Memory",
  region: "Voidborn",
  type: "Spell",
  cost: 5,
  rarity: "Epic",
  description: "Reanimate one allied Unit.",
  emoji: "🜏",
  spell: { kind: "reanimateUnit", amount: 0, target: "allyGraveyardUnit" },
};

const selfMillEngine: CardDef = {
  defId: "sm_engine",
  name: "Memory Well",
  region: "Tidecall",
  type: "Unit",
  cost: 1,
  power: 1,
  health: 3,
  rarity: "Rare",
  description: "Once per round, mill two cards from your own deck.",
  emoji: "🫧",
  activatedAbilities: [{
    description: "Sink two memories.",
    effect: { kind: "selfMill", amount: 2, target: "none" },
    maxUsesPerRound: 1,
  }],
};

function game(): GameState {
  return createCustomGame("Self Mill Cert", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    playerStartingMana: 10,
    aiStartingMana: 10,
    playerStartingHand: 0,
    aiStartingHand: 0,
    seed: 1_104_011,
  });
}

registerCustomCards([selfMillSpell, reanimateSpell, selfMillEngine]);

try {
  {
    const state = game();
    state.players.player.deck = ["ember_whelp", "tide_sprite", "void_stalker"];
    state.players.ai.deck = ["wood_bear", "wood_bear"];

    applyEffect(state, "player", { kind: "selfMill", amount: 2, target: "none" });

    assert.deepEqual(state.players.player.deck, ["void_stalker"], "selfMill consumes the controller deck only");
    assert.deepEqual(
      graveyardEntries(state, "player").map((entry) => [entry.defId, entry.reason, entry.owner]),
      [["ember_whelp", "mill", "player"], ["tide_sprite", "mill", "player"]],
      "selfMill preserves ordered physical cards and ownership in the controller graveyard",
    );
    assert.equal(graveyardEntries(state, "ai").length, 0, "selfMill never touches the opponent graveyard");
    assert.deepEqual(state.players.ai.deck, ["wood_bear", "wood_bear"], "selfMill never touches the opponent deck");
  }

  {
    const state = game();
    state.players.player.deck = ["ember_whelp"];
    applyEffect(state, "player", { kind: "selfMill", amount: 4, target: "none" });
    assert.equal(state.players.player.deck.length, 0, "selfMill safely clamps to the cards that exist");
    assert.equal(graveyardEntries(state, "player").length, 1);
    applyEffect(state, "player", { kind: "selfMill", amount: 2, target: "none" });
    assert.equal(graveyardEntries(state, "player").length, 1, "selfMill on an empty deck is a safe no-op");
  }

  {
    const state = game();
    state.players.ai.deck = ["ember_whelp", "ember_whelp"];
    applyEffect(state, "player", { kind: "mill", amount: 2, target: "none" });
    assert.equal(graveyardEntries(state, "player").length, 0, "legacy mill still does not mill self");
    assert.equal(graveyardEntries(state, "ai").length, 2, "legacy mill keeps its historical opponent semantics");
  }

  {
    const valid = validateAuthorableCard(selfMillSpell);
    assert.equal(valid.ok, true, "Card Studio accepts canonical selfMill");

    const invalidTarget = validateAuthorableCard({
      ...selfMillSpell,
      defId: "sm_invalid_target",
      spell: { kind: "selfMill", amount: 2, target: "self" },
    });
    assert.equal(invalidTarget.ok, false, "selfMill fails closed when authored with a hidden/self target");

    const invalidAmount = validateAuthorableCard({
      ...selfMillSpell,
      defId: "sm_invalid_amount",
      spell: { kind: "selfMill", amount: 0, target: "none" },
    });
    assert.equal(invalidAmount.ok, false, "selfMill requires a positive amount");
  }

  {
    const state = game();
    state.activePlayer = "ai";
    state.phase = "main";
    state.players.ai.mana = 10;
    state.players.ai.hand = [
      { instanceId: "ai-self-mill", defId: selfMillSpell.defId },
      { instanceId: "ai-reanimate", defId: reanimateSpell.defId },
    ];
    state.players.ai.deck = Array(8).fill("ember_whelp");

    const action = aiChooseAction(state, "ai");
    assert.equal(action?.defId, selfMillSpell.defId, "main AI uses selfMill when a real recursion plan is available");
  }

  {
    const state = game();
    state.activePlayer = "ai";
    state.phase = "main";
    state.players.ai.mana = 10;
    state.players.ai.hand = [{ instanceId: "ai-self-mill-alone", defId: selfMillSpell.defId }];
    state.players.ai.deck = Array(8).fill("ember_whelp");

    assert.equal(aiChooseAction(state, "ai"), null, "main AI refuses generic selfMill without graveyard recursion");
  }

  {
    const state = game();
    state.activePlayer = "ai";
    state.phase = "main";
    const source = makeUnit(state, selfMillEngine.defId, "ai");
    source.summonedThisTurn = false;
    state.players.ai.bench.push(source);
    state.players.ai.deck = [reanimateSpell.defId, ...Array(8).fill("ember_whelp")];

    const action = aiChooseActivatedAbilityAction(state, "ai");
    assert.equal(action?.instanceId, source.instanceId, "activated-ability AI uses selfMill when its deck contains recursion");
  }

  {
    const state = game();
    state.activePlayer = "ai";
    state.phase = "main";
    const source = makeUnit(state, selfMillEngine.defId, "ai");
    source.summonedThisTurn = false;
    state.players.ai.bench.push(source);
    state.players.ai.deck = Array(9).fill("ember_whelp");

    assert.equal(aiChooseActivatedAbilityAction(state, "ai"), null, "activated-ability AI refuses selfMill without graveyard recursion");
  }

  console.log("SELF-MILL EFFECTS 1.0: PASS — engine ownership + legacy mill isolation + Studio contract + conservative main/activated AI");
} finally {
  clearRegisteredCustomCards();
}
