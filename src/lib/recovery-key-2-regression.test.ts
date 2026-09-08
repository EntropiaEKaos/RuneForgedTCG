import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const client = read("src/lib/client-player-session.ts");
const playerRoute = read("src/app/api/player/route.ts");
const profile = read("src/app/profile/ProfileClient.tsx");
const alphaJourney = read("scripts/alpha-player-journey.ts");
const pvpE2e = read("scripts/e2e-pvp-ranked.ts");

assert.doesNotMatch(
  client,
  /localStorage\.setItem\((?:RECOVERY_KEY|LEGACY_RECOVERY_KEY)/,
  "Recovery Key 2.0 must never persist newly issued recovery secrets in localStorage",
);
assert.doesNotMatch(client, /storedRecoveryCode/);
assert.match(client, /legacyRecoveryCodeAvailable/);
assert.match(client, /migrateLegacyRecoveryCode/);
assert.match(client, /recoverPlayerSession/);
assert.match(client, /discardLegacyRecoveryCode/);
assert.match(client, /Deliberately do not persist payload\.recoveryCode/);

const recoveryBranch = playerRoute.indexOf('const recoveryCode = typeof body.recoveryCode');
const currentSessionBranch = playerRoute.indexOf("const current = await getPlayerSession(req)");
assert.ok(recoveryBranch >= 0 && currentSessionBranch > recoveryBranch, "explicit recovery must be processed before an existing temporary session");

const creationStart = playerRoute.indexOf("const requestedName = safeDisplayName");
const creationEnd = playerRoute.indexOf("return Response.json({ ...(await profilePayload(player)), created: true");
assert.ok(creationStart >= 0 && creationEnd > creationStart);
const creation = playerRoute.slice(creationStart, creationEnd);
assert.doesNotMatch(creation, /issuedRecoveryCode|recoveryKeyHash|recoveryKeyExpiresAt/);
assert.match(playerRoute, /recoveryConfigured/);
assert.match(playerRoute, /rotateRecoveryCode === true/);
assert.match(playerRoute, /recoveryKeyHash: recoveryHash\(issuedRecoveryCode\)/);
assert.match(playerRoute, /recoveryRotated: true/);

assert.doesNotMatch(profile, /storedRecoveryCode/);
assert.match(profile, /RECOVERY KEY 2\.0/);
assert.match(profile, /legacyRecoveryCodeAvailable/);
assert.match(profile, /migrateLegacyRecoveryCode/);
assert.match(profile, /recoverPlayerSession/);
assert.match(profile, /BAIXAR/);
assert.match(profile, /ela não será armazenada automaticamente no navegador/);
assert.match(profile, /Conta recuperada\. A chave usada foi rotacionada/);

assert.match(alphaJourney, /new accounts must not silently issue a recovery secret/);
assert.match(alphaJourney, /rotateRecoveryCode: true/);
assert.match(alphaJourney, /a recovery key must be single-use after successful recovery rotation/);
assert.match(pvpE2e, /new E2E account must not silently issue a recovery key/);
assert.match(pvpE2e, /rotateRecoveryCode: true/);
assert.doesNotMatch(pvpE2e, /assert\.match\(String\(result\.body\.recoveryCode/);

console.log("RECOVERY KEY 2.0 SOURCE CONTRACT: PASS — explicit issuance · no localStorage persistence · legacy migration · single-use recovery rotation");
