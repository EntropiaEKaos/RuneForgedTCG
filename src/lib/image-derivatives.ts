import crypto from "node:crypto";
import sharp from "sharp";
import type { DetectedAsset } from "./asset-storage";

export type ImageDerivativeFormat = "webp" | "avif";

export interface ImageDerivative {
  format: ImageDerivativeFormat;
  extension: ImageDerivativeFormat;
  mimeType: `image/${ImageDerivativeFormat}`;
  bytes: Buffer;
  size: number;
  width: number;
  height: number;
  sha256: string;
}

export interface ImageDerivativeResult {
  status: "ready" | "skipped" | "error";
  reason?: string;
  source: { width: number; height: number; pages: number } | null;
  maxDimension: number;
  derivatives: ImageDerivative[];
}

const MAX_INPUT_PIXELS = 40_000_000;

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
}

function derivativeConfig() {
  return {
    maxDimension: boundedInt(process.env.CARD_ART_MAX_DIMENSION, 1600, 640, 3200),
    webpQuality: boundedInt(process.env.CARD_ART_WEBP_QUALITY, 82, 45, 95),
    avifQuality: boundedInt(process.env.CARD_ART_AVIF_QUALITY, 55, 30, 85),
  };
}

function digest(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * Produces deterministic, deployment-friendly card-art derivatives. Animated
 * media is intentionally left untouched: flattening it silently would change
 * the editorial asset. The original upload always remains the source of truth.
 */
export async function generateImageDerivatives(bytes: Buffer, detected: DetectedAsset): Promise<ImageDerivativeResult> {
  const { maxDimension, webpQuality, avifQuality } = derivativeConfig();
  if (detected.kind !== "image") return { status: "skipped", reason: "not-image", source: null, maxDimension, derivatives: [] };
  if (detected.mimeType === "image/gif") return { status: "skipped", reason: "animated-or-gif-source", source: null, maxDimension, derivatives: [] };

  try {
    const input = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_INPUT_PIXELS, animated: false }).rotate();
    const metadata = await input.metadata();
    const width = Number(metadata.width || 0), height = Number(metadata.height || 0), pages = Number(metadata.pages || 1);
    if (!width || !height) return { status: "error", reason: "missing-dimensions", source: null, maxDimension, derivatives: [] };
    if (pages > 1) return { status: "skipped", reason: "animated-source", source: { width, height, pages }, maxDimension, derivatives: [] };

    const resized = input.resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true });
    const [webpOutput, avifOutput] = await Promise.all([
      resized.clone().webp({ quality: webpQuality, effort: 4, smartSubsample: true }).toBuffer({ resolveWithObject: true }),
      resized.clone().avif({ quality: avifQuality, effort: 4, chromaSubsampling: "4:2:0" }).toBuffer({ resolveWithObject: true }),
    ]);

    const make = (format: ImageDerivativeFormat, output: { data: Buffer; info: { width: number; height: number } }): ImageDerivative => ({
      format,
      extension: format,
      mimeType: `image/${format}`,
      bytes: output.data,
      size: output.data.length,
      width: output.info.width,
      height: output.info.height,
      sha256: digest(output.data),
    });
    return {
      status: "ready",
      source: { width, height, pages },
      maxDimension,
      derivatives: [make("webp", webpOutput), make("avif", avifOutput)],
    };
  } catch (error) {
    return {
      status: "error",
      reason: error instanceof Error ? error.message.slice(0, 180) : "image-encoder-failed",
      source: null,
      maxDimension,
      derivatives: [],
    };
  }
}
