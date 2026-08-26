import { readFileSync } from "node:fs";

function read(path: string) { return readFileSync(path, "utf8"); }
function assert(condition: unknown, message: string) { if (!condition) throw new Error(message); }

const admin = read("src/lib/admin-auth.ts");
const loginReward = read("src/app/api/login-reward/route.ts");
const matchmaking = read("src/app/api/matchmaking/route.ts");
const friends = read("src/app/api/friends/route.ts");

const requestSecurity = read("src/lib/request-security.ts");
assert(admin.includes("requestOriginAllowed(req)"), "Admin sessions must enforce the shared Origin guard");
assert(/const origin\s*=\s*request\.headers\.get\("origin"\)/.test(requestSecurity), "Origin guard must inspect the Origin header");
assert(/parsed\.host\s*===\s*host/.test(requestSecurity), "Origin host must match the trusted request host");
assert(requestSecurity.includes('process.env.TRUST_PROXY === "true"'), "Forwarded host/proto are trusted only behind an explicit proxy boundary");
assert(loginReward.includes("WHERE id = ${identity.playerId} FOR UPDATE"), "Login reward must lock by stable playerId");
assert(matchmaking.includes("where(eq(players.id, identity.playerId!))"), "Matchmaking must resolve the authenticated player by playerId");
assert(friends.includes("where(eq(players.id, identity.playerId!))"), "Friends must resolve the authenticated player by playerId");

console.log("security-audit-2.12: PASS");
