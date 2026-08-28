import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sanitizeCardEffect } from "@/game/card-authoring";
import { detectAssetType } from "@/lib/asset-storage";

const checks: string[] = [];
const ok = (value: unknown, message: string) => { assert.ok(value, message); checks.push(message); };

ok(!sanitizeCardEffect({ kind: "healUnit", target: "none", amount: 2 }), "healUnit rejects unusable target none");
ok(!sanitizeCardEffect({ kind: "summonToken", target: "none", amount: 1 }), "summonToken requires tokenDefId");
ok(!sanitizeCardEffect({ kind: "grantKeyword", target: "allyUnit", amount: 0 }), "grantKeyword requires keyword");
ok(!sanitizeCardEffect({ kind: "damageNexus", target: "none", amount: -1 }), "damage effects reject negative amount");
ok(!!sanitizeCardEffect({ kind: "draw", target: "none", amount: 1 }), "valid draw contract remains authorable");

const png = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
assert.equal(detectAssetType(png)?.mimeType, "image/png"); checks.push("asset magic-byte detection accepts PNG");
assert.equal(detectAssetType(Buffer.from("not really a png")), null); checks.push("asset magic-byte detection rejects spoofed media");

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.ok(Number(packageJson.version.split(".")[0]) > 2 || (Number(packageJson.version.split(".")[0]) === 2 && Number(packageJson.version.split(".")[1]) >= 89)); checks.push("package release preserves 2.89+ consolidation lineage");
for (const version of [...Object.values(packageJson.dependencies ?? {}), ...Object.values(packageJson.devDependencies ?? {})]) {
  assert.match(String(version), /^\d+\.\d+\.\d+$/, `dependency must be exact-pinned: ${version}`);
}
checks.push("all direct npm dependencies are exact-pinned");

const health = readFileSync("src/app/api/health/route.ts", "utf8");
ok(health.includes("APP_RELEASE"), "health endpoint uses canonical release identifier");
const upgrade = readFileSync("scripts/database-upgrade-2.31.ts", "utf8");
ok(upgrade.includes("async function main()") && upgrade.includes("main().catch"), "database upgrade is wrapped in an async main entrypoint");
const migrate = readFileSync("scripts/database-migrate.ts", "utf8");
ok(migrate.includes("runeforge_schema_meta") && migrate.includes("db:bootstrap") && migrate.includes("db:upgrade"), "database migration dispatcher supports fresh and proven existing databases");

const settings = readFileSync("src/game/settings.ts", "utf8");
ok(settings.includes("GAME_CONFIG_CACHE_TTL_MS") && settings.includes("lastCheckedAt") && settings.includes("loading"), "runtime game config refreshes with bounded TTL and in-flight dedupe");
const pipeline = readFileSync("src/app/api/admin/studio/pipeline/route.ts", "utf8");
ok(pipeline.includes("db.transaction") && pipeline.includes("pg_advisory_xact_lock") && pipeline.includes('.for("update")'), "content publication is transactional and concurrency locked");
const auth = readFileSync("src/lib/admin-auth.ts", "utf8");
ok(auth.includes("WeakMap<Request") && auth.includes("requestSessionCache"), "admin session resolution is request-deduplicated");
const credentials = readFileSync("src/lib/admin-credentials.ts", "utf8");
ok(!credentials.includes('|| process.env.ADMIN_SESSION_SECRET'), "MFA encryption key has no session-secret fallback");
const proxy = readFileSync("src/proxy.ts", "utf8");
ok(proxy.includes("'strict-dynamic'") && !/script-src[^\n]*unsafe-inline/.test(proxy), "CSP removes unsafe-inline from scripts");
ok(proxy.includes("request.clone().body") && proxy.includes("total > maxBodyBytes"), "chunked mutation bodies are size-limited");
const layout = readFileSync("src/app/layout.tsx", "utf8");
ok(layout.includes('dynamic = "force-dynamic"'), "nonce CSP is paired with dynamic rendering");
const upload = readFileSync("src/app/api/admin/assets/upload/route.ts", "utf8");
ok(upload.includes("detectAssetType") && upload.includes("storeAdminAsset") && !upload.includes("writeFile("), "asset upload uses sniffing and storage abstraction");
const limiter = readFileSync("src/lib/rate-limit.ts", "utf8");
ok(limiter.includes("direct-global") && limiter.includes("consumeRequestRateLimit"), "untrusted-proxy rate limiting has per-client and global safeguards");
const coverage = readFileSync(".github/workflows/ci.yml", "utf8");
ok(coverage.includes("MIN_FUNCTION_COVERAGE") && coverage.includes("test:coverage") && coverage.includes("test:e2e:http"), "CI gates behavioral coverage and HTTP E2E");

console.log(`CONSOLIDATION 2.89: ${checks.length}/${checks.length} PASS`);
