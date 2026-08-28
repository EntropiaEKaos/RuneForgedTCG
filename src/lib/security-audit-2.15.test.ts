import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(p: string) { return fs.readFileSync(path.join(root, p), "utf8"); }

const cards = read("src/app/api/admin/cards/route.ts");
const settings = read("src/app/api/admin/settings/route.ts");
const generic = read("src/app/api/admin/studio/[resource]/route.ts");
const genericId = read("src/app/api/admin/studio/[resource]/[id]/route.ts");
const adminAuth = read("src/lib/admin-auth.ts");
const playerSession = read("src/lib/player-session.ts");

if (!cards.includes('adminRoleAllowed(actor.role, ["designer", "qa", "publisher"])')) throw new Error("Card catalog GET missing read RBAC");
if (!settings.includes('adminRoleAllowed(actor.role, "liveops")')) throw new Error("Game settings GET missing liveops RBAC");
if (!generic.includes('resource === "players" && !adminRoleAllowed(actor.role, "admin")')) throw new Error("Player profile GET missing admin-only guard");
if (!genericId.includes('resource === "players" && !adminRoleAllowed(actor.role, "admin")')) throw new Error("Player profile PATCH missing admin-only guard");
if (!genericId.includes('economyReason is required')) throw new Error("Admin economy mutation missing reason requirement");
if (!adminAuth.includes("revokedAt") || !adminAuth.includes("expiresAt")) throw new Error("Admin session revocation/expiry missing");
if (!playerSession.includes("playerSessions.sessionId") || !playerSession.includes("playerSessions.playerId")) throw new Error("Player session ownership binding missing");

console.log("SECURITY AUDIT 2.15: PASS");
