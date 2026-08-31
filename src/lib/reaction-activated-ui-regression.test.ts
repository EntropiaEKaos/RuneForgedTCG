import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

const stack = read("src/components/game/ReactionStack.tsx");
const lifecycle = read("src/app/play/hooks/useMatchLifecycle.ts");
const transport = read("src/app/play/hooks/usePvpTransport.ts");
const battleView = read("src/app/play/BattleView.tsx");
const uiContract = read("src/game/client/reaction-ui-contract.ts");
const pvpEvents = read("src/game/client/pvp-reaction-events.ts");

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
assert.match(lifecycle, /canReactWithActivatedAbilityAction/, "lifecycle revalidates the DOM event before logging or transmitting it");
assert.match(lifecycle, /PVP_REACTION_STATE_EVENT/, "PvP reaction UI is hydrated only from the persisted server priority projection");
assert.match(lifecycle, /requestPvpReactionAction\(gameAction\)/, "PvP battlefield and hand responses go through the authoritative room sender");
assert.match(lifecycle, /requestPvpReactionAction\(\{ type: "resolve" \}\)/, "PvP priority pass preserves the historical resolve opcode");
assert.match(lifecycle, /if \(left <= 0 && !isPvp\) finishReaction\(\)/, "PvP timeout is not client-authoritative");
assert.match(lifecycle, /recordAction\(\{ type: "react", player: "player", instanceId: humanReact\.instanceId/, "legacy PvE hand-card reactions remain on the original logging path");
assert.match(lifecycle, /hasReactionOpportunity/, "AI action loop opens windows through the unified card-or-battlefield opportunity contract");

assert.match(pvpEvents, /PVP_REACTION_ACTION_EVENT/, "PvP reaction actions use a dedicated typed client event");
assert.match(transport, /addEventListener\(PVP_REACTION_ACTION_EVENT/, "PvP transport owns reaction action delivery");
assert.match(transport, /canonicalizeGuestAction/, "guest reactions retain canonical seat orientation before transport");
assert.match(transport, /publishPvpReactionState/, "polling and action responses publish the persisted priority projection to the UI");
assert.match(battleView, /data-pvp-reaction-priority/, "battlefield exposes persistent priority state for browser certification");
assert.match(battleView, /data-pvp-priority-waiting="true"/, "action owner receives an explicit wait state while opponent holds priority");

console.log("REACTION ACTIVATED UI REGRESSION: PASS — authoritative picker + persistent PvP priority transport/UI certified");
