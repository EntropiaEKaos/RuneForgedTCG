import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authProviderSettings } from "@/db/schema";
import { decryptAuthSecret } from "./auth-secret-vault";

export const AUTH_PROVIDERS = ["google", "discord", "email"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];
export type OAuthProvider = Exclude<AuthProvider, "email">;

export function parseAuthProvider(value: unknown): AuthProvider | null {
  return typeof value === "string" && (AUTH_PROVIDERS as readonly string[]).includes(value) ? value as AuthProvider : null;
}

export function parseOAuthProvider(value: unknown): OAuthProvider | null {
  return value === "google" || value === "discord" ? value : null;
}

export function safeAuthReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/play";
  return value.slice(0, 500);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function pkceChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function getAuthProviderSetting(provider: AuthProvider) {
  const [row] = await db.select().from(authProviderSettings).where(eq(authProviderSettings.provider, provider)).limit(1);
  return row ?? null;
}

export function providerReady(row: { enabled: boolean; clientId: string; secretEncrypted: string | null } | null): boolean {
  return Boolean(row?.enabled && row.clientId.trim() && row.secretEncrypted);
}

export function providerSecret(row: { secretEncrypted: string | null }): string {
  return decryptAuthSecret(row.secretEncrypted);
}

export function oauthEndpoints(provider: OAuthProvider) {
  if (provider === "google") return {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    userInfo: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  };
  return {
    authorize: "https://discord.com/oauth2/authorize",
    token: "https://discord.com/api/oauth2/token",
    userInfo: "https://discord.com/api/users/@me",
    scope: "identify email",
  };
}
