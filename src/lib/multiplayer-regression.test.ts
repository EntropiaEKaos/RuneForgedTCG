/** Static multiplayer invariants that do not require a live database. */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const matchmaking = fs.readFileSync(path.join(root, "src/app/api/matchmaking/route.ts"), "utf8");
const pvp = fs.readFileSync(path.join(root, "src/app/api/pvp/[code]/route.ts"), "utf8");
const commander = fs.readFileSync(path.join(root, "src/app/api/commander/route.ts"), "utf8");
const commanderRules = fs.readFileSync(path.join(root, "src/lib/commander-alpha.ts"), "utf8");
const multiplayerSchema = fs.readFileSync(path.join(root, "src/db/schema/multiplayer.ts"), "utf8");

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
if (!multiplayerSchema.includes('commanderRooms') || !multiplayerSchema.includes('commanderRoomPlayers')) throw new Error("Commander Alpha must use dedicated persisted room/seat tables.");
if (!commanderRules.includes('deckSize: 60') || !commanderRules.includes('generalCount: 1') || !commanderRules.includes('players: 4')) throw new Error("Commander Alpha must preserve the 60+1 / four-human contract.");
if (!commanderRules.includes('maxCopiesPerCard: 3')) throw new Error("Commander Alpha must enforce its explicit copy ceiling.");
if (!commander.includes('nextCommanderSeat') || !commander.includes('currentSeat')) throw new Error("Commander Alpha must rotate authoritative turns across active seats.");
if (!commander.includes('remaining.length === 1') || !commander.includes('winnerPlayerId')) throw new Error("Commander Alpha must finish when one active human remains.");
if (pvp.includes('commanderRooms') || matchmaking.includes('commanderRooms')) throw new Error("Commander Alpha must not be injected into the certified 1v1 PvP path.");
console.log("multiplayer regression: OK");
