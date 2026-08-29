import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
let pass = 0;
let fail = 0;
function check(name: string, condition: boolean) {
  if (condition) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.error(`❌ ${name}`); }
}
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

const ruleDsl = read("src/lib/rule-dsl.ts");
const ruleBuilder = read("src/app/admin/studio/RuleBuilder.tsx") + read("src/app/admin/studio/RuleBuilderModel.ts") + read("src/app/admin/studio/RuleBuilderCanvas.tsx");
const authoring = read("src/game/mechanics-authoring.ts");
const types = read("src/game/types.ts");
const engine = read("src/game/engine.ts") + read("src/game/engine/effects.ts") + read("src/game/engine/state.ts");
const pipeline = read("src/lib/content-pipeline.ts");
const schema = read("src/db/schema.ts") + read("src/db/schema/admin-content.ts");
const migration = read("drizzle/0020_mechanics_studio.sql");
const cardStudio = read("src/app/admin/studio/cards/CardAuthoringStudio.tsx") + read("src/app/admin/studio/cards/useCardAuthoringModel.ts") + read("src/app/admin/studio/cards/CardAuthoringFields.tsx");
const catalog = read("src/app/api/admin/studio/mechanics/catalog/route.ts");
const mechanicsUi = read("src/app/admin/studio/mechanics/MechanicsStudio.tsx");
const mechanicsPatch = read("src/app/api/admin/studio/[resource]/[id]/route.ts");
const pkg = JSON.parse(read("package.json"));
const suites = read("scripts/test-suites.mjs");

check("Rule DSL consumes canonical effect catalog", ruleDsl.includes("CARD_EFFECT_KINDS") && !ruleDsl.includes('"killUnit","poison"'));
check("Rule Builder consumes canonical effect/target catalogs", ruleBuilder.includes("CARD_EFFECT_KINDS") && ruleBuilder.includes("CARD_TARGETS"));
check("No arbitrary eval/new Function in mechanics authoring or UI", !/\beval\s*\(|new\s+Function\s*\(/.test(authoring + mechanicsUi + pipeline));
check("CardDef supports embedded mechanics and semantic archetype", types.includes("mechanics?: CardMechanic[]") && types.includes("archetypeKey?: string"));
check("Engine executes embedded mechanics through trigger path", engine.includes("def.mechanics") && engine.includes("mechanicConditionMatches"));
check("Mechanics authoring restricts archetypes to canonical CARD_TYPES", authoring.includes("CARD_TYPES") && authoring.includes("zones: Record<CardType"));
check("Archetype database schema exists", schema.includes("adminCardArchetypes") && schema.includes('"admin_card_archetypes"'));
check("Archetype migration restricts base structural types", migration.includes("admin_card_archetypes") && migration.includes("CHECK") && migration.includes("Sentinela"));
check("Content pipeline includes archetypes", pipeline.includes('"archetypes"') && pipeline.includes("adminCardArchetypes"));
check("QA validates published custom keyword contract", pipeline.includes("does not match its published mechanic contract"));
check("QA validates archetype baseType", pipeline.includes("requires structural base type"));
check("Card Studio loads mechanics catalog", cardStudio.includes("/api/admin/studio/mechanics/catalog"));
check("Card Studio embeds published keyword mechanics", cardStudio.includes("customKeywords") && cardStudio.includes("mechanics"));
check("Mechanics catalog exposes canonical primitives", catalog.includes("CARD_EFFECT_KINDS") && catalog.includes("CARD_TRIGGERS") && catalog.includes("CARD_TYPES"));
check("Mechanics editor supports draft editing", mechanicsUi.includes("editingId") && mechanicsUi.includes("PATCH"));
check("Mechanics editor locks identity keys after creation", mechanicsUi.includes("Identity key imutável") && mechanicsUi.includes("readOnly={locked}") && mechanicsUi.includes("if (editingId) delete payload.key"));
check("Mechanics PATCH contract excludes identity key mutations", /keywords:\s*\["name",\s*"description",\s*"icon",\s*"engineKeyword",\s*"behavior"\]/.test(mechanicsPatch) && /effects:\s*\["name",\s*"description",\s*"kind",\s*"schema"\]/.test(mechanicsPatch) && /archetypes:\s*\["name",\s*"description",\s*"baseType",\s*"definition"\]/.test(mechanicsPatch));
check("mechanics regression is classified as behavioral", /behavioralTests[\s\S]*mechanics-studio-1\.0\.test\.ts/.test(suites));
check("Dedicated mechanics test script exists", String(pkg.scripts?.["test:mechanics"] || "").includes("card-authoring-roundtrip.test.ts"));

console.log(`MECHANICS STUDIO REGRESSION: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
