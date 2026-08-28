import { and, eq } from "drizzle-orm";
import { economyActionReceipts } from "@/db/schema";

const OPERATION_ID = /^[A-Za-z0-9._:-]{16,100}$/;

export function economyOperationId(request: Request, body: Record<string, unknown>): string | null {
  const raw = String(request.headers.get("x-operation-id") || body.operationId || "").trim();
  return OPERATION_ID.test(raw) ? raw : null;
}

export async function runIdempotentEconomyAction<T extends Record<string, unknown>>(
  tx: any,
  input: { playerId: number; operationId: string; action: string },
  execute: () => Promise<T>,
): Promise<{ duplicate: boolean; response: T }> {
  const inserted = await tx.insert(economyActionReceipts).values({
    playerId: input.playerId,
    operationId: input.operationId,
    action: input.action,
    response: {},
  }).onConflictDoNothing({ target: [economyActionReceipts.playerId, economyActionReceipts.operationId] }).returning({ id: economyActionReceipts.id });

  if (!inserted.length) {
    const [existing] = await tx.select().from(economyActionReceipts).where(and(
      eq(economyActionReceipts.playerId, input.playerId),
      eq(economyActionReceipts.operationId, input.operationId),
    )).limit(1);
    if (!existing) throw new Error("Economy operation receipt collision");
    if (existing.action !== input.action) throw new Error("OPERATION_ID_REUSED_FOR_DIFFERENT_ACTION");
    return { duplicate: true, response: existing.response as T };
  }

  const response = await execute();
  await tx.update(economyActionReceipts).set({ response }).where(eq(economyActionReceipts.id, inserted[0].id));
  return { duplicate: false, response };
}
