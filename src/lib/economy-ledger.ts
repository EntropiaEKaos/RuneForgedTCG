import { economyTransactions } from "@/db/schema";

/** Append-only audit record for a balance mutation. Call inside the same DB transaction as the mutation. */
export async function recordEconomyTransaction(
  tx: any,
  input: { playerId: number; currency: "gold" | "dust" | "xp"; amount: number; balanceAfter: number; reason: string; referenceType?: string; referenceId?: string },
) {
  if (!input.amount) return;
  await tx.insert(economyTransactions).values({
    playerId: input.playerId,
    currency: input.currency,
    amount: input.amount,
    balanceAfter: input.balanceAfter,
    reason: input.reason,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
  });
}
