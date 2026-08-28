import assert from "node:assert/strict";
import { createPlayerSessionToken, verifyPlayerSessionToken } from "./player-session-token";
import { generateMfaSecret, hashAdminPassword, totpCode, verifyAdminPassword, verifyTotp } from "./admin-credentials";

process.env.PLAYER_SESSION_SECRET = "test-player-secret";
process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.ADMIN_SESSION_SECRET = "test-admin-secret";

const playerToken = createPlayerSessionToken(42, "Tester");
assert.deepEqual(verifyPlayerSessionToken(playerToken), { playerId: 42, playerName: "Tester" });
assert.equal(verifyPlayerSessionToken(`${playerToken}tampered`), null);

const credentials = hashAdminPassword("correct horse battery staple", "fixed-test-salt");
assert.equal(verifyAdminPassword("correct horse battery staple", credentials.salt, credentials.hash), true);
assert.equal(verifyAdminPassword("wrong password", credentials.salt, credentials.hash), false);

const mfaSecret = generateMfaSecret();
const timestamp = 1_700_000_000_000;
const code = totpCode(mfaSecret, timestamp);
assert.equal(verifyTotp(mfaSecret, code, timestamp), true);
assert.equal(verifyTotp(mfaSecret, "000000", timestamp), code === "000000");

console.log("security tests: OK");
