import assert from "node:assert/strict";
import { ENGINE_VERSION, RULESET_VERSION } from "@/game/version";
import { DECKS } from "@/game/decks";

assert.ok(ENGINE_VERSION.length > 0, "Engine version must remain defined");
assert.ok(RULESET_VERSION.length > 0, "Ruleset version must remain defined");
assert.ok(DECKS.length >= 2, "Balance Lab needs at least two decks");
assert.ok(DECKS.every(d => d.cards.length >= 20), "Existing decks must remain valid fixtures");
console.log("content-studio-5-regression: ok");
