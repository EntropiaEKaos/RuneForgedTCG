/** Static regressions for the human-vs-human authoritative path. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const reducer = fs.readFileSync(path.join(root, "src/game/reducer.ts"), "utf8");
const pvpRoute = fs.readFileSync(path.join(root, "src/app/api/pvp/[code]/route.ts"), "utf8");
const settlement = fs.readFileSync(path.join(root, "src/lib/pvp-settlement.ts"), "utf8");
const transition = fs.readFileSync(path.join(root, "src/lib/pvp-authoritative-transition.ts"), "utf8");
const replay = fs.readFileSync(path.join(root, "src/lib/pvp-replay.ts"), "utf8");
const gameClient = fs.readFileSync(path.join(root, "src/app/play/GameClient.tsx"), "utf8");
const pvpTransport = fs.readFileSync(path.join(root, "src/app/play/hooks/usePvpTransport.ts"), "utf8");

if (!reducer.includes('if (opponentIsBot && s.phase === "blocking"')) {
  throw new Error("PvP attack must not auto-assign AI blockers when opponentIsBot=false.");
}
if (!pvpRoute.includes('applyAuthoritativePvpSnapshotAction')) {
  throw new Error("PvP server must route actions through the snapshot-authoritative transition.");
}
if (!transition.includes('applyGameAction(state, authorized, false)')) {
  throw new Error("PvP authoritative transition must execute actions through the non-AI reducer path.");
}
if (!pvpRoute.includes('publicRoom(updated, identity.playerId)')) {
  throw new Error("PvP responses must expose viewer-oriented state.");
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
if (!replay.includes('applyGameAction(state, action, false)')) {
  throw new Error("PvP replay verification must disable AI behavior.");
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
console.log("pvp engine regression: OK");
