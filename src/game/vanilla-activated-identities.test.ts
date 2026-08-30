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

const REGIONAL_LATE_GAME = [
  "van_ember_u15", "van_ember_u16", "van_ember_u17", "van_ember_u18",
  "van_tide_u15", "van_tide_u16", "van_tide_u17", "van_tide_u18",
  "van_wood_u15", "van_wood_u16", "van_wood_u17", "van_wood_u18",
  "van_void_u15", "van_void_u16", "van_void_u17", "van_void_u18",
  "van_forest_u15", "van_forest_u16", "van_forest_u17", "van_forest_u18",
  "van_storm_u15", "van_storm_u16", "van_storm_u17", "van_storm_u18",
] as const;

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

for (const defId of REGIONAL_LATE_GAME) {
  const card = getCard(defId);
  assert.equal(card.activatedAbilities?.length, 1, `${defId} exposes exactly one native activated identity`);
  assert.match(card.description, /Ativada —/, `${defId} explains its activation on-card`);
}

for (const defId of LEGENDS) {
  assert.equal(getCard(defId).isLegend, true, `${defId} remains a Vanilla legend`);
}

const certifiedDeckCards = new Set(DECKS.flatMap((candidate) => candidate.cards));
for (const defId of REGIONAL_LATE_GAME) {
  assert.equal(
    certifiedDeckCards.has(defId),
    false,
    `${defId} must stay outside all certified Alpha decklists until a balance gate promotes it`,
  );
}

// Emberhold — combat pressure and direct burn.
{
  const state = game();
  const source = addUnit(state, "van_ember_u15", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const beforePower = ally.power;
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  const sourceAfter = next.players.player.bench.find((unit) => unit.instanceId === source.instanceId);
  assert.equal(allyAfter?.power, beforePower + 2, "General da Forja grants +2/+0 to the chosen ally");
  assert.equal(next.players.player.mana, 8, "General da Forja pays two regular mana");
  assert.equal(sourceAfter?.hasAttackedThisTurn, true, "General da Forja pays the exhaust cost");
}

{
  const state = game();
  const source = addUnit(state, "van_ember_u16", "player");
  const enemy = addUnit(state, "van_ember_u07", "ai");
  const beforeHealth = enemy.health;
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  const enemyAfter = next.players.ai.bench.find((unit) => unit.instanceId === enemy.instanceId);
  assert.equal(enemyAfter?.health, beforeHealth - 2, "Colosso de Obsidiana deals two targeted damage");
}

{
  const state = game();
  const source = addUnit(state, "van_ember_u17", "player");
  const before = state.players.ai.nexusHealth;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.ai.nexusHealth, before - 2, "Arauto do Sol Rubro pressures the enemy Nexus");
}

// Tidecall — cards, protection and tempo.
{
  const state = game();
  const source = addUnit(state, "van_tide_u15", "player");
  const handBefore = state.players.player.hand.length;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.player.hand.length, handBefore + 1, "Sábio das Nove Correntes draws exactly one card");
}

{
  const state = game();
  const source = addUnit(state, "van_tide_u16", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.equal(allyAfter?.barrier, true, "Guardião do Horizonte Azul grants an active Barrier");
  assert.ok(allyAfter?.keywords.includes("Barrier"), "Barrier is reflected in runtime keywords");
}

{
  const state = game();
  const source = addUnit(state, "van_tide_u17", "player");
  const enemy = addUnit(state, "void_stalker", "ai");
  const handBefore = state.players.ai.hand.length;
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  assert.equal(next.players.ai.bench.some((unit) => unit.instanceId === enemy.instanceId), false, "Arauto do Dilúvio removes the target from the board");
  assert.equal(next.players.ai.hand.length, handBefore + 1, "Arauto do Dilúvio returns the target to its owner's hand");
}

// Ironwood — healing, resilience and tribal growth.
{
  const state = game();
  const source = addUnit(state, "van_wood_u15", "player");
  const ally = addUnit(state, "wood_ent", "player");
  ally.health = ally.maxHealth - 3;
  const before = ally.health;
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.equal(allyAfter?.health, before + 3, "Xamã das Raízes heals three damage from an ally");
}

{
  const state = game();
  const source = addUnit(state, "van_wood_u16", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.ok(allyAfter?.keywords.includes("Tough"), "Protetor da Floresta Profunda grants Tough");
}

{
  const state = game();
  const source = addUnit(state, "van_wood_u17", "player");
  const beast = addUnit(state, "van_forest_u14", "player");
  const beforePower = beast.power;
  const beforeMaxHealth = beast.maxHealth;
  const next = activateAbility(state, "player", source.instanceId, 0);
  const beastAfter = next.players.player.bench.find((unit) => unit.instanceId === beast.instanceId);
  assert.equal(beastAfter?.power, beforePower + 1, "Avatar do Bosque grants +1 power to a Beast ally");
  assert.equal(beastAfter?.maxHealth, beforeMaxHealth + 1, "Avatar do Bosque grants +1 health to a Beast ally");
}

// Voidborn — Nexus health as a resource, sacrifice and corruption.
{
  const state = game();
  const source = addUnit(state, "van_void_u15", "player");
  state.players.player.nexusHealth = 10;
  const handBefore = state.players.player.hand.length;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.player.nexusHealth, 8, "Arconte da Desolação pays Nexus health as a real cost");
  assert.equal(next.players.player.hand.length, handBefore + 1, "Arconte da Desolação converts health into a card");
}

{
  const state = game();
  const source = addUnit(state, "van_void_u16", "player");
  const enemy = addUnit(state, "tide_guard", "ai");
  assert.equal(canActivateAbility(state, "player", source.instanceId, 0, enemy.instanceId), true);
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  assert.equal(next.players.player.bench.some((unit) => unit.instanceId === source.instanceId), false, "Monstro Sem Nome is sacrificed as a real cost");
  assert.equal(next.players.ai.bench.some((unit) => unit.instanceId === enemy.instanceId), false, "Monstro Sem Nome destroys its chosen enemy after the sacrifice cost");
}

{
  const state = game();
  const source = addUnit(state, "van_void_u17", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.ok(allyAfter?.keywords.includes("Wither"), "Profeta do Fim grants Wither to a chosen ally");
}

// Florestia — pack generation, reach and tribal scaling.
{
  const state = game();
  const source = addUnit(state, "van_forest_u15", "player");
  const before = state.players.player.bench.length;
  const next = activateAbility(state, "player", source.instanceId, 0);
  assert.equal(next.players.player.bench.length, before + 1, "Grande Lobo Dourado summons one Pack token");
  assert.equal(next.players.player.bench.filter((unit) => unit.defId === "forest_cub_token").length, 1);
}

{
  const state = game();
  const source = addUnit(state, "van_forest_u16", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.ok(allyAfter?.keywords.includes("Reach"), "Titã da Selva grants Reach");
}

{
  const state = game();
  const source = addUnit(state, "van_forest_u17", "player");
  const beast = addUnit(state, "van_forest_u14", "player");
  const besta = addUnit(state, "van_forest_u13", "player");
  const beastBefore = { power: beast.power, maxHealth: beast.maxHealth };
  const bestaBefore = { power: besta.power, maxHealth: besta.maxHealth };
  const next = activateAbility(state, "player", source.instanceId, 0);
  const beastAfter = next.players.player.bench.find((unit) => unit.instanceId === beast.instanceId);
  const bestaAfter = next.players.player.bench.find((unit) => unit.instanceId === besta.instanceId);
  assert.equal(beastAfter?.power, beastBefore.power + 1, "Arauto da Caçada buffs Beast allies");
  assert.equal(beastAfter?.maxHealth, beastBefore.maxHealth + 1);
  assert.equal(bestaAfter?.power, bestaBefore.power + 1, "Arauto da Caçada also buffs Besta allies");
  assert.equal(bestaAfter?.maxHealth, bestaBefore.maxHealth + 1);
}

// Tempestade — damage, speed and control.
{
  const state = game();
  const source = addUnit(state, "van_storm_u15", "player");
  const enemy = addUnit(state, "van_ember_u07", "ai");
  const before = enemy.health;
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  const enemyAfter = next.players.ai.bench.find((unit) => unit.instanceId === enemy.instanceId);
  assert.equal(enemyAfter?.health, before - 2, "Mestre do Trovão deals two targeted damage");
}

{
  const state = game();
  const source = addUnit(state, "van_storm_u16", "player");
  const ally = addUnit(state, "ember_whelp", "player");
  const next = activateAbility(state, "player", source.instanceId, 0, ally.instanceId);
  const allyAfter = next.players.player.bench.find((unit) => unit.instanceId === ally.instanceId);
  assert.ok(allyAfter?.keywords.includes("Haste"), "Serafim da Ruptura grants Haste");
}

{
  const state = game();
  const source = addUnit(state, "van_storm_u17", "player");
  const enemy = addUnit(state, "wood_ent", "ai");
  const next = activateAbility(state, "player", source.instanceId, 0, enemy.instanceId);
  const enemyAfter = next.players.ai.bench.find((unit) => unit.instanceId === enemy.instanceId);
  assert.equal(enemyAfter?.stunned, true, "Arauto do Céu Partido stuns a legal enemy target");
}

// Existing regional legends remain behaviorally certified.
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
  const enemy = addUnit(state, "void_duelist", "ai");
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

console.log("VANILLA ACTIVATED IDENTITIES: PASS — 24 late-game regional identities certified");
