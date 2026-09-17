import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const cardView = fs.readFileSync("src/components/CardView.tsx", "utf8");

test("CardView exposes authoritative rarity as a presentation-only DOM contract", () => {
  assert.match(cardView, /data-card-rarity=/);
  assert.match(cardView, /def\.rarity/);
  assert.match(cardView, /card-tier-/);
});

test("CardView keeps cosmetic frame and rarity as separate presentation dimensions", () => {
  assert.match(cardView, /data-card-frame=\{appearance\.frameId\}/);
  assert.match(cardView, /data-card-rarity=/);
  assert.match(cardView, /cosmeticClassNames\(appearance\)/);
});
