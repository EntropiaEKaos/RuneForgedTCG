import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const types = readFileSync("src/game/activated-ability-types.ts", "utf8");
const engine = readFileSync("src/game/engine/activated-actions.ts", "utf8");
const authoring = readFileSync("src/game/activated-ability-authoring.ts", "utf8");
const studio = readFileSync("src/app/admin/studio/cards/ActivatedAbilityEditor.tsx", "utf8");
const grammar = readFileSync("src/game/ability-system.ts", "utf8");

assert.match(types, /spellMana\?: number/);
assert.match(types, /consumeBarrier\?: boolean/);
assert.match(engine, /not enough spell mana for activated ability/);
assert.match(engine, /source has no active Barrier to consume/);
assert.match(engine, /player\.spellMana -= ability\.cost\?\.spellMana/);
assert.match(engine, /source\.unit\.barrier = false/);
assert.match(authoring, /Only Unit sources may consume Barrier/);
assert.match(authoring, /Activated ability spell mana cost must be an integer/);
assert.match(grammar, /\| "spellMana"/);
assert.match(grammar, /\| "consumeBarrier"/);
assert.match(studio, /data-expanded-activated-costs="true"/);
assert.match(studio, /Mana de feitiço/);
assert.match(studio, /Consumir Barrier ativa/);
assert.match(studio, /card\.type === "Unit"/);

console.log("EXPANDED ACTIVATED ABILITY COSTS SOURCE CONTRACT: PASS");
