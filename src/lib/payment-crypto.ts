import crypto from "node:crypto";

function paymentKey() {
  const source = process.env.PAYMENT_ENCRYPTION_KEY?.trim() || "";
  if (source.length < 32) throw new Error("PAYMENT_ENCRYPTION_KEY must contain at least 32 characters");
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptPaymentSecret(secret: string): string {
  const clear = secret.trim();
  if (!clear) throw new Error("Payment secret cannot be empty");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", paymentKey(), iv);
  const encrypted = Buffer.concat([cipher.update(clear, "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptPaymentSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (!value.startsWith("enc:v1:")) throw new Error("Unencrypted payment secret refused");
  const [, version, ivRaw, tagRaw, dataRaw] = value.split(":");
  if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted payment secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", paymentKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function paymentSecretFingerprint(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const clear = decryptPaymentSecret(value);
    return crypto.createHash("sha256").update(clear).digest("hex").slice(0, 12);
  } catch { return null; }
}
