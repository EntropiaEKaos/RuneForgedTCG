import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const editor = read("src/app/admin/studio/cards/ActivatedAbilityEditor.tsx");
const authoring = read("src/game/activated-ability-authoring.ts");
const runtime = read("src/game/reaction-activated-abilities.ts");
const pvp = read("src/lib/pvp-authoritative-transition.ts");

assert.match(editor, /data-studio-reaction-activated-authoring="true"/, "Studio exposes a dedicated reaction activated authoring surface");
assert.match(editor, /data-reaction-responds-to="true"/, "Studio exposes respondsTo timing controls");
assert.match(editor, /REACTION_KINDS/, "Studio derives reaction action families from one explicit catalog");
assert.match(editor, /reactionActivatedAbilities/, "Studio reads and persists reaction activated abilities");
assert.match(editor, /spellOnStack/, "reaction authoring communicates stack targeting");
assert.match(editor, /blockedTargets=\{\["spellOnStack"\]\}/, "main-phase authoring continues to block stack targeting");
assert.match(editor, /Casual PvP ainda não persiste janelas de prioridade/, "Studio communicates the certified PvP timing boundary instead of implying unsupported behavior");

assert.match(authoring, /delete baseInput\.reactionActivatedAbilities/, "base authoring cannot silently rewrite the reaction collection");
assert.match(authoring, /sanitizeRespondsTo/, "reaction timing is fail-closed in canonical authoring");
assert.match(authoring, /allowStackTarget/, "stack targeting is timing-aware rather than globally enabled");
assert.match(authoring, /Generic self-target activated effects currently require a Unit source/, "non-Unit self effects fail closed at publication");

assert.match(runtime, /validateReactionActivatedAbilityActivation/, "runtime retains authoritative reaction activation validation");
assert.match(runtime, /cannotBeCountered/, "runtime reaction counters honor uncounterable semantics");
assert.match(pvp, /case "react":\s*\n\s*case "resolve":\s*\n\s*case "aiStep":\s*\n\s*return null/, "PvP explicitly rejects non-persisted reaction priority actions");

console.log("STUDIO REACTION ACTIVATED ABILITY REGRESSION: PASS — timing authoring, stack targeting and fail-closed PvP boundary certified");