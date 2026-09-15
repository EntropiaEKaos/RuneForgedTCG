import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authLoginTokens } from "@/db/schema";
import { safeAuthReturnTo } from "@/lib/identity-auth";
import { establishExternalIdentity, IdentityConflictError } from "@/lib/player-identity";

export const dynamic = "force-dynamic";

function fail(req: NextRequest, code: string) {
  const url = new URL("/play", req.nextUrl.origin);
  url.searchParams.set("auth_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (token.length < 32 || token.length > 128) return fail(req, "invalid_magic_link");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const login = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(authLoginTokens).where(and(
      eq(authLoginTokens.tokenHash, tokenHash),
      eq(authLoginTokens.provider, "email"),
      isNull(authLoginTokens.consumedAt),
      gt(authLoginTokens.expiresAt, new Date()),
    )).limit(1).for("update");
    if (!row) return null;
    await tx.update(authLoginTokens).set({ consumedAt: new Date() }).where(eq(authLoginTokens.id, row.id));
    return row;
  });
  if (!login) return fail(req, "expired_magic_link");
  try {
    await establishExternalIdentity(req, { provider: "email", subject: login.subject, email: login.subject, emailVerified: true, displayName: null, avatarUrl: null });
    const target = new URL(safeAuthReturnTo(req.nextUrl.searchParams.get("returnTo")), req.nextUrl.origin);
    target.searchParams.set("auth", "email");
    return NextResponse.redirect(target);
  } catch (error) {
    if (error instanceof IdentityConflictError) return fail(req, "identity_conflict");
    console.error("[identity-auth] Magic-link callback failed", error);
    return fail(req, "magic_link_failed");
  }
}
