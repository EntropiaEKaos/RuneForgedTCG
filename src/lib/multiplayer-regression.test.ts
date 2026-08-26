/** Static multiplayer invariants that do not require a live database. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matchmaking = fs.readFileSync(path.join(root, "src/app/api/matchmaking/route.ts"), "utf8");
const pvp = fs.readFileSync(path.join(root, "src/app/api/pvp/[code]/route.ts"), "utf8");

// Checks the bidirectional-inequality shape (`matchmakingQueue.playerId <> <anything>.id`)
// rather than one exact variable name, so a harmless rename (e.g. `player`
// -> `lockedPlayer` when row locking was added) doesn't false-positive this
// check. A directional `<` filter (only lower-id opponents) is still caught
// explicitly below.
if (!/matchmakingQueue\.playerId\}\s*<>\s*\$\{\w+(\.\w+)*\.id\}/.test(matchmaking)) {
  throw new Error("Matchmaking must consider both higher- and lower-ID opponents.");
}
if (/matchmakingQueue\.playerId\}\s*<\s*\$\{\w+(\.\w+)*\.id\}/.test(matchmaking)) {
  throw new Error("Directional playerId matchmaking filter regressed.");
}
if (!pvp.includes('room: publicRoom(updated, identity.playerId)')) {
  throw new Error("PvP join must return a viewer-masked room state.");
}
if (pvp.includes('if (action === "leave") {\n      await db.delete(pvpRooms)')) {
  throw new Error("PvP leave must not blindly delete active rooms.");
}
if (!pvp.includes('Only the host can cancel a waiting room')) {
  throw new Error("Waiting-room cancellation must be host-only.");
}
if (!pvp.includes('forfeited: true')) {
  throw new Error("Active PvP leave must become an authoritative forfeit.");
}
console.log("multiplayer regression: OK");
