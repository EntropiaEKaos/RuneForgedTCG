import type { BattlefieldPresentationEvent } from "../battlefield-lab-scenario";
import { BattlefieldPresentationEventQueue, type BattlefieldQueuedPresentationEvent } from "./BattlefieldPresentationEventQueue";

export type BattlefieldPresentationSchedulerDriver = (
  item: BattlefieldQueuedPresentationEvent,
) => void | Promise<void>;

export class BattlefieldPresentationScheduler {
  private running = false;

  constructor(
    private readonly queue: BattlefieldPresentationEventQueue,
    private readonly driver: BattlefieldPresentationSchedulerDriver,
  ) {}

  enqueue(event: BattlefieldPresentationEvent): BattlefieldQueuedPresentationEvent {
    const item = this.queue.enqueue(event);
    void this.pump();
    return item;
  }

  async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (true) {
        const item = this.queue.beginNext();
        if (!item) break;
        try {
          await this.driver(item);
        } finally {
          this.queue.complete(item.sequence);
        }
      }
    } finally {
      this.running = false;
    }
  }

  clear(): void {
    this.queue.clear();
  }

  get busy(): boolean {
    return this.running || this.queue.active !== null;
  }
}
