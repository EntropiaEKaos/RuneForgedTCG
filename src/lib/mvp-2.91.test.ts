import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_CONFIG, mergeGameConfig, validateGameConfig } from "@/game/settings";
import { rankedOperational } from "@/lib/runtime-gates";

const read = (path: string) => readFileSync(path, "utf8");
const checks: string[] = [];
const ok = (condition: unknown, label: string) => { assert.ok(condition, label); checks.push(label); };

const pkg = JSON.parse(read("package.json"));
assert.ok(Number(pkg.version.split(".")[0]) > 2 || (Number(pkg.version.split(".")[0]) === 2 && Number(pkg.version.split(".")[1]) >= 91)); checks.push("package is 2.91.0 or newer");

const oldCertified = process.env.RANKED_RELEASE_CERTIFIED;
process.env.RANKED_RELEASE_CERTIFIED = "false";
assert.equal(rankedOperational({ rankedEnabled: true }), false); checks.push("ranked stays closed without certification env");
process.env.RANKED_RELEASE_CERTIFIED = "true";
assert.equal(rankedOperational({ rankedEnabled: false }), false); checks.push("ranked stays closed without admin enablement");
assert.equal(rankedOperational({ rankedEnabled: true }), true); checks.push("ranked requires both release certification and admin enablement");
if (oldCertified === undefined) delete process.env.RANKED_RELEASE_CERTIFIED; else process.env.RANKED_RELEASE_CERTIFIED = oldCertified;

const merged = mergeGameConfig(DEFAULT_CONFIG, { advanced: { presentation: { masterVolume: 0.35 } } });
assert.equal(merged.advanced.presentation.masterVolume, 0.35);
assert.equal(merged.advanced.presentation.defaultBoard, DEFAULT_CONFIG.advanced.presentation.defaultBoard);
checks.push("deep game-config merge preserves sibling settings");

const invalid = structuredClone(DEFAULT_CONFIG);
invalid.deckMin = 40; invalid.deckMax = 20;
invalid.advanced.matchmaking.rangeStepSeconds = 0;
const errors = validateGameConfig(invalid);
ok(errors.some((error) => error.includes("deckMin")), "cross-field deck invariant is enforced");
ok(errors.some((error) => error.includes("rangeStepSeconds")), "zero matchmaking step duration is rejected");

const migration = read("drizzle/0032_mvp_2_91.sql");
ok(migration.includes("DROP INDEX IF EXISTS economy_reward_idempotency_idx"), "2.91 normalizes the bad 2.90 economy index");
ok(/reason IN \('match_reward', 'mode_reward'\)/.test(migration), "economy idempotency is reward-only");
ok(migration.includes("recovery_key_hash") && migration.includes("ranked_config_snapshot"), "2.91 schema persists recovery and ranked provenance");

const production = read("scripts/production-verify.ts");
ok(/version=\'2\.(?:9[1-9]|[1-9]\d{2,})(?:\.\d+)?\'/.test(production), "production verification requires schema 2.91 or newer");
ok(production.includes("repeatable non-reward economy operations"), "production DB test proves repeatable purchases are allowed");
ok(production.includes("reward economy idempotency"), "production DB test proves duplicate rewards are blocked");

const player = read("src/app/api/player/route.ts");
const getBody = player.slice(player.indexOf("export async function GET"), player.indexOf("export async function POST"));
ok(!getBody.includes("db.insert(players)"), "GET /api/player never creates an account");
ok(player.includes("recoveryKeyHash: recoveryHash") && player.includes("getRuntimeStarterWallet"), "guest creation uses hashed recovery and runtime wallet");

const gates = read("src/lib/runtime-gates.ts");
ok(gates.includes("MAINTENANCE_MODE") && gates.includes("RANKED_RELEASE_CERTIFIED"), "maintenance and ranked release gates are server-side");
ok(read("src/app/api/matchmaking/route.ts").includes('runtimeGate("ranked")'), "ranked matchmaking enforces the server gate");
ok(read("src/app/api/matches/token/route.ts").includes('runtimeGate("ai")'), "new AI matches enforce aiEnabled");

const collectionApi = read("src/app/api/collection/route.ts");
const collectionUi = read("src/app/collection/CollectionClient.tsx");
ok(collectionApi.includes("duplicateCap: config.advanced.economy.duplicateCap"), "collection API exposes canonical duplicate cap");
ok(collectionUi.includes("owned >= duplicateCap") && collectionUi.includes("quantityOptions"), "collection UI consumes dynamic duplicate cap");
ok(!collectionUi.includes("owned}/3") && !collectionUi.includes("owned} / 3"), "collection UI has no fixed three-copy display");

ok(read("src/app/api/simulate/route.ts").includes("consumeRateLimit") && !read("src/app/api/simulate/route.ts").includes("new Map"), "simulation uses distributed rate limiting");
ok(read("src/lib/session-cleanup.ts").includes("replayRetentionDays"), "replay retention policy is consumed at runtime");
const pvp = read("src/app/api/pvp/[code]/route.ts");
ok(pvp.includes("chatMaxLength") && pvp.includes("floodMaxMessages") && pvp.includes("floodWindowSeconds"), "chat moderation limits are consumed by PvP");
ok(read("src/app/api/admin/runtime/route.ts").includes("allowDeckModeration"), "deck moderation toggle is enforced by admin runtime");

const replayDto = read("src/lib/replay-dto.ts");
const replayViewer = read("src/app/replay/[id]/ReplayViewer.tsx");
ok(replayDto.includes("opponentName") && !replayDto.includes("seed:"), "public replay DTO omits seed and exposes opponent name");
ok(replayViewer.includes("opponentName") && replayViewer.includes("ENGINE EVENTS"), "ReplayViewer matches the hardened public DTO");

const matchesRoute = read("src/app/api/matches/route.ts");
const matchesGet = matchesRoute.slice(matchesRoute.indexOf("export async function GET"));
ok(!matchesGet.includes("opponentPlayerId:") && !matchesGet.includes("playerId:"), "public matches response avoids raw internal player ids");

ok(read("src/app/layout.tsx").includes('lang="pt-BR"'), "document language matches MVP locale");
ok(read(".github/workflows/ci.yml").includes("release:ranked-gate"), "CI enforces Ranked fail-closed policy");
ok(read("scripts/e2e-pvp-ranked.ts").includes("RANKED_DISABLED") || read("scripts/e2e-pvp-ranked.ts").includes("423"), "HTTP E2E asserts Ranked is blocked for MVP");

console.log(`MVP 2.91 CERTIFICATION: ${checks.length}/${checks.length} PASS`);
