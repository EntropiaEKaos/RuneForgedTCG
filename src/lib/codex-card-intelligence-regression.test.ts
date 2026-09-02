import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const codex = readFileSync("src/app/codex/CodexExplorer.tsx", "utf8");
const cardTip = readFileSync("src/components/CardTip.tsx", "utf8");
const tooltip = readFileSync("src/components/Tooltip.tsx", "utf8");
const semanticTypes = readFileSync("src/game/semantic-card-types.ts", "utf8");

assert.ok(codex.includes('import CardTip from "@/components/CardTip";'), "Codex cards must reuse the shared CardTip intelligence surface");
assert.ok(codex.includes("<CardTip") && codex.includes("definition={card}"), "Codex must pass the published definition through CardTip");
assert.ok(codex.includes("collection={entry.collection}"), "Codex card rendering must preserve collection identity");
assert.ok(codex.includes("Passe o mouse em uma carta — ou toque e segure"), "Codex must make desktop and touch intelligence discovery explicit");

assert.ok(cardTip.includes("<CardInfo") && cardTip.includes("<ActivatedAbilityIntelligence"), "Shared CardTip must retain rules and activated-ability intelligence");
assert.ok(tooltip.includes("LONG_PRESS_MS") && tooltip.includes("onTouchStart={handleTouchStart}"), "Shared tooltip must retain long-press support for touch devices");

assert.ok(codex.includes("CERTIFIED_SEMANTIC_CARD_TYPES"), "Codex type options must derive certified semantic gameplay types from the central contract");
assert.ok(codex.includes("certifiedSemanticCardType(card)?.key ?? card.type"), "Codex filtering must prefer the gameplay-facing semantic type over its storage base type");
assert.ok(codex.includes("visibleTypeKey(card) !== type"), "Type filtering must use the gameplay-facing type identity");
assert.ok(codex.includes("semanticCardTypeLabel(card)"), "Codex presentation must use the canonical semantic type label");
assert.ok(codex.includes("semantic?.description") && codex.includes("semantic?.timing") && codex.includes("semantic?.mana"), "Codex search must discover cards by semantic type contract");

for (const key of ["structure", "ritual", "trap"]) {
  assert.ok(semanticTypes.includes(`key: "${key}"`), `Certified semantic type ${key} must remain centrally defined`);
}
assert.ok(codex.includes("Contrato de gameplay"), "Selected semantic cards must expose their gameplay contract");
assert.ok(codex.includes("TIMING_LABEL[semanticType.timing]"), "Semantic cards must explain their legal timing");
assert.ok(codex.includes("MANA_LABEL[semanticType.mana]"), "Semantic cards must explain their mana contract");
assert.ok(codex.includes("Base técnica: {TYPE_LABEL[semanticType.baseType]}"), "Semantic cards must distinguish player-facing type from stable storage base");

for (const forbidden of ["fetch(", "axios", "localStorage", "sessionStorage", "dispatch(", "applyAction(", "playCard(", "castSpell("]) {
  assert.ok(!codex.includes(forbidden), `Codex intelligence parity must remain presentation-only: ${forbidden}`);
}

console.log("RUNE FORGE CODEX CARD INTELLIGENCE: PASS");
