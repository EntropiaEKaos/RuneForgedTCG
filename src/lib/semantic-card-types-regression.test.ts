import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const semantic = read("src/game/semantic-card-types.ts");
assert.match(semantic, /key: "structure"/);
assert.match(semantic, /key: "ritual"/);
assert.match(semantic, /key: "trap"/);
assert.match(semantic, /baseType: "Artifact"/);
assert.match(semantic, /reaction-only/);
assert.match(semantic, /main-only/);
assert.match(semantic, /cardUsesSpellMana/);

const engineFacade = read("src/game/engine.ts");
assert.match(engineFacade, /engine\/semantic-actions/);
assert.match(engineFacade, /semantic-card-types/);
assert.doesNotMatch(engineFacade, /export \* from "\.\/engine\/actions"/);

const reducerFacade = read("src/game/reducer.ts");
assert.match(reducerFacade, /isTrapCard/);
assert.match(reducerFacade, /action\.type === "play" \|\| action\.type === "cast"/);

const classification = read("src/app/admin/studio/cards/CardClassificationTab.tsx");
assert.match(classification, /Certified gameplay types/);
assert.match(classification, /CERTIFIED_SEMANTIC_CARD_TYPES/);
assert.match(classification, /data-certified-card-type/);
assert.match(classification, /Reaction speed/);
assert.match(classification, /Ritual é deliberadamente main-phase only/);
assert.match(classification, /Armadilha é reaction-only/);
assert.match(classification, /Estrutura usa mana regular/);

for (const path of [
  "src/app/api/admin/cards/route.ts",
  "src/app/api/admin/cards/[id]/route.ts",
  "src/app/api/admin/studio/sandbox/route.ts",
  "src/app/api/admin/studio/import/route.ts",
  "src/lib/content-validation.ts",
]) {
  assert.match(read(path), /validateAuthorableCardWithSemanticTypes/, `${path} bypasses certified semantic type validation`);
}

console.log("SEMANTIC CARD TYPES SOURCE CONTRACT PASS: Studio + API + QA + engine authority are wired to the certified subtype contract");
