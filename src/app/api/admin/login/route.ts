import { NextRequest } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  authenticateAdminUser,
  createAdminSession,
  revokeAdminSession,
} from "@/lib/admin-auth";
import { consumeRequestRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get("content-length") || 0) > 16_000) {
      return Response.json({ ok: false, error: "Payload too large" }, { status: 413 });
    }
    const rate = await consumeRequestRateLimit(req, "admin-login", 8, 60_000);
    if (!rate.allowed) {
      return Response.json({ ok: false, error: "Too many login attempts" }, { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } });
    }
    const body = await req.json();
    const user = await authenticateAdminUser(
      String(body.username || "admin").trim(),
      String(body.password || ""),
      body.totp ? String(body.totp) : undefined,
    );
    if (!user) return Response.json({ ok: false, error: "Invalid credentials or MFA code" }, { status: 401 });
    const token = await createAdminSession({ id: user.id, username: user.username, role: user.role });
    const response = Response.json({ ok: true, user: { username: user.username, role: user.role } });
    response.headers.append(
      "Set-Cookie",
      `${ADMIN_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${ADMIN_SESSION_MAX_AGE}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch {
    return Response.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  await revokeAdminSession(req);
  const response = Response.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  return response;
}
