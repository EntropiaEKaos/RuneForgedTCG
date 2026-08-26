const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

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
