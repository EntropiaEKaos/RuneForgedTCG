import assert from "node:assert/strict";
import {
  activateAbility,
  activatedAbilitiesForInstance,
  createCustomGame,
  makeUnit,
} from "./engine";
import {
  activatedAbilityCostDescription,
  activatedAbilityCostLabel,
  activatedAbilityUiState,
} from "./activated-ability-presentation";
import type { DeckInput, GameState, PlayerId } from "./types";

const baseDeck: DeckInput = {
  id: "activated-presentation-test-deck",
  name: "Activated Presentation Test Deck",
  cards: Array(20).fill("ember_whelp"),
};

function game(): GameState {
  return createCustomGame("P", baseDeck, baseDeck, {
    skipMulligan: true,
    playerGoesFirst: true,
    seed: 515151,
  });
}

function addReadyUnit(state: GameState, defId: string, owner: PlayerId = "player") {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

{
  let state = game();
  state.players.player.mana = 5;
  state.players.player.maxMana = 5;
  const asterion = addReadyUnit(state, "van_ember_u18");
  const ability = activatedAbilitiesForInstance(state, "player", asterion.instanceId)[0];
  assert.ok(ability, "Asterion exposes its native activated ability");
  assert.equal(activatedAbilityCostLabel(ability), "💧2 ↷", "compact cost communicates mana and exhaust");
  assert.match(activatedAbilityCostDescription(ability), /2 de mana/i);
  assert.match(activatedAbilityCostDescription(ability), /exaurir esta carta/i);

  const ready = activatedAbilityUiState(state, "player", asterion.instanceId, 0);
  assert.deepEqual(ready, { canUse: true, status: "ready", reason: null }, "legal activation is visibly ready");

  state = activateAbility(state, "player", asterion.instanceId, 0);
  const used = activatedAbilityUiState(state, "player", asterion.instanceId, 0);
  assert.equal(used.canUse, false);
  assert.equal(used.status, "blocked");
  assert.equal(used.reason, "Já usada nesta rodada.", "per-round use limit is explained to the player");
}

{
  const state = game();
  state.players.player.mana = 5;
  const asterion = makeUnit(state, "van_ember_u18", "player");
  asterion.summonedThisTurn = true;
  state.players.player.bench.push(asterion);
  const ui = activatedAbilityUiState(state, "player", asterion.instanceId, 0);
  assert.equal(ui.canUse, false);
  assert.equal(ui.reason, "Unidade recém-invocada precisa de Haste para pagar exaustão.");
}

{
  const state = game();
  state.players.player.mana = 1;
  const asterion = addReadyUnit(state, "van_ember_u18");
  const ui = activatedAbilityUiState(state, "player", asterion.instanceId, 0);
  assert.equal(ui.canUse, false);
  assert.equal(ui.reason, "Mana insuficiente.");
}

{
  const state = game();
  state.players.player.nexusHealth = 2;
  const morthys = addReadyUnit(state, "van_void_u18");
  const ui = activatedAbilityUiState(state, "player", morthys.instanceId, 0);
  assert.equal(ui.canUse, false);
  assert.equal(ui.reason, "Vida do Nexus insuficiente para pagar sem ser letal.");
}

{
  const state = game();
  state.players.player.mana = 5;
  const vaelora = addReadyUnit(state, "van_storm_u18");
  const ui = activatedAbilityUiState(state, "player", vaelora.instanceId, 0);
  assert.equal(ui.canUse, false);
  assert.equal(ui.reason, "Sem alvos válidos.", "targeted abilities explain an empty legal target set");
}

{
  const state = game();
  state.players.player.mana = 5;
  const asterion = addReadyUnit(state, "van_ember_u18");
  state.activePlayer = "ai";
  const ui = activatedAbilityUiState(state, "player", asterion.instanceId, 0);
  assert.equal(ui.canUse, false);
  assert.equal(ui.reason, "Disponível apenas na fase principal do controlador.");
}

console.log("ACTIVATED ABILITY PRESENTATION: PASS");
