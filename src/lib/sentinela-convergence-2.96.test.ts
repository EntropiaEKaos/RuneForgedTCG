import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { baseCardsOnly, getCard } from "@/game/cards";
import { RELEASE_296_CARDS } from "@/game/cards/release-2.96";
import { validateAuthorableCard } from "@/game/card-authoring";
import { getCardCollection } from "@/game/card-collections";
import { cardRegions, identityForRegions } from "@/game/region-identity";
import { DECKS } from "@/game/decks";
import { aiChooseSentinelaAction } from "@/game/ai";
import { activateSentinelaAbility, canPlayCard, createGame, effectiveCost, playUnit } from "@/game/engine";

const cards = Object.values(RELEASE_296_CARDS);
const sentinelas = cards.filter((card) => card.type === "Sentinela");
const multi = cards.filter((card) => cardRegions(card).length > 1);
const duals = cards.filter((card) => cardRegions(card).length === 2);
const triads = cards.filter((card) => cardRegions(card).length === 3);

assert.equal(cards.length, 33, "2.96 must add exactly 33 cards");
assert.equal(sentinelas.length, 12, "2.96 must add exactly 12 Sentinelas");
assert.equal(sentinelas.filter((card) => cardRegions(card).length === 1).length, 6, "six Sentinelas must be mono-region");
assert.equal(sentinelas.filter((card) => cardRegions(card).length > 1).length, 6, "six Sentinelas must be multi-region");
assert.equal(multi.length, 27, "27 of the 33 new cards must be multi-region");
assert.equal(new Set(cards.map((card) => card.defId)).size, 33, "release defIds must be unique");
assert.equal(new Set(cards.map((card) => card.name)).size, 33, "release names must be unique");

const existing = baseCardsOnly().filter((card) => !card.defId.startsWith("rf296_"));
const existingNames = new Set(existing.map((card) => card.name));
assert.deepEqual(cards.filter((card) => existingNames.has(card.name)).map((card) => card.name), [], "2.96 display names must not collide with historical cards");

for (const card of cards) {
  const result = validateAuthorableCard(card);
  assert.equal(result.ok, true, `${card.defId} must satisfy Card Studio authoring`);
  assert.equal(getCardCollection(card.defId)?.code, "VAN", `${card.defId} must resolve to Vanilla`);
  assert.equal(getCard(card.defId).defId, card.defId, `${card.defId} must resolve through the canonical runtime registry`);
}

const expectedDuals = new Set([
  "Forja a Vapor", "Bosque Incandescente", "Cinzas Profanas", "Caçada da Brasa", "Forja do Trovão",
  "Raízes da Maré", "Abismo Afogado", "Matilha Lunar", "Monção Celeste", "Jardim do Crepúsculo",
  "Pacto Ancestral", "Copa Fulminante", "Matilha Sombria", "Eclipse Elétrico", "Uivo do Trovão",
]);
const expectedTriads = new Set([
  "Tríade da Criação", "Árvore-Mundo em Chamas", "Apocalipse da Tempestade Negra",
  "Memória do Abismo Vivo", "Lua da Grande Monção", "Círculo da Raiz Sombria",
]);
const dualNames = new Set(duals.map((card) => identityForRegions(cardRegions(card)).name));
const triadNames = new Set(triads.map((card) => identityForRegions(cardRegions(card)).name));
assert.deepEqual([...dualNames].sort(), [...expectedDuals].sort(), "all 15 dual identities must receive 2.96 representation");
assert.deepEqual([...triadNames].sort(), [...expectedTriads].sort(), "all six named triads must receive 2.96 representation");

// Sentinelas are battlefield cards, not spells: Spell Mana must never pay their cost.
const ember = DECKS.find((deck) => deck.id === "ember_aggro")!;
let manaState = createGame("Sentinel Tester", ember, ember, true, 296001);
manaState.players.player.hand = [{ instanceId: "sen_cost", defId: "rf296_sent_ilyra" }];
manaState.players.player.mana = 4;
manaState.players.player.spellMana = 3;
const spellsBefore = manaState.players.player.stats.spellsCast;
assert.equal(canPlayCard(manaState, "player", "sen_cost"), false, "Spell Mana must not make a Sentinela affordable");
manaState.players.player.mana = 5;
assert.equal(canPlayCard(manaState, "player", "sen_cost"), true, "regular mana must make the Sentinela affordable");
const played = playUnit(manaState, "player", "sen_cost");
assert.equal(played.players.player.mana, 0, "Sentinela must spend regular mana");
assert.equal(played.players.player.spellMana, 3, "Sentinela must preserve Spell Mana");
assert.equal(played.players.player.stats.spellsCast, spellsBefore, "Sentinela must not advance spell-cast counters");
assert.equal(played.players.player.sentinelas.at(-1)?.defId, "rf296_sent_ilyra", "Sentinela must enter the Sentinela battlefield zone");

// Exact identity Maestria also applies to multi-region Sentinelas.
const mastery = createGame("Mastery Tester", ember, ember, true, 296002);
const kaelis = getCard("rf296_sent_kaelis");
mastery.players.player.deckRegions = ["Emberhold", "Tidecall"];
assert.equal(effectiveCost(mastery, "player", kaelis), 5, "exact dual identity must grant Kaelis' convergence discount");
mastery.players.player.deckRegions = ["Emberhold", "Tidecall", "Tempestade"];
assert.equal(effectiveCost(mastery, "player", kaelis), 6, "a broader three-region identity must not receive an exact-dual mastery discount");

// AI must spend loyalty on a useful ultimate and supply its required target.
let aiState = createGame("AI Sentinel Tester", ember, ember, false, 296003);
aiState.phase = "main";
aiState.activePlayer = "ai";
aiState.players.player.bench = [{
  instanceId: "victim", defId: "ember_whelp", owner: "player", race: "Dragon", races: ["Dragon"], classes: [],
  power: 2, basePower: 2, health: 2, maxHealth: 2, keywords: [], barrier: false, frostbitten: false, stunned: false,
  isAttacking: false, hasStruck: false, hasAttackedThisTurn: false, summonedThisTurn: false,
  isChampion: false, leveled: false, strikes: 0, nexusStrikes: 0, equipment: [], lastBreath: false, killedBy: null,
  powerBuffs: 0, healthBuffs: 0, permanentHealthModifier: 0, poisonCounters: 0,
}];
aiState.players.ai.sentinelas = [{ instanceId: "morvane", defId: "rf296_sent_morvane", owner: "ai", loyalty: 7, activatedThisTurn: false }];
aiState.players.ai.nexusHealth = 12;
const choice = aiChooseSentinelaAction(aiState, "ai");
assert.ok(choice, "AI must find a Sentinela activation");
assert.equal(choice?.kind, "sentinela");
assert.equal(choice?.abilityIndex, 2, "AI should prioritize Morvane's useful -7 ultimate at seven loyalty");
assert.equal(choice?.targetInstanceId, "victim", "AI must target the enemy unit required by the ultimate");
const afterUltimate = activateSentinelaAbility(aiState, "ai", choice!.instanceId, choice!.abilityIndex!, choice!.targetInstanceId);
assert.equal(afterUltimate.players.player.bench.some((unit) => unit.instanceId === "victim"), false, "Morvane ultimate must destroy its target");
assert.equal(afterUltimate.players.ai.nexusHealth, 16, "Morvane ultimate must resolve its chained heal");
assert.equal(afterUltimate.players.ai.sentinelas.some((sen) => sen.instanceId === "morvane"), false, "a Sentinela reduced to zero loyalty by its ultimate must leave the battlefield");

const migration = fs.readFileSync(path.join(process.cwd(), "drizzle/0036_sentinelas_convergence_2_96.sql"), "utf8");
for (const card of cards) assert.match(migration, new RegExp(`\\('${card.defId}'\\)`), `${card.defId} must be assigned by migration 0036`);
assert.match(migration, /runeforge_schema_meta\(version\).*'2\.96'/s);

console.log("SENTINELAS & CONVERGENCIA 2.96: 33 cards · 12 Sentinelas · 27 multi-region · 15 dual identities · 6 triads · runtime/AI/mana contracts PASS");
