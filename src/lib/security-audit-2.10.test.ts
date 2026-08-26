import fs from "node:fs";

const read = (p: string) => fs.readFileSync(p, "utf8");
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const playerSession = read("src/lib/player-session.ts");
assert(playerSession.includes('process.env.NODE_ENV !== "production" && process.env.ALLOW_LEGACY_PLAYER_IDENTITY === "true"'), "legacy player identity must never be enabled in production");

const settings = read("src/app/api/admin/settings/route.ts");
assert(settings.includes('adminRoleAllowed(actor.role, "liveops")'), "game settings mutation must be Live Ops/admin only");

const exportRoute = read("src/app/api/admin/studio/export/route.ts");
assert(exportRoute.includes('adminRoleAllowed(actor.role,"admin")'), "content export must be admin-only");

const auditRoute = read("src/app/api/admin/studio/audit/route.ts");
assert(auditRoute.includes('adminRoleAllowed(actor.role,"admin")'), "audit log must be admin-only");

const studio = read("src/app/api/admin/studio/[resource]/route.ts");
assert(studio.includes('resource === "players" && !adminRoleAllowed(actor.role, "admin")'), "player profiles must be admin-only in generic studio listing");

const playerPatch = read("src/app/api/admin/studio/[resource]/[id]/route.ts");
assert(playerPatch.includes("economyReason is required for admin balance changes"), "admin balance changes require an explicit reason");
assert(playerPatch.includes("recordEconomyTransaction"), "admin balance changes must enter the economy ledger");
assert(playerPatch.includes("levelFromXp"), "admin XP changes must keep level derived consistently");

const login = read("src/app/api/admin/login/route.ts");
assert(login.includes("consumeRequestRateLimit") || login.includes("consumeRateLimit"), "admin login attempts must use the distributed rate limiter");
const rateLimit = read("src/lib/rate-limit.ts");
assert(rateLimit.includes("api_rate_limits") && rateLimit.includes("ON CONFLICT"), "distributed rate limiter must increment atomically in PostgreSQL");

const ruleTest = read("src/app/api/admin/studio/rule-test/route.ts");
assert(ruleTest.includes("adminRoleAllowed"), "rule test must have role-based authorization");
const validate = read("src/app/api/admin/studio/validate/route.ts");
assert(validate.includes("adminRoleAllowed"), "content validation endpoint must have role-based authorization");

console.log("SECURITY AUDIT 2.10 REGRESSION: PASS");
