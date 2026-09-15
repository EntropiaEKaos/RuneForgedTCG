import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { sealAuthState } from "@/lib/auth-secret-vault";
import { getAuthProviderSetting, oauthEndpoints, parseOAuthProvider, pkceChallenge, providerReady, safeAuthReturnTo } from "@/lib/identity-auth";

export const dynamic = "force-dynamic";
const OAUTH_COOKIE = "rf_oauth_tx";

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = parseOAuthProvider(raw);
  if (!provider) return Response.json({ ok: false, error: "Unsupported OAuth provider" }, { status: 404 });
  const setting = await getAuthProviderSetting(provider);
  if (!providerReady(setting)) return Response.json({ ok: false, error: "Provider is not available" }, { status: 503 });

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const returnTo = safeAuthReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/oauth/${provider}/callback`;
  const tx = sealAuthState({ provider, state, verifier, returnTo, redirectUri, exp: Date.now() + 10 * 60_000 });
  const store = await cookies();
  store.set(OAUTH_COOKIE, tx, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/oauth", maxAge: 600 });

  const endpoints = oauthEndpoints(provider);
  const url = new URL(endpoints.authorize);
  url.searchParams.set("client_id", setting!.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", endpoints.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", pkceChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  return NextResponse.redirect(url);
}
