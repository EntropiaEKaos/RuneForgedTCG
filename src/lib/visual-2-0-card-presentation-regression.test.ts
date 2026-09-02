import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/styles/visual-2-0-card-presentation.css", "utf8");
const handSafety = readFileSync("src/app/styles/visual-2-0-hand-selection-safety.css", "utf8");
const cardView = readFileSync("src/components/CardView.tsx", "utf8");
const cardInfo = readFileSync("src/components/CardInfo.tsx", "utf8");
const playerHand = readFileSync("src/components/game/PlayerHand.tsx", "utf8");
const doc = readFileSync("docs/VISUAL-2-0-CARD-PRESENTATION.md", "utf8");

assert.ok(
  layout.includes('import "./styles/visual-2-0-card-presentation.css";\nimport "./styles/visual-2-0-hand-selection-safety.css";'),
  "Hand selection safety must load after Card Presentation so gameplay selection cannot be clipped by earlier fan transforms",
);

for (const region of ["emberhold", "tidecall", "ironwood", "voidborn", "florestia", "tempestade"]) {
  assert.ok(css.includes(`[data-card-region="${region}"]`), `Card Presentation must preserve a material accent for ${region}`);
}

for (const rarity of ["rare", "epic", "legend"]) {
  assert.ok(css.includes(`[data-card-rarity="${rarity}"]`), `Card Presentation must give ${rarity} a distinct forged-frame treatment`);
}

assert.ok(css.includes(".tcg-arena .tcg-row .card-shell"), "Board-card density must remain explicitly scoped to the battlefield row");
assert.ok(css.includes(".tcg-arena .tcg-hand .card-shell"), "Hand-card density must remain explicitly scoped to the player hand");
assert.ok(css.includes('[data-card-intelligence-panel="true"]'), "Inspection must share the Visual 2.0 forged language");
assert.ok(css.includes(".card-cost") && css.includes("clip-path: polygon"), "Mana must use the certified rune-stone silhouette");
assert.ok(css.includes(".stat-power") && css.includes(".stat-health"), "Power and Health must remain distinct bottom anchors");
assert.ok(css.includes('[data-card-state="targetable"]'), "Gameplay target signals must remain visually stronger than rarity treatment");
assert.ok(css.includes("@media (prefers-reduced-motion: reduce)"), "Card Presentation must preserve reduced-motion accessibility");

assert.ok(
  handSafety.includes('.card-shell[data-card-state="selected"]') && handSafety.includes("transform: none !important"),
  "Selected hand cards must not inherit the generic upward selected transform that can shave the card crown",
);
assert.ok(
  handSafety.includes(".tcg-arena .tcg-hand") && handSafety.includes("overflow: visible"),
  "The hand shelf must preserve visible overflow for the complete selected frame",
);
assert.ok(
  handSafety.includes(":has(.card-shell[data-card-state=\"selected\"])"),
  "Selected hand card wrapper must rise in stacking order without changing geometry",
);
assert.ok(
  playerHand.includes("selected={pendingSpell?.instanceId === cardInstance.instanceId || pendingReaction?.instanceId === cardInstance.instanceId}"),
  "PlayerHand must continue deriving selected presentation from real pending spell/reaction state",
);

assert.ok(cardView.includes("data-card-region={def.region.toLowerCase()}"), "CardView must continue exposing region semantics for presentation/accessibility");
assert.ok(cardView.includes("data-card-rarity={(def.rarity || \"Common\").toLowerCase()}"), "CardView must continue exposing rarity semantics");
assert.ok(cardView.includes("data-card-state={cardState}"), "CardView must continue exposing authoritative presentation state");
assert.ok(cardInfo.includes('data-card-intelligence-panel="true"'), "Card intelligence panel contract must remain available");

assert.ok(doc.includes("Board card") && doc.includes("Hand card") && doc.includes("Intelligence / inspect"), "Card Presentation documentation must preserve the three information densities");
assert.ok(doc.includes("presentation-only") && doc.includes("CardDef"), "Documentation must preserve the engineering boundary");
assert.ok(doc.includes("selected") && doc.includes("complete top frame"), "Documentation must explicitly preserve the selected-card crown safety rule");

console.log("RUNE FORGE VISUAL 2.0 CARD PRESENTATION: PASS");
