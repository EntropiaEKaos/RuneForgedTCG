import assert from "node:assert/strict";
import { aiChooseAction } from "./ai";
import { aiChooseActivatedAbilityAction } from "./ai-activated-abilities";
import { getDeck } from "./decks";
import { createCustomGame, makePermanent } from "./engine";
import type { DeckInput, GameState } from "./types";

const IDS = {
  sepulcher: "rfalpha_reanimator_drowned_sepulcher",
  pulse: "rfalpha_reanimator_second_pulse",
  colossus: "rfalpha_reanimator_hollow_rift_colossus",
} as const;

const preset = getDeck("ecos_do_abismo");
const deck: DeckInput = { id: preset.id, name: preset.name, cards: [...preset.cards] };

function game(): GameState {
  const state = createCustomGame("AI Loot Ordering", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: false,
    aiStartingMana: 10,
    aiStartingHand: 0,
    playerStartingHand: 0,
    seed: 903130,
  });
  state.phase = "main";
  state.activePlayer = "ai";
  state.players.ai.mana = 10;
  state.players.ai.maxMana = 10;
  state.players.ai.hand = [];
  state.players.player.hand = [];
  const sepulcher = makePermanent(state, IDS.sepulcher, "ai");
  state.players.ai.permanents.push(sepulcher);
  return state;
}

// A paid discard-to-draw outlet must not consume mana/card selection before a
// normal legal hand development. This reproduces the balance-harness pathology
// where Sepulcro repeatedly looted before the AI ever considered its hand.
{
  const state = game();
  state.players.ai.hand = [{ instanceId: "playable-whelp", defId: "ember_whelp" }];

  assert.equal(
    aiChooseActivatedAbilityAction(state, "ai"),
    null,
    "paid loot is deferred while the AI has a legal card play",
  );
  const action = aiChooseAction(state, "ai");
  assert.ok(action, "AI should still choose the normal hand action");
  assert.equal(action.kind, "unit");
  assert.equal(action.instanceId, "playable-whelp", "normal board development wins priority over generic looting");
}

// Reanimator setup remains the intentional exception: with recursion ready,
// pitching a premium Unit is not random looting and should retain priority.
{
  const state = game();
  const sepulcher = state.players.ai.permanents[0];
  state.players.ai.hand = [
    { instanceId: "setup-pulse", defId: IDS.pulse },
    { instanceId: "setup-colossus", defId: IDS.colossus },
    { instanceId: "setup-whelp", defId: "ember_whelp" },
  ];

  const action = aiChooseActivatedAbilityAction(state, "ai");
  assert.ok(action, "premium reanimation setup should still use the outlet");
  assert.equal(action.instanceId, sepulcher.instanceId);
  assert.deepEqual(
    action.costDiscardInstanceIds,
    ["setup-colossus"],
    "the exception is narrow: it must be the premium reanimation target that is pitched",
  );
}

console.log("AI LOOT ORDERING: PASS — hand development precedes generic loot; premium reanimation setup remains intentional");
