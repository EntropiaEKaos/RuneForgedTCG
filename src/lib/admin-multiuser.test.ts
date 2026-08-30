import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  hashAdminPassword,
  totpCode,
  verifyAdminPassword,
  verifyTotp,
} from "./admin-credentials";
import { canAccessStudioAuthoring, studioLandingForRole } from "./admin-studio-access";

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

console.log("ADMIN MULTIUSER/MFA: PASS — credentials, MFA and Studio authoring role boundary certified");
