import { NextRequest, NextResponse } from "next/server";
import { apiRequestId, isMutationRequest, requestOriginAllowed } from "@/lib/request-security";

function csp(nonce: string): string {
  let assetOrigin = "";
  try {
    const configured = process.env.ASSET_PUBLIC_BASE_URL?.trim();
    if (configured) assetOrigin = ` ${new URL(configured).origin}`;
  } catch { /* invalid storage config is handled by release preflight/upload */ }
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${assetOrigin}`,
    `media-src 'self' blob:${assetOrigin}`,
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

async function bodyExceedsLimit(request: NextRequest, maxBodyBytes: number): Promise<boolean> {
  if (!isMutationRequest(request.method)) return false;
  const rawLength = request.headers.get("content-length");
  if (rawLength) {
    const contentLength = Number(rawLength);
    return Number.isFinite(contentLength) && contentLength > maxBodyBytes;
  }
  if (!request.body) return false;

  // HTTP/2/chunked bodies can omit Content-Length. Measure a clone so the
  // actual route still receives the untouched request stream.
  const reader = request.clone().body?.getReader();
  if (!reader) return false;
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return false;
      total += value?.byteLength ?? 0;
      if (total > maxBodyBytes) {
        await reader.cancel();
        return true;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function proxy(request: NextRequest) {
  const requestId = apiRequestId(request);
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith("/api/");
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = csp(nonce);

  if (isApi) {
    const configuredLimit = Math.max(64_000, Math.min(10_000_000, Number(process.env.MAX_API_BODY_BYTES) || 2_000_000));
    // Multipart asset upload has its own magic-byte validation and 12 MB cap.
    const maxBodyBytes = pathname === "/api/admin/assets/upload" ? 13_000_000 : configuredLimit;
    if (await bodyExceedsLimit(request, maxBodyBytes)) {
      return NextResponse.json({ ok: false, error: "Payload too large", requestId }, { status: 413, headers: { "x-request-id": requestId, "cache-control": "no-store", "Content-Security-Policy": policy } });
    }
    if (!requestOriginAllowed(request)) {
      return NextResponse.json(
        { ok: false, error: "Cross-origin mutation rejected", requestId },
        { status: 403, headers: { "x-request-id": requestId, "cache-control": "no-store", "Content-Security-Policy": policy } },
      );
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("Content-Security-Policy", policy);
  if (isApi) response.headers.set("cache-control", "no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
