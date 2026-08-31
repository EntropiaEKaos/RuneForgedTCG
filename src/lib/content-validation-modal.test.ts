import assert from "node:assert/strict";
import { validateContent } from "./content-validation";

function row(modes: unknown) {
  return {
    id: 1,
    defId: "modal_pipeline_probe",
    name: "Modal Pipeline Probe",
    data: {
      defId: "modal_pipeline_probe",
      name: "Modal Pipeline Probe",
      region: "Tidecall",
      type: "Artifact",
      cost: 2,
      rarity: "Rare",
      emoji: "◇",
      description: "Content governance modal probe.",
      maxHealth: 4,
      activatedAbilities: [{
        description: "Choose one",
        cost: { mana: 1 },
        modes,
      }],
    },
  };
}

const valid = validateContent("cards", row([
  { id: "spark", description: "Spark", effect: { kind: "damageNexus", amount: 2, target: "none" } },
  { id: "study", description: "Study", effect: { kind: "draw", amount: 1, target: "none" } },
]));
assert.equal(valid.passed, true, `valid modal card must pass central content governance: ${valid.errors.join("; ")}`);

const duplicate = validateContent("cards", row([
  { id: "same", description: "First", effect: { kind: "draw", amount: 1, target: "none" } },
  { id: "same", description: "Second", effect: { kind: "damageNexus", amount: 1, target: "none" } },
]));
assert.equal(duplicate.passed, false, "QA/publish/rollback governance must reject duplicate modal ids");
assert.ok(duplicate.errors.some((error) => /duplicate mode id/i.test(error)), duplicate.errors.join("; "));

const uncertifiedCondition = validateContent("cards", row([
  { id: "conditional", description: "Conditional", condition: { kind: "always" }, effect: { kind: "draw", amount: 1, target: "none" } },
]));
assert.equal(uncertifiedCondition.passed, false, "governance must fail closed on uncertified per-mode conditions");
assert.ok(uncertifiedCondition.errors.some((error) => /condition|override/i.test(error)), uncertifiedCondition.errors.join("; "));

console.log("CONTENT VALIDATION MODAL: PASS — QA/publish/rollback governance validates the complete activated modal contract");
