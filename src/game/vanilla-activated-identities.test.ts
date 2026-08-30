import assert from "node:assert/strict";
import { getCard } from "./cards";
import { DECKS } from "./decks";
import {
  activateAbility,
  canActivateAbility,
  createCustomGame,
  makeUnit,
} from "./engine";
import type { DeckInput, GameState, PlayerId } from "./types";

const deck: DeckInput = {
  id: "vanilla-activated-identity-test",
  name: "Vanilla Activated Identity Test",
  cards: Array(20).fill("ember_whelp"),
};

const LEGENDS = [
  "van_ember_u18",
  "van_tide_u18",
  "van_wood_u18",
  "van_void_u18",
  "van_forest_u18",
  "van_storm_u18",
] as const;

function game(): GameState {
  const state = createCustomGame("Vanilla Activated Identity Test", deck, deck, {
    skipMulligan: true,
    playerGoesFirst: true,
    seed: 454545,
  });
  state.phase = "main";
  state.activePlayer = "player";
  state.players.player.mana = 10;
  state.players.player.maxMana = 10;
  return state;
}

function addUnit(state: GameState, defId: string, owner: PlayerId) {
  const unit = makeUnit(state, defId, owner);
  unit.summonedThisTurn = false;
  state.players[owner].bench.push(unit);
  return unit;
}

for (const defId of LEGENDS) {
  const card = getCard(defId);
  assert.equal(card.isLegend, true, `${defId} remains a Vanilla legend`);
  assert.equal(card.activatedAbilities?.length, 1, `${defId} exposes exactly one native activated identity`);
  assert.match(card.description, /Ativada —/, `${defId} explains its activation on-card`);
}

const certifiedDeckCards = new Set(DECKS.flatMap((candidate) => candidate.cards));
for (const defId of LEGENDS) {
  assert.equal(
    certifiedDeckCards.has(defId),
    false,
    `${defId} must stay outside all certified Alpha decklists until a balance gate promotes it`,
  );
}

{
  const state = game();
  const source = addUnit(state, "van_ember_u18", "player");
  const enemyBefore = state.players.ai.nexusHealth;
  assert.equal(canActivateAbility(state, "player", source.instanceId, 0), true);
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.ai.nexusHealth, enemyBefore - 3, "Asterion channels Forge damage into the enemy Nexus");
  assert.equal(next.players.player.mana, 8, "Asterion pays regular mana");
  assert.equal(next.players.player.bench[0].hasAttackedThisTurn, true, "Asterion pays the exhaust cost authoritatively");
  assert.equal(canActivateAbility(next, "player", source.instanceId, 0), false, "Asterion cannot reactivate in the same round");
}

{
  const state = game();
  const source = addUnit(state, "van_tide_u18", "player");
  state.players.player.nexusHealth = 10;
  const handBefore = state.players.player.hand.length;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.player.nexusHealth, 12, "Nerissa heals the allied Nexus");
  assert.equal(next.players.player.hand.length, handBefore + 1, "Nerissa draws exactly one card");
  assert.equal(next.players.player.mana, 8);
}

{
  const state = game();
  const source = addUnit(state, "van_wood_u18", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.ok(allyAfter?.keywords.includes("Regeneration"), "Eldran grants Regeneration to a legal ally target");
}

{
  const state = game();
  const source = addUnit(state, "van_void_u18", "player");
  const enemy = addUnit(state, "wood_ent", "ai");
  state.players.player.nexusHealth = 10;
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  const enemyAfter = next.players.ai.bench.find((unit) => unit.instanceId === enemy.instanceId);
  assert.equal(next.players.player.nexusHealth, 8, "Morthys pays Nexus health as a real cost");
  assert.equal(enemyAfter?.health, enemy.health - 3, "Morthys deals targeted damage through the generic executor");
}

{
  const state = game();
  const source = addUnit(state, "van_forest_u18", "player");
  const before = state.players.player.bench.length;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.player.bench.length, before + 2, "Lyka summons two native Pack tokens");
  assert.equal(
    next.players.player.bench.filter((unit) => unit.defId === "forest_cub_token").length,
    2,
    "Lyka uses the existing canonical Florestia token",
  );
}

{
  const state = game();
  const source = addUnit(state, "van_storm_u18", "player");
  const enemy = addUnit(state, "wood_ent", "ai");
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  const enemyAfter = next.players.ai.bench.find((unit) => unit.instanceId === enemy.instanceId);
  assert.equal(enemyAfter?.stunned, true, "Vaelora stuns a legal enemy target");
}

console.log("VANILLA ACTIVATED IDENTITIES: PASS");
