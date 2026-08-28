import crypto from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

export interface DetectedAsset {
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "audio/mpeg" | "audio/ogg" | "audio/wav";
  extension: "png" | "jpg" | "webp" | "gif" | "mp3" | "ogg" | "wav";
  kind: "image" | "audio";
}

export function detectAssetType(bytes: Buffer): DetectedAsset | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const ascii = (offset: number, value: string) => bytes.subarray(offset, offset + value.length).toString("ascii") === value;
  if (bytes.length >= 8 && starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mimeType: "image/png", extension: "png", kind: "image" };
  if (bytes.length >= 3 && starts(0xff, 0xd8, 0xff)) return { mimeType: "image/jpeg", extension: "jpg", kind: "image" };
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return { mimeType: "image/webp", extension: "webp", kind: "image" };
  if (bytes.length >= 6 && (ascii(0, "GIF87a") || ascii(0, "GIF89a"))) return { mimeType: "image/gif", extension: "gif", kind: "image" };
  if (bytes.length >= 4 && ascii(0, "OggS")) return { mimeType: "audio/ogg", extension: "ogg", kind: "audio" };
  if (bytes.length >= 12 && ascii(0, "RIFF") && ascii(8, "WAVE")) return { mimeType: "audio/wav", extension: "wav", kind: "audio" };
  if (bytes.length >= 3 && ascii(0, "ID3")) return { mimeType: "audio/mpeg", extension: "mp3", kind: "audio" };
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { mimeType: "audio/mpeg", extension: "mp3", kind: "audio" };
  return null;
}

export interface ValidatedAssetMetadata {
  width?: number;
  height?: number;
}

const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 40_000_000;
function saneDimensions(width: number, height: number): boolean {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && width * height <= MAX_IMAGE_PIXELS;
}

/** Structural validation beyond magic bytes. Rejects truncated headers and image bombs. */
export function validateAssetPayload(bytes: Buffer, detected: DetectedAsset): ValidatedAssetMetadata | null {
  const ascii = (offset: number, value: string) => bytes.subarray(offset, offset + value.length).toString("ascii") === value;
  if (detected.mimeType === "image/png") {
    if (bytes.length < 45 || bytes.readUInt32BE(8) !== 13 || !ascii(12, "IHDR") || !ascii(bytes.length - 8, "IEND")) return null;
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    return saneDimensions(width, height) ? { width, height } : null;
  }
  if (detected.mimeType === "image/gif") {
    if (bytes.length < 14 || bytes[bytes.length - 1] !== 0x3b) return null;
    const width = bytes.readUInt16LE(6), height = bytes.readUInt16LE(8);
    return saneDimensions(width, height) ? { width, height } : null;
  }
  if (detected.mimeType === "image/webp") {
    if (bytes.length < 20 || !ascii(0, "RIFF") || !ascii(8, "WEBP")) return null;
    const declared = bytes.readUInt32LE(4) + 8;
    if (declared > bytes.length || declared < 20) return null;
    const chunk = bytes.subarray(12, 16).toString("ascii");
    if (!new Set(["VP8 ", "VP8L", "VP8X"]).has(chunk)) return null;
    if (chunk === "VP8X" && bytes.length >= 30) {
      const width = 1 + bytes.readUIntLE(24, 3), height = 1 + bytes.readUIntLE(27, 3);
      return saneDimensions(width, height) ? { width, height } : null;
    }
    return {};
  }
  if (detected.mimeType === "image/jpeg") {
    if (bytes.length < 12 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
    let offset = 2;
    while (offset + 4 <= bytes.length - 2) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1]; offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 7) {
        const height = bytes.readUInt16BE(offset + 3), width = bytes.readUInt16BE(offset + 5);
        return saneDimensions(width, height) ? { width, height } : null;
      }
      offset += length;
    }
    return null;
  }
  if (detected.mimeType === "audio/wav") {
    if (bytes.length < 44 || !ascii(0, "RIFF") || !ascii(8, "WAVE") || bytes.readUInt32LE(4) + 8 > bytes.length) return null;
    return ascii(12, "fmt ") && bytes.includes(Buffer.from("data"), 16) ? {} : null;
  }
  if (detected.mimeType === "audio/ogg") {
    if (bytes.length < 27 || !ascii(0, "OggS") || bytes[4] !== 0) return null;
    const segments = bytes[26];
    if (bytes.length < 27 + segments) return null;
    let payload = 0; for (let i = 0; i < segments; i += 1) payload += bytes[27 + i];
    return bytes.length >= 27 + segments + payload ? {} : null;
  }
  if (detected.mimeType === "audio/mpeg") {
    if (bytes.length < 4) return null;
    if (ascii(0, "ID3")) {
      if (bytes.length < 10) return null;
      const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
      return bytes.length >= 10 + size ? {} : null;
    }
    return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 ? {} : null;
  }
  return null;
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function sha256(value: Buffer | string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function awsDate(now = new Date()): { amzDate: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function encodePath(pathname: string): string {
  return pathname.split("/").map((part) => encodeURIComponent(decodeURIComponent(part))).join("/").replace(/%2F/gi, "/");
}

async function putS3Object(key: string, bytes: Buffer, mimeType: string): Promise<string> {
  const endpointRaw = process.env.ASSET_S3_ENDPOINT?.trim();
  const region = process.env.ASSET_S3_REGION?.trim() || "us-east-1";
  const bucket = process.env.ASSET_S3_BUCKET?.trim();
  const accessKey = process.env.ASSET_S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.ASSET_S3_SECRET_ACCESS_KEY?.trim();
  const publicBase = process.env.ASSET_PUBLIC_BASE_URL?.trim();
  if (!endpointRaw || !bucket || !accessKey || !secretKey || !publicBase) {
    throw new Error("S3 asset storage is not fully configured");
  }

  const endpoint = new URL(endpointRaw);
  if (endpoint.search) throw new Error("ASSET_S3_ENDPOINT must not contain a query string");
  const prefix = endpoint.pathname.replace(/\/$/, "");
  endpoint.pathname = `${prefix}/${bucket}/${key}`.replace(/\/+/g, "/");
  const canonicalUri = encodePath(endpoint.pathname);
  const payloadHash = sha256(bytes);
  const { amzDate, dateStamp } = awsDate();
  const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", canonicalUri, endpoint.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const requestBody = new Uint8Array(bytes.byteLength);
  requestBody.set(bytes);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      "authorization": authorization,
      "content-type": mimeType,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body: requestBody,
    signal: AbortSignal.timeout(Math.max(1_000, Math.min(60_000, Number(process.env.ASSET_STORAGE_TIMEOUT_MS) || 15_000))),
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    throw new Error(`Asset storage PUT failed (${response.status}): ${body || response.statusText}`);
  }
  return `${publicBase.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function deleteS3Object(key: string): Promise<void> {
  const endpointRaw = process.env.ASSET_S3_ENDPOINT?.trim(), region = process.env.ASSET_S3_REGION?.trim() || "us-east-1";
  const bucket = process.env.ASSET_S3_BUCKET?.trim(), accessKey = process.env.ASSET_S3_ACCESS_KEY_ID?.trim(), secretKey = process.env.ASSET_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpointRaw || !bucket || !accessKey || !secretKey) return;
  const endpoint = new URL(endpointRaw); const prefix = endpoint.pathname.replace(/\/$/, ""); endpoint.pathname = `${prefix}/${bucket}/${key}`.replace(/\/+/g, "/");
  const canonicalUri = encodePath(endpoint.pathname), payloadHash = sha256(Buffer.alloc(0)), { amzDate, dateStamp } = awsDate();
  const canonicalHeaders = `host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`, signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const canonicalRequest = ["DELETE", canonicalUri, endpoint.searchParams.toString(), canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp), regionKey = hmac(dateKey, region), serviceKey = hmac(regionKey, "s3"), signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto.createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(endpoint, { method: "DELETE", headers: { authorization, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate }, signal: AbortSignal.timeout(Math.max(1_000, Math.min(60_000, Number(process.env.ASSET_STORAGE_TIMEOUT_MS) || 15_000))) });
  if (!response.ok && response.status !== 404) throw new Error(`Asset storage DELETE failed (${response.status})`);
}

export interface StoredAdminAsset { url: string; created: boolean; }

async function putLocalObject(filename: string, bytes: Buffer): Promise<StoredAdminAsset> {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_ASSET_STORAGE !== "true") {
    throw new Error("Local asset storage is disabled in production; configure ASSET_STORAGE_MODE=s3");
  }
  const directory = path.join(process.cwd(), "public", "uploads", "admin");
  await mkdir(directory, { recursive: true });
  let created = true;
  await writeFile(path.join(directory, filename), bytes, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
    created = false;
  });
  return { url: `/uploads/admin/${filename}`, created };
}

export async function storeAdminAsset(filename: string, bytes: Buffer, mimeType: string): Promise<StoredAdminAsset> {
  const mode = (process.env.ASSET_STORAGE_MODE?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "s3" : "local"));
  if (mode === "local") return putLocalObject(filename, bytes);
  if (mode === "s3") {
    // Content-addressed keys may already be referenced by published cards. A PUT
    // is safe/idempotent, but without a trustworthy HEAD precondition we must
    // conservatively treat S3 objects as pre-existing for rollback purposes.
    return { url: await putS3Object(`admin/${filename}`, bytes, mimeType), created: false };
  }
  throw new Error(`Unsupported ASSET_STORAGE_MODE: ${mode}`);
}

export async function deleteAdminAsset(filename: string): Promise<void> {
  const mode = (process.env.ASSET_STORAGE_MODE?.trim().toLowerCase() || (process.env.NODE_ENV === "production" ? "s3" : "local"));
  if (mode === "local") {
    const target = path.join(process.cwd(), "public", "uploads", "admin", path.basename(filename));
    await unlink(target).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
    return;
  }
  if (mode === "s3") { await deleteS3Object(`admin/${path.basename(filename)}`); return; }
}
