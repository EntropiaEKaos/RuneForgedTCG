import { eq, sql } from "drizzle-orm";
import { playerPacks, players } from "@/db/schema";
import { recordEconomyTransaction } from "@/lib/economy-ledger";
import { levelFromXp } from "@/lib/achievements";

export interface GameGrantBundle {
  gold?: number;
  dust?: number;
  xp?: number;
  packs?: Array<{ packId: string; count: number }>;
  badges?: string[];
  title?: string;
}

function int(value: unknown, max = 10_000_000) {
  const n = Math.trunc(Number(value) || 0);
  return Math.max(0, Math.min(max, n));
}

export function sanitizeGameGrants(raw: unknown): GameGrantBundle {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const packs = Array.isArray(input.packs) ? input.packs.slice(0, 50).map((item) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    return { packId: String(row.packId || "").trim().slice(0, 80), count: Math.max(1, Math.min(1000, Math.trunc(Number(row.count) || 1))) };
  }).filter((row) => row.packId) : [];
  return {
    gold: int(input.gold), dust: int(input.dust), xp: int(input.xp), packs,
    badges: Array.isArray(input.badges) ? [...new Set(input.badges.map(String).map((x) => x.trim().slice(0, 80)).filter(Boolean))].slice(0, 30) : [],
    title: typeof input.title === "string" ? input.title.trim().slice(0, 80) : undefined,
  };
}


export function validateGrantPackIds(grants: GameGrantBundle, validPackIds: Iterable<string>): string[] {
  const valid = new Set(validPackIds);
  return [...new Set((grants.packs || []).map((p) => p.packId).filter((id) => !valid.has(id)))];
}

/** Apply a trusted server-side grant inside an existing transaction. */
export async function applyGameGrants(tx: any, input: {
  playerId: number;
  grants: GameGrantBundle;
  reason: string;
  referenceType: string;
  referenceId: string;
}) {
  const grants = sanitizeGameGrants(input.grants);
  const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).limit(1);
  if (!player) throw new Error("Player not found");
  await tx.execute(sql`SELECT id FROM players WHERE id = ${input.playerId} FOR UPDATE`);
  const [fresh] = await tx.select().from(players).where(eq(players.id, input.playerId)).limit(1);
  if (!fresh) throw new Error("Player not found");

  const gold = int(grants.gold), dust = int(grants.dust), xp = int(grants.xp);
  const nextBadges = [...new Set([...(Array.isArray(fresh.badges) ? fresh.badges.map(String) : []), ...(grants.badges || [])])].slice(0, 200);
  const updates: Record<string, unknown> = {};
  if (gold) updates.gold = sql`${players.gold} + ${gold}`;
  if (dust) updates.dust = sql`${players.dust} + ${dust}`;
  if (xp) { updates.xp = sql`${players.xp} + ${xp}`; updates.level = levelFromXp(fresh.xp + xp); }
  if ((grants.badges || []).length) updates.badges = nextBadges;
  if (grants.title) updates.title = grants.title;
  if (Object.keys(updates).length) await tx.update(players).set(updates).where(eq(players.id, fresh.id));

  if (gold) await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "gold", amount: gold, balanceAfter: fresh.gold + gold, reason: input.reason, referenceType: input.referenceType, referenceId: input.referenceId });
  if (dust) await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "dust", amount: dust, balanceAfter: fresh.dust + dust, reason: input.reason, referenceType: input.referenceType, referenceId: input.referenceId });
  if (xp) await recordEconomyTransaction(tx, { playerId: fresh.id, currency: "xp", amount: xp, balanceAfter: fresh.xp + xp, reason: input.reason, referenceType: input.referenceType, referenceId: input.referenceId });

  for (const pack of grants.packs || []) {
    await tx.insert(playerPacks).values({ playerId: fresh.id, packType: pack.packId, count: pack.count })
      .onConflictDoUpdate({ target: [playerPacks.playerId, playerPacks.packType], set: { count: sql`${playerPacks.count} + ${pack.count}` } });
  }
  return { gold, dust, xp, packs: grants.packs || [], badges: grants.badges || [], title: grants.title || null };
}
