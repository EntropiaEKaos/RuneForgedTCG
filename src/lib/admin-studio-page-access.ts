import "server-only";
import { headers } from "next/headers";
import { getAdminSessionContext } from "./admin-auth";

export async function getStudioPageSession(pathname: string) {
  const incoming = await headers();
  const requestHeaders = new Headers();
  incoming.forEach((value, key) => requestHeaders.set(key, value));
  const host = incoming.get("host") || "localhost";
  const protocol = incoming.get("x-forwarded-proto") || "http";
  const request = new Request(`${protocol}://${host}${pathname}`, {
    method: "GET",
    headers: requestHeaders,
  });
  return getAdminSessionContext(request);
}
