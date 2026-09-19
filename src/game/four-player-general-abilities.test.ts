import assert from "node:assert/strict";
import { activeGeneralAbilities, type GeneralAbilityDefinition } from "./four-player-general-abilities";

const abilities: GeneralAbilityDefinition[] = [
  { key: "war-council", scope: "command", description: "Command zone example." },
  { key: "battle-aura", scope: "presence", description: "Battlefield example." },
];

assert.deepEqual(activeGeneralAbilities(abilities, { location: "general_zone" }).map((a) => a.key), ["war-council"]);
assert.deepEqual(activeGeneralAbilities(abilities, { location: "battlefield" }).map((a) => a.key), ["battle-aura"]);
assert.deepEqual(activeGeneralAbilities(abilities, { location: "stack" }), []);
assert.deepEqual(activeGeneralAbilities(abilities, { location: "graveyard" }), []);
assert.deepEqual(activeGeneralAbilities(abilities, { location: "exile" }), []);

console.log("FOUR PLAYER GENERAL ABILITY SCOPES: PASS");
