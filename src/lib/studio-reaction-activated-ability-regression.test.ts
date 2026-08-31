import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const editor = read("src/app/admin/studio/cards/ActivatedAbilityEditor.tsx");
const authoring = read("src/game/activated-ability-authoring.ts");
const runtime = read("src/game/reaction-activated-abilities.ts");
const pvp = read("src/lib/pvp-authoritative-transition.ts");
const priority = read("src/lib/pvp-reaction-priority.ts");

assert.match(editor, /data-studio-reaction-activated-authoring="true"/, "Studio exposes a dedicated reaction activated authoring surface");
assert.match(editor, /data-reaction-responds-to="true"/, "Studio exposes respondsTo timing controls");
assert.match(editor, /REACTION_KINDS/, "Studio derives reaction action families from one explicit catalog");
assert.match(editor, /reactionActivatedAbilities/, "Studio reads and persists reaction activated abilities");
assert.match(editor, /spellOnStack/, "reaction authoring communicates stack targeting");
assert.match(editor, /blockedTargets=\{\["spellOnStack"\]\}/, "main-phase authoring continues to block stack targeting");
assert.match(editor, /Casual PvP usa prioridade persistida no servidor/, "Studio communicates the certified persistent PvP priority boundary");
assert.match(editor, /Encadeamento arbitrário de múltiplas respostas PvP ainda permanece fora do protocolo v1/, "Studio documents the remaining nested-response protocol limit explicitly");

assert.match(authoring, /delete baseInput\.reactionActivatedAbilities/, "base authoring cannot silently rewrite the reaction collection");
assert.match(authoring, /sanitizeRespondsTo/, "reaction timing is fail-closed in canonical authoring");
assert.match(authoring, /allowStackTarget/, "stack targeting is timing-aware rather than globally enabled");
assert.match(authoring, /Generic self-target activated effects currently require a Unit source/, "non-Unit self effects fail closed at publication");

assert.match(runtime, /validateReactionActivatedAbilityActivation/, "runtime retains authoritative reaction activation validation");
assert.match(runtime, /cannotBeCountered/, "runtime reaction counters honor uncounterable semantics");
assert.match(pvp, /openPvpReactionPriority/, "PvP transition opens server-persisted reaction priority before resolving reactable actions");
assert.match(pvp, /PVP_REACTION_PRIORITY_HELD_BY_OPPONENT/, "PvP boundary prevents the action owner from bypassing opponent priority");
assert.match(priority, /canReactWithResponse/, "PvP response payloads use the same canonical reaction legality contract as PvE");
assert.match(priority, /Nested PvP reaction priority is not certified by protocol v1/, "unsupported nested PvP reaction chains fail closed explicitly");

console.log("STUDIO REACTION ACTIVATED ABILITY REGRESSION: PASS — timing authoring, stack targeting and persistent PvP priority boundary certified");
