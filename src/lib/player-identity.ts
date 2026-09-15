import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { playerIdentities, players } from "@/db/schema";
import { getRuntimeStarterWallet } from "@/lib/control-plane";
import { getPlayerSession, setPlayerSession } from "@/lib/player-session";
import type { AuthProvider } from "@/lib/identity-auth";

export class IdentityConflictError extends Error {
  constructor() { super("This identity is already linked to another RuneForge account"); }
}

export type ExternalIdentityProfile = {
  provider: AuthProvider;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
};

async function allocateGuestName(tx: Parameters<Parameters<typeof db.transaction>[0]>[0]): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const candidate = `Guest-${randomBytes(4).toString("hex").toUpperCase()}`;
    const [existing] = await tx.select({ id: players.id }).from(players).where(eq(players.name, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Could not allocate authenticated player identity");
}

export async function establishExternalIdentity(req: Request, profile: ExternalIdentityProfile) {
  const subject = profile.subject.trim().slice(0, 240);
  if (!subject) throw new Error("External identity subject is required");
  const current = await getPlayerSession(req);
  const wallet = current ? null : await getRuntimeStarterWallet();

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(playerIdentities).where(and(
      eq(playerIdentities.provider, profile.provider),
      eq(playerIdentities.providerSubject, subject),
    )).limit(1).for("update");

    if (existing) {
      if (current && existing.playerId !== current.playerId) throw new IdentityConflictError();
      const [player] = await tx.select().from(players).where(eq(players.id, existing.playerId)).limit(1);
      if (!player) throw new Error("Linked RuneForge player is missing");
      await tx.update(playerIdentities).set({
        email: profile.email?.slice(0, 254) || existing.email,
        emailVerified: profile.emailVerified === true || existing.emailVerified,
        displayName: profile.displayName?.slice(0, 120) || existing.displayName,
        avatarUrl: profile.avatarUrl?.slice(0, 500) || existing.avatarUrl,
        lastLoginAt: new Date(),
      }).where(eq(playerIdentities.id, existing.id));
      return { player, created: false, linked: Boolean(current) };
    }

    if (current) {
      const [player] = await tx.select().from(players).where(eq(players.id, current.playerId)).limit(1);
      if (!player) throw new Error("Current RuneForge player is missing");
      await tx.insert(playerIdentities).values({
        playerId: player.id,
        provider: profile.provider,
        providerSubject: subject,
        email: profile.email?.slice(0, 254) || null,
        emailVerified: profile.emailVerified === true,
        displayName: profile.displayName?.slice(0, 120) || null,
        avatarUrl: profile.avatarUrl?.slice(0, 500) || null,
      });
      return { player, created: false, linked: true };
    }

    const name = await allocateGuestName(tx);
    const [player] = await tx.insert(players).values({
      name,
      gold: wallet?.gold ?? 100,
      dust: wallet?.dust ?? 0,
      xp: wallet?.xp ?? 0,
      level: 1,
    }).returning();
    await tx.insert(playerIdentities).values({
      playerId: player.id,
      provider: profile.provider,
      providerSubject: subject,
      email: profile.email?.slice(0, 254) || null,
      emailVerified: profile.emailVerified === true,
      displayName: profile.displayName?.slice(0, 120) || null,
      avatarUrl: profile.avatarUrl?.slice(0, 500) || null,
    });
    return { player, created: true, linked: false };
  });

  if (!current) await setPlayerSession(result.player.id, result.player.name);
  return result;
}
