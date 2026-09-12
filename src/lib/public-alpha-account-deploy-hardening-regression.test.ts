import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const client = read("src/lib/client-player-session.ts");
const route = read("src/app/api/player/route.ts");
const profile = read("src/app/profile/ProfileClient.tsx");
const layout = read("src/app/layout.tsx");
const notice = read("src/components/RecoveryKeyNotice.tsx");
const provenance = read("src/lib/deployment-provenance.ts");
const nextConfig = read("next.config.ts");
const netlify = read("netlify.toml");
const e2e = read("scripts/e2e-pvp-ranked.ts");
const alpha = read("scripts/alpha-player-journey.ts");

// Recovery secrets must never return to persistent Web Storage.
assert.doesNotMatch(client, /runeforge_recovery_code/i);
assert.doesNotMatch(client, /storedRecoveryCode/);
assert.doesNotMatch(client, /localStorage\.(?:setItem|getItem)\([^\n]*recovery/i);
assert.match(client, /LEGACY_RECOVERY_KEY/);
assert.match(client, /localStorage\.removeItem\(LEGACY_RECOVERY_KEY\)/);
assert.match(client, /PLAYER_RECOVERY_KEY_EVENT/);
assert.match(client, /consumePendingRecoveryCode/);
assert.match(client, /recoverPlayerSession/);
assert.match(client, /created\.response\.status === 409/);
assert.match(client, /publishRecoveryCode\(created\.payload\.recoveryCode\)/);

// A one-time handoff is globally visible and offers export outside the browser.
assert.match(layout, /RecoveryKeyNotice/);
assert.match(notice, /consumePendingRecoveryCode/);
assert.match(notice, /navigator\.clipboard\.writeText/);
assert.match(notice, /runeforge-recovery-key\.txt/);
assert.match(notice, /URL\.createObjectURL/);

// Explicit recovery must run before ordinary current-session mutations so a
// temporary guest can be replaced by the original account.
const recoveryIndex = route.indexOf("const recoveryCode =");
const currentIndex = route.indexOf("const current = await getPlayerSession");
assert.ok(recoveryIndex >= 0 && currentIndex > recoveryIndex, "recovery must precede current-session mutation handling");
assert.match(route, /await clearPlayerSession\(\);[\s\S]*await setPlayerSessionCookie\(rotated\.token\)/);
assert.match(profile, /recoverPlayerSession/);
assert.match(profile, /profile-recovery-key/);
assert.match(profile, /RECUPERAR CONTA/);
assert.doesNotMatch(profile, /storedRecoveryCode/);

// Runtime provenance can use non-secret identity embedded during the certified build.
assert.match(provenance, /RUNEFORGE_BUILD_SHA/);
assert.match(provenance, /RUNEFORGE_BUILD_ENV/);
assert.match(nextConfig, /process\.env\.COMMIT_REF/);
assert.match(nextConfig, /RUNEFORGE_BUILD_SHA/);
assert.match(nextConfig, /RUNEFORGE_BUILD_ENV/);

// Netlify must never bypass the canonical production gate.
assert.match(netlify, /RUNEFORGE_DEPLOY_SHA=\$COMMIT_REF npm run production:verify/);
assert.doesNotMatch(netlify, /command\s*=\s*"npm run build"/);
assert.match(netlify, /\[context\.production\.environment\]/);
assert.match(netlify, /RUNEFORGE_DEPLOY_ENV = "production"/);
assert.match(netlify, /\[context\.deploy-preview\.environment\]/);
assert.match(netlify, /\[context\.branch-deploy\.environment\]/);

// E2E/RC evidence must prove recovery over an already-authenticated temporary identity.
assert.match(e2e, /E2E Recovery Temp/);
assert.match(e2e, /explicit recovery must replace an already-authenticated temporary session/);
assert.match(alpha, /temporary recovery account failed/);
assert.match(alpha, /recovery test must begin on a different authenticated player/);

console.log("PUBLIC ALPHA ACCOUNT/DEPLOY HARDENING: PASS — one-time recovery keys + explicit session migration + certified Netlify gate");
