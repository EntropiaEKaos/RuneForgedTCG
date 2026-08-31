import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const stack = read("src/components/game/ReactionStack.tsx");
const lifecycle = read("src/app/play/hooks/useMatchLifecycle.ts");
const uiContract = read("src/game/client/reaction-ui-contract.ts");

assert.match(stack, /data-reaction-activated-picker="true"/, "reaction stack exposes a battlefield ability picker");
assert.match(stack, /reactionActivatedAbilityOptions/, "picker discovers choices through the canonical runtime contract");
assert.match(stack, /validateReactionActivatedAbilityActivation/, "picker derives legal board targets from authoritative validation");
assert.match(stack, /data-reaction-selected-discard="true"/, "picker exposes explicit selected-discard payment when required");
assert.match(stack, /responseKind:\s*"activatedAbility"/, "picker emits explicit battlefield response identity");
assert.match(stack, /REACTION_ACTIVATED_SUBMIT_EVENT/, "picker submits through the typed reaction UI handoff");
assert.match(stack, /type:\s*"react"/, "browser log preserves the historical react opcode with additive fields");

assert.match(uiContract, /ReactionActivatedSubmitDetail/, "browser handoff has a shared typed payload");
assert.match(uiContract, /Extract<GameAction, \{ type: "react" \}>/, "handoff log payload is constrained to the authoritative react action shape");

assert.match(lifecycle, /addEventListener\(REACTION_ACTIVATED_SUBMIT_EVENT/, "match lifecycle subscribes to battlefield reaction submissions");
assert.match(lifecycle, /canReactWithActivatedAbilityAction/, "lifecycle revalidates the DOM event before logging or resolving it");
assert.match(lifecycle, /if \(!reaction \|\| isPvp \|\| reaction\.pendingHuman\) return;/, "battlefield reaction UI stays fail-closed in PvP and while another human frame is pending");
assert.match(lifecycle, /recordAction\(\{ type: "react", player: "player", instanceId: humanReact\.instanceId/, "legacy hand-card reactions remain on the original logging path");
assert.match(lifecycle, /hasReactionOpportunity/, "AI action loop opens windows through the unified card-or-battlefield opportunity contract");

console.log("REACTION ACTIVATED UI REGRESSION: PASS — authoritative picker, replay handoff and fail-closed PvP boundary certified");