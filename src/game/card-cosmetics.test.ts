import assert from "node:assert/strict";
import {
  cosmeticClassNames,
  cosmeticDropChancePercent,
  normalizeCardCosmeticInput,
  replacePlayerCardCosmeticPreferences,
  replaceRegisteredCardCosmetics,
  resolveCardAppearance,
  resolveCardCosmeticPrestige,
} from "./card-cosmetics";
import { CARD_RARITY_PRESENTATION, rarityPresentationClassNames, resolveCardRarityPresentation } from "./card-rarity-presentation";
import { cardRarityPresentationContract } from "./card-rarity-presentation-contract";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    defId: "van_tide_u15",
    variantId: "tide_first_forge",
    name: "First Forge Foil",
    kind: "foil",
    frameId: "first_forge",
    finish: "foil",
    artUrl: "/uploads/tide-first-forge.webp",
    acquisition: "pack",
    packEligible: true,
    dropWeight: 2500,
    ...overrides,
  };
}

function main() {
  const normalized = normalizeCardCosmeticInput(valid());
  assert.equal(normalized.errors.length, 0, "valid cosmetic payload must pass normalization");
  assert.equal(normalized.value?.dropWeight, 2500);
  assert.deepEqual(normalized.value?.artCrop, { x: .5, y: .5, scale: 1 });

  for (const gameplayField of ["cost", "power", "health", "keywords", "description", "rarity", "type", "mechanics"]) {
    const result = normalizeCardCosmeticInput(valid({ [gameplayField]: gameplayField === "keywords" ? ["Flying"] : 99 }));
    assert.equal(result.value, null, `${gameplayField} must never be accepted by cosmetic authoring`);
    assert.ok(result.errors.some((error) => error.includes(gameplayField)), `${gameplayField} rejection must be explicit`);
  }

  assert.equal(resolveCardCosmeticPrestige(valid({ dropWeight: 100_000 }) as any).id, "forged");
  assert.equal(resolveCardCosmeticPrestige(valid({ dropWeight: 25_000 }) as any).id, "scarce");
  assert.equal(resolveCardCosmeticPrestige(valid({ dropWeight: 5_000 }) as any).id, "exalted");
  assert.equal(resolveCardCosmeticPrestige(valid({ dropWeight: 4_999 }) as any).id, "relic");
  assert.equal(resolveCardCosmeticPrestige(valid({ acquisition: "event", packEligible: false, dropWeight: 0 }) as any).id, "exclusive");
  assert.equal(cosmeticDropChancePercent(25_000), 2.5, "PPM must convert to nominal percentage without changing pack authority");

  assert.equal(normalizeCardCosmeticInput(valid({ variantId: "standard" })).value, null, "standard is reserved for implicit base appearance");
  assert.equal(normalizeCardCosmeticInput(valid({ kind: "animated", animationUrl: null })).value, null, "animated variants require animation media");
  assert.equal(normalizeCardCosmeticInput(valid({ kind: "serialized", serialLimit: null })).value, null, "serialized variants require a finite edition size");
  assert.equal(normalizeCardCosmeticInput(valid({ artUrl: "javascript:alert(1)" })).value, null, "cosmetic media URLs must be same-origin or HTTPS");

  replaceRegisteredCardCosmetics([]);
  replacePlayerCardCosmeticPreferences([]);
  assert.deepEqual(resolveCardAppearance("van_tide_u15"), {
    defId: "van_tide_u15",
    variantId: "standard",
    name: "Standard",
    kind: "standard",
    frameId: "default",
    finish: "normal",
  }, "cards without equipped cosmetic must resolve to Standard");

  const variant = normalizeCardCosmeticInput(valid({ kind: "serialized", finish: "holo", edition: "First Edition", serialLimit: 500, packEligible: false, dropWeight: 0 })).value!;
  replaceRegisteredCardCosmetics([{ ...variant, id: 7, status: "published", enabled: true }]);
  replacePlayerCardCosmeticPreferences([{ defId: variant.defId, assetId: 41, variantId: variant.variantId, frameId: variant.frameId, finish: variant.finish, serialNumber: 17 }]);
  const resolved = resolveCardAppearance(variant.defId);
  assert.equal(resolved.variantId, variant.variantId);
  assert.equal(resolved.kind, "serialized");
  assert.equal(resolved.serialNumber, 17);
  assert.equal(resolved.serialLimit, 500);
  assert.equal(resolved.assetId, 41, "equipped appearance must preserve exact collectible copy identity");
  assert.equal(resolved.artUrl, "/uploads/tide-first-forge.webp");
  assert.ok(cosmeticClassNames(resolved).includes("card-prestige-exclusive"), "shared CardView class contract must surface cosmetic prestige without changing CardInstance");

  replaceRegisteredCardCosmetics([]);
  assert.equal(resolveCardAppearance(variant.defId).variantId, "standard", "missing/unpublished cosmetic definitions must fail closed to Standard even if a preference remains");

  assert.deepEqual(["Common", "Rare", "Epic", "Legend"].map((rarity) => CARD_RARITY_PRESENTATION[rarity as keyof typeof CARD_RARITY_PRESENTATION].rank), [0, 1, 2, 3], "rarity prestige must stay deterministic");
  assert.equal(resolveCardRarityPresentation(undefined).id, "common", "missing rarity presentation must fail safely to Common");
  assert.deepEqual(rarityPresentationClassNames(undefined), ["card-tier-common", "card-rarity-ornament-common"]);
  const legend = resolveCardRarityPresentation("Legend");
  assert.equal(legend.premiumFx, "cinematic");
  assert.equal(legend.shellClass, "card-tier-legend");
  assert.equal(legend.shortLabel, "LENDÁRIA");
  assert.deepEqual(cardRarityPresentationContract("Epic"), {
    classes: ["card-tier-epic", "card-rarity-ornament-epic"],
    attributes: { "data-card-rarity": "epic", "data-card-rarity-rank": 2, "data-card-rarity-fx": "standard" },
  }, "rarity DOM contract must stay stable and presentation-only");
  assert.equal(cardRarityPresentationContract(undefined).attributes["data-card-rarity-fx"], "none", "Common fallback must not request premium FX");

  console.log("CARD COSMETICS + RARITY PRESENTATION: PASS");
}

main();
