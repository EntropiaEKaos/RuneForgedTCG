import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaSecret,
  hashAdminPassword,
  totpCode,
  verifyAdminPassword,
  verifyTotp,
} from "./admin-credentials";

process.env.MFA_ENCRYPTION_KEY = "runeforge-test-only-mfa-key-material-2.56";
const password = hashAdminPassword("a-very-strong-password");
if (!verifyAdminPassword("a-very-strong-password", password.salt, password.hash)
  || verifyAdminPassword("wrong", password.salt, password.hash)) throw new Error("password hashing failed");
const secret = generateMfaSecret();
const encrypted = encryptMfaSecret(secret);
if (encrypted === secret || decryptMfaSecret(encrypted) !== secret) throw new Error("MFA encryption failed");
const code = totpCode(secret);
if (!verifyTotp(secret, code)) throw new Error("TOTP failed");
console.log("ADMIN MULTIUSER/MFA: PASS");
