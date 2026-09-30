import type { BattlefieldPresentationEvent } from "../battlefield-lab-scenario";
import { BattlefieldPresentationEventQueue, type BattlefieldQueuedPresentationEvent } from "./BattlefieldPresentationEventQueue";

export type BattlefieldPresentationSchedulerDriver = (
  item: BattlefieldQueuedPresentationEvent,
) => void | Promise<void>;

export class BattlefieldPresentationScheduler {
  private running = false;
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly queue: BattlefieldPresentationEventQueue,
    private readonly driver: BattlefieldPresentationSchedulerDriver,
  ) {}

  enqueue(event: BattlefieldPresentationEvent): BattlefieldQueuedPresentationEvent {
    const item = this.queue.enqueue(event);
    void this.pump().catch(() => undefined);
    return item;
  }

  pump(): Promise<void> {
    if (this.activeRun) return this.activeRun;

    this.running = true;
    this.activeRun = this.runQueue().finally(() => {
      this.running = false;
      this.activeRun = null;
    });
    return this.activeRun;
  }

  private async runQueue(): Promise<void> {
    while (true) {
      const item = this.queue.beginNext();
      if (!item) break;
      try {
        await this.driver(item);
      } finally {
        this.queue.complete(item.sequence);
      }
    }
  }

  clear(): void {
    this.queue.clear();
  }

  get busy(): boolean {
    return this.running || this.queue.active !== null;
  }
}
