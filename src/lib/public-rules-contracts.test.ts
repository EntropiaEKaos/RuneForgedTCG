import assert from "node:assert/strict";
import { CARD_TYPES } from "@/game/card-authoring";
import { CERTIFIED_SEMANTIC_CARD_TYPES } from "@/game/semantic-card-types";
import type { PublicCardDto } from "./public-card-catalog";
import { buildPublicRulesContracts } from "./public-rules-contracts";

const collection = { key: "vanilla", code: "VAN", name: "Vanilla", symbol: null };
const base = {
  region: "Emberhold",
  regions: ["Emberhold"],
  cost: 2,
  keywords: [],
  customKeywords: [],
  description: "Fixture",
  rarity: "Common",
  races: [],
  classes: [],
  isLegend: false,
  isChampion: false,
  emoji: "◆",
  doctrineAffinities: [],
  collection,
} as const;

const cards: PublicCardDto[] = [
  { ...base, defId: "unit", name: "Unit", type: "Unit", structuralType: "Unit", power: 2, health: 2 },
  { ...base, defId: "spell", name: "Spell", type: "Spell", structuralType: "Spell" },
  { ...base, defId: "structure", name: "Structure", type: "Estrutura", structuralType: "Artifact" },
  { ...base, defId: "ritual", name: "Ritual", type: "Ritual", structuralType: "Spell" },
  { ...base, defId: "trap", name: "Trap", type: "Armadilha", structuralType: "Spell" },
];

const result = buildPublicRulesContracts(cards);
assert.equal(result.version, 1);
assert.equal(result.structural.length, CARD_TYPES.length);
assert.equal(result.structural.length, 6);
assert.equal(result.semantic.length, CERTIFIED_SEMANTIC_CARD_TYPES.length);
assert.equal(result.semantic.length, 3);
assert.equal(result.all.length, 9);

for (const type of CARD_TYPES) {
  assert.ok(result.structural.some((item) => item.key === type && item.baseType === type));
}

const unit = result.structural.find((item) => item.key === "Unit");
assert.equal(unit?.mana, "regular");
assert.equal(unit?.countsAsSpellCast, false);
assert.equal(unit?.persistent, true);
assert.equal(unit?.cardCount, 1);

const spell = result.structural.find((item) => item.key === "Spell");
assert.equal(spell?.zone, "stack");
assert.equal(spell?.timing, "speed-based");
assert.equal(spell?.mana, "spell");
assert.equal(spell?.countsAsSpellCast, true);
assert.equal(spell?.cardCount, 1, "semantic Ritual/Trap must not inflate plain structural Spell display count");

for (const engine of CERTIFIED_SEMANTIC_CARD_TYPES) {
  const projected = result.semantic.find((item) => item.key === engine.key);
  assert.ok(projected);
  assert.equal(projected.name, engine.name);
  assert.equal(projected.baseType, engine.baseType);
  assert.equal(projected.timing, engine.timing);
  assert.equal(projected.mana, engine.mana);
  assert.equal(projected.description, engine.description);
}

const structure = result.semantic.find((item) => item.key === "structure");
assert.equal(structure?.cardCount, 1);
assert.equal(structure?.persistent, true);
assert.equal(structure?.countsAsSpellCast, false);
assert.equal(structure?.mana, "regular");

const ritual = result.semantic.find((item) => item.key === "ritual");
assert.equal(ritual?.cardCount, 1);
assert.equal(ritual?.timing, "main-only");
assert.equal(ritual?.countsAsSpellCast, true);

const trap = result.semantic.find((item) => item.key === "trap");
assert.equal(trap?.cardCount, 1);
assert.equal(trap?.timing, "reaction-only");

for (const item of result.all) {
  assert.equal("spell" in item, false);
  assert.equal("effect" in item, false);
  assert.equal("behavior" in item, false);
  assert.equal("mechanics" in item, false);
}

console.log("PUBLIC RULES CONTRACTS: PASS — 6 structural · 3 semantic · engine-aligned timing/mana · public counts · safe DTO");
