import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { unsealAuthState } from "@/lib/auth-secret-vault";
import { getAuthProviderSetting, oauthEndpoints, parseOAuthProvider, providerReady, providerSecret, safeAuthReturnTo } from "@/lib/identity-auth";
import { establishExternalIdentity, IdentityConflictError } from "@/lib/player-identity";

export const dynamic = "force-dynamic";
const OAUTH_COOKIE = "rf_oauth_tx";
type OAuthTx = { provider: string; state: string; verifier: string; returnTo: string; redirectUri: string; exp: number };

function redirectError(req: NextRequest, code: string, returnTo?: string | null) {
  const url = new URL(safeAuthReturnTo(returnTo || "/play"), req.nextUrl.origin);
  url.searchParams.set("auth_error", code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = parseOAuthProvider(raw);
  if (!provider) return redirectError(req, "unsupported_provider");
  const store = await cookies();
  const tx = unsealAuthState<OAuthTx>(store.get(OAUTH_COOKIE)?.value);
  store.set(OAUTH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/oauth", maxAge: 0 });
  const state = req.nextUrl.searchParams.get("state") || "";
  const code = req.nextUrl.searchParams.get("code") || "";
  if (req.nextUrl.searchParams.get("error")) return redirectError(req, "provider_cancelled", tx?.returnTo);
  if (!tx || tx.provider !== provider || tx.state !== state || tx.exp < Date.now() || !code) return redirectError(req, "invalid_oauth_state", tx?.returnTo);

  const setting = await getAuthProviderSetting(provider);
  if (!setting || !providerReady(setting)) return redirectError(req, "provider_unavailable", tx.returnTo);
  try {
    const endpoints = oauthEndpoints(provider);
    const form = new URLSearchParams({
      client_id: setting.clientId,
      client_secret: providerSecret(setting),
      grant_type: "authorization_code",
      code,
      redirect_uri: tx.redirectUri,
      code_verifier: tx.verifier,
    });
    const tokenResponse = await fetch(endpoints.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: form,
      cache: "no-store",
    });
    const tokenPayload = await tokenResponse.json().catch(() => ({})) as { access_token?: string };
    if (!tokenResponse.ok || !tokenPayload.access_token) return redirectError(req, "token_exchange_failed", tx.returnTo);
    const profileResponse = await fetch(endpoints.userInfo, { headers: { authorization: `Bearer ${tokenPayload.access_token}` }, cache: "no-store" });
    const p = await profileResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!profileResponse.ok) return redirectError(req, "profile_fetch_failed", tx.returnTo);

    let subject = "", email: string | null = null, displayName: string | null = null, avatarUrl: string | null = null, emailVerified = false;
    if (provider === "google") {
      subject = String(p.sub || "").trim();
      email = typeof p.email === "string" ? p.email.trim().toLowerCase() : null;
      displayName = typeof p.name === "string" ? p.name : null;
      avatarUrl = typeof p.picture === "string" ? p.picture : null;
      emailVerified = p.email_verified === true;
    } else {
      subject = String(p.id || "").trim();
      email = typeof p.email === "string" ? p.email.trim().toLowerCase() : null;
      displayName = typeof p.global_name === "string" ? p.global_name : typeof p.username === "string" ? p.username : null;
      emailVerified = p.verified === true;
      if (subject && typeof p.avatar === "string" && p.avatar) avatarUrl = `https://cdn.discordapp.com/avatars/${subject}/${p.avatar}.png?size=256`;
    }
    if (!subject) return redirectError(req, "profile_subject_missing", tx.returnTo);
    await establishExternalIdentity(req, { provider, subject, email, emailVerified, displayName, avatarUrl });
    const returnTo = new URL(safeAuthReturnTo(tx.returnTo), req.nextUrl.origin);
    returnTo.searchParams.set("auth", provider);
    return NextResponse.redirect(returnTo);
  } catch (error) {
    if (error instanceof IdentityConflictError) return redirectError(req, "identity_conflict", tx.returnTo);
    console.error("[identity-auth] OAuth callback failed", error);
    return redirectError(req, "oauth_failed", tx.returnTo);
  }
}
