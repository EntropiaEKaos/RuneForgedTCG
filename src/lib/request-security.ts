const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class RequestBodyTooLargeError extends Error {
  readonly code = "REQUEST_BODY_TOO_LARGE";
  constructor(readonly maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
  }
}

export function isMutationRequest(method: string): boolean {
  return !SAFE_METHODS.has(method.toUpperCase());
}

export function requestOriginAllowed(request: Request): boolean {
  if (!isMutationRequest(request.method)) return true;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (!origin) return fetchSite == null || fetchSite === "same-origin" || fetchSite === "none";
  try {
    const parsed = new URL(origin);
    const trustProxy = process.env.TRUST_PROXY === "true";
    const forwardedHost = trustProxy ? request.headers.get("x-forwarded-host")?.split(",")[0].trim() : null;
    const host = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    const forwardedProto = trustProxy ? request.headers.get("x-forwarded-proto")?.split(",")[0].trim() : null;
    const protocol = forwardedProto ? `${forwardedProto}:` : new URL(request.url).protocol;
    return parsed.host === host && parsed.protocol === protocol;
  } catch {
    return false;
  }
}

export function apiRequestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

/**
 * Parse JSON while enforcing the byte limit on the actual request stream.
 * A Content-Length precheck is only an optimization; the streamed byte count is
 * authoritative so chunked/unknown-length requests cannot bypass the limit.
 */
export async function readBoundedJson<T = unknown>(request: Request, maxBytes: number): Promise<T> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError("maxBytes must be a positive safe integer");
  const declaredRaw = request.headers.get("content-length");
  if (declaredRaw) {
    const declared = Number(declaredRaw);
    if (Number.isFinite(declared) && declared > maxBytes) throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!request.body) throw new SyntaxError("Request body is empty");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
