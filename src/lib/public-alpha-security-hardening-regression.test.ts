import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const client = read("src/lib/client-player-session.ts");
const memory = read("src/lib/recovery-key-memory.ts");
const notice = read("src/components/RecoveryKeyNotice.tsx");
const recover = read("src/app/recover/RecoverAccountClient.tsx");
const profile = read("src/app/profile/ProfileClient.tsx");
const layout = read("src/app/layout.tsx");
const playerRoute = read("src/app/api/player/route.ts");
const netlify = read("netlify.toml");
const netlifyGate = read("scripts/netlify-certified-build.mjs");
const pkg = JSON.parse(read("package.json"));
const alphaVisual = read("scripts/alpha-visual-journey.mjs");
const alphaJourney = read("scripts/alpha-player-journey.ts");
const alphaRc = read(".github/workflows/alpha-release-candidate.yml");

// Recovery credentials are never persisted in browser storage.
assert.doesNotMatch(client, /localStorage\.setItem\([^\n]*recovery/i);
assert.equal((client.match(/localStorage\.getItem\(LEGACY_RECOVERY_KEY\)/g) || []).length, 1, "legacy recovery storage may only be read once by the migration path");
assert.match(client, /takeLegacyRecoveryCode/);
assert.match(client, /localStorage\.removeItem\(LEGACY_RECOVERY_KEY\)/);
assert.match(client, /if \(legacyRecoveryCode\) \{[\s\S]*body: JSON\.stringify\(\{ recoveryCode: legacyRecoveryCode \}\)/);
assert.doesNotMatch(client, /storedRecoveryCode/);
assert.match(client, /publishPendingRecoveryKey\(payload\.recoveryCode\)/);
assert.match(client, /recoverPlayerSession/);
assert.match(memory, /let pendingRecoveryKey: string \| null = null/);
assert.doesNotMatch(memory, /localStorage|sessionStorage|indexedDB/i);

// A newly issued key is made visible, but the user must save it explicitly.
assert.match(layout, /RecoveryKeyNotice/);
assert.match(notice, /data-recovery-key-notice="true"/);
assert.match(notice, /Esta chave não será salva neste navegador/);
assert.match(notice, /JÁ SALVEI/);
assert.match(profile, /Chave de recuperação não persistida/);
assert.doesNotMatch(profile, /storedRecoveryCode/);
assert.match(recover, /recoverPlayerSession/);
assert.match(recover, /A sessão atual só é substituída depois que a chave é validada/);
assert.match(recover, /data-recovered-replacement-key="true"/);

// Server recovery is evaluated before the normal current-session branch.
// Recovery rotation, target-session revocation, current-session revocation and
// replacement-session insertion are one durable database transaction.
const recoveryIndex = playerRoute.indexOf('const recoveryCode = typeof body.recoveryCode');
const currentBranchIndex = playerRoute.indexOf('if (current) {', recoveryIndex);
assert.ok(recoveryIndex >= 0 && currentBranchIndex > recoveryIndex, "recovery credential must be evaluated before the ordinary current-session branch");
assert.match(playerRoute, /if \(!rotated\) return Response\.json/);
assert.match(playerRoute, /const currentSessionId = current \? playerSessionIdFromRequest\(req\) : null/);
assert.match(playerRoute, /if \(currentSessionId\) \{[\s\S]*tx\.update\(playerSessions\)[\s\S]*eq\(playerSessions\.sessionId, currentSessionId\)/);
assert.match(playerRoute, /tx\.insert\(playerSessions\)\.values\(\{ sessionId: prepared\.sessionId/);
assert.match(playerRoute, /if \(!rotated\) return Response\.json[\s\S]*await setPlayerSessionCookie\(rotated\.token\)/);

// Browser and Alpha journey evidence cover the new lifecycle.
assert.match(alphaVisual, /runeforge_recovery_code/);
assert.match(alphaVisual, /data-recovery-key-notice/);
assert.match(alphaVisual, /JÁ SALVEI/);
assert.match(alphaVisual, /\/recover/);
assert.match(alphaJourney, /invalid recovery key must not replace the current session/);
assert.match(alphaJourney, /valid recovery key must replace the temporary current session/);

// Netlify can no longer call next build directly.
assert.match(netlify, /npm run deploy:netlify:certified/);
assert.doesNotMatch(netlify, /command\s*=\s*"npm run build"/);
assert.equal(pkg.scripts["deploy:netlify:certified"], "node scripts/netlify-certified-build.mjs");
assert.match(netlifyGate, /RUNEFORGE_NETLIFY_CERTIFIED/);
assert.match(netlifyGate, /COMMIT_REF/);
assert.match(netlifyGate, /RUNEFORGE_DEPLOY_SHA/);
assert.match(netlifyGate, /npm", \["run", "production:verify"\]/);
assert.match(alphaRc, /"netlify\.toml"/);

console.log("PUBLIC ALPHA SECURITY HARDENING SOURCE CONTRACT: PASS");
