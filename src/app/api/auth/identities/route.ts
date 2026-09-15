import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { authProviderSettings, playerIdentities } from "@/db/schema";
import { AUTH_PROVIDERS, providerReady } from "@/lib/identity-auth";
import { getPlayerSession } from "@/lib/player-session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getPlayerSession(req);
  if (!session) return Response.json({ ok: false, error: "Authentication required" }, { status: 401 });

  const [settings, identities] = await Promise.all([
    db.select().from(authProviderSettings),
    db.select({
      provider: playerIdentities.provider,
      email: playerIdentities.email,
      emailVerified: playerIdentities.emailVerified,
      displayName: playerIdentities.displayName,
      avatarUrl: playerIdentities.avatarUrl,
      createdAt: playerIdentities.createdAt,
      lastLoginAt: playerIdentities.lastLoginAt,
    }).from(playerIdentities).where(eq(playerIdentities.playerId, session.playerId)),
  ]);

  const settingsByProvider = new Map(settings.map((row) => [row.provider, row]));
  const identitiesByProvider = new Map(identities.map((row) => [row.provider, row]));
  return Response.json({
    ok: true,
    player: { id: session.playerId, name: session.playerName },
    providers: AUTH_PROVIDERS.map((provider) => {
      const setting = settingsByProvider.get(provider) ?? null;
      const identity = identitiesByProvider.get(provider) ?? null;
      return {
        provider,
        available: Boolean(setting && providerReady(setting)),
        linked: Boolean(identity),
        identity: identity ? {
          email: identity.email,
          emailVerified: identity.emailVerified,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          createdAt: identity.createdAt,
          lastLoginAt: identity.lastLoginAt,
        } : null,
      };
    }),
  });
}
