import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  hashAdminPassword,
  totpCode,
  verifyAdminPassword,
  verifyTotp,
} from "./admin-credentials";
import { canAccessStudioAuthoring, hasStudioUiCapability, studioLandingForRole } from "./admin-studio-access";

process.env.MFA_ENCRYPTION_KEY = "runeforge-test-only-mfa-key-material-2.56";
const password = hashAdminPassword("a-very-strong-password");
if (!verifyAdminPassword("a-very-strong-password", password.salt, password.hash)
  || verifyAdminPassword("wrong", password.salt, password.hash)) throw new Error("password hashing failed");
const secret = generateMfaSecret();
const encrypted = encryptMfaSecret(secret);
if (encrypted === secret || decryptMfaSecret(encrypted) !== secret) throw new Error("MFA encryption failed");
const code = totpCode(secret);
if (!verifyTotp(secret, code)) throw new Error("TOTP failed");

if (!canAccessStudioAuthoring("admin")) throw new Error("admin must access Studio authoring");
if (!canAccessStudioAuthoring("designer")) throw new Error("designer must access Studio authoring");
for (const role of ["qa", "publisher", "liveops"] as const) {
  if (canAccessStudioAuthoring(role)) throw new Error(`${role} must not access Studio authoring`);
}
if (studioLandingForRole("qa") !== "/admin/studio/production") throw new Error("QA landing must be Production Studio");
if (studioLandingForRole("publisher") !== "/admin/studio/production") throw new Error("publisher landing must be Production Studio");
if (studioLandingForRole("liveops") !== "/admin/studio/ops") throw new Error("liveops landing must be Live Ops");

for (const capability of ["authoring", "delete", "production", "liveops", "players", "operations", "operators", "control", "payments", "runtime", "balance", "qa-tools", "brawl"] as const) {
  if (!hasStudioUiCapability("admin", capability)) throw new Error(`admin must retain ${capability} UI capability`);
}
if (!hasStudioUiCapability("designer", "authoring")) throw new Error("designer must retain authoring UI capability");
for (const capability of ["delete", "production", "liveops", "players", "operations", "operators", "control", "payments", "runtime", "balance", "qa-tools", "brawl"] as const) {
  if (hasStudioUiCapability("designer", capability)) throw new Error(`designer must not expose ${capability} UI capability`);
}
if (!hasStudioUiCapability("qa", "production") || !hasStudioUiCapability("qa", "balance") || hasStudioUiCapability("qa", "authoring")) throw new Error("QA UI capability matrix is invalid");
if (!hasStudioUiCapability("publisher", "production") || hasStudioUiCapability("publisher", "balance")) throw new Error("publisher UI capability matrix is invalid");
if (!hasStudioUiCapability("liveops", "liveops") || hasStudioUiCapability("liveops", "authoring")) throw new Error("liveops UI capability matrix is invalid");

console.log("ADMIN MULTIUSER/MFA: PASS — credentials, MFA, Studio authoring boundary and role-aware UI capabilities certified");
