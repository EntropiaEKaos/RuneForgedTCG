import assert from "node:assert/strict";
import { BattlefieldPresentationEventQueue } from "./BattlefieldPresentationEventQueue";
import { BattlefieldPresentationScheduler } from "./BattlefieldPresentationScheduler";

async function main(): Promise<void> {
  const order: number[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  
  const scheduler = new BattlefieldPresentationScheduler(
    new BattlefieldPresentationEventQueue(),
    async (item) => {
      order.push(item.sequence);
      if (item.sequence === 1) await firstGate;
    },
  );
  
  scheduler.enqueue({ type: "priority", playerId: "p1" });
  scheduler.enqueue({ type: "damage", targetId: "unit-1", amount: 4 });
  await Promise.resolve();
  assert.deepEqual(order, [1]);
  assert.equal(scheduler.busy, true);
  
  releaseFirst?.();
  await scheduler.pump();
  assert.deepEqual(order, [1, 2]);
  assert.equal(scheduler.busy, false);
  
  const recovered: number[] = [];
  const recovery = new BattlefieldPresentationScheduler(
    new BattlefieldPresentationEventQueue(),
    async (item) => {
      recovered.push(item.sequence);
      if (item.sequence === 1) throw new Error("visual driver failure");
    },
  );
  recovery.enqueue({ type: "priority", playerId: "p2" });
  recovery.enqueue({ type: "death", entityId: "unit-9" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await recovery.pump().catch(() => undefined);
  assert.equal(recovery.busy, false);
  assert.deepEqual(recovered, [1, 2]);
  
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
