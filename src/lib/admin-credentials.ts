import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function hashAdminPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyAdminPassword(password: string, salt: string, expected: string) {
  const actual = crypto.scryptSync(password, salt, 64);
  const exp = Buffer.from(expected, "hex");
  return actual.length === exp.length && crypto.timingSafeEqual(actual, exp);
}

export function generateMfaSecret() {
  let out = "";
  const bytes = crypto.randomBytes(20);
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

function base32Decode(value: string) {
  let bits = "";
  const out: number[] = [];
  for (const char of value.replace(/=+$/, "").toUpperCase()) {
    const numeric = ALPHABET.indexOf(char);
    if (numeric < 0) continue;
    bits += numeric.toString(2).padStart(5, "0");
    while (bits.length >= 8) {
      out.push(parseInt(bits.slice(0, 8), 2));
      bits = bits.slice(8);
    }
  }
  return Buffer.from(out);
}

export function totpCode(secret: string, time = Date.now()) {
  const counter = Math.floor(time / 30_000);
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const hash = crypto.createHmac("sha1", base32Decode(secret)).update(bytes).digest();
  const offset = hash[hash.length - 1] & 15;
  const value = ((hash[offset] & 127) << 24)
    | (hash[offset + 1] << 16)
    | (hash[offset + 2] << 8)
    | hash[offset + 3];
  return String(value % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, now = Date.now()) {
  return [-1, 0, 1].some((window) => {
    const expected = Buffer.from(totpCode(secret, now + window * 30_000));
    const supplied = Buffer.from(String(code));
    return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
  });
}

function mfaKey() {
  const source = process.env.MFA_ENCRYPTION_KEY?.trim() || "";
  if (source.length < 32) {
    throw new Error("MFA_ENCRYPTION_KEY must be configured independently with at least 32 characters");
  }
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptMfaSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", mfaKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptMfaSecret(value: string) {
  if (!value.startsWith("enc:v1:")) return value;
  const [, version, ivRaw, tagRaw, dataRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted MFA secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", mfaKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
