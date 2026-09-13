import assert from "node:assert/strict";
import { getCard } from "./cards";
import { buildVanillaContentAudit } from "./vanilla-content-audit";
import { VANILLA_EXPERIMENTAL_DECKS } from "./vanilla-experimental-decks";

/**
 * Historical Vanilla 1.8 snapshot.
 *
 * Vanilla 1.9 and later may evolve the active Florestia Ascendant recipe.
 * This test preserves the exact 1.8 30-card regional coverage plus its ten
 * duplicate slots, while leaving exact active-recipe ownership to the newest
 * version gate.
 */
const historical18 = [
  ...Array.from({ length: 18 }, (_, index) => `van_forest_u${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 8 }, (_, index) => `van_forest_s${String(index + 1).padStart(2, "0")}`),
  "van_forest_e01",
  "van_forest_e02",
  "van_forest_a01",
  "van_forest_q01",
  "van_forest_u11", "van_forest_u11",
  "van_forest_u13", "van_forest_u13",
  "van_forest_u14", "van_forest_u14",
  "van_forest_u16", "van_forest_u16",
  "van_forest_u17", "van_forest_u17",
];

assert.equal(historical18.length, 40, "Vanilla 1.8 historical snapshot must contain exactly 40 cards");
assert.equal(new Set(historical18).size, 30, "Vanilla 1.8 historical snapshot must preserve all 30 regional definitions");
for (const defId of historical18) getCard(defId);

const historicalCounts = new Map<string, number>();
for (const defId of historical18) historicalCounts.set(defId, (historicalCounts.get(defId) ?? 0) + 1);
assert.ok(Math.max(...historicalCounts.values()) <= 3, "Vanilla 1.8 historical snapshot must remain within the three-copy ceiling");
assert.deepEqual(
  [...historicalCounts.entries()].filter(([, count]) => count === 3).map(([defId]) => defId).sort(),
  [
    "van_forest_u11",
    "van_forest_u13",
    "van_forest_u14",
    "van_forest_u16",
    "van_forest_u17",
  ].sort(),
  "Vanilla 1.8 exact five-card finisher core drifted",
);

const report = buildVanillaContentAudit();
assert.equal(report.gate, "pass", report.errors.join("\n"));
assert.equal(report.experimentalUniqueCards, 180);
assert.deepEqual(report.uncoveredExperimentalCardIds, []);

const active = VANILLA_EXPERIMENTAL_DECKS.find((deck) => deck.id === "vanilla_forest_2");
assert.ok(active, "missing active Florestia Ascendant recipe");
assert.equal(active.cards.length, 40, "active Florestia Ascendant must remain exactly 40 cards");
assert.equal(new Set(active.cards).size, 30, "active Florestia Ascendant must preserve all 30 regional definitions");

console.log(
  "VANILLA 1.8 HISTORICAL SNAPSHOT: PASS — exact Florestia 1.8 recipe archived · active recipe may evolve under later version gates",
);
