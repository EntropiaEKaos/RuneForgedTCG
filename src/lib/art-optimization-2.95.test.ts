import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { detectAssetType, validateAssetPayload } from "./asset-storage";
import { generateImageDerivatives } from "./image-derivatives";

const checks: string[] = [];
const pass = (condition: unknown, label: string) => { assert.ok(condition, label); checks.push(label); };
const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

async function main() {
  const source = await sharp({ create: { width: 2200, height: 1400, channels: 4, background: { r: 24, g: 54, b: 96, alpha: 1 } } })
    .png({ compressionLevel: 9 }).toBuffer();
  const detected = detectAssetType(source);
  pass(detected?.mimeType === "image/png", "generated PNG is detected by magic bytes");
  pass(Boolean(detected && validateAssetPayload(source, detected)?.width === 2200), "source dimensions pass structural validation");
  assert.ok(detected);
  const result = await generateImageDerivatives(source, detected);
  pass(result.status === "ready", "static card art produces optimized derivatives");
  pass(result.derivatives.map((row) => row.format).join(",") === "webp,avif", "pipeline emits WebP and AVIF");
  pass(result.derivatives.every((row) => row.width <= result.maxDimension && row.height <= result.maxDimension), "derivatives obey maximum dimension");
  pass(result.derivatives.every((row) => row.sha256 === crypto.createHash("sha256").update(row.bytes).digest("hex")), "derivative digests match encoded bytes");
  pass(result.derivatives.every((row) => row.size === row.bytes.length && row.size > 0), "derivative metadata reports real encoded sizes");

  const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.alloc(7), Buffer.from([0x3b])]);
  const gifDetected = detectAssetType(gif);
  assert.ok(gifDetected);
  const gifResult = await generateImageDerivatives(gif, gifDetected);
  pass(gifResult.status === "skipped" && gifResult.reason === "animated-or-gif-source", "GIF source is never silently flattened");

  const upload = read("src/app/api/admin/assets/upload/route.ts");
  const artApi = read("src/app/api/admin/studio/art/route.ts");
  const artUi = read("src/app/admin/studio/art/ArtPipelineClient.tsx");
  pass(upload.includes("generateImageDerivatives") && upload.includes("preferredUrl") && upload.includes("variants: { original: originalVariant"), "upload persists original plus optimized variant metadata");
  pass(artApi.includes('choice === "avif"') && artApi.includes('choice === "webp" || choice === "auto"'), "art publication supports AVIF and WebP with auto preference");
  pass(artUi.includes("Auto · WebP preferido") && artUi.includes("Economia"), "Studio exposes codec selection and byte savings");
  pass(read("package.json").includes('"sharp": "0.35.4"'), "sharp encoder is exact-pinned");

  console.log(`ART OPTIMIZATION 2.95: ${checks.length}/${checks.length} PASS`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
