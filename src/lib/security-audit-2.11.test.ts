import { readFileSync } from "node:fs";

const files = [
  "src/app/api/collection/route.ts",
  "src/app/api/dailies/claim/route.ts",
  "src/app/api/login-reward/route.ts",
  "src/app/api/packs/route.ts",
  "src/app/api/player/update/route.ts",
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (!source.includes("requireStablePlayerIdentity") || !source.includes("eq(players.id, identity.playerId)")) {
    throw new Error(`Authenticated player lookup is not strictly ID-based in ${file}`);
  }
}

const reward = readFileSync("src/app/api/player/update/route.ts", "utf8");
if (!reward.includes("const [fresh] = await tx.select().from(players)")) throw new Error("Match reward does not refresh player state after the row lock");
if (!reward.includes("eq(matches.playerId, fresh.id)")) throw new Error("Match reward ownership is not post-lock playerId-based");
if (!reward.includes("match.playerId !== fresh.id")) throw new Error("Match reward ownership guard missing or based on stale player state");

const playerRoute = readFileSync("src/app/api/player/route.ts", "utf8");
if (!playerRoute.includes("where(eq(matches.playerId, player.id))")) throw new Error("Player stats are still name-based");
if (!playerRoute.includes("where(eq(customDecks.ownerPlayerId, player.id))")) throw new Error("Deck ownership stats are still name-based");

const admin = readFileSync("src/lib/admin-auth.ts", "utf8");
if (!admin.includes("from(adminUsers)") || !/eq\(adminUsers\.enabled,\s*true\)/.test(admin)) {
  throw new Error("Admin session does not resolve the current enabled user from the database");
}
if (!admin.includes("user.role as AdminRole")) throw new Error("Admin role is not resolved from the current user record");
if (admin.includes("roleAtLogin as AdminRole")) throw new Error("Admin role is still trusted from the session snapshot");

console.log("SECURITY AUDIT 2.11: PASS");
