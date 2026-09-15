import crypto from "node:crypto";

type AuthKeySlot = "d" | "p";

function configuredSource(slot: AuthKeySlot): string {
  const value = slot === "d"
    ? process.env.AUTH_SECRETS_ENCRYPTION_KEY?.trim() || ""
    : process.env.PAYMENT_ENCRYPTION_KEY?.trim() || "";
  if (value.length < 32) {
    const name = slot === "d" ? "AUTH_SECRETS_ENCRYPTION_KEY" : "PAYMENT_ENCRYPTION_KEY";
    throw new Error(`${name} must contain at least 32 characters`);
  }
  return value;
}

function activeSlot(): AuthKeySlot {
  if ((process.env.AUTH_SECRETS_ENCRYPTION_KEY?.trim() || "").length >= 32) return "d";
  if ((process.env.PAYMENT_ENCRYPTION_KEY?.trim() || "").length >= 32) return "p";
  throw new Error("AUTH_SECRETS_ENCRYPTION_KEY or PAYMENT_ENCRYPTION_KEY must contain at least 32 characters");
}

function authKey(slot: AuthKeySlot): Buffer {
  const source = configuredSource(slot);
  return crypto.createHash("sha256").update(`runeforge:identity-auth:v2:${slot}:${source}`).digest();
}

function decryptWithKey(value: { ivRaw: string; tagRaw: string; dataRaw: string }, key: Buffer): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(value.ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(value.tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(value.dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptAuthSecret(secret: string): string {
  const clear = secret.trim();
  if (!clear) throw new Error("Auth secret cannot be empty");
  const slot = activeSlot();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", authKey(slot), iv);
  const encrypted = Buffer.concat([cipher.update(clear, "utf8"), cipher.final()]);
  return `auth:v2:${slot}:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptAuthSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("auth:v2:")) {
    const [, version, slotRaw, ivRaw, tagRaw, dataRaw] = value.split(":");
    if (version !== "v2" || (slotRaw !== "d" && slotRaw !== "p") || !ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted auth secret");
    return decryptWithKey({ ivRaw, tagRaw, dataRaw }, authKey(slotRaw));
  }
  // Transitional v1 support lets an already-written provider secret survive
  // the introduction of a dedicated Auth root key. New writes always carry
  // their key slot explicitly through the v2 envelope above.
  if (value.startsWith("auth:v1:")) {
    const [, version, ivRaw, tagRaw, dataRaw] = value.split(":");
    if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted auth secret");
    const candidates = [
      process.env.AUTH_SECRETS_ENCRYPTION_KEY?.trim() || "",
      process.env.PAYMENT_ENCRYPTION_KEY?.trim() || "",
    ].filter((source, index, all) => source.length >= 32 && all.indexOf(source) === index);
    for (const source of candidates) {
      try {
        const key = crypto.createHash("sha256").update(`runeforge:identity-auth:v1:${source}`).digest();
        return decryptWithKey({ ivRaw, tagRaw, dataRaw }, key);
      } catch {
        // Try the other configured transitional root, if present.
      }
    }
    throw new Error("Encrypted auth secret cannot be opened with configured roots");
  }
  throw new Error("Unencrypted auth secret refused");
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
