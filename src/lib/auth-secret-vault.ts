import crypto from "node:crypto";

function authKey(): Buffer {
  const dedicated = process.env.AUTH_SECRETS_ENCRYPTION_KEY?.trim() || "";
  const transitional = process.env.PAYMENT_ENCRYPTION_KEY?.trim() || "";
  const source = dedicated || transitional;
  if (source.length < 32) throw new Error("AUTH_SECRETS_ENCRYPTION_KEY or PAYMENT_ENCRYPTION_KEY must contain at least 32 characters");
  return crypto.createHash("sha256").update(`runeforge:identity-auth:v1:${source}`).digest();
}

export function encryptAuthSecret(secret: string): string {
  const clear = secret.trim();
  if (!clear) throw new Error("Auth secret cannot be empty");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", authKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clear, "utf8"), cipher.final()]);
  return `auth:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptAuthSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("auth:v1:")) throw new Error("Unencrypted auth secret refused");
  const [, version, ivRaw, tagRaw, dataRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted auth secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", authKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function authSecretFingerprint(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return crypto.createHash("sha256").update(decryptAuthSecret(value)).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

export function sealAuthState(payload: unknown): string {
  return encryptAuthSecret(JSON.stringify(payload));
}

export function unsealAuthState<T>(value: string | null | undefined): T | null {
  try {
    return JSON.parse(decryptAuthSecret(value)) as T;
  } catch {
    return null;
  }
}
