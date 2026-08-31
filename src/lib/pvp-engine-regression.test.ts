/** Static regressions for the human-vs-human authoritative path. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reducer = [
  fs.readFileSync(path.join(root, "src/game/reducer.ts"), "utf8"),
  fs.readFileSync(path.join(root, "src/game/reducer-core.ts"), "utf8"),
].join("\n");
const pvpRoute = fs.readFileSync(path.join(root, "src/app/api/pvp/[code]/route.ts"), "utf8");
const settlement = fs.readFileSync(path.join(root, "src/lib/pvp-settlement.ts"), "utf8");
const transition = fs.readFileSync(path.join(root, "src/lib/pvp-authoritative-transition.ts"), "utf8");
const priority = fs.readFileSync(path.join(root, "src/lib/pvp-reaction-priority.ts"), "utf8");
const replay = fs.readFileSync(path.join(root, "src/lib/pvp-replay.ts"), "utf8");
const gameClient = fs.readFileSync(path.join(root, "src/app/play/GameClient.tsx"), "utf8");
const pvpTransport = fs.readFileSync(path.join(root, "src/app/play/hooks/usePvpTransport.ts"), "utf8");
const lifecycle = fs.readFileSync(path.join(root, "src/app/play/hooks/useMatchLifecycle.ts"), "utf8");
const battleView = fs.readFileSync(path.join(root, "src/app/play/BattleView.tsx"), "utf8");
const schema = fs.readFileSync(path.join(root, "src/db/schema/multiplayer.ts"), "utf8");
const migration = fs.readFileSync(path.join(root, "drizzle/0041_pvp_reaction_priority.sql"), "utf8");

if (!reducer.includes('if (opponentIsBot && s.phase === "blocking"')) {
  throw new Error("PvP attack must not auto-assign AI blockers when opponentIsBot=false.");
}
if (!pvpRoute.includes('applyAuthoritativePvpSnapshotAction')) {
  throw new Error("PvP server must route actions through the snapshot-authoritative transition.");
}
if (!transition.includes('applyGameAction(state, authorized, false)')) {
  throw new Error("PvP authoritative transition must retain the non-AI reducer path for actions without a reaction opportunity.");
}
if (!transition.includes('openPvpReactionPriority')) {
  throw new Error("PvP authoritative transition must open persistent priority before resolving reactable play/cast actions.");
}
if (!transition.includes('expireAuthoritativePvpSnapshotReaction')) {
  throw new Error("PvP authoritative transition must expose snapshot-safe timeout resolution.");
}
if (!priority.includes('resolvePvpReactionResponse') || !priority.includes('resolvePvpReactionPass')) {
  throw new Error("Persistent priority must share one explicit react/pass state machine.");
}
if (!priority.includes('canReactWithResponse')) {
  throw new Error("Exact PvP reaction payloads must be revalidated by the canonical reaction contract.");
}
if (!pvpRoute.includes('reactionState: transition.reactionState')) {
  throw new Error("PvP room updates must persist reaction state atomically with versioned authoritative state.");
}
if (!pvpRoute.includes('resolveExpiredReactionRoom')) {
  throw new Error("PvP polling must resolve expired priority under a server row lock.");
}
if (!pvpRoute.includes('publicRoom(updated, identity.playerId)')) {
  throw new Error("PvP responses must expose viewer-oriented state.");
}
if (!pvpRoute.includes('toPvpParticipantReactionState')) {
  throw new Error("PvP public DTO must orient persistent priority for host and guest participants.");
}
if (!schema.includes('reactionState: jsonb("reaction_state")') || !migration.includes('reaction_state')) {
  throw new Error("Persistent reaction priority must exist in both Drizzle schema and migration 0041.");
}
if (!settlement.includes('settledAt')) {
  throw new Error("PvP settlement must have an idempotency anchor.");
}
if (!settlement.includes('calculateAppliedMmrResult')) {
  throw new Error("Ranked PvP settlement must persist the applied/clamped authoritative MMR delta.");
}
if (!settlement.includes('replayPvpMatch')) {
  throw new Error("PvP settlement must verify the final replay before persistence.");
}
if (!reducer.includes("action.sentinelaTargets")) throw new Error("Attack reducer must preserve Sentinela targets for deterministic replays.");
if (!gameClient.includes("sentinelaTargets: Object.keys(sentinelaTargets).length")) throw new Error("Game client must include Sentinela targets in attack actions.");
if (!replay.includes('openPvpReactionPriority') || !replay.includes('resolvePvpReactionResponse') || !replay.includes('resolvePvpReactionPass')) {
  throw new Error("PvP replay verification must reproduce persistent reaction windows deterministically.");
}
if (!replay.includes('applyGameAction(state, action, false)')) {
  throw new Error("PvP replay verification must disable AI behavior for normal actions.");
}
if (!gameClient.includes('pvpRoomCode')) {
  throw new Error("Game client must support the authoritative PvP room mode.");
}
if (!pvpTransport.includes("classifyPvpPollFailure")) {
  throw new Error("PvP polling must classify terminal room/session failures explicitly.");
}
if (!pvpTransport.includes('credentials: "include"')) {
  throw new Error("PvP polling must explicitly preserve the stable player session.");
}
if (!pvpTransport.includes("if (failure.terminal) return")) {
  throw new Error("Terminal PvP polling failures must stop retrying without falling back to local play.");
}
if (!pvpTransport.includes('PVP_REACTION_ACTION_EVENT') || !pvpTransport.includes('publishPvpReactionState')) {
  throw new Error("PvP transport must synchronize reaction state and route reaction actions through the authoritative sender.");
}
if (!lifecycle.includes('requestPvpReactionAction({ type: "resolve" })')) {
  throw new Error("PvP reaction UI must use the historical resolve opcode as explicit priority pass.");
}
if (!battleView.includes('data-pvp-reaction-priority')) {
  throw new Error("Battlefield UI must expose and guard the persistent priority state.");
}
console.log("pvp engine regression: OK — persistent priority, reconnect, timeout, replay and UI contracts certified");
